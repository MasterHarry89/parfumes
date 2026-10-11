// POST { orderIds: [...] } from the admin: creates Zásilkovna packets for the
// given orders that are ready to ship and stores the packet number on each order.
import { adminDb, createPacket, isAdminRequest, json } from "../lib/packeta.mjs";

const readyToShip = (order) => {
  const status = String(order.status).toLowerCase();
  if (!String(order.shipping_method ?? "").startsWith("packeta")) return false;
  if (["paid", "zaplaceno", "processing", "k výrobě"].includes(status)) return true;
  return order.payment_method === "cod" && status === "pending";
};

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdminRequest(request))) return json({ error: "Nemáte oprávnění." }, 403);

  const { orderIds } = await request.json().catch(() => ({}));
  if (!Array.isArray(orderIds) || orderIds.length === 0) return json({ error: "Chybí objednávky." }, 400);

  const db = adminDb();
  const { data: orders, error } = await db.from("orders").select("*").in("id", orderIds);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const order of orders) {
    if (order.packeta_packet_id) {
      results.push({ id: order.id, ok: true, barcode: order.packeta_barcode, existing: true });
      continue;
    }
    if (!readyToShip(order)) {
      results.push({ id: order.id, ok: false, error: "Objednávka ještě není zaplacená." });
      continue;
    }
    try {
      const packet = await createPacket(order);
      const { error: saveError } = await db
        .from("orders")
        .update({
          packeta_packet_id: packet.id,
          packeta_barcode: packet.barcode,
          packeta_status: "received data",
          packeta_status_code: 1,
          packeta_status_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (saveError) throw new Error(`Zásilka ${packet.barcode} vznikla, ale neuložila se: ${saveError.message}`);
      results.push({ id: order.id, ok: true, barcode: packet.barcode });
    } catch (createError) {
      results.push({ id: order.id, ok: false, error: createError.message });
    }
  }
  return json({ results });
};
