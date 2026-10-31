const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

// Yarın ve bugün: her gün 18:00–20:00 açık, 30 dk. Ayşe yarın 18:30 istedi, Mehmet bugün 23:59 kesin.
const DEMO=`
  const iso=d=>apptIso(d),tomorrow=iso(new Date(Date.now()+864e5)),today=iso(new Date());
  window.__dates={tomorrow,today};
  const link={active:true};
  coachReportRows=[{studentUid:"a",link,share:{profile:{name:"Ayşe Yılmaz"},program:{weeks:[]}}},{studentUid:"b",link,share:{profile:{name:"Mehmet Kaya"},program:{weeks:[]}}}];
  coachAvailability={duration:30,days:Object.fromEntries(["0","1","2","3","4","5","6"].map(k=>[k,{on:true,start:"18:00",end:"20:00"}]))};
  applyCoachAppointmentSnapshot({docs:[
    {id:"coach_"+tomorrow.replace(/-/g,"")+"_1830",data:()=>({coachUid:"coach",studentUid:"a",date:tomorrow,time:"18:30",duration:30,status:"requested",createdBy:"student",topic:"Deneme analizi",link:"",note:""})},
    {id:"coach_"+today.replace(/-/g,"")+"_2359",data:()=>({coachUid:"coach",studentUid:"b",date:today,time:"23:59",duration:30,status:"confirmed",createdBy:"coach",topic:"",link:"https://meet.google.com/abc",note:""})}
  ]});
`;

function fixture(t,extra=DEMO){
  const dom=new JSDOM(read("index.html"),{url:"https://coach.example.test",runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const w=dom.window,ops={batches:[],updates:[],sets:[],alerts:[]};
  w.innerWidth=1440;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:"profiles"},
    initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:"coach"}}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    query:(...x)=>x,where:(...x)=>x,collection:(_db,name)=>({name}),doc:(_db,...parts)=>({path:parts.join("/")}),
    serverTimestamp:()=>"NOW",getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    setDoc:async(ref,data)=>{ops.sets.push({path:ref.path,data})},
    updateDoc:async(ref,data)=>{ops.updates.push({path:ref.path,data})},
    addDoc:async()=>({id:"x"}),
    writeBatch:()=>{const list=[];ops.batches.push(list);return{set:(ref,data)=>list.push({op:"set",path:ref.path,data}),delete:ref=>list.push({op:"delete",path:ref.path}),commit:async()=>{}}},
    signOut:async()=>{},alert:message=>ops.alerts.push(message),confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},scrollTo:()=>{},open:()=>null,console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read("app-reset.js").replace(/^import[^\n]+\n/gm,"")+"\n;{"+extra+"}");
  return{w,doc:w.document,ops};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// jsdom penceresinde oluşan nesneler başka bir realm'a ait; karşılaştırmadan önce düz nesneye çevrilir.
const plain=value=>JSON.parse(JSON.stringify(value));

test("v41 yan menüde Randevular; sayfa açılınca takvim ve gün listesi çizilir",t=>{
  const {w,doc}=fixture(t);
  assert.ok(doc.querySelector('[data-coach-page="appointments"]'));
  doc.querySelector('[data-coach-page="appointments"]').click();
  assert.equal(doc.querySelector("#appointmentsPage").classList.contains("hidden"),false);
  assert.equal(doc.querySelector("#messagesPage").classList.contains("hidden"),true);
  assert.ok(doc.querySelectorAll("#apptMonth [data-appt-day]").length>=28);
  assert.ok(doc.querySelector("#apptMonth .busy"),"randevulu gün noktalı");
  assert.equal(doc.querySelector("#coachNavApptBadge").textContent,"1");
});

