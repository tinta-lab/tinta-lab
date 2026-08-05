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
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          {note && (
            <div className="mb-8 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-lg px-3 py-2">
              <span>⚠</span> {note}
            </div>
          )}
          <div className="prose prose-invert prose-slate max-w-none
            prose-headings:font-semibold prose-headings:text-white
            prose-p:text-slate-400 prose-p:leading-relaxed
            prose-a:text-teal-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-slate-300
            prose-ul:text-slate-400 prose-li:marker:text-teal-500
            prose-hr:border-slate-800">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
