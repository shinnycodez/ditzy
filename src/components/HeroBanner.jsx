import React from 'react';

function HeroBanner() {
  const imageUrl =
    'https://pbs.twimg.com/media/HKoUrL1WMAAc5Gl?format=jpg&name=900x900';

  return (
    <div className="relative bg-[#FAF3E1] ">
<div
  className="min-h-[240px] md:min-h-[480px] bg-cover lg:bg-contain bg-center bg-no-repeat transition-all duration-500 ease-in-out"
  style={{
    backgroundImage: `url("${imageUrl}")`,
  }}
/>

    </div>
  );
}

export default HeroBanner;