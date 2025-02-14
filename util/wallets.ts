import { ethers } from 'ethers'
import { numberToUnpaddedHex } from '@/util/format'
import { polygon } from 'viem/chains'

/**
 * Switches the Ethereum provider to the Polygon network.
 * @param provider The Ethereum provider.
 * @returns A promise that resolves to an unknown value.
 */
async function switchToPolygon(provider: ethers.Eip1193Provider): Promise<unknown> {
  return provider
    .request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: numberToUnpaddedHex(polygon.id),
          blockExplorerUrls: [polygon.blockExplorers.default.url],
          chainName: polygon.name,
          nativeCurrency: polygon.nativeCurrency,
          rpcUrls: [polygon.rpcUrls.default.http[0]],
        },
      ],
    })
    .catch(() =>
      provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToUnpaddedHex(polygon.id) }],
      }),
    )
}

/**
 * Converts an Eip1193Provider to a JsonRpcApiProvider.
 * @param provider The Eip1193Provider to convert.
 * @returns The converted JsonRpcApiProvider.
 */
function getJsonRpcProviderFromEip1193Provider(provider: ethers.Eip1193Provider): ethers.JsonRpcApiProvider {
  return new ethers.BrowserProvider(provider)
}

export { switchToPolygon, getJsonRpcProviderFromEip1193Provider }