import { useState } from "react";
import { FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { money, parseNumber } from "../lib/catalog";
import NumberCell from "./NumberCell";

const units = [
  { key: "sample", label: "na 1 vzorek" },
  { key: "order", label: "na 1 objednávku" },
];
const suggestions = [
  { name: "Naplnění jedné lahvičky", unit: "sample" },
  { name: "Zabalení objednávky", unit: "order" },
  { name: "Cesta do zásilkovny", unit: "order" },
];

const saveError = (error) =>
  error.code === "42P01" || /labor_tasks|admin_settings/.test(error.message)
    ? "Tabulky pro práci ještě neexistují. Spusťte supabase/finance.sql."
    : `Uložení se nepovedlo: ${error.message}`;

function AddTaskForm({ onReload, draft, setDraft }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const minutes = draft.minutes === "" ? 0 : parseNumber(draft.minutes);
    if (!draft.name.trim()) return setMessage("Zadejte název úkonu.");
    if (!(minutes >= 0)) return setMessage("Čas musí být číslo od 0.");
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("labor_tasks")
      .insert({ name: draft.name.trim(), minutes, unit: draft.unit });
    setBusy(false);
    if (error) return setMessage(saveError(error));
    setDraft({ name: "", minutes: "", unit: "sample" });
    await onReload();
  };

  return (
    <form className="pf-card pf" onSubmit={submit} noValidate>
      <header>
        <h2>Přidat úkon</h2>
        <p>Čas můžete nechat prázdný a doplnit ho, až ho změříte.</p>
      </header>
      <div className="pf-chips" aria-label="Návrhy úkonů">
        {suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion.name}
            onClick={() => setDraft({ ...draft, name: suggestion.name, unit: suggestion.unit })}
          >
            {suggestion.name}
          </button>
        ))}
      </div>
      <div className="pf-grid pf-grid-3">
        <label className="pf-field">
          <span className="pf-label">Úkon</span>
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Čas (minuty)</span>
          <input
            inputMode="decimal"
            value={draft.minutes}
            onChange={(event) => setDraft({ ...draft, minutes: event.target.value })}
            placeholder="např. 2,5"
          />
        </label>
        <label className="pf-field">
          <span className="pf-label">Počítá se</span>
          <select value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}>
            {units.map((unit) => (
              <option key={unit.key} value={unit.key}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && (
        <p className="adm-alert" role="alert">
          {message}
        </p>
      )}
      <button className="adm-button adm-submit" disabled={busy}>
        <FiPlus aria-hidden="true" /> {busy ? "Ukládám…" : "Přidat úkon"}
      </button>
    </form>
  );
}

export default function LaborView({ ready, rateKc, tasks, labour, onReload }) {
  const [draft, setDraft] = useState({ name: "", minutes: "", unit: "sample" });
  const [error, setError] = useState("");

  if (!ready) {
    return (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Tabulky pro práci a čas ještě neexistují. Spusťte v Supabase SQL editoru soubor
          supabase/finance.sql a stránku obnovte.
        </p>
      </div>
    );
  }

  const perMinute = (rateKc * 10) / 60; // tenths of CZK

  const saveRate = async (next) => {
    const { error: rateError } = await supabase
      .from("admin_settings")
      .upsert({ key: "hourly_rate", value: { kc: next } });
    if (rateError) return saveError(rateError);
    await onReload();
    return null;
  };

  const update = async (id, patch) => {
    const { error: updateError } = await supabase.from("labor_tasks").update(patch).eq("id", id);
    if (updateError) return saveError(updateError);
    await onReload();
    return null;
  };

  const remove = async (task) => {
    if (!window.confirm(`Opravdu smazat úkon „${task.name}“?`)) return;
    const { error: deleteError } = await supabase.from("labor_tasks").delete().eq("id", task.id);
    if (deleteError) setError(saveError(deleteError));
    else {
      setError("");
      await onReload();
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-note">
        <FiInfo aria-hidden="true" />
        <p>
          <strong>K čemu to je:</strong> změřte, jak dlouho trvá naplnit lahvičku, zabalit objednávku nebo dojít do
          zásilkovny, a nastavte si hodinovou sazbu. Práce na vzorek se pak přičte k nákladům v cenotvorbě a práce na
          objednávku se ukáže ve Financích jako odhad hodnoty vlastní práce.
        </p>
      </div>

      <section className="adm-card adm-packaging-summary">
        <header className="adm-card-head">
          <div>
            <span className="adm-eyebrow">Hodinová sazba</span>
            <h2>Kolik stojí hodina vaší práce</h2>
          </div>
        </header>
        <div className="adm-rate">
          <NumberCell
            key={rateKc}
            value={rateKc}
            unit="Kč / hod"
            label="Hodinová sazba v Kč"
            onSave={saveRate}
          />
          <ul className="adm-cost-tiles">
            <li>
              <span>Práce na 1 vzorek</span>
              <strong>{money(labour.perSample)}</strong>
            </li>
            <li>
              <span>Práce na 1 objednávku</span>
              <strong>{money(labour.perOrder)}</strong>
            </li>
          </ul>
        </div>
      </section>

      <div className="adm-stack">
        <AddTaskForm onReload={onReload} draft={draft} setDraft={setDraft} />

        <section className="adm-card adm-card-flush">
          <header className="adm-card-head">
            <div>
              <span className="adm-eyebrow">Změřené úkony</span>
              <h2>Čas a náklad práce</h2>
            </div>
          </header>
          {error && (
            <p className="adm-alert adm-inset" role="alert">
              {error}
            </p>
          )}
          {tasks.length === 0 ? (
            <p className="adm-empty">Zatím žádný úkon. Přidejte první výše, třeba „Naplnění jedné lahvičky“.</p>
          ) : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Úkon</th>
                    <th>Čas</th>
                    <th>Počítá se</th>
                    <th className="adm-right">Náklad</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.name}</strong>
                      </td>
                      <td>
                        <NumberCell
                          key={`min-${task.minutes}`}
                          value={task.minutes}
                          unit="min"
                          label={`Čas úkonu ${task.name} v minutách`}
                          onSave={(next) => update(task.id, { minutes: next })}
                        />
                      </td>
                      <td>
                        <select
                          className="adm-select"
                          value={task.unit}
                          aria-label={`Jednotka úkonu ${task.name}`}
                          onChange={(event) => update(task.id, { unit: event.target.value })}
                        >
                          {units.map((unit) => (
                            <option key={unit.key} value={unit.key}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="adm-right">
                        <strong>{money(task.minutes * perMinute)}</strong>
                      </td>
                      <td className="adm-right">
                        <button
                          className="adm-icon-button"
                          aria-label={`Smazat ${task.name}`}
                          title="Smazat"
                          onClick={() => remove(task)}
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
      </div>
    </div>
  );
}
