// index.js (opraveno)
// - reverse: kontrola MAPY_API_KEY + log + validace + akceptuje lon i lng
// - reverse: používá lon=... (ne lng) v requestu na Mapy
// - igloo/devices: odstraněno duplicitní dotenv (už je nahoře)
// - drobnosti: bezpečnější host/protocol (fallback), lepší error výpis

const express = require("express");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");

const {
  createHourlyPin,
  createDailyPin,
  createOneTimePin,
} = require("./services/iglooAccess");

const knexConfig = require("./db/knex");
const env = process.env.NODE_ENV || "development";
const knex = require("knex")(knexConfig[env]);

const app = express();
const PORT = 3100;

// =======================
// MIDDLEWARE
// =======================

// JSON body
app.use(express.json());

// CORS (frontend dev server)
app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Static files
app.use(express.static(path.join(__dirname, "public")));

// =======================
// HELPERS
// =======================

function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function randomPin(len = 6) {
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

// =======================
// UPLOADS (multer)
// =======================

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.post("/api/upload", upload.single("photo"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    return res.json({
      ok: true,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// =======================
// HEALTH (debug)
// =======================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, env, time: new Date().toISOString() });
});

// =======================
// MAPY.COM TILES PROXY (Leaflet)
// =======================

const MAPY_API_KEY = process.env.MAPY_API_KEY;

// Cache pro tile URL šablonu (abychom nevolali tiles.json pořád dokola)
const mapyTileTemplateCache = new Map();
// key: `${mapset}|${tileSize}|${lang}` -> { template: string, expiresAt: number }

async function getMapyTileTemplate({ mapset, tileSize, lang }) {
  const key = `${mapset}|${tileSize}|${lang}`;
  const now = Date.now();

  const cached = mapyTileTemplateCache.get(key);
  if (cached && cached.expiresAt > now) return cached.template;

  if (!MAPY_API_KEY) {
    throw new Error("Chybí MAPY_API_KEY v vleky-backend/.env");
  }

  const tilejsonUrl =
    `https://api.mapy.com/v1/maptiles/${encodeURIComponent(mapset)}/tiles.json` +
    `?apikey=${encodeURIComponent(MAPY_API_KEY)}` +
    `&tileSize=${encodeURIComponent(tileSize)}` +
    `&lang=${encodeURIComponent(lang)}`;

  const r = await fetch(tilejsonUrl);
  if (!r.ok) throw new Error(`Mapy tiles.json selhalo: HTTP ${r.status}`);
  const j = await r.json();

  const template = j?.tiles?.[0];
  if (!template) throw new Error("tiles.json nevrátilo tiles[0] template");

  // cache na 10 minut
  mapyTileTemplateCache.set(key, { template, expiresAt: now + 10 * 60 * 1000 });
  return template;
}

// =======================
// MAPY.COM GEOCODE / REVERSE (proxy, klíč zůstává v backendu)
// =======================

app.get("/api/mapy/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Chybí parametr q" });
    if (!MAPY_API_KEY) return res.status(500).json({ error: "Chybí MAPY_API_KEY v .env" });

    const url =
      `https://api.mapy.com/v1/geocode?` +
      `query=${encodeURIComponent(q)}` +
      `&lang=cs` +
      `&limit=5` +
      `&apikey=${encodeURIComponent(MAPY_API_KEY)}`;

    const r = await fetch(url);
    const raw = await r.json().catch(() => null);
    if (!r.ok) return res.status(502).json({ error: "Mapy geocode failed", status: r.status, data: raw });

    const items = Array.isArray(raw?.items) ? raw.items : [];
    const out = items
      .map((it) => {
        const label = it?.name || it?.label || it?.formatted || it?.locality?.name || null;
        const lat = it?.position?.lat ?? it?.lat ?? null;
        const lon = it?.position?.lon ?? it?.lon ?? it?.lng ?? null;
        if (label && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
          return { label: String(label), lat: Number(lat), lon: Number(lon) };
        }
        return null;
      })
      .filter(Boolean);

    return res.json({ items: out });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Geocode error" });
  }
});

