"use client"

import { ReactNode } from 'react';
import { Box, BoxProps } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Types
interface BaseEffectProps extends BoxProps {
  children: ReactNode;
}

interface GlitchTextProps extends BaseEffectProps {
  intensity?: 'light' | 'medium' | 'heavy';
}

interface FloatingElementProps extends BaseEffectProps {
  speed?: 'slow' | 'medium' | 'fast';
  offset?: number;
}

interface GradientBlurProps extends BaseEffectProps {
  colors?: string[];
  speed?: number;
}

// Keyframes
const floatingAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
`;

const glitchAnimation1 = keyframes`
  0% { clip-path: inset(80% 0 20% 0); transform: translate(-2px, 2px); }
  20% { clip-path: inset(20% 0 80% 0); transform: translate(2px, -2px); }
  40% { clip-path: inset(40% 0 40% 0); transform: translate(1px, 1px); }
  60% { clip-path: inset(60% 0 30% 0); transform: translate(-1px, -1px); }
  80% { clip-path: inset(10% 0 70% 0); transform: translate(3px, -3px); }
  100% { clip-path: inset(80% 0 20% 0); transform: translate(-2px, 2px); }
`;

// Components
export const GlitchText = ({ children, intensity = 'medium', ...props }: GlitchTextProps) => {
  const getIntensityValues = () => {
    switch (intensity) {
      case 'light': return { delay: '4s', duration: '2s' };
      case 'heavy': return { delay: '2s', duration: '1s' };
      default: return { delay: '3s', duration: '1.5s' };
    }
  };

  const { delay, duration } = getIntensityValues();

  return (
    <Box position="relative" display="inline-block" {...props}>
      {/* Base Text */}
      <Box position="relative" zIndex={2}>
        {children}
      </Box>
      
      {/* Glitch Layers */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        zIndex={1}
        _before={{
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'inherit',
          animation: `${glitchAnimation1} ${duration} infinite ${delay}`,
          textShadow: '2px 0 red',
          clipPath: 'inset(45% 0 55% 0)',
        }}
        _after={{
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'inherit',
          animation: `${glitchAnimation1} ${duration} infinite ${delay}`,
          textShadow: '-2px 0 blue',
          clipPath: 'inset(55% 0 45% 0)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export const FloatingElement = ({ 
  children, 
  speed = 'medium',
  offset = 20,
  ...props 
}: FloatingElementProps) => {
  const getDuration = () => {
    switch (speed) {
      case 'slow': return '4s';
      case 'fast': return '2s';
      default: return '3s';
    }
  };

  return (
    <Box
      animation={`${floatingAnimation} ${getDuration()} ease-in-out infinite`}
      style={{ '--floating-offset': `${offset}px` } as any}
      {...props}
    >
      {children}
    </Box>
  );
};

export const GradientBlur = ({ 
  children, 
  colors = ['#ff0080', '#7928ca', '#0070f3'],
  speed = 20,
  ...props 
}: GradientBlurProps) => {
  const gradientAnimation = keyframes`
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  `;

  return (
    <Box
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        top: '-2px',
        left: '-2px',
        right: '-2px',
        bottom: '-2px',
        background: `linear-gradient(45deg, ${colors.join(', ')})`,
        backgroundSize: '200% 200%',
        animation: `${gradientAnimation} ${speed}s ease infinite`,
        filter: 'blur(16px)',
        opacity: 0.8,
        zIndex: -1,
        borderRadius: 'inherit',
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

// Utility component for combining effects
interface CombinedEffectProps extends BaseEffectProps {
  effects: ('glitch' | 'float' | 'gradient' | 'chromatic')[];
  glitchIntensity?: 'light' | 'medium' | 'heavy';
  floatSpeed?: 'slow' | 'medium' | 'fast';
  gradientColors?: string[];
}

export const CombinedEffect = ({ 
  children, 
  effects,
  glitchIntensity = 'medium',
  floatSpeed = 'medium',
  gradientColors,
  ...props 
}: CombinedEffectProps) => {
  let content = children;

  // Apply effects in reverse order (inside-out)
  effects.reverse().forEach(effect => {
    switch (effect) {
      case 'glitch':
        content = <GlitchText intensity={glitchIntensity}>{content}</GlitchText>;
        break;
      case 'float':
        content = <FloatingElement speed={floatSpeed}>{content}</FloatingElement>;
        break;
      case 'gradient':
        content = <GradientBlur colors={gradientColors}>{content}</GradientBlur>;
        break;
      // Note: Chromatic effect should be imported separately
    }
  });

  return <Box {...props}>{content}</Box>;
}; 