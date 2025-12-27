import { useMemo } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L, { type LatLngExpression, type Icon } from "leaflet";

type Props = {
  lat?: number | null;
  lng?: number | null;
  height?: number;
  zoom?: number;
  mapset?: string; // např. "basic"
};

export default function MapPreview({
  lat,
  lng,
  height = 180,
  zoom = 14,
  mapset = "basic",
}: Props) {
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const center = useMemo<LatLngExpression>(() => {
    if (hasCoords) return [lat as number, lng as number];
    // fallback centrum (Plzeň)
    return [49.7477, 13.3776];
  }, [hasCoords, lat, lng]);

  // Default Leaflet icon fix pro Vite/React (jinak bývá rozbitá ikona markeru)
  const markerIcon = useMemo<Icon>(
    () =>
      new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      }),
    []
  );

  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={`http://localhost:3100/api/mapy/tiles/${mapset}/{z}/{x}/{y}.png`}
          attribution="&copy; Mapy.com"
        />
        {hasCoords && <Marker position={center} icon={markerIcon} />}
      </MapContainer>
    </div>
  );
}
