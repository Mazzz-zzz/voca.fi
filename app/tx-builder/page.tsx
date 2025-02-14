'use client'

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  Input,
  IconButton,
  Icon,
  Code,
  Spinner,
} from "@chakra-ui/react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useAccount } from 'wagmi'
import { enqueueSnackbar } from 'notistack'
import { IoMic, IoMicOff, IoSend, IoKey, IoSettings, IoInformationCircle, IoTrash, IoReorderTwo } from "react-icons/io5"
import ReactMarkdown from 'react-markdown'
import { useToolDefinitions } from '@/util/hooks/tools'
import { useChatSwap } from '@/util/hooks/useChatSwap'
import OpenAI from 'openai'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SettingsPanel } from '@/components/ui/settings-panel'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: Array<{
    name: string
    arguments: any
  }>
}

type QueuedTransaction = {
  id: string
  name: string
  arguments: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: any
}

const SYSTEM_MESSAGE: Message = {
  role: 'system',
  content: `You are a knowledgeable DeFi transaction builder assistant. Help users with:
- Building and executing complex DeFi transactions
- Understanding transaction parameters and gas costs
- Explaining transaction flows and expected outcomes
- Providing guidance on safe transaction practices

Keep responses clear, accurate, and focused on helping users make informed transaction decisions.
Always emphasize the importance of reviewing transactions before execution.
Never provide financial advice or specific trading recommendations.`
}

interface SortableTransactionItemProps {
  tx: QueuedTransaction
  onDelete: (id: string) => void
}

