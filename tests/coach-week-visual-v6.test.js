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
    '\nwindow.coachV6Test={seed(rows,uid,selectedWeek){coachReportRows=rows;selectedProgramStudentUid=uid;selectedProgramWeekStart=selectedWeek;hydrateProgramStudents();renderProgramWorkspace()},stats:coachV6WeekStats,subject:coachV6Subject,context(){return{student:selectedProgramStudentUid,week:selectedProgramWeekStart,edit:coachProgramEditContext}}};');
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
test('each + Ekle opens the real quick composer with that day selected',t=>{
  const h=harness(t);
  h.$('coachVisualWeekBoard').querySelector('[data-coach-add-day="4"]').click();
  assert.equal(h.$('programTaskDate').value,'2026-10-09');
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskDayGrid').querySelectorAll('[aria-pressed="true"]').length,1);
  assert.equal(h.writes.length,0);
});
test('visual quick controls delegate to existing bulk and template actions',t=>{
  const h=harness(t);
  h.$('coachVisualWeekBoard').querySelector('[data-coach-quick="bulk"]').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskDayGrid').querySelectorAll('[aria-pressed="true"]').length,5);
  h.$('programTaskCancel').click();
  h.$('coachVisualWeekBoard').querySelector('[data-coach-quick="templates"]').click();
  assert.equal(h.$('programTemplatePopover').classList.contains('hidden'),false);
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
test('v7 existing task with an explicit start time shows a real time badge; old tasks stay unscheduled',t=>{
  const h=harness(t),row=h.rows[1];
  row.share.program.weeks[0].data.s[0][1]='AYT Matematik · Fonksiyonlar · Saat 11:35';
  h.w.coachV6Test.seed(h.rows,'student-b',week);
  assert.match(h.$('coachVisualWeekBoard').querySelector('[data-program-task-id="s-0-1"] .coach-v7-time-badge').textContent,/11:35/);
  assert.equal(h.$('coachVisualWeekBoard').querySelectorAll('.coach-v7-time-badge').length,1);
});
