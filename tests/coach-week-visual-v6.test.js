const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const week='2026-10-05';
const original=()=>[
  {studentUid:'student-a',share:{profile:{name:'Ada'},program:{weeks:[]}}},
  {studentUid:'student-b',share:{profile:{name:'Deniz'},program:{
    rowLabels:{r:{0:'Paragraf'},s:{0:'Matematik',1:'Fizik',2:'Biyoloji'}},
    weeks:[{week,data:{r:{0:{0:'Koç · Paragraf · 20 soru'}},
      s:{0:{0:'Koç · TYT Matematik · Problemler · 40 soru',1:'AYT Matematik · Fonksiyonlar'},
         1:{0:'TYT Fizik · Hareket'},2:{3:'TYT Biyoloji · Hücre'}},
      dn:{'r-0-0':1,'s-0-0':1}}}]
  }}}
];
function harness(t){
  const dom=new JSDOM(read('index.html'),{url:'https://coach.example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,document=w.document,writes=[],alerts=[];
  const auth={currentUser:{uid:'coach-test'}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:'profiles'},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...parts)=>parts,where:(...parts)=>parts,
    serverTimestamp:()=>({ts:true}),
    addDoc:async(ref,data)=>{writes.push({collection:ref.name,...JSON.parse(JSON.stringify(data))});return{id:'action-'+writes.length}},
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{},setDoc:async()=>{},signOut:async()=>{},
    alert:msg=>alerts.push(msg),confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:callback=>{callback(0);return 1},cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read('app-reset.js').replace(/^import[^\n]+\n/gm,'')+
    '\nwindow.coachV6Test={seed(rows,uid,selectedWeek){coachReportRows=rows;selectedProgramStudentUid=uid;selectedProgramWeekStart=selectedWeek;hydrateProgramStudents();renderProgramWorkspace()},stats:coachV6WeekStats,subject:coachV6Subject,dropDraftCache(uid,selectedWeek){coachV7DraftCache.delete(coachV7Key(uid,selectedWeek))},context(){return{student:selectedProgramStudentUid,week:selectedProgramWeekStart,edit:coachProgramEditContext}}};');
  document.getElementById('bootView').classList.add('hidden');
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  const rows=original();w.coachV6Test.seed(rows,'student-b',week);
  return {w,document,rows,writes,alerts,$:id=>document.getElementById(id)};
}
test('visual weekly plan matches saved data with actual totals, no invented dates or lesson times',t=>{
  const h=harness(t),v=h.$('coachVisualWeekBoard');
  assert.equal(h.$('programsPage').dataset.coachWeekView,'visual');
  assert.equal(v.querySelectorAll('.coach-v6-day').length,7);
  assert.equal(v.querySelectorAll('.coach-v6-task').length,5);
  assert.equal(v.querySelector('[data-stat="total"] strong').textContent,'5');
  assert.equal(v.querySelector('[data-stat="done"] strong').textContent,'40%');
  assert.equal(v.querySelector('[data-stat="subjects"] strong').textContent,'4');
  assert.equal(v.querySelector('[data-stat="average"] strong').textContent,'0,7');
  assert.equal(v.querySelectorAll('.coach-v6-task[data-task-completed="true"]').length,2);
  assert.equal(v.querySelectorAll('[data-program-edit]').length,5);
  assert.equal(v.querySelectorAll('[data-program-select]').length,5);
  assert.equal(h.writes.length,0,'rendering the live student program must be read-only');
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-scroller'),'original classic board stays mounted');
  assert.doesNotMatch(v.querySelector('.coach-v6-days').textContent,/\b09:00\b|\b10:00\b/);
});
test('lesson colors group TYT/AYT together and user text cannot inject DOM or scripts',t=>{
  const h=harness(t),v=h.$('coachVisualWeekBoard');
  assert.equal(v.querySelector('[data-program-task-id="s-0-0"]').dataset.subject,'math');
  assert.equal(v.querySelector('[data-program-task-id="s-0-1"]').dataset.subject,'math');
  assert.equal(v.querySelector('[data-program-task-id="s-1-0"]').dataset.subject,'physics');
  assert.equal(v.querySelector('[data-program-task-id="r-0-0"]').dataset.subject,'reading');
  const malicious='Koç · Fizik · <img src=x onerror="window.injected=true">';
  h.rows[1].share.program.weeks[0].data.s[1][0]=malicious;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelector('img,script'),null);
  assert.ok(h.$('coachVisualWeekBoard').textContent.includes('<img src=x onerror='));
  assert.equal(h.w.injected,undefined);
});
test('week/list and classic/visual switches are live and can restore original view without writing',t=>{
  const h=harness(t),v=h.$('coachVisualWeekBoard');
  v.querySelector('[data-coach-v6-layout="list"]').click();
  assert.equal(v.querySelector('.coach-v6-days').dataset.layout,'list');
  assert.equal(v.querySelector('[data-coach-v6-layout="list"]').getAttribute('aria-pressed'),'true');
  h.$('coachWeekClassicMode').click();
  assert.equal(h.$('programsPage').dataset.coachWeekView,'classic');
  assert.equal(h.$('coachWeekClassicMode').getAttribute('aria-pressed'),'true');
  h.$('coachWeekVisualMode').click();
  assert.equal(h.$('programsPage').dataset.coachWeekView,'visual');
  assert.equal(h.writes.length,0);
  assert.match(read('coach-week-visual-v6.css'),/#programsPage\[data-coach-week-view="visual"\] #programWeekBoard\{display:none!important\}/);
  assert.match(read('coach-week-visual-v6.css'),/#programsPage\[data-coach-week-view="classic"\] #coachVisualWeekBoard\{display:none!important\}/);
});
test('new card edit opens the existing editor and preserves the exact source task id and date',t=>{
  const h=harness(t),v=h.$('coachVisualWeekBoard');
  v.querySelector('[data-program-task-id="s-0-1"] [data-program-edit]').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskText').value,'AYT Matematik · Fonksiyonlar');
  assert.equal(h.$('programTaskDate').value,'2026-10-06');
  assert.equal(h.$('programTaskDate').disabled,true);
  assert.equal(h.w.coachV6Test.context().edit.taskId,'s-0-1');
  assert.equal(h.writes.length,0);
});
test('one-click day + Ekle shows only a tiny inline editor, not the long form or old modal',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelector('[data-v9-toggle]').getAttribute('aria-expanded'),'false');
  assert.equal(h.$('coachV7InlineForm').hidden,true);
  assert.equal(root.querySelector('[data-v10-inline="4"]').hidden,true);
  root.querySelector('[data-coach-add-day="4"]').click();
  assert.equal(root.querySelector('[data-v10-inline="4"]').hidden,false);
  assert.equal(root.querySelectorAll('[data-v10-inline]:not([hidden])').length,1);
  assert.equal(root.querySelector('[data-coach-add-day="4"]').getAttribute('aria-expanded'),'true');
  assert.equal(h.$('coachV7InlineForm').hidden,true);
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  assert.equal(h.writes.length,0);
});
test('weekly quick actions section is removed without affecting existing lesson entry controls',t=>{
  const h=harness(t),visual=h.$('coachVisualWeekBoard');
  assert.equal(visual.querySelector('.coach-v6-quick'),null);
  assert.equal(visual.querySelector('.coach-v6-quick-actions'),null);
  assert.equal(visual.querySelector('[data-coach-quick]'),null);
  assert.equal(visual.textContent.includes('Hızlı İşlemler'),false);
  assert.equal(visual.querySelectorAll('[data-coach-add-day]').length,7);
  assert.ok(visual.querySelector('[data-v10-bulk-toggle]'));
  assert.ok(h.$('programAddWeekBtn'));
  assert.ok(h.$('programTemplatesBtn'));
  assert.ok(h.$('programAddTaskBtn'));
  assert.equal(h.writes.length,0);
});
test('visual board re-renders for the new student and selected week without stale tasks',t=>{
  const h=harness(t);
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v6-task').length,0);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v6-day').length,7);
  h.w.coachV6Test.seed(h.rows,'student-b','2026-10-12');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v6-task').length,0);
  assert.ok(h.$('coachVisualWeekBoard').textContent.includes('12 Eki')||h.$('coachVisualWeekBoard').textContent.includes('12 Ekim')||h.$('coachVisualWeekBoard').textContent.includes('12'));
  assert.equal(h.writes.length,0);
});


function v7Input(h,id,value){
  const node=h.$(id);node.value=value;
  node.dispatchEvent(new h.w.Event('input',{bubbles:true}));
}
function v7SetDays(h,days){
  const chosen=new Set(days);
  for(const day of Array.from({length:7},(_,i)=>i)){
    const button=h.$('coachVisualWeekBoard').querySelector('[data-v7-pick-day="'+day+'"]');
    if((button.getAttribute('aria-pressed')==='true')!==chosen.has(day))button.click();
  }
}
function v7Add(h,text,{time='',url='',days=[0]}={}){
  v7Input(h,'coachV7DraftText',text);
  v7Input(h,'coachV7DraftTime',time);
  v7Input(h,'coachV7DraftUrl',url);
  v7SetDays(h,days);
  h.$('coachVisualWeekBoard').querySelector('[data-v7-add]').click();
}
async function v7Settle(){for(let i=0;i<24;i++)await Promise.resolve()}

