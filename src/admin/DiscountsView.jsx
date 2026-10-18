import { useRef, useState } from "react";
import { FiEdit2, FiInfo, FiPause, FiPlay, FiPlus, FiTrash2 } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { countsAsRevenue, money, parseNumber, toStored } from "../lib/catalog";
import { discountState, discountValueLabel, isValidCode, normalizeCode } from "../lib/discounts";

const emptyDraft = {
  id: null,
  code: "",
  kind: "percent",
  value: "",
  minOrder: "",
  validFrom: "",
  validTo: "",
  maxUses: "",
  oncePerCustomer: false,
  note: "",
};

// Stored values -> what the form shows (Kč amounts are stored in tenths).
const draftOf = (code) => ({
  id: code.id,
  code: code.code,
  kind: code.kind,
  value: String(code.kind === "fixed" ? code.value / 10 : code.value).replace(".", ","),
  minOrder: code.minOrder ? String(code.minOrder / 10).replace(".", ",") : "",
  validFrom: code.validFrom,
  validTo: code.validTo,
  maxUses: code.maxUses ? String(code.maxUses) : "",
  oncePerCustomer: code.oncePerCustomer,
  note: code.note,
});

const saveError = (error) => {
  if (error.code === "23505") return "Kód s tímto názvem už existuje.";
  if (error.code === "42P01" || /discount_codes/.test(error.message))
    return "Tabulka slev ještě neexistuje. Spusťte supabase/discounts.sql.";
  return `Uložení se nepovedlo: ${error.message}`;
};

// An order uses up a code unless it was cancelled (same rule as discount_quote()).
const isCancelled = (status) => ["cancelled", "canceled", "zrušeno"].includes(String(status).toLowerCase());

const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("cs-CZ") : "");
const validityLabel = (code) =>
  code.validFrom && code.validTo
    ? `${formatDate(code.validFrom)} – ${formatDate(code.validTo)}`
    : code.validFrom
      ? `od ${formatDate(code.validFrom)}`
      : code.validTo
        ? `do ${formatDate(code.validTo)}`
        : "bez omezení";

