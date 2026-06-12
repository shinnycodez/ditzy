import React, { useEffect, useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Cart = ({ isOpen, onClose }) => {
  const [cartItems, setCartItems] = useState([]);

  // Load cart items from storage
  useEffect(() => {
    if (!isOpen) return;

    const loadCartFromStorage = () => {
      try {
        // Use the same key as checkout page
        const storedCart = localStorage.getItem('cartItems') || sessionStorage.getItem('cartItems');
        if (storedCart) {
          const parsedCart = JSON.parse(storedCart);
          setCartItems(parsedCart);
        } else {
          setCartItems([]);
        }
      } catch (error) {
        console.error('Error loading cart from storage:', error);
        setCartItems([]);
      }
    };

    loadCartFromStorage();

    // Listen for storage changes (cart updates from other tabs or checkout)
    const handleStorageChange = (e) => {
      if (e.key === 'cartItems') {
        try {
          if (e.newValue) {
            const updatedCart = JSON.parse(e.newValue);
            setCartItems(updatedCart);
          } else {
            // Cart was cleared
            setCartItems([]);
          }
        } catch (error) {
          console.error('Error parsing updated cart:', error);
          setCartItems([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isOpen]);

  // Save cart to storage
  const saveCartToStorage = (updatedCart) => {
    try {
      const cartData = JSON.stringify(updatedCart);
      localStorage.setItem('cartItems', cartData);
      // Also save to sessionStorage as backup
      sessionStorage.setItem('cartItems', cartData);
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  // Remove item from cart
  const removeItem = (index) => {
    const updatedCart = cartItems.filter((_, i) => i !== index);
    setCartItems(updatedCart);
    saveCartToStorage(updatedCart);
  };

  // Update quantity of item
  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;

    const updatedCart = [...cartItems];
    updatedCart[index] = {
      ...updatedCart[index],
      quantity: newQuantity
    };
    setCartItems(updatedCart);
    saveCartToStorage(updatedCart);
  };

  const total = cartItems.reduce(
    (acc, item) => acc + (item.price || 0) * (item.quantity || 1),
    0
  );

  return (
    <div
      className={`fixed top-0 right-0 h-full z-50 bg-[#FFFFFF] shadow-2xl transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        w-full md:w-[400px]`}
    >
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-[#141414]">Your Cart</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black text-2xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cartItems.length === 0 ? (
            <p className="text-gray-500">Your cart is currently empty.</p>
          ) : (
            cartItems.map((item, index) => (
              <div key={`${item.id || item.productId || index}-${index}`} className="flex items-start gap-4 p-3 border rounded-lg shadow-sm hover:shadow-md transition">
                <img src={item.image} alt={item.title} className="w-20 h-30 object-top rounded" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-[#141414]">{item.title}</h3>
                  
                  {/* Display variation (color) if it exists */}
                  {item.variation && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-gray-500">Color:</span>
                      <span className="text-xs font-medium text-gray-700">{item.variation}</span>
                      {/* Optional: Show a small color swatch */}
                      <div 
                        className="w-3 h-3 rounded-full border border-gray-200"
                        style={{ 
                          backgroundColor: item.variation.toLowerCase(),
                          display: /^#[0-9A-F]{6}$/i.test(item.variation) ? 'block' : 'none'
                        }}
                        title={item.variation}
                      />
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {item.type && `${item.type} |`} {item.size} {item.lining ? '| Lining' : ''}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-100 disabled:hover:bg-transparent"
                    >−</button>
                    <span className="text-sm min-w-[20px] text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      className="px-2 py-1 border rounded hover:bg-gray-100"
                    >+</button>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    PKR {(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-700 transition p-1"
                  title="Remove item"
                >
                  <FaTrashAlt />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t sticky bottom-0 bg-[#FFFFFF]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">Total:</span>
            <span className="text-lg font-semibold text-[#141414]">
              PKR {total.toLocaleString()}
            </span>
          </div>
          {cartItems.length > 0 ? (
            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full text-center bg-[#ff9f00] text-white py-2 rounded-lg hover:opacity-90 transition"
            >
              Proceed to Checkout
            </Link>
          ) : (
            <button
              disabled
              className="w-full bg-[#ff9f00] text-white py-2 rounded-lg opacity-50 cursor-not-allowed"
            >
              Proceed to Checkout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Cart;