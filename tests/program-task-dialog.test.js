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
      context(){return{studentUid:selectedProgramStudentUid,week:selectedProgramWeekStart,edit:coachProgramEditContext};}
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
  h.$('programTaskText').click();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false,'clicking dialog content must not dismiss it');
  h.$('programTaskBackdrop').click();
  assertClosed(h);
  assert.equal(h.w.dialogTest.context().studentUid,'student-b');
  assert.equal(h.w.dialogTest.context().week,week);
});

test('classic composer sends the entered date and text only to the selected student',async t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  h.change('programTaskDate','2026-10-09');
  h.change('programTaskText','TYT Türkçe · Paragraf · 20 soru');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes.map(x=>({collection:x.collection,studentUid:x.studentUid,coachUid:x.coachUid,type:x.type,payload:x.payload})),[
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
  assert.equal(h.$('programTaskDate').value,'2026-10-07');
  assert.equal(h.$('programTaskDate').disabled,true);
  h.change('programTaskText','Paragraf yanlışlarının tekrarı');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.deepEqual(h.writes[0].payload,{operation:'edit',sourceWeek:week,taskId:'r-0-2',text:'Koç · Paragraf yanlışlarının tekrarı — https://youtu.be/original'});
  h.runTimers();
  assertClosed(h);
  assert.equal(h.document.activeElement,h.$('programAddTaskBtn'),'saving replaces the edit card, so focus returns to the add button');
});

test('closing an edit and reopening resets to an empty new-work composer',t=>{
  const h=harness(t);
  h.document.querySelector('[data-program-task-id="r-0-2"] [data-program-edit]').click();
  assert.equal(h.$('programTaskText').value,'Paragraf tekrarı');
  h.click('programTaskCancel');
  assertClosed(h);
  h.click('programAddTaskBtn');
  assert.equal(h.$('programTaskDate').disabled,false);
  assert.equal(h.$('programTaskText').value,'');
  assert.equal(h.$('programTaskVideo').value,'');
  assert.equal(h.w.dialogTest.context().edit,null);
  assert.equal(h.writes.length,0);
});

test('invalid date, blank text and unsafe video URL cannot create actions',async t=>{
  const h=harness(t);
  h.click('programAddTaskBtn');
  h.change('programTaskDate','');
  h.change('programTaskText','Paragraf çöz');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,0);
  h.change('programTaskDate','2026-10-09');
  h.change('programTaskText','   ');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,0);
  h.change('programTaskText','Paragraf çöz');
  h.change('programTaskVideo','javascript:alert(1)');
  h.$('programTaskSend').click();
  await h.settle();
  assert.equal(h.writes.length,0);
  assert.equal(h.$('programTaskStatus').classList.contains('error'),true);
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
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
  h.click('programAddTaskBtn');
  h.w.videoDialogTest.setContext({teacher:'Test Hoca',subject:'Türkçe',topic:'Paragraf'});
  h.w.videoDialogTest.addToProgram({kind:'video',title:'Paragraf soru çözümü',url:'https://youtu.be/test'});
  h.runTimers(0);
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('programTaskVideo').value,'https://youtu.be/test');
  assert.match(h.$('programTaskText').value,/TYT Türkçe · Video izle · Paragraf soru çözümü/);
  assert.equal(h.w.dialogTest.context().studentUid,'student-b');
  assert.equal(h.w.dialogTest.context().week,week);
  assert.equal(h.scrollCalls.length,0);
  assert.equal(h.writes.length,0);
});

