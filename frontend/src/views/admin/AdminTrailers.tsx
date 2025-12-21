import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = "http://localhost:3100";

type Trailer = { id: number; name: string };

export default function AdminTrailers() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data, isLoading, isError } = useQuery<Trailer[]>({
    queryKey: ["trailers"],
    queryFn: async () => {
      const r = await fetch(`${API}/trailers`);
      if (!r.ok) throw new Error("load trailers failed");
      return r.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/trailers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "create failed");
      return j;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["trailers"] });
    },
  });

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>Admin – vleky</h1>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Název vleku"
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
        />
        <button
          onClick={() => create.mutate()}
          disabled={!name.trim() || create.isPending}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "white", fontWeight: 700 }}
        >
          {create.isPending ? "…" : "Vytvořit"}
        </button>
      </div>

      {isLoading && <p>Načítám…</p>}
      {isError && <p>Chyba načtení</p>}

      <ul>
        {data?.map(t => (
          <li key={t.id}>
            <Link to={`/admin/trailers/${t.id}`}>{t.name} (id {t.id})</Link>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 16 }}>
        <Link to="/">← zpět na veřejný web</Link>
      </p>
    </div>
  );
}
