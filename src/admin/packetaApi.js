// Admin calls to the Zásilkovna Netlify functions (netlify/functions/packeta-*).
// They run on the server because they need the Zásilkovna API password.
import { supabase } from "../lib/supabase";

const call = async (name, body = {}) => {
  const { data } = await supabase.auth.getSession();
  let response;
  try {
    response = await fetch(`/.netlify/functions/${name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Server neodpovídá. Zkontrolujte připojení.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.error ??
        (response.status === 404
          ? "Serverové funkce tu neběží. Spusťte web přes Netlify (nasazený web nebo `netlify dev`)."
          : "Chyba serveru."),
    );
  return result;
};

export const createPackets = (orderIds) => call("packeta-create", { orderIds });
export const refreshPacketStatuses = () => call("packeta-refresh");

export const downloadLabels = async (orderIds) => {
  const { pdf } = await call("packeta-labels", { orderIds });
  const bytes = Uint8Array.from(atob(pdf), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `stitky-zasilkovna-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

// Zásilkovna tracking status codes in Czech.
const packetStatusLabels = {
  1: "Zásilka založena",
  2: "Podána",
  3: "Připravena k odeslání",
  4: "Na cestě",
  5: "Připravena k vyzvednutí",
  6: "Předána dopravci",
  7: "Vyzvednuta",
  9: "Vrací se odesílateli",
  10: "Vrácena",
  11: "Zrušena",
  12: "Vyzvednuta dopravcem",
  14: "Celní řízení",
  16: "Pokus o doručení",
  17: "Odmítnuta příjemcem",
};
export const packetStatusLabel = (order) =>
  order.packetId ? (packetStatusLabels[order.packetStatusCode] ?? order.packetStatus ?? "Zásilka založena") : null;

// Packets created but not yet handed over: these still need a printed label.
export const needsLabel = (order) => Boolean(order.packetId) && (order.packetStatusCode ?? 1) <= 1;
