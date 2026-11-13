const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function day(offset){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
// Son 31 gün: her gün 60 dk / 40 soru; bugün 100 dk / 50 soru; son 7 gün matematik ağırlıklı.
const daily31=Array.from({length:31},(_,i)=>{const offset=i-30,date=day(offset),today=offset===0,minutes=today?100:60,questions=today?50:40;
  return{date,minutes,questions,subjects:offset>-7?[{name:"Matematik",minutes:minutes-20,questions:questions-10},{name:"Fizik",minutes:20,questions:10}]:[{name:"Türkçe",minutes,questions}]}});
const ROW={studentUid:"elif",share:{profile:{name:"Elif Yılmaz",track:"SAY",career:{level:12,tyt:{label:"TYT",name:"Platin III"}},reading:{tests30:3,wpm30:230,comprehension30:78}},
  progress:{minutes7:420,questions7:290,daily14:daily31.slice(-14).map(({date,minutes,questions})=>({date,minutes,questions})),daily31,subjects7:[],completedTopics:12,overdueTopics:3,activeTopics:5,dayReview:{entries:[]}},
  exams:[{id:"1",type:"TYT",name:"A",date:day(-20),totalNet:70,subjectResults:[]},{id:"2",type:"TYT",name:"B",date:day(-3),totalNet:78.75,subjectResults:[]}],
  errorJournal:[{date:day(-2),subject:"Fizik",topic:"Kuvvet",n:3,exam:"2"},{date:day(-20),subject:"Fizik",topic:"Kuvvet",n:2,exam:"1"}],topics:{items:[]},program:{weeks:[]},paragraphProblem:{entries:[]},updatedAt:{toMillis:()=>Date.now(),toDate:()=>new Date()}}};

function fixture(t,rows){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},errors=[];let prints=0;
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"x"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>true,print:()=>{prints++},
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.__rows=rows;
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{coachReportRows=window.__rows;const s=$("reportStudentSelect");s.innerHTML='<option value="all">Tüm</option>'+coachReportRows.map(r=>'<option value="'+r.studentUid+'">x</option>').join("");
  window.__show=scope=>{s.value=scope;renderReport(scope)};window.__page=()=>[...document.querySelectorAll("[data-coach-page].on")].map(x=>x.dataset.coachPage).join(",");}`);
  return{w,doc:w.document,errors,prints:()=>prints};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const v=c.textContent.trim();if(v)parts.push(v);}else walk(c);}};walk(node);return parts.join(" ");};
const kpis=doc=>[...doc.querySelectorAll("#reportStudentKpis .report-kpi")].map(text);

test("v53 dönem: bugün / 7 gün / 30 gün sayıları ve önceki döneme göre fark",t=>{
  const {doc,errors}=fixture(t,[ROW]);
  fixtureShow(doc,"elif");
  let k=kpis(doc);
  assert.match(k[0],/^ÇALIŞMA 7 sa 40 dk son 7 gün · ▲ %10 önceki döneme göre/);assert.match(k[1],/^SORU 290 son 7 gün · ▲ 10 önceki döneme göre/);
  doc.querySelector('[data-report-period="day"]').click();k=kpis(doc);
  assert.match(k[0],/^ÇALIŞMA 1 sa 40 dk bugün · ▲ %67 önceki döneme göre/);
  doc.querySelector('[data-report-period="month"]').click();k=kpis(doc);
  assert.match(k[0],/^ÇALIŞMA 30 sa 40 dk son 30 gün · önceki dönem verisi yok/,"31 gün 60 günlük karşılaştırmaya yetmez");
  assert.equal(doc.querySelectorAll("#reportActivityChart .report-activity-day").length,30);
  assert.match(doc.querySelector("#reportActivityChart .report-activity-bars").getAttribute("style"),/grid-template-columns:repeat\(30,/,"30 gün tek satırda");
  assert.match(text(doc.getElementById("reportScopeMeta")),/son 30 gün/);
  assert.deepEqual(errors,[]);
});
function fixtureShow(doc,uid){doc.defaultView.__show(uid)}

test("v53 ders süzgeci: süre, soru, grafik ve ders dağılımı yalnız o ders",t=>{
  const {doc,errors}=fixture(t,[ROW]);
  fixtureShow(doc,"elif");
  const select=doc.getElementById("reportSubjectSelect");
  assert.deepEqual([...select.options].map(o=>o.value),["all","Fizik","Matematik","Türkçe"]);
  select.value="Fizik";select.dispatchEvent(new doc.defaultView.Event("change"));
  assert.match(kpis(doc)[0],/^ÇALIŞMA 2 sa 20 dk son 7 gün · Fizik/);
  assert.deepEqual([...doc.querySelectorAll("#reportSubjectFocusBars b")].map(x=>x.textContent),["Fizik"]);
  assert.match(text(doc.getElementById("reportScopeMeta")),/son 7 gün · Fizik/);
  assert.deepEqual(errors,[]);
});

test("v53 özet şerit, rank, kısa bağlantılar, katlı ayrıntı ve yazdırma",t=>{
  const {doc,errors,prints}=fixture(t,[ROW]);
  fixtureShow(doc,"elif");
  const k=kpis(doc);
  assert.match(k[2],/^GÖREV UYUMU/);assert.match(k[3],/^KONU 12 bitti 3 geciken · 5 sürüyor/);
  assert.match(k[4],/^SON DENEME 78,75 TYT ▲ 8,75 önceki TYT denemesine göre/);assert.match(k[5],/^HIZLI OKUMA 230 k\/dk %78 anlama · 30 günde 3 test/);
  assert.match(doc.getElementById("reportStudentTarget").textContent,/TYT Platin III · Seviye 12/);
  for(const id of ["reportSubjectBreakdown","reportExamTrend","reportTopicStats","reportErrorList","reportPpSummary"])assert.ok(doc.getElementById(id).closest("article").classList.contains("report-v53-hidden"),id);
  const more=doc.getElementById("reportMoreDetails");assert.ok(more.contains(doc.getElementById("reportStudentSignals")));assert.ok(more.contains(doc.getElementById("reportEvidenceAnalysis")));
  const links=[...doc.querySelectorAll("#reportLinks .report-v53-link")].map(text);
  assert.match(links[0],/^Deneme · son TYT 78,75 \(▲ 8,75\) Deneme Analizi ›$/);assert.match(links[2],/^Tekrar eden hata · Fizik Kuvvet Hata Defteri ›$/);
  doc.querySelector('[data-report-open="exams"]').click();assert.equal(doc.defaultView.__page(),"exams");assert.equal(doc.getElementById("examStudentSelect").value,"elif");
  assert.equal(doc.getElementById("reportPrintBtn").hidden,false);doc.getElementById("reportPrintBtn").click();assert.equal(prints(),1);
  fixtureShow(doc,"all");assert.equal(doc.getElementById("reportPrintBtn").hidden,true,"genel görünümde yazdırma yok");
  assert.deepEqual(errors,[]);
});

test("v53 eski paylaşımda (daily31 yok) 7 gün mevcut sayıları gösterir, ders süzgeci kapalı",t=>{
  const old={...ROW,share:{...ROW.share,progress:{...ROW.share.progress,daily31:undefined}}};
  const {doc,errors}=fixture(t,[old]);
  fixtureShow(doc,"elif");
  assert.match(kpis(doc)[0],/^ÇALIŞMA 7 sa 40 dk son 7 gün/);
  assert.equal(doc.getElementById("reportSubjectSelect").disabled,true);
  assert.deepEqual(errors,[]);
});

test("v53 stil dosyası bağlı, renkler sarılı, yazdırma kuralı var",()=>{
  const html=read("index.html"),css=read("reports-v53.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/reports-v53\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-reports53(-[a-z0-9]+)*"/);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i);
  assert.match(css,/@media print\{/);
});

test("v72 risk nedeni: etiketin yanında en ağır nedenler yazılır; puan aynı kalır",t=>{
  const {doc,errors}=fixture(t,[ROW,{studentUid:"bos"}]);
  fixtureShow(doc,"all");
  const rows=[...doc.querySelectorAll("#reportAttentionList button")];
  assert.deepEqual(rows.map(b=>b.querySelector("small").textContent),["Öğrenci verisi henüz gelmedi","3 geciken konu · Bu hafta program yok"]);
  assert.equal(rows[1].querySelector("em").textContent,"İyi gidiyor","3×6 + 8 = 26 puan");
  assert.equal(doc.querySelector('.report-student-row[data-report-student="elif"] em').title,"3 geciken konu · Bu hafta program yok");
  fixtureShow(doc,"elif");
  assert.equal(doc.getElementById("reportStudentRisk").title,"3 geciken konu · Bu hafta program yok");
  assert.deepEqual(errors,[]);
});