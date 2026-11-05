export interface RenderInput {
  headline: string;
  category?: string;
  dateText?: string;
  imageUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  templateId?: string;
  width?: number;
  height?: number;
}

export interface RenderOutput {
  imageBuffer: Buffer;
  outputPath?: string;
  width: number;
  height: number;
  templateId: string;
}

export interface ImageRenderer {
  render(input: RenderInput): Promise<RenderOutput>;
  renderToBuffer(input: RenderInput): Promise<Buffer>;
  close(): Promise<void>;
}

