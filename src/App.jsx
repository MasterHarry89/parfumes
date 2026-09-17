import './App.css'
import './admin.css'

import { useEffect, useMemo, useState } from 'react'
  const hero = null

import { supabase } from './lib/supabase'

const volumes = [{ value: 1, label: '1 ml', price: 0 }, { value: 2, label: '2 ml', price: 30 }, { value: 3, label: '3 ml', price: 55 }, { value: 5, label: '5 ml', price: 90, future: true }, { value: 10, label: '10 ml', price: 150, future: true }]
const money = (value) => `${(value / 10).toFixed(2).replace('.', ',')} Kč`
const navigate = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo({ top: 0, behavior: 'smooth' }) }

const loadProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').eq('active', true)

  if (error) {
    console.error('loadProducts error:', error)
    return []
  }

  return (data ?? []).map((product) => ({
    ...product,
    id: product.id,
    name: product.name,
    brand: product.brand || 'Presence',
    family: product.family || 'Dřevitá',
    price: Number(product.price || 0),
    image: product.image || 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=85',
    note: product.note || 'Premium scent',
    tag: product.tag || 'Bestseller',
  }))
}

const loadInventory = async () => {
  const { data, error } = await supabase.from('inventory').select('*')

  if (error) {
    console.error('loadInventory error:', error)
    return []
  }

  return (data ?? []).map((item) => ({
    ...item,
    id: item.id,
    product_id: item.product_id,
    stockMl: Number(item.stock_ml || 0),
    costPerMl: Number(item.cost_per_ml || 0),
    prices: { 1: Number(item.cost_per_ml || 0), 2: Number(item.cost_per_ml || 0) + 30, 3: Number(item.cost_per_ml || 0) + 55, 5: Number(item.cost_per_ml || 0) + 90, 10: Number(item.cost_per_ml || 0) + 150 },
  }))
}

const loadOrders = async () => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })

  if (error) {
    console.error('loadOrders error:', error)
    return []
  }

  return (data ?? []).map((order) => ({
    ...order,
    id: order.id,
    customer: order.customer_name || 'Zákazník',
    date: new Date(order.created_at).toLocaleDateString('cs-CZ'),
    status: order.status || 'pending',
    total: Number(order.total || 0),
    items: 1,
  }))
}

function AdminApp({ path, inventoryData, ordersData }) {
  const [inventory, setInventory] = useState(inventoryData)
  const active = path === '/admin/sklad' ? 'sklad' : path === '/admin/objednavky' ? 'objednavky' : path === '/admin/finance' ? 'finance' : 'prehled'

  useEffect(() => {
    setInventory(inventoryData)
  }, [inventoryData])

  const totalMl = inventory.reduce((sum, item) => sum + item.stockMl, 0)
  const possibleSamples = inventory.reduce((sum, item) => sum + Math.floor(item.stockMl / 1), 0)
  const revenue = ordersData.reduce((sum, order) => sum + order.total, 0)
  const costs = inventory.reduce((sum, item) => sum + (item.stockMl * item.costPerMl), 0)
  const updateStock = (id, value) => setInventory((items) => items.map((item) => item.id === id ? { ...item, stockMl: Math.max(0, Number(value) || 0) } : item))
  return <div className="admin-app"><aside className="admin-sidebar"><button className="admin-logo" onClick={() => navigate('/admin')}>ÉP<span>ADMIN</span></button><div className="admin-account"><span className="admin-avatar">JD</span><div><strong>Jan Dvořák</strong><small>Administrátor</small></div></div><nav><span>ŘÍZENÍ OBCHODU</span><button className={active === 'prehled' ? 'active' : ''} onClick={() => navigate('/admin')}>⌂ Přehled</button><button className={active === 'sklad' ? 'active' : ''} onClick={() => navigate('/admin/sklad')}>◫ Sklad a ceny</button><button className={active === 'objednavky' ? 'active' : ''} onClick={() => navigate('/admin/objednavky')}>▤ Objednávky <i>{ordersData.length}</i></button><span>ANALYTIKA</span><button className={active === 'finance' ? 'active' : ''} onClick={() => navigate('/admin/finance')}>◒ Finance a marže</button><button>⌁ Přehled vůní</button></nav><button className="back-shop" onClick={() => navigate('/')}>← Zpět do e-shopu</button></aside><main className="admin-main"><header className="admin-header"><div><span className="eyebrow">Éparfumes / Admin</span><h1>{active === 'sklad' ? 'Sklad a ceny' : active === 'objednavky' ? 'Objednávky' : active === 'finance' ? 'Finance a marže' : 'Dobrý den, Jane.'}</h1></div><div className="admin-header-actions"><span className="admin-live"><b /> Systém online</span><button className="admin-bell">♧</button></div></header>{active === 'sklad' ? <InventoryView inventory={inventory} updateStock={updateStock} /> : active === 'objednavky' ? <OrdersView orders={ordersData} /> : active === 'finance' ? <FinanceView inventory={inventory} revenue={revenue} costs={costs} /> : <DashboardView totalMl={totalMl} possibleSamples={possibleSamples} revenue={revenue} inventory={inventory} orders={ordersData} />}</main></div>
}

