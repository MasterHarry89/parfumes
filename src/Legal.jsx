import { navigate } from "./lib/navigate";
import { money } from "./lib/catalog";
import {
  FREE_SHIPPING_FROM,
  paymentMethods,
  shippingMethods,
} from "./lib/checkout";

// Seller identification used across every legal page. Values in [brackets] are
// still missing and render highlighted so they cannot slip through unnoticed.
const seller = {
  name: "[Jméno a příjmení / název firmy]",
  ico: "[IČO]",
  address: "[Ulice a č. p., PSČ Město]",
  register: "[Fyzická osoba podnikající dle živnostenského zákona, zapsaná v živnostenském rejstříku]",
  vat: "[Není plátcem DPH]",
  email: "[kontaktní e-mail]",
  phone: "[telefon]",
};
const EFFECTIVE_FROM = "[datum účinnosti]";

const Field = ({ value }) =>
  value.startsWith("[") ? <mark className="legal-todo">{value}</mark> : value;
const S = Object.fromEntries(
  Object.entries(seller).map(([key, value]) => [key, <Field value={value} />]),
);

const Link = ({ to, children }) => (
  <a
    href={to}
    onClick={(event) => {
      event.preventDefault();
      navigate(to);
    }}
  >
    {children}
  </a>
);

const SellerBlock = () => (
  <p>
    {S.name}
    <br />
    IČO: {S.ico}
    <br />
    Sídlo: {S.address}
    <br />
    {S.register}
    <br />
    {S.vat}
    <br />
    E-mail: {S.email}
    <br />
    Telefon: {S.phone}
  </p>
);

