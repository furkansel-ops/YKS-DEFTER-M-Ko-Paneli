process.env.TZ="Europe/Istanbul";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {appointmentsIcs}=require("../coach-ics-v72.js");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("v72 .ics: yalnız onaylı ve yaklaşan randevular; saat UTC'ye çevrilir, metin kaçışlanır",()=>{
  const now=new Date("2026-11-13T10:00:00+03:00");
  const {count,text}=appointmentsIcs([
    {id:"a1",status:"confirmed",studentUid:"s1",date:"2026-11-14",time:"18:30",duration:45,topic:"Türev; limit, tekrar",link:"https://meet.example/x"},
    {id:"a2",status:"requested",studentUid:"s1",date:"2026-11-15",time:"10:00"},
    {id:"a3",status:"confirmed",studentUid:"s2",date:"2026-11-12",time:"10:00"},
    {id:"a4",status:"confirmed",studentUid:"s2",date:"2026-11-20",time:"9:00"},
    {id:"a5",status:"confirmed",studentUid:"s2",date:"2026-11-20",time:"09:00",link:"javascript:alert(1)"},
    null
  ],uid=>uid==="s1"?"Ayşe":"",now);
  assert.equal(count,2);
  assert.match(text,/^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/);
  assert.match(text,/UID:a1@yks-koc-paneli\r\nDTSTAMP:20261113T070000Z\r\nDTSTART:20261114T153000Z\r\nDTEND:20261114T161500Z\r\nSUMMARY:Görüşme: Ayşe\r\n/);
  assert.match(text,/DESCRIPTION:Türev\\; limit\\, tekrar\r\nURL:https:\/\/meet\.example\/x\r\n/);
  assert.match(text,/UID:a5@[\s\S]*SUMMARY:Görüşme: Öğrenci\r\nEND:VEVENT/,"https olmayan link yazılmaz");
  assert.doesNotMatch(text,/UID:a[234]@/);
  assert.equal(appointmentsIcs(undefined,null,now).count,0);
});

test("v72 bağlantı: Randevular sayfasında Takvime aktar düğmesi indirme yapar",()=>{
  const html=read("index.html"),app=read("app-reset.js");
  assert.match(html,/id="apptIcsExport"[^>]*>Takvime aktar<\/button>/);
  assert.match(html,/<script defer src="\.\/coach-ics-v72\.js\?v=1\.0\.0"><\/script>/);
  assert.match(app,/YKSCoachIcsV72\?\.appointmentsIcs\(coachAppointments,apptStudentName\)/);
  assert.match(app,/a\.download="randevular-"\+todayIsoLocal\(\)\+"\.ics"/);
});
