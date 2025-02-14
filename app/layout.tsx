import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClientProviders } from "./client-providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Voca.fi - Trade with your voice",
  description: "Trade with your voice",
  other: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    'Permissions-Policy': 'microphone=self'
  }
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