function DiscountForm({ draft, setDraft, onSaved, formRef }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = (patch) => setDraft({ ...draft, ...patch });
  const editing = draft.id !== null;

  const submit = async (event) => {
    event.preventDefault();
    const code = normalizeCode(draft.code);
    const value = parseNumber(draft.value);
    const minOrder = draft.minOrder === "" ? 0 : parseNumber(draft.minOrder);
    const maxUses = draft.maxUses === "" ? null : Number(draft.maxUses);
    if (!isValidCode(code)) return setMessage("Kód musí mít 3–32 znaků: písmena bez diakritiky, číslice, - nebo _.");
    if (!(value > 0)) return setMessage("Zadejte hodnotu slevy větší než 0.");
    if (draft.kind === "percent" && value > 100) return setMessage("Procentní sleva může být nejvýš 100 %.");
    if (!(minOrder >= 0)) return setMessage("Minimální nákup musí být číslo od 0.");
    if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses > 0))
      return setMessage("Počet použití musí být celé číslo větší než 0.");
    if (draft.validFrom && draft.validTo && draft.validTo < draft.validFrom)
      return setMessage("Konec platnosti musí být po jejím začátku.");

    const row = {
      code,
      kind: draft.kind,
      value: draft.kind === "fixed" ? toStored(value) : value,
      min_order: toStored(minOrder),
      valid_from: draft.validFrom || null,
      valid_to: draft.validTo || null,
      max_uses: maxUses,
      once_per_customer: draft.oncePerCustomer,
      note: draft.note.trim() || null,
    };
    setBusy(true);
    setMessage("");
    const { error } = editing
      ? await supabase.from("discount_codes").update(row).eq("id", draft.id)
      : await supabase.from("discount_codes").insert(row);
    setBusy(false);
    if (error) return setMessage(saveError(error));
    setDraft(emptyDraft);
    await onSaved();
  };

  return (
    <form className="pf-card pf" onSubmit={submit} noValidate ref={formRef}>
      <header>
        <h2>{editing ? `Upravit kód ${draft.code}` : "Nový slevový kód"}</h2>
        <p>
          Sleva se odečte jen ze zboží, ne z dopravy. Změna hodnoty platí pro nové objednávky, ty dřívější si slevu
          pamatují.
        </p>
      </header>
      <div className="pf-grid pf-grid-3">
        <label className="pf-field">
          <span className="pf-label">Kód</span>
          <input
            value={draft.code}
            onChange={(event) => set({ code: event.target.value.toUpperCase() })}
            placeholder="např. PODZIM10"
            autoComplete="off"
          />
          <small className="pf-hint">Zákazník ho může psát malými i velkými písmeny.</small>
        </label>
        <label className="pf-field">
          <span className="pf-label">Typ slevy</span>
          <select value={draft.kind} onChange={(event) => set({ kind: event.target.value })}>
            <option value="percent">Procenta ze zboží</option>
            <option value="fixed">Pevná částka v Kč</option>
          </select>
        </label>
        <label className="pf-field">
          <span className="pf-label">Hodnota ({draft.kind === "percent" ? "%" : "Kč"})</span>
          <input
            inputMode="decimal"
            value={draft.value}
            onChange={(event) => set({ value: event.target.value })}
            placeholder={draft.kind === "percent" ? "např. 10" : "např. 100"}
          />
        </label>
        <label className="pf-field">
          <span className="pf-label">Platí od</span>
          <input type="date" value={draft.validFrom} onChange={(event) => set({ validFrom: event.target.value })} />
          <small className="pf-hint">Prázdné = platí hned.</small>
        </label>
        <label className="pf-field">
          <span className="pf-label">Platí do (včetně)</span>
          <input type="date" value={draft.validTo} onChange={(event) => set({ validTo: event.target.value })} />
          <small className="pf-hint">Prázdné = bez konce.</small>
        </label>
        <label className="pf-field">
          <span className="pf-label">Minimální nákup zboží (Kč)</span>
          <input
            inputMode="decimal"
            value={draft.minOrder}
            onChange={(event) => set({ minOrder: event.target.value })}
            placeholder="bez omezení"
          />
        </label>
        <label className="pf-field">
          <span className="pf-label">Počet použití celkem</span>
          <input
            inputMode="numeric"
            value={draft.maxUses}
            onChange={(event) => set({ maxUses: event.target.value })}
            placeholder="bez omezení"
          />
        </label>
        <div className="pf-field">
          <span className="pf-label">Na zákazníka</span>
          <label className="pf-switch">
            <input
              type="checkbox"
              checked={draft.oncePerCustomer}
              onChange={(event) => set({ oncePerCustomer: event.target.checked })}
            />
            <span>Jen jednou na zákazníka</span>
          </label>
          <small className="pf-hint">Hlídá se podle e-mailu objednávky.</small>
        </div>
        <label className="pf-field">
          <span className="pf-label">Interní poznámka</span>
          <input
            value={draft.note}
            onChange={(event) => set({ note: event.target.value })}
            placeholder="např. Instagram kampaň"
          />
        </label>
      </div>
      {message && (
        <p className="adm-alert" role="alert">
          {message}
        </p>
      )}
      <div className="adm-form-actions">
        <button className="adm-button adm-submit" disabled={busy}>
          {editing ? <FiEdit2 aria-hidden="true" /> : <FiPlus aria-hidden="true" />}{" "}
          {busy ? "Ukládám…" : editing ? "Uložit změny" : "Přidat kód"}
        </button>
        {editing && (
          <button
            type="button"
            className="adm-button adm-button-light"
            onClick={() => {
              setDraft(emptyDraft);
              setMessage("");
            }}
          >
            Zrušit úpravy
          </button>
        )}
      </div>
    </form>
  );
}

