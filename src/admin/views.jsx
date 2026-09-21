import { useState } from "react";
import {
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiDollarSign,
  FiInfo,
  FiPlus,
  FiShoppingBag,
} from "react-icons/fi";

import { countsAsRevenue, money, volumes } from "../lib/catalog";
import { navigate } from "../lib/navigate";

export const LOW_STOCK_ML = 30;

const statusMap = {
  pending: ["Čeká na zaplacení", "warn"],
  paid: ["Zaplaceno", "info"],
  zaplaceno: ["Zaplaceno", "info"],
  processing: ["Zpracovává se", "info"],
  "k výrobě": ["K výrobě", "warn"],
  shipped: ["Odesláno", "ok"],
  odesláno: ["Odesláno", "ok"],
  completed: ["Dokončeno", "muted"],
  dokončeno: ["Dokončeno", "muted"],
  cancelled: ["Zrušeno", "bad"],
  canceled: ["Zrušeno", "bad"],
};
const statusInfo = (status) =>
  statusMap[String(status).toLowerCase()] ?? [String(status), "muted"];

// Cost of one 1 ml sample: the perfume, its packaging and the labour to fill it.
export const sampleCost = (item) => item.costPerMl + item.packaging1 + item.labour1;

export const marginOf = (item) =>
  item.price1 > 0
    ? Math.round(((item.price1 - sampleCost(item)) / item.price1) * 100)
    : null;

const shortId = (id) => {
  const text = String(id);
  return text.length > 10 ? `#${text.slice(0, 8)}` : `#${text}`;
};

function StatusPill({ status }) {
  const [label, tone] = statusInfo(status);
  return <span className={`adm-pill adm-pill-${tone}`}>{label}</span>;
}

export function Product({ item }) {
  const content = (
    <>
      {item.image ? (
        <img src={item.image} alt="" />
      ) : (
        <span className="adm-product-empty" aria-hidden="true">
          <FiBox />
        </span>
      )}
      <div>
        <strong>{item.name}</strong>
        <small>{item.brand || item.productId}</small>
      </div>
    </>
  );
  if (!item.productId) return <div className="adm-product">{content}</div>;
  const href = `/admin/produkty/${encodeURIComponent(item.productId)}`;
  return (
    <a
      className="adm-product adm-product-link"
      href={href}
      title="Upravit produkt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        navigate(href);
      }}
    >
      {content}
    </a>
  );
}