test('video library mounts on the classic screen and recommendations preserve the selected student and topic',async t=>{
  const h=harness(t),videoRuntime=read('program-videos-v1.js');
  const bootStart=videoRuntime.indexOf('  function boot()');
  assert.ok(bootStart>0);
  h.w.eval(videoRuntime.slice(0,bootStart)+`
    window.videoLibraryTest={buildShell,recommendResource,setContext(value){Object.assign(state,value)}};
  })();`);
  assert.equal(h.document.querySelector('.program-summary'),null);
  assert.equal(h.$('programHeroName'),null);
  h.w.videoLibraryTest.buildShell();
  h.w.videoLibraryTest.buildShell();
  assert.equal(h.document.querySelectorAll('#programVideoLibrary').length,1);
  assert.equal(h.$('programVideoLibrary').closest('#coachV19VideoPane'),h.$('coachV19VideoPane'));
  assert.equal(h.$('programVideoLibrary').closest('#programsPage'),null);
  h.w.videoLibraryTest.setContext({scope:'TYT',teacher:'Test Hoca',subject:'Türkçe',topic:'Paragraf'});
  h.w.videoLibraryTest.recommendResource({kind:'video',id:'test-video',title:'Paragraf çözümü',url:'https://youtu.be/test',thumb:'https://example.test/thumb.jpg'});
  await h.settle();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.writes[0],{
    collection:'coachingActions',studentUid:'student-b',coachUid:'coach-test',type:'coach_note',
    payload:{operation:'resource_recommendation',text:'Kaynak önerisi · Paragraf çözümü',kind:'video',id:'test-video',title:'Paragraf çözümü',url:'https://youtu.be/test',teacher:'Test Hoca',subject:'Türkçe',topic:'Paragraf',scope:'TYT',thumb:'https://example.test/thumb.jpg'},
    status:'pending',createdAt:{serverTimestamp:true},updatedAt:{serverTimestamp:true}
  });
  h.w.dialogTest.seed([],'',week);
  h.w.videoLibraryTest.recommendResource({kind:'playlist',id:'test-list',title:'Paragraf listesi',url:'https://www.youtube.com/playlist?list=test'});
  await h.settle();
  assert.equal(h.writes.length,1,'a missing selection cannot dispatch a recommendation to an old student');
  assert.match(h.$('coachVideoStatus').textContent,/Önce bir öğrenci seç/);
});

test('missing student keeps the dialog closed and does not lock the page',t=>{
  const h=harness(t);
  h.w.dialogTest.seed([],'',week);
  h.$('programAddTaskBtn').click();
  assertClosed(h);
  assert.equal(h.alerts.length,1);
  assert.equal(h.writes.length,0);
});

