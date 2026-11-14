const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {addDays,weekSummary,weeklyRows,minutesChange,weeklyHtml}=require("../coach-weekly-v74.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

const collect=(program,week,day)=>(week?.data?.r||[]).map((row,i)=>({id:"r-"+i+"-"+day,text:row[day]||""})).filter(t=>t.text);
const THIS="2026-11-16",LAST="2026-11-09",PREV="2026-11-02";
const share={
  progress:{daily31:[{date:"2026-11-08",minutes:999,questions:9},{date:"2026-11-09",minutes:90,questions:40},{date:"2026-11-15",minutes:30,questions:10},{date:"2026-11-16",minutes:500},{date:"2026-11-03",minutes:60,questions:5}]},
  exams:[{date:"2026-11-12",totalNet:60.5},{date:"2026-11-14",totalNet:70},{date:"2026-11-01",totalNet:10}],
  errorJournal:[{date:"2026-11-12",n:3},{date:"2026-11-13"},{date:"2026-11-20",n:9}],
  program:{weeks:[{week:LAST,data:{r:[["A","B"],["C"]],dn:{"r-0-0":true},done:{1:true}}}]}
};

test("v74: geçen hafta sınırları, toplamlar ve görev uyumu",()=>{
  assert.equal(addDays(THIS,-7),LAST);assert.equal(addDays("2026-01-05",-7),"2025-12-29");
  assert.deepEqual(weekSummary(share,LAST,collect),{minutes:120,questions:50,exams:2,avgNet:65.25,wrongs:4,tasksDone:2,tasksTotal:3,hasDays:true});
  const prev=weekSummary(share,PREV,collect);
  assert.equal(prev.minutes,1059);assert.equal(prev.tasksTotal,0);
  assert.deepEqual(weekSummary({},LAST,collect),{minutes:0,questions:0,exams:0,avgNet:0,wrongs:0,tasksDone:0,tasksTotal:0,hasDays:false});
});

test("v74: süre farkı, sıralama ve güvenli HTML",()=>{
  assert.equal(minutesChange({minutes:120},{minutes:100,hasDays:true}),20);
  assert.equal(minutesChange({minutes:50},{minutes:100,hasDays:true}),-50);
  assert.equal(minutesChange({minutes:50},{minutes:0,hasDays:false}),null);
  const rows=[{studentUid:"a",share,name:"<b>Ali</b>"},{studentUid:"b",share:{progress:{daily31:[]}},name:"Ayşe"},{studentUid:"c",share:null}];
  const items=weeklyRows(rows,THIS,collect);
  assert.deepEqual(items.map(x=>x.row.studentUid),["b","a"],"en az çalışan üstte; paylaşımı olmayan yok");
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const html=weeklyHtml(items,{esc,name:r=>r.name,fmtMinutes:m=>m+" dk"});
  assert.match(html,/&lt;b&gt;Ali&lt;\/b&gt;/);assert.doesNotMatch(html,/<b><b>/);
  assert.match(html,/2\/3 görev · 50 soru · 2 deneme · ort\. 65,25 net · 4 yanlış kaydı/);
  assert.match(html,/▼ %89/,"1059 dk'dan 120 dk'ya düşüş");
  assert.match(weeklyHtml([],{esc,name:String,fmtMinutes:String}),/coach-v74-empty/);
});

test("v74 bağlantı: pano kartı, stil, betik ve canlı yenileme",()=>{
  const app=read("app-reset.js"),html=read("index.html");
  assert.match(html,/<section class="dash-panel coach-v74-week"[^>]*>[\s\S]*?id="dashboardWeek"/);
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-weekly-v74\.css\?v=1\.0\.0">/);
  assert.match(html,/<script defer src="\.\/coach-weekly-v74\.js\?v=1\.0\.0"><\/script>/);
  assert.match(app,/renderCoachTodo\(\);\n  renderDashboardWeek\(\);/);
  assert.match(app,/dashboardStudentOpen\(button\.dataset\.v74Student\)/);
  assert.doesNotMatch(read("coach-weekly-v74.css"),/#[0-9a-f]{3,8}\b|rgb\(/i,"ham renk yok");
});
