import { useCallback, useState, useEffect } from 'react';
import { useAccount, useReadContract, useSendTransaction, UseSimulateContractParameters, useSimulateContract, useWaitForTransactionReceipt, useWriteContract, useChainId, UseSendTransactionReturnType, UseWriteContractReturnType, useBlockNumber, useBalance } from 'wagmi';
import { formatUnits, Address, BaseError, isAddress } from 'viem';
import { EnsoClient } from '@ensofinance/sdk';
import { DEFAULT_SLIPPAGE, ETH_ADDRESS} from '@/util/constants';
import { enqueueSnackbar } from 'notistack';

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: process.env.NEXT_PUBLIC_ENSO_API_KEY,
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
    // Log transaction status
    console.group('Transaction Status');
    console.log('Transaction Hash:', hash);
    console.log('Status:', {
      isLoading: waitForTransaction.isLoading,
      isSuccess: waitForTransaction.isSuccess,
      isError: waitForTransaction.isError,
      writeStatus: usedWriteContract.status
    });
    
    if (waitForTransaction.data) {
      console.log('Transaction Receipt:', {
        blockNumber: waitForTransaction.data.blockNumber,
        gasUsed: waitForTransaction.data.gasUsed,
        status: waitForTransaction.data.status,
        effectiveGasPrice: waitForTransaction.data.effectiveGasPrice
      });
    }
    
    if (waitForTransaction.error) {
      console.error('Transaction Error:', waitForTransaction.error);
    }
    console.groupEnd();

    if (waitForTransaction.error) {
      enqueueSnackbar({
        message: waitForTransaction.error.message,
        variant: toastState[TxState.Failure],
      });
    } else if (waitForTransaction.data) {
      enqueueSnackbar('Completed!', { 
        variant: toastState[TxState.Success],
        action: () => (
          <a 
            href={`https://polygonscan.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white', textDecoration: 'underline' }}
          >
            View on Polygonscan
          </a>
        )
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
    description,
    hash,
    usedWriteContract.status
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
  const { ...watchTransactionHash } = useWatchTransactionHash(title, sendTransaction);
  return { ...watchTransactionHash, sendTransaction };
};



type SwapResult = {
  formattedAmountIn: string;
  formattedAmountOut: string;
  priceImpact: number;
  tokenOutAddress: string;
  routeData: any;
  quoteData: any;
}

type QueuedTransaction = {
  id: string
  name: string
  arguments: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: any
}

export function useChatSwap() {
  const { address: walletAddress } = useAccount();
  const sendTransaction = useWatchSendTransactionHash("Sending transaction...");

  const searchTokenBySymbol = useCallback(async (symbol: string): Promise<string | null> => {
    try {
      const response = await fetch(`https://api.enso.finance/api/v1/tokens?chainId=137&includeMetadata=true`, {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_ENSO_API_KEY}`
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
      console.log('routeData', routeData);
      console.log('quoteData', quoteData);

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

  const prepareSingleBundleTransaction = useCallback(async (
    amountIn: string,
    tokenReceivedSymbol: string
  ): Promise<any> => {
    const tokenOutAddress = await searchTokenBySymbol(tokenReceivedSymbol);
    if (!tokenOutAddress) {
      throw new Error(`Token ${tokenReceivedSymbol} not found on Polygon`);
    }

    const bundleRequest = {
      protocol: "enso",
      action: "route",
      args: {
        tokenIn: ETH_ADDRESS,
        tokenOut: tokenOutAddress,
        amountIn: amountIn,
        slippage: DEFAULT_SLIPPAGE.toString()
      }
    };

    return bundleRequest;
  }, [walletAddress, searchTokenBySymbol]);

  const executeBundledTransaction = async (
    transactions: QueuedTransaction[]
  ): Promise<string> => {
    try {
      if (!transactions.length) {
        throw new Error('No transactions to bundle');
      }

      // Convert QueuedTransactions to Enso bundle format using prepareSingleBundleTransaction
      const bundleRequest = await Promise.all(transactions.map(async tx => {
        if (tx.name === 'create_swap_transaction') {
          return await prepareSingleBundleTransaction(
            tx.arguments.pol_outgoing_amount,
            tx.arguments.token_received_symbol
          );
        }
        throw new Error(`Unsupported transaction type: ${tx.name}`);
      }));

      // Flatten the array since prepareSingleBundleTransaction returns an array
      const flattenedBundleRequest = bundleRequest.flat();

      console.log('bundleRequest', flattenedBundleRequest);

      const response = await fetch(
        `https://api.enso.finance/api/v1/shortcuts/bundle?chainId=137&fromAddress=${walletAddress}&receiver=${walletAddress}&spender=${walletAddress}&routingStrategy=delegate`,
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ENSO_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(flattenedBundleRequest)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Bundle API error:', errorData);
        throw new Error(errorData.message || 'Failed to prepare bundled transaction');
      }

      const bundleData = await response.json();
      console.log('Bundle API Response:', bundleData);

      if (!bundleData || !bundleData.tx) {
        console.error('Invalid bundle data received:', bundleData);
        throw new Error('Invalid bundle data received from API');
      }

      console.log('sending bundled transaction');
      enqueueSnackbar('Please confirm the transaction in your wallet...', { 
        variant: 'info',
        autoHideDuration: 1500
      });

      let txResult;
      try {
        txResult = await sendTransaction.sendTransactionAsync?.({
          to: bundleData.tx.to,
          data: bundleData.tx.data,
          value: BigInt(bundleData.tx.value || 0)
        });
      } catch (error) {
        if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
          throw new Error('Transaction was rejected in wallet');
        }
        throw error;
      }

      if (!txResult || typeof txResult !== 'string') {
        throw new Error('Transaction hash not received');
      }
      
      try {
        const receipt = await sendTransaction.waitData;
        if (receipt) {
          enqueueSnackbar('Bundle submitted successfully! ', { 
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
        console.error('Transaction failed after sending:', error);
        throw new Error('Transaction failed: ' + (error.message || 'Unknown error'));
      }
      
      return txResult;
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';
      if (!errorMessage.includes('rejected')) {
        enqueueSnackbar(`Bundle execution failed: ${errorMessage}`, { variant: 'error' });
      }
      console.error('Error executing bundle:', error);
      throw error;
    }
  };

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
        autoHideDuration: 1500
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
    executeSwap,
    executeBundledTransaction,
    prepareSingleBundleTransaction
  };
}