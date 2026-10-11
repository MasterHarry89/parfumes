// CSV for Zásilkovna's bulk import (client.packeta.com > Import zásilek).
// The first row holds the column names from Zásilkovna's field list, so a custom
// template ("Vlastní šablona", 1 ignored header row) maps them once and is then
// reused for every import.

// Weight of one parcel with samples, in kg (Zásilkovna requires it).
export const PARCEL_WEIGHT_KG = 0.1;

// Zásilkovna's carrier ID for home delivery in the Czech Republic (from the list of
// carriers in the Zásilkovna administration). Empty = home-delivery orders are skipped.
export const HOME_DELIVERY_CARRIER_ID = "";

// Zásilkovna reserves the first column of every import file ("Nevybráno"); it
// must stay empty and cannot be mapped, so each row starts with a blank cell.
const columns = [
  "Vyhrazeno",
  "Číslo",
  "Celé jméno",
  "E-mail",
  "Telefon",
  "Dobírka",
  "Měna",
  "Hodnota",
  "Hmotnost",
  "Výdejní místo nebo dopravce",
  "Ulice",
  "Číslo popisné",
  "Město",
  "PSČ",
];

// Orders that are ready to hand over: paid ones, and cash-on-delivery ones that
// are still waiting (they are paid on pickup).
export const isReadyToShip = (order) => {
  const status = String(order.status).toLowerCase();
  if (!String(order.shippingMethod ?? "").startsWith("packeta")) return false;
  if (["paid", "zaplaceno", "processing", "k výrobě"].includes(status)) return true;
  return order.paymentMethod === "cod" && status === "pending";
};

// Totals are in tenths of CZK; Zásilkovna accepts whole crowns only for CZK.
const crowns = (tenths) => String(Math.round(tenths / 10));

// "+420 777 123 456" / "777123456" -> "+420777123456"
const phone = (text) => {
  const digits = String(text ?? "").replace(/[^\d+]/g, "");
  return /^\d{9}$/.test(digits) ? `+420${digits}` : digits;
};

// "Na Pankráci 1234/56" -> ["Na Pankráci", "1234/56"]
const splitStreet = (street) => {
  const match = String(street ?? "").trim().match(/^(.*?)[\s,]+(\d[\w/-]*)$/);
  return match ? [match[1], match[2]] : [String(street ?? "").trim(), ""];
};

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Returns the CSV text plus the orders that could not be exported and why.
export const buildPacketaCsv = (orders) => {
  const rows = [];
  const skipped = [];
  orders.forEach((order) => {
    let destination;
    let address = ["", "", "", ""];
    if (order.shippingMethod === "packeta_point") {
      destination = order.shippingPoint?.id;
      if (!destination) {
        skipped.push({ order, reason: "výdejní místo bylo zadané ručně, chybí jeho ID" });
        return;
      }
    } else {
      destination = HOME_DELIVERY_CARRIER_ID;
      if (!destination) {
        skipped.push({ order, reason: "není nastavené ID dopravce pro doručení na adresu" });
        return;
      }
      const [street, houseNumber] = splitStreet(order.shippingAddress?.street);
      address = [street, houseNumber, order.shippingAddress?.city ?? "", order.shippingAddress?.zip ?? ""];
    }
    rows.push([
      "",
      order.number ?? order.id,
      order.customer,
      order.email,
      phone(order.phone),
      order.paymentMethod === "cod" ? crowns(order.total) : "",
      "CZK",
      crowns(order.total),
      String(PARCEL_WEIGHT_KG),
      destination,
      ...address,
    ]);
  });
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  return { csv, count: rows.length, skipped };
};

export const downloadCsv = (csv, fileName) => {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
