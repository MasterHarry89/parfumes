import { supabase } from "../lib/supabase";
import { todayString } from "../lib/catalog";

export const expenseCategories = [
  { key: "perfume", label: "Parfémy" },
  { key: "packaging", label: "Obalový materiál" },
  { key: "platform", label: "Platformy a služby" },
  { key: "other", label: "Ostatní" },
];

// Adds a row to the expenses ledger. Returns an error message, or null on success.
// `amount` is in tenths of CZK.
export const recordExpense = async ({ category, label, amount, productId = null, materialId = null, date }) => {
  const { error } = await supabase.from("expenses").insert({
    spent_on: date ?? todayString(),
    category,
    label,
    amount,
    product_id: productId,
    material_id: materialId,
  });
  if (!error) return null;
  return error.code === "42P01" || /expenses/.test(error.message)
    ? "Výdaj se nezapsal do financí, protože chybí tabulka. Spusťte supabase/finance.sql."
    : `Výdaj se nezapsal do financí: ${error.message}`;
};
