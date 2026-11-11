---
name: remotion-best-practices
description: >-
  Best practices and architectural patterns for creating programmatic videos, reels, and shorts with Remotion.
  Use when building, styling, or structuring Remotion video compositions, creating 9:16 vertical reel themes,
  kinetic typography, spring animations, audio synchronization, asset preloading, and safe-zone layouts.
---

# Remotion Best Practices for Video & Reel Theme Creation

This skill provides industry standards and architectural rules for building video compositions, 9:16 social reels (Meta Reels, TikTok, YouTube Shorts), kinetic motion graphics, and audio-reactive templates in Remotion.

---

## 1. Core Principles of Remotion Development

### 1.1 Determinism & Pure Functions
Every Remotion component **must be purely deterministic**:
* **Never use wall-clock time:** Avoid `Date.now()`, `performance.now()`, `Math.random()` (use `random('seed')` from `remotion`), `setTimeout`, or `setInterval`.
* **Rely exclusively on `useCurrentFrame()` and `useVideoConfig()`**:
  ```tsx
  import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  ```
* **No CSS transitions or `@keyframes`:** CSS transitions and keyframes run on browser clock time and will de-sync during headless rendering. Use `interpolate()` or `spring()` to compute inline styles or Tailwind classes dynamically based on `frame`.

### 1.2 Layout & 9:16 Vertical Safe Zones
Social media platforms overlay UI elements (like/share buttons on the right, author and captions at the bottom, navigation at the top). Reel themes must respect these safe zones:

```tsx
export const REEL_SAFE_ZONES = {
  topMargin: 120,    // Clear platform header / back buttons
  bottomMargin: 340, // Clear caption text, music ticker, search bar
  rightMargin: 130,  // Clear like, comment, share, remix icons
  leftMargin: 60,
};
```
* Always wrap vertical reel content in `<AbsoluteFill>` with safe padding so text and critical graphics are never occluded.

---

## 2. Spring Physics & Interpolation Patterns

### 2.1 The Standard `spring()` Formula
Use `spring()` instead of linear interpolation for high-energy mobile video:
```tsx
const entrance = spring({
  frame,
  fps,
  config: {
    damping: 12,    // Lower = bouncier (10-14 ideal for UI)
    mass: 0.5,      // Lower = faster snap
    stiffness: 100, // Higher = snappier response
    overshootClamping: false,
  },
});
```

### 2.2 Interpolation with Clamping
Always clamp values to prevent unexpected out-of-range styles:
```tsx
const opacity = interpolate(frame, [0, 15], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
```

---

## 3. Reel Theme Architecture & Composition Hierarchy

A production-ready Reel template should be structured into declarative layers using `<AbsoluteFill>`, `<Sequence>`, and `<Series>`:

```
<Composition> (1080x1920 @ 30fps)
  ├── <AbsoluteFill> (Layer 0: Dynamic Background / Mesh Gradient / Ken Burns)
  ├── <AbsoluteFill> (Layer 1: Ambient Floating Light Orbs / Particles)
  ├── <Sequence from={0}> (Layer 2: Media Card / Feature Image with 3D Pop-in)
  ├── <Sequence from={10}> (Layer 3: Category / Breaking News Badge with Shimmer)
  ├── <Sequence from={18}> (Layer 4: Kinetic Typography / Headline with Word Stagger)
  ├── <Sequence from={30}> (Layer 5: Continuous Breaking Marquee Ticker)
  ├── <AbsoluteFill> (Layer 6: Platform UI Safe Zone Overlay - Dev Only)
  └── <Audio> (Layer 7: Background Music & TTS Voiceover)
```

### 3.1 Choreographed Layer Structure Example
```tsx
import { AbsoluteFill, Sequence, Series } from 'remotion';
import { AmbientBackground } from './AmbientBackground';
import { MediaCard } from './MediaCard';
import { CategoryBadge } from './CategoryBadge';
import { KineticHeadline } from './KineticHeadline';
import { NewsTicker } from './NewsTicker';
import { VoiceoverTrack } from './VoiceoverTrack';

export const NewsReelTheme: React.FC<NewsReelProps> = (props) => {
  return (
    <AbsoluteFill className="bg-slate-950 text-white font-sans overflow-hidden">
      {/* Dynamic Background */}
      <AmbientBackground theme={props.theme} />

      {/* Featured Article Image / Media Card */}
      <Sequence from={0} durationInFrames={props.durationInFrames}>
        <MediaCard imageUrl={props.imageUrl} title={props.headline} />
      </Sequence>

      {/* Category / Breaking Alert Badge */}
      <Sequence from={8}>
        <CategoryBadge category={props.category} theme={props.theme} />
      </Sequence>

      {/* Staggered Word-by-Word Kinetic Headline */}
      <Sequence from={15}>
        <KineticHeadline text={props.headline} isEnglish={props.isEnglish} />
      </Sequence>

      {/* Bottom News Marquee Ticker */}
      <Sequence from={25}>
        <NewsTicker website={props.website} category={props.category} />
      </Sequence>

      {/* Synchronized Voice & Background Music */}
      <VoiceoverTrack audioUrl={props.audioUrl} bgmUrl={props.bgmUrl} />
    </AbsoluteFill>
  );
};
```

---

## 4. Asset Preloading & Custom Fonts (e.g. Bangla Fonts)

When using custom fonts (Hind Siliguri, Noto Sans Bengali) or external article images:

### 4.1 Use `delayRender()` and `continueRender()`
Never allow rendering to proceed before fonts or images are loaded:
```tsx
import { useEffect, useState } from 'react';
import { delayRender, continueRender } from 'remotion';

export const BanglaFontLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('Loading Bangla Google Font'));

  useEffect(() => {
    const font = new FontFace(
      'Hind Siliguri',
      'url(https://fonts.gstatic.com/s/hindsiliguri/v12/ijwOs5juQtsyLLR5jN4CXCxcAlZr.woff2)'
    );

    font.load().then(() => {
      document.fonts.add(font);
      continueRender(handle);
    }).catch((err) => {
      console.error('Font failed to load', err);
      continueRender(handle);
    });
  }, [handle]);

  return <div style={{ fontFamily: 'Hind Siliguri, sans-serif' }}>{children}</div>;
};
```

---

## 5. Kinetic Typography & Subtitle Synchronization

### 5.1 Word-by-Word Stagger
```tsx
export const KineticHeadline: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-5xl font-bold">
      {words.map((word, i) => {
        const delay = i * 4; // 4 frames stagger per word
        const wordSpring = spring({
          frame: frame - delay,
          fps,
          config: { damping: 11, stiffness: 120, mass: 0.6 },
        });

        const scale = interpolate(wordSpring, [0, 1], [0.6, 1], { extrapolateLeft: 'clamp' });
        const opacity = interpolate(wordSpring, [0, 0.4, 1], [0, 0.8, 1], { extrapolateLeft: 'clamp' });
        const translateY = interpolate(wordSpring, [0, 1], [30, 0], { extrapolateLeft: 'clamp' });

        return (
          <span
            key={i}
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
```

---

## 6. Performance Optimization During Server-Side Rendering

1. **Avoid Layout Thrashing:** Use CSS flexbox/grid and inline `transform: translate3d()` to trigger GPU composition.
2. **Limit Heavy Blur Filters:** High CSS `blur(>20px)` on large full-screen elements can slow down Chromium renders. Prefer pre-blurred static assets or SVGs.
3. **Use WebM/MP4 with `<OffthreadVideo>`:** When overlaying video backgrounds, use `<OffthreadVideo>` to prevent frame-drop during headless export.