app.get("/api/mapy/reverse", async (req, res) => {
  try {
    if (!MAPY_API_KEY) return res.status(500).json({ error: "Chybí MAPY_API_KEY v .env" });

    const latRaw = String(req.query.lat ?? "").trim().replace(",", ".");
    const lonRaw = String(req.query.lon ?? req.query.lng ?? "").trim().replace(",", ".");

    const lat = Number(latRaw);
    const lon = Number(lonRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "Chybí nebo je špatně lat/lon", latRaw, lonRaw });
    }

    const qs = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      lang: "cs",
      apikey: MAPY_API_KEY,
    });

    const url = `https://api.mapy.com/v1/rgeocode?${qs.toString()}`;

    const r = await fetch(url);
    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(502).json({ error: "Mapy reverse geocode failed", status: r.status, url, data });
    }

    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Reverse geocode error" });
  }
});




// TileJSON bez klíče (tiles přepíšeme na naši proxy URL)
app.get("/api/mapy/tilejson/:mapset", async (req, res) => {
  try {
    const mapset = String(req.params.mapset || "basic");
    const tileSize = String(req.query.tileSize || "256");
    const lang = String(req.query.lang || "cs");

    if (!MAPY_API_KEY) return res.status(500).json({ error: "Chybí MAPY_API_KEY v .env" });

    const tilejsonUrl =
      `https://api.mapy.com/v1/maptiles/${encodeURIComponent(mapset)}/tiles.json` +
      `?apikey=${encodeURIComponent(MAPY_API_KEY)}` +
      `&tileSize=${encodeURIComponent(tileSize)}` +
      `&lang=${encodeURIComponent(lang)}`;

    const r = await fetch(tilejsonUrl);
    if (!r.ok) return res.status(502).json({ error: `Mapy tiles.json HTTP ${r.status}` });

    const j = await r.json();

    const host = req.get("host");
    const proto = req.headers["x-forwarded-proto"] || req.protocol;

    // přepiš tiles na naši proxy cestu (bez API klíče ve frontendu)
    j.tiles = [
      `${proto}://${host}/api/mapy/tiles/${encodeURIComponent(mapset)}/{z}/{x}/{y}.png?tileSize=${encodeURIComponent(
        tileSize
      )}&lang=${encodeURIComponent(lang)}`
    ];

    res.set("Cache-Control", "public, max-age=600");
    return res.json(j);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Mapy tilejson error" });
  }
});

// Proxy dlaždic
app.get("/api/mapy/tiles/:mapset/:z/:x/:y.png", async (req, res) => {
  try {
    const mapset = String(req.params.mapset || "basic");
    const z = String(req.params.z);
    const x = String(req.params.x);
    const y = String(req.params.y);
    const tileSize = String(req.query.tileSize || "256");
    const lang = String(req.query.lang || "cs");

    const template = await getMapyTileTemplate({ mapset, tileSize, lang });
    const tileUrl = template.replace("{z}", z).replace("{x}", x).replace("{y}", y);

    const r = await fetch(tileUrl);
    if (!r.ok) return res.status(502).send(`Tile fetch failed: HTTP ${r.status}`);

    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.set("Cache-Control", "public, max-age=86400");

    const buf = Buffer.from(await r.arrayBuffer());
    return res.send(buf);
  } catch (e) {
    return res.status(500).send(e?.message || "Mapy tile proxy error");
  }
});

// =======================
// RESERVATIONS / PINY
// =======================

