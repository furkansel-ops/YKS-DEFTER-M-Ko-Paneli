const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),css=read("coach-motion-v68.css"),js=read("coach-motion-v68.js");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const row=text=>'<div class="message-bubble-row incoming"><div class="message-bubble"><p>'+text+"</p></div></div>";

async function panel(t,{reduce=false}={}){
  const dom=new JSDOM('<body class="'+(reduce?"coach-reduce-motion":"")+'"><div id="appView" class="shell coach-shell-reset">'
    +'<section id="homePage" class="dashboard-page"><article class="stat-card"><strong id="statCompleted">—</strong></article></section>'
    +'<section id="studentsPage" class="students-page hidden"></section>'
    +'<section id="settingsPage" class="settings-page hidden"><section class="settings-section hidden" data-settings-panel="appearance"></section></section>'
    +'<div id="messageThread">'+row("bir")+row("iki")+"</div>"
    +'<p id="programTaskStatus" class="program-task-status hidden"></p><button id="sendBtn" class="btn primary" type="button">Gönder</button><button id="nextBtn" class="ghost" type="button">›</button>'
    +'<div class="student-connect-backdrop hidden" id="studentConnectBackdrop"><section class="student-connect-modal"><input type="radio" name="tur" checked><button id="closeBtn" type="button">Kapat</button></section></div>'
    +'<div class="error-photo-modal" id="errorPhotoModal" hidden><div class="error-photo-sheet"></div></div></div></body>',{runScripts:"outside-only",pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  dom.window.eval(js);
  await wait(40); // betik DOMContentLoaded ile kurulur
  return dom.window.document;
}

test("v68 hareket katmanı en son yüklenir, satır içi betik yok, yalnızca opacity/translate/scale/rotate oynar",()=>{
  assert.ok(html.indexOf("coach-motion-v68.css")>html.indexOf("admin-v65.css"),"stil dosyası diğer katmanlardan sonra gelmeli");
  assert.match(html,/<script defer src="\.\/coach-motion-v68\.js\?v=[\d.]+"><\/script>/);
  const frames=[...css.matchAll(/@keyframes [a-z-]+\{((?:[^{}]*\{[^{}]*\})+)\}/g)];
  assert.equal(frames.length,9);
  for(const [,body] of frames){
    const props=[...body.matchAll(/([a-z-]+):/g)].map(m=>m[1]);
    assert.deepEqual(props.filter(p=>!["opacity","translate","scale","rotate"].includes(p)),[],"düzeni kaydıran özellik olmamalı");
  }
  assert.doesNotMatch(css,/prefers-reduced-motion/,"Windows ayarına bağlı olmamalı; kapatma Ayarlar'daki düğmede");
  assert.doesNotMatch(js,/innerHTML|localStorage|addDoc|setDoc/,"yardımcı betik veri yazmamalı");
});

test("v68 ekran açılınca kısa süreli giriş işareti konur, süre dolunca kalkar; Ayarlar alt bölümü de aynı",async t=>{
  const doc=await panel(t),students=doc.getElementById("studentsPage"),section=doc.querySelector(".settings-section");
  assert.equal(doc.querySelector("[data-motion-enter]"),null,"yüklenince hiçbir ekran işaretli olmamalı");
  students.classList.remove("hidden");section.classList.remove("hidden");
  await wait(20);
  assert.ok(students.hasAttribute("data-motion-enter"));
  assert.ok(section.hasAttribute("data-motion-enter"));
  await wait(970);
  assert.equal(students.hasAttribute("data-motion-enter"),false,"işaret kalıcı olmamalı: canlı veri yenilenince animasyon tekrar oynamasın");
});

test("v68 Azaltılmış hareket açıkken hiçbir işaret konmaz ve sayılar saymaz",async t=>{
  const doc=await panel(t,{reduce:true}),students=doc.getElementById("studentsPage"),stat=doc.getElementById("statCompleted"),thread=doc.getElementById("messageThread");
  students.classList.remove("hidden");stat.textContent="24";thread.innerHTML=row("bir")+row("iki")+row("üç");
  await wait(60);
  assert.equal(doc.querySelector("[data-motion-enter],[data-motion-new]"),null);
  assert.equal(stat.textContent,"24");
});

test("v68 yalnızca yeni gelen mesaj balonu işaretlenir",async t=>{
  const doc=await panel(t),thread=doc.getElementById("messageThread");
  thread.innerHTML=row("bir")+row("iki")+row("üç");
  await wait(20);
  const marked=[...thread.querySelectorAll("[data-motion-new]")];
  assert.equal(marked.length,1);assert.equal(marked[0].textContent,"üç");
  thread.innerHTML=row("bir")+row("iki")+row("üç");
  await wait(20);
  assert.equal(thread.querySelector("[data-motion-new]"),null,"aynı liste yeniden çizilince balon tekrar oynamamalı");
});

test("v68 ana sayfa sayısı ilk gelişte sayarak dolar; panel yeni değer yazarsa o kalır",async t=>{
  const doc=await panel(t),stat=doc.getElementById("statCompleted");
  const seen=[];new (doc.defaultView.MutationObserver)(()=>seen.push(Number(stat.textContent))).observe(stat,{childList:true,characterData:true,subtree:true});
  stat.textContent="240";
  await wait(1000);
  assert.equal(stat.textContent,"240","sayma hedef değerde bitmeli");
  assert.ok(seen.some(v=>v>0&&v<240),"ara değerler görülmeli (gerçekten saymalı)");
  stat.textContent="—";await wait(20);
  stat.textContent="500";await wait(100);
  stat.textContent="31";
  await wait(900);
  assert.equal(stat.textContent,"31","panelin sonradan yazdığı değer ezilmemeli");
});

test("v68 durum yazısı gerçekten değişince beliriş işareti alır",async t=>{
  const doc=await panel(t),status=doc.getElementById("programTaskStatus");
  status.textContent="Görev eklendi";
  await wait(20);
  assert.ok(status.hasAttribute("data-motion-flash"));
  status.removeAttribute("data-motion-flash");
  status.textContent="Görev eklendi";
  await wait(20);
  assert.equal(status.hasAttribute("data-motion-flash"),false,"aynı metin yeniden yazılınca tekrar oynamamalı");
  status.textContent="";
  await wait(20);
  assert.equal(status.hasAttribute("data-motion-flash"),false,"boş metinde işaret konmamalı");
});

test("v68 dönen halka yalnızca tıklanan gönder türü düğmede, devre dışı kaldığı sürece görünür",async t=>{
  const doc=await panel(t),send=doc.getElementById("sendBtn"),next=doc.getElementById("nextBtn");
  send.click();send.disabled=true;
  await wait(20);
  assert.ok(send.hasAttribute("data-motion-busy"));
  send.disabled=false;
  await wait(20);
  assert.equal(send.hasAttribute("data-motion-busy"),false,"işlem bitince halka kalkmalı");
  next.click();next.disabled=true;
  await wait(20);
  assert.equal(next.hasAttribute("data-motion-busy"),false,"sınıra gelince kapanan ileri/geri düğmesinde halka çıkmamalı");
  send.disabled=true;
  await wait(20);
  assert.equal(send.hasAttribute("data-motion-busy"),false,"tıklanmadan devre dışı kalan düğmede halka çıkmamalı");
});

test("v68 pencere kapanınca asıl öğe hemen gizlenir, kapanış etkisiz bir kopyada oynar ve kopya kaldırılır",async t=>{
  const doc=await panel(t),back=doc.getElementById("studentConnectBackdrop"),photo=doc.getElementById("errorPhotoModal");
  back.classList.remove("hidden");photo.hidden=false;
  await wait(20);
  assert.equal(doc.querySelector("[data-motion-closing]"),null,"açılırken kopya oluşmamalı");
  back.classList.add("hidden");photo.hidden=true;
  await wait(20);
  const ghosts=[...doc.querySelectorAll("[data-motion-closing]")];
  assert.equal(ghosts.length,2);
  assert.ok(back.classList.contains("hidden")&&photo.hidden,"asıl pencereler gizli kalmalı");
  for(const ghost of ghosts){
    assert.ok(ghost.hasAttribute("inert"));assert.equal(ghost.getAttribute("aria-hidden"),"true");
    assert.equal(ghost.classList.contains("hidden"),false);assert.equal(ghost.hasAttribute("hidden"),false);
    assert.equal(ghost.querySelector("[name]"),null,"kopyadaki alan adları kaldırılmalı");
  }
  assert.equal(doc.getElementById("studentConnectBackdrop"),back,"kimlikle arama yine asıl öğeyi bulmalı");
  assert.equal(doc.querySelector("#studentConnectBackdrop input").checked,true,"asıl formdaki seçim bozulmamalı");
  await wait(260);
  assert.equal(doc.querySelector("[data-motion-closing]"),null,"kopya süre dolunca kaldırılmalı");
});

test("v68 Azaltılmış hareket açıkken durum, halka ve kapanış kopyası da yok",async t=>{
  const doc=await panel(t,{reduce:true}),status=doc.getElementById("programTaskStatus"),send=doc.getElementById("sendBtn"),back=doc.getElementById("studentConnectBackdrop");
  status.textContent="Kaydedildi";send.click();send.disabled=true;back.classList.remove("hidden");
  await wait(20);
  back.classList.add("hidden");
  await wait(20);
  assert.equal(doc.querySelector("[data-motion-flash],[data-motion-busy],[data-motion-closing]"),null);
});
