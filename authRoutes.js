const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Moved to the top with other imports

// --- SIGNUP ROUTE ---
router.post('/signup', async (req, res) => {
    const { full_name, email, password, role, phone } = req.body;

    try {
        // 1. Check if user already exists
        const [existingUser] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // 2. Encrypt the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Save to MySQL
        await db.execute(
            'INSERT INTO users (full_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, hashedPassword, role, phone]
        );

        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        const user = users[0];
        
        // Compare the provided password with the hashed one in DB
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Create a Token (Use a strong secret key from your .env in the future)
        const token = jwt.sign(
            { id: user.user_id, role: user.role }, 
            process.env.JWT_SECRET || 'fallback_dev_secret_change_in_prod', 
            { expiresIn: '7d' }
        );

        res.json({ 
            token, 
            user: { 
                id: user.user_id, 
                name: user.full_name, 
                role: user.role 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CRITICAL: Always export at the very end ---
module.exports = router;