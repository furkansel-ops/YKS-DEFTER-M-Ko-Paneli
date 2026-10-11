const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const week='2026-10-05';

function fixtures(){
  return [
    {studentUid:'student-a',share:{profile:{name:'Ada'},program:{weeks:[]}}},
    {studentUid:'student-b',share:{profile:{name:'Deniz'},program:{
      rowLabels:{r:{0:'Paragraf',1:'Boş rutin',2:'Problemler'},s:{0:'Matematik',1:'Fizik'}},
      weeks:[{week,data:{
        // Firestore represents numeric matrix indices as maps; holes must keep their identity.
        r:{0:{0:'Koç · Paragraf 20 soru',2:'Türkçe tekrar'},2:{1:'Koç · Problemler 30 soru'}},
        s:{0:{0:'Koç · Matematik 40 soru',4:'Koç · Video tekrar — https://youtu.be/original'},1:{3:'Fizik tekrar'}},
        done:{0:true},dn:{'r-0-0':false,'r-2-1':true,'s-1-3':true},
        mv:{'r-2-1':{from:'2026-10-05',at:1},'order-0':['s-0-0','r-0-0']}
      }}]
    }}}
  ];
}

function harness(t){
  const dom=new JSDOM(read('index.html'),{url:'https://coach.example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,document=w.document,writes=[],alerts=[],timers=[];
  let writeError=null;
  const auth={currentUser:{uid:'coach-test'}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:'profiles'},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...parts)=>parts,where:(...parts)=>parts,
    serverTimestamp:()=>({serverTimestamp:true}),
    addDoc:async(ref,data)=>{if(writeError)throw writeError;writes.push({collection:ref.name,...plain(data)});return{id:'action-'+writes.length}},
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{},setDoc:async()=>{},signOut:async()=>{},
    alert:message=>alerts.push(message),confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:callback=>{timers.push(callback);return timers.length},clearTimeout:()=>{},
    requestAnimationFrame:callback=>{callback(0);return 1},cancelAnimationFrame:()=>{},
    scrollTo:()=>{},console:{...console,error:()=>{}}
  });
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read('app-reset.js').replace(/^import[^\n]+\n/gm,'')+`
    window.classicTest={
      seed(rows,studentUid,week){coachReportRows=rows;selectedProgramStudentUid=studentUid;selectedProgramWeekStart=week;hydrateProgramStudents();renderProgramWorkspace();},
      data(uid){return coachReportRows.find(row=>row.studentUid===uid)?.share?.program;},
      move:saveCoachProgramMove,
      context(){return{studentUid:selectedProgramStudentUid,week:selectedProgramWeekStart,edit:coachProgramEditContext};}
    };
  `);
  document.getElementById('bootView').classList.add('hidden');
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  const $=id=>document.getElementById(id);
  w.classicTest.seed(fixtures(),'student-b',week);
  return {w,document,$,writes,alerts,
    task(id){return document.querySelector('[data-program-task-id="'+id+'"]')},
    seed(rows,studentUid,selectedWeek=week){w.classicTest.seed(rows,studentUid,selectedWeek)},
    change(id,value,type='input'){$(id).value=value;$(id).dispatchEvent(new w.Event(type,{bubbles:true}))},
    async settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve()},
    runTimers(){for(const callback of timers.splice(0))callback()},
    failWrites(){writeError=new Error('offline')}
  };
}

