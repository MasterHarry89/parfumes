import "./App.css";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const hero = null;

import { supabase } from "./lib/supabase";
import { navigate } from "./lib/navigate";
import {
  money,
  occasionOptions,
  priceFor,
  seasonOptions,
  toList,
  volumes,
} from "./lib/catalog";
import {
  FiCheck,
  FiCheckCircle,
  FiDroplet,
  FiMinus,
  FiPackage,
  FiPlus,
  FiRotateCcw,
  FiShoppingBag,
  FiTruck,
  FiZap,
} from "react-icons/fi";


const faqItems = [
  {
    question: "Jak rychle objednávku odešlete?",
    answer:
      "Objednávky expedujeme do 24 hodin z České republiky, obvykle je máte doma za 1–2 pracovní dny.",
  },
  {
    question: "Prodáváte originální vůně?",
    answer:
      "Ano, 100 % originální parfémy — žádné repliky ani neautorizované kopie.",
  },
  {
    question: "Proč zkoušet vzorky místo celého balení?",
    answer:
      "Vzorek vám umožní poznat vůni na vlastní kůži a v běžném nošení dřív, než investujete do plného balení.",
  },
  {
    question: "Jak velký je vzorek a na kolik dní mi vydrží?",
    answer:
      "Vzorky začínají už od 1 ml, což při běžném dávkování vystačí na několik týdnů používání.",
  },
  {
    question: "Jak funguje doprava zdarma?",
    answer:
      "Při nákupu nad 900 Kč je doprava po ČR zdarma, jinak účtujeme sazbu podle zvoleného přepravce.",
  },
  {
    question: "Jak probíhá vrácení zboží?",
    answer:
      "Nepoužité vzorky můžete vrátit do 14 dnů od doručení podle standardních podmínek e-shopu.",
  },
];
const loadProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("loadProducts error:", error);
    return [];
  }

  return (data ?? []).map((product) => ({
    ...product,
    id: product.id,
    name: product.name,
    brand: product.brand || "Presence",
    family: product.family || "Dřevitá",
    price: Number(product.price || 0),
    prices:
      product.prices && typeof product.prices === "object" ? product.prices : {},
    image:
      product.image ||
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=85",
    note: product.note || "Premium scent",
    tag: product.tag || "Bestseller",
    families: toList(product.families),
    notesTop: toList(product.notes_top),
    notesHeart: toList(product.notes_heart),
    notesBase: toList(product.notes_base),
    longevity: Number(product.longevity) || null,
    seasons: toList(product.seasons),
    occasions: toList(product.occasions),
  }));
};

