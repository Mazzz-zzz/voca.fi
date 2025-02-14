import { polygon } from "viem/chains";

// Polygon USDC address
export const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

export const USDC_ADDRESSES = {
  [polygon.id]: USDC_ADDRESS,
};

// Enso API Key
export const ENSO_API_KEY = process.env.NEXT_PUBLIC_ENSO_API_KEY || '';

// Safe Configuration
export const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || 'https://api.pimlico.io/v1/polygon/rpc';
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


// Safe Other

import { getMultiSendDeployment, getProxyFactoryDeployment, getSafeL2SingletonDeployment } from '@safe-global/safe-deployments'
import {
  getFCLP256VerifierDeployment,
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from '@safe-global/safe-modules-deployments'

// 137 = Polygon mainnet chain id
const APP_CHAIN_ID = 137

// Sep testnet shortname
// https://eips.ethereum.org/EIPS/eip-3770
const APP_CHAIN_SHORTNAME = 'polygon'

type DeploymentFunction = (filter: { network: string }) => { networkAddresses: Record<string, string | undefined> } | undefined
function getDeploymentAddress(fn: DeploymentFunction) {
  const network = `${APP_CHAIN_ID}`
  const deployment = fn({ network })
  if (!deployment || !deployment.networkAddresses[network]) {
    throw new Error('deployment not found')
  }
  return deployment.networkAddresses[network]
}

/*
  The Safe WebAuthn shared signer is still not audited and not included in the production deployment
  packages, thus we need to hardcode their addresses here.
  Deployment tag: https://github.com/safe-global/safe-modules/tree/passkey/v0.2.0
*/
const SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS = '0xfD90FAd33ee8b58f32c00aceEad1358e4AFC23f9'

const SAFE_MULTISEND_ADDRESS = getDeploymentAddress(getMultiSendDeployment)

const SAFE_4337_MODULE_ADDRESS = getDeploymentAddress(getSafe4337ModuleDeployment)

const SAFE_MODULE_SETUP_ADDRESS = getDeploymentAddress(getSafeModuleSetupDeployment)

const P256_VERIFIER_ADDRESS = getDeploymentAddress(getFCLP256VerifierDeployment)

const SAFE_PROXY_FACTORY_ADDRESS = getDeploymentAddress(getProxyFactoryDeployment)

const SAFE_SINGLETON_ADDRESS = getDeploymentAddress(getSafeL2SingletonDeployment)

const ENTRYPOINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

const XANDER_BLAZE_NFT_ADDRESS = '0xBb9ebb7b8Ee75CDBf64e5cE124731A89c2BC4A07'

export {
  SAFE_MODULE_SETUP_ADDRESS,
  APP_CHAIN_ID,
  ENTRYPOINT_ADDRESS,
  SAFE_MULTISEND_ADDRESS,
  SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS,
  SAFE_4337_MODULE_ADDRESS,
  SAFE_PROXY_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  XANDER_BLAZE_NFT_ADDRESS,
  P256_VERIFIER_ADDRESS,
  APP_CHAIN_SHORTNAME,
}