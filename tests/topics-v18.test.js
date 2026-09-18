const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

const moduleReady=import('../topics-live-v18.mjs');
const TODAY='2026-09-18';
const rawTopic=(overrides={})=>({key:'TYT|Matematik|Problemler',exam:'TYT',subject:'Matematik',topic:'Problemler',st:1,deadline:'2026-09-20',...overrides});
const shareOf=items=>({topics:{items}});
const entryOf=(items,studentUid='student-a')=>({link:{studentUid,coachUid:'coach-a',active:true},share:shareOf(items)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function dashboard(t,items=[rawTopic()],sendAction=async()=>{}){
  const {renderTopicDashboard}=await moduleReady;
  const dom=new JSDOM('<!doctype html><html lang="tr"><body><main id="content"></main></body></html>',{url:'https://example.test/'});
  const globals=['window','document','HTMLElement','FormData','Event'];
  const originals=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  for(const name of globals)Object.defineProperty(globalThis,name,{value:dom.window[name],writable:true,configurable:true});
  t.after(()=>{
    dom.window.close();
    for(const name of globals){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}
  });
  const host=dom.window.document.getElementById('content');
  const options={sendAction,friendlyError:error=>error.message};
  const render=entry=>renderTopicDashboard(host,entry,options);
  const entry=entryOf(items);
  render(entry);
  return{dom,host,entry,render};
}

function setValue(node,value,event='input'){
  assert.ok(node,'The expected user control must exist');
  node.value=value;
  node.dispatchEvent(new node.ownerDocument.defaultView.Event(event,{bubbles:true}));
}

function submit(form){
  assert.ok(form,'The action form must exist');
  form.dispatchEvent(new form.ownerDocument.defaultView.Event('submit',{bubbles:true,cancelable:true}));
}

const field=(host,name)=>host.querySelector(`[data-topic-field="${name}"]`);
const actionForm=host=>host.querySelector('form[data-topic-action]');
const cards=host=>[...host.querySelectorAll('[data-topic-id]')];
const topicNames=host=>cards(host).map(card=>card.querySelector('h4').textContent);
const openAction=(host,mode,topic='Problemler')=>{
  const card=cards(host).find(node=>node.querySelector('h4').textContent===topic);
  assert.ok(card,`The ${topic} topic must be reachable`);
  card.querySelector(`[data-topic-mode="${mode}"]`).click();
};

test('Konular v1.8 paylaşılmayan veriyi boş paylaşımdan ayırır',async()=>{
  const {buildTopicModel}=await moduleReady;
  for(const share of [null,{}, {topics:{}}, {topics:{items:null}}, {topics:{items:'bad'}}]){
    const model=buildTopicModel(share,TODAY);
    assert.equal(model.available,false);
    assert.equal(model.completionPct,null);
    assert.deepEqual(model.items,[]);
  }
  const empty=buildTopicModel(shareOf([]),TODAY);
  assert.equal(empty.available,true);
  assert.equal(empty.total,0);
  assert.equal(empty.completionPct,null);
});

test('Konular v1.8 gerçek dört aşamayı ve bilinmeyen durumları çakışmasız sayar',async()=>{
  const {buildTopicModel}=await moduleReady;
  const statuses=[0,1,2,3,'2',null,undefined,'',false,'bad',4,-1,1.5];
  const model=buildTopicModel(shareOf(statuses.map((st,index)=>rawTopic({key:`topic-${index}`,st}))),TODAY);
  assert.deepEqual(model.items.slice(0,5).map(item=>[item.stage,item.status,item.statusLabel]),[
    [0,'notstarted','Başlanmadı'],[1,'active','İşledim'],[2,'active','Soru çözdüm'],[3,'complete','Pekiştirdim'],[2,'active','Soru çözdüm']
  ]);
  assert.deepEqual([model.total,model.complete,model.active,model.notstarted,model.unknown],[13,1,3,1,8]);
  assert.equal(model.total,model.complete+model.active+model.notstarted+model.unknown);
  assert.equal(model.completionPct,8);
  assert.ok(model.items.slice(5).every(item=>item.stage===null&&item.status==='unknown'));
});

test('Konular v1.8 geçersiz tarihleri ve biten konuları gecikmeye katmaz',async()=>{
  const {buildTopicModel,validDateKey}=await moduleReady;
  for(const invalid of ['',null,undefined,'2026-02-30','2025-02-29','2026-13-01','2026-00-01','2026-09-00','2026-9-01','18/09/2026'])assert.equal(validDateKey(invalid),false,String(invalid));
  assert.equal(validDateKey('2024-02-29'),true);
  const model=buildTopicModel(shareOf([
    rawTopic({topic:'Geciken',st:1,deadline:'2026-09-17'}),
    rawTopic({topic:'Biten',st:3,deadline:'2026-09-01'}),
    rawTopic({topic:'Bugün',st:2,deadline:TODAY}),
    rawTopic({topic:'Gelecek',st:0,deadline:'2026-09-19'}),
    rawTopic({topic:'Geçersiz',deadline:'2026-02-30'}),
    rawTopic({topic:'Bilinmeyen',st:null,deadline:'2026-09-01'})
  ]),TODAY);
  assert.equal(model.overdue,1);
  assert.deepEqual(model.items.filter(item=>item.overdue).map(item=>item.topic),['Geciken']);
  assert.equal(model.items[4].deadline,'');
  assert.equal(model.items[4].invalidDeadline,true);
});

test('Konular v1.8 dersleri sınav türüyle ayırır ve kaynak kayıtları değiştirmez',async()=>{
  const {buildTopicModel,filterTopics}=await moduleReady;
  const raw=[rawTopic({topic:'TYT konusu'}),rawTopic({key:'AYT|Matematik|Limit',exam:'AYT',topic:'Limit',st:3}),null,'bad',[]];
  const original=structuredClone(raw);
  const model=buildTopicModel(shareOf(raw),TODAY);
  assert.equal(model.total,2);
  assert.equal(model.courseCount,2);
  assert.deepEqual(model.courses,['AYT · Matematik','TYT · Matematik']);
  assert.equal(model.invalidCount,3);
  const before=model.items.map(item=>item.key);
  filterTopics(model.items,{status:'all'},TODAY);
  assert.deepEqual(model.items.map(item=>item.key),before);
  assert.deepEqual(raw,original);
});

test('Konular v1.8 Türkçe aramayı ders ve durum filtresiyle birlikte uygular',async()=>{
  const {buildTopicModel,filterTopics}=await moduleReady;
  const model=buildTopicModel(shareOf([
    rawTopic({topic:'IŞIK',subject:'Fizik',st:1,deadline:'2026-09-01'}),
    rawTopic({topic:'İş ve Enerji',subject:'Fizik',st:3}),
    rawTopic({topic:'Işık',subject:'Fizik',exam:'AYT',st:2}),
    rawTopic({topic:'Sözcükte Anlam',subject:'Türkçe',st:0})
  ]),TODAY);
  assert.equal(filterTopics(model.items,{query:'  ışık  '},TODAY).length,2);
  assert.equal(filterTopics(model.items,{query:'ISIK'},TODAY).length,2);
  assert.equal(filterTopics(model.items,{query:'İŞ VE'},TODAY).length,1);
  assert.deepEqual(filterTopics(model.items,{query:'isik',subject:'TYT · Fizik',status:'overdue'},TODAY).map(item=>item.topic),['IŞIK']);
  assert.equal(filterTopics(model.items,{query:'Türkçe',status:'notstarted'},TODAY).length,1);
  assert.equal(filterTopics(model.items,{query:'olmayan konu'},TODAY).length,0);
});

test('Konular v1.8 DOM eksik veride çizgi, boş paylaşımda sıfır gösterir',async t=>{
  const {host,entry,render}=await dashboard(t,[]);
  assert.equal(host.querySelector('.topics-metric b').textContent,'0');
  assert.match(host.querySelector('[data-topic-list]').textContent,/Henüz paylaşılan konu kaydı yok/);
  render({...entry,share:{}});
  assert.equal(host.querySelector('.topics-metric b').textContent,'—');
  assert.match(host.querySelector('[data-topic-list]').textContent,/Konu verisi henüz paylaşılmadı/);
  assert.equal(host.querySelector('progress'),null);
});

test('Konular v1.8 tüm 125 konuya erişilir ve filtreler canlı çalışır',async t=>{
  const items=Array.from({length:125},(_,index)=>rawTopic({key:`topic-${index}`,topic:`Konu ${index+1}`,exam:index<100?'TYT':'AYT'}));
  const {host}=await dashboard(t,items);
  assert.equal(cards(host).length,125);
  assert.ok(topicNames(host).includes('Konu 125'));
  assert.equal(field(host,'query').closest('label').textContent.trim(),'Konu veya ders ara');
  setValue(field(host,'query'),'Konu 125');
  assert.deepEqual(topicNames(host),['Konu 125']);
  assert.equal(host.querySelector('[data-topic-result-count]').textContent,'1 / 125 konu');
  host.querySelector('[data-topic-clear]').click();
  assert.equal(cards(host).length,125);
  setValue(field(host,'subject'),'AYT · Matematik','change');
  assert.equal(cards(host).length,25);
  setValue(field(host,'status'),'complete','change');
  assert.equal(cards(host).length,0);
  assert.match(host.querySelector('[data-topic-list]').textContent,/eşleşen konu yok/);
});

test('Konular v1.8 paylaşılan HTML içeriğini yalnız metin olarak gösterir',async t=>{
  const attack='<img src=x onerror="globalThis.attacked=true">';
  const {host}=await dashboard(t,[rawTopic({subject:attack,topic:attack,key:'"><script>attacked=true</script>'})]);
  assert.equal(host.querySelector('img,script,iframe,[onerror]'),null);
  assert.ok(host.textContent.includes(attack));
  openAction(host,'deadline',attack);
  assert.equal(host.querySelector('img,script,iframe,[onerror]'),null);
  assert.ok(host.querySelector('.topics-selected-label').textContent.includes(attack));
});

test('Konular v1.8 son tarihi gerçek konu anahtarı ve mevcut action tipiyle gönderir',async t=>{
  const calls=[];
  const key='TYT||Matematik||Problemler';
  const {host}=await dashboard(t,[rawTopic({key})],async(...args)=>calls.push(args));
  openAction(host,'deadline');
  setValue(field(host,'date'),'2026-10-05');
  submit(actionForm(host));
  await flush();
  assert.deepEqual(calls,[['student-a','topic_deadline',{key,date:'2026-10-05'}]]);
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/Gönderildi.*işlenmesi bekleniyor/);
  assert.equal(actionForm(host),null);
});

for(const [mode,expectedText] of [['review','TYT · Matematik · Problemler konusunu tekrar et.'],['program','TYT · Matematik · Problemler konusunu çalış.']]){
  test(`Konular v1.8 ${mode} görevi program_task ile gönderir`,async t=>{
    const calls=[];
    const {host}=await dashboard(t,[rawTopic()],async(...args)=>calls.push(args));
    openAction(host,mode);
    assert.equal(field(host,'text').value,expectedText);
    setValue(field(host,'date'),'2026-10-06');
    submit(actionForm(host));
    await flush();
    assert.deepEqual(calls,[['student-a','program_task',{text:expectedText,date:'2026-10-06'}]]);
  });
}

test('Konular v1.8 boş tarihi ve boş görev metnini göndermez',async t=>{
  const calls=[];
  const {host}=await dashboard(t,[rawTopic()],async(...args)=>calls.push(args));
  openAction(host,'deadline');
  setValue(field(host,'date'),'');
  submit(actionForm(host));
  await flush();
  assert.deepEqual(calls,[]);
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/Geçerli bir tarih/);
  openAction(host,'program');
  setValue(field(host,'text'),'   ');
  setValue(field(host,'date'),'2026-10-06');
  submit(actionForm(host));
  await flush();
  assert.deepEqual(calls,[]);
});

