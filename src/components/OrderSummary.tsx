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
}

// Stablecoin display labels (no crypto-jargon per UI Copywriting Rules)
export default function OrderSummary({ order }: Props) {
  const currencyLabel = 'Digital dollar';

  return (
    <div className="order-summary">
      <h2>Order Summary</h2>
      
      <div className="order-ref">
        <span className="label">Order Reference:</span>
        <span className="value">{order.orderId}</span>
      </div>

      <div className="items-section">
        <h3>Items</h3>
        <div className="items-list">
          {(order.items ?? []).map((item, idx) => (
            <div key={idx} className="item">
              <span className="product-id">{item.productId}</span>
              <span className="qty">×{item.quantity}</span>
              <span className="price">{Number(item.price ?? 0).toFixed(2)} {currencyLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="order-total">
        <span className="label">Total:</span>
        <span className="amount">
          {(Number(order.total) || 0).toFixed(2)} <span className="currency">{currencyLabel}</span>
        </span>
      </div>
    </div>
  );
}