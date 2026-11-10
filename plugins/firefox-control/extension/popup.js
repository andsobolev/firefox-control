"use strict";
let state={paused:false,configured:false};
async function update(message={type:"status"}) {
  try {
    state=await browser.runtime.sendMessage(message);
    document.getElementById("status").textContent=!state.configured?"Откройте настройки подключения":state.paused?"Доступ приостановлен":state.connected?"Подключено локально":state.connecting?"Подключение…":state.error||"Ожидание локального плагина";
    document.getElementById("toggle").textContent=state.paused?"Возобновить доступ":"Приостановить доступ";
    document.getElementById("toggle").disabled=!state.configured;
    document.getElementById("reconnect").disabled=!state.configured;
  } catch(error){document.getElementById("status").textContent=error.message;}
}
document.getElementById("toggle").addEventListener("click",()=>update({type:"pause",paused:!state.paused}));
document.getElementById("reconnect").addEventListener("click",()=>update({type:"reconnect"}));
document.getElementById("settings").addEventListener("click",()=>browser.runtime.openOptionsPage());
update();
setInterval(()=>update(),1000);
