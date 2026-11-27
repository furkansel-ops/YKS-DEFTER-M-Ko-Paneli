/* Koç Paneli · v89 Video ekle — soldaki Ders, Hoca ve Konu açılır menüleri görünür listelere döner.
   Liste menünün etiketinin içine eklenir; seçim yine aynı <select>'e yazılır ve "change" gönderilir, böylece
   video yükleme (program-videos-v1.js) değişmez. Listeler yalnız Video ekle penceresinde görünür (coach-video-picker-v89.css). */
(function(root){
  "use strict";
  var LISTS=[["coachVideoSubject","subject","Ders"],["coachVideoTeacher","teacher","Hoca"],["coachVideoTopic","topic","Konu"]];
  var SUBJECT_KEYS={"Matematik":"math","Geometri":"geometry","Türkçe":"reading","Fizik":"physics","Kimya":"chemistry","Biyoloji":"biology","Edebiyat":"literature","Tarih":"history","Coğrafya":"geography","Felsefe":"philosophy","Din Kültürü":"religion"};
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
  function initials(name){return String(name||"").trim().split(/\s+/).map(function(part){return part.charAt(0);}).join("").slice(0,2).toLocaleUpperCase("tr-TR")||"?";}

  function render(select,kind,label){
    var box=document.getElementById(select.id+"V89");
    if(!box){
      box=document.createElement("div");box.id=select.id+"V89";box.className="coach-v89-list is-"+kind;
      box.setAttribute("role","group");box.setAttribute("aria-label",label);
      box.addEventListener("click",function(event){
        var button=event.target.closest("[data-v89-value]");
        if(!button||select.disabled)return;
        event.preventDefault();
        select.value=button.getAttribute("data-v89-value");
        select.dispatchEvent(new Event("change",{bubbles:true}));
        render(select,kind,label);
      });
      (select.closest("label")||select.parentNode).appendChild(box);
    }
    var options=Array.prototype.slice.call(select.options);
    box.hidden=select.disabled||!options.length;
    box.innerHTML=options.map(function(option){
      var value=option.value,name=option.textContent,on=value===select.value;
      var extra=kind==="subject"&&SUBJECT_KEYS[value]?' data-subject="'+SUBJECT_KEYS[value]+'"':"";
      return '<button type="button" data-v89-value="'+esc(value)+'" aria-pressed="'+on+'"'+extra+'>'
        +(kind==="teacher"?'<i aria-hidden="true">'+esc(initials(name))+'</i>':kind==="subject"?'<i aria-hidden="true"></i>':"")
        +'<span>'+esc(name)+'</span></button>';
    }).join("");
  }

  function watch(){
    LISTS.forEach(function(entry){
      var select=document.getElementById(entry[0]);
      if(!select||select.__v89)return;
      select.__v89=true;
      var redraw=function(){render(select,entry[1],entry[2]);};
      new MutationObserver(redraw).observe(select,{childList:true,attributes:true,attributeFilter:["disabled"]});
      select.addEventListener("change",redraw);
      redraw();
    });
  }

  root.CoachVideoListsV89={watch:watch,render:render};
  root.addEventListener("yks:coach-video-picker-open",function(){setTimeout(watch,0);});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch);else watch();
})(window);