test("v41 gün listesi: uygun saatler boş satır, randevular durumuyla; link öğrenciye görünür halde",t=>{
  const {w,doc}=fixture(t);
  w.eval("openCoachAppointmentDay(window.__dates.tomorrow)");
  const items=[...doc.querySelectorAll("#apptDayList .coach-v41-item")].map(node=>node.querySelector("time")?.textContent+"|"+node.textContent.replace(/\s+/g," ").trim());
  assert.ok(items.some(line=>line.startsWith("18:00|")&&/Boş/.test(line)));
  assert.ok(items.some(line=>line.startsWith("18:30|")&&/Ayşe Yılmaz/.test(line)&&/Onayın bekleniyor/.test(line)));
  assert.ok(items.some(line=>line.startsWith("19:30|")&&/Boş/.test(line)));
  assert.ok(!items.some(line=>line.startsWith("20:00|")),"bitiş saatine sığmayan saat açılmaz");
  w.eval("openCoachAppointmentDay(window.__dates.today)");
  const link=doc.querySelector("#apptDayList .coach-v41-link");
  assert.equal(link.getAttribute("href"),"https://meet.google.com/abc");
  assert.equal(link.getAttribute("rel"),"noopener noreferrer");
});

test("v41 koç boş saate randevu koyar: kilit + kesin randevu tek toplu yazmada",async t=>{
  const {w,doc,ops}=fixture(t);
  w.eval("openCoachAppointmentDay(window.__dates.tomorrow)");
  doc.querySelector('[data-appt-new="19:00"]').click();
  const form=doc.querySelector("[data-appt-new-form]");
  form.querySelector("[data-appt-student]").value="b";
  form.querySelector("[data-appt-topic]").value="Program görüşmesi";
  form.querySelector("[data-appt-link]").value="https://zoom.us/j/1";
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await flush();
  const id="coach_"+w.__dates.tomorrow.replace(/-/g,"")+"_1900",batch=ops.batches.at(-1);
  assert.deepEqual(batch.map(op=>op.op+" "+op.path),["set coachSlots/"+id,"set coachAppointments/"+id]);
  assert.deepEqual(plain(batch[0].data),{coachUid:"coach",date:w.__dates.tomorrow,time:"19:00"});
  assert.equal(batch[1].data.status,"confirmed");assert.equal(batch[1].data.createdBy,"coach");
  assert.equal(batch[1].data.studentUid,"b");assert.equal(batch[1].data.link,"https://zoom.us/j/1");
});

test("v41 yalnız https linki kabul edilir",async t=>{
  const {w,doc,ops}=fixture(t);
  w.eval("openCoachAppointmentDay(window.__dates.tomorrow)");
  doc.querySelector('[data-appt-new="19:00"]').click();
  const form=doc.querySelector("[data-appt-new-form]");
  form.querySelector("[data-appt-link]").value="javascript:alert(1)";
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await flush();
  assert.equal(ops.batches.length,0);
  assert.match(ops.alerts.at(-1),/https/);
});

test("v41 istek onaylanır, link eklenir, iptal kilitle birlikte siler",async t=>{
  const {w,doc,ops}=fixture(t);
  const id="coach_"+w.eval("window.__dates.tomorrow").replace(/-/g,"")+"_1830";
  w.eval("openCoachAppointmentDay(window.__dates.tomorrow)");
  doc.querySelector('#apptDayList [data-appt-approve]').click();await flush();
  assert.deepEqual(plain(ops.updates.at(-1)),{path:"coachAppointments/"+id,data:{status:"confirmed",updatedAt:"NOW"}});
  doc.querySelector('#apptDayList [data-appt-form="link"]').click();
  const linkForm=doc.querySelector("[data-appt-link-form]");linkForm.querySelector("input").value="https://meet.google.com/xyz";
  linkForm.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await flush();
  assert.deepEqual(plain(ops.updates.at(-1).data),{link:"https://meet.google.com/xyz",updatedAt:"NOW"});
  doc.querySelector('#apptDayList [data-appt-cancel]').click();await flush();
  assert.deepEqual(ops.batches.at(-1).map(op=>op.op+" "+op.path),["delete coachAppointments/"+id,"delete coachSlots/"+id]);
});

