import React, { useEffect, useState } from 'react';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  addDoc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import Header from './Header';
import { useNavigate } from 'react-router-dom';

const CheckoutPage = () => {
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    phone: '',
   instagram: '',
    address: '',
    city: '',
    postalCode: '',
    region: '',
    country: '',
    shippingMethod: 'Standard Delivery',
    paymentMethod: 'Cash on Delivery',
    promoCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bankTransferProofBase64, setBankTransferProofBase64] = useState(null);
  const [convertingImage, setConvertingImage] = useState(false);
  const [stockValidationErrors, setStockValidationErrors] = useState([]);

  // Constants
  const SHIPPING_COST = 350; // Flat rate for all cities

  // Load cart items from localStorage or session storage
  useEffect(() => {
    const loadCartFromStorage = () => {
      try {
        // Try to get cart from localStorage first, then sessionStorage
        const savedCart = localStorage.getItem('cartItems') || sessionStorage.getItem('cartItems');
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          setCartItems(parsedCart);
        }
      } catch (error) {
        console.error('Error loading cart from storage:', error);
        setCartItems([]);
      }
    };

    loadCartFromStorage();

    // Listen for storage changes (if cart is updated in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'cartItems' && e.newValue) {
        try {
          const updatedCart = JSON.parse(e.newValue);
          setCartItems(updatedCart);
        } catch (error) {
          console.error('Error parsing updated cart:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + SHIPPING_COST;

  // NEW FUNCTION: Validate and reduce stock for each item
 const validateAndReduceStock = async (items) => {
  const stockErrors = [];
  const stockUpdates = [];

  for (const item of items) {
    const productRef = doc(db, "products", item.productId || item.id);
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      stockErrors.push(`${item.title}: Product not found`);
      continue;
    }

    const productData = productDoc.data();
    const quantity = item.quantity || 1;
    let currentStock = null;
    let stockField = null; // 'variation', 'size', or 'default'
    let stockKey = null;   // the actual key inside the stock map

    if (item.variation && productData.stock && productData.stock[item.variation] !== undefined) {
      currentStock = productData.stock[item.variation];
      stockField = 'variation';
      stockKey = item.variation;
    } else if (item.size && productData.stock && productData.stock[item.size] !== undefined) {
      currentStock = productData.stock[item.size];
      stockField = 'size';
      stockKey = item.size;
    } else {
      currentStock = productData.defaultStock || 0;
      stockField = 'default';
    }

    if (currentStock < quantity) {
      stockErrors.push(
        `${item.title}${item.variation ? ` (${item.variation})` : ''}${item.size ? ` (${item.size})` : ''}: ` +
        `Only ${currentStock} left in stock, but you ordered ${quantity}`
      );
    } else {
      stockUpdates.push({
        productId: productRef.id,
        productRef,
        stockField,
        stockKey,
        newStock: currentStock - quantity,
        currentStockMap: productData.stock || {},
        item,
      });
    }
  }

  if (stockErrors.length > 0) return { success: false, errors: stockErrors };

  for (const update of stockUpdates) {
    try {
      if (update.stockField === 'default') {
        await updateDoc(update.productRef, { defaultStock: update.newStock });
      } else {
        // Spread the full stock map and overwrite just the changed key,
        // avoiding Firestore dot-notation path interpretation
        const updatedStockMap = {
          ...update.currentStockMap,
          [update.stockKey]: update.newStock,
        };
        await updateDoc(update.productRef, { stock: updatedStockMap });
      }
    } catch (err) {
      console.error(`Failed to update stock for ${update.item.title}:`, err);
      return {
        success: false,
        errors: [`Failed to update stock for ${update.item.title}. Please try again.`],
      };
    }
  }

  return { success: true, errors: [] };
};

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Clear the Base64 string if payment method changes from Advance payment
    if (name === 'paymentMethod' && value !== 'Advance payment') {
      setBankTransferProofBase64(null);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic file size validation (5MB limit)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setErrors(prev => ({ ...prev, bankTransferProof: 'File size exceeds 5MB limit.' }));
        setBankTransferProofBase64(null);
        return;
      }

      setConvertingImage(true);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));

      const reader = new FileReader();
      reader.onloadend = () => {
        setBankTransferProofBase64(reader.result);
        setConvertingImage(false);
      };
      reader.onerror = (error) => {
        console.error("Error converting file to Base64:", error);
        setBankTransferProofBase64(null);
        setConvertingImage(false);
        setErrors(prev => ({ ...prev, bankTransferProof: 'Failed to read image file.' }));
      };
      reader.readAsDataURL(file);
    } else {
      setBankTransferProofBase64(null);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = [ 'fullName', 'phone', 'address', 'city', 'country'];
    requiredFields.forEach(field => {
      if (!form[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    // Email validation
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Require bank transfer proof for Advance payment
    if (form.paymentMethod === 'Advance payment' && !bankTransferProofBase64) {
      newErrors.bankTransferProof = `Please upload a screenshot of your advance payment of PKR ${total.toLocaleString()}.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearCart = () => {
    // Clear cart from both storage options
    localStorage.removeItem('cartItems');
    sessionStorage.removeItem('cartItems');
    setCartItems([]);
  };

  const placeOrder = async () => {
    if (!validateForm()) {
      // Scroll to the first error field
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementsByName(firstErrorField)[0] || 
                      document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setLoading(true);
    setStockValidationErrors([]);

    // Generate a unique order ID for guest checkout
    const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Prepare order items with product IDs
    const orderItems = cartItems.map(item => ({
      productId: item.productId || item.id,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      // Store variation details
      variation: item.variation || null,
      type: item.type || null,
      size: item.size || null,
      lining: item.lining || false,
    }));

    // FIRST: Validate and reduce stock
    const stockResult = await validateAndReduceStock(orderItems);
    
    if (!stockResult.success) {
      setStockValidationErrors(stockResult.errors);
      setLoading(false);
      // Scroll to show stock errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const order = {
      orderId,
      customerType: 'guest', // Mark as guest order
      customerEmail: form.email,
      items: orderItems,
      shipping: form.shippingMethod,
      payment: form.paymentMethod,
      shippingAddress: {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        customerInstagram: form.instagram || null,
        postalCode: form.postalCode,
        region: form.region,
        country: form.country,
      },
      promoCode: form.promoCode,
      notes: form.notes,
      subtotal,
      shippingCost: SHIPPING_COST,
      total,
      createdAt: new Date(),
      status: 'processing',
      // Track that stock was already reduced at order placement
      stockReducedAtOrderPlacement: true,
      // Store advance payment proof for Advance payment
      bankTransferProofBase64: form.paymentMethod === 'Advance payment' ? bankTransferProofBase64 : null,
    };

    try {
      await addDoc(collection(db, 'orders'), order);

      // Clear the cart after successful order
      clearCart();

      // Store order ID for confirmation page
      sessionStorage.setItem('lastOrderId', orderId);
      sessionStorage.setItem('lastOrderEmail', form.email);
      sessionStorage.setItem('lastOrderType', 'checkout');

      navigate('/thanks');
    } catch (err) {
      console.error("Error placing order:", err);
      
      // Note: Stock has already been reduced at this point
      // In case of order creation failure, you might want to revert stock changes
      // This would require implementing a rollback mechanism
      
      if (err.code === 'resource-exhausted' || (err.message && err.message.includes('too large'))) {
        alert('Error: The uploaded image is too large. Please try a smaller image or contact support.');
      } else {
        alert('Error placing order. Please try again. If the issue persists, contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show empty cart message if no items
  if (cartItems.length === 0) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#FFFFFF] py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Your Cart is Empty</h1>
              <p className="text-gray-600 mb-8">Add some items to your cart to proceed with checkout.</p>
              <button
                onClick={() => navigate('/')}
                className="bg-black text-white px-8 py-3 rounded-md font-medium hover:bg-gray-800 transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#FFFFFF] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm sm:text-base">
              <li>
                <a href="/" className="text-gray-500 hover:text-gray-700">Home</a>
              </li>
              <li>
                <span className="text-gray-400">/</span>
              </li>
              <li>
                <span className="text-black font-medium">Checkout</span>
              </li>
            </ol>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

          {/* Stock Validation Errors Display */}
          {stockValidationErrors.length > 0 && (
            <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-red-800 font-medium">Stock Availability Issues</h3>
                  <ul className="list-disc list-inside mt-2">
                    {stockValidationErrors.map((error, index) => (
                      <li key={index} className="text-red-700 text-sm">{error}</li>
                    ))}
                  </ul>
                  <p className="text-red-700 text-sm mt-2">
                    Please update your cart quantity or remove items and try again.
                  </p>
                  <button
                    onClick={() => navigate('/cart')}
                    className="mt-3 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition"
                  >
                    Go to Cart
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Form */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Contact Information</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>
              <div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Instagram Username <span className="text-gray-400 text-xs font-normal">(Optional)</span>
  </label>
  <div className="relative">
    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
      @
    </span>
    <input
      name="instagram"
      type="text"
      value={form.instagram}
      onChange={handleChange}
      placeholder="yourusername"
      className="w-full px-4 py-2 pl-8 border border-gray-300 rounded-md focus:ring-black focus:border-black"
    />
  </div>
</div>

              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Shipping Address</h2>

              <div className="grid gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name*</label>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                  />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address*</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.address ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                  />
                  {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                    <input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                    />
                    {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input
                      name="postalCode"
                      value={form.postalCode}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.postalCode ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                    />
                    {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province/Region</label>
                    <input
                      name="region"
                      value={form.region}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.region ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                    />
                    {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country*</label>
                    <select
                      name="country"
                      value={form.country}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.country ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                    >
                      <option value="">Select Country</option>
                      <option value="PK">Pakistan</option>
                    </select>
                    {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country}</p>}
                  </div>
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-6 pb-2 border-b">Shipping Method</h2>

              <div className="space-y-4">
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="Standard Delivery"
                    checked={form.shippingMethod === 'Standard Delivery'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">Standard Delivery</p>
                    <p className="text-sm text-gray-500">
                      PKR {SHIPPING_COST} - Delivery in 8-10 business days
                    </p>
                  </div>
                </label>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-6 pb-2 border-b">Payment Method</h2>

              <div className="space-y-4">
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="Cash on Delivery"
                    checked={form.paymentMethod === 'Cash on Delivery'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900">Cash on Delivery</span>
                    <p className="text-sm text-gray-500">Pay when your order is delivered</p>
                  </div>
                </label>
                
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="Advance payment"
                    checked={form.paymentMethod === 'Advance payment'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900">Advance payment</span>
                    <p className="text-sm text-gray-500">Pay full amount online in advance</p>
                  </div>
                </label>
              </div>

              {form.paymentMethod === 'Advance payment' && (
                <div className="mt-6 p-4 border border-blue-300 bg-blue-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Advance Payment</h3>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    Please transfer the full amount of <strong>PKR {total.toLocaleString()}</strong> to:
                  </p>
                  <ul className="list-disc list-inside text-gray-800 text-sm sm:text-base mb-4">
                    <h2>Nayapay</h2>
                    <li><strong>Account Name</strong> Duaa Khan</li>
                    <li><strong>Bank Account Number:</strong> 02321007872534</li>
                    <h2>Bank transfer</h2>
                      <li><strong>Bank Name</strong> Bank Alfalah</li>
                    <li><strong>Bank Account Number: </strong>02321007872534</li>      
                    <li><strong>Account holder name : </strong>02321007872534</li>      
      
                  </ul>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    After completing the transfer, upload a screenshot / receipt as proof.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Payment Proof*
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className={`w-full px-4 py-2 border ${errors.bankTransferProof ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}
                    />
                    {errors.bankTransferProof && <p className="mt-1 text-sm text-red-600">{errors.bankTransferProof}</p>}
                    {bankTransferProofBase64 && (
                      <p className="mt-2 text-sm text-green-600">✓ Proof uploaded.</p>
                    )}
                    {convertingImage && (
                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Converting image...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.paymentMethod === 'Cash on Delivery' && (
                <div className="mt-6 p-4 border border-green-300 bg-green-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Cash on Delivery Information</h3>
                  <p className="text-gray-700 text-sm sm:text-base mb-2">
                    You will pay PKR {total.toLocaleString()} when your order is delivered to your address.
                  </p>
                  <p className="text-gray-600 text-sm">
                    Please have the exact amount ready.
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <div className="flex">
                  <input
                    name="promoCode"
                    value={form.promoCode}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:ring-black focus:border-black"
                    placeholder="Enter promo code"
                  />
                  <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-r-md hover:bg-gray-300 transition">
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes (Optional)</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-black focus:border-black"
                  placeholder="Special instructions, delivery notes, etc."
                />
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm lg:h-fit lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {cartItems.map((item, index) => (
                  <div key={item.id || index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-20 h-25 object-top rounded flex-shrink-0"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        
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
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-medium mt-2 sm:mt-0 sm:ml-4">
                      PKR {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm">PKR {subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Shipping</span>
                  <span className="text-sm">PKR {SHIPPING_COST.toLocaleString()}</span>
                </div>

                {form.promoCode && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Discount</span>
                    <span className="text-sm text-green-600">-PKR 0</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="font-medium text-base sm:text-lg">Total</span>
                <span className="font-bold text-base sm:text-lg">PKR {total.toLocaleString()}</span>
              </div>

              <button
                onClick={placeOrder}
                disabled={loading || cartItems.length === 0 || convertingImage || (form.paymentMethod === 'Advance payment' && !bankTransferProofBase64)}
                className={`mt-6 w-full py-3 px-4 rounded-md font-medium text-base ${
                  loading || cartItems.length === 0 || convertingImage || (form.paymentMethod === 'Advance payment' && !bankTransferProofBase64)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-black text-white hover:bg-gray-800'
                } transition`}
              >
                {loading || convertingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {convertingImage ? 'Converting Image...' : 'Processing Order...'}
                  </span>
                ) : cartItems.length === 0 ? (
                  'Your Cart is Empty'
                ) : (form.paymentMethod === 'Advance payment' && !bankTransferProofBase64) ? (
                  'Upload payment proof'
                ) : (
                  'Place Order'
                )}
              </button>

              <div className="mt-6 text-center text-xs sm:text-sm text-gray-500">
                <p>100% secure checkout</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;