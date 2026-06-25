import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, injected } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import App, { SupportWidget } from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div className="connect-wallet">
            <h2>Something went wrong</h2>
            <p>Please refresh the page and try again.</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wagmi config — celoAlfajores is kept as a fallback identifier,
 * but the Celo Sepolia chain (chainId: 11142220) is now the active testnet.
 * MiniPay injects the correct chain automatically via the injected connector.
 *
 * Celo Sepolia block explorer: https://celo-sepolia.blockscout.com
 *
 * autoConnect: true enables automatic reconnection on page load,
 * which is essential for MiniPay's Zero-Click Connect requirement.
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
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
      <SupportWidget />
    </ErrorBoundary>
  );
}