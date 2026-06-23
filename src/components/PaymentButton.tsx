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
}

// Celo token addresses (Sepolia testnet)
// USDC on Celo Sepolia: 0x01C5C0122039549AD1493B8220cABEdD739BC44E
const TOKENS = {
  cUSD: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
  // cEUR on Celo Sepolia — the testnet uses USDC as primary stable
  cEUR: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
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

export default function PaymentButton({ order, userAddress }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const handlePayment = async () => {
    if (!walletClient || !publicClient) {
      setError('Wallet not connected');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tokenAddress = TOKENS[order.currency];
      const amount = parseUnits(order.total.toString(), 6); // cUSD/cEUR use 6 decimals

      // Step 1: Approve token spending
      console.log('📝 Approving token spending...');
      const approveTx = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PAYMENT_RECEIVER_ADDRESS as `0x${string}`, amount],
        account: userAddress as `0x${string}`,
      });

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
        // Legacy transaction for MiniPay compatibility
        type: 'legacy',
      });

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
    } finally {
      setLoading(false);
    }
  };

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
          `Pay ${order.total.toFixed(2)} ${order.currency}`
        )}
      </button>

      <div className="payment-info">
        <p className="info-text">
          🔒 Secure payment powered by Celo blockchain
        </p>
        <p className="terms">
          By clicking pay, you approve a transaction for {order.total.toFixed(2)} {order.currency}
        </p>
      </div>
    </div>
  );
}
