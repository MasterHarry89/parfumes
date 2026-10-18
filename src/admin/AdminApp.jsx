import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowUpRight,
  FiBox,
  FiClock,
  FiGrid,
  FiHome,
  FiLogOut,
  FiPackage,
  FiShoppingBag,
  FiTag,
  FiTrendingUp,
} from "react-icons/fi";

import "./admin.css";
import { supabase } from "../lib/supabase";
import { navigate } from "../lib/navigate";
import { useAdminAccess, useSession } from "../lib/auth";
import { packagingCost, priceFor, sampleVolumes, toList } from "../lib/catalog";
import DiscountsView from "./DiscountsView";
import FinanceView from "./FinanceView";
import LaborView from "./LaborView";
import PackagingView from "./PackagingView";
import ProductForm from "./ProductForm";
import ProductsView from "./ProductsView";
import RestockDialog from "./Restock";
import OrderDetail from "./OrderDetail";
import { DashboardView, InventoryView, OrdersView, orderLabel } from "./views";

const pages = [
  { path: "/admin", key: "prehled", title: "Přehled", icon: FiHome },
  { path: "/admin/produkty", key: "produkty", title: "Produkty", icon: FiGrid },
  { path: "/admin/sklad", key: "sklad", title: "Sklad a ceny", icon: FiBox },
  { path: "/admin/obal", key: "obal", title: "Obalový materiál", icon: FiPackage },
  // Not in the menu: reached with the "Nový produkt" button on the Produkty page.
  { path: "/admin/produkty/novy", key: "novy-produkt", title: "Nový produkt", hidden: true },
  { path: "/admin/objednavky", key: "objednavky", title: "Objednávky", icon: FiShoppingBag },
  { path: "/admin/slevy", key: "slevy", title: "Slevy", icon: FiTag },
  { path: "/admin/prace", key: "prace", title: "Práce a čas", icon: FiClock },
  { path: "/admin/finance", key: "finance", title: "Finance", icon: FiTrendingUp },
];

const loadAll = async () => {
  const [products, inventory, orders, materials, expenses, tasks, settings, discounts] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("inventory").select("*"),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("packaging_materials").select("*").order("created_at"),
    supabase.from("expenses").select("*").order("spent_on", { ascending: false }),
    supabase.from("labor_tasks").select("*").order("created_at"),
    supabase.from("admin_settings").select("*"),
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
  ]);
  const failed = [products, inventory, orders].find((result) => result.error);
  if (failed) throw failed.error;

  return {
    products: products.data ?? [],
    // Until supabase/pricing.sql has been run the table does not exist; the rest of the admin still works.
    financeReady: !expenses.error,
    laborReady: !tasks.error && !settings.error,
    expenses: (expenses.data ?? []).map((expense) => ({
      id: expense.id,
      date: expense.spent_on,
      category: expense.category,
      label: expense.label,
      amount: Number(expense.amount || 0),
    })),
    laborTasks: (tasks.data ?? []).map((task) => ({
      id: task.id,
      name: task.name,
      minutes: Number(task.minutes || 0),
      unit: task.unit,
    })),
    hourlyRateKc: Number(
      (settings.data ?? []).find((setting) => setting.key === "hourly_rate")?.value?.kc || 0,
    ),
    // Until supabase/discounts.sql has been run the table does not exist.
    discountsReady: !discounts.error,
    discounts: (discounts.data ?? []).map((code) => ({
      id: code.id,
      code: code.code,
      kind: code.kind,
      value: Number(code.value || 0),
      validFrom: code.valid_from ?? "",
      validTo: code.valid_to ?? "",
      minOrder: Number(code.min_order || 0),
      maxUses: code.max_uses ?? null,
      oncePerCustomer: Boolean(code.once_per_customer),
      active: code.active !== false,
      note: code.note ?? "",
    })),
    materialsReady: !materials.error,
    materials: (materials.data ?? []).map((material) => ({
      id: material.id,
      name: material.name,
      stockQty: Number(material.stock_qty || 0),
      unitCost: Number(material.unit_cost || 0),
      perSample: Number(material.per_sample ?? 1),
      sizes: toList(material.sizes).map(Number),
    })),
    inventory: (inventory.data ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      stockMl: Number(item.stock_ml || 0),
      costPerMl: Number(item.cost_per_ml || 0),
    })),
    orders: (orders.data ?? []).map((order) => ({
      id: order.id,
      createdAt: order.created_at,
      customer: order.customer_name || "Zákazník",
      date: new Date(order.created_at).toLocaleDateString("cs-CZ"),
      status: order.status || "pending",
      total: Number(order.total || 0),
      number: order.order_number ?? null,
      userId: order.user_id ?? null,
      email: order.email ?? "",
      phone: order.phone ?? "",
      note: order.note ?? "",
      items: toList(order.items),
      shippingMethod: order.shipping_method ?? null,
      shippingPoint: order.shipping_point ?? null,
      shippingAddress: order.shipping_address ?? null,
      shippingPrice: Number(order.shipping_price || 0),
      paymentMethod: order.payment_method ?? null,
      paymentFee: Number(order.payment_fee || 0),
      discountId: order.discount_id ?? null,
      discountCode: order.discount_code ?? null,
      discountAmount: Number(order.discount_amount || 0),
      packetId: order.packeta_packet_id ?? null,
      barcode: order.packeta_barcode ?? null,
      packetStatus: order.packeta_status ?? null,
      packetStatusCode: order.packeta_status_code ?? null,
    })),
  };
};

