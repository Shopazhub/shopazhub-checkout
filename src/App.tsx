import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import OrderSummary from './components/OrderSummary';
import PaymentButton from './components/PaymentButton';

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

export default function App() {
  const { address, isConnected } = useAccount();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderRef, setOrderRef] = useState('');
  const [showOrderInput, setShowOrderInput] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('orderRef');

    if (ref) {
      setOrderRef(ref);
      fetchOrder(ref);
    } else {
      setLoading(false);
      setShowOrderInput(true);
    }
  }, []);

  const fetchOrder = async (ref: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/orders/${ref}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      let body: any = {};

      try {
        body = await response.json();
      } catch {
        // Ignore parsing errors
      }

      if (!response.ok) {
        throw new Error(body.message || 'Order not found');
      }

      setOrder(body);
      setShowOrderInput(false);
    } catch (err) {
      setOrder(null);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );

      setShowOrderInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOrder = () => {
    if (!orderRef.trim()) {
      setError('Please enter an order reference');
      return;
    }

    fetchOrder(orderRef.trim());
  };

  const handleLookupAnotherOrder = () => {
    setOrder(null);
    setOrderRef('');
    setError(null);
    setShowOrderInput(true);
  };

  if (loading) {
    return (
      <div className="app-container loading">
        <div className="spinner"></div>
        <p>Loading order...</p>
      </div>
    );
  }

  if (!order && showOrderInput) {
    return (
      <div className="app-container">

        <header className="checkout-header">
          <h1>🛍️ ShopazHub Checkout</h1>
        </header>

        <div className="order-ref-form">

          <h3>Enter Order Reference</h3>

          <input
            type="text"
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleFetchOrder();
              }
            }}
            placeholder="Enter your order reference"
          />

          <button
            onClick={handleFetchOrder}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Find Order'}
          </button>

          {error && (
            <p className="error-message">
              ❌ {error}
            </p>
          )}

        </div>

      </div>
    );
  }

  if (!order) {
    return (
      <div className="app-container error">
        <div className="error-message">
          <p>❌ No order found</p>

          <button onClick={handleLookupAnotherOrder}>
            Search Again
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="app-container">

        <div className="connect-wallet">

          <h1>🛍️ ShopazHub Checkout</h1>

          <p>
            Please connect your MiniPay wallet to continue
          </p>

          <button
            onClick={handleLookupAnotherOrder}
            style={{ marginTop: '1rem' }}
          >
            Lookup Another Order
          </button>

          {/* Wallet connect component/button goes here */}

        </div>

      </div>
    );
  }

  return (
    <div className="app-container">

      <header className="checkout-header">

        <h1>🛍️ ShopazHub Checkout</h1>

        <p className="connected-wallet">
          Connected:{' '}
          {address?.slice(0, 6)}...
          {address?.slice(-4)}
        </p>

      </header>

      <div className="checkout-content">

        <OrderSummary order={order} />

        <PaymentButton
          order={order}
          userAddress={address!}
        />

      </div>

      <div
        style={{
          marginTop: '2rem',
          textAlign: 'center',
        }}
      >
        <button onClick={handleLookupAnotherOrder}>
          Lookup Another Order
        </button>
      </div>

    </div>
  );
}