const express = require("express");
const path = require("path");

const uploadRouter = require("./routes/upload");

function createApp() {
  const app = express();

  app.use(express.json());

  // statické soubory
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/", (req, res) => {
    res.json({ ok: true, app: "vleky3" });
  });

  // API
  app.use("/api/upload", uploadRouter);

  return app;
}

module.exports = { createApp };
