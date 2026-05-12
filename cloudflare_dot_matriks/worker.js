// worker.js — Cloudflare Worker sebagai relay global
//
// ── Cara deploy ───────────────────────────────────────────────
//   1. Install Wrangler: npm install -g wrangler
//   2. Login: wrangler login
//   3. Buat KV namespace:
//        wrangler kv:namespace create "MESSAGES"
//      Salin "id" yang dikembalikan, lalu isi di wrangler.toml
//   4. Deploy: wrangler deploy
//
// ── Endpoint ──────────────────────────────────────────────────
//   GET  /message  — ESP32 polling teks saat ini
//   POST /message  — Node.js server mengirim teks baru
//   GET  /status   — cek worker online
//
// ── Autentikasi ───────────────────────────────────────────────
//   Setiap request harus menyertakan header:
//     X-Secret-Token: <token>
//   Token harus sama dengan yang ada di:
//     - cloudflare_dot_matriks.ino  (CF_SECRET_TOKEN)
//     - cloudflareDotMatriks.js     (CF_SECRET_TOKEN)
// ─────────────────────────────────────────────────────────────

const SECRET_TOKEN = 'project-ala-ala-1212'; // ← ganti & samakan di semua file

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Secret-Token',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Validasi token rahasia
    const token = request.headers.get('X-Secret-Token');
    if (token !== SECRET_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // GET /status
    if (url.pathname === '/status' && request.method === 'GET') {
      const text = (await env.MESSAGES.get('current')) ?? 'Menunggu pesan...';
      return json({ online: true, text });
    }

    // GET /message — ESP32 polling
    if (url.pathname === '/message' && request.method === 'GET') {
      const text = (await env.MESSAGES.get('current')) ?? 'Menunggu pesan...';
      return json({ text });
    }

    // POST /message — server mengirim teks baru
    if (url.pathname === '/message' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Body harus JSON' }, 400);
      }

      const raw  = (body.text ?? '').toString();
      const text = raw.replace(/[\r\n]/g, ' ').trim().slice(0, 127);

      if (!text) {
        return json({ error: 'Text tidak boleh kosong' }, 400);
      }

      await env.MESSAGES.put('current', text);
      return json({ success: true });
    }

    return json({ error: 'Not Found' }, 404);
  },
};
