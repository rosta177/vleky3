// src/routes/reservations.js

const express = require("express");
const { knex } = require("../db");
const { createOneTimePin } = require("../../vleky-backend/services/iglooAccess");

const router = express.Router();

// ====== CONFIG ======
function pinWindowMinutes() {
  const n = Number(process.env.PIN_WINDOW_MINUTES || 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

// Igloohome u vás vyžaduje startDate ve formátu YYYY-MM-DDTHH:00:00+hh:mm,
// takže to posíláme zaokrouhlené na celou hodinu.
function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// ===== helper: najdi aktivní zámek k vleku =====
async function getActiveLockDeviceId(trailerId) {
  const id = Number(trailerId);
  if (!id) {
    const err = new Error("Neplatné trailerId");
    err.status = 400;
    throw err;
  }

  const lock = await knex("locks")
    .where({ trailer_id: id, active: 1 })
    .first();

  if (!lock) {
    const err = new Error("K vleku není přiřazen aktivní zámek");
    err.status = 404;
    throw err;
  }

  return lock.device_id;
}

// ===== helper: zneplatni všechny staré PINy pro rezervaci =====
async function softDeletePinsForReservation(reservationId) {
  await knex("pins")
    .where({ reservationId })
    .whereNull("deletedAt")
    .update({ deletedAt: knex.fn.now() });
}

// ===============================
// POST /api/reservations/createPin
// body: { reservationId, trailerId, startAt? }
// - vytvoří ONETIME pin na PIN_WINDOW_MINUTES
// - startAt je volitelné; když není, použije "teď"
// ===============================
router.post("/reservations/createPin", async (req, res) => {
  try {
    const { reservationId, trailerId } = req.body || {};
    const rid = Number(reservationId);
    const tid = Number(trailerId);

    if (!rid || !tid) {
      return res.status(400).json({ error: "Chybí reservationId nebo trailerId" });
    }

    const deviceId = await getActiveLockDeviceId(tid);
    const minutes = pinWindowMinutes();

    // startAt = reálný začátek okna (pro naši expiraci)
    const startRaw = req.body.startAt ? new Date(req.body.startAt) : new Date();
    if (isNaN(startRaw.getTime())) {
      return res.status(400).json({ error: "Neplatné startAt" });
    }

    const endRaw = new Date(startRaw.getTime() + minutes * 60 * 1000);

    // Igloohome startDate musí být na celé hodině
    const iglooStart = floorToHour(startRaw);

    // mít aktivní vždy jen 1 pin na rezervaci
    await softDeletePinsForReservation(rid);

    const variance = 1 + Math.floor(Math.random() * 5); // 1..5
    const pinResponse = await createOneTimePin({
      deviceId,
      startDate: iglooStart,
      accessName: `Reservation ${rid} (${Date.now()})`,
      variance,
    });

    await knex("pins").insert({
      reservationId: rid,
      deviceId,
      pin: pinResponse.pin,
      pinId: pinResponse.pinId || null,
      type: "onetime",
      startAt: startRaw.getTime(),
      endAt: endRaw.getTime(),
      deletedAt: null,
    });

    return res.json({
      ok: true,
      reservationId: rid,
      trailerId: tid,
      deviceId,
      type: "onetime",
      pin: pinResponse.pin,
      startAt: startRaw.toISOString(),
      endAt: endRaw.toISOString(),
    });
  } catch (e) {
    const status = e.status || 500;
    const details = e.response?.data || e.message || e;
    console.error("Igloo createPin error:", details);
    return res.status(status).json({ error: "Nepodařilo se vytvořit PIN", details });
  }
});

// ===============================
// POST /api/reservations/:id/refreshPin
// body: { trailerId }
// - vytvoří nový ONETIME pin na PIN_WINDOW_MINUTES od teď
// - zneplatní předchozí piny (deletedAt)
// ===============================
router.post("/reservations/:id/refreshPin", async (req, res) => {
  try {
    const rid = Number(req.params.id);
    if (!rid) return res.status(400).json({ error: "Neplatné reservationId" });

    const tid = Number(req.body?.trailerId);
    if (!tid) return res.status(400).json({ error: "Chybí trailerId" });

    const deviceId = await getActiveLockDeviceId(tid);
    const minutes = pinWindowMinutes();

    const startRaw = new Date();
    const endRaw = new Date(startRaw.getTime() + minutes * 60 * 1000);
    const iglooStart = floorToHour(startRaw);

    

    await softDeletePinsForReservation(rid);

    const variance = 1 + Math.floor(Math.random() * 5); // 1..5
    const pinResponse = await createOneTimePin({
      deviceId,
      startDate: iglooStart,
      accessName: `Reservation ${rid} (refresh ${Date.now()})`,
      variance,
    });

    
    await knex("pins").insert({
      reservationId: rid,
      deviceId,
      pin: pinResponse.pin,
      pinId: pinResponse.pinId || null,
      type: "onetime",
      startAt: startRaw.getTime(),
      endAt: endRaw.getTime(),
      deletedAt: null,
    });

    return res.json({
      ok: true,
      reservationId: rid,
      trailerId: tid,
      deviceId,
      type: "onetime",
      pin: pinResponse.pin,
      startAt: startRaw.toISOString(),
      endAt: endRaw.toISOString(),
    });
  } catch (e) {
    const status = e.status || 500;
    const details = e.response?.data || e.message || e;
    console.error("Igloo refreshPin error:", details);
    return res.status(status).json({ error: "Nepodařilo se obnovit PIN", details });
  }
});

// ===============================
// GET /api/reservations/:id/pin
// - vrátí poslední aktivní PIN (deletedAt IS NULL)
// - hlídá okno startAt/endAt (v ms)
// ===============================
router.get("/reservations/:id/pin", async (req, res) => {
  try {
    const rid = Number(req.params.id);
    if (!rid) return res.status(400).json({ error: "Neplatné reservationId" });

    const pinRow = await knex("pins")
      .where({ reservationId: rid })
      .whereNull("deletedAt")
      .orderBy("id", "desc")
      .first();

    if (!pinRow) return res.status(404).json({ error: "PIN nenalezen" });

    const now = Date.now();
    const startMs = Number(pinRow.startAt);
    const endMs = Number(pinRow.endAt);

    if (startMs && now < startMs) {
      return res.status(403).json({ ok: false, error: "PIN bude dostupný až od startu" });
    }
    if (endMs && now > endMs) {
      return res.status(403).json({ ok: false, error: "PIN už expiroval" });
    }

    return res.json({
      ok: true,
      reservationId: pinRow.reservationId,
      trailerId: null, // vazbu reservation->trailer řešíme později
      deviceId: pinRow.deviceId,
      pin: pinRow.pin,
      type: pinRow.type,
      startAt: startMs ? new Date(startMs).toISOString() : null,
      endAt: endMs ? new Date(endMs).toISOString() : null,
    });
  } catch (e) {
    console.error("getPin error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