test('classic view separates routines and study without changing source task IDs or labels',t=>{
  const h=harness(t),board=h.$('programWeekBoard');
  assert.equal(board.classList.contains('program-student-shell'),true);
  const routines=board.querySelector('.student-program-routines'),study=board.querySelector('.student-program-study');
  assert.ok(routines);
  assert.ok(study);
  assert.match(routines.textContent,/Rutinler|RUTİNLER/);
  assert.match(study.textContent,/Ders Programım|DERS PROGRAMIM/);
  for(const label of ['Matematik','Fizik'])assert.ok(study.textContent.includes(label),label);
  for(let day=0;day<7;day++){
    const emptyRowCell=routines.querySelector('[data-program-cell="r-1-'+day+'"]');
    assert.ok(emptyRowCell,'blank routine row slot '+day+' stays aligned with its source index');
    assert.equal(emptyRowCell.hasAttribute('data-program-task-id'),false);
  }
  assert.deepEqual([...board.querySelectorAll('[data-program-task-id]')].map(node=>node.dataset.programTaskId).sort(),[
    'r-0-0','r-0-2','r-2-1','s-0-0','s-0-4','s-1-3'
  ]);
  assert.equal(routines.querySelectorAll('[data-program-task-id^="s-"]').length,0);
  assert.equal(study.querySelectorAll('[data-program-task-id^="r-"]').length,0);
  assert.match(h.task('r-2-1').textContent,/Problemler 30 soru/);
  assert.equal(h.writes.length,0,'rendering a received student program must be read-only');
});

test('completed state preserves day completion and per-cell completion with moved-task indicator',t=>{
  const h=harness(t);
  // A completed day still completes all its tasks, even when an older cell flag was false.
  for(const id of ['r-0-0','s-0-0','r-2-1','s-1-3'])assert.equal(h.task(id).dataset.taskCompleted,'true',id);
  for(const id of ['r-0-2','s-0-4'])assert.equal(h.task(id).dataset.taskCompleted,'false',id);
  assert.equal(h.task('r-2-1').classList.contains('is-moved'),true);
  assert.match(h.$('programWeekBoard').querySelector('.student-program-summary').textContent,/6 planlanan4 tamamlanan1 taşınan/);
  assert.equal(h.$('programWeekBoard').querySelector('.student-program-week-top strong').textContent,'67%');
  assert.match(h.$('programWeekBoard').querySelector('.student-program-summary').textContent,/1\/7 tamamlanan gün/);
  const dayMarks=h.$('programWeekBoard').querySelectorAll('.student-program-day-done');
  assert.equal(dayMarks.length,7);
  assert.equal(dayMarks[0].classList.contains('on'),true,'Monday carries the student’s explicit done flag');
  for(const day of [1,3]){
    assert.equal(dayMarks[day].classList.contains('on'),false,'finishing every task does not mark the whole day');
    assert.equal(h.$('programWeekBoard').querySelectorAll('.student-program-day-chip')[day].classList.contains('all-done'),true,'task progress still shows all tasks finished');
  }
});

test('an explicitly completed empty day keeps its day mark and counts in the weekly day summary',t=>{
  const h=harness(t),rows=fixtures();
  rows[1].share.program.weeks[0].data.done[6]=true;
  h.seed(rows,'student-b');
  const board=h.$('programWeekBoard'),dayMarks=board.querySelectorAll('.student-program-day-done');
  assert.equal(board.querySelectorAll('[data-program-task-day="6"]').length,0);
  assert.equal(dayMarks[6].classList.contains('on'),true);
  assert.match(board.querySelector('.student-program-summary').textContent,/2\/7 tamamlanan gün/);
  assert.equal(board.querySelectorAll('.student-program-day-chip')[6].classList.contains('all-done'),false,'a day flag must not invent task progress for an empty day');
  assert.match(board.querySelector('.student-program-summary').textContent,/6 planlanan4 tamamlanan/);
  assert.equal(board.querySelector('.student-program-week-top strong').textContent,'67%');
  assert.equal(h.writes.length,0);
});

test('task text and row labels render as text rather than executable markup',t=>{
  const h=harness(t),rows=fixtures(),program=rows[1].share.program;
  const text='Koç · <img src=x onerror="window.injected=true">';
  program.weeks[0].data.s[0][0]=text;
  program.rowLabels.s[0]='<script>window.injected=true</script>';
  h.seed(rows,'student-b');
  assert.equal(h.$('programWeekBoard').querySelector('img,script'),null);
  assert.ok(h.task('s-0-0').textContent.includes('<img src=x onerror="window.injected=true">'));
  assert.ok(h.$('programWeekBoard').textContent.includes('<script>window.injected=true</script>'));
  assert.equal(h.w.injected,undefined);
});

