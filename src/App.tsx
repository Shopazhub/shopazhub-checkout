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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get order data from URL params or session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderRef = params.get('orderRef');
    
    if (orderRef) {
      fetchOrder(orderRef);
    } else {
      setLoading(false);
      setError('No order reference provided');
    }
  }, []);

  const fetchOrder = async (orderRef: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/orders/${orderRef}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const data = await response.json();
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container loading">
        <div className="spinner"></div>
        <p>Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container error">
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="app-container error">
        <div className="error-message">
          <p>❌ No order found</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="app-container">
        <div className="connect-wallet">
          <h1>🛍️ ShopazHub Checkout</h1>
          <p>Please connect your MiniPay wallet to continue</p>
          {/* Connect button will be provided by wagmi context */}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="checkout-header">
        <h1>🛍️ ShopazHub Checkout</h1>
        <p className="connected-wallet">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
      </header>

      <div className="checkout-content">
        <OrderSummary order={order} />
        <PaymentButton order={order} userAddress={address!} />
      </div>
    </div>
  );
}
