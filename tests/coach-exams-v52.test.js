const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function day(offset){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
const subj=(name,net,d,y,b)=>({name,net,d,y,b});
const tyt=(id,offset,name,s)=>({id:String(id),type:"TYT",name,date:day(offset),totalNet:s.reduce((t,x)=>t+x.net,0),subjectResults:s});
const ELIF={studentUid:"elif",share:{profile:{name:"Elif Yılmaz",track:"SAY",targetNetTYT:90,career:{level:12,xp:5370,tyt:{label:"TYT",name:"Platin III",net:75.6,league:3,tier:3},ayt:null,ydt:null}},
  exams:[
    tyt(1,-30,"Limit TYT-1",[subj("Türkçe",29.5,31,6,3),subj("Sosyal",11,12,4,4),subj("Matematik",15.25,18,11,11),subj("Fen",12.75,14,5,1)]),
    tyt(2,-23,"Bilgi Sarmal TYT",[subj("Türkçe",30,32,8,0),subj("Sosyal",13.5,14,2,4),subj("Matematik",17.5,20,10,10),subj("Fen",11.25,13,7,0)]),
    tyt(3,-16,"3D TYT-3",[subj("Türkçe",27.75,30,9,1),subj("Sosyal",13,14,4,2),subj("Matematik",16,19,12,9),subj("Fen",13.25,15,7,-2)]),
    tyt(4,-2,"Özdebir TYT-4",[subj("Türkçe",31.5,33,6,1),subj("Sosyal",14.25,15,3,2),subj("Matematik",22.5,25,10,5),subj("Fen",10.5,12,6,2)]),
    tyt(0,-200,"Eski deneme",[subj("Türkçe",20,22,8,10)])
  ],
  errorJournal:[
    {date:day(-30),subject:"Fizik",topic:"Kuvvet ve Hareket",n:3,exam:"1",kind:"bilmiyordum"},
    {date:day(-16),subject:"Fizik",topic:"Kuvvet ve Hareket",n:2,exam:"3",kind:"bilmiyordum"},
    {date:day(-2),subject:"Fizik",topic:"Kuvvet ve Hareket",n:4,exam:"4",kind:"dikkat"},
    {date:day(-5),subject:"Kimya",topic:"Mol Kavramı",n:6},
    {date:day(-150),subject:"Biyoloji",topic:"Hücre",n:9}
  ],topics:{items:[{key:"TYT|Fizik|Kuvvet ve Hareket",subject:"Fizik",topic:"Kuvvet ve Hareket",st:1}]}}};
const MERT={studentUid:"mert",share:{profile:{name:"Mert Kaya"},exams:[tyt(5,-12,"A",[subj("Türkçe",30,30,0,10)]),tyt(6,-4,"B",[subj("Türkçe",24,26,8,6)])],errorJournal:[]}};
const ZEYNEP={studentUid:"zeynep",share:{profile:{name:"Zeynep Ak"},exams:[tyt(7,-20,"C",[subj("Türkçe",61,61,0,0)])],errorJournal:[]}};

function fixture(t,rows){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1"}},errors=[];
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"x"}),
    signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},console:{...console,error:(...a)=>errors.push(a.map(String).join(" "))},
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.__rows=rows;
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;{coachReportRows=window.__rows;hydrateExamStudentSelect();hydrateTopicControls();hydrateErrorControls();
  window.__render=scope=>renderExamAnalysis(scope);window.__page=()=>[...document.querySelectorAll("[data-coach-page].on")].map(x=>x.dataset.coachPage);}`);
  return{w,doc:w.document,errors};
}
const text=node=>{const parts=[];const walk=n=>{for(const c of n?.childNodes||[]){if(c.nodeType===3){const value=c.textContent.trim();if(value)parts.push(value);}else walk(c);}};walk(node);return parts.join(" ").replace(/\s+/g," ");};

test("v52 tüm öğrenciler: dikkat listesi düşüşü ve uzun aradaki öğrenciyi gösterir; son net ve fark",t=>{
  const {w,doc,errors}=fixture(t,[ELIF,MERT,ZEYNEP]);
  w.__render("all");
  assert.equal(doc.getElementById("examOverview").classList.contains("hidden"),false);
  const attention=[...doc.querySelectorAll("#examAttentionList .exam-v52-attention-row")].map(text);
  assert.equal(attention.length,2);
  assert.match(attention[0],/^Mert Kaya .*▼ 6 net/);assert.match(attention[1],/^Zeynep Ak .*20 gündür deneme yok/);
  const students=[...doc.querySelectorAll("#examComparisonList .exam-v52-student-row")].map(text);
  assert.match(students[0],/^Elif Yılmaz .*78,75 ▲ 8,75$/);assert.match(students.at(-1),/^Mert Kaya .*24 ▼ 6$/);
  assert.match(text(doc.getElementById("examOverviewKpis")),/TOPLAM DENEME 7/,"son 3 ay: eski deneme sayılmaz");
  doc.querySelector('#examAttentionList [data-exam-student="mert"]').click();
  assert.equal(doc.getElementById("examStudentName").textContent,"Mert Kaya");
  assert.deepEqual(errors,[]);
});

test("v52 öğrenci raporu: rank ve hedef, ders bazında fark ve D/Y/B, gelişim eğrisi hedef çizgisiyle",t=>{
  const {w,doc,errors}=fixture(t,[ELIF]);
  doc.getElementById("examTypeSelect").value="TYT";w.__render("elif");
  assert.equal(doc.getElementById("examStudentDetail").classList.contains("hidden"),false);
  assert.deepEqual([...doc.querySelectorAll("#examStudentTags span")].map(text),["TYT Platin III","Seviye 12"]);
  assert.match(text(doc.getElementById("examStudentGoal")),/TYT hedefi 90 net · 11,25 net kaldı/);
  assert.match(text(doc.getElementById("examStudentKpis")),/SON NET 78,75 ▲ 8,75 önceki denemeye göre/);
  assert.match(text(doc.getElementById("examStudentKpis")),/HEDEFE KALAN 11,25/);
  const rows=[...doc.querySelectorAll("#examSubjectList tbody tr")].map(text);
  assert.equal(rows[0],"Fen 10,5 12,42 ▼ 1,92 12/6/2","düşen ders en üstte, önceki 3 ortalaması");
  assert.equal(rows.at(-1),"Matematik 22,5 16,25 ▲ 6,25 25/10/5");
  const svg=doc.querySelector("#examTrendChart svg");
  assert.ok(svg.querySelector("line.goal"),"tek tür: hedef çizgisi");assert.equal(svg.querySelectorAll("circle.dot").length,4,"son 3 ay: 4 deneme");
  assert.equal(doc.querySelector("#examInsight"),null,"yanlış başlıklı Hızlı Okuma kartı kalktı");
  assert.doesNotMatch(read("index.html"),/<span>HIZLI OKUMA<\/span><h2>Koç için özet/);
  doc.getElementById("examPeriodSelect").value="all";w.__render("elif");
  assert.equal(doc.querySelectorAll("#examTrendChart circle.dot").length,5,"Tümü: eski deneme de görünür");
  assert.deepEqual(errors,[]);
});

test("v52 konu eksikleri: tekrar eden hata işaretli ve önce; Konu ve Hatalar ilgili sayfayı süzerek açar",t=>{
  const {w,doc,errors}=fixture(t,[ELIF]);
  w.__render("elif");
  const gaps=[...doc.querySelectorAll("#examTopicGaps .exam-v52-gap")];
  assert.equal(gaps.length,2,"dönem dışı hata sayılmaz");
  assert.match(text(gaps[0]),/^Fizik · Kuvvet ve Hareket 3 denemede 9 yanlış · en son .* · bilgi eksiği/);
  assert.match(text(gaps[1]),/^Kimya · Mol Kavramı 6 yanlış/);
  gaps[0].querySelector("[data-exam-topic]").click();
  assert.equal(w.__page().join(","),"topics");
  assert.equal(doc.getElementById("topicStudentSelect").value,"elif");assert.equal(doc.getElementById("topicSearchInput").value,"Kuvvet ve Hareket");
  gaps[0].querySelector("[data-exam-errors]").click();
  assert.equal(w.__page().join(","),"errors");
  assert.equal(doc.getElementById("errorStudentSelect").value,"elif");
  assert.deepEqual(errors,[]);
});

test("v52 deneme karşılaştırma: varsayılan son iki, en fazla üç; ders ders fark",t=>{
  const {w,doc,errors}=fixture(t,[ELIF]);
  w.__render("elif");
  const boxes=()=>[...doc.querySelectorAll("#examHistoryList input[type=checkbox]")];
  assert.deepEqual(boxes().map(x=>x.checked),[true,true,false,false]);
  let head=[...doc.querySelectorAll("#examCompare thead th")].map(text);
  assert.equal(head.length,4);
  assert.equal(text(doc.querySelector("#examCompare tr.total")),"Toplam 70 78,75 ▲ 8,75");
  for(const index of [2,3]){const box=boxes()[index];box.checked=true;box.dispatchEvent(new w.Event("change",{bubbles:true}));}
  assert.equal(boxes().filter(x=>x.checked).length,3,"dördüncü seçilince en eski seçim düşer");
  head=[...doc.querySelectorAll("#examCompare thead th")].map(text);assert.equal(head.length,5);
  const one=boxes().find(x=>x.checked);one.checked=false;one.dispatchEvent(new w.Event("change",{bubbles:true}));
  boxes().filter(x=>x.checked).slice(1).forEach(box=>{box.checked=false;box.dispatchEvent(new w.Event("change",{bubbles:true}));});
  assert.match(text(doc.getElementById("examCompare")),/en az iki deneme seç/);
  assert.deepEqual(errors,[]);
});

test("v52 stil dosyası bağlı ve tema renkleri sarılı",()=>{
  const html=read("index.html"),css=read("exams-v52.css");
  assert.match(html,/<link rel="stylesheet" href="\.\/exams-v52\.css\?v=1\.0\.0">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-exams52(-[a-z0-9]+)*"/);
  assert.doesNotMatch(css.replace(/var\(--kc-[\w-]+,[^)]*\)/g,""),/#[0-9a-f]{3,8}\b/i,"ham renk kalmadı");
});

test("v52 Tümü seçiliyken TYT ile AYT netleri karşılaştırılmaz",t=>{
  const ayt={id:"9",type:"AYT",name:"Limit AYT-1",date:day(-9),totalNet:40.25,subjectResults:[subj("Matematik",18,20,8,12)]};
  const row={...ELIF,share:{...ELIF.share,exams:[...ELIF.share.exams,ayt]}};
  const {w,doc,errors}=fixture(t,[row]);
  doc.getElementById("examTypeSelect").value="all";w.__render("elif");
  assert.match(text(doc.getElementById("examStudentKpis")),/SON NET 78,75 ▲ 8,75 önceki denemeye göre/,"son TYT bir önceki TYT ile");
  assert.match(text(doc.getElementById("examStudentKpis")),/ORTALAMA NET 72,38 4 TYT denemesi/);
  assert.match(text(doc.querySelector("#examHistoryList .exam-v52-history-row:nth-child(2)")),/Limit AYT-1 .* 40,25 —/,"ilk AYT'nin karşılaştırması yok");
  assert.equal(doc.querySelectorAll("#examTrendChart .exam-v52-legend span").length,2,"türe göre iki çizgi");
  assert.equal(doc.querySelector("#examTrendChart line.goal"),null,"karışık türde hedef çizgisi yok");
  assert.deepEqual(errors,[]);
});

test("v52 karşılaştırma varsayılanı aynı türden son iki deneme; farklı tür seçilince fark yok",t=>{
  const ayt={id:"9",type:"AYT",name:"Limit AYT-1",date:day(-1),totalNet:40.25,subjectResults:[subj("Matematik",18,20,8,12)]};
  const row={...ELIF,share:{...ELIF.share,exams:[...ELIF.share.exams,ayt]}};
  const {w,doc,errors}=fixture(t,[row]);
  doc.getElementById("examTypeSelect").value="all";w.__render("elif");
  const boxes=()=>[...doc.querySelectorAll("#examHistoryList input[type=checkbox]")];
  assert.deepEqual(boxes().map(x=>x.checked),[false,true,true,false,false],"tek AYT var: varsayılan son iki TYT");
  assert.equal(text(doc.querySelector("#examCompare tr.total")),"Toplam 70 78,75 ▲ 8,75");
  const aytBox=boxes()[0];aytBox.checked=true;aytBox.dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.match(text(doc.querySelector("#examCompare tr.total")),/^Toplam 70 78,75 40,25 —$/);
  assert.match(text(doc.getElementById("examCompare")),/fark yalnız aynı türde hesaplanır/);
  assert.deepEqual(errors,[]);
});
