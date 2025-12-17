require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({ ok: true, app: "vleky3" });
});

app.listen(PORT, () => {
  console.log(`vleky3 běží na http://localhost:${PORT}`);
});
