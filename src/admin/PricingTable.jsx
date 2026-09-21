import { money } from "../lib/catalog";
import { navigate } from "../lib/navigate";

// Cost breakdown and editable selling price per sample size.
// `rows` come from computePricing(); `priceInputs` are the prices typed over the suggestion.
export default function PricingTable({ rows, priceInputs, onChange, materialCount }) {
  const showLabour = rows.some((row) => row.labour > 0);

  return (
    <>
      <div className="pf-scroll">
        <table className="pf-pricing">
          <thead>
            <tr>
              <th>Velikost</th>
              <th>Parfém</th>
              <th>Obal</th>
              {showLabour && <th>Práce</th>}
              <th>Náklad</th>
              <th>Prodejní cena (Kč)</th>
              <th>Marže</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.volume.value}>
                <td>
                  <strong>{row.volume.label}</strong>
                </td>
                <td>{row.perfume === null ? "—" : money(row.perfume)}</td>
                <td>{money(row.packaging)}</td>
                {showLabour && <td>{money(row.labour)}</td>}
                <td>{row.cost === null ? "—" : money(row.cost)}</td>
                <td>
                  <div className="pf-price-cell">
                    <input
                      inputMode="decimal"
                      aria-label={`Prodejní cena ${row.volume.label} v Kč`}
                      value={
                        row.override !== undefined
                          ? row.override
                          : row.suggested !== null
                            ? String(row.suggested / 10)
                            : ""
                      }
                      placeholder="—"
                      onChange={(event) =>
                        onChange({ ...priceInputs, [row.volume.value]: event.target.value })
                      }
                    />
                    {row.override !== undefined && row.suggested !== null && (
                      <button
                        type="button"
                        className="pf-reset"
                        onClick={() => {
                          const next = { ...priceInputs };
                          delete next[row.volume.value];
                          onChange(next);
                        }}
                      >
                        Použít doporučenou ({row.suggested / 10} Kč)
                      </button>
                    )}
                  </div>
                </td>
                <td>{row.margin === null ? "—" : <strong>{row.margin} %</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {materialCount === 0 ? (
        <p className="pf-hint pf-packaging-hint">
          Obalový materiál zatím není zadaný, obal se počítá jako 0 Kč.{" "}
          <button type="button" className="pf-inline-link" onClick={() => navigate("/admin/obal")}>
            Přidat materiál →
          </button>
        </p>
      ) : (
        <p className="pf-hint pf-packaging-hint">
          Náklad na obal se bere z {materialCount} materiálů na stránce Obalový materiál.
          {!showLabour && (
            <>
              {" "}
              Čas práce zatím není měřený (
              <button type="button" className="pf-inline-link" onClick={() => navigate("/admin/prace")}>
                Práce a čas
              </button>
              ).
            </>
          )}
        </p>
      )}
    </>
  );
}
