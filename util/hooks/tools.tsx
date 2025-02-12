import { useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ETH_ADDRESS, ENSO_API_KEY } from '@/util/constants'

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

async function searchTokenBySymbol(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.enso.finance/api/v1/shortcuts/tokens?chainId=137&query=${symbol}`, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${ENSO_API_KEY}`
      }
    });
    
    const data = await response.json();
    if (data && data.tokens && data.tokens.length > 0) {
      // Find exact match first
      const exactMatch = data.tokens.find(
        (token: any) => token.symbol.toLowerCase() === symbol.toLowerCase()
      );
      if (exactMatch) {
        return exactMatch.address;
      }
      // If no exact match, return the first result
      return data.tokens[0].address;
    }
    return null;
  } catch (error) {
    console.error('Error searching for token:', error);
    return null;
  }
}

export const useToolDefinitions = () => {
  const { address: walletAddress } = useAccount()

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
              token_in: {
                type: 'string',
                description: 'The address of the token to swap from (always POL)',
                enum: [ETH_ADDRESS]
              },
              token_out_symbol: {
                type: 'string',
                description: 'The symbol of the token to swap to (e.g. "USDC", "WETH", "MATIC")'
              },
              amount_in: {
                type: 'string',
                description: 'The amount of POL tokens to swap (in wei)'
              }
            },
            required: ['token_in', 'token_out_symbol', 'amount_in']
          }
        }
      }
    ]
  }, [])

  const executeToolDefinition = useCallback(async (name: string, args: any) => {
    if (name === 'create_swap_transaction') {
      const tokenOutAddress = await searchTokenBySymbol(args.token_out_symbol);
      if (!tokenOutAddress) {
        throw new Error(`Token ${args.token_out_symbol} not found on Polygon`);
      }
      return {
        ...args,
        token_out: tokenOutAddress,
        from_address: walletAddress
      };
    }
    return args;
  }, [walletAddress]);

  return { getToolDefinitions, executeToolDefinition }
} 