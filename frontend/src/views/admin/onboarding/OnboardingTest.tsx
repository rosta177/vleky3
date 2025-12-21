import { Link, useParams } from "react-router-dom";

export default function OnboardingTest() {
  const { trailerId } = useParams();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>🧪 Ověření</h1>
      <p>Tady dáme tlačítko „Vytvořit test PIN“.</p>

      <p>Trailer ID: <b>{trailerId}</b></p>

      <p style={{ marginTop: 16 }}>
        <Link to="/admin/trailers">Dokončit → správa vleků</Link>
      </p>
    </div>
  );
}
