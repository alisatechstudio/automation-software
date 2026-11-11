# Canvas Animation & Frame-by-Frame Generation

Reference implementations for programmatic frame generation using `@napi-rs/canvas` or standard HTML5 Canvas.

## 1. Shimmer / Light Streak Effect

Simulates a shiny reflective beam gliding across a badge or card border:

```typescript
export function drawShimmerSweep(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  progress: number, // 0.0 to 1.0
  color = 'rgba(255, 255, 255, 0.4)'
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();

  const beamWidth = 80;
  const currentX = box.x - beamWidth + (box.width + beamWidth * 2) * progress;

  const gradient = ctx.createLinearGradient(currentX, box.y, currentX + beamWidth, box.y + box.height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.restore();
}
```

---

## 2. Dynamic Audio Waveform Visualizer

Generates animated waveform bars responsive to frequency simulation or playback progress:

```typescript
export function drawAudioWaveform(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  barsCount = 24,
  frame: number,
  baseHeight = 12
) {
  const barWidth = 6;
  const gap = 4;
  const totalWidth = barsCount * (barWidth + gap);
  const startX = center.x - totalWidth / 2;

  ctx.fillStyle = '#f59e0b';

  for (let i = 0; i < barsCount; i++) {
    // Harmonic wave calculation
    const wave = Math.sin(frame * 0.15 + i * 0.4) * 0.5 + 0.5;
    const height = baseHeight + wave * 36;
    const x = startX + i * (barWidth + gap);
    const y = center.y - height / 2;

    // Rounded pill
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, height, 3);
    ctx.fill();
  }
}
```

