"use client";

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  Center,
  Input,
} from "@chakra-ui/react";
import { sepolia } from "viem/chains";
import { useState } from "react";
import { Spoiler } from "spoiled";
import {
  DEFAULT_SLIPPAGE,
  USDC_ADDRESSES,
  USDC_TOKEN,
  ETH_ADDRESS,
  ETH_TOKEN,
} from "@/util/constants";
import TokenSelector from "@/components/TokenSelector";
import { Address } from "@ensofinance/shared/types";
import { Button } from "@/components/ui/button";
import { enqueueSnackbar } from "notistack";
import { useEnsoQuote } from "@/util/hooks/enso";
import { denormalizeValue, formatNumber, normalizeValue } from "@ensofinance/shared/util";
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useSendEnsoTransaction, useApproveIfNecessary } from "@/util/hooks/wallet";

type QuoteData = {
  gas: string;
  amountOut: string;
  feeAmount: string[];
  createdAt: number;
  priceImpact: number;
  routerData?: any;
  route: {
    action: string;
    protocol: string;
    tokenIn: string[];
    tokenOut: string[];
  }[];
};

const LuckyDeFi = () => {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  
  // Swap state
  const [swapValue, setSwapValue] = useState(0.1); // Default to 0.1 ETH
  const [revealed, setRevealed] = useState(false);

  // Always ETH -> USDC
  const tokenIn = ETH_ADDRESS as Address;
  const tokenOut = USDC_ADDRESSES[sepolia.id] as Address;
  
  const tokenInInfo = ETH_TOKEN;
  const tokenOutInfo = USDC_TOKEN;
  
  const swapAmount = denormalizeValue(swapValue.toString(), tokenInInfo.decimals);

  const routeParams = {
    fromAddress: address as `0x${string}`,
    receiver: address as `0x${string}`,
    chainId: sepolia.id,
    amountIn: swapAmount,
    slippage: DEFAULT_SLIPPAGE,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    routingStrategy: "router",
    referrer: address as `0x${string}`,
    referralFee: 0,
  } as const;

  const quoteParams = {
    chainId: sepolia.id,
    fromAddress: address as `0x${string}`,
    amountIn: swapAmount,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    routingStrategy: "router",
  } as const;

  const { data: quoteData } = useEnsoQuote(quoteParams) as { data: QuoteData };

  const {
    send: sendSwap,
    ensoData,
    isFetchingEnsoData,
  } = useSendEnsoTransaction(
    swapAmount,
    tokenOut as `0x${string}`,
    tokenIn as `0x${string}`,
    DEFAULT_SLIPPAGE
  );

  const approveWrite = useApproveIfNecessary(
    tokenIn as `0x${string}`,
    ensoData?.tx?.to as `0x${string}`,
    swapAmount
  );

  const valueOut = normalizeValue(quoteData?.amountOut, tokenOutInfo.decimals);
  const exchangeRate = +valueOut / +swapValue;

  const handleSwap = async () => {
    if (!isConnected || !address || !quoteData?.routerData) {
      enqueueSnackbar('Please connect wallet first', { variant: 'error' })
      return
    }

    setIsLoading(true)
    try {
      if (approveWrite) {
        enqueueSnackbar('Approving token...', { variant: 'info' })
        await approveWrite.write()
        // Wait for a few blocks to ensure the approval is processed
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      enqueueSnackbar('Swapping ETH to USDC...', { variant: 'info' })
      await sendSwap()
      enqueueSnackbar('Swap successful!', { variant: 'success' })
    } catch (error) {
      console.error('Swap failed:', error)
      enqueueSnackbar('Swap failed', { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <Container py={8} h={"full"} w={"full"}>
        <Center h={"full"}>
          <VStack gap={4}>
            <Heading size="lg">Connect Wallet</Heading>
            <Text color="gray.500">Please connect your wallet to continue</Text>
            <Button onClick={() => open()}>
              Connect Wallet
            </Button>
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Container py={8} h={"full"} w={"full"}>      
      <Box borderWidth={1} borderRadius="lg" w="full" p={4}>
        <Box position="relative">
          <Text fontSize="sm" color="gray.500">
            Swap ETH amount:
          </Text>
          <Flex align="center" mb={4}>
            <Flex
              border="solid 1px"
              borderColor="gray.200"
              borderRadius="md"
              p={2}
              align="center"
              flex={1}
            >
              <Flex flexDirection="column">
                <TokenSelector 
                  value={tokenIn} 
                  onChange={() => {}} 
                  isInput={true}
                />
              </Flex>
              <Input
                css={{
                  "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
                    WebkitAppearance: "none",
                  },
                }}
                type={"number"}
                fontSize="xl"
                border={"none"}
                outline={"none"}
                placeholder="0.0"
                textAlign="right"
                value={swapValue}
                onChange={(e) => setSwapValue(+e.target.value)}
                mr={5}
              />
            </Flex>
          </Flex>

          <VStack align="stretch" gap={3}>
            <Center
              onClick={() => setRevealed((val) => !val)}
              cursor={"pointer"}
            >
              <Heading as={"h6"} size={"md"} color="gray.500">
                You will receive:{" "}
                <Box>
                  <Spoiler density={0.5} hidden={!revealed}>
                    {formatNumber(valueOut)} {tokenOutInfo.symbol}
                  </Spoiler>
                </Box>
              </Heading>
            </Center>

            <Flex
              justify="space-between"
              onClick={() => setRevealed((val) => !val)}
              cursor={"pointer"}
            >
              <Text color="gray.600">Exchange Rate:</Text>
              <Spoiler density={0.5} hidden={!revealed}>
                <Text>
                  1 {tokenInInfo.symbol} = {formatNumber(exchangeRate)}{" "}
                  {tokenOutInfo.symbol}
                </Text>
              </Spoiler>
            </Flex>

            <Flex justify="space-between">
              <Text color="gray.600">Price impact:</Text>
              <Text>
                -{((quoteData?.priceImpact ?? 0) / 100).toFixed(2)}%
              </Text>
            </Flex>
          </VStack>

          <Flex mt={6} w={"full"} justifyContent={"center"}>
            <Button
              w="full"
              disabled={!quoteData?.routerData || isLoading || isFetchingEnsoData}
              onClick={handleSwap}
            >
              {isLoading ? 'Processing...' : "Swap ETH to USDC"}
            </Button>
          </Flex>
        </Box>
      </Box>
    </Container>
  );
};

export default LuckyDeFi;
