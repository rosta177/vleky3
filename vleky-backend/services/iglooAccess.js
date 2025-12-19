// vleky-backend/services/iglooAccess.js
// --------------------------------------------
// 1) OAuth2 access token (client_credentials)
// 2) Get devices
// 3) Create algoPIN: onetime | hourly | daily
// --------------------------------------------

const axios = require("axios");
const https = require("https");
require("dotenv").config();

const {
  IGLOO_CLIENT_ID,
  IGLOO_CLIENT_SECRET,
  IGLOO_TOKEN_URL,
  IGLOO_API_BASE,
  IGLOO_INSECURE_TLS, // optional: "1" => ignore TLS errors (dev only)
} = process.env;

const TOKEN_URL = IGLOO_TOKEN_URL || "https://auth.igloohome.co/oauth2/token";
const API_BASE = IGLOO_API_BASE || "https://api.igloodeveloper.co/igloohome";

// DEV only: allow turning off cert validation explicitly
const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: IGLOO_INSECURE_TLS === "1" ? false : true,
});

function requireEnv() {
  if (!IGLOO_CLIENT_ID || !IGLOO_CLIENT_SECRET) {
    console.warn("⚠️ Chybí IGLOO_CLIENT_ID nebo IGLOO_CLIENT_SECRET v .env");
  }
}

// Igloohome chce: YYYY-MM-DDTHH:00:00+hh:mm (minuty/sekundy vždy 00)
function formatDateIgloo(date) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");

  const minutes = "00";
  const seconds = "00";

  const offsetMinutesTotal = -d.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(Math.abs(offsetMinutesTotal) / 60)).padStart(2, "0");
  const offsetMinutes = String(Math.abs(offsetMinutesTotal) % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}
function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}
// Igloohome ONETIME – pošleme i minuty (a klidně sekundy = 00)
function formatDateIglooExact(date) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = "00";

  const offsetMinutesTotal = -d.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(Math.abs(offsetMinutesTotal) / 60)).padStart(2, "0");
  const offsetMinutes = String(Math.abs(offsetMinutesTotal) % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}

function ceilToNextHour(date) {
  const d = new Date(date);
  // pokud už je přesně na hodině, necháme; jinak posun na další hodinu
  if (d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0) {
    d.setHours(d.getHours() + 1);
  }
  d.setMinutes(0, 0, 0);
  return d;
}


async function getAccessToken() {
  requireEnv();

  const params = new URLSearchParams();
  params.append("client_id", IGLOO_CLIENT_ID || "");
  params.append("client_secret", IGLOO_CLIENT_SECRET || "");
  params.append("grant_type", "client_credentials");

  try {
    const res = await axios.post(TOKEN_URL, params.toString(), {
      httpsAgent: insecureHttpsAgent,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

    const token = res.data?.access_token;
    if (!token) throw new Error("V odpovědi není access_token");
    return token;
  } catch (err) {
    const details = err.response?.data || err.message || err;
    console.error("❌ getAccessToken error:", details);
    throw new Error(typeof details === "string" ? details : JSON.stringify(details));
  }
}

async function iglooPost(path, bodyObj) {
  const token = await getAccessToken();
  const url = `${API_BASE}${path}`;

  try {
    // Debug: co posíláme (bez tokenu)
    console.log("➡️ IGLOO POST", url, bodyObj);

    const res = await axios.post(url, bodyObj, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 20000,
    });
    return res.data;
  } catch (err) {
    const details = err.response?.data || err.message || err;
    console.error("❌ IGLOO POST error:", url, details);
    throw new Error(typeof details === "string" ? details : JSON.stringify(details));
  }
}

async function iglooGet(path) {
  const token = await getAccessToken();
  const url = `${API_BASE}${path}`;

  try {
    const res = await axios.get(url, {
      httpsAgent: insecureHttpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      timeout: 20000,
    });
    return res.data;
  } catch (err) {
    const details = err.response?.data || err.message || err;
    console.error("❌ IGLOO GET error:", url, details);
    throw new Error(typeof details === "string" ? details : JSON.stringify(details));
  }
}

async function getDevices() {
  return iglooGet("/devices");
}

async function createOneTimePin({ deviceId, startDate, accessName = "Reservation", variance = 1 }) {
  if (!deviceId) throw new Error("Chybí deviceId (ID zámku).");
  if (!startDate) throw new Error("Chybí startDate.");

  const body = {
    variance,
    startDate: formatDateIglooExact(startDate),
    accessName,
  };

  return iglooPost(`/devices/${deviceId}/algopin/onetime`, body);
}



async function createHourlyPin({ deviceId, startDate, endDate, accessName = "Reservation" }) {
  if (!deviceId) throw new Error("Chybí deviceId.");
  if (!startDate) throw new Error("Chybí startDate.");
  if (!endDate) throw new Error("Chybí endDate.");

 const startH = floorToHour(startDate);
const endH = ceilToNextHour(endDate);

const body = {
  variance: 1,
  startDate: formatDateIgloo(startH),
  endDate: formatDateIgloo(endH),
  accessName,
};


  return iglooPost(`/devices/${deviceId}/algopin/hourly`, body);
}

async function createDailyPin({ deviceId, startDate, accessName = "Reservation" }) {
  if (!deviceId) throw new Error("Chybí deviceId.");
  if (!startDate) throw new Error("Chybí startDate.");

  const body = {
    variance: 1,
    startDate: formatDateIgloo(startDate),
    accessName,
  };

  return iglooPost(`/devices/${deviceId}/algopin/daily`, body);
}

module.exports = {
  getDevices,
  createOneTimePin,
  createHourlyPin,
  createDailyPin,
  formatDateIgloo,
  formatDateIglooExact,
};

