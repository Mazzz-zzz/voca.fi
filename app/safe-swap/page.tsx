"use client";

import { Container, Heading, Text, VStack, Spinner } from "@chakra-ui/react";
import { SafeSwap } from "@/components/SafeSwap";
import { useAccount, usePublicClient, useWalletClient, useSendTransaction } from "wagmi";
import { useEffect, useState, useMemo } from "react";
import { polygon } from "viem/chains";
import { 
  getPasskeyFromLocalStorage, 
  createPasskey, 
  storePasskeyInLocalStorage,
  PasskeyLocalStorageFormat,
  toLocalStorageFormat 
} from "@/util/passkeys";
import { 
  getSafeAddressFromLocalStorage, 
  getSafeAddress,
  getSafeInitializer,
  getSafeDeploymentData,
  encodeSetupCall,
  storeSafeAddressInLocalStorage
} from "@/util/safe";
import { 
  SAFE_4337_MODULE_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  P256_VERIFIER_ADDRESS,
  SAFE_MULTISEND_ADDRESS,
  SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS,
} from "@/util/constants";
import { useSafe4337 } from "@/util/hooks/useSafe4337";
import { useUserOpGasLimitEstimation } from "@/util/hooks/safe/useUserOpGasEstimation";
import { useFeeData } from "@/util/hooks/safe/useFeeData";
import { useNativeTokenBalance } from "@/util/hooks/safe/useNativeTokenBalance";
import { useCodeAtAddress } from "@/util/hooks/safe/useCodeAtAddress";
import { 
  getUnsignedUserOperation,
  getUserOpInitCode,
  packGasParameters,
  getMissingAccountFunds,
  signAndSendUserOp,
  getAccountEntryPointBalance
} from "@/util/userOp";
import { Button } from "@/components/ui/button";
import { enqueueSnackbar } from "notistack";
import { Eip1193Provider } from "ethers";
import { getJsonRpcProviderFromEip1193Provider } from "@/util/wallets";

