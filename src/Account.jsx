import { useEffect, useState } from "react";

import { supabase } from "./lib/supabase";
import { navigate } from "./lib/navigate";
import { countsAsRevenue, money, orderPoints, orderStatusInfo, toList } from "./lib/catalog";

const authErrorMessage = (error) => {
  const text = error.message ?? "";
  if (error.status === 429 || /rate limit/i.test(text))
    return "Příliš mnoho pokusů. Počkejte několik minut a zkuste to znovu.";
  if (/invalid login credentials/i.test(text)) return "Nesprávný e-mail nebo heslo.";
  if (/not confirmed/i.test(text))
    return "E-mail ještě není potvrzený. Klikněte na odkaz, který jsme vám poslali.";
  if (/already registered/i.test(text)) return "Účet s tímto e-mailem už existuje. Přihlaste se.";
  if (/signups not allowed/i.test(text)) return "Registrace jsou momentálně vypnuté.";
  if (/password/i.test(text)) return "Heslo musí mít alespoň 6 znaků.";
  return text || "Něco se nepovedlo. Zkuste to znovu.";
};

function AuthForm() {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authErrorMessage(authError));
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/ucet` },
      });
      if (authError) setError(authErrorMessage(authError));
      // With e-mail confirmation on, Supabase returns no session until the link is clicked.
      else if (!data.session)
        setNotice("Hotovo! Poslali jsme vám e-mail s odkazem pro potvrzení účtu.");
    }
    setBusy(false);
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "is-active" : ""}
          onClick={() => switchMode("login")}
        >
          Přihlášení
        </button>
        <button
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "is-active" : ""}
          onClick={() => switchMode("register")}
        >
          Registrace
        </button>
      </div>
      <p className="auth-lead">
        {mode === "login"
          ? "Přihlaste se a podívejte se na své objednávky a body."
          : "Za každých 10 Kč zaplaceného nákupu získáte 1 bod."}
      </p>
      <form onSubmit={submit}>
        <label>
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Heslo
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Moment…" : mode === "login" ? "Přihlásit se" : "Vytvořit účet"} <span>→</span>
        </button>
      </form>
    </div>
  );
}

// Every product the customer has paid for, newest first, each listed once.
const purchasedProducts = (orders) => {
  const seen = new Map();
  orders
    .filter((order) => countsAsRevenue(order.status))
    .forEach((order) =>
      toList(order.items).forEach((item) => {
        if (item.product_id && !seen.has(item.product_id)) seen.set(item.product_id, item);
      }),
    );
  return [...seen.values()];
};

function AccountOverview({ session, products }) {
  const [orders, setOrders] = useState(null);
  const [loadError, setLoadError] = useState("");
  const userId = session.user.id;

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError("Objednávky se nepodařilo načíst.");
        setOrders(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const points = (orders ?? []).reduce((sum, order) => sum + orderPoints(order), 0);
  const bought = purchasedProducts(orders ?? []);
  const productById = Object.fromEntries(products.map((product) => [product.id, product]));

  return (
    <>
      <div className="account-head">
        <div>
          <span className="eyebrow">Můj účet</span>
          <p>{session.user.email}</p>
        </div>
        <button className="account-logout" onClick={() => supabase.auth.signOut()}>
          Odhlásit se
        </button>
      </div>

      <section className="points-card" aria-label="Věrnostní body">
        <span className="eyebrow">Věrnostní body</span>
        <strong>{orders === null ? "…" : points.toLocaleString("cs-CZ")}</strong>
        <small>1 bod za každých 10 Kč zaplaceného nákupu</small>
      </section>

      {loadError && <p className="auth-error">{loadError}</p>}

      <section className="account-section">
        <h2>Moje objednávky</h2>
        {orders === null ? (
          <p className="account-muted">Načítám…</p>
        ) : orders.length === 0 ? (
          <div className="account-empty">
            <p>Zatím tu nemáte žádnou objednávku.</p>
            <button className="primary-button" onClick={() => navigate("/kolekce")}>
              Prozkoumat vzorky <span>→</span>
            </button>
          </div>
        ) : (
          <ul className="order-list">
            {orders.map((order) => {
              const [label, tone] = orderStatusInfo(order.status || "pending");
              const earned = orderPoints(order);
              return (
                <li key={order.id} className="order-row">
                  <div className="order-row-top">
                    <div>
                      <strong>Objednávka #{String(order.id).slice(0, 8)}</strong>
                      <small>{new Date(order.created_at).toLocaleDateString("cs-CZ")}</small>
                    </div>
                    <span className={`order-status order-status-${tone}`}>{label}</span>
                    <b>{money(Number(order.total || 0))}</b>
                  </div>
                  {toList(order.items).length > 0 && (
                    <ul className="order-items">
                      {toList(order.items).map((item, index) => (
                        <li key={`${item.product_id}-${item.volume}-${index}`}>
                          {item.brand} {item.name}
                          {item.volume ? ` · ${item.volume}` : ""}
                          {item.quantity > 1 ? ` · ${item.quantity} ks` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  <small className="order-points">
                    {earned > 0 ? `+ ${earned} bodů` : "Body se připíšou po zaplacení"}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bought.length > 0 && (
        <section className="account-section">
          <h2>Moje vůně</h2>
          <ul className="bought-list">
            {bought.map((item) => {
              const product = productById[item.product_id];
              return (
                <li key={item.product_id}>
                  <button
                    disabled={!product}
                    onClick={() => navigate(`/produkt/${item.product_id}`)}
                  >
                    {product?.image && <img src={product.image} alt="" />}
                    <span>
                      <small>{item.brand || product?.brand}</small>
                      {item.name || product?.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

export default function Account({ session, products }) {
  return (
    <main className="page-shell account-page">
      <h1>{session ? "Můj účet" : "Účet"}</h1>
      {session === undefined ? (
        <p className="account-muted">Načítám…</p>
      ) : session ? (
        <AccountOverview session={session} products={products} />
      ) : (
        <AuthForm />
      )}
    </main>
  );
}
