# Checklist pro parfemovy e-shop v Reactu

Tento dokument slouzi jako pracovni checklist pro e-shop inspirovany informacni architekturou MicroPerfumes. Nekopirujeme jejich znacku, texty, fotografie ani vizualni identitu; prebirame pouze overene principy e-commerce a prizpusobime je nasi nabidce.

## 0. Rozhodnuti pred zacatkem

- [x] Cilovy trh: Ceska republika, jazyk cestina, mena CZK
- [x] MVP nabidka: vzorky parfemu; darkove sady a plna baleni zatim neprodavame
- [x] Aktivni varianty: 1 ml, 2 ml a 3 ml
- [ ] Budouci varianty: 5 ml a 10 ml pripravit v datech, administraci, cenach a UI jako uzamcene varianty
- [ ] Zvolit zdroj produktovych dat: vlastni API, headless CMS, Shopify Storefront API, nebo mock data pro MVP
- [ ] Zvolit platby a dopravu
- [ ] Definovat pravidla skladu, dostupnosti, vratek a reklamaci
- [ ] Overit pravni podminky pro prodej a prebalovani parfemu v cilovych zemich
- [x] Vizuální smer MVP: hravy, moderni a luxusni; teply papir, koralova, salvejova a zluta
- [ ] Pripravit finalni brand: nazev, logo, barvy, typografie, fotografie a ton komunikace

### Doporuceny platebni tok

- [ ] Pouzit Stripe Checkout pro prvni produkcni verzi, protoze Stripe bezpecne zpracuje platbu a u nas zustane jednodussi frontend
- [ ] Platbu vytvaret pouze na backendu pres Stripe Checkout Session
- [ ] Neposilat secret key do React aplikace
- [ ] Po uspesne platbe zpracovat Stripe webhook a teprve pak vytvorit objednavku / odepsat sklad
- [ ] Overit podporu plateb v CR: karty, Apple Pay / Google Pay a pripadne bankovni prevod
- [ ] Nastavit testovaci a produkcni Stripe klice pres environment variables
- [ ] Pro vlastni checkout pouzit Stripe Elements az ve chvili, kdy budeme potrebovat plnou kontrolu nad UX

### Co znamena zdroj produktovych dat

- [x] Pro prototyp pouzit lokalni mock data v Reactu, aby byly stranky ihned proklikatelne
- [ ] Pro produkci rozhodnout, kde se budou spravovat nazev, znacka, popis, ceny, varianty 1/2/3/5/10 ml, sklad a obrazky
- [ ] Preferovana dalsi etapa: vlastni backend / CMS s API, ze ktereho React data nacita
- [ ] Nedrzet produkcni ceny a dostupnost pouze v klientskem JavaScriptu

## 1. Informační architektura

### Hlavni stranky

- [ ] Domovska stranka `/`
- [x] Kolekce vzorku `/kolekce`
- [ ] Kategorie pro zeny `/kolekce?pro=zeny`
- [ ] Kategorie pro muze `/kolekce?pro=muzi`
- [ ] Unisex kategorie `/collections/unisex`
- [ ] Bestsellery `/collections/best-sellers`
- [ ] Novinky `/collections/new-arrivals`
- [ ] Darkove sady `/collections/gift-sets`
- [ ] Cestovni spreje `/collections/travel-sprays`
- [ ] Vyprodej a akce `/collections/sale`
- [x] Katalog znacek `/znacky` jako pripravena routa MVP
- [ ] Detail znacky `/brands/:slug`
- [x] Detail produktu `/produkt/:slug`
- [ ] Vyhledavani `/search?q=...`
- [x] Kosik `/kosik`
- [ ] Checkout nebo presmerovani do checkoutu
- [ ] Prihlaseni, registrace a ucet zakaznika
- [ ] Sledovani objednavky
- [ ] Kontakt a zakaznicka podpora
- [ ] Doprava, platby, vraceni a obchodni podminky
- [ ] O nas, recenze, blog a FAQ

### Navigace

