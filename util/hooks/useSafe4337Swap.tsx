import { useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { enqueueSnackbar } from 'notistack';
import { Safe4337Pack } from '@safe-global/relay-kit';
import { useSafe4337 } from './useSafe4337';
import { BUNDLER_URL, RPC_URL } from '../constants';
import { Address } from '@/util/format';
import { PublicClient } from 'viem';

export const useSafe4337Swap = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { safeModule, isInitializing, initializeSafe4337, createUserOperation, validateUserOperation } = useSafe4337();

  const prepareSafe4337Swap = useCallback(async (
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string,
    provider: PublicClient
  ) => {
    try {
      // Initialize Safe 4337 if not already initialized
      if (!safeModule) {
        const initialized = await initializeSafe4337(provider);
        if (!initialized) {
          throw new Error('Failed to initialize Safe 4337 module');
        }
      }

      // Wait if initialization is in progress
      if (isInitializing) {
        throw new Error('Safe 4337 initialization in progress');
      }

      // Create the user operation for the swap
      const userOp = await createUserOperation(
        tokenOut, // to address (token we're swapping to)
        amountIn, // value (amount of tokens we're swapping)
        '0x', // data (will be populated by the router)
        0 // operation type (0 for call)
      );

      // Validate the user operation
      const isValid = await validateUserOperation(userOp);
      if (!isValid) {
        throw new Error('Invalid user operation');
      }

      return userOp;
    } catch (error) {
      console.error('Error preparing Safe 4337 swap:', error);
      enqueueSnackbar('Failed to prepare Safe 4337 swap: ' + (error as Error).message, { variant: 'error' });
      throw error;
    }
  }, [safeModule, isInitializing, initializeSafe4337, createUserOperation, validateUserOperation]);

  const executeSafe4337Swap = useCallback(async (
    userOp: any,
    _provider: PublicClient
  ): Promise<`0x${string}`> => {
    try {
      // Initialize Safe4337Pack
      const safe4337Pack = await Safe4337Pack.init({
        provider: RPC_URL,
        bundlerUrl: BUNDLER_URL,
        options: {
          owners: [address],
          threshold: 1
        }
      });

      // Create and sign the transaction
      const safeTransaction = await safe4337Pack.createTransaction({
        transactions: [userOp]
      });

      const signedSafeOperation = await safe4337Pack.signSafeOperation(safeTransaction);

      // Execute the transaction
      const response = await safe4337Pack.executeTransaction({
        executable: signedSafeOperation
      });

      enqueueSnackbar('Safe 4337 swap executed successfully', { variant: 'success' });
      return response as `0x${string}`;
    } catch (error) {
      console.error('Error executing Safe 4337 swap:', error);
      enqueueSnackbar('Failed to execute Safe 4337 swap: ' + (error as Error).message, { variant: 'error' });
      throw error;
    }
  }, [address]);

  return {
    prepareSafe4337Swap,
    executeSafe4337Swap,
  };
}; 