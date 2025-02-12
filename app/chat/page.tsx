'use client'

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  Input,
  Button,
} from "@chakra-ui/react"
import { useState, useEffect } from "react"
import { useAccount } from 'wagmi'
import { enqueueSnackbar } from 'notistack'

export default function ChatPage() {
  const { isConnected } = useAccount()
  const [message, setMessage] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSetApiKey = () => {
    if (apiKey.trim().startsWith('sk-')) {
      setIsApiKeySet(true)
      enqueueSnackbar("OpenAI API key has been set successfully", { 
        variant: "success" 
      })
    } else {
      enqueueSnackbar("Please enter a valid OpenAI API key starting with 'sk-'", { 
        variant: "error" 
      })
    }
  }

  // Prevent hydration mismatch by not rendering wallet-dependent content on first render
  if (!mounted) {
    return (
      <Container py={8} h={"full"} w={"full"}>
        <VStack gap={4}>
          <Heading size="lg">Voice Chat</Heading>
          <Text color="gray.500">Loading...</Text>
        </VStack>
      </Container>
    )
  }

  if (!isConnected) {
    return (
      <Container py={8} h={"full"} w={"full"}>
        <VStack gap={4}>
          <Heading size="lg">Connect Wallet</Heading>
          <Text color="gray.500">Please connect your wallet to access the chat</Text>
        </VStack>
      </Container>
    )
  }

  return (
    <Container py={8} h={"full"} w={"full"}>
      <VStack gap={4} align="stretch">
        <Heading size="lg">Voice Chat</Heading>
        <Text color="gray.500">Coming soon: Voice-powered trading chat interface</Text>
        
        <Box
          borderWidth={1}
          borderRadius="lg"
          p={4}
          bg="gray.50"
        >
          <Text mb={2} fontWeight="medium">BYO-Keys: OpenAI API Key</Text>
          <Flex gap={2}>
            <Input
              type="password"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isApiKeySet}
            />
            <Button onClick={handleSetApiKey} disabled={isApiKeySet}>
              Set Key
            </Button>
            {isApiKeySet && (
              <Button onClick={() => setIsApiKeySet(false)}>
                Change
              </Button>
            )}
          </Flex>
        </Box>
        
        <Box 
          borderWidth={1} 
          borderRadius="lg" 
          p={4} 
          h="400px" 
          overflowY="auto"
          bg="gray.50"
        >
          {/* Chat messages will go here */}
          <Text color="gray.500" textAlign="center" mt="40%">
            Voice chat functionality coming soon...
          </Text>
        </Box>

        <Flex gap={4}>
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!isApiKeySet}
          />
          <Button onClick={() => setMessage("")} disabled={!isApiKeySet}>
            Send
          </Button>
        </Flex>
      </VStack>
    </Container>
  )
} 