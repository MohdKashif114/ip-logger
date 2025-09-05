import express from "express";

const app = express();
app.set("trust proxy", true);  // important for Render (behind proxies)

// Store visits in memory (will reset if server restarts)
const visits = [];

function clientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  const ra = req.socket?.remoteAddress || "";
  return ra.replace("::ffff:", "");
}

app.get("/", (req, res) => {
  const ip = clientIP(req);
  const when = new Date().toISOString();
  visits.push({ ip, when, ua: req.headers["user-agent"] || "" });
  console.log(`[VISIT] ${when} - ${ip}`);
  res.send(`
    <h1>IP Logging Demo</h1>
    <p>Your visit has been logged for demo purposes.</p>
  `);
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
app.get("/logs", (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) return res.status(403).send("Forbidden");
  res.type("json").send(JSON.stringify({ count: visits.length, visits }, null, 2));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
