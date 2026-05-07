const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const db      = require('./db');

// Safely load AI engine — won't crash if file missing
let runMatchingForItem = null;
try {
  runMatchingForItem = require('./aiMatchEngine').runMatchingForItem;
} catch (e) {
  console.warn('AI matching disabled.');
}

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* POST /api/items/report */
router.post('/report', upload.single('image'), async (req, res) => {
  const { user_id, title, description, category, location, type } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const [result] = await db.execute(
      `INSERT INTO items (user_id, title, description, category, location, type, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [user_id, title, description, category, location, type, image_url]
    );

    if (runMatchingForItem) {
      const newItem = { item_id: result.insertId, user_id, title, description, category, location, type, image_url };
      runMatchingForItem(newItem).catch(err => console.error('AI error:', err.message));
    }

    res.status(201).json({ message: 'Success!', id: result.insertId });
  } catch (err) {
    console.error('MySQL Insert Error:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

/* GET /api/items/all */
router.get('/all', async (req, res) => {
  const { type, category, search } = req.query;
  let sql = `SELECT i.*, COUNT(c.comment_id) AS comment_count
             FROM items i
             LEFT JOIN comments c ON c.item_id = i.item_id
             WHERE 1=1`;
  const params = [];
  if (type)     { sql += ' AND i.type = ?';                                 params.push(type); }
  if (category) { sql += ' AND i.category = ?';                             params.push(category); }
  if (search)   { sql += ' AND (i.title LIKE ? OR i.description LIKE ?)';   params.push(`%${search}%`, `%${search}%`); }
  sql += ' GROUP BY i.item_id ORDER BY i.reported_at DESC';

  try {
    const [results] = await db.execute(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching items', error: err.message });
  }
});

/* GET /api/items/user/:id */
router.get('/user/:id', async (req, res) => {
  try {
    const [results] = await db.execute(
      'SELECT * FROM items WHERE user_id = ? ORDER BY reported_at DESC',
      [req.params.id]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching items', error: err.message });
  }
});

/* POST /api/items/comment */
router.post('/comment', async (req, res) => {
  const { item_id, user_id, comment_text } = req.body;
  if (!item_id || !comment_text?.trim())
    return res.status(400).json({ message: 'item_id and comment_text are required.' });
  try {
    const [items] = await db.execute('SELECT item_id FROM items WHERE item_id = ?', [item_id]);
    if (!items.length) return res.status(404).json({ message: 'Item not found.' });
    const [result] = await db.execute(
      'INSERT INTO comments (item_id, user_id, comment_text) VALUES (?, ?, ?)',
      [item_id, user_id || null, comment_text.trim()]
    );
    res.status(201).json({ message: 'Comment submitted.', comment_id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

/* GET /api/items/comments/:itemId */
router.get('/comments/:itemId', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.comment_id, c.comment_text, c.created_at, u.full_name AS commenter_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.user_id
       WHERE c.item_id = ? ORDER BY c.created_at DESC`,
      [req.params.itemId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

module.exports = router;