- [ ] Promo lista s kratkou aktualni nabidkou
- [ ] Hlavicka s logem, vyhledavanim, uctem a kosikem
- [ ] Hlavni menu: Zeny, Muzi, Unisex, Znacky, Bestsellery, Novinky, Darky
- [ ] Mega menu nebo rozbalovaci navigace pro seznam kategorii a znacek
- [ ] Mobilni menu s jasnou hierarchii
- [ ] Breadcrumbs na kategoriich a detailech produktu
- [ ] Footer rozdeleny na Nakup, Podpora, Ucet, O nas a socialni site
- [ ] Sticky header podle vysledku testovani na mobilu

## 2. Domovska stranka

- [x] Hero sekce s hlavnim sdelenim, produktem a CTA
- [x] Rychle vstupy: Akce, Bestsellery, Novinky a Vzorky
- [x] Trust blok: originalni vune, objemy 1-3 ml, rychle odeslani a expedice z CR
- [ ] Sekce „Jak to funguje“ ve 3 krocich
- [x] Produktovy blok vybranych vuni / Bestsellery
- [ ] Produktovy carousel pro zeny
- [ ] Produktovy carousel pro muze
- [x] Editorialni blok pro Novinky
- [ ] Bannery pro sezoni kampane a vyprodej
- [x] Parfemove rodiny: citrusove, drevite, kvetinove, sladke, korenite a ciste
- [ ] Sekce vybranych znacek
- [ ] Argumenty duvery: autenticita, rychle odeslani, doprava, podpora
- [ ] Recenze zakazniku s hodnocenim a overenim
- [x] FAQ blok pro velikost vzorku, vydrz a autenticitu
- [ ] Newsletter s jasnym benefitem
- [ ] Responzivni galerie nebo editorialni blok s vlastnimi fotografiemi
- [ ] Lazy loading obrazku a rezervovane rozmery proti layout shiftu

## 3. Katalog a kolekce

- [ ] Grid produktu s responzivnim poctem sloupcu
- [ ] Pocet nalezenych produktu
- [ ] Razeni: doporucene, nejprodavanejsi, novinky, cena vzestupne/sestupne
- [ ] Filtr podle pohlavi nebo cilove skupiny
- [ ] Filtr podle znacky
- [ ] Filtr podle typu vune, koncentrace a objemu
- [ ] Filtr podle ceny
- [ ] Filtr dostupnosti a akce
- [ ] Mobilni filter drawer s moznosti vymazat filtry
- [ ] URL query params pro sdilitelne a obnovitelne filtrovani
- [ ] Pagination nebo infinite scroll s pristupnym ovladanim
- [ ] Empty state pri nulovem vysledku
- [ ] Loading skeleton pro grid a filtry
- [ ] Error state s moznosti opakovat nacitani
- [ ] Produktova karta s fotkou, badge, nazvem, znackou, publikem a cenou
- [ ] Zobrazeni puvodni a akcni ceny
- [ ] Quick view s variantami a pridanim do kosiku
- [ ] Wishlist nebo ulozeni produktu pro pozdejsi navrat
- [ ] Hover obrazek nebo galerie jen tam, kde to nezhorši mobilni pouziti

## 4. Produktovy detail

- [ ] Galerie fotografii produktu s mobilnim swipe
- [ ] Nazev, znacka, typ vune a cilova skupina
- [ ] Cena za vybranou variantu
- [ ] Dostupnost a odhad odeslani
- [ ] Volba objemu a typu baleni jako varianty
- [ ] Jednoznacne oznaceni varianty, jednotek a ceny
- [ ] Mnozstvi a tlacitko „Pridat do kosiku"
- [ ] Buy now nebo rychly checkout, pokud ho podporuje platba
- [ ] Upozorneni na vyprodani a moznost upozorneni na naskladneni
- [ ] Popis vune, hlavni slozky, koncentrace a vydrz
- [ ] Informace o autenticite a zpusobu baleni
- [ ] Doprava, vraceni a podminky zobrazene blizko CTA
- [ ] Recenze, hodnoceni a fotografie zakazniku
- [ ] FAQ accordion
- [ ] Doporučene a podobne produkty
- [ ] Structured data `Product`, `Offer`, `AggregateRating`, pokud jsou data pravdiva
- [ ] Open Graph a SEO metadata pro sdileni produktu

