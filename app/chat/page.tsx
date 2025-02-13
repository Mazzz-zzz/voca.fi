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
  Spinner,
} from "@chakra-ui/react"
import { useState, useEffect } from "react"
import { useAccount, useWalletClient } from 'wagmi'
import { enqueueSnackbar } from 'notistack'
import OpenAI from 'openai'
import { useToolDefinitions } from '@/util/hooks/tools'
import { useSendEnsoTransaction, useApproveIfNecessary } from '@/util/hooks/wallet'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const STORAGE_KEY = 'voca_openai_key'

const SYSTEM_MESSAGE: Message = {
  role: 'system',
  content: `You are a knowledgeable DeFi and trading assistant. Help users with:
- Understanding trading concepts and DeFi protocols
- Analyzing trading strategies and market conditions
- Explaining blockchain concepts and smart contracts
- Providing guidance on safe trading practices
- Answering questions about crypto markets and tokens

Keep responses clear, accurate, and focused on helping users make informed trading decisions.
Always emphasize the importance of DYOR (Do Your Own Research) and risk management.
Never provide financial advice or specific trading recommendations.`
}

export default function ChatPage() {
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { getToolDefinitions, executeToolDefinition } = useToolDefinitions()
  const [message, setMessage] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [openai, setOpenai] = useState<OpenAI | null>(null)
  const [swapParams, setSwapParams] = useState<any>(null)

  const {
    send: sendSwap,
    ensoData,
    isFetchingEnsoData,
  } = useSendEnsoTransaction(
    swapParams?.amount,
    swapParams?.token_out as `0x${string}`,
    swapParams?.token_in,
    swapParams?.slippage
  );

  const approveWrite = useApproveIfNecessary(
    swapParams?.token_in as `0x${string}`,
    ensoData?.tx?.to as `0x${string}`,
    swapParams?.amount
  );

  // Initialize from localStorage and set up OpenAI client
  useEffect(() => {
    setMounted(true)
    const savedKey = localStorage.getItem(STORAGE_KEY)
    if (savedKey) {
      setApiKey(savedKey)
      setIsApiKeySet(true)
      const openaiClient = new OpenAI({
        apiKey: savedKey,
        dangerouslyAllowBrowser: true
      })
      setOpenai(openaiClient)
    }
  }, [])

  const handleSetApiKey = () => {
    if (apiKey.trim().startsWith('sk-')) {
      localStorage.setItem(STORAGE_KEY, apiKey)
      const openaiClient = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      })
      setOpenai(openaiClient)
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

  const handleChangeKey = () => {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey("")
    setIsApiKeySet(false)
    setOpenai(null)
  }

  const handleToolExecution = async (name: string, args: any) => {
    const result = await executeToolDefinition(name, args, walletClient);

    if (name === 'create_swap_transaction') {
      setSwapParams(result);
      try {
        if (approveWrite) {
          enqueueSnackbar('Approving token...', { variant: 'info' });
          await approveWrite.write();
          // Wait for a few blocks to ensure the approval is processed
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        enqueueSnackbar('Executing swap...', { variant: 'info' });
        const txResult = await sendSwap();
        enqueueSnackbar('Swap successful!', { variant: 'success' });
        return { ...result, transaction_hash: txResult };
      } catch (error) {
        enqueueSnackbar('Swap failed', { variant: 'error' });
        console.log('error', error)
        throw new Error(`Failed to execute transaction: ${error.message}`);
      }
    }
    console.log('result', result)
    return result;
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !openai || isLoading) return

    try {
      setIsLoading(true)
      const userMessage = { role: 'user' as const, content: message }
      setMessages(prev => [...prev, userMessage])
      setMessage("")

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: messages.concat(userMessage),
        tools: getToolDefinitions(),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      })

      const response = completion.choices[0].message
      
      // Handle tool calls if any
      if (response.tool_calls) {
        const toolResults = await Promise.all(
          response.tool_calls.map(async (call) => {
            const args = JSON.parse(call.function.arguments)
            console.log('args', args)
            const executedArgs = await handleToolExecution(call.function.name, args)
            return {
              name: call.function.name,
              args: executedArgs
            }
          })
        )

        const toolCallMessage = {
          role: 'assistant' as const,
          content: `I would execute these tools: ${toolResults.map(result => 
            `\n- ${result.name}(${JSON.stringify(result.args, null, 2)})`
          ).join('')}`
        }
        setMessages(prev => [...prev, toolCallMessage])
      } else {
        setMessages(prev => [...prev, response])
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Failed to send message", { 
        variant: "error" 
      })
      // Remove the user message if the API call failed
      setMessages(prev => prev.slice(0, -1))
      setMessage(message) // Restore the message in the input
    } finally {
      setIsLoading(false)
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
              <Button onClick={handleChangeKey}>
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
          {messages.length === 1 ? (
            <Text color="gray.500" textAlign="center" mt="40%">
              Start a conversation...
            </Text>
          ) : (
            <VStack align="stretch" gap={4}>
              {messages.filter(msg => msg.role !== 'system').map((msg, index) => (
                <Box 
                  key={index}
                  alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                  maxW="80%"
                  bg={msg.role === 'user' ? 'blue.500' : 'gray.200'}
                  color={msg.role === 'user' ? 'white' : 'black'}
                  p={3}
                  borderRadius="lg"
                >
                  <Text>{msg.content}</Text>
                </Box>
              ))}
              {isLoading && (
                <Flex justify="flex-start" p={2}>
                  <Spinner size="sm" />
                </Flex>
              )}
            </VStack>
          )}
        </Box>

        <Flex gap={4}>
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!isApiKeySet || isLoading}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!isApiKeySet || isLoading}
            loading={isLoading}
          >
            Send
          </Button>
        </Flex>
      </VStack>
    </Container>
  )
} 