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

  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
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

    await db.query(`CREATE TABLE IF NOT EXISTS orders (
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

    await db.query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      item_type VARCHAR(100),
      quantity INT,
      services VARCHAR(255),
      price_rate INT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      order_id INT NULL,
      rating INT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Add order_id column if feedback table already existed without it
    await db.query(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS order_id INT NULL`);

    console.log("✅ All tables ready!");

    // Auto-seed admin user if not exists
    const [existing] = await db.query("SELECT id FROM users WHERE username='admin1'");
    if (!existing.length) {
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("12345", 8);
      await db.query(
        "INSERT INTO users (name, email, username, password, role) VALUES (?,?,?,?,'admin')",
        ["Admin", "admin@freshfold.com", "admin1", hash]
      );
      console.log("✅ Admin user created: username=admin1 password=12345");
    }
  } catch (err) {
    console.error("❌ Setup failed:", err.message);
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
