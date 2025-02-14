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
import { SettingsPanel } from '@/components/ui/settings-panel'

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
- Help users being informed on gnosis safe and enso protocol that routes
- Answering questions about crypto markets and tokens
- Creating and executing swap transactions on polygon only from POL token (call the function create_swap_transaction with the arguments token_received_symbol and pol_outgoing_amount)
- Confirming or canceling prepared swap transactions (call the function confirm_swap with argument confirm=true to execute or confirm=false to cancel)

Keep responses clear, accurate, and focused on helping users make informed trading decisions.`
}

const defaultSessionConfig: SessionResourceType = {
  modalities: ['text', 'audio'],
  instructions: SYSTEM_MESSAGE.content,
  voice: 'verse',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: null,
  turn_detection: null,
  tools: [
    {
      type: 'function',
      name: 'create_swap_transaction',
      description: 'Create a transaction to swap native POL tokens to another token using Safe',
      parameters: {
        type: 'object',
        properties: {
          token_received_symbol: {
            type: 'string',
            description: 'The symbol of the token to swap to (e.g. "USDC", "WETH", "MATIC")'
          },
          pol_outgoing_amount: {
            type: 'string',
            description: 'The amount of POL tokens to swap (in wei)'
          }
        },
        required: ['token_received_symbol', 'pol_outgoing_amount']
      }
    }
  ],
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
  const [sendWithoutConfirm, setSendWithoutConfirm] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [retryCount, setRetryCount] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioQueueRef = useRef<Array<Int16Array>>([])
  const isPlayingRef = useRef(false)
  const swapResultRef = useRef<any>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playbackAudioContextRef = useRef<AudioContext | null>(null)

  // Add new state for session initialization
  const [isSessionInitializing, setIsSessionInitializing] = useState(true)

  // Initialize playback audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      playbackAudioContextRef.current = new AudioContext()
    }
    return () => {
      playbackAudioContextRef.current?.close()
    }
  }, [])

  // Check microphone permissions on mount and retry if denied
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
            if (result.state === 'denied') {
              setRetryCount(prev => prev + 1)
            }
          })

          // If denied, try requesting directly through getUserMedia
          if (result.state === 'denied') {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
              stream.getTracks().forEach(track => track.stop())
              setMicrophonePermission('granted')
            } catch {
              setRetryCount(prev => prev + 1)
            }
          }
        } else {
          // Fallback to getUserMedia check
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach(track => track.stop())
            setMicrophonePermission('granted')
          } catch {
            setRetryCount(prev => prev + 1)
          }
        }
      } catch (error) {
        console.error('Error checking microphone permissions:', error)
        setMicrophonePermission('prompt')
        setRetryCount(prev => prev + 1)
      }
    }

    if (typeof window !== 'undefined') {
      checkMicrophonePermissions()
    }
  }, [])

  // Retry getting microphone permissions periodically if denied
  useEffect(() => {
    if (microphonePermission === 'denied' && retryCount < 5) {
      const retryTimer = setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
          setMicrophonePermission('granted')
        } catch (error) {
          console.log('Retry attempt failed:', retryCount + 1)
          setRetryCount(prev => prev + 1)
        }
      }, 2000 * (retryCount + 1)) // Exponential backoff

      return () => clearTimeout(retryTimer)
    }
  }, [microphonePermission, retryCount])

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
          tools: [
            ...validTools,
            ...(!sendWithoutConfirm ? [{
              type: 'function',
              name: 'confirm_swap',
              description: 'Confirm and execute a previously prepared swap transaction',
              parameters: {
                type: 'object',
                properties: {
                  confirm: {
                    type: 'boolean',
                    description: 'Whether to confirm and execute the swap (true) or cancel it (false)'
                  }
                },
                required: ['confirm']
              }
            }] : [])
          ],
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
          setIsApiKeySet(true)
          setIsSessionInitializing(false)
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
          //console.log('Audio buffer committed')
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
          // Clear audio queue when speech starts
          audioQueueRef.current = []
          isPlayingRef.current = false
          break

        case 'input_audio_buffer.speech_stopped':
          setIsListening(false)
          // No need to send accumulated buffer since we're streaming it in real-time
          break

        case 'response.function_call_arguments.done':
          console.log('Function call arguments done:', data)
          if (data.call_id && data.arguments) {
            try {
              const args = JSON.parse(data.arguments)
              const toolName = data.name || ''

              if (toolName === 'create_swap_transaction') {
                try {
                  const result = await prepareSwap(
                    args.pol_outgoing_amount,
                    args.token_received_symbol
                  )
                  console.log("Swap prepared:", result)
                  
                  // Store the result in the ref instead of state
                  swapResultRef.current = result

                  if (!sendWithoutConfirm) {
                    wsRef.current?.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: data.call_id,
                        output: JSON.stringify({ 
                          status: 'success',
                          preparedSwap: swapResultRef.current,
                          message: 'Please confirm the transaction to execute the swap.'
                        })
                      }
                    }))

                    //we just pass the message to the assistant. no need to set messages here
                    /*setMessages(prev => [...prev, {
                      role: 'assistant',
                      content: `I'll help you swap ${swapResultRef.current.formattedAmountIn} POL for ${swapResultRef.current.formattedAmountOut} ${args.token_received_symbol} with price impact: ${swapResultRef.current.priceImpact.toFixed(2)}%.\nPlease confirm if you want to proceed with this transaction.`
                    }])*/

                    // Create a new response for the next interaction
                    wsRef.current?.send(JSON.stringify({
                      type: 'response.create'
                    }))
                    return
                  }

                  // If no confirmation needed, execute immediately using result directly
                  console.log("executing swap with result:", result)
                  const txResult = await executeSwap(result)
                  console.log("txResult", txResult)
                  
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Transaction executed successfully! [View on Polygonscan](https://polygonscan.com/tx/${txResult})`
                  }])

                  wsRef.current?.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: data.call_id,
                      output: JSON.stringify({ 
                        status: 'success',
                        transaction: txResult
                      })
                    }
                  }))

                } catch (error) {
                  console.error('Error in swap execution:', error)
                  let errorMessage = 'Failed to execute transaction'
                  if (error.message.includes('rejected')) {
                    errorMessage = 'Transaction was rejected in your wallet'
                  } else if (error.message.includes('failed')) {
                    errorMessage = `Transaction failed: ${error.message}`
                  }

                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: errorMessage
                  }])

                  wsRef.current?.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: data.call_id,
                      output: JSON.stringify({ 
                        status: 'error',
                        message: errorMessage
                      })
                    }
                  }))
                }
              } else if (toolName === 'confirm_swap') {
                try {
                  // Get the latest swap result directly from ref
                  if (!swapResultRef.current) {
                    throw new Error('No swap transaction prepared')
                  }
                  
                  const txResult = await executeSwap(swapResultRef.current)
                  
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Transaction executed successfully! [View on Polygonscan](https://polygonscan.com/tx/${txResult})`
                  }])

                  wsRef.current?.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: data.call_id,
                      output: JSON.stringify({ 
                        status: 'success',
                        transaction: txResult
                      })
                    }
                  }))

                } catch (error) {
                  console.error('Error executing swap:', error)
                  let errorMessage = 'Failed to execute transaction'
                  if (error.message.includes('rejected')) {
                    errorMessage = 'Transaction was rejected in your wallet'
                  } else if (error.message.includes('failed')) {
                    errorMessage = `Transaction failed: ${error.message}`
                  }

                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: errorMessage
                  }])

                  wsRef.current?.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: data.call_id,
                      output: JSON.stringify({ 
                        status: 'error',
                        message: errorMessage
                      })
                    }
                  }))
                }
              }

              // Always create a new response after handling function calls
              wsRef.current?.send(JSON.stringify({
                type: 'response.create'
              }))

            } catch (error) {
              console.error('Error handling tool call:', error)
              wsRef.current?.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: data.call_id,
                  output: JSON.stringify({ 
                    status: 'error',
                    message: error.message
                  })
                }
              }))
            }
          }
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
        "Failed to start recording. Please check microphone permissions or switch to chrome/brave. (This doesn't work on arc for some reason)",
        { variant: "error" }
      )
    }
  }

  const stopRecording = () => {
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
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

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
          track.enabled = false
        })
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

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
                  disabled={!isApiKeySet || isProcessing || microphonePermission === 'denied' || isSessionInitializing}
                  loading={isProcessing || isSessionInitializing}
                  size="lg"
                  colorScheme={isListening ? "red" : microphonePermission === 'denied' ? "gray" : "blue"}
                  borderRadius="full"
                  w="64px"
                  h="64px"
                  position="relative"
                  bg={isListening ? "red.500" : microphonePermission === 'denied' ? "gray.400" : "blue.500"}
                  _hover={{
                    bg: isListening ? "red.600" : microphonePermission === 'denied' ? "gray.400" : "blue.600",
                  }}
                  css={isListening ? {
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      bottom: '-8px',
                      left: '-8px',
                      border: '3px solid',
                      borderColor: 'var(--chakra-colors-red-500)',
                      borderRadius: '100%',
                      animation: 'pulse 1.5s ease-out infinite'
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      bottom: '-4px',
                      left: '-4px',
                      border: '3px solid',
                      borderColor: 'var(--chakra-colors-red-500)',
                      borderRadius: '100%',
                      animation: 'pulse 1.5s ease-out infinite',
                      animationDelay: '0.75s'
                    },
                    '@keyframes pulse': {
                      '0%': {
                        transform: 'scale(0.95)',
                        opacity: 1
                      },
                      '100%': {
                        transform: 'scale(1.2)',
                        opacity: 0
                      }
                    }
                  } : undefined}
                  title={
                    isSessionInitializing 
                      ? "Initializing session..."
                      : microphonePermission === 'denied' 
                        ? "Microphone access denied. Please enable it in your browser settings." 
                        : isListening 
                          ? "Stop recording" 
                          : "Start recording"
                  }
                >
                  <Icon 
                    as={isListening ? IoMicOff : IoMic} 
                    boxSize="28px"
                    color="white"
                  />
                </IconButton>
              </Flex>
              {microphonePermission === 'denied' && (
                <VStack gap={2} mt={2}>
                  <Text fontSize="sm" color="red.500" textAlign="center">
                    Microphone access is required. Please enable it in your browser settings.
                  </Text>
                  {retryCount < 5 && (
                    <Text fontSize="xs" color="gray.500">
                      Retrying to get access... ({5 - retryCount} attempts remaining)
                    </Text>
                  )}
                </VStack>
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