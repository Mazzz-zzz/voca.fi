"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { SnackbarProvider } from "notistack";
import { Provider as ChakraProvider } from "../components/ui/provider";
import { ColorModeProvider } from "@/components/ui/color-mode";
import { wagmiConfig } from "@/util/config";


const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <ChakraProvider>
            <ColorModeProvider>{children}</ColorModeProvider>
          </ChakraProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
