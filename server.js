
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      balance INT DEFAULT 0,
      is_admin BOOLEAN DEFAULT false
    );
  `);

  const adminUser = process.env.ADMIN_USERNAME || "mywebhosting";
  const adminPass = process.env.ADMIN_PASSWORD || "password123";

  const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [adminUser]);
  if (!rows.length) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query("INSERT INTO users VALUES($1,$2,0,true)", [adminUser, hash]);
  }
}

app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"public","embed.html")));

app.post("/api/login", async (req,res)=>{
  const { username, password } = req.body;
  const { rows } = await pool.query("SELECT * FROM users WHERE username=$1",[username]);
  if(!rows.length) return res.status(400).json({error:"Invalid"});
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if(!ok) return res.status(400).json({error:"Invalid"});
  res.json({success:true,balance:rows[0].balance});
});

const port = process.env.PORT || 3000;
initDB().then(()=>app.listen(port,()=>console.log("Running on",port)));
