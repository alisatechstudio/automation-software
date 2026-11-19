import { ImageRenderer, RenderInput, RenderOutput } from './types.js';
import { CanvasCardRenderer } from './canvas.js';

/**
 * PlaywrightImageRenderer implementation delegated to CanvasCardRenderer.
 * This guarantees ultra-fast, zero-overhead card rendering in serverless environments
 * without requiring heavyweight Chromium binaries.
 */
export class PlaywrightImageRenderer implements ImageRenderer {
  private canvasRenderer: CanvasCardRenderer;

  constructor() {
    this.canvasRenderer = new CanvasCardRenderer();
  }

  public async render(input: RenderInput): Promise<RenderOutput> {
    return this.canvasRenderer.render(input);
  }

  public async renderToBuffer(input: RenderInput): Promise<Buffer> {
    return this.canvasRenderer.renderToBuffer(input);
  }

  public async close(): Promise<void> {
    return this.canvasRenderer.close();
  }
}
