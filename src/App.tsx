import { useEffect, useRef, useState } from 'react';
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

const DEPOSIT_URL = 'https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT';

export default function App() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderRef, setOrderRef] = useState('');
  const [showOrderInput, setShowOrderInput] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMiniPay, setIsMiniPay] = useState(false);
  const [lowBalance, setLowBalance] = useState(false);

  useEffect(() => {
    // Zero-Click Connect: detect MiniPay automatically
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('orderRef');
    const token = params.get('token');

    if (token) {
      localStorage.setItem('token', token);
    }

    if (ref) {
      setOrderRef(ref);
      fetchOrder(ref);
    } else {
      setLoading(false);
      setShowOrderInput(true);
    }
  }, []);

  const redirectToDeposit = () => {
    window.location.href = DEPOSIT_URL;
  };

  const fetchOrder = async (ref: string) => {
    try {
      setLoading(true);
      setError(null);
      setLowBalance(false);

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

      // DEBUG: shows raw API response — remove after confirming order field names
      setError('API response: ' + JSON.stringify(body));
      setShowOrderInput(true);
      return;
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
    setLowBalance(false);
    setShowOrderInput(true);
  };

  const handlePaymentError = (errMessage: string) => {
    // Low-Balance Handling: if the error indicates insufficient funds,
    // redirect to deposit page instead of showing a generic error
    const lowFundsKeywords = [
      'insufficient funds',
      'low balance',
      'gas',
      'fee',
      'not enough',
      'transfer amount exceeds balance',
    ];

    const isLowFunds = lowFundsKeywords.some((keyword) =>
      errMessage.toLowerCase().includes(keyword)
    );

    if (isLowFunds) {
      setLowBalance(true);
    } else {
      setError(errMessage);
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

  if (lowBalance) {
    return (
      <div className="app-container">
        <header className="checkout-header">
          <div className="logo-container">
            <img src="/logo.png" alt="ShopazHub" />
          </div>
        </header>

        <div className="connect-wallet">
          <h2>Insufficient funds</h2>

          <p>
            You don't have enough funds to complete this payment. Please add
            funds to your wallet and try again.
          </p>

          <button
            onClick={redirectToDeposit}
            className="payment-button"
            style={{ marginTop: '1rem', marginBottom: '0.5rem' }}
          >
            Deposit
          </button>

          <button
            onClick={handleLookupAnotherOrder}
            style={{ marginTop: '0.5rem' }}
          >
            Try a different order
          </button>
        </div>

        <Footer />
      </div>
    );
  }

  if (!order && showOrderInput) {
    return (
      <div className="app-container">

        <header className="checkout-header">
          <div className="logo-container">
            <img src="/logo.png" alt="ShopazHub" />
          </div>
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

        <Footer />
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

  // On MiniPay, wagmi auto-connects via the injected connector but it's async.
  // Wait for the connection to settle before rendering the checkout so we never
  // pass an undefined address into PaymentButton.
  if (isMiniPay && !isConnected && (isConnecting || isReconnecting)) {
    return (
      <div className="app-container loading">
        <div className="spinner"></div>
        <p>Connecting wallet...</p>
      </div>
    );
  }

  // Zero-Click Connect: on MiniPay, wallet is auto-connected via injected connector.
  // For non-MiniPay browsers, we still show the wallet connection prompt.
  if (!isConnected && !isMiniPay) {
    return (
      <div className="app-container">

        <header className="checkout-header">
          <div className="logo-container">
            <img src="/logo.png" alt="ShopazHub" />
          </div>
        </header>

        <div className="connect-wallet">

          <p>
            Please connect your wallet to continue with your payment
          </p>

          <button
            onClick={handleLookupAnotherOrder}
            style={{ marginTop: '1rem' }}
          >
            Lookup Another Order
          </button>

          <p className="info-text" style={{ marginTop: '1rem', color: '#999', fontSize: '12px' }}>
            Wallet connection is handled automatically in MiniPay.
          </p>

          {/* wagmi injected connector handles the connect button automatically */}

        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="app-container">

      <header className="checkout-header">
        <div className="logo-container">
          <img src="/logo.png" alt="ShopazHub" />
        </div>

        <h1>Checkout</h1>

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
          onError={handlePaymentError}
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

      <Footer />
    </div>
  );
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="support-widget" ref={ref}>
      <div className={`support-popup${open ? ' support-popup--open' : ''}`} role="dialog" aria-label="Support options">
        <p className="support-popup-label">How can we help?</p>

        <a
          href="https://wa.me/2348164602886?text=Hello%2C%20I%20need%20help%20with%20my%20order."
          target="_blank"
          rel="noopener noreferrer"
          className="support-popup-option support-popup-option--wa"
          onClick={() => setOpen(false)}
        >
          <span className="support-popup-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
          </span>
          <span className="support-popup-text">
            <span className="support-popup-title">WhatsApp</span>
            <span className="support-popup-sub">Chat with us instantly</span>
          </span>
        </a>

        <a
          href="mailto:support@shopazhub.com"
          className="support-popup-option support-popup-option--email"
          onClick={() => setOpen(false)}
        >
          <span className="support-popup-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </span>
          <span className="support-popup-text">
            <span className="support-popup-title">Email Support</span>
            <span className="support-popup-sub">support@shopazhub.com</span>
          </span>
        </a>
      </div>

      <button
        className={`support-fab${open ? ' support-fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Contact support"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="8" cy="10" r="1" fill="currentColor"/>
            <circle cx="16" cy="10" r="1" fill="currentColor"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="checkout-footer">
      <div className="footer-support">
        <p className="footer-support-label">Need help?</p>
        <div className="footer-support-channels">
          <a
            href="mailto:support@shopazhub.com"
            className="support-link support-email"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            support@shopazhub.com
          </a>
          <a
            href="https://wa.me/2348164602886"
            target="_blank"
            rel="noopener noreferrer"
            className="support-link support-whatsapp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="footer-links">
        <a
          href="https://shopazhub.com/termsOfUse"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        <a
          href="https://shopazhub.com/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
      </div>
      <p className="footer-copyright">
        Shopaz E-Cart Solutions Limited. All Rights Reserved
      </p>
    </footer>
  );
}
