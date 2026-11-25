// Printed leaflet that goes into every parcel (Regulation (EC) 1223/2009, Art. 19(4):
// small packaging may carry the ingredients and warnings on an enclosed leaflet).
// One A6 page per order listing each scent in it. The batch each scent was filled
// from is saved on the order the first time it is printed, so a reprint shows the
// same batch and any sample can be traced back to its bottle.

import { concentrationLabel } from "../lib/catalog";
import { supabase } from "../lib/supabase";
import { isMissing, seller } from "../lib/seller";
import { orderLabel } from "./views";

const WARNINGS =
  "Pouze pro vnější použití. Hořlavé – uchovávejte mimo dosah tepla a otevřeného ohně. " +
  "Nestříkejte do očí ani na podrážděnou pokožku. Uchovávejte mimo dosah dětí. " +
  "Při podráždění přestaňte používat.";

// Paid orders (and unpaid cash on delivery) that still have to be packed.
export const needsPacking = (order) => {
  const status = String(order.status).toLowerCase();
  if (["paid", "zaplaceno", "processing", "k výrobě"].includes(status)) return true;
  return order.paymentMethod === "cod" && status === "pending";
};

const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Same scent in several sizes is one entry: "1 ml, 2× 3 ml".
const scentsOf = (order) => {
  const byId = new Map();
  for (const item of order.items) {
    const entry = byId.get(item.product_id) ?? { id: item.product_id, name: item.name, brand: item.brand, sizes: [] };
    entry.sizes.push(item.quantity > 1 ? `${item.quantity}× ${item.volume}` : item.volume);
    byId.set(item.product_id, entry);
  }
  return [...byId.values()];
};

// What would be printed but is still missing, so it can be fixed first.
export const leafletProblems = (orders, products) => {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const problems = [];
  if (isMissing(seller.name) || isMissing(seller.address))
    problems.push("Chybí vaše jméno a adresa v src/lib/seller.js.");
  const missing = new Set();
  orders.forEach((order) =>
    scentsOf(order).forEach((scent) => {
      if (!byId.get(String(scent.id))?.ingredients) missing.add(`${scent.brand} ${scent.name}`.trim());
    }),
  );
  if (missing.size) problems.push(`Chybí složení u: ${[...missing].join(", ")}.`);
  return problems;
};

const leafletHtml = (order, products) => {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const scents = scentsOf(order)
    .map((scent) => {
      const product = byId.get(String(scent.id)) ?? {};
      const batch = order.batches?.[scent.id];
      const facts = [
        `Objem: ${scent.sizes.join(", ")}`,
        batch && `Šarže: ${batch}`,
        product.pao_months > 0 && `Po otevření: ${product.pao_months} M`,
      ].filter(Boolean);
      return `
        <section class="scent">
          <h2>${escape(scent.brand)} ${escape(scent.name)}${
            concentrationLabel[product.concentration] ? ` <small>${escape(concentrationLabel[product.concentration])}</small>` : ""
          }</h2>
          <p class="facts">${facts.map(escape).join(" · ")}</p>
          <p class="inci"><b>Složení:</b> ${escape(product.ingredients || "— (doplňte v administraci)")}</p>
          ${product.manufacturer ? `<p class="small">Výrobce originálu: ${escape(product.manufacturer)}</p>` : ""}
        </section>`;
    })
    .join("");

  return `
    <article class="leaflet">
      <header>
        <strong>Informace o vzorcích</strong>
        <span>Objednávka ${escape(orderLabel(order))} · ${escape(order.date)}</span>
      </header>
      ${scents}
      <p class="warn"><b>Upozornění:</b> ${escape(WARNINGS)}</p>
      <footer>
        Vzorky plněny z originálních balení výrobců. Plnil a odpovídá:
        ${escape(seller.name)}, ${escape(seller.address)}${isMissing(seller.ico) ? "" : `, IČO ${escape(seller.ico)}`}${
          isMissing(seller.email) ? "" : `, ${escape(seller.email)}`
        }
      </footer>
    </article>`;
};

const PAGE_CSS = `
  @page { size: A6; margin: 6mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 7.5pt/1.35 Arial, Helvetica, sans-serif; color: #000; }
  .leaflet { break-after: page; }
  .leaflet:last-child { break-after: auto; }
  header { display: flex; justify-content: space-between; gap: 6px; padding-bottom: 3px; margin-bottom: 4px; border-bottom: 1px solid #000; }
  header strong { font-size: 9pt; }
  .scent { padding: 3px 0 4px; border-bottom: .5pt solid #999; break-inside: avoid; }
  h2 { margin: 0; font-size: 8.5pt; }
  h2 small { font-weight: normal; }
  p { margin: 2px 0; }
  .facts { font-weight: bold; }
  .inci, .small { font-size: 6.5pt; }
  .warn { margin-top: 5px; font-size: 6.5pt; }
  footer { margin-top: 4px; font-size: 6.5pt; }
  @media screen { body { background: #ddd; padding: 12px; } .leaflet { width: 105mm; min-height: 148mm; margin: 0 auto 12px; padding: 6mm; background: #fff; } }
`;

// Fills in the batch of every scent that does not have one yet (from the bottle
// currently in stock) and marks the orders as printed. Returns orders with batches.
const stampOrders = async (orders, inventory) => {
  const batchOf = new Map(inventory.map((item) => [String(item.productId), item.batchCode]));
  const stamped = [];
  const failures = [];
  for (const order of orders) {
    const batches = { ...(order.batches ?? {}) };
    scentsOf(order).forEach((scent) => {
      if (!batches[scent.id] && batchOf.get(String(scent.id))) batches[scent.id] = batchOf.get(String(scent.id));
    });
    const { error } = await supabase
      .from("orders")
      .update({ batches, leaflet_printed_at: order.leafletPrintedAt ?? new Date().toISOString() })
      .eq("id", order.id);
    if (error) failures.push(error.message);
    stamped.push({ ...order, batches });
  }
  return { stamped, error: failures[0] ?? null };
};

// Opens the print dialog with one leaflet per order. Must be called straight from a
// click so the browser allows the new window. Returns an error message or null.
export const printLeaflets = async (orders, { products, inventory }) => {
  const win = window.open("", "_blank");
  if (!win) return "Prohlížeč zablokoval nové okno. Povolte vyskakovací okna pro administraci.";
  win.document.write("<p style='font-family:sans-serif'>Připravuji příbalové listy…</p>");

  const { stamped, error } = await stampOrders(orders, inventory);
  win.document.open();
  win.document.write(`<!doctype html><html lang="cs"><head><meta charset="utf-8">
    <title>Příbalové listy</title><style>${PAGE_CSS}</style></head>
    <body>${stamped.map((order) => leafletHtml(order, products)).join("")}</body></html>`);
  win.document.close();
  win.focus();
  win.print();

  if (!error) return null;
  return /batches|leaflet_printed_at/.test(error)
    ? "Listy jsou vytištěné, ale šarže se k objednávkám neuložily. Spusťte supabase/product-compliance.sql."
    : `Listy jsou vytištěné, ale šarže se k objednávkám neuložily: ${error}`;
};
