(()=>{
  "use strict";

  const VERSION="1.5.0";
  const CONTENT_ID="content";
  const TAB_ID="tabs";
  const SYNC_ID="syncPill";
  const SECTION_NAMES={
    attention:"Dikkat edilmesi gerekenler",
    program:"Programdan son görevler",
    exams:"Son denemeler",
    actions:"Hızlı işlemler"
  };
  const metricMeta={
    "7 gün çalışma":{icon:"⏱",tone:"focus",hint:"Son 7 günlük odak"},
    "7 gün soru":{icon:"✎",tone:"questions",hint:"Son 7 günlük soru"},
    "Son deneme":{icon:"↗",tone:"exam",hint:"En güncel deneme"},
    "Geciken konu":{icon:"!",tone:"warning",hint:"Takip gerektiren konu"}
  };

  const text=node=>String(node?.textContent||"").trim();
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const normalize=value=>String(value||"").replace(/\s+/g," ").trim();

  function isSummaryActive(){
    const tabs=document.getElementById(TAB_ID);
    const active=tabs?.querySelector(".tab.on");
    return normalize(text(active))==="Özet";
  }

  function findCard(host,label){
    return[...host.querySelectorAll(":scope > .grid > .card")].find(card=>normalize(text(card.querySelector("h3"))).includes(label));
  }

  function decorateMetrics(host){
    const cards=[...host.querySelectorAll(":scope > .metrics > .metric")];
    cards.forEach((card,index)=>{
      const labelNode=card.querySelector(":scope > span");
      const valueNode=card.querySelector(":scope > b");
      const noteNode=card.querySelector(":scope > small");
      if(!labelNode||!valueNode)return;
      const label=normalize(text(labelNode));
      const meta=metricMeta[label]||{icon:"•",tone:"neutral",hint:"Canlı öğrenci verisi"};
      card.classList.add("summary-metric");
      card.dataset.tone=meta.tone;
      card.style.setProperty("--metric-delay",`${index*45}ms`);
      if(!card.querySelector(".summary-metric-icon")){
        const icon=document.createElement("span");
        icon.className="summary-metric-icon";
        icon.setAttribute("aria-hidden","true");
        icon.textContent=meta.icon;
        card.prepend(icon);
      }
      labelNode.classList.add("summary-metric-label");
      valueNode.classList.add("summary-metric-value");
      noteNode?.classList.add("summary-metric-note");
      card.title=meta.hint;

      const value=normalize(text(valueNode));
      if(label==="Geciken konu"){
        const count=Number(value.replace(/[^0-9.-]/g,""))||0;
        card.classList.toggle("is-clear",count===0);
        card.classList.toggle("is-alert",count>0);
      }
      if(label==="Son deneme"&&value==="—")card.classList.add("is-empty-value");
    });
  }

  function addSectionHeader(card,eyebrow,description,countText=""){
    if(!card||card.querySelector(":scope > .summary-section-head"))return;
    const old=card.querySelector(":scope > h3");
    if(!old)return;
    const wrap=document.createElement("div");
    wrap.className="summary-section-head";
    const left=document.createElement("div");
    left.innerHTML=`<span class="summary-eyebrow">${esc(eyebrow)}</span><h3>${esc(normalize(text(old)))}</h3><p>${esc(description)}</p>`;
    wrap.append(left);
    if(countText){
      const badge=document.createElement("span");
      badge.className="summary-count";
      badge.textContent=countText;
      wrap.append(badge);
    }
    old.replaceWith(wrap);
  }

  function decorateAttention(card){
    if(!card)return;
    card.classList.add("summary-panel","summary-attention");
    const alerts=[...card.querySelectorAll(":scope > .alert")];
    const empty=card.querySelector(":scope > .empty");
    addSectionHeader(card,"Koç sinyalleri","Öğrencide öncelik verilmesi gereken noktaları tek yerde gösterir.",alerts.length?`${alerts.length} sinyal`:"Temiz");

    alerts.forEach((alert,index)=>{
      alert.classList.add("summary-alert");
      const strong=alert.querySelector("strong");
      const title=normalize(text(strong));
      let icon="!",tone="warn";
      if(title.includes("hata")){icon="×";tone="error"}
      else if(title.includes("net düşüş")){icon="↓";tone="danger"}
      else if(title.includes("Geciken")){icon="⌛";tone="warn"}
      alert.dataset.tone=tone;
      if(!alert.querySelector(".summary-alert-icon")){
        const badge=document.createElement("span");
        badge.className="summary-alert-icon";
        badge.textContent=icon;
        alert.prepend(badge);
      }
      alert.style.setProperty("--alert-delay",`${index*55}ms`);
    });

    if(empty){
      empty.classList.add("summary-empty","summary-empty-ok");
      if(!empty.querySelector(".summary-empty-icon"))empty.innerHTML=`<span class="summary-empty-icon">✓</span><div><b>Kritik uyarı görünmüyor</b><small>${esc(normalize(text(empty))||"Öğrencinin mevcut verilerinde öne çıkan bir risk yok.")}</small></div>`;
    }
  }

  function splitTask(raw){
    const parts=normalize(raw).split(" · ");
    if(parts.length<2)return{meta:"Program",title:normalize(raw)};
    return{meta:parts.shift(),title:parts.join(" · ")};
  }

  function decorateProgram(card){
    if(!card)return;
    card.classList.add("summary-panel","summary-program");
    const rows=[...card.querySelectorAll(":scope > .row")];
    addSectionHeader(card,"Programım","Öğrencinin Programım bölümünden en son planlanan görevler.",rows.length?`${rows.length} görev`:"0 görev");
    rows.forEach(row=>{
      if(row.dataset.summaryRow==="1")return;
      row.dataset.summaryRow="1";
      row.classList.add("summary-row","summary-task-row");
      const left=row.querySelector(":scope > span"),right=row.querySelector(":scope > b");
      const data=splitTask(text(left));
      const done=normalize(text(right)).includes("✓");
      if(left)left.innerHTML=`<small class="summary-row-meta">${esc(data.meta)}</small><strong>${esc(data.title||"Görev")}</strong>`;
      if(right){right.className=`summary-state ${done?"done":"pending"}`;right.textContent=done?"Tamamlandı":"Bekliyor"}
    });
    const empty=card.querySelector(":scope > .empty");
    if(empty){empty.classList.add("summary-empty");empty.innerHTML='<span class="summary-empty-icon">＋</span><div><b>Henüz program görevi yok</b><small>Öğrenci Programım bölümünü doldurduğunda son görevler burada görünür.</small></div>'}
  }

  function parseExam(raw){
    const parts=normalize(raw).split(" · ");
    return{date:parts.length>1?parts.shift():"",name:parts.join(" · ")||normalize(raw)};
  }

  function decorateExams(card){
    if(!card)return;
    card.classList.add("summary-panel","summary-exams");
    const rows=[...card.querySelectorAll(":scope > .row")];
    addSectionHeader(card,"Deneme takibi","Son denemeleri ve netlerini hızlı karşılaştır.",rows.length?`${rows.length} kayıt`:"0 kayıt");
    rows.forEach(row=>{
      if(row.dataset.summaryRow==="1")return;
      row.dataset.summaryRow="1";
      row.classList.add("summary-row","summary-exam-row");
      const left=row.querySelector(":scope > span"),right=row.querySelector(":scope > b");
      const data=parseExam(text(left));
      if(left)left.innerHTML=`${data.date?`<small class="summary-row-meta">${esc(data.date)}</small>`:""}<strong>${esc(data.name||"Deneme")}</strong>`;
      if(right){right.classList.add("summary-net");const n=Number(normalize(text(right)).replace(",",".").replace(/[^0-9.-]/g,""));if(Number.isFinite(n))right.dataset.level=n>=80?"high":n>=50?"mid":"base"}
    });
    const empty=card.querySelector(":scope > .empty");
    if(empty){empty.classList.add("summary-empty");empty.innerHTML='<span class="summary-empty-icon">↗</span><div><b>Henüz deneme kaydı yok</b><small>İlk deneme eklendiğinde net özeti burada otomatik oluşur.</small></div>'}
  }

  function clickTab(label){
    const button=[...(document.getElementById(TAB_ID)?.querySelectorAll(".tab")||[])].find(item=>normalize(text(item))===label);
    button?.click();
  }

  function decorateActions(card){
    if(!card)return;
    card.classList.add("summary-panel","summary-actions");
    addSectionHeader(card,"Koç araçları","Öğrenciye görev veya not gönder; ayrıntılı bölümlere tek tıkla geç.");
    const forms=[...card.querySelectorAll(":scope > .form")];
    forms.forEach((form,index)=>{
      form.classList.add("summary-action-form");
      if(form.querySelector(".summary-form-label"))return;
      const label=document.createElement("div");
      label.className="summary-form-label";
      label.innerHTML=index===0?'<span>01</span><div><b>Programa görev ekle</b><small>Görev öğrencinin Programım akışına gider.</small></div>':'<span>02</span><div><b>Koç notu gönder</b><small>Öğrenci için kısa yönlendirme bırak.</small></div>';
      form.prepend(label);
    });
    if(!card.querySelector(":scope > .summary-shortcuts")){
      const nav=document.createElement("div");
      nav.className="summary-shortcuts";
      nav.innerHTML='<button type="button" data-summary-tab="Program">Programı aç <span>→</span></button><button type="button" data-summary-tab="Deneme">Denemeleri aç <span>→</span></button><button type="button" data-summary-tab="Konular">Konulara git <span>→</span></button>';
      card.append(nav);
      nav.querySelectorAll("[data-summary-tab]").forEach(button=>button.addEventListener("click",()=>clickTab(button.dataset.summaryTab)));
    }
  }

  function addOverviewStrip(host){
    if(host.querySelector(":scope > .summary-overview-strip"))return;
    const strip=document.createElement("section");
    strip.className="summary-overview-strip";
    const sync=normalize(text(document.getElementById(SYNC_ID)))||"Canlı eşitleme açık";
    strip.innerHTML=`<div><span class="summary-live-dot"></span><div><b>Canlı öğrenci özeti</b><small>Program, deneme, ilerleme ve konu verileri tek ekranda.</small></div></div><span class="summary-sync-copy">${esc(sync)}</span>`;
    host.prepend(strip);
  }

  function enhance(){
    const host=document.getElementById(CONTENT_ID);
    if(!host||!isSummaryActive())return;
    const metrics=host.querySelector(":scope > .metrics");
    const grid=host.querySelector(":scope > .grid");
    if(!metrics||!grid)return;
    if(host.dataset.summaryV15==="working")return;
    host.dataset.summaryV15="working";
    host.classList.add("summary-dashboard-v15");
    addOverviewStrip(host);
    decorateMetrics(host);
    decorateAttention(findCard(host,SECTION_NAMES.attention));
    decorateProgram(findCard(host,SECTION_NAMES.program));
    decorateExams(findCard(host,SECTION_NAMES.exams));
    decorateActions(findCard(host,SECTION_NAMES.actions));
    host.dataset.summaryV15=VERSION;
  }

  let queued=false;
  function queueEnhance(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;enhance()});
  }

  const observer=new MutationObserver(queueEnhance);
  function start(){
    const content=document.getElementById(CONTENT_ID),tabs=document.getElementById(TAB_ID),sync=document.getElementById(SYNC_ID);
    if(content)observer.observe(content,{childList:true,subtree:true});
    if(tabs)observer.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    if(sync)observer.observe(sync,{childList:true,subtree:true,characterData:true});
    queueEnhance();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.__YKS_COACH_SUMMARY_V15__={version:VERSION,refresh:queueEnhance};
})();