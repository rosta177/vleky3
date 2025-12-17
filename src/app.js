const express = require("express");
const path = require("path");

const uploadRouter = require("./routes/upload");
const dbTestRouter = require("./routes/db-test");
const trailersRouter = require("./routes/trailers");
const locksRouter = require("./routes/locks");


function createApp() {
  const app = express();

  app.use(express.json());

  // statické soubory
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // root
  app.get("/", (req, res) => {
    res.json({ ok: true, app: "vleky3" });
  });

  // API
  app.use("/api/upload", uploadRouter);
  app.use("/api/db-test", dbTestRouter);
  app.use("/api/trailers", trailersRouter);
  app.use("/api", locksRouter);

  return app;
}

module.exports = { createApp };