## 5. Kosik a checkout

- [ ] Mini cart po pridani produktu
- [ ] Editace varianty a mnozstvi v kosiku
- [ ] Odstraneni produktu
- [ ] Vypocet mezisouctu, slevy, dopravy a celkove castky
- [ ] Promo kod s validaci a zobrazenim duvodu zamitnuti
- [ ] Progress bar nebo informace o hranici dopravy zdarma
- [ ] Cross-sell, ale bez blokovani checkoutu
- [ ] Ulozeni kosiku pri refreshi a navratu uzivatele
- [ ] Checkout bez zbytecneho rozptylovani
- [ ] Validace adresy, kontaktu a doruceni
- [ ] Platba kartou a dalsi relevantni metody
- [ ] Souhlas s podminkami a ochrana osobnich udaju
- [ ] Potvrzeni objednavky s cislem, shrnutim a dalsim postupem
- [ ] E-mailove udalosti: potvrzeni, platba, expedice, doruceni, storno
- [ ] Osetrit chybu platby, vyprsenou cenu a vyprodani varianty

## 6. React architektura

- [ ] Inicializovat React + TypeScript + Vite
- [ ] Nastavit ESLint, Prettier a kontrolu typu
- [ ] Zvolit router, napr. React Router
- [ ] Rozdelit aplikaci na `pages`, `components`, `features`, `services`, `hooks`, `types`
- [ ] Vytvorit design tokens pro barvy, typografii, mezery, radius a stiny
- [ ] Vytvorit znovupouzitelne komponenty: Header, Footer, Button, Modal, Drawer, Tabs, Accordion, ProductCard, ProductGrid, Price, Badge
- [ ] Oddelit katalogova data od prezentacnich komponent
- [ ] Zvolit server state: TanStack Query nebo ekvivalent
- [ ] Zvolit stav kosiku a wishlistu: Context, Zustand nebo ekvivalent
- [ ] Definovat typy `Product`, `Variant`, `Brand`, `Collection`, `CartItem`, `Order`
- [ ] Centralizovat API klienta, chyby a loading stavy
- [ ] Implementovat persistenci kosiku a preferenci souhlasu
- [ ] Osetrit 404, globalni chyby a offline stav
- [ ] Lazy-load rout a tezkych komponent

## 7. Data a backend

- [ ] Navrhnout schema produktu, variant, cen, skladu, kategorii, znacek a obrazku
- [ ] Rozlisit produkt, variantu a skladovou polozku
- [ ] Ulozit SEO slugy a kanonicke URL
- [ ] Resit ceny, dane, slevy a zaokrouhlovani na backendu
- [ ] Nikdy neverit cenam a dostupnosti pouze z klienta
- [ ] API pro seznam, detail, filtry, vyhledavani a souvisejici produkty
- [ ] API pro kosik, checkout, objednavky a sledovani objednavky
- [ ] Webhooky pro platbu, expedici a zmenu skladu
- [ ] Admin pro produkty, objednavky, obsah, akce a bannery
- [ ] Validace vstupu, rate limiting, logovani a audit zmen
- [ ] Zasady pro obrazky: format, velikost, crop, alt text a CDN

## 8. Vyhledavani a merchandising

- [ ] Autocomplete pri psani znacky nebo nazvu parfemu
- [ ] Normalizace diakritiky, velikosti pismen a alternativnich nazvu
- [ ] Vysledky rozdelene na produkty, znacky a kategorie
- [ ] Stranka bez vysledku s doporucenymi kategoriemi
- [ ] Synonyma a tolerance preklepu
- [ ] Zvyrazneni hledaneho vyrazu
- [ ] Merici udalosti pro vyhledavani a kliknuti
- [ ] Pravidla pro merchandising: bestsellery, marze, sklad a sezona

