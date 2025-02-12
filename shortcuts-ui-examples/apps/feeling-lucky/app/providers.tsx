"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { ChakraProvider } from "@chakra-ui/react";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { sepolia } from "viem/chains";
import { ReownProvider } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig } from "wagmi";
import { http } from "viem";

export const chakraTheme = createSystem(defaultConfig, {});

const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http()
  }
});

const appKitConfig = {
  adapter: new WagmiAdapter({ config: wagmiConfig }),
  networks: [sepolia],
  defaultNetwork: sepolia,
  theme: "light",
  appName: "Feeling Lucky",
  appDescription: "A fun DeFi app for lucky swaps",
  appUrl: "https://feeling-lucky.xyz",
  appIcon: "https://avatars.githubusercontent.com/u/37784886",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReownProvider config={appKitConfig}>
      <QueryClientProvider client={new QueryClient()}>
        <SnackbarProvider>
          <ChakraProvider value={chakraTheme}>
            {children}
          </ChakraProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </ReownProvider>
  );
}
