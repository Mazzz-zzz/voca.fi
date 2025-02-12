'use client'

import { Flex, Text, Box } from "@chakra-ui/react"
import { useAccount, useBalance } from "wagmi"
import { Button } from "@/components/ui/button"
import { useAppKit } from '@reown/appkit/react'
import { formatEther } from "viem"

export function Navbar() {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  })

  return (
    <Flex 
      as="nav" 
      align="center" 
      justify="space-between" 
      p={4} 
      borderBottom="1px" 
      borderColor="gray.200"
    >
      <Text fontSize="xl" fontWeight="bold">Voca.fi</Text>
      
      <Flex align="center" gap={4}>
        {isConnected && balance && (
          <Text color="gray.600">
            {parseFloat(formatEther(balance.value)).toFixed(4)} POL
          </Text>
        )}
        <Button onClick={() => open()}>
          {address 
            ? `${address.slice(0, 6)}...${address.slice(-4)}` 
            : 'Connect Wallet'
          }
        </Button>
      </Flex>
    </Flex>
  )
} 