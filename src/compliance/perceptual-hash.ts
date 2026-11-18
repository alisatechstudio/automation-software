import sharp from 'sharp';

/**
 * Computes a 64-bit difference hash (dHash) for an image buffer or file path using Sharp.
 * dHash is extremely fast, highly resistant to scaling, compression, and minor color changes.
 */
export async function computeImageDHash(imageInput: string | Buffer): Promise<string> {
  // Resize to 9x8 grayscale (raw pixels: 72 bytes)
  const raw = await sharp(imageInput)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let hash = '';
  // Compare each pixel to its right neighbor (8 comparisons per row * 8 rows = 64 bits)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const leftPixel = raw[row * 9 + col];
      const rightPixel = raw[row * 9 + col + 1];
      hash += leftPixel < rightPixel ? '1' : '0';
    }
  }

  // Convert 64-bit binary string to 16-character hex string
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = hash.substring(i, i + 4);
    hex += parseInt(nibble, 2).toString(16);
  }

  return hex;
}

/**
 * Calculates the Hamming distance between two hex hashes (0 to 64).
 * Lower distance = more similar. Distance < 10 typically indicates near-identical images.
 */
export function hammingDistanceHex(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 64;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    let xor = val1 ^ val2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Calculates normalized Levenshtein similarity between two strings (0.0 to 1.0).
 * 1.0 = identical, 0.0 = completely different.
 */
export function calculateTextSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const m = s1.length;
  const n = s2.length;
  const maxLen = Math.max(m, n);

  // If one string is vastly longer, quick upper bound
  if (Math.abs(m - n) / maxLen > 0.8) {
    return 0.1;
  }

  // Two-row dynamic programming for Levenshtein distance
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const char1 = s1[i - 1];

    for (let j = 1; j <= n; j++) {
      const cost = char1 === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insertion
        prevRow[j] + 1, // deletion
        prevRow[j - 1] + cost // substitution
      );
    }

    // Swap rows
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  const distance = prevRow[n];
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Token Jaccard similarity for script structure comparison (0.0 to 1.0).
 */
export function calculateTokenSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(text1.toLowerCase().match(/\w+/g) || []);
  const tokens2 = new Set(text2.toLowerCase().match(/\w+/g) || []);

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++;
    }
  }

  const union = tokens1.size + tokens2.size - intersection;
  return union > 0 ? intersection / union : 0.0;
}
