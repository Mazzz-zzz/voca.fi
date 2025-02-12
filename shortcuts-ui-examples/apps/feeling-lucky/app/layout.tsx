import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClientProviders } from "./client-providers";
import { Navbar } from "@/components/Navbar";

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
          <Navbar />
          <main>
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  )
}
