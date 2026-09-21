import { useState } from "react";

import { parseNumber } from "../lib/catalog";

// A number that saves when you leave the field or press Enter.
// `onSave(next)` returns an error message, or null when saved.
export default function NumberCell({ value, unit, label, onSave }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");

  const commit = async () => {
    const next = parseNumber(draft);
    if (!Number.isFinite(next) || next < 0) {
      setDraft(String(value));
      setError("Zadejte číslo od 0.");
      return;
    }
    if (next === value) return;
    setError("");
    const message = await onSave(next);
    if (message) {
      setDraft(String(value));
      setError(message);
    }
  };

  return (
    <div>
      <div className="adm-stock-input">
        <input
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <span>{unit}</span>
      </div>
      {error && <small className="adm-stock-note is-error">{error}</small>}
    </div>
  );
}