test('v7 form collects selected days and explicit start times as a local draft without network writes',t=>{
  const h=harness(t);
  v7Add(h,'TYT Matematik · Problemler 30 soru',{time:'09:15',days:[0,2,4]});
  const root=h.$('coachVisualWeekBoard'),drafts=root.querySelectorAll('.coach-v7-draft');
  assert.equal(drafts.length,3);
  assert.deepEqual([...drafts].map(x=>Number(x.closest('[data-day]').dataset.day)),[0,2,4]);
  assert.equal(root.querySelector('[data-v7-send]').textContent,'Taslağı Gönder (3)');
  assert.equal(root.querySelectorAll('.coach-v7-draft-main em').length,3);
  assert.equal(h.writes.length,0);
  const key=h.w.sessionStorage.key(0);
  assert.match(key,/yks-coach-week-draft-v7:coach-test\|student-b\|2026-10-05/);
  assert.equal(JSON.parse(h.w.sessionStorage.getItem(key)).length,3);
});
test('v7 draft edits, selectable day move and delete affect only the local draft',t=>{
  const h=harness(t);
  v7Add(h,'Fizik · Kuvvet',{days:[0]});
  let root=h.$('coachVisualWeekBoard');
  root.querySelector('[data-v7-edit]').click();
  assert.equal(h.$('coachV7DraftText').value,'Fizik · Kuvvet');
  v7Input(h,'coachV7DraftText','Fizik · Hareket');
  v7Input(h,'coachV7DraftTime','10:30');
  root=h.$('coachVisualWeekBoard');
  root.querySelector('[data-v7-add]').click();
  root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,1);
  assert.match(root.querySelector('.coach-v7-draft').textContent,/Hareket/);
  assert.match(root.querySelector('.coach-v7-draft').textContent,/10:30/);
  const picker=root.querySelector('[data-v7-move]');picker.value='5';
  picker.dispatchEvent(new h.w.Event('change',{bubbles:true}));
  root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelector('.coach-v7-draft').closest('[data-day]').dataset.day,'5');
  root.querySelector('[data-v7-remove]').click();
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  assert.equal(h.writes.length,0);
});
test('v7 validates time, url and sends nothing before explicit approval',async t=>{
  const h=harness(t);
  v7Input(h,'coachV7DraftText','Kimya · Karışımlar');
  v7Input(h,'coachV7DraftUrl','javascript:alert(1)');
  h.$('coachVisualWeekBoard').querySelector('[data-v7-add]').click();
  assert.match(h.$('coachV7FormError').textContent,/http veya https/);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  v7Input(h,'coachV7DraftUrl','');
  h.$('coachVisualWeekBoard').querySelector('[data-v7-add]').click();
  assert.equal(h.writes.length,0);
  h.w.confirm=()=>false;
  h.$('coachVisualWeekBoard').querySelector('[data-v7-send]').click();await v7Settle();
  assert.equal(h.writes.length,0);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,1);
});
test('v7 confirms and queues individual student-compatible tasks with user-provided times',async t=>{
  const h=harness(t);
  v7Add(h,'TYT Biyoloji · Hücre',{time:'13:10',url:'https://youtu.be/example',days:[1,4]});
  const button=h.$('coachVisualWeekBoard').querySelector('[data-v7-send]');
  button.click();button.click();await v7Settle();
  assert.equal(h.writes.length,2,'double click must not duplicate send actions');
  assert.deepEqual(h.writes.map(x=>x.payload),[
    {text:'TYT Biyoloji · Hücre · Saat 13:10 — https://youtu.be/example',date:'2026-10-06'},
    {text:'TYT Biyoloji · Hücre · Saat 13:10 — https://youtu.be/example',date:'2026-10-09'}
  ]);
  assert.ok(h.writes.every(x=>x.type==='program_task'&&x.status==='pending'&&x.studentUid==='student-b'));
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  assert.match(h.$('coachV7DraftStatus').textContent,/Öğrenci uygulamasında işlenmesi bekleniyor/);
});
test('v7 partial send failure leaves only unsent tasks and retry does not resend successful tasks',async t=>{
  const h=harness(t);
  v7Add(h,'Paragraf · 20 soru',{days:[0,1,2]});
  const originalWrite=h.w.addDoc;
  let attempt=0;
  h.w.addDoc=async (ref,data)=>{attempt++;if(attempt===2)throw new Error('offline');return originalWrite(ref,data)};
  h.$('coachVisualWeekBoard').querySelector('[data-v7-send]').click();await v7Settle();
  assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05']);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,2);
  assert.match(h.$('coachV7DraftStatus').textContent,/2 çalışma taslakta/);
  h.$('coachVisualWeekBoard').querySelector('[data-v7-send]').click();await v7Settle();
  assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05','2026-10-06','2026-10-07']);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
});
test('v7 drafts are isolated by student and week; switching context does not leak or send old tasks',t=>{
  const h=harness(t);
  v7Add(h,'Matematik · Problemler',{days:[0]});
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  h.w.coachV6Test.seed(h.rows,'student-b','2026-10-12');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(h.writes.length,0);
});
test('v7 draggable draft changes day locally; existing task drop uses confirmed original move action',async t=>{
  const h=harness(t);v7Add(h,'Kimya · Atom',{days:[0]});
  let root=h.$('coachVisualWeekBoard');
  root.querySelector('.coach-v7-draft').dispatchEvent(new h.w.Event('dragstart',{bubbles:true,cancelable:true}));
  root.querySelector('.coach-v6-day[data-day="4"]').dispatchEvent(new h.w.Event('drop',{bubbles:true,cancelable:true}));
  root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelector('.coach-v7-draft').closest('[data-day]').dataset.day,'4');
  assert.equal(h.writes.length,0);
  const existing=root.querySelector('[data-program-task-id="s-0-1"]');
  existing.dispatchEvent(new h.w.Event('dragstart',{bubbles:true,cancelable:true}));
  root.querySelector('.coach-v6-day[data-day="6"]').dispatchEvent(new h.w.Event('drop',{bubbles:true,cancelable:true}));
  await v7Settle();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0].payload,{operation:'move',sourceWeek:week,taskId:'s-0-1',date:'2026-10-11'});
  assert.equal(h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"]'),null);
  assert.ok(h.$('programWeekBoard').querySelector('[data-program-task-id="s-0-6"]'));
});
test('v12 keeps recorded lesson times for editing but hides the clock in the weekly table',t=>{
  const h=harness(t),row=h.rows[1];
  row.share.program.weeks[0].data.s[0][1]='AYT Matematik · Fonksiyonlar · Saat 11:35';
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const card=h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"]');
  assert.ok(card);
  assert.doesNotMatch(card.textContent,/11:35|Saat /);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-time-badge').length,0);
  card.querySelector('[data-program-edit]').click();
  assert.equal(h.$('programTaskText').value,'AYT Matematik · Fonksiyonlar · Saat 11:35');
  assert.equal(h.writes.length,0);
});


test('v8 TYT/AYT and eight subject shortcuts fill the editable draft title without sending',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('[data-v8-preset]').length,8);
  root.querySelector('[data-v8-level="AYT"]').click();
  root.querySelector('[data-v8-preset="physics"]').click();
  assert.equal(h.$('coachV7DraftText').value,'AYT Fizik · Konu tekrarı · 20 soru');
  v7Input(h,'coachV7DraftText','AYT Fizik · Elektrik Alan · 35 soru');
  root.querySelector('[data-v8-days="alternate"]').click();
  assert.equal(h.$('coachV8DraftCount').textContent,'3 güne 3 çalışma eklenecek');
  assert.equal(root.querySelectorAll('[data-v7-pick-day][aria-pressed="true"]').length,3);
  root.querySelector('[data-v7-add]').click();
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,3);
  assert.equal(h.writes.length,0);
});

test('v8 repeated drafting keeps selected days, allowing multiple subjects without seven repetitive clicks',t=>{
  const h=harness(t);let root=h.$('coachVisualWeekBoard');
  root.querySelector('[data-v8-days="weekdays"]').click();
  root.querySelector('[data-v8-preset="reading"]').click();
  root.querySelector('[data-v7-add]').click();
  root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,5);
  assert.equal(root.querySelectorAll('[data-v7-pick-day][aria-pressed="true"]').length,5);
  assert.equal(h.$('coachV8DraftCount').textContent,'5 güne 5 çalışma eklenecek');
  root.querySelector('[data-v8-preset="math"]').click();
  root.querySelector('[data-v7-add]').click();
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,10);
  assert.equal(h.writes.length,0);
  const tasks=JSON.parse(h.w.sessionStorage.getItem(h.w.sessionStorage.key(0)));
  assert.equal(tasks.filter(x=>x.text.includes('Paragraf')).length,5);
  assert.equal(tasks.filter(x=>x.text.includes('Matematik')).length,5);
});

