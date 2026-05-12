
import { useEffect, useRef, useState } from 'react'

const BASE_URL = import.meta.env.VITE_SERVER_URL ?? ''

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function CloudflareDotMatriks() {
  const [online, setOnline]   = useState(false)
  const [curText, setCurText] = useState('')
  const [text, setText]       = useState('')
  const [status, setStatus]   = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const inputRef              = useRef<HTMLInputElement>(null)

  function fetchStatus() {
    fetch(`${BASE_URL}/api/cloudflare-led/status`)
      .then((r) => r.json())
      .then((d) => {
        setOnline(d.online ?? false)
        if (d.text && d.text !== 'Menunggu pesan...') setCurText(d.text)
      })
      .catch(() => setOnline(false))
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  async function handleSend() {
    if (!text.trim()) return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(`${BASE_URL}/api/cloudflare-led`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim')
      setStatus('success')
      setMessage(`Teks "${text.trim()}" berhasil dikirim ke Cloudflare!`)
      setCurText(text.trim())
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Terjadi kesalahan')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800">
        Cloudflare LED Dot Matrix Control
      </h1>

      {/* Status Worker */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className={online ? 'text-green-600' : 'text-red-500'}>
          {online ? 'Cloudflare Worker Online' : 'Cloudflare Worker Offline'}
        </span>
      </div>

      {/* Panduan jika offline */}
      {!online && (
        <div className="text-xs text-gray-400 text-center max-w-sm leading-relaxed bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
          Pastikan Cloudflare Worker sudah di-deploy dan{' '}
          <code className="font-mono bg-gray-200 px-1 rounded">CF_WORKER_URL</code>{' '}
          di{' '}
          <code className="font-mono bg-gray-200 px-1 rounded">
            server/routes/cloudflareDotMatriks.js
          </code>{' '}
          sudah diisi dengan benar.
        </div>
      )}

      {/* Teks yang sedang tampil */}
      {curText && (
        <div className="text-xs text-gray-500 text-center">
          Tampil saat ini di LED:{' '}
          <span className="font-mono font-medium text-indigo-600">"{curText}"</span>
        </div>
      )}

      {/* Card input */}
      <div className="flex flex-col gap-4 p-6 rounded-2xl border border-gray-200 shadow-md w-full max-w-md bg-white">
        <h2 className="text-lg font-semibold text-gray-700 text-center">
          Kirim Teks ke LED (Cloudflare)
        </h2>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik teks yang ingin ditampilkan..."
          maxLength={127}
          disabled={status === 'loading'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
        />

        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>{text.length}/127 karakter</span>
          <span>Enter untuk kirim</span>
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || status === 'loading'}
          className="w-full py-2 px-4 rounded-lg font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? 'Mengirim...' : 'Kirim ke LED'}
        </button>

        {/* Feedback */}
        {message && (
          <p
            className={`text-sm text-center ${
              status === 'success' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {/* Penjelasan arsitektur */}
      <div className="text-xs text-gray-400 text-center max-w-sm leading-relaxed">
        Web → Node.js Server → Cloudflare Worker → ESP32 polling setiap 2 detik → LED Matrix
      </div>
    </div>
  )
}
