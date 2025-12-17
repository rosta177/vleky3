// services/iglooAccess.js
// --------------------------------------------
// 1) Získání OAuth2 access tokenu
// 2) Načtení seznamu zařízení (Get Devices)
// 3) Vytvoření one-time algoPINu pro konkrétní deviceId
// --------------------------------------------

const axios = require("axios");
const https = require("https");
require("dotenv").config();

const {
  IGLOO_CLIENT_ID,
  IGLOO_CLIENT_SECRET,
  IGLOO_TOKEN_URL,
  IGLOO_API_BASE
} = process.env;

// Výchozí hodnoty – když něco v .env chybí
const TOKEN_URL = IGLOO_TOKEN_URL || "https://auth.igloohome.co/oauth2/token";
const API_BASE = IGLOO_API_BASE || "https://api.igloodeveloper.co/igloohome";

if (!IGLOO_CLIENT_ID || !IGLOO_CLIENT_SECRET) {
  console.warn("⚠️ Chybí IGLOO_CLIENT_ID nebo IGLOO_CLIENT_SECRET v .env");
}

// ⚠️ DEV HTTPS agent – ignoruje chyby certifikátu (jen pro vývoj!)
const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// --------------------------------------------
// Access token (client_credentials)
// --------------------------------------------
async function getAccessToken() {
  try {
    const params = new URLSearchParams();
    params.append("client_id", IGLOO_CLIENT_ID);
    params.append("client_secret", IGLOO_CLIENT_SECRET);
    params.append("grant_type", "client_credentials");

    const res = await axios.post(TOKEN_URL, params.toString(), {
      httpsAgent: insecureHttpsAgent,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const token = res.data.access_token;
    if (!token) {
      throw new Error("V odpovědi není access_token");
    }

    return token;
  } catch (err) {
    console.error(
      "❌ Chyba při získávání tokenu:",
      err.response?.data || err.message || err
    );
    throw new Error("Nepodařilo se získat access token z Igloohome");
  }
}

// --------------------------------------------
// Get Devices – seznam zařízení
// --------------------------------------------
async function getDevices() {
  const token = await getAccessToken();

  console.log("🌍 API_BASE:", API_BASE);

  try {
    const res = await axios.get(`${API_BASE}/devices`, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    return res.data;
  } catch (err) {
    console.error(
      "❌ Chyba při získávání zařízení:",
      err.response?.data || err.message || err
    );
    throw new Error("Nepodařilo se získat seznam zařízení");
  }
}

// Převod JS Date na formát, který chce Igloohome,
// např. "2025-02-11T19:00:00+01:00"
function formatStartDateForIgloohome(date) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = "00"; // podle příkladu z dokumentace necháme vždy :00
  const seconds = "00";

  // JS vrací offset v minutách západně od UTC, proto minus
  const offsetMinutesTotal = -d.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(Math.abs(offsetMinutesTotal) / 60)).padStart(2, "0");
  const offsetMinutes = String(Math.abs(offsetMinutesTotal) % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}


// --------------------------------------------
// Create One-Time AlgoPIN
// POST /devices/{deviceId}/algopin/onetime
// Body:
// {
//   "variance": 1,
//   "startDate": "2022-01-01T00:00:00+08:00",
//   "accessName": "Maintenance guy"
// }
// --------------------------------------------
async function createOneTimePin({ deviceId, startDate, accessName = "Reservation" }) {
  if (!deviceId) {
    throw new Error("Chybí deviceId (ID zámku).");
  }

  if (!startDate) {
    throw new Error("Chybí startDate.");
  }

  try {
    const token = await getAccessToken();

    const url = `${API_BASE}/devices/${deviceId}/algopin/onetime`;

    const formattedStartDate = formatStartDateForIgloohome(startDate);

    const body = {
      variance: 1,
      startDate: formattedStartDate,
      accessName
    };

    const response = await axios.post(url, body, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    return response.data;
  } catch (err) {
    console.error(
      "❌ Chyba při vytváření one-time PINu:",
      err.response?.data || err.message || err
    );
    throw new Error("Nepodařilo se vytvořit one-time PIN");
  }
}

async function createHourlyPin({ deviceId, startDate, endDate, accessName = "Reservation" }) {
  if (!deviceId) throw new Error("Chybí deviceId.");
  if (!startDate) throw new Error("Chybí startDate.");
  if (!endDate) throw new Error("Chybí endDate.");

  try {
    const token = await getAccessToken();

    const url = `${API_BASE}/devices/${deviceId}/algopin/hourly`;

    const formattedStart = formatStartDateForIgloohome(startDate);
    const formattedEnd = formatStartDateForIgloohome(endDate);

    const body = {
      variance: 1,
      startDate: formattedStart,
      endDate: formattedEnd,
      accessName
    };

    const response = await axios.post(url, body, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    return response.data;

    } catch (err) {
    const details = err.response?.data || err.message || err;

    console.error("❌ Chyba při vytváření HOURLY PINu:", details);

    // pošleme výš původní chybu, ať endpoint vidí detaily
    throw err;
  }
}

// --------------------------------------------
// Create Daily AlgoPIN
// POST /devices/{deviceId}/algopin/daily
// --------------------------------------------
async function createDailyPin({ deviceId, startDate, accessName = "Reservation" }) {
  if (!deviceId) throw new Error("Chybí deviceId.");
  if (!startDate) throw new Error("Chybí startDate.");

  try {
    const token = await getAccessToken();

    const url = `${API_BASE}/devices/${deviceId}/algopin/daily`;

    const formattedStart = formatStartDateForIgloohome(startDate);

    const body = {
      variance: 1,
      startDate: formattedStart,
      accessName
    };

    const response = await axios.post(url, body, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    return response.data;

  } catch (err) {
    const details = err.response?.data || err.message || err;
    console.error("❌ Daily PIN error:", details);
    throw err;
  }
}



// --------------------------------------------
// EXPORTY – TADY JE TO DŮLEŽITÉ
// --------------------------------------------
module.exports = {
  getDevices,
  createOneTimePin,
  createHourlyPin,
  createDailyPin,
};


