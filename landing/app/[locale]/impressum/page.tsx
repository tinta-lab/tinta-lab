import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';
import { COMPANY, COUNTRY } from '@/components/legal/company';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Impressum', robots: { index: false, follow: false } };
}

const ODR = 'https://ec.europa.eu/consumers/odr/';

function Provider({ locale }: { locale: string }) {
  return (
    <p>
      {COMPANY.owner}<br />
      {COMPANY.brand}<br />
      {COMPANY.street}<br />
      {COMPANY.city}<br />
      {COUNTRY[locale] ?? COUNTRY.de}
    </p>
  );
}

function Contact({ email, form }: { email: string; form: string }) {
  return (
    <p>
      {email}: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a><br />
      {form}: <a href={COMPANY.contactForm}>app.tinta-lab.de/contact</a>
    </p>
  );
}

// German is the legally required version (§ 5 DDG); the others are
// convenience translations of the same content.
const CONTENT: Record<string, (locale: string) => React.ReactNode> = {
  de: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
      <h2>Verantwortlicher</h2>
      <Provider locale={l} />
      <h2>Kontakt</h2>
      <Contact email="E-Mail" form="Kontaktformular" />
      <h2>Umsatzsteuer</h2>
      <p>Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet und ausgewiesen.</p>
      <hr />
      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
        verantwortlich. Wir sind als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte
        fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
        hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt. Bei Bekanntwerden von entsprechenden Rechtsverletzungen
        werden wir diese Inhalte umgehend entfernen.
      </p>
      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben.
        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
      </p>
      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
        Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
        des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors.
      </p>
      <hr />
      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href={ODR} target="_blank" rel="noopener noreferrer">{ODR}</a>. Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>
      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </>
  ),
  en: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Information pursuant to § 5 DDG (German Digital Services Act)</p>
      <h2>Responsible</h2>
      <Provider locale={l} />
      <h2>Contact</h2>
      <Contact email="Email" form="Contact form" />
      <h2>VAT</h2>
      <p>Under § 19 UStG (German small business regulation), no VAT is charged or shown.</p>
      <hr />
      <h2>Liability for content</h2>
      <p>
        As a service provider, we are responsible for our own content on these pages under general law. However,
        we are not obliged to monitor transmitted or stored third-party information or to investigate circumstances
        that indicate unlawful activity. Obligations to remove or block the use of information under general law
        remain unaffected. As soon as we become aware of a specific legal violation, we will remove the content
        concerned immediately.
      </p>
      <h2>Liability for links</h2>
      <p>
        Our website contains links to external third-party websites whose content we have no control over. The
        respective provider or operator is always responsible for the content of linked pages.
      </p>
      <h2>Copyright</h2>
      <p>
        The content and works created by the site operator on these pages are subject to German copyright law.
        Reproduction, editing, distribution and any kind of use beyond the limits of copyright law require the
        written consent of the respective author.
      </p>
      <hr />
      <h2>EU dispute resolution</h2>
      <p>
        The European Commission provides a platform for online dispute resolution (ODR):{' '}
        <a href={ODR} target="_blank" rel="noopener noreferrer">{ODR}</a>. You will find our email address above.
      </p>
      <h2>Consumer dispute resolution</h2>
      <p>We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.</p>
    </>
  ),
  it: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Informazioni ai sensi del § 5 DDG (legge tedesca sui servizi digitali)</p>
      <h2>Responsabile</h2>
      <Provider locale={l} />
      <h2>Contatti</h2>
      <Contact email="Email" form="Modulo di contatto" />
      <h2>IVA</h2>
      <p>Ai sensi del § 19 UStG (regime tedesco per le piccole imprese) l’IVA non viene addebitata né indicata.</p>
      <hr />
      <h2>Responsabilità per i contenuti</h2>
      <p>
        In qualità di fornitore del servizio siamo responsabili dei nostri contenuti su queste pagine secondo le
        leggi generali. Non siamo tuttavia obbligati a sorvegliare le informazioni di terzi trasmesse o memorizzate
        né a ricercare circostanze che indichino un’attività illecita. Restano salvi gli obblighi di rimozione o di
        blocco dell’uso delle informazioni previsti dalle leggi generali. Non appena veniamo a conoscenza di una
        violazione concreta, rimuoviamo subito i contenuti interessati.
      </p>
      <h2>Responsabilità per i link</h2>
      <p>
        Il nostro sito contiene link a siti web esterni di terzi, sui cui contenuti non abbiamo alcun controllo.
        Dei contenuti delle pagine collegate è sempre responsabile il rispettivo fornitore o gestore.
      </p>
      <h2>Diritto d’autore</h2>
      <p>
        I contenuti e le opere creati dal gestore del sito su queste pagine sono soggetti al diritto d’autore
        tedesco. La riproduzione, la modifica, la diffusione e ogni forma di utilizzo oltre i limiti del diritto
        d’autore richiedono il consenso scritto del rispettivo autore.
      </p>
      <hr />
      <h2>Risoluzione delle controversie nell’UE</h2>
      <p>
        La Commissione europea mette a disposizione una piattaforma per la risoluzione online delle controversie
        (ODR): <a href={ODR} target="_blank" rel="noopener noreferrer">{ODR}</a>. Il nostro indirizzo email è indicato sopra.
      </p>
      <h2>Risoluzione delle controversie dei consumatori</h2>
      <p>Non siamo disposti né obbligati a partecipare a procedure di risoluzione delle controversie dinanzi a un organismo di conciliazione per i consumatori.</p>
    </>
  ),
  ru: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Сведения согласно § 5 DDG (Закон Германии о цифровых услугах)</p>
      <h2>Ответственное лицо</h2>
      <Provider locale={l} />
      <h2>Контакты</h2>
      <Contact email="Эл. почта" form="Форма обратной связи" />
      <h2>НДС</h2>
      <p>Согласно § 19 UStG (режим малого предпринимательства в Германии) НДС не начисляется и не указывается.</p>
      <hr />
      <h2>Ответственность за содержание</h2>
      <p>
        Как поставщик услуг мы отвечаем за собственное содержание этих страниц в соответствии с общими законами.
        При этом мы не обязаны контролировать переданную или сохранённую информацию третьих лиц или выяснять
        обстоятельства, указывающие на противоправную деятельность. Обязанности по удалению или блокировке
        информации согласно общим законам остаются в силе. Как только нам станет известно о конкретном нарушении,
        мы незамедлительно удалим соответствующее содержание.
      </p>
      <h2>Ответственность за ссылки</h2>
      <p>
        Наш сайт содержит ссылки на внешние сайты третьих лиц, на содержание которых мы не можем влиять.
        За содержание этих страниц всегда отвечает их владелец или оператор.
      </p>
      <h2>Авторское право</h2>
      <p>
        Материалы и произведения, созданные владельцем сайта, охраняются авторским правом Германии.
        Копирование, переработка, распространение и любое иное использование за пределами авторского права
        допускаются только с письменного согласия автора.
      </p>
      <hr />
      <h2>Урегулирование споров в ЕС</h2>
      <p>
        Европейская комиссия предоставляет платформу для онлайн-урегулирования споров (ODR):{' '}
        <a href={ODR} target="_blank" rel="noopener noreferrer">{ODR}</a>. Наш адрес электронной почты указан выше.
      </p>
      <h2>Урегулирование споров с потребителями</h2>
      <p>Мы не готовы и не обязаны участвовать в процедурах урегулирования споров в арбитражной комиссии по делам потребителей.</p>
    </>
  ),
};

export default async function Impressum({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'impressum' });
  const note = locale !== 'de' ? t('note') : undefined;
  return (
    <LegalPage title={t('title')} note={note}>
      {(CONTENT[locale] ?? CONTENT.de)(locale)}
    </LegalPage>
  );
}
