import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface KineticHeadlineProps {
  headline: string;
  isEnglish?: boolean;
  accentColor?: string;
  headlineColor?: string;
}

export const KineticHeadline: React.FC<KineticHeadlineProps> = ({
  headline,
  isEnglish = false,
  accentColor = '#f59e0b',
  headlineColor = '#0f172a',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = headline.trim().split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Periodic specular light sheen sweep every 90 frames (~3s)
  const sweepCycle = frame % 90;
  const isSweeping = sweepCycle >= 40 && sweepCycle <= 65;
  const sweepProgress = isSweeping ? (sweepCycle - 40) / 25 : -1;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center"
      style={{
        fontFamily: isEnglish ? 'Inter, system-ui, sans-serif' : '"Hind Siliguri", "Noto Sans Bengali", sans-serif',
        lineHeight: 1.35,
      }}
    >
      {words.map((word, index) => {
        // Stagger entrance: 3 frames delay per word
        const wordDelay = Math.round(index * (32 / Math.max(1, totalWords)));

        const wordSpring = spring({
          frame: frame - wordDelay,
          fps,
          config: {
            damping: 12,
            stiffness: 120,
            mass: 0.5,
          },
        });

        const scale = interpolate(wordSpring, [0, 1], [0.75, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const translateY = interpolate(wordSpring, [0, 1], [24, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const opacity = interpolate(wordSpring, [0, 0.4, 1], [0, 0.9, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Calculate if sheen passes over this word
        const wordNormPos = index / Math.max(1, totalWords);
        const distFromSheen = Math.abs(wordNormPos - sweepProgress);
        const isSheenActive = isSweeping && distFromSheen < 0.22;
        const sheenGlow = isSheenActive ? (1 - distFromSheen / 0.22) * 0.9 : 0;

        return (
          <span
            key={index}
            className="inline-block text-4xl lg:text-5xl font-extrabold tracking-tight"
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              color: isSheenActive ? '#ffffff' : headlineColor,
              textShadow: isSheenActive
                ? `0 0 18px rgba(255, 255, 255, ${sheenGlow}), 0 0 30px ${accentColor}`
                : 'none',
              transition: 'color 0.1s ease',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

