'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Icon,
  Stack,
  Image,
  HStack,
} from "@chakra-ui/react"
import { FloatingElement, GradientBlur, CombinedEffect } from '@/components/ui/effects'
import { ChromaticAberration } from '@/components/ui/chromatic-aberration'
import { IoWallet, IoMic, IoSwapHorizontal } from 'react-icons/io5'

const features = [
  {
    icon: <Icon as={IoMic} boxSize={8} />,
    title: "Voice & Text Commands",
    description: "Execute DeFi actions naturally using voice or text - 'Swap 1 POL for USDC'"
  },
  {
    icon: <Icon as={IoSwapHorizontal} boxSize={8} />,
    title: "Simple DeFi Actions",
    description: "Easily perform swaps, borrowing, and liquidity provision across protocols without complex interfaces"
  },
  {
    icon: <Icon as={IoWallet} boxSize={8} />,
    title: "Action Bundling",
    description: "Combine multiple DeFi operations into a single transaction - save time and gas"
  }
]

export default function HomePage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <Box 
      h="100vh" 
      w="100vw" 
      bg="white" 
      color="gray.700" 
      position="relative" 
      overflow="hidden"
      display="flex"
      alignItems="center"
      justifyContent="center"
      style={{ opacity: isClient ? 1 : 0 }}
    >
      {isClient && (
        <>
          {/* Background Effects */}
          <Box position="absolute" top="-50%" left="-25%" w="150%" h="150%" zIndex={0}>
            <GradientBlur
              colors={['#FFB5E8', '#B5DEFF', '#AFF8DB']}
              speed={20}
              opacity={0.4}
            >
              <Box w="full" h="full" />
            </GradientBlur>
          </Box>

          {/* Content */}
          <Container maxW="container.xl" position="relative" zIndex={1}>
            <Stack direction="column" gap="16" alignItems="center">
              {/* Logo and Title */}
              <Stack direction="column" gap="6">
                <FloatingElement speed="slow" offset={5}>
                  <ChromaticAberration intensity={5}>
                    <Box position="relative" display="flex" justifyContent="center" alignItems="center">
                      <Icon
                        as={IoMic}
                        boxSize="100px"
                        color="white"
                        style={{ filter: 'blur(2.5px)' }}
                        outline="1px solid white"
                        borderRadius="full"
                      />
                    </Box>
                  </ChromaticAberration>
                </FloatingElement>
                
                <FloatingElement speed="slow" offset={5}>
                  <Heading 
                    size="lg" 
                    textAlign="center" 
                    letterSpacing="wider"
                    bgClip="text"
                    color="gray.300"
                  >
                    Control DeFi with Your Voice
                  </Heading>
                </FloatingElement>
              </Stack>

              {/* Feature Grid */}
              <SimpleGrid columns={[1, 1, 3]} gap={8} w="full">
                {features.map((feature, i) => (
                  <CombinedEffect
                    key={i}
                    effects={['gradient', 'float']}
                    floatSpeed="slow"
                    gradientColors={['#FFB5E8', '#B5DEFF']}
                  >
                    <Box
                      p={8}
                      borderRadius="xl"
                      bg="rgba(255, 255, 255, 0.7)"
                      backdropFilter="blur(10px)"
                      borderWidth={1}
                      borderColor="gray.100"
                      boxShadow="0 4px 20px rgba(0, 0, 0, 0.05)"
                      height="300px"
                      display="flex"
                      alignItems="center"
                    >
                      <Stack direction="column" gap="4" alignItems="center" w="full">
                        <Box color="gray.700">
                          {feature.icon}
                        </Box>
                        <Heading 
                          size="md" 
                          textAlign="center"
                          color="gray.700"
                        >
                          {feature.title}
                        </Heading>
                        <Text 
                          textAlign="center" 
                          color="gray.500"
                          flex="1"
                        >
                          {feature.description}
                        </Text>
                      </Stack>
                    </Box>
                  </CombinedEffect>
                ))}
              </SimpleGrid>

              {/* Bottom Section */}
              <Stack gap={6} alignItems="center">
                <FloatingElement speed="slow" offset={5}>
                  <Text 
                    fontSize="lg" 
                    color="gray.600"
                    textAlign="center"
                    maxW="2xl"
                    fontWeight="medium"
                  >
                    Experience DeFi like never before with Voca.fi - where complex DeFi actions 
                    become as simple as having a conversation
                  </Text>
                </FloatingElement>

                {/* Built With Section */}
                <HStack gap={4} pt={8}>
                  <Text color="gray.500" fontSize="sm">Built with</Text>
                  <Image 
                    src="/wordmark_gradient.png" 
                    alt="Safe"
                    h="20px"
                    objectFit="contain"
                  />
                  <Text color="gray.500" fontSize="sm">&</Text>
                  <Image 
                    src="/safe-logo.svg" 
                    alt="Safe"
                    h="40px"
                    objectFit="contain"
                  />
                </HStack>
              </Stack>
            </Stack>
          </Container>
        </>
      )}
    </Box>
  )
} 