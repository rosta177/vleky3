// vleky-backend/services/iglooAccess.js
// --------------------------------------------
// 1) OAuth2 access token (client_credentials)
// 2) Get devices
// 3) Create algoPIN: onetime | hourly | daily
// --------------------------------------------

const axios = require("axios");
const https = require("https");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });


const {
  IGLOO_CLIENT_ID,
  IGLOO_CLIENT_SECRET,
  IGLOO_TOKEN_URL,
  IGLOO_API_BASE,
  IGLOO_INSECURE_TLS, // optional: "1" => ignore TLS errors (dev only)
  IGLOO_DEBUG,        // optional: "1" => log requests
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Igloohome chce: YYYY-MM-DDTHH:00:00+hh:mm (minuty/sekundy vždy 00)
function formatDateIglooHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);

  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hours = pad2(d.getHours());

  const offsetMinutesTotal = -d.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? "+" : "-";
  const offsetHours = pad2(Math.floor(Math.abs(offsetMinutesTotal) / 60));
  const offsetMinutes = pad2(Math.abs(offsetMinutesTotal) % 60);

  return `${year}-${month}-${day}T${hours}:00:00${sign}${offsetHours}:${offsetMinutes}`;
}

function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// „Další celá hodina“ (aby startDate nebyl v minulosti / probíhající hodině)
function ceilToNextHour(date) {
  const d = new Date(date);
  if (d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0) {
    d.setHours(d.getHours() + 1);
  }
  d.setMinutes(0, 0, 0);
  return d;
}

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const xi = Math.trunc(x);
  return Math.max(min, Math.min(max, xi));
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
    if (IGLOO_DEBUG === "1") {
      console.log("➡️ IGLOO POST", url, bodyObj);
    }

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

// ONETIME: u vás to evidentně vyžaduje startDate NA CELOU HODINU.
// Proto nepoužívat "Exact" s minutami -> invalid_request.
async function createOneTimePin({ deviceId, startDate, accessName = "Reservation", variance = 1 }) {
  if (!deviceId) throw new Error("Chybí deviceId (ID zámku).");
  if (!startDate) throw new Error("Chybí startDate.");

  // Igloo chce HH:00:00 a ideálně ne v minulosti -> vezmeme nejbližší další hodinu
  const startH = ceilToNextHour(startDate);

  const body = {
    variance: clampInt(variance, 1, 10, 1), // kdyby Igloo povolovalo jen 1..10; když víš přesně, dej 1..5
    startDate: formatDateIglooHour(startH),
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
    startDate: formatDateIglooHour(startH),
    endDate: formatDateIglooHour(endH),
    accessName,
  };

  return iglooPost(`/devices/${deviceId}/algopin/hourly`, body);
}

async function createDailyPin({ deviceId, startDate, accessName = "Reservation" }) {
  if (!deviceId) throw new Error("Chybí deviceId.");
  if (!startDate) throw new Error("Chybí startDate.");

  const startH = floorToHour(startDate);

  const body = {
    variance: 1,
    startDate: formatDateIglooHour(startH),
    accessName,
  };

  return iglooPost(`/devices/${deviceId}/algopin/daily`, body);
}

module.exports = {
  getDevices,
  createOneTimePin,
  createHourlyPin,
  createDailyPin,

  // export helperů pro debug / jiné soubory (volitelné)
  formatDateIglooHour,
  floorToHour,
  ceilToNextHour,
};
