import React from 'react';
import { Composition } from 'remotion';
import { NewsReelTheme } from './NewsReelTheme.js';
import { ReelCompositionProps } from './types.js';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<ReelCompositionProps>
        id="NewsReel"
        component={NewsReelTheme}
        durationInFrames={30 * 25} // 25 seconds @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: 'সারাদেশে তীব্র দাবদাহের পূর্বাভাস দিল আবহাওয়া অধিদপ্তর',
          category: 'জাতীয় সংবাদ',
          imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1080&q=80',
          website: 'bdnews.site',
          isEnglish: false,
          themeColor: '#6366f1',
          accentColor: '#f59e0b',
        }}
      />
    </>
  );
};

