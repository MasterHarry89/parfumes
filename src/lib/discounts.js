import { money } from "./catalog";

// Discount codes. The database (supabase/discounts.sql) decides whether a code is
// valid and how much it takes off; this file only formats what it answers.

// Codes are stored upper-case: letters, digits, "-" and "_", 3–32 characters.
export const normalizeCode = (text) => text.trim().toUpperCase().replace(/\s+/g, "");
export const isValidCode = (code) => /^[A-Z0-9_-]{3,32}$/.test(code);

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("cs-CZ");

// "10 %" or "50,00 Kč". `value` is a percentage, or tenths of CZK for a fixed amount.
export const discountValueLabel = (kind, value) =>
  kind === "percent" ? `${Number(value).toLocaleString("cs-CZ")} %` : money(Number(value));

// Message for a refused code, from check_discount() or a "discount_*" place_order() error.
export const discountErrorMessage = (result) => {
  switch (result.error) {
    case "unknown":
      return "Tento slevový kód neexistuje.";
    case "ended":
      return "Platnost tohoto kódu byla ukončena.";
    case "not_started":
      return result.valid_from ? `Kód platí až od ${formatDate(result.valid_from)}.` : "Kód zatím neplatí.";
    case "expired":
      return result.valid_to ? `Platnost kódu skončila ${formatDate(result.valid_to)}.` : "Platnost kódu skončila.";
    case "min_order":
      return result.min_order
        ? `Kód platí pro nákup zboží od ${money(Number(result.min_order))}.`
        : "Nákup nesplňuje podmínky kódu.";
    case "used_up":
      return "Tento kód už byl vyčerpán.";
    case "already_used":
      return "Tento kód jste už jednou použili.";
    default:
      return "Kód se nepodařilo ověřit. Zkuste to prosím znovu.";
  }
};

// Codes ended by the admin, waiting for their start, past their end, or running.
// Dates are compared as Prague calendar days, like the database does.
export const discountState = (code, usedCount = 0) => {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
  if (!code.active) return ["Ukončený", ""];
  if (code.validTo && today > code.validTo) return ["Vypršel", ""];
  if (code.maxUses && usedCount >= code.maxUses) return ["Vyčerpaný", "warn"];
  if (code.validFrom && today < code.validFrom) return ["Naplánovaný", "info"];
  return ["Aktivní", "ok"];
};
