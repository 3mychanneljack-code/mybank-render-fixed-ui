const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_FILE = path.join(__dirname, 'db.json');
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      users: [],
      transactions: [],
      broadcasts: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mywebhosting';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

// helpers
function findUser(db, username) {
  return db.users.find(u => u.username === username);
}
function sanitizeUserForClient(u) {
  if (!u) return null;
  return { username: u.username, balance: Number(u.balance), is_admin: !!u.is_admin, is_frozen: !!u.is_frozen };
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'embed.html'));
});

// Create user
app.post('/api/createUser', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username+password required' });

  const db = loadDB();
  if (findUser(db, username)) return res.status(400).json({ error: 'User already exists' });

  const hash = await bcrypt.hash(password, 10);
  db.users.push({ username, password_hash: hash, balance: 0, is_admin: false, is_frozen: false });
  saveDB(db);
  res.json({ success: true });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = findUser(db, username);
  if (!user) return res.status(400).json({ error: 'Invalid login' });
  if (user.is_frozen) return res.status(403).json({ error: 'Account frozen' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Invalid login' });
  res.json({ success: true, user: sanitizeUserForClient(user) });
});

// Balance
app.post('/api/balance', (req, res) => {
  const { username } = req.body;
  const db = loadDB();
  const user = findUser(db, username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_frozen) return res.status(403).json({ error: 'Account frozen' });
  res.json({ balance: Number(user.balance) });
});

// Send money
app.post('/api/send', (req, res) => {
  const { from, to, amount } = req.body;
  const amt = Number(amount);
  if (!from || !to || !amt) return res.status(400).json({ error: 'from,to,amount required' });
  if (amt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (amt > 20) return res.status(400).json({ error: 'Max transaction is 20 Niftoes' });

  const db = loadDB();
  const sender = findUser(db, from);
  const receiver = findUser(db, to);
  if (!sender || !receiver) return res.status(404).json({ error: 'Sender or receiver not found' });
  if (sender.is_frozen) return res.status(403).json({ error: 'Sender account frozen' });
  if (receiver.is_frozen) return res.status(403).json({ error: 'Receiver account frozen' });
  if (Number(sender.balance) < amt) return res.status(400).json({ error: 'Not enough Niftoes' });

  sender.balance = Number(sender.balance) - amt;
  receiver.balance = Number(receiver.balance) + amt;
  db.transactions.push({ id: db.transactions.length + 1, sender: sender.username, receiver: receiver.username, amount: amt, created_at: new Date().toISOString() });
  saveDB(db);
  res.json({ success: true });
});

// Admin simple auth (checks body or env)
function checkAdminAuth(body) {
  const user = body && body.adminUsername;
  const pass = body && body.adminPassword;
  const adminUser = process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  return user === adminUser && pass === adminPass;
}

app.post('/api/admin/login', (req, res) => {
  if (checkAdminAuth(req.body)) return res.json({ success: true });
  res.status(403).json({ error: 'Invalid admin credentials' });
});

// Admin list users
app.post('/api/admin/users', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const db = loadDB();
  res.json(db.users.map(u => ({ username: u.username, balance: Number(u.balance), is_admin: !!u.is_admin, is_frozen: !!u.is_frozen })));
});

// Admin create user
app.post('/api/admin/createUser', async (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const { username, password, balance = 0, is_admin = false } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username+password required' });
  const db = loadDB();
  if (findUser(db, username)) return res.status(400).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  db.users.push({ username, password_hash: hash, balance: Number(balance), is_admin: !!is_admin, is_frozen: false });
  saveDB(db);
  res.json({ success: true });
});

// Admin set balance
app.post('/api/admin/setBalance', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const { username, balance } = req.body;
  const db = loadDB();
  const user = findUser(db, username);
  if (!user) return res.status(404).json({ error: 'user not found' });
  if (Number(balance) < 0) return res.status(400).json({ error: 'Balance cannot be negative' });
  user.balance = Number(balance);
  saveDB(db);
  res.json({ success: true });
});

// Admin freeze/unfreeze
app.post('/api/admin/freezeUser', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const { username, freeze } = req.body;
  const db = loadDB();
  const user = findUser(db, username);
  if (!user) return res.status(404).json({ error: 'user not found' });
  user.is_frozen = !!freeze;
  saveDB(db);
  res.json({ success: true });
});

// Admin delete user
app.post('/api/admin/deleteUser', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const { username } = req.body;
  const db = loadDB();
  const idx = db.users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'user not found' });
  db.users.splice(idx, 1);
  // remove transactions involving user (keep others)
  db.transactions = db.transactions.filter(t => t.sender !== username && t.receiver !== username);
  saveDB(db);
  res.json({ success: true });
});

// Admin transactions
app.post('/api/admin/transactions', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const db = loadDB();
  res.json(db.transactions.slice().reverse());
});

// Admin broadcast
app.post('/api/admin/broadcast', (req, res) => {
  if (!checkAdminAuth(req.body)) return res.status(403).json({ error: 'forbidden' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const db = loadDB();
  db.broadcasts.push({ message, created_at: new Date().toISOString() });
  saveDB(db);
  res.json({ success: true });
});

// Public broadcasts
app.get('/api/broadcasts', (req, res) => {
  const db = loadDB();
  res.json(db.broadcasts.slice().reverse());
});

// ensure admin user exists in db (on startup)
(function ensureAdmin() {
  const db = loadDB();
  const adminUser = DEFAULT_ADMIN_USERNAME;
  if (!findUser(db, adminUser)) {
    const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    db.users.push({ username: adminUser, password_hash: hash, balance: 0, is_admin: true, is_frozen: false });
    saveDB(db);
    console.log('Seeded admin user:', adminUser);
  }
})();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('MyBank server listening on', port));