// The admin lives in its own chunk so shoppers never download it.
const AdminApp = lazy(() => import("./admin/AdminApp"));

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [products, setProducts] = useState([]);

  const refreshProducts = async () => setProducts(await loadProducts());

  useEffect(() => {
    refreshProducts();
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let previousScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < previousScrollY) {
        setHeaderHidden(false);
      } else if (currentScrollY > previousScrollY && currentScrollY > 80) {
        setHeaderHidden(true);
        setMenuOpen(false);
      }
      previousScrollY = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const addToCart = (product, volume = volumes[0], quantity = 1) => {
    if (volume.future) return;
    const line = {
      ...product,
      volume: volume.label,
      price: priceFor(product, volume),
    };
    setCart((items) => [...items, ...Array.from({ length: quantity }, () => line)]);
  };
  const filtered = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.brand} ${product.family}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [products, search],
  );
  const currentProduct = products.find((product) => path.includes(product.id));
  if (path.startsWith("/admin"))
    return (
      <Suspense fallback={null}>
        <AdminApp path={path} onCatalogChanged={refreshProducts} />
      </Suspense>
    );
  const renderCatalog = () => (
    <main className="catalog-page page-shell">
      <div className="catalog-heading">
        <div>
          <h1>Vzorky parfémů</h1>
        </div>
        <p className="heading-note">
          Malé množství. Velký první dojem.
          <br />
          Vyberte si vůni bez závazků.
        </p>
      </div>
      <div className="catalog-toolbar">
        <span>{filtered.length} vůní</span>
        <button className="filter-button">☷ &nbsp; Filtry</button>
        <select aria-label="Řazení">
          <option>Doporučené</option>
          <option>Nejnovější</option>
          <option>Od nejlevnějších</option>
        </select>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <span className="eyebrow">Filtrovat</span>
          <h3>Pro koho</h3>
          <label>
            <input type="checkbox" /> Ženy
          </label>
          <label>
            <input type="checkbox" /> Muži
          </label>
          <label>
            <input type="checkbox" /> Unisex
          </label>
          <h3>Rodina vůně</h3>
          {["Svěží", "Dřevitá", "Čistá", "Citrusová", "Pižmová"].map(
            (family) => (
              <label key={family}>
                <input type="checkbox" /> {family}
              </label>
            ),
          )}
          <h3>Velikost</h3>
          <div className="size-pills">
            {volumes.slice(0, 3).map((volume) => (
              <button key={volume.value}>{volume.label}</button>
            ))}
          </div>
        </aside>
        <section className="product-grid">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={() => navigate(`/produkt/${product.id}`)}
              onAdd={() => addToCart(product)}
            />
          ))}
        </section>
      </div>
    </main>
  );
  const renderProduct = () =>
    currentProduct ? (
      <ProductDetail
        key={currentProduct.id}
        product={currentProduct}
        products={products}
        onAdd={addToCart}
        onOpen={(id) => navigate(`/produkt/${id}`)}
        onBack={() => navigate("/kolekce")}
      />
    ) : (
      renderCatalog()
    );
  const renderCart = () => (
    <main className="page-shell cart-page">
      <div className="breadcrumb">
        <button onClick={() => navigate("/")}>Domů</button>
        <span>/</span>
        <strong>Košík</strong>
      </div>
      <h1>Váš výběr</h1>
      {cart.length ? (
        <>
          <div className="cart-items">
            {cart.map((item, index) => (
              <div className="cart-row" key={`${item.id}-${index}`}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.brand} · {item.volume}
                  </small>
                </div>
                <b>{money(item.price)}</b>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            <span>Mezisoučet</span>
            <strong>
              {money(cart.reduce((sum, item) => sum + item.price, 0))}
            </strong>
            <button
              className="primary-button"
              onClick={() => alert("Checkout bude napojený na Stripe.")}
            >
              Pokračovat k platbě <span>↗</span>
            </button>
          </div>
        </>
      ) : (
        <div className="empty-cart">
          <span className="empty-mark">✦</span>
          <h2>Košík čeká na vaši první vůni</h2>
          <button
            className="primary-button"
            onClick={() => navigate("/kolekce")}
          >
            Prozkoumat vzorky <span>↗</span>
          </button>
        </div>
      )}
    </main>
  );
  const content =
    path === "/kosik" ? (
      renderCart()
    ) : path === "/kolekce" || path === "/znacky" ? (
      renderCatalog()
    ) : path.startsWith("/produkt/") ? (
      renderProduct()
    ) : (
      <Home
        products={products}
        onOpen={(id) => navigate(`/produkt/${id}`)}
        onShop={() => navigate("/kolekce")}
      />
    );
  return (
    <div className="app home-app">
      <div className="announcement">
        Doprava zdarma od 900 Kč <span>·</span> Vzorky, které vás dostanou blíž
        k vaší vůni
      </div>
      <header className={`site-header ${headerHidden ? "header-hidden" : ""}`}>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Otevřít menu"
        >
          ☰
        </button>
        <button className="wordmark" onClick={() => navigate("/")}>
          ÉPARFUMES<span>®</span>
        </button>
        <nav className={menuOpen ? "nav-open" : ""}>
          <button
            className="nav-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Zavřít menu"
          >
            ×
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate("/kolekce");
            }}
          >
            Vzorky
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate("/kolekce");
            }}
          >
            Ženy
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate("/kolekce");
            }}
          >
            Muži
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate("/znacky");
            }}
          >
            Značky
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate("/kolekce");
            }}
          >
            Novinky
          </button>
        </nav>
        <div className="header-actions">
          <label className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat vůni"
              onKeyDown={(event) =>
                event.key === "Enter" && navigate("/kolekce")
              }
            />
          </label>
          <button className="icon-button" aria-label="Účet">
            ♙
          </button>
          <button className="cart-button" onClick={() => navigate("/kosik")}>
            Košík <span>{cart.length}</span>
          </button>
        </div>
      </header>
      <div className="search-results">
        {search && (
          <button onClick={() => navigate("/kolekce")}>
            Zobrazit výsledky pro „{search}“ <span>→</span>
          </button>
        )}
      </div>
      {content}
      <footer>
        <div className="footer-top">
          <div>
            <button className="wordmark" onClick={() => navigate("/")}>
              ÉPARFUMES<span>®</span>
            </button>
            <p>
              Vůně, které si nejdříve
              <br />
              můžete opravdu vyzkoušet.
            </p>
          </div>
          <div>
            <span className="eyebrow">Nakupovat</span>
            <button onClick={() => navigate("/kolekce")}>Všechny vzorky</button>
            <button onClick={() => navigate("/kolekce")}>Bestsellery</button>
            <button onClick={() => navigate("/znacky")}>Značky</button>
          </div>
          <div>
            <span className="eyebrow">Pomoc</span>
            <button>Doprava a platba</button>
            <button>Vrácení zboží</button>
            <button>Kontakt</button>
          </div>
          <div>
            <span className="eyebrow">Buďte u toho</span>
            <p>
              Novinky, tipy a vůně
              <br />
              přímo do schránky.
            </p>
            <label className="newsletter">
              <input placeholder="Váš e-mail" />
              <button>→</button>
            </label>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Éparfumes</span>
          <span>Česká republika · CZK</span>
          <span>Instagram &nbsp; TikTok</span>
        </div>
      </footer>
    </div>
  );
}

