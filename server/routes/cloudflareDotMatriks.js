// routes/cloudflareDotMatriks.js
// Node.js bertindak sebagai proxy antara frontend dan Cloudflare Worker.
//
// ── Konfigurasi ───────────────────────────────────────────────
//   Ganti CF_WORKER_URL dan CF_SECRET_TOKEN agar sama dengan
//   yang ada di worker.js dan cloudflare_dot_matriks.ino
// ─────────────────────────────────────────────────────────────

const express = require('express');

const router = express.Router();

const CF_WORKER_URL   = process.env.CF_WORKER_URL;
const CF_SECRET_TOKEN = process.env.CF_SECRET_TOKEN;
const TIMEOUT_MS      = 6000;

async function fetchWorker(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CF_WORKER_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'X-Secret-Token': CF_SECRET_TOKEN,
        ...(options.headers ?? {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/cloudflare-led/status
router.get('/status', async (req, res) => {
  try {
    const r    = await fetchWorker('/status');
    const data = await r.json();
    res.json({ online: true, workerUrl: CF_WORKER_URL, ...data });
  } catch {
    res.json({ online: false, workerUrl: CF_WORKER_URL });
  }
});

// POST /api/cloudflare-led   body: { "text": "..." }
router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text tidak boleh kosong' });
  }

  const sanitized = text.replace(/[\r\n]/g, ' ').trim().slice(0, 127);

  try {
    const r = await fetchWorker('/message', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: sanitized }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: 'Worker error: ' + err });
    }

    console.log(`[CF-LED] Teks dikirim ke Cloudflare Worker: "${sanitized}"`);
    res.json({ success: true });
  } catch (err) {
    const msg =
      err.name === 'AbortError'
        ? 'Cloudflare Worker timeout'
        : 'Tidak dapat terhubung ke Cloudflare Worker';
    res.status(503).json({ error: msg });
  }
});

module.exports = router;
