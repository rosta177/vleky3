import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";

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

  photos: string[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0" }}>
      <div style={{ width: 170, color: "#64748b" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function TrailerPublic() {
  const { id } = useParams();

  const { data, isLoading, isError, error } = useQuery<Trailer>({
    queryKey: ["trailer", id],
    queryFn: () => apiGet(`/trailers/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 24 }}>Načítám vlek…</div>;

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#b91c1c", fontWeight: 700 }}>Chyba při načítání vleku</p>
        <p>{(error as Error).message}</p>
        <p>
          <Link to="/">← zpět na seznam</Link>
        </p>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 24 }}>Vlek nenalezen</div>;

  const t = data;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/">← zpět na seznam</Link>
      </div>

      <h1 style={{ margin: "0 0 12px 0", fontSize: 48 }}>{t.name}</h1>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          maxWidth: 720,
          background: "white",
        }}
      >
        <Row label="Cena" value={t.price_per_day_czk !== null ? `${t.price_per_day_czk} Kč/den` : "—"} />
        <Row label="Lokace" value={t.location ?? "—"} />
        <Row label="Majitel" value={t.owner_name ?? "—"} />
        <Row label="Nosnost" value={t.payload_kg !== null ? `${t.payload_kg} kg` : "—"} />
        <Row label="Celková váha" value={t.total_weight_kg !== null ? `${t.total_weight_kg} kg` : "—"} />
        <Row
          label="Ložná plocha"
          value={t.bed_width_m && t.bed_length_m ? `${t.bed_width_m} m × ${t.bed_length_m} m` : "—"}
        />
        <Row label="Plachta" value={t.cover ?? "—"} />
      </div>

      {t.description && (
        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <h3>Popis</h3>
          <p>{t.description}</p>
        </div>
      )}

      <div style={{ maxWidth: 720, marginTop: 18 }}>
        <Link
          to={`/t/${t.id}/reserve`}
          style={{
            display: "inline-block",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "white",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Rezervovat
        </Link>
      </div>
    </div>
  );
}
