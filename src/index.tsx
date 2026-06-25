import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, injected } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import App, { SupportWidget } from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; info: string }
> {
  state = { hasError: false, error: null as Error | null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ info: errorInfo.componentStack ?? '' });
  }

  render() {
    if (this.state.hasError) {
      const { error, info } = this.state;
      return (
        <div className="app-container" style={{ paddingTop: '40px' }}>
          <div style={{
            background: '#1a0000',
            border: '1px solid #ff4444',
            borderRadius: '12px',
            padding: '20px',
            color: '#ff9999',
            fontFamily: 'monospace',
            fontSize: '12px',
            wordBreak: 'break-word',
          }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#ff4444', fontSize: '14px' }}>
              ❌ Render Error (debug mode)
            </p>
            <p style={{ margin: '0 0 12px', color: '#ffcccc', fontSize: '13px', fontFamily: 'inherit' }}>
              <strong>{error?.name}:</strong> {error?.message}
            </p>
            {info && (
              <pre style={{
                margin: '0 0 16px',
                whiteSpace: 'pre-wrap',
                background: '#110000',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#ff8888',
                maxHeight: '200px',
                overflow: 'auto',
              }}>
                {info}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
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