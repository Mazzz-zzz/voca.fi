"use client";

import { useRef } from "react";
import { Provider as ChakraProvider } from "../components/ui/provider";
import { PrivyClientConfig, PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { SnackbarProvider } from "notistack";
import { ColorModeProvider } from "@/components/ui/color-mode";
import { wagmiConfig } from "@/util/config";

const queryClient = new QueryClient();
const PRIVY_KEY = process.env.NEXT_PUBLIC_PRIVY_KEY!;

export function Providers({ children }: { children: React.ReactNode }) {
  // has to be set up in component to get access to client's localStorage
  const { current: privyConfig } = useRef<PrivyClientConfig>({
    appearance: {
      theme: "light",
      accentColor: "#EDF2F7",
      logo: `${process.env.NEXT_PUBLIC_BASE_PATH}/big-logo.svg`,
      walletChainType: "ethereum-only",
    },
    loginMethods: ["wallet", "telegram"],
  });

  return (
    <PrivyProvider appId={PRIVY_KEY} config={privyConfig}>
      <SnackbarProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <ChakraProvider>
              <ColorModeProvider>{children}</ColorModeProvider>
            </ChakraProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </SnackbarProvider>
    </PrivyProvider>
  );
}