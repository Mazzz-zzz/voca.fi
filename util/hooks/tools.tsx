import { useCallback } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { polygon } from 'viem/chains'
import { ETH_ADDRESS, ENSO_API_KEY } from '@/util/constants'
import { EnsoClient } from '@ensofinance/sdk'
import { useEnsoQuote, useEnsoRouterData } from './enso'
import { useSendEnsoTransaction } from './wallet'

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: ENSO_API_KEY,
});

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
      }
    ]
  }, [])

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

  return { getToolDefinitions, executeToolDefinition }
} 