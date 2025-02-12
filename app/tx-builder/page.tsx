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
  Textarea,
  HStack,
  IconButton,
} from "@chakra-ui/react"
import { useState } from "react"
import { useAccount } from 'wagmi'
import { FaMicrophone, FaStop } from 'react-icons/fa'
import { enqueueSnackbar } from 'notistack'

export default function TxBuilderPage() {
  const { isConnected } = useAccount()
  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [transactionPreview, setTransactionPreview] = useState("")

  const handleStartRecording = () => {
    setIsRecording(true)
    enqueueSnackbar("Recording started - Speak your transaction instructions...", { 
      variant: "info" 
    })
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    enqueueSnackbar("Recording stopped - Processing your instructions...", { 
      variant: "info" 
    })
  }

  const handleSendMessage = () => {
    if (!message.trim()) return
    
    // Here we'll add the logic to process the message and build the transaction
    setTransactionPreview(`// Transaction preview will appear here
// Based on your instruction: "${message}"
// Processing...`)
    
    setMessage("")
  }

  if (!isConnected) {
    return (
      <Container py={8} h={"full"} w={"full"}>
        <VStack gap={4}>
          <Heading size="lg">Connect Wallet</Heading>
          <Text color="gray.500">Please connect your wallet to use the Transaction Builder</Text>
        </VStack>
      </Container>
    )
  }

  return (
    <Container py={8} h={"full"} w={"full"} maxW="container.lg">
      <VStack gap={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Transaction Builder</Heading>
          <Text color="gray.500">Build complex transactions using natural language</Text>
        </Box>

        <Flex gap={6} direction={{ base: 'column', md: 'row' }}>
          {/* Chat/Voice Input Section */}
          <Box flex={1}>
            <VStack gap={4} align="stretch">
              <Box 
                borderWidth={1} 
                borderRadius="lg" 
                p={4} 
                h="300px" 
                overflowY="auto"
                bg="gray.50"
              >
                <Text color="gray.500" mb={4}>
                  Example commands:
                </Text>
                <Text color="gray.600" fontSize="sm">
                  • "Swap 0.1 ETH for USDC using best route"<br/>
                  • "Create a limit order to sell 100 USDC when ETH reaches 3000"<br/>
                  • "Set up a recurring weekly buy of 50 USDC worth of ETH"
                </Text>
              </Box>

              <Flex gap={2}>
                <Input
                  placeholder="Type your transaction instructions..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <IconButton
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  children={isRecording ? <FaStop size={16} /> : <FaMicrophone size={16} />}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  colorScheme={isRecording ? "red" : "gray"}
                />
                <Button onClick={handleSendMessage}>
                  Build
                </Button>
              </Flex>
            </VStack>
          </Box>

          {/* Transaction Preview Section */}
          <Box flex={1}>
            <VStack gap={4} align="stretch">
              <Heading size="sm">Transaction Preview</Heading>
              <Textarea
                value={transactionPreview}
                readOnly
                height="300px"
                fontFamily="mono"
                placeholder="Your transaction will appear here..."
              />
              <Button
                disabled={!transactionPreview}
                colorScheme="blue"
              >
                Execute Transaction
              </Button>
            </VStack>
          </Box>
        </Flex>
      </VStack>
    </Container>
  )
} 