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

test("v63 Kitap seç: yalnız Soru çözümünde, bitmemiş kitaplar, seçili ders önce; basınca metin yazılır, tekrar basınca geri alınır",t=>{
  const {w,doc,errors}=fixture(t);
  const box=doc.getElementById("coachV59BookBox"),area=doc.getElementById("programTaskText"),activity=doc.getElementById("programBuilderActivity");
  const books=()=>[...doc.querySelectorAll("[data-v63-book]")];
  w.__v59.set(BOOKS);activity.value="Soru çözümü";w.__v59.host();
  assert.equal(box.hidden,false);
  assert.equal(books().length,2,"bitmiş Türkçe kitabı listede yok");
  assert.ok(doc.querySelector(".coach-v59-tests").hidden,"kitap seçilmeden test sayısı yok");
  assert.equal(doc.querySelectorAll("#coachV59BookHost b").length,2,"kitap adındaki <b> metin olarak kalır");
  books()[0].click();
  assert.equal(area.value,"📚 345 TYT Matematik Soru Bankası · 18–20. testler · 39 soru");
  assert.equal(books()[0].getAttribute("aria-pressed"),"true");assert.equal(doc.activeElement,books()[0],"odak seçilen kitapta kalır");
  doc.querySelector('[data-v63-tests="5"]').click();
  assert.equal(area.value,"📚 345 TYT Matematik Soru Bankası · 18–22. testler · 65 soru");
  const num=doc.getElementById("coachV63Tests");num.value="2";num.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.equal(area.value,"📚 345 TYT Matematik Soru Bankası · 18–19. testler · 26 soru");
  books()[0].click();
  assert.equal(area.value,"","seçim kalkınca kitap metni silinir");assert.equal(books()[0].getAttribute("aria-pressed"),"false");
  books()[0].click();area.value="elle yazdım";
  activity.value="Konu anlatımı";activity.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.equal(box.hidden,true,"Soru çözümü dışında gizli");assert.equal(area.value,"elle yazdım","elle değiştirilen metne dokunulmaz");
  activity.value="Soru çözümü";activity.dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.equal(box.hidden,false);assert.ok(books().every(b=>b.getAttribute("aria-pressed")==="false"),"tür değişince seçim kalktı");
  const subject=doc.getElementById("programBuilderSubject");subject.value="Fizik";subject.dispatchEvent(new w.Event("change",{bubbles:true}));
  assert.match(books()[0].textContent,/Fizik/,"seçili dersin kitabı önce");
  w.__v59.host(true);assert.equal(box.hidden,true,"düzenlemede gizli");
  w.__v59.set([BOOKS[1]]);w.__v59.host();assert.match(box.textContent,/bütün kitapları bitti/);
  w.__v59.set([]);w.__v59.host();assert.match(box.textContent,/henüz Kitaplarım'a kitap eklemedi/);
  assert.deepEqual(errors,[]);
});

test("v63 Kitap seç link alanının üstünde; Video ekle bilgisayarda iki sütun",()=>{
  const html=read("index.html"),css=read("coach-task-composer-v45.css"),video=read("coach-video-picker-v46.css");
  assert.ok(html.indexOf('id="coachV59BookBox"')>html.indexOf('id="programTaskText"')&&html.indexOf('id="coachV59BookBox"')<html.indexOf('id="programTaskVideo"'));
  assert.match(css,/"builder book" "keep link"/);assert.match(css,/"task" "book" "link"/);
  assert.match(video,/grid-template-columns:340px minmax\(0,1fr\)/);
});

test("v59 stil bağlı, görev gönderme sözleşmesi değişmedi",()=>{
  const html=read("index.html"),js=read("app-reset.js");
  assert.match(html,/<link rel="stylesheet" href="\.\/books-v59\.css\?v=1\.3\.0">/);
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

test("v61 katalog kapağı: yalnız Kitapseç CDN adresi, yönlendiren bilgisi gönderilmez, açılmazsa kaldırılır",t=>{
  const {w,doc,errors}=fixture(t);
  const ok="https://cdn.kitapsec.com/image/urun/2026/07/23/1784790696.jpg";
  w.__v59.set([{...BOOKS[0],coverUrl:ok},{...BOOKS[2],coverUrl:"https://kotu.example/x.jpg"},{...BOOKS[1],coverUrl:'https://cdn.kitapsec.com/image/urun/a.jpg" onerror="alert(1)'}]);w.__v59.card();
  const imgs=doc.querySelectorAll("#studentCardBooks img.coach-v61-remote");
  assert.equal(imgs.length,1);assert.equal(imgs[0].getAttribute("src"),ok);assert.equal(imgs[0].getAttribute("referrerpolicy"),"no-referrer");
  assert.equal(doc.querySelectorAll("#studentCardBooks [onerror]").length,0);
  imgs[0].dispatchEvent(new w.Event("error"));
  assert.equal(doc.querySelectorAll("#studentCardBooks img.coach-v61-remote").length,0,"açılmayan kapak kaldırıldı");
  assert.match(doc.querySelector("#studentCardBooks .coach-v59-cover").textContent,/345/,"kısaltma yerinde");
  assert.deepEqual(errors,[]);
});

test("v61 GIF katalog kapağı da gösterilir",t=>{
  const {w,doc}=fixture(t);const gif="https://cdn.kitapsec.com/image/urun/2026/03/10/1773144341.gif";
  w.__v59.set([{...BOOKS[0],coverUrl:gif}]);w.__v59.card();
  assert.equal(doc.querySelector("#studentCardBooks img.coach-v61-remote").getAttribute("src"),gif);
});

const tick=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r))};
const CATALOG={cdn:"https://cdn.kitapsec.com/image/urun/",items:[
  {id:1,n:"Üç Dört Beş TYT Matematik Soru Bankası",p:"Üç Dört Beş",c:"2024/a.jpg",s:"Matematik",e:"TYT",k:"Soru Bankası",t:40,q:13},
  {id:2,n:"345 TYT Matematik Soru Bankası",p:"345",s:"Matematik",e:"TYT"},
  {id:3,n:"Limit <b>AYT</b> Fizik",p:"Limit",s:"Fizik",e:"AYT",t:"x"}
]};
test("v64 öğrenci kartında Kitap ekle: katalogdan ara, var olanı engelle, sayıları doğrula, coach_note/book_add gönder",async t=>{
  const {w,doc,errors}=fixture(t),sent=[];
  w.fetch=async()=>({ok:true,json:async()=>CATALOG});w.addDoc=async(ref,data)=>{sent.push({ref,data});return{id:"x"}};
  w.__v59.set([BOOKS[0]]);w.__v59.card();
  const host=doc.getElementById("coachV64Add"),click=sel=>host.querySelector(sel).click();
  assert.equal(host.querySelector("[data-v64=open]").textContent,"+ Kitap ekle");
  click("[data-v64=open]");assert.equal(doc.getElementById("coachV64Hint").textContent,"Katalog yükleniyor…");
  await tick();assert.match(doc.getElementById("coachV64Hint").textContent,/^3 kitap/);
  const q=doc.getElementById("coachV64Query");q.value="345 mat";q.dispatchEvent(new w.Event("input",{bubbles:true}));
  const hits=[...host.querySelectorAll("[data-v64-pick]")];
  assert.equal(hits.length,2,"Üç Dört Beş adı 345 ile de bulunur");
  assert.equal(hits[1].disabled,true);assert.match(hits[1].textContent,/Kitaplarında var/);
  q.value="limit";q.dispatchEvent(new w.Event("input",{bubbles:true}));
  assert.ok(!host.innerHTML.includes("<b>AYT</b>"),"katalog adı kaçışlı");
  q.value="345 mat";q.dispatchEvent(new w.Event("input",{bubbles:true}));
  click('[data-v64-pick="0"]');
  assert.equal(doc.getElementById("coachV64Total").value,"40");assert.equal(doc.getElementById("coachV64Per").value,"13");assert.equal(doc.getElementById("coachV64Subject").value,"Matematik");
  host.querySelector("form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await tick();
  assert.equal(sent.length,1);const a=sent[0].data;
  assert.equal(sent[0].ref.name,"coachingActions");assert.equal(a.type,"coach_note");assert.equal(a.status,"pending");assert.equal(a.studentUid,"elif");assert.equal(a.coachUid,"coach-1");
  assert.equal(a.payload.operation,"book_add");assert.equal(a.payload.text,"Kitap önerisi · Üç Dört Beş TYT Matematik Soru Bankası");
  assert.equal(a.payload.total,40);assert.equal(a.payload.perTest,13);assert.equal(a.payload.coverUrl,"https://cdn.kitapsec.com/image/urun/2024/a.jpg");
  assert.match(host.querySelector(".coach-v64-status").textContent,/gönderildi ✓/);assert.ok(host.querySelector("[data-v64=open]"),"gönderince kapanır");
  // Listede yok → adıyla ekle; sayılar doğrulanır, aynı ad engellenir
  click("[data-v64=open]");await tick();
  const q2=doc.getElementById("coachV64Query");q2.value="Kendi Kitabım";q2.dispatchEvent(new w.Event("input",{bubbles:true}));
  click("[data-v64=manual]");assert.equal(doc.getElementById("coachV64Name").value,"Kendi Kitabım");
  const submit=()=>host.querySelector("form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  submit();await tick();assert.match(host.querySelector(".coach-v64-status").textContent,/Toplam test 1 ile 2000/);assert.equal(sent.length,1);
  doc.getElementById("coachV64Total").value="10";doc.getElementById("coachV64Per").value="500";submit();await tick();assert.match(host.querySelector(".coach-v64-status").textContent,/Testteki soru/);
  doc.getElementById("coachV64Name").value=" 345 tyt matematik soru bankası ";doc.getElementById("coachV64Per").value="20";submit();await tick();
  assert.match(host.querySelector(".coach-v64-status").textContent,/zaten var/);assert.equal(sent.length,1);
  doc.getElementById("coachV64Name").value="Kendi Kitabım";doc.getElementById("coachV64Subject").value="Fizik";submit();await tick();
  assert.equal(sent.length,2);assert.equal(sent[1].data.payload.subject,"Fizik");assert.equal(sent[1].data.payload.coverUrl,"");assert.equal(sent[1].data.payload.perTest,20);
  // kart yeniden açılınca sıfırlanır
  w.__v59.card();assert.ok(host.querySelector("[data-v64=open]"));assert.equal(host.querySelector(".coach-v64-status"),null);
  assert.deepEqual(errors,[]);
});
test("v64 katalog açılamazsa koç adını yazarak ekleyebilir; gönderim hatası gösterilir",async t=>{
  const {w,doc}=fixture(t);
  w.fetch=async()=>({ok:false,status:503});w.addDoc=async()=>{throw new Error("izin yok")};
  w.__v59.set([]);w.__v59.card();
  const host=doc.getElementById("coachV64Add");host.querySelector("[data-v64=open]").click();await tick();
  assert.match(doc.getElementById("coachV64Hint").textContent,/Katalog açılamadı/);
  const q=doc.getElementById("coachV64Query");q.value="Bir Kitap";q.dispatchEvent(new w.Event("input",{bubbles:true}));
  host.querySelector("[data-v64=manual]").click();doc.getElementById("coachV64Total").value="5";doc.getElementById("coachV64Per").value="10";
  host.querySelector("form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await tick();
  assert.match(host.querySelector(".coach-v64-status.is-error").textContent,/Gönderilemedi: izin yok/);
  assert.equal(doc.getElementById("coachV64Name").value,"Bir Kitap","form açık kalır");
});
