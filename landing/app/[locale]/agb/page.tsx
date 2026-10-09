import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';
import { COMPANY, legalHref } from '@/components/legal/company';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agb' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const who = `${COMPANY.owner} / ${COMPANY.brand}`;

// German is the binding version; the others are convenience translations.
const CONTENT: Record<string, (privacyHref: string) => React.ReactNode> = {
  de: (privacy) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>§ 1 Geltungsbereich</h2>
      <p>Diese AGB gelten für alle Verträge zwischen {who} und den Kunden über die Nutzung der Tinta Lab Smart-Home-Managementplattform.</p>
      <h2>§ 2 Leistungsgegenstand</h2>
      <ul>
        <li>Installation und Einrichtung von Home Assistant auf kundeneigener Hardware</li>
        <li>Bereitstellung einer gesicherten Fernzugriff-Infrastruktur (Cloudflare Tunnel)</li>
        <li>Monitoring des Betriebszustands</li>
        <li>Technischer Support und Optimierung von Automatisierungen</li>
      </ul>
      <p>Der Fernzugriff ist technisch nur möglich, wenn der Kunde diesen aktiv freigibt.</p>
      <h2>§ 3 Vertragsschluss</h2>
      <p>Der Vertrag kommt durch schriftliche Bestätigung per E-Mail zustande. Die Nutzung der Plattform setzt die Registrierung und Annahme dieser AGB voraus.</p>
      <h2>§ 4 Mitwirkungspflichten des Kunden</h2>
      <ul>
        <li>Stabile Internetverbindung für das Home-Assistant-Gerät</li>
        <li>Dauerhaft eingeschaltetes und erreichbares Gerät</li>
        <li>Bereitstellung von Zugangsdaten auf Anfrage, sofern für die Einrichtung erforderlich</li>
      </ul>
      <h2>§ 5 Vergütung</h2>
      <p>Die Vergütung richtet sich nach der individuellen Vereinbarung. Keine versteckten Gebühren. Die Abrechnung erfolgt je nach Vereinbarung monatlich oder einmalig.</p>
      <h2>§ 6 Datenschutz und Auftragsverarbeitung</h2>
      <p>Alle Smart-Home-Daten verbleiben auf der Hardware des Kunden. Details: <a href={privacy}>Datenschutzerklärung</a>.</p>
      <p>
        Soweit der Kunde die Dienste von Tinta Lab als Unternehmer im Sinne des § 14 BGB nutzt und hierbei
        personenbezogene Daten Dritter verarbeitet werden, schließen die Parteien eine Vereinbarung zur
        Auftragsverarbeitung (AVV) gemäß Art. 28 DSGVO. Tinta Lab stellt hierfür auf Anfrage ein entsprechendes
        Standard-AVV-Muster zur Verfügung.
      </p>
      <h2>§ 7 Fernwartungszugriff</h2>
      <p>Jeder Zugriff erfordert die aktive Freigabe durch den Kunden. Jede Sitzung wird protokolliert und ist jederzeit einsehbar. Der Kunde kann eine laufende Sitzung jederzeit beenden.</p>
      <h2>§ 8 Haftung</h2>
      <p>Tinta Lab haftet unbegrenzt bei Vorsatz und grober Fahrlässigkeit. Im Übrigen ist die Haftung auf den vertragstypisch vorhersehbaren Schaden begrenzt. Für Datenverluste durch Ausfall der Kundenhardware übernimmt Tinta Lab keine Haftung.</p>
      <h2>§ 9 Kündigung</h2>
      <p>Kündigung mit 30 Tagen Frist zum Monatsende. Nach Kündigung werden alle plattformseitig gespeicherten Daten gelöscht. Kundendaten auf eigener Hardware bleiben vollständig erhalten.</p>
      <h2>§ 10 Anzuwendendes Recht</h2>
      <p>Deutsches Recht. Gerichtsstand: Sitz von Tinta Lab.</p>
      <h2>§ 11 Salvatorische Klausel</h2>
      <p>Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
    </>
  ),
  en: (privacy) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Last updated: August 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>§ 1 Scope</h2>
      <p>These terms apply to all contracts between {who} and its customers for the use of the Tinta Lab smart home management platform.</p>
      <h2>§ 2 Services</h2>
      <ul>
        <li>Installation and setup of Home Assistant on hardware owned by the customer</li>
        <li>Provision of a secured remote access infrastructure (Cloudflare Tunnel)</li>
        <li>Monitoring of the operating status</li>
        <li>Technical support and optimisation of automations</li>
      </ul>
      <p>Remote access is technically only possible when the customer actively grants it.</p>
      <h2>§ 3 Conclusion of contract</h2>
      <p>The contract is concluded by written confirmation by email. Use of the platform requires registration and acceptance of these terms.</p>
      <h2>§ 4 Customer’s obligations to cooperate</h2>
      <ul>
        <li>A stable internet connection for the Home Assistant device</li>
        <li>The device is permanently switched on and reachable</li>
        <li>Access credentials are provided on request where required for the setup</li>
      </ul>
      <h2>§ 5 Fees</h2>
      <p>Fees are based on the individual agreement. No hidden charges. Billing is monthly or one-off, depending on the agreement.</p>
      <h2>§ 6 Data protection and data processing</h2>
      <p>All smart home data remains on the customer’s hardware. Details: <a href={privacy}>Privacy Policy</a>.</p>
      <p>
        Where the customer uses Tinta Lab’s services as a business within the meaning of § 14 BGB and personal data
        of third parties is processed in the course of this, the parties conclude a data processing agreement (DPA)
        pursuant to Art. 28 GDPR. Tinta Lab provides a standard DPA template on request.
      </p>
      <h2>§ 7 Remote maintenance access</h2>
      <p>Every access requires the customer’s active approval. Every session is logged and can be reviewed at any time. The customer can end an ongoing session at any time.</p>
      <h2>§ 8 Liability</h2>
      <p>Tinta Lab is liable without limitation for intent and gross negligence. Otherwise, liability is limited to the damage typically foreseeable under the contract. Tinta Lab accepts no liability for data loss caused by failure of the customer’s hardware.</p>
      <h2>§ 9 Termination</h2>
      <p>Either party may terminate with 30 days’ notice to the end of a month. After termination, all data stored on the platform is deleted. Customer data on the customer’s own hardware remains fully intact.</p>
      <h2>§ 10 Applicable law</h2>
      <p>German law applies. Place of jurisdiction: the registered office of Tinta Lab.</p>
      <h2>§ 11 Severability</h2>
      <p>Should individual provisions be invalid, the validity of the remaining provisions remains unaffected.</p>
    </>
  ),
  it: (privacy) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Ultimo aggiornamento: agosto 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>§ 1 Ambito di applicazione</h2>
      <p>Le presenti condizioni si applicano a tutti i contratti tra {who} e i clienti per l’utilizzo della piattaforma di gestione smart home Tinta Lab.</p>
      <h2>§ 2 Oggetto dei servizi</h2>
      <ul>
        <li>Installazione e configurazione di Home Assistant sull’hardware del cliente</li>
        <li>Fornitura di un’infrastruttura protetta per l’accesso remoto (Cloudflare Tunnel)</li>
        <li>Monitoraggio dello stato di funzionamento</li>
        <li>Supporto tecnico e ottimizzazione delle automazioni</li>
      </ul>
      <p>L’accesso remoto è tecnicamente possibile solo se il cliente lo autorizza attivamente.</p>
      <h2>§ 3 Conclusione del contratto</h2>
      <p>Il contratto si conclude con conferma scritta via email. L’uso della piattaforma presuppone la registrazione e l’accettazione delle presenti condizioni.</p>
      <h2>§ 4 Obblighi di collaborazione del cliente</h2>
      <ul>
        <li>Connessione internet stabile per il dispositivo Home Assistant</li>
        <li>Dispositivo sempre acceso e raggiungibile</li>
        <li>Messa a disposizione delle credenziali su richiesta, se necessarie per la configurazione</li>
      </ul>
      <h2>§ 5 Corrispettivo</h2>
      <p>Il corrispettivo è stabilito dall’accordo individuale. Nessun costo nascosto. La fatturazione avviene mensilmente o una tantum, secondo l’accordo.</p>
      <h2>§ 6 Protezione dei dati e trattamento per conto</h2>
      <p>Tutti i dati della smart home restano sull’hardware del cliente. Dettagli: <a href={privacy}>Informativa sulla privacy</a>.</p>
      <p>
        Se il cliente utilizza i servizi di Tinta Lab in qualità di imprenditore ai sensi del § 14 BGB e vengono
        trattati dati personali di terzi, le parti stipulano un accordo sul trattamento dei dati (DPA) ai sensi
        dell’art. 28 GDPR. Tinta Lab mette a disposizione su richiesta un modello standard.
      </p>
      <h2>§ 7 Accesso per assistenza remota</h2>
      <p>Ogni accesso richiede l’autorizzazione attiva del cliente. Ogni sessione viene registrata ed è consultabile in qualsiasi momento. Il cliente può interrompere una sessione in corso in qualsiasi momento.</p>
      <h2>§ 8 Responsabilità</h2>
      <p>Tinta Lab risponde senza limiti in caso di dolo e colpa grave. Negli altri casi la responsabilità è limitata al danno prevedibile tipico del contratto. Tinta Lab non risponde della perdita di dati dovuta a guasti dell’hardware del cliente.</p>
      <h2>§ 9 Recesso dal contratto</h2>
      <p>Disdetta con preavviso di 30 giorni alla fine del mese. Dopo la disdetta tutti i dati memorizzati sulla piattaforma vengono cancellati. I dati del cliente sul proprio hardware restano integralmente conservati.</p>
      <h2>§ 10 Legge applicabile</h2>
      <p>Si applica il diritto tedesco. Foro competente: la sede di Tinta Lab.</p>
      <h2>§ 11 Clausola di salvaguardia</h2>
      <p>L’eventuale invalidità di singole disposizioni non pregiudica la validità delle restanti.</p>
    </>
  ),
  ru: (privacy) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Редакция: август 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>§ 1 Сфера применения</h2>
      <p>Настоящие условия применяются ко всем договорам между {who} и клиентами об использовании платформы управления умным домом Tinta Lab.</p>
      <h2>§ 2 Предмет услуг</h2>
      <ul>
        <li>Установка и настройка Home Assistant на оборудовании клиента</li>
        <li>Предоставление защищённой инфраструктуры удалённого доступа (Cloudflare Tunnel)</li>
        <li>Мониторинг рабочего состояния</li>
        <li>Техническая поддержка и оптимизация автоматизаций</li>
      </ul>
      <p>Удалённый доступ технически возможен только тогда, когда клиент сам его открывает.</p>
      <h2>§ 3 Заключение договора</h2>
      <p>Договор считается заключённым после письменного подтверждения по электронной почте. Для использования платформы необходимы регистрация и принятие настоящих условий.</p>
      <h2>§ 4 Обязанности клиента</h2>
      <ul>
        <li>Стабильное подключение к интернету для устройства с Home Assistant</li>
        <li>Устройство постоянно включено и доступно</li>
        <li>Предоставление данных для входа по запросу, если они нужны для настройки</li>
      </ul>
      <h2>§ 5 Оплата</h2>
      <p>Стоимость определяется индивидуальной договорённостью. Скрытых платежей нет. Оплата — ежемесячно или единоразово, по договорённости.</p>
      <h2>§ 6 Защита данных и обработка по поручению</h2>
      <p>Все данные умного дома остаются на оборудовании клиента. Подробнее: <a href={privacy}>Политика конфиденциальности</a>.</p>
      <p>
        Если клиент пользуется услугами Tinta Lab как предприниматель в смысле § 14 BGB и при этом обрабатываются
        персональные данные третьих лиц, стороны заключают соглашение об обработке данных по поручению (AVV/DPA)
        согласно ст. 28 GDPR. Tinta Lab предоставляет типовой образец по запросу.
      </p>
      <h2>§ 7 Удалённый доступ для обслуживания</h2>
      <p>Каждый доступ требует активного разрешения клиента. Каждая сессия записывается в журнал и доступна для просмотра в любое время. Клиент может прервать текущую сессию в любой момент.</p>
      <h2>§ 8 Ответственность</h2>
      <p>Tinta Lab несёт неограниченную ответственность за умысел и грубую неосторожность. В остальных случаях ответственность ограничена ущербом, типично предсказуемым для договора. Tinta Lab не отвечает за потерю данных из-за отказа оборудования клиента.</p>
      <h2>§ 9 Расторжение</h2>
      <p>Расторжение с уведомлением за 30 дней до конца месяца. После расторжения все данные, хранящиеся на платформе, удаляются. Данные клиента на его собственном оборудовании полностью сохраняются.</p>
      <h2>§ 10 Применимое право</h2>
      <p>Применяется право Германии. Место рассмотрения споров — по месту нахождения Tinta Lab.</p>
      <h2>§ 11 Оговорка о делимости</h2>
      <p>Если отдельные положения окажутся недействительными, это не влияет на действительность остальных.</p>
    </>
  ),
};

export default async function AGB({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'agb' });
  const note = locale !== 'de' ? t('note') : undefined;
  return (
    <LegalPage title={t('title')} note={note}>
      {(CONTENT[locale] ?? CONTENT.de)(legalHref(locale, 'datenschutz'))}
    </LegalPage>
  );
}
