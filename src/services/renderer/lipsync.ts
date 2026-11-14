import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';

// Resolve ffmpeg path (prefer @ffmpeg-installer/ffmpeg if available)
let ffmpegBinPath = 'ffmpeg';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpegBinPath = ffmpegInstaller.path;
  }
} catch {
  // Use system ffmpeg
}

/**
 * Pre-analyzed mouth cavity openness metrics for the 127 Bangladeshi male news presenter frames (1080x608).
 * Index corresponds to frame_0001.jpg (0) through frame_0127.jpg (126).
 * Values normalized between 0.0 (fully closed lips) and 1.0 (wide open vowel).
 */
export const ANCHOR_MOUTH_OPENNESS: readonly number[] = Object.freeze([
  0.238, 0.217, 0.176, 0.146, 0.183, 0.198, 0.198, 0.161, 0.198, 0.195,
  0.248, 0.297, 0.350, 0.378, 0.644, 0.836, 0.498, 0.167, 0.198, 0.594,
  0.876, 0.929, 0.653, 0.279, 0.065, 0.074, 0.043, 0.028, 0.158, 0.226,
  0.084, 0.025, 0.065, 0.080, 0.080, 0.121, 0.133, 0.124, 0.084, 0.056,
  0.071, 0.056, 0.068, 0.074, 0.071, 0.155, 0.183, 0.158, 0.176, 0.164,
  0.176, 0.167, 0.176, 0.443, 0.567, 0.393, 0.421, 0.409, 0.477, 0.539,
  0.567, 0.415, 0.263, 0.325, 0.582, 0.164, 0.099, 0.316, 0.678, 0.598,
  0.576, 0.495, 0.443, 0.263, 0.192, 0.170, 0.087, 0.080, 0.068, 0.059,
  0.062, 0.037, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.053,
  0.099, 0.019, 0.022, 0.025, 0.031, 0.084, 0.084, 0.000, 0.003, 0.012,
  0.000, 0.006, 0.006, 0.037, 0.158, 0.012, 0.022, 0.022, 0.009, 0.635,
  1.000, 0.796, 0.737, 0.777, 0.687, 0.777, 0.746, 0.851, 0.879, 0.913,
  0.879, 0.889, 0.867, 0.876, 0.650, 0.409, 0.381
]);

export interface LipSyncTrajectory {
  baseFrames: number[];
  mouthFrames: number[];
  targetOpenness: number[];
  totalFrames: number;
}

export class LipSyncEngine {
  private static instance: LipSyncEngine | null = null;
  private readonly opennessTable: readonly number[];
  private readonly numFrames: number;

  // Pre-allocated canvases for high-speed zero-flicker compositing
  private readonly compCanvas: any;
  private readonly compCtx: any;
  private readonly maskCanvas: any;
  private readonly maskCtx: any;

  constructor(customOpenness?: number[]) {
    this.opennessTable = customOpenness && customOpenness.length > 0
      ? customOpenness
      : ANCHOR_MOUTH_OPENNESS;
    this.numFrames = this.opennessTable.length;

    // Anchor frame resolution: 1080 x 608
    this.compCanvas = createCanvas(1080, 608);
    this.compCtx = this.compCanvas.getContext('2d');
    this.maskCanvas = createCanvas(1080, 608);
    this.maskCtx = this.maskCanvas.getContext('2d');
  }

  public static getInstance(): LipSyncEngine {
    if (!LipSyncEngine.instance) {
      LipSyncEngine.instance = new LipSyncEngine();
    }
    return LipSyncEngine.instance;
  }

