/* Fail closed during auth bootstrap. Keep the current shell hidden instead of
   exposing a stale home screen if module imports fail or the network stalls. */
(()=>{
  const boot=document.getElementById("bootView");
  const appScript=document.querySelector("script[data-coach-app]");
  if(!boot||!appScript)return;
  function showRecovery(message){
    if(boot.classList.contains("hidden"))return;
    const messageNode=boot.querySelector("span");
    if(messageNode)messageNode.textContent=message;
    if(boot.querySelector(".coach-boot-retry"))return;
    const button=document.createElement("button");
    button.type="button";
    button.className="coach-boot-retry";
    button.textContent="Yeniden dene";
    button.addEventListener("click",()=>window.location.reload());
    boot.appendChild(button);
  }
  appScript.addEventListener("error",()=>{
    showRecovery("Bağlantı kurulamadı. Sayfayı yeniden açmayı deneyebilirsin.");
  });
  const timeout=window.setTimeout(()=>{
    showRecovery("Açılış uzun sürüyor. Bağlantını kontrol edip yeniden deneyebilirsin.");
  },15000);
  window.addEventListener("pagehide",()=>window.clearTimeout(timeout),{once:true});
})();
