const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const week='2026-10-05';

function fixture(){
  return [
    {studentUid:'student-a',share:{profile:{name:'Ada'},program:{weeks:[]}}},
    {studentUid:'student-b',share:{profile:{name:'Deniz'},program:{weeks:[{week,data:{r:[['','','Koç · Paragraf tekrarı — https://youtu.be/original','','','','']],s:[]}}]}}}
  ];
}

function harness(t){
  // External scripts/styles are never fetched; only the real local runtime is evaluated.
  const dom=new JSDOM(read('index.html'),{url:'https://coach.example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,document=w.document,writes=[],alerts=[],focusCalls=[],scrollCalls=[],timers=[];
  const auth={currentUser:{uid:'coach-test'}};
  Object.assign(w,{
    FIREBASE_CONFIG:{},COLLECTIONS:{profiles:'profiles'},
    initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    GoogleAuthProvider:class{setCustomParameters(){}},
    onAuthStateChanged:()=>()=>{},onSnapshot:()=>()=>{},
    collection:(_db,name)=>({name}),doc:(_db,...parts)=>({parts}),
    query:(...parts)=>parts,where:(...parts)=>parts,
    serverTimestamp:()=>({serverTimestamp:true}),
    addDoc:async(ref,data)=>{writes.push({collection:ref.name,...plain(data)});return{id:'action-'+writes.length}},
    getDoc:async()=>({exists:()=>false}),getDocs:async()=>({docs:[]}),
    updateDoc:async()=>{},setDoc:async()=>{},signOut:async()=>{},
    alert:message=>alerts.push(message),confirm:()=>true,
    setInterval:()=>0,clearInterval:()=>{},
    setTimeout:(callback,delay=0)=>{timers.push({callback,delay});return timers.length},clearTimeout:()=>{},
    requestAnimationFrame:callback=>{callback(0);return 1},cancelAnimationFrame:()=>{},
    scrollTo:(...args)=>scrollCalls.push(args)
  });
  const realFocus=w.HTMLElement.prototype.focus;
  w.HTMLElement.prototype.focus=function(options){focusCalls.push({id:this.id,options});return realFocus.call(this,options)};
  w.HTMLElement.prototype.scrollIntoView=function(options){scrollCalls.push({id:this.id,options})};
  w.eval(read('app-reset.js').replace(/^import[^\n]+\n/gm,'')+`
    window.dialogTest={
      seed(rows,studentUid,week){coachReportRows=rows;selectedProgramStudentUid=studentUid;selectedProgramWeekStart=week;hydrateProgramStudents();renderProgramWorkspace();},
      openEdit:openCoachProgramEdit,showPage:showCoachPage,showAuth,
      context(){return{studentUid:selectedProgramStudentUid,week:selectedProgramWeekStart,days:[...coachProgramDays],edit:coachProgramEditContext};}
    };
  `);
  document.getElementById('bootView').classList.add('hidden');
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  w.dialogTest.seed(fixture(),'student-b',week);
  w.dialogTest.showPage('programs');
  const $=id=>document.getElementById(id);
  return {w,document,$,writes,alerts,focusCalls,scrollCalls,timers,
    click(id){const el=$(id);el.focus();el.click();},
    key(key,shiftKey=false){const event=new w.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(event);return event;},
    async settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve();},
    runTimers(maxDelay=Infinity){const due=timers.splice(0);for(const item of due){if(item.delay<=maxDelay)item.callback();else timers.push(item)}},
    change(id,value,type='input'){$(id).value=value;$(id).dispatchEvent(new w.Event(type,{bubbles:true}));}
  };
}

function assertClosed(h){
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true);
  assert.equal(h.$('programTaskBackdrop').getAttribute('aria-hidden'),'true');
  assert.equal(h.document.documentElement.classList.contains('program-task-open'),false);
  assert.equal(h.$('appView').inert,false);
}

test('Çalışma Ekle opens a page-independent dialog, focuses without scrolling, and Escape restores its opener',t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  const backdrop=h.$('programTaskBackdrop');
  assert.equal(backdrop.parentElement,h.document.body,'page animation must not contain the fixed dialog');
  assert.equal(backdrop.classList.contains('hidden'),false);
  assert.equal(backdrop.getAttribute('aria-hidden'),'false');
  assert.equal(h.document.documentElement.classList.contains('program-task-open'),true);
  assert.equal(h.$('appView').inert,true);
  assert.equal(h.document.activeElement,h.$('programTaskTitle'));
  assert.equal(h.focusCalls.at(-1).options?.preventScroll,true);
  assert.match(h.$('programTaskStudentName').textContent,/Deniz/);
  assert.equal(h.w.dialogTest.context().week,week);
  assert.equal(h.scrollCalls.length,0);
  h.key('Escape');
  assertClosed(h);
  assert.equal(h.document.activeElement,h.$('programAddTaskBtn'));
  assert.equal(h.focusCalls.at(-1).options?.preventScroll,true);
  assert.equal(h.writes.length,0,'opening and closing must not create tasks');
});