test('Konular v1.8 eksik anahtarla son tarih gönderimini kapatır',async t=>{
  const {host}=await dashboard(t,[rawTopic({key:undefined})]);
  assert.equal(host.querySelector('[data-topic-mode="deadline"]').disabled,true);
  assert.equal(host.querySelector('[data-topic-mode="program"]').disabled,false);
});

test('Konular v1.8 çift gönderimi ve işlem sürerken snapshot kaynaklı tekrarları önler',async t=>{
  const calls=[],pending=deferred();
  const {host,entry,render}=await dashboard(t,[rawTopic()],(...args)=>{calls.push(args);return pending.promise});
  openAction(host,'deadline');
  setValue(field(host,'date'),'2026-10-05');
  const originalForm=actionForm(host);
  submit(originalForm);
  submit(originalForm);
  assert.equal(calls.length,1);
  assert.equal(actionForm(host).querySelector('button[type="submit"]').disabled,true);
  render({...entry,share:shareOf([rawTopic({st:2})])});
  assert.equal(actionForm(host).querySelector('button[type="submit"]').disabled,true);
  submit(actionForm(host));
  assert.equal(calls.length,1);
  pending.resolve();
  await flush();
  assert.equal(actionForm(host),null);
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/Gönderildi/);
});

test('Konular v1.8 başarısız gönderimde taslağı korur ve yeniden denemeye izin verir',async t=>{
  let attempts=0;
  const {host}=await dashboard(t,[rawTopic()],async()=>{attempts++;if(attempts===1)throw new Error('Bağlantı kesildi')});
  openAction(host,'review');
  setValue(field(host,'text'),'Problemler için 20 soru çöz.');
  setValue(field(host,'date'),'2026-10-05');
  submit(actionForm(host));
  await flush();
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/Gönderilemedi: Bağlantı kesildi/);
  assert.equal(field(host,'text').value,'Problemler için 20 soru çöz.');
  assert.equal(field(host,'date').value,'2026-10-05');
  assert.equal(actionForm(host).querySelector('button[type="submit"]').disabled,false);
  submit(actionForm(host));
  await flush();
  assert.equal(attempts,2);
  assert.equal(actionForm(host),null);
});