const isHiddenBadge = (text) => {
  const value = (text || "").toLowerCase();
  return (
    value.includes("editor") ||
    value.includes("oblíb") ||
    value.includes("oblib") ||
    value.includes("minimalis")
  );
};

const badgeTone = (text) => {
  const value = (text || "").toLowerCase();
  if (value.includes("nov")) return "tag-new";
  if (value.includes("bestsell")) return "tag-best";
  return "";
};

function ProductCard({ product, onOpen, onAdd, tag }) {
  const rawBadge = tag || product.tag;
  const badge = rawBadge && !isHiddenBadge(rawBadge) ? rawBadge : null;
  return (
    <article className="product-card">
      <div className="product-image" onClick={onOpen}>
        <img src={product.image} alt={`${product.brand} ${product.name}`} />
        {badge && (
          <span className={`product-tag ${badgeTone(badge)}`}>{badge}</span>
        )}
        <button
          className="quick-add"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          aria-label={`Přidat ${product.name} do košíku`}
        >
          +
        </button>
      </div>
      <div className="product-info">
        <h3 className="product-title" onClick={onOpen}>
          <span className="brand">{product.brand}</span> {product.name}
        </h3>
        <strong className="product-price">od {money(product.price)}</strong>
      </div>
    </article>
  );
}
const pickBestsellers = (products, excludeId, limit = 6) => {
  const others = products.filter((product) => product.id !== excludeId);
  const isBestseller = (product) =>
    `${product.tag || ""} ${product.name || ""}`
      .toLowerCase()
      .includes("bestseller");
  // Tagged bestsellers first; top up with other products so the rail is never nearly empty.
  return [
    ...others.filter(isBestseller),
    ...others.filter((product) => !isBestseller(product)),
  ].slice(0, limit);
};

const trustItems = [
  { icon: FiCheckCircle, label: "100% originální vůně" },
  { icon: FiPackage, label: "Expedice z ČR do 24 hodin" },
  { icon: FiRotateCcw, label: "14 dní na vrácení" },
  { icon: FiDroplet, label: "Vzorky od 1 ml" },
];

