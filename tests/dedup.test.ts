import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  computeImageDHash,
  hammingDistanceHex,
  calculateTextSimilarity,
  calculateTokenSimilarity,
} from '../src/compliance/perceptual-hash.js';

describe('Deduplication & Perceptual Hashing Utilities', () => {
  it('should compute consistent 16-character dHash for identical images', async () => {
    // Generate a simple test image with Sharp
    const imgBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const hash1 = await computeImageDHash(imgBuffer);
    const hash2 = await computeImageDHash(imgBuffer);

    expect(hash1).toHaveLength(16);
    expect(hash1).toBe(hash2);
    expect(hammingDistanceHex(hash1, hash2)).toBe(0);
  });

  it('should calculate accurate Hamming distance between hex hashes', () => {
    const h1 = '0000000000000000';
    const h2 = '0000000000000001'; // 1 bit diff
    const h3 = '000000000000000f'; // 4 bits diff (1111)
    const h4 = 'ffffffffffffffff'; // 64 bits diff

    expect(hammingDistanceHex(h1, h2)).toBe(1);
    expect(hammingDistanceHex(h1, h3)).toBe(4);
    expect(hammingDistanceHex(h1, h4)).toBe(64);
  });

  it('should calculate accurate normalized text similarity (Levenshtein)', () => {
    const textA = 'Biomechanical analysis of elite sprint acceleration and stride frequency.';
    const textB = 'Biomechanical analysis of elite sprint acceleration and stride frequency.'; // 100% match
    const textC = 'Biomechanical breakdown of elite sprinter acceleration and stride velocity.'; // minor phrasing change
    const textD = 'Cooking pasta with fresh basil and tomato sauce in Italy.'; // completely different

    expect(calculateTextSimilarity(textA, textB)).toBe(1.0);
    expect(calculateTextSimilarity(textA, textC)).toBeGreaterThan(0.7);
    expect(calculateTextSimilarity(textA, textD)).toBeLessThan(0.3);
  });

  it('should calculate accurate token Jaccard similarity', () => {
    const textA = 'quarterback pocket presence throwing mechanics';
    const textB = 'quarterback throwing mechanics pocket presence'; // same tokens, different order
    const textC = 'basketball three point shooting form';

    expect(calculateTokenSimilarity(textA, textB)).toBe(1.0);
    expect(calculateTokenSimilarity(textA, textC)).toBe(0.0);
  });
});
