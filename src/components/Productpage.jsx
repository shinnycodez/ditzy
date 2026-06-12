import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

import Header from './Header';
import ProductImageGrid from './ProductImageGrid';
import ProductInfo from './ProductInfo';
import QuantitySelector from './QuantitySelector';

const ProductPage = ({ onOpenCart }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [activeDiscount, setActiveDiscount] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch discounts from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "discounts"), (snapshot) => {
      const discountsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDiscounts(discountsData);
    });
    return () => unsubscribe();
  }, []);

  // Helper function to check if discount is currently active
  const isDiscountActive = (discount) => {
    if (!discount.isActive) return false;
    const now = new Date();
    const startDate = discount.startDate?.toDate ? discount.startDate.toDate() : new Date(discount.startDate);
    const endDate = discount.endDate?.toDate ? discount.endDate.toDate() : new Date(discount.endDate);
    return now >= startDate && now <= endDate;
  };

  // Check for active discount when product or discounts change
  useEffect(() => {
    if (product && discounts.length > 0) {
      const currentActiveDiscount = discounts.find(discount => 
        discount.productIds.includes(product.id) && isDiscountActive(discount)
      );
      setActiveDiscount(currentActiveDiscount || null);
    } else {
      setActiveDiscount(null);
    }
  }, [product, discounts]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() };
          setProduct(productData);
          // Set the first variation as selected by default if variations exist
          if (productData.variations && productData.variations.length > 0) {
            setSelectedVariation(productData.variations[0]);
          }
          // Set the first size as selected by default if sizes exist
          if (productData.sizes && productData.sizes.length > 0) {
            setSelectedSize(productData.sizes[0]);
          }
        } else {
          console.error('No such product!');
          navigate('/'); // Redirect to home if product not found
        }
      } catch (err) {
        console.error('Error fetching product: ', err);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  // Calculate current stock based on selected variation/size
  const getCurrentStock = () => {
    if (!product) return 0;
    
    return selectedVariation && product.stock && product.stock[selectedVariation] !== undefined 
      ? product.stock[selectedVariation] 
      : selectedSize && product.stock && product.stock[selectedSize] !== undefined 
        ? product.stock[selectedSize] 
        : product.defaultStock || 0;
  };

  // Check if item is out of stock
  const isOutOfStock = () => {
    return getCurrentStock() === 0;
  };

  // Calculate discounted price
  const getDiscountedPrice = () => {
    if (!activeDiscount) return product.price;
    return Math.round(product.price * (1 - activeDiscount.discountPercentage / 100));
  };

  // Get the price to use for cart operations
  const getCurrentPrice = () => {
    return activeDiscount ? getDiscountedPrice() : product.price;
  };

  // Save cart to storage (consistent with cart component and checkout)
  const saveCartToStorage = (cartData) => {
    try {
      const cartJson = JSON.stringify(cartData);
      localStorage.setItem('cartItems', cartJson);
      sessionStorage.setItem('cartItems', cartJson);
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  // Load cart from storage
  const loadCartFromStorage = () => {
    try {
      const storedCart = localStorage.getItem('cartItems') || sessionStorage.getItem('cartItems');
      return storedCart ? JSON.parse(storedCart) : [];
    } catch (error) {
      console.error('Error loading cart from storage:', error);
      return [];
    }
  };

  const handleAddToCart = async () => {
    if (loading || !product.available || isOutOfStock()) return;
    
    const currentStock = getCurrentStock();
    
    if (quantity > currentStock) {
      alert(`⚠️ Only ${currentStock} item${currentStock === 1 ? '' : 's'} available in stock!`);
      return;
    }
    
    setLoading(true);

    // Create a unique identifier that includes both variation and size if they exist
    const variationPart = selectedVariation ? `_${selectedVariation}` : '';
    const sizePart = selectedSize ? `_${selectedSize}` : '';
    const itemId = `${product.id}${variationPart}${sizePart}_${Date.now()}`;

    const cartItem = {
      id: itemId,
      productId: product.id,
      title: product.title,
      price: getCurrentPrice(), // Use discounted price if available
      originalPrice: product.price, // Store original price for reference
      image: product.coverImage,
      quantity,
      variation: selectedVariation, // Include the selected color variation
      size: selectedSize, // Include the selected size
      discountApplied: activeDiscount ? activeDiscount.discountPercentage : null,
      createdAt: new Date().toISOString(),
      // Add stock information for reference
      maxStock: currentStock,
      stockType: selectedVariation ? 'variation' : selectedSize ? 'size' : 'default'
    };

    try {
      // Load current cart
      let currentCart = loadCartFromStorage();

      // Check if item with same configuration already exists
      const existingIndex = currentCart.findIndex(item =>
        item.productId === cartItem.productId && 
        item.variation === cartItem.variation &&
        item.size === cartItem.size
      );

      if (existingIndex !== -1) {
        // Check if adding more would exceed available stock
        const newTotalQuantity = currentCart[existingIndex].quantity + quantity;
        if (newTotalQuantity > currentStock) {
          alert(`⚠️ Cannot add more items. You already have ${currentCart[existingIndex].quantity} in cart, only ${currentStock} available total.`);
          setLoading(false);
          return;
        }
        
        // Update quantity of existing item
        currentCart[existingIndex].quantity = newTotalQuantity;
        currentCart[existingIndex].maxStock = currentStock; // Update stock reference
      } else {
        // Add new item to cart
        currentCart.push(cartItem);
      }

      // Save updated cart
      saveCartToStorage(currentCart);

      // Show success message
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);

      // Open cart if callback provided
      if (onOpenCart) onOpenCart();

    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('❌ Error adding item to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (loading || !product.available || isOutOfStock()) return;

    const currentStock = getCurrentStock();
    
    if (quantity > currentStock) {
      alert(`⚠️ Only ${currentStock} item${currentStock === 1 ? '' : 's'} available in stock!`);
      return;
    }

    const buyNowItem = {
      id: product.id,
      productId: product.id,
      title: product.title,
      price: getCurrentPrice(), // Use discounted price if available
      originalPrice: product.price, // Store original price for reference
      image: product.coverImage,
      quantity,
      variation: selectedVariation, // Include the selected color variation
      size: selectedSize, // Include the selected size
      discountApplied: activeDiscount ? activeDiscount.discountPercentage : null,
      createdAt: new Date().toISOString(),
    };

    try {
      // Store buy now item for checkout
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      navigate('/buynowcheckout');
    } catch (error) {
      console.error('Error storing buy now item:', error);
      alert('Error processing buy now. Please try again.');
    }
  };

  if (!product) return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">Loading product...</p>
      </div>
    </div>
  );

  const allImages = product.images
    ? [product.coverImage, ...product.images]
    : [product.coverImage];

  const discountedPrice = getDiscountedPrice();
  const savings = product.price - discountedPrice;
  const currentStock = getCurrentStock();
  const outOfStock = isOutOfStock();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FFFFFF] overflow-x-hidden">
      {showSuccess && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[100]">
          <div className="flex items-center gap-3 bg-green-100 border border-green-300 text-green-800 px-5 py-2 rounded-xl shadow-lg animate-fade-in-out transition-all">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Added to cart successfully!</span>
          </div>
        </div>
      )}

      <Header />
      <div className="layout-container flex h-full grow flex-col bg-[#FFFFFF]">
        <div className="gap-1 px-6 flex flex-1 justify-center py-5 flex-col md:flex-row">
          <div className="flex flex-col max-w-[920px] flex-1">
            <div className="flex w-full grow p-4 relative">
              {/* Discount Badge */}
              {activeDiscount && (
                <div className="absolute top-6 left-6 z-10">
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    -{activeDiscount.discountPercentage}% OFF
                  </div>
                  {activeDiscount.description && (
                    <div className="bg-black text-white px-2 py-1 rounded text-xs mt-1 text-center">
                      {activeDiscount.description}
                    </div>
                  )}
                </div>
              )}
              <ProductImageGrid images={allImages} />
            </div>
          </div>

          <div className="flex flex-col w-full md:w-[360px]">
            {/* Product Info with Discount Pricing */}
            <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-[#ff9f00] mb-2 font-['Didot','Bodoni_MT','Didot_LT_Std','Georgia',serif]">{product.title}</h1>
              
              {/* Price Display with Discount */}
              <div className="mb-4">
                {activeDiscount ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-green-600">
                        PKR {discountedPrice.toLocaleString()}
                      </span>
                      <span className="text-lg text-gray-500 line-through">
                        PKR {product.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-medium">
                        {activeDiscount.discountPercentage}% OFF
                      </span>
                      <span className="text-green-600 text-sm font-medium">
                        You save PKR {savings.toLocaleString()}
                      </span>
                    </div>
                    {activeDiscount.description && (
                      <p className="text-sm text-blue-600 font-medium">
                        🎯 {activeDiscount.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-[#ff9f00]">
                    PKR {product.price.toLocaleString()}
                  </span>
                )}
              </div>

              <p className="text-gray-600 mb-4">{product.description}</p>
              
              {product.packageInfo && (
                <p className="text-sm text-gray-500 mb-3">Package: {product.packageInfo}</p>
              )}
            </div>
            
            {/* Availability Display */}
            <div className="px-4 py-2">
              {outOfStock ? (
                <p className="text-red-600 font-medium">❌ Out of Stock</p>
              ) : (
                <p className="text-green-600 font-medium">✅ In Stock</p>
              )}
            </div>

            {/* Stock Information Display */}
            {!outOfStock && (
              <div className="px-4 py-2">
                <p className="text-sm text-gray-600">
                  {selectedVariation && product.stock && product.stock[selectedVariation] !== undefined 
                    ? `Stock (${selectedVariation}): ${currentStock} available`
                    : selectedSize && product.stock && product.stock[selectedSize] !== undefined 
                      ? `Stock (${selectedSize}): ${currentStock} available`
                      : `Stock: ${currentStock} available`
                  }
                </p>
                
                {/* Low stock warning */}
                {currentStock > 0 && currentStock <= 5 && (
                  <p className="text-sm text-orange-600 font-medium mt-1">
                    ⚠️ Low stock! Only {currentStock} left
                  </p>
                )}
              </div>
            )}

            {/* Color Variations Selector with Stock */}
            {product.variations && product.variations.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Color:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variations.map((variation) => {
                    const variationStock = product.stock && product.stock[variation] !== undefined 
                      ? product.stock[variation] 
                      : product.defaultStock || 0;
                    
                    return (
                      <button
                        key={variation}
                        type="button"
                        onClick={() => setSelectedVariation(variation)}
                        disabled={variationStock === 0}
                        className={`px-3 py-1 rounded-full text-sm border ${
                          selectedVariation === variation
                            ? 'bg-black text-white border-black'
                            : variationStock === 0
                              ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                        } transition-colors duration-200 relative`}
                        title={variationStock === 0 ? 'Out of stock' : `${variationStock} available`}
                      >
                        {variation}
                        {variationStock === 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Variations Selector with Stock */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Size:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => {
                    const sizeStock = product.stock && product.stock[size] !== undefined 
                      ? product.stock[size] 
                      : product.defaultStock || 0;
                    
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        disabled={sizeStock === 0}
                        className={`px-3 py-1 rounded-full text-sm border min-w-[40px] ${
                          selectedSize === size
                            ? 'bg-green-600 text-white border-green-600'
                            : sizeStock === 0
                              ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                              : 'bg-white text-gray-800 border-gray-300 hover:border-green-400'
                        } transition-colors duration-200 relative`}
                        title={sizeStock === 0 ? 'Out of stock' : `${sizeStock} available`}
                      >
                        {size}
                        {sizeStock === 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <QuantitySelector 
              quantity={quantity} 
              setQuantity={setQuantity}
              maxQuantity={outOfStock ? 0 : currentStock}
            />

            {/* Discount Timer (if discount is active) */}
            {activeDiscount && !outOfStock && (
              <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-600 font-bold text-sm">🔥 LIMITED TIME OFFER</span>
                </div>
                <p className="text-xs text-red-700">
                  Offer ends: {(activeDiscount.endDate?.toDate ? activeDiscount.endDate.toDate() : new Date(activeDiscount.endDate)).toLocaleDateString()} at {(activeDiscount.endDate?.toDate ? activeDiscount.endDate.toDate() : new Date(activeDiscount.endDate)).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 p-4">
              <button
                onClick={handleAddToCart}
                disabled={loading || outOfStock || !product.available}
                className={`w-full border-2 py-3 px-4 rounded-xl font-medium text-base transition-colors ${
                  !loading && !outOfStock && product.available
                    ? 'border-black text-black hover:bg-gray-100'
                    : 'border-gray-400 text-gray-400 cursor-not-allowed bg-gray-100'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : outOfStock ? (
                  'Out of Stock'
                ) : activeDiscount ? (
                  `Add to Cart - PKR ${getCurrentPrice().toLocaleString()}`
                ) : (
                  'Add to Cart'
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={loading || outOfStock || !product.available}
                className={`w-full py-3 px-4 rounded-xl font-medium text-base transition-colors ${
                  !loading && !outOfStock && product.available
                    ? 'bg-[#ff9f00] text-white hover:bg-[#FF6A1C]'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {outOfStock ? 'Out of Stock' : activeDiscount ? `Buy Now - PKR ${getCurrentPrice().toLocaleString()}` : 'Buy Now'}
              </button>

              {/* Savings highlight */}
              {activeDiscount && !outOfStock && (
                <div className="text-center p-2 bg-green-100 rounded-lg">
                  <p className="text-green-700 font-medium text-sm">
                    💰 You're saving PKR {(savings * quantity).toLocaleString()} on this purchase!
                  </p>
                </div>
              )}
            </div>

            {/* Additional Product Details */}
            {product.details && (
              <div className="px-4 py-2 border-t mt-4">
                <h3 className="font-medium text-gray-900 mb-2">Product Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  {Object.entries(product.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;