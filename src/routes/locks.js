const express = require("express");
const { knex } = require("../db");

const router = express.Router();

// POST /api/trailers/:id/lock
router.post("/trailers/:id/lock", async (req, res) => {
  try {
    const trailerId = Number(req.params.id);
    if (!trailerId) return res.status(400).json({ error: "Neplatné trailer id" });

    const b = req.body || {};
    const provider = (b.provider || "igloohome").toString();
    const deviceId = (b.device_id || "").toString().trim();
    const name = b.name ? String(b.name) : null;
    const active = (b.active === undefined) ? true : !!b.active;

    if (!deviceId) return res.status(400).json({ error: "Chybí device_id" });

    // ověříme, že vlek existuje
    const trailer = await knex("trailers").where({ id: trailerId }).first();
    if (!trailer) return res.status(404).json({ error: "Vlek nenalezen" });

    // UPSERT (podle trailer_id)
    const existing = await knex("locks").where({ trailer_id: trailerId }).first();

    if (existing) {
      await knex("locks").where({ trailer_id: trailerId }).update({
        provider,
        device_id: deviceId,
        name,
        active,
        updated_at: knex.fn.now()
      });
    } else {
      await knex("locks").insert({
        trailer_id: trailerId,
        provider,
        device_id: deviceId,
        name,
        active
      });
    }

    const saved = await knex("locks").where({ trailer_id: trailerId }).first();
    return res.json({ ok: true, lock: saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
});

// GET /api/trailers/:id/lock
router.get("/trailers/:id/lock", async (req, res) => {
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

// DELETE /api/trailers/:id/lock
router.delete("/trailers/:id/lock", async (req, res) => {
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

module.exports = router;
