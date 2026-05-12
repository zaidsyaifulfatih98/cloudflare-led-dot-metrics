// serial.js — Shared serial port connection untuk semua project
const { SerialPort } = require('serialport');

const SERIAL_PORT = 'COM4';
const BAUD_RATE = 115200;

let serialPort = null;
let connected = false;
let reconnectTimer = null;

function connectSerial() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE }, (err) => {
    if (err) {
      console.error('[Serial] Gagal konek:', err.message);
      connected = false;
      scheduleReconnect();
    } else {
      console.log(`[Serial] Terhubung ke ${SERIAL_PORT}`);
      connected = true;
    }
  });

  serialPort.on('error', (err) => {
    console.error('[Serial] Error:', err.message);
    connected = false;
  });

  serialPort.on('close', () => {
    console.warn('[Serial] Port tertutup, mencoba reconnect...');
    connected = false;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      console.log('[Serial] Mencoba reconnect ke', SERIAL_PORT);
      connectSerial();
    }, 3000);
  }
}

function isConnected() {
  return connected && serialPort && serialPort.isOpen;
}

function sendChar(char, res, label) {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Perangkat tidak terhubung' });
  }
  serialPort.write(char, (err) => {
    if (err) return res.status(500).json({ error: 'Gagal kirim perintah: ' + err.message });
    console.log(`[${label}] Karakter dikirim: '${char}'`);
    res.json({ success: true });
  });
}

function sendText(text, res, label) {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Perangkat tidak terhubung' });
  }
  serialPort.write(text, (err) => {
    if (err) return res.status(500).json({ error: 'Gagal kirim teks: ' + err.message });
    console.log(`[${label}] Teks dikirim: "${text.trim()}"`);
    res.json({ success: true });
  });
}

module.exports = {
  connectSerial,
  isConnected,
  sendChar,
  sendText,
  getPort: () => SERIAL_PORT,
};
