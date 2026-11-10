"use strict";
let state={configured:false,paused:false};
const status=document.getElementById("status");
function render(next){
  state=next;
  status.textContent=!state.configured?"Не настроено — доступ к вкладкам отключён.":state.paused?"Доступ приостановлен.":state.connected?"Подключено к локальному плагину.":state.connecting?"Подключение…":state.error||"Ожидание локального плагина.";
  document.getElementById("toggle").textContent=state.paused?"Возобновить доступ":"Приостановить доступ";
  for(const id of ["toggle","reconnect","forget"])document.getElementById(id).disabled=!state.configured;
}
async function update(message={type:"status"}){
  try{render(await browser.runtime.sendMessage(message));}catch(error){status.textContent=error.message;}
}
document.getElementById("pair").addEventListener("submit",async event=>{
  event.preventDefault();
  try{
    const file=document.getElementById("file").files[0];
    if(!file||file.size>4096)throw new Error("Выберите файл подключения размером до 4 КБ.");
    if(!document.getElementById("consent").checked)throw new Error("Сначала подтвердите разрешение.");
    let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error("Файл должен содержать JSON настройки подключения.");}
    const connection=validateConnection(parsed);
    render(await browser.runtime.sendMessage({type:"configure",connection,consent:true}));
    document.getElementById("pair").reset();
  }catch(error){status.textContent=error.message;}
});
document.getElementById("toggle").addEventListener("click",()=>update({type:"pause",paused:!state.paused}));
document.getElementById("reconnect").addEventListener("click",()=>update({type:"reconnect"}));
document.getElementById("forget").addEventListener("click",()=>update({type:"forget"}));
update();
setInterval(()=>{if(!document.getElementById("file").files.length)update();},2000);
