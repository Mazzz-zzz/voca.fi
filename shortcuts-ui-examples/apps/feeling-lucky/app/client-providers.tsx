'use client'

import { ChakraProvider } from "@chakra-ui/react";
import { SnackbarProvider } from "notistack";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { WagmiConfig, createConfig, cookieToInitialState } from 'wagmi';
import { polygon } from 'viem/chains';
import { http } from 'viem';
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Web3ModalProvider } from '@/context/web3modal';

const chakraTheme = createSystem(defaultConfig, {});

// Set up queryClient
const queryClient = new QueryClient()

// Set up wagmi config
const config = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http(),
  },
});

export function ClientProviders({ 
  children,
  cookies 
}: { 
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(config, cookies)

  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <Web3ModalProvider>
          <SnackbarProvider>
            <ChakraProvider value={chakraTheme}>
              {children}
            </ChakraProvider>
          </SnackbarProvider>
        </Web3ModalProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 