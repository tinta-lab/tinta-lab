import type { Metadata } from 'next';
import Navbar     from '@/components/Navbar';
import Hero       from '@/components/Hero';
import Features   from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Security   from '@/components/Security';
import Devices    from '@/components/Devices';
import FAQ        from '@/components/FAQ';
import CtaBanner  from '@/components/CtaBanner';
import Footer     from '@/components/Footer';

const PATHS = { de: '/', en: '/en', it: '/it', ru: '/ru' } as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: PATHS[locale as keyof typeof PATHS] ?? '/',
      languages: { ...PATHS, 'x-default': '/' },
    },
  };
}

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