test("v41 saati değiştir: eski kayıtlar silinir, yeni saat kesin ve notlu yazılır",async t=>{
  const {w,doc,ops}=fixture(t);
  const day=w.eval("window.__dates.tomorrow"),old="coach_"+day.replace(/-/g,"")+"_1830",next="coach_"+day.replace(/-/g,"")+"_1930";
  w.eval("openCoachAppointmentDay(window.__dates.tomorrow)");
  doc.querySelector('#apptDayList [data-appt-form="move"]').click();
  const form=doc.querySelector("[data-appt-move-form]");form.querySelector("[data-appt-move-time]").value="19:30";
  form.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));await flush();
  const batch=ops.batches.at(-1);
  assert.deepEqual(batch.map(op=>op.op+" "+op.path),["delete coachAppointments/"+old,"delete coachSlots/"+old,"set coachSlots/"+next,"set coachAppointments/"+next]);
  assert.equal(batch[3].data.status,"confirmed");assert.match(batch[3].data.note,/Koç saati değiştirdi/);
});

test("v41 uygun saatler kaydedilir; bitiş başlangıçtan önceyse uyarır",async t=>{
  const {w,doc,ops}=fixture(t,"coachAvailability=null;");
  doc.querySelector('[data-coach-page="appointments"]').click();
  assert.match(doc.querySelector("#apptHoursState").textContent,/Henüz kaydedilmedi/);
  doc.querySelector('[data-appt-duration="45"]').click();
  assert.equal(doc.querySelector('[data-appt-duration="45"]').getAttribute("aria-pressed"),"true");
  assert.equal(doc.querySelector("#apptHoursState").textContent,"Kaydedilmedi");
  doc.querySelector("#apptHoursSave").click();await flush();
  assert.equal(ops.sets.at(-1).path,"coachAvailability/coach");
  assert.equal(ops.sets.at(-1).data.duration,45);
  assert.deepEqual(plain(ops.sets.at(-1).data.days["1"]),{on:true,start:"18:00",end:"21:00"});
  const monday=doc.querySelector('[data-appt-hour="1"]');monday.querySelector("[data-appt-end]").value="17:00";
  doc.querySelector("#apptHoursSave").click();await flush();
  assert.match(ops.alerts.at(-1),/Pazartesi: bitiş saati/);
});

test("v41.4 sade gün listesi: ✕ günü kapatır, + Saat ekle açar; saat ve süre cümleyi günceller",async t=>{
  const {w,doc,ops}=fixture(t,"coachAvailability=null;");
  doc.querySelector('[data-coach-page="appointments"]').click();
  const row=key=>doc.querySelector('[data-appt-hour="'+key+'"]'),sentence=doc.querySelector("#apptWeekTotal");
  const change=(key,field,value)=>{const select=row(key).querySelector("[data-appt-"+field+"]");select.value=value;select.dispatchEvent(new w.Event("change",{bubbles:true}))};
  // Varsayılan: hafta içi 18–21 (5×6), cumartesi 11–14 (6), pazar kapalı → 36.
  assert.equal(doc.querySelectorAll("#apptHours [data-appt-hour]").length,7);
  assert.equal(sentence.textContent,"Pzt–Cum 18–21 · Cmt 11–14 · Paz kapalı · 30 dkHaftada 36 görüşmelik yer açılır.");
  assert.equal(doc.querySelector("#apptPresets"),null,"hazır düğmeler yok");
  assert.equal(doc.querySelector('#apptHoursDrawer [role="switch"]'),null,"anahtar yok");
  assert.match(row("0").textContent,/Kapalı/);
  row("0").querySelector("[data-appt-add]").click();
  assert.equal(row("0").querySelector("[data-appt-start]").value,"11:00","kapalı günün son saati geri gelir");
  row("6").querySelector("[data-appt-off]").click();
  assert.match(row("6").textContent,/Kapalı/);
  change("3","start","19:00");
  assert.equal(row("3").querySelector("[data-appt-start]").value,"19:00");
  assert.equal(sentence.textContent,"Pzt–Sal 18–21 · Çar 19–21 · Per–Cum 18–21 · Cmt kapalı · Paz 11–14 · 30 dkHaftada 34 görüşmelik yer açılır.");
  assert.equal(doc.querySelector("#apptHoursState").textContent,"Kaydedilmedi");
  change("1","end","17:00");
  assert.equal(sentence.textContent,"Pazartesi: bitiş saati başlangıçtan sonra olmalı.");
  assert.equal(sentence.classList.contains("bad"),true);
  change("1","end","21:00");
  doc.querySelector('[data-appt-duration="60"]').click();
  assert.match(sentence.textContent,/· 60 dkHaftada 17 görüşmelik/);
  for(const key of ["1","2","3","4","5","0"])row(key).querySelector("[data-appt-off]").click();
  assert.match(sentence.textContent,/^Hiç açık gün yok/);
  doc.querySelector("#apptHoursSave").click();await flush();
  assert.equal(ops.sets.at(-1).path,"coachAvailability/coach");
  assert.equal(plain(ops.sets.at(-1).data.days["1"]).on,false);
  assert.equal(ops.sets.at(-1).data.duration,60);
});

