// Product pages (/produkt/<id>): fills the HTML head with the product's own title,
// description, share preview (Open Graph) and Google structured data before the
// page leaves the server. Facebook, WhatsApp & co. do not run JavaScript, so
// without this every shared product would look like the home page.
// Unknown products get a real 404 status, so search engines drop them.

const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SURCHARGE = { 1: 0, 2: 30, 3: 55 }; // same rule as priceFor() in src/lib/catalog.js
const priceFor = (product, ml) =>
  Number(product.prices?.[ml]) || Number(product.price || 0) + SURCHARGE[ml];

const supabase = async (path, init = {}) => {
  const base = Netlify.env.get("VITE_SUPABASE_URL");
  const key = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
};

export default async (request, context) => {
  const response = await context.next();
  if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) return response;

  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.slice("/produkt/".length).replace(/\/$/, ""));
  if (!id) return response;

  let product;
  let mlLeft = null;
  try {
    [product] = await supabase(`/rest/v1/products?id=eq.${encodeURIComponent(id)}&active=is.true&select=*`);
    if (product) {
      const stock = await supabase("/rest/v1/rpc/product_availability", { method: "POST", body: "{}" }).catch(() => []);
      mlLeft = stock.find((row) => row.product_id === String(product.id))?.ml_left ?? null;
    }
  } catch {
    return response; // database unreachable: serve the page as it is
  }

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  if (!product) {
    return new Response(
      html.replace(/<title>[\s\S]*?<\/title>/, "<title>Stránka nenalezena | Éparfumes</title>"),
      { status: 404, headers },
    );
  }

  const name = `${product.brand} ${product.name}`;
  const title = `${name} – vzorek | Éparfumes`;
  const fullDescription = (
    product.description ||
    product.note ||
    `Vzorek parfému ${name} od 1 ml. Vyzkoušejte vůni dřív, než koupíte celý flakon.`
  ).replace(/\s+/g, " ").trim();
  // Search results show ~160 characters: cut at a word, not in the middle of one.
  const description =
    fullDescription.length <= 160
      ? fullDescription
      : `${fullDescription.slice(0, 157).replace(/\s+\S*$/, "")}…`;
  const canonical = `${url.origin}/produkt/${encodeURIComponent(product.id)}`;
  const image = new URL(product.image || "/parfumes2.png", url.origin).href;
  const prices = [1, 2, 3].map((ml) => priceFor(product, ml) / 10); // tenths of CZK -> CZK

  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    brand: { "@type": "Brand", name: product.brand },
    description,
    image,
    url: canonical,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CZK",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: prices.length,
      availability:
        mlLeft !== null && mlLeft < 1 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="product" />`,
    // "<" escaped so product text can never close the script tag.
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");

  const page = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${escapeHtml(image)}$2`)
    .replace(/<meta property="og:type" content="website" \/>\s*/, "")
    .replace("</head>", `    ${head}\n  </head>`);

  return new Response(page, { status: 200, headers });
};

export const config = { path: "/produkt/*" };
