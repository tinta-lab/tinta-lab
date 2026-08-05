import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agb' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AGB({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agb' });
  const note = locale !== 'de' ? t('note') : undefined;

  return (
    <LegalPage title={t('title')} note={note}>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025 — Tinta Lab / Viktor Goloviznin</p>

      <h2>§ 1 Geltungsbereich</h2>
      <p>
        Diese AGB gelten für alle Verträge zwischen Viktor Goloviznin / Tinta Lab und
        den Kunden über die Nutzung der Tinta Lab Smart-Home-Managementplattform.
      </p>

      <h2>§ 2 Leistungsgegenstand</h2>
      <ul>
        <li>Installation und Einrichtung von Home Assistant auf kundeneigener Hardware</li>
        <li>Bereitstellung einer gesicherten Fernzugriff-Infrastruktur (Cloudflare Tunnel)</li>
        <li>Monitoring des Betriebszustands</li>
        <li>Technischer Support und Optimierung von Automatisierungen</li>
      </ul>
      <p>
        Der Fernzugriff ist technisch nur möglich, wenn der Kunde diesen aktiv freigibt.
      </p>

      <h2>§ 3 Vertragsschluss</h2>
      <p>
        Der Vertrag kommt durch schriftliche Bestätigung per E-Mail zustande.
        Die Nutzung der Plattform setzt die Registrierung und Annahme dieser AGB voraus.
      </p>

      <h2>§ 4 Mitwirkungspflichten des Kunden</h2>
      <ul>
        <li>Stabile Internetverbindung für das Home-Assistant-Gerät</li>
        <li>Dauerhaft eingeschaltetes und erreichbares Gerät</li>
        <li>Bereitstellung von Zugangsdaten auf Anfrage, sofern für die Einrichtung erforderlich</li>
      </ul>

      <h2>§ 5 Vergütung</h2>
      <p>
        Die Vergütung richtet sich nach der individuellen Vereinbarung. Keine versteckten
        Gebühren. Die Abrechnung erfolgt je nach Vereinbarung monatlich oder einmalig.
      </p>

      <h2>§ 6 Datenschutz</h2>
      <p>
        Alle Smart-Home-Daten verbleiben auf der Hardware des Kunden. Details:{' '}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2>§ 7 Fernwartungszugriff</h2>
      <p>
        Jeder Zugriff erfordert die aktive Freigabe durch den Kunden. Jede Sitzung wird
        protokolliert und ist jederzeit einsehbar. Der Kunde kann eine laufende Sitzung
        jederzeit beenden.
      </p>

      <h2>§ 8 Haftung</h2>
      <p>
        Tinta Lab haftet unbegrenzt bei Vorsatz und grober Fahrlässigkeit. Im Übrigen ist
        die Haftung auf den vertragstypisch vorhersehbaren Schaden begrenzt. Für
        Datenverluste durch Ausfall der Kundenhardware übernimmt Tinta Lab keine Haftung.
      </p>

      <h2>§ 9 Kündigung</h2>
      <p>
        Kündigung mit 30 Tagen Frist zum Monatsende. Nach Kündigung werden alle
        plattformseitig gespeicherten Daten gelöscht. Kundendaten auf eigener Hardware
        bleiben vollständig erhalten.
      </p>

      <h2>§ 10 Anzuwendendes Recht</h2>
      <p>Deutsches Recht. Gerichtsstand: Sitz von Tinta Lab.</p>

      <h2>§ 11 Salvatorische Klausel</h2>
      <p>
        Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen
        Bestimmungen unberührt.
      </p>
    </LegalPage>
  );
}
