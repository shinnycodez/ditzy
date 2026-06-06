import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import SidebarFilters from './SidebarFilters';
import ProductGrid from './ProductGrid';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AiOutlineClose, AiOutlineSearch } from 'react-icons/ai';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Products() {
  const queryParams = useQuery();
  const categoryFromURL = queryParams.get('category');
  
  const [filters, setFilters] = useState({});
  const [allProducts, setAllProducts] = useState([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch products based on category
  useEffect(() => {
    const fetchProductsByCategory = async () => {
      setLoading(true);
      try {
        let productsQuery;
        
        if (categoryFromURL && categoryFromURL !== 'All') {
          productsQuery = query(
            collection(db, 'products'),
            where('category', '==', categoryFromURL)
          );
        } else {
          productsQuery = collection(db, 'products');
        }
        
        const querySnapshot = await getDocs(productsQuery);
        const productList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setAllProducts(productList);
      } catch (error) {
        console.error('Error fetching products:', error);
        setAllProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProductsByCategory();
  }, [categoryFromURL]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div
      className="relative flex size-full min-h-screen flex-col bg-[#a4c2da] group/design-root overflow-x-hidden"
      style={{ fontFamily: '"Noto Serif", "Noto Sans", sans-serif' }}
    >
      <div className="layout-container flex h-full grow flex-col">
        <Header />

        <div className="gap-1 px-4 md:px-6 flex flex-1 justify-center py-5">
          {/* Sidebar visible only on desktop */}
          <div className="hidden md:block">
            <SidebarFilters onFilterChange={setFilters} />
          </div>

          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            {/* Category Header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-800">
                {categoryFromURL ? `${categoryFromURL}` : 'All Products'}
              </h1>
              {!loading && allProducts.length > 0 && (
                <p className="text-gray-600 mt-1">
                  {allProducts.length} {allProducts.length === 1 ? 'product' : 'products'} found
                </p>
              )}
            </div>

            {/* Mobile Categories Header with Filters Button */}
            <div className="flex items-center justify-between md:hidden mb-4">
              <h2 className="text-lg font-semibold">Products</h2>
              <button
                className="bg-black text-white px-3 py-1 rounded-md text-sm"
                onClick={() => setMobileFiltersOpen(true)}
              >
                Filters
              </button>
            </div>

            {/* Search Bar Section */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AiOutlineSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder="Search products by name, description, color, size..."
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-base bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <AiOutlineClose className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Fullscreen Filter Overlay */}
            {mobileFiltersOpen && (
              <div className="fixed inset-0 z-50 bg-white p-4 overflow-y-auto md:hidden">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="text-gray-500"
                  >
                    <AiOutlineClose className="w-6 h-6" />
                  </button>
                </div>
                <SidebarFilters onFilterChange={setFilters} onClose={() => setMobileFiltersOpen(false)} />
              </div>
            )}

            {/* Product Grid - passes only the props that ProductGrid accepts */}
            <ProductGrid 
              products={allProducts}
              filters={filters}
              searchQuery={searchQuery}
              loading={loading}
            />
            
            {/* No results message */}
            {!loading && allProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No products available in {categoryFromURL || 'this category'}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;