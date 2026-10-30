const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("panel eski mavi görünümde; giriş ekranı stili en son yüklenir",()=>{
  const html=read("index.html");
  assert.match(html,/coach-mobile-compat-v33\.css\?v=[^"]+">\s*<link rel="stylesheet" href="\.\/coach-auth-v34\.css\?v=1\.1\.\d+[^"]*">/);
  assert.match(html,/<meta name="theme-color" content="#0d1728">/);
  assert.ok(!fs.existsSync(path.join(root,"coach-notebook-v34.css")));
  const css=fs.readdirSync(root).filter(f=>f.endsWith(".css")).map(read).join("\n").toLowerCase();
  assert.ok(css.includes("#2873f0"),"mavi vurgu geri gelmeli");
  for(const notebook of ["#7c2d10","#9c3a12","#f6f1e7","--nb-serif"])assert.ok(!css.includes(notebook),notebook+" kaldı");
  assert.doesNotMatch(read("coach-auth-v34.css"),/@import|@font-face|url\(\s*["']?https?:/);
});

test("giriş ekranı e-posta, Google ve kayıt sekmesini aynı sayfada sunar; eski kimlikler korunur",()=>{
  const html=read("index.html");
  assert.match(html,/id="authView" class="auth-page hidden"/);
  for(const id of ["authStatus","signInBtn","nbLoginForm","nbRegisterForm","nbAuthTitle"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/data-nb-mode="register"/);
  assert.match(html,/<script type="module" src="\.\/coach-auth-v34\.js\?v=1\.1\.\d+"><\/script>/);
  assert.match(read("register.html"),/location\.replace\("\.\/#register"\)/);
});

test("koç auth modülü doğrulanmamış e-postayı içeri almaz ve öğrenci hesabını koç yapmaz",()=>{
  const js=read("coach-auth-v34.js");
  assert.match(js,/if\(!user\.emailVerified\)\{\s*await verifyMail\(user\);await signOut\(auth\);/);
  assert.match(js,/throw new Error\("Bu hesap öğrenci hesabı olarak kayıtlı/);
  assert.match(js,/role:"coach",displayName:fields\.displayName/);
  assert.match(js,/sendPasswordResetEmail/);
  assert.match(js,/createUserWithEmailAndPassword/);
  assert.match(js,/window\.__YKS_COACH_AUTH_BUSY__=true/);
  assert.match(read("app-reset.js"),/if\(window\.__YKS_COACH_AUTH_BUSY__\)return;\s*if\(!user\)\{/);
});

test("Ayarlar › Hesap giriş yöntemini gösterir; e-posta hesaplarında şifre değiştirme vardır",()=>{
  const html=read("index.html"),js=read("coach-auth-v34.js");
  for(const id of ["settingsAccountMethod","settingsAccountNote","settingsPasswordBtn","settingsSessionNote"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,/reset\.hidden=!password/);
});

test("koç hesabını silme: önce kimlik, sonra koçun verileri, en son hesap; öğrenci verisine dokunmaz",()=>{
  const html=read("index.html"),js=read("coach-auth-v34.js");
  for(const id of ["coachDeleteOpenBtn","coachDeleteDialog","coachDeletePassword","coachDeleteConfirm","coachDeleteConfirmBtn"])assert.match(html,new RegExp('id="'+id+'"'));
  const run=js.slice(js.indexOf("async function runDelete"),js.indexOf('$("coachDeleteOpenBtn")?.addEventListener'));
  const reauth=run.indexOf("reauthenticateWith"),data=run.indexOf("deleteCoachData("),remove=run.indexOf("deleteUser(");
  assert.ok(reauth>0&&data>reauth&&remove>data,"sıra: yeniden doğrulama → veriler → hesap");
  const data2=js.slice(js.indexOf("async function deleteCoachData"),js.indexOf("function clearCoachDeviceData"));
  assert.match(data2,/where\("coachUid","==",uid\)/);
  assert.match(data2,/active:false,endedAt:serverTimestamp\(\),updatedAt:serverTimestamp\(\)/);
  assert.doesNotMatch(data2,/coachingShares|studentCoachAccess|users\//);
  assert.match(js,/key\.startsWith\("yks-coach-week-draft-v7:"\)/);
  assert.doesNotMatch(js,/localStorage\.clear/);
  // v39: koç notları buluttan ve cihazdan silinir; kural yayında değilse izin hatası silmeyi durdurmaz.
  const notes=data2.indexOf('doc(db,"coachNotes",uid)'),profile=data2.indexOf("Koç profili siliniyor");
  assert.ok(notes>0&&notes<profile,"notlar profilden önce silinir");
  assert.match(data2,/catch\(error\)\{if\(!String\(error\?\.code\|\|""\)\.includes\("permission-denied"\)\)throw error\}/);
  assert.match(js,/key\.startsWith\("yks_coach_notes_v1:"\)/);
});
