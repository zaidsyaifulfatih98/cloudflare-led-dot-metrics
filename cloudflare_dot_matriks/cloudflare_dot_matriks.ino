// cloudflare_dot_matriks.ino
// ESP32 polling pesan dari Cloudflare Worker lalu tampilkan di LED dot matrix.
//
// Library yang dibutuhkan (instal via Library Manager):
//   - MD_Parola  (majicDesigns)
//   - MD_MAX72XX (majicDesigns)
//   - ArduinoJson (Benoit Blanchon)
//
// ── Alur sistem ───────────────────────────────────────────────
//   Web UI  →  Node.js Server  →  Cloudflare Worker  ← polling ESP32
//
// ── Cara setup ────────────────────────────────────────────────
//   1. Isi WIFI_SSID / WIFI_PASSWORD dengan jaringan kamu
//   2. Isi CF_WORKER_URL  dengan URL worker kamu
//        contoh: https://cloudflare-dot-matriks.namakamu.workers.dev
//   3. Ganti CF_SECRET_TOKEN dengan token rahasia yang sama
//        di file ini, di worker.js, dan di cloudflareDotMatriks.js
// ─────────────────────────────────────────────────────────────

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <MD_Parola.h>
#include <MD_MAX72xx.h>
#include <SPI.h>
#include <ArduinoJson.h>

// ── Konfigurasi WiFi ──────────────────────────────────────────
const char* WIFI_SSID     = "stabiloo";
const char* WIFI_PASSWORD = "stabiloo87";

// ── Konfigurasi Cloudflare Worker ─────────────────────────────
const char* CF_WORKER_URL   = "https://cloudflare-dot-matriks.zaidsyaifulfatih98.workers.dev";
const char* CF_SECRET_TOKEN = "project-ala-ala-1212";

// ── Konfigurasi LED Matrix ────────────────────────────────────
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
#define MAX_DEVICES   4
#define CLK_PIN       18
#define DATA_PIN      23
#define CS_PIN        5

// Interval polling Cloudflare (ms)
#define POLL_INTERVAL 10000

MD_Parola P = MD_Parola(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MAX_DEVICES);

char displayBuffer[128] = "Menunggu pesan...";
char lastText[128]      = "";

SemaphoreHandle_t bufferMutex;

// ── Task polling di Core 0 ───────────────────────────────────
void pollTask(void* param) {
  for (;;) {
    pollCloudflare();
    vTaskDelay(pdMS_TO_TICKS(POLL_INTERVAL));
  }
}

// ── Polling Cloudflare Worker ─────────────────────────────────
void pollCloudflare() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CF] WiFi terputus, melewati poll");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // skip verifikasi sertifikat (cukup untuk HTTPS enkripsi)

  HTTPClient http;
  String url = String(CF_WORKER_URL) + "/message";
  if (!http.begin(client, url)) {
    Serial.println("[CF] Gagal membuka koneksi HTTP");
    return;
  }

  http.addHeader("X-Secret-Token", CF_SECRET_TOKEN);
  http.setTimeout(5000);

  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (err) {
      Serial.print("[CF] JSON error: ");
      Serial.println(err.c_str());
    } else {
      const char* text = doc["text"] | "";
      // Hanya update tampilan jika teks berubah
      if (strlen(text) > 0 && strcmp(text, lastText) != 0) {
        strncpy(lastText, text, sizeof(lastText) - 1);
        lastText[sizeof(lastText) - 1] = '\0';

        if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
          strncpy(displayBuffer, text, sizeof(displayBuffer) - 1);
          displayBuffer[sizeof(displayBuffer) - 1] = '\0';
          xSemaphoreGive(bufferMutex);
        }

        Serial.print("[CF] Teks baru: ");
        Serial.println(displayBuffer);
      }
    }
  } else if (code == 401) {
    Serial.println("[CF] 401 Unauthorized — cek CF_SECRET_TOKEN");
  } else {
    Serial.printf("[CF] HTTP %d\n", code);
  }

  http.end();
}

// ── Setup ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  bufferMutex = xSemaphoreCreateMutex();

  // Init LED matrix
  P.begin();
  P.setIntensity(5);
  P.displayText(displayBuffer, PA_CENTER, 200, 0, PA_SCROLL_LEFT, PA_SCROLL_LEFT);

  // Hubungkan WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    P.displayAnimate();
  }
  Serial.println();
  Serial.print("Terhubung! IP: ");
  Serial.println(WiFi.localIP());

  // Tampilkan IP di LED (5 detik)
  String ip = WiFi.localIP().toString();
  ip.toCharArray(displayBuffer, sizeof(displayBuffer));
  P.displayReset();
  P.displayText(displayBuffer, PA_CENTER, 200, 0, PA_SCROLL_LEFT, PA_SCROLL_LEFT);

  unsigned long showUntil = millis() + 5000;
  while (millis() < showUntil) {
    P.displayAnimate();
  }

  // Kembali ke pesan awal
  strncpy(displayBuffer, "Menunggu pesan...", sizeof(displayBuffer) - 1);
  P.displayReset();
  P.displayText(displayBuffer, PA_CENTER, 200, 0, PA_SCROLL_LEFT, PA_SCROLL_LEFT);

  // Jalankan polling di Core 0 (loop() berjalan di Core 1)
  xTaskCreatePinnedToCore(pollTask, "pollTask", 8192, NULL, 1, NULL, 0);
}

// ── Loop ──────────────────────────────────────────────────────
void loop() {
  if (P.displayAnimate()) {
    // Cek apakah ada teks baru dari polling task
    if (xSemaphoreTake(bufferMutex, 0) == pdTRUE) {
      P.displayText(displayBuffer, PA_CENTER, 200, 0, PA_SCROLL_LEFT, PA_SCROLL_LEFT);
      xSemaphoreGive(bufferMutex);
    }
    P.displayReset();
  }
}