export function Metric({ icon: Icon, label, value, note, tone = "light" }) {
  return (
    <div className={`adm-metric adm-metric-${tone}`}>
      <span className="adm-metric-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="adm-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export function Panel({ title, eyebrow, action, children, flush }) {
  return (
    <section className={`adm-card ${flush ? "adm-card-flush" : ""}`}>
      {(title || action) && (
        <header className="adm-card-head">
          <div>
            {eyebrow && <span className="adm-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="adm-empty">{children}</p>;
}

export function DashboardView({ stock, orders }) {
  const totalMl = stock.reduce((sum, item) => sum + item.stockMl, 0);
  const stockCost = stock.reduce((sum, item) => sum + item.stockMl * item.costPerMl, 0);
  const stockPotential = stock.reduce((sum, item) => sum + item.stockMl * item.price1, 0);
  const low = stock.filter((item) => item.stockMl < LOW_STOCK_ML);
  const revenue = orders
    .filter((order) => countsAsRevenue(order.status))
    .reduce((sum, order) => sum + order.total, 0);
  const pending = orders.filter((order) => order.status === "pending").length;
  const watch = [...stock].sort((a, b) => a.stockMl - b.stockMl).slice(0, 5);
  const maxMl = Math.max(1, ...stock.map((item) => item.stockMl));

  return (
    <div className="adm-page">
      <div className="adm-metrics">
        <Metric
          icon={FiBox}
          label="Hodnota skladu"
          value={money(stockCost)}
          note={`${totalMl.toLocaleString("cs-CZ")} ml · při prodeji ${money(stockPotential)}`}
          tone="lime"
        />
        <Metric
          icon={FiAlertTriangle}
          label="Dochází nebo vyprodáno"
          value={low.length.toString()}
          note={`pod ${LOW_STOCK_ML} ml na skladě`}
        />
        <Metric
          icon={FiDollarSign}
          label="Tržby z objednávek"
          value={money(revenue)}
          note="zaplacené objednávky"
        />
        <Metric
          icon={FiShoppingBag}
          label="Čeká na zaplacení"
          value={pending.toString()}
          note="objednávek ve stavu pending"
          tone="dark"
        />
      </div>

      <div className="adm-grid-2">
        <Panel
          eyebrow="Stav zásob"
          title="Vůně, které hlídat"
          action={
            <button className="adm-link" onClick={() => navigate("/admin/sklad")}>
              Celý sklad →
            </button>
          }
        >
          {watch.length === 0 ? (
            <Empty>Ve skladu zatím nic není.</Empty>
          ) : (
            <ul className="adm-list">
              {watch.map((item) => (
                <li key={item.id}>
                  <Product item={item} />
                  <div
                    className={`adm-bar ${item.stockMl < LOW_STOCK_ML ? "is-low" : ""}`}
                    aria-hidden="true"
                  >
                    <span style={{ width: `${(item.stockMl / maxMl) * 100}%` }} />
                  </div>
                  <b>{item.stockMl} ml</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          eyebrow="Poslední aktivita"
          title="Objednávky"
          action={
            <button className="adm-link" onClick={() => navigate("/admin/objednavky")}>
              Všechny →
            </button>
          }
        >
          {orders.length === 0 ? (
            <Empty>Zatím žádné objednávky. Objeví se po první platbě.</Empty>
          ) : (
            <ul className="adm-list adm-list-orders">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <div>
                    <strong>{order.customer}</strong>
                    <small>
                      {shortId(order.id)} · {order.date}
                    </small>
                  </div>
                  <StatusPill status={order.status} />
                  <b>{money(order.total)}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StockCell({ item, onSave }) {
  const [draft, setDraft] = useState(String(item.stockMl));
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const [message, setMessage] = useState("");

  const commit = async () => {
    const next = Number(draft.replace(",", "."));
    if (!Number.isFinite(next) || next < 0) {
      setDraft(String(item.stockMl));
      setState("error");
      setMessage("Zadejte číslo od 0.");
      return;
    }
    if (next === item.stockMl) {
      setDraft(String(item.stockMl));
      return;
    }
    setState("saving");
    const error = await onSave(item.id, next);
    if (error) {
      setDraft(String(item.stockMl));
      setState("error");
      setMessage(error);
    } else {
      setState("saved");
    }
  };

  return (
    <div className="adm-stock">
      <div className="adm-stock-input">
        <input
          inputMode="decimal"
          aria-label={`Objem ${item.name} v ml`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setState("idle");
          }}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <span>ml</span>
      </div>
      <small className={`adm-stock-note is-${state}`} aria-live="polite">
        {state === "saving" && "Ukládám…"}
        {state === "saved" && (
          <>
            <FiCheck aria-hidden="true" /> Uloženo
          </>
        )}
        {state === "error" && message}
        {state === "idle" && `${Math.floor(item.stockMl / 3)} × 3 ml vzorků`}
      </small>
    </div>
  );
}

export function InventoryView({ stock, onSaveStock, onRestock }) {
  return (
    <div className="adm-page">
      <div className="adm-note">
        <FiInfo aria-hidden="true" />
        <p>
          <strong>Jak to funguje?</strong> Množství můžete opravit přímo v poli (uloží se
          po opuštění pole nebo klávesou Enter). Nový nákup s novou cenou přidáte tlačítkem Doskladnit.
          Marže 1 ml se počítá z prodejní ceny, nákladu na parfém a nákladu na obal.
        </p>
      </div>
      <Panel
        flush
        title="Vůně ve skladu"
        action={
          <button className="adm-button" onClick={() => navigate("/admin/produkty/novy")}>
            <FiPlus aria-hidden="true" /> Nový produkt
          </button>
        }
      >
        {stock.length === 0 ? (
          <Empty>Ve skladu zatím nejsou žádné vůně.</Empty>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Vůně</th>
                  <th>Na skladě</th>
                  <th>Náklad / ml</th>
                  <th>Prodejní ceny</th>
                  <th>Marže 1 ml</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => {
                  const margin = marginOf(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Product item={item} />
                      </td>
                      <td>
                        <StockCell item={item} onSave={onSaveStock} />
                        {item.stockMl === 0 ? (
                          <span className="adm-pill adm-pill-bad">Vyprodáno</span>
                        ) : (
                          item.stockMl < LOW_STOCK_ML && (
                            <span className="adm-pill adm-pill-warn">Dochází</span>
                          )
                        )}
                      </td>
                      <td>{money(item.costPerMl)}</td>
                      <td>
                        <div className="adm-chips">
                          {volumes
                            .filter((volume) => !volume.future)
                            .map((volume) => (
                              <span key={volume.value}>
                                {volume.label} <b>{money(item.priceOf(volume))}</b>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td>
                        {margin === null ? (
                          "—"
                        ) : (
                          <>
                            <strong className="adm-good">{margin} %</strong>
                            <small className="adm-sub">
                              {money(item.price1 - sampleCost(item))} / vzorek
                            </small>
                          </>
                        )}
                      </td>
                      <td className="adm-right">
                        <button className="adm-button adm-button-light" onClick={() => onRestock(item)}>
                          <FiPlus aria-hidden="true" /> Doskladnit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function OrdersView({ orders }) {
  const [filter, setFilter] = useState("all");
  const statuses = [...new Set(orders.map((order) => order.status))];
  const visible =
    filter === "all" ? orders : orders.filter((order) => order.status === filter);

  return (
    <div className="adm-page">
      <p className="adm-lead">
        Objednávky se zde objeví po potvrzení platby přes Stripe.
      </p>
      <Panel flush>
        <div className="adm-tabs" role="tablist" aria-label="Filtr objednávek">
          <button
            role="tab"
            aria-selected={filter === "all"}
            className={filter === "all" ? "is-on" : ""}
            onClick={() => setFilter("all")}
          >
            Všechny <b>{orders.length}</b>
          </button>
          {statuses.map((status) => (
            <button
              key={status}
              role="tab"
              aria-selected={filter === status}
              className={filter === status ? "is-on" : ""}
              onClick={() => setFilter(status)}
            >
              {statusInfo(status)[0]}{" "}
              <b>{orders.filter((order) => order.status === status).length}</b>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <Empty>Zatím tu nejsou žádné objednávky.</Empty>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Objednávka</th>
                  <th>Zákazník</th>
                  <th>Datum</th>
                  <th>Stav</th>
                  <th className="adm-right">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{shortId(order.id)}</strong>
                    </td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td>
                      <StatusPill status={order.status} />
                    </td>
                    <td className="adm-right">
                      <strong>{money(order.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