function Screen({ children }) {
  return <div className="adm adm-screen">{children}</div>;
}

function Wordmark() {
  return (
    <span className="adm-wordmark">
      ÉPARFUMES<sup>®</sup>
    </span>
  );
}

const loginErrorMessage = (error) => {
  const text = error.message ?? "";
  if (error.status === 429 || /rate limit/i.test(text))
    return "Příliš mnoho pokusů. Počkejte několik minut a zkuste to znovu.";
  if (/invalid login credentials/i.test(text))
    return "Nesprávný e-mail nebo heslo. Pozor, prohlížeč může doplnit heslo z jiného webu.";
  if (/not confirmed/i.test(text))
    return "E-mail účtu není potvrzený. V Supabase u uživatele zapněte potvrzení (Auto Confirm).";
  return `Přihlášení se nepovedlo: ${text || "neznámá chyba"}`;
};

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(loginErrorMessage(authError));
    setBusy(false);
  };

  return (
    <Screen>
      <form className="adm-login" onSubmit={submit}>
        <Wordmark />
        <h1>Přihlášení do administrace</h1>
        <p>Tato část je jen pro správce e-shopu.</p>
        <label>
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Heslo</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}
        <button className="adm-primary" disabled={busy}>
          {busy ? "Přihlašuji…" : "Přihlásit se"}
        </button>
        <button type="button" className="adm-link" onClick={() => navigate("/")}>
          ← Zpět do e-shopu
        </button>
      </form>
    </Screen>
  );
}

function AccessProblem({ access, session }) {
  const denied = access.status === "denied";
  return (
    <Screen>
      <div className="adm-login">
        <Wordmark />
        <h1>{denied ? "Tento účet nemá přístup" : "Nepodařilo se ověřit přístup"}</h1>
        <p>
          {denied
            ? `Účet ${session.user.email} není mezi správci. Přidejte ho do tabulky admins (viz supabase/admin-lockdown.sql).`
            : `Databáze odpověděla: ${access.message}. Pokud jste ještě nespustili supabase/admin-lockdown.sql, udělejte to.`}
        </p>
        <button className="adm-primary" onClick={() => supabase.auth.signOut()}>
          Odhlásit se
        </button>
        <button className="adm-link" onClick={() => navigate("/")}>
          ← Zpět do e-shopu
        </button>
      </div>
    </Screen>
  );
}

function NavLink({ page, active }) {
  const Icon = page.icon;
  return (
    <a
      href={page.path}
      className={active ? "is-active" : ""}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        navigate(page.path);
      }}
    >
      <Icon aria-hidden="true" />
      {page.title}
    </a>
  );
}

