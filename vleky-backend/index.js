// index.js

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { createHourlyPin, createDailyPin } = require("./services/iglooAccess");

const app = express();
const PORT = 3100;

const knexConfig = require("./db/knex");
const env = process.env.NODE_ENV || "development";
const knex = require("knex")(knexConfig[env]);

// --------- Upload fotek (multer) ---------

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// parsování JSONu z těla requestu
app.use(express.json());

// statické soubory
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

// -------------------- Upload endpoint --------------------

app.post("/api/upload", upload.single("photo"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ ok: true, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

// -------------------- Rezervace / PINy (Igloohome) --------------------

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
    const lock = await knex("locks")
      .where({ trailer_id: trailerId, active: 1 })
      .first();

    if (!lock) {
      return res.status(404).json({
        error: "K tomuto vleku není přiřazen aktivní zámek",
        trailerId,
      });
    }

    const deviceId = lock.device_id;

    // 2) Vytvoř PIN (stejná logika jako dřív)
    let type = "hourly";
    let pinResponse;

    const diffMs = end.getTime() - start.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diffMs <= oneDayMs) {
      type = "hourly";
      pinResponse = await createHourlyPin({
        deviceId,
        startDate: start,
        endDate: end,
        accessName: `Reservation ${reservationId}`,
      });
    } else {
      type = "daily";
      const startOfDay = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        0, 0, 0
      );

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
      pin: pinResponse.pin,
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
      deviceId,              // klidně pak schováme ve frontendu; pro debug je super
      pin: pinResponse.pin,
      pinId: pinResponse.pinId || null,
      startAt,
      endAt,
    });
  } catch (err) {
    const details = err.response?.data || err.message || err;
    console.error("❌ Error in /api/reservations/createPin:", details);

    return res.status(500).json({
      error: "Nepodařilo se vytvořit PIN",
      details,
    });
  }
});


// GET /api/reservations/:id/pin – načtení PINu z DB
app.get("/api/reservations/:id/pin", async (req, res) => {
  try {
    const { id } = req.params;

    const pinEntry = await knex("pins")
      .where({ reservationId: id })
      .whereNull("deletedAt")
      .first();

    if (!pinEntry) {
      return res.status(404).json({ error: "PIN pro tuto rezervaci nebyl nalezen." });
    }

    res.json(pinEntry);
  } catch (error) {
    console.error("Chyba při načítání PINu:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================
// RENTALS (půjčovny)
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

    // Adresy
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

    // Půjčovna
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

    return res.json({
      ...rental,
      billing_address: billing,
      pickup_address: pickup,
    });
  } catch (e) {
    console.error("Chyba v GET /api/rentals/:id:", e);
    return res.status(500).json({ error: "Server error" });
  }
});
// =======================
// LOCKS (zámky pro vleky)
// =======================

// Přidat / změnit zámek na vleku
// Body: { provider: "igloohome", device_id: "xxxx", name: "Zámek 1", active: true }
app.post('/api/trailers/:id/lock', async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: 'Neplatné trailer id' });

    const b = req.body || {};
    const provider = (b.provider || 'igloohome').toString();
    const deviceId = (b.device_id || '').toString().trim();
    const name = b.name ? String(b.name) : null;
    const active = (b.active === undefined) ? true : !!b.active;

    if (!deviceId) return res.status(400).json({ error: 'Chybí device_id' });

    // ověříme, že vlek existuje
    const trailer = await knex('trailers').where({ id: trailerId }).first();
    if (!trailer) return res.status(404).json({ error: 'Vlek nenalezen' });

    // UPSERT: pokud už lock pro trailer existuje -> update, jinak insert
    const existing = await knex('locks').where({ trailer_id: trailerId }).first();

    if (existing) {
      await knex('locks').where({ trailer_id: trailerId }).update({
        provider,
        device_id: deviceId,
        name,
        active,
        updated_at: knex.fn.now()
      });
    } else {
      await knex('locks').insert({
        trailer_id: trailerId,
        provider,
        device_id: deviceId,
        name,
        active
      });
    }

    const saved = await knex('locks').where({ trailer_id: trailerId }).first();
    return res.json({ ok: true, lock: saved });
  } catch (e) {
    // typicky narazíš na UNIQUE constraint (device_id už použitý jinde)
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Získat zámek vleku
app.get('/api/trailers/:id/lock', async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: 'Neplatné trailer id' });

    const lock = await knex('locks').where({ trailer_id: trailerId }).first();
    if (!lock) return res.status(404).json({ error: 'Zámek nepřiřazen' });

    return res.json(lock);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Odebrat zámek z vleku
app.delete('/api/trailers/:id/lock', async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: 'Neplatné trailer id' });

    const deleted = await knex('locks').where({ trailer_id: trailerId }).del();
    return res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// TRAILERS (vleky)
// =======================

// GET /trailers - seznam vleků
app.get('/trailers', async (req, res) => {
  try {
    const rows = await knex('trailers').select('*').orderBy('id', 'desc');

    // photos_json -> photos (pole)
    const data = rows.map(r => ({
      ...r,
      photos: r.photos_json ? JSON.parse(r.photos_json) : []
    }));

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /trailers - vytvořit vlek (JSON body)
app.post('/trailers', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || String(b.name).trim() === '') {
      return res.status(400).json({ error: 'Chybí name' });
    }

    const photos = Array.isArray(b.photos) ? b.photos : [];
    const [id] = await knex('trailers').insert({
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

      rental_id: b.rental_id ?? null
    });

    const created = await knex('trailers').where({ id }).first();
    res.json({
      ...created,
      photos: created.photos_json ? JSON.parse(created.photos_json) : []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// PUT /trailers/:id - upravit vlek
app.put('/trailers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID' });

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
      rental_id: b.rental_id
    };

    // vyhoď undefined hodnoty (aby se nepřepisovalo na null omylem)
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

    if (photos !== undefined) {
      patch.photos_json = JSON.stringify(photos);
    }

    await knex('trailers').where({ id }).update({ ...patch, updated_at: knex.fn.now() });

    const updated = await knex('trailers').where({ id }).first();
    if (!updated) return res.status(404).json({ error: 'Nenalezeno' });

    res.json({
      ...updated,
      photos: updated.photos_json ? JSON.parse(updated.photos_json) : []
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// DELETE /trailers/:id - smazat vlek
app.delete('/trailers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID' });

    const deleted = await knex('trailers').where({ id }).del();
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --------- Start serveru ---------
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
// ===============================
// PŘIŘAZENÍ ZÁMKU K VLEKU
// ===============================

