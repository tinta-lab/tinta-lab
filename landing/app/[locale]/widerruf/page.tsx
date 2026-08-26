import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'widerruf' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Widerruf({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'widerruf' });
  const note = locale !== 'de' ? t('note') : undefined;

  return (
    <LegalPage title={t('title')} note={note}>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025 — Tinta Lab / Viktor Goloviznin</p>

      <h2>Widerrufsrecht</h2>
      <p>
        Verbrauchern steht bei Vertragsschluss im Fernabsatz (z. B. Registrierung und
        Buchung über app.tinta-lab.de) ein gesetzliches Widerrufsrecht zu. Es gilt
        Folgendes:
      </p>
      <p>
        Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen
        Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
        Vertragsschlusses.
      </p>
      <p>
        Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
      </p>
      <p>
        Tinta Lab, Viktor Goloviznin<br />
        E-Mail: <a href="mailto:support@tinta-lab.de">support@tinta-lab.de</a>
      </p>
      <p>
        mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief
        oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen,
        informieren. Sie können dafür das untenstehende Muster-Widerrufsformular
        verwenden, das jedoch nicht vorgeschrieben ist.
      </p>
      <p>
        Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die
        Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
      </p>

      <h2>Folgen des Widerrufs</h2>
      <p>
        Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von
        Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem
        Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags
        bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe
        Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es
        sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall
        werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
      </p>

      <h2>Vorzeitiges Erlöschen bei bereits erbrachter Leistung</h2>
      <p>
        Haben Sie verlangt, dass die Dienstleistung (z. B. Einrichtung von Home
        Assistant, Provisionierung des Fernzugriffs) während der Widerrufsfrist
        beginnen soll, und widerrufen Sie den Vertrag dennoch, so haben Sie uns einen
        angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem
        Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags
        unterrichten, bereits erbrachten Leistungen im Vergleich zum Gesamtumfang der
        im Vertrag vorgesehenen Leistungen entspricht. Ihr Widerrufsrecht erlischt
        vorzeitig, wenn wir die Dienstleistung vollständig erbracht haben und mit der
        Ausführung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche Zustimmung
        gegeben und gleichzeitig Ihre Kenntnis davon bestätigt haben, dass Sie Ihr
        Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren.
      </p>

      <h2>Ausschluss / vorzeitiges Erlöschen bei digitalen Inhalten</h2>
      <p>
        Bei Verträgen zur Bereitstellung von nicht auf einem körperlichen Datenträger
        befindlichen digitalen Inhalten erlischt das Widerrufsrecht ebenfalls vorzeitig,
        wenn wir mit der Ausführung des Vertrags erst begonnen haben, nachdem Sie
        ausdrücklich zugestimmt haben, dass wir vor Ablauf der Widerrufsfrist mit der
        Ausführung des Vertrags beginnen, und Sie Ihre Kenntnis davon bestätigt haben,
        dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrags Ihr
        Widerrufsrecht verlieren.
      </p>

      <hr />

      <h2>Muster-Widerrufsformular</h2>
      <p>
        (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus
        und senden Sie es zurück.)
      </p>
      <p>
        An:<br />
        Tinta Lab, Viktor Goloviznin<br />
        E-Mail: support@tinta-lab.de
      </p>
      <p>
        Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag
        über die Erbringung der folgenden Dienstleistung (*):
      </p>
      <ul>
        <li>Bestellt am (*) / erhalten am (*): __________</li>
        <li>Name des/der Verbraucher(s): __________</li>
        <li>Anschrift des/der Verbraucher(s): __________</li>
        <li>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): __________</li>
        <li>Datum: __________</li>
      </ul>
      <p className="text-slate-500 text-sm">(*) Unzutreffendes streichen.</p>

      <hr />

      <h2>Kein Widerrufsrecht bei Geschäftskunden</h2>
      <p>
        Das vorstehende Widerrufsrecht gilt ausschließlich für Verbraucher im Sinne des
        § 13 BGB. Für Unternehmer (§ 14 BGB), insbesondere Geschäftskunden im
        B2B-Bereich, besteht kein gesetzliches Widerrufsrecht.
      </p>

      <p className="text-slate-500 text-sm">
        Diese Widerrufsbelehrung ergänzt die <a href="/agb">AGB</a> und die{' '}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>
    </LegalPage>
  );
}
