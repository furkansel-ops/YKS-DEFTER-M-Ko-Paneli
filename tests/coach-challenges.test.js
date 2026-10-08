"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),{pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const url=pathToFileURL(path.join(root,"coach-challenge-core.mjs")).href;
test("koç haftası ve üç ödüllü görev kimliği sabitlenir",async()=>{
 const c=await import(url);
 assert.equal(c.mondayOf("2026-10-08"),"2026-10-05");
 const uid="studentABC",coach="coachXYZ",week="2026-10-05";
 const rows=[{studentUid:uid,coachUid:coach,weekStart:week,slot:"0",xp:35},
   {studentUid:uid,coachUid:coach,weekStart:week,slot:"1",xp:50}];
 assert.equal(c.availableRewardSlot(rows,uid,coach,week),"2");
 assert.equal(c.availableRewardSlot([...rows,{...rows[0],slot:"2"}],uid,coach,week),null);
 assert.equal(c.challengeId(uid,coach,week,"2"),"studentABC_2026-10-05_2");
 assert.equal(c.challengeId(uid,coach,week,"free-12345678"),"studentABC_coachXYZ_2026-10-05_free-12345678");
 assert.throws(()=>c.challengeId(uid,coach,week,"5"),/bölümü/);
 assert.throws(()=>c.challengeId(uid,coach,"2026-10-32","0"),/Tarih/);
});
test("koç görevleri ilk gün/son gün, ölçülebilir hedef ve onay doğrulaması",async()=>{
 const c=await import(url),now=new Date("2026-10-08T12:00:00+03:00");
 const base={title:"Fizik çalışma",subject:"TYT|Fizik",note:"Hareket",kind:"both",
   difficulty:"hard",goalMinutes:90,goalQuestions:40,startDay:"2026-10-09",dueDay:"2026-10-12"};
 const draft=c.validateChallengeInput(base,now);
 assert.equal(draft.weekStart,"2026-10-05");
 assert.equal(draft.goalMinutes,90);assert.equal(draft.goalQuestions,40);
 assert.throws(()=>c.validateChallengeInput({...base,startDay:"2026-10-08"},now),/yarın/);
 assert.throws(()=>c.validateChallengeInput({...base,dueDay:"2026-10-07"},now),/Son tarih/);
 assert.throws(()=>c.validateChallengeInput({...base,goalMinutes:0},now),/Süre/);
 assert.deepEqual(c.validateChallengeInput({...base,kind:"manual"},now).goalMinutes,0);
 assert.equal(c.nextState("manual","submitted","approve"),"approved");
 assert.equal(c.nextState("minutes","assigned","cancel"),"cancelled");
 assert.throws(()=>c.nextState("manual","assigned","approve"),/izin/);
 assert.throws(()=>c.nextState("minutes","completed","cancel"),/izin/);
});
test("koç paneli yeni modül ve öğrenci olay bağlantılarını içerir",()=>{
 const html=read("index.html"),app=read("app-reset.js"),module=read("coach-challenges.mjs");
 assert.match(html,/data-coach-page="challenges"/);
 assert.match(html,/id="challengesPage"/);
 assert.match(html,/id="cgForm"/);
 assert.match(html,/coach-challenges\.mjs/);
 assert.match(app,/YKSCoachChallengeContext/);
 assert.match(app,/yks:coach-challenges-students/);
 assert.match(module,/where\("studentUid","==",studentUid\)/);
 assert.match(module,/status==="approved"/);
 assert.match(module,/runTransaction\(db/);
 assert.match(module,/transaction\.set\(refs\[open\]/);
});
