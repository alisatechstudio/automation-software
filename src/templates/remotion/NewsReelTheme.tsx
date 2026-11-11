import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  Audio,
} from 'remotion';
import { ReelCompositionProps, REEL_SAFE_ZONES } from './types.js';
import { KineticHeadline } from './KineticHeadline.js';
import { SafeZoneOverlay } from './SafeZone.js';

export const NewsReelTheme: React.FC<ReelCompositionProps> = ({
  headline,
  category,
  imageUrl,
  website = 'bdnews.site',
  audioUrl,
  bgmUrl,
  isEnglish = false,
  themeColor = '#6366f1',
  accentColor = '#f59e0b',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // 1. Ken Burns Subtle Image Scale (1.0 to 1.08)
  const imageScale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: 'clamp',
  });
  const imagePanY = interpolate(frame, [0, durationInFrames], [0, -20], {
    extrapolateRight: 'clamp',
  });

  // 2. Main Card Spring Entrance (frames 4-20)
  const cardEntrance = spring({
    frame: frame - 4,
    fps,
    config: {
      damping: 13,
      stiffness: 95,
      mass: 0.7,
    },
  });
  const cardScale = interpolate(cardEntrance, [0, 1], [0.92, 1], {
    extrapolateLeft: 'clamp',
  });
  const cardOpacity = interpolate(cardEntrance, [0, 0.5, 1], [0, 0.9, 1], {
    extrapolateLeft: 'clamp',
  });
  const cardTranslateY = interpolate(cardEntrance, [0, 1], [40, 0], {
    extrapolateLeft: 'clamp',
  });

  // 3. Category Badge Spring Entrance (frames 8-24)
  const badgeEntrance = spring({
    frame: frame - 8,
    fps,
    config: {
      damping: 10,
      stiffness: 120,
      mass: 0.5,
    },
  });
  const badgeScale = interpolate(badgeEntrance, [0, 1], [0.6, 1], {
    extrapolateLeft: 'clamp',
  });

  // 4. Ambient Background Glowing Orbs (Harmonic Motion)
  const orb1X = width * 0.75 + Math.sin(frame * 0.05) * 45;
  const orb1Y = height * 0.7 + Math.cos(frame * 0.04) * 35;
  const orb2X = width * 0.25 + Math.cos(frame * 0.04) * 40;
  const orb2Y = height * 0.85 + Math.sin(frame * 0.06) * 30;

  // 5. Continuous Breaking News Marquee
  const marqueeOffset = (frame * 3.5) % 800;

  return (
    <AbsoluteFill className="bg-slate-950 text-white overflow-hidden select-none font-sans">
      {/* Dynamic Background Mesh Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
        }}
      />

      {/* Floating Ambient Glow Orbs */}
      <div
        className="absolute rounded-full blur-3xl opacity-35 pointer-events-none"
        style={{
          width: 500,
          height: 500,
          background: themeColor,
          left: orb1X - 250,
          top: orb1Y - 250,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{
          width: 450,
          height: 450,
          background: accentColor,
          left: orb2X - 225,
          top: orb2Y - 225,
        }}
      />

      {/* Top Header / Channel Bar (Above photo) */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8"
        style={{ height: REEL_SAFE_ZONES.topMargin }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50">
            BD
          </div>
          <span className="font-bold text-xl tracking-wider text-white drop-shadow">
            {website.toUpperCase()}
          </span>
        </div>

        {/* Live Indicator Pill */}
        <div
          className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold tracking-widest uppercase shadow-md shadow-red-600/40"
          style={{ transform: `scale(${badgeScale})` }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>LIVE</span>
        </div>
      </div>

      {/* Hero Media Section (Top Half with 16:9 / 4:3 Crop) */}
      <div
        className="absolute top-28 left-6 right-6 h-[720px] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        style={{
          transform: `translateY(${cardTranslateY}px) scale(${cardScale})`,
          opacity: cardOpacity,
        }}
      >
        {imageUrl ? (
          <Img
            src={imageUrl}
            className="w-full h-full object-cover"
            style={{
              transform: `scale(${imageScale}) translateY(${imagePanY}px)`,
            }}
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-2xl">
            {website}
          </div>
        )}

        {/* Vignette Gradients */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
      </div>

      {/* Bottom Main Content Card (Safe-Zone Aware) */}
      <div
        className="absolute left-6 right-6 rounded-3xl bg-white text-slate-900 p-8 shadow-2xl border border-indigo-100 flex flex-col items-center justify-between"
        style={{
          top: 890,
          bottom: REEL_SAFE_ZONES.bottomMargin + 20,
          transform: `translateY(${cardTranslateY * 0.7}px) scale(${cardScale})`,
          opacity: cardOpacity,
        }}
      >
        {/* Category Badge */}
        <div
          className="px-6 py-2 rounded-full text-sm font-extrabold tracking-wider uppercase text-white shadow-md"
          style={{
            backgroundColor: themeColor,
            transform: `scale(${badgeScale})`,
          }}
        >
          {category || 'BREAKING NEWS'}
        </div>

        {/* Kinetic Animated Headline */}
        <div className="my-auto px-2">
          <KineticHeadline
            headline={headline}
            isEnglish={isEnglish}
            accentColor={accentColor}
            headlineColor="#0f172a"
          />
        </div>

        {/* Card Footer Bar */}
        <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{website}</span>
          <span className="text-indigo-600 font-bold">SWIPE FOR MORE</span>
        </div>
      </div>

      {/* Continuous Ticker Marquee Strip (At Bottom Safe Boundary) */}
      <div
        className="absolute left-0 right-0 h-14 bg-indigo-600/90 backdrop-blur-md border-t border-indigo-400/30 flex items-center overflow-hidden z-20"
        style={{ bottom: REEL_SAFE_ZONES.bottomMargin - 70 }}
      >
        <div
          className="whitespace-nowrap flex space-x-12 text-sm font-extrabold tracking-wider uppercase text-white"
          style={{ transform: `translateX(-${marqueeOffset}px)` }}
        >
          <span>🚨 {category}: {headline}</span>
          <span>•</span>
          <span>VISIT {website.toUpperCase()} FOR LIVE UPDATES</span>
          <span>•</span>
          <span>🚨 {category}: {headline}</span>
        </div>
      </div>

      {/* Audio Layer */}
      {audioUrl && <Audio src={audioUrl} />}
      {bgmUrl && <Audio src={bgmUrl} volume={0.15} />}

      {/* Optional Safe Zone Guide (Set visible={true} in dev) */}
      <SafeZoneOverlay visible={false} />
    </AbsoluteFill>
  );
};