## 8A. Administrace, vyroba vzorku a sklad ml

- [x] Admin prehled s objemem skladu, dostupnymi vzorky, trzby a objednavkami
- [x] Admin sklad s editaci zakladniho objemu v ml
- [x] Admin sklad s nakladem za 1 ml, prodejnimi cenami a orientacni marzi
- [x] Admin objednavky se stavy K vyrobe, Zaplaceno, Odeslano a Dokonceno
- [x] Admin finance s trzby, naklady, ziskem a marzi po jednotlivych vunich
- [ ] U kazde vune evidovat nakupni cenu za 1 ml, obal, rozprašovac, etiketu a praci
- [ ] Pocitat dostupnost podle zvolene varianty: `floor(stockMl / requestedMl)`
- [ ] Pri vytvoreni objednavky pouze rezervovat objem; pri potvrzene platbe ho atomicky odepsat
- [ ] Pri storno nebo refundaci vratit rezervovany objem podle realneho stavu vyroby
- [ ] Zablokovat objednavku, pokud neni dostatek ml nebo se mezitim zmenila cena
- [ ] V objednavce evidovat konkretni spotrebu: vune, ml, obal, etiketa a stav vyroby
- [ ] Evidovat pohyby skladu: naskladneni, rezervace, spotreba, vraceni, korekce a duvod
- [ ] Pridat audit log, kdo a kdy zmenil sklad, cenu nebo naklad
- [ ] Rozlisit trzby, variabilni naklady, dopravu, platebni poplatky, marketing a cisty zisk
- [ ] Umoznit export objednavek a financnich reportu do CSV
- [ ] Omezit admin prihlasenim a rolemi; nikdy nenechat admin data pouze na klientovi

## 9. UX, pristupnost a responzivita

- [ ] Mobile-first layout pro sirky priblizne 320, 375, 768, 1024 a 1440 px
- [ ] Viditelny focus a ovladani klavesnici
- [ ] Spravne labely, landmarky, heading hierarchy a ARIA jen tam, kde je potreba
- [ ] Dostatecny kontrast a velikost klikacich ploch
- [ ] Alt text pro produktove a obsahove obrazky
- [ ] Dialogy a drawers s focus trapem a Escape zavrenim
- [ ] Loading, success, error a empty states pro kazdy hlavni tok
- [ ] Toast notifikace nesmi zakryt CTA nebo obsah
- [ ] Otestovat dlouhe nazvy produktu, slevove badge a vice variant
- [ ] Zkontrolovat lokalizaci, menu na mobilu a sticky prvky

## 10. SEO, vykon a analytika

- [ ] Unikatni title, description, canonical a Open Graph pro kazdou indexovanou stranku
- [ ] Sitemap, robots.txt a spravne 301 redirecty
- [ ] Schema.org pro produkty, breadcrumb, organizaci a recenze
- [ ] SSR nebo prerendering pro SEO dulezite stranky, pokud to projekt vyzaduje
- [ ] WebP/AVIF, responsive images, lazy loading a CDN
- [ ] Core Web Vitals: LCP, CLS, INP
- [ ] Mereni view item, add to cart, begin checkout, purchase a search
- [ ] Consent mode a sprava cookies podle cilove legislativy
- [ ] Error tracking a performance monitoring
- [ ] Testovat checkout bez blokovani analytikou nebo reklamnim skriptem

## 11. Obsah a duvera

- [ ] Vlastni fotografie produktů a konzistentni pozadi
- [ ] Jasne informace o autenticite a puvodu produktu
- [ ] Transparentni informace o baleni, objemu a tom, co zakaznik obdrzi
- [ ] Viditelne dodaci lhuty, cena dopravy a pravidla vraceni
- [ ] FAQ pro nejcastejsi otazky pred nakupem
- [ ] Recenze s rozumnou ochranou proti spamu
- [ ] Kontaktni kanal a realna doba odpovedi
- [ ] O nas a informace o provozovateli
- [ ] Obchodni podminky, ochrana udaju, cookies a reklamace
- [ ] Nezobrazovat tvrzeni o autenticite, certifikaci nebo hodnoceni bez podkladu

