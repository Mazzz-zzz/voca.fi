import { useState, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import Safe4337ModuleAbi from '@/util/safe-4337-module.json';
import { enqueueSnackbar } from 'notistack';
import { PublicClient, encodeFunctionData } from 'viem';

// Get module address based on network
const getModuleAddress = (chainId: number): string => {
  const addresses = Safe4337ModuleAbi.networkAddresses;
  return addresses[chainId.toString() as keyof typeof addresses];
};

export function useSafe4337() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [safeModule, setSafeModule] = useState<{
    address: `0x${string}`;
    abi: typeof Safe4337ModuleAbi.abi;
    provider: PublicClient;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeSafe4337 = useCallback(async (provider: PublicClient): Promise<boolean> => {
    if (isInitializing) return false;
    
    try {
      setIsInitializing(true);
      
      if (!chainId) throw new Error('No chain ID found');
      if (!address) throw new Error('No wallet address found');
      
      const moduleAddress = getModuleAddress(chainId);
      if (!moduleAddress) throw new Error('Network not supported');

      // Create the contract instance
      const contract = {
        address: moduleAddress as `0x${string}`,
        abi: Safe4337ModuleAbi.abi,
        provider,
      };

      // Verify we can interact with the contract
      try {
        await provider.readContract({
          address: contract.address,
          abi: contract.abi,
          functionName: 'SUPPORTED_ENTRYPOINT',
        });
      } catch (error) {
        console.error('Failed to verify contract interaction:', error);
        throw new Error('Failed to verify Safe 4337 module');
      }

      setSafeModule(contract);
      enqueueSnackbar('Safe 4337 module initialized', { variant: 'success' });
      return true;
    } catch (error) {
      console.error('Failed to initialize Safe 4337:', error);
      enqueueSnackbar('Failed to initialize Safe 4337: ' + (error as Error).message, { variant: 'error' });
      setSafeModule(null);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [chainId, address, isInitializing]);

  const createUserOperation = useCallback(async (
    to: string,
    value: string,
    data: string,
    operation: number = 0 // 0 for call, 1 for delegatecall
  ) => {
    if (!safeModule || !address) throw new Error('Safe 4337 not initialized');

    // Get nonce from the entry point instead
    const entryPointAddress = await safeModule.provider.readContract({
      address: safeModule.address,
      abi: safeModule.abi,
      functionName: 'SUPPORTED_ENTRYPOINT',
    });

    // For now, use a timestamp-based nonce as a fallback
    const nonce = BigInt(Math.floor(Date.now() / 1000));

    // Encode the call data for executeUserOp
    const encodedCallData = encodeFunctionData({
      abi: safeModule.abi,
      functionName: 'executeUserOp',
      args: [to, value, data, operation],
    });

    const userOp = {
      sender: address,
      nonce,
      initCode: '0x',
      callData: encodedCallData,
      callGasLimit: BigInt(100000), // Reasonable default
      verificationGasLimit: BigInt(100000), // Reasonable default
      preVerificationGas: BigInt(21000), // Base gas cost
      maxFeePerGas: BigInt(0),
      maxPriorityFeePerGas: BigInt(0),
      paymasterAndData: '0x',
      signature: '0x'
    };

    return userOp;
  }, [safeModule, address]);

  const validateUserOperation = useCallback(async (
    userOp: any
  ) => {
    if (!safeModule) throw new Error('Safe 4337 not initialized');

    try {
      // Convert BigInt values to strings for JSON serialization
      const serializedUserOp = {
        ...userOp,
        nonce: userOp.nonce.toString(),
        callGasLimit: userOp.callGasLimit.toString(),
        verificationGasLimit: userOp.verificationGasLimit.toString(),
        preVerificationGas: userOp.preVerificationGas.toString(),
        maxFeePerGas: userOp.maxFeePerGas.toString(),
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
      };

      const validationData = await safeModule.provider.readContract({
        address: safeModule.address,
        abi: safeModule.abi,
        functionName: 'validateUserOp',
        args: [
          serializedUserOp,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          0
        ],
      });

      return validationData.toString() === '0';
    } catch (error) {
      console.error('Failed to validate user operation:', error);
      return false;
    }
  }, [safeModule]);

  return {
    safeModule,
    isInitializing,
    initializeSafe4337,
    createUserOperation,
    validateUserOperation,
    isSupported: !!chainId && !!getModuleAddress(chainId)
  };
} 