/* ═══════════════════════════════════════════════════════════════
   UniFind — AI Match Routes
   aiRoutes.js
   ════════════════════════════════════════════════════════════════ */

const express = require('express');
const router  = express.Router();
const db      = require('./db');
const { runMatchingForItem } = require('./aiMatchEngine');

/* ───────────────────────────────────────────────────────────────
   GET /api/ai/matches
   Returns all stored AI matches with both item details.
   Query params: ?min_score=50  (default 0)
   ─────────────────────────────────────────────────────────────── */
router.get('/matches', async (req, res) => {
  const minScore = parseInt(req.query.min_score) || 0;

  try {
    const [rows] = await db.execute(
      `SELECT
         m.match_id,
         m.confidence_score,
         m.match_reason,
         m.status        AS match_status,
         m.created_at,

         li.item_id      AS lost_id,
         li.title        AS lost_title,
         li.description  AS lost_desc,
         li.location     AS lost_location,
         li.image_url    AS lost_image,
         li.reported_at  AS lost_reported_at,
         lc.name         AS lost_category,
         lu.full_name    AS lost_reporter,

         fi.item_id      AS found_id,
         fi.title        AS found_title,
         fi.description  AS found_desc,
         fi.location     AS found_location,
         fi.image_url    AS found_image,
         fi.reported_at  AS found_reported_at,
         fc.name         AS found_category,
         fu.full_name    AS found_reporter

       FROM ai_matches m
       JOIN items li ON m.lost_item_id  = li.item_id
       JOIN items fi ON m.found_item_id = fi.item_id
       LEFT JOIN categories lc ON li.category_id = lc.category_id
       LEFT JOIN categories fc ON fi.category_id = fc.category_id
       LEFT JOIN users lu ON li.user_id = lu.user_id
       LEFT JOIN users fu ON fi.user_id = fu.user_id
       WHERE m.confidence_score >= ?
       ORDER BY m.confidence_score DESC, m.created_at DESC`,
      [minScore]
    );
    res.json(rows);
  } catch (err) {
    console.error('AI matches fetch error:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

/* ───────────────────────────────────────────────────────────────
   GET /api/ai/matches/user/:userId
   Returns AI matches relevant to a specific user
   (matches where they own either the lost or found item).
   ─────────────────────────────────────────────────────────────── */
router.get('/matches/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT
         m.match_id,
         m.confidence_score,
         m.match_reason,
         m.status        AS match_status,
         m.created_at,

         li.item_id      AS lost_id,
         li.title        AS lost_title,
         li.description  AS lost_desc,
         li.location     AS lost_location,
         li.image_url    AS lost_image,
         lc.name         AS lost_category,

         fi.item_id      AS found_id,
         fi.title        AS found_title,
         fi.description  AS found_desc,
         fi.location     AS found_location,
         fi.image_url    AS found_image,
         fc.name         AS found_category

       FROM ai_matches m
       JOIN items li ON m.lost_item_id  = li.item_id
       JOIN items fi ON m.found_item_id = fi.item_id
       LEFT JOIN categories lc ON li.category_id = lc.category_id
       LEFT JOIN categories fc ON fi.category_id = fc.category_id
       WHERE li.user_id = ? OR fi.user_id = ?
       ORDER BY m.confidence_score DESC`,
      [userId, userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('User AI matches error:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

/* ───────────────────────────────────────────────────────────────
   POST /api/ai/run-match/:itemId
   Manually trigger matching for a specific item.
   Called automatically by itemRoutes after every new report.
   ─────────────────────────────────────────────────────────────── */
router.post('/run-match/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT i.*, c.name AS category
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.category_id
       WHERE i.item_id = ?`,
      [itemId]
    );

    if (!rows.length) return res.status(404).json({ message: 'Item not found.' });

    // Run async — don't block the response
    runMatchingForItem(rows[0]).catch(console.error);

    res.json({ message: 'AI matching started.', item_id: itemId });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

/* ───────────────────────────────────────────────────────────────
   PATCH /api/ai/matches/:matchId/confirm
   Admin confirms a match → sets both items to resolved.
   ─────────────────────────────────────────────────────────────── */
router.patch('/matches/:matchId/confirm', async (req, res) => {
  const { matchId } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[match]] = await conn.execute(
      'SELECT * FROM ai_matches WHERE match_id = ?', [matchId]
    );
    if (!match) { await conn.rollback(); return res.status(404).json({ message: 'Match not found.' }); }

    await conn.execute(
      `UPDATE ai_matches SET status = 'confirmed' WHERE match_id = ?`, [matchId]
    );
    await conn.execute(
      `UPDATE items SET status = 'resolved' WHERE item_id IN (?, ?)`,
      [match.lost_item_id, match.found_item_id]
    );

    await conn.commit();
    res.json({ message: 'Match confirmed and items resolved.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Database error', error: err.message });
  } finally {
    conn.release();
  }
});

/* ───────────────────────────────────────────────────────────────
   PATCH /api/ai/matches/:matchId/dismiss
   Admin dismisses a false-positive match.
   ─────────────────────────────────────────────────────────────── */
router.patch('/matches/:matchId/dismiss', async (req, res) => {
  const { matchId } = req.params;
  try {
    await db.execute(
      `UPDATE ai_matches SET status = 'dismissed' WHERE match_id = ?`, [matchId]
    );
    // Revert both items to active
    const [[match]] = await db.execute(
      'SELECT * FROM ai_matches WHERE match_id = ?', [matchId]
    );
    if (match) {
      await db.execute(
        `UPDATE items SET status = 'active' WHERE item_id IN (?, ?) AND status = 'matched'`,
        [match.lost_item_id, match.found_item_id]
      );
    }
    res.json({ message: 'Match dismissed.' });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

module.exports = router;