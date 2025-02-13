import SafeAppsSDK from '@safe-global/safe-apps-sdk';
import { useAccount, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { EnsoClient, RouteParams } from '@ensofinance/sdk';
import { useDebounce } from '@uidotdev/usehooks';
import { Address, isAddress } from 'viem';
import { ENSO_API_KEY } from '../constants';

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: ENSO_API_KEY,
});

const safeAppsSDK = new SafeAppsSDK();

export const useSafeEnsoTransaction = (
  amountIn: string,
  tokenOut: Address,
  tokenIn: Address,
  slippage: number
) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const debouncedAmount = useDebounce(amountIn, 1000);

  const routeParams: RouteParams = {
    fromAddress: address as `0x${string}`,
    receiver: address as `0x${string}`,
    spender: address as `0x${string}`,
    chainId,
    amountIn: debouncedAmount,
    slippage,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    routingStrategy: "delegate", // Using delegate strategy for Safe
  };

  const { data: ensoData, isFetching } = useQuery({
    queryKey: [
      "enso-safe-route",
      chainId,
      address,
      debouncedAmount,
      tokenIn,
      tokenOut,
    ],
    queryFn: () => ensoClient.getRouterData(routeParams),
    enabled:
      +debouncedAmount > 0 &&
      isAddress(address) &&
      isAddress(tokenIn) &&
      isAddress(tokenOut),
  });

  const sendSafeTransaction = async (tx: any) => {
    try {
      // Submit transaction to Safe
      const response = await safeAppsSDK.txs.send({
        txs: [{
          to: tx.to,
          value: tx.value || '0',
          data: tx.data,
        }],
      });
      
      return response;
    } catch (error) {
      console.error('Safe transaction failed:', error);
      throw error;
    }
  };

  const send = async () => {
    if (!ensoData?.tx) {
      throw new Error('No transaction data available');
    }
    
    return sendSafeTransaction(ensoData.tx);
  };

  return {
    send,
    ensoData,
    isFetchingEnsoData: isFetching,
  };
}; 