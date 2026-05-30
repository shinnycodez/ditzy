import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import Header from "./Header";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function AdminPortal() {
  const [salesByMonth, setSalesByMonth] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [totalSales, setTotalSales] = useState({ day: 0, month: 0, year: 0 });
  const [searchTerm, setSearchTerm] = useState('');

const [formData, setFormData] = useState({
  title: "",
  price: "",
  category: "",
  description: "",
  coverImage: "",
  image1: "",
  image2: "",
  isTopProduct: false,
  available: true,
  variationInput: "",
  variations: [],
  sizeInput: "",
  sizes: [],
  // Add stock management fields
  stock: {}, // Object to track stock by variation/size
  defaultStock: 0, // Default stock for products without variations
});

  // New discount-related state
  const [discountFormData, setDiscountFormData] = useState({
    productIds: [],
    discountPercentage: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]); // New state for contacts
  const [discounts, setDiscounts] = useState([]); // New state for discounts
  const [loading, setLoading] = useState(false);
  const [discountLoading, setDiscountLoading] = useState(false); // New loading state for discounts
  const [successMsg, setSuccessMsg] = useState("");
  const [discountSuccessMsg, setDiscountSuccessMsg] = useState(""); // New success message for discounts
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showContacts, setShowContacts] = useState(false); // New state for contacts visibility
  const [showDiscounts, setShowDiscounts] = useState(false); // New state for discounts visibility
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedContacts, setExpandedContacts] = useState({}); // New state for expanded contacts
  const [viewingImage, setViewingImage] = useState(null); // State for image viewer

  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in title
    if (product.title?.toLowerCase().includes(searchLower)) return true;
    
    // Search in category
    if (product.category?.toLowerCase().includes(searchLower)) return true;
    
    // Search in variations/colors
    if (product.variations?.some(variation => 
      variation.toLowerCase().includes(searchLower)
    )) return true;
    
    // Search in sizes
    if (product.sizes?.some(size => 
      size.toLowerCase().includes(searchLower)
    )) return true;
    
    // Search in stock keys
    if (product.stock && Object.keys(product.stock).some(key => 
      key.toLowerCase().includes(searchLower)
    )) return true;
    
    return false;
  });
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // New useEffect for discounts
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "discounts"), (snapshot) => {
      const discountsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by creation date (newest first)
      discountsData.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return bTime - aTime;
      });
      setDiscounts(discountsData);
    });
    return () => unsubscribe();
  }, []);

  // New useEffect for contacts
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "contacts"), (snapshot) => {
      const contactsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by timestamp (newest first)
      contactsData.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return bTime - aTime;
      });
      setContacts(contactsData);
    });
    return () => unsubscribe();
  }, []);
