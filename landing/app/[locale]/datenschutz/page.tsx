import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/components/legal/company';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'datenschutz' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const Mail = () => <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
const CfLink = () => (
  <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">cloudflare.com/privacypolicy</a>
);
const Authority = () => (
  <p>
    Der Hessische Beauftragte für Datenschutz und Informationsfreiheit<br />
    Postfach 3163<br />
    65021 Wiesbaden<br />
    <a href="https://datenschutz.hessen.de/" target="_blank" rel="noopener noreferrer">datenschutz.hessen.de</a>
  </p>
);

// German is the binding version; the others are convenience translations.
const CONTENT: Record<string, React.ReactNode> = {
  de: (
    <>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025</p>
      <h2>1. Verantwortlicher</h2>
      <p>{COMPANY.owner} / {COMPANY.brand}<br />E-Mail: <Mail /></p>
      <h2>2. Welche Daten wir erheben und warum</h2>
      <h3>2.1 Serverlog-Daten</h3>
      <p>
        Beim Besuch dieser Website speichert unser Webserver automatisch technische Zugriffsdaten (IP-Adresse,
        Browsertyp, Betriebssystem, aufgerufene URL, Datum und Uhrzeit). Diese Daten werden ausschließlich zur
        Sicherstellung des Betriebs verwendet und nach spätestens 7 Tagen gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
      </p>
      <h3>2.2 Kontaktanfragen</h3>
      <p>
        Wenn Sie über das Kontaktformular oder per E-Mail mit uns in Verbindung treten, speichern wir Ihre Angaben
        ausschließlich zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. f DSGVO.
      </p>
      <h3>2.3 Plattform-Nutzung (App) und Tinta Agent</h3>
      <p>Bei Registrierung und Nutzung der Tinta Lab Plattform (app.tinta-lab.de) werden folgende Daten verarbeitet:</p>
      <ul>
        <li>Name und E-Mail-Adresse (zur Kontoführung und Kommunikation)</li>
        <li>Betriebszustandssignale Ihres Home-Assistant-Systems (Heartbeat, Systemstatus, Agenten-Version — ob das System erreichbar ist)</li>
        <li>
          Support-Sitzungsprotokoll: Bei jeder Fernwartungssitzung, die Sie explizit freigegeben haben, protokollieren
          wir Zeitpunkt, Dauer, den von Ihnen gewählten Zugriffsgrund und die zugewiesene Support-Mitarbeiter-ID.
          Dieses Protokoll ist zur Nachvollziehbarkeit kryptografisch fälschungssicher verkettet (SHA-256 Hash-Chain)
          und kann nachträglich nicht unbemerkt verändert werden.
        </li>
      </ul>
      <p>
        <strong>Nicht verarbeitet</strong> werden dabei: Passwörter, Rohdaten von Sensoren oder Binärsensoren,
        Kamerabilder oder -videos, sowie sonstige personenbezogene Nutzungsdaten Ihrer Smart-Home-Geräte. Ihre
        Home-Automation-Daten (Geräte, Szenen, Verlauf) verbleiben ausschließlich auf Ihrer eigenen Hardware — wir
        haben darauf keinen Zugriff.
      </p>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für Kontoführung und Systemwartung;
        Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
        IT-Sicherheit und Nachweisbarkeit) für das Support-Sitzungsprotokoll.
      </p>
      <h2>3. Cookies und Tracking</h2>
      <p>
        Diese Website (tinta-lab.de) verwendet keine Werbe- oder Tracking-Cookies. Die App setzt ausschließlich
        technisch notwendige Session-Cookies zur Authentifizierung. Es werden keine Drittanbieter-Tracker eingesetzt.
      </p>
      <h2>4. Weitergabe an Dritte</h2>
      <ul>
        <li><strong>Hosting-Infrastruktur</strong>: DSGVO-konformer EU-Anbieter.</li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA): stellt den
          verschlüsselten Reverse-Tunnel (Cloudflare Tunnel) bereit, über den der Fernzugriff auf Ihr System ohne
          Öffnung lokaler Router-Ports erfolgt, sowie die Auslieferung dieser Website. Cloudflare verarbeitet dabei
          nur Transportmetadaten. Die Datenübertragung in die USA stützt sich auf die Zertifizierung von Cloudflare
          unter dem EU-U.S. Data Privacy Framework (DPF), ergänzt um Standardvertragsklauseln (SCC) der
          EU-Kommission als zusätzliche Absicherung. Weitere Informationen: <CfLink />.
        </li>
      </ul>
      <h2>5. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange wie nötig. Auf Wunsch löschen wir Ihr Konto und alle
        zugehörigen Daten unverzüglich, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>
      <h2>6. Ihre Rechte (Art. 15–22 DSGVO)</h2>
      <ul>
        <li><strong>Auskunft</strong> (Art. 15)</li>
        <li><strong>Berichtigung</strong> (Art. 16)</li>
        <li><strong>Löschung</strong> (Art. 17)</li>
        <li><strong>Einschränkung</strong> (Art. 18)</li>
        <li><strong>Datenübertragbarkeit</strong> (Art. 20)</li>
        <li><strong>Widerspruch</strong> (Art. 21)</li>
        <li><strong>Widerruf einer erteilten Einwilligung</strong> mit Wirkung für die Zukunft (Art. 7 Abs. 3)</li>
      </ul>
      <p>Zur Ausübung Ihrer Rechte: <Mail /></p>
      <h2>7. Beschwerderecht bei der zuständigen Aufsichtsbehörde</h2>
      <p>
        Im Falle von Verstößen gegen die DSGVO steht Ihnen ein Beschwerderecht bei einer Aufsichtsbehörde zu.
        Die für uns zuständige Aufsichtsbehörde ist:
      </p>
      <Authority />
    </>
  ),
  en: (
    <>
      <p className="text-slate-500 text-sm mb-8">Last updated: August 2025</p>
      <h2>1. Controller</h2>
      <p>{COMPANY.owner} / {COMPANY.brand}<br />Email: <Mail /></p>
      <h2>2. What data we collect and why</h2>
      <h3>2.1 Server log data</h3>
      <p>
        When you visit this website, our web server automatically stores technical access data (IP address, browser
        type, operating system, requested URL, date and time). This data is used solely to keep the service running
        and is deleted after 7 days at the latest. Legal basis: Art. 6(1)(f) GDPR.
      </p>
      <h3>2.2 Contact requests</h3>
      <p>
        If you contact us via the contact form or by email, we store your details solely to process your request.
        Legal basis: Art. 6(1)(b) and (f) GDPR.
      </p>
      <h3>2.3 Use of the platform (app) and Tinta Agent</h3>
      <p>When you register for and use the Tinta Lab platform (app.tinta-lab.de), we process the following data:</p>
      <ul>
        <li>Name and email address (for account management and communication)</li>
        <li>Operating status signals of your Home Assistant system (heartbeat, system status, agent version — whether the system is reachable)</li>
        <li>
          Support session log: for every remote maintenance session you have explicitly approved, we record the time,
          duration, the access reason you selected and the assigned support staff ID. For traceability, this log is
          cryptographically chained (SHA-256 hash chain) and cannot be altered afterwards without detection.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> process: passwords, raw sensor or binary sensor data, camera images or videos, or
        any other personal usage data of your smart home devices. Your home automation data (devices, scenes,
        history) remains exclusively on your own hardware — we have no access to it.
      </p>
      <p>
        Legal basis: Art. 6(1)(b) GDPR (performance of contract) for account management and system maintenance;
        Art. 6(1)(a) GDPR (consent) and Art. 6(1)(f) GDPR (legitimate interest in IT security and accountability)
        for the support session log.
      </p>
      <h2>3. Cookies and tracking</h2>
      <p>
        This website (tinta-lab.de) uses no advertising or tracking cookies. The app only sets technically necessary
        session cookies for authentication. No third-party trackers are used.
      </p>
      <h2>4. Disclosure to third parties</h2>
      <ul>
        <li><strong>Hosting infrastructure</strong>: GDPR-compliant EU provider.</li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA): provides the
          encrypted reverse tunnel (Cloudflare Tunnel) through which remote access to your system works without
          opening local router ports, and delivers this website. Cloudflare only processes transport metadata.
          Transfers to the USA are based on Cloudflare’s certification under the EU-U.S. Data Privacy Framework
          (DPF), supplemented by the European Commission’s Standard Contractual Clauses (SCC) as an additional
          safeguard. More information: <CfLink />.
        </li>
      </ul>
      <h2>5. Retention period</h2>
      <p>
        We keep personal data only as long as necessary. On request, we delete your account and all related data
        without delay, unless statutory retention obligations prevent this.
      </p>
      <h2>6. Your rights (Art. 15–22 GDPR)</h2>
      <ul>
        <li><strong>Access</strong> (Art. 15)</li>
        <li><strong>Rectification</strong> (Art. 16)</li>
        <li><strong>Erasure</strong> (Art. 17)</li>
        <li><strong>Restriction of processing</strong> (Art. 18)</li>
        <li><strong>Data portability</strong> (Art. 20)</li>
        <li><strong>Objection</strong> (Art. 21)</li>
        <li><strong>Withdrawal of consent</strong> with effect for the future (Art. 7(3))</li>
      </ul>
      <p>To exercise your rights: <Mail /></p>
      <h2>7. Right to lodge a complaint with the supervisory authority</h2>
      <p>If you believe the GDPR has been infringed, you have the right to lodge a complaint with a supervisory authority. The authority responsible for us is:</p>
      <Authority />
    </>
  ),
  it: (
    <>
      <p className="text-slate-500 text-sm mb-8">Ultimo aggiornamento: agosto 2025</p>
      <h2>1. Titolare del trattamento</h2>
      <p>{COMPANY.owner} / {COMPANY.brand}<br />Email: <Mail /></p>
      <h2>2. Quali dati raccogliamo e perché</h2>
      <h3>2.1 Dati di log del server</h3>
      <p>
        Quando visiti questo sito, il nostro server web memorizza automaticamente dati tecnici di accesso
        (indirizzo IP, tipo di browser, sistema operativo, URL richiesto, data e ora). Questi dati servono
        esclusivamente a garantire il funzionamento e vengono cancellati al più tardi dopo 7 giorni.
        Base giuridica: art. 6, par. 1, lett. f GDPR.
      </p>
      <h3>2.2 Richieste di contatto</h3>
      <p>
        Se ci contatti tramite il modulo di contatto o via email, conserviamo i tuoi dati esclusivamente per
        gestire la tua richiesta. Base giuridica: art. 6, par. 1, lett. b e f GDPR.
      </p>
      <h3>2.3 Uso della piattaforma (app) e Tinta Agent</h3>
      <p>Con la registrazione e l’uso della piattaforma Tinta Lab (app.tinta-lab.de) trattiamo i seguenti dati:</p>
      <ul>
        <li>Nome e indirizzo email (per la gestione dell’account e la comunicazione)</li>
        <li>Segnali sullo stato di funzionamento del tuo sistema Home Assistant (heartbeat, stato del sistema, versione dell’Agent — se il sistema è raggiungibile)</li>
        <li>
          Registro delle sessioni di supporto: per ogni sessione di assistenza remota da te esplicitamente autorizzata
          registriamo data e ora, durata, il motivo d’accesso da te scelto e l’ID del membro del supporto assegnato.
          Per garantirne la tracciabilità, il registro è concatenato crittograficamente (catena di hash SHA-256) e non
          può essere modificato successivamente senza che ciò venga rilevato.
        </li>
      </ul>
      <p>
        <strong>Non</strong> trattiamo: password, dati grezzi di sensori o sensori binari, immagini o video delle
        telecamere, né altri dati personali di utilizzo dei tuoi dispositivi smart home. I dati della tua domotica
        (dispositivi, scene, cronologia) restano esclusivamente sul tuo hardware: non abbiamo accesso a essi.
      </p>
      <p>
        Base giuridica: art. 6, par. 1, lett. b GDPR (esecuzione del contratto) per la gestione dell’account e la
        manutenzione del sistema; art. 6, par. 1, lett. a GDPR (consenso) e art. 6, par. 1, lett. f GDPR (legittimo
        interesse alla sicurezza informatica e alla tracciabilità) per il registro delle sessioni di supporto.
      </p>
      <h2>3. Cookie e tracciamento</h2>
      <p>
        Questo sito (tinta-lab.de) non utilizza cookie pubblicitari o di tracciamento. L’app imposta solo cookie
        di sessione tecnicamente necessari per l’autenticazione. Non vengono utilizzati tracker di terze parti.
      </p>
      <h2>4. Comunicazione a terzi</h2>
      <ul>
        <li><strong>Infrastruttura di hosting</strong>: fornitore UE conforme al GDPR.</li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA): fornisce il
          tunnel inverso cifrato (Cloudflare Tunnel) che consente l’accesso remoto al tuo sistema senza aprire porte
          sul router, e distribuisce questo sito. Cloudflare tratta solo metadati di trasporto. Il trasferimento dei
          dati negli USA si basa sulla certificazione di Cloudflare nell’ambito dell’EU-U.S. Data Privacy Framework
          (DPF), integrata dalle clausole contrattuali standard (SCC) della Commissione europea come garanzia
          aggiuntiva. Ulteriori informazioni: <CfLink />.
        </li>
      </ul>
      <h2>5. Periodo di conservazione</h2>
      <p>
        Conserviamo i dati personali solo per il tempo necessario. Su richiesta cancelliamo senza indugio il tuo
        account e tutti i dati collegati, salvo obblighi di conservazione previsti dalla legge.
      </p>
      <h2>6. I tuoi diritti (artt. 15–22 GDPR)</h2>
      <ul>
        <li><strong>Accesso</strong> (art. 15)</li>
        <li><strong>Rettifica</strong> (art. 16)</li>
        <li><strong>Cancellazione</strong> (art. 17)</li>
        <li><strong>Limitazione del trattamento</strong> (art. 18)</li>
        <li><strong>Portabilità dei dati</strong> (art. 20)</li>
        <li><strong>Opposizione</strong> (art. 21)</li>
        <li><strong>Revoca del consenso</strong> con effetto per il futuro (art. 7, par. 3)</li>
      </ul>
      <p>Per esercitare i tuoi diritti: <Mail /></p>
      <h2>7. Diritto di reclamo all’autorità di controllo</h2>
      <p>In caso di violazioni del GDPR hai il diritto di presentare reclamo a un’autorità di controllo. L’autorità competente per noi è:</p>
      <Authority />
    </>
  ),
  ru: (
    <>
      <p className="text-slate-500 text-sm mb-8">Редакция: август 2025</p>
      <h2>1. Ответственный за обработку данных</h2>
      <p>{COMPANY.owner} / {COMPANY.brand}<br />Эл. почта: <Mail /></p>
      <h2>2. Какие данные мы собираем и зачем</h2>
      <h3>2.1 Журналы веб-сервера</h3>
      <p>
        При посещении сайта наш веб-сервер автоматически сохраняет технические данные доступа (IP-адрес, тип
        браузера, операционная система, запрошенный URL, дата и время). Эти данные используются только для
        обеспечения работы сайта и удаляются не позднее чем через 7 дней. Правовое основание: ст. 6 п. 1 лит. f GDPR.
      </p>
      <h3>2.2 Обращения через форму связи</h3>
      <p>
        Если вы связываетесь с нами через форму обратной связи или по электронной почте, мы храним ваши данные
        только для обработки обращения. Правовое основание: ст. 6 п. 1 лит. b и f GDPR.
      </p>
      <h3>2.3 Использование платформы (приложения) и Tinta Agent</h3>
      <p>При регистрации и использовании платформы Tinta Lab (app.tinta-lab.de) обрабатываются следующие данные:</p>
      <ul>
        <li>Имя и адрес электронной почты (для ведения аккаунта и связи с вами)</li>
        <li>Сигналы о состоянии вашей системы Home Assistant (heartbeat, статус системы, версия агента — доступна ли система)</li>
        <li>
          Журнал сессий поддержки: для каждой сессии удалённого обслуживания, которую вы явно разрешили, мы
          фиксируем время, длительность, выбранную вами причину доступа и ID назначенного сотрудника поддержки.
          Для прослеживаемости журнал защищён криптографической цепочкой (SHA-256) и не может быть незаметно изменён задним числом.
        </li>
      </ul>
      <p>
        Мы <strong>не обрабатываем</strong>: пароли, «сырые» данные датчиков, изображения и видео с камер, а также
        иные персональные данные об использовании ваших устройств умного дома. Данные вашей домашней автоматизации
        (устройства, сценарии, история) остаются исключительно на вашем оборудовании — у нас нет к ним доступа.
      </p>
      <p>
        Правовое основание: ст. 6 п. 1 лит. b GDPR (исполнение договора) — для ведения аккаунта и обслуживания
        системы; ст. 6 п. 1 лит. a GDPR (согласие) и ст. 6 п. 1 лит. f GDPR (законный интерес в информационной
        безопасности и подотчётности) — для журнала сессий поддержки.
      </p>
      <h2>3. Cookies и отслеживание</h2>
      <p>
        Этот сайт (tinta-lab.de) не использует рекламные и отслеживающие cookies. Приложение устанавливает только
        технически необходимые сессионные cookies для входа в систему. Сторонние трекеры не используются.
      </p>
      <h2>4. Передача данных третьим лицам</h2>
      <ul>
        <li><strong>Хостинг</strong>: поставщик из ЕС, соблюдающий GDPR.</li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA): предоставляет
          зашифрованный обратный туннель (Cloudflare Tunnel), через который работает удалённый доступ к вашей системе
          без открытия портов на роутере, а также доставку этого сайта. Cloudflare обрабатывает только транспортные
          метаданные. Передача данных в США основана на сертификации Cloudflare по EU-U.S. Data Privacy Framework
          (DPF) и дополнительно защищена стандартными договорными условиями (SCC) Еврокомиссии. Подробнее: <CfLink />.
        </li>
      </ul>
      <h2>5. Срок хранения</h2>
      <p>
        Мы храним персональные данные только столько, сколько необходимо. По вашему запросу мы незамедлительно
        удалим аккаунт и все связанные данные, если этому не препятствуют обязательные сроки хранения по закону.
      </p>
      <h2>6. Ваши права (ст. 15–22 GDPR)</h2>
      <ul>
        <li><strong>Право на доступ</strong> (ст. 15)</li>
        <li><strong>Право на исправление</strong> (ст. 16)</li>
        <li><strong>Право на удаление</strong> (ст. 17)</li>
        <li><strong>Право на ограничение обработки</strong> (ст. 18)</li>
        <li><strong>Право на переносимость данных</strong> (ст. 20)</li>
        <li><strong>Право на возражение</strong> (ст. 21)</li>
        <li><strong>Отзыв согласия</strong> на будущее время (ст. 7 п. 3)</li>
      </ul>
      <p>Чтобы воспользоваться своими правами, напишите нам: <Mail /></p>
      <h2>7. Право на жалобу в надзорный орган</h2>
      <p>Если вы считаете, что GDPR нарушен, вы вправе подать жалобу в надзорный орган. Компетентный для нас орган:</p>
      <Authority />
    </>
  ),
};

export default async function Datenschutz({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'datenschutz' });
  const note = locale !== 'de' ? t('note') : undefined;
  return (
    <LegalPage title={t('title')} note={note}>
      {CONTENT[locale] ?? CONTENT.de}
    </LegalPage>
  );
}
