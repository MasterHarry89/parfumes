// POST from the admin ("Aktualizovat stavy"): the same sync as the hourly job,
// on demand. (Scheduled functions cannot be called by URL.)
import { isAdminRequest, json, syncPacketStatuses } from "../lib/packeta.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdminRequest(request))) return json({ error: "Nemáte oprávnění." }, 403);
  try {
    return json(await syncPacketStatuses());
  } catch (syncError) {
    return json({ error: syncError.message }, 500);
  }
};
