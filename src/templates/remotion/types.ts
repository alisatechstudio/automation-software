export interface ReelCompositionProps {
  headline: string;
  category: string;
  imageUrl?: string;
  website?: string;
  logoUrl?: string;
  audioUrl?: string;
  bgmUrl?: string;
  isEnglish?: boolean;
  themeColor?: string;
  accentColor?: string;
}

export const REEL_SAFE_ZONES = {
  topMargin: 120,    // Top notch / platform header
  bottomMargin: 340, // Captions, music strip, search pill
  rightMargin: 130,  // Like, comment, share, remix icons
  leftMargin: 60,
};

