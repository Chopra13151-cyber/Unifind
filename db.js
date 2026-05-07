const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306, // MySQL default port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('Check if your MySQL password in .env is correct and MySQL is running.');
  } else {
    console.log('✅ Connected to MySQL successfully!');
    connection.release();
  }
});

module.exports = pool.promise();module.exports.getConnection = () => pool.promise().getConnection();