// Vytvoření PINu podle rezervace
app.post("/api/reservations/createPin", async (req, res) => {
  try {
    const { reservationId, trailerId, startAt, endAt } = req.body;

    if (!trailerId || !startAt || !endAt) {
      return res.status(400).json({ error: "Chybí trailerId, startAt nebo endAt" });
    }
    if (!reservationId) {
      return res.status(400).json({ error: "Chybí reservationId" });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Špatný formát datumu" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "endAt musí být po startAt" });
    }

    // 1) Najdi aktivní zámek přiřazený k vleku
    const lock = await knex("locks").where({ trailer_id: trailerId, active: 1 }).first();
    if (!lock) {
      return res.status(404).json({
        error: "K tomuto vleku není přiřazen aktivní zámek",
        trailerId,
      });
    }
    const deviceId = lock.device_id;

    // 2) Vytvoř PIN
    let type = "hourly";
    let pinResponse;

    const diffMs = end.getTime() - start.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diffMs <= oneDayMs) {
      type = "hourly";
      try {
        pinResponse = await createHourlyPin({
          deviceId,
          startDate: start,
          endDate: end,
          accessName: `Reservation ${reservationId}`,
        });
      } catch (e) {
        console.warn("⚠️ createPin: Igloo unavailable, using MOCK pin");
        pinResponse = { pin: randomPin(6), pinId: null, mock: true };
      }
    } else {
      type = "daily";
      const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
      pinResponse = await createDailyPin({
        deviceId,
        startDate: startOfDay,
        accessName: `Reservation ${reservationId}`,
      });
    }

    // 3) Ulož PIN do DB (pins)
    await knex("pins").insert({
      reservationId,
      deviceId,
      pin: String(pinResponse.pin),
      pinId: pinResponse.pinId || null,
      type,
      startAt: start,
      endAt: end,
    });

    return res.json({
      success: true,
      type,
      reservationId,
      trailerId,
      deviceId,
      pin: String(pinResponse.pin),
      pinId: pinResponse.pinId || null,
      startAt,
      endAt,
    });
  } catch (err) {
    const details = err?.response?.data || err?.message || err;
    console.error("❌ Error in /api/reservations/createPin:", details);
    return res.status(500).json({ error: "Nepodařilo se vytvořit PIN", details });
  }
});

// POST /api/reservations/:id/refreshPin
app.post("/api/reservations/:id/refreshPin", async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    const trailerId = Number(req.body?.trailerId);

    if (!reservationId) return res.status(400).json({ error: "Neplatné reservationId" });
    if (!trailerId) return res.status(400).json({ error: "Chybí trailerId" });

    const minutes = Number(req.body?.windowMinutes || process.env.PIN_WINDOW_MINUTES || 5);
    const windowMin = Number.isFinite(minutes) && minutes > 0 ? minutes : 5;

    const lock = await knex("locks").where({ trailer_id: trailerId, active: 1 }).first();
    if (!lock) {
      return res.status(404).json({
        error: "K tomuto vleku není přiřazen aktivní zámek",
        trailerId,
      });
    }
    const deviceId = lock.device_id;

    const prev = await knex("pins")
      .where({ reservationId })
      .whereNull("deletedAt")
      .orderBy("id", "desc")
      .first();

    const prevPin = prev?.pin || null;

    await knex("pins")
      .where({ reservationId })
      .whereNull("deletedAt")
      .update({ deletedAt: knex.fn.now() });

    const start = new Date();
    const end = new Date(start.getTime() + windowMin * 60 * 1000);

    const iglooStart = floorToHour(start);
    const variance = 1 + Math.floor(Math.random() * 5);

    let pinResponse;
    let attempts = 0;

    while (attempts < 5) {
      attempts++;
      try {
        pinResponse = await createOneTimePin({
          deviceId,
          startDate: iglooStart,
          accessName: `Reservation ${reservationId} (refresh ${Date.now()} #${attempts})`,
          variance,
        });
      } catch (e) {
        console.warn("⚠️ Igloo unavailable, using MOCK pin fallback");
        pinResponse = { pin: randomPin(6), pinId: null, mock: true };
      }

      if (!prevPin || String(pinResponse.pin) !== String(prevPin)) break;
    }

    if (prevPin && String(pinResponse.pin) === String(prevPin)) {
      return res.status(500).json({
        error: "Nepodařilo se vygenerovat nový PIN (opakovaně stejný jako předchozí)",
      });
    }

    await knex("pins").insert({
      reservationId,
      deviceId,
      pin: String(pinResponse.pin),
      pinId: pinResponse.pinId || null,
      type: "onetime",
      startAt: start,
      endAt: end,
      deletedAt: null,
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      reservationId,
      trailerId,
      deviceId,
      pin: String(pinResponse.pin),
      pinId: pinResponse.pinId || null,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      previousPin: prevPin,
      changed: prevPin ? String(prevPin) !== String(pinResponse.pin) : true,
    });
  } catch (err) {
    const details = err?.response?.data || err?.message || err;
    console.error("❌ Error in /api/reservations/:id/refreshPin:", details);
    return res.status(500).json({ error: "Nepodařilo se obnovit PIN", details });
  }
});

