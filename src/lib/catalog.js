import {
  LuBriefcase,
  LuCalendarDays,
  LuDumbbell,
  LuFlower2,
  LuHeart,
  LuLeaf,
  LuMoon,
  LuPartyPopper,
  LuSnowflake,
  LuSun,
} from "react-icons/lu";

// Sample sizes. `price` is the surcharge (in tenths of CZK) on top of the 1 ml price.
export const volumes = [
  { value: 1, label: "1 ml", price: 0 },
  { value: 2, label: "2 ml", price: 30 },
  { value: 3, label: "3 ml", price: 55 },
  { value: 5, label: "5 ml", price: 90, future: true },
  { value: 10, label: "10 ml", price: 150, future: true },
];

// Prices and costs are stored in tenths of CZK (890 = 89,00 Kč).
export const money = (value) =>
  `${(value / 10).toLocaleString("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;

export const toList = (value) => (Array.isArray(value) ? value : []);

export const slugify = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Allowed values for products.seasons / products.occasions (see supabase/product-details.sql).
export const seasonOptions = [
  { key: "jaro", label: "Jaro", icon: LuFlower2 },
  { key: "leto", label: "Léto", icon: LuSun },
  { key: "podzim", label: "Podzim", icon: LuLeaf },
  { key: "zima", label: "Zima", icon: LuSnowflake },
];
export const occasionOptions = [
  { key: "kazdodenni", label: "Každodenní", icon: LuCalendarDays },
  { key: "prace", label: "Do práce", icon: LuBriefcase },
  { key: "vecer", label: "Večer", icon: LuMoon },
  { key: "rande", label: "Rande", icon: LuHeart },
  { key: "sport", label: "Sport", icon: LuDumbbell },
  { key: "party", label: "Párty", icon: LuPartyPopper },
];

// Fragrance families, same set as the "Parfémové rodiny" tiles on the home page.
export const familyOptions = [
  "Citrus",
  "Dřevité",
  "Sladké",
  "Ovocné",
  "Amber",
  "Fresh",
  "Kořeněné",
  "Orientální",
  "Kožené",
  "Tabákové",
  "Zelené",
  "Vodní",
  "Pižmové",
  "Pudrové",
  "Bílé květiny",
];

// Sample sizes that can be sold today (5 and 10 ml are "brzy").
export const sampleVolumes = volumes.filter((volume) => !volume.future);

// Selling price of one size in tenths of CZK. Uses the price stored for that
// size, otherwise the legacy "1 ml price + fixed surcharge".
export const priceFor = (product, volume) =>
  Number(product.prices?.[volume.value]) || product.price + volume.price;

// Packaging cost (tenths of CZK) of ONE sample of the given size.
export const packagingCost = (materials, size) =>
  materials
    .filter((material) => material.sizes.includes(size))
    .reduce((sum, material) => sum + material.unitCost * material.perSample, 0);

// Smallest price ending in 9 (9, 19, 29, ... 99, 109 ...) that reaches the target
// margin over `cost`. Both in tenths of CZK; the result is a whole number of Kč.
export const suggestPrice = (cost, marginPercent) => {
  const target = cost / (1 - Math.min(marginPercent, 95) / 100) / 10; // in Kč
  const steps = Math.max(0, Math.ceil((target - 9) / 10));
  return (steps * 10 + 9) * 10;
};

// "89,5" / "89.5" -> 89.5, anything unparsable -> NaN
export const parseNumber = (text) => Number(String(text).trim().replace(",", "."));

// Money is stored in tenths of CZK.
export const toStored = (kc) => Math.round(kc * 10);

// Orders that count as revenue (not waiting for payment and not cancelled).
export const countsAsRevenue = (status) =>
  !["pending", "cancelled", "canceled", "zrušeno"].includes(String(status).toLowerCase());

// One row per sample size with the cost breakdown, the suggested price and the
// price actually in use. Money is in tenths of CZK. `priceInputs` holds prices
// (as text, in Kč) the user typed over the suggestion, keyed by size in ml.
export const computePricing = ({
  costPerMl,
  materials,
  labourPerSample = 0,
  marginTarget,
  priceInputs,
}) =>
  sampleVolumes.map((volume) => {
    const perfume = costPerMl === null ? null : costPerMl * volume.value;
    const packaging = packagingCost(materials, volume.value);
    const labour = labourPerSample;
    const cost = perfume === null ? null : perfume + packaging + labour;
    const canSuggest = cost !== null && marginTarget >= 0 && marginTarget < 100;
    const suggested = canSuggest ? suggestPrice(cost, marginTarget) : null;
    const override = priceInputs[volume.value];
    const priceKc =
      override !== undefined ? parseNumber(override) : suggested !== null ? suggested / 10 : NaN;
    const price = priceKc > 0 ? toStored(priceKc) : null;
    const margin =
      price !== null && cost !== null ? Math.round(((price - cost) / price) * 100) : null;
    return { volume, perfume, packaging, labour, cost, suggested, override, price, margin };
  });

// "2026-09" for a Date / ISO string / "YYYY-MM-DD" date.
export const monthKey = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}/.test(value) && value.length <= 10) {
    return value.slice(0, 7);
  }
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key) => {
  const [year, month] = key.split("-").map(Number);
  const text = new Date(year, month - 1, 1).toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Today as YYYY-MM-DD in local time (toISOString would shift the day around midnight).
export const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