export const legalPages = {
  "o-projektu": {
    title: "O projektu",
    content: (
      <>
        <p className="legal-lead">
          Éparfumes vznikl z jednoduché myšlenky: podělit se o vůně, které mám
          rád, s lidmi, kteří je mají rádi stejně.
        </p>

        <h2>Proč to dělám</h2>
        <p>
          Parfémy sbírám už roky. Postupně se mi doma sešla sbírka vůní, ke
          kterým se člověk běžně nedostane – často luxusních, výrazných a
          drahých. A protože vím, jak frustrující je koupit celý flakon
          naslepo, rozhodl jsem se z ní nabídnout vzorky ostatním.
        </p>

        <h2>Konec drahých „blind buy“</h2>
        <p>
          Kdo miluje parfémy, to zná: vůně skvěle zní v recenzích, na papírku
          v obchodě voní úžasně, ale na vlastní kůži, po pár hodinách nošení,
          je to najednou něco úplně jiného. U parfému za několik tisíc korun je
          takový „blind buy“ zbytečně drahý omyl.
        </p>
        <p>
          Vzorek vám dá možnost vůni nosit několik dní, v práci, večer, v
          různém počasí – a teprve potom se rozhodnout, jestli si zaslouží
          místo ve vaší sbírce.
        </p>

        <h2>Komunita, ne velký byznys</h2>
        <p>
          Cílem Éparfumes není obrovský výdělek. Ceny vzorků jsou nastavené
          tak, aby pokryly samotnou vůni, flakonky, balení a dopravu. Jde mi
          hlavně o to, aby se drahé a zajímavé vůně dostaly k lidem, kteří je
          ocení, a aby si je mohli vyzkoušet bez zbytečného rizika.
        </p>

        <h2>Na čem mi záleží</h2>
        <ul>
          <li>
            <strong>Jen originály.</strong> Každý vzorek je plněný z
            originálního flakonu, žádné repliky ani „inspirované“ vůně.
          </li>
          <li>
            <strong>Pečlivé plnění.</strong> Vzorky plním ručně do čistých
            flakonků a každý pečlivě označím.
          </li>
          <li>
            <strong>Upřímná doporučení.</strong> Rád poradím, co zkusit dál –
            napište mi přes stránku <Link to="/kontakt">Kontakt</Link>.
          </li>
        </ul>

        <p>
          Děkuju, že jste tady. Ať najdete vůni, která bude opravdu vaše.
        </p>
        <p>
          <Link to="/kolekce">Prohlédnout vzorky →</Link>
        </p>
      </>
    ),
  },

  "obchodni-podminky": {
    title: "Obchodní podmínky",
    content: (
      <>
        <h2>1. Úvodní ustanovení</h2>
        <p>
          Tyto obchodní podmínky upravují vzájemná práva a povinnosti mezi
          prodávajícím a kupujícím při nákupu zboží v internetovém obchodě
          Éparfumes (dále jen „e-shop“). Prodávajícím je:
        </p>
        <SellerBlock />
        <p>
          Vztahy neupravené těmito podmínkami se řídí zákonem č. 89/2012 Sb.,
          občanský zákoník, a u spotřebitelů také zákonem č. 634/1992 Sb., o
          ochraně spotřebitele. Kupujícím-spotřebitelem je každý, kdo mimo
          rámec své podnikatelské činnosti uzavírá smlouvu s prodávajícím.
        </p>

        <h2>2. Zboží</h2>
        <p>
          E-shop nabízí vzorky originálních parfémů. Vzorky jsou plněny z
          originálních balení výrobců do vzorkovacích flakonků v objemech
          uvedených u každého produktu. Vzorek není originálním balením
          výrobce. Fotografie produktů jsou ilustrativní a zobrazují originální
          balení, ze kterého je vzorek plněn.
        </p>

        <h2>3. Uživatelský účet</h2>
        <p>
          Kupující může nakupovat bez registrace nebo si založit uživatelský
          účet. Je povinen uvádět pravdivé údaje a chránit přístup ke svému
          účtu. Prodávající může účet zrušit, pokud jej kupující nepoužívá déle
          než 3 roky nebo porušuje tyto podmínky.
        </p>

        <h2>4. Uzavření kupní smlouvy</h2>
        <p>
          Prezentace zboží v e-shopu je informativní a není návrhem na
          uzavření smlouvy. Objednávku kupující odesílá tlačítkem „Objednat s
          povinností platby“. Kupní smlouva vzniká doručením potvrzení
          objednávky prodávajícím na e-mail kupujícího. Před odesláním může
          kupující objednávku zkontrolovat a opravit zadané údaje.
        </p>
        <p>
          Prodávající si vyhrazuje právo objednávku nepřijmout, zejména pokud
          zboží není skladem nebo byla u zboží zjevně chybně uvedena cena. V
          takovém případě kupujícího neprodleně kontaktuje a případnou již
          uhrazenou částku vrátí.
        </p>

        <h2>5. Cena a platební podmínky</h2>
        <p>
          Ceny jsou uvedeny v Kč a jsou konečné. {S.vat}. Cena za dopravu a
          případný poplatek za způsob platby jsou uvedeny na stránce{" "}
          <Link to="/doprava-a-platba">Doprava a platba</Link> a v rekapitulaci
          objednávky před jejím odesláním.
        </p>
        <p>
          Při platbě převodem nebo kartou je cena splatná do 7 dnů od uzavření
          smlouvy. Pokud nebude v této lhůtě uhrazena, může prodávající
          objednávku zrušit. Při platbě na dobírku se platí při převzetí
          zásilky. Daňový doklad prodávající zasílá elektronicky.
        </p>

        <h2>6. Dodání zboží</h2>
        <p>
          Zboží odesíláme obvykle do 24 hodin od přijetí objednávky (u platby
          předem od připsání platby) prostřednictvím Zásilkovny. Doručení trvá
          obvykle 1–2 pracovní dny. Zboží dodáváme pouze v rámci České
          republiky. Pokud kupující zásilku nepřevezme, je povinen uhradit
          náklady spojené s jejím opakovaným doručením.
        </p>
        <p>
          Při převzetí zkontrolujte neporušenost obalu. Poškozenou zásilku
          můžete odmítnout převzít nebo poškození zapsat do protokolu
          přepravce a neprodleně nám jej oznámit.
        </p>

        <h2>7. Odstoupení od smlouvy</h2>
        <p>
          Spotřebitel má právo odstoupit od kupní smlouvy bez udání důvodu do
          14 dnů od převzetí zboží. Odstoupení stačí zaslat na e-mail{" "}
          {S.email},
          můžete využít{" "}
          <Link to="/odstoupeni-od-smlouvy">vzorový formulář</Link>. Zboží
          zašlete do 14 dnů od odstoupení na adresu {S.address}. Přímé náklady
          na vrácení zboží nese kupující.
        </p>
        <p>
          Podle § 1837 písm. g) občanského zákoníku nelze odstoupit od smlouvy
          o dodání zboží v zapečetěném obalu, které spotřebitel z obalu vyňal
          a z hygienických důvodů jej není možné vrátit. Vrátit proto lze jen
          vzorky nepoužité a s neporušeným uzávěrem.
        </p>
        <p>
          Peníze včetně nejlevnější nabízené ceny dopravy vrátíme do 14 dnů od
          odstoupení stejným způsobem, jakým byly přijaty, nejdříve však poté,
          co nám bude zboží doručeno nebo kupující prokáže, že jej odeslal.
          Pokud bude vrácené zboží poškozené nebo použité, má prodávající
          nárok na náhradu snížení jeho hodnoty.
        </p>

        <h2>8. Práva z vadného plnění</h2>
        <p>
          Práva a postup při reklamaci upravuje{" "}
          <Link to="/reklamacni-rad">Reklamační řád</Link>.
        </p>

        <h2>9. Věrnostní body</h2>
        <p>
          Registrovaný kupující získává za každých 10 Kč zaplaceného nákupu 1
          věrnostní bod. Body se připisují po zaplacení objednávky a při
          vrácení zboží se odečítají. Body nejsou směnitelné za peníze a jejich
          využití a případné změny programu prodávající oznámí v e-shopu.
        </p>

        <h2>10. Mimosoudní řešení sporů a dozor</h2>
        <p>
          Stížnosti vyřizujeme na e-mailu {S.email}. K mimosoudnímu řešení
          spotřebitelských sporů je příslušná Česká obchodní inspekce, Štěpánská
          796/15, 120 00 Praha 2,{" "}
          <a href="https://adr.coi.cz" target="_blank" rel="noreferrer">
            adr.coi.cz
          </a>
          . Dozor nad dodržováním povinností prodávajícího vykonává Česká
          obchodní inspekce a příslušný živnostenský úřad, nad ochranou
          osobních údajů Úřad pro ochranu osobních údajů.
        </p>

        <h2>11. Závěrečná ustanovení</h2>
        <p>
          Kupní smlouva se uzavírá v českém jazyce a prodávající ji archivuje v
          elektronické podobě; přístupná není. Prodávající může tyto podmínky
          měnit; na již uzavřené smlouvy se použije znění účinné v době
          odeslání objednávky. Tyto obchodní podmínky jsou účinné od{" "}
          <Field value={EFFECTIVE_FROM} />.
        </p>
      </>
    ),
  },

  "reklamacni-rad": {
    title: "Reklamační řád",
    content: (
      <>
        <h2>1. Odpovědnost za vady</h2>
        <p>
          Prodávající ({S.name}, IČO {S.ico}) odpovídá kupujícímu, že zboží při
          převzetí nemá vady, má sjednaný objem a odpovídá popisu v e-shopu.
          Spotřebitel může vadu, která se projeví u zboží do 24 měsíců od
          převzetí, uplatnit u prodávajícího. Projeví-li se vada během prvního
          roku, má se za to, že existovala již při převzetí.
        </p>
        <p>
          Za vadu se nepovažuje subjektivní vnímání vůně, její odlišný projev
          na pokožce, výdrž ani intenzita, ani rozdíly mezi šaržemi
          originálního parfému.
        </p>

        <h2>2. Jak reklamovat</h2>
        <p>
          Reklamaci oznamte bez zbytečného odkladu e-mailem na {S.email}.
          Uveďte číslo objednávky, popis vady a přiložte fotografii. Pokud
          budeme potřebovat zboží posoudit, zašlete jej na adresu {S.address}{" "}
          (ne na dobírku). Při poškození během přepravy postupujte podle článku
          6 <Link to="/obchodni-podminky">obchodních podmínek</Link>.
        </p>

        <h2>3. Vaše práva</h2>
        <p>
          Při vadném plnění můžete požadovat dodání nového zboží bez vady nebo
          odstranění vady. Není-li to možné, nebo to prodávající odmítne či
          nezajistí v přiměřené době, můžete požadovat přiměřenou slevu nebo
          od smlouvy odstoupit. Od smlouvy nelze odstoupit, je-li vada
          nevýznamná.
        </p>

        <h2>4. Vyřízení reklamace</h2>
        <p>
          Přijetí reklamace potvrdíme e-mailem s uvedením data jejího
          uplatnění. Reklamaci včetně odstranění vady vyřídíme nejpozději do 30
          dnů od jejího uplatnění, pokud se s vámi nedohodneme na delší lhůtě. O
          vyřízení vás informujeme e-mailem. Při oprávněné reklamaci vám
          uhradíme účelně vynaložené náklady na její uplatnění.
        </p>

        <h2>5. Mimosoudní řešení</h2>
        <p>
          Pokud s vyřízením reklamace nebudete spokojeni, můžete se obrátit na
          Českou obchodní inspekci (
          <a href="https://adr.coi.cz" target="_blank" rel="noreferrer">
            adr.coi.cz
          </a>
          ). Reklamační řád je účinný od <Field value={EFFECTIVE_FROM} />.
        </p>
      </>
    ),
  },

  "ochrana-osobnich-udaju": {
    title: "Ochrana osobních údajů",
    content: (
      <>
        <h2>1. Správce</h2>
        <p>Správcem vašich osobních údajů je:</p>
        <SellerBlock />
        <p>
          Údaje zpracováváme podle nařízení (EU) 2016/679 (GDPR) a zákona č.
          110/2019 Sb. Pověřence pro ochranu osobních údajů jsme nejmenovali.
        </p>

        <h2>2. Jaké údaje a proč</h2>
        <ul>
          <li>
            <strong>Vyřízení objednávky</strong> – jméno, e-mail, telefon,
            doručovací adresa nebo výdejní místo, obsah objednávky a platba.
            Právní základ: plnění smlouvy.
          </li>
          <li>
            <strong>Uživatelský účet a věrnostní body</strong> – e-mail,
            přihlašovací údaje a historie objednávek. Právní základ: plnění
            smlouvy.
          </li>
          <li>
            <strong>Účetnictví a daně</strong> – údaje na daňových dokladech.
            Právní základ: plnění právní povinnosti.
          </li>
          <li>
            <strong>Reklamace a ochrana našich nároků</strong> – komunikace a
            údaje o objednávce. Právní základ: oprávněný zájem.
          </li>
          <li>
            <strong>Newsletter</strong> – e-mail. Právní základ: váš souhlas
            (nebo oprávněný zájem u našich zákazníků), odhlásit se můžete
            kdykoli odkazem v každém e-mailu.
          </li>
        </ul>

        <h2>3. Jak dlouho</h2>
        <p>
          Údaje k objednávkám uchováváme po dobu trvání smlouvy a 3 roky po
          jejím skončení kvůli případným nárokům, daňové doklady 10 let podle
          účetních a daňových předpisů. Uživatelský účet do jeho zrušení,
          údaje pro newsletter do odvolání souhlasu či odhlášení.
        </p>

        <h2>4. Komu údaje předáváme</h2>
        <ul>
          <li>Zásilkovna s.r.o. – doručení zásilky,</li>
          <li>
            poskytovatel platební brány – zpracování platby kartou{" "}
            <Field value="[název platební brány]" />,
          </li>
          <li>
            Supabase, Inc. – provoz databáze a uživatelských účtů,
          </li>
          <li>Netlify, Inc. – hosting webu,</li>
          <li>
            poskytovatel e-mailových služeb a účetní{" "}
            <Field value="[doplnit, až budou známi]" />.
          </li>
        </ul>
        <p>
          Někteří zpracovatelé sídlí v USA. Předání probíhá na základě
          rozhodnutí o odpovídající ochraně (EU-US Data Privacy Framework) nebo
          standardních smluvních doložek Evropské komise.
        </p>

        <h2>5. Vaše práva</h2>
        <p>
          Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení
          zpracování, přenositelnost a právo vznést námitku proti zpracování
          založenému na oprávněném zájmu. Udělený souhlas můžete kdykoli
          odvolat. Žádosti zasílejte na {S.email}, vyřídíme je do 1 měsíce.
          Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (
          <a href="https://uoou.gov.cz" target="_blank" rel="noreferrer">
            uoou.gov.cz
          </a>
          ).
        </p>

        <h2>6. Cookies</h2>
        <p>
          Informace o cookies najdete na stránce{" "}
          <Link to="/cookies">Cookies</Link>. Tyto zásady jsou účinné od{" "}
          <Field value={EFFECTIVE_FROM} />.
        </p>
      </>
    ),
  },

  cookies: {
    title: "Cookies",
    content: (
      <>
        <p>
          Cookies a obdobné technologie (např. úložiště prohlížeče) jsou malé
          soubory, které si web ukládá ve vašem zařízení.
        </p>
        <h2>Jaké používáme</h2>
        <p>
          E-shop používá pouze <strong>technicky nezbytné</strong> úložiště,
          bez kterého by nefungovalo přihlášení k uživatelskému účtu a
          dokončení objednávky. K jejich použití nepotřebujeme váš souhlas.
        </p>
        <p>
          Nepoužíváme analytické ani marketingové cookies. Pokud je v budoucnu
          zavedeme, vyžádáme si předem váš souhlas a tuto stránku aktualizujeme.
        </p>
        <h2>Jak je spravovat</h2>
        <p>
          Cookies můžete kdykoli smazat nebo zablokovat v nastavení prohlížeče.
          Bez nezbytného úložiště se ale nebudete moci přihlásit. Více o
          zpracování údajů v{" "}
          <Link to="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link>
          .
        </p>
      </>
    ),
  },

  "doprava-a-platba": {
    title: "Doprava a platba",
    content: (
      <>
        <p>
          Objednávky expedujeme obvykle do 24 hodin z České republiky a doma
          je máte zpravidla za 1–2 pracovní dny. Doručujeme pouze v rámci ČR.
        </p>
        <h2>Doprava</h2>
        <table className="legal-table">
          <tbody>
            {shippingMethods.map((method) => (
              <tr key={method.key}>
                <td>
                  <strong>{method.label}</strong>
                  <small>{method.note}</small>
                </td>
                <td>{money(method.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Při nákupu od {money(FREE_SHIPPING_FROM).replace(",00", "")} je
          doprava zdarma.
        </p>
        <h2>Platba</h2>
        <table className="legal-table">
          <tbody>
            {paymentMethods
              .filter((method) => method.enabled)
              .map((method) => (
                <tr key={method.key}>
                  <td>
                    <strong>{method.label}</strong>
                    <small>{method.note}</small>
                  </td>
                  <td>{method.fee ? money(method.fee) : "Zdarma"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p>
          Podrobnosti najdete v{" "}
          <Link to="/obchodni-podminky">obchodních podmínkách</Link>.
        </p>
      </>
    ),
  },

  "odstoupeni-od-smlouvy": {
    title: "Odstoupení od smlouvy",
    content: (
      <>
        <p>
          Nepoužité vzorky s neporušeným uzávěrem můžete vrátit do 14 dnů od
          převzetí bez udání důvodu. Stačí nám poslat e-mail na {S.email} –
          můžete k tomu použít formulář níže – a zboží zaslat do 14 dnů na
          adresu {S.address}. Podrobnosti jsou v článku 7{" "}
          <Link to="/obchodni-podminky">obchodních podmínek</Link>.
        </p>
        <h2>Vzorový formulář pro odstoupení od smlouvy</h2>
        <div className="legal-form">
          <p>
            Adresát: {S.name}, {S.address}, e-mail: {S.email}
          </p>
          <p>
            Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží:
            ……………………
          </p>
          <p>Datum objednání / datum obdržení: ……………………</p>
          <p>Číslo objednávky: ……………………</p>
          <p>Jméno a příjmení spotřebitele: ……………………</p>
          <p>Adresa spotřebitele: ……………………</p>
          <p>Číslo bankovního účtu pro vrácení peněz: ……………………</p>
          <p>Datum: ……………………</p>
          <p>Podpis (pouze pokud je formulář zasílán v listinné podobě)</p>
        </div>
      </>
    ),
  },

  kontakt: {
    title: "Kontakt",
    content: (
      <>
        <p>
          Máte dotaz k objednávce, vůni nebo vrácení? Napište nám, odpovídáme
          obvykle do 24 hodin v pracovní dny.
        </p>
        <SellerBlock />
      </>
    ),
  },
};

// Footer order of the legal links.
export const legalLinks = [
  ["obchodni-podminky", "Obchodní podmínky"],
  ["reklamacni-rad", "Reklamační řád"],
  ["ochrana-osobnich-udaju", "Ochrana osobních údajů"],
  ["cookies", "Cookies"],
];

export default function LegalPage({ slug }) {
  const page = legalPages[slug];
  return (
    <div className="home-page">
      <main className="page-shell legal-page">
        <h1>{page.title}</h1>
        <div className="legal-body">{page.content}</div>
      </main>
    </div>
  );
}
