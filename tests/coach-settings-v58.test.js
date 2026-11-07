const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const DAY=86400000;

function fixture(t,{permission="granted",prefs=null}={}){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1",email:"koc@example.test",emailVerified:true}},errors=[],snaps=[],nexts=[];
  w.innerWidth=375;
  if(prefs)w.localStorage.setItem("yks_coach_ui_preferences_v2",JSON.stringify(prefs));
  class FakeNotification{static permission=permission;static async requestPermission(){return FakeNotification.permission}}
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),Notification:FakeNotification,
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},
    onSnapshot:(target,next)=>{const name=Array.isArray(target)?target[0]?.name:"doc:"+(target?.parts||[]).join("/");snaps.push(name);nexts.push([name,next]);return()=>{}},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;window.__v58={
  rows(){
    const now=Date.now(),link={active:true};
    coachReportRows=[
      {studentUid:"elif",link,share:{profile:{name:"Elif Yılmaz"},updatedAt:new Date(now-4*60000).toISOString()}},
      {studentUid:"zeynep",link,share:{profile:{name:"Zeynep Ak"},updatedAt:new Date(now-3*${DAY}).toISOString()}},
      {studentUid:"mert",link,share:{profile:{name:"Mert Kaya"},updatedAt:new Date(now-60000).toISOString()}},
      {studentUid:"eski",link:{active:false},share:null}
    ];
    coachV58Reports="ok";coachV56Live="live";
    coachV58ShareState.set("mert",{state:"error",error:{code:"permission-denied"}});
    coachV58RenderSync();
  },
  showApp(){showApp({displayName:"Furkan Koç",role:"coach"},window.getAuth().currentUser)},
  state(){return{reports:coachV58Reports,busy:coachV58Busy,note:coachV58Note,live:coachV56Live}}
};`);
  return{w,doc:w.document,errors,snaps,nexts};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};
const flush=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve))};

test("v58 Ayarlar ana: en üstte gerçek durum; verisi alınamayan ve eski öğrenci sayılır, bağlantısı kapalı öğrenci sayılmaz",t=>{
  const {w,doc,errors}=fixture(t);
  const card=doc.getElementById("coachV58SyncCard");
  assert.equal(card.previousElementSibling.classList.contains("coach-settings-search"),true,"arama kutusunun hemen altında");
  assert.equal(doc.getElementById("coachV58SyncSummary").textContent,"Bağlanıyor…");
  w.__v58.rows();
  assert.equal(doc.getElementById("coachV58SyncSummary").textContent,"Canlı · 1 öğrencinin verisi alınamadı · 1 öğrencinin verisi eski");
  assert.equal(card.querySelector(".coach-v58-dot").dataset.tone,"bad");
  assert.deepEqual(errors,[]);
});

test("v58 Bağlantı ve eşitleme ayrıntısı: internet, mesajlar, öğrenci verileri; sorunlu öğrenci adıyla, ne yapılacağıyla ve düğmesiyle",t=>{
  const {w,doc}=fixture(t);
  w.__v58.rows();
  doc.getElementById("coachV58SyncCard").click();
  assert.equal(doc.getElementById("coachSettingsDetailTitle").textContent,"Bağlantı ve eşitleme");
  const lines=[...doc.querySelectorAll("#coachV58SyncDetail .coach-v58-line")];
  assert.deepEqual(lines.map(x=>x.querySelector("b").textContent),["İnternet","Mesajlar","Öğrenci verileri","Mert Kaya · veri alınamadı","Zeynep Ak · veri eski"]);
  assert.equal(text(lines[0]),"İnternet Bağlı");
  assert.equal(text(lines[1]),"Mesajlar Canlı");
  assert.equal(text(lines[2]),"Öğrenci verileri 3 öğrenci · son veri 1 dk önce 2 sorun");
  assert.match(text(lines[3]),/İzin yok: bağlantı kapalı olabilir\. Öğrenciler'den bağlantıyı kontrol et\. Öğrenciler$/);
  assert.match(text(lines[4]),/Son eşitleme 3 gün önce\. Öğrenci uygulamayı açıp internete bağlanınca kendiliğinden gelir; gerekirse ona mesaj at\. Mesaj$/);
  assert.equal(lines[3].dataset.tone,"bad");assert.equal(lines[4].dataset.tone,"warn");
  lines[4].querySelector("[data-v58-message]").click();
  assert.equal(doc.getElementById("messagesPage").classList.contains("hidden"),false,"Mesaj → o öğrencinin konuşması");
  doc.querySelector('[data-coach-page="settings"]').click();doc.getElementById("coachV58SyncCard").click();
  doc.querySelector("#coachV58SyncDetail [data-v58-go]").click();
  assert.equal(doc.getElementById("studentsPage").classList.contains("hidden"),false,"Öğrenciler → Öğrenciler sayfası");
});

test("v58 internet yoksa durum satırı ve ayrıntı bunu söyler",t=>{
  const {w,doc}=fixture(t);
  w.__v58.rows();
  Object.defineProperty(w.navigator,"onLine",{configurable:true,get:()=>false});
  w.dispatchEvent(new w.Event("offline"));
  assert.equal(doc.getElementById("coachV58SyncSummary").textContent,"Bağlantı yok · internet bekleniyor");
  doc.getElementById("coachV58SyncCard").click();
  assert.match(text(doc.querySelector("#coachV58SyncDetail .coach-v58-line")),/^İnternet Bağlantı gelince panel kendiliğinden eşitlenir\. Yok$/);
});

test("v58 Yeniden bağlan: öğrenci, mesaj ve randevu dinleyicileri baştan kurulur, saatle sonuç yazar",async t=>{
  const {w,doc,snaps,nexts,errors}=fixture(t);
  w.__v58.rows();
  doc.getElementById("coachV58SyncCard").click();
  const before=snaps.length;
  doc.getElementById("coachV58Reconnect").click();
  assert.equal(doc.getElementById("coachV58Reconnect").disabled,true);
  assert.equal(doc.getElementById("coachV58Reconnect").textContent,"Yeniden bağlanıyor…");
  await flush();
  const added=snaps.slice(before);
  assert.ok(added.includes("coachingMessages"),"mesaj dinleyicisi yeniden kuruldu: "+added);
  assert.ok(added.includes("coachAppointments"),"randevu dinleyicisi yeniden kuruldu: "+added);
  const state=w.__v58.state();
  assert.equal(state.busy,false);assert.equal(state.reports,"ok");
  assert.match(text(doc.getElementById("coachV58SyncDetail")),/Yeniden bağlandı · \d{2}:\d{2}$/);
  assert.equal(doc.getElementById("coachV58SyncSummary").textContent,"Bağlanıyor…","sunucu cevap verene kadar");
  nexts.filter(([name])=>name==="coachingMessages").at(-1)[1]({docs:[]});
  assert.equal(doc.getElementById("coachV58SyncSummary").textContent,"Canlı");
  assert.deepEqual(errors,[]);
});

test("v58 bildirim: Ayarlar'daki iki anahtar ve Mesajlar'daki düğme aynı tercih",async t=>{
  const {w,doc}=fixture(t);
  const inputs=[...doc.querySelectorAll("[data-v58-notify]")];
  assert.equal(inputs.length,2);assert.ok(doc.getElementById("settingsMessageNotify"));
  assert.ok(inputs.every(x=>!x.checked&&!x.disabled));
  inputs[0].click();await flush();
  assert.equal(JSON.parse(w.localStorage.getItem("yks_coach_ui_preferences_v2")).messageNotify,true);
  assert.ok(inputs.every(x=>x.checked),"iki anahtar da açık");
  assert.equal(doc.getElementById("messageNotifyBtn").textContent,"🔔 Yeni mesajda bildirim: Açık");
  doc.getElementById("settingsMessageNotify").click();await flush();
  assert.equal(JSON.parse(w.localStorage.getItem("yks_coach_ui_preferences_v2")).messageNotify,false);
  assert.ok(inputs.every(x=>!x.checked));
  assert.equal(doc.getElementById("messageNotifyBtn").textContent,"🔔 Yeni mesajda bildirim: Kapalı");
});

test("v58 bildirim tarayıcıda engelliyse anahtar kilitli ve nedenini yazar",t=>{
  const {doc}=fixture(t,{permission:"denied"});
  assert.ok([...doc.querySelectorAll("[data-v58-notify]")].every(x=>x.disabled));
  assert.equal(doc.querySelector("[data-v58-notify-note]").textContent,"Bildirim tarayıcıda engelli; tarayıcının site ayarlarından izin ver");
});

test("v58 açılış ekranı Paragraf + Problem ve Randevular'ı da açar; hesap bilgisi gerçek",t=>{
  const {w,doc,errors}=fixture(t,{prefs:{defaultPage:"appointments"}});
  assert.deepEqual([...doc.querySelectorAll("#settingsDefaultPage option")].map(x=>x.value),["home","students","programs","reports","paragraphProblem","exams","topics","errors","messages","appointments"]);
  w.__v58.showApp();
  assert.equal(doc.getElementById("appointmentsPage").classList.contains("hidden"),false);
  assert.equal(doc.getElementById("settingsDefaultPage").value,"appointments");
  assert.equal(doc.getElementById("settingsAccountVerified").textContent,"Doğrulandı");
  const account=text(doc.querySelector('[data-settings-panel="account"] .settings-account-list'));
  assert.doesNotMatch(account,/Firebase|senkron/i);
  assert.match(account,/Tercihler Tema, açılış ekranı, mesaj taslakları Bu tarayıcıda/);
  assert.match(text(doc.querySelector('[data-settings-panel="account"] .settings-account-card')),/Oturum açık/);
  assert.deepEqual(errors,[]);
});

test("v58 kısa Görünüm: büyük yoğunluk kartları ve canlı önizleme yok; iki seçenek anında uygular",t=>{
  const {doc}=fixture(t);
  const panel=doc.querySelector('[data-settings-panel="appearance"]');
  assert.equal(panel.querySelector(".appearance-density-card,.appearance-live-card,#appearanceLivePreview"),null);
  const seg=[...panel.querySelectorAll(".coach-v58-seg [data-density]")];
  assert.deepEqual(seg.map(x=>x.textContent),["Standart","Kompakt"]);
  seg[1].click();
  assert.equal(doc.body.classList.contains("coach-compact"),true);
  assert.equal(seg[1].classList.contains("active"),true);assert.equal(seg[0].classList.contains("active"),false);
  assert.equal(doc.getElementById("appearanceDensityLabel").textContent,"Kompakt");
  assert.ok(panel.querySelector("#settingsReduceMotion"));
  assert.match(text(panel),/Değişiklikler anında uygulanır\.$/);
});

test("v58 Gece ve Canlı öğrencideki v85 paletiyle aynı; tarayıcı çubuğu yeni zemin rengi",t=>{
  const {doc}=fixture(t);
  const css=read("coach-themes-v36.css"),block=name=>css.slice(css.indexOf(':root[data-theme="'+name+'"]{'),css.indexOf("}",css.indexOf(':root[data-theme="'+name+'"]{')));
  for(const token of ["--k-bg:#192134","--k-surface:#222c46","--k-soft:#2c3753","--k-ink:#f2f5fc","--k-line:#3a4769","--k-accent:#8aacff"])assert.ok(block("night").includes(token),"Gece "+token);
  for(const token of ["--k-bg:#fff0e4","--k-soft:#f3eaff","--k-ink:#1c1433","--k-line:#f0dccd","--k-accent:#6a2cff"])assert.ok(block("vivid").includes(token),"Canlı "+token);
  assert.match(css,/data-swatch="night"\]\{background:linear-gradient\(90deg,#192134/);
  doc.querySelector('[data-coach-theme="vivid"]').click();
  assert.equal(doc.querySelector('meta[name="theme-color"]').content,"#6a2cff");
  const tokens=read("coach-theme-tokens-v36.css"),night=tokens.slice(tokens.indexOf(':root[data-theme="night"]'),tokens.indexOf(':root[data-theme="vivid"]'));
  assert.match(night,/--kc-ffffff:#222c46;/,"Gece'de beyaz kart = öğrencinin Gece kartı");
});

test("v58 dosyalar: stil ve sürüm iğnesi; ham renk yok; kategori metinleri",()=>{
  const html=read("index.html"),css=read("settings-v58.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/settings-v58\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-pp57-settings58"/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,""),/#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.match(html,/<b>Mesajlar ve bildirim<\/b><small>Ctrl\+Enter, hızlı mesajlar, tarayıcı bildirimi<\/small>/);
  assert.match(html,/<b>Hesap ve oturum<\/b><small>Giriş, e-posta doğrulama, çıkış<\/small>/);
});
