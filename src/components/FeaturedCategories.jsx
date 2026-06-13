import React from 'react';
import { Link } from 'react-router-dom';

const categories = [
    {
    id: 1,
    title: "bracelets♡",
    imageUrl: "https://pbs.twimg.com/media/HKoaD1TWEAA8tQT?format=jpg&name=large",
    link: "bracelets"
  },
  {
    id: 2,
    title: "keychains♡",
    imageUrl: "https://pbs.twimg.com/media/HKoaJAGWgAA5VT8?format=jpg&name=large",
      link: "keychains",
  },


    {
    id: 4,
    title: "bookmarks♡",
    imageUrl: "https://pbs.twimg.com/media/HKoaLqXXIAAEnMc?format=jpg&name=large",
   link: "bookmarks",
  },
        {
    id: 4,
    title: "phone charms♡",
    imageUrl:"https://pbs.twimg.com/media/HKoaOgPWkAAFyN9?format=jpg&name=large",
     link: "phone charms"
  },
      {
    id: 3,
    title: "necklaces♡",
    imageUrl: "https://pbs.twimg.com/media/HKoeUXgaYAABTNY?format=jpg&name=small",
      link: "necklaces"
  },

        {
    id: 5,
    title: "earrings♡",
    imageUrl:"https://pbs.twimg.com/media/HKoeSPXb0AA6fhQ?format=jpg&name=large",
     link: "earrings"
  },
 

];

function FeaturedCategories() {
  return (
<div>
<h2 className="text-[#ff9f00] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5 font-['Didot','Bodoni_MT','Didot_LT_Std','Georgia',serif]">
    Featured Categories
  </h2>

  <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
    {categories.map(category => (
      <Link
        to={`/products?category=${encodeURIComponent(category.link)}`}
        key={category.id}
        className="flex flex-col gap-2 group bg-white rounded-lg overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-[1.03]"
      >
        <div
          className="w-full aspect-[1/1] bg-center bg-no-repeat bg-cover"
          style={{ backgroundImage: `url(${category.imageUrl})` }}
        ></div>
        <p className="text-[#141414] text-base font-medium leading-normal text-center px-2 pb-3">
          {category.title}
        </p>
      </Link>
    ))}
  </div>
</div>

  );
}

export default FeaturedCategories;