test('Video Ekle opens its own teacher library and sends only after explicit confirmation',async t=>{
  const h=harness(t),w=h.w;
  const feed={teachers:{'Eyüp B.':{channelName:'Eyüp B.',videos:[{
    id:'abc123XYZ99',title:'TYT Matematik Problemler Konu anlatımı',
    url:'https://www.youtube.com/watch?v=abc123XYZ99'
  }]}}};
  let requests=0;
  w.fetch=async()=>{requests++;return{ok:true,json:async()=>feed}};
  w.eval(read('program-videos-v1.js'));
  h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),true);
  assert.equal(h.$('programVideoLibrary').closest('#coachV19VideoPane'),h.$('coachV19VideoPane'));
  assert.equal(requests,0);
  h.click('programAddVideoBtn');
  for(let i=0;i<40;i++)await Promise.resolve();
  assert.equal(h.$('programTaskBackdrop').classList.contains('hidden'),true,'Çalışma Ekle stays closed');
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),false);
  assert.equal(h.$('coachVideoPickerBackdrop').getAttribute('aria-hidden'),'false');
  assert.equal(h.$('coachVideoPickerTitle'),h.document.activeElement);
  assert.equal(h.$('coachVideoPickerDate').value,'2026-10-05');
  assert.equal(h.$('coachVideoPickerDays').querySelectorAll('button').length,7);
  assert.equal(h.$('coachVideoLibraryHost').contains(h.$('programVideoLibrary')),true);
  assert.ok(requests>0,'existing real teacher feed is loaded only on opening');
  assert.ok(h.$('coachVideoResults').querySelector('[data-video-add="0"]'));
  assert.equal(h.$('coachVideoResults').querySelector('[data-video-add="0"]').textContent,'Seç');
  assert.equal(h.$('coachVideoPickerSave').disabled,true);
  assert.equal(h.writes.length,0);
  h.$('coachVideoResults').querySelector('[data-video-add="0"]').click();
  assert.equal(h.$('coachVideoPickerSave').disabled,false);
  assert.match(h.$('coachVideoPickerSelection').textContent,/Problemler/);
  assert.equal(h.writes.length,0,'selecting never sends the video to a student');
  h.$('coachVideoPickerDays').querySelector('[data-video-date="2026-10-07"]').click();
  assert.equal(h.$('coachVideoPickerDate').value,'2026-10-07');
  h.$('coachVideoPickerSave').click();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].studentUid,'student-b');
  assert.equal(h.writes[0].type,'program_task');
  assert.deepEqual(Object.keys(h.writes[0].payload).sort(),['date','text']);
  assert.equal(h.writes[0].payload.date,'2026-10-07');
  assert.match(h.writes[0].payload.text,/TYT Matematik.*Eyüp B..*Video izle/);
  assert.match(h.writes[0].payload.text,/https:\/\/www\.youtube\.com\/watch\?v=abc123XYZ99/);
  h.runTimers();
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),true);
  assert.equal(h.$('programVideoLibrary').closest('#coachV19VideoPane'),h.$('coachV19VideoPane'));
  assert.equal(h.document.documentElement.classList.contains('program-task-open'),false);
});

test('video picker cancel, student switch and invalid dates never create program tasks',async t=>{
  const h=harness(t),w=h.w;
  h.click('programAddVideoBtn');
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),false);
  h.$('coachVideoPickerSave').click();
  await h.settle();assert.equal(h.writes.length,0);
  h.$('coachVideoPickerCancel').click();
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),true);
  assert.equal(h.document.activeElement,h.$('programAddVideoBtn'));
  h.click('programAddVideoBtn');
  w.dispatchEvent(new w.CustomEvent('yks:coach-video-picked',{detail:{
    scope:'AYT',subject:'Fizik',teacher:'Özcan Aykın',title:'Elektrik',
    url:'https://youtu.be/abc123XYZ99',kind:'video'
  }}));
  h.change('coachVideoPickerDate','2026-13-39','change');
  h.$('coachVideoPickerSave').click();
  await h.settle();assert.equal(h.writes.length,0);
  assert.match(h.$('coachVideoPickerStatus').textContent,/Geçerli bir gün/);
  h.change('coachVideoPickerDate','2026-10-07','change');
  h.change('programStudentSelect','student-a','change');
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),true);
  assert.equal(h.writes.length,0);
  h.click('programAddVideoBtn');
  assert.equal(h.$('coachVideoPickerSave').disabled,true,'old student selection must not survive');
  h.$('coachVideoPickerClose').click();
});