test('Konular v1.8 sekmeye dönüş ve canlı snapshot filtreyi, odağı ve taslağı korur',async t=>{
  const calls=[];
  const items=[rawTopic(),rawTopic({key:'AYT|Fizik|Işık',exam:'AYT',subject:'Fizik',topic:'Işık'})];
  const {host,entry,render}=await dashboard(t,items,async(...args)=>calls.push(args));
  setValue(field(host,'subject'),'TYT · Matematik','change');
  setValue(field(host,'status'),'active','change');
  setValue(field(host,'query'),'Prob');
  openAction(host,'program');
  setValue(field(host,'text'),'Problemler için özel görev.');
  setValue(field(host,'date'),'2026-10-08');
  field(host,'text').focus();field(host,'text').setSelectionRange(5,9);
  render({...entry,share:shareOf([rawTopic({st:2}),items[1]])});
  assert.equal(host.ownerDocument.activeElement,field(host,'text'));
  assert.equal(field(host,'text').selectionStart,5);
  assert.equal(field(host,'text').selectionEnd,9);
  for(let cycle=0;cycle<3;cycle++){
    host.innerHTML='<section>Özet</section>';
    render(entry);
    assert.equal(host.querySelectorAll('.topics-dashboard-v18').length,1);
    assert.equal(field(host,'query').value,'Prob');
    assert.equal(field(host,'subject').value,'TYT · Matematik');
    assert.equal(field(host,'status').value,'active');
    assert.equal(field(host,'text').value,'Problemler için özel görev.');
    assert.equal(field(host,'date').value,'2026-10-08');
    assert.equal(cards(host).length,1);
  }
  submit(actionForm(host));
  await flush();
  assert.equal(calls.length,1);
});