// GET /api/reservations/:id/pin
app.get("/api/reservations/:id/pin", async (req, res) => {
  try {
    const { id } = req.params;

    const pinEntry = await knex("pins")
      .where({ reservationId: id })
      .whereNull("deletedAt")
      .orderBy("id", "desc")
      .first();

    if (!pinEntry) return res.status(404).json({ error: "PIN pro tuto rezervaci nebyl nalezen." });

    return res.json(pinEntry);
  } catch (error) {
    console.error("Chyba při načítání PINu:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// =======================
// RENTALS
// =======================

app.post("/api/rentals", async (req, res) => {
  try {
    const b = req.body || {};

    const required = ["first_name", "last_name", "email", "phone", "name", "slug"];
    for (const k of required) {
      if (!b[k] || String(b[k]).trim() === "") {
        return res.status(400).json({ error: `Chybí pole: ${k}` });
      }
    }

    if (!b.billing_address || !b.pickup_address) {
      return res.status(400).json({ error: "Chybí billing_address nebo pickup_address" });
    }

    const [billingId] = await knex("addresses").insert({
      line1: b.billing_address.line1,
      line2: b.billing_address.line2 || null,
      city: b.billing_address.city,
      zip: b.billing_address.zip,
      country: b.billing_address.country || "CZ",
    });

    const [pickupId] = await knex("addresses").insert({
      line1: b.pickup_address.line1,
      line2: b.pickup_address.line2 || null,
      city: b.pickup_address.city,
      zip: b.pickup_address.zip,
      country: b.pickup_address.country || "CZ",
    });

    const [rentalId] = await knex("rentals").insert({
      first_name: b.first_name,
      last_name: b.last_name,
      email: b.email,
      phone: b.phone,
      ico: b.ico || null,
      dic: b.dic || null,
      name: b.name,
      slug: b.slug,
      billing_address_id: billingId,
      pickup_address_id: pickupId,
      payout_account_iban: b.payout_account_iban || null,
      payout_account_local: b.payout_account_local || null,
      payout_account_name: b.payout_account_name || null,
    });

    return res.json({ ok: true, rental_id: rentalId });
  } catch (e) {
    console.error("Chyba v POST /api/rentals:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/rentals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Neplatné ID" });

    const rental = await knex("rentals").where({ id }).first();
    if (!rental) return res.status(404).json({ error: "Nenalezeno" });

    const billing = rental.billing_address_id
      ? await knex("addresses").where({ id: rental.billing_address_id }).first()
      : null;

    const pickup = rental.pickup_address_id
      ? await knex("addresses").where({ id: rental.pickup_address_id }).first()
      : null;

    return res.json({ ...rental, billing_address: billing, pickup_address: pickup });
  } catch (e) {
    console.error("Chyba v GET /api/rentals/:id:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// =======================
// LOCKS
// =======================

// Přidat / změnit zámek na vleku
// Body: { provider: "igloohome", device_id: "xxxx", name: "Zámek 1", active: true, force?: true }
app.post("/api/trailers/:id/lock", async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: "Neplatné trailer id" });

    const b = req.body || {};
    const provider = (b.provider || "igloohome").toString();
    const deviceId = (b.device_id || "").toString().trim();
    const name = b.name ? String(b.name) : null;
    const active = (b.active === undefined) ? true : !!b.active;
    const force = !!b.force; // <-- POTVRZENÍ PŘESUNU Z UI

    if (!deviceId) return res.status(400).json({ error: "Chybí device_id" });

    // ověříme, že vlek existuje
    const trailer = await knex("trailers").where({ id: trailerId }).first();
    if (!trailer) return res.status(404).json({ error: "Vlek nenalezen" });

    // 1) Je tenhle device už přiřazený někde jinde?
    const byDevice = await knex("locks")
      .where({ provider, device_id: deviceId })
      .first();

    // Pokud device existuje a patří jinému vleku a není force -> vrať 409 + info
    if (byDevice && Number(byDevice.trailer_id) !== trailerId && !force) {
      const otherTrailer = await knex("trailers")
        .where({ id: byDevice.trailer_id })
        .first();

      return res.status(409).json({
        error: "LOCK_ALREADY_ASSIGNED",
        device_id: deviceId,
        provider,
        currentTrailer: otherTrailer
          ? { id: otherTrailer.id, name: otherTrailer.name }
          : { id: byDevice.trailer_id, name: null },
      });
    }

    // 2) Pokud device existuje a force=true -> PŘESUN
    if (byDevice && Number(byDevice.trailer_id) !== trailerId && force) {
      // zajistíme 1 trailer -> max 1 lock: smaž případný jiný lock na cílovém traileru
      await knex("locks")
        .where({ trailer_id: trailerId })
        .whereNot({ id: byDevice.id })
        .del();

      // přepoj device na tento trailer
      await knex("locks")
        .where({ id: byDevice.id })
        .update({
          trailer_id: trailerId,
          name,
          active,
          updated_at: knex.fn.now(),
        });

      const saved = await knex("locks").where({ id: byDevice.id }).first();
      return res.json({ ok: true, lock: saved, moved: true });
    }

    // 3) Standardní upsert (device neexistuje, nebo už patří tomuhle traileru)
    const existing = await knex("locks").where({ trailer_id: trailerId }).first();

    if (existing) {
      await knex("locks").where({ trailer_id: trailerId }).update({
        provider,
        device_id: deviceId,
        name,
        active,
        updated_at: knex.fn.now(),
      });
    } else {
      await knex("locks").insert({
        trailer_id: trailerId,
        provider,
        device_id: deviceId,
        name,
        active,
      });
    }

    const saved = await knex("locks").where({ trailer_id: trailerId }).first();
    return res.json({ ok: true, lock: saved, moved: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
});

app.get("/api/trailers/:id/lock", async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: "Neplatné trailer id" });

    const lock = await knex("locks").where({ trailer_id: trailerId }).first();
    if (!lock) return res.status(404).json({ error: "Zámek nepřiřazen" });

    return res.json(lock);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/trailers/:id/lock", async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: "Neplatné trailer id" });

    const deleted = await knex("locks").where({ trailer_id: trailerId }).del();
    return res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

// =======================
// TRAILERS
// =======================

// GET /trailers - seznam vleků
app.get("/trailers", async (req, res) => {
  try {
    const rows = await knex("trailers").select("*").orderBy("id", "desc");
    const data = rows.map((r) => ({ ...r, photos: r.photos_json ? JSON.parse(r.photos_json) : [] }));
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /trailers/:id - detail vleku
app.get("/trailers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Neplatné ID" });

    const row = await knex("trailers").where({ id }).first();
    if (!row) return res.status(404).json({ error: "Nenalezeno" });

    return res.json({ ...row, photos: row.photos_json ? JSON.parse(row.photos_json) : [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /trailers
app.post("/trailers", async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || String(b.name).trim() === "") {
      return res.status(400).json({ error: "Chybí name" });
    }

    const photos = Array.isArray(b.photos) ? b.photos : [];
    const [id] = await knex("trailers").insert({
      name: b.name,
      total_weight_kg: b.total_weight_kg ?? b.totalWeightKg ?? null,
      payload_kg: b.payload_kg ?? b.payloadKg ?? null,
      bed_width_m: b.bed_width_m ?? b.bedWidthM ?? null,
      bed_length_m: b.bed_length_m ?? b.bedLengthM ?? null,
      cover: b.cover ?? null,
      location: b.location ?? null,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
      price_per_day_czk: b.price_per_day_czk ?? b.pricePerDay ?? null,
      owner_name: b.owner_name ?? b.owner ?? null,
      description: b.description ?? null,
      photos_json: JSON.stringify(photos),
      rental_id: b.rental_id ?? null,
    });

    const created = await knex("trailers").where({ id }).first();
    return res.json({ ...created, photos: created.photos_json ? JSON.parse(created.photos_json) : [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
});

// PUT /trailers/:id
app.put("/trailers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Neplatné ID" });

    const b = req.body || {};
    const photos = Array.isArray(b.photos) ? b.photos : undefined;

    const patch = {
      name: b.name,
      total_weight_kg: b.total_weight_kg ?? b.totalWeightKg,
      payload_kg: b.payload_kg ?? b.payloadKg,
      bed_width_m: b.bed_width_m ?? b.bedWidthM,
      bed_length_m: b.bed_length_m ?? b.bedLengthM,
      cover: b.cover,
      location: b.location,
      lat: b.lat,
      lng: b.lng,
      price_per_day_czk: b.price_per_day_czk ?? b.pricePerDay,
      owner_name: b.owner_name ?? b.owner,
      description: b.description,
      rental_id: b.rental_id,
    };

    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    if (photos !== undefined) {
      patch.photos_json = JSON.stringify(photos);
    }

    await knex("trailers").where({ id }).update({ ...patch, updated_at: knex.fn.now() });

    const updated = await knex("trailers").where({ id }).first();
    if (!updated) return res.status(404).json({ error: "Nenalezeno" });

    return res.json({ ...updated, photos: updated.photos_json ? JSON.parse(updated.photos_json) : [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
});

// DELETE /trailers/:id
app.delete("/trailers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Neplatné ID" });

    const deleted = await knex("trailers").where({ id }).del();
    return res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

// =======================
// IGLOO debug: list devices
// =======================
app.get("/api/igloo/devices", async (req, res) => {
  try {
    const axios = require("axios");
    const https = require("https");

    const {
      IGLOO_CLIENT_ID,
      IGLOO_CLIENT_SECRET,
      IGLOO_TOKEN_URL,
      IGLOO_API_BASE,
      IGLOO_INSECURE_TLS,
    } = process.env;

    const TOKEN_URL = IGLOO_TOKEN_URL || "https://auth.igloohome.co/oauth2/token";
    const API_BASE = IGLOO_API_BASE || "https://api.igloodeveloper.co/igloohome";

    if (!IGLOO_CLIENT_ID || !IGLOO_CLIENT_SECRET) {
      return res.status(400).json({ error: "Chybí IGLOO_CLIENT_ID / IGLOO_CLIENT_SECRET v .env" });
    }

    const insecureHttpsAgent = new https.Agent({
      rejectUnauthorized: IGLOO_INSECURE_TLS === "1" ? false : true,
    });

    // 1) token
    const tokenResp = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: IGLOO_CLIENT_ID,
        client_secret: IGLOO_CLIENT_SECRET,
      }),
      { httpsAgent: insecureHttpsAgent }
    );

    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) return res.status(500).json({ error: "Token response missing access_token", tokenResp: tokenResp.data });

    // 2) devices
    const devResp = await axios.get(`${API_BASE}/devices`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      httpsAgent: insecureHttpsAgent,
    });

    return res.json(devResp.data);
  } catch (e) {
    const details = e?.response?.data || e?.message || e;
    console.error("igloo devices error:", details);
    return res.status(500).json({ error: "Nepodařilo se načíst devices", details });
  }
});

// =======================
// START
// =======================
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});

