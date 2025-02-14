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
      minH="100vh" 
      w="100vw" 
      bg="white" 
      color="gray.700" 
      position="relative" 
      overflow="hidden"
      display="flex"
      alignItems="space-around"
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
          <Container maxW="container.xl" position="relative" zIndex={1} py={4}>
            <Stack direction="column" gap={["4", "6", "8"]} alignItems="center">
              {/* Warnings Section */}
              <Box
                w="full"
                p={3}
                bg="rgba(255, 255, 255, 0.8)"
                backdropFilter="blur(10px)"
                borderRadius="xl"
                borderWidth={0.5}
                borderColor="orange.200"
              >
                <Stack direction="column" gap={1}>
                  <HStack>
                    <Text fontSize="lg">⚠️</Text>
                    <Text fontWeight="medium" color="orange.500">Important Notes</Text>
                  </HStack>
                  <Stack direction="column" pl={7} gap={0.5}>
                    <Text fontSize="sm" color="gray.600">• Network only supports Polygon at the moment</Text>
                    <Text fontSize="sm" color="gray.600">• BYO API keys to OpenAI - requires access to realtime API (may need higher usage tier)</Text>
                    <Text fontSize="sm" color="gray.600">• Microphone permissions may not work on firefox or even arc browser. Please ensure you use chrome or brave.</Text>
                  </Stack>
                </Stack>
              </Box>

              {/* Logo and Title */}
              <Stack direction="column" gap="3">
                <FloatingElement speed="slow" offset={3}>
                  <ChromaticAberration intensity={5}>
                    <Box position="relative" display="flex" justifyContent="center" alignItems="center">
                      <Icon
                        as={IoMic}
                        boxSize={["60px", "80px"]}
                        color="white"
                        style={{ filter: 'blur(2.5px)' }}
                        outline="1px solid white"
                        borderRadius="full"
                      />
                    </Box>
                  </ChromaticAberration>
                </FloatingElement>
                
                <FloatingElement speed="slow" offset={3}>
                  <Heading 
                    size="md" 
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
              <SimpleGrid columns={[1, 1, 3]} gap={4} w="full">
                {features.map((feature, i) => (
                  <CombinedEffect
                    key={i}
                    effects={['gradient', 'float']}
                    floatSpeed="slow"
                    gradientColors={['#FFB5E8', '#B5DEFF']}
                  >
                    <Box
                      p={4}
                      borderRadius="xl"
                      bg="rgba(255, 255, 255, 0.7)"
                      backdropFilter="blur(10px)"
                      borderWidth={1}
                      borderColor="gray.100"
                      boxShadow="0 4px 20px rgba(0, 0, 0, 0.05)"
                      height={["auto", "auto", "200px"]}
                      display="flex"
                      alignItems="center"
                    >
                      <Stack direction="column" gap="2" alignItems="center" w="full">
                        <Box color="gray.700">
                          {feature.icon}
                        </Box>
                        <Heading 
                          size="sm" 
                          textAlign="center"
                          color="gray.700"
                        >
                          {feature.title}
                        </Heading>
                        <Text 
                          textAlign="center" 
                          color="gray.500"
                          fontSize="sm"
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
              <Stack gap={3} alignItems="center">
                <FloatingElement speed="slow" offset={3}>
                  <Text 
                    fontSize="md" 
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
                <HStack gap={3} pt={4}>
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