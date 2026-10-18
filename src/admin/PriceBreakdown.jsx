import { money } from "../lib/catalog";

// Line by line: what one sample costs and what is left of its price, per size.
// Also the worst case of a sample sent on its own, carrying the whole order's
// packaging (box, filler …) and order labour. Money is in tenths of CZK.

function Line({ label, detail, value, tone }) {
  return (
    <div className={`pb-line ${tone ? `pb-${tone}` : ""}`}>
      <dt>
        {label}
        {detail && <small>{detail}</small>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

const profitLine = (price, cost) => {
  const profit = price - cost;
  return `${money(profit)} · ${Math.round((profit / price) * 100)} %`;
};

export default function PriceBreakdown({ rows, materials, labourPerOrder = 0 }) {
  const orderMaterials = materials.filter((material) => material.unit === "order");
  const orderPackaging = orderMaterials.reduce((sum, material) => sum + material.unitCost * material.perSample, 0);
  const orderExtra = orderPackaging + labourPerOrder;

  return (
    <details className="pb" open>
      <summary>Jak vzniká cena</summary>
      <div className="pb-grid">
        {rows.map((row) => {
          const ml = row.volume.value;
          const sampleMaterials = materials.filter(
            (material) => material.unit !== "order" && material.sizes.includes(ml),
          );
          const known = row.cost !== null;
          const priced = known && row.price !== null;
          return (
            <section key={ml} className="pb-card">
              <h4>Vzorek {row.volume.label}</h4>
              <dl>
                <Line
                  label="Parfém"
                  detail={row.perfume === null ? "nákupní cena není zadaná" : `${money(row.perfume / ml)} za ml × ${ml} ml`}
                  value={row.perfume === null ? "—" : money(row.perfume)}
                />
                {sampleMaterials.length === 0 ? (
                  <Line label="Obal vzorku" detail="žádný materiál pro tuto velikost" value={money(0)} />
                ) : (
                  sampleMaterials.map((material) => (
                    <Line
                      key={material.id}
                      label={material.name}
                      detail={
                        material.perSample === 1
                          ? null
                          : `${money(material.unitCost)} × ${String(material.perSample).replace(".", ",")} ks`
                      }
                      value={money(material.unitCost * material.perSample)}
                    />
                  ))
                )}
                {row.labour > 0 && <Line label="Práce na vzorek" value={money(row.labour)} />}
                <Line label="Náklad vzorku" value={known ? money(row.cost) : "—"} tone="sum" />
                <Line label="Prodejní cena" value={row.price === null ? "—" : money(row.price)} />
                {priced && <Line label="Zisk z vzorku" value={profitLine(row.price, row.cost)} tone="profit" />}
                {priced && (
                  <Line
                    label="Na 1 ml"
                    detail={`prodej ${money(row.price / ml)}, náklad ${money(row.cost / ml)}`}
                    value={`zisk ${money((row.price - row.cost) / ml)}`}
                    tone="profit"
                  />
                )}
              </dl>

              {orderExtra > 0 && (
                <div className="pb-solo">
                  <p>Když je vzorek v objednávce sám</p>
                  <dl>
                  {orderMaterials.map((material) => (
                    <Line
                      key={material.id}
                      label={`+ ${material.name}`}
                      value={money(material.unitCost * material.perSample)}
                    />
                  ))}
                  {labourPerOrder > 0 && <Line label="+ Práce na objednávku" value={money(labourPerOrder)} />}
                  <Line label="Náklad celkem" value={known ? money(row.cost + orderExtra) : "—"} tone="sum" />
                  {priced && (
                    <Line
                      label="Zisk"
                      value={profitLine(row.price, row.cost + orderExtra)}
                      tone={row.price - row.cost - orderExtra < 0 ? "loss" : "profit"}
                    />
                  )}
                  </dl>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="pf-hint">
        Doprava a poplatek za dobírku platí zákazník, proto tu nejsou. Obal na objednávku se při více vzorcích v
        jedné objednávce rozpočítá mezi ně, takže skutečný zisk je mezi oběma čísly.
      </p>
    </details>
  );
}