test('v8 modal quick presets allow draft-first bulk planning without any Firestore action',t=>{
  const h=harness(t);
  h.$('programAddWeekBtn').click();
  const picker=h.$('coachV8ModalPicker');
  assert.equal(picker.querySelectorAll('[data-v8-preset]').length,8);
  picker.querySelector('[data-v8-level="AYT"]').click();
  picker.querySelector('[data-v8-preset="biology"]').click();
  assert.equal(h.$('programTaskText').value,'AYT Biyoloji · Konu tekrarı · 20 soru');
  h.$('programTaskAddDraft').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  assert.equal(h.writes.length,0);
  const draft=h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft');
  assert.equal(draft.length,5);
  assert.deepEqual([...draft].map(x=>Number(x.closest('[data-day]').dataset.day)),[0,1,2,3,4]);
  assert.match(h.$('coachV7DraftStatus').textContent,/henüz gönderilmedi/);
});

test('v8 modal draft selection targets the chosen week even when its date differs from the visible week',t=>{
  const h=harness(t);
  h.$('programAddTaskBtn').click();
  v7Input(h,'programTaskDate','2026-10-15');
  h.$('coachV8ModalPicker').querySelector('[data-v8-preset="math"]').click();
  h.$('programTaskAddDraft').click();
  assert.equal(h.w.coachV6Test.context().week,'2026-10-12');
  const root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(root.querySelector('.coach-v7-draft').closest('[data-day]').dataset.day,'3');
  assert.equal(h.writes.length,0);
});

test('v8 modal direct-send action still uses the original protocol after choosing a quick lesson',async t=>{
  const h=harness(t);
  h.$('programAddTaskBtn').click();
  v7Input(h,'programTaskDate','2026-10-05');
  h.$('coachV8ModalPicker').querySelector('[data-v8-preset="reading"]').click();
  h.$('programTaskSend').click();await v7Settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].type,'program_task');
  assert.deepEqual(h.writes[0].payload,{text:'Paragraf · 20 soru',date:'2026-10-05'});
});

test('v8 editing existing student tasks cannot use the new draft action',t=>{
  const h=harness(t);
  h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"] [data-program-edit]').click();
  assert.equal(h.$('programTaskBackdrop').hasAttribute('data-editing'),true);
  assert.match(read('coach-lesson-composer-v8.css'),/#programTaskAddDraft\{display:none!important\}/);
  h.$('programTaskAddDraft').click();
  assert.equal(h.writes.length,0);
  assert.equal(h.w.coachV6Test.context().edit.taskId,'s-0-1');
});


test('compact editor is collapsed by default and can be toggled without erasing the week',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard'),toggle=root.querySelector('[data-v9-toggle]');
  assert.equal(h.$('coachV7InlineForm').hidden,true);
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  toggle.click();
  assert.equal(h.$('coachV7InlineForm').hidden,false);
  toggle.click();
  assert.equal(h.$('coachV7InlineForm').hidden,true);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v6-day').length,7);
  assert.equal(h.writes.length,0);
});

test('more than 100 studies per week are preserved and rendered without losing a column',t=>{
  const h=harness(t);
  const key='yks-coach-week-draft-v7:coach-test|student-b|2026-10-05';
  const large=Array.from({length:115},(_,i)=>({
    id:'lesson-'+i,day:i%7,text:'TYT Matematik · Çalışma '+i,time:'',url:''
  }));
  h.w.sessionStorage.setItem(key,JSON.stringify(large));
  h.w.coachV6Test.dropDraftCache('student-b',week);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,115);
  assert.equal(root.querySelector('[data-v7-send]').textContent,'Taslağı Gönder (115)');
  for(let day=0;day<7;day++)assert.ok(root.querySelector('.coach-v6-day[data-day="'+day+'"] .coach-v7-draft'));
  assert.match(read('coach-compact-v9.css'),/max-height:340px;overflow-y:auto/);
  assert.equal(h.writes.length,0);
});

test('existing-task move to a full day grows an extra row without overwriting other lessons',async t=>{
  const h=harness(t),weekData=h.rows[1].share.program.weeks[0].data;
  for(let i=0;i<3;i++)weekData.s[i][4]='Yerinde kalacak '+i;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const moved=h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"]');
  moved.dispatchEvent(new h.w.Event('dragstart',{bubbles:true,cancelable:true}));
  h.$('coachVisualWeekBoard').querySelector('.coach-v6-day[data-day="4"]').dispatchEvent(new h.w.Event('drop',{bubbles:true,cancelable:true}));
  await v7Settle();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0].payload,{operation:'move',sourceWeek:week,taskId:'s-0-1',date:'2026-10-09'});
  for(let i=0;i<3;i++)assert.equal(weekData.s[i][4],'Yerinde kalacak '+i);
  assert.equal(weekData.s[3][4],'AYT Matematik · Fonksiyonlar');
  assert.equal(h.$('programWeekBoard').querySelector('[data-program-task-id="s-3-4"]')!==null,true);
});


