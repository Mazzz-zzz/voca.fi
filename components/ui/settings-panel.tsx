import {
  Box,
  Button,
  Flex,
  Icon,
  Input,
  Text,
} from "@chakra-ui/react"
import { IoKey, IoSettings, IoInformationCircle } from "react-icons/io5"

interface SettingsPanelProps {
  apiKey: string
  isApiKeySet: boolean
  sendWithoutConfirm: boolean
  onApiKeyChange: (value: string) => void
  onSetApiKey: () => void
  onChangeKey: () => void
  onToggleSendWithoutConfirm: () => void
}

export function SettingsPanel({
  apiKey,
  isApiKeySet,
  sendWithoutConfirm,
  onApiKeyChange,
  onSetApiKey,
  onChangeKey,
  onToggleSendWithoutConfirm,
}: SettingsPanelProps) {
  return (
    <Box
      borderWidth={1}
      borderRadius="xl"
      p={6}
      bg="white"
      shadow="sm"
    >
      <Flex gap={8}>
        {/* BYO-Keys Section */}
        <Box flex={1}>
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
              onChange={(e) => onApiKeyChange(e.target.value)}
              disabled={isApiKeySet}
              size="lg"
              _placeholder={{ color: 'gray.400' }}
            />
            <Button 
              onClick={onSetApiKey} 
              disabled={isApiKeySet}
              size="lg"
              colorScheme="blue"
            >
              Set Key
            </Button>
            {isApiKeySet && (
              <Button 
                onClick={onChangeKey}
                size="lg"
                variant="outline"
              >
                Change
              </Button>
            )}
          </Flex>
        </Box>

        {/* Divider */}
        <Box borderLeftWidth={1} borderColor="gray.200" />

        {/* Chat Settings Section */}
        <Box flex={1}>
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
              onClick={onToggleSendWithoutConfirm}
              variant={sendWithoutConfirm ? "solid" : "outline"}
            >
              {sendWithoutConfirm ? "Enabled" : "Disabled"}
            </Button>
          </Flex>
        </Box>
      </Flex>
    </Box>
  )
} 