import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum, sepolia } from '@reown/appkit/networks'

// Get projectId from https://cloud.reown.com
export const projectId = '6f1dfe72a99a30fe6e3ea65fb5296b95'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [sepolia]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig 