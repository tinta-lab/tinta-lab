import Navbar     from '@/components/Navbar';
import Hero       from '@/components/Hero';
import Features   from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Security   from '@/components/Security';
import Devices    from '@/components/Devices';
import FAQ        from '@/components/FAQ';
import CtaBanner  from '@/components/CtaBanner';
import Footer     from '@/components/Footer';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <Devices />
        <FAQ />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
