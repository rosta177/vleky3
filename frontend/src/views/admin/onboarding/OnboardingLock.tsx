import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API = "http://localhost:3100";

export default function OnboardingLock() {
  const nav = useNavigate();
  const { trailerId } = useParams();
  const id = Number(trailerId);

  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function postLock(force: boolean) {
    const r = await fetch(`${API}/api/trailers/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "igloohome",
        device_id: deviceId.trim(),
        name: name.trim() || null,
        active,
        ...(force ? { force: true } : {}),
      }),
    });

    const j = await r.json().catch(() => null);
    return { r, j };
  }

  async function save() {
    setErr(null);
    setSaving(true);

    try {
      // 1) první pokus bez force
      const { r, j } = await postLock(false);

      if (!r.ok) {
        // 409 = už přiřazeno jinde -> nabídnout přesun
        if (r.status === 409 && j?.error === "LOCK_ALREADY_ASSIGNED") {
          const current = j?.currentTrailer;
          const msg =
            `Tenhle zámek už je přiřazen k vleku ` +
            `${current?.id ?? "?"}` +
            (current?.name ? ` (${current.name})` : "") +
            `. \n\nChceš ho PŘESUNOUT na tento vlek (${id})?`;

          const yes = window.confirm(msg);

          if (!yes) {
            setErr("Přesun zámku zrušen.");
            return;
          }

          // 2) druhý pokus s force:true
          const { r: r2, j: j2 } = await postLock(true);
          if (!r2.ok) throw new Error(j2?.error || "save lock failed (force)");

          nav(`/admin/onboarding/test/${id}`);
          return;
        }

        // ostatní chyby
        throw new Error(j?.error || "save lock failed");
      }

      // success
      nav(`/admin/onboarding/test/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>🔒 Zámek k vleku</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#64748b", marginBottom: 6 }}>Device ID (Igloohome) *</div>
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          placeholder="např. SP2X2408136a"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#64748b", marginBottom: 6 }}>Název zámku (pro vás)</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          placeholder="např. Padlock – autopřepravník"
        />
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Aktivní
      </label>

      <button
        onClick={save}
        disabled={!deviceId.trim() || saving}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "white",
          fontWeight: 700,
          opacity: deviceId.trim() ? 1 : 0.6,
        }}
      >
        {saving ? "Ukládám…" : "Uložit zámek →"}
      </button>

      {err && <p style={{ color: "#b91c1c", marginTop: 12, fontWeight: 700 }}>{err}</p>}
    </div>
  );
}
