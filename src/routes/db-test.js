const express = require("express");
const { knex } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const tables = await knex.raw(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    res.json({ ok: true, tables });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
