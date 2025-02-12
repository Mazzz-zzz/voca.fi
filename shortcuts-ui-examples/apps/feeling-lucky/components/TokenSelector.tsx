import { Flex, Text } from "@chakra-ui/react";
import { Address } from "viem";
import { USDC_TOKEN, ETH_TOKEN } from "@/util/constants";

const TokenIndicator = ({ token }: { token: typeof USDC_TOKEN | typeof ETH_TOKEN }) => (
  <Flex align="center">
    <Text ml={2}>{token.symbol}</Text>
  </Flex>
);

const TokenSelector = ({
  value,
  onChange,
  isInput = false,
}: {
  value: Address;
  onChange: (value: Address) => void;
  isInput?: boolean;
}) => {
  const token = isInput ? ETH_TOKEN : USDC_TOKEN;
  
  return (
    <Flex align="center">
      <TokenIndicator token={token} />
    </Flex>
  );
};

export default TokenSelector;
