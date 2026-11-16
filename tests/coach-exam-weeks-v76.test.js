const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {addDays,mondayOf,examWeeks,examWeeksHtml,planPayload}=require("../coach-exam-weeks-v76.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TODAY="2026-11-18";// Çarşamba

test("v76 haftalar Pazartesi başlar; plan ve sonuç kendi haftasında, sonucu girilen plan tekrar görünmez",()=>{
  assert.equal(mondayOf(TODAY),"2026-11-16");assert.equal(mondayOf("2026-11-22"),"2026-11-16");assert.equal(mondayOf("2026-11-16"),"2026-11-16");
  const share={
    exams:[{date:"2026-11-15",type:"TYT",name:"A",totalNet:70},{date:"2026-11-10",type:"tyt",name:"B",totalNet:60.5},{date:"2025-01-01",totalNet:1}],
    progress:{examPlans:[{date:"2026-11-15",type:"TYT",name:"A"},{date:"2026-11-14",type:"AYT",name:"Kaçan"},{date:"2026-11-21",type:"TYT",name:"<i>Sıradaki</i>"},{date:"bozuk"}]}
  };
  const weeks=examWeeks(share,TODAY);
  assert.equal(weeks.length,9);assert.equal(weeks[4].start,"2026-11-16");assert.equal(weeks[4].offset,0);
  const last=weeks[3];
  assert.deepEqual(last.exams.map(e=>e.name),["B","A"]);
  assert.deepEqual(last.plans.map(p=>[p.name,p.missed]),[["Kaçan",true]],"sonucu girilen A planı düşer; girilmeyen geçmiş plan işaretlenir");
  assert.deepEqual(weeks[4].plans.map(p=>[p.name,p.missed]),[["<i>Sıradaki</i>",false]]);
  assert.equal(examWeeks({},TODAY).every(w=>!w.plans.length&&!w.exams.length),true);
  const html=examWeeksHtml(weeks,{esc});
  assert.match(html,/16–22 Kas<\/b><small>Bu hafta · 1 planlı/);
  assert.match(html,/9–15 Kas<\/b><small>Geçen hafta · 2 sonuç · ort\. 65,25 net · 1 planlı/);
  assert.match(html,/&lt;i&gt;Sıradaki&lt;\/i&gt;/);assert.doesNotMatch(html,/<i>Sıradaki/);
  assert.match(html,/<li class="miss">.*Sonuç girilmedi/);
  assert.match(html,/<small>Cmt 21 Kas<\/small><\/span><em>Planlı<\/em>/);
  assert.equal(addDays("2026-12-28",7),"2027-01-04");
});

test("v76 koçun planı doğrulanır ve kural değişmeden coach_note/exam_plan_add olarak gider",()=>{
  assert.deepEqual(planPayload({date:"2026-11-21",type:"TYT",name:"  3D TYT-4 "},TODAY),{payload:{operation:"exam_plan_add",text:"Deneme planı · 3D TYT-4 · Cmt 21 Kas",date:"2026-11-21",type:"TYT",name:"3D TYT-4"}});
  assert.equal(planPayload({date:"2026-11-21",type:"BRANS"},TODAY).payload.name,"Branş denemesi");
  assert.match(planPayload({date:"2026-11-17",type:"TYT"},TODAY).error,/ileri/);
  assert.match(planPayload({date:"2026-02-30",type:"TYT"},TODAY).error,/tarih/);
  assert.match(planPayload({date:"2026-11-21",type:"XX"},TODAY).error,/tür/);
  const app=read("app-reset.js");
  assert.match(app,/addDoc\(collection\(db,"coachingActions"\),\{studentUid:row\.studentUid,coachUid:user\.uid,type:"coach_note",payload:result\.payload,status:"pending",createdAt:serverTimestamp\(\),updatedAt:serverTimestamp\(\)\}\)/);
  assert.match(app,/function renderExamAnalysis\(scope\)\{\n  try\{renderExamWeeks\(/);
  assert.match(app,/api\.examWeeksHtml\(api\.examWeeks\(row\.share,today\),\{esc:escHtml\}\)/);
});

test("v76 kart, stil ve betik yüklenir; ham renk yok",()=>{
  const html=read("index.html");
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-exam-weeks-v76\.css\?v=1\.0\.0">/);
  assert.match(html,/<script defer src="\.\/coach-exam-weeks-v76\.js\?v=1\.0\.0"><\/script>/);
  assert.match(html,/<article class="exam-card coach-v76-card hidden" id="examWeeksCard">/);
  for(const id of ["examPlanDate","examPlanType","examPlanName","examPlanAdd","examPlanStatus","examWeeksList"])assert.ok(html.includes('id="'+id+'"'),id);
  assert.doesNotMatch(read("coach-exam-weeks-v76.css"),/#[0-9a-f]{3,8}\b|rgb\(/i,"ham renk yok");
});
