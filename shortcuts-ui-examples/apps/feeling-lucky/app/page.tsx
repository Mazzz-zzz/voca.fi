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
import { useMemo, useState } from "react";
import { Spoiler } from "spoiled";
import {
  DEFAI_LIST,
  DEFAULT_SLIPPAGE,
  DEFI_LIST,
  MEMES_LIST,
  USDC_ADDRESSES,
} from "@/util/constants";
import TokenSelector from "@/components/TokenSelector";
import { Address } from "@ensofinance/shared/types";
import { Button } from "@/components/ui/button";
import { enqueueSnackbar } from "notistack";
import { useEnsoQuote } from "@/util/hooks/enso";
import { denormalizeValue, formatNumber, normalizeValue } from "@ensofinance/shared/util";
import { useTokenFromList } from "@/util/hooks/common";
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';

const CATEGORIES = {
  DEFI: { name: "DeFi", tokens: DEFI_LIST },
  MEME: { name: "Meme", tokens: MEMES_LIST },
  DEFAI: { name: "DeFAI", tokens: DEFAI_LIST }
} as const;

const LuckyDeFi = () => {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  
  // Swap state
  const [tokenIn, setTokenIn] = useState<Address>(USDC_ADDRESSES[sepolia.id] as Address);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CATEGORIES>("MEME");
  const [swapValue, setSwapValue] = useState(10);
  const [revealed, setRevealed] = useState(false);

  const tokenInInfo = useTokenFromList(tokenIn);
  const swapAmount = denormalizeValue(swapValue.toString(), tokenInInfo?.decimals);

  const randomToken = useMemo(() => {
    const selectedList = CATEGORIES[selectedCategory].tokens;
    const index = Math.floor(Math.random() * selectedList.length);
    return selectedList[index] as Address;
  }, [selectedCategory]);

  const tokenOutInfo = useTokenFromList(randomToken as Address);

  const { data: quoteData } = useEnsoQuote({
    chainId: sepolia.id,
    fromAddress: address as `0x${string}`,
    amountIn: swapAmount,
    tokenIn: tokenIn?.toLowerCase() as `0x${string}`,
    tokenOut: randomToken?.toLowerCase() as `0x${string}`,
    routingStrategy: "router",
  }) as { data: any };

  const valueOut = normalizeValue(quoteData?.amountOut, tokenOutInfo?.decimals);
  const exchangeRate = +valueOut / +swapValue;

  const handleSwap = async () => {
    if (!isConnected || !address || !quoteData?.routerData) {
      enqueueSnackbar('Please connect wallet first', { variant: 'error' })
      return
    }

    setIsLoading(true)
    try {
      // Handle swap logic here
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
      <Flex justify="flex-end" mb={4}>
        <Button onClick={() => open()}>
          {address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Connect Wallet'}
        </Button>
      </Flex>
      
      <Box borderWidth={1} borderRadius="lg" w="full" p={4}>
        <Flex gap={4} mb={4}>
          {Object.entries(CATEGORIES).map(([key, { name }]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "solid" : "outline"}
              onClick={() => setSelectedCategory(key as keyof typeof CATEGORIES)}
            >
              {name}
            </Button>
          ))}
        </Flex>

        <Box position="relative">
          <Text fontSize="sm" color="gray.500">
            Swap from:
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
                  onChange={(value) => setTokenIn(value as Address)}
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
                    {formatNumber(valueOut)} {tokenOutInfo?.symbol}
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
                  1 {tokenInInfo?.symbol} = {formatNumber(exchangeRate)}{" "}
                  {tokenOutInfo?.symbol}
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
              disabled={!quoteData?.routerData || isLoading}
              onClick={handleSwap}
            >
              {isLoading ? 'Processing...' : "I'm feeling lucky"}
            </Button>
          </Flex>
        </Box>
      </Box>
    </Container>
  );
};

export default LuckyDeFi;
