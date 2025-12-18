const express = require("express");
const { knex } = require("../db");
const { createHourlyPin, createDailyPin } = require("../../vleky-backend/services/iglooAccess");

const router = express.Router();

// POST /api/reservations/createPin
router.post("/reservations/createPin", async (req, res) => {
  try {
    const { reservationId, trailerId, startAt, endAt } = req.body;

    if (!reservationId || !trailerId || !startAt || !endAt) {
      return res.status(400).json({ error: "Chybí reservationId, trailerId, startAt nebo endAt" });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ error: "Neplatný časový rozsah" });
    }

    // aktivní zámek k vleku
    const lock = await knex("locks")
      .where({ trailer_id: trailerId, active: 1 })
      .first();

    if (!lock) {
      return res.status(404).json({ error: "K vleku není přiřazen aktivní zámek" });
    }

    const diffMs = end.getTime() - start.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let type = "hourly";
    let pinResponse;

    if (diffMs <= oneDayMs) {
      pinResponse = await createHourlyPin({
        deviceId: lock.device_id,
        startDate: start,
        endDate: end,
        accessName: `Reservation ${reservationId}`,
      });
    } else {
      type = "daily";
      const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      pinResponse = await createDailyPin({
        deviceId: lock.device_id,
        startDate: startOfDay,
        accessName: `Reservation ${reservationId}`,
      });
    }

    await knex("pins").insert({
      reservationId,
      deviceId: lock.device_id,
      pin: pinResponse.pin,
      pinId: pinResponse.pinId || null,
      type,
      startAt: start,
      endAt: end,
    });

    res.json({
      ok: true,
      reservationId,
      trailerId,
      deviceId: lock.device_id,
      type,
      pin: pinResponse.pin,
      startAt,
      endAt,
    });
  } catch (e) {
    const details = e.response?.data || e.message || e;
console.error("Igloo error:", details);
res.status(500).json({ error: "Nepodařilo se vytvořit PIN", details });
  }
});

// GET /api/reservations/:id/pin
router.get("/reservations/:id/pin", async (req, res) => {
  try {
    const { id } = req.params;

    const pin = await knex("pins")
      .where({ reservationId: id })
      .whereNull("deletedAt")
      .first();

    if (!pin) return res.status(404).json({ error: "PIN nenalezen" });

    res.json(pin);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
