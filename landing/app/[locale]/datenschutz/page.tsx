import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'datenschutz' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Datenschutz({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'datenschutz' });
  const note = locale !== 'de' ? t('note') : undefined;

  return (
    <LegalPage title={t('title')} note={note}>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Viktor Goloviznin / Tinta Lab<br />
        E-Mail: <a href="mailto:support@tinta-lab.de">support@tinta-lab.de</a>
      </p>

      <h2>2. Welche Daten wir erheben und warum</h2>

      <h3>2.1 Serverlog-Daten</h3>
      <p>
        Beim Besuch dieser Website speichert unser Webserver automatisch technische
        Zugriffsdaten (IP-Adresse, Browsertyp, Betriebssystem, aufgerufene URL,
        Datum und Uhrzeit). Diese Daten werden ausschließlich zur Sicherstellung des
        Betriebs verwendet und nach spätestens 7 Tagen gelöscht.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
      </p>

      <h3>2.2 Kontaktanfragen</h3>
      <p>
        Wenn Sie über das Kontaktformular oder per E-Mail mit uns in Verbindung treten,
        speichern wir Ihre Angaben ausschließlich zur Bearbeitung Ihrer Anfrage.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. f DSGVO.
      </p>

      <h3>2.3 Plattform-Nutzung (App)</h3>
      <p>Bei Registrierung und Nutzung der Tinta Lab Plattform (app.tinta-lab.de) werden folgende Daten verarbeitet:</p>
      <ul>
        <li>Name und E-Mail-Adresse (zur Kontoführung und Kommunikation)</li>
        <li>Betriebszustandssignale Ihres Home-Assistant-Systems (ob das System erreichbar ist)</li>
        <li>Support-Sitzungsprotokoll: Zeitpunkt und Dauer von Fernwartungszugriffen, die Sie explizit freigegeben haben</li>
      </ul>
      <p>
        Ihre Home-Automation-Daten (Geräte, Szenen, Verlauf) verbleiben ausschließlich
        auf Ihrer eigenen Hardware. Wir haben darauf keinen Zugriff.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>3. Cookies und Tracking</h2>
      <p>
        Diese Website (tinta-lab.de) verwendet keine Werbe- oder Tracking-Cookies.
        Die App setzt ausschließlich technisch notwendige Session-Cookies zur Authentifizierung.
        Es werden keine Drittanbieter-Tracker eingesetzt.
      </p>

      <h2>4. Weitergabe an Dritte</h2>
      <ul>
        <li><strong>Hosting-Infrastruktur</strong>: DSGVO-konformer EU-Anbieter.</li>
        <li><strong>Cloudflare</strong>: Verschlüsselte Tunnelverbindung; verarbeitet nur Transportmetadaten. EU-US DPF zertifiziert.</li>
      </ul>

      <h2>5. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange wie nötig. Auf Wunsch löschen wir
        Ihr Konto und alle zugehörigen Daten unverzüglich, sofern keine gesetzlichen
        Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2>6. Ihre Rechte (Art. 15–22 DSGVO)</h2>
      <ul>
        <li><strong>Auskunft</strong> (Art. 15)</li>
        <li><strong>Berichtigung</strong> (Art. 16)</li>
        <li><strong>Löschung</strong> (Art. 17)</li>
        <li><strong>Einschränkung</strong> (Art. 18)</li>
        <li><strong>Datenübertragbarkeit</strong> (Art. 20)</li>
        <li><strong>Widerspruch</strong> (Art. 21)</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte:{' '}
        <a href="mailto:support@tinta-lab.de">support@tinta-lab.de</a>
      </p>
    </LegalPage>
  );
}
