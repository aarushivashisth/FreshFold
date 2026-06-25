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

// ✅ Connect to DB and auto-create tables on startup
(async () => {
  const maxRetries = 5;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await db.getConnection();
      console.log("✅ MySQL Connected!");
      conn.release();
      break;
    } catch (err) {
      console.error(`❌ MySQL Connection Attempt ${i}/${maxRetries} Failed:`, err.message);
      if (i === maxRetries) {
        console.error("❌ All MySQL connection attempts failed. Server will start but DB queries may fail.");
        return;
      }
      console.log(`⏳ Retrying in ${i * 2} seconds...`);
      await new Promise(r => setTimeout(r, i * 2000));
    }
  }

  // Create tables — each in its own try/catch so one failure doesn't block the rest
  const run = async (label, sql) => {
    try { await db.query(sql); console.log(`✅ ${label}`); }
    catch (e) { console.error(`❌ ${label}:`, e.message); }
  };

  await run("users table", `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    role ENUM('customer','admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await run("orders table", `CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'placed',
    pickup_slot VARCHAR(100),
    current_step INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await run("order_items table", `CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    item_type VARCHAR(100),
    quantity INT,
    services VARCHAR(255),
    price_rate INT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  await run("feedback table", `CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT NULL,
    rating INT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Add order_id to feedback if it was created without it — ignore error if column already exists
  try { await db.query(`ALTER TABLE feedback ADD COLUMN order_id INT NULL`); }
  catch (e) { /* column already exists, fine */ }

  // Auto-seed admin user
  try {
    const bcrypt = require("bcrypt");
    const [existing] = await db.query("SELECT id FROM users WHERE username='admin1'");
    if (!existing.length) {
      const hash = await bcrypt.hash("12345", 8);
      await db.query(
        "INSERT INTO users (name, email, username, password, role) VALUES (?,?,?,?,'admin')",
        ["Admin", "admin@freshfold.com", "admin1", hash]
      );
      console.log("✅ Admin created: username=admin1 password=12345");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (e) {
    console.error("❌ Admin seed failed:", e.message);
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
