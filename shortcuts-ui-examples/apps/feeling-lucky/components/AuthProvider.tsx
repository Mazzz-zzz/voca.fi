'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { PasskeyArgType } from '@safe-global/protocol-kit'
import { createPasskey, storePasskeyInLocalStorage } from '@/util/passkeys'
import { Safe4337Pack } from '@safe-global/relay-kit'
import { BUNDLER_URL, RPC_URL } from '@/util/constants'
import LoginWithPasskey from '@/components/LoginWithPasskey'

const shortenAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function AuthProvider() {
  const [selectedPasskey, setSelectedPasskey] = useState<PasskeyArgType>();
  const [safeAddress, setSafeAddress] = useState<string>();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleCreatePasskey = async () => {
    const passkey = await createPasskey()
    storePasskeyInLocalStorage(passkey)
    setSelectedPasskey(passkey)

    const safe4337Pack = await Safe4337Pack.init({
      provider: RPC_URL,
      signer: passkey,
      bundlerUrl: BUNDLER_URL,
      options: {
        owners: [],
        threshold: 1
      }
    })

    const address = await safe4337Pack.protocolKit.getAddress()
    setSafeAddress(address)
  }

  const handleSelectPasskey = async (passkey: PasskeyArgType) => {
    setSelectedPasskey(passkey);

    const safe4337Pack = await Safe4337Pack.init({
      provider: RPC_URL,
      signer: passkey,
      bundlerUrl: BUNDLER_URL,
      options: {
        owners: [],
        threshold: 1
      }
    });

    const address = await safe4337Pack.protocolKit.getAddress();
    setSafeAddress(address);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        {safeAddress ? (
          <Button onClick={() => setSelectedPasskey(undefined)}>
            {shortenAddress(safeAddress)}
          </Button>
        ) : (
          <Button onClick={() => setIsLoginModalOpen(true)}>Connect Safe</Button>
        )}
      </div>

      <LoginWithPasskey
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        handleCreatePasskey={handleCreatePasskey}
        handleSelectPasskey={handleSelectPasskey}
      />
    </>
  );
} 