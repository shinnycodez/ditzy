import React, { useEffect, useState } from 'react';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Header from './Header';
import { useNavigate } from 'react-router-dom';

const BuyNowCheckout = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
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
    paymentMethod: 'JazzCash/EasyPaisa',
    promoCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bankTransferProofBase64, setBankTransferProofBase64] = useState(null);
  const [convertingImage, setConvertingImage] = useState(false);
  const [stockValidationErrors, setStockValidationErrors] = useState([]);

  // Constants
  const MINIMUM_ORDER_VALUE = 1000;

  // Load buy now product from session storage
  useEffect(() => {
    try {
      const buyNowItem = sessionStorage.getItem('buyNowItem');
      if (buyNowItem) {
        const parsedProduct = JSON.parse(buyNowItem);
        setProduct(parsedProduct);
        setCartItems([{
          id: parsedProduct.id || `temp_${Date.now()}`,
          ...parsedProduct,
          quantity: parsedProduct.quantity || 1,
          createdAt: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error loading buy now product:', error);
    }
  }, []);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const shippingCost = form.city.trim().toLowerCase() === 'karachi' ? 250 : 350;
  const cashOnDeliveryFee = 0; // No extra COD fee
  const total = subtotal + shippingCost + cashOnDeliveryFee;

  // Split payment for JazzCash/EasyPaisa
  const getSplitAmounts = () => {
    if (form.paymentMethod !== 'JazzCash/EasyPaisa') return { advance: 0, doorstep: 0 };
    const advance = Math.max(0, total - 500);
    const doorstep = total - advance; // will be min(500, total)
    return { advance, doorstep };
  };
  const { advance: advanceAmount, doorstep: doorstepAmount } = getSplitAmounts();

  // Check if order meets minimum value requirement
  const isMinimumOrderMet = subtotal >= MINIMUM_ORDER_VALUE;
  const remainingAmount = MINIMUM_ORDER_VALUE - subtotal;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear proof when switching away from JazzCash/EasyPaisa
    if (name === 'paymentMethod' && value !== 'JazzCash/EasyPaisa') {
      setBankTransferProofBase64(null);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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
      reader.onerror = () => {
        setBankTransferProofBase64(null);
        setConvertingImage(false);
        setErrors(prev => ({ ...prev, bankTransferProof: 'Failed to read image file.' }));
      };
      reader.readAsDataURL(file);
    } else {
      setBankTransferProofBase64(null);
    }
  };

  // Stock validation and reduction (unchanged)
  const validateAndReduceStock = async (items) => {
    const stockErrors = [];
    const stockUpdates = [];

    for (const item of items) {
      const productRef = doc(db, "products", item.productId || item.id.replace('temp_', ''));
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        stockErrors.push(`${item.title}: Product not found`);
        continue;
      }

      const product = productDoc.data();
      const quantity = item.quantity || 1;
      let currentStock = null;
      let stockKey = null;

      if (item.variation && product.stock && product.stock[item.variation] !== undefined) {
        currentStock = product.stock[item.variation];
        stockKey = `stock.${item.variation}`;
      } 
      else if (item.size && product.stock && product.stock[item.size] !== undefined) {
        currentStock = product.stock[item.size];
        stockKey = `stock.${item.size}`;
      }
      else {
        currentStock = product.defaultStock || 0;
        stockKey = 'defaultStock';
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
          stockKey,
          newStock: currentStock - quantity,
          item: item
        });
      }
    }

    if (stockErrors.length > 0) return { success: false, errors: stockErrors };

    for (const update of stockUpdates) {
      try {
        await updateDoc(update.productRef, {
          [update.stockKey]: update.newStock
        });
      } catch (err) {
        return { 
          success: false, 
          errors: [`Failed to update stock for ${update.item.title}. Please try again.`] 
        };
      }
    }
    return { success: true, errors: [] };
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = ['fullName', 'phone', 'address', 'city', 'region', 'country'];
    
    requiredFields.forEach(field => {
      if (!form[field]) newErrors[field] = 'This field is required';
    });

    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (form.phone && !/^\d{7,}$/.test(form.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number (at least 7 digits)';
    }

    // For JazzCash/EasyPaisa, require proof if advance amount > 0
    if (form.paymentMethod === 'JazzCash/EasyPaisa' && advanceAmount > 0 && !bankTransferProofBase64) {
      newErrors.bankTransferProof = `Please upload a screenshot of your advance payment of PKR ${advanceAmount.toLocaleString()}.`;
    }

    if (!isMinimumOrderMet) {
      newErrors.minimumOrder = `Minimum order value is PKR ${MINIMUM_ORDER_VALUE.toLocaleString()}. Add PKR ${remainingAmount.toLocaleString()} more to proceed.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const placeOrder = async () => {
    if (!validateForm()) {
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementsByName(firstErrorField)[0] || document.getElementById(firstErrorField);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);
    setStockValidationErrors([]);

    const orderId = 'BUYNOW_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const orderItems = cartItems.map(item => ({
      productId: item.productId || item.id.replace('temp_', ''),
      title: item.title,
      quantity: item.quantity || 1,
      price: item.price,
      image: item.image || item.coverImage,
      variation: item.variation || null,
      type: item.type || null,
      size: item.size || null,
      lining: item.lining || false,
    }));

    const stockResult = await validateAndReduceStock(orderItems);
    if (!stockResult.success) {
      setStockValidationErrors(stockResult.errors);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const order = {
      orderId,
      customerType: 'guest',
      customerEmail: form.email,
      items: orderItems,
      shipping: form.shippingMethod,
      payment: form.paymentMethod,
      shippingAddress: {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        region: form.region,
        country: form.country,
        customerInstagram: form.instagram || null,
      },
      promoCode: form.promoCode,
      notes: form.notes,
      subtotal,
      shippingCost,
      cashOnDeliveryFee,
      total,
      createdAt: new Date(),
      status: 'processing',
      buyNow: true,
      stockReducedAtOrderPlacement: true,
      // Store split payment details for JazzCash/EasyPaisa
      advanceAmount: form.paymentMethod === 'JazzCash/EasyPaisa' ? advanceAmount : null,
      doorstepAmount: form.paymentMethod === 'JazzCash/EasyPaisa' ? doorstepAmount : null,
      bankTransferProofBase64: form.paymentMethod === 'JazzCash/EasyPaisa' ? bankTransferProofBase64 : null,
    };

    try {
      await addDoc(collection(db, 'orders'), order);
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.setItem('lastOrderId', orderId);
      sessionStorage.setItem('lastOrderEmail', form.email);
      sessionStorage.setItem('lastOrderType', 'buyNow');
      navigate('/thanks');
    } catch (err) {
      console.error("Error placing order:", err);
      if (err.code === 'resource-exhausted' || (err.message && err.message.includes('too large'))) {
        alert('Error: The uploaded image is too large. Please try a smaller image or contact support.');
      } else {
        alert('Error placing order. Please try again. If the issue persists, contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!product && cartItems.length === 0) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#fceadc] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-4">Loading Product...</h2>
            <p className="text-gray-600 mb-6">Please wait while we load your product details.</p>
            <button onClick={() => navigate('/')} className="w-full bg-black text-white py-3 rounded-md font-medium hover:bg-gray-800 transition">
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#fefaf9] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <nav className="flex mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm sm:text-base">
              <li><a href="/" className="text-gray-500 hover:text-gray-700">Home</a></li>
              <li><span className="text-gray-400">/</span></li>
              <li><span className="text-black font-medium">Buy Now Checkout</span></li>
            </ol>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Buy Now Checkout</h1>

          {stockValidationErrors.length > 0 && (
            <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-red-800 font-medium">Stock Availability Issues</h3>
                  <ul className="list-disc list-inside mt-2">
                    {stockValidationErrors.map((error, index) => <li key={index} className="text-red-700 text-sm">{error}</li>)}
                  </ul>
                  <button onClick={() => navigate('/')} className="mt-3 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition">
                    Continue Shopping
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isMinimumOrderMet && (
            <div className="mb-6 p-4 border border-orange-300 bg-orange-50 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-orange-800 font-medium">Minimum Order Required</h3>
                  <p className="text-orange-700 text-sm">Minimum order value is PKR {MINIMUM_ORDER_VALUE.toLocaleString()}. Add PKR {remainingAmount.toLocaleString()} more to proceed.</p>
                </div>
              </div>
              <button onClick={() => navigate('/')} className="mt-3 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition">
                Continue Shopping
              </button>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column – Form */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Contact Information</h2>
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter your email address"
                  className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`} />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Shipping Address</h2>
              <div className="grid gap-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name*</label>
                  <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
                  <input id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="e.g., 03001234567"
                    className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Street Address*</label>
                  <input id="address" name="address" value={form.address} onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.address ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                  {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                    <input id="city" name="city" value={form.city} onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                    {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.postalCode ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                    {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Province/Region*</label>
                    <input id="region" name="region" value={form.region} onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.region ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                    {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region}</p>}
                  </div>
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country*</label>
                    <select id="country" name="country" value={form.country} onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.country ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`}>
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
                  <input type="radio" name="shippingMethod" value="Standard Delivery" checked={form.shippingMethod === 'Standard Delivery'} onChange={handleChange} className="h-4 w-4 text-black focus:ring-black" />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Standard Delivery</p>
                    <p className="text-xs sm:text-sm text-gray-500">PKR 250 for Karachi and 350 for other cities - Delivery in 8-10 business days</p>
                  </div>
                </label>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-6 pb-2 border-b">Payment Method</h2>
              <div className="space-y-4">
                {['Cash on Delivery', 'JazzCash/EasyPaisa'].map(method => (
                  <label key={method} className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                    <input type="radio" name="paymentMethod" value={method} checked={form.paymentMethod === method} onChange={handleChange} className="h-4 w-4 text-black focus:ring-black" />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900 text-sm sm:text-base">{method}</span>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {method === 'Cash on Delivery' ? 'Pay when your order is delivered' : 'Split payment: advance online + cash on doorstep'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {form.paymentMethod === 'JazzCash/EasyPaisa' && (
                <div className="mt-6 p-4 border border-blue-300 bg-blue-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Split Payment – JazzCash/EasyPaisa</h3>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    <strong>Advance payment:</strong> PKR {advanceAmount.toLocaleString()} (total - 500)<br />
                    <strong>Remaining (pay on doorstep):</strong> PKR {doorstepAmount.toLocaleString()}
                  </p>
                  <p className="text-gray-700 mb-2 text-sm sm:text-base">
                    Please transfer the advance amount of <strong>PKR {advanceAmount.toLocaleString()}</strong> to:
                  </p>
                  <ul className="list-disc list-inside text-gray-800 text-sm sm:text-base mb-4">
                    <li><strong>Account Name:</strong> Muzaffar uddin Ahmed</li>
                    <li><strong>JazzCash/EasyPaisa Number:</strong> 0333 0258436</li>
                  </ul>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    After completing the advance transfer, upload a screenshot / receipt as proof. The remaining PKR {doorstepAmount.toLocaleString()} will be collected in cash when your order is delivered.
                  </p>
                  <div>
                    <label htmlFor="bankTransferProof" className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Advance Payment Proof*
                    </label>
                    <input id="bankTransferProof" type="file" accept="image/*" onChange={handleFileChange}
                      className={`w-full px-4 py-2 border ${errors.bankTransferProof ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black`} />
                    {errors.bankTransferProof && <p className="mt-1 text-sm text-red-600">{errors.bankTransferProof}</p>}
                    {bankTransferProofBase64 && <p className="mt-2 text-sm text-green-600">✓ Proof uploaded.</p>}
                    {convertingImage && <p className="mt-2 text-sm text-gray-600 flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Converting image...
                    </p>}
                  </div>
                </div>
              )}

              {form.paymentMethod === 'Cash on Delivery' && (
                <div className="mt-6 p-4 border border-green-300 bg-green-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Cash on Delivery</h3>
                  <p className="text-gray-700 text-sm sm:text-base mb-2">You will pay the full amount PKR {total.toLocaleString()} when your order is delivered.</p>
                  <p className="text-gray-600 text-sm">Please have the exact amount ready.</p>
                </div>
              )}

              <div className="mt-6">
                <label htmlFor="promoCode" className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <div className="flex">
                  <input id="promoCode" name="promoCode" value={form.promoCode} onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:ring-black focus:border-black" placeholder="Enter promo code" />
                  <button type="button" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-r-md hover:bg-gray-300 transition">Apply</button>
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Order Notes (Optional)</label>
                <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-black focus:border-black" placeholder="Special instructions, delivery notes, etc." />
              </div>
            </div>

            {/* Right Column – Order Summary */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm h-fit lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {cartItems.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex gap-4 mb-2 sm:mb-0">
                      <img src={item.image || item.coverImage} alt={item.title} className="w-16 h-20 sm:w-20 sm:h-25 object-top rounded" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{item.title}</p>
                        {item.variation && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-gray-500">Color:</span>
                            <span className="text-xs font-medium text-gray-700">{item.variation}</span>
                          </div>
                        )}
                        <p className="text-xs sm:text-sm text-gray-500">{item.type && `${item.type} |`} {item.size} {item.lining ? '| Lining' : ''}</p>
                        <p className="text-xs sm:text-sm text-gray-500">Qty: {item.quantity || 1}</p>
                      </div>
                    </div>
                    <p className="font-medium text-sm sm:text-base">PKR {(item.price * (item.quantity || 1)).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between"><span className="text-sm text-gray-600">Subtotal</span><span>PKR {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-600">Shipping</span><span>PKR {shippingCost.toLocaleString()}</span></div>
                {form.promoCode && <div className="flex justify-between"><span className="text-sm text-gray-600">Discount</span><span className="text-green-600">-PKR 0</span></div>}
              </div>

              <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="font-medium text-base sm:text-lg">Total</span>
                <span className="font-bold text-base sm:text-lg">PKR {total.toLocaleString()}</span>
              </div>

              {form.paymentMethod === 'JazzCash/EasyPaisa' && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <p><strong>Split payment breakdown:</strong></p>
                  <p>🔹 Advance via JazzCash/EasyPaisa: <strong>PKR {advanceAmount.toLocaleString()}</strong></p>
                  <p>🔹 Cash on doorstep: <strong>PKR {doorstepAmount.toLocaleString()}</strong></p>
                </div>
              )}

              {errors.minimumOrder && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600 text-sm">{errors.minimumOrder}</p>
                </div>
              )}

              <button
                onClick={placeOrder}
                disabled={loading || cartItems.length === 0 || convertingImage || !isMinimumOrderMet || (form.paymentMethod === 'JazzCash/EasyPaisa' && advanceAmount > 0 && !bankTransferProofBase64)}
                className={`mt-6 w-full py-3 px-4 rounded-md font-medium text-white ${
                  loading || cartItems.length === 0 || convertingImage || !isMinimumOrderMet || (form.paymentMethod === 'JazzCash/EasyPaisa' && advanceAmount > 0 && !bankTransferProofBase64)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-black hover:bg-gray-800'
                } transition text-base`}
              >
                {loading || convertingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {convertingImage ? 'Converting Image...' : 'Processing Order...'}
                  </span>
                ) : cartItems.length === 0 ? 'No Items to Order'
                : !isMinimumOrderMet ? `Add PKR ${remainingAmount.toLocaleString()} More`
                : (form.paymentMethod === 'JazzCash/EasyPaisa' && advanceAmount > 0 && !bankTransferProofBase64) ? 'Upload advance payment proof'
                : 'Place Order Now'}
              </button>

              <div className="mt-6 text-center text-xs sm:text-sm text-gray-500">
                <p>100% secure checkout</p>
                {!isMinimumOrderMet && <p className="text-orange-600 mt-2">Minimum order: PKR {MINIMUM_ORDER_VALUE.toLocaleString()}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BuyNowCheckout;