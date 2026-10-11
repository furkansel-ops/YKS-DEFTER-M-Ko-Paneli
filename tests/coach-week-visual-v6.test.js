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
  assert.doesNotMatch(v.textContent,/\b09:00\b|\b10:00\b/);
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
