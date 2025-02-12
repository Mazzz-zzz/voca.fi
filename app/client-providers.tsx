'use client'

import { ChakraProvider } from "@chakra-ui/react";
import { SnackbarProvider } from "notistack";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { WagmiProvider, createConfig } from 'wagmi';
import { polygon } from 'viem/chains';
import { http } from 'viem';
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { walletConnect, injected, safe } from 'wagmi/connectors';

const chakraTheme = createSystem(defaultConfig, {});

// Set up queryClient
const queryClient = new QueryClient();

// Project ID from WalletConnect Cloud
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Set up wagmi config
const metadata = {
  name: 'Voca.fi',
  description: 'Voca.fi Safe App',
  url: 'https://voca.fi',
  icons: ['https://voca.fi/logo.svg']
};

const config = createConfig({
  chains: [polygon],
  connectors: [
    walletConnect({ projectId, metadata, showQrModal: false }),
    injected(),
    safe()
  ],
  transports: {
    [polygon.id]: http(),
  },
});

// Initialize web3modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  defaultChain: polygon,
  themeMode: 'light'
});

export function ClientProviders({ 
  children 
}: { 
  children: ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <ChakraProvider value={chakraTheme}>
            {children}
          </ChakraProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 