test('week navigation shows an empty future week without changing the saved table',t=>{
  const h=harness(t),before=plain(h.w.classicTest.data('student-b'));
  h.$('programNextWeek').click();
  assert.equal(h.w.classicTest.context().week,'2026-10-12');
  assert.equal(h.$('programWeekBoard').querySelectorAll('[data-program-task-id]').length,0);
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-study'));
  h.$('programPrevWeek').click();
  assert.equal(h.w.classicTest.context().week,week);
  assert.match(h.task('r-2-1').textContent,/Problemler 30 soru/);
  assert.deepEqual(plain(h.w.classicTest.data('student-b')),before);
  assert.equal(h.writes.length,0);
});

test('editing a sparse mapped row keeps its original cell, date, and coach prefix',async t=>{
  const h=harness(t);
  h.task('r-2-1').querySelector('[data-program-edit]').click();
  assert.equal(h.$('programTaskDate').value,'2026-10-06');
  assert.equal(h.$('programTaskDate').disabled,true);
  h.change('programTaskText','Problemler 45 soru');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.deepEqual(h.writes[0].payload,{operation:'edit',sourceWeek:week,taskId:'r-2-1',text:'Koç · Problemler 45 soru'});
  assert.match(h.task('r-2-1').textContent,/Problemler 45 soru/);
  assert.match(h.task('r-0-0').textContent,/Paragraf 20 soru/);
  assert.equal(h.task('r-1-1'),null,'normalizing sparse rows must not renumber the source task');
});

test('deleting one coach task preserves other cells and does not expose delete for student tasks',async t=>{
  const h=harness(t);
  h.task('s-0-4').querySelector('[data-program-edit]').click();
  assert.equal(h.$('programTaskDelete').classList.contains('hidden'),false);
  h.$('programTaskDelete').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0].payload,{operation:'delete',sourceWeek:week,taskId:'s-0-4'});
  assert.equal(h.task('s-0-4'),null);
  assert.match(h.task('s-0-0').textContent,/Matematik 40 soru/);
  assert.match(h.task('s-1-3').textContent,/Fizik tekrar/);
  h.runTimers();
  h.task('s-1-3').querySelector('[data-program-edit]').click();
  assert.equal(h.$('programTaskDelete').classList.contains('hidden'),true);
  h.$('programTaskDelete').click();
  await h.settle();
  assert.equal(h.writes.length,1,'programmatic activation must not bypass coach-ownership validation');
});

test('moving a sparse mapped task preserves its row and targets the chosen date only',async t=>{
  const h=harness(t);
  assert.equal(await h.w.classicTest.move(week,'r-2-1',5),true);
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0].payload,{operation:'move',sourceWeek:week,taskId:'r-2-1',date:'2026-10-10'});
  assert.equal(h.task('r-2-1'),null);
  assert.match(h.task('r-2-5').textContent,/Problemler 30 soru/);
  assert.equal(h.task('r-2-5').dataset.taskCompleted,'false');
  assert.match(h.task('r-0-0').textContent,/Paragraf 20 soru/);
  const data=h.w.classicTest.data('student-b').weeks[0].data;
  assert.equal(data.mv['r-2-5'].from,'2026-10-06');
  assert.equal(data.dn['r-2-1'],undefined);
});

test('failed move restores the original matrix and task completion',async t=>{
  const h=harness(t),before=plain(h.w.classicTest.data('student-b'));
  h.failWrites();
  assert.equal(await h.w.classicTest.move(week,'r-2-1',5),false);
  assert.deepEqual(plain(h.w.classicTest.data('student-b')),before);
  assert.equal(h.task('r-2-5'),null);
  assert.equal(h.task('r-2-1').dataset.taskCompleted,'true');
  assert.equal(h.writes.length,0);
});

