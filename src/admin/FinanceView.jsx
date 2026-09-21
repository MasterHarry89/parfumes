import { useState } from "react";
import {
  FiChevronRight,
  FiDollarSign,
  FiPercent,
  FiPlus,
  FiShoppingBag,
  FiTrash2,
  FiTrendingUp,
} from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { navigate } from "../lib/navigate";
import {
  countsAsRevenue,
  money,
  monthKey,
  parseNumber,
  todayString,
  toStored,
} from "../lib/catalog";
import { expenseCategories } from "./expenses";
import { Empty, Metric, Panel, Product, marginOf, sampleCost } from "./views";

const categoryLabel = Object.fromEntries(expenseCategories.map((category) => [category.key, category.label]));

const saveError = (error) =>
  error.code === "42P01" || /expenses/.test(error.message)
    ? "Tabulka výdajů ještě neexistuje. Spusťte supabase/finance.sql."
    : `Uložení se nepovedlo: ${error.message}`;

function AddExpenseForm({ onSaved }) {
  const [form, setForm] = useState({ date: todayString(), category: "platform", label: "", amount: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const amount = parseNumber(form.amount);
    if (!form.label.trim()) return setMessage("Zadejte popis výdaje.");
    if (!(amount >= 0) || form.amount === "") return setMessage("Zadejte částku v Kč.");
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("expenses").insert({
      spent_on: form.date,
      category: form.category,
      label: form.label.trim(),
      amount: toStored(amount),
    });
    setBusy(false);
    if (error) return setMessage(saveError(error));
    setForm({ ...form, label: "", amount: "" });
    await onSaved(form.date);
  };

  return (
    <form className="pf-card pf" onSubmit={submit} noValidate>
      <header>
        <h2>Přidat výdaj</h2>
        <p>Nákupy parfému a materiálu se zapisují samy. Tady přidejte poplatky platforem, reklamu a ostatní.</p>
      </header>
      <div className="pf-grid pf-grid-4">
        <label className="pf-field">
          <span className="pf-label">Datum</span>
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Kategorie</span>
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {expenseCategories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span className="pf-label">Popis</span>
          <input
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
            placeholder="Stripe poplatky, Shoptet, reklama…"
          />
        </label>
        <label className="pf-field">
          <span className="pf-label">Částka (Kč)</span>
          <input
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="299"
          />
        </label>
      </div>
      {message && (
        <p className="adm-alert" role="alert">
          {message}
        </p>
      )}
      <button className="adm-button adm-submit" disabled={busy}>
        <FiPlus aria-hidden="true" /> {busy ? "Ukládám…" : "Přidat výdaj"}
      </button>
    </form>
  );
}

const SHORT_MONTHS = Array.from({ length: 12 }, (_, index) => {
  const text = new Date(2000, index, 1).toLocaleDateString("cs-CZ", { month: "short" }).replace(".", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
});

const sum = (values) => values.reduce((total, value) => total + value, 0);
const zeros = () => Array(12).fill(0);
// Whole crowns without the unit keep 13 columns readable; "—" for empty cells. Input is tenths of CZK.
const kc = (tenths) => (Math.round(tenths) === 0 ? "—" : Math.round(tenths / 10).toLocaleString("cs-CZ"));

const shortId = (id) => {
  const text = String(id);
  return text.length > 10 ? `#${text.slice(0, 8)}` : `#${text}`;
};

// Label with the expand arrow AFTER the text, so labels line up with the plain rows.
function Expander({ open, onClick, children }) {
  return (
    <button type="button" className="adm-expander" aria-expanded={open} onClick={onClick}>
      {children}
      <FiChevronRight aria-hidden="true" />
    </button>
  );
}
const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "—");

const yearOf = (value) => Number(monthKey(value).slice(0, 4));
const monthIndex = (value) => Number(monthKey(value).slice(5, 7)) - 1;

export default function FinanceView({ stock, orders, expenses, ready, labour, onReload }) {
  const thisYear = new Date().getFullYear();
  const nowIndex = new Date().getMonth();
  const [year, setYear] = useState(thisYear);
  const [error, setError] = useState("");
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState([]);
  const toggleGroup = (key) =>
    setOpenGroups((open) => (open.includes(key) ? open.filter((item) => item !== key) : [...open, key]));

  const years = [
    ...new Set([
      thisYear,
      year,
      ...orders.map((order) => yearOf(order.createdAt)),
      ...expenses.map((expense) => yearOf(expense.date)),
    ]),
  ].sort((a, b) => b - a);

  // ---- revenue: paid orders only
  const revenue = zeros();
  const orderCount = zeros();
  const revenueLines = [];
  orders
    .filter((order) => countsAsRevenue(order.status) && yearOf(order.createdAt) === year)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((order) => {
      const index = monthIndex(order.createdAt);
      revenue[index] += order.total;
      orderCount[index] += 1;
      const months = zeros();
      months[index] = order.total;
      revenueLines.push({ label: `${shortId(order.id)} · ${order.customer}`, months, total: order.total });
    });

  // ---- expenses of the year: category -> label -> amount per month
  const yearExpenses = expenses.filter((expense) => yearOf(expense.date) === year);
  const groups = expenseCategories
    .map((category) => {
      const lines = new Map();
      yearExpenses
        .filter((expense) => expense.category === category.key)
        .forEach((expense) => {
          // Every distinct thing that was paid for becomes its own line.
          const label = expense.label.trim();
          const key = label.toLowerCase();
          if (!lines.has(key)) lines.set(key, { label, months: zeros() });
          lines.get(key).months[monthIndex(expense.date)] += expense.amount;
        });
      const list = [...lines.values()]
        .map((line) => ({ ...line, total: sum(line.months) }))
        .sort((a, b) => b.total - a.total);
      const months = zeros();
      list.forEach((line) => line.months.forEach((value, index) => (months[index] += value)));
      return { ...category, lines: list, months, total: sum(months) };
    })
    .filter((group) => group.lines.length > 0);

  const expenseMonths = zeros();
  groups.forEach((group) => group.months.forEach((value, index) => (expenseMonths[index] += value)));
  const profit = revenue.map((value, index) => value - expenseMonths[index]);

  const revenueTotal = sum(revenue);
  const expenseTotal = sum(expenseMonths);
  const profitTotal = revenueTotal - expenseTotal;
  const labourEstimate = sum(orderCount) * labour.perOrder;

  const monthCells = (values, render = kc) =>
    values.map((value, index) => (
      <td key={index} className={index === nowIndex && year === thisYear ? "is-now" : ""}>
        {render(value, index)}
      </td>
    ));

  const removeExpense = async (expense) => {
    if (!window.confirm(`Opravdu smazat výdaj „${expense.label}“?`)) return;
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (deleteError) setError(saveError(deleteError));
    else {
      setError("");
      await onReload();
    }
  };

  return (
    <div className="adm-page">
      {!ready && (
        <p className="adm-alert adm-spaced" role="alert">
          Tabulka výdajů ještě neexistuje. Spusťte v Supabase SQL editoru soubor supabase/finance.sql a stránku obnovte.
        </p>
      )}

      <div className="adm-metrics">
        <Metric
          icon={FiDollarSign}
          label={`Obrat ${year}`}
          value={money(revenueTotal)}
          note={`${sum(orderCount)} zaplacených objednávek`}
          tone="lime"
        />
        <Metric icon={FiShoppingBag} label={`Výdaje ${year}`} value={money(expenseTotal)} note="nákupy, materiál, poplatky" />
        <Metric icon={FiTrendingUp} label={`Zisk ${year}`} value={money(profitTotal)} note="obrat minus výdaje" />
        <Metric
          icon={FiPercent}
          label="Marže"
          value={revenueTotal > 0 ? percent(profitTotal, revenueTotal) : "—"}
          note="zisk z obratu"
          tone="dark"
        />
      </div>

      <Panel
        flush
        eyebrow="Po měsících · částky v Kč"
        title="Finanční přehled"
        action={
          <label className="adm-toolbar-field">
            <span>Rok</span>
            <select className="adm-select" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="adm-scroll">
          <table className="adm-table adm-year">
            <thead>
              <tr>
                <th />
                {SHORT_MONTHS.map((label, index) => (
                  <th key={label} className={`adm-right ${index === nowIndex && year === thisYear ? "is-now" : ""}`}>
                    {label}
                  </th>
                ))}
                <th className="adm-right is-total">Celkem</th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-strong">
                <th scope="row">
                  <Expander open={revenueOpen} onClick={() => setRevenueOpen(!revenueOpen)}>
                    Obrat
                  </Expander>
                </th>
                {monthCells(revenue)}
                <td className="is-total">{kc(revenueTotal)}</td>
              </tr>
              {revenueOpen && revenueLines.length === 0 && (
                <tr className="is-child">
                  <th scope="row" colSpan={14}>
                    V roce {year} zatím nejsou žádné zaplacené objednávky.
                  </th>
                </tr>
              )}
              {revenueOpen &&
                revenueLines.map((line) => (
                  <tr key={line.label} className="is-child">
                    <th scope="row" title={line.label}>
                      {line.label}
                    </th>
                    {monthCells(line.months)}
                    <td className="is-total">{kc(line.total)}</td>
                  </tr>
                ))}

              <tr className="is-strong is-line">
                <th scope="row">
                  <Expander open={expensesOpen} onClick={() => setExpensesOpen(!expensesOpen)}>
                    Výdaje
                  </Expander>
                </th>
                {monthCells(expenseMonths)}
                <td className="is-total">{kc(expenseTotal)}</td>
              </tr>
              {expensesOpen && groups.length === 0 && (
                <tr className="is-child">
                  <th scope="row" colSpan={14}>
                    V roce {year} zatím nejsou zapsané žádné výdaje. Nákupy parfému a materiálu se zapíšou samy, ostatní
                    přidáte formulářem Přidat výdaj níže.
                  </th>
                </tr>
              )}
              {expensesOpen &&
                groups.map((group) => {
                  const open = openGroups.includes(group.key);
                  return [
                    <tr key={group.key} className="is-group">
                      <th scope="row">
                        <Expander open={open} onClick={() => toggleGroup(group.key)}>
                          {group.label}
                        </Expander>
                      </th>
                      {monthCells(group.months)}
                      <td className="is-total">{kc(group.total)}</td>
                    </tr>,
                    ...(open
                      ? group.lines.map((line) => (
                          <tr key={`${group.key}-${line.label}`} className="is-child">
                            <th scope="row" title={line.label}>
                              {line.label}
                            </th>
                            {monthCells(line.months)}
                            <td className="is-total">{kc(line.total)}</td>
                          </tr>
                        ))
                      : []),
                  ];
                })}

              <tr className="is-strong is-line">
                <th scope="row">Marže</th>
                {monthCells(revenue, (value, index) => percent(profit[index], value))}
                <td className="is-total">{percent(profitTotal, revenueTotal)}</td>
              </tr>
              <tr className="is-strong">
                <th scope="row">Zisk</th>
                {monthCells(profit, (value) =>
                  Math.round(value) === 0 ? "—" : <span className={value < 0 ? "adm-bad" : ""}>{kc(value)}</span>,
                )}
                <td className="is-total">
                  <span className={profitTotal < 0 ? "adm-bad" : ""}>{kc(profitTotal)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="adm-footnote adm-inset-note">
          Nákupy se počítají v měsíci, kdy jste je zaplatili. V měsících, kdy nakupujete zásoby, je zisk proto nižší a
          později se to srovná. Do obratu se počítají jen zaplacené objednávky.
        </p>
      </Panel>

      <div className="adm-stack adm-spaced-top">
        {labour.perOrder > 0 ? (
          <section className="adm-card">
            <header className="adm-card-head">
              <div>
                <span className="adm-eyebrow">Rok {year}</span>
                <h2>Hodnota vlastní práce (odhad)</h2>
              </div>
            </header>
            <ul className="adm-cost-tiles">
              <li>
                <span>Práce na objednávky</span>
                <strong>{money(labourEstimate)}</strong>
                <small>
                  {sum(orderCount)} × {money(labour.perOrder)}
                </small>
              </li>
              <li>
                <span>Zisk po započtení práce</span>
                <strong className={profitTotal - labourEstimate < 0 ? "adm-bad" : ""}>
                  {money(profitTotal - labourEstimate)}
                </strong>
                <small>zisk minus vlastní práce</small>
              </li>
            </ul>
          </section>
        ) : (
          <p className="adm-lead">
            Chcete vidět i hodnotu vlastní práce?{" "}
            <button className="adm-link-strong" onClick={() => navigate("/admin/prace")}>
              Nastavte čas a hodinovou sazbu →
            </button>
          </p>
        )}

        <AddExpenseForm
          onSaved={async (date) => {
            await onReload();
            setYear(yearOf(date));
          }}
        />

        <section className="adm-card adm-card-flush">
          <header className="adm-card-head">
            <div>
              <span className="adm-eyebrow">Rok {year}</span>
              <h2>Záznamy výdajů</h2>
            </div>
          </header>
          {error && (
            <p className="adm-alert adm-inset" role="alert">
              {error}
            </p>
          )}
          {yearExpenses.length === 0 ? (
            <Empty>V tomto roce nejsou žádné záznamy.</Empty>
          ) : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Kategorie</th>
                    <th>Popis</th>
                    <th className="adm-right">Částka</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {yearExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{new Date(expense.date).toLocaleDateString("cs-CZ")}</td>
                      <td>
                        <span className="adm-pill">{categoryLabel[expense.category] ?? expense.category}</span>
                      </td>
                      <td>{expense.label}</td>
                      <td className="adm-right">
                        <strong>{money(expense.amount)}</strong>
                      </td>
                      <td className="adm-right">
                        <button
                          className="adm-icon-button"
                          aria-label={`Smazat výdaj ${expense.label}`}
                          title="Smazat"
                          onClick={() => removeExpense(expense)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Panel flush eyebrow="Ekonomika katalogu" title="Výnosnost jednotlivých vůní">
          {stock.length === 0 ? (
            <Empty>Ve skladu zatím nejsou žádné vůně.</Empty>
          ) : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Vůně</th>
                    <th>Na skladě</th>
                    <th>Cena 1 ml</th>
                    <th>Náklad 1 vzorku</th>
                    <th>Marže</th>
                    <th className="adm-right">Hodnota zásob (parfém)</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item) => {
                    const itemMargin = marginOf(item);
                    return (
                      <tr key={item.id}>
                        <td>
                          <Product item={item} />
                        </td>
                        <td>{item.stockMl} ml</td>
                        <td>{money(item.price1)}</td>
                        <td>{money(sampleCost(item))}</td>
                        <td>{itemMargin === null ? "—" : <strong className="adm-good">{itemMargin} %</strong>}</td>
                        <td className="adm-right">{money(item.stockMl * item.costPerMl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