test('Tab stays inside the composer and background clicks close without losing selection',t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  h.$('programTaskSend').focus();
  const forward=h.key('Tab');
  assert.equal(forward.defaultPrevented,true);
  assert.equal(h.document.activeElement,h.$('programTaskClose'));
  const backward=h.key('Tab',true);
  assert.equal(backward.defaultPrevented,true);
  assert.equal(h.document.activeElement,h.$('programTaskSend'));
  h.$('programTaskSubject').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false,'clicking dialog content must not dismiss it');
  h.$('programTaskBackdrop').click();
  assertClosed(h);
  assert.equal(h.w.dialogTest.context().studentUid,'student-b');
  assert.equal(h.w.dialogTest.context().week,week);
});

test('quick builder still sends only the selected student and chosen days of the selected week',async t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  h.change('programTaskSubject','TYT · Türkçe','change');
  h.change('programTaskTopic','Paragraf');
  h.change('programTaskQuestions','20');
  for(const button of h.document.querySelectorAll('[data-program-day].active'))button.click();
  h.document.querySelector('[data-program-day="1"]').click();
  h.document.querySelector('[data-program-day="4"]').click();
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,2);
  assert.deepEqual(h.writes.map(x=>({collection:x.collection,studentUid:x.studentUid,coachUid:x.coachUid,type:x.type,payload:x.payload})),[
    {collection:'coachingActions',studentUid:'student-b',coachUid:'coach-test',type:'program_task',payload:{text:'TYT Türkçe · Paragraf · 20 soru',date:'2026-10-06'}},
    {collection:'coachingActions',studentUid:'student-b',coachUid:'coach-test',type:'program_task',payload:{text:'TYT Türkçe · Paragraf · 20 soru',date:'2026-10-09'}}
  ]);
  h.runTimers();
  assertClosed(h);
});

test('editing keeps the source task, day, coach prefix and video with exactly one edit action',async t=>{
  const h=harness(t);
  const editButton=h.document.querySelector('[data-program-task-id="r-0-2"] [data-program-edit]');
  assert.ok(editButton);
  editButton.focus();editButton.click();
  assert.equal(h.$('programTaskText').value,'Paragraf tekrarı');
  assert.equal(h.$('programTaskVideo').value,'https://youtu.be/original');
  assert.deepEqual(plain(h.w.dialogTest.context().days),[2]);
  assert.equal(h.document.querySelector('[data-program-day="2"]').disabled,true);
  h.change('programTaskText','Paragraf yanlışlarının tekrarı');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.deepEqual(h.writes[0].payload,{operation:'edit',sourceWeek:week,taskId:'r-0-2',text:'Koç ·Paragraf yanlışlarının tekrarı — https://youtu.be/original'});
  h.runTimers();
  assertClosed(h);
  assert.equal(h.document.activeElement,h.$('programAddTaskBtn'),'saving replaces the edit card, so focus returns to the add button');
});

test('templates retain custom text and close/reopen returns to adding a new task',t=>{
  const h=harness(t);
  const template=h.document.querySelector('[data-program-template]');
  template.focus();template.click();
  assert.equal(h.$('programTaskText').value,template.dataset.programTemplate);
  assert.equal(h.$('programCustomBuilder').classList.contains('hidden'),false);
  h.click('programTaskCancel');
  assertClosed(h);
  h.click('programAddTaskBtn');
  assert.equal(h.$('programQuickBuilder').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskText').value,'');
  assert.equal(h.w.dialogTest.context().edit,null);
  assert.equal(h.writes.length,0);
});

test('navigation and sign-out hide a body-level dialog and release its scroll lock',t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  h.w.dialogTest.showPage('students');
  assertClosed(h);
  h.w.dialogTest.showPage('programs');
  h.click('programAddTaskBtn');
  h.w.dialogTest.showAuth();
  assertClosed(h);
  assert.equal(h.$('appView').classList.contains('hidden'),true);
  assert.equal(h.writes.length,0);
});

test('video-to-program opens and fills the same composer without scrolling the page',t=>{
  const h=harness(t);
  // Expose the existing IIFE function without starting remote library loads.
  const videoRuntime=read('program-videos-v1.js');
  const bootStart=videoRuntime.indexOf('  function boot()');
  assert.ok(bootStart>0);
  h.w.eval(videoRuntime.slice(0,bootStart)+`
    window.videoDialogTest={addToProgram,setContext(value){Object.assign(state,value)}};
  })();`);
  h.w.videoDialogTest.setContext({teacher:'Test Hoca',subject:'Türkçe',topic:'Paragraf'});
  h.w.videoDialogTest.addToProgram({kind:'video',title:'Paragraf soru çözümü',url:'https://youtu.be/test'});
  h.runTimers(0);
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskVideo').value,'https://youtu.be/test');
  assert.match(h.$('programTaskText').value,/Video izle · Test Hoca · Türkçe · Paragraf · Paragraf soru çözümü/);
  assert.equal(h.w.dialogTest.context().studentUid,'student-b');
  assert.equal(h.w.dialogTest.context().week,week);
  assert.equal(h.scrollCalls.length,0);
  assert.equal(h.writes.length,0);
});

test('missing student keeps the dialog closed and does not lock the page',t=>{
  const h=harness(t);
  h.w.dialogTest.seed([],'',week);
  h.$('programAddTaskBtn').click();
  assertClosed(h);
  assert.equal(h.alerts.length,1);
  assert.equal(h.writes.length,0);
});
