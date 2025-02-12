import { polygon } from "viem/chains";

// Polygon USDC address
export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export const USDC_ADDRESSES = {
  [polygon.id]: USDC_ADDRESS,
};

export const USDC_TOKEN = {
  address: USDC_ADDRESS,
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
};

export const ENSO_API_KEY = process.env.NEXT_PUBLIC_ENSO_API_KEY;

// Native MATIC/POL address (special address for native token)
export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const ETH_TOKEN = {
  address: ETH_ADDRESS,
  name: "Polygon",
  symbol: "POL",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
};

export const DEFAULT_SLIPPAGE = 50; // 0.5%

export const STORAGE_PASSKEY_LIST_KEY = 'safe_passkey_list'
export const RPC_URL = 'https://polygon-rpc.com'
export const CHAIN_NAME = 'polygon'
export const PAYMASTER_ADDRESS = '0x0000000000325602a77416A16136FDafd04b299f'
export const BUNDLER_URL = `https://api.pimlico.io/v2/${CHAIN_NAME}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
export const PAYMASTER_URL = `https://api.pimlico.io/v2/${CHAIN_NAME}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
export const NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'



