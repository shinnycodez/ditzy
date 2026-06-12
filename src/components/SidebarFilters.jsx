import React, { useState } from 'react';

function SidebarFilters({ onFilterChange, onClose }) {
  const [tempFilters, setTempFilters] = useState({
    category: [],
    available: [],
    priceRange: [0, 500000000],
  });

  const options = {
    Category: ['Phone charms', 'Keychains', 'Bracelet', 'Earings', 'Necklaces', 'Plushies'],
    Availability: [true, false],
  };

  const handleCheckboxChange = (filterName, value) => {
    const key = filterName === 'Availability' ? 'available' : filterName.toLowerCase();
    setTempFilters((prev) => {
      const current = prev[key] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const handlePriceChange = (index, value) => {
    const newRange = [...tempFilters.priceRange];
    newRange[index] = Number(value);
    setTempFilters((prev) => ({
      ...prev,
      priceRange: newRange,
    }));
  };

  const applyFilters = () => {
    onFilterChange?.(tempFilters);
    onClose?.(); // Close filter panel on mobile
  };

  const clearFilters = () => {
    const cleared = {
      category: [],
      available: [],
      priceRange: [0, 5000000],
    };
    setTempFilters(cleared);
    onFilterChange?.(cleared);
    onClose?.(); // Close filter panel on mobile
  };

  return (
    <div className="flex flex-col w-full md:w-80">
      <h2 className="text-[#141414] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">
        Filters
      </h2>
      <div className="flex flex-col p-4 gap-3">
        {Object.keys(options).map((filter) => (
          <details
            key={filter}
            className="flex flex-col rounded-lg border border-[#e0e0e0] bg-[#
#fefaf9] px-[15px] py-[7px] group"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-6 py-2">
              <p className="text-[#141414] text-sm font-medium leading-normal">{filter}</p>
              <div className="text-[#141414] group-open:rotate-180">
                <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
                </svg>
              </div>
            </summary>
            <div className="flex flex-col gap-2 pb-2">
              {options[filter].map((option) => (
                <label key={option.toString()} className="flex items-center gap-2 text-[#757575] text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={
                      filter === 'Availability'
                        ? tempFilters.available.includes(option)
                        : tempFilters[filter.toLowerCase()]?.includes(option)
                    }
                    onChange={() => handleCheckboxChange(filter, option)}
                    className="accent-[#141414]"
                  />
                  {filter === 'Availability'
                    ? option === true
                      ? 'In Stock'
                      : 'Out of Stock'
                    : option}
                </label>
              ))}
            </div>
          </details>
        ))}

        {/* Price Range */}
        <details
          open
          className="flex flex-col rounded-lg border border-[#e0e0e0] bg-[#
#fefaf9] px-[15px] py-[7px] group"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-6 py-2">
            <p className="text-[#141414] text-sm font-medium leading-normal">Price Range</p>
            <div className="text-[#141414] group-open:rotate-180">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
              </svg>
            </div>
          </summary>
          <div className="pt-2 pb-4">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={tempFilters.priceRange[0]}
                onChange={(e) => handlePriceChange(0, e.target.value)}
                className="w-20 px-2 py-1 border border-[#ccc] rounded text-sm bg-[#
#fefaf9]"
              />
              <span className="text-sm text-[#757575]">to</span>
              <input
                type="number"
                min={tempFilters.priceRange[0]}
                value={tempFilters.priceRange[1]}
                onChange={(e) => handlePriceChange(1, e.target.value)}
                className="w-20 px-2 py-1 border border-[#ccc] rounded text-sm bg-[#
#fefaf9]"
              />
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={applyFilters}
            className="flex-1 bg-[#ff9f00] text-white text-sm font-semibold py-2 px-4 rounded hover:opacity-90 transition"
          >
            Apply Filters
          </button>
          <button
            onClick={clearFilters}
            className="flex-1 border border-[#141414] text-[#141414] text-sm font-semibold py-2 px-4 rounded hover:bg-[#f3f3f3] transition"
          >
            Clear
          </button>
        </div>
                  {/* <img
  src="https://scontent.flhe7-1.fna.fbcdn.net/v/t1.15752-9/521434321_723434950653516_4695240504891457317_n.png?_nc_cat=101&ccb=1-7&_nc_sid=0024fc&_nc_ohc=NztkB-j-myQQ7kNvwFhssUB&_nc_oc=AdnRuI7C-NvMA7mZyTt7sOO83JammEZcuob_MPqphRYt4jnBZjOgOpfTlK_NTJkSr9o&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.flhe7-1.fna&oh=03_Q7cD2wHVTpNl9jgZ_WFH_qtL94s3n5fVwd4M4GqpSVt5dOBHfw&oe=68AD625C"
  alt="Cute filter doodle"
  className="w-3/4 max-w-[200px] mx-auto mt-4"
/> */}
      </div>
    </div>
  );
}

export default SidebarFilters;
