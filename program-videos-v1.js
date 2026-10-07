(function(){
  "use strict";

  const ROOT_ID="programVideoLibrary";
  const MEDIA_REPO_PATH="/YKS-DEFTER-M-/";
  const MEDIA_FALLBACK_BASE="https://furkansel-ops.github.io/YKS-DEFTER-M-/";
  let feedCache=null;
  let feedBase="";
  const teacherArchiveCache=new Map();
  const CATEGORIES={
    all:{label:"Tümü",term:""},
    konu:{label:"Konu",term:"konu anlatımı"},
    kamp:{label:"Kamp",term:"kamp"},
    soru:{label:"Soru",term:"soru çözümü"},
    deneme:{label:"Deneme",term:"deneme çözümü"},
    tekrar:{label:"Tekrar",term:"genel tekrar"}
  };
  const SUBJECTS=["Matematik","Geometri","Türkçe","Edebiyat","Fizik","Kimya","Biyoloji","Tarih","Coğrafya","Felsefe","Din Kültürü"];
  const TEACHERS=[
    {n:"MatMan",d:["Matematik","Matematik (AYT)"],id:"UCi3OrIf5uqtIdR7tX9ZZyVA"},
    {n:"Bıyıklı Matematik",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCxHSLxJcuZ8SpF5zgJeQ8Cg"},
    {n:"Rehber Matematik",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCzxj9SKkLuDhdxSDXxcmwqQ"},
    {n:"Eyüp B.",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCbv-0vMCnLqwlZXUWoI4a5w"},
    {n:"Mert Hoca",d:["Matematik","Matematik (AYT)","Geometri","Geometri (AYT)"],id:"UCzMVi_CPx_XB9uhMl4uWR9g"},
    {n:"Matematiğin Güler Yüzü",d:["Matematik","Matematik (AYT)"],id:"UCdj-EiG6PCWM7ZqR5PzNOOw"},
    {n:"İlyas Güneş",d:["Matematik","Matematik (AYT)"],id:"UCRTxepZJj8vWniao-0Tkp4g"},
    {n:"SML Hoca",d:["Matematik","Matematik (AYT)"],id:"UCSiatSbaEJZpI_tkQXwRbcw"},
    {n:"Moz Akademi",d:["Matematik","Matematik (AYT)"],id:"UCSqWGILaJ5qZ_D9149h6RJg"},
    {n:"Barış Çelenk",d:["Matematik","Matematik (AYT)"],id:"UCpogE5vw7rLYOuzYoDk1Ang"},
    {n:"Kenan Kara",d:["Geometri","Geometri (AYT)"],id:"UC1X0FciySnrdUZld0O_tDXw"},
    {n:"Merkeze Teğet Geometri",d:["Geometri","Geometri (AYT)"],id:"UCGlM-klG4Q70q9WkXX9cTWA"},
    {n:"Nurtaç Hoca",d:["Geometri","Geometri (AYT)"],id:"UCNgmALbCj_-cQpxiIpTqOSQ"},
    {n:"Rüştü Hoca",d:["Türkçe","Edebiyat"],id:"UCyohoF5P2JFvc3KLLZRwDug"},
    {n:"Türkçenin Matematiği",d:["Türkçe"],id:"UCCAmWzulVvB1DjnR5IQCTUQ"},
    {n:"Deniz Hoca",d:["Edebiyat"],id:"UC_ke4VQZo9TewOf-p-LSx_Q"},
    {n:"Özcan Aykın",d:["Fizik","Fizik (AYT)"],id:"UC_IRxSYYyDa4Li9lxAM4xbQ"},
    {n:"VIP Fizik",d:["Fizik","Fizik (AYT)"],h:"@vipfizik"},
    {n:"Umut Öncül",d:["Fizik","Fizik (AYT)"],h:"@umutonculakademi"},
    {n:"Ertan Sinan Şahin",d:["Fizik","Fizik (AYT)"],id:"UCbIOzYvwXdvFGxt70WD2Y2A"},
    {n:"Fizikle Barış",d:["Fizik","Fizik (AYT)"],id:"UCooJ3GA5zLWnrV-qWupXakg"},
    {n:"Altuğ Güneş",d:["Fizik","Fizik (AYT)"],id:"UCx4651yGDx7DR6KiyxG_CUA"},
    {n:"Fizikfinito",d:["Fizik","Fizik (AYT)"],id:"UC-zDbhn0rWs2EywjGQMrK7A"},
    {n:"Fizik Evim",d:["Fizik","Fizik (AYT)"],id:"UCkRD9iVmodQfET17HeqxUrg"},
    {n:"Ferrum",d:["Kimya","Kimya (AYT)"],id:"UC0yco2kB3xW3WI__8E8HaKw"},
    {n:"Kimya Adası",d:["Kimya","Kimya (AYT)"],h:"@kimyaadasi"},
    {n:"Meschemy Kimya",d:["Kimya","Kimya (AYT)"],h:"@meschemykimya"},
    {n:"Paraksilen Kimya",d:["Kimya","Kimya (AYT)"],h:"@paraksilen"},
    {n:"Kimya Dersleri · Sinan İhtiyaroğlu",d:["Kimya","Kimya (AYT)"],h:"@kimyadersleri"},
    {n:"Semih Balmuk Kimya",d:["Kimya","Kimya (AYT)"],id:"UCoholQ9DKzOGYK7y9rYgrmA"},
    {n:"Levent Özdede ile Kimya",d:["Kimya","Kimya (AYT)"],h:"@leventozdede"},
    {n:"Görkem Şahin · Benim Hocam",d:["Kimya","Kimya (AYT)"],h:"@benimhocam",q:"Görkem Şahin Kimya",searchOnly:true},
    {n:"Biosem",d:["Biyoloji","Biyoloji (AYT)"],h:"@biosem"},
    {n:"Dr. Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],id:"UCY7Nh-CV3qqaWTxldlG4RCA"},
    {n:"Selin Hoca",d:["Biyoloji","Biyoloji (AYT)"],id:"UCl50Dhk1O-5YZYwHrWmuLtw"},
    {n:"Senin Biyolojin",d:["Biyoloji","Biyoloji (AYT)"],h:"@seninbiyolojin"},
    {n:"Betül Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],h:"@betulbiyoloji"},
    {n:"Cici Biyoloji",d:["Biyoloji","Biyoloji (AYT)"],h:"@CiciBiyoloji"},
    {n:"Yavuz Tuna Coğrafya",d:["Coğrafya","Coğrafya (AYT)"],id:"UCai5DYClxEjy-VH-eqz4MIA"},
    {n:"Coğrafyanın Kodları",d:["Coğrafya","Coğrafya (AYT)"],id:"UCIvX31CHx2RsFQM46qbjuJA"},
    {n:"KR Akademi",d:["Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)"],id:"UC1NYzm_kEss5qScWlf-TtwA"},
    {n:"Hocalara Geldik",d:["Türkçe","Matematik","Matematik (AYT)","Geometri","Geometri (AYT)","Fizik","Fizik (AYT)","Kimya","Kimya (AYT)","Biyoloji","Biyoloji (AYT)","Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)","Felsefe","Din Kültürü","Edebiyat"],id:"UCBcM2J8SHyq8GUSvrhWnwTg",searchOnly:true},
    {n:"Tonguç Akademi",d:["Türkçe","Matematik","Matematik (AYT)","Geometri","Geometri (AYT)","Fizik","Fizik (AYT)","Kimya","Kimya (AYT)","Biyoloji","Biyoloji (AYT)","Tarih","Tarih (AYT)","Coğrafya","Coğrafya (AYT)","Felsefe","Din Kültürü","Edebiyat"],id:"UCm3vDH7Uvz_qwql5Qih4yGw",searchOnly:true}
  ];

  const TOPICS={
    "TYT|Türkçe":["Paragraf","Sözcükte Anlam","Cümlede Anlam","Dil Bilgisi","Yazım Kuralları","Noktalama"],
    "TYT|Matematik":["Temel Kavramlar","Sayı Basamakları","Problemler","Kümeler","Fonksiyonlar","Olasılık"],
    "TYT|Geometri":["Üçgenler","Dörtgenler","Çember","Analitik Geometri"],
    "TYT|Fizik":["Fizik Bilimine Giriş","Hareket ve Kuvvet","Enerji","Isı ve Sıcaklık","Elektrik","Optik"],
    "TYT|Kimya":["Kimya Bilimi","Atom","Periyodik Sistem","Kimyasal Türler","Maddenin Halleri","Karışımlar"],
    "TYT|Biyoloji":["Canlıların Ortak Özellikleri","Hücre","Canlıların Sınıflandırılması","Ekoloji","Kalıtım"],
    "TYT|Tarih":["Tarih Bilimi","İlk Uygarlıklar","İlk Türk Devletleri","İslam Tarihi","Osmanlı Devleti","Kurtuluş Savaşı","Atatürk ve İnkılaplar"],
    "TYT|Coğrafya":["Harita Bilgisi","İklim","İç Kuvvetler","Dış Kuvvetler","Nüfus","Göç","Ekonomik Faaliyetler"],
    "TYT|Felsefe":["Felsefeye Giriş","Bilgi Felsefesi","Varlık Felsefesi","Ahlak Felsefesi","Din Felsefesi","Siyaset Felsefesi","Mantık"],
    "TYT|Din Kültürü":["Bilgi ve İnanç","Din ve İslam","İslam ve İbadet","Ahlak","Hz. Muhammed","Kur'an"],
    "AYT|Matematik":["Fonksiyonlar","Polinomlar","Trigonometri","Logaritma","Diziler","Limit","Türev","İntegral"],
    "AYT|Geometri":["Üçgenler","Dörtgenler","Çember","Analitik Geometri"],
    "AYT|Fizik":["Vektörler","Kuvvet ve Hareket","Elektrik ve Manyetizma","Çembersel Hareket","Dalgalar","Modern Fizik"],
    "AYT|Kimya":["Modern Atom Teorisi","Gazlar","Çözeltiler","Tepkimelerde Enerji","Kimyasal Denge","Organik Kimya"],
    "AYT|Biyoloji":["Sinir Sistemi","Endokrin Sistem","Duyu Organları","Destek ve Hareket","Sindirim","Dolaşım","Solunum","Boşaltım","Üreme","Genetik","Ekoloji"],
    "AYT|Edebiyat":["Şiir Bilgisi","Halk Edebiyatı","Divan Edebiyatı","Tanzimat Edebiyatı","Servetifünun","Milli Edebiyat","Cumhuriyet Dönemi","Roman ve Hikâye"],
    "AYT|Tarih":["Osmanlı Devleti","Avrupa Tarihi","XX. Yüzyıl Başlarında Osmanlı","Milli Mücadele","Atatürkçülük ve İnkılaplar","Çağdaş Türk ve Dünya Tarihi"],
    "AYT|Coğrafya":["Ekosistem","Nüfus Politikaları","Yerleşmeler","Türkiye Ekonomisi","Küresel Ticaret","Çevre ve Toplum"]
  };
  const TOPIC_ALIASES={
    "Temel Kavramlar":["temel kavram","sayı kümeleri","sayi kumeleri"],
    "Sayı Basamakları":["sayı basamak","sayi basamak"],
    "Problemler":["problem","problemler"],
    "Fonksiyonlar":["fonksiyon"],
    "Üçgenler":["üçgen","ucgen"],
    "Dörtgenler":["dörtgen","dortgen"],
    "Çember":["çember","cember","daire"],
    "Analitik Geometri":["analitik geometri","analitik"],
    "Hareket ve Kuvvet":["hareket","kuvvet"],
    "Kuvvet ve Hareket":["kuvvet","hareket"],
    "Isı ve Sıcaklık":["ısı","isi","sıcaklık","sicaklik"],
    "Elektrik ve Manyetizma":["elektrik","manyetizma"],
    "Periyodik Sistem":["periyodik"],
    "Kimyasal Türler":["kimyasal tür","kimyasal tur"],
    "Maddenin Halleri":["maddenin halleri","katı","kati","sıvı","sivi","gaz"],
    "Canlıların Sınıflandırılması":["sınıflandır","siniflandir"],
    "Kalıtım":["kalıtım","kalitim"],
    "Genetik":["genetik","kalıtım","kalitim"],
    "Sinir Sistemi":["sinir sistemi","sinir"],
    "Endokrin Sistem":["endokrin","hormon"],
    "Duyu Organları":["duyu organ"],
    "Destek ve Hareket":["destek ve hareket","iskelet","kas"],
    "Boşaltım":["boşaltım","bosaltim","üriner","uriner"],
    "Modern Atom Teorisi":["modern atom","atom teor"],
    "Çözeltiler":["çözelti","cozelti"],
    "Kimyasal Denge":["kimyasal denge","denge"],
    "Organik Kimya":["organik"],
    "Türev":["türev","turev"],
    "İntegral":["integral"],
    "İç Kuvvetler":["iç kuvvet","ic kuvvet"],
    "Dış Kuvvetler":["dış kuvvet","dis kuvvet"],
    "Atatürk ve İnkılaplar":["atatürk","ataturk","inkılap","inkilap"],
    "Milli Mücadele":["milli mücadele","milli mucadele","kurtuluş","kurtulus"],
    "Servetifünun":["servetifünun","servet-i fünun","servetifun"],
    "Milli Edebiyat":["milli edebiyat"],
    "Cumhuriyet Dönemi":["cumhuriyet dönemi","cumhuriyet donemi"]
  };
  const state={scope:"TYT",subject:"Matematik",topic:"",teacher:"",category:"all",mode:"videos",query:"",busy:false,items:[],cache:new Map(),hasMore:false,archive:null,loadedPages:new Set(),selectedPlaylist:null};

  const $=id=>document.getElementById(id);
  function esc(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
  function compact(v){return String(v??"").replace(/\s+/g," ").trim();}
  function teacherByName(){return TEACHERS.find(t=>t.n===state.teacher)||null;}
  function subjectKey(){
    if(state.scope==="AYT"&&state.subject!=="Edebiyat")return state.subject+" (AYT)";
    return state.subject;
  }
  function availableSubjects(){
    return SUBJECTS.filter(subject=>{
      if(state.scope==="TYT"&&subject==="Edebiyat")return false;
      const key=state.scope==="AYT"&&subject!=="Edebiyat"?subject+" (AYT)":subject;
      return TEACHERS.some(t=>t.d.includes(key));
    });
  }
  function availableTeachers(){const key=subjectKey();return TEACHERS.filter(t=>t.d.includes(key));}

  function buildShell(){
    const page=$("programsPage"),summary=page?.querySelector(".program-summary");
    if(!page||!summary||$(ROOT_ID))return;
    const section=document.createElement("section");
    section.id=ROOT_ID;
    section.className="coach-video-library";
    section.innerHTML=
      '<div class="coach-video-head"><div><span>HOCALAR &amp; VİDEOLAR</span><h3>Güncel video kütüphanesi</h3><p>TYT / AYT, ders, hoca ve içerik türüne göre ara; videoyu veya oynatma listesini öğrencinin programına tek tıkla ekle.</p></div><div class="coach-video-live"><i></i><b>YKS medya</b><small>Güncel arşiv</small></div></div>'+
      '<div class="coach-video-filters">'+
        '<div class="coach-video-seg" id="coachVideoScope"><button type="button" data-scope="TYT" class="active">TYT</button><button type="button" data-scope="AYT">AYT</button></div>'+
        '<label><span>Ders</span><select id="coachVideoSubject"></select></label>'+
        '<label class="coach-video-topic-field"><span>Konu</span><select id="coachVideoTopic"><option value="">Tüm konular</option></select></label>'+
        '<label class="coach-video-teacher-field"><span>Hoca</span><select id="coachVideoTeacher"></select></label>'+
        '<div class="coach-video-seg" id="coachVideoMode"><button type="button" data-mode="videos" class="active">Videolar</button><button type="button" data-mode="playlists">Oynatma listeleri</button></div>'+
      '</div>'+
      '<div class="coach-video-tools"><div class="coach-video-cats" id="coachVideoCategories"></div><label class="coach-video-search"><span>⌕</span><input id="coachVideoSearch" type="search" placeholder="Başlıkta ara..."></label><button type="button" id="coachVideoRefresh" class="coach-video-refresh">↻ Yenile</button></div>'+
      '<div class="coach-video-meta"><span id="coachVideoStatus">Kaynak hazırlanıyor…</span><a id="coachVideoChannel" href="#" target="_blank" rel="noopener noreferrer" class="hidden">YouTube kanalını aç ↗</a></div>'+
      '<div class="coach-video-results" id="coachVideoResults"></div>'+
      '<div class="coach-video-more-row"><button type="button" id="coachVideoMore" class="coach-video-more hidden">Daha fazla getir</button></div>';
    const programAnchor=$("programMainEmpty")||$("programWeekBoard")||summary;
    programAnchor.insertAdjacentElement("afterend",section);
    const cats=$("coachVideoCategories");
    Object.entries(CATEGORIES).forEach(([key,row])=>{
      const b=document.createElement("button");b.type="button";b.dataset.category=key;b.textContent=row.label;if(key==="all")b.classList.add("active");cats.appendChild(b);
    });
    bind();
    rebuildSubjects();
  }

  function bind(){
    $("coachVideoScope")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-scope]");if(!b||state.busy)return;
      state.scope=b.dataset.scope||"TYT";state.selectedPlaylist=null;
      document.querySelectorAll("#coachVideoScope [data-scope]").forEach(x=>x.classList.toggle("active",x===b));
      rebuildSubjects();void load(true);
    });
    $("coachVideoSubject")?.addEventListener("change",event=>{state.subject=event.target.value;state.topic="";state.selectedPlaylist=null;rebuildTopics();rebuildTeachers();void load(true);});
    $("coachVideoTopic")?.addEventListener("change",event=>{state.topic=event.target.value;state.selectedPlaylist=null;void load(true);});
    $("coachVideoTeacher")?.addEventListener("change",event=>{state.teacher=event.target.value;state.selectedPlaylist=null;syncChannelLink();void load(true);});
    $("coachVideoMode")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-mode]");if(!b||state.busy)return;
      state.mode=b.dataset.mode||"videos";state.selectedPlaylist=null;
      document.querySelectorAll("#coachVideoMode [data-mode]").forEach(x=>x.classList.toggle("active",x===b));
      void load(true);
    });
    $("coachVideoCategories")?.addEventListener("click",event=>{
      const b=event.target.closest("[data-category]");if(!b||state.busy)return;
      state.category=b.dataset.category||"all";state.selectedPlaylist=null;
      document.querySelectorAll("#coachVideoCategories [data-category]").forEach(x=>x.classList.toggle("active",x===b));
      void load(true);
    });
    let timer=0;
    $("coachVideoSearch")?.addEventListener("input",event=>{
      clearTimeout(timer);state.query=compact(event.target.value);state.selectedPlaylist=null;timer=setTimeout(()=>void load(true),350);
    });
    $("coachVideoRefresh")?.addEventListener("click",()=>{state.cache.clear();void load(true,true);});
    $("coachVideoMore")?.addEventListener("click",()=>void load(false));
    window.addEventListener("yks:coach-resource-recommend-result",event=>{
      const detail=event.detail||{};
      if(detail.ok)setStatus("Öneri öğrenciye gönderildi ✓");
      else if(detail.message)setStatus(String(detail.message));
    });
    $("coachVideoResults")?.addEventListener("click",event=>{
      const back=event.target.closest("[data-playlist-back]");
      if(back){state.selectedPlaylist=null;render();return;}
      const view=event.target.closest("[data-playlist-view]");
      if(view){const item=state.items[Number(view.dataset.playlistView)];if(item){state.selectedPlaylist=item;render();}return;}
      const playlistRecommend=event.target.closest("[data-playlist-recommend]");
      if(playlistRecommend&&state.selectedPlaylist){recommendResource(state.selectedPlaylist);return;}
      const playlistVideoRecommend=event.target.closest("[data-playlist-video-recommend]");
      if(playlistVideoRecommend){const item=state.selectedPlaylist?.videos?.[Number(playlistVideoRecommend.dataset.playlistVideoRecommend)];if(item)recommendResource(item);return;}
      const playlistAdd=event.target.closest("[data-playlist-video-add]");
      if(playlistAdd){const item=state.selectedPlaylist?.videos?.[Number(playlistAdd.dataset.playlistVideoAdd)];if(item)addToProgram(item);return;}
      const playlistOpen=event.target.closest("[data-playlist-video-open]");
      if(playlistOpen){const item=state.selectedPlaylist?.videos?.[Number(playlistOpen.dataset.playlistVideoOpen)];if(item)window.open(item.url,"_blank","noopener,noreferrer");return;}
      const recommend=event.target.closest("[data-video-recommend]");
      if(recommend){const item=state.items[Number(recommend.dataset.videoRecommend)];if(item)recommendResource(item);return;}
      const add=event.target.closest("[data-video-add]"),open=event.target.closest("[data-video-open]");
      if(add){const item=state.items[Number(add.dataset.videoAdd)];if(item)addToProgram(item);}
      if(open){const item=state.items[Number(open.dataset.videoOpen)];if(item)window.open(item.url,"_blank","noopener,noreferrer");}
    });
  }

  function rebuildSubjects(){
    const select=$("coachVideoSubject"),subjects=availableSubjects();if(!select)return;
    const wanted=subjects.includes(state.subject)?state.subject:subjects[0]||"Matematik";state.subject=wanted;
    select.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");select.value=wanted;
    rebuildTopics();
    rebuildTeachers();
  }
  function rebuildTopics(){
    const select=$("coachVideoTopic");if(!select)return;
    const topics=TOPICS[state.scope+"|"+state.subject]||[],wanted=topics.includes(state.topic)?state.topic:"";state.topic=wanted;
    select.innerHTML='<option value="">Tüm konular</option>'+topics.map(topic=>'<option value="'+esc(topic)+'">'+esc(topic)+'</option>').join("");
    select.value=wanted;select.disabled=!topics.length;
  }
  function rebuildTeachers(){
    const select=$("coachVideoTeacher"),teachers=availableTeachers();if(!select)return;
    const wanted=teachers.some(t=>t.n===state.teacher)?state.teacher:(teachers[0]?.n||"");state.teacher=wanted;
    select.innerHTML=teachers.map(t=>'<option value="'+esc(t.n)+'">'+esc(t.n)+'</option>').join("");select.value=wanted;
    syncChannelLink();
  }
  function syncChannelLink(){
    const a=$("coachVideoChannel"),t=teacherByName();if(!a)return;
    const url=t?.id?"https://www.youtube.com/channel/"+encodeURIComponent(t.id):(t?.h?"https://www.youtube.com/"+t.h:"");
    a.classList.toggle("hidden",!url);if(url)a.href=url;
  }

  function queryText(){
    const t=teacherByName(),category=CATEGORIES[state.category]?.term||"",base=t?.q||t?.n||"";
    return [base,state.scope,state.subject,state.topic,category,state.query].filter(Boolean).join(" ");
  }
  function cacheKey(){return [state.mode,state.scope,state.subject,state.topic,state.teacher,state.category,state.query].join("|");}
  function setStatus(text){const n=$("coachVideoStatus");if(n)n.textContent=text;}
  function setBusy(on){
    state.busy=on;
    const root=$(ROOT_ID);root?.classList.toggle("loading",on);
    ["coachVideoSubject","coachVideoTopic","coachVideoTeacher","coachVideoRefresh","coachVideoSearch"].forEach(id=>{const n=$(id);if(n)n.disabled=on;});
  }
  function norm(value){
    return String(value??"").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  }
  function mediaBases(){
    const out=[];
    try{out.push(new URL(MEDIA_REPO_PATH,location.origin).href);}catch{}
    out.push(MEDIA_FALLBACK_BASE);
    return [...new Set(out)];
  }
  async function fetchJsonUrl(url,force=false){
    const target=new URL(url);
    if(force)target.searchParams.set("coachRefresh",String(Date.now()));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const res=await fetch(target.href,{headers:{Accept:"application/json"},cache:"no-store",credentials:"omit",signal:controller.signal});
      if(!res.ok)throw new Error("HTTP "+res.status);
      return await res.json();
    }finally{clearTimeout(timer);}
  }
  async function loadFeed(force=false){
    if(feedCache&&!force)return feedCache;
    let lastError=null;
    for(const base of mediaBases()){
      try{
        const data=await fetchJsonUrl(new URL("teachers-v2-feed.json",base).href,force);
        if(!data||typeof data!=="object"||!data.teachers||!Object.keys(data.teachers).length)throw new Error("boş medya akışı");
        feedCache=data;feedBase=base;return data;
      }catch(error){lastError=error;}
    }
    throw lastError||new Error("Hocalar medya akışı alınamadı");
  }
  function teacherMedia(feed,name){
    if(!feed?.teachers)return null;
    if(feed.teachers[name])return feed.teachers[name];
    const wanted=norm(name);
    for(const [key,value] of Object.entries(feed.teachers))if(norm(key)===wanted)return value;
    return null;
  }
  function videoId(item){
    const raw=String(item?.id||item?.url||"");
    const m=raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/)||raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)||raw.match(/^([A-Za-z0-9_-]{6,})$/);
    return m?m[1]:"";
  }
  function playlistId(item){
    const raw=String(item?.id||item?.url||"");
    const m=raw.match(/[?&]list=([A-Za-z0-9_-]{8,})/)||raw.match(/^((?:PL|UU|OLAK5uy_)[A-Za-z0-9_-]{8,})$/);
    return m?m[1]:"";
  }
  function normalizeVideo(item,media){
    const id=videoId(item);if(!id)return null;
    return {kind:"video",id,title:compact(item?.title||"YouTube videosu"),thumb:String(item?.thumbnail||("https://i.ytimg.com/vi/"+id+"/hqdefault.jpg")),by:compact(item?.channel||media?.channelName||state.teacher),meta:state.scope+" · "+state.subject+(state.topic?" · "+state.topic:""),url:String(item?.url||("https://www.youtube.com/watch?v="+encodeURIComponent(id)))};
  }
  function normalizePlaylist(item,media){
    const id=playlistId(item);if(!id)return null;
    const rawVideos=Array.isArray(item?.videos)?item.videos:[],videos=rawVideos.map(video=>normalizeVideo(video,media)).filter(Boolean);
    const total=Number(item?.videoCount||videos.length)||videos.length,complete=Boolean(item?.contentComplete);
    const meta=complete?(total+" video"):(videos.length?(videos.length+" önizleme · tam liste"):"Tam liste");
    return {kind:"playlist",id,title:compact(item?.title||"Oynatma listesi"),thumb:String(videos[0]?.thumb||rawVideos[0]?.thumbnail||""),by:compact(media?.channelName||state.teacher),meta,url:String(item?.url||("https://www.youtube.com/playlist?list="+encodeURIComponent(id))),videos,videoCount:total,contentComplete:complete};
  }
  function dedupe(list){
    const seen=new Set(),out=[];
    for(const x of list){if(!x||seen.has(x.kind+":"+x.id))continue;seen.add(x.kind+":"+x.id);out.push(x);}
    return out;
  }
  const SUBJECT_TERMS={
    "Matematik":["matematik","problem","fonksiyon","polinom","trigonometri","logaritma","limit","türev","turev","integral"],
    "Geometri":["geometri","üçgen","ucgen","dörtgen","dortgen","çember","cember","analitik"],
    "Türkçe":["türkçe","turkce","paragraf","dil bilgisi","yazım","yazim","noktalama"],
    "Edebiyat":["edebiyat","şiir","siir","roman","hikaye","divan","tanzimat"],
    "Fizik":["fizik","hareket","kuvvet","enerji","elektrik","manyetizma","optik"],
    "Kimya":["kimya","atom","mol","gazlar","çözelti","cozelti","asit","baz","organik"],
    "Biyoloji":["biyoloji","hücre","hucre","kalıtım","kalitim","ekoloji","fotosentez","genetik"],
    "Tarih":["tarih","osmanlı","osmanli","inkılap","inkilap","selçuklu","selcuklu"],
    "Coğrafya":["coğrafya","cografya","iklim","harita","nüfus","nufus"],
    "Felsefe":["felsefe","mantık","mantik","psikoloji","sosyoloji"],
    "Din Kültürü":["din kültürü","din kulturu","islam","kuran","hadis"]
  };
  function hasSubject(title,subject){return (SUBJECT_TERMS[subject]||[subject]).some(term=>title.includes(norm(term)));}
  function subjectMatches(title){
    if(hasSubject(title,state.subject))return true;
    const otherExplicit=SUBJECTS.some(subject=>subject!==state.subject&&hasSubject(title,subject));
    return !otherExplicit;
  }
  function topicTerms(topic){
    if(!topic)return[];
    const aliases=TOPIC_ALIASES[topic]||[];
    const words=norm(topic).split(" ").filter(word=>word.length>=4&&!["sistemi","dönemi","donemi","bilgisi"].includes(word));
    return [...new Set([norm(topic),...aliases.map(norm),...words])].filter(Boolean);
  }
  function topicMatches(title){
    const terms=topicTerms(state.topic);if(!terms.length)return true;
    return terms.some(term=>title.includes(term));
  }
  function titleMatches(item){
    const title=norm(item?.title||"");
    const query=norm(state.query);
    if(query&&!title.includes(query))return false;
    if(!subjectMatches(title))return false;
    if(!topicMatches(title))return false;
    const categoryTerms={
      konu:["konu","anlatım","anlatim","ders"],
      kamp:["kamp","gün","gun"],
      soru:["soru","çözüm","cozum","test"],
      deneme:["deneme","branş","brans"],
      tekrar:["tekrar","özet","ozet","full","genel"]
    };
    const terms=categoryTerms[state.category]||[];
    if(terms.length&&!terms.some(term=>title.includes(norm(term))))return false;
    return {title,tyt:title.includes("tyt"),ayt:title.includes("ayt")};
  }
  function filtered(items){
    const checked=items.map(item=>({item,match:titleMatches(item)})).filter(row=>row.match!==false);
    if(!checked.length)return [];
    if(state.scope==="AYT"){
      const ayt=checked.filter(row=>row.match?.ayt).map(row=>row.item);
      return ayt.length?ayt:checked.map(row=>row.item);
    }
    const tytOrNeutral=checked.filter(row=>!row.match?.ayt).map(row=>row.item);
    return tytOrNeutral.length?tytOrNeutral:checked.map(row=>row.item);
  }
  async function loadArchive(media,force=false){
    if(!media?.archiveIndex)return null;
    const key=state.teacher;
    if(!force&&teacherArchiveCache.has(key))return teacherArchiveCache.get(key);
    const meta=await fetchJsonUrl(new URL(media.archiveIndex,feedBase).href,force);
    if(!meta||!Array.isArray(meta.pages)||!Array.isArray(meta.playlists))throw new Error("geçersiz hoca arşivi");
    const archive={meta,videos:[],loaded:new Set()};
    teacherArchiveCache.set(key,archive);
    return archive;
  }
  async function loadArchivePage(archive,index,force=false){
    if(!archive||index<0||index>=archive.meta.pages.length||archive.loaded.has(index))return;
    const pagePath=archive.meta.pages[index];
    const page=await fetchJsonUrl(new URL(pagePath,feedBase).href,force);
    if(!page||!Array.isArray(page.videos))throw new Error("geçersiz video sayfası");
    archive.videos=dedupe(archive.videos.concat(page.videos.map(video=>normalizeVideo(video,archive.meta)).filter(Boolean)));
    archive.loaded.add(index);
  }
  function nextArchiveIndex(archive){
    if(!archive)return -1;
    for(let i=0;i<archive.meta.pages.length;i++)if(!archive.loaded.has(i))return i;
    return -1;
  }
  function fallbackUploadsItem(){
    const t=teacherByName();if(!t?.id)return null;
    const list="UU"+String(t.id).slice(2);
    return {kind:"playlist",id:list,title:state.teacher+" · Kanalın tüm güncel videoları",thumb:"",by:state.teacher,meta:"YouTube yüklemeleri",url:"https://www.youtube.com/playlist?list="+encodeURIComponent(list)};
  }
  async function buildTeacherItems(force=false,loadMore=false){
    const feed=await loadFeed(force),media=teacherMedia(feed,state.teacher);
    if(!media)throw new Error("Bu hoca canlı medya akışında bulunamadı");
    let archive=null;
    try{archive=await loadArchive(media,force);}catch(error){console.warn("[coach-video-archive]",error);}
    state.archive=archive;
    if(state.mode==="playlists"){
      const raw=Array.isArray(archive?.meta?.playlists)?archive.meta.playlists:(Array.isArray(media.playlists)?media.playlists:[]);
      const items=raw.map(item=>normalizePlaylist(item,archive?.meta||media)).filter(Boolean);
      state.hasMore=false;
      return filtered(items);
    }
    if(archive&&archive.meta.pages.length){
      const missing=archive.meta.pages.map((_,index)=>index).filter(index=>!archive.loaded.has(index));
      if(missing.length)await Promise.all(missing.map(index=>loadArchivePage(archive,index,force)));
    }
    const preview=(Array.isArray(media.videos)?media.videos:[]).map(video=>normalizeVideo(video,media)).filter(Boolean);
    const archived=Array.isArray(archive?.videos)?archive.videos:[];
    state.hasMore=false;
    return filtered(dedupe(preview.concat(archived)));
  }

  async function load(reset=true,forced=false){
    if(state.busy||!state.teacher)return;
    const key=cacheKey();
    if(reset&&!forced&&state.cache.has(key)){
      const saved=state.cache.get(key);state.items=saved.items.slice();state.hasMore=saved.hasMore;render();return;
    }
    setBusy(true);
    if(reset){state.items=[];state.hasMore=false;renderSkeleton();}
    setStatus((reset?"YKS Defterim medya arşivi açılıyor…":"Daha fazla video yükleniyor…"));
    try{
      const incoming=await buildTeacherItems(forced,!reset);
      state.items=dedupe(incoming);
      state.cache.set(key,{items:state.items.slice(),hasMore:state.hasMore,at:Date.now()});
      render();
    }catch(error){
      console.error("[coach-video-library]",error);
      const fallback=fallbackUploadsItem();
      if(reset&&fallback){
        state.items=[fallback];state.hasMore=false;render();
        setStatus("Canlı arşive ulaşılamadı; hocanın YouTube yüklemeleri gösteriliyor.");
      }else if(reset)renderError();
      else setStatus("Daha fazla video getirilemedi.");
    }finally{setBusy(false);}
  }

  function renderSkeleton(){
    const host=$("coachVideoResults");if(!host)return;
    host.innerHTML=Array.from({length:4},()=>'<article class="coach-video-card skeleton"><div></div><span></span><b></b><small></small></article>').join("");
    $("coachVideoMore")?.classList.add("hidden");
  }
  function renderError(){
    const host=$("coachVideoResults");if(!host)return;
    const searchUrl="https://www.youtube.com/results?search_query="+encodeURIComponent(queryText());
    host.innerHTML='<div class="coach-video-empty"><span>↗</span><b>YKS Defterim video arşivine şu an ulaşılamadı</b><p>Hoca ve filtre seçimin korundu. İstersen aynı aramayı YouTube’da açabilirsin.</p><a href="'+esc(searchUrl)+'" target="_blank" rel="noopener noreferrer">YouTube’da ara</a></div>';
    setStatus("Video arşivi bağlantısı kurulamadı.");
    $("coachVideoMore")?.classList.add("hidden");
  }
  function renderPlaylistDetail(){
    const host=$("coachVideoResults"),more=$("coachVideoMore"),item=state.selectedPlaylist;if(!host||!item)return;
    more?.classList.add("hidden");
    const videos=Array.isArray(item.videos)?item.videos:[];
    const total=Number(item.videoCount||videos.length)||videos.length;
    const note=item.contentComplete?(total+" video · listenin tamamı"):(videos.length+" önizleme · tam liste YouTube bağlantısında");
    const cards=videos.map((video,index)=>'<article class="coach-video-card">'+
      '<button type="button" class="coach-video-thumb" data-playlist-video-open="'+index+'" aria-label="Videoyu aç"><img src="'+esc(video.thumb||("https://i.ytimg.com/vi/"+video.id+"/hqdefault.jpg"))+'" alt="" loading="lazy" referrerpolicy="no-referrer"><span>Video</span></button>'+
      '<div class="coach-video-card-body"><small>'+esc(video.by||state.teacher)+'</small><b>'+esc(video.title)+'</b><em>'+esc(video.meta||state.scope+" · "+state.subject+(state.topic?" · "+state.topic:""))+'</em></div>'+
      '<div class="coach-video-card-actions"><button type="button" data-playlist-video-open="'+index+'">Aç ↗</button><button type="button" class="recommend" data-playlist-video-recommend="'+index+'">Öğrenciye öner</button><button type="button" class="primary" data-playlist-video-add="'+index+'">Programa ekle</button></div>'+
    '</article>').join("");
    host.innerHTML='<div class="coach-playlist-detail-head"><button type="button" data-playlist-back>‹ Playlistlere dön</button><div><small>'+esc(state.teacher)+'</small><b>'+esc(item.title)+'</b><span>'+esc(note)+'</span></div><div class="coach-playlist-detail-actions"><button type="button" class="recommend" data-playlist-recommend>Öğrenciye öner</button><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">YouTube’da tam liste ↗</a></div></div>'+
      (cards||'<div class="coach-video-empty"><span>▶</span><b>Playlist bağlantısı hazır</b><p>Bu eski arşiv kaydında video kartları eksik. Tam listeyi YouTube’dan açabilirsin; yeni arşiv yenilendiğinde videolar burada tek tek görünecek.</p><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Tam listeyi aç ↗</a></div>');
    setStatus(state.teacher+" · "+item.title+" · "+note);
  }

  function render(){
    const host=$("coachVideoResults"),more=$("coachVideoMore");if(!host)return;
    if(state.mode==="playlists"&&state.selectedPlaylist){renderPlaylistDetail();return;}
    if(!state.items.length){
      const searchUrl="https://www.youtube.com/results?search_query="+encodeURIComponent(queryText());
      host.innerHTML='<div class="coach-video-empty"><span>⌕</span><b>Bu filtrede sonuç bulunamadı</b><p>Filtreyi genişletebilir veya aynı aramayı YouTube’da açabilirsin.</p><a href="'+esc(searchUrl)+'" target="_blank" rel="noopener noreferrer">YouTube’da ara</a></div>';
      setStatus(state.teacher+" · "+state.scope+" · sonuç yok");
      more?.classList.add("hidden");return;
    }
    host.innerHTML=state.items.map((item,index)=>{
      const thumb=item.thumb?'<img src="'+esc(item.thumb)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<div class="coach-video-thumb-empty">▶</div>';
      const isPlaylist=item.kind==="playlist";
      return '<article class="coach-video-card">'+
        '<button type="button" class="coach-video-thumb" '+(isPlaylist?'data-playlist-view="'+index+'"':'data-video-open="'+index+'"')+' aria-label="'+(isPlaylist?'Playlist videolarını göster':'Videoyu aç')+'">'+thumb+'<span>'+(isPlaylist?"Liste":"Video")+'</span></button>'+
        '<div class="coach-video-card-body"><small>'+esc(item.by||state.teacher)+'</small><b>'+esc(item.title)+'</b><em>'+esc(item.meta||state.scope+" · "+state.subject+(state.topic?" · "+state.topic:""))+'</em></div>'+
        '<div class="coach-video-card-actions"><button type="button" '+(isPlaylist?'data-playlist-view="'+index+'"':'data-video-open="'+index+'"')+'>'+(isPlaylist?'Videoları gör':'Aç ↗')+'</button><button type="button" class="recommend" data-video-recommend="'+index+'">Öğrenciye öner</button><button type="button" class="primary" data-video-add="'+index+'">Programa ekle</button></div>'+
      '</article>';
    }).join("");
    setStatus(state.teacher+" · "+state.scope+" "+state.subject+" · "+state.items.length+" "+(state.mode==="playlists"?"liste":"video")+" gösteriliyor");
    more?.classList.toggle("hidden",!state.hasMore);
  }

  function recommendResource(item){
    const hero=compact($("programHeroName")?.textContent);
    if(!hero||/seçilmedi/i.test(hero)){setStatus("Önce bir öğrenci seç, sonra kaynağı öner.");return;}
    const detail={
      kind:item.kind==="playlist"?"playlist":"video",
      id:String(item.id||"").slice(0,120),
      title:compact(item.title||"Koç önerisi").slice(0,180),
      url:String(item.url||"").slice(0,600),
      teacher:compact(state.teacher).slice(0,100),
      subject:compact(state.subject).slice(0,80),
      topic:compact(state.topic).slice(0,120),
      scope:compact(state.scope).slice(0,10),
      thumb:String(item.thumb||"").slice(0,600)
    };
    if(!detail.id||!/^https?:\/\//i.test(detail.url)){setStatus("Bu kaynak öneri olarak gönderilemiyor.");return;}
    setStatus(detail.kind==="playlist"?"Playlist öğrenciye öneriliyor…":"Video öğrenciye öneriliyor…");
    window.dispatchEvent(new CustomEvent("yks:coach-resource-recommend",{detail}));
  }

  function addToProgram(item){
    const hero=compact($("programHeroName")?.textContent);
    if(!hero||/seçilmedi/i.test(hero)){setStatus("Önce soldan bir öğrenci seç, sonra videoyu programa ekle.");return;}
    const open=$("programAddTaskBtn");if(!open)return;
    open.click();
    setTimeout(()=>{
      const backdrop=$("programTaskBackdrop");
      if(!backdrop||backdrop.classList.contains("hidden")){setStatus("Çalışma ekleme penceresi açılamadı.");return;}
      $("programCustomTab")?.click();
      const text=$("programTaskText"),video=$("programTaskVideo");
      const prefix=item.kind==="playlist"?"Oynatma listesi":"Video izle";
      const topicPart=state.topic?" · "+state.topic:"";
      if(text){text.value=(prefix+" · "+state.teacher+" · "+state.subject+topicPart+" · "+item.title).slice(0,600);text.dispatchEvent(new Event("input",{bubbles:true}));}
      if(video){video.value=item.url;video.dispatchEvent(new Event("input",{bubbles:true}));}
      backdrop.scrollIntoView({block:"center",behavior:"smooth"});
      setStatus(item.kind==="playlist"?"Oynatma listesi görev penceresine eklendi.":"Video görev penceresine eklendi.");
    },0);
  }

  function boot(){buildShell();if($(ROOT_ID))void load(true);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();