import { useCallback, useEffect } from "react";
import {
  useReadContract,
  useAccount,
  useSendTransaction,
  UseSimulateContractParameters,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  useChainId,
  UseSendTransactionReturnType,
  UseWriteContractReturnType,
  useBlockNumber,
  useBalance,
} from "wagmi";
import { enqueueSnackbar } from "notistack";
import { Address, BaseError } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { formatNumber, normalizeValue } from "@ensofinance/shared/util";
import { RouteParams } from "@ensofinance/sdk";
import { useTokenFromList } from "./common";
import erc20Abi from "../../erc20Abi.json";
import { useEnsoRouterData } from "./enso";
import { ETH_ADDRESS, BUNDLER_URL, PAYMASTER_URL, PAYMASTER_ADDRESS, RPC_URL } from "../constants";
import { PasskeyArgType } from '@safe-global/protocol-kit';
import { Safe4337Pack } from '@safe-global/relay-kit';

enum TxState {
  Success,
  Failure,
  Pending,
}

const toastState: Record<TxState, "success" | "error" | "info"> = {
  [TxState.Success]: "success",
  [TxState.Failure]: "error",
  [TxState.Pending]: "info",
};

export const useErc20Balance = (tokenAddress: Address) => {
  const { address } = useAccount();

  return useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
};

// if token is native ETH, use usBalance instead
export const useTokenBalance = (token: Address) => {
  const { address } = useAccount();
  const { data: erc20Balance } = useErc20Balance(token as `0x${string}`);
  const { data: balance } = useBalance({ address });

  const value = token === ETH_ADDRESS ? balance?.value : erc20Balance;

  return value?.toString() ?? "0";
};

export const useAllowance = (token: Address, spender: Address) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const blockNumber = useBlockNumber({ watch: true });
  const queryClient = useQueryClient();
  const { data, queryKey } = useReadContract({
    chainId,
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, spender],
    blockTag: "pending",
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [blockNumber, queryClient, queryKey]);

  return data?.toString() ?? "0";
};

export const useApprove = (token: Address, target: Address, amount: string) => {
  const tokenData = useTokenFromList(token as `0x${string}`);
  const chainId = useChainId();

  return {
    title: `Approve ${formatNumber(normalizeValue(amount, tokenData?.decimals))} of ${tokenData?.symbol} for spending`,
    args: {
      chainId,
      address: token as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [target, amount],
    },
  };
};

export const useExtendedContractWrite = (
  title: string,
  writeContractVariables: UseSimulateContractParameters,
) => {
  const simulateContract = useSimulateContract(writeContractVariables);
  const contractWrite = useWatchWriteTransactionHash(title);

  const write = useCallback(() => {
    if (
      writeContractVariables.address &&
      writeContractVariables.abi &&
      writeContractVariables.functionName
    ) {
      // @ts-ignore
      contractWrite.writeContract(writeContractVariables, {
        onError: (error: BaseError) => {
          enqueueSnackbar({
            message: error?.shortMessage || error.message,
            variant: "error",
          });
          console.error(error);
        },
      });
    }
  }, [contractWrite, writeContractVariables]);

  return {
    ...contractWrite,
    write,
    estimateError: simulateContract.error,
  };
};

const useWatchTransactionHash = <
  T extends UseSendTransactionReturnType | UseWriteContractReturnType,
>(
  description: string,
  usedWriteContract: T,
) => {
  const hash = usedWriteContract.data;
  const waitForTransaction = useWaitForTransactionReceipt({
    hash,
  });
  const writeLoading = usedWriteContract.status === "pending";

  // toast error if tx failed to be mined and success if it is having confirmation
  useEffect(() => {
    if (waitForTransaction.error) {
      enqueueSnackbar({
        message: waitForTransaction.error.message,
        variant: toastState[TxState.Failure],
      });
    } else if (waitForTransaction.data) {
      enqueueSnackbar({
        message: description,
        variant: toastState[TxState.Success],
      });
    } else if (waitForTransaction.isLoading) {
      enqueueSnackbar({
        message: description,
        variant: toastState[TxState.Pending],
      });
    }
  }, [
    waitForTransaction.data,
    waitForTransaction.error,
    waitForTransaction.isLoading,
  ]);

  return {
    ...usedWriteContract,
    isLoading: writeLoading || waitForTransaction.isLoading,
    walletLoading: writeLoading,
    txLoading: waitForTransaction.isLoading,
    waitData: waitForTransaction.data,
  };
};

export const useWatchSendTransactionHash = (title: string) => {
  const sendTransaction = useSendTransaction();

  return useWatchTransactionHash(title, sendTransaction);
};

const useWatchWriteTransactionHash = (description: string) => {
  const writeContract = useWriteContract();

  return useWatchTransactionHash(description, writeContract);
};

export const useExtendedSendTransaction = (
  title: string,
  args: UseSimulateContractParameters,
) => {
  const sendTransaction = useWatchSendTransactionHash(title);

  const send = useCallback(() => {
    sendTransaction.sendTransaction(args, {
      onError: (error) => {
        enqueueSnackbar({
          // @ts-ignore
          message: error?.cause?.shortMessage,
          variant: "error",
        });
        console.error(error);
      },
    });
  }, [sendTransaction, args]);

  return {
    ...sendTransaction,
    send,
  };
};

export const useApproveIfNecessary = (
  tokenIn: Address,
  target: Address,
  amount: string,
) => {
  const allowance = useAllowance(tokenIn, target);
  const approveData = useApprove(tokenIn, target, amount);
  const writeApprove = useExtendedContractWrite(
    approveData.title,
    approveData.args,
  );

  if (tokenIn === ETH_ADDRESS) return undefined;

  return +allowance < +amount ? writeApprove : undefined;
};

export const useSendEnsoTransaction = (
  amountIn: string,
  tokenOut: Address,
  tokenIn: Address,
  slippage: number,
  passkey?: PasskeyArgType
) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const sendTransaction = useWatchSendTransactionHash("Send Transaction");
  
  const preparedData: RouteParams = {
    fromAddress: address as `0x${string}`,
    receiver: address as `0x${string}`,
    spender: address as `0x${string}`,
    chainId,
    amountIn,
    slippage,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    routingStrategy: "router",
  };

  const { data: ensoData, isFetching } = useEnsoRouterData(preparedData);

  const sendSafeTransaction = async (tx: any) => {
    if (!passkey) {
      throw new Error('No passkey provided');
    }

    const safe4337Pack = await Safe4337Pack.init({
      provider: RPC_URL,
      signer: passkey,
      bundlerUrl: BUNDLER_URL,
      options: {
        owners: [],
        threshold: 1
      }
    });

    const safeTransaction = await safe4337Pack.createTransaction({
      transactions: [tx]
    });

    const signedSafeOperation = await safe4337Pack.signSafeOperation(safeTransaction);
    
    return await safe4337Pack.executeTransaction({
      executable: signedSafeOperation
    });
  };
  
  const send = async () => {
    if (!ensoData?.tx) return;
    
    if (passkey) {
      return sendSafeTransaction(ensoData.tx);
    } else {
      return sendTransaction.sendTransaction(ensoData.tx);
    }
  };

  return {
    send,
    ensoData,
    isFetchingEnsoData: isFetching,
  };
};

// Replace useNetworkId to not use Privy
export const useNetworkId = () => {
  return useChainId();
};
