// v75 · Bir koç hesabını yönetici yapar: Koç Paneli › Ayarlar › Koç davetleri bu hesapta açılır.
// Kullanım: node scripts/make-admin.mjs <uid>   (uid: Firebase konsolu › Authentication › kullanıcı satırı)
//           node scripts/make-admin.mjs --remove <uid>
// Önce `firebase login` gerekir; proje sahibi kimliğiyle (IAM) yazar. Kurallar istemcinin admins'e yazmasını yasaklar.
import {accessToken} from "./create-coach-invite.mjs";

const PROJECT = "yks-uygulamam";
const args = process.argv.slice(2), remove = args[0] === "--remove", uid = remove ? args[1] : args[0];

async function main() {
  if (!/^[A-Za-z0-9]{20,128}$/.test(uid || "")) throw new Error("Geçerli bir kullanıcı uid'i ver (Authentication sayfasındaki 'Kullanıcı UID').");
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/admins`;
  const headers = {authorization: "Bearer " + await accessToken(), "content-type": "application/json"};
  const res = remove
    ? await fetch(`${base}/${uid}`, {method: "DELETE", headers})
    : await fetch(`${base}?documentId=${uid}`, {method: "POST", headers, body: JSON.stringify({fields: {createdAt: {timestampValue: new Date().toISOString()}}})});
  if (!res.ok) throw new Error(`Yazılamadı (${res.status}): ${(await res.json().catch(() => ({}))).error?.message || ""}`);
  console.log(remove ? `Yönetici kaldırıldı: ${uid}` : `Yönetici eklendi: ${uid}`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
