/* Koç Paneli · v68 — hareket yardımcıları (coach-motion-v68.css ile birlikte).
   Veri okumaz/yazmaz: ekran açılınca kısa süreli data-motion-enter koyar, ana sayfa sayılarını saydırır,
   yeni gelen mesaj balonunu işaretler. Ayarlar'daki "Azaltılmış hareket" açıksa hiçbir şey yapmaz. */
(function(){
  "use strict";
  var ENTER_MS=900,COUNT_MS=700;
  function motionOff(){return document.body.classList.contains("coach-reduce-motion");}

  // Sayı 0'dan hedefe sayar. Panel bu sırada yeni bir değer yazarsa sayma bırakılır, panelin yazdığı kalır.
  function countUp(el){
    var match=/^(%?)(\d{1,6})(%?)$/.exec(String(el.textContent||"").trim());
    if(!match||motionOff())return;
    var target=Number(match[2]),started=performance.now();
    if(target<2)return;
    el.__mvLast=el.textContent;
    function step(now){
      if(el.textContent!==el.__mvLast)return;
      var progress=Math.min(1,(now-started)/COUNT_MS),value=Math.round(target*(1-Math.pow(1-progress,3)));
      el.__mvLast=match[1]+value+match[3];el.textContent=el.__mvLast;
      if(progress<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function markEnter(page){
    if(!page||motionOff())return;
    page.setAttribute("data-motion-enter","");
    clearTimeout(page.__mvTimer);
    page.__mvTimer=setTimeout(function(){page.removeAttribute("data-motion-enter");},ENTER_MS);
    if(page.id==="homePage")page.querySelectorAll(".stat-card strong").forEach(countUp);
  }

  function watchPages(){
    var app=document.getElementById("appView");
    if(!app)return;
    var observer=new MutationObserver(function(records){
      records.forEach(function(record){
        var el=record.target,wasHidden=/(^|\s)hidden(\s|$)/.test(record.oldValue||"");
        if(!wasHidden||el.classList.contains("hidden"))return;
        markEnter(el===app?app.querySelector("section[id$='Page']:not(.hidden)"):el);
      });
    });
    var options={attributes:true,attributeFilter:["class"],attributeOldValue:true};
    observer.observe(app,options);
    // Ayarlar'ın alt bölümleri de birer ekran gibi açılır.
    app.querySelectorAll("section[id$='Page'],.settings-section").forEach(function(page){observer.observe(page,options);});
  }

  // Ana sayfa sayıları veri gelince "—" yerine yazılır; yalnızca bu ilk gelişte sayarak gösterilir.
  function watchStats(){
    document.querySelectorAll("#homePage .stat-card strong").forEach(function(el){
      var previous=el.textContent;
      new MutationObserver(function(){
        var now=el.textContent;
        if(now===el.__mvLast)return;
        var wasEmpty=!/\d/.test(previous);
        previous=now;
        if(wasEmpty&&!el.closest(".hidden"))countUp(el);
      }).observe(el,{childList:true,characterData:true,subtree:true});
    });
  }

  function watchThread(){
    var thread=document.getElementById("messageThread");
    if(!thread)return;
    var count=thread.querySelectorAll(".message-bubble-row").length;
    new MutationObserver(function(){
      var rows=thread.querySelectorAll(".message-bubble-row");
      if(rows.length===count+1&&!motionOff())rows[rows.length-1].setAttribute("data-motion-new","");
      count=rows.length;
    }).observe(thread,{childList:true});
  }

  // Durum satırları (kaydedildi, gönderildi, hata): metin gerçekten değişince beliriş yeniden oynatılır.
  var STATUS_IDS=["authStatus","messageComposeStatus","studentCodeStatus","coachVideoPickerStatus","coachV7DraftStatus","programTaskStatus","settingsSaveState"];
  function watchStatus(){
    STATUS_IDS.forEach(function(id){
      var el=document.getElementById(id);
      if(!el)return;
      var previous=el.textContent;
      new MutationObserver(function(){
        var now=el.textContent;
        if(now===previous)return;
        previous=now;
        if(!now.trim()||motionOff())return;
        el.removeAttribute("data-motion-flash");void el.offsetWidth;el.setAttribute("data-motion-flash","");
      }).observe(el,{childList:true,characterData:true,subtree:true});
    });
  }

  // Dönen halka yalnızca az önce tıklanan gönder/kaydet türü düğmede, devre dışı kaldığı sürece görünür.
  // (Sayfa sonuna gelince kapanan ileri/geri gibi düğmeler bu yüzden kapsam dışı.)
  var BUSY_WINDOW_MS=600,BUSY_MAX_MS=8000,BUSY_KIND=/primary|send|save|submit|confirm|danger/i;
  function watchBusy(){
    var last=null,at=0;
    function remember(event){
      var button=event.type==="submit"?event.submitter:(event.target&&event.target.closest?event.target.closest("button"):null);
      if(button){last=button;at=Date.now();}
    }
    document.addEventListener("click",remember,true);
    document.addEventListener("submit",remember,true);
    new MutationObserver(function(records){
      records.forEach(function(record){
        var button=record.target;
        if(button.tagName!=="BUTTON")return;
        if(!button.disabled){button.removeAttribute("data-motion-busy");return;}
        if(button!==last||Date.now()-at>BUSY_WINDOW_MS||motionOff())return;
        if(button.type!=="submit"&&!BUSY_KIND.test(button.className+" "+button.id))return;
        button.setAttribute("data-motion-busy","");
        setTimeout(function(){button.removeAttribute("data-motion-busy");},BUSY_MAX_MS);
      });
    }).observe(document.body,{attributes:true,attributeFilter:["disabled"],subtree:true});
  }

  // Pencere kapanınca asıl öğe anında gizlenir (panelin davranışı değişmez); kapanış, etkisiz bir kopyada oynar.
  var MODALS=".student-connect-backdrop,.coach-video-picker-backdrop,.program-task-backdrop,.coach-delete-backdrop,.student-v54-modal,.error-photo-modal,.coach-v41-drawer";
  var CLOSE_MS=180,GHOST_MAX_NODES=500;
  function isClosed(el){return el.classList.contains("hidden")||el.hasAttribute("hidden");}
  function ghostClose(el){
    if(motionOff()||el.getElementsByTagName("*").length>GHOST_MAX_NODES)return; // çok büyük pencere kopyalanmaz
    var ghost=el.cloneNode(true);
    ghost.classList.remove("hidden");ghost.removeAttribute("hidden");
    ghost.setAttribute("inert","");ghost.setAttribute("aria-hidden","true");ghost.setAttribute("data-motion-closing","");
    // Kopyadaki radyo düğmeleri asıl formdakilerle aynı gruba girip seçimi bozmasın.
    ghost.querySelectorAll("[name]").forEach(function(node){node.removeAttribute("name");});
    el.after(ghost); // asıldan sonra: aynı kimlikle aramalar yine asıl öğeyi bulur
    setTimeout(function(){ghost.remove();},CLOSE_MS);
  }
  function watchModals(){
    document.querySelectorAll(MODALS).forEach(function(el){
      var open=!isClosed(el);
      new MutationObserver(function(){
        var now=!isClosed(el);
        if(open&&!now)ghostClose(el);
        open=now;
      }).observe(el,{attributes:true,attributeFilter:["class","hidden"]});
    });
  }

  function install(){watchPages();watchStats();watchThread();watchStatus();watchBusy();watchModals();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
})();
