import React, { useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';
import axios from 'axios';

interface Order {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  currency: 'cUSD' | 'cEUR';
}

interface Props {
  order: Order;
  userAddress: string;
  onError?: (message: string) => void;
}

/**
 * CIP-64 Fee Abstraction on Celo Mainnet:
 * These feeCurrency addresses enable paying network fees in stablecoins
 * instead of CELO. MiniPay abstracts network fees automatically.
 *
 * USDm:  0x765DE816845861e75A25fCA122bb6898B8B1282a (18 decimals)
 * USDC:  0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B (6 decimals) - Gas Adapter
 * USDT:  0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72 (6 decimals) - Gas Adapter
 */
const FEE_CURRENCIES = {
  USDm: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  USDC: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
  USDT: '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72',
};

const DEFAULT_FEE_CURRENCY = FEE_CURRENCIES.USDm;

// Token addresses for the payment contract (Celo Mainnet / Sepolia)
const TOKENS = {
  // Celo Sepolia testnet USDC
  cUSD: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
  cEUR: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
};

const PAYMENT_RECEIVER_ADDRESS = import.meta.env.VITE_PAYMENT_RECEIVER_ADDRESS || '';

// Stablecoin display names (no crypto-jargon)
const CURRENCY_LABELS: Record<string, string> = {
  cUSD: 'Digital dollar',
  cEUR: 'Digital euro',
};

// Simple ERC20 ABI for approve and transfer
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const PAYMENT_RECEIVER_ABI = [
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_orderRef', type: 'string' },
      { name: '_currency', type: 'string' },
    ],
    name: 'payForOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export default function PaymentButton({ order, userAddress, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const handlePayment = async () => {
    if (!walletClient || !publicClient) {
      setError('Wallet not connected');
      onError?.('Wallet not connected');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tokenAddress = TOKENS[order.currency];
      const amount = parseUnits(order.total.toString(), 6); // cUSD/cEUR use 6 decimals

      // Step 1: Approve token spending (using legacy tx for MiniPay compatibility)
      console.log('📝 Approving token spending...');
      const approveTx = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PAYMENT_RECEIVER_ADDRESS as `0x${string}`, amount],
        account: userAddress as `0x${string}`,
        // EIP-1559: Use legacy transaction for MiniPay compatibility
        type: 'legacy',
        // CIP-64: Pay network fees with stablecoins via feeCurrency
        feeCurrency: DEFAULT_FEE_CURRENCY as `0x${string}`,
      } as any);

      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log('✅ Token approved');

      // Step 2: Call payForOrder on contract
      console.log('💳 Processing payment...');
      const paymentTx = await walletClient.writeContract({
        address: PAYMENT_RECEIVER_ADDRESS as `0x${string}`,
        abi: PAYMENT_RECEIVER_ABI,
        functionName: 'payForOrder',
        args: [amount, order.orderId, order.currency],
        account: userAddress as `0x${string}`,
        // EIP-1559: Legacy transaction for MiniPay compatibility
        type: 'legacy',
        // CIP-64: Pay network fees with stablecoins
        feeCurrency: DEFAULT_FEE_CURRENCY as `0x${string}`,
      } as any);

      // Wait for payment transaction
      const receipt = await publicClient.waitForTransactionReceipt({ hash: paymentTx });
      console.log('✅ Payment confirmed');

      setTxHash(paymentTx);

      // Step 3: Notify backend
      console.log('📢 Notifying backend...');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/orders/confirm-minipay`,
        {
          orderRef: order.orderId,
          txHash: paymentTx,
          amount: order.total,
          currency: order.currency,
          payer: userAddress,
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      console.log('✅ Payment successful!');
      // Redirect to success page or show success message
      window.location.href = `/orders/${order.orderId}/success?tx=${paymentTx}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      console.error('❌ Payment error:', err);
      // Notify parent about the error for low-balance handling
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const currencyLabel = CURRENCY_LABELS[order.currency] || 'Stablecoin';

  return (
    <div className="payment-button-container">
      {txHash && (
        <div className="success-message">
          <p>✅ Payment successful!</p>
          <p className="tx-hash">
            Tx: <a href={`https://celo-sepolia.blockscout.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={loading || !!txHash}
        className="payment-button"
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : txHash ? (
          '✅ Payment Complete'
        ) : (
          `Pay ${order.total.toFixed(2)} ${currencyLabel}`
        )}
      </button>

      <div className="payment-info">
        <p className="info-text">
          🔒 Secure payment processed on the Celo network
        </p>
        <p className="terms">
          By clicking pay, you approve a transaction for {order.total.toFixed(2)} {currencyLabel}
        </p>
      </div>
    </div>
  );
}