function v10DayOpen(h,day){
  h.$('coachVisualWeekBoard').querySelector('[data-coach-add-day="'+day+'"]').click();
  return h.$('coachVisualWeekBoard').querySelector('[data-v10-inline="'+day+'"]');
}
function v10DayType(h,day,value,enter=true){
  const node=h.$('coachVisualWeekBoard').querySelector('[data-v10-input="'+day+'"]');
  node.value=value;
  if(enter)node.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
}
test('v10 one-field quick entry supports repeated Enter, grows a single day and never sends to student',t=>{
  const h=harness(t);
  v10DayOpen(h,3);
  v10DayType(h,3,'TYT Matematik · Problemler · 25 soru');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(h.$('coachVisualWeekBoard').querySelector('[data-v10-inline="3"]').hidden,false);
  assert.equal(h.$('coachVisualWeekBoard').querySelector('[data-v10-input="3"]').value,'');
  v10DayType(h,3,'TYT Kimya · Atom · 30 soru');
  const root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,2);
  assert.equal(root.querySelector('.coach-v6-day[data-day="3"]').querySelectorAll('.coach-v7-draft').length,2);
  assert.equal(root.querySelector('[data-v10-inline="3"]').hidden,false);
  assert.match(root.querySelector('[data-v7-send]').textContent,/2/);
  assert.equal(h.writes.length,0);
});
test('v10 day presets fill the lesson, editable topic and enter save without duplicate dialogs',t=>{
  const h=harness(t),part=v10DayOpen(h,2);
  const select=part.querySelector('[data-v10-subject="2"]');
  select.value='math|AYT';
  select.dispatchEvent(new h.w.Event('change',{bubbles:true}));
  assert.equal(part.querySelector('[data-v10-input="2"]').value,'AYT Matematik · Problemler · 30 soru');
  v10DayType(h,2,'AYT Matematik · Fonksiyonlar · 20 soru');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,1);
  assert.match(h.$('coachVisualWeekBoard').querySelector('.coach-v7-draft').textContent,/Fonksiyonlar/);
  assert.equal(h.writes.length,0);
});
test('v10 day editor can switch target day and escape without touching the draft',t=>{
  const h=harness(t);
  v10DayOpen(h,5);
  v10DayOpen(h,0);
  assert.equal(h.$('coachVisualWeekBoard').querySelector('[data-v10-inline="5"]').hidden,true);
  const input=h.$('coachVisualWeekBoard').querySelector('[data-v10-input="0"]');
  input.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('[data-v10-inline]:not([hidden])').length,0);
  assert.equal(h.writes.length,0);
});
const v35Flush=()=>new Promise(resolve=>setImmediate(resolve));
function v35Open(h){
  h.$('programBulkTasksBtn').click();
  return h.$('coachV10Bulk');
}
function v35Paste(h,text){
  const bulk=v35Open(h);
  bulk.querySelector('[data-v35-mode="paste"]').click();
  const box=bulk.querySelector('[data-v35-paste]');box.value=text;box.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  return bulk;
}
const v35Sent=h=>h.writes.filter(x=>x.collection==='coachingActions'&&x.type==='program_task').map(x=>[x.payload.date,x.payload.text]);
test('v35 toplu görev penceresi üst menüden açılır, Esc ve × ile kapanır, yazmadan önce hiçbir şey göndermez',t=>{
  const h=harness(t);
  assert.equal(h.$('coachV10Bulk').hidden,true);
  const bulk=v35Open(h);
  assert.equal(bulk.hidden,false);
  assert.equal(bulk.querySelector('[role="dialog"]').getAttribute('aria-modal'),'true');
  assert.match(bulk.textContent,/Deniz/);
  bulk.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(bulk.hidden,true);
  v35Open(h).querySelector('[data-v35-close]').click();
  assert.equal(h.$('coachV10Bulk').hidden,true);
  assert.equal(h.writes.length,0);
});
test('v35 paste sends mixed lines with correct dates and subject-first text',async t=>{
  const h=harness(t);
  const bulk=v35Paste(h,'Pzt TYT Matematik Problemler 30 soru\nPzt Paragraf 20 soru\n\nPer AYT Biyoloji Sinir Sistemi konu anlatımı\nPaz Deneme analizi');
  assert.equal(bulk.querySelectorAll('.coach-v35-line[data-state="ok"]').length,4);
  assert.match(bulk.querySelector('[data-v10-bulk-add]').textContent,/Öğrenciye gönder \(4 görev\)/);
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.deepEqual(v35Sent(h),[
    ['2026-10-05','TYT Matematik · Problemler · Soru çözümü · 30 soru'],
    ['2026-10-05','TYT Paragraf · Soru çözümü · 20 soru'],
    ['2026-10-08','AYT Biyoloji · Sinir Sistemi · Konu anlatımı'],
    ['2026-10-11','TYT Deneme · Deneme analizi']
  ]);
  assert.ok(h.writes.every(x=>x.studentUid==='student-b'&&x.coachUid==='coach-test'&&x.status==='pending'));
  assert.match(h.$('coachV10Bulk').querySelector('[data-v10-bulk-error]').textContent,/4 görev öğrenciye gönderildi/);
  assert.equal(h.$('coachV10Bulk').querySelector('[data-v35-paste]').value,'');
});
test('v35 paste understands day ranges, lists, hafta içi and free tasks',async t=>{
  const h=harness(t),bulk=v35Paste(h,'Çar-Cum Kimya Mol Kavramı 40 soru\nPzt,Per Fizik Optik\nhafta içi Paragraf 20 soru\nCmt kitap okuma');
  assert.equal(bulk.querySelectorAll('.coach-v35-line[data-state="free"]').length,1);
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  const sent=v35Sent(h);
  assert.equal(sent.length,3+2+5+1);
  assert.deepEqual(sent.slice(0,3).map(x=>x[0]),['2026-10-07','2026-10-08','2026-10-09']);
  assert.ok(sent.slice(0,3).every(x=>x[1]==='TYT Kimya · Mol Kavramı · Soru çözümü · 40 soru'));
  assert.deepEqual(sent.at(-1),['2026-10-10','kitap okuma']);
});
test('v35 bulk validation is all-or-nothing; preserves text and never sends malformed work',async t=>{
  const h=harness(t),bulk=v35Paste(h,'Pzt Matematik Problemler\nMatematik Problemler');
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.match(bulk.querySelector('[data-v10-bulk-error]').textContent,/2\. satır: Gün anlaşılmadı/);
  assert.equal(bulk.querySelector('[data-v35-paste]').value,'Pzt Matematik Problemler\nMatematik Problemler');
  const box=bulk.querySelector('[data-v35-paste]');box.value='Pzt Matematik Problemler\nSal '+'x'.repeat(601);box.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.match(bulk.querySelector('[data-v10-bulk-error]').textContent,/600 karakter/);
  assert.equal(h.writes.length,0);
  box.value='Pzt Matematik Problemler\nSal Fizik Hareket ve Kuvvet';box.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.deepEqual(v35Sent(h).map(x=>x[1]),['TYT Matematik · Problemler · Soru çözümü','TYT Fizik · Hareket ve Kuvvet · Soru çözümü']);
});
test('v35 interrupted send keeps only the unsent remainder and never repeats sent tasks',async t=>{
  const h=harness(t),bulk=v35Paste(h,'Pzt Kimya Mol Kavramı\nSal Kimya Karışımlar\nÇar Kimya Asit-Baz-Tuz');
  let calls=0;
  const original=h.writes.push.bind(h.writes);
  h.writes.push=item=>{calls++;if(calls===2)throw new Error('ağ hatası');return original(item);};
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.equal(h.writes.length,1);
  assert.match(bulk.querySelector('[data-v10-bulk-error]').textContent,/1 görev gönderildi\. Kalan 2 görev/);
  assert.match(bulk.querySelector('[data-v10-bulk-add]').textContent,/Kalan 2 görevi gönder/);
  h.writes.push=original;
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.deepEqual(v35Sent(h).map(x=>x[1]),['TYT Kimya · Mol Kavramı · Soru çözümü','TYT Kimya · Karışımlar · Soru çözümü','TYT Kimya · Asit-Baz-Tuz · Soru çözümü']);
});
test('v35 bulk input handles more than the former 100 task cap and sends each record once',async t=>{
  const h=harness(t),bulk=v35Paste(h,Array.from({length:120},(_,i)=>'Çar TYT Matematik Tekrar '+(i+1)).join('\n'));
  assert.match(bulk.querySelector('[data-v10-bulk-add]').textContent,/120 görev/);
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.equal(v35Sent(h).length,120);
  assert.equal(new Set(v35Sent(h).map(x=>x[1])).size,120);
});
test('v35 table rows compose subject-first text for each selected day and validate missing days',async t=>{
  const h=harness(t),bulk=v35Open(h);
  const set=(selector,value)=>{const node=bulk.querySelector(selector);node.value=value;node.dispatchEvent(new h.w.Event('change',{bubbles:true}));};
  set('[data-v35-row="0"] [data-v35-field="subject"]','Kimya');
  assert.ok([...bulk.querySelectorAll('#coachV35Topics0 option')].some(o=>o.value==='Mol Kavramı'),'konu önerileri öğrenci müfredatından');
  set('[data-v35-row="0"] [data-v35-field="topic"]','Mol Kavramı');
  set('[data-v35-row="0"] [data-v35-field="count"]','40');
  bulk.querySelector('[data-v35-row="0"] [data-v35-day="0"]').click();
  bulk.querySelector('[data-v35-row="0"] [data-v35-day="2"]').click();
  assert.match(bulk.querySelector('[data-v35-row="0"] [data-v35-preview]').textContent,/TYT Kimya · Mol Kavramı · Soru çözümü · 40 soru · 2 gün/);
  bulk.querySelector('[data-v35-dup-row]').click();
  set('[data-v35-row="1"] [data-v35-field="level"]','AYT');
  set('[data-v35-row="1"] [data-v35-field="subject"]','Fizik');
  bulk.querySelector('[data-v35-row="1"] [data-v35-day="0"]').click();
  bulk.querySelector('[data-v35-row="1"] [data-v35-day="2"]').click();
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.match(bulk.querySelector('[data-v10-bulk-error]').textContent,/2\. satırda gün seçilmedi/);
  assert.equal(h.writes.length,0);
  bulk.querySelector('[data-v35-row="1"] [data-v35-day="4"]').click();
  assert.match(bulk.querySelector('[data-v10-bulk-add]').textContent,/3 görev/);
  bulk.querySelector('[data-v10-bulk-add]').click();await v35Flush();
  assert.deepEqual(v35Sent(h),[
    ['2026-10-05','TYT Kimya · Mol Kavramı · Soru çözümü · 40 soru'],
    ['2026-10-07','TYT Kimya · Mol Kavramı · Soru çözümü · 40 soru'],
    ['2026-10-09','AYT Fizik · Soru çözümü · 40 soru']
  ]);
});
test('v10 per-day draft stays bound to the selected student and week',t=>{
  const h=harness(t);
  v10DayOpen(h,1);
  v10DayType(h,1,'TYT Fizik · Kuvvet');
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  h.w.coachV6Test.seed(h.rows,'student-b','2026-10-12');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,0);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(h.writes.length,0);
});
test('v10 quick-entry text escapes markup and does not create active DOM scripts',t=>{
  const h=harness(t);
  v10DayOpen(h,1);
  v10DayType(h,1,'Fizik · <img src=x onerror="window.hacked=true">');
  const root=h.$('coachVisualWeekBoard');
  assert.equal(root.querySelector('.coach-v7-draft img'),null);
  assert.match(root.querySelector('.coach-v7-draft').textContent,/<img/);
  assert.equal(h.w.hacked,undefined);
  assert.equal(h.writes.length,0);
});


test('v12 weekly table has seven moderate-size day columns with no clock axis',t=>{
  const h=harness(t),table=h.$('coachVisualWeekBoard').querySelector('.coach-v12-week-table');
  assert.ok(table);
  assert.equal(table.dataset.layout,'week');
  assert.equal(table.querySelectorAll('.coach-v11-time-rail,.coach-v11-time-hour,.coach-v11-hour-slot').length,0);
  assert.equal(table.querySelectorAll('.coach-v11-day').length,7);
  assert.equal(table.querySelectorAll('.coach-v12-card-stack').length,7);
  assert.equal(table.querySelectorAll('.coach-v6-add-day').length,7);
  assert.equal(table.querySelectorAll('.coach-v11-task').length,5);
  assert.equal(table.querySelectorAll('.coach-v11-task-menu').length,5);
  assert.equal(table.querySelectorAll('[data-program-edit]').length,5);
  assert.equal(table.querySelectorAll('[data-program-select]').length,5);
  assert.doesNotMatch(table.textContent,/Saati yok|\b09:00\b|\b21:00\b/);
  assert.equal(h.writes.length,0);
});

test('v12 keeps all tasks for each day, in their own scrollable stack with stable task identities',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard'),table=root.querySelector('.coach-v12-week-table');
  assert.equal(table.querySelectorAll('[data-task-count]').length,7);
  assert.equal(table.querySelector('[data-program-task-id="s-0-1"]').dataset.programTaskDay,'1');
  assert.equal(table.querySelector('.coach-v11-day[data-day="0"] .coach-v12-card-stack').dataset.taskCount,'3');
  assert.equal(table.querySelector('.coach-v11-day[data-day="1"] .coach-v12-card-stack').dataset.taskCount,'1');
  assert.equal(table.querySelector('.coach-v11-day[data-day="3"] .coach-v12-card-stack').dataset.taskCount,'1');
  assert.equal(table.querySelectorAll('.coach-v11-day .coach-v11-day-footer').length,7);
  assert.equal(h.$('programWeekBoard').querySelector('.student-program-scroller')!==null,true);
  assert.equal(h.writes.length,0);
});