function Accordion({ items, defaultOpen = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div className={`accordion-item ${isOpen ? "is-open" : ""}`} key={item.title}>
            <button
              className="accordion-trigger"
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${index}`}
              onClick={() => setOpen(isOpen ? -1 : index)}
            >
              <span>{item.title}</span>
              <span className="accordion-icon" aria-hidden="true" />
            </button>
            <div
              className="accordion-panel"
              id={`accordion-panel-${index}`}
              role="region"
            >
              <div>{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Shows every option so buyers see what a scent is *not* suited for too;
// the ones stored on the product are highlighted.
function OptionTiles({ options, active }) {
  return (
    <ul className="option-tiles">
      {options.map(({ key, label, icon: Icon }) => (
        <li key={key} className={active.includes(key) ? "is-active" : ""}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <span className="sr-only">
            {active.includes(key) ? " – vhodné" : " – nevhodné"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FaqBand() {
  return (
    <section className="faq-band">
      <div className="page-shell">
        <div>
          <span className="eyebrow">Máte otázku?</span>
          <h2>Často kladené otázky</h2>
          <p>Vše, co potřebujete vědět o vzorcích, doručení a vůních.</p>
        </div>
        <div className="faq-list">
          {faqItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductDetail({ product, products, onAdd, onOpen, onBack }) {
  const [selected, setSelected] = useState(volumes[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const ctaRef = useRef(null);
  const total = priceFor(product, selected) * quantity;
  const bestsellers = pickBestsellers(products, product.id);

  useEffect(() => {
    const node = ctaRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) =>
      setShowBar(!entry.isIntersecting),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  const addSelected = () => {
    onAdd(product, selected, quantity);
    setAdded(true);
  };

  const noteGroups = [
    { label: "Vrchní složky", items: product.notesTop },
    { label: "Srdcové složky", items: product.notesHeart },
    { label: "Základní složky", items: product.notesBase },
  ].filter((group) => group.items.length);
  const hasUsage =
    product.longevity || product.seasons.length || product.occasions.length;

  const accordionItems = [
    {
      title: "O tomto produktu",
      content: (
        <>
          <p>
            {product.description ||
              "Vůně, která se otevírá pomalu. Objednejte si malý vzorek a nechte ji ukázat, co ve vás probudí."}
          </p>
          <dl className="spec-list">
            <div>
              <dt>Značka</dt>
              <dd>{product.brand}</dd>
            </div>
            <div>
              <dt>Rodina vůně</dt>
              <dd>{product.family}</dd>
            </div>
            {product.note && (
              <div>
                <dt>Charakter</dt>
                <dd>{product.note}</dd>
              </div>
            )}
          </dl>
        </>
      ),
    },
    ...(noteGroups.length
      ? [
          {
            title: "Složky parfému",
            content: (
              <div className="note-groups">
                {noteGroups.map((group) => (
                  <div className="note-group" key={group.label}>
                    <span className="attr-label">{group.label}</span>
                    <ul className="chips">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(hasUsage
      ? [
          {
            title: "Výdrž a použití",
            content: (
              <div className="usage">
                {product.longevity && (
                  <div className="usage-block">
                    <span className="attr-label">Výdrž parfému</span>
                    <div
                      className="meter"
                      role="meter"
                      aria-valuemin={1}
                      aria-valuemax={10}
                      aria-valuenow={product.longevity}
                      aria-label="Výdrž parfému"
                    >
                      <div
                        className="meter-fill"
                        style={{ width: `${product.longevity * 10}%` }}
                      />
                      <b>{product.longevity}/10</b>
                    </div>
                    <div className="meter-scale">
                      <span>Slabá</span>
                      <span>Silná</span>
                    </div>
                  </div>
                )}
                {product.seasons.length > 0 && (
                  <div className="usage-block">
                    <span className="attr-label">Vhodné roční období</span>
                    <OptionTiles
                      options={seasonOptions}
                      active={product.seasons}
                    />
                  </div>
                )}
                {product.occasions.length > 0 && (
                  <div className="usage-block">
                    <span className="attr-label">Vhodné k příležitosti</span>
                    <OptionTiles
                      options={occasionOptions}
                      active={product.occasions}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      title: "Proč zkoušet vzorek",
      content: (
        <p>
          Vzorek vám umožní poznat vůni na vlastní kůži a v běžném nošení dřív,
          než investujete do plného balení. Vzorky začínají už od 1 ml, což při
          běžném dávkování vystačí na několik týdnů používání.
        </p>
      ),
    },
    {
      title: "Doprava a platba",
      content: (
        <p>
          Objednávky expedujeme do 24 hodin z České republiky, obvykle je máte
          doma za 1–2 pracovní dny. Při nákupu nad 900 Kč je doprava po ČR
          zdarma, jinak účtujeme sazbu podle zvoleného přepravce.
        </p>
      ),
    },
    {
      title: "Vrácení zboží",
      content: (
        <p>
          Nepoužité vzorky můžete vrátit do 14 dnů od doručení podle
          standardních podmínek e-shopu.
        </p>
      ),
    },
  ];

  return (
    <div className="home-page pdp">
      <main className="page-shell product-page">
        <div className="breadcrumb">
          <button onClick={onBack}>Vzorky</button>
          <span>/</span>
          <strong>{product.name}</strong>
        </div>
        <div className="pdp-grid">
          <div className="pdp-gallery">
            <img src={product.image} alt={`${product.brand} ${product.name}`} />
            {product.tag && !isHiddenBadge(product.tag) && (
              <span className="pdp-badge">{product.tag}</span>
            )}
          </div>
          <div className="pdp-info">
            <span className="pdp-brand">{product.brand}</span>
            <h1>{product.name}</h1>
            <p className="pdp-lead">{product.description || product.note}</p>

            <div className="pdp-section-label">Velikost</div>
            <div className="size-cards" role="radiogroup" aria-label="Velikost vzorku">
              {volumes.map((volume) => {
                const price = priceFor(product, volume);
                return (
                  <button
                    key={volume.value}
                    role="radio"
                    aria-checked={selected.value === volume.value}
                    className={`size-card ${selected.value === volume.value ? "selected" : ""}`}
                    disabled={volume.future}
                    onClick={() => setSelected(volume)}
                  >
                    <strong>{volume.label}</strong>
                    {volume.future ? (
                      <small>brzy</small>
                    ) : (
                      <>
                        <span>{money(price)}</span>
                        <small>({money(price / volume.value)}/ml)</small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="buy-panel">
              <div className="stock-row">
                <span className="stock-status">
                  <i aria-hidden="true" /> Skladem
                </span>
                <span>Expedujeme do 24 hodin</span>
              </div>
              <div className="ship-note">
                <FiTruck aria-hidden="true" />
                <span>
                  Doprava <b>zdarma od 900 Kč</b>. Doručení obvykle za 1–2
                  pracovní dny.
                </span>
              </div>
              <div className="pdp-price">{money(total)}</div>
              <small className="pdp-price-note">
                {quantity > 1
                  ? `${quantity} × ${money(priceFor(product, selected))}. `
                  : ""}
                Cena za dopravu se vypočítá v košíku.
              </small>
              <div className="buy-row" ref={ctaRef}>
                <div className="qty" aria-label="Počet kusů">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Ubrat kus"
                  >
                    <FiMinus />
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    disabled={quantity >= 10}
                    aria-label="Přidat kus"
                  >
                    <FiPlus />
                  </button>
                </div>
                <button
                  className="pdp-cta"
                  onClick={addSelected}
                  disabled={selected.future}
                >
                  {added ? <FiCheck /> : <FiShoppingBag />}
                  {added ? "Přidáno do košíku" : "Přidat do košíku"}
                </button>
              </div>
            </div>

            <ul className="trust-grid">
              {trustItems.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <Accordion items={accordionItems} />
          </div>
        </div>
      </main>

      {bestsellers.length > 0 && (
        <section className="product-carousel page-shell pdp-bestsellers">
          <div className="carousel-heading">
            <div>
              <h2>Bestsellery</h2>
            </div>
          </div>
          <div className="carousel-track">
            {bestsellers.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onOpen={() => onOpen(item.id)}
                onAdd={() => onAdd(item)}
              />
            ))}
          </div>
        </section>
      )}

      <FaqBand />

      <div className={`sticky-bar ${showBar ? "is-visible" : ""}`} aria-hidden={!showBar}>
        <img src={product.image} alt="" />
        <div className="sticky-bar-copy">
          <strong>
            {product.brand} {product.name}
          </strong>
          <small>
            {selected.label}
            {quantity > 1 ? ` · ${quantity} ks` : ""}
          </small>
        </div>
        <b>{money(total)}</b>
        <button
          className="pdp-cta"
          onClick={addSelected}
          disabled={selected.future}
          tabIndex={showBar ? 0 : -1}
        >
          {added ? <FiCheck /> : <FiShoppingBag />}
          {added ? "Přidáno" : "Přidat do košíku"}
        </button>
      </div>
    </div>
  );
}
function ProductCarousel({ title, eyebrow, products, onOpen, onAdd, badge }) {
  if (!products.length) return null;
  return (
    <section
      onClick={() => navigate("/kolekce")}
      className={`product-carousel page-shell ${title === "Bestsellery" ? "bestseller-carousel" : ""}`}
    >
      <div className="carousel-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="carousel-track">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            tag={badge}
            onOpen={() => onOpen(product.id)}
            onAdd={() => onAdd(product)}
          />
        ))}
      </div>
    </section>
  );
}

function Home({ products, onOpen, onShop }) {
  const newest = [...products]
    .sort(
      (a, b) =>
        new Date(b.created_at || b.updated_at || 0) -
        new Date(a.created_at || a.updated_at || 0),
    )
    .slice(0, 6);
  const bestsellers = products
    .filter((product) =>
      `${product.tag || ""} ${product.name || ""}`
        .toLowerCase()
        .includes("bestseller"),
    )
    .slice(0, 6);
  const bestsellerItems = bestsellers.length
    ? bestsellers
    : products.slice(0, 6);
  return (
    <div className="home-page">
      <section className="hero">
        <img
          className="hero-photo"
          src="https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1600&q=90"
          alt="Flakón parfému"
        />
        <div className="hero-copy">
          <span className="eyebrow">Vybrané vůně s charakterem</span>
          <h1 className="hero-title">
            Objevte svou
            <br />
            <em>signature</em>
            <br />
            vůni.
          </h1>
          <p>
            Vybrané pánské vůně pro muže, kteří chtějí mít vynikající styl,
            čistou autoritu a výraznou přítomnost bez zbytečného hluku.
          </p>
          <button className="primary-button" onClick={onShop}>
            Prozkoumat kolekci <span>↗</span>
          </button>
        </div>
      </section>
      <HomeContent products={products} onOpen={onOpen} onShop={onShop} />
      <ProductCarousel
        title="Novinky"
        badge="NOVINKA"
        products={newest}
        onOpen={onOpen}
        onAdd={() => {}}
      />
      <FaqBand />
    </div>
  );
}
function HomeContent({ products, onOpen, onShop }) {
  const bestsellers = products.filter((product) =>
    `${product.tag || ""} ${product.name || ""}`
      .toLowerCase()
      .includes("bestseller"),
  );
  const bestsellerItems = bestsellers.length
    ? bestsellers
    : products.slice(0, 6);
  const fragranceFamilies = [
    {
      icon: "✦",
      title: "Citrus",
      description: "čerstvé a lehké",
      label: "Rodina vůně",
      tone: "category-coral",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Citrus_slices-1002778.jpeg/960px-Citrus_slices-1002778.jpeg",
    },
    {
      icon: "◌",
      title: "Dřevité",
      description: "čisté a sebejisté",
      label: "Rodina vůně",
      tone: "category-yellow",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/d/d1/Log_Ends_-_geograph.org.uk_-_350620.jpg",
    },
    {
      icon: "◈",
      title: "Sladké",
      description: "hřejivé a návykové",
      label: "Rodina vůně",
      tone: "category-plum",
      image:
        "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "❋",
      title: "Ovocné",
      description: "šťavnaté a hravé",
      label: "Rodina vůně",
      tone: "category-rose",
      image:
        "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "▣",
      title: "Amber",
      description: "teplé a hluboké",
      label: "Rodina vůně",
      tone: "category-sage",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "✧",
      title: "Fresh",
      description: "série pro každý den",
      label: "Rodina vůně",
      tone: "category-ink",
      image:
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "✹",
      title: "Kořeněné",
      description: "výrazné a hřejivé",
      label: "Rodina vůně",
      tone: "category-sun",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "◉",
      title: "Orientální",
      description: "smyslné a hluboké",
      label: "Rodina vůně",
      tone: "category-plum",
      image:
        "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "▰",
      title: "Kožené",
      description: "suché a charakteristické",
      label: "Rodina vůně",
      tone: "category-ink",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/d/d1/Log_Ends_-_geograph.org.uk_-_350620.jpg",
    },
    {
      icon: "▥",
      title: "Tabákové",
      description: "kouřové a sofistikované",
      label: "Rodina vůně",
      tone: "category-coral",
      image:
        "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "♧",
      title: "Zelené",
      description: "svěží a přirozené",
      label: "Rodina vůně",
      tone: "category-sage",
      image:
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "≈",
      title: "Vodní",
      description: "čisté a osvěžující",
      label: "Rodina vůně",
      tone: "category-fog",
      image:
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "◌",
      title: "Pižmové",
      description: "měkké a intimní",
      label: "Rodina vůně",
      tone: "category-rose",
      image:
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "·",
      title: "Pudrové",
      description: "jemné a uhlazené",
      label: "Rodina vůně",
      tone: "category-yellow",
      image:
        "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "❀",
      title: "Bílé květiny",
      description: "elegantní a opojné",
      label: "Rodina vůně",
      tone: "category-coral",
      image:
        "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "◒",
      title: "Jaro",
      description: "SEZÓNA · lehké ráno a nový začátek",
      label: "Podle sezóny",
      tone: "category-rose",
      image:
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "☼",
      title: "Léto",
      description: "SEZÓNA · svěžest na rozpálené dny",
      label: "Podle sezóny",
      tone: "category-sun",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Citrus_slices-1002778.jpeg/960px-Citrus_slices-1002778.jpeg",
    },
    {
      icon: "◐",
      title: "Podzim",
      description: "SEZÓNA · koření, dřevo a vrstvy",
      label: "Podle sezóny",
      tone: "category-plum",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/d/d1/Log_Ends_-_geograph.org.uk_-_350620.jpg",
    },
    {
      icon: "❄",
      title: "Zima",
      description: "SEZÓNA · výrazná stopa a teplo",
      label: "Podle sezóny",
      tone: "category-fog",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "♡",
      title: "Rande",
      description: "POUŽITÍ · blízko, ale s charakterem",
      label: "Podle použití",
      tone: "category-coral",
      image:
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "▤",
      title: "Office",
      description: "POUŽITÍ · čistá autorita bez hluku",
      label: "Podle použití",
      tone: "category-yellow",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/d/d1/Log_Ends_-_geograph.org.uk_-_350620.jpg",
    },
    {
      icon: "✦",
      title: "Večer",
      description: "POUŽITÍ · když má být přítomnost cítit",
      label: "Podle použití",
      tone: "category-sage",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "↗",
      title: "Každý den",
      description: "POUŽITÍ · podpis, ke kterému se vrátíte",
      label: "Podle použití",
      tone: "category-ink",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Citrus_slices-1002778.jpeg/960px-Citrus_slices-1002778.jpeg",
    },
    {
      icon: "⌁",
      title: "Sport",
      description: "POUŽITÍ · čistá energie a svěžest",
      label: "Podle použití",
      tone: "category-fog",
      image:
        "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=900&q=85",
    },
    {
      icon: "✷",
      title: "Párty",
      description: "POUŽITÍ · výrazná stopa po setmění",
      label: "Podle použití",
      tone: "category-plum",
      image:
        "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85",
    },
  ];

  const familySlice = fragranceFamilies.slice.bind(fragranceFamilies);
  fragranceFamilies.slice = (start, end) => {
    if (start === 0 && end === 4) return familySlice(0, 15);
    if (start === 4 && end === 8) return familySlice(15, 19);
    if (start === 8) return familySlice(19);
    return familySlice(start, end);
  };

  const seasonTiles = fragranceFamilies.slice(4, 8);
  const month = new Date().getMonth();
  const currentSeasonName =
    month === 11 || month <= 1
      ? "Zima"
      : month <= 4
        ? "Jaro"
        : month <= 7
          ? "Léto"
          : "Podzim";
  const currentSeason =
    seasonTiles.find((season) => season.title === currentSeasonName) ||
    seasonTiles[0];
  const otherSeasons = seasonTiles.filter(
    (season) => season.title !== currentSeason.title,
  );

  return (
    <main>
      <section className="entry-strip">
        <button
          className="entry-card entry-men"
          onClick={onShop}
          style={{
            backgroundImage:
              "url(https://upload.wikimedia.org/wikipedia/commons/d/d1/Log_Ends_-_geograph.org.uk_-_350620.jpg)",
          }}
        >
          <span>01 / NEJŽÁDANĚJŠÍ</span>
          <strong>Pánské vůně</strong>
          <small>Výrazné kompozice s čistou autoritou</small>
          <b aria-hidden="true">&gt;</b>
        </button>
        <button
          className="entry-card entry-women"
          onClick={onShop}
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85)",
          }}
        >
          <span>02 / OBJEVTE</span>
          <strong>Dámské vůně</strong>
          <small>Elegantní vůně pro vlastní podpis</small>
          <b aria-hidden="true">&gt;</b>
        </button>
        <button
          className="entry-card entry-new"
          onClick={onShop}
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=900&q=85)",
          }}
        >
          <strong>Nové</strong>
          <small>Poslední objevy v naší kolekci</small>
          <b aria-hidden="true">&gt;</b>
        </button>
        <button
          className="entry-card entry-sets"
          onClick={onShop}
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85)",
          }}
        >
          <span>04 / PRO VÍCE VRSTEV</span>
          <strong>Sety</strong>
          <small>Pro více vůní v jednom výběru</small>
          <b aria-hidden="true">&gt;</b>
        </button>
        <button
          className="entry-card entry-sale"
          onClick={onShop}
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=85)",
          }}
        >
          <span>05 / VÝHODNĚJI</span>
          <strong>Akce</strong>
          <small>Výhodnější výběr vůní</small>
          <b aria-hidden="true">&gt;</b>
        </button>
      </section>
      <section className="trust-strip" aria-label="Výhody nákupu">
        <div>
          <FiCheckCircle className="trust-icon" aria-hidden="true" />
          <div className="trust-copy">
            <strong>100% originální</strong>
            <span>ověřené vůně</span>
          </div>
        </div>
        <div>
          <FiDroplet className="trust-icon" aria-hidden="true" />
          <div className="trust-copy">
            <strong>Vzorky od 1 ml</strong>
            <span>vyzkoušíte bez závazku</span>
          </div>
        </div>
        <div>
          <FiZap className="trust-icon" aria-hidden="true" />
          <div className="trust-copy">
            <strong>Expedice z ČR</strong>
            <span>rychle k vám domů</span>
          </div>
        </div>
        <div>
          <FiTruck className="trust-icon" aria-hidden="true" />
          <div className="trust-copy">
            <strong>Doprava zdarma</strong>
            <span>při nákupu od 900 Kč</span>
          </div>
        </div>
      </section>
      <ProductCarousel
        title="Bestsellery"
        badge="BESTSELLER"
        products={bestsellerItems}
        onOpen={onOpen}
        onAdd={() => {}}
      />
      <div className="section-heading secondary-heading">
        <div onClick={onShop}>
          <h2>Parfémové rodiny</h2>
        </div>
      </div>
      <div className="family-track">
        {fragranceFamilies.slice(0, 4).map((family, index) => (
          <button
            className={`family-tile ${family.tone} ${family.title === "Dřevité" ? "family-wood" : ""}`}
            key={family.title}
            onClick={onShop}
            style={{ backgroundImage: `url(${family.image})` }}
          >
            <strong>{family.title}</strong>
            <small>{family.description}</small>
          </button>
        ))}
      </div>
      <div className="section-heading secondary-heading">
        <div onClick={onShop}>
          <h2>Podle sezóny</h2>
        </div>
      </div>
      <div className="season-layout">
        <button
          className={`discovery-tile season-current ${currentSeason.tone}`}
          onClick={onShop}
          style={{ backgroundImage: `url(${currentSeason.image})` }}
        >
          <strong>{currentSeason.title}</strong>
          <small>{currentSeason.description.replace("SEZÓNA · ", "")}</small>
        </button>
        <div className="season-list">
          {otherSeasons.map((season) => (
            <button
              className={`discovery-tile ${season.tone}`}
              key={season.title}
              onClick={onShop}
              style={{ backgroundImage: `url(${season.image})` }}
            >
              <strong>{season.title}</strong>
              <small>{season.description.replace("SEZÓNA · ", "")}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="occasion-strip">
        <div>
          <h2>Podle příležitosti</h2>
        </div>
        <div className="occasion-list">
          {fragranceFamilies.slice(8).map((family, index) => (
            <button
              key={family.title}
              onClick={onShop}
              style={{ backgroundImage: `url(${family.image})` }}
            >
              <strong>{family.title}</strong>
              <small>{family.description.replace("POUŽITÍ · ", "")}</small>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
export default App;