function SortableTransactionItem({ tx, onDelete }: SortableTransactionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: tx.id,
    disabled: tx.status !== 'pending'
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <Box 
      ref={setNodeRef}
      style={style}
      borderWidth={1}
      borderRadius="lg"
      p={4}
      bg="gray.50"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Flex align="center" gap={2}>
          {tx.status === 'pending' && (
            <Box
              {...attributes}
              {...listeners}
              cursor="grab"
              _active={{ cursor: 'grabbing' }}
              display="flex"
              alignItems="center"
            >
              <Icon 
                as={IoReorderTwo} 
                color="gray.400"
                boxSize={5}
              />
            </Box>
          )}
          <Text fontWeight="medium">{tx.name}</Text>
        </Flex>
        <Flex align="center" gap={2}>
          <Text
            fontSize="sm"
            color={
              tx.status === 'completed' ? 'green.500' :
              tx.status === 'failed' ? 'red.500' :
              tx.status === 'executing' ? 'blue.500' :
              'gray.500'
            }
          >
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
          </Text>
          {tx.status === 'pending' && (
            <IconButton
              aria-label="Delete transaction"
              onClick={() => onDelete(tx.id)}
              size="sm"
              variant="ghost"
              colorScheme="red"
            >
              <Icon as={IoTrash} />
            </IconButton>
          )}
        </Flex>
      </Flex>
      <Code p={2} borderRadius="md" fontSize="sm" w="full">
        {JSON.stringify(tx.arguments, null, 2)}
      </Code>
      {tx.status === 'completed' && tx.result?.txHash && (
        <Text fontSize="sm" mt={2}>
          <a 
            href={`https://polygonscan.com/tx/${tx.result.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'blue.500', textDecoration: 'underline' }}
          >
            View on Polygonscan
          </a>
        </Text>
      )}
    </Box>
  )
}

const STORAGE_KEY = 'voca_openai_key'
const SETTINGS_STORAGE_KEY = 'voca_tx_builder_settings'

export default function TxBuilderPage() {
  const { isConnected } = useAccount()
  const { getToolDefinitions } = useToolDefinitions()
  const { prepareSwap, executeSwap, prepareBundledTransaction, executeBundledTransaction } = useChatSwap()

  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [queuedTransactions, setQueuedTransactions] = useState<QueuedTransaction[]>([])
  const [mounted, setMounted] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [sendWithoutConfirm, setSendWithoutConfirm] = useState(false)
  const [openai, setOpenai] = useState<OpenAI | null>(null)

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

  const handleToolExecution = async (name: string, args: any) => {
    if (name === 'create_swap_transaction') {
      try {
        const result = await prepareSwap(args.pol_outgoing_amount, args.token_received_symbol)
        
        // Add to transaction queue
        const newTransaction: QueuedTransaction = {
          id: Math.random().toString(36).substring(7),
          name: 'create_swap_transaction',
          arguments: args,
          status: 'pending',
          result: result
        }
        
        setQueuedTransactions(prev => [...prev, newTransaction])
        
        return result
      } catch (error) {
        console.error('Error in swap preparation:', error)
        throw error
      }
    }
  }

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
      
      if (response.tool_calls) {
        for (const call of response.tool_calls) {
          const args = JSON.parse(call.function.arguments)
          await handleToolExecution(call.function.name, args)
        }
      }
      
      setMessages(prev => [...prev, response])

    } catch (error) {
      enqueueSnackbar(error.message || "Failed to process message", { 
        variant: "error" 
      })
      setMessages(prev => prev.slice(0, -1))
      setMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  const executeAllTransactions = async () => {
    try {
      // Only bundle pending transactions
      const pendingTransactions = queuedTransactions.filter(tx => tx.status === 'pending');
      
      if (pendingTransactions.length === 0) {
        return;
      }

      // Update all pending transactions to executing
      setQueuedTransactions(prev => 
        prev.map(tx => tx.status === 'pending' ? { ...tx, status: 'executing' } : tx)
      );

      // Prepare the bundle
      const bundleResult = await prepareBundledTransaction(pendingTransactions);

      // Execute the bundled transaction
      const txHash = await executeBundledTransaction(bundleResult);

      // Update all executed transactions
      setQueuedTransactions(prev => 
        prev.map(tx => {
          if (tx.status === 'executing') {
            return { 
              ...tx, 
              status: 'completed',
              result: { ...tx.result, txHash } 
            };
          }
          return tx;
        })
      );

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `All transactions executed successfully! [View on Polygonscan](https://polygonscan.com/tx/${txHash})`
      }]);

    } catch (error) {
      // Update all executing transactions to failed
      setQueuedTransactions(prev => 
        prev.map(tx => tx.status === 'executing' ? { ...tx, status: 'failed' } : tx)
      );
      
      const errorMessage = error.message || "Failed to execute transactions";
      if (!errorMessage.includes('rejected')) {
        enqueueSnackbar(errorMessage, { variant: "error" });
      }
      console.error('Error executing transactions:', error);
    }
  };

  const deleteTransaction = (id: string) => {
    setQueuedTransactions(prev => prev.filter(t => t.id !== id))
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setQueuedTransactions((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  if (!mounted) {
    return (
      <Container py={8} h={"full"} w={"full"}>
        <VStack gap={4}>
          <Heading size="lg">Transaction Builder</Heading>
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
          <Text color="gray.500">Please connect your wallet to use the Transaction Builder</Text>
        </VStack>
      </Container>
    )
  }

  return (
    <Container py={8} maxW="container.xl" h={"full"}>
      <VStack gap={6} align="stretch">
        <Flex align="center" justify="space-between">
          <VStack align="start">
            <Heading size="lg">Transaction Builder</Heading>
            <Text color="gray.500" fontSize="sm">Build and execute transaction sequences</Text>
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

        <Flex gap={6} align="stretch">
          {/* Builder Window */}
          <Box flex={1}>
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
                    <Text fontSize="lg" mb={2}>Welcome to Transaction Builder</Text>
                    <Text fontSize="sm">Start by describing the transaction you want to build</Text>
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
                    placeholder="Describe your transaction..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={!isApiKeySet || isLoading}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    size="lg"
                    bg="white"
                    _placeholder={{ color: 'gray.400' }}
                  />
                  <IconButton
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    colorScheme={isRecording ? "red" : "gray"}
                    size="lg"
                    disabled={!isApiKeySet}
                  >
                    <Icon as={isRecording ? IoMicOff : IoMic} />
                  </IconButton>
                  <IconButton
                    aria-label="Send message"
                    onClick={handleSendMessage}
                    disabled={!isApiKeySet || isLoading}
                    size="lg"
                    colorScheme="blue"
                  >
                    <Icon as={IoSend} />
                  </IconButton>
                </Flex>
              </Box>
            </Box>
          </Box>

          {/* Queue Window */}
          <Box flex={1}>
            <Box
              borderWidth={1}
              borderRadius="xl"
              bg="white"
              shadow="sm"
              h="500px"
              display="flex"
              flexDirection="column"
            >
              <Box p={6} h="full" display="flex" flexDirection="column">
                <Heading size="sm" mb={4}>Transaction Queue</Heading>
                <Box flex={1} overflowY="auto">
                  <VStack align="stretch" gap={4}>
                    {queuedTransactions.length === 0 ? (
                      <Flex 
                        direction="column" 
                        align="center" 
                        justify="center" 
                        h="350px" 
                        color="gray.400"
                        borderWidth={2}
                        borderStyle="dashed"
                        borderRadius="xl"
                        p={6}
                      >
                        <Text fontSize="lg" mb={2}>No Transactions Queued</Text>
                        <Text fontSize="sm" textAlign="center">
                          Transactions will appear here when you describe what you want to do
                        </Text>
                      </Flex>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={queuedTransactions}
                          strategy={verticalListSortingStrategy}
                        >
                          {queuedTransactions.map((tx) => (
                            <SortableTransactionItem
                              key={tx.id}
                              tx={tx}
                              onDelete={deleteTransaction}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </VStack>
                </Box>
                {queuedTransactions.some(tx => tx.status === 'pending') && (
                  <Button
                    colorScheme="blue"
                    size="lg"
                    mt={4}
                    onClick={executeAllTransactions}
                    loading={queuedTransactions.some(tx => tx.status === 'executing')}
                  >
                    Execute All Transactions
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </Flex>
      </VStack>
    </Container>
  )
} 