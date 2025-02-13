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
  IconButton,
  Icon,
} from "@chakra-ui/react"
import { useState, useEffect, useRef } from "react"
import { useAccount } from 'wagmi'
import { enqueueSnackbar } from 'notistack'
import { IoMic, IoMicOff, IoKey, IoSettings, IoInformationCircle } from "react-icons/io5"
import ReactMarkdown from 'react-markdown'
import { useToolDefinitions } from '@/util/hooks/tools'
import { useChatSwap } from '@/util/hooks/useChatSwap'

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  tempId?: string  // Optional temporary ID to match transcripts with messages
}

type ToolDefinitionType = {
  type?: "function"
  name: string
  description: string
  parameters: { [key: string]: any }
}

type AudioFormatType = "pcm16" | "g711_ulaw" | "g711_alaw"

type AudioTranscriptionType = {
  model: "whisper-1"
}

type TurnDetectionServerVadType = {
  type: "server_vad"
  threshold?: number
  prefix_padding_ms?: number
  silence_duration_ms?: number
}

type SessionResourceType = {
  model?: string
  modalities?: string[]
  instructions?: string
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  input_audio_format?: AudioFormatType
  output_audio_format?: AudioFormatType
  input_audio_transcription?: AudioTranscriptionType | null
  turn_detection?: TurnDetectionServerVadType | null
  tools?: ToolDefinitionType[]
  tool_choice?: "auto" | "none" | "required" | { type: "function"; name: string }
  temperature?: number
  max_response_output_tokens?: number | "inf"
}

type ItemStatusType = "in_progress" | "completed" | "incomplete"

type InputTextContentType = {
  type: "input_text"
  text: string
}

type InputAudioContentType = {
  type: "input_audio"
  audio?: string
  transcript?: string | null
}

type TextContentType = {
  type: "text"
  text: string
}

type AudioContentType = {
  type: "audio"
  audio?: string
  transcript?: string | null
}

type BaseItemType = {
  previous_item_id?: string | null
  type: "message" | "function_call" | "function_call_output"
  status?: ItemStatusType
  role?: "user" | "assistant" | "system"
  content?: Array<InputTextContentType | InputAudioContentType | TextContentType | AudioContentType>
  call_id?: string
  name?: string
  arguments?: string
  output?: string
}

type ItemType = BaseItemType & {
  id: string
  object: string
  formatted: {
    audio?: Int16Array
    text?: string
    transcript?: string
    tool?: {
      type: "function"
      name: string
      call_id: string
      arguments: string
    }
    output?: string
    file?: any
  }
}

const STORAGE_KEY = 'voca_openai_key'
const SETTINGS_STORAGE_KEY = 'voca_voice_settings'

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

const defaultSessionConfig: SessionResourceType = {
  modalities: ['text', 'audio'],
  instructions: SYSTEM_MESSAGE.content,
  voice: 'verse',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: null,
  turn_detection: null,
  tools: [],
  tool_choice: 'auto',
  temperature: 0.8,
  max_response_output_tokens: 4096,
}

const defaultServerVadConfig: TurnDetectionServerVadType = {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 200,
}

