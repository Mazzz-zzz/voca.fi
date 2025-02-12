import { useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ETH_ADDRESS } from '@/util/constants'

export type Tool = {
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

export const useTools = () => {
  const { address } = useAccount()

  const getTools = useCallback((): Tool[] => {
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
              token_in: {
                type: 'string',
                description: 'The address of the token to swap from (always POL)',
                enum: [ETH_ADDRESS]
              },
              token_out: {
                type: 'string',
                description: 'The address of the token to swap to'
              },
              amount_in: {
                type: 'string',
                description: 'The amount of POL tokens to swap (in wei)'
              }
            },
            required: ['token_in', 'token_out', 'amount_in']
          }
        }
      }
    ]
  }, [])

  return { getTools }
} 