function DashboardView({ totalMl, possibleSamples, revenue, inventory, orders }) { return <div className="admin-content"><div className="admin-actions-row"><p className="admin-muted">Úterý 15. září 2026 <span>·</span> poslední aktualizace právě teď</p><button className="admin-primary" onClick={() => navigate('/admin/sklad')}>+ Naskladnit vůni</button></div><div className="metric-grid"><Metric label="Objem ve skladu" value={`${totalMl} ml`} note="napříč 6 vůněmi" tone="sage" /><Metric label="Dostupné vzorky" value={possibleSamples.toLocaleString('cs-CZ')} note="při výrobě 1 ml" tone="yellow" /><Metric label="Tržby tento měsíc" value={money(revenue)} note="+18,4 % oproti srpnu" tone="coral" /><Metric label="Objednávky ke zpracování" value={orders.length.toString()} note="všechny aktivní objednávky" tone="ink" /></div><div className="admin-grid-two"><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">Stav zásob</span><h2>Vůně, které hlídat</h2></div><button onClick={() => navigate('/admin/sklad')}>Celý sklad →</button></div>{inventory.slice(0, 4).map((item) => <div className="stock-line" key={item.id}><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.brand}</small></div><div className="stock-bar"><span style={{ width: `${Math.min(100, item.stockMl / 2)}%` }} /></div><b>{item.stockMl} ml</b></div>)}</section><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">Poslední aktivita</span><h2>Objednávky</h2></div><button onClick={() => navigate('/admin/objednavky')}>Všechny →</button></div>{orders.slice(0, 3).map((order) => <div className="order-line" key={order.id}><span className="order-dot" /><div><strong>{order.id}</strong><small>{order.customer}</small></div><span className={`status status-${order.status.replace(' ', '-').toLowerCase()}`}>{order.status}</span><b>{money(order.total)}</b></div>)}</section></div></div> }
function Metric({ label, value, note, tone }) { return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div> }
function InventoryView({ inventory, updateStock }) { return <div className="admin-content"><div className="admin-actions-row"><p className="admin-muted">Naskladňujete základní parfém v mililitrech. Vzorky se odečtou až po zaplacení objednávky.</p><button className="admin-primary">+ Naskladnit vůni</button></div><div className="inventory-explainer"><span>i</span><p><strong>Jak to funguje?</strong> Zadejte množství originální vůně, které máte k dispozici. Systém automaticky hlídá, kolik 1 ml, 2 ml nebo 3 ml vzorků lze vyrobit. Při objednávce se odečte skutečně spotřebovaný objem.</p></div><section className="admin-panel inventory-panel"><div className="inventory-table-head"><span>Vůně</span><span>Dostupný objem</span><span>Náklad / ml</span><span>Prodejní ceny</span><span>Marže 1 ml</span></div>{inventory.map((item) => <div className="inventory-row" key={item.id}><div className="inventory-product"><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.brand} · {item.family}</small></div></div><div className="stock-input"><input type="number" value={item.stockMl} onChange={(event) => updateStock(item.id, event.target.value)} min="0" /><span>ml</span><small>{Math.floor(item.stockMl / 3)} × 3 ml vzorků</small></div><div className="cost-cell">{money(item.costPerMl)}<small>za 1 ml</small></div><div className="price-chips"><span>1 ml <b>{money(item.prices[1])}</b></span><span>2 ml <b>{money(item.prices[2])}</b></span><span>3 ml <b>{money(item.prices[3])}</b></span></div><div className="margin-cell"><strong>{Math.round(((item.prices[1] - item.costPerMl) / item.prices[1]) * 100)} %</strong><small>{money(item.prices[1] - item.costPerMl)} / vzorek</small></div></div>)}</section></div> }
function OrdersView({ orders }) { return <div className="admin-content"><div className="admin-actions-row"><p className="admin-muted">Objednávky se zde objeví po potvrzení platby přes Stripe.</p><select className="admin-select"><option>Všechny objednávky</option><option>Čekají na výrobu</option><option>Odeslané</option></select></div><section className="admin-panel orders-panel"><div className="orders-tabs"><button className="active">Všechny <b>{orders.length}</b></button><button>Čekají na výrobu <b>{orders.filter((order) => order.status === 'pending').length}</b></button><button>Odeslané</button></div><div className="orders-table-head"><span>Objednávka</span><span>Zákazník</span><span>Datum</span><span>Stav</span><span>Celkem</span></div>{orders.map((order) => <div className="orders-row" key={order.id}><strong>{order.id}</strong><div><b>{order.customer}</b><small>{order.items} položky</small></div><span>{order.date}</span><span className={`status status-${order.status.replace(' ', '-').toLowerCase()}`}>{order.status}</span><strong>{money(order.total)}</strong><button>···</button></div>)}</section></div> }
function FinanceView({ inventory, revenue, costs }) { const projected = inventory.reduce((sum, item) => sum + (item.stockMl * item.prices[1]), 0); return <div className="admin-content"><div className="admin-actions-row"><p className="admin-muted">Přehled ekonomiky podle prodejních cen a evidovaných nákladů.</p><select className="admin-select"><option>Září 2026</option><option>Srpen 2026</option></select></div><div className="metric-grid finance-metrics"><Metric label="Tržby celkem" value={money(revenue)} note="24 objednávek" tone="coral" /><Metric label="Náklady na vůně" value={money(costs)} note="spotřebovaný objem" tone="yellow" /><Metric label="Hrubý zisk" value={money(revenue - costs)} note="před dopravou a reklamou" tone="sage" /><Metric label="Průměrná marže" value="68,2 %" note="za všechny vůně" tone="ink" /></div><section className="admin-panel finance-panel"><div className="panel-heading"><div><span className="eyebrow">Ekonomika katalogu</span><h2>Výnosnost jednotlivých vůní</h2></div><span className="admin-period">Září 2026</span></div><div className="finance-table-head"><span>Vůně</span><span>Prodáno</span><span>Tržby</span><span>Náklady</span><span>Zisk</span><span>Marže</span></div>{inventory.map((item, index) => { const sold = [18, 12, 23, 7, 15, 10][index]; const sales = sold * item.prices[1]; const spend = sold * item.costPerMl; return <div className="finance-row" key={item.id}><div><strong>{item.name}</strong><small>{item.brand}</small></div><span>{sold} ks</span><span>{money(sales)}</span><span>{money(spend)}</span><strong>{money(sales - spend)}</strong><b>{Math.round(((sales - spend) / sales) * 100)} %</b></div>})}<div className="finance-total"><strong>Celkem</strong><strong>85 ks</strong><strong>{money(3275)}</strong><strong>{money(1280)}</strong><strong>{money(1995)}</strong><b>60,9 %</b></div></section><p className="admin-footnote">Výpočet je orientační prototyp. Produkce musí rozlišovat náklad na parfém, obal, rozprašovač, etiketu, práci, dopravu, platební poplatky a reklamu.</p></div> }

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const [loadedProducts, loadedInventory, loadedOrders] = await Promise.all([
        loadProducts(),
        loadInventory(),
        loadOrders(),
      ])

      setProducts(loadedProducts)
      setInventory(loadedInventory)
      setOrders(loadedOrders)
    }

    fetchData()
  }, [])

  useEffect(() => { const onPopState = () => setPath(window.location.pathname); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState) }, [])
  const addToCart = (product, volume = volumes[0]) => { if (volume.future) return; setCart((items) => [...items, { ...product, volume: volume.label, price: product.price + volume.price }]) }
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.brand} ${product.family}`.toLowerCase().includes(search.toLowerCase())), [products, search])
  const currentProduct = products.find((product) => path.includes(product.id))
  if (path.startsWith('/admin')) return <AdminApp path={path} inventoryData={inventory} ordersData={orders} />
  const renderCatalog = () => <main className="catalog-page page-shell"><div className="breadcrumb"><button onClick={() => navigate('/')}>Domů</button><span>/</span><strong>Všechny vůně</strong></div><div className="catalog-heading"><div><p className="eyebrow">Objevte svůj podpis</p><h1>Vzorky parfémů</h1></div><p className="heading-note">Malé množství. Velký první dojem.<br />Vyberte si vůni bez závazků.</p></div><div className="catalog-toolbar"><span>{filtered.length} vůní</span><button className="filter-button">☷ &nbsp; Filtry</button><select aria-label="Řazení"><option>Doporučené</option><option>Nejnovější</option><option>Od nejlevnějších</option></select></div><div className="catalog-layout"><aside className="filters"><span className="eyebrow">Filtrovat</span><h3>Pro koho</h3><label><input type="checkbox" /> Ženy</label><label><input type="checkbox" /> Muži</label><label><input type="checkbox" /> Unisex</label><h3>Rodina vůně</h3>{['Svěží', 'Dřevitá', 'Čistá', 'Citrusová', 'Pižmová'].map((family) => <label key={family}><input type="checkbox" /> {family}</label>)}<h3>Velikost</h3><div className="size-pills">{volumes.slice(0, 3).map((volume) => <button key={volume.value}>{volume.label}</button>)}</div></aside><section className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onOpen={() => navigate(`/produkt/${product.id}`)} onAdd={() => addToCart(product)} />)}</section></div></main>
  const renderProduct = () => currentProduct ? <ProductDetail product={currentProduct} onAdd={addToCart} onBack={() => navigate('/kolekce')} /> : renderCatalog()
  const renderCart = () => <main className="page-shell cart-page"><div className="breadcrumb"><button onClick={() => navigate('/')}>Domů</button><span>/</span><strong>Košík</strong></div><h1>Váš výběr</h1>{cart.length ? <><div className="cart-items">{cart.map((item, index) => <div className="cart-row" key={`${item.id}-${index}`}><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.brand} · {item.volume}</small></div><b>{money(item.price)}</b></div>)}</div><div className="cart-summary"><span>Mezisoučet</span><strong>{money(cart.reduce((sum, item) => sum + item.price, 0))}</strong><button className="primary-button" onClick={() => alert('Checkout bude napojený na Stripe.')}>Pokračovat k platbě <span>↗</span></button></div></> : <div className="empty-cart"><span className="empty-mark">✦</span><h2>Košík čeká na vaši první vůni</h2><button className="primary-button" onClick={() => navigate('/kolekce')}>Prozkoumat vzorky <span>↗</span></button></div>}</main>
  const content = path === '/kosik' ? renderCart() : path === '/kolekce' || path === '/znacky' ? renderCatalog() : path.startsWith('/produkt/') ? renderProduct() : <Home products={products} onOpen={(id) => navigate(`/produkt/${id}`)} onShop={() => navigate('/kolekce')} />
  return <div className="app"><div className="announcement">Doprava zdarma od 900 Kč <span>·</span> Vzorky, které vás dostanou blíž k vaší vůni</div><header className="site-header"><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Otevřít menu">☰</button><button className="wordmark" onClick={() => navigate('/')}>ÉPARFUMES<span>®</span></button><nav className={menuOpen ? 'nav-open' : ''}><button onClick={() => { setMenuOpen(false); navigate('/kolekce') }}><span className="nav-icon">◌</span>Vzorky</button><button onClick={() => { setMenuOpen(false); navigate('/kolekce') }}><span className="nav-icon">✦</span>Ženy</button><button onClick={() => { setMenuOpen(false); navigate('/kolekce') }}><span className="nav-icon">▣</span>Muži</button><button onClick={() => { setMenuOpen(false); navigate('/znacky') }}><span className="nav-icon">◍</span>Značky</button><button onClick={() => { setMenuOpen(false); navigate('/kolekce') }}><span className="nav-icon">✧</span>Novinky</button></nav><div className="header-actions"><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hledat vůni" onKeyDown={(event) => event.key === 'Enter' && navigate('/kolekce')} /></label><button className="icon-button" aria-label="Účet">♙</button><button className="cart-button" onClick={() => navigate('/kosik')}>Košík <span>{cart.length}</span></button></div></header><div className="search-results">{search && <button onClick={() => navigate('/kolekce')}>Zobrazit výsledky pro „{search}“ <span>→</span></button>}</div>{content}<footer><div className="footer-top"><div><button className="wordmark" onClick={() => navigate('/')}>ÉPARFUMES<span>®</span></button><p>Vůně, které si nejdříve<br />můžete opravdu vyzkoušet.</p></div><div><span className="eyebrow">Nakupovat</span><button onClick={() => navigate('/kolekce')}>Všechny vzorky</button><button onClick={() => navigate('/kolekce')}>Bestsellery</button><button onClick={() => navigate('/znacky')}>Značky</button></div><div><span className="eyebrow">Pomoc</span><button>Doprava a platba</button><button>Vrácení zboží</button><button>Kontakt</button></div><div><span className="eyebrow">Buďte u toho</span><p>Novinky, tipy a vůně<br />přímo do schránky.</p><label className="newsletter"><input placeholder="Váš e-mail" /><button>→</button></label></div></div><div className="footer-bottom"><span>© 2026 Éparfumes</span><span>Česká republika · CZK</span><span>Instagram &nbsp; TikTok</span></div></footer></div>
}

function ProductCard({ product, onOpen, onAdd }) { return <article className="product-card"><button className="product-image" onClick={onOpen}><img src={product.image} alt={`${product.brand} ${product.name}`} /><span className="product-tag">{product.tag}</span><span className="quick-add">+</span></button><div className="product-info"><div><span className="brand">{product.brand}</span><h3 onClick={onOpen}>{product.name}</h3><p>{product.note}</p></div><div className="product-bottom"><strong>od {money(product.price)}</strong><button onClick={onAdd} aria-label={`Přidat ${product.name}`}>+</button></div></div></article> }
function ProductDetail({ product, onAdd, onBack }) { const [selected, setSelected] = useState(volumes[0]); return <main className="page-shell product-page"><div className="breadcrumb"><button onClick={onBack}>Vzorky</button><span>/</span><strong>{product.name}</strong></div><div className="product-detail"><div className="detail-image"><img src={product.image} alt={`${product.brand} ${product.name}`} /><span>{product.tag}</span></div><div className="detail-copy"><span className="eyebrow">{product.brand}</span><h1>{product.name}</h1><p className="detail-note">{product.note}</p><div className="rule" /><p>Vůně, která se otevírá pomalu. Objednejte si malý vzorek a nechte ji ukázat, co ve vás probudí.</p><div className="detail-price"><span>Vyberte velikost</span><strong>{money(product.price + selected.price)}</strong></div><div className="volume-options">{volumes.map((volume) => <button key={volume.value} className={selected.value === volume.value ? 'selected' : ''} disabled={volume.future} onClick={() => setSelected(volume)}>{volume.label}{volume.future && <small>brzy</small>}</button>)}</div><button className="primary-button full" onClick={() => onAdd(product, selected)} disabled={selected.future}>Přidat do košíku <span>↗</span></button><div className="detail-benefits"><span>✦ 100% originální vůně</span><span>◌ Expedujeme z ČR</span><span>↺ 14 dní na vrácení</span></div></div></div></main> }
function Home({ products, onOpen, onShop }) { return <><section className="hero"><div className="hero-copy"><span className="eyebrow">Contemporary fragrance house</span><h1>Presence<br /><em>for men.</em></h1><p>Vybrané pánské vůně pro muže, kteří chtějí mít vynikající styl, čistou autoritu a výraznou přítomnost bez zbytečného hluku.</p><button className="primary-button" onClick={onShop}>Prozkoumat kolekci <span>↗</span></button></div><div className="hero-visual"><div className="sun-disc" /><div className="hero-bottle"><span>PR</span><small>sample / 03</small></div><div className="hero-orbit">1 ml<br /><span>silná osobnost<br />v každé vrstvě</span></div></div></section><HomeContent products={products} onOpen={onOpen} onShop={onShop} /></> }
function HomeContent({ products, onOpen, onShop }) {
  const fragranceFamilies = [
    { icon: '✦', title: 'Citrus', description: 'čerstvé a lehké', label: 'Rodina vůně', tone: 'category-coral' },
    { icon: '◌', title: 'Dřevité', description: 'čisté a sebejisté', label: 'Rodina vůně', tone: 'category-yellow' },
    { icon: '▣', title: 'Amber', description: 'teplé a hluboké', label: 'Rodina vůně', tone: 'category-sage' },
    { icon: '✧', title: 'Fresh', description: 'série pro každý den', label: 'Rodina vůně', tone: 'category-ink' },
    { icon: '◒', title: 'Jaro', description: 'SEZÓNA · lehké ráno a nový začátek', label: 'Podle sezóny', tone: 'category-rose' },
    { icon: '☼', title: 'Léto', description: 'SEZÓNA · svěžest na rozpálené dny', label: 'Podle sezóny', tone: 'category-sun' },
    { icon: '◐', title: 'Podzim', description: 'SEZÓNA · koření, dřevo a vrstvy', label: 'Podle sezóny', tone: 'category-plum' },
    { icon: '❄', title: 'Zima', description: 'SEZÓNA · výrazná stopa a teplo', label: 'Podle sezóny', tone: 'category-fog' },
    { icon: '♡', title: 'Rande', description: 'POUŽITÍ · blízko, ale s charakterem', label: 'Podle použití', tone: 'category-coral' },
    { icon: '▤', title: 'Office', description: 'POUŽITÍ · čistá autorita bez hluku', label: 'Podle použití', tone: 'category-yellow' },
    { icon: '✦', title: 'Večer', description: 'POUŽITÍ · když má být přítomnost cítit', label: 'Podle použití', tone: 'category-sage' },
    { icon: '↗', title: 'Každý den', description: 'POUŽITÍ · podpis, ke kterému se vrátíte', label: 'Podle použití', tone: 'category-ink' },
    { icon: '⌁', title: 'Sport', description: 'POUŽITÍ · čistá energie a svěžest', label: 'Podle použití', tone: 'category-fog' },
    { icon: '✷', title: 'Párty', description: 'POUŽITÍ · výrazná stopa po setmění', label: 'Podle použití', tone: 'category-plum' },
  ]

    return <main><section className="entry-strip"><button className="entry-card entry-men" onClick={onShop}><span>01 / NEJŽÁDANĚJŠÍ</span><strong>Pánské</strong><small>Výrazné kompozice s čistou autoritou</small><b>Prozkoumat ↗</b></button><button className="entry-card entry-women" onClick={onShop}><span>02 / OBJEVTE</span><strong>Dámské</strong><small>Elegantní vůně pro vlastní podpis</small><b>Prozkoumat ↗</b></button><button className="entry-card entry-new" onClick={onShop}><span>03 / ČERSTVĚ PŘIDÁNO</span><strong>Nové vůně</strong><small>Poslední objevy v naší kolekci</small><b>Prozkoumat ↗</b></button></section><div className="section-heading secondary-heading"><div><span className="eyebrow">Podle charakteru</span><h2>Oblíbené skupiny</h2></div><button onClick={onShop}>Všechny rodiny <span>↗</span></button></div><div className="family-track">{fragranceFamilies.slice(0, 4).map((family, index) => <button className={`family-tile ${family.tone}`} key={family.title} onClick={onShop}><span className="family-step">0{index + 1}</span><span className="family-icon">{family.icon}</span><strong>{family.title}</strong><small>{family.description}</small><b>↗</b></button>)}</div><div className="discovery-layout"><div className="discovery-season"><span className="eyebrow">Podle sezóny</span><h2>Vůně pro<br /><em>každé období.</em></h2><p>Vyberte si kompozici podle nálady a počasí.</p><button className="text-button" onClick={onShop}>Prohlédnout sezóny <span>↗</span></button></div><div className="discovery-tiles">{fragranceFamilies.slice(4, 8).map((family) => <button className={`discovery-tile ${family.tone}`} key={family.title} onClick={onShop}><span className="family-icon">{family.icon}</span><strong>{family.title}</strong><small>{family.description.replace('SEZÓNA · ', '')}</small></button>)}</div></div><div className="occasion-strip"><div><span className="eyebrow">Podle použití</span><h2>Kam dnes míříte?</h2></div><div className="occasion-list">{fragranceFamilies.slice(8).map((family, index) => <button key={family.title} onClick={onShop}><span>0{index + 1}</span><strong>{family.title}</strong><small>{family.description.replace('POUŽITÍ · ', '')}</small><b>↗</b></button>)}</div></div>
</main>

}
export default App
