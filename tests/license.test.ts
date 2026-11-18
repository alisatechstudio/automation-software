import { describe, it, expect } from 'vitest';
import { runLicenseCheck } from '../src/compliance/checks/license-check.js';
import type { ClipMeta } from '../src/types/index.js';

describe('Compliance Gate: License Verification Check', () => {
  const baseClip: ClipMeta = {
    id: 'test_clip_1',
    title: 'Calisthenics Muscle Up Form Breakdown',
    url: 'https://example.com/clip.mp4',
    licenseType: 'CC_BY',
    licenseProofUrl: 'https://creativecommons.org/licenses/by/4.0/',
    credit: 'Footage by FitnessCreator (Licensed under CC-BY 4.0)',
    publishedAt: new Date().toISOString(),
    sport: 'Calisthenics',
    duration: 30,
    sourceName: 'TestSource',
  };

  it('should PASS when commercial license (CC_BY) with proof and attribution is present', () => {
    const result = runLicenseCheck(baseClip);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe('LICENSE');
    expect(result.reason).toContain('Commercial license verified');
  });

  it('should PASS for all authorized commercial license types', () => {
    const allowedLicenses = ['OWNED_PERMISSION', 'CC0', 'CC_BY', 'PEXELS', 'PIXABAY', 'LICENSED_PARTNER'];

    for (const lic of allowedLicenses) {
      const clip = { ...baseClip, licenseType: lic };
      const result = runLicenseCheck(clip);
      expect(result.passed).toBe(true);
    }
  });

  it('should REJECT Non-Commercial (NC) licenses (CC_BY_NC)', () => {
    const clip: ClipMeta = {
      ...baseClip,
      licenseType: 'CC_BY_NC',
    };
    const result = runLicenseCheck(clip);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('prohibits commercial use');
  });

  it('should REJECT CC-BY-NC-SA and CC-BY-NC-ND variations', () => {
    const ncVariations = ['CC_BY_NC_SA', 'CC_BY_NC_ND', 'Creative Commons Non-Commercial'];
    for (const nc of ncVariations) {
      const clip = { ...baseClip, licenseType: nc };
      const result = runLicenseCheck(clip);
      expect(result.passed).toBe(false);
    }
  });

  it('should REJECT clip if license proof URL is missing', () => {
    const clip: ClipMeta = {
      ...baseClip,
      licenseProofUrl: '',
    };
    const result = runLicenseCheck(clip);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('No license evidence');
  });

  it('should REJECT clip if attribution credit is missing or empty', () => {
    const clip: ClipMeta = {
      ...baseClip,
      credit: '',
    };
    const result = runLicenseCheck(clip);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Insufficient attribution');
  });
});
