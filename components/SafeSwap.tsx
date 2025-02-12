import {
  Box,
  Button,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { enqueueSnackbar } from "notistack";
import { Address, denormalizeValue, formatNumber, normalizeValue } from "@/util/format";
import { DEFAULT_SLIPPAGE, ETH_ADDRESS, USDC_ADDRESSES } from "@/util/constants";
import { polygon } from "viem/chains";
import { useSafeEnsoTransaction } from "@/util/hooks/safe";
import { useEnsoQuote } from "@/util/hooks/enso";

export const SafeSwap = () => {
  const { address, isConnected } = useAccount();
  const [swapValue, setSwapValue] = useState("0.1");
  const [isSwapping, setIsSwapping] = useState(false);

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

  const {
    send: sendSwap,
    ensoData,
    isFetchingEnsoData,
  } = useSafeEnsoTransaction(
    swapAmount,
    tokenOut,
    tokenIn,
    DEFAULT_SLIPPAGE
  );

  const handleSwap = async () => {
    if (!isConnected || !address || !ensoData?.tx) {
      enqueueSnackbar("Please connect your Safe wallet first", { variant: "error" });
      return;
    }

    setIsSwapping(true);
    try {
      enqueueSnackbar("Initiating Safe transaction...", { variant: "info" });

      await sendSwap();

      enqueueSnackbar("Transaction submitted to Safe. Please confirm it in your Safe wallet.", { variant: "success" });
    } catch (error) {
      console.error("Swap failed:", error);
      enqueueSnackbar("Swap failed. Please try again.", { variant: "error" });
    } finally {
      setIsSwapping(false);
    }
  };

  const valueOut = quoteData?.amountOut ? normalizeValue(quoteData.amountOut, 6) : "0"; // 6 decimals for USDC
  const exchangeRate = +valueOut / +swapValue;

  return (
    <Box p={4} borderWidth={1} borderRadius="lg">
      <VStack gap={4}>
        <Text fontSize="xl" fontWeight="bold">
          Safe Wallet Swap
        </Text>
        
        <Input
          type="number"
          value={swapValue}
          onChange={(e) => setSwapValue(e.target.value)}
          placeholder="Amount to swap"
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
          loading={isSwapping || isFetchingEnsoData}
          onClick={handleSwap}
          disabled={!isConnected}
          style={{ width: '100%' }}
        >
          {!isConnected
            ? "Connect Safe Wallet"
            : "Swap with Safe"}
        </Button>
      </VStack>
    </Box>
  );
}; 