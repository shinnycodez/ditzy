import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function ProductGrid({ products = [], filters = {}, searchQuery = '', loading = false }) {
  const queryParams = useQuery();
  const categoryFromURL = queryParams.get('category');

  const {
    category = [],
    size = [],
    color = [],
    available = [],
    priceRange = [0, Infinity],
  } = filters;

  // Filter products based on filters and URL params
  const filteredProducts = products.filter((product) => {
    // Category filter (from URL or sidebar)
    const matchesCategory = categoryFromURL
      ? product.category === categoryFromURL
      : category.length
      ? category.includes(product.category)
      : true;

    // Size filter - handle both product.size and product.sizes array
    let matchesSize = true;
    if (size.length) {
      if (product.sizes && Array.isArray(product.sizes)) {
        matchesSize = size.some(s => product.sizes.includes(s));
      } else if (product.size) {
        matchesSize = size.includes(product.size);
      } else {
        matchesSize = false;
      }
    }

    // Color filter - handle both product.variation and product.variations array
    let matchesColor = true;
    if (color.length) {
      if (product.variations && Array.isArray(product.variations)) {
        matchesColor = color.some(c => product.variations.includes(c));
      } else if (product.variation) {
        matchesColor = color.includes(product.variation);
      } else if (product.color) {
        matchesColor = color.includes(product.color);
      } else {
        matchesColor = false;
      }
    }

    // Availability filter
    const matchesAvailability = available.length
      ? available.includes(product.available !== false ? 'in-stock' : 'out-of-stock')
      : true;

    // Price filter
    const matchesPrice =
      product.price >= priceRange[0] && product.price <= priceRange[1];

    // Search filter
    const matchesSearch = searchQuery
      ? product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.variations && product.variations.some(v => 
          v.toLowerCase().includes(searchQuery.toLowerCase())
        )) ||
        (product.sizes && product.sizes.some(s => 
          s.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      : true;

    return (
      matchesCategory &&
      matchesSize &&
      matchesColor &&
      matchesAvailability &&
      matchesPrice &&
      matchesSearch
    );
  });

  // Determine title based on filters
  let title = 'All Products';
  if (categoryFromURL) {
    title = categoryFromURL;
  } else if (searchQuery) {
    title = `Results for "${searchQuery}"`;
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <p className="text-[#757575] text-lg font-medium">Loading products...</p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex flex-wrap gap-2 p-4">
        <Link
          to="/"
          className="text-[#757575] text-base font-medium hover:text-[#0c77f2] transition"
        >
          Home
        </Link>
        <span className="text-[#757575] text-base font-medium">/</span>
        <span className="text-[#141414] text-base font-medium">{title}</span>
      </div>

      {/* Page Title */}
      <div className="flex items-center gap-3">
        <p className="text-[#141414] text-[32px] font-bold">{title}</p>
        <img
          src="https://pbs.twimg.com/media/GznizxLWUAEdik-?format=png&name=small"
          alt="category icon"
          className="w-30 h-25 object-contain"
        />
      </div>

      {/* Results count */}
      {searchQuery && (
        <div className="px-4 mt-2 text-sm text-gray-600">
          Found {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <Link to={`/product/${product.id}`} key={product.id} className="h-full">
              <div className="flex flex-col h-full gap-3 pb-3 group shadow-md rounded-lg overflow-hidden transition-transform duration-300 hover:shadow-lg bg-white">
                {/* Product image - fixed height */}
                <div className="w-full aspect-square overflow-hidden">
                  <img
                    src={product.coverImage || product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Product info - fixed height with consistent spacing */}
                <div className="px-3 pb-4 flex flex-col justify-between h-[130px]">
                  <div className="min-h-[60px] overflow-hidden">
                    <p className="text-[#141414] text-base font-medium line-clamp-2">
                      {product.title}
                    </p>
                    <p className="text-[#757575] text-sm font-normal mt-1">
                      PKR {product.price?.toLocaleString()}
                    </p>
                    {/* Show stock status on product card (optional) */}
                    {product.available === false && (
                      <p className="text-red-500 text-xs mt-1">Out of Stock</p>
                    )}
                  </div>
                  <button 
                    className={`mt-auto py-2 px-1 rounded-full text-white text-sm font-semibold shadow-md transition-all duration-200 ${
                      product.available === false 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-[#1c5078] hover:bg-gray-900'
                    }`}
                    disabled={product.available === false}
                    onClick={(e) => {
                      if (product.available !== false) {
                        // Add to cart or buy now logic here
                        e.preventDefault();
                        // You can add buy now functionality here
                      }
                    }}
                  >
                    {product.available === false ? 'Out of Stock' : 'Buy Now'}
                  </button>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center col-span-full py-12">
            <p className="text-[#757575] text-lg font-medium">
              No products found.
            </p>
            {(searchQuery || Object.keys(filters).some(key => filters[key]?.length)) && (
              <button
                onClick={() => window.location.href = '/products'}
                className="mt-4 text-blue-600 hover:text-blue-800 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default ProductGrid;