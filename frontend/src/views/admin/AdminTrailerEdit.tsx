import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API = "http://localhost:3100";

type Trailer = {
  id: number;
  name: string;
  total_weight_kg: number | null;
  payload_kg: number | null;
  bed_width_m: number | null;
  bed_length_m: number | null;
  cover: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  price_per_day_czk: number | null;
  owner_name: string | null;
  description: string | null;
  photos?: string[];
  rental_id?: number | null;
};

type Lock = {
  id: number;
  trailer_id: number;
  provider: string;
  device_id: string;
  name: string | null;
  active: number;
};

type IglooDevice = {
  deviceId: string;
  deviceName?: string;
  type?: string;
  batteryLevel?: number;
};

function nOrNull(v: string): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#64748b", marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "1px solid #cbd5e1",
        }}
      />
    </div>
  );
}

export default function AdminTrailerEdit() {
  const { id } = useParams();
  const trailerId = Number(id);
  const qc = useQueryClient();

  // Trailer
  const trailerQ = useQuery<Trailer>({
    queryKey: ["trailer", trailerId],
    queryFn: async () => {
      const r = await fetch(`${API}/trailers/${trailerId}`);
      if (!r.ok) throw new Error("load trailer failed");
      return r.json();
    },
    enabled: !!trailerId,
  });

  // Lock
  const lockQ = useQuery<Lock | null>({
    queryKey: ["lock", trailerId],
    queryFn: async () => {
      const r = await fetch(`${API}/api/trailers/${trailerId}/lock`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("load lock failed");
      return r.json();
    },
    enabled: !!trailerId,
  });

  // Igloo devices
  const devicesQ = useQuery<IglooDevice[]>({
    queryKey: ["igloo-devices"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/igloo/devices`);
      if (!r.ok) throw new Error("load igloo devices failed");
      const j = await r.json();

      // tvůj endpoint vrací tabulku s payload
      const payload = Array.isArray(j?.payload) ? j.payload : [];
      return payload.map((d: any) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        type: d.type,
        batteryLevel: d.batteryLevel,
      }));
    },
  });

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [desc, setDesc] = useState("");

  const [totalWeight, setTotalWeight] = useState("");
  const [payload, setPayload] = useState("");
  const [bedW, setBedW] = useState("");
  const [bedL, setBedL] = useState("");
  const [cover, setCover] = useState("");

  // Lock state
  const [deviceId, setDeviceId] = useState("");
  const [lockName, setLockName] = useState("");
  const [active, setActive] = useState(true);

  // inicializace z dat (jen jednou po načtení)
  useEffect(() => {
    if (!trailerQ.data) return;
    const t = trailerQ.data;

    setName((prev) => (prev ? prev : t.name ?? ""));
    setPrice((prev) => (prev ? prev : (t.price_per_day_czk ?? "").toString()));
    setLocation((prev) => (prev ? prev : (t.location ?? "")));
    setOwner((prev) => (prev ? prev : (t.owner_name ?? "")));
    setDesc((prev) => (prev ? prev : (t.description ?? "")));

    setTotalWeight((prev) => (prev ? prev : (t.total_weight_kg ?? "").toString()));
    setPayload((prev) => (prev ? prev : (t.payload_kg ?? "").toString()));
    setBedW((prev) => (prev ? prev : (t.bed_width_m ?? "").toString()));
    setBedL((prev) => (prev ? prev : (t.bed_length_m ?? "").toString()));
    setCover((prev) => (prev ? prev : (t.cover ?? "")));
  }, [trailerQ.data]);

  useEffect(() => {
    if (!lockQ.data) return;
    const l = lockQ.data;
    setDeviceId((prev) => (prev ? prev : l.device_id ?? ""));
    setLockName((prev) => (prev ? prev : (l.name ?? "")));
    setActive(l.active === 1);
  }, [lockQ.data]);

  const saveTrailer = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        price_per_day_czk: nOrNull(price),
        location: location.trim() || null,
        owner_name: owner.trim() || null,
        description: desc.trim() || null,

        total_weight_kg: nOrNull(totalWeight),
        payload_kg: nOrNull(payload),
        bed_width_m: nOrNull(bedW),
        bed_length_m: nOrNull(bedL),
        cover: cover.trim() || null,
      };

      const r = await fetch(`${API}/trailers/${trailerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "save trailer failed");
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trailer", trailerId] }),
  });

  const saveLock = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/trailers/${trailerId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "igloohome",
          device_id: deviceId.trim(),
          name: lockName.trim() || null,
          active,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "save lock failed");
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lock", trailerId] }),
  });

  const deviceOptions = useMemo(() => {
    const arr = devicesQ.data ?? [];
    return arr.slice().sort((a, b) => String(a.deviceName ?? a.deviceId).localeCompare(String(b.deviceName ?? b.deviceId)));
  }, [devicesQ.data]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 820 }}>
      <p>
        <Link to="/admin/trailers">← zpět na admin vleky</Link>
      </p>

      <h1 style={{ margin: "0 0 12px 0" }}>Admin – vlek {trailerId}</h1>

      {/* TRAILER FORM */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, background: "white" }}>
        <h3 style={{ marginTop: 0 }}>Vlek</h3>

        <Input label="Název" value={name} onChange={setName} placeholder="např. Autopřepravník 2t" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Cena Kč/den" value={price} onChange={setPrice} placeholder="např. 300" />
          <Input label="Lokace" value={location} onChange={setLocation} placeholder="např. Chrást" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Majitel (jméno)" value={owner} onChange={setOwner} placeholder="např. Rostislav" />
          <Input label="Plachta (text)" value={cover} onChange={setCover} placeholder="např. ano/ne nebo typ" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Celková váha (kg)" value={totalWeight} onChange={setTotalWeight} placeholder="např. 750" />
          <Input label="Nosnost (kg)" value={payload} onChange={setPayload} placeholder="např. 2000" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Ložná šířka (m)" value={bedW} onChange={setBedW} placeholder="např. 2.0" />
          <Input label="Ložná délka (m)" value={bedL} onChange={setBedL} placeholder="např. 4.0" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#64748b", marginBottom: 6 }}>Popis</div>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          onClick={() => saveTrailer.mutate()}
          disabled={!name.trim() || saveTrailer.isPending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "white",
            fontWeight: 700,
            opacity: !name.trim() ? 0.6 : 1,
          }}
        >
          {saveTrailer.isPending ? "Ukládám…" : "Uložit vlek"}
        </button>

        {saveTrailer.isError && (
          <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 700 }}>
            {(saveTrailer.error as Error).message}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* LOCK FORM */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, background: "white" }}>
        <h3 style={{ marginTop: 0 }}>Zámek (Igloohome)</h3>

        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#64748b", marginBottom: 6 }}>Vybrat z Igloo zařízení</div>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          >
            <option value="">— vyber zařízení —</option>
            {deviceOptions.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceName ? `${d.deviceName} (${d.deviceId})` : d.deviceId}
                {typeof d.batteryLevel === "number" ? ` • ${d.batteryLevel}%` : ""}
              </option>
            ))}
          </select>
          {devicesQ.isLoading && <div style={{ color: "#64748b", marginTop: 6 }}>Načítám devices…</div>}
          {devicesQ.isError && <div style={{ color: "#b91c1c", marginTop: 6 }}>Nepodařilo se načíst devices</div>}
        </div>

        <Input label="Device ID (ručně)" value={deviceId} onChange={setDeviceId} placeholder="např. SP2X..." />

        <Input label="Název zámku" value={lockName} onChange={setLockName} placeholder="např. padlock2 nr1" />

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktivní
        </label>

        <button
          onClick={() => saveLock.mutate()}
          disabled={!deviceId.trim() || saveLock.isPending}
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
          {saveLock.isPending ? "Ukládám…" : "Uložit zámek"}
        </button>

        {saveLock.isError && (
          <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 700 }}>
            {(saveLock.error as Error).message}
          </div>
        )}
      </div>

      <p style={{ marginTop: 16 }}>
        <Link to={`/t/${trailerId}`}>→ veřejná stránka vleku</Link>
      </p>
    </div>
  );
}
