import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LegalPage from '@/components/LegalPage';
import { COMPANY, legalHref } from '@/components/legal/company';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'widerruf' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

// The model withdrawal notice must name the provider with a postal address.
const Addressee = ({ email }: { email: string }) => (
  <p>
    {COMPANY.brand}, {COMPANY.owner}<br />
    {COMPANY.street}<br />
    {COMPANY.city}<br />
    {email}: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
  </p>
);

type Links = { agb: string; privacy: string };

// German is the binding version; the others are convenience translations.
const CONTENT: Record<string, (l: Links) => React.ReactNode> = {
  de: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Stand: August 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>Widerrufsrecht</h2>
      <p>Verbrauchern steht bei Vertragsschluss im Fernabsatz (z. B. Registrierung und Buchung über app.tinta-lab.de) ein gesetzliches Widerrufsrecht zu. Es gilt Folgendes:</p>
      <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.</p>
      <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns</p>
      <Addressee email="E-Mail" />
      <p>mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
      <p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
      <h2>Folgen des Widerrufs</h2>
      <p>
        Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben,
        unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren
        Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel,
        das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas
        anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
      </p>
      <h2>Vorzeitiges Erlöschen bei bereits erbrachter Leistung</h2>
      <p>
        Haben Sie verlangt, dass die Dienstleistung (z. B. Einrichtung von Home Assistant, Provisionierung des
        Fernzugriffs) während der Widerrufsfrist beginnen soll, und widerrufen Sie den Vertrag dennoch, so haben Sie
        uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der
        Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Leistungen im
        Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Leistungen entspricht. Ihr Widerrufsrecht erlischt
        vorzeitig, wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung erst begonnen haben,
        nachdem Sie dazu Ihre ausdrückliche Zustimmung gegeben und gleichzeitig Ihre Kenntnis davon bestätigt haben,
        dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren.
      </p>
      <h2>Ausschluss / vorzeitiges Erlöschen bei digitalen Inhalten</h2>
      <p>
        Bei Verträgen zur Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten
        erlischt das Widerrufsrecht ebenfalls vorzeitig, wenn wir mit der Ausführung des Vertrags erst begonnen haben,
        nachdem Sie ausdrücklich zugestimmt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung des
        Vertrags beginnen, und Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der
        Ausführung des Vertrags Ihr Widerrufsrecht verlieren.
      </p>
      <hr />
      <h2>Muster-Widerrufsformular</h2>
      <p>(Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
      <p>An:</p>
      <Addressee email="E-Mail" />
      <p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*):</p>
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
      <p>Das vorstehende Widerrufsrecht gilt ausschließlich für Verbraucher im Sinne des § 13 BGB. Für Unternehmer (§ 14 BGB), insbesondere Geschäftskunden im B2B-Bereich, besteht kein gesetzliches Widerrufsrecht.</p>
      <p className="text-slate-500 text-sm">Diese Widerrufsbelehrung ergänzt die <a href={l.agb}>AGB</a> und die <a href={l.privacy}>Datenschutzerklärung</a>.</p>
    </>
  ),
  en: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Last updated: August 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>Right of withdrawal</h2>
      <p>Consumers have a statutory right of withdrawal for contracts concluded at a distance (e.g. registration and booking via app.tinta-lab.de). The following applies:</p>
      <p>You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day the contract is concluded.</p>
      <p>To exercise your right of withdrawal, you must inform us</p>
      <Addressee email="Email" />
      <p>of your decision to withdraw from this contract by means of a clear statement (e.g. a letter sent by post or an email). You may use the model withdrawal form below, but this is not mandatory.</p>
      <p>To meet the withdrawal deadline, it is sufficient for you to send your notice of withdrawal before the withdrawal period expires.</p>
      <h2>Consequences of withdrawal</h2>
      <p>
        If you withdraw from this contract, we will refund all payments received from you without undue delay and in
        any event no later than fourteen days from the day on which we receive notice of your withdrawal. We will use
        the same means of payment you used for the original transaction, unless expressly agreed otherwise with you;
        in no case will you be charged any fees for this refund.
      </p>
      <h2>Early expiry when the service has already been provided</h2>
      <p>
        If you requested that the service (e.g. setting up Home Assistant, provisioning remote access) should begin
        during the withdrawal period and you nevertheless withdraw, you must pay us a reasonable amount corresponding
        to the proportion of the services already provided up to the time you inform us of your withdrawal, compared
        with the full scope of services under the contract. Your right of withdrawal expires early once we have fully
        performed the service, provided that we only began performance after you gave your express consent and at the
        same time acknowledged that you lose your right of withdrawal once we have fully performed the contract.
      </p>
      <h2>Exclusion / early expiry for digital content</h2>
      <p>
        For contracts for the supply of digital content not on a physical medium, the right of withdrawal also expires
        early if we only began performance after you expressly agreed that we start before the end of the withdrawal
        period and you acknowledged that by giving this consent you lose your right of withdrawal when performance begins.
      </p>
      <hr />
      <h2>Model withdrawal form</h2>
      <p>(If you wish to withdraw from the contract, please complete this form and send it back.)</p>
      <p>To:</p>
      <Addressee email="Email" />
      <p>I/We (*) hereby withdraw from the contract concluded by me/us (*) for the provision of the following service (*):</p>
      <ul>
        <li>Ordered on (*) / received on (*): __________</li>
        <li>Name of consumer(s): __________</li>
        <li>Address of consumer(s): __________</li>
        <li>Signature of consumer(s) (only if notified on paper): __________</li>
        <li>Date: __________</li>
      </ul>
      <p className="text-slate-500 text-sm">(*) Delete as appropriate.</p>
      <hr />
      <h2>No right of withdrawal for business customers</h2>
      <p>The above right of withdrawal applies only to consumers within the meaning of § 13 BGB. Businesses (§ 14 BGB), in particular B2B customers, have no statutory right of withdrawal.</p>
      <p className="text-slate-500 text-sm">This notice supplements the <a href={l.agb}>Terms of Service</a> and the <a href={l.privacy}>Privacy Policy</a>.</p>
    </>
  ),
  it: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Ultimo aggiornamento: agosto 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>Diritto di recesso</h2>
      <p>Ai consumatori spetta un diritto di recesso legale per i contratti conclusi a distanza (ad es. registrazione e prenotazione tramite app.tinta-lab.de). Si applica quanto segue:</p>
      <p>Hai il diritto di recedere dal presente contratto entro quattordici giorni senza indicarne le ragioni. Il periodo di recesso è di quattordici giorni dalla conclusione del contratto.</p>
      <p>Per esercitare il diritto di recesso devi informarci</p>
      <Addressee email="Email" />
      <p>della tua decisione di recedere dal contratto tramite una dichiarazione esplicita (ad es. lettera inviata per posta o email). Puoi utilizzare il modulo tipo di recesso riportato sotto, ma non è obbligatorio.</p>
      <p>Per rispettare il termine di recesso è sufficiente inviare la comunicazione prima della scadenza del periodo di recesso.</p>
      <h2>Effetti del recesso</h2>
      <p>
        Se recedi dal contratto, ti rimborseremo tutti i pagamenti ricevuti senza indebito ritardo e in ogni caso entro
        quattordici giorni dal giorno in cui riceviamo la comunicazione del recesso. Utilizzeremo lo stesso mezzo di
        pagamento da te usato per la transazione iniziale, salvo diverso accordo espresso; in nessun caso ti verranno
        addebitati costi per il rimborso.
      </p>
      <h2>Estinzione anticipata se il servizio è già stato prestato</h2>
      <p>
        Se hai chiesto che il servizio (ad es. configurazione di Home Assistant, attivazione dell’accesso remoto)
        iniziasse durante il periodo di recesso e recedi comunque, dovrai versarci un importo proporzionato alle
        prestazioni già fornite fino al momento in cui ci comunichi il recesso, rispetto all’insieme delle prestazioni
        previste dal contratto. Il diritto di recesso si estingue anticipatamente quando abbiamo prestato
        integralmente il servizio, se abbiamo iniziato solo dopo il tuo consenso espresso e la tua conferma di essere
        consapevole di perdere il diritto di recesso a esecuzione completa del contratto.
      </p>
      <h2>Esclusione / estinzione anticipata per i contenuti digitali</h2>
      <p>
        Per i contratti di fornitura di contenuti digitali non su supporto materiale, il diritto di recesso si estingue
        anticipatamente anche se abbiamo iniziato l’esecuzione solo dopo il tuo consenso espresso a iniziare prima della
        scadenza del periodo di recesso e la tua conferma di essere consapevole di perdere così il diritto di recesso.
      </p>
      <hr />
      <h2>Modulo tipo di recesso</h2>
      <p>(Compila e restituisci il presente modulo solo se desideri recedere dal contratto.)</p>
      <p>Destinatario:</p>
      <Addressee email="Email" />
      <p>Con la presente io/noi (*) notifichiamo il recesso dal mio/nostro (*) contratto per la prestazione del seguente servizio (*):</p>
      <ul>
        <li>Ordinato il (*) / ricevuto il (*): __________</li>
        <li>Nome del/dei consumatore/i: __________</li>
        <li>Indirizzo del/dei consumatore/i: __________</li>
        <li>Firma del/dei consumatore/i (solo se il modulo è inviato su carta): __________</li>
        <li>Data: __________</li>
      </ul>
      <p className="text-slate-500 text-sm">(*) Cancellare la dicitura inutile.</p>
      <hr />
      <h2>Nessun diritto di recesso per i clienti business</h2>
      <p>Il diritto di recesso sopra descritto vale esclusivamente per i consumatori ai sensi del § 13 BGB. Gli imprenditori (§ 14 BGB), in particolare i clienti B2B, non hanno un diritto di recesso legale.</p>
      <p className="text-slate-500 text-sm">Queste informazioni integrano le <a href={l.agb}>Condizioni generali</a> e l’<a href={l.privacy}>Informativa sulla privacy</a>.</p>
    </>
  ),
  ru: (l) => (
    <>
      <p className="text-slate-500 text-sm mb-8">Редакция: август 2025 — {COMPANY.brand} / {COMPANY.owner}</p>
      <h2>Право на отказ от договора</h2>
      <p>Потребителям при заключении договора дистанционно (например, при регистрации и заказе через app.tinta-lab.de) предоставляется законное право на отказ. Действует следующее:</p>
      <p>Вы вправе отказаться от настоящего договора в течение четырнадцати дней без объяснения причин. Срок отказа составляет четырнадцать дней со дня заключения договора.</p>
      <p>Чтобы воспользоваться правом на отказ, вы должны сообщить нам</p>
      <Addressee email="Эл. почта" />
      <p>о своём решении отказаться от договора в форме однозначного заявления (например, письмом по почте или по электронной почте). Вы можете использовать приведённый ниже образец формы отказа, но это не обязательно.</p>
      <p>Для соблюдения срока достаточно отправить уведомление об отказе до его истечения.</p>
      <h2>Последствия отказа</h2>
      <p>
        Если вы отказываетесь от договора, мы незамедлительно, но не позднее чем через четырнадцать дней со дня
        получения вашего уведомления, возвращаем все полученные от вас платежи. Для возврата мы используем тот же
        способ оплаты, что и при первоначальной операции, если с вами явно не согласовано иное; никаких сборов за
        возврат с вас не взимается.
      </p>
      <h2>Досрочное прекращение права при уже оказанной услуге</h2>
      <p>
        Если вы попросили начать оказание услуги (например, настройку Home Assistant, подключение удалённого доступа)
        в течение срока отказа и всё же отказываетесь от договора, вы оплачиваете нам разумную сумму, соответствующую
        доле услуг, оказанных до момента вашего уведомления об отказе, по отношению к полному объёму услуг по договору.
        Право на отказ прекращается досрочно, если мы полностью оказали услугу и начали её оказание только после
        вашего явного согласия и подтверждения того, что при полном исполнении договора вы теряете право на отказ.
      </p>
      <h2>Исключение / досрочное прекращение для цифрового контента</h2>
      <p>
        По договорам о предоставлении цифрового контента не на материальном носителе право на отказ также прекращается
        досрочно, если мы начали исполнение только после вашего явного согласия начать до истечения срока отказа и
        подтверждения того, что с началом исполнения вы теряете право на отказ.
      </p>
      <hr />
      <h2>Образец формы отказа</h2>
      <p>(Если вы хотите отказаться от договора, заполните эту форму и отправьте её нам.)</p>
      <p>Кому:</p>
      <Addressee email="Эл. почта" />
      <p>Настоящим я/мы (*) отказываюсь/отказываемся (*) от заключённого мной/нами (*) договора на оказание следующей услуги (*):</p>
      <ul>
        <li>Дата заказа (*) / получения (*): __________</li>
        <li>Имя потребителя(-ей): __________</li>
        <li>Адрес потребителя(-ей): __________</li>
        <li>Подпись потребителя(-ей) (только для уведомления на бумаге): __________</li>
        <li>Дата: __________</li>
      </ul>
      <p className="text-slate-500 text-sm">(*) Ненужное зачеркнуть.</p>
      <hr />
      <h2>Для бизнес-клиентов право на отказ не действует</h2>
      <p>Указанное право на отказ распространяется только на потребителей в смысле § 13 BGB. У предпринимателей (§ 14 BGB), в частности клиентов B2B, законного права на отказ нет.</p>
      <p className="text-slate-500 text-sm">Эта информация дополняет <a href={l.agb}>условия обслуживания</a> и <a href={l.privacy}>политику конфиденциальности</a>.</p>
    </>
  ),
};

export default async function Widerruf({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'widerruf' });
  const note = locale !== 'de' ? t('note') : undefined;
  return (
    <LegalPage title={t('title')} note={note}>
      {(CONTENT[locale] ?? CONTENT.de)({ agb: legalHref(locale, 'agb'), privacy: legalHref(locale, 'datenschutz') })}
    </LegalPage>
  );
}
