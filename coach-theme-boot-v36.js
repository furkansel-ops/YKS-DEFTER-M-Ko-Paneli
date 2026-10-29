// Ayarlar › Görünüm'de seçilen tema ilk boyamadan önce uygulanır.
(function(){
  try{
    var theme=(JSON.parse(localStorage.getItem("yks_coach_ui_preferences_v2")||"{}")||{}).theme;
    if(theme==="night"||theme==="vivid")document.documentElement.dataset.theme=theme;
  }catch(error){}
})();
