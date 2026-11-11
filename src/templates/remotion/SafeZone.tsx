import React from 'react';
import { AbsoluteFill } from 'remotion';
import { REEL_SAFE_ZONES } from './types.js';

/**
 * Dev overlay to verify 9:16 safe areas on Meta Reels, TikTok, and YouTube Shorts.
 * Keep disabled in production renders.
 */
export const SafeZoneOverlay: React.FC<{ visible?: boolean }> = ({ visible = false }) => {
  if (!visible) return null;

  return (
    <AbsoluteFill className="pointer-events-none z-50">
      {/* Top Header Exclusion Zone */}
      <div
        className="w-full bg-red-500/20 border-b border-red-500/40 text-red-200 text-xs p-2 font-mono flex items-center justify-between"
        style={{ height: REEL_SAFE_ZONES.topMargin }}
      >
        <span>TOP SAFE ZONE (Stories/Reels Header)</span>
        <span>120px</span>
      </div>

      {/* Right Social Action Buttons Zone */}
      <div
        className="absolute right-0 bg-blue-500/20 border-l border-blue-500/40 text-blue-200 text-xs p-2 font-mono flex flex-col justify-center items-center"
        style={{
          top: REEL_SAFE_ZONES.topMargin,
          bottom: REEL_SAFE_ZONES.bottomMargin,
          width: REEL_SAFE_ZONES.rightMargin,
        }}
      >
        <span className="[writing-mode:vertical-rl] rotate-180">RIGHT ACTIONS ZONE (Like / Share)</span>
      </div>

      {/* Bottom Captions & Audio Ticker Zone */}
      <div
        className="absolute bottom-0 w-full bg-yellow-500/20 border-t border-yellow-500/40 text-yellow-200 text-xs p-2 font-mono flex items-center justify-between"
        style={{ height: REEL_SAFE_ZONES.bottomMargin }}
      >
        <span>BOTTOM SAFE ZONE (Captions & Audio Strip)</span>
        <span>340px</span>
      </div>
    </AbsoluteFill>
  );
};

