// v69 · Yeni koç için tek kullanımlık kayıt daveti oluşturur ve kodu yazdırır.
// Kullanım: node scripts/create-coach-invite.mjs [gün=7]
// Önce `firebase login` gerekir. Proje sahibi kimliğiyle (IAM) yazdığı için Firestore kurallarına takılmaz;
// kurallar istemcinin davet oluşturmasını zaten yasaklar.
import {randomInt} from "node:crypto";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {homedir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const PROJECT = "yks-uygulamam";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789"; // kuraldaki ^[A-Z2-9]{24}$ ile aynı küme
const TOOLS = process.env.FIREBASE_TOOLS_DIR || path.resolve(import.meta.dirname, "../../kural-testi/node_modules/firebase-tools");

export function makeCode() {
  return Array.from({length: 24}, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

async function accessToken() {
  const {clientId, clientSecret} = createRequire(import.meta.url)(path.join(TOOLS, "lib/api.js"));
  const cfg = JSON.parse(readFileSync(path.join(homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
  const refresh = cfg?.tokens?.refresh_token;
  if (!refresh) throw new Error("Firebase girişi yok: önce `firebase login` çalıştır.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"content-type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({grant_type: "refresh_token", refresh_token: refresh, client_id: clientId(), client_secret: clientSecret()})
  });
  const json = await res.json();
  if (!res.ok) throw new Error("Erişim anahtarı alınamadı: " + (json.error_description || json.error));
  return json.access_token;
}

async function main() {
  const days = Number(process.argv[2] ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("Gün sayısı 1–90 arası tam sayı olmalı.");
  const code = makeCode();
  assert.match(code, /^[A-Z2-9]{24}$/);
  const now = new Date(), expires = new Date(now.getTime() + days * 864e5);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/coachRegistrationInvites?documentId=${code}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {authorization: "Bearer " + await accessToken(), "content-type": "application/json"},
    body: JSON.stringify({fields: {
      status: {stringValue: "open"},
      expiresAt: {timestampValue: expires.toISOString()},
      createdAt: {timestampValue: now.toISOString()},
      updatedAt: {timestampValue: now.toISOString()}
    }})
  });
  if (!res.ok) throw new Error(`Davet yazılamadı (${res.status}): ${(await res.json()).error?.message || ""}`);
  console.log(`Koç davet kodu: ${code}`);
  console.log(`Son kullanma: ${expires.toLocaleString("tr-TR")} · tek kullanımlık`);
}

if (process.argv[1]?.endsWith("create-coach-invite.mjs")) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
