// db.js
const mysql = require("mysql2");
require("dotenv").config();

// ✅ Railway provides MySQL vars as MYSQLHOST, MYSQLUSER, etc.
// Also supports custom DB_HOST, DB_USER, etc. and MYSQL_URL connection string.
// Priority: MYSQL_URL > MYSQL* vars > DB_* vars > localhost defaults

// If MYSQL_URL is available (Railway's connection string), use it directly
const MYSQL_URL = process.env.MYSQL_URL || process.env.DATABASE_URL;

let pool;

if (MYSQL_URL) {
  // ✅ Use connection string (Railway provides this automatically)
  pool = mysql.createPool(MYSQL_URL);
  console.log("📦 MySQL: Using connection string (MYSQL_URL)");
} else {
  // ✅ Use individual env vars — support both Railway (MYSQL*) and custom (DB_*) naming
  const config = {
    host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
    user: process.env.MYSQLUSER || process.env.DB_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || "freshfold",
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || "3306"),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  console.log(`📦 MySQL: Connecting to ${config.host}:${config.port}/${config.database}`);
  pool = mysql.createPool(config);
}

module.exports = pool.promise();
