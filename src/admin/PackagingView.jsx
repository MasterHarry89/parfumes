import { useState } from "react";
import { FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { money, parseNumber, sampleVolumes, toStored } from "../lib/catalog";
import { recordExpense } from "./expenses";
import NumberCell from "./NumberCell";

const SIZES = sampleVolumes.map((volume) => volume.value);

const saveError = (error) =>
  error.code === "42P01" || /packaging_materials/.test(error.message)
    ? "Tabulka materiálu ještě neexistuje. Spusťte supabase/pricing.sql."
    : `Uložení se nepovedlo: ${error.message}`;

function SizeChips({ value, onChange, label }) {
  const toggle = (size) =>
    onChange(value.includes(size) ? value.filter((v) => v !== size) : [...value, size].sort());
  return (
    <div className="pf-chips" role="group" aria-label={label}>
      {SIZES.map((size) => {
        const on = value.includes(size);
        return (
          <button
            type="button"
            key={size}
            className={on ? "is-on" : ""}
            aria-pressed={on}
            onClick={() => toggle(size)}
          >
            {size} ml
          </button>
        );
      })}
    </div>
  );
}

function RestockForm({ materials, onReload }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [total, setTotal] = useState("");
  const [perSample, setPerSample] = useState("1");
  const [sizes, setSizes] = useState(SIZES);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  const existing = materials.find(
    (material) => material.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const quantity = parseNumber(qty);
  const totalKc = parseNumber(total);
  const unitKc = quantity > 0 && totalKc >= 0 ? totalKc / quantity : null;

  const changeName = (value) => {
    setName(value);
    const match = materials.find(
      (material) => material.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) {
      setPerSample(String(match.perSample));
      setSizes(match.sizes);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const usage = parseNumber(perSample);
    if (!name.trim()) return setMessage({ type: "error", text: "Zadejte název materiálu." });
    if (!(quantity > 0)) return setMessage({ type: "error", text: "Zadejte počet kusů větší než 0." });
    if (!(totalKc >= 0)) return setMessage({ type: "error", text: "Zadejte celkovou cenu nákupu." });
    if (!(usage >= 0)) return setMessage({ type: "error", text: "Spotřeba na vzorek musí být číslo od 0." });

    setBusy(true);
    setMessage(null);
    const purchaseCost = toStored(totalKc);
    let error;
    if (existing) {
      // Weighted average, so the unit cost reflects everything still in stock.
      const newQty = existing.stockQty + quantity;
      const unitCost = (existing.stockQty * existing.unitCost + purchaseCost) / newQty;
      ({ error } = await supabase
        .from("packaging_materials")
        .update({ stock_qty: newQty, unit_cost: unitCost, per_sample: usage, sizes })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("packaging_materials").insert({
        name: name.trim(),
        stock_qty: quantity,
        unit_cost: purchaseCost / quantity,
        per_sample: usage,
        sizes,
      }));
    }
    setBusy(false);
    if (error) return setMessage({ type: "error", text: saveError(error) });

    const expenseError = await recordExpense({
      category: "packaging",
      label: existing?.name ?? name.trim(),
      amount: purchaseCost,
      materialId: existing?.id ?? null,
    });
    await onReload();
    const done = existing
      ? `Přidáno ${quantity} ks k materiálu „${existing.name}“.`
      : `Materiál „${name.trim()}“ je naskladněný.`;
    setMessage(
      expenseError
        ? { type: "error", text: `${done} ${expenseError}` }
        : { type: "ok", text: `${done} Nákup je zapsaný do výdajů.` },
    );
    setName("");
    setQty("");
    setTotal("");
    setPerSample("1");
    setSizes(SIZES);
  };

  return (
    <form className="pf-card pf" onSubmit={submit} noValidate>
      <header>
        <h2>Naskladnit materiál</h2>
        <p>
          Zadejte, kolik kusů jste koupili a za kolik celkem. Cena za kus se
          dopočítá. Když materiál už existuje, přičte se množství a cena za kus se zprůměruje.
        </p>
      </header>
      <div className="pf-grid">
        <label className="pf-field pf-wide">
          <span className="pf-label">Materiál</span>
          <input
            list="material-names"
            value={name}
            onChange={(event) => changeName(event.target.value)}
            placeholder="Lahvička 2 ml, krabička, umělá tráva, nálepky…"
          />
          <datalist id="material-names">
            {materials.map((material) => (
              <option key={material.id} value={material.name} />
            ))}
          </datalist>
          {existing && (
            <small className="pf-hint">
              Už existuje: na skladě {existing.stockQty} ks po {money(existing.unitCost)}.
            </small>
          )}
        </label>
        <label className="pf-field">
          <span className="pf-label">Počet kusů</span>
          <input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="100" />
        </label>
        <label className="pf-field">
          <span className="pf-label">Celková cena nákupu (Kč)</span>
          <input inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="1000" />
          {unitKc !== null && (
            <small className="pf-hint">
              Vychází <strong>{money(toStored(unitKc))}</strong> za kus
            </small>
          )}
        </label>
        <label className="pf-field">
          <span className="pf-label">Spotřeba na 1 vzorek (ks)</span>
          <input inputMode="decimal" value={perSample} onChange={(event) => setPerSample(event.target.value)} />
          <small className="pf-hint">Třeba 1 lahvička, 1 krabička, 0,1 ks trávy.</small>
        </label>
        <div className="pf-field">
          <span className="pf-label">Používá se u velikostí</span>
          <SizeChips value={sizes} onChange={setSizes} label="Velikosti vzorku" />
        </div>
      </div>
      {message && (
        <p className={message.type === "ok" ? "adm-ok" : "adm-alert"} role={message.type === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      <button className="adm-button adm-submit" disabled={busy}>
        <FiPlus aria-hidden="true" /> {busy ? "Ukládám…" : existing ? "Přidat na sklad" : "Naskladnit materiál"}
      </button>
    </form>
  );
}

export default function PackagingView({ materials, ready, packaging, onReload }) {
  const [error, setError] = useState("");

  const update = async (id, patch) => {
    const { error: updateError } = await supabase.from("packaging_materials").update(patch).eq("id", id);
    if (updateError) return saveError(updateError);
    await onReload();
    return null;
  };

  const remove = async (material) => {
    if (!window.confirm(`Opravdu smazat materiál „${material.name}“?`)) return;
    const { error: deleteError } = await supabase.from("packaging_materials").delete().eq("id", material.id);
    if (deleteError) setError(saveError(deleteError));
    else {
      setError("");
      await onReload();
    }
  };

  if (!ready) {
    return (
      <div className="adm-page">
        <p className="adm-alert" role="alert">
          Tabulka pro obalový materiál ještě neexistuje. Spusťte v Supabase SQL editoru soubor
          supabase/pricing.sql a stránku obnovte.
        </p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-note">
        <FiInfo aria-hidden="true" />
        <p>
          <strong>Jak se počítá obal:</strong> cena za kus × spotřeba na vzorek, sečteno přes všechny
          materiály použité u dané velikosti. Výsledek se ukáže v cenotvorbě u každého nového produktu.
        </p>
      </div>

      <section className="adm-card adm-packaging-summary">
        <header className="adm-card-head">
          <div>
            <span className="adm-eyebrow">Náklad na obal</span>
            <h2>Jeden vzorek stojí na obalu</h2>
          </div>
        </header>
        <ul className="adm-cost-tiles">
          {sampleVolumes.map((volume) => (
            <li key={volume.value}>
              <span>{volume.label}</span>
              <strong>{money(packaging[volume.value] ?? 0)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="adm-stack">
        <RestockForm materials={materials} onReload={onReload} />

        <section className="adm-card adm-card-flush">
          <header className="adm-card-head">
            <div>
              <span className="adm-eyebrow">Sklad materiálu</span>
              <h2>Materiál</h2>
            </div>
          </header>
          {error && (
            <p className="adm-alert adm-inset" role="alert">
              {error}
            </p>
          )}
          {materials.length === 0 ? (
            <p className="adm-empty">Zatím žádný materiál. Naskladněte první nákup výše.</p>
          ) : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Materiál</th>
                    <th>Na skladě</th>
                    <th>Cena / ks</th>
                    <th>Spotřeba na vzorek</th>
                    <th>Velikosti</th>
                    <th className="adm-right">Náklad na vzorek</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <td>
                        <strong>{material.name}</strong>
                      </td>
                      <td>
                        <NumberCell
                          key={`stock-${material.stockQty}`}
                          value={material.stockQty}
                          unit="ks"
                          label={`Sklad ${material.name} v kusech`}
                          onSave={(next) => update(material.id, { stock_qty: next })}
                        />
                      </td>
                      <td>{money(material.unitCost)}</td>
                      <td>
                        <NumberCell
                          key={`use-${material.perSample}`}
                          value={material.perSample}
                          unit="ks"
                          label={`Spotřeba ${material.name} na vzorek`}
                          onSave={(next) => update(material.id, { per_sample: next })}
                        />
                      </td>
                      <td>
                        <SizeChips
                          value={material.sizes}
                          label={`Velikosti pro ${material.name}`}
                          onChange={(sizes) => update(material.id, { sizes })}
                        />
                      </td>
                      <td className="adm-right">
                        <strong>{money(material.unitCost * material.perSample)}</strong>
                      </td>
                      <td className="adm-right">
                        <button
                          className="adm-icon-button"
                          aria-label={`Smazat ${material.name}`}
                          title="Smazat"
                          onClick={() => remove(material)}
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
