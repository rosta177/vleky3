import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import { Link } from "react-router-dom";

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
    <div style={{ padding: 24 }}>
      <h1>Půjčvlek</h1>

      <ul>
        {data!.map(t => (
          <li key={t.id}>
            <Link to={`/t/${t.id}`}>
              {t.name} {t.price_per_day_czk ? `– ${t.price_per_day_czk} Kč/den` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