## 12. Testovaci scenare

- [ ] Navstivit homepage na mobilu a desktopu
- [ ] Najit produkt pres menu, kolekci i vyhledavani
- [ ] Filtrovat kolekci a obnovit stranku
- [ ] Otevrit quick view a zvolit variantu
- [ ] Otevrit produkt, zmenit variantu, pridat mnozstvi a pridat do kosiku
- [ ] Obnovit stranku s naplnenym kosikem
- [ ] Aplikovat platny i neplatny promo kod
- [ ] Otestovat hranici dopravy zdarma
- [ ] Dokoncit uspesnou objednavku v testovacim prostredi
- [ ] Otestovat zamitnutou platbu a navrat do kosiku
- [ ] Otestovat vyprodanou variantu
- [ ] Otestovat 404 a API chybu
- [ ] Ovladať hlavni tok pouze klavesnici a cteckou obrazovky
- [ ] Otestovat dlouhe nazvy, chybejici obrazek a pomale pripojeni
- [ ] Otestovat consent banner a odmitnuti marketingovych cookies

## 13. MVP poradi implementace

### Faze 1: Zaklad

- [ ] React + TypeScript + Vite
- [ ] Design system a layout
- [ ] Homepage, header, footer a routing
- [ ] Mock data produktu a znacek

### Faze 2: Nakupni katalog

- [ ] Kolekce s gridem
- [ ] Filtry, razeni a URL query params
- [ ] Produktova karta a detail produktu
- [ ] Varianty a cenove zobrazeni

### Faze 3: Kosik

- [ ] Stav kosiku a persistovani
- [ ] Mini cart a stranka kosiku
- [ ] Promo kod a doprava
- [ ] Zakladni checkout nebo napojeni na poskytovatele

### Faze 4: Provozni minimum

- [ ] API nebo headless commerce backend
- [ ] Objednavky, platby a e-maily
- [ ] Admin a sklad
- [ ] SEO, analytika, consent a monitoring

### Faze 5: Optimalizace

- [ ] Wishlist
- [ ] Quick view
- [ ] Recenze a UGC
- [ ] Personalizovane doporuceni
- [ ] Loyalty program, darkove karty a referral
- [ ] A/B testy merchandisingu a checkoutu

## Doporučena vychozi struktura React projektu

```text
src/
  app/
    router.tsx
    providers.tsx
  components/
    layout/
    navigation/
    product/
    commerce/
    feedback/
  features/
    catalog/
    search/
    cart/
    checkout/
    account/
  pages/
    HomePage.tsx
    CollectionPage.tsx
    ProductPage.tsx
    SearchPage.tsx
    CartPage.tsx
    BrandsPage.tsx
  services/
    apiClient.ts
    catalogApi.ts
    checkoutApi.ts
  state/
    cartStore.ts
    wishlistStore.ts
  types/
    catalog.ts
    commerce.ts
  styles/
    tokens.css
    globals.css
```

## Definition of Done pro MVP

- [ ] Zakaznik najde produkt do 30 sekund z homepage
- [ ] Zakaznik rozumi rozdilu mezi variantami a objemy
- [ ] Cena, dostupnost, doprava a vraceni jsou viditelne pred platbou
- [ ] Produkt lze vlozit do kosiku z kolekce i detailu
- [ ] Kosik prezije refresh a spravne pocita varianty, slevy a dopravu
- [ ] Checkout uspesne vytvori objednavku a zobrazi potvrzeni
- [ ] Hlavni tok funguje na mobilu, desktopu, klavesnici a pri chybe API
- [ ] Produktove stranky maji zakladni SEO metadata a structured data
- [ ] Nejsou pouzity cizi texty, fotografie, logo ani identita MicroPerfumes
