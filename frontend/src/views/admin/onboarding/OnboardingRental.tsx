import { useNavigate } from "react-router-dom";

export default function OnboardingRental() {
  const nav = useNavigate();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>🏠 Základ půjčovny</h1>
      <p>Tady bude formulář půjčovny (rentals).</p>

      <button
        onClick={() => nav("/admin/onboarding/trailer")}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "white",
          fontWeight: 700,
        }}
      >
        Pokračovat →
      </button>
    </div>
  );
}
