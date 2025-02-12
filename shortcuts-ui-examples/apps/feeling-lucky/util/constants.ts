import { arbitrum, base, mainnet, sepolia } from "viem/chains";

export const USDC_ADDRESS = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";

export const USDC_ADDRESSES = {
  [sepolia.id]: USDC_ADDRESS,
};

export const USDC_TOKEN = {
  address: USDC_ADDRESS,
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
};

export const ENSO_API_KEY = process.env.NEXT_PUBLIC_ENSO_API_KEY;

export const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export const ETH_TOKEN = {
  address: ETH_ADDRESS,
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
};

export const DEFAULT_SLIPPAGE = 50; // 0.5%

export const STORAGE_PASSKEY_LIST_KEY = 'safe_passkey_list'
export const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
export const CHAIN_NAME = 'sepolia'
export const PAYMASTER_ADDRESS = '0x0000000000325602a77416A16136FDafd04b299f' // SEPOLIA
export const BUNDLER_URL = `https://api.pimlico.io/v2/${CHAIN_NAME}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
export const PAYMASTER_URL = `https://api.pimlico.io/v2/${CHAIN_NAME}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
export const NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'



