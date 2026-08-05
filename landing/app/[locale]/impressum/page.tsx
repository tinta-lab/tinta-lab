import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Impressum', robots: { index: false, follow: false } };
}

export default async function Impressum({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'impressum' });
  const note = locale !== 'de' ? t('note') : undefined;

  return (
    <LegalPage title={t('title')} note={note}>
      <p className="text-slate-500 text-sm mb-8">Angaben gemäß § 5 TMG</p>

      <h2>Verantwortlicher</h2>
      <p>
        Viktor Goloviznin<br />
        Tinta Lab<br />
        [Straße und Hausnummer]<br />
        [PLZ] [Stadt]<br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:support@tinta-lab.de">support@tinta-lab.de</a>
      </p>

      <h2>Berufshaftpflichtversicherung</h2>
      <p>
        Tinta Lab erbringt IT-Dienstleistungen im Bereich Smart Home als freiberufliche
        Tätigkeit. Eine Berufshaftpflichtversicherung besteht entsprechend dem Umfang
        der angebotenen Dienstleistungen.
      </p>

      <hr />

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
        Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind
        wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte
        fremde Informationen zu überwachen. Verpflichtungen zur Entfernung oder Sperrung
        der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon
        unberührt. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir
        diese Inhalte umgehend entfernen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir
        keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der
        jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
        unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung,
        Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
        bedürfen der schriftlichen Zustimmung des jeweiligen Autors.
      </p>
    </LegalPage>
  );
}
