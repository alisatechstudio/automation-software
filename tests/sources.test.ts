import { describe, it, expect } from 'vitest';
import { checkBlocklist } from '../src/sources/blocklist.js';
import { WatchedFolderSource } from '../src/sources/watched-folder.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Sources & Ingestion Security', () => {
  describe('Hard Blocklist Enforcement', () => {
    it('should BLOCK broadcaster ESPN unconditionally when no license agreement exists', () => {
      const result = checkBlocklist('Sensational goal highlights broadcasted by ESPN SportsCenter');
      expect(result.isBlocked).toBe(true);
      expect(result.matchedEntity).toBe('espn');
      expect(result.reason).toContain('prohibited without verified license agreement');
    });

    it('should BLOCK major league FIFA / Premier League clips', () => {
      const fifaRes = checkBlocklist('FIFA World Cup Final 2026 epic moments');
      expect(fifaRes.isBlocked).toBe(true);
      expect(fifaRes.matchedEntity).toBe('fifa');

      const eplRes = checkBlocklist('Premier League match week goals');
      expect(eplRes.isBlocked).toBe(true);
      expect(eplRes.matchedEntity).toBe('premier league');
    });

    it('should PERMIT blocklisted entity ONLY when an explicit licensed partner agreement exists in config', () => {
      const licensedAgreements = ['FIFA Official Digital Partner Feed', 'fifa'];
      const result = checkBlocklist('FIFA Match Breakdown', undefined, licensedAgreements);
      expect(result.isBlocked).toBe(false);
    });

    it('should PASS amateur or licensed sports footage not matching blocklist', () => {
      const result = checkBlocklist('Local Calisthenics Street Workout Competition in Austin Texas');
      expect(result.isBlocked).toBe(false);
    });
  });

  describe('Watched Folder Permission Validation', () => {
    const testInbox = path.resolve(process.cwd(), 'data/test_inbox');

    it('should reject video files lacking companion license notes when requirePermissionFile is true', async () => {
      if (!fs.existsSync(testInbox)) {
        fs.mkdirSync(testInbox, { recursive: true });
      }

      const dummyVideo = path.join(testInbox, 'unauthorized_match.mp4');
      fs.writeFileSync(dummyVideo, 'fake video buffer content');

      const source = new WatchedFolderSource({
        inboxPath: testInbox,
        requirePermissionFile: true,
      });

      const clips = await source.fetchRecent();
      expect(clips.find((c) => c.title.includes('unauthorized_match'))).toBeUndefined();

      // Clean up test file
      fs.unlinkSync(dummyVideo);
      fs.rmdirSync(testInbox);
    });
  });
});
