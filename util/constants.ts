import { polygon } from "viem/chains";

// Polygon USDC address
export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export const USDC_ADDRESSES = {
  [polygon.id]: USDC_ADDRESS,
};

// Enso API Key
export const ENSO_API_KEY = process.env.NEXT_PUBLIC_ENSO_API_KEY;

// Safe Configuration
export const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || 'https://api.enso.finance/api/v1/shortcuts/bundle?chainId=137&fromAddress=${walletAddress}&receiver=${walletAddress}&spender=${walletAddress}&routingStrategy=delegate';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || '';
export const PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || '';

// Native ETH token address
export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Token Info
export const ETH_TOKEN = {
  address: ETH_ADDRESS,
  symbol: "POL",
  decimals: 18,
  name: "Polygon",
};

export const USDC_TOKEN = {
  address: USDC_ADDRESS,
  symbol: "USDC",
  decimals: 6,
  name: "USD Coin",
};

// Default slippage in basis points (0.5%)
export const DEFAULT_SLIPPAGE = 50;

export const STORAGE_PASSKEY_LIST_KEY = 'safe_passkey_list';

export const CHAIN_NAME = 'polygon'
export const NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'



