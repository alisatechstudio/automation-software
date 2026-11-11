---
name: motion-design
description: >-
  Guides motion design, UI animation, kinetic typography, video keyframing, and dynamic transitions.
  Use when designing or coding animated UI components, CSS/Canvas/SVG animations, video render pipelines
  (FFmpeg, @napi-rs/canvas, Remotion), news tickers, lower thirds, or short-form social video reels (Reels/Shorts/TikTok).
---

# Motion Design & Animation Skill

This skill provides production-grade instructions, easing mathematics, and rendering patterns for creating fluid, modern motion graphics across web apps, canvas renderers, and automated video engines.

---

## 1. Core Principles of Digital Motion Design

### 1.1 Timing & Easing Curves
Linear motion (`linear`) feels robotic and unnatural. Always apply physics-inspired easing curves:
* **Entrances (Ease-Out):** Elements should enter quickly and decelerate smoothly as they arrive.
  - Recommended: `cubic-bezier(0.16, 1, 0.3, 1)` (Quartic ease-out) or Spring overshoot.
* **Exits (Ease-In):** Elements should begin slowly and accelerate off-screen.
  - Recommended: `cubic-bezier(0.7, 0, 0.84, 0)` (Quartic ease-in).
* **State Changes / Transitions (Ease-In-Out):** Used for elements that stay on screen but transform.
  - Recommended: `cubic-bezier(0.65, 0, 0.35, 1)`.
* **Micro-interactions & Buttons:** Duration: `150ms – 250ms`.
* **Card & Modal Transitions:** Duration: `300ms – 450ms`.
* **Full Screen / Scene Transitions:** Duration: `500ms – 800ms`.

### 1.2 Staggering & Choreography
Never animate all elements simultaneously.
* Offset sibling elements (e.g., list items, words in a headline, stats counters) by **40ms – 80ms**.
* Direct user attention in an intended reading sequence: **Badge / Category → Main Headline → Media Card → Supporting Text / Call to Action**.

---

## 2. Canvas & Automated Video Reel Engines (@napi-rs/canvas & FFmpeg)

When generating programmatic video frames for news reels or social media clips:

### 2.1 Normalized Time Parameter (`t`)
Every animation must be calculated as a normalized progress factor `t` where `t = currentFrame / totalFrames` ($0 \le t \le 1$):

```typescript
// Standard Easing Functions in TypeScript
export const Easing = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number, overshoot = 1.70158) => {
    return 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
  },
  // Clamped spring simulation for entrance snap
  springSnap: (t: number) => {
    return 1 - Math.exp(-6 * t) * Math.cos(10 * t);
  }
};
```

### 2.2 Kinetic Headline & Subtitle Motion
* **Word-by-Word Stagger:** Calculate per-word progress:
  ```typescript
  const wordDelay = 0.08; // 8% offset per word
  const wordDuration = 0.25;
  const wordProgress = Math.min(1, Math.max(0, (t - i * wordDelay) / wordDuration));
  const eased = Easing.easeOutQuart(wordProgress);
  const offsetY = (1 - eased) * 24; // slide up 24px
  const alpha = eased;
  ```
* **Dynamic Highlight Sweep:** Draw a subtle background accent pill or gradient underline that slides from width 0 to 100% under the primary keyword.

### 2.3 Ambient Background Motion
* **Orb / Mesh Gradient Drift:** Use low-frequency harmonic oscillations (sine/cosine) with differing phase offsets:
  ```typescript
  const orbX = centerX + Math.sin(frameIndex * 0.015) * 60;
  const orbY = centerY + Math.cos(frameIndex * 0.02) * 45;
  ```
* **Ken Burns Camera Motion:** For featured image backgrounds, zoom smoothly between 1.00x and 1.08x while slightly panning $(dx, dy)$ over the segment duration.

---

## 3. High-Impact News & Social Reels Patterns

### 3.1 Breaking News Marquee & Ticker
* Continuously scrolling ticker at the bottom or top:
  `xPos = (canvasWidth - (frameIndex * scrollSpeed)) % (totalTextWidth + spacing)`
* Add a left/right gradient opacity mask so text fades into the edge rather than abruptly clipping.

### 3.2 Lower Thirds & Alert Badges
* **Phase 1 (Entrance 0.0 – 0.3s):** Badge expands horizontally with `easeOutBack`, text fades in.
* **Phase 2 (Hold & Shimmer 0.3s – End):** A 15° angled white linear gradient shines across the badge every 2.5 seconds.
* **Phase 3 (Exit):** Quick collapse to 0 opacity with scale reduction (0.95x).

---

## 4. Modern Web & CSS Motion Guidelines

### 4.1 Performance Checklist
* Animate **only** `transform` (`translate3d`, `scale`, `rotate`) and `opacity`.
* Avoid animating `top`, `left`, `margin`, `width`, or `height` as they trigger browser layout reflow.
* Use `will-change: transform` sparingly on animated targets to promote them to dedicated GPU compositor layers.

### 4.2 Tailwind & CSS Animation Snippets
```css
@keyframes shimmerSweep {
  0% { transform: translateX(-100%) skewX(-15deg); }
  100% { transform: translateX(250%) skewX(-15deg); }
}

@keyframes pulseGlow {
  0%, 100% { filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.4)); }
  50% { filter: drop-shadow(0 0 30px rgba(239, 68, 68, 0.8)); }
}
```

---

## 5. References and Further Details
* [Easing Curves Mathematics](./references/easing-curves.md)
* [FFmpeg Motion & Transitions](./references/ffmpeg-motion.md)
* [Canvas Frame-by-Frame Implementation](./references/canvas-animation.md)

