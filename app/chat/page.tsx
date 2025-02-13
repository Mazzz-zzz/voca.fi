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
import { useToolDefinitions } from '@/util/hooks/tools'
import { useSendEnsoTransaction, useApproveIfNecessary } from '@/util/hooks/wallet'
import { DEFAULT_SLIPPAGE, ETH_ADDRESS, ENSO_API_KEY } from '@/util/constants'
import { EnsoClient } from '@ensofinance/sdk'
import { IoSend, IoKey, IoSettings, IoInformationCircle } from "react-icons/io5"
import { formatUnits } from 'viem'

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: ENSO_API_KEY,
});

async function searchTokenBySymbol(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.enso.finance/api/v1/tokens?chainId=137&includeMetadata=true`, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${ENSO_API_KEY}`
      }
    });
    
    const data = await response.json();
    if (data && data.data && data.data.length > 0) {
      // Find exact match first
      const exactMatch = data.data.find(
        (token: any) => token.symbol?.toLowerCase() === symbol.toLowerCase()
      );
      if (exactMatch) {
        return exactMatch.address;
      }
      // If no exact match, try to find a partial match
      const partialMatch = data.data.find(
        (token: any) => token.symbol?.toLowerCase().includes(symbol.toLowerCase())
      );
      if (partialMatch) {
        return partialMatch.address;
      }
    }
    return null;
  } catch (error) {
    console.error('Error searching for token:', error);
    return null;
  }
}

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
  const { data: walletClient } = useWalletClient()
  const { getToolDefinitions } = useToolDefinitions()
  const [message, setMessage] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [openai, setOpenai] = useState<OpenAI | null>(null)
  const [swapParams, setSwapParams] = useState<any>(null)
  const [sendWithoutConfirm, setSendWithoutConfirm] = useState(false)

  const {
    send: sendSwap,
    ensoData,
    isFetchingEnsoData,
  } = useSendEnsoTransaction(
    swapParams?.amount,
    swapParams?.token_out as `0x${string}`,
    swapParams?.token_in as `0x${string}`,
    DEFAULT_SLIPPAGE
  );

  console.log('Enso data:', ensoData);

  const approveWrite = useApproveIfNecessary(
    swapParams?.token_in as `0x${string}`,
    ensoData?.tx?.to as `0x${string}`,
    swapParams?.amount
  );

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

  const executeToolDefinition = useCallback(async (name: string, args: any, walletClient: any) => {
    if (name === 'create_swap_transaction') {
      const tokenOutAddress = await searchTokenBySymbol(args.token_received_symbol);
      if (!tokenOutAddress) {
        throw new Error(`Token ${args.token_received_symbol} not found on Polygon`);
      }

      const routeParams = {
        chainId: 137,
        fromAddress: walletAddress as `0x${string}`,
        amountIn: args.pol_outgoing_amount,
        tokenIn: ETH_ADDRESS as `0x${string}`,
        tokenOut: tokenOutAddress as `0x${string}`,
        receiver: walletAddress as `0x${string}`,
        spender: walletAddress as `0x${string}`,
      };
      console.log('routeParams', routeParams)

      const quoteParams = {
        chainId: 137, // Polygon
        fromAddress: walletAddress as `0x${string}`,
        tokenIn: ETH_ADDRESS as `0x${string}`, // POL token address
        tokenOut: tokenOutAddress as `0x${string}`,
        amountIn: args.pol_outgoing_amount,
      };

      try {
        // Get route and quote data
        const routeData = await ensoClient.getRouterData(routeParams);
        const quoteData = await ensoClient.getQuoteData(quoteParams);

        if (!walletClient) {
          throw new Error('Wallet client not initialized');
        }

        // Return transaction parameters instead of executing
        return {
          ...args,
          token_out: tokenOutAddress,
          from_address: walletAddress,
          route_data: routeData,
          quote_data: quoteData,
          amount: args.pol_outgoing_amount,
          token_in: ETH_ADDRESS as `0x${string}`,
          slippage: 0.5
        };

      } catch (error) {
        console.error('Error executing swap:', error);
        throw new Error(`Failed to execute swap: ${error.message}`);
      }
    }
    return args;
  }, [walletAddress]);

  const handleToolExecution = async (name: string, args: any) => {
    const result = await executeToolDefinition(name, args, walletClient);

    if (name === 'create_swap_transaction') {
      setSwapParams(result);
      
      const formattedAmountIn = formatUnits(BigInt(args.pol_outgoing_amount), 18)
      const formattedAmountOut = formatUnits(BigInt(result.quote_data?.amountOut || 0), 18) // USDC has 6 decimals
      const priceImpact = (result.quote_data?.priceImpact ?? 0) / 100
      
      if (!sendWithoutConfirm) {
        // If confirmation is required, add a message asking for confirmation
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I'll help you swap ${formattedAmountIn} POL for ${formattedAmountOut} ${args.token_received_symbol} with price impact: ${priceImpact.toFixed(2)}%.\nPlease confirm by replying with "ok" or "yes" to proceed with the transaction.`
        }]);
        return result;
      }

      try {
        // Add execution message before proceeding
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Executing swap of ${formattedAmountIn} POL for ${formattedAmountOut} ${args.token_received_symbol} with price impact: ${priceImpact.toFixed(2)}%`
        }]);

        if (approveWrite) {
          enqueueSnackbar('Approving token...', { variant: 'info' });
          await approveWrite.write();
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
    return result;
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !openai || isLoading) return

    try {
      setIsLoading(true)
      const userMessage = { role: 'user' as const, content: message }
      setMessages(prev => [...prev, userMessage])
      setMessage("")

      // Check if this is a confirmation message for a pending swap
      if (swapParams && !sendWithoutConfirm && 
          (message.toLowerCase() === 'ok' || message.toLowerCase() === 'yes')) {
        try {
          if (approveWrite) {
            enqueueSnackbar('Approving token...', { variant: 'info' });
            await approveWrite.write();
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          enqueueSnackbar('Executing swap...', { variant: 'info' });
          const txResult = await sendSwap();
          enqueueSnackbar('Swap successful!', { variant: 'success' });
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Transaction executed successfully!'
          }]);
          
          setSwapParams(null); // Clear the pending swap
          setIsLoading(false);
          return;
        } catch (error) {
          enqueueSnackbar('Swap failed', { variant: 'error' });
          console.log('error', error);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Failed to execute transaction: ${error.message}`
          }]);
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
        
        <Box
          borderWidth={1}
          borderRadius="xl"
          p={6}
          bg="white"
          shadow="sm"
        >
          <Flex align="center" mb={4}>
            <Icon as={IoKey} mr={2} color="gray.600" />
            <Text fontWeight="medium">BYO-Keys: OpenAI API Key</Text>
            <Box 
              as="span" 
              ml={2} 
              color="gray.400" 
              cursor="help" 
              title="Your API key is stored locally and never sent to our servers"
            >
              <Icon as={IoInformationCircle} />
            </Box>
          </Flex>
          <Flex gap={2}>
            <Input
              type="password"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isApiKeySet}
              size="lg"
              _placeholder={{ color: 'gray.400' }}
            />
            <Button 
              onClick={handleSetApiKey} 
              disabled={isApiKeySet}
              size="lg"
              colorScheme="blue"
            >
              Set Key
            </Button>
            {isApiKeySet && (
              <Button 
                onClick={handleChangeKey}
                size="lg"
                variant="outline"
              >
                Change
              </Button>
            )}
          </Flex>
        </Box>

        <Box
          borderWidth={1}
          borderRadius="xl"
          p={6}
          bg="white"
          shadow="sm"
        >
          <Flex align="center" mb={4}>
            <Icon as={IoSettings} mr={2} color="gray.600" />
            <Text fontWeight="medium">Chat Settings</Text>
          </Flex>
          <Flex align="center" justify="space-between">
            <Box>
              <Text>Send without confirmation</Text>
              <Text fontSize="sm" color="gray.500">Automatically execute transactions without asking</Text>
            </Box>
            <Button
              size="md"
              colorScheme={sendWithoutConfirm ? "green" : "gray"}
              onClick={handleToggleSendWithoutConfirm}
              variant={sendWithoutConfirm ? "solid" : "outline"}
            >
              {sendWithoutConfirm ? "Enabled" : "Disabled"}
            </Button>
          </Flex>
        </Box>
        
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
                    <Text>{msg.content}</Text>
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