test('v12 tasks with 06:45, 11:05 and 23:20 keep their correct dates but show no clock labels',t=>{
  const h=harness(t),raw=h.rows[1].share.program.weeks[0].data;
  raw.s[0][1]='AYT Matematik · Fonksiyonlar · Saat 11:35';
  raw.s[1][0]='TYT Fizik · Hareket · Saat 23:20';
  raw.s[2][3]='TYT Biyoloji · Hücre · Saat 06:45';
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const table=h.$('coachVisualWeekBoard').querySelector('.coach-v12-week-table');
  assert.equal(table.querySelector('.coach-v11-day[data-day="1"] [data-program-task-id="s-0-1"]').dataset.subject,'math');
  assert.equal(table.querySelector('.coach-v11-day[data-day="0"] [data-program-task-id="s-1-0"]').dataset.subject,'physics');
  assert.equal(table.querySelector('.coach-v11-day[data-day="3"] [data-program-task-id="s-2-3"]').dataset.subject,'biology');
  assert.equal(table.querySelectorAll('.coach-v11-task').length,5);
  assert.doesNotMatch(table.textContent,/11:35|23:20|06:45|Saat /);
  assert.equal(raw.s[0][1],'AYT Matematik · Fonksiyonlar · Saat 11:35');
  assert.equal(h.writes.length,0);
});

test('v12 time-stamped local draft stays in its chosen day as a normal compact card',t=>{
  const h=harness(t);
  v7Add(h,'TYT Kimya · Atom',{time:'10:45',days:[3]});
  const root=h.$('coachVisualWeekBoard'),day=root.querySelector('.coach-v11-day[data-day="3"]');
  const card=day.querySelector('.coach-v12-card-stack .coach-v7-draft');
  assert.ok(card);
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(card.querySelector('[data-v7-edit]')!==null,true);
  assert.equal(h.writes.length,0);
  assert.match(read('coach-week-preview-table-v11.css'),/\.coach-v12-week-table \.coach-v7-draft-main em/);
});

test('v12 expanding the task action menu leaves edit and move controls working',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  const card=root.querySelector('[data-program-task-id="s-0-1"]');
  assert.ok(card.querySelector('summary'));
  card.querySelector('summary').click();
  assert.equal(card.querySelector('details').open,true);
  assert.ok(card.querySelector('[data-program-edit]'));
  assert.ok(card.querySelector('[data-program-select]'));
  card.querySelector('[data-program-edit]').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskText').value,'AYT Matematik · Fonksiyonlar');
  assert.equal(h.writes.length,0);
});

test('v12 week/list and width controls change only weekly table presentation',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  const table=root.querySelector('.coach-v12-week-table'),wide=root.querySelector('[data-v11-width]');
  assert.equal(wide.getAttribute('aria-pressed'),'false');
  wide.click();assert.equal(table.dataset.density,'wide');
  root.querySelector('[data-coach-v6-layout="list"]').click();
  assert.equal(table.dataset.layout,'list');
  root.querySelector('[data-coach-v6-layout="week"]').click();
  assert.equal(table.dataset.layout,'week');
  assert.equal(table.querySelectorAll('.coach-v11-day').length,7);
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-scroller'));
  assert.ok(h.$('coachV7DraftText'));
  assert.equal(h.writes.length,0);
});

test('v12 135 lessons remain available on one day without page-stretching rows or lost tasks',t=>{
  const h=harness(t);
  const key='yks-coach-week-draft-v7:coach-test|student-b|2026-10-05';
  const many=Array.from({length:135},(_,i)=>({
    id:'lesson-'+i,day:1,text:'AYT Fizik · Çalışma '+i,time:'',url:''
  }));
  h.w.sessionStorage.setItem(key,JSON.stringify(many));
  h.w.coachV6Test.dropDraftCache('student-b',week);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const table=h.$('coachVisualWeekBoard').querySelector('.coach-v12-week-table');
  assert.equal(table.querySelectorAll('.coach-v7-draft').length,135);
  assert.equal(table.querySelector('.coach-v11-day[data-day="1"] .coach-v12-card-stack').dataset.taskCount,'136');
  assert.ok(table.querySelector('.coach-v11-day[data-day="1"] .coach-v6-add-day'));
  assert.equal(h.writes.length,0);
});

