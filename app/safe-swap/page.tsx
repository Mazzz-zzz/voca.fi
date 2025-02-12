"use client";

import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import { SafeSwap } from "@/components/SafeSwap";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";

export default function SafeSwapPage() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Container py={8}>
      <VStack gap={4} align="stretch">
        <Heading size="lg">Safe Wallet Swap</Heading>
        <Text color="gray.500">
          Swap tokens using your Safe wallet. The transaction will be submitted to your Safe for confirmation.
        </Text>
        {!isConnected && (
          <Text color="orange.500">
            Please connect your Safe wallet to continue.
          </Text>
        )}
        <SafeSwap />
      </VStack>
    </Container>
  );
} 