export default function DiscountsView({ ready, codes, orders, onReload }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");
  const formRef = useRef(null);

  if (!ready) {
    return (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Tabulka slev ještě neexistuje. Spusťte v Supabase SQL editoru soubor supabase/discounts.sql a stránku
          obnovte.
        </p>
      </div>
    );
  }

  // Per code: uses (every order not cancelled) and money from paid orders.
  const stats = (code) => {
    const withCode = orders.filter((order) => order.discountId === code.id && !isCancelled(order.status));
    const paid = withCode.filter((order) => countsAsRevenue(order.status));
    return {
      used: withCode.length,
      granted: paid.reduce((sum, order) => sum + order.discountAmount, 0),
      revenue: paid.reduce((sum, order) => sum + order.total, 0),
    };
  };

  const update = async (code, patch) => {
    const { error: updateError } = await supabase.from("discount_codes").update(patch).eq("id", code.id);
    if (updateError) return setError(saveError(updateError));
    setError("");
    await onReload();
  };

  const toggleActive = (code) => {
    if (code.active && !window.confirm(`Ukončit kód ${code.code}? Zákazníci ho už nepůjdou použít.`)) return;
    update(code, { active: !code.active });
  };

  const remove = async (code) => {
    if (!window.confirm(`Opravdu smazat kód ${code.code}?`)) return;
    const { error: deleteError } = await supabase.from("discount_codes").delete().eq("id", code.id);
    if (deleteError) return setError(saveError(deleteError));
    setError("");
    if (draft.id === code.id) setDraft(emptyDraft);
    await onReload();
  };

  const edit = (code) => {
    setDraft(draftOf(code));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="adm-page">
      <div className="adm-note">
        <FiInfo aria-hidden="true" />
        <p>
          <strong>Jak slevy fungují:</strong> zákazník zadá kód v pokladně a sleva se odečte ze zboží. Doprava zdarma
          se počítá až ze zlevněné částky. Kód „spotřebuje“ každá objednávka, která není zrušená. Ukončený kód zůstane
          v historii, smazat jde jen kód, který ještě nikdo nepoužil.
        </p>
      </div>

      <div className="adm-stack">
        <DiscountForm draft={draft} setDraft={setDraft} onSaved={onReload} formRef={formRef} />

        <section className="adm-card adm-card-flush">
          <header className="adm-card-head">
            <div>
              <span className="adm-eyebrow">Slevové kódy</span>
              <h2>Přehled a výsledky</h2>
            </div>
          </header>
          {error && (
            <p className="adm-alert adm-inset" role="alert">
              {error}
            </p>
          )}
          {codes.length === 0 ? (
            <p className="adm-empty">Zatím žádný kód. Přidejte první výše, třeba PODZIM10 s 10% slevou.</p>
          ) : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Kód</th>
                    <th>Sleva</th>
                    <th>Platnost</th>
                    <th>Podmínky</th>
                    <th className="adm-right">Použito</th>
                    <th className="adm-right">Slevy celkem</th>
                    <th className="adm-right">Tržby s kódem</th>
                    <th>Stav</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => {
                    const { used, granted, revenue } = stats(code);
                    const [stateLabel, tone] = discountState(code, used);
                    const conditions = [
                      code.minOrder > 0 && `nákup od ${money(code.minOrder)}`,
                      code.oncePerCustomer && "1× na zákazníka",
                    ].filter(Boolean);
                    return (
                      <tr key={code.id}>
                        <td>
                          <strong>{code.code}</strong>
                          {code.note && <small className="adm-sub">{code.note}</small>}
                        </td>
                        <td>{discountValueLabel(code.kind, code.value)}</td>
                        <td>{validityLabel(code)}</td>
                        <td>{conditions.length ? conditions.join(", ") : "—"}</td>
                        <td className="adm-right">
                          {used}
                          {code.maxUses ? ` / ${code.maxUses}` : "×"}
                        </td>
                        <td className="adm-right">{granted ? money(granted) : "—"}</td>
                        <td className="adm-right">{revenue ? money(revenue) : "—"}</td>
                        <td>
                          <span className={`adm-pill ${tone ? `adm-pill-${tone}` : ""}`}>{stateLabel}</span>
                        </td>
                        <td className="adm-right adm-nowrap">
                          <button
                            className="adm-icon-button adm-icon-plain"
                            aria-label={`Upravit ${code.code}`}
                            title="Upravit"
                            onClick={() => edit(code)}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                          <button
                            className="adm-icon-button adm-icon-plain"
                            aria-label={code.active ? `Ukončit ${code.code}` : `Obnovit ${code.code}`}
                            title={code.active ? "Ukončit" : "Obnovit"}
                            onClick={() => toggleActive(code)}
                          >
                            {code.active ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
                          </button>
                          {used === 0 && (
                            <button
                              className="adm-icon-button"
                              aria-label={`Smazat ${code.code}`}
                              title="Smazat"
                              onClick={() => remove(code)}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="adm-footnote adm-inset-note">
            Použito = objednávky, které nejsou zrušené (i ty čekající na platbu). Slevy a tržby počítají jen zaplacené
            objednávky.
          </p>
        </section>
      </div>
    </div>
  );
}
