"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { ChakraProvider } from "@chakra-ui/react";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { createConfig } from "@privy-io/wagmi";
import { baseSepolia } from "viem/chains";
import { http } from "viem";


export const chakraTheme = createSystem(defaultConfig, {});

export const wagmiConfig = createConfig({
  chains: [baseSepolia], // Use Base Sepolia testnet
  transports: {
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <ChakraProvider value={chakraTheme}>
          {children}
        </ChakraProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