test("v41 Bugün yapılacaklar: onay bekleyen istek ve bugünkü görüşme, Onayla düğmesi çalışır",async t=>{
  const {w,doc,ops}=fixture(t,DEMO+"renderCoachDashboard();");
  const rows=[...doc.querySelectorAll("#dashboardTodo .coach-v38-task")].map(node=>node.dataset.todoKind+"|"+node.querySelector("b").textContent);
  assert.ok(rows.includes("appt|Ayşe Yılmaz · yarın 18:30 randevu istiyor"),rows.join("\n"));
  assert.ok(rows.includes("apptToday|Mehmet Kaya · bugün 23:59 görüşme"));
  doc.querySelector('#dashboardTodo [data-todo-action="appt-approve"]').click();await flush();
  assert.equal(ops.updates.at(-1).data.status,"confirmed");
});

test("v41.2 şablon B: turuncu istek şeridi açılıp kapanır; saat özeti tek satır; Düzenle yan paneli açar",async t=>{
  const {w,doc}=fixture(t);
  doc.querySelector('[data-coach-page="appointments"]').click();
  const banner=doc.querySelector("#apptPendingBanner");
  assert.equal(banner.hidden,false);
  assert.equal(doc.querySelector("#apptPendingTitle").textContent,"1 randevu isteği onayını bekliyor");
  assert.equal(doc.querySelector("#apptPending").hidden,true);
  doc.querySelector("#apptPendingToggle").click();
  assert.equal(doc.querySelector("#apptPending").hidden,false);
  assert.equal(doc.querySelector("#apptPendingToggle").getAttribute("aria-expanded"),"true");
  assert.ok(doc.querySelector("#apptPending [data-appt-approve]"));
  assert.equal(doc.querySelector("#apptHoursSummary").textContent,"Pzt–Paz 18–20 · 30 dk");
  assert.equal(doc.querySelector("#apptHoursDrawer").hidden,true);
  doc.querySelector("#apptHoursOpen").click();
  assert.equal(doc.querySelector("#apptHoursDrawer").hidden,false);
  doc.querySelector("#apptHoursDrawer").dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  assert.equal(doc.querySelector("#apptHoursDrawer").hidden,true);
  // Sayfa giriş animasyonu transform bırakır; sabit çekmece sayfa bölümünün içinde olursa ekran dışına taşar.
  assert.equal(doc.querySelector("#appointmentsPage").contains(doc.querySelector("#apptHoursDrawer")),false);
  doc.querySelector("#apptHoursOpen").click();
  doc.querySelector('[data-coach-page="messages"]').click();
  assert.equal(doc.querySelector("#apptHoursDrawer").hidden,true,"başka sayfaya geçince çekmece kapanır");
});

test("v41.2 saat özeti ardışık aynı günleri birleştirir, kapalı günleri yazar",t=>{
  const {w}=fixture(t,"");
  const days={"1":{on:true,start:"18:00",end:"21:00"},"2":{on:true,start:"18:00",end:"21:00"},"3":{on:true,start:"18:00",end:"21:00"},"4":{on:true,start:"18:00",end:"21:00"},"5":{on:true,start:"18:00",end:"21:00"},"6":{on:true,start:"11:00",end:"14:30"},"0":{on:false,start:"11:00",end:"14:00"}};
  w.__days=days;
  assert.equal(w.eval("apptHoursSummary({duration:45,days:window.__days})"),"Pzt–Cum 18–21 · Cmt 11–14:30 · Paz kapalı · 45 dk");
  assert.equal(w.eval("apptHoursSummary(null)"),"Uygun saat açmadın; öğrenciler randevu alamaz.");
});
