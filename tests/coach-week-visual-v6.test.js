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
test('v10 seven-day paste adds mixed counts atomically with correct day and no Firestore writes',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  assert.equal(h.$('coachV10Bulk').hidden,true);
  root.querySelector('[data-v10-bulk-toggle]').click();
  assert.equal(h.$('coachV10Bulk').hidden,false);
  root.querySelector('[data-v10-bulk-day="0"]').value='TYT Matematik · Problemler\nParagraf · 20 soru';
  root.querySelector('[data-v10-bulk-day="3"]').value='\nAYT Biyoloji · Sinir Sistemi\n\n';
  root.querySelector('[data-v10-bulk-day="6"]').value='Deneme analizi';
  root.querySelector('[data-v10-bulk-add]').click();
  const result=h.$('coachVisualWeekBoard');
  assert.equal(result.querySelectorAll('.coach-v7-draft').length,4);
  assert.equal(result.querySelector('.coach-v6-day[data-day="0"]').querySelectorAll('.coach-v7-draft').length,2);
  assert.equal(result.querySelector('.coach-v6-day[data-day="3"]').querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(result.querySelector('.coach-v6-day[data-day="6"]').querySelectorAll('.coach-v7-draft').length,1);
  assert.equal(h.$('coachV10Bulk').hidden,true);
  assert.match(result.querySelector('#coachV7DraftStatus').textContent,/4 çalışma taslağa eklendi/);
  assert.equal(h.writes.length,0);
});
test('v10 bulk validation is all-or-nothing; preserves text and never sends malformed work',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  root.querySelector('[data-v10-bulk-toggle]').click();
  root.querySelector('[data-v10-bulk-day="0"]').value='Matematik · Problemler';
  root.querySelector('[data-v10-bulk-day="1"]').value='x'.repeat(551);
  root.querySelector('[data-v10-bulk-add]').click();
  assert.equal(root.querySelectorAll('.coach-v7-draft').length,0);
  assert.match(root.querySelector('[data-v10-bulk-error]').textContent,/550 karakter/);
  assert.equal(root.querySelector('[data-v10-bulk-day="0"]').value,'Matematik · Problemler');
  assert.equal(h.writes.length,0);
  root.querySelector('[data-v10-bulk-day="1"]').value='Fizik · Hareket';
  root.querySelector('[data-v10-bulk-add]').click();
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-draft').length,2);
});
test('v10 bulk input handles more than the former 100 task cap and retains each record',t=>{
  const h=harness(t),root=h.$('coachVisualWeekBoard');
  root.querySelector('[data-v10-bulk-toggle]').click();
  root.querySelector('[data-v10-bulk-day="2"]').value=Array.from({length:120},(_,i)=>'TYT Matematik · Tekrar '+(i+1)).join('\n');
  root.querySelector('[data-v10-bulk-add]').click();
  const board=h.$('coachVisualWeekBoard');
  assert.equal(board.querySelectorAll('.coach-v7-draft').length,120);
  assert.match(board.querySelector('[data-v7-send]').textContent,/120/);
  assert.equal(h.writes.length,0);
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
  assert.match(html,/program-videos-v1\.js\?v=1\.8\.2/);
  assert.match(css,/#programsPage #programVideoLibrary\.coach-video-library\{display:none!important\}/);
  assert.match(js,/const ROOT_ID="programVideoLibrary"/);
  assert.match(js,/function boot\(\)\{buildShell\(\)/);
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
  assert.match(html,/app-reset\.js\?v=1\.0\.66/);
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
  assert.equal(buttons.length,3);
  assert.ok(h.$('programTemplatesBtn'));
  assert.ok(h.$('programAddTaskBtn'));
  assert.ok(h.$('programAddWeekBtn'));
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
  assert.match(html,/coach-preview-upper-v15\.css\?v=1\.0\.0/);
  assert.match(html,/app-reset\.js\?v=1\.0\.66/);
  assert.match(css,/#programsPage \.coach-v15-header-main/);
  assert.match(css,/#programsPage \.coach-v15-overview/);
  assert.match(css,/#programsPage #coachVisualWeekBoard \.coach-v6-title/);
  assert.match(css,/#programsPage \.program-toolbar\{display:none!important\}/);
  assert.doesNotMatch(css,/\.coach-v14-week|\.coach-v12-card-stack|\.coach-v11-task|\.coach-v7-draft|#programWeekBoard|#programVideoLibrary/);
  assert.match(html,/id="coachVisualWeekBoard"/);
  assert.match(html,/id="programWeekBoard"/);
});


test('upper-only stage displays preview header and facts while deliberately withholding the weekly table',t=>{
  const h=harness(t),page=h.$('programsPage'),workspace=h.$('coachFutureProgramTable');
  assert.ok(workspace,'original program layout remains for the later stage');
  assert.equal(workspace.hasAttribute('hidden'),true,'weekly table is not visible yet');
  assert.ok(workspace.contains(h.$('coachVisualWeekBoard')));
  assert.ok(workspace.contains(h.$('programWeekBoard')));
  assert.equal(page.querySelector('.coach-v15-header').contains(h.$('programStudentSelect')),true);
  assert.equal(page.querySelectorAll('#coachV15Overview .coach-v15-stat').length,4);
  assert.equal(page.querySelector('.coach-v15-actions').contains(h.$('programAddTaskBtn')),true);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v14-day').length,7,'lesson data and existing table code were not deleted');
  assert.equal(h.writes.length,0);
});

test('upper-only stage keeps week navigation and existing add dialog usable outside the hidden table',t=>{
  const h=harness(t),overview=h.$('coachV15Overview');
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  h.$('programNextWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'0');
  assert.equal(h.$('coachFutureProgramTable').hasAttribute('hidden'),true);
  h.$('programPrevWeek').click();
  assert.equal(overview.querySelector('[data-coach-summary="total"] strong').textContent,'5');
  h.$('programAddTaskBtn').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.writes.length,0);
});

test('upper-only presentation stylesheet visibly hides only deferred table container without removing sources',()=>{
  const html=read('index.html'),css=read('coach-preview-upper-v15.css'),app=read('app-reset.js');
  assert.match(html,/<section class="program-layout" id="coachFutureProgramTable" hidden>/);
  assert.match(html,/coach-preview-upper-v15\.css\?v=1\.0\.1/);
  assert.match(css,/#programsPage > #coachFutureProgramTable\[hidden\]\{display:none!important\}/);
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
