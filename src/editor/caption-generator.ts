import fs from 'node:fs';
import path from 'node:path';

export interface CaptionSegment {
  index: number;
  startTimeSec: number;
  endTimeSec: number;
  text: string;
}

export class CaptionGenerator {
  /**
   * Generates timed SRT captions from a script text distributed evenly across target duration.
   */
  public generateSrtFromScript(scriptText: string, totalDurationSec: number, outputPath: string): string {
    // Split script into bite-sized phrases (3-7 words per subtitle line)
    const rawSentences = scriptText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const phrases: string[] = [];
    for (const sentence of rawSentences) {
      const words = sentence.split(/\s+/);
      let currentPhrase: string[] = [];
      for (const word of words) {
        currentPhrase.push(word);
        if (currentPhrase.length >= 5) {
          phrases.push(currentPhrase.join(' '));
          currentPhrase = [];
        }
      }
      if (currentPhrase.length > 0) {
        phrases.push(currentPhrase.join(' '));
      }
    }

    if (phrases.length === 0) {
      phrases.push(scriptText);
    }

    const durationPerPhrase = totalDurationSec / phrases.length;
    let srtContent = '';

    phrases.forEach((phrase, idx) => {
      const start = idx * durationPerPhrase;
      const end = Math.min(totalDurationSec, (idx + 1) * durationPerPhrase);

      srtContent += `${idx + 1}\n`;
      srtContent += `${this.formatSrtTime(start)} --> ${this.formatSrtTime(end)}\n`;
      srtContent += `${phrase}\n\n`;
    });

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, srtContent, 'utf8');
    return outputPath;
  }

  private formatSrtTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(
      millis
    ).padStart(3, '0')}`;
  }
}
