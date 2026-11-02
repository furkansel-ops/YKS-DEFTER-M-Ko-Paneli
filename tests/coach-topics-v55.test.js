const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function fixture(t,{full=true}={}){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},errors=[];
  w.innerWidth=375;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),writeBatch:()=>({delete(){},commit:async()=>{}}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{const iso=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
  const it=(key,st,extra={})=>{const p=key.split("|");return{key,exam:p[0],subject:p[1],topic:p[2],st,deadline:"",...extra}};
  const items=[it("TYT|Matematik|Problemler",2,{conf:2}),it("TYT|Matematik|Fonksiyonlar",1),it("TYT|Matematik|Olasılık",0),it("TYT|Fizik|Optik",3,{ts:iso(-10),rev:[0]}),
    it("TYT|Türkçe|Paragraf",3,{ts:iso(-4),rev:[0]}),it("AYT|Matematik (AYT)|Türev",3,{ts:iso(-1)}),it("AYT|Edebiyat|Divan Edebiyatı",1),it("YDT|Yabancı Dil|Kelime",0)];
  const week=programCurrentWeekStart(),day=["Problemler çöz","","Fonksiyonlar konu anlatımı · 40 soru","","","",""];
  window.__week=week;
  coachReportRows=[{studentUid:"elif",link:{id:"l1",active:true},share:{profile:{name:"Elif Yılmaz",track:"SAY"},updatedAt:new Date().toISOString(),
      topics:${full?"{items,full:true}":"{items:items.filter(x=>x.st>0)}"},errorJournal:[{subject:"Matematik",topic:"Problemler",n:5}],program:{weeks:[{week,data:{r:[["","","Fonksiyonlar konu anlatımı · 40 soru","","","",""]]}}],rowLabels:{r:["Ders"]}},exams:[],progress:{}}},
    {studentUid:"zeynep",link:{id:"l2",active:true},share:{profile:{name:"Zeynep Ak",track:"SÖZ"},updatedAt:new Date().toISOString(),topics:{items:[it("TYT|Tarih|Osmanlı",1)]},errorJournal:[],program:{weeks:[]},exams:[],progress:{}}}];
  renderTopicAnalysis("all");}`);
  return{w,doc:w.document,errors};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};
const choose=(w,doc,uid)=>{const s=doc.getElementById("topicV55Student");s.value=uid;s.dispatchEvent(new w.Event("change"));};

test("v55 tüm öğrenciler: öğrenci kartı TYT/AYT yüzdesi ve en öncelikli konu; eski sürüm işaretlenir",t=>{
  const {doc,errors}=fixture(t);
  assert.equal(doc.getElementById("topicsPage").dataset.v55,"on");
  const cards=[...doc.querySelectorAll("#topicV55Body .topic-v55-student")];
  assert.equal(cards.length,2);
  assert.match(text(cards[0]),/^E Elif Yılmaz SAY · Son eşitleme .* 1 tekrar gecikti TYT %40 · 2\/5 AYT Sayısal %100 · 1\/1 Problemler · Matematik 5 yanlış güven 2\/5 Görev ver$/);
  assert.match(text(cards[1]),/Zeynep Ak SÖZ .* eski sürüm/);
  assert.deepEqual(errors,[]);
});

test("v55 öğrenci: sekmeler, aşamalar, tekrar zamanı, nedenli öncelik ve 'Programda' etiketi",t=>{
  const {w,doc,errors}=fixture(t);
  choose(w,doc,"elif");
  const body=doc.getElementById("topicV55Body");
  assert.deepEqual([...body.querySelectorAll("[data-v55-exam]")].map(b=>b.textContent),["TYT · 5 konu","AYT Sayısal · 1 konu"],"AYT yalnız alan dersleri (Edebiyat SAY'da yok)");
  const cards=[...body.querySelectorAll(".topic-v55-card")];
  assert.match(text(cards[0]),/TYT ilerlemesi %40 2 \/ 5 konu pekişti Pekiştirdim 2 Soru çözdüm 1 İşledim 1 Başlanmadı 1/);
  assert.match(text(cards[1]),/Tekrar zamanı 1 gecikti 1 bu hafta Optik · Fizik 2\. tekrar \(7\. gün\) · 3 gün gecikti Görev ver Paragraf · Türkçe 2\. tekrar \(7\. gün\) · /);
  assert.match(text(cards[2]),/Önce bunlara bak Problemler · Matematik 5 yanlış güven 2\/5 Soru çözdüm Görev ver Optik · Fizik tekrar 3 gün gecikti Pekiştirdim/);
  body.querySelector('[data-v55-subject="elif|TYT|Matematik"]').click();
  const topics=text(doc.querySelector(".topic-v55-subject.is-open .topic-v55-topics"));
  assert.match(topics,/Problemler Soru çözdüm · 5 yanlış ★★☆☆☆ Görev ver Fonksiyonlar İşledim Programda · Çar Olasılık Başlanmadı Görev ver/);
  body.querySelector('[data-v55-exam="AYT"]').click();
  assert.match(text(body.querySelector(".topic-v55-card")),/AYT Sayısal ilerlemesi %100 1 \/ 1/);
  assert.deepEqual(errors,[]);
});

test("v55 Görev ver: program penceresi öğrenci, seviye, ders, konu ve tür hazır açılır",t=>{
  const {w,doc}=fixture(t);
  choose(w,doc,"elif");
  doc.querySelector('[data-v55-assign="elif"][data-v55-key="TYT|Fizik|Optik"]').click();
  assert.equal(doc.getElementById("programTaskBackdrop").classList.contains("hidden"),false);
  assert.equal(doc.getElementById("programBuilderSubject").value,"Fizik");
  assert.equal(doc.getElementById("programBuilderTopic").value,"Optik");
  assert.equal(doc.getElementById("programBuilderActivity").value,"Tekrar","gecikmiş tekrar → Tekrar");
  assert.equal(doc.querySelector('#programBuilderLevel [data-plan-level="TYT"]')?.getAttribute("aria-pressed"),"true");
  assert.match(doc.getElementById("programTaskStudentName").textContent,/^Elif Yılmaz için yeni çalışma$/);
});

test("v55 arama ve eski girişler: Deneme Analizi'nden konuya git aramayı doldurur; eski paylaşımda uyarı",t=>{
  const {w,doc}=fixture(t,{full:false});
  w.eval('examOpenTopic("elif","Matematik","Problem")');
  assert.equal(doc.getElementById("topicV55Student").value,"elif");
  assert.equal(doc.getElementById("topicV55Search").value,"Problem");
  const body=doc.getElementById("topicV55Body");
  assert.match(text(body),/Öğrenci uygulaması güncellenince müfredatın tamamı/);
  assert.match(text(body.querySelector(".topic-v55-subject.is-open")),/Matematik 0 \/ 2 Problemler Soru çözdüm · 5 yanlış/,"arama eşleşen dersi açar, diğer konuları gizler");
  assert.equal(body.querySelectorAll(".topic-v55-subject").length,1);
});

test("v55 dosyalar: stil ve sürüm iğnesi; renkler tema belirteçli",()=>{
  const html=read("index.html"),css=read("topics-v55.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/topics-v55\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-students54-topics55-messages56-pp57"/);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i,"ham renk kalmaz");
});
