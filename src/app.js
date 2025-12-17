const express = require("express");

function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({ ok: true, app: "vleky3" });
  });

  return app;
}

module.exports = { createApp };