export default function VoicePage() {
  const { isConnected } = useAccount()
  const { getToolDefinitions } = useToolDefinitions()
  const { prepareSwap, executeSwap } = useChatSwap()

  const [apiKey, setApiKey] = useState("")
  const [isApiKeySet, setIsApiKeySet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MESSAGE])
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [swapResult, setSwapResult] = useState<any>(null)
  const [sendWithoutConfirm, setSendWithoutConfirm] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioQueueRef = useRef<Array<Int16Array>>([])
  const isPlayingRef = useRef(false)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playbackAudioContextRef = useRef<AudioContext | null>(null)

  // Initialize playback audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      playbackAudioContextRef.current = new AudioContext()
    }
    return () => {
      playbackAudioContextRef.current?.close()
    }
  }, [])

  // Check microphone permissions on mount
  useEffect(() => {
    const checkMicrophonePermissions = async () => {
      try {
        // Check if permissions API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          setMicrophonePermission(result.state)
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setMicrophonePermission(result.state)
          })
        } else {
          // Fallback to getUserMedia check
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(track => track.stop())
            setMicrophonePermission('granted')
          } catch {
            setMicrophonePermission('denied')
          }
        }
      } catch (error) {
        console.error('Error checking microphone permissions:', error)
        setMicrophonePermission('prompt')
      }
    }

    if (typeof window !== 'undefined') {
      checkMicrophonePermissions()
    }
  }, [])

  // Initialize from localStorage
  useEffect(() => {
    setMounted(true)
    const savedKey = localStorage.getItem(STORAGE_KEY)
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
    
    if (savedKey) {
      setApiKey(savedKey)
      setIsApiKeySet(true)
      initializeWebSocket(savedKey)
    }

    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setSendWithoutConfirm(settings.sendWithoutConfirm || false)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Cleanup function
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const initializeWebSocket = (key: string) => {
    const ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        [
          "realtime",
          // Auth
          "openai-insecure-api-key." + key, 

          // Beta protocol, required
          "openai-beta.realtime-v1"
        ]
      );

    ws.onopen = () => {
      console.log('WebSocket connected')
      // Get and validate tool definitions
      const tools = getToolDefinitions()
      const validTools = tools.map(tool => ({
        type: "function" as const,
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      })).filter(tool => tool.name && tool.description)

      // Send initial session configuration
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          ...defaultSessionConfig,
          tools: validTools,
          instructions: SYSTEM_MESSAGE.content,
          input_audio_transcription: {
            model: "whisper-1"
          },
          turn_detection: defaultServerVadConfig
        }
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
        enqueueSnackbar("Failed to process response", { variant: "error" })
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      enqueueSnackbar("Failed to connect to OpenAI", { variant: "error" })
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      if (!event.wasClean) {
        enqueueSnackbar("Connection closed unexpectedly", { variant: "error" })
      }
    }

    wsRef.current = ws
  }

  const handleWebSocketMessage = async (data: any) => {
    try {
      switch (data.type) {
        case 'session.created':
          console.log('Session created:', data.session)
          setSessionId(data.session)
          break

        case 'session.updated':
          console.log('Session configuration updated:', data.session)
          // After session is updated, we can start accepting audio input
          setIsApiKeySet(true)
          break

        case 'conversation.item.created':
          console.log('Conversation item created:', data.item)
          if (data.item.role === 'assistant') {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: data.item.content[0]?.text || ''
            }])
          } else if (data.item.role === 'user') {
            // Handle user message confirmation
            const content = data.item.content[0]
            if (content?.type === 'input_text') {
              setMessages(prev => [...prev, {
                role: 'user',
                content: content.text
              }])
            }
          }
          break

        case 'input_audio_buffer.committed':
          console.log('Audio buffer committed')
          // Add an empty user message as a placeholder for the transcript
          setMessages(prev => [...prev, {
            role: 'user',
            content: '',
            tempId: data.item_id // Store the item_id to match with transcript later
          }])
          break

        case 'conversation.item.input_audio_transcription.completed':
          //console.log('Conversation item input audio transcription completed:', data)
          if (data.item_id && data.transcript) {
            setMessages(prev => {
              // Find the placeholder message with matching tempId
              const messageIndex = prev.findIndex(msg => 
                msg.role === 'user' && 
                msg.tempId === data.item_id
              )
              
              if (messageIndex !== -1) {
                const updatedMessages = [...prev]
                updatedMessages[messageIndex] = {
                  role: 'user',
                  content: data.transcript
                }
                return updatedMessages
              }
              
              // If no matching message found, add as new message
              return [...prev, {
                role: 'user',
                content: data.transcript
              }]
            })
            
            // Update the transcript state for display
            setTranscript(data.transcript)
          }
          break

        //set assistant text as it comes in
        case 'response.text.delta':
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1]
            if (lastMessage?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMessage,
                  content: lastMessage.content + data.delta.text
                }
              ]
            }
            return prev
          })
          break

        case 'response.audio_transcript.delta':
          // Handle audio transcript delta
          //console.log('Response audio transcript delta:', data)
          if (data.delta) {
            setMessages(prev => {
              const lastMessage = prev[prev.length - 1]
              if (lastMessage?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + data.delta
                  }
                ]
              }
              return prev
            })
          }
          break

        case 'response.audio.delta':
          if (data.delta && playbackAudioContextRef.current) {
            try {
              // Decode base64 to bytes
              const audioData = atob(data.delta)
              const bytes = new Uint8Array(audioData.length)
              for (let i = 0; i < audioData.length; i++) {
                bytes[i] = audioData.charCodeAt(i)
              }

              // Convert bytes to PCM16 samples
              const pcmData = new Int16Array(bytes.buffer)
              
              // Add to queue
              audioQueueRef.current.push(pcmData)
              
              // Try to play next in queue if not currently playing
              if (!isPlayingRef.current) {
                playNextInQueue()
              }
            } catch (error) {
              console.error('Error processing audio:', error)
            }
          }
          break

        case 'input_audio_buffer.speech_started':
          setIsListening(true)
          break

        case 'input_audio_buffer.speech_stopped':
          setIsListening(false)
          // No need to send accumulated buffer since we're streaming it in real-time
          break

        case 'error':
          console.error('Server error:', data.error)
          if (data.error?.type === 'invalid_request_error') {
            // Handle specific error types
            switch (data.error?.code) {
              case 'missing_required_parameter':
                enqueueSnackbar(`Configuration error: ${data.error.message}`, { 
                  variant: "error",
                  autoHideDuration: 5000
                })
                break
              default:
                enqueueSnackbar(data.error.message || "Server error occurred", { 
                  variant: "error",
                  autoHideDuration: 5000
                })
            }
          } else {
            enqueueSnackbar("An unexpected error occurred", { 
              variant: "error",
              autoHideDuration: 5000
            })
          }
          break

        default:
          console.log('Unhandled message type:', data.type, data)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
      enqueueSnackbar("Failed to process server message", { 
        variant: "error",
        autoHideDuration: 5000
      })
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      streamRef.current = stream

      // Set up audio context and analyser
      const audioContext = new AudioContext({
        sampleRate: 24000,
      })
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()

      // Create and connect AudioWorkletNode
      await audioContext.audioWorklet.addModule('/audioProcessor.js')
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor')
      
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(workletNode)
      //workletNode.connect(audioContext.destination)

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          const pcmData = event.data.pcmData
          // Convert to base64 and send
          const base64Data = btoa(
            String.fromCharCode.apply(null, new Uint8Array(pcmData.buffer))
          )

          wsRef.current?.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Data
          }))
        }
      }
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Start recording and visualization
      updateAudioLevel()
      setIsListening(true)

    } catch (error) {
      console.error('Error starting recording:', error)
      enqueueSnackbar(
        "Failed to start recording. Please check microphone permissions.",
        { variant: "error" }
      )
    }
  }

  const stopRecording = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Commit the audio buffer
    wsRef.current?.send(JSON.stringify({
      type: 'input_audio_buffer.commit'
    }))

    setIsListening(false)
    setAudioLevel(0)
  }

  const updateAudioLevel = () => {
    if (!analyserRef.current || !isListening) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average volume level
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length
    const normalizedLevel = average / 255 // Normalize to 0-1 range
    setAudioLevel(normalizedLevel)

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }

  const toggleListening = async () => {
    if (!isListening) {
      await startRecording()
    } else {
      stopRecording()
    }
  }

  const handleVoiceInput = async (text: string) => {
    if (!text.trim() || !wsRef.current || !sessionId) return

    try {
      setIsProcessing(true)
      
      wsRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: text
          }]
        }
      }))

      wsRef.current.send(JSON.stringify({
        type: 'response.create'
      }))

    } catch (error) {
      enqueueSnackbar(error.message || "Failed to process voice input", {
        variant: "error",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSetApiKey = () => {
    if (apiKey.trim().startsWith('sk-')) {
      localStorage.setItem(STORAGE_KEY, apiKey)
      setIsApiKeySet(true)
      initializeWebSocket(apiKey)
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
    if (wsRef.current) {
      wsRef.current.close()
    }
  }

  const handleToggleSendWithoutConfirm = () => {
    const newValue = !sendWithoutConfirm
    setSendWithoutConfirm(newValue)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      sendWithoutConfirm: newValue
    }))
  }

  // Add playNextInQueue function
  const playNextInQueue = async () => {
    if (!playbackAudioContextRef.current || !audioQueueRef.current.length || isPlayingRef.current) {
      return
    }

    isPlayingRef.current = true
    const pcmData = audioQueueRef.current.shift()!

    try {
      const buffer = playbackAudioContextRef.current.createBuffer(1, pcmData.length, 24000)
      const channelData = buffer.getChannelData(0)

      // Convert to float32 audio
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 0x8000
      }

      const source = playbackAudioContextRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(playbackAudioContextRef.current.destination)
      
      if (playbackAudioContextRef.current.state === 'suspended') {
        await playbackAudioContextRef.current.resume()
      }

      source.onended = () => {
        isPlayingRef.current = false
        playNextInQueue()
      }

      source.start()
    } catch (error) {
      console.error('Error playing audio:', error)
      isPlayingRef.current = false
      playNextInQueue()
    }
  }

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
          <Text color="gray.500">Please connect your wallet to access voice chat</Text>
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
            <Text fontWeight="medium">OpenAI API Key</Text>
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
            <Text fontWeight="medium">Voice Settings</Text>
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
                <Text fontSize="sm">Click the microphone button to start speaking</Text>
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
              </VStack>
            )}
          </Box>

          <Box 
            borderTopWidth={1} 
            p={4} 
            bg="gray.50" 
            borderBottomRadius="xl"
          >
            <Flex direction="column" gap={3}>
              {transcript && (
                <Text fontSize="sm" color="gray.600">
                  {transcript}
                </Text>
              )}
              <Flex justify="center" direction="column" align="center" gap={2}>
                <Box
                  w="full"
                  h="4px"
                  bg="gray.200"
                  borderRadius="full"
                  overflow="hidden"
                  maxW="200px"
                  mb={2}
                >
                  <Box
                    h="full"
                    w={`${audioLevel * 100}%`}
                    bg={isListening ? "blue.500" : "gray.400"}
                    transition="width 0.1s ease-out"
                  />
                </Box>
                <IconButton
                  aria-label={isListening ? "Stop recording" : "Start recording"}
                  onClick={toggleListening}
                  disabled={!isApiKeySet || isProcessing || microphonePermission === 'denied'}
                  loading={isProcessing}
                  size="lg"
                  colorScheme={isListening ? "red" : microphonePermission === 'denied' ? "gray" : "blue"}
                  borderRadius="full"
                  w="64px"
                  h="64px"
                  title={
                    microphonePermission === 'denied' 
                      ? "Microphone access denied. Please enable it in your browser settings." 
                      : isListening 
                        ? "Stop recording" 
                        : "Start recording"
                  }
                >
                  <Icon as={isListening ? IoMicOff : IoMic} />
                </IconButton>
              </Flex>
              {microphonePermission === 'denied' && (
                <Text fontSize="sm" color="red.500" textAlign="center" mt={2}>
                  Microphone access is required. Please enable it in your browser settings.
                </Text>
              )}
              {microphonePermission === 'prompt' && !isListening && (
                <Text fontSize="sm" color="gray.500" textAlign="center" mt={2}>
                  Click the microphone button to allow voice access
                </Text>
              )}
            </Flex>
          </Box>
        </Box>
      </VStack>
    </Container>
  )
} 