test('Konular v1.8 silinen bir konunun eski taslağını göndermez',async t=>{
  const calls=[];
  const {host,entry,render}=await dashboard(t,[rawTopic()],async(...args)=>calls.push(args));
  openAction(host,'deadline');
  render({...entry,share:shareOf([])});
  submit(actionForm(host));
  await flush();
  assert.equal(calls.length,0);
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/artık paylaşımda bulunmuyor/);
});

test('Konular v1.8 öğrenci değişiminde eski taslağı ve eski form dinleyicisini taşımaz',async t=>{
  const calls=[];
  const {host,render}=await dashboard(t,[rawTopic()],async(...args)=>calls.push(args));
  openAction(host,'program');
  setValue(field(host,'text'),'A öğrencisinin taslağı');
  setValue(field(host,'query'),'Prob');
  const staleForm=actionForm(host);
  render(entryOf([rawTopic({key:'student-b-topic'})],'student-b'));
  assert.equal(field(host,'query').value,'');
  assert.equal(actionForm(host),null);
  submit(staleForm);
  await flush();
  assert.equal(calls.length,0);
  openAction(host,'deadline');
  setValue(field(host,'date'),'2026-10-05');
  submit(actionForm(host));
  await flush();
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'student-b');
  assert.equal(calls[0][2].key,'student-b-topic');
});

