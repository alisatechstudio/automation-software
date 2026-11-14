import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Resolve ffmpeg path (prefer @ffmpeg-installer/ffmpeg if available)
let ffmpegBinPath = 'ffmpeg';
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpegBinPath = ffmpegInstaller.path;
  }
} catch {
  // Use system ffmpeg
}

/**
 * Pre-analyzed mouth openness metrics for the 127 Bangladeshi male news presenter frames.
 * Index corresponds to frame_0001.jpg (0) through frame_0127.jpg (126).
 * Values normalized between 0.0 (fully closed mouth) and 1.0 (wide open vowel).
 */
export const ANCHOR_MOUTH_OPENNESS: readonly number[] = Object.freeze([
  0.204, 0.204, 0.196, 0.192, 0.188, 0.237, 0.237, 0.254, 0.287, 0.300,
  0.371, 0.350, 0.375, 0.308, 0.271, 0.300, 0.063, 0.025, 0.029, 0.021,
  0.204, 0.304, 0.025, 0.025, 0.029, 0.042, 0.046, 0.046, 0.000, 0.058,
  0.087, 0.142, 0.133, 0.167, 0.258, 0.362, 0.358, 0.367, 0.188, 0.087,
  0.104, 0.108, 0.163, 0.163, 0.171, 0.237, 0.263, 0.246, 0.275, 0.267,
  0.283, 0.271, 0.246, 0.271, 0.212, 0.146, 0.121, 0.138, 0.179, 0.225,
  0.304, 0.258, 0.237, 0.267, 0.675, 0.275, 0.125, 0.117, 0.175, 0.158,
  0.113, 0.113, 0.125, 0.179, 0.237, 0.254, 0.150, 0.138, 0.129, 0.121,
  0.071, 0.017, 0.033, 0.017, 0.021, 0.008, 0.000, 0.004, 0.029, 0.138,
  0.104, 0.054, 0.083, 0.079, 0.008, 0.071, 0.075, 0.013, 0.037, 0.087,
  0.075, 0.121, 0.087, 0.004, 0.154, 0.000, 0.000, 0.000, 0.000, 0.033,
  0.679, 1.000, 0.871, 0.854, 0.617, 0.483, 0.563, 0.738, 0.579, 0.604,
  0.575, 0.588, 0.596, 0.621, 0.417, 0.204, 0.204
]);

/**
 * Natural closed-mouth resting zones in the male news presenter footage.
 * Within these clusters, mouth openness is <= 0.05, and micro-movements
 * represent natural breathing and resting posture without freeze-framing.
 */
interface ClosedCluster {
  min: number;
  max: number;
  center: number;
}

const CLOSED_CLUSTERS: readonly ClosedCluster[] = Object.freeze([
  { min: 22, max: 28, center: 25 },
  { min: 81, max: 88, center: 85 },
  { min: 105, max: 109, center: 107 }
]);

export class LipSyncEngine {
  private static instance: LipSyncEngine | null = null;
  private readonly opennessTable: readonly number[];
  private readonly numFrames: number;

  constructor(customOpenness?: number[]) {
    this.opennessTable = customOpenness && customOpenness.length > 0
      ? customOpenness
      : ANCHOR_MOUTH_OPENNESS;
    this.numFrames = this.opennessTable.length;
  }

  public static getInstance(): LipSyncEngine {
    if (!LipSyncEngine.instance) {
      LipSyncEngine.instance = new LipSyncEngine();
    }
    return LipSyncEngine.instance;
  }

