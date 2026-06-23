// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Test Database Connection on start (with retry for Railway cold starts)
(async () => {
  const maxRetries = 5;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await db.getConnection();
      console.log("✅ MySQL Connected!");
      conn.release();
      return;
    } catch (err) {
      console.error(`❌ MySQL Connection Attempt ${i}/${maxRetries} Failed:`, err.message);
      if (i === maxRetries) {
        console.error("❌ All MySQL connection attempts failed. Server will start but DB queries may fail.");
        // Don't process.exit(1) — let Railway keep the container alive for healthchecks
      } else {
        console.log(`⏳ Retrying in ${i * 2} seconds...`);
        await new Promise(r => setTimeout(r, i * 2000));
      }
    }
  }
})();

// ✅ Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ✅ Routes
app.use("/api/users", require("./routes/userRoutes")(db));
app.use("/api/orders", require("./routes/orderRoutes")(db));
app.use("/api/feedback", require("./routes/feedbackRoutes")(db));

// ✅ Health check endpoint (useful for Railway)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ✅ Fallback
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // ✅ Required for Railway — must bind to all interfaces
app.listen(PORT, HOST, () => console.log(`🚀 Server running on ${HOST}:${PORT}`));
