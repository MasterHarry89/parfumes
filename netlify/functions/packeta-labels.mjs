// POST { orderIds: [...] } from the admin: one PDF with the Zásilkovna labels of
// those orders (four A6 labels per A4 page), returned as base64.
import { adminDb, isAdminRequest, json, labelsPdf } from "../lib/packeta.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdminRequest(request))) return json({ error: "Nemáte oprávnění." }, 403);

  const { orderIds } = await request.json().catch(() => ({}));
  if (!Array.isArray(orderIds) || orderIds.length === 0) return json({ error: "Chybí objednávky." }, 400);

  const { data: orders, error } = await adminDb()
    .from("orders")
    .select("packeta_packet_id")
    .in("id", orderIds)
    .not("packeta_packet_id", "is", null);
  if (error) return json({ error: error.message }, 500);
  if (orders.length === 0) return json({ error: "Objednávky nemají založené zásilky." }, 400);

  try {
    return json({ pdf: await labelsPdf(orders.map((order) => order.packeta_packet_id)) });
  } catch (labelError) {
    return json({ error: labelError.message }, 502);
  }
};
