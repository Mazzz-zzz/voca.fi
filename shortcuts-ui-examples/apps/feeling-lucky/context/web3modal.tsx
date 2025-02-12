import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SafeAppWeb3Modal } from '@safe-global/safe-apps-web3modal';

interface Web3ModalContextType {
  web3modal: SafeAppWeb3Modal | null;
  connect: () => Promise<void>;
}

const Web3ModalContext = createContext<Web3ModalContextType | null>(null);

export function Web3ModalProvider({ children }: { children: ReactNode }) {
  const [web3modal, setWeb3Modal] = useState<SafeAppWeb3Modal | null>(null);

  useEffect(() => {
    const modal = new SafeAppWeb3Modal();
    setWeb3Modal(modal);
  }, []);

  const connect = async () => {
    if (!web3modal) {
      console.error('Web3Modal is not initialized');
      return;
    }
    try {
      console.log('Requesting provider')
      await web3modal.requestProvider();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  return (
    <Web3ModalContext.Provider value={{ web3modal, connect }}>
      {children}
    </Web3ModalContext.Provider>
  );
}

export function useWeb3Modal() {
  const context = useContext(Web3ModalContext);
  if (!context) {
    throw new Error('useWeb3Modal must be used within a Web3ModalProvider');
  }
  return context;
} 