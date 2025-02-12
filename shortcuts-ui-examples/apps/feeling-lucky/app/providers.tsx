"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { SnackbarProvider } from "notistack";
import { ChakraProvider } from "@chakra-ui/react";
import { chakraTheme } from "@/util/config";
import { wagmiConfig } from "@/util/config";

const queryClient = new QueryClient();

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
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
