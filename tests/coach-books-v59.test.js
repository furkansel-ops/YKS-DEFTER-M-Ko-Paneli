const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const BOOKS=[
  {id:"1",name:"345 TYT Matematik Soru Bankası",subject:"Matematik",pub:"345",exam:"TYT",total:40,done:17,perTest:13,last:day(1)},
  {id:"2",name:"Limit TYT Türkçe Fasikül Set",subject:"Türkçe",pub:"Limit",exam:"TYT",total:24,done:24,perTest:40,last:day(3)},
  {id:"3",name:"Bilgi Sarmal <b>Fizik</b>",subject:"Fizik",pub:"Bilgi Sarmal",exam:"TYT",total:26,done:3,perTest:0,last:day(12)}
];
function fixture(t){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,auth={currentUser:{uid:"coach-1",email:"koc@example.test",emailVerified:true}},errors=[];
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),Notification:class{static permission="denied"},
    GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),serverTimestamp:()=>"NOW",
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),setDoc:async()=>{},updateDoc:async()=>{},addDoc:async()=>({id:"a"}),signOut:async()=>{},alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},
    console:{...console,error:(...a)=>errors.push(a.map(String).join(" ")),warn:()=>{}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+`
;window.__v59={
  set(books){coachReportRows=[{studentUid:"elif",link:{active:true},share:{profile:{name:"Elif Yılmaz"},progress:{books}}}]},
  card(){openStudentCard("elif")},
  host(edit=false){coachV59RenderBookHost(coachReportRows[0],edit)},
  text:coachV59BookTaskText
};`);
  return{w,doc:w.document,errors};
}

test("v59 görev metni sıradaki testlerden yazılır; kalan testi aşmaz, bitmiş kitapta boş",t=>{
  const {w}=fixture(t),f=w.__v59.text;
  assert.equal(f(BOOKS[0],3),"📚 345 TYT Matematik Soru Bankası · 18–20. testler · 39 soru");
  assert.equal(f(BOOKS[0],1),"📚 345 TYT Matematik Soru Bankası · 18. test · 13 soru");
  assert.equal(f({...BOOKS[0],done:38},5),"📚 345 TYT Matematik Soru Bankası · 39–40. testler · 26 soru","kalan 2 test");
  assert.equal(f(BOOKS[1],2),"","bitmiş kitap");
  assert.equal(f(BOOKS[2],2),"📚 Bilgi Sarmal <b>Fizik</b> · 4–5. testler","soru/test bilinmiyorsa soru yazmaz");
});

test("v59 öğrenci kartında kitaplar: ilerleme, son ilerleme uyarısı, bitti, HTML kaçışı",t=>{
  const {w,doc,errors}=fixture(t);
  w.__v59.set(BOOKS);w.__v59.card();
  const box=doc.getElementById("studentCardBooks");
  assert.match(box.textContent,/Kitapları · 3/);assert.match(box.textContent,/1 bitti · 1\.181 soru/);
  assert.match(box.textContent,/17 \/ 40 test · 221 soru/);assert.match(box.textContent,/Son ilerleme dün/);
  assert.equal(box.querySelector(".is-stale").textContent,"12 gündür ilerleme yok");
  assert.equal(box.querySelector(".is-done").textContent,"Bitti");
  assert.equal(box.querySelectorAll("b").length,4,"kitap adındaki <b> metin olarak kalır");
  w.__v59.set([]);w.__v59.card();
  assert.match(doc.getElementById("studentCardBooks").textContent,/henüz Kitaplarım'a kitap eklemedi/);
  assert.deepEqual(errors,[]);
});

test("v59 görev penceresi: Kitaptan ödev yalnız bitmemiş kitaplarla, metne yazınca görev metni dolar",t=>{
  const {w,doc,errors}=fixture(t);
  w.__v59.set(BOOKS);w.__v59.host();
  const box=doc.getElementById("coachV59BookBox");assert.equal(box.hidden,false);
  assert.equal(doc.querySelectorAll("#coachV59Book option").length,2,"bitmiş Türkçe kitabı listede yok");
  assert.equal(doc.getElementById("coachV59Preview").textContent,"📚 345 TYT Matematik Soru Bankası · 18–20. testler · 39 soru");
  doc.querySelector('[data-v59-tests="5"]').click();
  assert.equal(doc.querySelector('[data-v59-tests="5"]').getAttribute("aria-pressed"),"true");
  doc.getElementById("coachV59Use").click();
  assert.equal(doc.getElementById("programTaskText").value,"📚 345 TYT Matematik Soru Bankası · 18–22. testler · 65 soru");
  w.__v59.host(true);assert.equal(box.hidden,true,"düzenlemede gizli");
  w.__v59.set([BOOKS[1]]);w.__v59.host();assert.equal(box.hidden,true,"bitmemiş kitap yoksa gizli");
  assert.deepEqual(errors,[]);
});

test("v59 stil bağlı, görev gönderme sözleşmesi değişmedi",()=>{
  const html=read("index.html"),js=read("app-reset.js");
  assert.match(html,/<link rel="stylesheet" href="\.\/books-v59\.css\?v=1\.0\.0">/);
  assert.match(js,/const task=base\+\(resource\?" — "\+resource:""\)/);
});

test("v60 öğrenci kartında öğrencinin çektiği kapak; bozuk ya da zararlı kapak yerine kısaltma",t=>{
  const {w,doc,errors}=fixture(t);
  const jpeg="data:image/jpeg;base64,"+"A".repeat(40);
  w.__v59.set([{...BOOKS[0],cover:jpeg},{...BOOKS[2],cover:'data:image/jpeg;base64,AA" onerror="alert(1)'},{...BOOKS[1],cover:"data:image/png;base64,AAAA"}]);w.__v59.card();
  const imgs=doc.querySelectorAll("#studentCardBooks .coach-v59-cover img");
  assert.equal(imgs.length,1);assert.equal(imgs[0].getAttribute("src"),jpeg);
  assert.equal(doc.querySelectorAll("#studentCardBooks [onerror]").length,0);
  assert.equal(doc.querySelectorAll("#studentCardBooks .coach-v59-cover:not(.has-img)").length,2,"diğerleri kısaltmalı kapak");
  assert.deepEqual(errors,[]);
});
