// Delivery and payment options shown at checkout. Money is in tenths of CZK.
// The database (public.place_order in supabase/checkout.sql) computes the real
// total, so keep these prices in sync with it; they are only for display here.

export const FREE_SHIPPING_FROM = 15000; // 1 500 Kč

export const shippingMethods = [
  {
    key: "packeta_point",
    label: "Zásilkovna – výdejní místo nebo Z-BOX",
    note: "Vyzvednete do 1–2 pracovních dnů",
    price: 790,
  },
  {
    key: "packeta_home",
    label: "Zásilkovna – doručení na adresu",
    note: "Kurýr doručí do 1–2 pracovních dnů",
    price: 1090,
  },
];

// Bank details for "Bankovním převodem", set in Netlify environment variables.
export const bankAccount = import.meta.env.VITE_BANK_ACCOUNT || "";

// The card option turns on once a payment gateway is connected (VITE_CARD_PAYMENTS=on).
// Bank transfer is offered only once VITE_BANK_ACCOUNT is set.
export const paymentMethods = [
  {
    key: "card",
    label: "Kartou online",
    note: "Apple Pay, Google Pay, platební karta",
    fee: 0,
    enabled: import.meta.env.VITE_CARD_PAYMENTS === "on",
  },
  {
    key: "transfer",
    label: "Bankovním převodem",
    note: "Platební údaje zobrazíme po odeslání objednávky",
    fee: 0,
    enabled: true,
    hidden: !bankAccount,
  },
  {
    key: "cod",
    label: "Na dobírku",
    note: "Zaplatíte při převzetí zásilky",
    fee: 290,
    enabled: true,
  },
].filter((method) => !method.hidden);

export const shippingPriceFor = (method, subtotal) =>
  subtotal >= FREE_SHIPPING_FROM ? 0 : method.price;

// ---- Zásilkovna (Packeta) pickup-point widget -------------------------------
// With VITE_PACKETA_API_KEY set, customers pick the point on Zásilkovna's map.
// Without it the checkout falls back to typing the point in by hand.
export const packetaApiKey = import.meta.env.VITE_PACKETA_API_KEY || "";

let packetaScript;
const loadPacketa = () => {
  packetaScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://widget.packeta.com/v6/www/js/library.js";
    script.onload = resolve;
    script.onerror = () => {
      packetaScript = undefined;
      reject(new Error("Mapu Zásilkovny se nepodařilo načíst."));
    };
    document.head.appendChild(script);
  });
  return packetaScript;
};

// Opens the widget; resolves with { id, name, street, city, zip } or null when closed.
export const pickPacketaPoint = async () => {
  await loadPacketa();
  return new Promise((resolve) =>
    window.Packeta.Widget.pick(
      packetaApiKey,
      (point) =>
        resolve(
          point && {
            id: String(point.id),
            name: point.name,
            street: point.street,
            city: point.city,
            zip: point.zip,
          },
        ),
      { country: "cz", language: "cs" },
    ),
  );
};

// ---- Payment gateway ----------------------------------------------------------
// Hook for card payments. Once a gateway (Stripe, Comgate, GoPay…) is chosen, this
// calls a server function (e.g. a Netlify Function) that creates the payment for
// the order and returns the gateway URL; the browser is then redirected there.
// The server must confirm the payment (webhook) before the order is marked paid.
export const startCardPayment = async (order) => {
  void order;
  throw new Error("Platba kartou zatím není napojená.");
};
