export type GeocodeItem = { label: string; lat: number; lon: number };

export async function mapyGeocode(q: string): Promise<GeocodeItem[]> {
  const r = await fetch(`http://localhost:3100/api/mapy/geocode?q=${encodeURIComponent(q)}`);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return Array.isArray(j?.items) ? j.items : [];
}

export async function mapyReverse(lat: number, lng: number): Promise<{ label: string }> {
  const r = await fetch(`http://localhost:3100/api/mapy/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return { label: String(j?.label || "") };
}
