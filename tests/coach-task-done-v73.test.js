const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {newlyDoneTasks,taskDoneMessage}=require("../coach-task-done-v73.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

// Basit görev toplayıcı: data.r satırlarının o güne düşen hücreleri (app-reset'teki id biçimiyle).
const collect=(program,week,day)=>(week?.data?.r||[]).map((row,i)=>({id:"r-"+i+"-"+day,text:row[day]||""})).filter(t=>t.text);
const share=(data,week="2026-11-09")=>({program:{weeks:[{week,data}]}});
const R=[["Paragraf 40 soru","","Türev tekrar"],["Problem 30 soru"]];

test("v73: yalnız yeni tamamlanan görevler; ilk yükleme ve değişmeyenler bildirilmez",()=>{
  const before=share({r:R,dn:{"r-1-0":true}});
  assert.deepEqual(newlyDoneTasks(null,before,collect),[],"ilk yükleme");
  assert.deepEqual(newlyDoneTasks(before,before,collect),[]);
  const after=share({r:R,dn:{"r-1-0":true,"r-0-2":true}});
  assert.deepEqual(newlyDoneTasks(before,after,collect),[{week:"2026-11-09",day:2,id:"r-0-2",text:"Türev tekrar"}]);
  const dayDone=share({r:R,dn:{"r-1-0":true},done:{0:true}});
  assert.deepEqual(newlyDoneTasks(before,dayDone,collect).map(x=>x.id),["r-0-0"],"günün tümü işaretlenince önceden tamam olan tekrar sayılmaz");
  assert.deepEqual(newlyDoneTasks(before,share({r:R,dn:{"r-0-0":true}},"2026-11-16"),collect).map(x=>x.week),["2026-11-16"],"yeni hafta");
  assert.deepEqual(newlyDoneTasks(before,{program:{weeks:"bozuk"}},collect),[]);
});

test("v73: bildirim metni",()=>{
  assert.equal(taskDoneMessage([]),"");
  assert.equal(taskDoneMessage([{text:"Türev tekrar"}]),"Görevi tamamladı: Türev tekrar");
  assert.equal(taskDoneMessage([{text:"A"},{text:"B"}]),"2 görev tamamladı · A");
});

test("v73 bağlantı: canlı paylaşımda önceki halle karşılaştırılır; tercih ve arka sekme şartı",()=>{
  const app=read("app-reset.js"),html=read("index.html");
  assert.match(app,/const before=target\.share;\s*target\.share=snap\.exists\(\)\?snap\.data\(\):null;scheduleCoachRealtimeRender\(\);\s*coachTaskDoneNotify\(target,before\);/);
  assert.match(app,/if\(!items\.length\|\|!coachV56NotifyOn\(\)\|\|!document\.hidden\)return;/);
  assert.match(html,/<script defer src="\.\/coach-task-done-v73\.js\?v=1\.0\.0"><\/script>/);
  assert.match(html,/Yeni mesaj ve tamamlanan görev · panel açıkken başka sekmedeysen/);
});
