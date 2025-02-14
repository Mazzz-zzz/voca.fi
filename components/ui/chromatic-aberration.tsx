"use client"

import { ReactNode } from 'react';
import { Box, BoxProps } from '@chakra-ui/react';

interface ChromaticAberrationProps extends BoxProps {
  children: ReactNode;
  intensity?: number; // Controls the strength of the effect (1-10)
  animate?: boolean; // Whether to animate the effect
}

export const ChromaticAberration = ({ 
  children, 
  intensity = 2,
  animate = false,
  ...props 
}: ChromaticAberrationProps) => {
  const offset = Math.min(intensity, 10) * 0.5; // Limit max intensity

  return (
    <Box position="relative" {...props}>
      {/* Base layer */}
      <Box
        position="relative"
        zIndex={2}
      >
        {children}
      </Box>

      {/* Red channel */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={1}
        style={{
          transform: `translate(${offset}px, 0)`,
          mixBlendMode: 'screen',
          filter: 'url(#redMatrix)',
          animation: animate ? 'chromaticMove 2s ease-in-out infinite' : 'none',
        }}
      >
        {children}
      </Box>

      {/* Blue channel */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={1}
        style={{
          transform: `translate(-${offset}px, 0)`,
          mixBlendMode: 'screen',
          filter: 'url(#blueMatrix)',
          animation: animate ? 'chromaticMove 2s ease-in-out infinite reverse' : 'none',
        }}
      >
        {children}
      </Box>

      {/* SVG Filters */}
      <Box as="svg" width="0" height="0" position="absolute" visibility="hidden">
        <defs>
          <filter id="redMatrix">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
            />
          </filter>
          <filter id="blueMatrix">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </Box>

      <style jsx global>{`
        @keyframes chromaticMove {
          0% {
            transform: translate(${offset}px, 0);
          }
          50% {
            transform: translate(-${offset}px, 0);
          }
          100% {
            transform: translate(${offset}px, 0);
          }
        }
      `}</style>
    </Box>
  );
}; 