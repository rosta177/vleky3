import { Link, useNavigate } from "react-router-dom";

export default function OnboardingStart() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>👋 Vítej</h1>
      <p>Nastavíme půjčovnu a první vlek. Zabere to pár minut.</p>

      <button
        onClick={() => nav("/admin/onboarding/rental")}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "white",
          fontWeight: 700,
        }}
      >
        Začít nastavení →
      </button>

      <p style={{ marginTop: 16 }}>
        <Link to="/admin/trailers">Přeskočit na správu vleků</Link>
      </p>
    </div>
  );
}