const deleteOrder = async (orderId) => {
  if (confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "orders", orderId));
      console.log(`Order ${orderId} deleted successfully.`);
    } catch (err) {
      console.error("Failed to delete order:", err);
    }
  }
};
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      let dayTotal = 0;
      let monthTotal = 0;
      let yearTotal = 0;
      const monthMap = {};
      const productMap = {};

      ordersData.forEach(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : new Date());
        const total = order.total || 0;

        if (orderDate >= startOfDay) dayTotal += total;
        if (orderDate >= startOfMonth) monthTotal += total;
        if (orderDate >= startOfYear) yearTotal += total;

        const month = orderDate.toLocaleString('default', { month: 'short' });
        monthMap[month] = (monthMap[month] || 0) + total;

        (order.items || []).forEach(item => {
          const itemId = item.productId || `${item.title}-${item.type}-${item.size}`;
          if (!productMap[itemId]) {
            productMap[itemId] = {
              title: item.title,
              totalQty: 0,
              totalSales: 0
            };
          }
          productMap[itemId].totalQty += item.quantity;
          productMap[itemId].totalSales += item.price * item.quantity;
        });
      });

      setTotalSales({
        day: dayTotal,
        month: monthTotal,
        year: yearTotal
      });

      setSalesByMonth(
        Object.keys(monthMap).map(month => ({
          month,
          total: monthMap[month]
        }))
      );

      const sortedProductSales = Object.values(productMap).sort((a, b) => b.totalSales - a.totalSales);
      setProductSales(sortedProductSales);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // New handler for discount form changes
  const handleDiscountChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDiscountFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // New handler for product selection in discount form
  const handleProductSelection = (productId, isSelected) => {
    setDiscountFormData((prev) => ({
      ...prev,
      productIds: isSelected
        ? [...prev.productIds, productId]
        : prev.productIds.filter(id => id !== productId),
    }));
  };

  // New function to handle discount submission
  const handleDiscountSubmit = async (e) => {
    e.preventDefault();
    setDiscountLoading(true);
    setDiscountSuccessMsg("");

    try {
      if (!discountFormData.productIds.length) {
        setDiscountSuccessMsg("❌ Please select at least one product.");
        setDiscountLoading(false);
        return;
      }

      if (!discountFormData.discountPercentage || discountFormData.discountPercentage <= 0 || discountFormData.discountPercentage > 100) {
        setDiscountSuccessMsg("❌ Please enter a valid discount percentage (1-100).");
        setDiscountLoading(false);
        return;
      }

      const startDate = new Date(discountFormData.startDate);
      const endDate = new Date(discountFormData.endDate);

      if (startDate >= endDate) {
        setDiscountSuccessMsg("❌ End date must be after start date.");
        setDiscountLoading(false);
        return;
      }

      // Create discount document
      await addDoc(collection(db, "discounts"), {
        productIds: discountFormData.productIds,
        discountPercentage: parseFloat(discountFormData.discountPercentage),
        startDate: startDate,
        endDate: endDate,
        description: discountFormData.description,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setDiscountSuccessMsg("✅ Discount created successfully!");
      setDiscountFormData({
        productIds: [],
        discountPercentage: "",
        startDate: "",
        endDate: "",
        description: "",
      });
    } catch (err) {
      console.error("Error creating discount:", err);
      setDiscountSuccessMsg("❌ Failed to create discount.");
    }

    setDiscountLoading(false);
  };

  // New function to delete discount
  const deleteDiscount = async (discountId) => {
    if (confirm("Are you sure you want to delete this discount? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "discounts", discountId));
        console.log(`Discount ${discountId} deleted successfully.`);
      } catch (err) {
        console.error("Failed to delete discount:", err);
      }
    }
  };

  // New function to toggle discount status
  const toggleDiscountStatus = async (discountId, currentStatus) => {
    try {
      const discountRef = doc(db, "discounts", discountId);
      await updateDoc(discountRef, {
        isActive: !currentStatus,
      });
      console.log(`Discount ${discountId} status updated.`);
    } catch (err) {
      console.error("Failed to update discount status:", err);
    }
  };

  // Helper function to check if discount is currently valid
  const isDiscountActive = (discount) => {
    if (!discount.isActive) return false;
    const now = new Date();
    const startDate = discount.startDate?.toDate ? discount.startDate.toDate() : new Date(discount.startDate);
    const endDate = discount.endDate?.toDate ? discount.endDate.toDate() : new Date(discount.endDate);
    return now >= startDate && now <= endDate;
  };

  // Helper function to get discount status text
  const getDiscountStatusText = (discount) => {
    if (!discount.isActive) return { text: "Disabled", color: "text-gray-600" };
    
    const now = new Date();
    const startDate = discount.startDate?.toDate ? discount.startDate.toDate() : new Date(discount.startDate);
    const endDate = discount.endDate?.toDate ? discount.endDate.toDate() : new Date(discount.endDate);
    
    if (now < startDate) return { text: "Scheduled", color: "text-blue-600" };
    if (now > endDate) return { text: "Expired", color: "text-red-600" };
    return { text: "Active", color: "text-green-600" };
  };

const markAsDelivered = async (orderId) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderDoc = await getDoc(orderRef);
    const order = orderDoc.data();
    
    // Check if stock was already reduced at order placement
    if (!order.stockReducedAtOrderPlacement) {
      // Only deduct stock if it wasn't already reduced
      for (const item of order.items || []) {
        const productRef = doc(db, "products", item.productId);
        const productDoc = await getDoc(productRef);
        const product = productDoc.data();
        
        if (product) {
          let updateData = {};
          const quantity = item.quantity || 1;
          
          // Deduct stock based on variation/size
          if (item.variation && product.stock && product.stock[item.variation] !== undefined) {
            const newStock = Math.max(0, (product.stock[item.variation] || 0) - quantity);
            updateData[`stock.${item.variation}`] = newStock;
          } 
          else if (item.size && product.stock && product.stock[item.size] !== undefined) {
            const newStock = Math.max(0, (product.stock[item.size] || 0) - quantity);
            updateData[`stock.${item.size}`] = newStock;
          }
          else {
            // Deduct from default stock
            const newDefaultStock = Math.max(0, (product.defaultStock || 0) - quantity);
            updateData.defaultStock = newDefaultStock;
          }
          
          // Update product stock
          await updateDoc(productRef, updateData);
        }
      }
    }
    
    // Mark order as delivered
    await updateDoc(orderRef, {
      status: "delivered",
      bankTransferProofBase64: null,
    });
    
    console.log(`Order ${orderId} marked as delivered.`);
  } catch (err) {
    console.error("Failed to mark as delivered:", err);
  }
};
  // New function to delete contact
  const deleteContact = async (contactId) => {
    if (confirm("Are you sure you want to delete this contact message? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "contacts", contactId));
        console.log(`Contact ${contactId} deleted successfully.`);
      } catch (err) {
        console.error("Failed to delete contact:", err);
      }
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setSuccessMsg("");

  try {
    const productData = {
      title: formData.title,
      price: parseFloat(formData.price),
      category: formData.category,
      description: formData.description,
      coverImage: formData.coverImage,
      images: [formData.image1, formData.image2],
      isTopProduct: formData.isTopProduct,
      available: formData.available,
      variations: formData.variations,
      sizes: formData.sizes,
      // Add stock data
      stock: formData.stock,
      defaultStock: parseInt(formData.defaultStock) || 0,
    };

    if (editId) {
      await updateDoc(doc(db, "products", editId), productData);
      setSuccessMsg("✅ Product updated successfully!");
      setEditId(null);
    } else {
      await addDoc(collection(db, "products"), {
        ...productData,
        createdAt: serverTimestamp(),
      });
      setSuccessMsg("✅ Product added successfully!");
    }

    // Reset form (keep the stock reset)
    setFormData({
      title: "",
      price: "",
      category: "",
      description: "",
      coverImage: "",
      image1: "",
      image2: "",
      isTopProduct: false,
      available: true,
      variations: [],
      variationInput: "",
      sizes: [],
      sizeInput: "",
      stock: {},
      defaultStock: 0,
    });
  } catch (err) {
    console.error("Error:", err);
    setSuccessMsg("❌ Failed to submit.");
  }

  setLoading(false);
};

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };
const handleEdit = (product) => {
  setFormData({
    title: product.title,
    price: product.price,
    category: product.category,
    description: product.description,
    coverImage: product.coverImage,
    image1: product.images?.[0] || "",
    image2: product.images?.[1] || "",
    isTopProduct: product.isTopProduct || false,
    available: product.available !== false,
    variations: product.variations || [], // Color variations
    variationInput: "",
    sizes: product.sizes || [], // Size variations
    sizeInput: "",
    // Add stock fields
    stock: product.stock || {}, // Stock by variation/size
    defaultStock: product.defaultStock || 0, // Default stock
  });
  setEditId(product.id);
  setShowForm(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // New function to toggle contact expansion
  const toggleContactExpand = (contactId) => {
    setExpandedContacts((prev) => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };

  // Image Viewer Modal Component
  const ImageViewer = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="relative bg-white rounded-lg p-2 max-w-full max-h-[90vh] overflow-hidden flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-800 hover:text-gray-600 text-3xl font-bold p-1 rounded-full bg-gray-200"
            aria-label="Close"
          >
          &times;
          </button>
          <img
            src={imageUrl}
            alt="Bank Transfer Proof"
            className="max-w-full max-h-[80vh] object-contain rounded-md"
          />
        </div>
      </div>
    );
  };

const OrderDetails = ({ order }) => (
  <div className="mt-4 space-y-3 text-sm text-gray-700 p-2 border-t border-gray-200 pt-3">
    <p><strong>Status:</strong> <span className={`font-semibold ${order.status === 'delivered' ? 'text-green-600' : 'text-orange-600'}`}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></p>
    <p><strong>Payment Method:</strong> {order.payment}</p>
    {order.payment === 'JazzCash/EasyPaisa' && order.bankTransferProofBase64 && (
      <div className="mt-2">
        <strong>Bank Transfer Proof:</strong>
        <div
          className="mt-1 border border-gray-300 p-2 rounded max-w-full sm:max-w-xs overflow-hidden cursor-pointer hover:border-blue-500 transition-colors duration-200"
          onClick={() => setViewingImage(order.bankTransferProofBase64)}
        >
          <img
            src={order.bankTransferProofBase64}
            alt="Bank Transfer Proof"
            className="w-full h-auto object-contain max-h-64 sm:max-h-80"
          />
          <p className="text-center text-xs text-gray-500 mt-1">Click to enlarge</p>
        </div>
      </div>
    )}
    <p><strong>Shipping Method:</strong> {order.shipping}</p>
    <p><strong>Promo Code:</strong> {order.promoCode || "None"}</p>
    <p><strong>Notes:</strong> {order.notes || "None"}</p>
    <p>
      <strong>Order Time:</strong>{" "}
      {order.createdAt?.toDate?.().toLocaleString() || "Unknown"}
    </p>

    <div>
      <strong>Shipping Address:</strong>
      <div className="ml-0 sm:ml-4 text-xs sm:text-sm">
        <p>{order.shippingAddress?.fullName}</p>
        <p>{order.shippingAddress?.address}</p>
        <p>{order.shippingAddress?.city}, {order.shippingAddress?.region}</p>
        <p>{order.shippingAddress?.country}, {order.shippingAddress?.postalCode}</p>
        <p>Phone: {order.shippingAddress?.phone}</p>
       <p>Instagram: {order.shippingAddress?.customerInstagram}</p>
      </div>
    </div>

    <div>
      <strong>Items:</strong>
      <ul className="list-disc ml-4 sm:ml-5 mt-1 text-xs sm:text-sm">
        {(order.items || []).map((item, i) => (
          <li key={i}>
            {item.title} – 
            {item.variation && ` Color: ${item.variation} –`}
            {item.size && ` Size: ${item.size} –`}
            {item.type && ` Type: ${item.type} –`}
            Qty: {item.quantity} – 
            Price: PKR {item.price?.toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

  // New ContactDetails component
  const ContactDetails = ({ contact }) => (
    <div className="mt-4 space-y-3 text-sm text-gray-700 p-4 border-t border-gray-200 pt-3 bg-pink-50 rounded-lg">
      <div>
        <strong>📧 Email:</strong>
        <p className="text-blue-600 hover:text-blue-800">
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </p>
      </div>
      <div>
        <strong>💌 Message:</strong>
        <p className="mt-1 p-3 bg-white border border-pink-200 rounded-md whitespace-pre-wrap">
          {contact.message}
        </p>
      </div>
      <p>
        <strong>🕒 Received:</strong>{" "}
        {contact.timestamp?.toDate?.().toLocaleString() || "Unknown"}
      </p>
    </div>
  );

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 sm:space-y-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        {/* Add Product Form */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showForm ? "➖ Hide Add Product Form" : "➕ Add New Product"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-gray-50 p-4 sm:p-6 mt-4 rounded-lg shadow-inner space-y-4"
            >
              {successMsg && (
                <p className={`text-center text-sm sm:text-base p-2 rounded ${successMsg.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {successMsg}
                </p>
              )}
              <input name="title" placeholder="Product Title" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.title} onChange={handleChange} required />
              <input name="price" placeholder="Price (PKR)" type="number" step="0.01" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.price} onChange={handleChange} required />
              <input name="category" placeholder="Category (e.g., 'Formal', 'Casual')" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.category} onChange={handleChange} required />
              <textarea name="description" placeholder="Product Description" rows="4" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.description} onChange={handleChange} required />
              <input name="coverImage" placeholder="Cover Image URL (e.g., Firebase Storage URL)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.coverImage} onChange={handleChange} required />
              <input name="image1" placeholder="Image 1 URL (Optional)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.image1} onChange={handleChange} />
              <input name="image2" placeholder="Image 2 URL (Optional)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.image2} onChange={handleChange} />

              {/* Color Variations Input */}
              <div>
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">Color Variations (e.g., Red, Blue)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    name="variationInput"
                    value={formData.variationInput}
                    onChange={handleChange}
                    placeholder="Add a color (e.g., Red)"
                    className="flex-1 border border-gray-300 p-2 rounded-md text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.variationInput.trim()) {
                        setFormData((prev) => ({
                          ...prev,
                          variations: [...prev.variations, prev.variationInput.trim()],
                          variationInput: "",
                        }));
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm sm:text-base"
                  >
                    Add
                  </button>
                </div>

                {/* Show list of color variations */}
                {formData.variations && formData.variations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.variations.map((v, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {v}
<button
  type="button"
  onClick={() => {
    const variationToRemove = formData.variations[i];
    const updatedVariations = formData.variations.filter((_, index) => index !== i);
    const updatedStock = { ...formData.stock };
    delete updatedStock[variationToRemove];
    
    setFormData((prev) => ({
      ...prev,
      variations: updatedVariations,
      stock: updatedStock,
    }));
  }}
  className="text-red-500 hover:text-red-700"
>
  &times;
</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
{/* Default Stock Input */}
<div>
  <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
    Default Stock Quantity
  </label>
  <input
    type="number"
    name="defaultStock"
    value={formData.defaultStock}
    onChange={handleChange}
    placeholder="Enter stock quantity"
    min="0"
    className="w-full border border-gray-300 p-2 rounded-md text-sm sm:text-base"
  />
</div>

{/* Stock by Variation (if variations exist) */}
{formData.variations.length > 0 && (
  <div>
    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
      Stock by Color Variation
    </label>
    {formData.variations.map((variation, index) => (
      <div key={index} className="flex items-center gap-2 mb-2">
        <span className="w-20 text-sm">{variation}:</span>
        <input
          type="number"
          value={formData.stock[variation] || 0}
          onChange={(e) => {
            const newStock = { ...formData.stock };
            newStock[variation] = parseInt(e.target.value) || 0;
            setFormData(prev => ({ ...prev, stock: newStock }));
          }}
          placeholder="Qty"
          min="0"
          className="border border-gray-300 p-2 rounded-md text-sm w-20"
        />
      </div>
    ))}
  </div>
)}

{/* Stock by Size (if sizes exist) */}
{formData.sizes.length > 0 && (
  <div>
    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
      Stock by Size
    </label>
    {formData.sizes.map((size, index) => (
      <div key={index} className="flex items-center gap-2 mb-2">
        <span className="w-20 text-sm">{size}:</span>
        <input
          type="number"
          value={formData.stock[size] || 0}
          onChange={(e) => {
            const newStock = { ...formData.stock };
            newStock[size] = parseInt(e.target.value) || 0;
            setFormData(prev => ({ ...prev, stock: newStock }));
          }}
          placeholder="Qty"
          min="0"
          className="border border-gray-300 p-2 rounded-md text-sm w-20"
        />
      </div>
    ))}
  </div>
)}
              {/* Size Variations Input */}
              <div>
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">Size Variations (e.g., S, M, L)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    name="sizeInput"
                    value={formData.sizeInput}
                    onChange={handleChange}
                    placeholder="Add a size (e.g., S, M, L, XL)"
                    className="flex-1 border border-gray-300 p-2 rounded-md text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.sizeInput.trim()) {
                        setFormData((prev) => ({
                          ...prev,
                          sizes: [...prev.sizes, prev.sizeInput.trim()],
                          sizeInput: "",
                        }));
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm sm:text-base"
                  >
                    Add
                  </button>
                </div>

                {/* Show list of size variations */}
                {formData.sizes && formData.sizes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.sizes.map((size, i) => (
                      <span key={i} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {size}
<button
  type="button"
  onClick={() => {
    const sizeToRemove = formData.sizes[i];
    const updatedSizes = formData.sizes.filter((_, index) => index !== i);
    const updatedStock = { ...formData.stock };
    delete updatedStock[sizeToRemove];
    
    setFormData((prev) => ({
      ...prev,
      sizes: updatedSizes,
      stock: updatedStock,
    }));
  }}
  className="text-red-500 hover:text-red-700"
>
  &times;
</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm sm:text-base text-gray-700 cursor-pointer">
                  <input type="checkbox" name="isTopProduct" checked={formData.isTopProduct} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Mark as Top Product
                </label>
                <label className="flex items-center gap-2 text-sm sm:text-base text-gray-700 cursor-pointer">
                  <input type="checkbox" name="available" checked={formData.available} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Product Available
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md transition-colors duration-200 text-base sm:text-lg font-medium disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {loading ? (editId ? "Updating..." : "Adding...") : (editId ? "Update Product" : "Add Product")}
              </button>
            </form>
          )}
        </div>

        {/* Discount Management Section */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowDiscounts(!showDiscounts)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showDiscounts ? "➖ Hide Discount Management" : "🎯 Manage Product Discounts"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showDiscounts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showDiscounts && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner space-y-6">
              {/* Create New Discount Form */}
              <form onSubmit={handleDiscountSubmit} className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border space-y-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">🎯 Create New Discount</h3>
                
                {discountSuccessMsg && (
                  <p className={`text-center text-sm sm:text-base p-2 rounded ${discountSuccessMsg.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {discountSuccessMsg}
                  </p>
                )}

                <div>
                  <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Select Products for Discount:</label>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                    {products.length === 0 ? (
                      <p className="text-gray-500 text-sm">No products available. Add products first.</p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((product) => (
                          <label key={product.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={discountFormData.productIds.includes(product.id)}
                              onChange={(e) => handleProductSelection(product.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <img src={product.coverImage} alt={product.title} className="w-12 h-12 object-cover rounded" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{product.title}</p>
                              <p className="text-xs text-gray-600">PKR {product.price?.toLocaleString()}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {discountFormData.productIds.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">✅ {discountFormData.productIds.length} product(s) selected</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percentage (%)</label>
                    <input
                      type="number"
                      name="discountPercentage"
                      value={discountFormData.discountPercentage}
                      onChange={handleDiscountChange}
                      placeholder="e.g., 20"
                      min="1"
                      max="100"
                      className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <input
                      type="text"
                      name="description"
                      value={discountFormData.description}
                      onChange={handleDiscountChange}
                      placeholder="e.g., Summer Sale"
                      className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      name="startDate"
                      value={discountFormData.startDate}
                      onChange={handleDiscountChange}
                      className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      name="endDate"
                      value={discountFormData.endDate}
                      onChange={handleDiscountChange}
                      className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={discountLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-md transition-colors duration-200 text-base sm:text-lg font-medium disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {discountLoading ? "Creating Discount..." : "Create Discount"}
                </button>
              </form>

              {/* Existing Discounts List */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">📋 Existing Discounts ({discounts.length})</h3>
                
                {discounts.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm sm:text-base py-4">No discounts created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {discounts.map((discount) => {
                      const statusInfo = getDiscountStatusText(discount);
                      const isActive = isDiscountActive(discount);
                      
                      return (
                        <div key={discount.id} className={`border rounded-lg p-4 ${isActive ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">
                                {discount.discountPercentage}% OFF {discount.description && `- ${discount.description}`}
                              </h4>
                              <p className={`text-sm font-medium ${statusInfo.color}`}>
                                Status: {statusInfo.text}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                              <button
                                onClick={() => toggleDiscountStatus(discount.id, discount.isActive)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
                                  discount.isActive 
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }`}
                              >
                                {discount.isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => deleteDiscount(discount.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700 mb-3">
                            <div>
                              <strong>Start:</strong> {discount.startDate?.toDate?.().toLocaleString() || new Date(discount.startDate).toLocaleString()}
                            </div>
                            <div>
                              <strong>End:</strong> {discount.endDate?.toDate?.().toLocaleString() || new Date(discount.endDate).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <strong className="text-sm text-gray-700">Products ({discount.productIds.length}):</strong>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {discount.productIds.map((productId) => {
                                const product = products.find(p => p.id === productId);
                                return product ? (
                                  <div key={productId} className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-2">
                                    <img src={product.coverImage} alt={product.title} className="w-8 h-8 object-cover rounded" />
                                    <div>
                                      <p className="text-xs font-medium">{product.title}</p>
                                      <p className="text-xs text-gray-600">
                                        PKR {product.price?.toLocaleString()} → PKR {Math.round(product.price * (1 - discount.discountPercentage / 100)).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <span key={productId} className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">Product not found</span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

 {/* Product Inventory Section */}
<div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
  <button
    onClick={() => setShowInventory(!showInventory)}
    className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
  >
    <span>{showInventory ? "➖ Hide Inventory" : "📦 View Product Inventory"}</span>
    <svg className={`w-5 h-5 transition-transform duration-200 ${showInventory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
  </button>

  {showInventory && (
    <div className="mt-4">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search products by title, category, color, size..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-sm sm:text-base"
          />
          <svg 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredProducts.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 text-sm sm:text-base py-4">
            {searchTerm ? `No products found matching "${searchTerm}"` : 'No products found. Add a product to get started!'}
          </p>
        ) : (
          filteredProducts.map((product) => {
            // Check if product has any active discount
            const activeDiscount = discounts.find(discount => 
              discount.productIds.includes(product.id) && isDiscountActive(discount)
            );
            const discountedPrice = activeDiscount 
              ? Math.round(product.price * (1 - activeDiscount.discountPercentage / 100))
              : null;

            return (
              <div key={product.id} className={`flex flex-col sm:flex-row gap-4 border border-gray-200 p-4 rounded-md shadow-sm ${product.available === false ? 'bg-gray-100 opacity-80' : 'bg-white'} ${activeDiscount ? 'ring-2 ring-green-300' : ''}`}>
                <div className="relative">
                  <img src={product.coverImage} className="w-24 h-24 object-contain rounded-md flex-shrink-0 mx-auto sm:mx-0" alt={product.title} />
                  {activeDiscount && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{activeDiscount.discountPercentage}%
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{product.title}</h3>
                  <div className="text-sm text-gray-700">
                    {activeDiscount ? (
                      <div>
                        <span className="line-through text-red-500">PKR {product.price?.toLocaleString()}</span>
                        <span className="ml-2 font-bold text-green-600">PKR {discountedPrice?.toLocaleString()}</span>
                        <p className="text-xs text-green-600 font-medium">{activeDiscount.description || 'On Sale'}</p>
                      </div>
                    ) : (
                      <p>Price: PKR {product.price?.toLocaleString()}</p>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">Category: {product.category}</p>
                  <p className="text-sm text-gray-700">Top Product: {product.isTopProduct ? "Yes" : "No"}</p>
                  {product.variations && product.variations.length > 0 && (
                    <p className="text-sm text-gray-700">Colors: {product.variations.join(', ')}</p>
                  )}
                  {product.sizes && product.sizes.length > 0 && (
                    <p className="text-sm text-gray-700">Sizes: {product.sizes.join(', ')}</p>
                  )}
                  <p className="text-sm mt-1">Status: <span className={`font-medium ${product.available === false ? 'text-red-600' : 'text-green-600'}`}>
                    {product.available === false ? 'Out of Stock' : 'Available'}
                  </span></p>
                  <p className="text-sm text-gray-700">
                    Stock: {(() => {
                      if (Object.keys(product.stock || {}).length > 0) {
                        return Object.entries(product.stock || {}).map(([key, value]) => 
                          `${key}: ${value}`
                        ).join(', ');
                      }
                      return product.defaultStock || 0;
                    })()}
                  </p>
                  <div className="mt-3 flex justify-center sm:justify-start gap-2">
                    <button onClick={() => handleEdit(product)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200">Edit</button>
                    <button onClick={() => handleDelete(product.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200">Delete</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  )}
</div>

        {/* Orders Section */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowOrders(!showOrders)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showOrders ? "➖ Hide Orders" : "🧾 View Customer Orders"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showOrders ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showOrders && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner space-y-6">
              {orders.length === 0 ? (
                <p className="text-center text-gray-500 text-sm sm:text-base py-4">No orders received yet.</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mb-3 text-gray-800 border-b pb-2">🆕 Pending Orders ({orders.filter(o => o.status !== "delivered").length})</h3>
                    {orders.filter(o => o.status !== "delivered").length === 0 ? (
                      <p className="text-gray-500 text-sm sm:text-base">No pending orders at the moment. Great job!</p>
                    ) : (
                      orders
                        .filter((order) => order.status !== "delivered")
                        .map((order) => (
                          <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mb-4 last:mb-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                              <div className="mb-2 sm:mb-0">
                                <p className="font-semibold text-base sm:text-lg text-gray-900">
                                  Order by: {order.shippingAddress?.fullName || order.customerEmail}
                                </p>
                                <p className="text-sm text-gray-600">Total: PKR {order.total?.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Payment: {order.payment}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                                  onClick={() => toggleExpand(order.id)}
                                >
                                  {expandedOrders[order.id] ? "Hide Details" : "View Details"}
                                </button>
                                <button
                                  onClick={() => markAsDelivered(order.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  ✅ Mark as Delivered
                                </button>
                                <button
                                  onClick={() => deleteOrder(order.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>

                            {expandedOrders[order.id] && (
                              <OrderDetails order={order} />
                            )}
                          </div>
                        ))
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mt-6 mb-3 text-gray-800 border-b pb-2">📦 Delivered Orders ({orders.filter(o => o.status === "delivered").length})</h3>
                    {orders.filter(o => o.status === "delivered").length === 0 ? (
                      <p className="text-gray-500 text-sm sm:text-base">No delivered orders yet.</p>
                    ) : (
                      orders
                        .filter((order) => order.status === "delivered")
                        .map((order) => (
                          <div key={order.id} className="border border-green-300 rounded-lg p-4 bg-green-50 shadow-sm mb-4 last:mb-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                              <div className="mb-2 sm:mb-0">
                                <p className="font-semibold text-base sm:text-lg text-gray-900">
                                  Order by: {order.shippingAddress?.fullName || order.user}
                                </p>
                                <p className="text-sm text-gray-600">Total: PKR {order.total?.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Payment: {order.payment}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                                  onClick={() => toggleExpand(order.id)}
                                >
                                  {expandedOrders[order.id] ? "Hide Details" : "View Details"}
                                </button>
                                <button
                                  onClick={() => deleteOrder(order.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>

                            {expandedOrders[order.id] && (
                              <OrderDetails order={order} />
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contact Messages Section */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowContacts(!showContacts)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showContacts ? "➖ Hide Contact Messages" : "💌 View Contact Messages"} ({contacts.length})</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showContacts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showContacts && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner space-y-4">
              {contacts.length === 0 ? (
                <p className="text-center text-gray-500 text-sm sm:text-base py-4">No contact messages received yet.</p>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} className="border border-pink-200 rounded-lg p-4 bg-pink-50 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="mb-2 sm:mb-0">
                        <p className="font-semibold text-base sm:text-lg text-gray-900 flex items-center gap-2">
                          🌸 {contact.name}
                        </p>
                        <p className="text-sm text-gray-600">📧 {contact.email}</p>
                        <p className="text-sm text-gray-600">
                          🕒 {contact.timestamp?.toDate?.().toLocaleString() || "Unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-2 sm:mt-0">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                          onClick={() => toggleContactExpand(contact.id)}
                        >
                          {expandedContacts[contact.id] ? "Hide Message" : "View Message"}
                        </button>
                        <a
                          href={`mailto:${contact.email}?subject=Re: Your message&body=Hi ${contact.name},%0D%0A%0D%0AThank you for your message...`}
                          className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                        >
                          📧 Reply
                        </a>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {expandedContacts[contact.id] && (
                      <ContactDetails contact={contact} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sales Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-center bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">📅 Daily Sales</p>
            <p className="text-xl sm:text-2xl text-green-600 font-bold mt-1">PKR {totalSales.day.toLocaleString()}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">🗓️ Monthly Sales</p>
            <p className="text-xl sm:text-2xl text-blue-600 font-bold mt-1">PKR {totalSales.month.toLocaleString()}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">📆 Yearly Sales</p>
            <p className="text-xl sm:text-2xl text-purple-600 font-bold mt-1">PKR {totalSales.year.toLocaleString()}</p>
          </div>
        </div>

        {/* Monthly Sales Chart */}
        <div className="bg-white p-4 sm:p-6 mt-4 sm:mt-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📊 Monthly Sales Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `PKR ${value.toLocaleString()}`} />
              <Tooltip formatter={(value) => [`PKR ${value.toLocaleString()}`, 'Sales']} />
              <Bar dataKey="total" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 sm:p-6 mt-4 sm:mt-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 Top Selling Products (By Sales)</h2>
          <ResponsiveContainer width="100%" height={300}>
            {productSales.length > 0 ? (
              <BarChart data={productSales.slice(0, 10)}>
                <XAxis dataKey="title" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => `PKR ${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => [`PKR ${value.toLocaleString()}`, 'Sales']} />
                <Bar dataKey="totalSales" fill="#10b981" />
              </BarChart>
            ) : (
              <p className="text-center text-gray-500 py-10">No product sales data available yet.</p>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
    </>
  );
}

export default AdminPortal;