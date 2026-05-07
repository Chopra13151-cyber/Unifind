const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');
const app     = express();

const authRoutes = require('./authRoutes');
const itemRoutes = require('./itemRoutes');
const cctvRoutes = require('./Cctvroutes');
const aiRoutes   = require('./aiRoutes');        // ← AI routes

require('dotenv').config();

// ── MIDDLEWARE ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── SERVE FRONTEND HTML FILES ───────────────────────────
// This lets you open http://localhost:3000/Admin.html
// instead of file:///D:/... which blocks fetch() calls
app.use(express.static(path.join(__dirname)));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ROUTES ──────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/cctv',  cctvRoutes);
app.use('/api/ai',    aiRoutes);               // ← AI routes

// ── ADMIN: Get all users ────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT user_id, full_name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

app.get('/', (req, res) => res.send('UniFind Backend is Running!'));

// ── START ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Open your app at: http://localhost:${PORT}/Admin.html`);
});