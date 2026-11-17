// Ayarlar › Görünüm'de seçilen tema ilk boyamadan önce uygulanır.
(function(){
  try{
    var theme=(JSON.parse(localStorage.getItem("yks_coach_ui_preferences_v2")||"{}")||{}).theme;
    if(["night","vivid","okyanus","orman","gunbatimi","geceyarisi"].indexOf(theme)>=0)document.documentElement.dataset.theme=theme;
  }catch(error){}
})();
