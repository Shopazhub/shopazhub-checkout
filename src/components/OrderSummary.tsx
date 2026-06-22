import React from 'react';

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

export default function OrderSummary({ order }: Props) {
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
          {order.items.map((item, idx) => (
            <div key={idx} className="item">
              <span className="product-id">{item.productId}</span>
              <span className="qty">×{item.quantity}</span>
              <span className="price">{item.price.toFixed(2)} {order.currency}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="order-total">
        <span className="label">Total:</span>
        <span className="amount">
          {order.total.toFixed(2)} <span className="currency">{order.currency}</span>
        </span>
      </div>
    </div>
  );
}