test('v13 table grows to reveal every lesson without any independent vertical scrollbar',t=>{
  const css=read('coach-week-preview-table-v11.css');
  const html=read('index.html');
  assert.match(html,/coach-week-preview-table-v11\.css\?v=1\.0\.2/);
  assert.match(css,/#programsPage #coachVisualWeekBoard \.coach-v12-week-table/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(166px,1fr\)\)/);
  assert.match(css,/min-height:182px;height:auto/);
  assert.match(css,/min-height:145px/);
  assert.match(css,/\.coach-v12-card-stack\{/);
  assert.match(css,/max-height:none!important/);
  assert.match(css,/overflow:visible!important/);
  assert.match(css,/grid-auto-rows:max-content/);
  assert.match(css,/margin:0;padding:9px 7px!important/);
  assert.match(css,/\.coach-v11-task-menu\[open\]/);
  assert.match(css,/position:static/);
  assert.match(css,/min-height:64px/);
  assert.doesNotMatch(css,/height:388px|height:355px|height:220px|overflow-y:auto|subgrid|coach-v11-time-rail/);
  assert.doesNotMatch(css,/dashboardFlow|messagesPage|settingsPage/);
});

test('v13 teacher and video section is hidden by CSS without deleting any feature code or library',t=>{
  const css=read('program-videos-v1.css');
  const js=read('program-videos-v1.js');
  const html=read('index.html');
  assert.match(html,/program-videos-v1\.css\?v=1\.4\.1/);
  assert.match(html,/program-videos-v1\.js\?v=1\.9\.4/);
  assert.match(css,/#programsPage #programVideoLibrary\.coach-video-library\{display:none!important\}/);
  assert.match(js,/const ROOT_ID="programVideoLibrary"/);
  assert.match(js,/function boot\(\)\{\s*buildShell\(\)/);
  assert.match(js,/TEACHERS=/);
  assert.match(js,/recommendResource/);
  assert.match(html,/id="programsPage"/);
});


test('phase 1 renders seven preview-style day shells with factual completion bars',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  const table=root.querySelector('.coach-v14-week');
  assert.ok(table,'the phase-one weekly table is present');
  assert.equal(table.querySelectorAll('.coach-v14-day').length,7);
  assert.equal(table.querySelectorAll('.coach-v14-progress').length,7);
  assert.equal(table.querySelectorAll('.coach-v6-add-day').length,7);
  assert.equal(table.querySelectorAll('.coach-v12-card-stack').length,7);
  const monday=table.querySelector('.coach-v14-day[data-day="0"]');
  assert.match(monday.querySelector('.coach-v6-day-head').textContent,/Pazartesi/);
  assert.match(monday.querySelector('.coach-v6-day-head').textContent,/2\/3 tamamlandı/);
  assert.equal(monday.querySelector('.coach-v14-progress').getAttribute('aria-valuenow'),'67');
  assert.equal(monday.querySelector('.coach-v14-progress span').style.width,'67%');
  const tuesday=table.querySelector('.coach-v14-day[data-day="1"]');
  assert.equal(tuesday.querySelector('.coach-v14-progress').getAttribute('aria-valuenow'),'0');
  assert.equal(tuesday.querySelector('.coach-v14-progress span').style.width,'0%');
  const blank=table.querySelector('.coach-v14-day[data-day="2"]');
  assert.match(blank.querySelector('.coach-v6-day-head').textContent,/0\/0 tamamlandı/);
  assert.equal(blank.querySelector('.coach-v14-progress').getAttribute('aria-valuenow'),'0');
  assert.equal(table.querySelectorAll('.coach-v11-task').length,5);
  assert.equal(h.writes.length,0);
});

test('phase 1 completion progress updates from real student data, never from draft-only tasks',t=>{
  const h=harness(t);
  const weekData=h.rows[1].share.program.weeks[0].data;
  weekData.dn={'r-0-0':1,'s-0-0':1,'s-1-0':1};
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const monday=h.$('coachVisualWeekBoard').querySelector('.coach-v14-day[data-day="0"]');
  assert.equal(monday.querySelector('.coach-v14-progress').getAttribute('aria-valuenow'),'100');
  assert.equal(monday.querySelector('.coach-v14-progress span').style.width,'100%');
  v7Add(h,'AYT Matematik · Tekrar',{days:[0]});
  const mondayAgain=h.$('coachVisualWeekBoard').querySelector('.coach-v14-day[data-day="0"]');
  assert.equal(mondayAgain.querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(mondayAgain.querySelector('.coach-v14-progress').getAttribute('aria-valuenow'),'100');
  assert.equal(h.writes.length,0);
});

test('phase 1 does not alter program task IDs, actions or existing layouts',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  const oldIds=[...root.querySelectorAll('[data-program-task-id]')].map(node=>node.dataset.programTaskId);
  assert.deepEqual(oldIds.sort(),['r-0-0','s-0-0','s-0-1','s-1-0','s-2-3']);
  assert.equal(root.querySelectorAll('[data-program-edit]').length,5);
  assert.equal(root.querySelectorAll('[data-program-select]').length,5);
  root.querySelector('[data-coach-v6-layout="list"]').click();
  assert.equal(root.querySelector('.coach-v14-week').dataset.layout,'list');
  assert.equal(root.querySelectorAll('.coach-v14-progress').length,7);
  root.querySelector('[data-coach-v6-layout="week"]').click();
  assert.equal(root.querySelector('.coach-v14-week').dataset.layout,'week');
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-scroller'));
  assert.equal(h.writes.length,0);
});

test('phase 1 CSS adjusts only table skeleton, not the teacher library, task card style or sidebar',()=>{
  const css=read('coach-week-skeleton-v14.css');
  const html=read('index.html');
  assert.match(html,/coach-week-skeleton-v14\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70/);
  assert.match(css,/#programsPage #coachVisualWeekBoard \.coach-v14-week/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(170px,1fr\)\)/);
  assert.match(css,/\.coach-v14-progress span/);
  assert.match(css,/\.coach-v14-day \.coach-v6-add-day/);
  assert.match(css,/\.coach-v14-week\[data-layout="list"\]/);
  assert.doesNotMatch(css,/\.coach-v11-task(?:[{\s.]|$)|\.coach-v7-draft(?:[{\s.]|$)|#programVideoLibrary|#coachNav|#homePage|#settingsPage/);
});


test('upper preview contains one real student selector and one functioning week navigation',t=>{
  const h=harness(t),page=h.$('programsPage');
  assert.ok(page.querySelector('.coach-v15-breadcrumb'));
  assert.equal(page.querySelector('.coach-v15-title-group h1').textContent,'Haftalık Plan');
  assert.equal(page.querySelectorAll('#programStudentSelect').length,1);
  assert.equal(page.querySelectorAll('#programPrevWeek').length,1);
  assert.equal(page.querySelectorAll('#programNextWeek').length,1);
  assert.equal(page.querySelectorAll('#programCurrentWeek').length,1);
  assert.equal(page.querySelectorAll('#programWeekLabel').length,1);
  assert.equal(h.$('programStudentSelect').value,'student-b');
  assert.match(h.$('coachV15Subtitle').textContent,/Deniz/);
  assert.match(h.$('programWeekLabel').textContent,/5\s*(?:–|-)\s*11|5 Eki|5 Ekim/i);
  assert.equal(h.writes.length,0);
});

test('upper preview metric cards reflect actual selected-week student data, not screenshot placeholder numbers',t=>{
  const h=harness(t),overview=h.$('coachV15Overview');
  assert.equal(overview.querySelectorAll('.coach-v15-stat').length,4);
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  assert.equal(overview.querySelector('[data-coach-summary="progress"] strong').textContent,'40%');
  assert.equal(overview.querySelector('[data-coach-summary="subjects"] strong').textContent,'4');
  assert.equal(overview.querySelector('[data-coach-summary="average"] strong').textContent,'0,7');
  assert.equal(overview.querySelector('.coach-v15-progress-ring').getAttribute('aria-label'),'40% tamamlandı');
  assert.match(overview.textContent,/2 \/ 5 görev/);
  assert.doesNotMatch(overview.textContent,/\+4 geçen haftaya göre|Toplam Görev28/);
  assert.equal(h.writes.length,0);
});

test('upper overview refreshes when switching students or navigating to a different week',t=>{
  const h=harness(t),overview=h.$('coachV15Overview');
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'0');
  assert.equal(overview.querySelector('[data-coach-summary="progress"] strong').textContent,'0%');
  assert.match(h.$('coachV15Subtitle').textContent,/Ada/);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  h.$('programNextWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'0');
  assert.equal(overview.querySelector('[data-coach-summary="subjects"] strong').textContent,'0');
  h.$('programPrevWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  assert.equal(h.writes.length,0);
});

test('upper controls preserve templates, quick entry, classic switch and unchanged weekly board',t=>{
  const h=harness(t),page=h.$('programsPage');
  const idsBefore=[...h.$('coachVisualWeekBoard').querySelectorAll('[data-program-task-id]')].map(node=>node.dataset.programTaskId).sort();
  assert.deepEqual(idsBefore,['r-0-0','s-0-0','s-0-1','s-1-0','s-2-3']);
  const buttons=page.querySelectorAll('.coach-v15-action-buttons button');
  assert.equal(buttons.length,5);
  assert.ok(h.$('programAddVideoBtn'),'Video Ekle is beside Çalışma Ekle');
  assert.equal(h.$('programAddVideoBtn').previousElementSibling,h.$('programAddTaskBtn'));
  assert.ok(h.$('programTemplatesBtn'));
  assert.ok(h.$('programAddTaskBtn'));
  assert.ok(h.$('programAddWeekBtn'));
  assert.equal(h.$('programBulkTasksBtn').previousElementSibling,h.$('programAddWeekBtn'),'Toplu Görev Yaz is beside Haftaya Toplu Ekle');
  h.$('programTemplatesBtn').click();
  assert.equal(h.$('programTemplatePopover').classList.contains('hidden'),false);
  h.$('programTemplateClose').click();
  h.$('coachWeekClassicMode').click();
  assert.equal(page.dataset.coachWeekView,'classic');
  h.$('coachWeekVisualMode').click();
  assert.equal(page.dataset.coachWeekView,'visual');
  assert.deepEqual([...h.$('coachVisualWeekBoard').querySelectorAll('[data-program-task-id]')].map(node=>node.dataset.programTaskId).sort(),idsBefore);
  assert.equal(h.writes.length,0);
});

test('upper styling hides only duplicated header summaries, never the weekly lessons',()=>{
  const html=read('index.html'),css=read('coach-preview-upper-v15.css');
  assert.match(html,/coach-preview-upper-v15\.css\?v=1\.0\.1/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70/);
  assert.match(css,/#programsPage \.coach-v15-header-main/);
  assert.match(css,/#programsPage \.coach-v15-overview/);
  assert.match(css,/#programsPage #coachVisualWeekBoard \.coach-v6-title/);
  assert.match(css,/#programsPage \.program-toolbar\{display:none!important\}/);
  assert.doesNotMatch(css,/\.coach-v14-week|\.coach-v12-card-stack|\.coach-v11-task|\.coach-v7-draft|#programWeekBoard|#programVideoLibrary/);
  assert.match(html,/id="coachVisualWeekBoard"/);
  assert.match(html,/id="programWeekBoard"/);
});


test('table-only stage shows seven actual day columns beneath the approved upper section',t=>{
  const h=harness(t),page=h.$('programsPage'),workspace=h.$('coachFutureProgramTable');
  assert.ok(workspace);
  assert.equal(workspace.hasAttribute('hidden'),false,'the seven-day table is visible');
  assert.equal(workspace.classList.contains('coach-v16-table-only'),true);
  assert.ok(workspace.contains(h.$('coachVisualWeekBoard')));
  assert.ok(workspace.contains(h.$('programWeekBoard')),'legacy program code remains');
  assert.equal(page.querySelector('.coach-v15-header').contains(h.$('programStudentSelect')),true);
  assert.equal(page.querySelectorAll('#coachV15Overview .coach-v15-stat').length,4);
  assert.ok(page.querySelector('.coach-v15-actions').contains(h.$('programAddTaskBtn')));
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v14-week .coach-v14-day').length,7);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v12-card-stack').length,7);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('[data-program-task-id]').length,5);
  assert.equal(h.writes.length,0);
});

test('table-only stage keeps top week navigation, the student timetable and add dialog working',t=>{
  const h=harness(t),overview=h.$('coachV15Overview');
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  h.$('programNextWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'0');
  assert.equal(h.$('coachFutureProgramTable').hasAttribute('hidden'),false);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('[data-program-task-id]').length,0);
  h.$('programPrevWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('[data-program-task-id]').length,5);
  h.$('programAddTaskBtn').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.writes.length,0);
});

test('table-only stylesheet suppresses duplicate panels without deleting old program sources',()=>{
  const html=read('index.html'),css=read('coach-table-only-v16.css'),app=read('app-reset.js');
  assert.match(html,/<section class="program-layout coach-v16-table-only" id="coachFutureProgramTable"/);
  assert.match(html,/coach-table-only-v16\.css\?v=1\.0\.0/);
  assert.doesNotMatch(html,/<section class="program-layout" id="coachFutureProgramTable" hidden>/);
  assert.match(css,/#programsPage #coachFutureProgramTable \.coach-v6-sheet-head/);
  assert.match(css,/#programsPage #coachFutureProgramTable \.coach-v7-panel/);
  assert.match(css,/#programsPage #coachFutureProgramTable \.coach-v10-bulk/);
  assert.match(css,/#programsPage #coachFutureProgramTable #programWeekBoard/);
  assert.match(css,/#coachVisualWeekBoard:not\(\.hidden\)/);
  assert.match(css,/display:none!important/);
  assert.match(html,/id="coachVisualWeekBoard"/);
  assert.match(html,/id="programWeekBoard"/);
  assert.match(html,/id="programStudentSelect"/);
  assert.match(app,/function renderCoachVisualWeek/);
  assert.match(app,/function bindCoachVisualWeekActions/);
  assert.match(app,/function renderProgramWorkspace/);
  assert.match(html,/id="programAddTaskBtn"/);
  assert.match(html,/id="programTemplatesBtn"/);
  assert.match(html,/id="programAddWeekBtn"/);
});


test('table-only program still provides in-day quick entry, task edit and move without writes',t=>{
  const h=harness(t),board=h.$('coachVisualWeekBoard');
  assert.equal(board.querySelectorAll('[data-coach-add-day]').length,7);
  assert.equal(board.querySelectorAll('[data-program-edit]').length,5);
  assert.equal(board.querySelectorAll('[data-program-select]').length,5);
  const day=board.querySelector('[data-coach-add-day="4"]');
  day.click();
  assert.equal(board.querySelector('[data-v10-inline="4"]').hidden,false);
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  board.querySelector('[data-program-task-id="s-0-1"] [data-program-edit]').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.writes.length,0);
});

test('table-only student changes retain factual upper numbers and render correct empty state',t=>{
  const h=harness(t);
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(h.$('coachV15Overview').querySelector('[data-coach-summary="total"] strong').textContent,'0');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v14-day').length,7);
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(h.$('coachV15Overview').querySelector('[data-coach-summary="total"] strong').textContent,'5');
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v14-day').length,7);
  assert.equal(h.writes.length,0);
});

test('new coach composer generates editable TYT and AYT lesson tasks',t=>{
 const h=harness(t);h.$('programAddTaskBtn').click();
 const set=(id,value,event='input')=>{const n=h.$(id);n.value=value;n.dispatchEvent(new h.w.Event(event,{bubbles:true}))};
 set('programBuilderSubject','Matematik','change');
 set('programBuilderTopic','Problemler');
 set('programBuilderCount','30');
 assert.equal(h.$('programTaskText').value,'TYT Matematik · Problemler · Soru çözümü · 30 soru');
 assert.equal(h.writes.length,0);
 h.$('programBuilderLevel').querySelector('[data-plan-level="AYT"]').click();
 assert.equal(h.$('programTaskText').value,'AYT Matematik · Problemler · Soru çözümü · 30 soru');
 assert.ok([...h.$('programBuilderTopicSuggestions').querySelectorAll('option')].some(x=>x.value==='Türev'));
 set('programBuilderActivity','Tekrar');
 assert.equal(h.$('programTaskText').value,'AYT Matematik · Problemler · Tekrar');
 assert.equal(h.$('programBuilderCount').closest('label').hidden,true);
});
test('manual instructions are preserved unless regenerate is explicitly selected',t=>{
 const h=harness(t);h.$('programAddTaskBtn').click();
 const subject=h.$('programBuilderSubject');subject.value='Fizik';subject.dispatchEvent(new h.w.Event('change',{bubbles:true}));
 h.$('programTaskText').value='Kendi hazırladığım özel çalışma';h.$('programTaskText').dispatchEvent(new h.w.Event('input',{bubbles:true}));
 h.$('programBuilderTopic').value='Hareket ve Kuvvet';h.$('programBuilderTopic').dispatchEvent(new h.w.Event('input',{bubbles:true}));
 assert.equal(h.$('programTaskText').value,'Kendi hazırladığım özel çalışma');
 assert.match(h.$('programBuilderHint').textContent,/korundu/);
 h.$('programBuilderApply').click();
 assert.equal(h.$('programTaskText').value,'TYT Fizik · Hareket ve Kuvvet · Soru çözümü');
 h.$('programTaskCancel').click();h.$('programAddTaskBtn').click();
 assert.equal(h.$('programBuilderSubject').value,'');
 assert.equal(h.$('programTaskText').value,'');
});
test('multiple chosen weekdays send separate existing-format coachingActions',async t=>{
 const h=harness(t);h.$('programAddTaskBtn').click();
 h.$('programBuilderSubject').value='Kimya';h.$('programBuilderSubject').dispatchEvent(new h.w.Event('change',{bubbles:true}));
 h.$('programBuilderTopic').value='Karışımlar';h.$('programBuilderTopic').dispatchEvent(new h.w.Event('input',{bubbles:true}));
 h.$('programDaysWeekdays').click();h.$('programTaskSend').click();
 for(let i=0;i<15;i++)await Promise.resolve();
 assert.equal(h.writes.length,5);
 assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
 for(const item of h.writes){
   assert.equal(item.collection,'coachingActions');
   assert.equal(item.type,'program_task');
   assert.deepEqual(Object.keys(item.payload).sort(),['date','text']);
   assert.equal(item.payload.text,'TYT Kimya · Karışımlar · Soru çözümü');
 }
});
test('invalid quantity cannot send; existing editing and quick presets stay intact',async t=>{
 const h=harness(t);h.$('programAddTaskBtn').click();
 h.$('programBuilderSubject').value='Matematik';h.$('programBuilderSubject').dispatchEvent(new h.w.Event('change',{bubbles:true}));
 h.$('programBuilderCount').value='1000';h.$('programBuilderCount').dispatchEvent(new h.w.Event('input',{bubbles:true}));
 h.$('programTaskSend').click();await Promise.resolve();
 assert.equal(h.writes.length,0);assert.match(h.$('programTaskStatus').textContent,/1 ile 999/);
 h.$('programTaskClose').click();
 h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"] [data-program-edit]').click();
 assert.equal(h.$('programTaskText').value,'AYT Matematik · Fonksiyonlar');
 assert.equal(h.$('programTaskBackdrop').hasAttribute('data-editing'),true);
 h.$('programTaskCancel').click();h.$('programAddTaskBtn').click();
 const picker=h.$('coachV8ModalPicker');
 picker.querySelector('[data-v8-level="AYT"]').click();
 picker.querySelector('[data-v8-preset="biology"]').click();
 assert.equal(h.$('programTaskText').value,'AYT Biyoloji · Konu tekrarı · 20 soru');
});
test('composer stylesheet changes only the new modal, not the weekly board',()=>{
 const html=read('index.html'),css=read('coach-lesson-composer-v18.css');
 assert.match(html,/coach-lesson-composer-v18\.css\?v=1\.0\.0/);
 assert.match(html,/app-reset\.js\?v=1\.0\.70/);
 for(const id of ['programBuilderSubject','programBuilderTopic','programBuilderActivity','programBuilderCount','programTaskDayGrid'])assert.ok(html.includes('id="'+id+'"'));
 assert.doesNotMatch(css,/#coachVisualWeekBoard|\.coach-v14-week|\.coach-v12-card-stack/);
});

test('hidden video library stays dormant but can be reactivated without losing the existing integration',async t=>{
  const h=harness(t),w=h.w;
  const feed={teachers:{'Eyüp B.':{
    channelName:'Eyüp B.',
    videos:[{id:'abc123XYZ99',title:'TYT Matematik Problemler 30 soru çözümü',url:'https://www.youtube.com/watch?v=abc123XYZ99'}],
    playlists:[{id:'PLabc123456789',title:'TYT Matematik video kampı',url:'https://www.youtube.com/playlist?list=PLabc123456789'}]
  }}};
  let requests=0;
  w.fetch=async()=>{requests++;return{ok:true,json:async()=>feed}};
  w.eval(read('program-videos-v1.js'));
  h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const host=h.$('programVideoLibrary');
  assert.ok(host,'the original full media library is mounted');
  assert.equal(h.$('coachV19VideoPane').contains(host),true);
  assert.equal(h.$('programsPage').contains(host),false,'no duplicate panel below the weekly table');
  assert.equal(requests,0,'closed modal does not make unnecessary video fetches');
  assert.equal(h.$('coachV19VideoPane').hidden,true);
  h.$('programAddTaskBtn').click();
  for(let i=0;i<24;i++)await Promise.resolve();
  assert.equal(h.$('coachV19Workbench').dataset.activePane,'program');
  assert.equal(requests,0,'hidden media must not load while opening lesson composer');
  h.$('programTaskCancel').click();
  // Re-enable only in this regression test to protect the archived video flow.
  h.$('coachV19VideoPane').hidden=false;
  h.$('coachV19ShowVideos').closest('nav').hidden=false;
  h.$('programAddTaskBtn').click();
  for(let i=0;i<24;i++)await Promise.resolve();
  assert.ok(requests>=1,'unhiding the archived panel reactivates the original feed');
  assert.ok(host.querySelector('[data-video-add="0"]'),'actual existing video render is reused');
  host.querySelector('[data-video-add="0"]').click();
  assert.equal(h.$('programTaskVideo').value,'https://www.youtube.com/watch?v=abc123XYZ99');
  assert.match(h.$('programTaskText').value,/Video izle/);
  assert.equal(h.writes.length,0,'linking media is not a Firebase send');
  assert.equal(h.$('coachV19Workbench').dataset.activePane,'program');
  assert.equal(h.$('coachV19Linked').dataset.linked,'true');
  h.$('programTaskSend').click();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].collection,'coachingActions');
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.match(h.writes[0].payload.text,/https:\/\/www\.youtube\.com\/watch\?v=abc123XYZ99/);
});
test('custom coach text survives video selection and compact tabs retain their own state',async t=>{
  const h=harness(t),w=h.w;
  const feed={teachers:{'Eyüp B.':{videos:[{id:'abc123XYZ99',title:'TYT Matematik tekrar',url:'https://www.youtube.com/watch?v=abc123XYZ99'}]}}};
  w.fetch=async()=>({ok:true,json:async()=>feed});
  w.eval(read('program-videos-v1.js'));h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  h.$('coachV19VideoPane').hidden=false;
  h.$('coachV19ShowVideos').closest('nav').hidden=false;
  h.$('programAddTaskBtn').click();
  for(let i=0;i<20;i++)await Promise.resolve();
  h.$('programTaskText').value='Özgün çalışma görevim';
  h.$('programTaskText').dispatchEvent(new w.Event('input',{bubbles:true}));
  h.$('coachV19ShowVideos').click();
  assert.equal(h.$('coachV19Workbench').dataset.activePane,'videos');
  assert.equal(h.$('coachV19ShowVideos').getAttribute('aria-pressed'),'true');
  h.$('programVideoLibrary').querySelector('[data-video-add="0"]').click();
  assert.equal(h.$('coachV19Workbench').dataset.activePane,'program');
  assert.equal(h.$('programTaskText').value,'Özgün çalışma görevim');
  assert.equal(h.writes.length,0);
  h.$('programTaskCancel').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  assert.equal(h.$('programsPage').querySelectorAll('.coach-v14-day').length,7);
});
test('new video workspace styles stay scoped to modal and preserve the hidden legacy placement rule',()=>{
  const html=read('index.html'),css=read('coach-split-composer-v19.css'),old=read('program-videos-v1.css');
  assert.match(html,/coach-split-composer-v19\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70/);
  assert.match(html,/program-videos-v1\.js\?v=1\.9\.4/);
  assert.match(html,/id="coachV19Workbench"/);
  assert.match(html,/id="coachV19VideoPane"/);
  assert.match(css,/\.coach-v19-workbench/);
  assert.match(css,/grid-template-columns:minmax\(0,56fr\) minmax\(0,44fr\)/);
  assert.match(css,/@media\(max-width:910px\)/);
  assert.doesNotMatch(css,/#programsPage|\.coach-v14-week/);
  assert.match(old,/#programsPage #programVideoLibrary\.coach-video-library\{display:none!important\}/);
});

test('completion badges clearly distinguish completed tasks from pending tasks without changing student data',t=>{
  const h=harness(t),board=h.$('coachVisualWeekBoard');
  const finished=board.querySelector('[data-program-task-id="s-0-0"]');
  const pending=board.querySelector('[data-program-task-id="s-1-0"]');
  assert.equal(finished.getAttribute('data-task-completed'),'true');
  assert.equal(finished.getAttribute('data-task-status'),'done');
  assert.match(finished.querySelector('.coach-v27-task-status').textContent,/✓ Tamamlandı/);
  assert.equal(finished.querySelector('.coach-v27-task-status').classList.contains('is-complete'),true);
  assert.equal(pending.getAttribute('data-task-completed'),'false');
  assert.equal(pending.getAttribute('data-task-status'),'pending');
  assert.match(pending.querySelector('.coach-v27-task-status').textContent,/Bekliyor/);
  assert.equal(pending.querySelector('.coach-v27-task-status').classList.contains('is-pending'),true);
  assert.match(board.querySelector('.coach-v6-day[data-day="0"] .coach-v27-day-status').textContent,/2\/3 tamamlandı/);
  assert.equal(board.querySelectorAll('.coach-v27-task-status').length,5);
  assert.equal(h.writes.length,0);
});

test('student finishing task updates visual and classic badges on next sync, but does not send coach actions',t=>{
  const h=harness(t);
  const data=h.rows[1].share.program.weeks[0].data;
  data.dn['s-1-0']=1;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const monday=h.$('coachVisualWeekBoard').querySelector('.coach-v6-day[data-day="0"]');
  assert.equal(monday.querySelector('.coach-v27-day-status').getAttribute('data-all-done'),'true');
  assert.match(monday.querySelector('.coach-v27-day-status').textContent,/Gün tamamlandı/);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v27-task-status.is-complete').length,3);
  const classic=h.$('programWeekBoard').querySelector('[data-program-task-id="s-1-0"]');
  assert.equal(classic.getAttribute('data-task-completed'),'true');
  assert.equal(classic.querySelector('.classic-task-status').dataset.completionStatus,'done');
  assert.match(classic.querySelector('.classic-task-status').textContent,/Tamamlandı/);
  // Updating completion is a student data sync, not a coach action or coach-toggled checkbox.
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('[data-coach-mark-done]').length,0);
  assert.equal(h.writes.length,0);
  data.dn['s-1-0']=0;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v27-task-status.is-complete').length,2);
  assert.equal(h.$('programWeekBoard').querySelector('[data-program-task-id="s-1-0"] .classic-task-status').dataset.completionStatus,'pending');
  assert.equal(h.writes.length,0);
});

test('completion styles use a clear green done state without enlarging or clipping task rows',()=>{
  const css=read('coach-task-completion-v27.css'),html=read('index.html');
  assert.match(html,/coach-task-completion-v27\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70/);
  assert.match(css,/\.coach-v11-task\[data-task-completed="true"\]/);
  assert.match(css,/\.coach-v27-task-status\.is-complete/);
  assert.match(css,/\.coach-v27-task-status\.is-pending/);
  assert.match(css,/\.coach-v11-task-menu\[open\][\s\S]*grid-row:3/);
  assert.match(css,/\.classic-task-status\[data-completion-status="done"\]/);
  assert.doesNotMatch(css,/\.coach-v7-draft|\.program-task-modal|#coachVideoPickerBackdrop/);
});

test('coach weekly pulse shows saved completion and remaining tasks without inferring missing sync times',t=>{
  const h=harness(t),visual=h.$('coachVisualWeekBoard');
  const pulse=visual.querySelector('.coach-v28-pulse');
  assert.ok(pulse,'compact progress strip is attached to the actual weekly table');
  assert.match(pulse.querySelector('.coach-v28-pill.complete').textContent,/2 tamamlandı/);
  assert.match(pulse.querySelector('.coach-v28-pill.pending').textContent,/3 bekliyor/);
  assert.match(pulse.querySelector('.coach-v28-sync').textContent,/zaman bilgisi yok/);
  assert.equal(pulse.querySelector('.coach-v28-pill.today'),null,'another week must not be described as today');
  assert.equal(h.writes.length,0);
  const program=h.rows[1].share.program;
  program.syncedAt=Date.parse('2026-10-06T12:00:00.000Z');
  program.weeks[0].data.dn['s-1-0']=1;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const fresh=h.$('coachVisualWeekBoard').querySelector('.coach-v28-pulse');
  assert.match(fresh.querySelector('.coach-v28-pill.complete').textContent,/3 tamamlandı/);
  assert.match(fresh.querySelector('.coach-v28-pill.pending').textContent,/2 bekliyor/);
  assert.doesNotMatch(fresh.querySelector('.coach-v28-sync').textContent,/zaman bilgisi yok/);
  assert.equal(h.writes.length,0,'sync and completion indicators never queue a coach action');
});

test('current day progress is scoped to the real selected week',t=>{
  const h=harness(t),current=h.w.eval('programCurrentWeekStart()');
  h.rows[1].share.program.weeks[0].week=current;
  h.w.coachV6Test.seed(h.rows,'student-b',current);
  const pulse=h.$('coachVisualWeekBoard').querySelector('.coach-v28-pulse');
  assert.match(pulse.querySelector('.coach-v28-pill.today').textContent,/Bugün [0-9]+\/[0-9]+/);
  assert.equal(h.writes.length,0);
});

test('live completion redraw keeps wide table position and open card action menu for the same student and week',t=>{
  const h=harness(t),visual=h.$('coachVisualWeekBoard');
  const before=visual.querySelector('.coach-v6-days');
  before.scrollLeft=287;before.scrollTop=21;
  const task=visual.querySelector('[data-program-task-id="s-1-0"]');
  const menu=task.querySelector('.coach-v11-task-menu');
  menu.open=true;menu.querySelector('summary').focus();
  h.rows[1].share.program.weeks[0].data.dn['s-1-0']=1;
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  const after=h.$('coachVisualWeekBoard').querySelector('.coach-v6-days');
  assert.equal(after.scrollLeft,287);
  assert.equal(after.scrollTop,21);
  const reopened=h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-1-0"] .coach-v11-task-menu');
  assert.equal(reopened.open,true);
  assert.equal(h.document.activeElement,reopened.querySelector('summary'));
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v27-task-status.is-complete').length,3);
  assert.equal(h.writes.length,0);
  h.w.coachV6Test.seed(h.rows,'student-a',week);
  assert.equal(h.$('coachVisualWeekBoard').querySelector('.coach-v6-days').scrollLeft,0,'another student starts at the table beginning');
});

test('coach progress pulse keeps existing weekly table dimensions and cache-busted assets',()=>{
  const css=read('coach-live-progress-v28.css'),html=read('index.html');
  assert.match(html,/coach-live-progress-v28\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-r28-r29-v30-live/);
  assert.match(css,/\.coach-v28-pulse/);
  assert.match(css,/\.coach-v28-pill\.complete/);
  assert.match(css,/@media\(max-width:780px\)/);
  assert.doesNotMatch(css,/\.coach-v12-week-table\s*\{|\.coach-v11-task\s*\{|grid-template-columns:repeat\(7/);
});
