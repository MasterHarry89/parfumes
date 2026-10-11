// Runs every hour on the live site: pulls Zásilkovna tracking states and moves
// orders to "Odesláno" / "Dokončeno".
import { syncPacketStatuses } from "../lib/packeta.mjs";

export default async () => {
  const result = await syncPacketStatuses();
  console.log("packeta-sync", JSON.stringify(result));
};

export const config = { schedule: "@hourly" };
