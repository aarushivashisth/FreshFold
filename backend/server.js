// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const db = require("./db");

const app = express();

// ✅ CORS Configuration — Railway + localhost for dev
const allowedOrigins = [
  "https://freshfold-production.up.railway.app",
  "http://localhost:5000",
  "http://localhost:3000",
  "http://127.0.0.1:5000"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("⚠ CORS blocked request from:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

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
      } else {
        console.log(`⏳ Retrying in ${i * 2} seconds...`);
        await new Promise(r => setTimeout(r, i * 2000));
      }
    }
  }
})();

// ✅ Serve frontend files
app.use(express.static(path.join(__dirname, "./frontend")));

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
  res.sendFile(path.join(__dirname, "./frontend/login.html"));
});

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // ✅ Required for Railway — must bind to all interfaces
app.listen(PORT, HOST, () => console.log(`🚀 Server running on ${HOST}:${PORT}`));