  /**
   * Finds the nearest natural closed-mouth cluster to a given frame position.
   */
  private getNearestClosedCluster(frame: number): ClosedCluster {
    let best = CLOSED_CLUSTERS[0];
    let minDist = Math.abs(frame - best.center);
    for (const c of CLOSED_CLUSTERS) {
      const d = Math.abs(frame - c.center);
      if (d < minDist) {
        minDist = d;
        best = c;
      }
    }
    return best;
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
          { maxBuffer: 32 * 1024 * 1024 }
        );
      } else if (Buffer.isBuffer(audioSource) && audioSource.length > 100) {
        pcmBuffer = execSync(
          `"${ffmpegBinPath}" -v error -i pipe:0 -f s16le -ac 1 -ar 16000 -`,
          { input: audioSource, maxBuffer: 32 * 1024 * 1024 }
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
   * Computes an audio-driven lip sync trajectory matching spoken words to video frames.
   *
   * @param audioSource Path to voiceover audio file or audio Buffer
   * @param totalFrames Total number of video frames in the reel (e.g. 600 frames for 25s at 24fps)
   * @param fps Video frame rate (default 24)
   * @returns Array of length `totalFrames` with the exact anchor frame index (0..126) for each frame
   */
  public solveLipSyncTrajectory(
    audioSource: string | Buffer | null | undefined,
    totalFrames: number,
    fps: number = 24
  ): number[] {
    const trajectory = new Array<number>(totalFrames);

    // Default resting / natural loop fallback if audio is missing
    if (!audioSource) {
      let restingPos = 24;
      let dir = 1;
      for (let f = 0; f < totalFrames; f++) {
        restingPos += dir;
        if (restingPos >= 28) { restingPos = 28; dir = -1; }
        else if (restingPos <= 22) { restingPos = 22; dir = 1; }
        trajectory[f] = restingPos;
      }
      return trajectory;
    }

    const samples = this.decodeToPcm(audioSource);
    if (!samples || samples.length === 0) {
      for (let f = 0; f < totalFrames; f++) {
        trajectory[f] = f % this.numFrames;
      }
      return trajectory;
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

    // 2. Perceptual noise floor & non-linear mouth openness target
    const silenceThreshold = 380;
    const targetOpenness = new Float32Array(totalFrames);

    for (let f = 0; f < totalFrames; f++) {
      if (energies[f] < silenceThreshold) {
        targetOpenness[f] = 0.0;
      } else {
        const norm = (energies[f] - silenceThreshold) / Math.max(1, maxRms - silenceThreshold);
        targetOpenness[f] = Math.min(1.0, Math.pow(norm, 0.72) * 1.25);
      }
    }

    // 3. Asymmetric physical jaw kinematics (rapid attack for opening, gradual decay for closing)
    const smoothed = new Float32Array(totalFrames);
    for (let f = 0; f < totalFrames; f++) {
      const prev = f > 0 ? smoothed[f - 1] : 0;
      const target = targetOpenness[f];
      const factor = target > prev ? 0.75 : 0.40;
      smoothed[f] = prev + (target - prev) * factor;
    }

    // 4. Trajectory solver
    let playhead = 24; // Start in calm resting posture
    let direction = 1; // 1 = forward, -1 = backward
    let restingDirection = 1;

    for (let f = 0; f < totalFrames; f++) {
      const targetO = smoothed[f];
      const isSilent = targetO < 0.08;

      if (isSilent) {
        // In silence: smoothly settle into the nearest resting closed loop
        const cluster = this.getNearestClosedCluster(playhead);
        if (playhead < cluster.min) {
          playhead = Math.min(cluster.min, playhead + 1);
        } else if (playhead > cluster.max) {
          playhead = Math.max(cluster.max, playhead - 1);
        } else {
          // Living micro-breathing inside closed zone without freeze-framing
          playhead += restingDirection;
          if (playhead >= cluster.max) {
            playhead = cluster.max;
            restingDirection = -1;
          } else if (playhead <= cluster.min) {
            playhead = cluster.min;
            restingDirection = 1;
          }
        }
        trajectory[f] = playhead;
      } else {
        // In active speech: advance naturally along ping-pong trajectory
        if (playhead >= this.numFrames - 3) {
          direction = -1;
        } else if (playhead <= 2) {
          direction = 1;
        }

        let step = 1;
        // Accentuate mouth opening on strong vowel peaks
        if (targetO > 0.60) {
          const cand1 = playhead + 1 * direction;
          const cand2 = playhead + 2 * direction;
          if (cand2 >= 0 && cand2 < this.numFrames) {
            const o1 = this.opennessTable[cand1] || 0;
            const o2 = this.opennessTable[cand2] || 0;
            if (o2 > o1) {
              step = 2;
            }
          }
        }

        playhead = Math.max(0, Math.min(this.numFrames - 1, playhead + step * direction));
        trajectory[f] = playhead;
      }
    }

    return trajectory;
  }
}
