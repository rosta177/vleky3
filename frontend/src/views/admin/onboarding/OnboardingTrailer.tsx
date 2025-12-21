import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3100";

export default function OnboardingTrailer() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createTrailer() {
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch(`${API}/trailers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "create trailer failed");

      nav(`/admin/onboarding/lock/${j.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>🚚 Přidej první vlek</h1>

      <div style={{ margin: "12px 0" }}>
        <div style={{ color: "#64748b", marginBottom: 6 }}>Název vleku *</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          placeholder="např. Autopřepravník 2t"
        />
      </div>

      <button
        onClick={createTrailer}
        disabled={!name.trim() || saving}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "white",
          fontWeight: 700,
          opacity: name.trim() ? 1 : 0.6,
        }}
      >
        {saving ? "Ukládám…" : "Uložit vlek →"}
      </button>

      {err && <p style={{ color: "#b91c1c", marginTop: 12, fontWeight: 700 }}>{err}</p>}
    </div>
  );
}