function AdminShell({ path, session, onCatalogChanged }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await loadAll());
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Packaging cost of one sample, per size (tenths of CZK).
  const packaging = useMemo(
    () =>
      Object.fromEntries(
        sampleVolumes.map((volume) => [volume.value, packagingCost(data?.materials ?? [], volume.value)]),
      ),
    [data],
  );

  // Labour cost in tenths of CZK: per filled sample and per order.
  const labour = useMemo(() => {
    const perMinute = ((data?.hourlyRateKc ?? 0) * 10) / 60;
    const sum = (unit) =>
      (data?.laborTasks ?? [])
        .filter((task) => task.unit === unit)
        .reduce((total, task) => total + task.minutes * perMinute, 0);
    return { perSample: sum("sample"), perOrder: sum("order") };
  }, [data]);

  const stock = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.products.map((product) => [product.id, product]));
    return data.inventory.map((item) => {
      const product = byId.get(item.productId);
      const priced = {
        price: Number(product?.price || 0),
        prices: product?.prices && typeof product.prices === "object" ? product.prices : {},
      };
      return {
        ...item,
        name: product?.name ?? item.productId,
        brand: product?.brand ?? "",
        image: product?.image ?? null,
        price1: product ? priceFor(priced, sampleVolumes[0]) : 0,
        priceOf: (volume) => (product ? priceFor(priced, volume) : 0),
        packaging1: packaging[1] ?? 0,
        labour1: labour.perSample,
      };
    });
  }, [data, packaging, labour]);

  const [restocking, setRestocking] = useState(null);

  const saveStock = async (id, stockMl) => {
    const { error } = await supabase.from("inventory").update({ stock_ml: stockMl }).eq("id", id);
    if (error) return "Uložení se nepovedlo.";
    setData((current) => ({
      ...current,
      inventory: current.inventory.map((item) => (item.id === id ? { ...item, stockMl } : item)),
    }));
    return null;
  };

  const saveOrderStatus = async (id, status) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return "Stav se nepodařilo uložit.";
    setData((current) => ({
      ...current,
      orders: current.orders.map((order) => (order.id === id ? { ...order, status } : order)),
    }));
    return null;
  };

  const cleanPath = path.replace(/\/$/, "");
  const orderMatch = cleanPath.match(/^\/admin\/objednavky\/([^/]+)$/);
  const orderId = orderMatch ? decodeURIComponent(orderMatch[1]) : null;
  const openOrder = orderId && data ? data.orders.find((order) => String(order.id) === orderId) : null;
  const editMatch = cleanPath.match(/^\/admin\/produkty\/(?!novy$)([^/]+)$/);
  const editId = editMatch ? decodeURIComponent(editMatch[1]) : null;
  const editProduct = editId && data ? data.products.find((product) => product.id === editId) : null;
  const page = editMatch
    ? { key: "upravit-produkt", title: "Upravit produkt" }
    : orderMatch
    ? { key: "objednavka", title: "Objednávka" }
    : (pages.find((candidate) => candidate.path === cleanPath) ?? pages[0]);
  const navKey = ["novy-produkt", "upravit-produkt"].includes(page.key)
    ? "produkty"
    : page.key === "objednavka"
      ? "objednavky"
      : page.key;
  const headTitle =
    page.key === "upravit-produkt" && editProduct
      ? editProduct.name
      : page.key === "objednavka" && openOrder
        ? `Objednávka ${orderLabel(openOrder)}`
        : page.title;
  const today = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let content;
  if (loadError) {
    content = (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Data se nepodařilo načíst: {loadError}
        </p>
        <button className="adm-button" onClick={reload}>
          Zkusit znovu
        </button>
      </div>
    );
  } else if (!data) {
    content = (
      <div className="adm-page">
        <p className="adm-lead">Načítám data…</p>
      </div>
    );
  } else if (page.key === "sklad") {
    content = <InventoryView stock={stock} onSaveStock={saveStock} onRestock={setRestocking} />;
  } else if (page.key === "obal") {
    content = (
      <PackagingView
        materials={data.materials}
        ready={data.materialsReady}
        packaging={packaging}
        onReload={reload}
      />
    );
  } else if (page.key === "produkty") {
    content = <ProductsView products={data.products} stock={stock} />;
  } else if (page.key === "upravit-produkt") {
    content = editProduct ? (
      <ProductForm
        key={editProduct.id}
        product={editProduct}
        inventoryCostPerMl={data.inventory.find((item) => item.productId === editProduct.id)?.costPerMl ?? null}
        existingIds={[]}
        materials={data.materials}
        labourPerSample={labour.perSample}
        onSaved={async () => {
          await reload();
          await onCatalogChanged?.();
        }}
        onOpenProduct={(id) => navigate(`/produkt/${id}`)}
        onBack={() => navigate("/admin/produkty")}
      />
    ) : (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Produkt „{editId}“ neexistuje.
        </p>
        <button className="adm-button" onClick={() => navigate("/admin/produkty")}>
          Zpět na produkty
        </button>
      </div>
    );
  } else if (page.key === "novy-produkt") {
    content = (
      <ProductForm
        existingIds={data.products.map((product) => product.id)}
        materials={data.materials}
        labourPerSample={labour.perSample}
        onSaved={async () => {
          await reload();
          await onCatalogChanged?.();
        }}
        onOpenProduct={(id) => navigate(`/produkt/${id}`)}
        onBack={() => navigate("/admin/produkty")}
      />
    );
  } else if (page.key === "objednavka") {
    content = openOrder ? (
      <OrderDetail order={openOrder} onSaveStatus={saveOrderStatus} />
    ) : (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Objednávka neexistuje.
        </p>
        <button className="adm-button" onClick={() => navigate("/admin/objednavky")}>
          Zpět na objednávky
        </button>
      </div>
    );
  } else if (page.key === "objednavky") {
    content = <OrdersView orders={data.orders} onReload={reload} />;
  } else if (page.key === "finance") {
    content = (
      <FinanceView
        stock={stock}
        orders={data.orders}
        expenses={data.expenses}
        ready={data.financeReady}
        labour={labour}
        onReload={reload}
      />
    );
  } else if (page.key === "slevy") {
    content = (
      <DiscountsView
        ready={data.discountsReady}
        codes={data.discounts}
        orders={data.orders}
        onReload={reload}
      />
    );
  } else if (page.key === "prace") {
    content = (
      <LaborView
        ready={data.laborReady}
        rateKc={data.hourlyRateKc}
        tasks={data.laborTasks}
        labour={labour}
        onReload={reload}
      />
    );
  } else {
    content = <DashboardView stock={stock} orders={data.orders} />;
  }

  return (
    <div className="adm">
      <aside className="adm-side">
        <a
          href="/admin"
          className="adm-brand"
          onClick={(event) => {
            event.preventDefault();
            navigate("/admin");
          }}
        >
          <Wordmark />
          <span>ADMIN</span>
        </a>
        <nav aria-label="Administrace">
          {pages
            .filter((candidate) => !candidate.hidden)
            .map((candidate) => (
              <NavLink key={candidate.key} page={candidate} active={candidate.key === navKey} />
            ))}
        </nav>
        <div className="adm-side-foot">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <FiArrowUpRight aria-hidden="true" /> Zobrazit e-shop
          </a>
          <div className="adm-user">
            <span className="adm-avatar" aria-hidden="true">
              {session.user.email.slice(0, 2).toUpperCase()}
            </span>
            <span className="adm-user-mail">{session.user.email}</span>
            <button aria-label="Odhlásit se" title="Odhlásit se" onClick={() => supabase.auth.signOut()}>
              <FiLogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      <main className="adm-main">
        <header className="adm-head">
          <div>
            <span className="adm-eyebrow">{today}</span>
            <h1>{headTitle}</h1>
          </div>
        </header>
        {content}
        {restocking && data && (
          <RestockDialog
            item={stock.find((item) => item.id === restocking.id) ?? restocking}
            materials={data.materials}
            labourPerSample={labour.perSample}
            onClose={() => setRestocking(null)}
            onDone={async () => {
              await reload();
              await onCatalogChanged?.();
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function AdminApp({ path, onCatalogChanged }) {
  const session = useSession();
  const access = useAdminAccess(session);

  if (session === undefined) return <Screen><p className="adm-lead">Načítám…</p></Screen>;
  if (!session) return <AdminLogin />;
  if (access.status === "checking") return <Screen><p className="adm-lead">Ověřuji přístup…</p></Screen>;
  if (access.status !== "ok") return <AccessProblem access={access} session={session} />;
  return <AdminShell path={path} session={session} onCatalogChanged={onCatalogChanged} />;
}
