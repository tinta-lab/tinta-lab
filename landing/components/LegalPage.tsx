import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface Props {
  title: string;
  note?: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, note, children }: Props) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">{title}</h1>
          {note && (
            <div className="mb-8 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-lg px-3 py-2">
              <span>⚠</span> {note}
            </div>
          )}
          <div className="legal">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