test('Konular v1.8 eski asenkron sonuç yeni öğrencinin formunu veya mesajını değiştirmez',async t=>{
  const calls=[],pending=deferred();
  const {host,render}=await dashboard(t,[rawTopic()],(...args)=>{calls.push(args);return pending.promise});
  openAction(host,'deadline');
  setValue(field(host,'date'),'2026-10-05');
  submit(actionForm(host));
  render(entryOf([rawTopic({key:'student-b-topic'})],'student-b'));
  openAction(host,'program');
  setValue(field(host,'text'),'B öğrencisinin taslağı');
  pending.resolve();
  await flush();
  assert.equal(calls.length,1);
  assert.equal(field(host,'text').value,'B öğrencisinin taslağı');
  assert.equal(host.querySelector('[data-topic-feedback]').textContent,'');
  assert.equal(actionForm(host).querySelector('button[type="submit"]').disabled,false);
});

test('Konular v1.8 sekmeden çıkıldıktan sonra tamamlanan istek başka sekmeyi çizmez',async t=>{
  const calls=[],pending=deferred();
  const {host,entry,render}=await dashboard(t,[rawTopic()],(...args)=>{calls.push(args);return pending.promise});
  openAction(host,'deadline');
  const detachedForm=actionForm(host);
  host.innerHTML='<section id="other-tab">İlerleme</section>';
  submit(detachedForm);
  await flush();
  assert.equal(calls.length,0,'Leaving the tab must revoke its detached form');
  render(entry);
  submit(actionForm(host));
  assert.equal(calls.length,1);
  host.innerHTML='<section id="other-tab">İlerleme</section>';
  pending.resolve();
  await flush();
  assert.equal(host.innerHTML,'<section id="other-tab">İlerleme</section>');
  render(entry);
  assert.equal(host.querySelectorAll('.topics-dashboard-v18').length,1);
  assert.equal(actionForm(host),null);
  assert.match(host.querySelector('[data-topic-feedback]').textContent,/Gönderildi/);
});

test('Konular v1.8 başka öğrencinin özetine geçiş önceki konu taslağını sıfırlar',async t=>{
  const {syncTopicStudent}=await moduleReady;
  const {host,entry,render}=await dashboard(t);
  openAction(host,'program');
  setValue(field(host,'text'),'A öğrencisinin eski taslağı');
  setValue(field(host,'query'),'Prob');
  syncTopicStudent(host,'student-b');
  host.innerHTML='<section id="other-tab">B öğrencisinin özeti</section>';
  render(entry);
  assert.equal(actionForm(host),null);
  assert.equal(field(host,'query').value,'');
  assert.equal(host.querySelector('[data-topic-feedback]').textContent,'');
  openAction(host,'program');
  assert.equal(field(host,'text').value,'TYT · Matematik · Problemler konusunu çalış.');
});

test('Konular v1.8 oturum sıfırlanınca eski sonuç aynı öğrencinin yeni oturumuna sızmaz',async t=>{
  const {syncTopicStudent}=await moduleReady;
  const calls=[],pending=deferred();
  const {host,entry,render}=await dashboard(t,[rawTopic()],(...args)=>{calls.push(args);return pending.promise});
  openAction(host,'deadline');
  setValue(field(host,'date'),'2026-10-05');
  submit(actionForm(host));
  assert.equal(calls.length,1);
  syncTopicStudent(host,null);
  host.innerHTML='<section>Giriş yap</section>';
  render(entry);
  assert.equal(actionForm(host),null);
  openAction(host,'review');
  setValue(field(host,'text'),'Yeni oturumun taslağı');
  pending.resolve();
  await flush();
  assert.equal(field(host,'text').value,'Yeni oturumun taslağı');
  assert.equal(host.querySelector('[data-topic-feedback]').textContent,'');
  assert.equal(actionForm(host).querySelector('button[type="submit"]').disabled,false);
  assert.equal(calls.length,1);
});
