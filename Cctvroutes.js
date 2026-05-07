const express = require('express');
const router  = express.Router();
const db      = require('./db');

/* ═══════════════════════════════════════════════════════
   POST /api/cctv/request
   Student submits a new CCTV request.
═══════════════════════════════════════════════════════ */
router.post('/request', async (req, res) => {
  const { requester_id, item_id, incident_date, incident_time, location, reason } = req.body;

  if (!requester_id || !incident_date || !location || !reason) {
    return res.status(400).json({ message: 'requester_id, incident_date, location and reason are required.' });
  }

  try {
    const sql = `
      INSERT INTO cctv_requests
        (requester_id, item_id, incident_date, incident_time, location, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;
    const [result] = await db.execute(sql, [
      requester_id,
      item_id || null,
      incident_date,
      incident_time || null,
      location,
      reason
    ]);

    res.status(201).json({ message: 'Request submitted successfully.', request_id: result.insertId });
  } catch (err) {
    console.error('CCTV Request Insert Error:', err);
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /api/cctv/all-requests
   ADMIN: Returns ALL cctv requests with requester name & item title.
═══════════════════════════════════════════════════════ */
router.get('/all-requests', async (req, res) => {
  try {
    const sql = `
      SELECT
        cr.request_id,
        cr.status,
        cr.admin_note,
        cr.location,
        cr.incident_date,
        cr.incident_time,
        cr.reason,
        cr.created_at,
        cr.updated_at,
        u.full_name   AS requester_name,
        i.title       AS item_title
      FROM cctv_requests cr
      LEFT JOIN users u ON cr.requester_id = u.user_id
      LEFT JOIN items i ON cr.item_id      = i.item_id
      ORDER BY cr.created_at DESC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error('CCTV All Requests Error:', err);
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════
   PATCH /api/cctv/update/:id
   ADMIN: Approve or reject a request, optionally add a note.
   Body: { status: 'approved'|'rejected'|'completed', admin_note?: string }
═══════════════════════════════════════════════════════ */
router.patch('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;

  const allowed = ['pending', 'approved', 'rejected', 'completed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    const sql = `
      UPDATE cctv_requests
      SET status = ?, admin_note = ?, updated_at = NOW()
      WHERE request_id = ?
    `;
    const [result] = await db.execute(sql, [status, admin_note || null, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    res.json({ message: `Request #${id} updated to ${status}.` });
  } catch (err) {
    console.error('CCTV Update Error:', err);
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /api/cctv/notifications/:userId
   Returns actioned requests so the student sees admin responses.
═══════════════════════════════════════════════════════ */
router.get('/notifications/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const sql = `
      SELECT
        cr.request_id,
        cr.status,
        cr.admin_note,
        cr.location,
        cr.incident_date,
        cr.incident_time,
        cr.reason,
        cr.created_at,
        cr.updated_at,
        i.title AS item_title
      FROM cctv_requests cr
      LEFT JOIN items i ON cr.item_id = i.item_id
      WHERE cr.requester_id = ?
        AND cr.status IN ('approved', 'rejected', 'completed')
      ORDER BY cr.updated_at DESC
    `;
    const [rows] = await db.execute(sql, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('CCTV Notifications Error:', err);
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════
   GET /api/cctv/my-requests/:userId
   Returns ALL requests by this user (all statuses).
═══════════════════════════════════════════════════════ */
router.get('/my-requests/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const sql = `
      SELECT
        cr.request_id,
        cr.status,
        cr.admin_note,
        cr.location,
        cr.incident_date,
        cr.incident_time,
        cr.reason,
        cr.created_at,
        cr.updated_at,
        i.title AS item_title
      FROM cctv_requests cr
      LEFT JOIN items i ON cr.item_id = i.item_id
      WHERE cr.requester_id = ?
      ORDER BY cr.created_at DESC
    `;
    const [rows] = await db.execute(sql, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('CCTV My Requests Error:', err);
    res.status(500).json({ message: 'Database error.', error: err.message });
  }
});

module.exports = router;