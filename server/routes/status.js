// routes/status.js — Status koneksi serial port
const express = require('express');
const { isConnected, getPort } = require('../serial');

const router = express.Router();

// GET /api/status
router.get('/', (req, res) => {
  res.json({ connected: isConnected(), port: getPort() });
});

module.exports = router;