test('moving into an occupied day uses a sparse empty row without overwriting neighboring tasks',async t=>{
  const h=harness(t),rows=fixtures();
  rows[1].share.program.weeks[0].data.r[2][0]='Koç · Yerinde kalacak rutin';
  h.seed(rows,'student-b');
  assert.equal(await h.w.classicTest.move(week,'r-2-1',0),true);
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0].payload,{operation:'move',sourceWeek:week,taskId:'r-2-1',date:'2026-10-05'});
  assert.equal(h.task('r-2-1'),null);
  assert.match(h.task('r-1-0').textContent,/Problemler 30 soru/);
  assert.match(h.task('r-2-0').textContent,/Yerinde kalacak rutin/);
  assert.match(h.task('r-0-0').textContent,/Paragraf 20 soru/);
  const data=h.w.classicTest.data('student-b').weeks[0].data;
  assert.equal(data.mv['r-1-0'].from,'2026-10-06');
  assert.equal(data.dn['r-2-1'],undefined);
});

test('empty weeks keep the classic sections and accept a directly entered date',async t=>{
  const h=harness(t);
  h.seed(fixtures(),'student-a','2026-11-16');
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-routines'));
  assert.ok(h.$('programWeekBoard').querySelector('.student-program-study'));
  assert.equal(h.$('programMainEmpty').classList.contains('hidden'),true);
  assert.match(h.$('programWeekBoard').querySelector('.student-program-summary').textContent,/0 planlanan/);
  h.$('programAddTaskBtn').click();
  assert.equal(h.$('programTaskDate').value,'2026-11-16');
  h.change('programTaskDate','2026-11-19');
  h.change('programTaskText','AYT Matematik · Türev · 30 soru');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-a');
  assert.deepEqual(h.writes[0].payload,{text:'AYT Matematik · Türev · 30 soru',date:'2026-11-19'});
});

test('changing students closes an old edit and cannot write it to the newly selected student',async t=>{
  const h=harness(t),rows=fixtures();
  rows[0].share.program.weeks=[{week,data:{r:[['Koç · Ada farklı çalışma']],s:[]}}];
  h.seed(rows,'student-b');
  h.task('r-0-0').querySelector('[data-program-edit]').click();
  h.change('programTaskText','Yanlış öğrenciye gitmemeli');
  h.change('programStudentSelect','student-a','change');
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  assert.equal(h.document.documentElement.classList.contains('program-task-open'),false);
  h.$('programTaskSend').click();
  h.$('programTaskDelete').click();
  await h.settle();
  assert.equal(h.writes.length,0);
  assert.match(h.task('r-0-0').textContent,/Ada farklı çalışma/);
  h.$('programAddTaskBtn').click();
  h.change('programTaskDate','2026-10-08');
  h.change('programTaskText','Ada için yeni çalışma');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-a');
});

test('automatic student fallback closes an old move menu and rejects its stale action',async t=>{
  const h=harness(t),rows=fixtures();
  rows[0].share.program.weeks=[{week,data:{r:[['Koç · Ada farklı çalışma']],s:[]}}];
  h.seed(rows,'student-b');
  h.task('r-0-0').querySelector('[data-program-select]').click();
  const menu=h.document.querySelector('.program-move-menu');
  assert.ok(menu);
  const staleTarget=menu.querySelectorAll('.program-move-days button')[1];
  assert.equal(staleTarget.disabled,false);
  // A live unlink removes the active student; hydration automatically picks the remaining one.
  h.seed([rows[0]],'student-b');
  assert.equal(h.w.classicTest.context().studentUid,'student-a');
  assert.equal(h.document.querySelector('.program-move-menu'),null);
  staleTarget.click();
  await h.settle();
  assert.equal(h.writes.length,0);
  assert.match(h.task('r-0-0').textContent,/Ada farklı çalışma/);
  assert.equal(h.task('r-0-1'),null);
});
