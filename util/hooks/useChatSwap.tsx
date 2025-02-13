import { useCallback, useState, useEffect } from 'react';
import { useAccount, useReadContract, useSendTransaction, UseSimulateContractParameters, useSimulateContract, useWaitForTransactionReceipt, useWriteContract, useChainId, UseSendTransactionReturnType, UseWriteContractReturnType, useBlockNumber, useBalance } from 'wagmi';
import { formatUnits, Address, BaseError, isAddress } from 'viem';
import { EnsoClient } from '@ensofinance/sdk';
import { DEFAULT_SLIPPAGE, ETH_ADDRESS, ENSO_API_KEY, BUNDLER_URL, RPC_URL } from '@/util/constants';
import { enqueueSnackbar } from 'notistack';

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: ENSO_API_KEY,
});

enum TxState {
  Success,
  Failure,
  Pending,
}

const toastState: Record<TxState, "success" | "error" | "info"> = {
  [TxState.Success]: "success",
  [TxState.Failure]: "error",
  [TxState.Pending]: "info",
};

const useWatchTransactionHash = <
  T extends UseSendTransactionReturnType | UseWriteContractReturnType,
>(
  description: string,
  usedWriteContract: T,
) => {
  const hash = usedWriteContract.data;
  const waitForTransaction = useWaitForTransactionReceipt({
    hash,
  });
  const writeLoading = usedWriteContract.status === "pending";

  useEffect(() => {
    if (waitForTransaction.error) {
      enqueueSnackbar({
        message: waitForTransaction.error.message,
        variant: toastState[TxState.Failure],
      });
    } else if (waitForTransaction.data) {
      enqueueSnackbar({
        message: description,
        variant: toastState[TxState.Success],
      });
    } else if (waitForTransaction.isLoading) {
      enqueueSnackbar({
        message: description,
        variant: toastState[TxState.Pending],
      });
    }
  }, [
    waitForTransaction.data,
    waitForTransaction.error,
    waitForTransaction.isLoading,
    description
  ]);

  return {
    ...usedWriteContract,
    isLoading: writeLoading || waitForTransaction.isLoading,
    walletLoading: writeLoading,
    txLoading: waitForTransaction.isLoading,
    waitData: waitForTransaction.data,
  };
};



const useWatchSendTransactionHash = (title: string) => {
  const sendTransaction = useSendTransaction();
  return useWatchTransactionHash(title, sendTransaction);
};



type SwapResult = {
  formattedAmountIn: string;
  formattedAmountOut: string;
  priceImpact: number;
  tokenOutAddress: string;
  routeData: any;
  quoteData: any;
}

export function useChatSwap() {
  const { address: walletAddress } = useAccount();
  const sendTransaction = useWatchSendTransactionHash("Send Transaction");

  const searchTokenBySymbol = useCallback(async (symbol: string): Promise<string | null> => {
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
  }, []);

  const prepareSwap = useCallback(async (
    amountIn: string,
    tokenReceivedSymbol: string
  ): Promise<SwapResult> => {
    const tokenOutAddress = await searchTokenBySymbol(tokenReceivedSymbol);
    if (!tokenOutAddress) {
      throw new Error(`Token ${tokenReceivedSymbol} not found on Polygon`);
    }

    const routeParams = {
      chainId: 137,
      fromAddress: walletAddress as `0x${string}`,
      amountIn,
      tokenIn: ETH_ADDRESS as `0x${string}`,
      tokenOut: tokenOutAddress as `0x${string}`,
      receiver: walletAddress as `0x${string}`,
      spender: walletAddress as `0x${string}`,
    };

    const quoteParams = {
      chainId: 137,
      fromAddress: walletAddress as `0x${string}`,
      tokenIn: ETH_ADDRESS as `0x${string}`,
      tokenOut: tokenOutAddress as `0x${string}`,
      amountIn,
    };

    try {
      // Get route and quote data
      const [routeData, quoteData] = await Promise.all([
        ensoClient.getRouterData(routeParams),
        ensoClient.getQuoteData(quoteParams)
      ]);

      return {
        formattedAmountIn: formatUnits(BigInt(amountIn), 18),
        formattedAmountOut: formatUnits(BigInt(quoteData?.amountOut || 0), 6),
        priceImpact: (quoteData?.priceImpact ?? 0) / 100,
        tokenOutAddress,
        routeData,
        quoteData,
      };
    } catch (error) {
      console.error('Error preparing swap:', error);
      throw new Error(`Failed to prepare swap: ${error.message}`);
    }
  }, [walletAddress, searchTokenBySymbol]);

  const executeSwap = async (swapResult: SwapResult): Promise<string> => {
    try {
      if (!swapResult) {
        throw new Error('Swap result is required');
      }

      // Use the route data from the prepared swap
      if (!swapResult.routeData?.tx) {
        throw new Error('Transaction data not ready');
      }

      console.log('sending swap');
      enqueueSnackbar('Please confirm the transaction in your wallet...', { 
        variant: 'info',
        autoHideDuration: 15000
      });

      let txResult;
      try {
        txResult = await sendTransaction.sendTransactionAsync?.(swapResult.routeData.tx);
      } catch (error) {
        // Handle user rejection or other MetaMask errors
        if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
          throw new Error('Transaction was rejected in wallet');
        }
        throw error;
      }

      if (!txResult || typeof txResult !== 'string') {
        throw new Error('Transaction hash not received');
      }
      console.log('txResult', txResult);
      
      enqueueSnackbar('Transaction submitted, waiting for confirmation...', { 
        variant: 'info',
        autoHideDuration: 15000
      });

      // Wait for transaction confirmation
      try {
        const receipt = await sendTransaction.waitData;
        console.log('receipt', receipt);
        if (receipt) {
          enqueueSnackbar('Swap successful! ', { 
            variant: 'success',
            action: () => (
              <a 
                href={`https://polygonscan.com/tx/${txResult}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                View on Polygonscan
              </a>
            )
          });
        }
      } catch (error) {
        // Handle transaction failure after it was sent
        console.error('Transaction failed after sending:', error);
        throw new Error('Transaction failed: ' + (error.message || 'Unknown error'));
      }
      
      return txResult;
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';
      if (!errorMessage.includes('rejected')) { // Don't show error toast for user rejections
        enqueueSnackbar(`Swap failed: ${errorMessage}`, { variant: 'error' });
      }
      console.error('Error executing swap:', error);
      throw error;
    }
  };

  return {
    prepareSwap,
    executeSwap
  };
}