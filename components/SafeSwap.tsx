import {
  Box,
  Button,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { enqueueSnackbar } from "notistack";
import { Address, denormalizeValue, formatNumber, normalizeValue } from "@/util/format";
import { DEFAULT_SLIPPAGE, ETH_ADDRESS, USDC_ADDRESSES } from "@/util/constants";
import { polygon } from "viem/chains";
import { useEnsoQuote } from "@/util/hooks/enso";
import { useSafe4337Swap } from "@/util/hooks/useSafe4337Swap";

export const SafeSwap = () => {
  const { address, isConnected } = useAccount();
  const provider = usePublicClient();
  const [swapValue, setSwapValue] = useState("0.1");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Always POL -> USDC
  const tokenIn = ETH_ADDRESS as Address;
  const tokenOut = USDC_ADDRESSES[polygon.id] as Address;
  
  const swapAmount = denormalizeValue(swapValue, 18); // 18 decimals for POL

  const quoteParams = {
    chainId: polygon.id,
    fromAddress: address as `0x${string}`,
    amountIn: swapAmount,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    routingStrategy: "delegate", // Using delegate for Safe
  } as const;

  const { data: quoteData } = useEnsoQuote(quoteParams);
  const { prepareSafe4337Swap, executeSafe4337Swap } = useSafe4337Swap();

  const handleSwap = async () => {
    if (!isConnected || !address || !quoteData || !provider) {
      enqueueSnackbar("Please connect your Safe wallet first", { variant: "error" });
      return;
    }

    setIsSwapping(true);
    setIsInitializing(true);
    try {
      enqueueSnackbar("Initializing Safe 4337 module...", { variant: "info" });

      // Prepare the Safe 4337 swap
      const userOp = await prepareSafe4337Swap(
        tokenIn,
        tokenOut,
        swapAmount,
        provider
      );

      setIsInitializing(false);
      enqueueSnackbar("Executing Safe 4337 transaction...", { variant: "info" });

      // Execute the swap using the public client
      const txHash = await executeSafe4337Swap(userOp, provider);

      enqueueSnackbar("Transaction executed successfully!", {
        variant: "success",
        action: () => (
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white', textDecoration: 'underline' }}
          >
            View on Polygonscan
          </a>
        )
      });
    } catch (error) {
      console.error("Swap failed:", error);
      if (error instanceof Error) {
        enqueueSnackbar(`Swap failed: ${error.message}`, { variant: "error" });
      } else {
        enqueueSnackbar("Swap failed. Please try again.", { variant: "error" });
      }
    } finally {
      setIsSwapping(false);
      setIsInitializing(false);
    }
  };

  const valueOut = quoteData?.amountOut ? normalizeValue(quoteData.amountOut, 6) : "0"; // 6 decimals for USDC
  const exchangeRate = +valueOut / +swapValue;

  return (
    <Box p={4} borderWidth={1} borderRadius="lg">
      <VStack gap={4}>
        <Text fontSize="xl" fontWeight="bold">
          Safe Wallet Swap with 4337
        </Text>
        
        <Input
          type="number"
          value={swapValue}
          onChange={(e) => setSwapValue(e.target.value)}
          placeholder="Amount to swap"
          disabled={isSwapping}
        />

        <Text>
          You will receive approximately: {formatNumber(valueOut)} USDC
        </Text>

        {exchangeRate > 0 && (
          <Text fontSize="sm" color="gray.500">
            1 POL = {formatNumber(exchangeRate.toString())} USDC
          </Text>
        )}

        <Button
          colorScheme="blue"
          loading={isSwapping}
          onClick={handleSwap}
          disabled={!isConnected || isSwapping}
          width="100%"
        >
          {!isConnected
            ? "Connect Safe Wallet"
            : isInitializing
            ? "Initializing Safe 4337..."
            : "Swap with Safe 4337"}
        </Button>
      </VStack>
    </Box>
  );
}; 