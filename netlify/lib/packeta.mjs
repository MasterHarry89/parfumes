// Server-side helpers for the Netlify functions: Zásilkovna (Packeta) REST/XML API
// and Supabase with the service role. Secrets live in Netlify environment variables:
//   PACKETA_API_PASSWORD        Zásilkovna API password (secret)
//   SUPABASE_SERVICE_ROLE_KEY   Supabase service role key (secret)
//   PACKETA_SENDER              optional sender ("eshop") name from Zásilkovna
//   PACKETA_WEIGHT_KG           optional parcel weight, default 0.1
//   PACKETA_HOME_CARRIER_ID     optional carrier ID for home delivery
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are shared with the website.
import { createClient } from "@supabase/supabase-js";

const API_URL = "https://www.zasilkovna.cz/api/rest";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

export const adminDb = () =>
  createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

// True when the request carries the login of an allow-listed admin (public.is_admin()).
export const isAdminRequest = async (request) => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const userDb = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userDb.rpc("is_admin");
  return !error && data === true;
};

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// ---- XML ---------------------------------------------------------------------

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// { a: 1, b: { c: 2 }, ids: [3, 4] } -> <a>1</a><b><c>2</c></b><ids>3</ids><ids>4</ids>
const toXml = (data) =>
  Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => toXml({ [key]: item })).join("");
      if (typeof value === "object") return `<${key}>${toXml(value)}</${key}>`;
      return `<${key}>${escapeXml(value)}</${key}>`;
    })
    .join("");

const tag = (xml, name) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

const callApi = async (method, params) => {
  const body = toXml({
    [method]: { apiPassword: process.env.PACKETA_API_PASSWORD, ...params },
  });
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/xml; charset=utf-8" },
    body,
  });
  const xml = await response.text();
  if (tag(xml, "status") !== "ok") {
    // Field-level problems (e.g. an invalid phone) are listed in <detail> as name + fault pairs.
    const details = [
      ...[...xml.matchAll(/<name>([\s\S]*?)<\/name>\s*<fault>([\s\S]*?)<\/fault>/g)].map((m) => `${m[1]}: ${m[2]}`),
      ...[...xml.matchAll(/<message>([\s\S]*?)<\/message>/g)].map((m) => m[1]),
    ];
    throw new Error([tag(xml, "string"), ...details].filter(Boolean).join(" – ") || "Chyba API Zásilkovny");
  }
  return tag(xml, "result") ?? "";
};

// ---- Packets -----------------------------------------------------------------

// Money on orders is in tenths of CZK; Zásilkovna wants whole crowns for CZK.
const crowns = (tenths) => Math.round(Number(tenths || 0) / 10);

const splitName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/);
  return parts.length > 1
    ? { name: parts.slice(0, -1).join(" "), surname: parts.at(-1) }
    : { name: parts[0], surname: parts[0] };
};

const phone = (text) => {
  const digits = String(text ?? "").replace(/[^\d+]/g, "");
  return /^\d{9}$/.test(digits) ? `+420${digits}` : digits;
};

// "Na Pankráci 1234/56" -> ["Na Pankráci", "1234/56"]
const splitStreet = (street) => {
  const match = String(street ?? "").trim().match(/^(.*?)[\s,]+(\d[\w/-]*)$/);
  return match ? [match[1], match[2]] : [String(street ?? "").trim(), ""];
};

// Creates the packet for one order row; returns { id, barcode }.
export const createPacket = async (order) => {
  const home = order.shipping_method === "packeta_home";
  const addressId = home ? process.env.PACKETA_HOME_CARRIER_ID : order.shipping_point?.id;
  if (!addressId)
    throw new Error(
      home
        ? "Není nastavené ID dopravce pro doručení na adresu (PACKETA_HOME_CARRIER_ID)."
        : "Výdejní místo bylo zadané ručně, chybí jeho ID.",
    );
  const [street, houseNumber] = home ? splitStreet(order.shipping_address?.street) : [];
  const result = await callApi("createPacket", {
    packetAttributes: {
      number: order.order_number ?? order.id,
      ...splitName(order.customer_name),
      email: order.email,
      phone: phone(order.phone),
      addressId,
      cod: order.payment_method === "cod" ? crowns(order.total) : undefined,
      value: crowns(order.total),
      currency: "CZK",
      weight: Number(process.env.PACKETA_WEIGHT_KG || 0.1),
      eshop: process.env.PACKETA_SENDER,
      street: home ? street : undefined,
      houseNumber: home ? houseNumber : undefined,
      city: home ? order.shipping_address?.city : undefined,
      zip: home ? order.shipping_address?.zip : undefined,
    },
  });
  return { id: tag(result, "id"), barcode: tag(result, "barcode") };
};

// Latest tracking state of a packet: { code, text, at }.
export const packetStatus = async (packetId) => {
  const result = await callApi("packetStatus", { packetId });
  return {
    code: Number(tag(result, "statusCode")),
    text: tag(result, "codeText") ?? "",
    at: tag(result, "dateTime") ?? null,
  };
};

// One PDF (base64) with the labels of several packets, four A6 labels per A4 page.
export const labelsPdf = (packetIds) =>
  callApi("packetsLabelsPdf", {
    packetIds: { id: packetIds },
    format: "A6 on A4",
    offset: 0,
  });

// Zásilkovna status codes -> our order status. 1 = data received only (not handed
// over yet); 2–6, 12, 14, 16 = on its way; 7 = picked up by the customer.
// Returned / cancelled packets are left for the admin to decide (refund etc.).
export const orderStatusForPacket = (code) => {
  if (code === 7) return "completed";
  if ([2, 3, 4, 5, 6, 12, 14, 16].includes(code)) return "shipped";
  return null;
};

// ---- Shared jobs ---------------------------------------------------------------

const statusRank = { pending: 0, paid: 1, zaplaceno: 1, processing: 1, "k výrobě": 1, shipped: 2, odesláno: 2, completed: 3, dokončeno: 3 };

// Pulls the tracking state of every open packet and moves orders forward
// (never backwards). Returns how many orders were checked and changed.
export const syncPacketStatuses = async () => {
  const db = adminDb();
  const { data: orders, error } = await db
    .from("orders")
    .select("id, status, packeta_packet_id, packeta_status_code")
    .not("packeta_packet_id", "is", null)
    .not("status", "in", "(completed,dokončeno,cancelled,canceled,zrušeno)");
  if (error) throw new Error(error.message);

  let changed = 0;
  const failed = [];
  for (const order of orders) {
    try {
      const state = await packetStatus(order.packeta_packet_id);
      const update = {
        packeta_status: state.text,
        packeta_status_code: state.code,
        packeta_status_at: state.at ? new Date(state.at).toISOString() : new Date().toISOString(),
      };
      const target = orderStatusForPacket(state.code);
      const current = statusRank[String(order.status).toLowerCase()] ?? 0;
      if (target && statusRank[target] > current) update.status = target;
      if (update.status || state.code !== order.packeta_status_code) {
        const { error: updateError } = await db.from("orders").update(update).eq("id", order.id);
        if (updateError) throw new Error(updateError.message);
        if (update.status) changed += 1;
      }
    } catch (syncError) {
      failed.push({ id: order.id, error: syncError.message });
    }
  }
  return { checked: orders.length, changed, failed };
};
