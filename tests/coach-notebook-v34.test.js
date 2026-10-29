const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Defter görünümü en son yüklenir ve eski mavi palet CSS'lerde kalmaz",()=>{
  const html=read("index.html");
  assert.match(html,/coach-mobile-compat-v33\.css\?v=[^"]+">\s*<link rel="stylesheet" href="\.\/coach-notebook-v34\.css\?v=1\.0\.0">/);
  assert.match(html,/<meta name="theme-color" content="#f6f1e7">/);
  const css=fs.readdirSync(root).filter(f=>f.endsWith(".css")).map(read).join("\n").toLowerCase();
  for(const blue of ["#2873f0","#1268f5","#edf5ff","#347beb","#76b7ff"])assert.ok(!css.includes(blue),blue+" kaldı");
  const nb=read("coach-notebook-v34.css");
  assert.match(nb,/--nb-deep:#7c2d10/);
  assert.match(nb,/font-family:var\(--nb-serif\)!important/);
  assert.doesNotMatch(nb,/@import|@font-face|url\(\s*["']?https?:/);
});

test("giriş ekranı e-posta, Google ve kayıt sekmesini aynı sayfada sunar; eski kimlikler korunur",()=>{
  const html=read("index.html");
  assert.match(html,/id="authView" class="auth-page hidden"/);
  for(const id of ["authStatus","signInBtn","nbLoginForm","nbRegisterForm","nbAuthTitle"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/data-nb-mode="register"/);
  assert.match(html,/<script type="module" src="\.\/coach-auth-v34\.js\?v=1\.0\.0"><\/script>/);
  assert.match(read("register.html"),/location\.replace\("\.\/#register"\)/);
});

test("koç auth modülü doğrulanmamış e-postayı içeri almaz ve öğrenci hesabını koç yapmaz",()=>{
  const js=read("coach-auth-v34.js");
  assert.match(js,/if\(!user\.emailVerified\)\{\s*await verifyMail\(user\);await signOut\(auth\);/);
  assert.match(js,/throw new Error\("Bu hesap öğrenci hesabı olarak kayıtlı/);
  assert.match(js,/role:"coach",displayName:fields\.displayName/);
  assert.match(js,/sendPasswordResetEmail/);
  assert.match(js,/createUserWithEmailAndPassword/);
  // Akış sürerken app-reset profil kontrolünü bekletir.
  assert.match(js,/window\.__YKS_COACH_AUTH_BUSY__=true/);
  assert.match(read("app-reset.js"),/if\(window\.__YKS_COACH_AUTH_BUSY__\)return;\s*if\(!user\)\{/);
});

test("Ayarlar › Hesap giriş yöntemini gösterir; e-posta hesaplarında şifre değiştirme vardır",()=>{
  const html=read("index.html"),js=read("coach-auth-v34.js");
  for(const id of ["settingsAccountMethod","settingsAccountNote","settingsPasswordBtn","settingsSessionNote"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,/reset\.hidden=!password/);
});
