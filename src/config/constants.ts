import path from 'path';

export const TEMPLATES = {
  CANVA_BDNEWS: 'template-canva-bdnews',
  SQUARE_BREAKING: 'template-square-breaking',
  SQUARE_EDITORIAL: 'template-square-editorial',
  LANDSCAPE_STANDARD: 'template-landscape-standard',
} as const;

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  filename: string;
}

export const AVAILABLE_TEMPLATES: Record<string, TemplateDefinition> = {
  'template-canva-bdnews': {
    id: 'template-canva-bdnews',
    name: 'BD News 24/7 Red (Canva Replica)',
    description: 'Exact replica of BD News 24/7 Canva design: framed photo, circular logo, red headline card, and ribbon',
    width: 1080,
    height: 1080,
    filename: 'template-canva-bdnews.html',
  },
  'template-square-breaking': {
    id: 'template-square-breaking',
    name: 'Square Breaking News (1080x1080)',
    description: 'High impact red header, photo overlay, bold headline auto-fit for Instagram & Facebook',
    width: 1080,
    height: 1080,
    filename: 'template-square-breaking.html',
  },
  'template-square-editorial': {
    id: 'template-square-editorial',
    name: 'Square Editorial Modern (1080x1080)',
    description: 'Clean modern dark editorial design with category badge and publication date',
    width: 1080,
    height: 1080,
    filename: 'template-square-editorial.html',
  },
  'template-landscape-standard': {
    id: 'template-landscape-standard',
    name: 'Landscape Social Share (1200x630)',
    description: 'Facebook link-preview 1.91:1 aspect ratio with side-by-side photo and auto-fit typography',
    width: 1200,
    height: 630,
    filename: 'template-landscape-standard.html',
  },
};

