import { EnsoClient } from "@ensofinance/sdk";

// Initialize the Enso client
// Note: Replace 'YOUR_API_KEY' with your actual API key from Enso
export const ensoClient = new EnsoClient({
    apiKey: process.env.NEXT_PUBLIC_ENSO_API_KEY || 'YOUR_API_KEY',
});

// Helper functions for common Enso operations

// Get quote for token swap
export async function getTokenSwapQuote(
    fromAddress: `0x${string}`,
    amountIn: string,
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    chainId: number = 1 // Default to Ethereum mainnet
) {
    try {
        return await ensoClient.getQuoteData({
            fromAddress,
            chainId,
            amountIn,
            tokenIn,
            tokenOut,
        });
    } catch (error) {
        console.error('Error getting token swap quote:', error);
        throw error;
    }
}

// Get token approval data
export async function getTokenApproval(
    fromAddress: `0x${string}`,
    tokenAddress: `0x${string}`,
    amount: string,
    chainId: number = 1
) {
    try {
        return await ensoClient.getApprovalData({
            fromAddress,
            tokenAddress,
            chainId,
            amount,
        });
    } catch (error) {
        console.error('Error getting token approval data:', error);
        throw error;
    }
}

// Get wallet balances
export async function getWalletBalances(
    eoaAddress: `0x${string}`,
    chainId: number = 1
) {
    try {
        return await ensoClient.getBalances({
            eoaAddress,
            chainId,
        });
    } catch (error) {
        console.error('Error getting wallet balances:', error);
        throw error;
    }
}

// Get token data
export async function getTokenInfo(
    address: `0x${string}`,
    chainId: number = 1
) {
    try {
        return await ensoClient.getTokenData({
            address,
            chainId,
        });
    } catch (error) {
        console.error('Error getting token data:', error);
        throw error;
    }
} 