test('v46 · v48 Video ekle: gün satırı haftayı değiştirir; birden çok video seçilir, alt şeritte sayılır',async t=>{
  const h=harness(t),w=h.w;
  const feed={teachers:{'Eyüp B.':{channelName:'Eyüp B.',videos:[
    {id:'abc123XYZ99',title:'TYT Matematik Problemler Konu anlatımı',url:'https://www.youtube.com/watch?v=abc123XYZ99'},
    {id:'def456UVW88',title:'Fonksiyon Soru Çözümü',url:'https://www.youtube.com/watch?v=def456UVW88'}
  ]}}};
  w.fetch=async()=>({ok:true,json:async()=>feed});
  w.eval(read('program-videos-v1.js'));
  h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  h.click('programAddVideoBtn');
  for(let i=0;i<40;i++)await Promise.resolve();
  assert.equal(h.$('coachVideoPickerTitle').textContent,'Video ekle');
  assert.equal(h.$('coachVideoPickerWeekLabel').textContent,'5 Eki – 11 Eki');
  assert.equal(h.$('coachVideoPickerSave').textContent,"Pazartesi'ye ekle");
  assert.equal(h.$('coachVideoPickerSelection').textContent,'Bir ya da birkaç video seç');
  assert.equal(h.$('coachVideoPickerClear').hidden,true);
  assert.ok(h.$('programVideoLibrary').querySelector('.coach-video-controls .coach-video-filters'),'filtreler sabit üst kutuda');
  const add=i=>h.$('coachVideoResults').querySelector('[data-video-add="'+i+'"]');
  add(0).click();
  assert.equal(add(0).textContent,'✓ Seçildi');assert.ok(add(0).closest('.coach-video-card').classList.contains('is-picked'));
  assert.equal(h.$('coachVideoPickerSelection').querySelector('b').textContent,'TYT Matematik Problemler Konu anlatımı');
  assert.equal(h.$('coachVideoPickerSelection').querySelector('small').textContent,'Eyüp B.');
  add(1).click();
  assert.equal(add(0).textContent,'✓ Seçildi','v48: önceki seçim kalır');assert.equal(add(1).textContent,'✓ Seçildi');
  assert.equal(h.$('coachVideoPickerSelection').querySelector('b').textContent,'2 video seçildi');
  assert.equal(h.$('coachVideoPickerSelection').querySelector('small').textContent,'TYT Matematik Problemler Konu anlatımı · Fonksiyon Soru Çözümü');
  assert.equal(h.$('coachVideoPickerClear').hidden,false);
  add(0).click();
  assert.equal(add(0).textContent,'Seç','ikinci dokunuş seçimi kaldırır');
  assert.equal(h.$('coachVideoPickerSelection').querySelector('b').textContent,'Fonksiyon Soru Çözümü');
  add(0).click();
  h.$('coachVideoPickerDays').querySelector('[data-video-date="2026-10-07"]').click();
  assert.equal(h.$('coachVideoPickerSave').textContent,"Çarşamba'ya 2 video ekle");
  h.$('coachVideoPickerNextWeek').click();
  assert.equal(h.$('coachVideoPickerDate').value,'2026-10-14');
  assert.equal(h.$('coachVideoPickerWeekLabel').textContent,'12 Eki – 18 Eki');
  assert.equal(h.$('coachVideoPickerSave').textContent,"Çarşamba'ya 2 video ekle",'aynı gün yeni haftada');
  h.$('coachVideoPickerPrevWeek').click();
  assert.equal(h.$('coachVideoPickerDate').value,'2026-10-07');
  assert.equal(h.writes.length,0,'gün ve hafta değiştirmek hiçbir şey göndermez');
  h.$('coachVideoPickerClose').click();
});

