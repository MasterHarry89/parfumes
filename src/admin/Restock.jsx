import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { computePricing, money, parseNumber, sampleVolumes, toStored } from "../lib/catalog";
import { recordExpense } from "./expenses";
import PricingTable from "./PricingTable";

// Restocking an existing scent: adds the new ml, averages the purchase cost per
// ml with what is still on the shelf and lets you re-price every sample size.
export default function RestockDialog({ item, materials, labourPerSample, onClose, onDone }) {
  const [ml, setMl] = useState("");
  const [total, setTotal] = useState("");
  const [margin, setMargin] = useState("60");
  // Starts on the prices currently in the shop, so nothing changes unless you want it to.
  const [priceInputs, setPriceInputs] = useState(() =>
    Object.fromEntries(sampleVolumes.map((volume) => [volume.value, String(item.priceOf(volume) / 10)])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const addMl = parseNumber(ml);
  const totalKc = parseNumber(total);
  const validPurchase = addMl > 0 && total !== "" && totalKc >= 0;
  const purchaseTenths = totalKc * 10;
  const purchasePerMl = validPurchase ? purchaseTenths / addMl : null;
  // Weighted average over what is on the shelf plus the new purchase.
  const newAverage = validPurchase
    ? (item.stockMl * item.costPerMl + purchaseTenths) / (item.stockMl + addMl)
    : null;

  const rows = computePricing({
    costPerMl: newAverage ?? item.costPerMl,
    materials,
    labourPerSample,
    marginTarget: parseNumber(margin),
    priceInputs,
  });
  const hasOverrides = Object.keys(priceInputs).length > 0;

  const save = async (event) => {
    event.preventDefault();
    if (!validPurchase) return setError("Zadejte, kolik ml doskladňujete a za kolik celkem.");
    const missing = rows.find((row) => row.price === null);
    if (missing) return setError(`Zadejte prodejní cenu pro ${missing.volume.label}.`);

    setBusy(true);
    setError("");
    const { error: stockError } = await supabase
      .from("inventory")
      .update({ stock_ml: item.stockMl + addMl, cost_per_ml: Math.round(newAverage) })
      .eq("id", item.id);
    if (stockError) {
      setBusy(false);
      return setError(`Sklad se nepodařilo uložit: ${stockError.message}`);
    }

    const { error: priceError } = await supabase
      .from("products")
      .update({
        price: rows[0].price,
        prices: Object.fromEntries(rows.map((row) => [row.volume.value, row.price])),
      })
      .eq("id", item.productId);

    const expenseError = await recordExpense({
      category: "perfume",
      label: `${item.brand} ${item.name} (doskladnění ${addMl} ml)`.trim(),
      amount: toStored(totalKc),
      productId: item.productId,
    });

    await onDone();
    setBusy(false);
    const warnings = [
      priceError && `Sklad je uložený, ale ceny se nepodařilo změnit: ${priceError.message}`,
      expenseError,
    ].filter(Boolean);
    if (warnings.length) setError(warnings.join(" "));
    else onClose();
  };

  return (
    <div className="adm-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form
        className="adm-modal pf"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restock-title"
        onSubmit={save}
        noValidate
      >
        <header className="adm-modal-head">
          <div>
            <span className="adm-eyebrow">Doskladnění</span>
            <h2 id="restock-title">
              {item.brand} {item.name}
            </h2>
          </div>
          <button type="button" className="adm-icon-button" aria-label="Zavřít" onClick={onClose} disabled={busy}>
            <FiX aria-hidden="true" />
          </button>
        </header>

        <ul className="adm-cost-tiles">
          <li>
            <span>Teď na skladě</span>
            <strong>{item.stockMl} ml</strong>
            <small>po {money(item.costPerMl)} za ml</small>
          </li>
          <li>
            <span>Po doskladnění</span>
            <strong>{item.stockMl + (addMl > 0 ? addMl : 0)} ml</strong>
            <small>{newAverage === null ? "zadejte nákup" : `průměr ${money(newAverage)} za ml`}</small>
          </li>
        </ul>

        <div className="pf-grid pf-grid-3">
          <label className="pf-field">
            <span className="pf-label">Doskladnit (ml)</span>
            <input autoFocus inputMode="decimal" value={ml} onChange={(event) => setMl(event.target.value)} placeholder="100" />
          </label>
          <label className="pf-field">
            <span className="pf-label">Nákupní cena celkem (Kč)</span>
            <input inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="5000" />
          </label>
          <div className="pf-field">
            <span className="pf-label">Cena tohoto nákupu za 1 ml</span>
            <output className="pf-readout">{purchasePerMl === null ? "—" : money(purchasePerMl)}</output>
          </div>
        </div>
        <p className="pf-hint">
          Nová cena za ml je vážený průměr starých zásob a tohoto nákupu, takže marže odpovídá tomu, co opravdu prodáváte.
        </p>

        <div className="pf-grid pf-grid-3">
          <label className="pf-field">
            <span className="pf-label">Cílová marže (%)</span>
            <input inputMode="decimal" value={margin} onChange={(event) => setMargin(event.target.value)} />
          </label>
          {hasOverrides && (
            <div className="pf-field">
              <span className="pf-label">Ceny</span>
              <button type="button" className="adm-button adm-button-light" onClick={() => setPriceInputs({})}>
                Použít všechny doporučené
              </button>
            </div>
          )}
        </div>

        <PricingTable rows={rows} priceInputs={priceInputs} onChange={setPriceInputs} materialCount={materials.length} />

        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}
        <div className="adm-modal-actions">
          <button type="button" className="pf-secondary" onClick={onClose} disabled={busy}>
            Zrušit
          </button>
          <button className="pf-save" disabled={busy}>
            {busy ? "Ukládám…" : "Doskladnit"}
          </button>
        </div>
      </form>
    </div>
  );
}
