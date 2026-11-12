const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const load=async()=>require("../coach-exam-tasks-v70.js");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

const share={
  exams:[
    {id:"1",type:"TYT",name:"Eski TYT",date:"2026-10-01",subjectResults:[{name:"Matematik",net:20,y:3},{name:"Fizik",net:5,y:1}]},
    {id:"2",type:"TYT",name:"Özdebir TYT-4",date:"2026-11-01",subjectResults:[{name:"Matematik",net:15,y:6},{name:"Fizik",net:5,y:1},{name:"Türkçe",net:30,y:0}]}
  ],
  errorJournal:[
    {subject:"Fizik",topic:"Kuvvet",n:2,exam:"2"},{subject:"Fizik",topic:"Kuvvet",n:1,exam:"2"},
    {subject:"Kimya",topic:"Mol",exam:"2"},{subject:"Fizik",topic:"Optik",n:5,exam:"1"}
  ]
};

test("v70 öneriler: son denemenin Hata Defteri konuları önce, sonra ders yanlışı ve net düşüşü",async()=>{
  const {examTaskSuggestions}=await load(),r=examTaskSuggestions(share);
  assert.equal(r.exam.id,"2");assert.equal(r.exam.name,"Özdebir TYT-4");
  assert.deepEqual(r.items.map(x=>[x.kind,x.subject,x.topic,x.wrong]),[["topic","Fizik","Kuvvet",3],["topic","Kimya","Mol",1],["subject","Matematik","",6]]);
  assert.equal(r.items[2].drop,5,"aynı türdeki önceki denemeye göre net düşüşü");
  assert.match(r.items[0].text,/^Kuvvet: konu tekrarı/);assert.ok(!r.items.some(x=>x.topic==="Optik"),"eski denemenin yanlışı karışmaz");
});

test("v70 öneriler: bozuk ya da boş veride çökmez; yanlışsız denemede öneri yok",async()=>{
  const {examTaskSuggestions}=await load();
  for(const bad of [undefined,null,{},{exams:"x"},{exams:[null,1,"a"]}])assert.deepEqual(examTaskSuggestions(bad).items,[]);
  assert.deepEqual(examTaskSuggestions({exams:[{id:"9",date:"2026-11-02",subjectResults:[{name:"Türkçe",net:35,y:0}]}]}).items,[]);
});

test("v70 HTML: öğrenci metinleri kaçırılır; gönderilen öneri form yerine ✓ gösterir",async()=>{
  const {examTaskSuggestions,examTasksHtml}=await load();
  const evil={exams:[{id:"3",name:'<img src=x onerror=alert(1)>',date:"2026-11-03"}],errorJournal:[{subject:"Fizik",topic:'"><script>x</script>',exam:"3"}]};
  const r=examTaskSuggestions(evil),html=examTasksHtml(r,{esc,minDate:"2026-11-12",date:"2026-11-13"});
  assert.doesNotMatch(html,/<img|<script/);assert.match(html,/data-exam-task-send/);
  const done=examTasksHtml(r,{esc,minDate:"2026-11-12",date:"2026-11-13",sent:new Set([r.items[0].key])});
  assert.match(done,/Gönderildi ✓/);assert.doesNotMatch(done,/data-exam-task-send/);
});

test("v70 bağlantı: rapor deneme kartı önerileri çizer, post_exam_task gönderir; dosyalar yüklü",()=>{
  const js=read("app-reset.js"),html=read("index.html");
  assert.match(html,/<script defer src="\.\/coach-exam-tasks-v70\.js\?v=1\.0\.0"><\/script><script defer src="\.\/program-videos-v1\.js/);
  assert.match(js,/api=window\.YKSExamTasksV70/);
  assert.match(js,/Henüz deneme verisi yok\.<\/div>';\s*renderExamTasks\(row\);/);
  assert.match(js,/type:"post_exam_task",payload:\{text:value,date,exam:result\.exam\.name\},status:"pending"/);
  assert.match(js,/date<todayIsoLocal\(\)\)return fail/);
  assert.match(html,/id="reportExamList"><\/div>\s*<div id="reportExamTasks"><\/div>/);
  assert.match(html,/coach-exam-tasks-v70\.css\?v=1\.0\.0/);
});
