// index.js — Entry point server
// Untuk menambah project baru: buat file di routes/ lalu mount di sini

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');

// Routes per project
const statusRoute        = require('./routes/status');
const cloudflareLedRoute = require('./routes/cloudflareDotMatriks');

const app         = express();
const PORT_SERVER = process.env.PORT || 3001;

app.use(cors({
  origin: (process.env.ALLOWED_ORIGIN || '*').replace(/\/$/, ''),
}));
app.use(express.json());

// Mount routes
app.use('/api/status',         statusRoute);
app.use('/api/cloudflare-led', cloudflareLedRoute);

// Lokal: jalankan server biasa. Vercel: export app sebagai handler
if (process.env.VERCEL !== '1') {
  app.listen(PORT_SERVER, () => {
    console.log(`[Server] Berjalan di http://localhost:${PORT_SERVER}  (mode: cloudflare)`);
  });
}

module.exports = app;