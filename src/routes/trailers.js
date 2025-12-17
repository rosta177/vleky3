const express = require("express");
const { knex } = require("../db");

const router = express.Router();

// helper: photos_json -> photos[]
function mapTrailer(row) {
  if (!row) return row;
  let photos = [];
  try {
    photos = row.photos_json ? JSON.parse(row.photos_json) : [];
  } catch {
    photos = [];
  }
  const { photos_json, ...rest } = row;
  return { ...rest, photos };
}

// GET /api/trailers
router.get("/", async (req, res) => {
  try {
    const rows = await knex("trailers").select("*").orderBy("id", "desc");
    res.json(rows.map(mapTrailer));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trailers
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || String(b.name).trim() === "") {
      return res.status(400).json({ error: "Chybí name" });
    }

    const photos = Array.isArray(b.photos) ? b.photos : [];

    // SQLite + knex: insert() vrací pole id (většinou)
    const inserted = await knex("trailers").insert({
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

    const id = Array.isArray(inserted) ? inserted[0] : inserted;

    const created = await knex("trailers").where({ id }).first();
    res.json(mapTrailer(created));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

// PUT /api/trailers/:id
router.put("/:id", async (req, res) => {
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
      rental_id: b.rental_id
    };

    // vyhoď undefined hodnoty
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    if (photos !== undefined) {
      patch.photos_json = JSON.stringify(photos);
    }

    await knex("trailers").where({ id }).update({
      ...patch,
      updated_at: knex.fn.now()
    });

    const updated = await knex("trailers").where({ id }).first();
    if (!updated) return res.status(404).json({ error: "Nenalezeno" });

    res.json(mapTrailer(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

// DELETE /api/trailers/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Neplatné ID" });

    const deleted = await knex("trailers").where({ id }).del();
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
