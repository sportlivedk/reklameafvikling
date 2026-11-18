// SPORT LIVE Reklameafvikling – forbindelse til Google Sheets via Apps Script.
// Indstillinger (adresse, logo, opdateringsinterval) ligger i js/config.js.
const {API_URL, LOGO_URL, OPDATER_MINUTTER} = window.SL_CONFIG || {};
// Logo: skiftes først ud, når billedet er hentet. Mangler filen, bliver tekstlogoet stående.
if(LOGO_URL){const sw=()=>{const w=document.getElementById("wm");if(!w)return;const i=new Image();i.alt="SPORT LIVE";i.style.height="26px";i.style.display="block";i.onload=()=>{if(w.isConnected)w.replaceWith(i);};i.src=LOGO_URL;};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sw);else sw();}
(function(){
  const KEY="sl-reklame-login";
  let auth=null;try{auth=JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){}
  const st={bookings:new Map(),docs:{"config/main":null,"config/kategorier":null,"status/godkendt":null},me:{email:"",role:"læser"},ver:null};
  const subs={col:[],colErr:[],doc:{}};let pending=0,loading=null,readyRes,ready=new Promise(r=>readyRes=r);
  async function call(action,...args){
    if(!/^https:\/\/script\.google\.com\//.test(API_URL))throw {code:"unavailable",message:"API_URL er ikke sat i js/config.js. Se vejledningen."};
    let r;try{r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,auth,args})});}
    catch(e){throw {code:"unavailable",message:"Ingen forbindelse til Google Sheets. Tjek internetforbindelsen."};}
    let j;try{j=await r.json();}catch(e){throw {code:"unavailable",message:"Uventet svar fra Apps Script. Er webappen udgivet med adgang for alle?"};}
    if(j.ok)return j.data;
    if(j.code==="AUTH"){logout(false);showLogin(j.error);throw {code:"auth",message:j.error};}
    if(j.code==="KONFLIKT")setTimeout(load,0); // en anden har ændret det samme: hent nyeste udgave
    throw {code:j.code==="ADGANG"||j.code==="REGEL"||j.code==="KONFLIKT"?"invalid_argument":"unavailable",message:j.error};}
  // ---- login-skærm ----
  function showLogin(msg){
    {const ex=document.getElementById("login");if(ex){const b=ex.querySelector("#li-err");if(msg&&b){b.hidden=false;b.textContent=msg;}return;}}
    const w=document.createElement("div");w.id="login";w.className="scrim";w.style.alignItems="center";
    w.innerHTML=`<form class="modal" style="width:min(400px,100%)" autocomplete="on"><header><h2 style="font-size:22px"><span class="onair" aria-hidden="true" style="margin-right:10px"></span>SPORT LIVE Reklameafvikling</h2></header>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">
        <div class="fld"><label for="li-e">E-mail</label><input id="li-e" type="text" inputmode="email" autocomplete="username" required></div>
        <div class="fld"><label for="li-k">Kode</label><input id="li-k" type="password" autocomplete="current-password" required></div>
        <div class="errbox" id="li-err" ${msg?"":"hidden"}></div>
        <button class="btn pri" type="submit" style="justify-content:center">Log ind</button>
        <p class="note" style="margin:0">Har du ikke en kode, så kontakt ejeren af systemet.</p></div></form>`;
    document.body.appendChild(w);if(msg)w.querySelector("#li-err").textContent=msg;
    const em=w.querySelector("#li-e");if(auth&&auth.email)em.value=auth.email;setTimeout(()=>(em.value?w.querySelector("#li-k"):em).focus(),0);
    w.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();e.stopPropagation();const btn=w.querySelector("button[type=submit]");btn.disabled=true;
      auth={email:em.value.trim().toLowerCase(),kode:w.querySelector("#li-k").value.trim()};
      try{await call("login");try{localStorage.setItem(KEY,JSON.stringify(auth));}catch(x){}w.remove();load();}
      catch(err){const b=w.querySelector("#li-err");b.hidden=false;b.textContent=err.message;btn.disabled=false;w.querySelector("#li-k").select();}});}
  function logout(reload){auth=auth?{email:auth.email}:null;try{localStorage.setItem(KEY,JSON.stringify(auth));}catch(e){}if(reload)location.reload();}
  window.slLogout=()=>logout(true);
  // ---- data ----
  const meta={fromCache:false,hasPendingWrites:false};
  const snapCol=()=>({docs:[...st.bookings.entries()].map(([id,d])=>({id,exists:true,data:()=>d,metadata:meta})),size:st.bookings.size,empty:!st.bookings.size,metadata:meta,docChanges:()=>[]});
  const snapDoc=p=>({id:p.split("/")[1],exists:!!st.docs[p],data:()=>st.docs[p]||undefined,metadata:meta});
  const emit=()=>{subs.col.forEach(f=>{try{f(snapCol());}catch(e){console.error(e);}});Object.keys(subs.doc).forEach(p=>subs.doc[p].forEach(f=>{try{f(snapDoc(p));}catch(e){console.error(e);}}));};
  let lastCheck=0;
  function ingest(s){lastCheck=Date.now();st.bookings=new Map((s.bookings||[]).map(b=>{const {id,...r}=b;return [id,r];}));st.docs["config/main"]=s.cfg||null;st.docs["config/kategorier"]=s.kat||null;st.docs["status/godkendt"]={uger:s.godkendt||{}};st.me=s.me||st.me;st.mails=s.mails||{};st.mailTest=s.mailTest||"";st.ver=s.version;readyRes();emit();}
  function load(){if(!auth||!auth.kode){showLogin();return Promise.resolve();}
    if(!loading)loading=call("getState").then(ingest).catch(e=>{if(e.code!=="auth"){readyRes();subs.colErr.forEach(f=>f&&f(e));}}).finally(()=>{loading=null;});return loading;}
  // Tjek for ændringer fra andre: hvert X. minut (config.js), og når man vender tilbage til fanen efter mindst 2 min.
  // Et tjek er et lille kald (kun et versionsnummer). Fulde data hentes kun, hvis noget er ændret.
  async function check(){if(document.hidden||pending||st.ver===null||!auth||!auth.kode)return;lastCheck=Date.now();try{const v=await call("getVersion");if(v!==st.ver)load();}catch(e){}}
  setInterval(check,Math.max(1,+OPDATER_MINUTTER||10)*60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-lastCheck>120000)check();});
  const genId=()=>"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  // base = bookingens tidsstempel, som siden kender det. Serveren afviser, hvis en anden har ændret den imens.
  const base=prev=>prev?String(prev.updatedAt||""):null;
  async function send(ops,undoFn){pending++;try{const r=await call("apply",ops);const same=r.version===String(+st.ver+1);st.ver=same?r.version:st.ver;
      Object.entries(r.stamps||{}).forEach(([id,t])=>{const b=st.bookings.get(id);if(b){b.updatedAt=t;b.updatedBy=st.me.email;}});
      if(!same)load(); // andre har gemt siden sidst: hent nyeste udgave
    }catch(e){undoFn();emit();throw e;}finally{pending--;}}
  function bookingRef(id){return {id,path:"bookings/"+id,
    set:async d=>{const prev=st.bookings.get(id);st.bookings.set(id,JSON.parse(JSON.stringify(d)));emit();await send([{op:"set",id,data:d,base:base(prev)}],()=>prev?st.bookings.set(id,prev):st.bookings.delete(id));},
    update:async p=>{const prev=st.bookings.get(id);if(!prev)throw {code:"invalid_argument",message:"Bookingen findes ikke længere."};st.bookings.set(id,{...prev,...p});emit();await send([{op:"update",id,data:p,base:base(prev)}],()=>st.bookings.set(id,prev));},
    delete:async()=>{const prev=st.bookings.get(id);st.bookings.delete(id);emit();await send([{op:"delete",id,base:base(prev)}],()=>{if(prev)st.bookings.set(id,prev);});}};}
  const db={
    collection:p=>({path:p,doc:id=>bookingRef(id||genId()),onSnapshot:(next,err)=>{subs.col.push(next);subs.colErr.push(err);if(st.ver!==null)setTimeout(()=>next(snapCol()),0);else load();return()=>{};}}),
    doc:p=>({id:p.split("/")[1],path:p,onSnapshot:(next)=>{(subs.doc[p]=subs.doc[p]||[]).push(next);if(st.ver!==null)setTimeout(()=>next(snapDoc(p)),0);else load();return()=>{};},
      set:async d=>{const fn={"config/main":"saveConfig","config/kategorier":"saveKat","status/godkendt":"saveGodkendt"}[p];if(!fn)throw {code:"invalid_argument",message:"Ukendt dokument"};const prev=st.docs[p];st.docs[p]=d;emit();pending++;try{const r=await call(fn,d);const same=r.version===String(+st.ver+1);st.ver=r.version;if(!same)load();}catch(e){st.docs[p]=prev;emit();throw e;}finally{pending--;}}})};
  const isEd=()=>st.me.role==="ejer"||st.me.role==="redaktør";const ensure=async()=>{if(st.ver===null)load();await ready;};
  const user={id:async()=>{await ensure();return st.me.email||null;},me:async()=>{await ensure();return {id:st.me.email};},can:async()=>{await ensure();return isEd();},canEdit:async()=>{await ensure();return isEd();},
    isOwner:async()=>{await ensure();return st.me.role==="ejer";},profiles:async ids=>Object.fromEntries((ids||[]).map(i=>[i,{name:i}]))};
  const MIME={xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pdf:"application/pdf",csv:"text/csv"};
  const downloads={save:async({filename,data})=>{const ext=(filename.split(".").pop()||"").toLowerCase();const blob=new Blob([data instanceof Blob?data:new Blob([data])],{type:MIME[ext]||""});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return {status:"saved"};}};
  window.claude={use:async n=>({db,user,downloads})[n]||null};
  // Slet et break med alle dets bookinger i ét kald
  async function deleteBreak(id){pending++;try{await call("deleteBreak",id);}finally{pending--;}await load();}
  // Send "ugen er klar"-mail til alle i fanen Brugere (via Apps Script / firmaets Google-konto)
  async function sendKlar(o){pending++;try{const r=await call("sendKlar",o);st.mails=st.mails||{};st.mails[r.key]={at:r.at,by:r.by,n:r.n,test:r.test||""};st.mailTest=r.test||"";emit();return r;}finally{pending--;}}
  window.__gas={st,load,deleteBreak,sendKlar};
})();
