import { useCallback } from 'react'

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
      }>
      required?: string[]
    }
  }
}

export const useToolDefinitions = () => {

  const getToolDefinitions = useCallback((): ToolDefinition[] => {
    return [
      {
        type: 'function',
        function: {
          name: 'get_token_balance',
          description: 'Get the balance of a specific token for the connected wallet',
          parameters: {
            type: 'object',
            properties: {
              token_address: {
                type: 'string',
                description: 'The contract address of the token'
              }
            },
            required: ['token_address']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_token_price',
          description: 'Get the current price of a token in USD',
          parameters: {
            type: 'object',
            properties: {
              token_address: {
                type: 'string',
                description: 'The contract address of the token'
              }
            },
            required: ['token_address']
          }
        }
      },
      {
        type: 'function',
        function: {
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
      },
      {
        type: 'function',
        function: {
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
        }
      }
    ]
  }, [])

  return { getToolDefinitions }
} 