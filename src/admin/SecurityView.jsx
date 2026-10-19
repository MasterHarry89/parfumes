import { useEffect, useState } from "react";
import { FiInfo, FiShield } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import { Panel } from "./views";

// Two-factor login (TOTP: Google Authenticator, Microsoft Authenticator, 1Password …).
// Once it is on, public.is_admin() accepts only sessions confirmed with the code.

const verifiedTotp = (factors) => (factors?.totp ?? []).find((factor) => factor.status === "verified");

function CodeInput({ value, onChange }) {
  return (
    <input
      className="adm-code-input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      placeholder="123456"
      aria-label="Šestimístný kód z aplikace"
      autoFocus
    />
  );
}

const verifyCode = async (factorId, code) => {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? "Kód nesedí nebo vypršel. Zadejte aktuální kód z aplikace." : null;
};

// Shown right after the password when the admin has the authenticator app turned on.
export function MfaChallenge({ onSignOut }) {
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setFactorId(verifiedTotp(data)?.id ?? null));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!factorId || code.length !== 6) return setError("Zadejte šestimístný kód.");
    setBusy(true);
    setError("");
    const problem = await verifyCode(factorId, code);
    // On success Supabase issues a new session; the admin opens by itself.
    if (problem) {
      setError(problem);
      setCode("");
      setBusy(false);
    }
  };

  return (
    <form className="adm-login" onSubmit={submit}>
      <FiShield className="adm-login-icon" aria-hidden="true" />
      <h1>Ověřovací kód</h1>
      <p>Otevřete ověřovací aplikaci v telefonu a opište šestimístný kód pro eParfumes.</p>
      <CodeInput value={code} onChange={setCode} />
      {error && (
        <p className="adm-alert" role="alert">
          {error}
        </p>
      )}
      <button className="adm-primary" disabled={busy || !factorId}>
        {busy ? "Ověřuji…" : "Pokračovat"}
      </button>
      <button type="button" className="adm-link" onClick={onSignOut}>
        Odhlásit se
      </button>
    </form>
  );
}

export default function SecurityView() {
  const [factors, setFactors] = useState(null);
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }

  const load = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setMessage({ tone: "bad", text: `Nepodařilo se načíst nastavení: ${error.message}` });
    setFactors(data ?? { all: [], totp: [] });
  };

  useEffect(() => {
    load();
  }, []);

  const active = verifiedTotp(factors);

  const start = async () => {
    setBusy(true);
    setMessage(null);
    // A half-finished earlier attempt would block a new one.
    for (const factor of factors?.all ?? []) {
      if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "eParfumes admin" });
    setBusy(false);
    if (error) return setMessage({ tone: "bad", text: `Zapnutí se nepovedlo: ${error.message}` });
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  };

  const confirm = async (event) => {
    event.preventDefault();
    if (code.length !== 6) return setMessage({ tone: "bad", text: "Zadejte šestimístný kód z aplikace." });
    setBusy(true);
    const problem = await verifyCode(enrolling.id, code);
    setBusy(false);
    if (problem) return setMessage({ tone: "bad", text: problem });
    setEnrolling(null);
    setMessage({ tone: "ok", text: "Dvoufázové přihlášení je zapnuté. Příště po hesle zadáte i kód z aplikace." });
    await load();
  };

  const turnOff = async () => {
    if (!window.confirm("Opravdu vypnout dvoufázové přihlášení? K adminu pak bude stačit jen heslo.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: active.id });
    setBusy(false);
    if (error) return setMessage({ tone: "bad", text: `Vypnutí se nepovedlo: ${error.message}` });
    setMessage({ tone: "ok", text: "Dvoufázové přihlášení je vypnuté." });
    await load();
  };

  return (
    <div className="adm-page">
      <div className="adm-note">
        <FiInfo aria-hidden="true" />
        <p>
          <strong>Proč:</strong> k adminu se dostane každý, kdo zná vaše heslo. S dvoufázovým přihlášením je navíc
          potřeba kód z aplikace ve vašem telefonu, takže samotné ukradené nebo uniklé heslo nestačí.
        </p>
      </div>

      <Panel eyebrow="Přihlášení do adminu" title="Dvoufázové přihlášení">
        {factors === null ? (
          <p className="adm-lead">Načítám…</p>
        ) : active ? (
          <div className="adm-mfa">
            <span className="adm-pill adm-pill-ok">Zapnuto</span>
            <p>Po zadání hesla se vždy zeptáme i na kód z ověřovací aplikace.</p>
            <button className="adm-button adm-button-light" onClick={turnOff} disabled={busy}>
              Vypnout
            </button>
          </div>
        ) : enrolling ? (
          <form className="adm-mfa" onSubmit={confirm}>
            <ol>
              <li>
                V telefonu otevřete ověřovací aplikaci (Google Authenticator, Microsoft Authenticator, 1Password…).
              </li>
              <li>Naskenujte QR kód.</li>
              <li>Opište šestimístný kód, který aplikace ukáže.</li>
            </ol>
            <img className="adm-qr" src={enrolling.qr} alt="QR kód pro ověřovací aplikaci" />
            <p className="adm-sub">
              Nejde naskenovat? Zadejte klíč ručně: <code>{enrolling.secret}</code>
            </p>
            <CodeInput value={code} onChange={setCode} />
            <div className="adm-form-actions">
              <button className="adm-button" disabled={busy}>
                {busy ? "Ověřuji…" : "Zapnout"}
              </button>
              <button type="button" className="adm-button adm-button-light" onClick={() => setEnrolling(null)}>
                Zrušit
              </button>
            </div>
          </form>
        ) : (
          <div className="adm-mfa">
            <span className="adm-pill adm-pill-warn">Vypnuto</span>
            <p>Doporučujeme zapnout. Zabere to minutu a potřebujete jen telefon.</p>
            <button className="adm-button" onClick={start} disabled={busy}>
              <FiShield aria-hidden="true" /> {busy ? "Připravuji…" : "Zapnout dvoufázové přihlášení"}
            </button>
          </div>
        )}
        {message && (
          <p className={message.tone === "ok" ? "adm-ok" : "adm-alert"} role={message.tone === "ok" ? "status" : "alert"}>
            {message.text}
          </p>
        )}
      </Panel>
    </div>
  );
}
