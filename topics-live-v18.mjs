const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const clean=value=>typeof value==="string"?value.trim():"";
const stageLabels=["Başlanmadı","İşledim","Soru çözdüm","Pekiştirdim"];
const sessions=new WeakMap();

export function syncTopicStudent(host,uid){
  if(sessions.get(host)?.uid!==uid)sessions.delete(host);
}

export function localDateKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function validDateKey(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime())&&localDateKey(date)===value;
}

function searchable(value){
  return String(value??"").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i");
}

export function buildTopicModel(share,todayKey=localDateKey()){
  const available=Array.isArray(share?.topics?.items);
  const raw=available?share.topics.items:[];
  const items=raw.flatMap((item,index)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))return [];
    const subject=clean(item.subject)||clean(item.lesson)||clean(item.ders);
    const topic=clean(item.topic)||clean(item.name)||clean(item.konu);
    const exam=clean(item.exam);
    const course=[exam,subject].filter(Boolean).join(" · ")||"Ders belirtilmemiş";
    const st=(typeof item.st==="number"||typeof item.st==="string"&&item.st.trim()!=="")?Number(item.st):NaN;
    const stage=Number.isInteger(st)&&st>=0&&st<=3?st:null;
    const status=stage===null?"unknown":stage===3?"complete":stage>0?"active":"notstarted";
    const deadline=validDateKey(item.deadline)?item.deadline:"";
    return [{id:String(index),key:clean(item.key),exam,subject,course,topic:topic||"Konu belirtilmemiş",hasName:Boolean(topic),stage,status,
      statusLabel:stage===null?"Durum paylaşılmamış":stageLabels[stage],deadline,invalidDeadline:Boolean(item.deadline)&&!deadline,
      overdue:Boolean(deadline&&deadline<todayKey&&stage!==null&&stage<3)}];
  });
  const courses=[...new Set(items.map(item=>item.course))].sort((a,b)=>a.localeCompare(b,"tr"));
  const complete=items.filter(item=>item.status==="complete").length;
  return {available,items,courses,total:items.length,complete,active:items.filter(item=>item.status==="active").length,
    notstarted:items.filter(item=>item.status==="notstarted").length,unknown:items.filter(item=>item.status==="unknown").length,
    overdue:items.filter(item=>item.overdue).length,courseCount:new Set(items.filter(item=>item.subject).map(item=>item.course)).size,
    completionPct:items.length?Math.round(complete/items.length*100):null,invalidCount:raw.length-items.length};
}

export function filterTopics(items,{query="",subject="",status="all"}={},todayKey=localDateKey()){
  const needle=searchable(query.trim());
  return items.filter(item=>(!subject||item.course===subject)&&(!needle||searchable(`${item.course} ${item.topic}`).includes(needle))&&
    (status==="all"||(status==="overdue"?item.deadline&&item.deadline<todayKey&&item.stage!==null&&item.stage<3:item.status===status)))
    .sort((a,b)=>Number(b.overdue)-Number(a.overdue)||Number(a.status==="complete")-Number(b.status==="complete")||
      (a.deadline||"9999").localeCompare(b.deadline||"9999")||a.course.localeCompare(b.course,"tr")||a.topic.localeCompare(b.topic,"tr"));
}

function metric(label,value,note,tone=""){
  return `<article class="topics-metric ${tone}"><span>${label}</span><b>${value}</b><small>${note}</small></article>`;
}

function dateLabel(value){
  return value?new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"Son tarih yok";
}

function emptyDraft(){return {mode:"",id:"",key:"",label:"",text:"",date:localDateKey()};}

