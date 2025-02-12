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
  HStack,
  RadioCard,
  Skeleton,
} from "@chakra-ui/react";
import { base } from "viem/chains";
import { useMemo, useState, ReactNode, useEffect } from "react";
import { useSwitchChain, useAccount, useChainId } from "wagmi";
import Image from "next/image";
import { Spoiler } from "spoiled";
import { PasskeyArgType } from '@safe-global/protocol-kit'
import {
  useApproveIfNecessary,
  useNetworkId,
  useSendEnsoTransaction,
  useTokenBalance,
} from "@/util/hooks/wallet";
import { useEnsoApprove, useEnsoQuote } from "@/util/hooks/enso";
import {
  denormalizeValue,
  formatNumber,
  normalizeValue,
} from "@ensofinance/shared/util";
import {
  DEFAI_LIST,
  DEFAULT_SLIPPAGE,
  DEFI_LIST,
  MEMES_LIST,
  PAYMASTER_ADDRESS,
  PAYMASTER_URL,
  USDC_ADDRESSES,
} from "@/util/constants";
import { useTokenFromList } from "@/util/hooks/common";
import TokenSelector from "@/components/TokenSelector";
import { Address } from "@ensofinance/shared/types";
import { Button } from "@/components/ui/button";
import LoginWithPasskey from '@/components/LoginWithPasskey'
import SafeAccountDetails from '@/components/SafeAccountDetails'
import { createPasskey, storePasskeyInLocalStorage } from '../util/passkeys'
import { enqueueSnackbar } from "notistack";
import { Safe4337Pack } from '@safe-global/relay-kit'
import { BUNDLER_URL, RPC_URL } from '../util/constants'
import { Address as ViemAddress } from 'viem'

enum Category {
  defi,
  meme,
  defai,
}

const CategoryTokens = {
  [Category.defi]: DEFI_LIST,
  [Category.meme]: MEMES_LIST,
  [Category.defai]: DEFAI_LIST,
};

const CategoryNames = {
  [Category.defi]: "DeFi",
  [Category.meme]: "Meme",
  [Category.defai]: "DeFAI",
};

const shortenAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const LuckyDeFi = () => {
  const [tokenIn, setTokenIn] = useState<Address>(
    USDC_ADDRESSES[base.id] as Address
  );
  const [selectedCategory, setSelectedCategory] = useState(
    Category.meme.toString(),
  );
  const [selectedPasskey, setSelectedPasskey] = useState<PasskeyArgType>();
  const [safeAddress, setSafeAddress] = useState<string>();
  const [isSafeDeployed, setIsSafeDeployed] = useState<boolean>();
  const chainId = useNetworkId();
  const tokenInInfo = useTokenFromList(tokenIn);
  const { switchChain } = useSwitchChain();
  const balance = useTokenBalance(tokenIn);
  const { address } = useAccount();
  const [swapValue, setSwapValue] = useState(10);
  const [revealed, setRevealed] = useState(false);

  const swapAmount = denormalizeValue(
    swapValue.toString(),
    tokenInInfo?.decimals,
  );

  const approveData = useEnsoApprove(tokenIn, swapAmount);
  const approve = useApproveIfNecessary(
    tokenIn,
    approveData.data?.spender,
    swapAmount,
  );

  const randomToken = useMemo(() => {
    const selectedList = CategoryTokens[selectedCategory];
    const index = Math.floor(Math.random() * selectedList.length);

    return selectedList[index] as Address;
  }, [selectedCategory]);

  const { send: sendData, ensoData, isFetchingEnsoData } =
    useSendEnsoTransaction(swapAmount, randomToken as `0x${string}`, tokenIn as `0x${string}`, DEFAULT_SLIPPAGE);
  const tokenOutInfo = useTokenFromList(randomToken as Address);

  const wrongChain = chainId !== base.id;
  const notEnoughBalance = tokenIn && +balance < +swapAmount;
  const needLogin = !address;
  const approveNeeded = !!approve && +swapAmount > 0 && !!tokenIn;

  const { data: quoteData } = useEnsoQuote({
    chainId: base.id,
    fromAddress: address?.toLowerCase() as `0x${string}`,
    amountIn: swapAmount,
    tokenIn: tokenIn?.toLowerCase() as `0x${string}`,
    tokenOut: randomToken?.toLowerCase() as `0x${string}`,
    routingStrategy: "router",
  });
  const valueOut = normalizeValue(quoteData?.amountOut, tokenOutInfo?.decimals);
  const exchangeRate = +valueOut / +swapValue;

  const SkeletonLoader = ({
    children,
    isLoading,
  }: {
    children: ReactNode;
    isLoading: boolean;
  }) => (isLoading ? <Skeleton w={"120px"} h={"24px"} /> : <>{children}</>);

  const handleTokenChange = (value: string) => {
    setTokenIn(value as Address);
  };

  useEffect(() => {
    async function initializeSafe() {
      if (!selectedPasskey) return

      const safe4337Pack = await Safe4337Pack.init({
        provider: RPC_URL,
        signer: selectedPasskey,
        bundlerUrl: BUNDLER_URL,
        options: {
          owners: [],
          threshold: 1
        }
      })

      const address = await safe4337Pack.protocolKit.getAddress()
      const isDeployed = await safe4337Pack.protocolKit.isSafeDeployed()

      setSafeAddress(address)
      setIsSafeDeployed(isDeployed)
    }

    initializeSafe()
  }, [selectedPasskey])

  async function handleCreatePasskey() {
    const passkey = await createPasskey()
    storePasskeyInLocalStorage(passkey)
    setSelectedPasskey(passkey)
  }

  async function handleSelectPasskey(passkey: PasskeyArgType) {
    setSelectedPasskey(passkey)
  }

  const sendSafeTransaction = async (tx: any) => {
    if (!selectedPasskey || !safeAddress) {
      enqueueSnackbar('Please connect Safe wallet first', { variant: 'error' })
      return
    }

    const safe4337Pack = await Safe4337Pack.init({
      provider: RPC_URL,
      signer: selectedPasskey,
      bundlerUrl: BUNDLER_URL,
      options: {
        owners: [],
        threshold: 1
      }
    })

    const safeTransaction = await safe4337Pack.createTransaction({
      transactions: [tx]
    })

    const signedSafeOperation = await safe4337Pack.signSafeOperation(safeTransaction)
    
    return await safe4337Pack.executeTransaction({
      executable: signedSafeOperation
    })
  }

  const [isLoading, setIsLoading] = useState(false);

  const handleSendTransaction = async () => {
    if (!ensoData?.tx) return;
    setIsLoading(true);
    try {
      await sendSafeTransaction(ensoData.tx);
    } catch (error) {
      console.error('Transaction failed:', error);
      enqueueSnackbar('Transaction failed', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container py={8} h={"full"} w={"full"}>
      <Center h={"full"}>
        <VStack gap={4} align="flex-start" mt={-100}>
          <Box w="container.sm">
            <VStack gap={4} align="flex-start">
              <Heading size="lg" textAlign="center" w="full">
                I'm feeling lucky
              </Heading>
              <Text color="gray.500" textAlign="center" w="full">
                Randomly allocate your capital across the DeFi and meme tokens
              </Text>

              <Box borderWidth={1} borderRadius="lg" w="full" p={4}>
                <RadioCard.Root
                  variant={"subtle"}
                  colorPalette={"gray"}
                  size={"sm"}
                  mb={4}
                  value={selectedCategory}
                >
                  <HStack align="stretch" w={150}>
                    {Object.keys(CategoryTokens).map((key) => (
                      <RadioCard.Item
                        display={"flex"}
                        w={"full"}
                        key={key}
                        value={key}
                        border={"none"}
                        onClick={() => setSelectedCategory(key.toString())}
                        alignItems={"center"}
                      >
                        <RadioCard.ItemHiddenInput />
                        <RadioCard.ItemControl
                          minW={"80px"}
                          justifyContent={"center"}
                        >
                          <RadioCard.ItemText>
                            {CategoryNames[+key as Category]}
                          </RadioCard.ItemText>
                        </RadioCard.ItemControl>
                      </RadioCard.Item>
                    ))}
                  </HStack>
                </RadioCard.Root>

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
                          onChange={handleTokenChange}
                        />
                        <Text
                          color={notEnoughBalance ? "red" : "gray.500"}
                          fontSize="sm"
                          mb={1}
                          whiteSpace={"nowrap"}
                          cursor={"pointer"}
                          visibility={address ? "visible" : "hidden"}
                          _hover={{ color: "gray.600" }}
                          onClick={() =>
                            setSwapValue(
                              +normalizeValue(balance, tokenInInfo?.decimals),
                            )
                          }
                        >
                          Available:{" "}
                          {formatNumber(
                            normalizeValue(balance, tokenInInfo?.decimals),
                          )}{" "}
                          {tokenInInfo?.symbol}
                        </Text>
                      </Flex>
                      <Input
                        css={{
                          "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button":
                            {
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
                        <SkeletonLoader isLoading={isFetchingEnsoData}>
                          <Box>
                            <Spoiler density={0.5} hidden={!revealed}>
                              {formatNumber(valueOut)} {tokenOutInfo?.symbol}
                            </Spoiler>
                          </Box>
                        </SkeletonLoader>
                      </Heading>
                    </Center>

                    <Flex
                      justify="space-between"
                      onClick={() => setRevealed((val) => !val)}
                      cursor={"pointer"}
                    >
                      <Text color="gray.600">Exchange Rate:</Text>
                      <SkeletonLoader isLoading={isFetchingEnsoData}>
                        <Spoiler density={0.5} hidden={!revealed}>
                          {" "}
                          <Text>
                            1 {tokenInInfo?.symbol} = {formatNumber(exchangeRate)}{" "}
                            {tokenOutInfo?.symbol}
                          </Text>
                        </Spoiler>
                      </SkeletonLoader>
                    </Flex>

                    <Flex justify="space-between">
                      <Text color="gray.600">Price impact:</Text>
                      <Text>
                        -{((quoteData?.priceImpact ?? 0) / 100).toFixed(2)}%
                      </Text>
                    </Flex>
                  </VStack>

                  <Flex mt={6} w={"full"} justifyContent={"center"}>
                    {wrongChain ? (
                      <Button
                        w="full"
                        bg="gray.solid"
                        _hover={{ bg: "blackAlpha.solid" }}
                        onClick={() => switchChain({ chainId: base.id })}
                      >
                        Switch to Base
                      </Button>
                    ) : (
                      <Flex w={"full"} gap={4}>
                        {approveNeeded && (
                          <Button
                            flex={1}
                            loading={approve.isLoading}
                            colorPalette={"gray"}
                            onClick={approve.write}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          flex={1}
                          variant="solid"
                          disabled={!safeAddress || !isSafeDeployed || !(+swapAmount > 0) || isLoading}
                          colorPalette={"gray"}
                          onClick={handleSendTransaction}
                        >
                          {isLoading ? 'Processing...' : "I'm feeling lucky"}
                        </Button>
                      </Flex>
                    )}
                  </Flex>
                </Box>
              </Box>
            </VStack>
          </Box>
        </VStack>
      </Center>
    </Container>
  );
};

export default LuckyDeFi;
