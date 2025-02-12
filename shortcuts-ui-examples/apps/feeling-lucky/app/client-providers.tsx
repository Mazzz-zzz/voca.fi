'use client'

import { ChakraProvider } from "@chakra-ui/react";
import { SnackbarProvider } from "notistack";
import { createSystem, defaultConfig } from "@chakra-ui/react";
import ContextProvider from '@/context'
import { ReactNode } from "react";

const chakraTheme = createSystem(defaultConfig, {});

export function ClientProviders({ 
  children,
  cookies 
}: { 
  children: ReactNode;
  cookies: string | null;
}) {
  return (
    <ContextProvider cookies={cookies}>
      <SnackbarProvider>
        <ChakraProvider value={chakraTheme}>
          {children}
        </ChakraProvider>
      </SnackbarProvider>
    </ContextProvider>
  );
} 