// The host owns one session. Replacing a snapshot keeps the draft; switching students replaces it.
export function renderTopicDashboard(host,entry,{sendAction,friendlyError=error=>error.message}={}){
  const uid=entry?.link?.studentUid||"";
  let session=sessions.get(host);
  if(!session||session.uid!==uid){
    session={uid,filters:{query:"",subject:"",status:"all"},draft:emptyDraft(),pending:false,message:"",error:false};
    sessions.set(host,session);
  }
  const active=host.ownerDocument.activeElement;
  const focus=host.contains(active)&&active.dataset.topicField?{field:active.dataset.topicField,start:active.selectionStart,end:active.selectionEnd}:null;
  const model=buildTopicModel(entry?.share);
  session.model=model;
  if(session.filters.subject&&!model.courses.includes(session.filters.subject))session.filters.subject="";
  const count=value=>model.available?value:"—";
  host.innerHTML=`<section class="topics-dashboard-v18" aria-label="Konu takibi">
    <header class="topics-heading"><div><span class="eyebrow">Konu takibi</span><h2>Konuların durumunu gör, sonraki adımı planla.</h2><p>Öğrencinin paylaştığı konu kayıtları ve bitiş hedefleri.</p></div><span class="pill">Konular v1.8</span></header>
    <div class="topics-metrics">${metric("Paylaşılan konu",count(model.total),"Tüm müfredatın sayısı değildir")}${metric("Tamamlanan",count(model.complete),model.completionPct===null?"Tamamlanma oranı yok":`Paylaşılan konuların %${model.completionPct}'i`,"is-complete")}${metric("Devam eden",count(model.active),"İşledim veya soru çözdüm")}${metric("Geciken",count(model.overdue),"Son tarihi geçen, bitmemiş konular","is-overdue")}${metric("Ders",count(model.courseCount),"Paylaşımda bulunan dersler")}</div>
    <div class="topics-layout"><div class="topics-main">
      <section class="card topics-subjects"><div class="topics-section-heading"><h3>Derslere göre durum</h3><span>Tamamlanan / paylaşılan</span></div><div data-topic-courses></div></section>
      <section class="card topics-list-card"><div class="topics-section-heading"><h3>Konu listesi</h3><span data-topic-result-count role="status" aria-live="polite"></span></div>
        <div class="topics-filters"><label>Konu veya ders ara<input type="search" class="field" data-topic-field="query" maxlength="160" placeholder="Örn. TYT matematik"></label>
          <label>Ders<select class="field" data-topic-field="subject"><option value="">Tüm dersler</option>${model.courses.map(course=>`<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("")}</select></label>
          <label>Durum<select class="field" data-topic-field="status"><option value="all">Tüm durumlar</option><option value="overdue">Geciken</option><option value="active">Devam eden</option><option value="notstarted">Başlanmadı</option><option value="complete">Tamamlanan</option><option value="unknown">Durumu bilinmeyen</option></select></label>
          <button type="button" class="btn" data-topic-clear>Temizle</button></div>
        <div data-topic-list class="topics-list"></div>
        <p class="topics-footnote">Yalnız paylaşılan kayıtlar gösterilir; listede olmayan konular hakkında durum çıkarılmaz. Son çalışma ve tekrar ihtiyacı bu paylaşımda yer almıyor.</p>
      </section></div>
      <aside class="card topics-action-card"><span class="eyebrow">Koç işlemi</span><h3>Bir sonraki adım</h3><div data-topic-composer></div><div data-topic-feedback role="status" aria-live="polite"></div><p class="topics-footnote">Gönderilen hedef ve görevler öğrenci uygulamasında işlendikten sonra paylaşıma yansır.</p></aside>
    </div></section>`;
  const root=host.firstElementChild;
  session.root=root;
  const find=selector=>root.querySelector(selector);
  for(const field of ["query","subject","status"])find(`[data-topic-field="${field}"]`).value=session.filters[field];

  function feedback(){
    const node=find("[data-topic-feedback]");
    node.className=session.message?`status ${session.error?"err":"ok"}`:"";
    node.textContent=session.message;
  }

  function renderCourses(){
    find("[data-topic-courses]").innerHTML=model.courses.length?model.courses.map(course=>{
      const items=model.items.filter(item=>item.course===course),done=items.filter(item=>item.status==="complete").length;
      const overdue=items.filter(item=>item.overdue).length,pct=Math.round(done/items.length*100);
      return `<button type="button" class="topics-course" data-topic-course="${escapeHtml(course)}" aria-pressed="${session.filters.subject===course}"><span><b>${escapeHtml(course)}</b><small>${overdue?`${overdue} geciken`:`${items.filter(item=>item.status==="active").length} devam eden`}</small></span><span class="topics-course-progress"><span>${done} / ${items.length}</span><progress value="${done}" max="${items.length}" aria-label="${escapeHtml(course)} tamamlanma: %${pct}"></progress></span></button>`;
    }).join(""):`<div class="empty">${model.available?"Henüz paylaşılan konu kaydı yok.":"Konu verisi henüz paylaşılmadı."}</div>`;
    find("[data-topic-courses]").querySelectorAll("[data-topic-course]").forEach(button=>button.onclick=()=>{
      session.filters.subject=session.filters.subject===button.dataset.topicCourse?"":button.dataset.topicCourse;
      find('[data-topic-field="subject"]').value=session.filters.subject;
      renderCourses();renderList();
    });
  }

  function renderList(){
    const items=filterTopics(model.items,session.filters);
    find("[data-topic-result-count]").textContent=model.available?`${items.length} / ${model.total} konu`:"Veri bekleniyor";
    find("[data-topic-list]").innerHTML=items.length?items.map(item=>`<article class="topics-item ${item.overdue?"is-overdue":""}" data-topic-id="${item.id}">
      <div class="topics-item-main"><span class="topics-course-name">${escapeHtml(item.course)}</span><h4>${escapeHtml(item.topic)}</h4><div class="topics-item-meta"><span class="topics-stage ${item.status}">${item.statusLabel}${item.stage===null?"":` · ${item.stage}/3 aşama`}</span><span class="topics-deadline ${item.overdue?"is-overdue":""}">${item.overdue?"Gecikti · ":""}${item.invalidDeadline?"Son tarih geçersiz":escapeHtml(dateLabel(item.deadline))}</span></div></div>
      <div class="topics-item-actions"><button type="button" class="btn" data-topic-mode="deadline" ${!item.key?'disabled title="Konu anahtarı paylaşılmamış"':""}>Son tarih</button><button type="button" class="btn" data-topic-mode="review" ${!item.hasName?"disabled":""}>Tekrar görevi</button><button type="button" class="btn" data-topic-mode="program" ${!item.hasName?"disabled":""}>Programa görev</button></div></article>`).join(""):
      `<div class="empty">${!model.available?"Konu verisi henüz paylaşılmadı.":!model.total?"Henüz paylaşılan konu kaydı yok.":"Bu filtrelerle eşleşen konu yok."}</div>`;
    if(model.invalidCount)find("[data-topic-list]").insertAdjacentHTML("beforeend",`<p class="topics-footnote">${model.invalidCount} okunamayan kayıt gösterilemedi.</p>`);
    find("[data-topic-list]").querySelectorAll("[data-topic-mode]").forEach(button=>{
      button.disabled=button.disabled||session.pending;
      button.onclick=()=>{
        if(session.pending)return;
        const item=model.items.find(item=>item.id===button.closest("[data-topic-id]").dataset.topicId);
        const label=`${item.course} · ${item.topic}`,mode=button.dataset.topicMode;
        session.draft={mode,id:item.id,key:item.key,label,text:`${label}${mode==="review"?" konusunu tekrar et.":" konusunu çalış."}`.slice(0,220),date:item.deadline&&mode==="deadline"?item.deadline:localDateKey()};
        session.message="";feedback();renderComposer();
        find(`[data-topic-field="${mode==="deadline"?"date":"text"}"]`)?.focus();
      };
    });
  }

  function renderComposer(){
    const draft=session.draft,container=find("[data-topic-composer]");
    if(!draft.mode){container.innerHTML='<p class="topics-composer-empty">Listeden bir konu seç. Son tarih belirleyebilir veya öğrenciye çalışma ve tekrar görevi gönderebilirsin.</p>';return;}
    const deadline=draft.mode==="deadline",title=deadline?"Konu bitiş hedefi":draft.mode==="review"?"Tekrar görevi":"Program görevi";
    container.innerHTML=`<form class="form" data-topic-action="${deadline?"topic_deadline":"program_task"}"><strong>${title}</strong><p class="topics-selected-label">${escapeHtml(draft.label)}</p>
      ${deadline?"":'<label>Görev<textarea class="field" data-topic-field="text" name="text" maxlength="220" required></textarea></label>'}
      <label>${deadline?"Son tarih":"Görev tarihi"}<input class="field" data-topic-field="date" name="date" type="date" required></label><button type="submit" class="btn primary">${session.pending?"Gönderiliyor…":"Öğrenciye gönder"}</button><button type="button" class="btn" data-topic-cancel>Vazgeç</button></form>`;
    const form=container.querySelector("form");
    for(const field of ["text","date"]){
      const input=form.querySelector(`[data-topic-field="${field}"]`);
      if(input){input.value=draft[field];input.oninput=()=>{draft[field]=input.value;};}
    }
    form.querySelectorAll("input,textarea,button").forEach(node=>node.disabled=session.pending);
    form.querySelector("[data-topic-cancel]").onclick=()=>{session.draft=emptyDraft();session.message="";renderComposer();feedback();};
    form.onsubmit=async event=>{
      event.preventDefault();
      if(session.pending||sessions.get(host)!==session||session.root!==root||!root.isConnected||!host.contains(root))return;
      const current=session.model.items.find(item=>draft.key?item.key===draft.key:item.id===draft.id&&`${item.course} · ${item.topic}`===draft.label);
      if(!current||deadline&&!current.key){session.message="Konu artık paylaşımda bulunmuyor. Listeden yeniden seç.";session.error=true;feedback();return;}
      if(!validDateKey(draft.date)||!deadline&&!draft.text.trim()){
        session.message="Geçerli bir tarih ve görev metni gir.";session.error=true;feedback();return;
      }
      const payload=deadline?{key:current.key,date:draft.date}:{text:draft.text.trim().slice(0,220),date:draft.date};
      session.pending=true;session.message="";session.error=false;feedback();renderComposer();renderList();
      try{
        await sendAction(uid,deadline?"topic_deadline":"program_task",payload);
        session.message="Gönderildi. Öğrenci uygulamasında işlenmesi bekleniyor.";session.error=false;session.draft=emptyDraft();
      }catch(error){session.message=`Gönderilemedi: ${friendlyError(error)||"Lütfen tekrar dene."}`;session.error=true;}
      finally{
        session.pending=false;
        // An old request may finish after navigation or a student switch. Refresh only its current view.
        if(sessions.get(host)===session&&session.root?.isConnected&&host.contains(session.root))session.refresh();
      }
    };
  }

  session.refresh=()=>{feedback();renderComposer();renderList();};
  for(const field of ["query","subject","status"]){
    const node=find(`[data-topic-field="${field}"]`);
    node[field==="query"?"oninput":"onchange"]=()=>{session.filters[field]=node.value;renderCourses();renderList();};
  }
  find("[data-topic-clear]").onclick=()=>{
    session.filters={query:"",subject:"",status:"all"};
    for(const field of ["query","subject","status"])find(`[data-topic-field="${field}"]`).value=session.filters[field];
    renderCourses();renderList();find('[data-topic-field="query"]').focus();
  };
  renderCourses();renderList();renderComposer();feedback();
  if(focus){
    const node=find(`[data-topic-field="${focus.field}"]`);
    node?.focus();
    if(node&&focus.start!==null&&["query","text"].includes(focus.field))node.setSelectionRange(focus.start,focus.end);
  }
}
