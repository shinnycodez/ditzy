import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import FeaturedCategories from './components/FeaturedCategories';
import ShopTheLook from './components/ShopTheLook';
import Footer from './components/Footer';
import ContactForm from './components/ContactForm';

function Home() {
  return (
    <div
      className="relative flex size-full min-h-screen flex-col bg-[#FFFFFF] group/design-root overflow-x-hidden"
    style={{ fontFamily: '"Noto Serif", "Noto Sans", sans-serif' }}
    >
      <div className="layout-container flex h-full grow flex-col">
        <Header />

        {/* Full width HeroBanner section */}
        <div className="w-full bg-[#F0E68C]"> 
          <HeroBanner />
        </div>

        <div className="px-4 md:px-10 lg:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1 w-full">
            <FeaturedCategories />
            <ShopTheLook />
            
            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;