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

const DEFAULT_FEE_CURRENCY = FEE_CURRENCIES.USDC;

// USDC (Circle bridged) on Celo Mainnet — the token payForOrder() pulls via transferFrom.
// The cUSD/cEUR labels are just event metadata; the contract always uses USDC.
const TOKENS = {
  cUSD: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  cEUR: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
};

const PAYMENT_RECEIVER_ADDRESS = import.meta.env.VITE_PAYMENT_RECEIVER_ADDRESS || '';

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

function extractErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Pull the human-readable reason out of the contract revert JSON:
  // "message":"execution reverted: Order already processed"
  const jsonMatch = raw.match(/"message"\s*:\s*"execution reverted:\s*([^"]+)"/);
  if (jsonMatch) return jsonMatch[1].trim();

  // Plain revert without JSON wrapping
  const directMatch = raw.match(/execution reverted:\s*([^\n{(]+)/);
  if (directMatch) return directMatch[1].trim();

  // User rejected the transaction
  if (raw.toLowerCase().includes('user rejected') || raw.toLowerCase().includes('rejected the request')) {
    return 'Transaction cancelled.';
  }

  return 'Payment failed. Please try again.';
}

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

      // Step 3: Notify backend (public endpoint — no auth required)
      console.log('📢 Notifying backend...');
      const confirmRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/orders/confirm-minipay`,
        {
          orderRef: order.orderId,
          txHash: paymentTx,
          payer: userAddress,
          amount: order.total,
          currency: order.currency,
        }
      );

      const payload = confirmRes.data?.payload;
      if (!payload?.status) {
        throw new Error(payload?.message || 'Payment confirmation failed');
      }

      console.log('✅ Payment successful!');
      window.location.href = `/orders/${order.orderId}/success?tx=${paymentTx}`;
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      console.error('❌ Payment error:', err);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const orderAmount = Number(order.total) || 0;

  return (
    <div className="payment-button-container">
      {txHash && (
        <div className="success-message">
          <p>✅ Payment successful!</p>
          <p className="tx-hash">
            Tx: <a href={`https://celoscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
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

      {!txHash && (
        <div className="cost-breakdown">
          <div className="cost-row">
            <span>Order amount</span>
            <span>{orderAmount.toFixed(2)} Digital dollars</span>
          </div>
          <div className="cost-row">
            <span>Network fee</span>
            <span className="cost-fee">&lt; $0.01 USDC</span>
          </div>
          <div className="cost-row cost-row--total">
            <span>You pay</span>
            <span>{orderAmount.toFixed(2)} USDC</span>
          </div>
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
          `Pay ${orderAmount.toFixed(2)} USDC`
        )}
      </button>

      <div className="payment-info">
        <p className="info-text">
          🔒 Secure payment via Celo network
        </p>
      </div>
    </div>
  );
}