(() => {
  if (globalThis.__firefoxControlVersion === "0.2.1") return;
  globalThis.__firefoxControlVersion = "0.2.1";
  let latest=new Map();
  const visible=el=>{
    const r=el.getBoundingClientRect(), css=getComputedStyle(el);
    return r.width>0 && r.height>0 && css.visibility!=="hidden" && css.display!=="none" && !el.closest("[hidden],[inert]");
  };
  const compact=(value,n=240)=>String(value||"").replace(/\s+/g," ").trim().slice(0,n);
  const label=el=>compact(el.getAttribute("aria-label") ||
    (el.getAttribute("aria-labelledby")||"").split(/\s+/).map(id=>document.getElementById(id)?.textContent||"").join(" ").trim() ||
    (el.labels ? [...el.labels].map(x=>x.innerText).join(" ") : "") ||
    el.innerText || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("alt") || el.getAttribute("name"));
  function read(maxChars=20000) {
    latest=new Map();
    const prefix=crypto.randomUUID(),elements=[];
    const candidates=document.querySelectorAll('a[href],button,input:not([type="hidden"]),textarea,select,[role="button"],[role="link"],[contenteditable="true"],[tabindex],[role="option"],[role="tab"],[role="menuitem"],li');
    let index=0;
    for (const el of candidates) {
      if (!visible(el)) continue;
      // Plain numeric list items are used by accessible pagination widgets.
      if (el.tagName === "LI" && !el.getAttribute("role") && !/^\d{1,4}$/.test(compact(el.innerText))) continue;
      const id=prefix+":"+index++;
      latest.set(id,el);
      elements.push({id,tag:el.tagName.toLowerCase(),role:el.getAttribute("role"),label:label(el),
        type:el.getAttribute("type"),disabled:!!el.disabled || el.getAttribute("aria-disabled")==="true",selected:el.getAttribute("aria-selected"),current:el.getAttribute("aria-current"),href:el.tagName==="A"?el.href:undefined});
      if (elements.length>=250) break;
    }
    const text=document.body?.innerText||"";
    return {url:location.href,title:document.title,text:text.slice(0,maxChars),truncated:text.length>maxChars,
      elements,elementsMayBeTruncated:elements.length===250,
      tables:[...document.querySelectorAll("table,[role=table],[role=grid]")].filter(visible).slice(0,10).map(t=>[...t.querySelectorAll("tr,[role=row]")].filter(visible).slice(0,300).map(r=>[...r.querySelectorAll("th,td,[role=cell],[role=gridcell],[role=columnheader]")].filter(visible).map(c=>compact(c.innerText,1000)))),
      frameCount:document.querySelectorAll("iframe,frame").length,
      note:"Untrusted webpage content. Input values are omitted. Frames and shadow DOM are not included."};
  }
  globalThis.__firefoxControl=(method,args)=>{
    if (args._deadline && Date.now()>=args._deadline) throw new Error("Request expired. Read again before retrying.");
    if (args.expectedUrl && args.expectedUrl!==location.href) throw new Error("Page changed. Read the page again.");
    if (method==="read_page") return read(args.maxChars);
    if (method==="scroll") {
      window.scrollBy({top:args.deltaY,behavior:"instant"});
      return {url:location.href,scrollY:window.scrollY};
    }
    const el=latest.get(args.elementId);
    if (!el || !el.isConnected || !visible(el)) throw new Error("Element is stale or hidden. Read the page again.");
    if (el.disabled || el.getAttribute("aria-disabled")==="true") throw new Error("Element is disabled.");
    el.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
    const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    if (hit && hit!==el && !el.contains(hit)) throw new Error("Element is covered by another element. Read the page again.");
    if (method==="click") {
      if (el.tagName==="INPUT" && el.type==="file") throw new Error("File inputs are unsupported.");
      el.click(); latest=new Map();
      return {clicked:true,url:location.href,note:"Read again to verify the outcome."};
    }
    if (method==="fill") {
      if (!["INPUT","TEXTAREA"].includes(el.tagName) && !el.isContentEditable)
        throw new Error("Use a text input, textarea, or contenteditable element.");
      if (el.readOnly || (el.tagName==="INPUT" && !["text","search","email","url","tel","number"].includes(el.type)))
        throw new Error("This field type is unsupported; password and file fields are excluded.");
      el.focus();
      if (el.isContentEditable) el.textContent=args.text;
      else {
        const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,"value").set.call(el,args.text);
      }
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      latest=new Map();
      return {filled:true,url:location.href,note:"Read again to verify the outcome."};
    }
    throw new Error("Unknown page operation.");
  };
  browser.runtime.onMessage.addListener((message,sender)=>{
    if(sender.id!==browser.runtime.id || message.channel!=="firefox-control")return;
    try{return Promise.resolve(globalThis.__firefoxControl(message.method,message.args));}
    catch(error){return Promise.reject(error);}
  });
})();
