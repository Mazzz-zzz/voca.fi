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
  Icon,
  IconButton,
} from "@chakra-ui/react"
import { useState, useEffect, useCallback } from "react"
import { useAccount, useWalletClient } from 'wagmi'
import { enqueueSnackbar } from 'notistack'
import OpenAI from 'openai'
import ReactMarkdown from 'react-markdown'
import { useToolDefinitions } from '@/util/hooks/tools'
import { DEFAULT_SLIPPAGE, ETH_ADDRESS, ENSO_API_KEY } from '@/util/constants'
import { EnsoClient } from '@ensofinance/sdk'
import { IoSend, IoKey, IoSettings, IoInformationCircle } from "react-icons/io5"
import { formatUnits } from 'viem'
import { useChatSwap } from '@/util/hooks/useChatSwap'
import { SettingsPanel } from '@/components/ui/settings-panel'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const STORAGE_KEY = 'voca_openai_key'
const SETTINGS_STORAGE_KEY = 'voca_settings'

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
  const { isConnected, address: walletAddress } = useAccount()
  const { getToolDefinitions } = useToolDefinitions()
  const { prepareSwap, executeSwap } = useChatSwap()

  const [message, setMessage] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)


  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [swapResult, setSwapResult] = useState<any>(null)


  const [openai, setOpenai] = useState<OpenAI | null>(null)
  const [sendWithoutConfirm, setSendWithoutConfirm] = useState(false)

  // Initialize from localStorage and set up OpenAI client
  useEffect(() => {
    setMounted(true)
    const savedKey = localStorage.getItem(STORAGE_KEY)
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
    
    if (savedKey) {
      setApiKey(savedKey)
      setIsApiKeySet(true)
      const openaiClient = new OpenAI({
        apiKey: savedKey,
        dangerouslyAllowBrowser: true
      })
      setOpenai(openaiClient)
    }

    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setSendWithoutConfirm(settings.sendWithoutConfirm || false)
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

  const handleToggleSendWithoutConfirm = () => {
    const newValue = !sendWithoutConfirm
    setSendWithoutConfirm(newValue)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      sendWithoutConfirm: newValue
    }))
  }

  const handleToolExecution = async (name: string, args: any) => {
    if (name === 'create_swap_transaction') {
      try {
        const result = await prepareSwap(args.pol_outgoing_amount, args.token_received_symbol);
        console.log('swapResult', result)
        setSwapResult(result);  // Store the result
        if (!sendWithoutConfirm) {
          // If confirmation is required, add a message asking for confirmation
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I'll help you swap ${result.formattedAmountIn} POL for ${result.formattedAmountOut} ${args.token_received_symbol} with price impact: ${result.priceImpact.toFixed(2)}%.\nPlease confirm by replying with "ok" or "yes" to proceed with the transaction.`
          }]);
          return result;
        }

        // Add execution message before proceeding
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Executing swap of ${result.formattedAmountIn} POL for ${result.formattedAmountOut} ${args.token_received_symbol} with price impact: ${result.priceImpact.toFixed(2)}%`
        }]);

        try {
          const txResult = await executeSwap(result);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Transaction executed successfully! [View on Polygonscan](https://polygonscan.com/tx/${txResult})`
          }]);
          return { ...result, transaction_hash: txResult };
        } catch (error) {
          // Handle specific transaction errors
          let errorMessage = 'Failed to execute transaction';
          if (error.message.includes('rejected')) {
            errorMessage = 'Transaction was rejected in your wallet';
          } else if (error.message.includes('failed')) {
            errorMessage = `Transaction failed: ${error.message}`;
          }
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: errorMessage
          }]);
          throw error;
        }
      } catch (error) {
        console.error('Error in swap execution:', error);
        throw error;
      }
    } else if (name === 'confirm_swap') {
      try {
        const txResult = await executeSwap(swapResult);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Transaction executed successfully! [View on Polygonscan](https://polygonscan.com/tx/${txResult})`
        }]);
        return { transaction_hash: txResult };
      } catch (error) {
        console.error('Error executing swap:', error);
        let errorMessage = 'Failed to execute transaction';
        if (error.message.includes('rejected')) {
          errorMessage = 'Transaction was rejected in your wallet';
        } else if (error.message.includes('failed')) {
          errorMessage = `Transaction failed: ${error.message}`;
        }
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: errorMessage
        }]);
        throw error;
      }
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !openai || isLoading) return

    try {
      setIsLoading(true)
      const userMessage = { role: 'user' as const, content: message }
      setMessages(prev => [...prev, userMessage])
      setMessage("")

      // Check if this is a confirmation message for a pending swap
      if (swapResult && !sendWithoutConfirm && 
          (message.toLowerCase() === 'ok' || message.toLowerCase() === 'yes')) {
        try {
          const toolCall = {
            name: 'confirm_swap',
            arguments: '{}'
          };
          await handleToolExecution(toolCall.name, JSON.parse(toolCall.arguments));
          setIsLoading(false);
          return;
        } catch (error) {
          setIsLoading(false);
          return;
        }
      }

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
        const toolResults = [];
        for (const call of response.tool_calls) {
          const args = JSON.parse(call.function.arguments);
          await handleToolExecution(call.function.name, args);
          toolResults.push({
            name: call.function.name,
            args: args
          });
        }
        // Only add the tool execution message if it's not a swap transaction
        // (since we handle swap messages separately in handleToolExecution)
        if (!toolResults.some(result => result.name === 'create_swap_transaction')) {
          const toolCallMessage = {
            role: 'assistant' as const,
            content: `I would execute these tools: ${toolResults.map(result => 
              `\n- ${result.name}(${JSON.stringify(result.args, null, 2)})`
            ).join('')}`
          }
          setMessages(prev => [...prev, toolCallMessage])
        }
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
    <Container py={8} maxW="container.md" h={"full"}>
      <VStack gap={6} align="stretch">
        <Flex align="center" justify="space-between">
          <VStack align="start">
            <Heading size="lg">Voice Chat</Heading>
            <Text color="gray.500" fontSize="sm">Voice-powered trading assistant</Text>
          </VStack>
        </Flex>
        
        <SettingsPanel
          apiKey={apiKey}
          isApiKeySet={isApiKeySet}
          sendWithoutConfirm={sendWithoutConfirm}
          onApiKeyChange={setApiKey}
          onSetApiKey={handleSetApiKey}
          onChangeKey={handleChangeKey}
          onToggleSendWithoutConfirm={handleToggleSendWithoutConfirm}
        />
        
        <Box 
          borderWidth={1} 
          borderRadius="xl" 
          bg="white"
          shadow="sm"
          h="500px"
          display="flex"
          flexDirection="column"
        >
          <Box 
            p={6}
            flex={1}
            overflowY="auto"
            css={{
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                width: '6px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'gray.200',
                borderRadius: '24px',
              },
            }}
          >
            {messages.length === 1 ? (
              <Flex direction="column" align="center" justify="center" h="full" color="gray.400">
                <Text fontSize="lg" mb={2}>Welcome to Voice Chat</Text>
                <Text fontSize="sm">Start a conversation by typing a message below</Text>
              </Flex>
            ) : (
              <VStack align="stretch" gap={4}>
                {messages.filter(msg => msg.role !== 'system').map((msg, index) => (
                  <Box 
                    key={index}
                    alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                    maxW="80%"
                    bg={msg.role === 'user' ? 'blue.500' : 'gray.100'}
                    color={msg.role === 'user' ? 'white' : 'black'}
                    p={4}
                    borderRadius="2xl"
                    borderBottomRightRadius={msg.role === 'user' ? 'sm' : '2xl'}
                    borderBottomLeftRadius={msg.role === 'assistant' ? 'sm' : '2xl'}
                    shadow="sm"
                  >
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a 
                            {...props} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'underline' }}
                          />
                        )
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </Box>
                ))}
                {isLoading && (
                  <Flex justify="flex-start" p={2}>
                    <Spinner size="sm" color="blue.500" />
                  </Flex>
                )}
              </VStack>
            )}
          </Box>

          <Box 
            borderTopWidth={1} 
            p={4} 
            bg="gray.50" 
            borderBottomRadius="xl"
          >
            <Flex gap={3}>
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!isApiKeySet || isLoading}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                size="lg"
                bg="white"
                _placeholder={{ color: 'gray.400' }}
              />
              <IconButton
                aria-label="Send message"
                onClick={handleSendMessage}
                disabled={!isApiKeySet || isLoading}
                loading={isLoading}
                size="lg"
                colorScheme="blue"
              >
                <Icon as={IoSend} />
              </IconButton>
            </Flex>
          </Box>
        </Box>
      </VStack>
    </Container>
  )
} 