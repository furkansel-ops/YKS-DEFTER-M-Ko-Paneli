const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(t){
  const dom=new JSDOM(read('index.html'),{url:'https://coach.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,document=w.document,writes=[],timers=[];
  let writeCounter=0,failureAt=0,pauseNext=null;
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:'profiles'},
    initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:'coach-1'}}),getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...parts)=>parts,where:(...parts)=>parts,serverTimestamp:()=>({ts:true}),
    addDoc:async(ref,data)=>{
      writeCounter++;
      if(failureAt===writeCounter){failureAt=0;throw new Error('network failed');}
      writes.push({collection:ref.name,...JSON.parse(JSON.stringify(data))});
      if(pauseNext){const p=pauseNext;pauseNext=null;await p.promise}
      return{id:'action-'+writes.length};
    },
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{},setDoc:async()=>{},signOut:async()=>{},
    alert:()=>{},confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:callback=>{timers.push(callback);return timers.length},clearTimeout:()=>{},
    requestAnimationFrame:callback=>{callback(0);return 1},cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read('app-reset.js').replace(/^import[^\n]+\n/gm,'')+
    '\n window.fastWeekTest={seed(rows,uid,week){coachReportRows=rows;selectedProgramStudentUid=uid;selectedProgramWeekStart=week;hydrateProgramStudents();renderProgramWorkspace()}, selected(){return [...coachWeeklySelectedDates].sort()},week(){return coachWeeklyDraftWeek},student(){return selectedProgramStudentUid}};');
  document.getElementById('bootView').classList.add('hidden');
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  w.fastWeekTest.seed([
    {studentUid:'student-a',share:{profile:{name:'Ada'},program:{weeks:[]}}},
    {studentUid:'student-b',share:{profile:{name:'Deniz'},program:{weeks:[{week:'2026-10-05',data:{r:[],s:[]}}]}}}
  ],'student-b','2026-10-05');
  const $=id=>document.getElementById(id);
  return {w,document,$,writes,
    async settle(){for(let i=0;i<16;i++)await Promise.resolve()},
    change(id,value,type='input'){$(id).value=value;$(id).dispatchEvent(new w.Event(type,{bubbles:true}))},
    selected:()=>Array.from(w.fastWeekTest.selected()),
    failOnWrite(n){failureAt=n},
    deferNextWrite(){let resolve;const promise=new Promise(r=>{resolve=r});pauseNext={promise};return resolve}
  };
}
test('planner is mounted without replacing the original classic week table',t=>{
  const h=harness(t);
  assert.ok(h.$('programAddWeekBtn'));
  assert.ok(h.$('programTaskDayGrid'));
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-scroller'));
  assert.match(read('index.html'),/coach-fast-planner\.css\?v=1\.0\.0/);
  assert.match(read('index.html'),/app-reset\.js\?v=1\.0\.62/);
  assert.equal(h.writes.length,0);
});
test('normal mode picks one day; changing the date moves day selector to another week',async t=>{
  const h=harness(t);
  h.$('programAddTaskBtn').click();
  assert.equal(h.selected().length,1);
  assert.equal(h.$('programTaskDayGrid').querySelectorAll('button').length,7);
  assert.equal(h.$('programTaskKeepOpen').checked,false);
  h.change('programTaskDate','2026-10-15');
  assert.equal(h.w.fastWeekTest.week(),'2026-10-12');
  assert.deepEqual(h.selected(),['2026-10-15']);
  h.change('programTaskText','AYT Matematik · İntegral 30 soru');
  h.$('programTaskSend').click();await h.settle();
  assert.deepEqual(h.writes.map(x=>x.payload),[{text:'AYT Matematik · İntegral 30 soru',date:'2026-10-15'}]);
  assert.equal(h.writes[0].studentUid,'student-b');
});
test('bulk mode supports 5/7/0 shortcuts, then queues selected dates in order',async t=>{
  const h=harness(t);h.$('programAddWeekBtn').click();
  assert.deepEqual(h.selected(),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
  assert.equal(h.$('programTaskSend').textContent,'5 güne gönder');
  h.$('programDaysAll').click();assert.equal(h.selected().length,7);
  h.$('programDaysClear').click();assert.equal(h.selected().length,0);
  h.change('programTaskText','TYT Türkçe · Paragraf 20 soru');
  h.$('programTaskSend').click();await h.settle();
  assert.equal(h.writes.length,0);assert.match(h.$('programTaskStatus').textContent,/En az bir gün/);
  h.$('programDaysWeekdays').click();h.$('programTaskSend').click();await h.settle();
  assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
  assert.ok(h.writes.every(x=>x.studentUid==='student-b'&&x.type==='program_task'&&x.status==='pending'));
  assert.match(h.$('programTaskStatus').textContent,/Öğrencinin uygulamasında işlenmesi bekleniyor/);
});
test('keep-open adds another subject without reopening or carrying over the previous text',async t=>{
  const h=harness(t);h.$('programAddWeekBtn').click();
  h.$('programTaskKeepOpen').checked=true;h.change('programTaskText','Paragraf · 20 soru');
  h.$('programTaskSend').click();await h.settle();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskText').value,'');
  assert.equal(h.$('programTaskVideo').value,'');
  assert.equal(h.writes.length,5);
  h.$('programTaskDayGrid').querySelector('[data-program-draft-date="2026-10-05"]').click();
  h.change('programTaskText','Matematik · Problemler');
  h.$('programTaskSend').click();await h.settle();
  assert.deepEqual(h.writes.slice(5).map(x=>x.payload.date),['2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
});
test('a partial network failure allows retry of only unsent weekdays',async t=>{
  const h=harness(t);h.$('programAddWeekBtn').click();h.change('programTaskText','TYT Biyoloji · Hücre');
  h.failOnWrite(3);h.$('programTaskSend').click();await h.settle();
  assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05','2026-10-06']);
  assert.deepEqual(h.selected(),['2026-10-07','2026-10-08','2026-10-09']);
  assert.match(h.$('programTaskStatus').textContent,/2 gün kuyruğa alındı, 3 gün kaldı/);
  h.$('programTaskSend').click();await h.settle();
  assert.deepEqual(h.writes.map(x=>x.payload.date),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
});
test('switching the selected student mid-send prevents dispatch of the remaining dates',async t=>{
  const h=harness(t);h.$('programAddWeekBtn').click();h.change('programTaskText','Fizik · Kuvvet');
  const release=h.deferNextWrite();h.$('programTaskSend').click();await h.settle();
  assert.equal(h.writes.length,1);
  h.change('programStudentSelect','student-a','change');
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  release();await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.equal(h.w.fastWeekTest.student(),'student-a');
});
test('edit mode cannot access the bulk days, and closing resets the draft',t=>{
  const h=harness(t);h.$('programAddWeekBtn').click();h.$('programTaskCancel').click();
  assert.equal(h.selected().length,0);
  assert.match(read('coach-fast-planner.css'),/data-editing/);
  assert.match(read('app-reset.js'),/payload:\{operation:"edit",sourceWeek:edit\.weekStart,taskId:edit\.taskId,text:editedTask\}/);
});
