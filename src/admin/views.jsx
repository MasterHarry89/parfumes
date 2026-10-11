import { useState } from "react";
import {
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiChevronRight,
  FiDollarSign,
  FiDownload,
  FiInfo,
  FiPlus,
  FiPrinter,
  FiRefreshCw,
  FiSend,
  FiShoppingBag,
} from "react-icons/fi";

import { countsAsRevenue, money, orderStatusInfo, volumes } from "../lib/catalog";
import { navigate } from "../lib/navigate";
import { buildPacketaCsv, downloadCsv, isReadyToShip } from "./packetaExport";
import {
  createPackets,
  downloadLabels,
  needsLabel,
  packetStatusLabel,
  refreshPacketStatuses,
} from "./packetaApi";

export const LOW_STOCK_ML = 30;

const statusInfo = orderStatusInfo;

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

// "#1042" once the order has a number (checkout.sql), the short id before that.
export const orderLabel = (order) => (order.number ? `#${order.number}` : shortId(order.id));

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
                      {orderLabel(order)} · {order.date}
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

export function OrdersView({ orders, onReload }) {
  const [filter, setFilter] = useState("all");
  const statuses = [...new Set(orders.map((order) => order.status))];
  const visible =
    filter === "all" ? orders : orders.filter((order) => order.status === filter);
  // Ready to ship and not sent to Zásilkovna yet; and packets still waiting for a label.
  const readyToShip = orders.filter((order) => isReadyToShip(order) && !order.packetId);
  const awaitingLabel = orders.filter(needsLabel);
  const [busy, setBusy] = useState(null); // create | labels | refresh | null
  const [message, setMessage] = useState(null); // { tone, text, list }

  const run = async (action, job) => {
    setBusy(action);
    setMessage(null);
    try {
      await job();
    } catch (error) {
      setMessage({ tone: "bad", text: error.message });
    }
    setBusy(null);
  };

  const sendToPacketa = () =>
    run("create", async () => {
      const { results } = await createPackets(readyToShip.map((order) => order.id));
      const failed = results.filter((result) => !result.ok);
      const byId = new Map(orders.map((order) => [order.id, order]));
      setMessage({
        tone: failed.length ? "bad" : "ok",
        text: `Založeno zásilek: ${results.length - failed.length}.${failed.length ? " Tyto se nepodařilo založit:" : " Teď si stáhněte štítky."}`,
        list: failed.map((result) => {
          const order = byId.get(result.id);
          return `${order ? orderLabel(order) : result.id} (${order?.customer ?? ""}): ${result.error}`;
        }),
      });
      await onReload();
    });

  const printLabels = () =>
    run("labels", () => downloadLabels(awaitingLabel.map((order) => order.id)));

  const refresh = () =>
    run("refresh", async () => {
      const { checked, changed, failed } = await refreshPacketStatuses();
      setMessage({
        tone: failed.length ? "bad" : "ok",
        text: `Zkontrolováno zásilek: ${checked}, změněných objednávek: ${changed}.`,
        list: failed.map((item) => `${item.id}: ${item.error}`),
      });
      await onReload();
    });

  // Fallback without the API: CSV for Zásilkovna's manual import.
  const exportCsv = () => {
    const { csv, count, skipped } = buildPacketaCsv(readyToShip);
    setMessage(
      skipped.length
        ? {
            tone: "bad",
            text: "Tyto objednávky nejsou v exportu, zadejte je v Zásilkovně ručně:",
            list: skipped.map(({ order, reason }) => `${orderLabel(order)} (${order.customer}): ${reason}`),
          }
        : null,
    );
    if (count > 0) downloadCsv(csv, `zasilkovna-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="adm-page">
      <p className="adm-lead">Klikněte na objednávku pro detail, doručení a změnu stavu.</p>
      <div className="adm-ship-actions">
        <button
          className="adm-button"
          disabled={readyToShip.length === 0 || busy !== null}
          onClick={sendToPacketa}
        >
          <FiSend aria-hidden="true" />
          {busy === "create" ? "Zakládám…" : `Odeslat do Zásilkovny (${readyToShip.length})`}
        </button>
        <button
          className="adm-button adm-button-light"
          disabled={awaitingLabel.length === 0 || busy !== null}
          onClick={printLabels}
        >
          <FiPrinter aria-hidden="true" />
          {busy === "labels" ? "Připravuji…" : `Štítky (${awaitingLabel.length})`}
        </button>
        <button className="adm-button adm-button-light" disabled={busy !== null} onClick={refresh}>
          <FiRefreshCw aria-hidden="true" />
          {busy === "refresh" ? "Aktualizuji…" : "Aktualizovat stavy zásilek"}
        </button>
        <button
          className="adm-link"
          disabled={readyToShip.length === 0 || busy !== null}
          onClick={exportCsv}
        >
          <FiDownload aria-hidden="true" /> CSV export
        </button>
      </div>
      {message && (
        <div className={`adm-ship-message ${message.tone === "ok" ? "adm-note" : "adm-alert"}`} role="status">
          {message.text}
          {message.list?.length > 0 && (
            <ul>
              {message.list.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
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
                  <th>Doprava</th>
                  <th>Stav</th>
                  <th className="adm-right">Celkem</th>
                  <th aria-label="Detail" />
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr
                    key={order.id}
                    className="is-link"
                    onClick={() => navigate(`/admin/objednavky/${encodeURIComponent(order.id)}`)}
                  >
                    <td>
                      <strong>{orderLabel(order)}</strong>
                    </td>
                    <td>{order.customer}</td>
                    <td>{order.date}</td>
                    <td>
                      {order.shippingPoint?.name ??
                        (order.shippingAddress ? order.shippingAddress.city : "—")}
                    </td>
                    <td>
                      <StatusPill status={order.status} />
                      {packetStatusLabel(order) && (
                        <small className="adm-sub">{packetStatusLabel(order)}</small>
                      )}
                    </td>
                    <td className="adm-right">
                      <strong>{money(order.total)}</strong>
                    </td>
                    <td className="adm-right adm-row-arrow">
                      <FiChevronRight aria-hidden="true" />
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
