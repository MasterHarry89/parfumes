// /sitemap.xml and /robots.txt, generated on request so new products appear by
// themselves and the address follows the domain (netlify.app now, own domain later).
// Reads only public data (active products) with the public anon key.

const STATIC_PAGES = [
  "/",
  "/kolekce",
  "/o-projektu",
  "/doprava-a-platba",
  "/kontakt",
  "/obchodni-podminky",
  "/reklamacni-rad",
  "/odstoupeni-od-smlouvy",
  "/ochrana-osobnich-udaju",
  "/cookies",
];

const xmlEscape = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const activeProducts = async () => {
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${base}/rest/v1/products?active=is.true&select=id,created_at`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  return response.ok ? response.json() : [];
};

export default async (request) => {
  const origin = new URL(request.url).origin;

  if (new URL(request.url).pathname === "/robots.txt") {
    return new Response(
      [
        "User-agent: *",
        // Private or useless for search: the admin, the cart, the checkout and the account.
        "Disallow: /admin",
        "Disallow: /kosik",
        "Disallow: /pokladna",
        "Disallow: /ucet",
        "",
        `Sitemap: ${origin}/sitemap.xml`,
        "",
      ].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } },
    );
  }

  const products = await activeProducts().catch(() => []);
  const urls = [
    ...STATIC_PAGES.map((path) => `<url><loc>${xmlEscape(origin + path)}</loc></url>`),
    ...products.map(
      (product) =>
        `<url><loc>${xmlEscape(`${origin}/produkt/${encodeURIComponent(product.id)}`)}</loc>` +
        (product.created_at ? `<lastmod>${product.created_at.slice(0, 10)}</lastmod>` : "") +
        "</url>",
    ),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } },
  );
};

export const config = { path: ["/sitemap.xml", "/robots.txt"] };
