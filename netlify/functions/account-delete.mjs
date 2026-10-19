// POST from "Můj účet" → "Smazat účet": deletes the caller's own customer account
// (GDPR right to erasure). Orders stay, because accounting law requires keeping
// them; their user_id becomes null (on delete set null), so they are no longer
// tied to a login and the points are gone with the account.
import { createClient } from "@supabase/supabase-js";

import { adminDb, isAdminRequest, json } from "../lib/packeta.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Nejste přihlášeni." }, 401);

  // Who is asking: verified by Supabase from the login token, never taken from the body.
  const userDb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await userDb.auth.getUser(token);
  if (error || !data.user) return json({ error: "Přihlášení vypršelo. Přihlaste se znovu." }, 401);

  // An admin deleting their own login would lock the shop's administration.
  if (await isAdminRequest(request))
    return json({ error: "Účet správce se tu smazat nedá." }, 403);

  const { error: deleteError } = await adminDb().auth.admin.deleteUser(data.user.id);
  if (deleteError) return json({ error: "Účet se nepodařilo smazat. Zkuste to prosím znovu." }, 500);
  return json({ ok: true });
};
