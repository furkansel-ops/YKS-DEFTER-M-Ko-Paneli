const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const css=read("coach-video-picker-v89.css");

function fixture(t){
  const dom=new JSDOM(`<div id="coachVideoPickerBackdrop"><div class="coach-video-filters">
    <label><span>Ders</span><select id="coachVideoSubject"><option>Matematik</option><option>Fizik</option></select></label>
    <label><span>Konu</span><select id="coachVideoTopic"><option value="">Tüm konular</option><option>Problemler</option></select></label>
    <label><span>Hoca</span><select id="coachVideoTeacher"><option>Eyüp B.</option><option>&lt;b&gt;3D&lt;/b&gt; Yayınları</option></select></label></div></div>`,{runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  dom.window.eval(read("coach-video-lists-v89.js"));
  return dom.window;
}

test("v89 menüler görünür listeye döner; seçim aynı select'e yazılır ve change gönderilir",t=>{
  const w=fixture(t),doc=w.document,changes=[];
  doc.getElementById("coachVideoTeacher").addEventListener("change",e=>changes.push(e.target.value));
  const subject=doc.getElementById("coachVideoSubjectV89");
  assert.ok(subject.closest("label"),"liste etiketin içinde");
  assert.deepEqual([...subject.querySelectorAll("button")].map(b=>[b.textContent,b.dataset.subject,b.getAttribute("aria-pressed")]),[["Matematik","math","true"],["Fizik","physics","false"]]);
  const teacher=doc.getElementById("coachVideoTeacherV89");
  assert.equal(teacher.querySelector("b"),null,"hoca adı HTML olarak yazılmaz");
  assert.equal(teacher.querySelectorAll("button i")[0].textContent,"EB");
  teacher.querySelectorAll("button")[1].click();
  assert.equal(doc.getElementById("coachVideoTeacher").value,"<b>3D</b> Yayınları");
  assert.deepEqual(changes,["<b>3D</b> Yayınları"]);
  assert.equal(teacher.querySelectorAll("button")[1].getAttribute("aria-pressed"),"true");
});

test("v89 seçenekler yenilenince liste de yenilenir; kapalı menüde liste gizli",async t=>{
  const w=fixture(t),doc=w.document,topic=doc.getElementById("coachVideoTopic");
  topic.innerHTML='<option value="">Tüm konular</option><option>Kümeler</option><option>Olasılık</option>';
  await new Promise(r=>setTimeout(r,0));
  assert.deepEqual([...doc.querySelectorAll("#coachVideoTopicV89 button")].map(b=>b.textContent),["Tüm konular","Kümeler","Olasılık"]);
  topic.disabled=true;await new Promise(r=>setTimeout(r,0));
  assert.equal(doc.getElementById("coachVideoTopicV89").hidden,true);
});

test("v89 bağlantı ve stiller: betik ve stil yüklenir; listeler yalnız Video ekle penceresinde",()=>{
  const html=read("index.html");
  assert.match(html,/<script defer src="\.\/coach-video-lists-v89\.js\?v=1\.0\.0"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\.\/coach-video-picker-v89\.css\?v=1\.0\.0">/);
  assert.match(css,/^\.coach-v89-list\{display:none\}/m);
  assert.deepEqual(css.replace(/var\(--kc-[0-9a-f]{6},#[0-9a-f]{6}\)/g,"").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsl\(/gi)||[],[]);
});
