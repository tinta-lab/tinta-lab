// Shared section header — one consistent rhythm for every section instead
// of each component restyling its own eyebrow/h2/lead.
export default function SectionHeading({
  id, eyebrow, title, lead, align = 'center',
}: {
  id: string; eyebrow: string; title: string; lead?: string; align?: 'center' | 'left';
}) {
  const center = align === 'center';
  return (
    <div className={`reveal mb-12 sm:mb-14 ${center ? 'text-center mx-auto max-w-3xl' : 'max-w-2xl'}`}>
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90">{eyebrow}</div>
      <h2
        id={id}
        className="text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white mb-5"
        style={{ textWrap: 'balance' }}
      >
        {title}
      </h2>
      {lead && (
        <p className={`text-lg text-slate-400 leading-relaxed ${center ? 'mx-auto max-w-2xl' : ''}`} style={{ textWrap: 'pretty' }}>
          {lead}
        </p>
      )}
    </div>
  );
}
