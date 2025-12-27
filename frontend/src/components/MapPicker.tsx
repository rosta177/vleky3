import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { useMemo } from "react";
import L, { type LatLngExpression, type Icon } from "leaflet";

type Props = {
  lat: number | null;
  lng: number | null;
  height?: number;
  zoom?: number;
  mapset?: string;
  onPick: (lat: number, lng: number) => void;
};

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({
  lat,
  lng,
  height = 260,
  zoom = 14,
  mapset = "basic",
  onPick,
}: Props) {
  const hasCoords = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);

  const center = useMemo<LatLngExpression>(() => {
    if (hasCoords) return [lat as number, lng as number];
    return [49.7477, 13.3776]; // Plzeň fallback
  }, [hasCoords, lat, lng]);

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
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <ClickHandler onPick={onPick} />
        <TileLayer
          url={`http://localhost:3100/api/mapy/tiles/${mapset}/{z}/{x}/{y}.png`}
          attribution="&copy; Mapy.com"
        />
        {hasCoords && <Marker position={[lat as number, lng as number]} icon={markerIcon} />}
      </MapContainer>
    </div>
  );
}
