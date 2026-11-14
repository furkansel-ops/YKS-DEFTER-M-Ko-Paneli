const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {ALPHABET,makeInviteCode,inviteStatus,inviteRows,invitesHtml}=require("../coach-invites-v75.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("v75 kod: kuraldaki biçim; 238 ve üstü baytlar atılır (kayma yok)",()=>{
  for(let i=0;i<200;i++)assert.match(makeInviteCode(n=>crypto.randomBytes(n)),/^[A-Z2-9]{24}$/);
  assert.equal(ALPHABET.length,34);
  // Sabit bayt dizisi: 255 ve 238 atılır, 0 → A, 33 → 9, 237 (=6*34+33) → 9
  let calls=0;const code=makeInviteCode(n=>{calls++;return Uint8Array.from({length:n},(_,i)=>[255,238,0,33,237][i%5])});
  assert.equal(code,"A99".repeat(8));assert.equal(calls,1);
});

test("v75 liste: durum, sıralama, geçersiz kimlik dışarıda, kaçışlı HTML",()=>{
  const now=Date.UTC(2026,10,14),day=864e5,ts=ms=>({toMillis:()=>ms});
  assert.equal(inviteStatus({status:"used",expiresAt:ts(now+day)},now),"used");
  assert.equal(inviteStatus({status:"open",expiresAt:ts(now-1)},now),"expired");
  assert.equal(inviteStatus({status:"open",expiresAt:ts(now+1)},now),"open");
  const A="A".repeat(24),B="B".repeat(24),C="C".repeat(24),D="D".repeat(24);
  const rows=inviteRows([
    {id:A,data:{status:"used",expiresAt:ts(now+day),createdAt:ts(now-3*day),usedAt:ts(now-day)}},
    {id:B,data:{status:"open",expiresAt:ts(now+9*day),createdAt:ts(now-day)}},
    {id:C,data:{status:"open",expiresAt:ts(now+2*day),createdAt:ts(now-5*day)}},
    {id:D,data:{status:"open",expiresAt:ts(now-day),createdAt:ts(now-9*day)}},
    {id:"<x>",data:{status:"open",expiresAt:ts(now+day)}}
  ],now);
  assert.deepEqual(rows.map(r=>r.code[0]+r.status),["Copen","Bopen","Aused","Dexpired"]);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const html=invitesHtml(rows,{esc,fmtDate:ms=>new Date(ms).toISOString().slice(0,10)});
  assert.equal((html.match(/data-v75-cancel=/g)||[]).length,2,"yalnız açık davet iptal edilir");
  assert.match(html,/Kullanıldı · Kullanıldı: 2026-11-13/);
  assert.match(invitesHtml([],{esc,fmtDate:String}),/Henüz davet yok/);
});

test("v75 bağlantı: yalnız yöneticide görünür; üretim, liste, iptal ve sayfa parçaları",()=>{
  const app=read("app-reset.js"),html=read("index.html"),css=read("coach-invites-v75.css");
  assert.match(html,/id="coachInvitesCategory" data-settings-tab="invites"[^>]*hidden>/);
  assert.match(html,/data-settings-panel="invites"[\s\S]*?id="coachInviteCreate"[\s\S]*?id="coachInviteList"/);
  assert.match(html,/<script defer src="\.\/coach-invites-v75\.js\?v=1\.0\.0"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-invites-v75\.css\?v=1\.0\.0">/);
  assert.match(app,/coachV75Admin=\(await getDoc\(doc\(db,"admins",uid\)\)\)\.exists\(\)/);
  assert.match(app,/category\.hidden=!coachV75Admin/);
  assert.match(app,/setDoc\(doc\(db,"coachRegistrationInvites",code\),\{status:"open",expiresAt:new Date\(Date\.now\(\)\+days\*864e5\),createdAt:serverTimestamp\(\),updatedAt:serverTimestamp\(\),createdBy:user\.uid\}\)/);
  assert.match(app,/crypto\.getRandomValues\(new Uint8Array\(n\)\)/);
  assert.match(app,/if\(!confirm\(code\+" davetini iptal etmek istiyor musun\?/);
  assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b|rgb\(/i,"ham renk yok");
});
