import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

function toIsoLocal(d: Date) {
  // yyyy-MM-ddTHH:mm pro input[type=datetime-local]
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function Reserve() {
  const { id } = useParams();
  const trailerId = Number(id);

  const now = useMemo(() => new Date(), []);
  const [startAt, setStartAt] = useState(toIsoLocal(now));
  const [endAt, setEndAt] = useState(toIsoLocal(new Date(now.getTime() + 2 * 60 * 60 * 1000)));
  const [reservationId, setReservationId] = useState<number>(Date.now()); // demo ID
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createPin() {
    setErr(null);
    setResult(null);

    if (!trailerId) {
      setErr("Neplatné ID vleku.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3100/api/reservations/createPin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          trailerId,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setResult(data);
    } catch (e: any) {
      setErr(e?.message || "Chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to={`/t/${trailerId}`}>← zpět na vlek</Link>
      </div>

      <h1 style={{ margin: "0 0 12px 0" }}>Rezervace</h1>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#64748b", marginBottom: 6 }}>Reservation ID (demo)</div>
          <input
            value={reservationId}
            onChange={(e) => setReservationId(Number(e.target.value))}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#64748b", marginBottom: 6 }}>Od</div>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#64748b", marginBottom: 6 }}>Do</div>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", width: "100%" }}
          />
        </div>

        <button
          onClick={createPin}
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Vytvářím PIN…" : "Potvrdit a vytvořit PIN"}
        </button>

        {err && (
          <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 700 }}>
            {err}
          </div>
        )}

        {result?.mock && (
  <div style={{ marginTop: 8, color: "#b45309", fontWeight: 700 }}>
    ⚠️ Testovací PIN – zámek se neodemkne (mock)
  </div>
)}


        {result && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>PIN: {result.pin}</div>
            <div style={{ color: "#64748b" }}>Typ: {result.type}</div>
          </div>
        )}
      </div>
    </div>
  );
}