export default function SafeSwapPage() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { sendTransactionAsync } = useSendTransaction();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [hasSafeAddress, setHasSafeAddress] = useState(false);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [isValidSafe, setIsValidSafe] = useState(false);
  const [passkey, setPasskey] = useState<PasskeyLocalStorageFormat | null>(null);
  const [userOpHash, setUserOpHash] = useState<string>();
  const [isDeploying, setIsDeploying] = useState(false);

  const { safeModule, initializeSafe4337 } = useSafe4337();

  // Setup data for Safe deployment
  const setupData = useMemo(
    () => passkey ? encodeSetupCall([SAFE_4337_MODULE_ADDRESS], { 
      ...passkey.pubkeyCoordinates, 
      verifiers: P256_VERIFIER_ADDRESS 
    }) : null,
    [passkey]
  );

  const initializer = useMemo(() => {
    if (!setupData) return null;
    const owners = [SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS];
    if (address) owners.push(address);

    return getSafeInitializer(
      owners, 
      1, 
      SAFE_4337_MODULE_ADDRESS, 
      SAFE_MULTISEND_ADDRESS, 
      setupData
    );
  }, [setupData, address]);

  const computedSafeAddress = useMemo(() => {
    if (!initializer) return null;
    return safeAddress || getSafeAddress(initializer);
  }, [initializer, safeAddress]);

  // Convert publicClient to Eip1193Provider
  const eip1193Provider = useMemo<Eip1193Provider | null>(() => {
    if (!publicClient) return null;
    return {
      request: async ({ method, params }) => {
        return publicClient.request({ method, params: params || [] });
      }
    };
  }, [publicClient]);

  // Deployment-related hooks
  const [safeCode] = useCodeAtAddress(eip1193Provider, computedSafeAddress as `0x${string}`);
  const [feeData] = useFeeData(eip1193Provider);
  const unsignedUserOperation = useMemo(() => {
    if (!computedSafeAddress || !initializer) return null;
    const initCode = getUserOpInitCode(
      SAFE_PROXY_FACTORY_ADDRESS,
      getSafeDeploymentData(SAFE_SINGLETON_ADDRESS, initializer)
    );
    return getUnsignedUserOperation(
      {
        to: computedSafeAddress,
        data: "0x",
        value: 0,
        operation: 0,
      },
      computedSafeAddress,
      0,
      initCode
    );
  }, [computedSafeAddress, initializer]);

  const { userOpGasLimitEstimation, status: estimationStatus } = useUserOpGasLimitEstimation(
    unsignedUserOperation
  );

  const [safeBalance] = useNativeTokenBalance(eip1193Provider, computedSafeAddress as `0x${string}`);

  useEffect(() => {
    setMounted(true);
    const checkSetup = async () => {
      try {
        const storedPasskey = getPasskeyFromLocalStorage();
        const savedSafeAddress = getSafeAddressFromLocalStorage();
        
        if (storedPasskey) {
          setPasskey(storedPasskey);
          setHasPasskey(true);
        }
        setHasSafeAddress(!!savedSafeAddress);
        setSafeAddress(savedSafeAddress);

        if (savedSafeAddress) {
          const code = await publicClient.getBytecode({ 
            address: savedSafeAddress as `0x${string}` 
          });
          setIsValidSafe(!!code);
        }
      } catch (error) {
        console.error("Error checking setup:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSetup();
  }, [publicClient]);

  const handleCreatePasskey = async () => {
    try {
      setIsLoading(true);
      const newPasskey = await createPasskey();
      const formattedPasskey = toLocalStorageFormat(newPasskey);
      storePasskeyInLocalStorage(newPasskey);
      setPasskey(formattedPasskey);
      setHasPasskey(true);
    } catch (error) {
      console.error("Failed to create passkey:", error);
      enqueueSnackbar("Failed to create passkey", { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploySafe = async () => {
    if (!passkey || !unsignedUserOperation || !feeData || !userOpGasLimitEstimation || !sendTransactionAsync || !eip1193Provider) {
      return;
    }

    try {
      setIsDeploying(true);

      // Get current balance in the entry point
      const currentBalance = await getAccountEntryPointBalance(
        getJsonRpcProviderFromEip1193Provider(eip1193Provider),
        computedSafeAddress
      );

      // Calculate required funds with a higher multiplier for safety
      const missingFunds = getMissingAccountFunds(
        BigInt(feeData.maxFeePerGas),
        userOpGasLimitEstimation,
        currentBalance,
        20n // Increase multiplier for safety margin
      );

      // If missing funds, we need to send them first
      if (missingFunds > 0n) {
        console.log('Sending missing funds:', missingFunds.toString());
        const hash = await sendTransactionAsync({
          to: computedSafeAddress as `0x${string}`,
          value: missingFunds,
          chain: polygon,
        });
        
        console.log('Funding transaction hash:', hash);
        // Wait for the transaction to be mined
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('Funding transaction confirmed');
      }

      const userOpToSign = {
        ...unsignedUserOperation,
        ...packGasParameters({
          verificationGasLimit: userOpGasLimitEstimation.verificationGasLimit,
          callGasLimit: userOpGasLimitEstimation.callGasLimit,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          maxFeePerGas: feeData.maxFeePerGas,
        }),
        preVerificationGas: userOpGasLimitEstimation.preVerificationGas,
      };

      const hash = await signAndSendUserOp(userOpToSign, passkey);
      setUserOpHash(hash);
      
      if (computedSafeAddress) {
        storeSafeAddressInLocalStorage(computedSafeAddress);
        setHasSafeAddress(true);
        setSafeAddress(computedSafeAddress);
      }

      enqueueSnackbar("Safe deployment transaction submitted", { variant: "success" });
    } catch (error) {
      console.error("Failed to deploy Safe:", error);
      enqueueSnackbar("Failed to deploy Safe: " + (error as Error).message, { variant: "error" });
    } finally {
      setIsDeploying(false);
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <Container py={8}>
        <VStack gap={4} align="center">
          <Spinner size="xl" />
          <Text>Loading...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container py={8}>
      <VStack gap={4} align="stretch">
        <Heading size="lg">Safe Wallet Swap</Heading>
        
        {!hasPasskey && (
          <VStack gap={4} p={4} borderWidth={1} borderRadius="md">
            <Text>You need to create a passkey to use Safe Wallet Swap</Text>
            <Button colorScheme="blue" onClick={handleCreatePasskey}>
              Create Passkey
            </Button>
          </VStack>
        )}

        {hasPasskey && !hasSafeAddress && (
          <VStack gap={4} p={4} borderWidth={1} borderRadius="md">
            <Text>You need to deploy a Safe Wallet</Text>
            <Button 
              colorScheme="blue" 
              onClick={handleDeploySafe}
              loading={isDeploying}
              loadingText="Deploying Safe..."
              disabled={!address || isDeploying}
            >
              Deploy Safe Wallet
            </Button>
            {userOpHash && (
              <Text fontSize="sm" color="gray.500">
                Deployment transaction submitted. Track status on{" "}
                <a 
                  href={`https://jiffyscan.xyz/userOpHash/${userOpHash}?network=sepolia`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  Jiffyscan
                </a>
              </Text>
            )}
          </VStack>
        )}

        {hasPasskey && hasSafeAddress && !isValidSafe && (
          <VStack gap={4} p={4} borderWidth={1} borderRadius="md" bg="orange.50">
            <Text color="orange.700">The Safe Wallet address is invalid or not deployed. Please create a new Safe Wallet.</Text>
            <Button 
              colorScheme="orange" 
              onClick={handleDeploySafe}
              loading={isDeploying}
              loadingText="Deploying Safe..."
              disabled={!address || isDeploying}
            >
              Deploy New Safe Wallet
            </Button>
          </VStack>
        )}

        {hasPasskey && hasSafeAddress && isValidSafe && (
          <>
            <Text color="gray.500">
              Swap tokens using your Safe wallet. The transaction will be submitted to your Safe for confirmation.
            </Text>
            {!isConnected && (
              <Text color="orange.500">
                Please connect your wallet to continue.
              </Text>
            )}
            <SafeSwap />
          </>
        )}
      </VStack>
    </Container>
  );
} 