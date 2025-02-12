import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClientProviders } from "./client-providers";

export const metadata: Metadata = {
  title: "Voca.fi - Feeling Lucky",
  description: "A fun DeFi app for lucky swaps"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const headersList = await headers();
  const cookies = headersList.get('cookie');

  return (
    <html lang="en">
      <body>
        <ClientProviders cookies={cookies}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
