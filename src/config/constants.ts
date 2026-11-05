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

export interface ReelTemplateDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: '1:1' | '9:16';
  badgeColor: string;
}

export const REEL_TEMPLATES: Record<string, ReelTemplateDefinition> = {
  'studio-red': {
    id: 'studio-red',
    name: 'BD News 24/7 Red (Canva Replica Studio)',
    description: '1080x1080 Square: Red gradient studio, framed photo, circular logo, white lower-third card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#dc2626',
  },
  'breaking-bold': {
    id: 'breaking-bold',
    name: 'Breaking News TV Flash (ব্রেকিং নিউজ)',
    description: '1080x1080 Square: High urgency TV alert, animated breaking ticker, bold red & black straps with gold accent',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#eab308',
  },
  'dark-cinema': {
    id: 'dark-cinema',
    name: 'Cinematic Dark Cyber (বিবিসি / রয়টার্স স্টাইল)',
    description: '1080x1080 Square: Premium obsidian & neon cyan aesthetic, widescreen photo, glowing glassmorphic card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#06b6d4',
  },
  'viral-gradient': {
    id: 'viral-gradient',
    name: 'Viral Social Mesh (ভাইরাল সোশ্যাল গ্র্যাডিয়েন্ট)',
    description: '1080x1080 Square: Modern sunset violet/rose mesh gradient, floating photo, high-contrast viral card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#ec4899',
  },
  'vertical-916': {
    id: 'vertical-916',
    name: 'Vertical Fullscreen Reel (9:16 মোবাইল ফুলস্ক্রিন)',
    description: '1080x1920 Fullscreen: Native smartphone vertical reel format, massive centered photo & bottom overlay headline',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    badgeColor: '#10b981',
  },
};


