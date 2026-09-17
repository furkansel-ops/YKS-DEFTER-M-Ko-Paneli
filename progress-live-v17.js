(()=>{
  "use strict";

  const VERSION="1.7.0";
  const CONTENT_ID="content";
  const TAB_ID="tabs";
  const normalize=value=>String(value??"").replace(/\s+/g," ").trim();
  const text=node=>normalize(node?.textContent||"");
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const fmt=value=>Number.isFinite(value)?value.toFixed(1):"—";

  function isProgressActive(){
    const active=document.getElementById(TAB_ID)?.querySelector(".tab.on");
    return text(active)==="İlerleme";
  }

  function parseNumber(value){
    const n=Number(normalize(value).replace(",",".").replace(/[^0-9.-]/g,""));
    return Number.isFinite(n)?n:null;
  }

  function metricMap(host){
    const map=new Map();
    [...host.querySelectorAll(":scope > .metrics > .metric")].forEach(card=>{
      const label=text(card.querySelector(":scope > span"));
      map.set(label,{card,label,value:text(card.querySelector(":scope > b")),note:text(card.querySelector(":scope > small"))});
    });
    return map;
  }

  function summaryMap(host){
    const map=new Map();
    const card=[...host.querySelectorAll(":scope > .card")].find(item=>text(item.querySelector("h3")).includes("İlerleme özeti"));
    [...card?.querySelectorAll(":scope > .row")||[]].forEach(row=>{
      map.set(text(row.querySelector(":scope > span")),parseNumber(text(row.querySelector(":scope > b")))??0);
    });
    return{card,map};
  }

  function parseTopic(value){
    const match=normalize(value).match(/(\d+)\s*\/\s*(\d+)/);
    return match?{complete:Number(match[1]),total:Number(match[2])}:{complete:0,total:0};
  }

  function parseDelta(note){
    if(!note||note.includes("Karşılaştırma yok"))return null;
    return parseNumber(note);
  }

  function buildNetTrend(latest,delta){
    if(latest===null||delta===null){
      return'<div class="progress-empty-chart"><span>↗</span><div><b>Net karşılaştırması için veri bekleniyor</b><small>En az iki deneme olduğunda son değişim burada grafikleşir.</small></div></div>';
    }
    const previous=latest-delta;
    const min=Math.min(previous,latest),max=Math.max(previous,latest),range=Math.max(1,max-min);
    const width=560,height=150,pad=28;
    const y=value=>height-pad-((value-min)/range)*(height-pad*2);
    const y1=y(previous),y2=y(latest);
    const tone=delta>0?"up":delta<0?"down":"flat";
    return`<div class="progress-chart-head"><div><span class="progress-eyebrow">Net değişimi</span><b>Son iki deneme</b></div><span class="progress-delta ${tone}">${delta>0?"+":""}${fmt(delta)} net</span></div><div class="progress-chart-wrap"><svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Son iki deneme net değişimi"><line class="axis" x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}"></line><polyline points="${pad},${y1.toFixed(1)} ${width-pad},${y2.toFixed(1)}"></polyline><circle cx="${pad}" cy="${y1.toFixed(1)}" r="5"><title>Önceki deneme · ${fmt(previous)} net</title></circle><circle cx="${width-pad}" cy="${y2.toFixed(1)}" r="5"><title>Son deneme · ${fmt(latest)} net</title></circle></svg><div class="progress-chart-labels"><span><small>Önceki</small><b>${fmt(previous)}</b></span><span><small>Son</small><b>${fmt(latest)}</b></span></div></div>`;
  }

  function insight(label,value,note,tone="neutral"){
    return`<article class="progress-insight" data-tone="${esc(tone)}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></article>`;
  }

  function buildSignals({overdue,examCount,delta,hours,questions}){
    const signals=[];
    if(overdue>0)signals.push({tone:"warn",icon:"⌛",title:`${overdue} geciken konu`,note:"Konu hedefleri tarafında takip gerekiyor."});
    if(delta!==null&&delta<0)signals.push({tone:"down",icon:"↓",title:`Son deneme ${fmt(Math.abs(delta))} net düştü`,note:"Deneme ve Hata Defteri birlikte incelenebilir."});
    if(delta!==null&&delta>0)signals.push({tone:"up",icon:"↗",title:`Son deneme +${fmt(delta)} net arttı`,note:"Güncel deneme önceki kaydın üzerinde."});
    if(examCount===0)signals.push({tone:"neutral",icon:"◎",title:"Henüz deneme verisi yok",note:"İlk deneme eklendiğinde değişim analizi başlayacak."});
    if(hours===0&&questions===0)signals.push({tone:"warn",icon:"!",title:"Son 7 günde kayıt görünmüyor",note:"Çalışma süresi ve soru verisi henüz oluşmamış."});
    if(!signals.length)signals.push({tone:"clear",icon:"✓",title:"Belirgin takip sinyali yok",note:"Mevcut ilerleme verilerinde öne çıkan uyarı görünmüyor."});
    return signals.map(item=>`<div class="progress-signal" data-tone="${item.tone}"><span>${item.icon}</span><div><b>${esc(item.title)}</b><small>${esc(item.note)}</small></div></div>`).join("");
  }

  function decorateOriginalMetrics(host){
    const icons={"7 gün çalışma":"⏱","7 gün soru":"✎","Son net":"↗","Konu ilerleme":"✓"};
    [...host.querySelectorAll(":scope > .metrics > .metric")].forEach((card,index)=>{
      card.classList.add("progress-original-metric");
      card.style.setProperty("--progress-delay",`${index*45}ms`);
      const label=card.querySelector(":scope > span");
      if(label&&!card.querySelector(":scope > .progress-metric-icon")){
        const icon=document.createElement("i");
        icon.className="progress-metric-icon";
        icon.textContent=icons[text(label)]||"•";
        card.prepend(icon);
      }
    });
  }

  function decorateSummary(card){
    if(!card)return;
    card.classList.add("progress-summary-card");
    const title=card.querySelector(":scope > h3");
    if(title&&!card.querySelector(":scope > .progress-section-head")){
      const head=document.createElement("div");
      head.className="progress-section-head";
      head.innerHTML='<div><span class="progress-eyebrow">Konu ve deneme durumu</span><h3>İlerleme özeti</h3><p>Tamamlanan, aktif ve geciken kayıtları tek yerde karşılaştır.</p></div>';
      title.replaceWith(head);
    }
    const rowMeta={"Tamamlanan konu":"✓","Aktif konu":"→","Geciken konu":"⌛","Kayıtlı deneme":"◎"};
    [...card.querySelectorAll(":scope > .row")].forEach(row=>{
      row.classList.add("progress-summary-row");
      const label=row.querySelector(":scope > span");
      if(label&&!row.querySelector(":scope > .progress-row-icon")){
        const icon=document.createElement("i");icon.className="progress-row-icon";icon.textContent=rowMeta[text(label)]||"•";row.prepend(icon);
      }
    });
  }

  function clickTab(label){
    const button=[...(document.getElementById(TAB_ID)?.querySelectorAll(".tab")||[])].find(item=>text(item)===label);
    button?.click();
  }

  function buildDashboard(host){
    const metrics=metricMap(host),summary=summaryMap(host);
    const work=metrics.get("7 gün çalışma"),question=metrics.get("7 gün soru"),net=metrics.get("Son net"),topic=metrics.get("Konu ilerleme");
    if(!work||!question||!net||!topic||!summary.card)return;

    const hours=parseNumber(work.value)??0;
    const questions=parseNumber(question.value)??0;
    const latestNet=net.value==="—"?null:parseNumber(net.value);
    const delta=parseDelta(net.note);
    const topicInfo=parseTopic(topic.value);
    const completed=summary.map.get("Tamamlanan konu")??topicInfo.complete;
    const active=summary.map.get("Aktif konu")??0;
    const overdue=summary.map.get("Geciken konu")??0;
    const examCount=summary.map.get("Kayıtlı deneme")??0;
    const total=Math.max(topicInfo.total,completed+active);
    const remaining=Math.max(0,total-completed-active);
    const completionPct=total?Math.round(completed/total*100):0;
    const activePct=total?Math.round(active/total*100):0;
    const remainingPct=Math.max(0,100-completionPct-activePct);

    const dash=document.createElement("section");
    dash.className="progress-dashboard-head";
    dash.innerHTML=`<div class="progress-live-strip"><div><span class="progress-live-dot"></span><div><b>Canlı ilerleme analizi</b><small>YKS Defterim’deki çalışma, soru, deneme ve konu verileri birlikte okunuyor.</small></div></div><span class="progress-version">İlerleme v${VERSION}</span></div>
      <div class="progress-insights">${insight("Günlük çalışma ort.",`${fmt(hours/7)} sa`,`7 günde ${fmt(hours)} saat`,"focus")}${insight("Günlük soru ort.",`${Math.round(questions/7)} soru`,`7 günde ${Math.round(questions)} soru`,"questions")}${insight("Konu tamamlanma",`%${completionPct}`,`${completed}/${total||0} konu tamamlandı`,"topics")}${insight("Son net değişimi",delta===null?"—":`${delta>0?"+":""}${fmt(delta)}`,latestNet===null?"Deneme verisi bekleniyor":`${fmt(latestNet)} son net`,delta===null?"neutral":delta>=0?"positive":"negative")}</div>
      <div class="progress-analysis-grid"><section class="progress-panel progress-net-panel">${buildNetTrend(latestNet,delta)}</section><section class="progress-panel progress-topic-panel"><div class="progress-panel-head"><div><span class="progress-eyebrow">Konu ilerlemesi</span><b>${total?`%${completionPct} tamamlandı`:"Veri bekleniyor"}</b></div><span>${overdue} geciken</span></div><div class="progress-topic-bar" role="img" aria-label="Konu ilerleme dağılımı"><span class="done" style="width:${completionPct}%"></span><span class="active" style="width:${activePct}%"></span><span class="remaining" style="width:${remainingPct}%"></span></div><div class="progress-topic-legend"><span><i class="done"></i>Tamamlanan <b>${completed}</b></span><span><i class="active"></i>Aktif <b>${active}</b></span><span><i class="remaining"></i>Başlanmayan <b>${remaining}</b></span></div></section></div>
      <div class="progress-lower-grid"><section class="progress-panel progress-signals"><div class="progress-panel-head"><div><span class="progress-eyebrow">Koç sinyalleri</span><b>Takip özeti</b></div></div>${buildSignals({overdue,examCount,delta,hours,questions})}</section><section class="progress-panel progress-shortcuts"><div class="progress-panel-head"><div><span class="progress-eyebrow">Hızlı geçiş</span><b>Ayrıntıya in</b></div></div><button type="button" data-progress-tab="Deneme">Deneme analizini aç <span>→</span></button><button type="button" data-progress-tab="Konular">Konuları aç <span>→</span></button><button type="button" data-progress-tab="Program">Programı aç <span>→</span></button></section></div>`;
    host.prepend(dash);
    dash.querySelectorAll("[data-progress-tab]").forEach(button=>button.addEventListener("click",()=>clickTab(button.dataset.progressTab)));
  }

  function enhance(){
    const host=document.getElementById(CONTENT_ID);
    if(!host||!isProgressActive())return;
    if(host.querySelector(":scope > .progress-dashboard-head"))return;
    const metrics=host.querySelector(":scope > .metrics"),summary=[...host.querySelectorAll(":scope > .card")].find(card=>text(card.querySelector("h3")).includes("İlerleme özeti"));
    if(!metrics||!summary)return;
    host.classList.add("progress-dashboard-v17");
    decorateOriginalMetrics(host);
    decorateSummary(summary);
    buildDashboard(host);
    host.dataset.progressV17=VERSION;
  }

  let queued=false;
  function queue(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;enhance()});
  }

  const observer=new MutationObserver(queue);
  function start(){
    const content=document.getElementById(CONTENT_ID),tabs=document.getElementById(TAB_ID);
    if(content)observer.observe(content,{childList:true,subtree:true});
    if(tabs)observer.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    queue();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.__YKS_COACH_PROGRESS_V17__={version:VERSION,refresh:queue};
})();