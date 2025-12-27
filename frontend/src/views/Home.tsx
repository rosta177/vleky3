import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import { Link } from "react-router-dom";
import MapPreview from "../components/MapPreview";


type Trailer = {
  id: number;
  name: string;
  price_per_day_czk?: number;
};

export default function Home() {
  const { data, isLoading, error } = useQuery<Trailer[]>({
    queryKey: ["trailers"],
    queryFn: () => apiGet("/trailers"),
  });

  if (isLoading) return <p>Načítám vleky…</p>;
  if (error) return <p>Chyba při načítání</p>;

    return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Půjčvlek</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {data!.map(t => (
          <div
            key={t.id}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, wordBreak: "break-word" }}>
                  {t.name}
                </div>
                <div style={{ marginTop: 6, color: "#6b7280" }}>
                  {t.price_per_day_czk ? `${t.price_per_day_czk} Kč/den` : "Cena: neuvedeno"}
                </div>
              </div>

              <span
                title="Status (zatím placeholder)"
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#f3f4f6",
                  color: "#111827",
                  whiteSpace: "nowrap",
                }}
              >
                dostupný
              </span>
            </div>

            {/* Map placeholder */}
                       {/* Map */}
            <div style={{ marginTop: 12 }}>
              <MapPreview lat={(t as any).lat} lng={(t as any).lng} height={180} />
            </div>



            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <Link
                to={`/t/${t.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#111827",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Detail
              </Link>

              <Link
                to={`/t/${t.id}/reserve`}

                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#2563eb",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Rezervovat
              </Link>

              <button
                type="button"
                disabled
                title="Zámek zatím nepovinný – akce pro zámek zatím vypnuté"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  color: "#9ca3af",
                  fontWeight: 600,
                  cursor: "not-allowed",
                }}
              >
                Odemknout (zámek)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

}

