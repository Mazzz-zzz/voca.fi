'use client'

import { ChakraProvider } from "@chakra-ui/react";
import { SnackbarProvider } from "notistack";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { SafeAppWeb3Modal } from '@safe-global/safe-apps-web3modal';
import { WagmiConfig, createConfig } from 'wagmi';
import { polygon } from 'viem/chains';
import { http } from 'viem';
import ContextProvider from '@/context'
import { ReactNode, useEffect, useState } from "react";

const chakraTheme = createSystem(defaultConfig, {});

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
  const [web3modal, setWeb3Modal] = useState<SafeAppWeb3Modal | null>(null);

  useEffect(() => {
    const modal = new SafeAppWeb3Modal();
    setWeb3Modal(modal);

    (async () => {
      try {
        await modal.requestProvider();
      } catch (error) {
        console.error('Failed to initialize web3modal:', error);
      }
    })();
  }, []);

  return (
    <WagmiConfig config={config}>
      <ContextProvider cookies={cookies}>
        <SnackbarProvider>
          <ChakraProvider value={chakraTheme}>
            {children}
          </ChakraProvider>
        </SnackbarProvider>
      </ContextProvider>
    </WagmiConfig>
  );
} 