test('v46 Video ekle stilleri yalnız tema değişkenleri ve en az 11px yazı kullanır',()=>{
  const css=read('coach-video-picker-v46.css'),html=read('index.html');
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-video-picker-v46\.css\?v=1\.0\.\d+">/);
  assert.match(html,/app-reset\.js\?v=1\.0\.70-[^"]*-composer45-video46[^"]*"/);
  assert.match(css,/#coachVideoPickerBackdrop \.coach-video-controls\{position:sticky;top:0;/);
  assert.match(css,/\.coach-video-card-actions>:is\(button\[data-video-open\],button\[data-playlist-video-open\]\)\{display:none\}/,'resim zaten videoyu açar');
  assert.doesNotMatch(css,/button:first-child\{display:none\}|\[data-playlist-view\]\{display:none/,'listelerde "Videoları gör" kalır');
  assert.match(css,/#coachVideoPickerBackdrop #coachVideoPickerCancel\{display:none\}/);
  assert.match(css,/#coachVideoPickerStatus:not\(\[data-status="error"\]\):not\(\[data-status="success"\]\)\{display:none\}/);
  assert.deepEqual(css.match(/[:,(\s]#[0-9a-fA-F]{3,8}\b/g)||[],[]);
  assert.doesNotMatch(css,/rgba?\(|hsl\(/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=11,size);
});

test('v48 seçilen videolar sırayla aynı güne ayrı görev gider; açık kalsın işaretliyse pencere kapanmaz',async t=>{
  const h=harness(t),w=h.w;
  const videos=['aaa111AAA11','bbb222BBB22','ccc333CCC33'].map((id,i)=>({id,title:'Video '+(i+1),url:'https://www.youtube.com/watch?v='+id}));
  w.fetch=async()=>({ok:true,json:async()=>({teachers:{'Eyüp B.':{channelName:'Eyüp B.',videos}}})});
  w.eval(read('program-videos-v1.js'));
  h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  h.click('programAddVideoBtn');
  for(let i=0;i<40;i++)await Promise.resolve();
  const add=i=>h.$('coachVideoResults').querySelector('[data-video-add="'+i+'"]');
  add(2).click();add(0).click();add(1).click();
  h.$('coachVideoPickerClear').click();
  assert.equal(add(0).textContent,'Seç','Temizle hepsini kaldırır');assert.equal(h.$('coachVideoPickerSave').disabled,true);
  add(2).click();add(0).click();
  h.$('coachVideoPickerKeepOpen').checked=true;
  h.$('coachVideoPickerSave').click();
  for(let i=0;i<30;i++)await Promise.resolve();
  assert.deepEqual(h.writes.map(x=>x.payload.text.match(/v=(\w+)/)[1]),['ccc333CCC33','aaa111AAA11'],'seçilen sırayla');
  assert.deepEqual([...new Set(h.writes.map(x=>x.payload.date))],['2026-10-05']);
  h.runTimers();
  assert.equal(h.$('coachVideoPickerBackdrop').classList.contains('hidden'),false,'pencere açık kalır');
  assert.match(h.$('coachVideoPickerStatus').textContent,/^2 video görev olarak gönderildi ✓/);
  assert.equal(h.$('coachVideoPickerSelection').textContent,'Bir ya da birkaç video seç');
  assert.equal(add(2).textContent,'Seç','gönderilenlerin işareti kalkar');
  h.$('coachVideoPickerClose').click();
  h.click('programAddVideoBtn');
  assert.equal(h.$('coachVideoPickerKeepOpen').checked,false,'yeniden açılınca kutu boş');
});

test('v48 en çok 10 video seçilir; Çalışma ekle linki göreve eklenir',async t=>{
  const h=harness(t),w=h.w;
  const videos=Array.from({length:11},(_,i)=>({id:'vid'+String(i).padStart(8,'0'),title:'Video '+i,url:'https://www.youtube.com/watch?v=vid'+String(i).padStart(8,'0')}));
  w.fetch=async()=>({ok:true,json:async()=>({teachers:{'Eyüp B.':{channelName:'Eyüp B.',videos}}})});
  w.eval(read('program-videos-v1.js'));
  h.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  h.click('programAddVideoBtn');
  for(let i=0;i<40;i++)await Promise.resolve();
  for(let i=0;i<11;i++)h.$('coachVideoResults').querySelector('[data-video-add="'+i+'"]').click();
  assert.equal(h.$('coachVideoPickerSelection').querySelector('b').textContent,'10 video seçildi');
  assert.match(h.$('coachVideoPickerStatus').textContent,/En çok 10 video/);
  assert.equal(h.$('coachVideoResults').querySelector('[data-video-add="10"]').textContent,'Seç');
  h.$('coachVideoPickerClose').click();
  assert.match(read('index.html'),/<label class="coach-v22-legacy-video-link"><span>Link · isteğe bağlı<\/span><input id="programTaskVideo" type="url"/);
});
