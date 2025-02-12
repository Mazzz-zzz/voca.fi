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
import { useState } from "react"
import { useAccount } from 'wagmi'

export default function ChatPage() {
  const { isConnected } = useAccount()
  const [message, setMessage] = useState("")

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
          />
          <Button onClick={() => setMessage("")}>
            Send
          </Button>
        </Flex>
      </VStack>
    </Container>
  )
} 