import { Address, isAddress } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { ENSO_API_KEY } from "../constants";
import { EnsoClient, RouteParams, QuoteParams } from "@ensofinance/sdk";

const ensoClient = new EnsoClient({
  baseURL: "https://api.enso.finance/api/v1",
  apiKey: ENSO_API_KEY,
});

const DEBOUNCE_TIME = 1000; // Increased from 500ms to 1000ms

export const useEnsoApprove = (tokenAddress: Address, amount: string) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const debouncedAmount = useDebounce(amount, DEBOUNCE_TIME);

  return useQuery({
    queryKey: [
      "enso-approval",
      tokenAddress,
      chainId,
      address,
      debouncedAmount,
    ],
    queryFn: () =>
      ensoClient.getApprovalData({
        fromAddress: address as `0x${string}`,
        tokenAddress: tokenAddress as `0x${string}`,
        chainId,
        amount: debouncedAmount,
      }),
    enabled: +amount > 0 && isAddress(address) && isAddress(tokenAddress),
  });
};


export const useEnsoRouterData = (params: RouteParams) => {
  const debouncedAmount = useDebounce(params.amountIn, 500);

  return useQuery({
    queryKey: [
      "enso-router",
      params.chainId,
      params.fromAddress,
      debouncedAmount,
      params.tokenIn,
      params.tokenOut,
    ],
    queryFn: () => ensoClient.getRouterData(params),
    enabled:
      +params.amountIn > 0 &&
      isAddress(params.fromAddress) &&
      isAddress(params.tokenIn) &&
      isAddress(params.tokenOut),
  });
};

export const useEnsoQuote = (params: QuoteParams) => {
  const debouncedAmount = useDebounce(params.amountIn, DEBOUNCE_TIME);

  return useQuery({
    queryKey: [
      "enso-quote",
      params.chainId,
      params.fromAddress,
      debouncedAmount,
      params.tokenIn,
      params.tokenOut,
    ],
    queryFn: async () => {
      try {
        console.log("Fetching quote with params:", {
          ...params,
          amountIn: debouncedAmount,
        });
        const data = await ensoClient.getQuoteData({
          ...params,
          amountIn: debouncedAmount,
        });
        console.log("Quote response:", data);
        return data;
      } catch (error) {
        console.error("Error fetching quote:", error);
        throw error;
      }
    },
    enabled:
      +debouncedAmount > 0 &&
      isAddress(params.fromAddress) &&
      isAddress(params.tokenIn) &&
      isAddress(params.tokenOut),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
};
