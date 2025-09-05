import express from "express";
import pkg from "pg";
import fetch from "node-fetch";

const { Pool } = pkg;
const app = express();
app.set("trust proxy", true); // needed for Render

// 🔹 Connect to Postgres (Render will give DATABASE_URL later)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔹 Create table if not exists
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      isp TEXT,
      visited_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
initDB();

// 🔹 Helper: get client IP
function clientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  const ra = req.socket?.remoteAddress || "";
  return ra.replace("::ffff:", "");
}

// 🔹 Route: log visit
app.get("/", async (req, res) => {
  const ip = clientIP(req);
  const ua = req.headers["user-agent"] || "";

  // Get location info from ip-api.com
  let country = null, region = null, city = null, isp = null;
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
    const geoData = await geoRes.json();
    if (geoData.status === "success") {
      country = geoData.country;
      region = geoData.regionName;
      city = geoData.city;
      isp = geoData.isp;
    }
  } catch (err) {
    console.error("Geo lookup failed:", err);
  }

  // Save to DB
  await pool.query(
    `INSERT INTO visits (ip, user_agent, country, region, city, isp) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ip, ua, country, region, city, isp]
  );

  console.log(`[VISIT] ${ip} (${country}, ${city})`);
  res.send("<h1>IP Logging Demo</h1><p>Your visit has been logged.</p>");
});

// 🔹 Route: view logs (protected by token)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
app.get("/logs", async (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) return res.status(403).send("Forbidden");

  const result = await pool.query("SELECT * FROM visits ORDER BY visited_at DESC LIMIT 100");
  res.type("json").send(JSON.stringify(result.rows, null, 2));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
