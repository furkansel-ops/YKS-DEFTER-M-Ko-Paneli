const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const THUMB="data:image/jpeg;base64,QUJD";

function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},listeners={},writes=[],gets=[],errors=[];
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},
    onSnapshot:(q,cb)=>{listeners[Array.isArray(q)?q[0].name:q.path]=cb;return()=>{}},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",
    getDoc:async ref=>{gets.push(ref.path);return{exists:()=>true,data:()=>({image:"data:image/jpeg;base64,QklH"})}},
    getDocs:async()=>({docs:[]}),setDoc:async()=>{},addDoc:async()=>({id:"x"}),
    updateDoc:async(ref,data)=>{writes.push({path:ref.path,data})},
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{coachReportRows=[{studentUid:"elif",share:{profile:{name:"Elif Yılmaz"},errorJournal:[{date:"2026-10-30",subject:"Fizik",topic:"Kuvvet",n:2}]}},{studentUid:"mert",share:{profile:{name:"Mert Kaya"},errorJournal:[]}}];
  hydrateErrorControls();startCoachShareRealtime();showCoachPage("errors");}`);
  const photo=(id,extra)=>({id:"elif_"+id,data:()=>({studentUid:"elif",coachUid:"coach-1",photoKey:id,wrongId:id.split("-")[0],subject:"Fizik",topic:"Kuvvet",date:"2026-10-30",exam:"11",examName:"Özdebir TYT-4",question:"12",kind:"bilmiyordum",note:"Bileşen unuttum",thumb:THUMB,...extra})});
  return{w,doc:w.document,listeners,writes,gets,errors,photo};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test("v52 koç fotoğraf arşivi: tek dinleyici, durum süzgeci, tekrar eden konu ve önizleme ızgarası",t=>{
  const {doc,listeners,errors,photo}=fixture(t);
  assert.ok(listeners.coachingErrorPhotos,"coachUid ile tek sorgu");
  assert.equal(doc.getElementById("errorPhotoSection").hidden,true,"fotoğraf yoksa bölüm gizli");
  listeners.coachingErrorPhotos({docs:[photo("1-0"),photo("1-1",{exam:"9",examName:"3D TYT-3",date:"2026-10-16"}),photo("2-0",{subject:"Kimya",topic:"Mol",coachStatus:"review",coachComment:"Tekrar et"}),photo("3-0",{thumb:"javascript:alert(1)",subject:"Tarih",topic:"Osmanlı",coachStatus:"solved"}),{id:"x_9-0",data:()=>({studentUid:"yabanci",coachUid:"coach-1",photoKey:"9-0",subject:"Fizik",topic:"Kuvvet",thumb:THUMB})}]});
  assert.equal(doc.getElementById("errorPhotoSection").hidden,false);
  assert.equal(text(doc.getElementById("errorPhotoChips")),"Açık 2 Tekrar gerekli 1 Çözüldü 1 Tümü","bağlı olmayan öğrencinin fotoğrafı sayılmaz");
  assert.equal(doc.querySelectorAll("#errorPhotoGrid .error-photo-item").length,2,"varsayılan: açık");
  assert.match(text(doc.getElementById("errorPhotoRepeat")),/Fizik · Kuvvet Elif Yılmaz · 2 denemede · 2 fotoğraf konu eksiği/);
  doc.querySelector('[data-photo-filter="all"]').click();
  const items=[...doc.querySelectorAll("#errorPhotoGrid .error-photo-item")];
  assert.equal(items.length,4);
  const fizik=items.find(item=>/Özdebir/.test(item.textContent)&&/Fizik/.test(item.textContent));
  assert.match(text(fizik),/^açık Fizik · Kuvvet Özdebir TYT-4 · S\.12 · 30 Eki Elif Yılmaz$/);
  const tarih=items.find(item=>/Tarih/.test(item.textContent));assert.equal(tarih.querySelector("img"),null,"veri olmayan adres resim olarak basılmaz");
  assert.deepEqual(errors,[]);
});

test("v52 fotoğraf ayrıntısı: büyük fotoğraf açınca okunur; koç yorumu ve durumu yalnız kendi alanlarına yazılır",async t=>{
  const {w,doc,listeners,writes,gets,errors,photo}=fixture(t);
  listeners.coachingErrorPhotos({docs:[photo("1-0")]});
  doc.querySelector("#errorPhotoGrid .error-photo-item").click();
  const modal=doc.getElementById("errorPhotoModal");assert.equal(modal.hidden,false);
  assert.equal(doc.getElementById("errorPhotoTitle").textContent,"Fizik · Kuvvet");
  assert.match(text(doc.getElementById("errorPhotoMeta")),/Deneme Özdebir TYT-4 Soru 12 Ders · konu Fizik · Kuvvet Tarih 30 Eki Hata türü bilgi eksiği/);
  assert.match(text(doc.getElementById("errorPhotoNote")),/Öğrencinin notu Bileşen unuttum/);
  await flush();
  assert.deepEqual(gets,["coachingErrorPhotoImages/elif_1-0"]);assert.equal(doc.getElementById("errorPhotoImage").getAttribute("src"),"data:image/jpeg;base64,QklH");
  doc.getElementById("errorPhotoComment").value="  cos37 = 0,8 kullan  ";
  doc.querySelector('[data-photo-status="review"]').click();await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{path:"coachingErrorPhotos/elif_1-0",data:{coachComment:"cos37 = 0,8 kullan",coachStatus:"review",coachAt:"NOW"}}]);
  assert.equal(doc.querySelector('[data-photo-status="review"]').getAttribute("aria-pressed"),"true");
  assert.match(doc.getElementById("errorPhotoStatus").textContent,/Kaydedildi/);
  doc.querySelector('[data-photo-status="review"]').click();await flush();
  assert.equal(writes.at(-1).data.coachStatus,"","aynı duruma tekrar basınca kalkar");
  w.document.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape"}));assert.equal(modal.hidden,true);
  assert.deepEqual(errors,[]);
});

test("v52 stil, sürüm ve koç hesabı silinince paylaşılan fotoğraflar da silinir",()=>{
  const html=read("index.html"),css=read("errors-photo-v52.css"),authJs=read("coach-auth-v34.js");
  assert.match(html,/<link rel="stylesheet" href="\.\/errors-photo-v52\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-exams52-photos52(-[a-z0-9]+)*"/);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i,"ham renk kalmadı");
  assert.match(authJs,/for\(const name of \["coachingErrorPhotos","coachingErrorPhotoImages"\]\)\{const photos=await byCoach\(name\)/);
});