  /**
   * Decodes an audio file or buffer into 16kHz 16-bit signed mono PCM.
   */
  private decodeToPcm(audioSource: string | Buffer): Int16Array | null {
    try {
      let pcmBuffer: Buffer;
      if (typeof audioSource === 'string') {
        if (!fs.existsSync(audioSource)) return null;
        pcmBuffer = execSync(
          `"${ffmpegBinPath}" -v error -i "${audioSource}" -f s16le -ac 1 -ar 16000 -`,
          { maxBuffer: 64 * 1024 * 1024 }
        );
      } else if (Buffer.isBuffer(audioSource) && audioSource.length > 100) {
        pcmBuffer = execSync(
          `"${ffmpegBinPath}" -v error -i pipe:0 -f s16le -ac 1 -ar 16000 -`,
          { input: audioSource, maxBuffer: 64 * 1024 * 1024 }
        );
      } else {
        return null;
      }

      if (!pcmBuffer || pcmBuffer.length < 2) return null;
      return new Int16Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        Math.floor(pcmBuffer.length / 2)
      );
    } catch (err: any) {
      console.warn('[LipSyncEngine] Audio PCM decode warning:', err?.message || err);
      return null;
    }
  }

  /**
   * Computes high-fidelity audio-driven syllable lip sync trajectory matching spoken words to video frames.
   *
   * @param audioSource Path to voiceover audio file or audio Buffer
   * @param totalFrames Total number of video frames in the reel (e.g. 600 frames for 25s at 24fps)
   * @param fps Video frame rate (default 24)
   * @returns LipSyncTrajectory containing base head pose frames, syllable-matched mouth frames, and openness curve
   */
  public solveLipSyncTrajectory(
    audioSource: string | Buffer | null | undefined,
    totalFrames: number,
    fps: number = 24
  ): LipSyncTrajectory {
    const baseFrames = new Array<number>(totalFrames);
    const mouthFrames = new Array<number>(totalFrames);
    const targetOpenness = new Array<number>(totalFrames);

    // Continuous natural ping-pong loop for base head & body movement
    let basePlayhead = 24;
    let baseDir = 1;
    for (let f = 0; f < totalFrames; f++) {
      basePlayhead += baseDir;
      if (basePlayhead >= this.numFrames - 2) {
        basePlayhead = this.numFrames - 2;
        baseDir = -1;
      } else if (basePlayhead <= 2) {
        basePlayhead = 2;
        baseDir = 1;
      }
      baseFrames[f] = basePlayhead;
    }

    // Default resting / natural loop fallback if audio is missing
    if (!audioSource) {
      for (let f = 0; f < totalFrames; f++) {
        mouthFrames[f] = 84; // resting closed lips (openness = 0.000)
        targetOpenness[f] = 0.0;
      }
      return { baseFrames, mouthFrames, targetOpenness, totalFrames };
    }

    const samples = this.decodeToPcm(audioSource);
    if (!samples || samples.length === 0) {
      for (let f = 0; f < totalFrames; f++) {
        mouthFrames[f] = baseFrames[f];
        targetOpenness[f] = 0.0;
      }
      return { baseFrames, mouthFrames, targetOpenness, totalFrames };
    }

    const samplesPerFrame = Math.round(16000 / fps);
    const audioFrames = Math.floor(samples.length / samplesPerFrame);

    // 1. Calculate RMS energy per video frame
    const energies = new Float32Array(totalFrames);
    let maxRms = 1;

    for (let f = 0; f < totalFrames; f++) {
      if (f >= audioFrames) {
        energies[f] = 0;
        continue;
      }
      const start = f * samplesPerFrame;
      const end = Math.min(samples.length, start + samplesPerFrame);
      let sumSq = 0;
      for (let i = start; i < end; i++) {
        sumSq += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sumSq / Math.max(1, end - start));
      if (rms > maxRms) maxRms = rms;
      energies[f] = rms;
    }

    // 2. Perceptual noise floor & crisp syllable target openness
    const silenceThreshold = 350;
    const rawTarget = new Float32Array(totalFrames);

    for (let f = 0; f < totalFrames; f++) {
      if (energies[f] < silenceThreshold) {
        rawTarget[f] = 0.0;
      } else {
        const norm = (energies[f] - silenceThreshold) / Math.max(1, maxRms - silenceThreshold);
        // Non-linear perceptual scaling with power 0.65 for sharp syllable dynamics
        rawTarget[f] = Math.min(1.0, Math.pow(norm, 0.65) * 1.35);
      }
    }

    // 3. Syllable-responsive jaw kinematics (rapid attack 0.85 for vowel bursts, snappy decay 0.55 for consonant closure)
    const smoothed = new Float32Array(totalFrames);
    for (let f = 0; f < totalFrames; f++) {
      const prev = f > 0 ? smoothed[f - 1] : 0;
      const target = rawTarget[f];
      const factor = target > prev ? 0.85 : 0.55;
      smoothed[f] = prev + (target - prev) * factor;
      targetOpenness[f] = smoothed[f];
    }

    // 4. Syllable-driven viseme selection conditioned on base head pose
    for (let f = 0; f < totalFrames; f++) {
      const bIdx = baseFrames[f];
      const targetO = smoothed[f];

      // Local search window [bIdx - 25, bIdx + 25] ensures exact head-pose and lighting alignment
      const windowStart = Math.max(0, bIdx - 25);
      const windowEnd = Math.min(this.numFrames - 1, bIdx + 25);

      if (targetO < 0.06) {
        // SILENCE / PAUSE: Guarantee fully closed mouth
        let bestClosed = bIdx;
        let minClosedO = Infinity;
        for (let c = windowStart; c <= windowEnd; c++) {
          if (this.opennessTable[c] < minClosedO) {
            minClosedO = this.opennessTable[c];
            bestClosed = c;
          }
        }
        mouthFrames[f] = bestClosed;
      } else {
        // ACTIVE SPEECH: Find viseme matching syllable openness
        let bestCand = bIdx;
        let minDiff = Infinity;
        for (let c = windowStart; c <= windowEnd; c++) {
          const diff = Math.abs(this.opennessTable[c] - targetO);
          if (diff < minDiff) {
            minDiff = diff;
            bestCand = c;
          }
        }
        mouthFrames[f] = bestCand;
      }
    }

    return { baseFrames, mouthFrames, targetOpenness, totalFrames };
  }

  /**
   * Draws a lip-synced news anchor frame using feathered elliptical mouth blending.
   *
   * @param f Current video frame index
   * @param anchorImages Array of preloaded anchor image elements
   * @param lipSyncData Computed trajectory from solveLipSyncTrajectory
   * @param drawFn Callback that receives the final composite element (image or canvas) to render onto the destination context
   */
  public drawAnchorFrame(
    f: number,
    anchorImages: any[],
    lipSyncData: LipSyncTrajectory | null | undefined,
    drawFn: (compositeElement: any) => void
  ): void {
    if (!anchorImages || anchorImages.length === 0) return;

    if (!lipSyncData || !lipSyncData.baseFrames || lipSyncData.baseFrames.length === 0) {
      // Fallback: draw sequential frame
      const fallbackImg = anchorImages[f % anchorImages.length];
      drawFn(fallbackImg);
      return;
    }

    const bIdx = lipSyncData.baseFrames[f] ?? (f % anchorImages.length);
    const mIdx = lipSyncData.mouthFrames[f] ?? bIdx;
    const baseImg = anchorImages[bIdx] || anchorImages[0];
    const mouthImg = anchorImages[mIdx] || baseImg;

    // If base and mouth are already the same frame, draw directly with zero compositing overhead
    if (bIdx === mIdx || !mouthImg) {
      drawFn(baseImg);
      return;
    }

    // Composite mouth onto base head using smooth feathered elliptical gradient
    const frameW = 1080;
    const frameH = 608;

    this.compCtx.clearRect(0, 0, frameW, frameH);
    this.compCtx.drawImage(baseImg, 0, 0);

    // Mouth mask centered at X: 568, Y: 375 (matching studio news anchor mouth position)
    this.maskCtx.clearRect(0, 0, frameW, frameH);
    this.maskCtx.drawImage(mouthImg, 0, 0);

    this.maskCtx.globalCompositeOperation = 'destination-in';
    const grad = this.maskCtx.createRadialGradient(568, 375, 10, 568, 375, 38);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    this.maskCtx.fillStyle = grad;
    this.maskCtx.beginPath();
    this.maskCtx.ellipse(568, 375, 42, 28, 0, 0, Math.PI * 2);
    this.maskCtx.fill();

    this.maskCtx.globalCompositeOperation = 'source-over';
    this.compCtx.drawImage(this.maskCanvas, 0, 0);

    drawFn(this.compCanvas);
  }
}
