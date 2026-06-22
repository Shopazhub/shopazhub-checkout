import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import { injected } from '@wagmi/connectors';
import App from './App';
import './index.css';

/**
 * Wagmi config — celoAlfajores is kept as a fallback identifier,
 * but the Celo Sepolia chain (chainId: 11142220) is now the active testnet.
 * MiniPay injects the correct chain automatically via the injected connector.
 *
 * Celo Sepolia block explorer: https://celo-sepolia.blockscout.com
 */
const queryClient = new QueryClient();

const config = createConfig({
  chains: [celoAlfajores, celo],
  connectors: [injected()],
  transports: {
    [celoAlfajores.id]: http(),
    [celo.id]: http(),
  },
});

export default function Root() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
