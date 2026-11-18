// SPORT LIVE Reklameafvikling – selve systemet (overblik, planlægning, ugeplan, rapporter, regler)
(() => {
// Tema: mørk som standard, lys kan vælges. Huskes pr. browser.
try{const th=localStorage.getItem("sl-theme");if(th==="light")document.documentElement.dataset.theme="light";}catch(e){}
"use strict";
// ---------- Konstanter ----------
const DEFAULT_BREAKS = [
  {id:"RB1",navn:"Reklamebreak 1",type:"Reklamebreak",perDag:6,bumper:7,buffer:10,snit:true},
  {id:"RB2",navn:"Reklamebreak 2",type:"Reklamebreak",perDag:6,bumper:7,buffer:10,snit:true},
  {id:"RB3",navn:"Reklamebreak 3",type:"Reklamebreak",perDag:6,bumper:7,buffer:10,snit:true},
  {id:"RB4",navn:"Reklamebreak 4",type:"Reklamebreak",perDag:6,bumper:7,buffer:10,snit:true},
  {id:"PB1",navn:"Powerbreak 1",type:"Powerbreak",perDag:5,bumper:7,buffer:3,snit:true},
  {id:"PB2",navn:"Powerbreak 2",type:"Powerbreak",perDag:5,bumper:7,buffer:3,snit:true},
  {id:"SB1",navn:"Sponsorbreak 1",type:"Sponsorbreak",perDag:4,bumper:0,buffer:0,snit:false},
  {id:"SB2",navn:"Sponsorbreak 2",type:"Sponsorbreak",perDag:4,bumper:0,buffer:0,snit:false},
  {id:"SB3",navn:"Sponsorbreak 3",type:"Sponsorbreak",perDag:4,bumper:0,buffer:0,snit:false},
  {id:"SB4",navn:"Sponsorbreak 4",type:"Sponsorbreak",perDag:4,bumper:0,buffer:0,snit:false},
  {id:"SB5",navn:"Sponsorbreak 5",type:"Sponsorbreak",perDag:4,bumper:0,buffer:0,snit:false},
];
const TYPES = ["Reklamebreak","Powerbreak","Sponsorbreak"];
const TPRE = {Reklamebreak:"RB",Powerbreak:"PB",Sponsorbreak:"SB"};
// Ekstraordinære breaks: tæller kun med i kapacitet/belægning i uger, hvor de har spots
const hasBookings = id => all().some(x=>x.breakId===id);
const isX = b => !!(b&&(b.ekstra||/^X/.test(b.id)));
const ekstraTag = b => isX(b)?` <span class="xtag" title="Ekstraordinært break">Ekstra</span>`:"";
const KANALER = ["SPORT LIVE","Castory","TVR","Distributør","Egen promo"];
// Fra 2027 sælger Castory det, TVR solgte. Historikken før 2027 bevares som TVR.
const KANAL_SKIFT = {fra:2027, gammel:"TVR", ny:"Castory"};
const kanalFor = (year,k) => (+year>=KANAL_SKIFT.fra && k===KANAL_SKIFT.gammel) ? KANAL_SKIFT.ny : k;
const kanalerFor = year => KANALER.filter(k=>!(+year>=KANAL_SKIFT.fra && k===KANAL_SKIFT.gammel));
const KCLS = {"SPORT LIVE":"SL","Castory":"CA","TVR":"TVR","Distributør":"DI","Egen promo":"EG"};
const KVAR = {"SPORT LIVE":"--k-sl","Castory":"--k-ca","TVR":"--k-tvr","Distributør":"--k-di","Egen promo":"--k-eg"};
const STATUSER = ["Bekræftet","Option","Afventer film","Annulleret"];
const STCLS = {"Bekræftet":"st-ok","Option":"st-opt","Afventer film":"st-film","Annulleret":"st-ann"};
const MDR = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];

// ---------- Tilstand ----------
const S = {
  bookings: new Map(), cfg: {breaks: DEFAULT_BREAKS, dagePrUge: 7}, cfgVer: false,
  loaded: false, slow: false, err: null, canWrite: true, db: null, user: null, dl: null, meId: null,
  year: 0, week: 0, view: "ugeplan",
  bf: {q:"", type:"", kanal:"", status:"", aktiv:false},
  rf: null, modal: null, base:new Map(), baseReady:false, act:null, undo:[], tx:null, godk:{}, ugeAuto:false, histOpen:false, isOwner:null, rmode:"kunde", pv:{r:"kunde",c:"maaned",m:"sek"}, q:null, drag:null, kat:{kunder:{},kategorier:["Bank","Betting"],regler:[{a:"Bank",b:"Betting"}],eksklusiv:[]}, katDraft:null, pt:"Reklamebreak", pwin:"13", pq:"", lib:[], paint:null, dirty:false, collapsed:new Set(),
};

// ---------- Uge-matematik (ISO 8601) ----------
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-day+3);const y=t.getUTCFullYear();const j4=new Date(Date.UTC(y,0,4));const w=1+Math.round(((t-j4)/864e5-3+((j4.getUTCDay()+6)%7))/7);return [y,w];}
function weeksIn(y){const d=new Date(y,11,28);return isoWeek(d)[1];}
function weekMon(y,w){const j4=new Date(Date.UTC(y,0,4));const off=(j4.getUTCDay()+6)%7;const m=new Date(j4);m.setUTCDate(j4.getUTCDate()-off+(w-1)*7);return m;}
function weekLabel(y,w){const m=weekMon(y,w);const s=new Date(m);s.setUTCDate(m.getUTCDate()+6);
  const a=m.getUTCDate()+"."+(m.getUTCMonth()!==s.getUTCMonth()?" "+MDR[m.getUTCMonth()]:"");return a+"–"+s.getUTCDate()+". "+MDR[s.getUTCMonth()]+" "+s.getUTCFullYear();}
function dStr(d){return d.getUTCDate()+". "+MDR[d.getUTCMonth()]+" "+d.getUTCFullYear();}
function shiftWeek(y,w,d){w+=d;while(w<1){y--;w+=weeksIn(y);}while(w>weeksIn(y)){w-=weeksIn(y);y++;}return [y,w];}
const TODAY = isoWeek(new Date());
// Planlægning åbner på 2027 (systemet starter der). Ugeplan beholder sin egen uge.
const PLAN_START = Math.max(2027, TODAY[0]);
const planYears = () => {const ys=new Set([PLAN_START-1,PLAN_START,TODAY[0]+1]);all().forEach(b=>ys.add(+b.year));return [...ys].filter(x=>x>=2026).sort();};


// ---------- Hjælpere ----------
const $ = (s,r=document)=>r.querySelector(s);
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtN = n => Math.round(n).toLocaleString("da-DK");
function fmtDur(sec){sec=Math.round(sec);const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}
function fmtHours(sec){const h=sec/3600;return h>=10?fmtN(h)+" t":h.toLocaleString("da-DK",{maximumFractionDigits:1})+" t";}
function ranges(ws){ws=[...ws].sort((a,b)=>a-b);const o=[];let s=null,p=null;for(const w of ws){if(s===null){s=p=w;continue;}if(w===p+1){p=w;continue;}o.push(s===p?""+s:s+"–"+p);s=p=w;}if(s!==null)o.push(s===p?""+s:s+"–"+p);return o.join(", ");}
const brk = id => S.cfg.breaks.find(b=>b.id===id) || {id,navn:id,type:"?",perDag:0,bumper:0,buffer:0};
const spotsPrUge = b => (brk(b.breakId).perDag||0)*(S.cfg.dagePrUge||7);
const live = b => b.status!=="Annulleret";
function all(){return [...S.bookings.values()];}
function activeIn(y,w,breakId){return all().filter(b=>b.year===y&&live(b)&&(b.uger||[]).includes(w)&&(!breakId||b.breakId===breakId));}
function sortPos(a,b){const pa=a.pos??999,pb=b.pos??999;return pa-pb||a.kunde.localeCompare(b.kunde,"da");}
function kanalChip(k){return `<span class="chip"><span class="dot" style="background:var(${KVAR[k]||"--k-eg"})"></span>${esc(k)}</span>`;}
function statusChip(s){return `<span class="chip ${STCLS[s]||""}">${esc(s)}</span>`;}
function kunder(){return [...new Set(all().map(b=>b.kunde))].sort((a,b)=>a.localeCompare(b,"da"));}
function years(){const ys=new Set(all().map(b=>b.year));ys.add(TODAY[0]);ys.add(TODAY[0]+1);return [...ys].sort();}
let toastT;function toast(t){S.lastToast=t;let el=$("#toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";el.setAttribute("role","status");document.body.appendChild(el);}el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2600);}

function breakLen(y,w,id){const b=brk(id);const items=activeIn(y,w,id);if(!items.length)return 0;return items.reduce((s,x)=>s+(+x.sek||0),0)+(b.bumper||0);}
// Udgangspunkt for ændringer: længder som de var, da siden blev åbnet (eller sidst nulstillet)
function baseLen(y,w,id){const k=y+"|"+id+"|"+w;if(!S.base.has(k))S.base.set(k,breakLen(y,w,id));return S.base.get(k);}
function deltaHtml(d,cls="dl"){return d?`<span class="${cls} ${d>0?"up":"dn"}">${d>0?"+":"−"}${Math.abs(d)}s</span>`:"";}
function lenWith(y,w,breakId,bid,has){const b=brk(breakId);const items=activeIn(y,w,breakId).filter(x=>x.id!==bid);let sum=items.reduce((s,x)=>s+(+x.sek||0),0);const me=S.bookings.get(bid);let n=items.length;if(has&&me){sum+=+me.sek||0;n++;}return n?sum+(b.bumper||0):0;}
function primeBase(){if(S.baseReady)return;S.baseReady=true;for(const b of all())for(const w of b.uger)baseLen(b.year,w,b.breakId);for(const br of S.cfg.breaks)for(let w=1;w<=weeksIn(S.year);w++)baseLen(S.year,w,br.id);}
// ---------- Brancheregler ----------
const kat = k => (S.kat.kunder||{})[k]||"";
function clash(k1,k2){if(k1===k2)return false;const a=kat(k1),b=kat(k2);if(!a||!b)return false;
  if(a===b&&(S.kat.eksklusiv||[]).includes(a))return `to kunder fra ${a}`;
  return (S.kat.regler||[]).some(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a))?`${a} og ${b}`:false;}
// Konflikter i et break en given uge: liste af [kunde1,kunde2,årsag]
function conflictsIn(y,w,breakId){const ks=[...new Set(activeIn(y,w,breakId).map(x=>x.kunde))];const out=[];
  for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const c=clash(ks[i],ks[j]);if(c)out.push([ks[i],ks[j],c]);}return out;}
// Vil kunde k kollidere i break/uge? Returnerer {w,med,aarsag} pr. blokeret uge
function blocked(y,breakId,k,weeks,excludeId){const out=[];for(const w of weeks){for(const x of activeIn(y,w,breakId)){if(x.id===excludeId||x.kunde===k)continue;const c=clash(k,x.kunde);if(c){out.push({w,med:x.kunde,aarsag:c});break;}}}return out;}
function blockMsg(k,breakId,bl){const med=[...new Set(bl.map(b=>b.med))].join(", ");return `${k} (${kat(k)}) må ikke stå sammen med ${med} (${kat(bl[0].med)}) i ${brk(breakId).navn}, uge ${ranges(bl.map(b=>b.w))}.`;}
// Alle brud i hele databasen med en given brancheopsætning (bruges før nye regler/brancher gemmes)
function allConflicts(katSetup){const saved=S.kat;if(katSetup)S.kat=katSetup;const out=[];try{const seen=new Set();for(const b of all()){if(!live(b))continue;for(const w of b.uger){const k=b.year+"|"+b.breakId+"|"+w;if(seen.has(k))continue;seen.add(k);for(const c of conflictsIn(b.year,w,b.breakId))out.push({y:b.year,w,br:b.breakId,a:c[0],b:c[1]});}}}finally{S.kat=saved;}return out;}
function confSummary(cs){const g=new Map();for(const c of cs){const k=c.a+" + "+c.b+" i "+brk(c.br).navn+" ("+c.y+")";if(!g.has(k))g.set(k,[]);g.get(k).push(c.w);}return [...g].slice(0,6).map(([k,ws])=>k+", uge "+ranges(ws)).join("; ")+(g.size>6?` og ${g.size-6} flere`:"");}
const ktag = k => kat(k)?`<span class="ktag">${esc(kat(k))}</span>`:"";
// Ugens indhold som liste "break|kunde|sek" (bruges til at se ændringer efter godkendelse)
function weekSig(y,w){return activeIn(y,w).map(b=>b.breakId+"|"+b.kunde+"|"+b.sek).sort();}
function groupAvg(y,w,type){const bs=S.cfg.breaks.filter(b=>b.type===type&&b.snit);const L=bs.map(b=>breakLen(y,w,b.id)).filter(v=>v>0);return L.length?L.reduce((a,b)=>a+b,0)/L.length:0;}

// ---------- Rendering ----------
function render(){
  {const w=document.getElementById("who");if(w&&window.__gas&&__gas.st.me.email){w.textContent=__gas.st.me.email.split("@")[0].toUpperCase();w.title=__gas.st.me.email+" · "+__gas.st.me.role;document.getElementById("logout").hidden=false;}}
  {const tb=document.getElementById("thbtn");if(tb)tb.textContent=document.documentElement.dataset.theme==="light"?"☾":"☀︎";}
  try{drawHist();}catch(e){}
  if(S.paint){S.dirty=true;return;}
  document.querySelectorAll("#nav a,#gearbtn").forEach(a=>{if(a.getAttribute("href")==="#"+S.view)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  $("#wklbl").innerHTML=`Uge ${S.week} <span>· ${esc(weekLabel(S.year,S.week))}</span>`;
  {const hideW=(S.view==="rapporter"||S.view==="indstillinger");document.querySelectorAll("#wk [data-a=wk-prev],#wk [data-a=wk-next],#wk [data-a=wk-now],#wklbl").forEach(e=>e.style.display=hideW?"none":"");}
  const m=$("#main");
  if(S.err){m.innerHTML=`<div class="card pad"><h2>Data kan ikke hentes</h2><p class="muted">${esc(S.err)}</p></div>`;return;}
  if(!S.loaded){m.innerHTML=`<div class="empty">${S.slow?"Forbindelsen til databasen er langsom. Data vises, så snart den svarer.":"Henter afviklingsdata…"}</div>`;return;}
  const v={planlaegning:vPlan,dashboard:vDash,overblik:vDash,ugeplan:vUgeplan,bookinger:vBookinger,rapporter:vRapporter,indstillinger:vIndst}[S.view]||vOverblik;
  const NXT=shiftWeek(TODAY[0],TODAY[1],1);const weekViews=["dashboard","ugeplan"];const notNow=weekViews.includes(S.view)&&(S.year!==TODAY[0]||S.week!==TODAY[1])&&!(S.view==="ugeplan"&&S.year===NXT[0]&&S.week===NXT[1]);
  const wkBanner=notNow?`<div class="wkban" role="status"><span>Du ser <b>uge ${S.week}, ${S.year}</b> (${esc(weekLabel(S.year,S.week))}). Denne uge er uge ${TODAY[1]}.</span><button class="btn sm" data-a="wk-now">Gå til denne uge</button></div>`:"";
  document.getElementById("wk").classList.toggle("notnow",notNow);
  m.innerHTML=wkBanner+(S.slow?`<div class="banner small">Forbindelsen er ustabil. Det viste kan være forældet.</div>`:"")+(!S.canWrite?`<div class="banner small">Du har kun læseadgang. Bed ejeren om rollen redaktør.</div>`:"")+v();
  if(S.view==="rapporter")afterReport();
  if(S.view==="dashboard")drawYear();
}

// --- Overblik
function vOverblik(){
  const y=S.year,w=S.week,[ny,nw]=shiftWeek(y,w,1);
  const act=activeIn(y,w);const nxt=activeIn(ny,nw);
  const kset=new Set(act.map(b=>b.kunde));
  const sendDag=S.cfg.breaks.reduce((s,b)=>s+breakLen(y,w,b.id)*(b.perDag||0),0);
  const film=act.filter(b=>b.status==="Afventer film");
  const keyOf=b=>b.kunde+"|"+b.breakId;
  const nowK=new Set(act.map(keyOf)),nxtK=new Set(nxt.map(keyOf));
  const starter=groupBy(nxt.filter(b=>!nowK.has(keyOf(b))),b=>b.kunde);
  const slutter=groupBy(act.filter(b=>!nxtK.has(keyOf(b))),b=>b.kunde);
  const maxLen=Math.max(1,...S.cfg.breaks.map(b=>breakLen(y,w,b.id)));
  // år til dato
  const ytd=aggregate({year:y,fra:1,til:w});
  const top=ytd.perKunde.slice(0,8);const tmax=Math.max(1,...top.map(r=>r.sek));
  const kan=ytd.perKanal;const ksum=kan.reduce((s,r)=>s+r.sek,0)||1;
  return `
  <div class="row between"><h2>Uge ${w}, ${y}</h2><div class="row"><button class="btn" data-a="go" data-v="ugeplan">Åbn ugeplan</button>${S.canWrite?`<button class="btn pri" data-a="new">+ Ny booking</button>`:""}</div></div>
  <div class="tiles">
    <div class="card tile"><div class="k">Aktive bookinger</div><div class="v">${act.length}</div><div class="s">${kset.size} kunder i luften</div></div>
    <div class="card tile"><div class="k">Reklametid pr. dag</div><div class="v">${fmtDur(sendDag)}</div><div class="s">alle breaks inkl. ind/ud</div></div>
    <div class="card tile"><div class="k">Snit reklamebreak</div><div class="v">${fmtDur(groupAvg(y,w,"Reklamebreak"))}</div><div class="s">Powerbreak ${fmtDur(groupAvg(y,w,"Powerbreak"))}</div></div>
    ${(()=>{const c=S.cfg.breaks.flatMap(b=>conflictsIn(y,w,b.id).map(x=>b.id+": "+x[0]+" + "+x[1]));return `<div class="card tile"><div class="k">Brancheregler</div><div class="v" style="color:${c.length?"var(--bad)":"inherit"}">${c.length}</div><div class="s">${c.length?esc(c.join(" · ")):"Ingen konflikter i uge "+w}</div></div>`;})()}
    <div class="card tile"><div class="k">Afventer film</div><div class="v" style="color:${film.length?"var(--warn)":"inherit"}">${film.length}</div><div class="s">${film.length?esc([...new Set(film.map(b=>b.kunde))].join(", ")):"Alle spots er på plads"}</div></div>
  </div>
  <div class="grid2">
    <div class="card pad"><div class="row between"><h3>Ændringer til uge ${nw}</h3><span class="note">sammenlignet med uge ${w}</span></div>
      <div class="grid2" style="gap:14px;margin-top:10px">
        <div><div class="tag-new">Starter</div>${listKB(starter)}</div>
        <div><div class="tag-end">Stopper efter uge ${w}</div>${listKB(slutter)}</div>
      </div>
    </div>
    <div class="card pad"><h3>Breaklængde uge ${w}</h3>
      <table style="margin-top:8px"><tbody>${S.cfg.breaks.map(b=>{const L=breakLen(y,w,b.id);const n=activeIn(y,w,b.id).length;return `<tr><td style="width:140px;white-space:nowrap">${esc(b.navn)}</td><td><div class="bar"><i style="width:${L/maxLen*100}%"></i></div></td><td class="n" style="width:60px"><b>${fmtDur(L)}</b></td><td class="n muted small" style="width:64px">${n} spots</td></tr>`;}).join("")}</tbody></table>
    </div>
  </div>
  <div class="grid2">
    <div class="card pad"><div class="row between"><h3>Største kunder, år til dato</h3><button class="btn sm ghost" data-a="go" data-v="rapporter">Se rapport</button></div>
      <table style="margin-top:8px"><tbody>${top.map(r=>`<tr class="click" data-a="rep-kunde" data-k="${esc(r.kunde)}"><td>${esc(r.kunde)}</td><td><div class="bar"><i style="width:${r.sek/tmax*100}%"></i></div></td><td class="n"><b>${fmtHours(r.sek)}</b></td><td class="n muted small">${fmtN(r.spots)} visn.</td></tr>`).join("")||`<tr><td class="muted">Ingen data</td></tr>`}</tbody></table>
    </div>
    <div class="card pad"><h3>Sendetid pr. salgskanal, år til dato</h3>
      <div style="display:flex;height:14px;border-radius:4px;overflow:hidden;margin:14px 0 12px">${kan.map(r=>`<i title="${esc(r.kanal)}" style="width:${r.sek/ksum*100}%;background:var(${KVAR[r.kanal]||"--k-eg"})"></i>`).join("")}</div>
      <table><tbody>${kan.map(r=>`<tr><td><span class="sw" style="background:var(${KVAR[r.kanal]||"--k-eg"})"></span>${esc(r.kanal)}</td><td class="n">${fmtHours(r.sek)}</td><td class="n muted">${(r.sek/ksum*100).toLocaleString("da-DK",{maximumFractionDigits:0})} %</td><td class="n muted small">${r.kunder} kunder</td></tr>`).join("")}</tbody></table>
    </div>
  </div>`;
}
function groupBy(arr,f){const m=new Map();for(const x of arr){const k=f(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0],"da"));}
function listKB(g){if(!g.length)return `<p class="muted small">Ingen</p>`;return `<ul class="list-plain small">${g.map(([k,bs])=>`<li><span>${esc(k)}</span><span class="muted">${esc(bs.map(b=>b.breakId).sort().join(" "))}</span></li>`).join("")}</ul>`;}

// --- Planlægning
function planWeeks(){const nW=weeksIn(S.year);const k=S.pwin;
  if(k==="aar")return [1,nW];if(k==="Q1")return [1,13];if(k==="Q2")return [14,26];if(k==="Q3")return [27,39];if(k==="Q4")return [40,nW];
  let a=Math.max(1,S.week-1);let b=Math.min(nW,a+12);a=Math.max(1,b-12);return [a,b];}
function library(){const m=new Map();
  for(const b of all()){const k=b.kunde+"|"+(b.spot||"")+"|"+b.sek;const o=m.get(k);if(!o||(b.year>o.year))m.set(k,{kunde:b.kunde,sek:+b.sek,kanal:b.kanal,spot:b.spot||"",year:b.year});}
  for(const x of S.lib){const k=x.kunde+"|"+(x.spot||"")+"|"+x.sek;if(!m.has(k))m.set(k,x);}
  return [...m.values()].sort((a,b)=>a.kunde.localeCompare(b.kunde,"da")||(a.spot?0:1)-(b.spot?0:1)||(a.spot||"").localeCompare(b.spot||"","da",{numeric:true})||a.sek-b.sek);}
// Et spot = kunde + spotnavn + længde
const libFind=(k,sp,s)=>library().find(x=>x.kunde===k&&(x.spot||"")===(sp||"")&&+x.sek===+s)||library().find(x=>x.kunde===k&&+x.sek===+s)||{kanal:"Castory",spot:sp||""};
const sameSpot=(x,k,sp,s)=>x.kunde===k&&+x.sek===+s&&(x.spot||"")===(sp||"");
const spotLbl=sp=>sp?esc(sp):`<span class="spmiss">Uden navn</span>`;
function libList(lib,kfn){if(!lib.length)return `<p class="muted small">Ingen kunder eller spots matcher</p>`;let out="",cur=null;
  for(const x of lib){if(x.kunde!==cur){if(cur!==null)out+=`</div>`;cur=x.kunde;out+=`<div class="lkg"><div class="lkh"><b>${esc(x.kunde)}</b>${kat(x.kunde)?`<span class="ktag">${esc(kat(x.kunde))}</span>`:""}</div>`;}
    out+=`<div class="dchip spchip" draggable="${S.canWrite!==false}" data-k="${esc(x.kunde)}" data-sp="${esc(x.spot||"")}" data-s="${x.sek}" style="border-left-color:var(${KVAR[kfn(x.kanal)]||"--k-eg"})" title="${esc(x.kunde+" · "+(x.spot||"spot uden navn")+" · "+x.sek+" sek · "+kfn(x.kanal))}"><b>${spotLbl(x.spot)}</b><span>${x.sek}s</span></div>`;}
  return out+`</div>`;}
const spotOpts=k=>library().filter(x=>x.kunde===k&&x.spot).map(x=>`<option value="${esc(x.spot)}">${x.sek}s</option>`).join("");
// Kampagnens første og sidste uge for et spot i et break (pauser undervejs tæller ikke). Fortsætter over årsskiftet = ingen markering.
function campSpan(y,breakId,x){const ws=new Set();for(const b of all())if(+b.year===+y&&b.breakId===breakId&&live(b)&&sameSpot(b,x.kunde,x.spot,x.sek))b.uger.forEach(u=>ws.add(+u));
  if(!ws.size)return {start:null,end:null};let start=Math.min(...ws),end=Math.max(...ws);const nW=weeksIn(y);
  const runs=(yy,wk)=>all().some(b=>+b.year===yy&&b.breakId===breakId&&live(b)&&sameSpot(b,x.kunde,x.spot,x.sek)&&b.uger.includes(wk));
  if(start===1&&runs(+y-1,weeksIn(+y-1)))start=null;if(end===nW&&runs(+y+1,1))end=null;return {start,end};}
const libMatch=q=>x=>!q||x.kunde.toLowerCase().includes(q)||(x.spot||"").toLowerCase().includes(q);
function vPlan(){
  const y=S.year,[a,z]=planWeeks();const t=S.pt;const q=S.pq.trim().toLowerCase();
  const tabs=TYPES.map(tp=>{const n=S.cfg.breaks.filter(b=>b.type===tp).reduce((s,b)=>s+activeIn(y,S.week,b.id).length,0);return `<button class="${tp===t?"on":""}" data-a="ptab" data-t="${tp}">${tp}s <span>${n} spots i uge ${S.week}</span></button>`;}).join("");
  const wins=[["13","13 uger"],["Q1","Q1"],["Q2","Q2"],["Q3","Q3"],["Q4","Q4"],["aar","Hele året"]];
  const lib=library().filter(libMatch(q));
  const ws=[];for(let w=a;w<=z;w++)ws.push(w);
  const mon=w=>weekMon(y,w);const isM=w=>w===a||mon(w).getUTCMonth()!==mon(w-1).getUTCMonth();
  const head=`<tr><th class="lc" style="text-align:left;font-size:12px;color:var(--muted)">Kunde · sek</th>${ws.map(w=>{const cur=y===TODAY[0]&&w===TODAY[1];const sel=w===S.week;return `<th class="w${isM(w)?" m":""}${cur?" cur":""}" title="Uge ${w}: ${esc(weekLabel(y,w))}"><i>${isM(w)?MDR[mon(w).getUTCMonth()]:""}</i><a href="#" data-a="pweek" data-w="${w}" style="color:inherit;text-decoration:${sel?"underline":"none"}">${w}</a></th>`;}).join("")}</tr>`;
  const blocks=S.cfg.breaks.filter(b=>b.type===t).map(b=>{
    const rows=all().filter(x=>x.year===y&&x.breakId===b.id&&live(x)&&(!q||x.kunde.toLowerCase().includes(q)));
    const vis=rows.filter(x=>x.uger.some(w=>w>=a&&w<=z)).sort(sortPos);const hidden=rows.length-vis.length;
    const col=S.collapsed.has(b.id);
    const lens=ws.map(w=>breakLen(y,w,b.id));const M=maksOf(b);const Lw=breakLen(y,S.week,b.id);const cfw=new Map(ws.map(w=>[w,conflictsIn(y,w,b.id)]).filter(([,c])=>c.length));const avg=groupAvg(y,S.week,t);
    const body=col?"":vis.map(x=>{const set=new Set(x.uger);const kc=`var(${KVAR[x.kanal]||"--k-eg"})`;
      return `<tr><td class="lc" title="${esc(x.kunde+(x.spot?" · "+x.spot:"")+(x.note?" · "+x.note:""))}"><div class="lci"><span class="sw" style="background:${kc}"></span><a href="#" data-a="edit" data-id="${esc(x.id)}">${esc(x.kunde)}</a><small>${x.sek}s</small>${ktag(x.kunde)}${x.status!=="Bekræftet"?` <span class="chip ${STCLS[x.status]}" style="font-size:10px;padding:0 5px">${esc(x.status)}</span>`:""}${S.canWrite!==false?`<span class="rowact"><button class="btn ghost icon sm" data-a="swap" data-id="${esc(x.id)}" title="Skift kunde ud" aria-label="Skift ${esc(x.kunde)} ud">⇄</button><button class="btn ghost icon sm danger" data-a="rm" data-id="${esc(x.id)}" title="Fjern kunde" aria-label="Fjern ${esc(x.kunde)}">✕</button></span>`:""}</div></td>${ws.map(w=>{const on=set.has(w);const st=on&&(w===a||!set.has(w-1)),en=on&&(w===z||!set.has(w+1));let rl=0;if(st){while(set.has(w+rl)&&w+rl<=z)rl++;}return `<td class="c${on?" on":""}${st?" s":""}${en?" e":""}${set.has(w)&&(cfw.get(w)||[]).some(c=>c[0]===x.kunde||c[1]===x.kunde)?" cf":""}${y===TODAY[0]&&w===TODAY[1]?" cur":""}" style="--kc:${kc}${st?`;--rl:${rl}`:""}"${st&&rl>=2?` data-lbl="${esc(x.kunde+(x.spot?" · "+x.spot:"")+" · "+x.sek+"s")}"`:""} data-id="${esc(x.id)}" data-b="${b.id}" data-w="${w}"></td>`;}).join("")}</tr>`;}).join("")
      +`<tr class="drop"><td class="lc">Træk en kunde hertil</td>${ws.map(w=>`<td class="c${y===TODAY[0]&&w===TODAY[1]?" cur":""}" data-b="${b.id}" data-w="${w}"></td>`).join("")}</tr>`;
    const lenRow=`<tr class="len"><td class="lc">Længde${b.bumper?` inkl. ${b.bumper}s ind/ud`:""}</td>${lens.map((L,i)=>`<td class="${t!=="Sponsorbreak"&&avg&&L>avg*1.15?"hi":""}${cfw.has(ws[i])?" cf":""}${y===TODAY[0]&&ws[i]===TODAY[1]?" cur":""}" data-lb="${b.id}" data-lw="${ws[i]}" title="Uge ${ws[i]}: ${fmtDur(L)}${M?" af maks "+fmtDur(M)+" ("+Math.round(L/M*100)+" %)":""}${cfw.has(ws[i])?" · Brancheregel brudt: "+esc(cfw.get(ws[i]).map(c=>c[0]+" + "+c[1]).join(", ")):""}">${M?`<div class="gz"><i class="${pctCls(L/M)}" style="height:${Math.min(L/M,1.25)/1.25*100}%"></i><b></b></div>`:""}<span class="lv">${L?fmtDur(L):"–"}</span>${deltaHtml(L-baseLen(y,ws[i],b.id))}</td>`).join("")}</tr>`;
    return `<section class="card pblk"><header><div class="row" style="gap:10px"><button class="btn ghost icon sm" data-a="pcol" data-b="${b.id}" aria-expanded="${!col}" aria-label="Fold ${esc(b.navn)}">${col?"▸":"▾"}</button><h3>${esc(b.navn)}</h3>${ekstraTag(b)}${isX(b)&&S.isOwner!==false?`<button class="btn ghost icon sm danger rmx" data-a="rm-brk" data-id="${b.id}" title="Slet ${esc(b.navn)}" aria-label="Slet ${esc(b.navn)}">🗑</button>`:""}<span class="note">${b.perDag} gange dagligt · ${vis.length} kunder i perioden${hidden?` · ${hidden} uden for perioden`:""}</span>${cfw.size?`<span class="conf small">Brancheregel brudt i uge ${esc(ranges([...cfw.keys()]))}</span>`:""}</div>
      <div class="hgz"><span class="note">Uge ${S.week}</span><b class="num">${fmtDur(Lw)}</b>${deltaHtml(Lw-baseLen(y,S.week,b.id),"dlt")}${M?`<div class="blb" title="${fmtDur(Lw)} af maks ${fmtDur(M)}"><i class="${pctCls(Lw/M)}" style="width:${Math.min(Lw/M,1.25)/1.25*100}%"></i><b style="left:${100/1.25}%"></b></div><span class="note num">${Math.round(Lw/M*100)} % af ${fmtDur(M)}</span>`:""}</div></header>
      <div class="pg"><table style="width:max(100%, ${240+ws.length*32}px)"><thead>${head}</thead><tbody>${body}${lenRow}</tbody></table></div></section>`;}).join("");
  const libHtml=libList(lib,k=>kanalFor(S.year,k));
  return `<div class="row between"><div class="row" style="gap:14px"><h2>Planlægning ${y}</h2><div class="seg" role="group" aria-label="Vælg år">${planYears().map(x=>`<button class="${x===y?"on":""}" data-a="pyear" data-y="${x}">${x}</button>`).join("")}</div></div><div class="row"><div class="seg" role="group" aria-label="Periode">${wins.map(([k,l])=>`<button class="${S.pwin===k?"on":""}" data-a="pwin" data-k="${k}">${l}</button>`).join("")}</div>${S.canWrite!==false?`<button class="btn pri" data-a="new">+ Ny booking</button>`:""}</div></div>
  <div class="tabs" role="tablist">${tabs}</div>
  ${(()=>{let n=0,tot=0;for(const [k,v] of S.base){const [yy,id,w]=k.split("|");if(+yy!==y)continue;const d=breakLen(y,+w,id)-v;if(d){n++;tot+=d;}}return n?`<div class="banner small row between" style="background:var(--surface);border-color:var(--line)"><span>Ændringer siden du åbnede siden: <b>${n}</b> break-uger ændret, i alt <b>${tot>0?"+":"−"}${Math.abs(tot)} sek</b>. Tallene under hvert break viser ændringen pr. uge.</span><button class="btn sm" data-a="base-reset">Nulstil ændringer</button></div>`:"";})()}
  <div class="plan">
    ${libPanel("Træk en kunde ind i en uge. Klik eller træk hen over ugerne for at forlænge.")}
    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="legend">${kanalerFor(y).map(k=>`<span><span class="sw" style="background:var(${KVAR[k]})"></span>${k}</span>`).join("")}<span><span class="sw" style="background:var(--accent-soft);outline:1px solid var(--accent)"></span>Valgt uge ${S.week}</span><span class="lgz"><i class="ok"></i><i class="warn"></i><i class="bad"></i>Længde mod maks</span><span style="color:var(--accent);font-weight:600">Orange tal = over 15 % over snittet</span></div>
      ${blocks}
    </div>
  </div>`;
}
async function setWeeks(id,uger,quiet){const b=S.bookings.get(id);if(!b)return;let nu=[...new Set(uger)].sort((a,b)=>a-b);
  const added=nu.filter(w=>!b.uger.includes(w));const bl=blocked(b.year,b.breakId,b.kunde,added,b.id);
  if(bl.length){const bw=new Set(bl.map(x=>x.w));nu=nu.filter(w=>!bw.has(w));toast("Ikke tilladt: "+blockMsg(b.kunde,b.breakId,bl));quiet=true;render();}
  if(nu.join()===b.uger.join())return;
  if(!quiet){const add=nu.filter(w=>!b.uger.includes(w)),del=b.uger.filter(w=>!nu.includes(w));const parts=[];if(add.length)parts.push(`+${b.sek}s i uge ${ranges(add)}`);if(del.length)parts.push(`−${b.sek}s i uge ${ranges(del)}`);toast(`${b.kunde}, ${brk(b.breakId).navn}: ${parts.join(" · ")}`);}
  if(!nu.length){toast("Bookingen har ingen uger. Slet den i bookingvinduet, hvis den skal væk.");}
  await dbUpdate(id,{uger:nu});}
async function dropLib(kunde,sek,breakId,w,spot=""){
  const bl=blocked(S.year,breakId,kunde,[w]);if(bl.length){toast("Ikke tilladt: "+blockMsg(kunde,breakId,bl));return;}
  const ex=all().find(x=>x.year===S.year&&x.breakId===breakId&&sameSpot(x,kunde,spot,sek)&&live(x));
  if(ex){if(ex.uger.includes(w)){toast(`${kunde}${spot?" · "+spot:""} kører allerede i uge ${w}`);return;}await setWeeks(ex.id,[...ex.uger,w]);return;}
  const src=libFind(kunde,spot,sek);
  const id=S.db.collection("bookings").doc().id;
  if(await writeDoc(id,clean({year:S.year,breakId,kunde,kanal:src.kanal,spot:spot||"",sek:+sek,pos:null,uger:[w],status:"Bekræftet",note:"",ordrenr:""})))toast(`${kunde} lagt i ${brk(breakId).navn}, uge ${w}: +${sek}s`);
}
// --- Ugeplan
function libPanel(hint){
  const q=S.pq.trim().toLowerCase();const lib=library().filter(libMatch(q));
  const libHtml=libList(lib,k=>kanalFor(S.year,k));
  return `<aside class="card lib"><div class="hd"><h3>Kunder og spots</h3><input type="search" id="pq" data-pq="1" placeholder="Søg kunde eller spot" value="${esc(S.pq)}" aria-label="Søg kunde eller spot">
      <p class="note" style="margin:0">${hint}</p>
      ${S.canWrite!==false?`<details><summary class="small" style="cursor:pointer;font-weight:600">+ Nyt spot</summary><div style="display:grid;gap:6px;margin-top:8px"><input type="text" id="nl-k" placeholder="Kunde" aria-label="Kunde" list="nl-kl"><datalist id="nl-kl">${kunder().map(k=>`<option value="${esc(k)}">`).join("")}</datalist><input type="text" id="nl-sp" placeholder="Spotnavn, fx R018 Julekampagne" aria-label="Spotnavn" maxlength="80"><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" id="nl-s" placeholder="Sek" min="1" style="width:70px" aria-label="Sekunder"><select id="nl-ka" aria-label="Salgskanal" style="flex:1">${kanalerFor(S.year).map(k=>`<option>${k}</option>`).join("")}</select></div><button class="btn sm" data-a="nl-add">Tilføj spot</button></div></details>`:""}</div>
      <div class="ls">${libHtml}</div></aside>`;}
function vUgeplan(){
  const y=S.year,w=S.week,[py,pw]=shiftWeek(y,w,-1),[ny,nw]=shiftWeek(y,w,1);
  const sec=TYPES.map(t=>{
    const bs=S.cfg.breaks.filter(b=>b.type===t&&(!isX(b)||activeIn(y,w,b.id).length||!hasBookings(b.id)));
    const avg=groupAvg(y,w,t);const b0=bs[0]||{};
    const tot=bs.reduce((s2,b)=>s2+breakLen(y,w,b.id),0),totP=bs.reduce((s2,b)=>s2+breakLen(py,pw,b.id),0),totB=bs.reduce((s2,b)=>s2+baseLen(y,w,b.id),0);
    const totH=`<span class="note">I alt <b class="num" style="color:var(--ink)">${fmtDur(tot)}</b>${deltaHtml(tot-totB,"dlt")}</span>`;
    const head=t==="Sponsorbreak"?`<span class="note">${b0.perDag||0} afmeldinger pr. dag (intro/outro)</span>`:
      `<div class="mtsum"><div><span>Gennemsnit alle breaks i sek.</span><b class="num">${Math.round(avg)}</b></div><div><span>Gennemsnit alle breaks i min.</span><b class="num">${fmtDur(Math.round(avg))}</b></div><div class="pl"><span>Placeholder tid i MediaTool</span><b class="num">${fmtDur(Math.round(avg)+(b0.buffer||0))}</b><small>snit + ${b0.buffer||0} sek</small></div></div>`;
    return `<section class="ugsec" style="display:flex;flex-direction:column;gap:10px"><div class="row between"><div class="row" style="gap:14px"><h3>${t}s</h3>${totH}${S.isOwner!==false?`<button class="btn sm addx" data-a="add-brk" data-t="${t}" title="Opret et ekstraordinært ${t.toLowerCase()}">+ Ekstra ${t.toLowerCase()}</button>`:""}</div>${head}</div>
      <div class="hrow">${bs.map(b=>breakCard(b,y,w,py,pw,ny,nw)).join("")}</div></section>`;}).join("");
  const gk=S.godk[y+"-"+w];let changedAfter=[];
  if(gk&&Array.isArray(gk.sig)){const cur=new Set(weekSig(y,w)),old=new Set(gk.sig);const add=[...cur].filter(x=>!old.has(x)),rem=[...old].filter(x=>!cur.has(x));
    changedAfter=[...add.map(x=>({kunde:"+ "+x.split("|")[1]+" ("+x.split("|")[0]+")"})),...rem.map(x=>({kunde:"− "+x.split("|")[1]+" ("+x.split("|")[0]+")"}))];}
  const mk=`${y}-${String(w).padStart(2,"0")}`,ml=(window.__gas&&__gas.st.mails||{})[mk];
  const canMail=!!(window.__gas&&__gas.sendKlar&&S.canWrite!==false),mtest=window.__gas&&__gas.st.mailTest,cw2=S.canWrite!==false;
  const dt=x=>esc(new Date(x).toLocaleString("da-DK",{dateStyle:"short",timeStyle:"short"}));
  const mailInfo=ml?`<span class="gki">✉ Mail sendt ${dt(ml.at)}${ml.test?" (test)":` til ${ml.n}`}</span>`:"";
  const testTag=canMail&&mtest?`<span class="mtest" title="Mailen sendes kun til ${esc(mtest)}, indtil testtilstanden slås fra i Code.gs">TEST · kun til ${esc(mtest)}</span>`:"";
  const gkBox=gk
    ?`<div class="gk ${changedAfter.length?"warn":"ok"}"><span class="gkd" aria-hidden="true">${changedAfter.length?"!":"✓"}</span><b>${changedAfter.length?`Uge ${w} er ændret efter godkendelse`:`Uge ${w} er godkendt`}</b><span class="gki">${esc(gk.by||"ukendt")} · ${dt(gk.at)}${changedAfter.length?` · ${changedAfter.length} ændring${changedAfter.length===1?"":"er"}: ${esc(changedAfter.map(b=>b.kunde).slice(0,4).join(", "))}${changedAfter.length>4?" …":""}`:""}</span>${mailInfo}<span class="gksp"></span>${testTag}
      ${cw2?`${changedAfter.length?`<button class="btn sm pri" data-a="${canMail?"godk-mail":"godk"}">${canMail?"Godkend igen og send mail":"Godkend igen"}</button>`:""}${canMail?`<button class="btn sm${changedAfter.length?" ghost":""}" data-a="sendklar">✉ ${ml?"Send mail igen":"Send mail"}</button>`:""}<button class="btn sm ghost" data-a="ugodk">Fjern godkendelse</button>`:""}</div>`
    :`<div class="gk"><span class="gkd" aria-hidden="true">○</span><b>Uge ${w} er ikke godkendt</b><span class="gki" title="Godkend, når listen er klar til afvikling. Så kan Castory og Continuity se, at den er færdig.">Godkend, når listen er klar</span>${mailInfo}<span class="gksp"></span>${testTag}
      ${cw2?(canMail?`<button class="btn sm pri" data-a="godk-mail" title="Godkender ugen og sender mail med link til alle i fanen Brugere">✓ Godkend og send mail</button><button class="btn sm ghost" data-a="godk">Kun godkend</button>`:`<button class="btn sm pri" data-a="godk">Godkend uge ${w}</button>`):""}</div>`;
  return `<div class="row between noprint"><div class="row" style="gap:14px"><h2>Afviklingsliste uge ${w}</h2><span class="note wkl">${esc(weekLabel(y,w))}</span><div class="seg" role="group" aria-label="Vælg uge">${(()=>{const [ny2,nw2]=shiftWeek(TODAY[0],TODAY[1],1);return `<button class="${y===TODAY[0]&&w===TODAY[1]?"on":""}" data-a="wk-now">Denne uge (${TODAY[1]})</button><button class="${y===ny2&&w===nw2?"on":""}" data-a="wk-nextnow">Næste uge (${nw2})</button>`;})()}</div><details class="helpd"><summary class="btn sm ghost" title="Hjælp og genveje">? Hjælp</summary><div class="helpp card pad">
      <p><b>Sådan arbejder du</b><br>Træk et spot fra listen ind i et break. Slip oven på en reklame for at bytte. Træk mellem breaks for at flytte eller kopiere. Træk ned i skraldespanden for at fjerne.</p>
      <p><b>Mærker</b><br><span class="tag-new">Starter</span> = kampagnens første uge · <span class="tag-end">Slutter</span> = kampagnens sidste uge · Pauser undervejs markeres ikke · Tallet foran er rækkefølgen i breaket.</p>
      <p><b>Genveje</b><br>Ctrl+Z fortryd · 1–3 vælg periode i dialogen · F/K flyt eller kopiér · Esc luk.</p></div></details></div>
    <div class="row"><button class="btn" data-a="copy-week">Kopiér som tekst</button>${S.dl?`<button class="btn" data-a="xlsx-week">Hent Excel</button>`:""}${S.canWrite!==false?`<button class="btn pri" data-a="new">+ Ny booking</button>`:""}</div></div>

    ${gkBox}
    <div class="plan">${libPanel("Træk en kunde ind i et break. Slip oven på en kunde for at bytte. Ctrl+Z fortryder.")}
    <div style="display:flex;flex-direction:column;gap:20px;min-width:0">${sec}</div></div>
    <div id="trash" class="trash" hidden aria-hidden="true">Slip her for at fjerne fra breaket</div>`;
}
function breakCard(b,y,w,py,pw,ny,nw){
  const items=activeIn(y,w,b.id).sort(sortPos);
  const prev=new Set(activeIn(py,pw,b.id).map(x=>x.kunde));const next=new Set(activeIn(ny,nw,b.id).map(x=>x.kunde));
  const gone=activeIn(py,pw,b.id).filter(x=>!items.some(i=>i.kunde===x.kunde)).map(x=>x.kunde);
  const L=breakLen(y,w,b.id);const cfs=conflictsIn(y,w,b.id);const cfK=new Set(cfs.flatMap(c=>[c[0],c[1]]));
  const cw=S.canWrite!==false;
  const lis=items.map((x,i)=>{const sp=campSpan(y,b.id,x);const tag=sp.start===w&&sp.end===w?` <span class="tag-new" title="Kører kun i uge ${w}">Kun denne uge</span>`:sp.start===w?` <span class="tag-new" title="Kampagnen starter i uge ${w}">Starter</span>`:sp.end===w?` <span class="tag-end" title="Kampagnen slutter i uge ${w}">Slutter</span>`:"";
    const spl=x.spot?`<div class="spn" title="${esc(x.spot)}">${esc(x.spot)}</div>`:"";const sub=x.note||"";
    return `<li class="lane-${KCLS[x.kanal]||"EG"}${cfK.has(x.kunde)?" cf":""}" draggable="${cw}" data-sid="${esc(x.id)}" data-bk="${b.id}"><span class="p">${i+1}</span><span class="nm"><b><a href="#" data-a="edit" data-id="${esc(x.id)}" draggable="false" style="color:inherit;text-decoration:none">${esc(x.kunde)}</a></b> ${ktag(x.kunde)}${tag}${x.status!=="Bekræftet"?" "+statusChip(x.status):""}${spl}${sub?`<div class="lnote" title="${esc(sub)}">${esc(sub)}</div>`:""}</span>
      ${cw?`<span class="mv">${x.spot?"":`<button class="btn ghost icon sm" data-a="name-spot" data-id="${esc(x.id)}" title="Giv spottet et navn" aria-label="Giv spottet for ${esc(x.kunde)} et navn">✎</button>`}<button class="btn ghost icon sm" data-a="swap" data-id="${esc(x.id)}" title="Skift kunde ud" aria-label="Skift ${esc(x.kunde)} ud">⇄</button><button class="btn ghost icon sm danger" data-a="rm" data-id="${esc(x.id)}" title="Fjern" aria-label="Fjern ${esc(x.kunde)}">✕</button></span>`:"<span></span>"}
      <span class="sk">${x.sek}</span></li>`;}).join("");
  const dPrev=L-breakLen(py,pw,b.id),dBase=L-baseLen(y,w,b.id);
  const bump=items.length&&b.bumper?`<li class="bump"><span class="p">·</span><span class="nm">Breaker ind/ud</span><span></span><span class="sk">${b.bumper}</span></li>`:"";
  return `<article class="card brk${isX(b)?" xbrk":""}" data-dropb="${b.id}"><header><div><h3 style="font-size:16px" title="${esc(b.navn)}">${esc(b.navn)}</h3><div class="note">${b.perDag}× dagligt · ${items.length} spots</div>${isX(b)?`<div class="note xrow">${S.isOwner!==false?`<button class="btn sm xdel" data-a="rm-brk" data-id="${b.id}" title="Slet ${esc(b.navn)}">🗑 Slet</button>`:""}</div>`:""}</div><div style="text-align:right"><div class="len${maksOf(b)&&L>maksOf(b)?" over":""}" ${maksOf(b)&&L>maksOf(b)?`title="Over maks længde ${fmtDur(maksOf(b))}"`:""}>${fmtDur(L)}${deltaHtml(dBase,"dlt")}</div>${maksOf(b)&&L>maksOf(b)?`<div class="overtag">${fmtDur(L-maksOf(b))} over maks ${fmtDur(maksOf(b))}</div>`:""}</div></header>
    ${cfs.length?`<div class="cfl">Brancheregel brudt: ${cfs.map(c=>esc(c[0]+" + "+c[1])).join(", ")}</div>`:""}<ol>${lis?`<li class="lhd" aria-hidden="true"><span>Rækkefølge</span><span></span><span>Sek</span></li>`:""}${lis||`<li class="emptyli"><span class="dropz">+ Træk en kunde hertil</span></li>`}${bump}</ol>
    <div class="tots">${b.type==="Sponsorbreak"?`<span>Total antal sekunder</span><b class="num">${L}</b>`:`<span>Total antal sek.</span><b class="num">${L}</b><span>Total antal min.</span><b class="num">${fmtDur(L)}</b>`}</div>
    ${gone.length?`<footer><span>Udgår fra uge ${pw}: ${esc(gone.join(", "))}</span></footer>`:""}</article>`;
}

// ---------- Hurtig handling efter træk (omfang + konsekvens) ----------
function quickOpts(){const q=S.q,w=S.week,y=S.year;const nW=weeksIn(y);
  if(q.kind==="add"){const fr=[];for(let i=w;i<=nW;i++)fr.push(i);return [{key:"uge",label:`Kun uge ${w}`,W:[w]},{key:"frem",label:`Uge ${w}–${nW}, resten af året`,W:fr},{key:"custom",label:"Vælg uger selv",W:null}];}
  const b=S.bookings.get(q.id);if(!b)return [];
  return [{key:"uge",label:`Kun uge ${w}`,W:b.uger.filter(x=>x===w)},{key:"frem",label:`Fra uge ${w} og frem`,W:b.uger.filter(x=>x>=w)},{key:"alle",label:"Alle uger",W:[...b.uger]}].filter(o=>o.W.length);}
function quickEval(o){const q=S.q,y=S.year;if(!o.W)return {txt:"Åbner bookingvinduet",bl:[]};const n=`${o.W.length} ${o.W.length===1?"uge":"uger"} (uge ${ranges(o.W)})`;
  const sgn=d=>(d>0?"+":d<0?"−":"±")+Math.abs(d)+"s";
  if(q.kind==="add"){const bl=blocked(y,q.to,q.k,o.W);return {txt:`${brk(q.to).navn} ${sgn(q.s)} i ${n}`,bl};}
  const b=S.bookings.get(q.id);
  if(q.kind==="swap"){const bl=blocked(y,b.breakId,q.k,o.W,b.id);return {txt:`${brk(b.breakId).navn} ${sgn(q.s-b.sek)} i ${n}`,bl};}
  if(q.kind==="move"){const bl=blocked(y,q.to,b.kunde,o.W);return {txt:q.copy?`${brk(q.to).navn} ${sgn(b.sek)} i ${n} · ${brk(b.breakId).navn} uændret`:`${brk(b.breakId).navn} ${sgn(-b.sek)} · ${brk(q.to).navn} ${sgn(b.sek)} i ${n}`,bl};}
  return {txt:`${brk(b.breakId).navn} ${sgn(-b.sek)} i ${n}`,bl:[]};}
function openQuick(q){S.q=q;S.act=null;drawQuick();}
function drawQuick(){const root=$("#actroot");const q=S.q;if(!q){if(!S.act)root.innerHTML="";return;}
  const b=q.id?S.bookings.get(q.id):null;
  const title=q.kind==="add"?`${esc(q.k)} (${q.s}s) ind i ${esc(brk(q.to).navn)}`:q.kind==="swap"?`${esc(b.kunde)} skiftes ud med ${esc(q.k)} (${q.s}s)`:q.kind==="move"?`${q.copy?"Kopiér":"Flyt"} ${esc(b.kunde)} ${q.copy?"til":"fra "+esc(brk(b.breakId).navn)+" til"} ${esc(brk(q.to).navn)}`:`Fjern ${esc(b.kunde)} fra ${esc(brk(b.breakId).navn)}`;
  const opts=quickOpts();
  root.innerHTML=`<div class="scrim" data-a="q-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="q-t" style="width:min(560px,100%)">
    <header><h2 id="q-t" style="font-size:20px">${title}</h2><button class="btn ghost" data-a="q-close" aria-label="Luk">✕</button></header>
    <div style="padding:14px 18px;display:flex;flex-direction:column;gap:8px">${q.kind==="move"?`<div class="seg mvseg" role="group" aria-label="Flyt eller kopiér"><button class="${q.copy?"":"on"}" data-a="q-copy" data-v="0"><b>Flyt</b><span>fjernes fra ${esc(brk(b.breakId).navn)}</span></button><button class="${q.copy?"on":""}" data-a="q-copy" data-v="1"><b>Kopiér</b><span>bliver stående i begge breaks</span></button></div>`:""}<div class="fld"><label>Hvor længe skal det gælde?</label></div>
    ${opts.map((o,i)=>{const ev=quickEval(o);const dis=ev.bl.length>0;return `<button class="qopt" data-a="q-go" data-key="${o.key}" ${dis?"disabled":""}><span class="qk">${i+1}</span><span class="qb"><b>${esc(o.label)}</b><span class="${dis?"conf":"muted"}">${esc(dis?"Ikke tilladt: "+blockMsg(q.kind==="move"&&b?b.kunde:(q.k||b.kunde),q.kind==="add"||q.kind==="move"?q.to:b.breakId,ev.bl):ev.txt)}</span></span></button>`;}).join("")}
    </div><footer><span class="note">Tast 1–${opts.length} for at vælge${q.kind==="move"?" · F flyt / K kopiér":""} · Esc lukker · Ctrl+Z fortryder bagefter</span><button class="btn" data-a="q-close">Annullér</button></footer></div></div>`;
  setTimeout(()=>{const f=root.querySelector(".qopt:not(:disabled)");if(f)f.focus();},0);}
async function doGodk(){const me=S.meId||"";let name=me;try{if(S.user&&me){const ps=await S.user.profiles([me]);name=ps?.[me]?.name||me;}}catch(e){}
  if(window.__gas&&__gas.st.me&&__gas.st.me.email)name=__gas.st.me.email;
  const g={...S.godk,[S.year+"-"+S.week]:{by:name||"ukendt",at:new Date().toISOString(),sig:weekSig(S.year,S.week)}};try{await S.db.doc("status/godkendt").set({uger:g});toast(`Uge ${S.week} er godkendt`);return true;}catch(err){failWrite(err);return false;}}
function mailAsk(w,ml,godk){const tst=window.__gas&&__gas.st.mailTest;return (godk?`Godkend uge ${w} og send mail om, at den er klar?`:`Send mail om, at reklameafviklingen for uge ${w} er klar?`)+(tst?`\n\nTESTTILSTAND: mailen sendes kun til ${tst}.`:`\n\nMailen går til alle i fanen Brugere.`)+(ml?`\n\nDer blev allerede sendt en mail for uge ${w} den ${new Date(ml.at).toLocaleString("da-DK",{dateStyle:"short",timeStyle:"short"})}.`:"");}
async function doSendKlar(){const y=S.year,w=S.week;const its=S.cfg.breaks.flatMap(b=>activeIn(y,w,b.id));const kunder=new Set(its.map(x=>x.kunde)).size;
  try{const r=await __gas.sendKlar({year:y,week:w,label:weekLabel(y,w),link:location.origin+location.pathname,spots:its.length,kunder});toast(r.test?`Testmail om uge ${w} er sendt til ${r.test}`:`Mail om uge ${w} er sendt til ${r.n} ${r.n===1?"person":"personer"}`);return true;}catch(err){toast("Mailen blev ikke sendt: "+(err?.message||"ukendt fejl"));return false;}}
async function runQuick(key){const q=S.q;const o=quickOpts().find(x=>x.key===key);if(!o)return;const y=S.year;
  if(o.W&&quickEval(o).bl.length)return;
  S.q=null;drawQuick();
  if(q.kind==="add"){if(!o.W){const src=libFind(q.k,q.sp,q.s);openModal(null);Object.assign(S.modal.d,{kunde:q.k,sek:+q.s,kanal:src.kanal,spot:q.sp||"",uger:[S.week]});S.modal.breaks=new Set([q.to]);drawModal();return;}
    const ex=all().find(x=>x.year===y&&x.breakId===q.to&&sameSpot(x,q.k,q.sp,q.s)&&live(x));
    if(ex)await setWeeks(ex.id,[...ex.uger,...o.W],true);
    else{const src=libFind(q.k,q.sp,q.s);await writeDoc(S.db.collection("bookings").doc().id,clean({year:y,breakId:q.to,kunde:q.k,kanal:src.kanal,spot:q.sp||"",sek:+q.s,pos:null,uger:o.W,status:"Bekræftet",note:"",ordrenr:""}));}
    toast(`${q.k} lagt i ${brk(q.to).navn}: +${q.s}s i uge ${ranges(o.W)}`);return;}
  const b=S.bookings.get(q.id);if(!b)return;
  if(q.kind==="swap"||q.kind==="rm"){S.act={kind:q.kind==="swap"?"swap":"rm",id:b.id,scope:key,kunde:q.k||"",sek:q.s||"",spot:q.sp,kanal:(q.k?libFind(q.k,q.sp,q.s).kanal:null)||b.kanal};await doAct();return;}
  if(q.kind==="move"){const W=o.W;const rest=b.uger.filter(w=>!W.includes(w));
    const ex=all().find(x=>x.year===y&&x.breakId===q.to&&sameSpot(x,b.kunde,b.spot,b.sek)&&live(x));
    if(ex)await setWeeks(ex.id,[...ex.uger,...W],true);else await writeDoc(S.db.collection("bookings").doc().id,clean({...b,breakId:q.to,pos:null,uger:W}));
    if(q.copy){toast(`${b.kunde} kopieret til ${brk(q.to).navn} i uge ${ranges(W)}. Står stadig i ${brk(b.breakId).navn}`);return;}
    if(rest.length)await setWeeks(b.id,rest,true);else await dbDel(b.id);
    toast(`${b.kunde} flyttet fra ${brk(b.breakId).navn} til ${brk(q.to).navn} i uge ${ranges(W)}`);}}
async function reorderTo(srcId,breakId,beforeId){const items=activeIn(S.year,S.week,breakId).sort(sortPos);const src=items.find(x=>x.id===srcId);if(!src)return;
  const rest=items.filter(x=>x.id!==srcId);let idx=beforeId?rest.findIndex(x=>x.id===beforeId):rest.length;if(idx<0)idx=rest.length;rest.splice(idx,0,src);
  for(let k=0;k<rest.length;k++){const b=rest[k];if(b.pos!==k+1)await dbUpdate(b.id,{pos:k+1});}
  toast(`${src.kunde} flyttet til plads ${idx+1} i ${brk(breakId).navn}`);}

// ---------- Fortryd ----------
function touch(id){if(S.tx&&!S.tx.before.has(id)){const b=S.bookings.get(id);if(b){const {id:_,...r}=b;S.tx.before.set(id,JSON.parse(JSON.stringify(r)));}else S.tx.before.set(id,null);}}
async function dbSet(id,data){touch(id);await S.db.collection("bookings").doc(id).set(data);}
async function dbUpdate(id,patch){touch(id);try{await S.db.collection("bookings").doc(id).update({...patch,updatedAt:new Date().toISOString(),updatedBy:S.meId||null});}catch(e){failWrite(e);}}
async function dbDel(id){touch(id);try{await S.db.collection("bookings").doc(id).delete();}catch(e){failWrite(e);}}
async function txRun(fn){if(S.tx)return fn();S.tx={before:new Map()};S.lastToast="";try{await fn();}finally{const tx=S.tx;S.tx=null;if(tx.before.size){tx.label=S.lastToast||`${tx.before.size} booking${tx.before.size===1?"":"er"} ændret`;tx.at=new Date();S.undo.push(tx);if(S.undo.length>30)S.undo.shift();showUndo();drawHist();}}}
function drawHist(){const b=$("#undobtn"),n=$("#histn"),pop=$("#histpop");if(!b)return;const last=S.undo.at(-1);b.disabled=!last||S.canWrite===false;b.title=last?"Fortryd: "+last.label+" (Ctrl+Z)":"Intet at fortryde";n.textContent=S.undo.length;
  if(!pop.hidden){pop.innerHTML=`<div class="hh"><b>Dine ændringer i denne session</b><span class="note">Fortryd tager den nyeste først</span></div>`+(S.undo.length?`<ol>${S.undo.slice().reverse().map((t,i)=>`<li${i===0?' class="newest"':""}><span class="ht">${t.at.toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"})}</span><span>${esc(t.label)}</span></li>`).join("")}</ol><div style="padding:8px 12px"><button class="btn sm pri" data-a="undo">↶ Fortryd seneste</button></div>`:`<p class="note" style="padding:10px 12px;margin:0">Ingen ændringer endnu. Ændringer, du laver, vises her, og du kan fortryde dem.</p>`);}}
function showUndo(){let el=$("#toast");if(!el||el.hidden){toast("Ændring gemt");el=$("#toast");}if(!el.querySelector("button")){const b=document.createElement("button");b.textContent="Fortryd";b.className="tbtn";b.dataset.a="undo";el.appendChild(b);}}
async function undo(){const tx=S.undo.pop();if(!tx){toast("Intet at fortryde");return;}
  for(const [id,before] of tx.before){try{if(before===null)await S.db.collection("bookings").doc(id).delete();else await S.db.collection("bookings").doc(id).set(before);}catch(e){failWrite(e);return;}}
  toast(`Fortrudt: ${tx.label||(tx.before.size+" bookinger")}`);drawHist();render();}

// ---------- Træk og slip i ugeplanen ----------
document.addEventListener("dragstart",e=>{const t=e.target;if(!t.closest)return;const c=t.closest(".dchip");const li=t.closest("li[data-sid]");
  if(c){S.drag={src:"lib",k:c.dataset.k,s:+c.dataset.s,sp:c.dataset.sp||""};}
  else if(li){S.drag={src:"spot",id:li.dataset.sid,bk:li.dataset.bk};e.dataTransfer.setData("text/plain",JSON.stringify({id:li.dataset.sid}));e.dataTransfer.effectAllowed="move";li.classList.add("dragging");const tr=$("#trash");if(tr)tr.hidden=false;}});
function clearDz(){document.querySelectorAll(".dz-card,.dz-swap,.dz-before,.trash.on").forEach(x=>x.classList.remove("dz-card","dz-swap","dz-before","on"));}
function ugTarget(e){const t=e.target;if(!t.closest)return null;const tr=t.closest("#trash");if(tr)return {kind:"trash",el:tr};
  const li=t.closest("li[data-sid]");if(li)return {kind:"li",el:li,id:li.dataset.sid,bk:li.dataset.bk};const card=t.closest("[data-dropb]");if(card)return {kind:"card",el:card,bk:card.dataset.dropb};return null;}
document.addEventListener("dragover",e=>{if(!S.drag||S.view!=="ugeplan")return;const T=ugTarget(e);if(!T)return;if(T.kind==="trash"&&S.drag.src!=="spot")return;e.preventDefault();clearDz();
  if(T.kind==="trash")T.el.classList.add("on");else if(T.kind==="li"){if(S.drag.src==="lib")T.el.classList.add("dz-swap");else if(T.id!==S.drag.id)T.el.classList.add(T.bk===S.drag.bk?"dz-before":"dz-swap");}else T.el.classList.add("dz-card");});
document.addEventListener("drop",async e=>{if(!S.drag||S.view!=="ugeplan")return;const T=ugTarget(e);const D=S.drag;S.drag=null;clearDz();const tr=$("#trash");if(tr)tr.hidden=true;if(!T)return;e.preventDefault();
  if(S.canWrite===false)return;
  if(D.src==="lib"){if(T.kind==="li"){openQuick({kind:"swap",id:T.id,k:D.k,s:D.s,sp:D.sp});}else if(T.kind==="card"){openQuick({kind:"add",to:T.bk,k:D.k,s:D.s,sp:D.sp});}return;}
  if(T.kind==="trash"){openQuick({kind:"rm",id:D.id});return;}
  if(T.kind==="li"){if(T.id===D.id)return;if(T.bk===D.bk)await txRun(()=>reorderTo(D.id,T.bk,T.id));else openQuick({kind:"move",id:D.id,to:T.bk,copy:!!(e.ctrlKey||e.altKey||e.metaKey)||!!S.moveCopy});return;}
  if(T.kind==="card"){if(T.bk===D.bk)await txRun(()=>reorderTo(D.id,T.bk,null));else openQuick({kind:"move",id:D.id,to:T.bk,copy:!!(e.ctrlKey||e.altKey||e.metaKey)||!!S.moveCopy});}});
document.addEventListener("dragend",()=>{S.drag=null;clearDz();document.querySelectorAll(".dragging").forEach(x=>x.classList.remove("dragging"));const tr=$("#trash");if(tr)tr.hidden=true;});

// --- Dashboard
function weekStats(y,w){const act=activeIn(y,w);const perDag=S.cfg.breaks.reduce((s,b)=>s+breakLen(y,w,b.id)*(b.perDag||0),0);
  const visn=act.reduce((s,b)=>s+spotsPrUge(b),0);return {kunder:new Set(act.map(b=>b.kunde)).size,spots:act.length,perDag,visn,snit:groupAvg(y,w,"Reklamebreak")};}
function kpi(label,val,cur,prev,fmt,unit){const d=cur-prev;const ds=d===0?"±0":(d>0?"+":"−")+(fmt?fmt(Math.abs(d)):fmtN(Math.abs(d)));
  return `<div class="card tile"><div class="k">${label}</div><div class="v">${val}</div><div class="s"><span class="${d>0?"up":d<0?"dn":""}">${ds}${unit||""}</span> mod forrige uge</div></div>`;}
function kundeSpan(y){const m=new Map();for(const b of all()){if(b.year!==y||!live(b)||!b.uger.length)continue;const o=m.get(b.kunde)||{kunde:b.kunde,first:99,last:0,kanal:b.kanal,breaks:new Set(),sek:new Set(),opt:false};
  o.first=Math.min(o.first,b.uger[0]);o.last=Math.max(o.last,b.uger.at(-1));o.breaks.add(b.breakId);o.sek.add(b.sek);if(b.status==="Option")o.opt=true;m.set(b.kunde,o);}return m;}
function vDash(){
  const y=S.year,w=S.week,[py,pw]=shiftWeek(y,w,-1),nW=weeksIn(y);
  const c=weekStats(y,w),p=weekStats(py,pw);
  // handling
  const conf=S.cfg.breaks.flatMap(b=>conflictsIn(y,w,b.id).map(x=>({b:b.navn,t:x[0]+" + "+x[1]})));
  const film=activeIn(y,w).filter(b=>b.status==="Afventer film");
  const span=kundeSpan(y);const nextYear=new Set(all().filter(b=>b.year===y+1).map(b=>b.kunde));
  const udl=[...span.values()].filter(o=>o.last>=w&&o.last<=w+4&&!(o.last>=nW-1&&nextYear.has(o.kunde))).sort((a,b)=>a.last-b.last);
  const start=[...span.values()].filter(o=>o.first>w&&o.first<=w+4).sort((a,b)=>a.first-b.first);
  const opts=all().filter(b=>b.year===y&&b.status==="Option"&&b.uger.some(x=>x>=w&&x<=w+2));
  const alerts=[
    {n:conf.length,l:"Brancheregler brudt",s:conf.length?conf.slice(0,3).map(x=>x.b+": "+x.t).join(" · "):"Ingen i uge "+w,go:"ugeplan",lvl:"bad"},
    {n:film.length,l:"Afventer film",s:film.length?[...new Set(film.map(b=>b.kunde))].join(", "):"Alle spots er leveret",go:"ugeplan",lvl:"warn"},
    {n:opts.length,l:"Optioner inden for 2 uger",s:opts.length?[...new Set(opts.map(b=>b.kunde))].join(", "):"Ingen ubekræftede",go:"planlaegning",lvl:"warn"},
    {n:udl.length,l:"Kampagner slutter inden for 4 uger",s:udl.length?udl.slice(0,4).map(o=>o.kunde).join(", ")+(udl.length>4?" …":""):"Ingen",go:"#udl",lvl:"info"}];
  // heatmap
  const a=Math.max(1,w-1),z=Math.min(nW,a+12);const ws=[];for(let i=a;i<=z;i++)ws.push(i);
  const maxT={};for(const t of TYPES){maxT[t]=Math.max(1,...S.cfg.breaks.filter(b=>b.type===t).flatMap(b=>ws.map(x=>breakLen(y,x,b.id))));}
  const heat=`<table class="heat"><thead><tr><th></th>${ws.map(x=>`<th class="${x===w?"sel":""}">${x}</th>`).join("")}</tr></thead><tbody>${TYPES.map(t=>`<tr class="grp"><td colspan="${ws.length+1}">${t}s</td></tr>`+S.cfg.breaks.filter(b=>b.type===t).map(b=>`<tr><th>${esc(b.navn)}</th>${ws.map(x=>{const L=breakLen(y,x,b.id);const f=L/maxT[t];const cf=conflictsIn(y,x,b.id);const n=activeIn(y,x,b.id).length;
    return `<td class="hc${f>.6?" hi":""}${cf.length?" cf":""}${x===w?" sel":""}" style="--f:${Math.round(8+f*82)}%" data-a="hgo" data-w="${x}" data-tip="${esc(`${b.navn} · uge ${x}\n${fmtDur(L)} · ${n} spots${cf.length?"\nBrancheregel brudt: "+cf.map(c=>c[0]+" + "+c[1]).join(", "):""}`)}">${L?fmtDur(L):"–"}</td>`;}).join("")}</tr>`).join("")).join("")}</tbody></table>`;
  // årsgraf: solgt tid pr. dag pr. uge, stablet pr. kanal
  const top=all().filter(b=>b.year===y&&live(b));const tot=c.perDag;
  const ytd=aggregate({year:y,fra:1,til:w});const tk=ytd.perKunde.slice(0,10);const tmax=Math.max(1,...tk.map(r=>r.sek));
  const kan=ytd.perKanal;const ksum=kan.reduce((s,r)=>s+r.sek,0)||1;
  const row=(o,lbl)=>`<li><span><span class="sw" style="background:var(${KVAR[o.kanal]||"--k-eg"})"></span><a href="#" data-a="rep-kunde" data-k="${esc(o.kunde)}" style="color:inherit">${esc(o.kunde)}</a> ${ktag(o.kunde)}${o.opt?' <span class="chip st-opt" style="font-size:10px;padding:0 5px">Option</span>':""}</span><span class="muted small num">${[...o.breaks].sort().join(" ")} · ${[...o.sek].join("/")}s · ${lbl(o)}</span></li>`;
  return `<div class="row between"><h2>Overblik</h2><div class="row"><button class="btn" data-a="go" data-v="ugeplan">Afviklingsliste</button><button class="btn" data-a="go" data-v="planlaegning">Planlægning</button></div></div>
  ${vOverview(y,w)}
  <h3 style="font-size:20px;margin-top:6px">Detaljer</h3>
  <div class="card pad"><div class="row between"><h3>Breaklængde uge ${a}–${z}</h3><span class="note">Mørkere = længere break inden for breaktypen · hvid ramme = valgt uge · rød ramme = brancheregel brudt · klik for at åbne ugen</span></div><div class="tw" style="margin-top:10px">${heat}</div></div>
  <div class="card pad"><div class="row between"><h3>Solgt reklametid pr. dag, ${y}</h3><div class="legend">${kanalerFor(y).map(k=>`<span><span class="sw" style="background:var(${KVAR[k]})"></span>${k}</span>`).join("")}</div></div><div id="yrchart" style="margin-top:8px"></div></div>
  <div class="grid2">
    <div class="card pad" id="udl"><div class="row between"><h3>Slutter inden for 4 uger</h3><span class="note">Salgsopfølgning</span></div>${udl.length?`<ul class="list-plain small" style="margin-top:6px">${udl.map(o=>row(o,o=>"sidste uge "+o.last)).join("")}</ul>`:`<p class="muted small">Ingen kampagner slutter de næste 4 uger.</p>`}</div>
    <div class="card pad"><div class="row between"><h3>Starter inden for 4 uger</h3><span class="note">Tjek at film er leveret</span></div>${start.length?`<ul class="list-plain small" style="margin-top:6px">${start.map(o=>row(o,o=>"start uge "+o.first)).join("")}</ul>`:`<p class="muted small">Ingen nye kampagner de næste 4 uger.</p>`}</div>
  </div>
  <div class="grid2">
    <div class="card pad"><div class="row between"><h3>Top 10 kunder, år til dato</h3><button class="btn sm ghost" data-a="go" data-v="rapporter">Se rapport</button></div>
      <table style="margin-top:8px"><tbody>${tk.map((r,i)=>`<tr class="click" data-a="rep-kunde" data-k="${esc(r.kunde)}"><td class="muted num" style="width:24px">${i+1}</td><td>${esc(r.kunde)}</td><td style="width:40%"><div class="bar"><i style="width:${r.sek/tmax*100}%;background:var(${KVAR[[...r.kanaler][0]]||"--k-eg"})"></i></div></td><td class="n"><b>${fmtHours(r.sek)}</b></td></tr>`).join("")}</tbody></table></div>
    <div class="card pad"><h3>Sendetid pr. salgskanal, år til dato</h3>
      <div style="display:flex;height:16px;border-radius:4px;overflow:hidden;margin:14px 0 12px;gap:2px">${kan.map(r=>`<i title="${esc(r.kanal)}" style="width:${r.sek/ksum*100}%;background:var(${KVAR[r.kanal]||"--k-eg"})"></i>`).join("")}</div>
      <table><tbody>${kan.map(r=>`<tr><td><span class="sw" style="background:var(${KVAR[r.kanal]||"--k-eg"})"></span>${esc(r.kanal)}</td><td class="n">${fmtHours(r.sek)}</td><td class="n muted">${(r.sek/ksum*100).toLocaleString("da-DK",{maximumFractionDigits:0})} %</td><td class="n muted small">${r.kunder} kunder</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}
function drawYear(){const el=$("#yrchart");if(!el)return;const y=S.year,nW=weeksIn(y);
  const data=[];for(let w=1;w<=nW;w++){const o={w,tot:0};for(const k of KANALER)o[k]=0;for(const b of activeIn(y,w)){const v=(+b.sek||0)*(brk(b.breakId).perDag||0);o[b.kanal]=(o[b.kanal]||0)+v;o.tot+=v;}data.push(o);}
  const W=Math.max(360,el.clientWidth||900),H=230,pl=48,pr=8,pt=14,pb=24;const mx=Math.max(1,...data.map(d=>d.tot))/60;const step=niceStep(mx/4);const top=Math.ceil(mx/step)*step;
  const bw=(W-pl-pr)/nW;const yy=v=>pt+(H-pt-pb)*(1-v/top);
  let g="";for(let v=0;v<=top+1e-9;v+=step)g+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${yy(v)}" y2="${yy(v)}"/><text x="${pl-6}" y="${yy(v)+4}" text-anchor="end">${fmtN(v)} min</text>`;
  const cur=y===TODAY[0]?TODAY[1]:0;
  const bars=data.map((d,i)=>{let acc=0;const x=pl+i*bw+bw*.14,wd=Math.max(1,bw*.72);let segs="";const ks=KANALER.filter(k=>d[k]>0);
    ks.forEach((k,j)=>{const v=d[k]/60;const y0=yy(acc),y1=yy(acc+v);acc+=v;const h=Math.max(0,y0-y1-(j<ks.length-1?1.5:0));segs+=`<rect x="${x}" y="${y1}" width="${wd}" height="${h}" rx="${j===ks.length-1?2:0}" style="fill:var(${KVAR[k]})"/>`;});
    const tip=`Uge ${d.w}: ${fmtDur(d.tot)} pr. dag\n`+KANALER.filter(k=>d[k]>0).map(k=>`${k}: ${fmtDur(d[k])}`).join("\n");
    return segs+`<rect x="${pl+i*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent" data-tip="${esc(tip)}" data-a="hgo" data-w="${d.w}" style="cursor:pointer"/>`+((d.w%4===1||d.w===nW)?`<text x="${pl+i*bw+bw/2}" y="${H-6}" text-anchor="middle">${d.w}</text>`:"");}).join("");
  const mk=cur?`<line x1="${pl+(cur-.5)*bw}" x2="${pl+(cur-.5)*bw}" y1="${pt-6}" y2="${H-pb}" style="stroke:var(--ink);stroke-dasharray:3 3"/><text x="${pl+(cur-.5)*bw+4}" y="${pt}" style="fill:var(--ink);font-weight:600">Nu</text>`:"";
  el.innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Solgt reklametid pr. dag pr. uge, stablet pr. salgskanal">${g}${bars}${mk}</svg>`;}
// tooltip
document.addEventListener("mousemove",e=>{const t=e.target.closest&&e.target.closest("[data-tip]");let tip=$("#tip");if(!t){if(tip)tip.hidden=true;return;}
  if(!tip){tip=document.createElement("div");tip.id="tip";tip.className="tip";document.body.appendChild(tip);}tip.textContent=t.dataset.tip;tip.hidden=false;
  const x=Math.min(window.innerWidth-tip.offsetWidth-12,e.clientX+14),yv=Math.min(window.innerHeight-tip.offsetHeight-12,e.clientY+14);tip.style.left=x+"px";tip.style.top=yv+"px";});

// --- Overordnet overblik (én skærm)
const maksOf = b => +b.maks || ({Reklamebreak:330,Powerbreak:120,Sponsorbreak:25}[b.type]||0);
function capWeek(y,w){let used=0,cap=0,free=0;const per={};for(const t of TYPES){per[t]={used:0,cap:0};}
  for(const b of S.cfg.breaks){const L=breakLen(y,w,b.id),M=maksOf(b);if(isX(b)&&!L)continue;used+=L*(b.perDag||0);cap+=M*(b.perDag||0);free+=Math.max(0,M-L)*(b.perDag||0);per[b.type].used+=L;per[b.type].cap+=M;}
  return {used,cap,free,pct:cap?used/cap:0,per};}
function pctCls(p){return p>1?"bad":p>=.85?"warn":"ok";}
// --- Overblik pr. periode: dag, uge, måned, kvartal, år
const PERIODS=[["dag","Dag"],["uge","Uge"],["maaned","Måned"],["kvartal","Kvartal"],["atd","År til dato"],["aar","År"]];
const MDRL=["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"];
function weeksOfYear(y){const o=[];for(let w=1;w<=weeksIn(y);w++)o.push([y,w]);return o;}
function periodOf(kind,y,w){
  const m=weekMonth(y,w),q=Math.floor(m/3);
  if(kind==="dag"||kind==="uge"){const [py,pw]=shiftWeek(y,w,-1);return {weeks:[[y,w]],prev:[[py,pw]],label:kind==="dag"?`Pr. dag i uge ${w}, ${y}`:`Uge ${w}, ${y}`,sub:weekLabel(y,w),prevLabel:`uge ${pw}`};}
  if(kind==="maaned"){const ws=weeksOfYear(y).filter(([a,b])=>weekMonth(a,b)===m);const pm=m?m-1:11,pyy=m?y:y-1;const pws=weeksOfYear(pyy).filter(([a,b])=>weekMonth(a,b)===pm);
    return {weeks:ws,prev:pws,label:`${MDRL[m][0].toUpperCase()+MDRL[m].slice(1)} ${y}`,sub:`uge ${ws[0][1]}–${ws.at(-1)[1]}`,prevLabel:MDRL[pm]};}
  if(kind==="kvartal"){const ws=weeksOfYear(y).filter(([a,b])=>Math.floor(weekMonth(a,b)/3)===q);const pq=q?q-1:3,pyy=q?y:y-1;const pws=weeksOfYear(pyy).filter(([a,b])=>Math.floor(weekMonth(a,b)/3)===pq);
    return {weeks:ws,prev:pws,label:`Q${q+1} ${y}`,sub:`uge ${ws[0][1]}–${ws.at(-1)[1]}`,prevLabel:`Q${pq+1}${pyy!==y?" "+pyy:""}`};}
  if(kind==="atd"){const ws=weeksOfYear(y).filter(([a,b])=>b<=w);const pws=weeksOfYear(y-1).filter(([a,b])=>b<=w);return {weeks:ws,prev:pws,label:`År til dato ${y}`,sub:`uge 1–${w} (til og med ${esc(weekLabel(y,w).split("–")[1])})`,prevLabel:`samme periode ${y-1}`};}
  return {weeks:weeksOfYear(y),prev:weeksOfYear(y-1),label:`${y}`,sub:`uge 1–${weeksIn(y)}`,prevLabel:`${y-1}`};}
function periodStats(weeks,perDay){
  const dage=S.cfg.dagePrUge||7;const kunder=new Set(),kanal={},kunde={};let visn=0,sek=0,used=0,cap=0,free=0,perDag=0,nW=0,act=0;
  for(const [y,w] of weeks){const a=activeIn(y,w);if(a.length)nW++;act+=a.length;
    for(const b of a){kunder.add(b.kunde);const spu=spotsPrUge(b);visn+=spu;const s2=spu*(+b.sek||0);sek+=s2;kanal[b.kanal]=(kanal[b.kanal]||0)+s2;kunde[b.kunde]=(kunde[b.kunde]||0)+s2;}
    const c=capWeek(y,w);used+=c.used;cap+=c.cap;free+=c.free;perDag+=c.used;}
  const f=perDay?1/dage:1;
  return {kunder:kunder.size,visn:visn*f,sek:sek*f,pct:cap?used/cap:0,freeDag:weeks.length?free/weeks.length:0,freeTot:free*dage*f,perDag:weeks.length?perDag/weeks.length:0,kanal,kunde,spots:weeks.length?act/weeks.length:0,hasData:nW>0};}
function shiftPeriod(kind,dir){let y=S.year,w=S.week;
  if(kind==="dag"||kind==="uge"){[y,w]=shiftWeek(y,w,dir);}
  else if(kind==="aar"||kind==="atd"){y+=dir;w=Math.min(w,weeksIn(y));}
  else{const P=periodOf(kind,y,w);const target=dir<0?P.prev:null;
    if(target&&target.length){[y,w]=target[0];}else{const last=P.weeks.at(-1);[y,w]=shiftWeek(last[0],last[1],1);}}
  S.year=y;S.week=w;S.rf=null;render();}
function vOverview(y,w){
  const kind=S.ovp||"uge";const P=periodOf(kind,y,w);const perDay=kind==="dag";
  const c=periodStats(P.weeks,perDay),p=periodStats(P.prev,perDay);
  const dd=(a,b,fmt,unit="")=>{if(!p.hasData)return `<span class="muted">ingen data for ${esc(P.prevLabel)}</span>`;const d=a-b;const r=Math.round(d*100)/100;return Math.abs(r)<0.5&&!fmt?`<span class="muted">±0 mod ${esc(P.prevLabel)}</span>`:`<span class="${d>0?"up":d<0?"dn":"muted"}">${d>0?"+":d<0?"−":"±"}${fmt?fmt(Math.abs(d)):fmtN(Math.abs(d))}${unit}</span> <span class="muted">mod ${esc(P.prevLabel)}</span>`;};
  const tiles=[
    ["Kunder i luften",fmtN(c.kunder),dd(c.kunder,p.kunder)],
    [perDay?"Visninger pr. dag":"Visninger",fmtN(c.visn),dd(c.visn,p.visn)],
    [perDay?"Sendetid pr. dag":"Sendetid",perDay?fmtDur(c.sek):fmtHours(c.sek),dd(c.sek,p.sek,v=>perDay?fmtDur(v):fmtHours(v))],
    ["Reklametid pr. dag",fmtDur(c.perDag),dd(c.perDag,p.perDag,fmtDur)],
    ["Belægning",Math.round(c.pct*100)+" %",dd(Math.round(c.pct*100),Math.round(p.pct*100),null," pp")],
    [perDay?"Ledig tid pr. dag":"Ledig reklametid",perDay?fmtDur(c.freeDag):fmtHours(c.freeTot),`<span class="muted">${fmtDur(c.freeDag)} pr. dag i snit</span>`]];
  // graf
  let chart="";
  if(kind==="dag"||kind==="uge"){const bs=S.cfg.breaks.filter(b=>!isX(b)||breakLen(y,w,b.id));const SC=1.2;
    chart=`<div class="ovl">Breaklængde mod maks, uge ${w}</div><div class="bl">${bs.map(b=>{const L=breakLen(y,w,b.id),M=maksOf(b);return `<div class="blr" data-tip="${esc(`${b.navn}: ${fmtDur(L)} af maks ${fmtDur(M)} · ${b.perDag} gange dagligt`)}"><span>${esc(b.navn)}</span><div class="blb"><i class="${pctCls(M?L/M:0)}" style="width:${M?Math.min(L/M,SC)/SC*100:0}%"></i><b style="left:${100/SC}%"></b></div><span class="num">${fmtDur(L)} <span class="muted">${M?Math.round(L/M*100)+"%":""}</span></span></div>`;}).join("")}</div><div class="note">Hver bjælke viser breakets længde i forhold til dets egen maks længde. Stregen er 100 %.</div>`;}
  else{const groups=(kind==="aar"||kind==="atd")?MDRL.map((n,i)=>({l:n.slice(0,3),ws:P.weeks.filter(([a,b])=>weekMonth(a,b)===i)})).filter(g=>g.ws.length):P.weeks.map(x=>({l:String(x[1]),ws:[x]}));
    const vals=groups.map(g=>{const st=periodStats(g.ws,false);return {l:g.l,v:st.sek/3600,pct:st.pct,ws:g.ws};});const mx=Math.max(0.01,...vals.map(v=>v.v));
    chart=`<div class="ovl">Sendetid pr. ${kind==="aar"||kind==="atd"?"måned":"uge"} (timer)</div><div class="pbars">${vals.map(v=>`<div class="pbc" data-tip="${esc(`${kind==="aar"||kind==="atd"?v.l:"Uge "+v.l}: ${v.v.toLocaleString("da-DK",{maximumFractionDigits:1})} timer · belægning ${Math.round(v.pct*100)} %`)}" ${kind!=="aar"&&kind!=="atd"?`data-a="hgo" data-w="${v.ws[0][1]}"`:""}><div class="pbv">${v.v>=10?fmtN(v.v):v.v.toLocaleString("da-DK",{maximumFractionDigits:1})}</div><div class="pbt"><i style="height:${v.v/mx*100}%"></i></div><div class="pbl">${esc(v.l)}</div></div>`).join("")}</div>`;}
  const kt=Object.values(c.kanal).reduce((a,b)=>a+b,0)||1;
  const top=Object.entries(c.kunde).sort((a,b)=>b[1]-a[1]).slice(0,6);const tmx=Math.max(1,...top.map(t=>t[1]));
  const keyOf=b=>b.kunde+"|"+b.breakId;const [ny,nw]=shiftWeek(y,w,1);const nowK=new Set(activeIn(y,w).map(keyOf)),nxtK=new Set(activeIn(ny,nw).map(keyOf));
  const st=new Set(activeIn(ny,nw).filter(b=>!nowK.has(keyOf(b))).map(b=>b.kunde)).size,sp=new Set(activeIn(y,w).filter(b=>!nxtK.has(keyOf(b))).map(b=>b.kunde)).size;
  const conf=S.cfg.breaks.reduce((s2,b)=>s2+conflictsIn(y,w,b.id).length,0),film=activeIn(y,w).filter(b=>b.status==="Afventer film").length;
  const gk=S.godk&&S.godk[ny+"-"+nw];
  return `<section class="ov card">
    <div class="ovbar"><div class="seg" role="tablist" aria-label="Periode">${PERIODS.map(([k,l])=>`<button class="${k===kind?"on":""}" data-a="ovp" data-k="${k}" role="tab" aria-selected="${k===kind}">${l}</button>`).join("")}</div>
      <div class="ovnav"><button class="btn icon sm" data-a="ovprev" aria-label="Forrige periode">‹</button><div><b>${esc(P.label)}</b><span class="muted small"> · ${esc(P.sub)}</span></div><button class="btn icon sm" data-a="ovnext" aria-label="Næste periode">›</button></div></div>
    ${perDay?`<p class="note" style="margin:-6px 0 0">Planen lægges pr. uge, så alle dage i en uge har samme afvikling. Tallene er ugens tal delt med ${S.cfg.dagePrUge||7}.</p>`:""}
    <div class="ovtiles">${tiles.map(t=>`<div class="ovt"><div class="k">${t[0]}</div><div class="v ${t[0]==="Belægning"?pctCls(c.pct):""}">${t[1]}</div><div class="s">${t[2]}</div></div>`).join("")}</div>
    <div class="ovmid2">
      <div>${chart}</div>
      <div><div class="ovl">Salgskanaler</div><div class="mixbar">${KANALER.filter(k=>c.kanal[k]).map(k=>`<i style="width:${c.kanal[k]/kt*100}%;background:var(${KVAR[k]})" data-tip="${esc(k+": "+fmtHours(c.kanal[k]*(perDay?1:1)))}"></i>`).join("")}</div>
        <div class="mixl">${KANALER.filter(k=>c.kanal[k]).map(k=>`<span><span class="sw" style="background:var(${KVAR[k]})"></span>${k} <b class="num">${Math.round(c.kanal[k]/kt*100)} %</b></span>`).join("")||'<span class="muted">Ingen data</span>'}</div>
        <div class="ovl" style="margin-top:16px">Største kunder</div>
        <table class="small"><tbody>${top.map(([k,v])=>`<tr class="click" data-a="rep-kunde" data-k="${esc(k)}"><td>${esc(k)}</td><td style="width:45%"><div class="bar"><i style="width:${v/tmx*100}%"></i></div></td><td class="n">${perDay?fmtDur(v):fmtHours(v)}</td></tr>`).join("")||'<tr><td class="muted">Ingen data</td></tr>'}</tbody></table></div>
    </div>
    <div class="stl stl-row"><span class="${conf?"bad":"ok"}"><b>${conf}</b> brud på brancheregler i uge ${w}</span><span class="${film?"warn":"ok"}"><b>${film}</b> afventer film</span><span><b>${st}</b> kunder starter i uge ${nw}</span><span><b>${sp}</b> stopper efter uge ${w}</span><span class="${gk?"ok":"warn"}"><b>${gk?"✓":"○"}</b> uge ${nw} ${gk?"er godkendt":"er ikke godkendt"}</span></div>
  </section>`;
}


// --- Krydsrapport (pivot)
const DIMS={kunde:"Kunde",spot:"Spot",kanal:"Salgskanal",branche:"Branche",type:"Breaktype",brk:"Break",kvartal:"Kvartal",maaned:"Måned",uge:"Uge",status:"Status"};
const MEAS={visn:"Visninger",sek:"Sendetid",bookinger:"Bookinger",kunder:"Kunder"};
const PRESETS=[["Kunde × måned","kunde","maaned","sek"],["Salgskanal × kvartal","kanal","kvartal","sek"],["Branche × breaktype","branche","type","visn"],["Break × uge","brk","uge","sek"],["Kunde × break","kunde","brk","visn"],["Salgskanal × måned","kanal","maaned","kunder"]];
function weekMonth(y,w){const t=weekMon(y,w);t.setUTCDate(t.getUTCDate()+3);return t.getUTCMonth();}
function dimVal(dim,b,w,y){switch(dim){case "kunde":return b.kunde;case "spot":return b.kunde+" · "+(b.spot||"uden navn")+" · "+b.sek+"s";case "kanal":return b.kanal;case "branche":return kat(b.kunde)||"Ingen branche";case "type":return brk(b.breakId).type;case "brk":return brk(b.breakId).navn;
  case "kvartal":return "Q"+(Math.floor(weekMonth(y,w)/3)+1);case "maaned":return MDR[weekMonth(y,w)];case "uge":return w;case "status":return b.status;}}
function dimOrder(dim){if(dim==="maaned")return k=>MDR.indexOf(k);if(dim==="uge")return k=>+k;if(dim==="kvartal")return k=>+String(k).slice(1);if(dim==="brk")return k=>S.cfg.breaks.findIndex(b=>b.navn===k);if(dim==="type")return k=>TYPES.indexOf(k);if(dim==="kanal")return k=>KANALER.indexOf(k);return null;}
function pivot(f,rd,cd,ms){const dage=S.cfg.dagePrUge||7;const cells=new Map(),rT=new Map(),cT=new Map();const tot={v:0,set:new Set()};
  const add=(m,k,v,id)=>{let o=m.get(k);if(!o){o={v:0,set:new Set()};m.set(k,o);}o.v+=v;if(id!=null)o.set.add(id);};
  for(const b of all()){if(b.year!==f.year||!live(b))continue;if(f.kunde&&b.kunde!==f.kunde)continue;if(f.kanal&&b.kanal!==f.kanal)continue;const br=brk(b.breakId);if(f.type&&br.type!==f.type)continue;
    const spu=(br.perDag||0)*dage;for(const w of b.uger){if(w<f.fra||w>f.til)continue;const r=dimVal(rd,b,w,f.year),c=dimVal(cd,b,w,f.year);
      const v=ms==="visn"?spu:ms==="sek"?spu*(+b.sek||0):0;const id=ms==="bookinger"?b.id:ms==="kunder"?b.kunde:null;
      add(cells,r+"\u0001"+c,v,id);add(rT,r,v,id);add(cT,c,v,id);tot.v+=v;if(id!=null)tot.set.add(id);}}
  const val=o=>!o?0:(ms==="bookinger"||ms==="kunder")?o.set.size:o.v;
  const sortKeys=(m,dim)=>{const ord=dimOrder(dim);const ks=[...m.keys()];return ord?ks.sort((a,b)=>ord(a)-ord(b)):ks.sort((a,b)=>val(m.get(b))-val(m.get(a)));};
  return {rows:sortKeys(rT,rd),cols:sortKeys(cT,cd),cell:(r,c)=>val(cells.get(r+"\u0001"+c)),rowT:r=>val(rT.get(r)),colT:c=>val(cT.get(c)),total:val(tot)};}
const fmtM=(ms,v)=>!v?"":ms==="sek"?fmtDur(v):fmtN(v);
function vKryds(){const f=S.rf;const P=S.pv;const R=pivot(f,P.r,P.c,P.m);
  const mx=Math.max(1,...R.rows.flatMap(r=>R.cols.map(c=>R.cell(r,c))));
  const dsel=(id,key,v)=>`<select id="${id}" data-pv="${key}">${Object.entries(DIMS).map(([k,l])=>`<option value="${k}" ${k===v?"selected":""}>${l}</option>`).join("")}</select>`;
  const table=R.rows.length?`<div class="card tw"><table class="pv"><thead><tr><th>${DIMS[P.r]} \\ ${DIMS[P.c]}</th>${R.cols.map(c=>`<th class="n">${esc(P.c==="uge"?"Uge "+c:c)}</th>`).join("")}<th class="n">I alt</th></tr></thead><tbody>
    ${R.rows.map(r=>`<tr><th>${esc(P.r==="uge"?"Uge "+r:r)}</th>${R.cols.map(c=>{const v=R.cell(r,c);return `<td class="n" style="--f:${v?Math.round(6+v/mx*60):0}%">${fmtM(P.m,v)}</td>`;}).join("")}<td class="n tot">${fmtM(P.m,R.rowT(r))}</td></tr>`).join("")}
    </tbody><tfoot><tr><th>I alt</th>${R.cols.map(c=>`<td class="n tot">${fmtM(P.m,R.colT(c))}</td>`).join("")}<td class="n tot">${fmtM(P.m,R.total)}</td></tr></tfoot></table></div>`:`<div class="card empty">Ingen data i perioden med de valgte filtre</div>`;
  return `<div class="card pad filters">
    <div class="fld"><label for="pvr">Rækker</label>${dsel("pvr","r",P.r)}</div><div class="fld"><label for="pvc">Kolonner</label>${dsel("pvc","c",P.c)}</div>
    <div class="fld"><label for="pvm">Måltal</label><select id="pvm" data-pv="m">${Object.entries(MEAS).map(([k,l])=>`<option value="${k}" ${k===P.m?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="fld"><label>Færdige rapporter</label><div class="seg" role="group">${PRESETS.map(([l,r,c,m])=>`<button class="${P.r===r&&P.c===c&&P.m===m?"on":""}" data-a="pvp" data-r="${r}" data-c="${c}" data-m="${m}">${l}</button>`).join("")}</div></div>
  </div>
  <div class="row between"><h3 style="font-size:20px">${MEAS[P.m]}: ${DIMS[P.r].toLowerCase()} × ${DIMS[P.c].toLowerCase()} · uge ${f.fra}–${f.til}, ${f.year}</h3>${S.dl&&R.rows.length?`<button class="btn pri" data-a="xlsx-pv">Hent Excel</button>`:""}</div>
  ${table}
  <p class="note">${P.m==="bookinger"||P.m==="kunder"?"Bookinger og kunder tælles én gang pr. celle, så rækker og kolonner summerer ikke nødvendigvis til totalen.":"Planlagt afvikling: uger × gange dagligt × "+(S.cfg.dagePrUge||7)+" dage."} Filtrene for år, periode, kunde, salgskanal og breaktype ovenfor gælder også her.</p>`;}
function pvRows(){const f=S.rf,P=S.pv;const R=pivot(f,P.r,P.c,P.m);const conv=v=>P.m==="sek"?+(v/3600).toFixed(2):v;
  return R.rows.map(r=>{const o={[DIMS[P.r]]:P.r==="uge"?"Uge "+r:r};for(const c of R.cols)o[P.c==="uge"?"Uge "+c:String(c)]=conv(R.cell(r,c));o["I alt"]=conv(R.rowT(r));return o;});}

// --- Kunderapport som PDF (pdf-lib)
const pdfTxt = s => String(s??"").replace(/[−–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/→/g,"->").replace(/[^\x20-\x7E\xA0-\xFF·–€]/g,"");
async function kundePdf(){
  if(!window.PDFLib){toast("PDF-modulet kunne ikke indlæses");return;}
  const f=S.rf;if(!f.kunde){toast("Vælg en kunde først");return;}
  const A=aggregate(f);const {PDFDocument,StandardFonts,rgb}=PDFLib;
  const doc=await PDFDocument.create();doc.setTitle(`Kampagnerapport ${f.kunde}`);doc.setAuthor("SPORT LIVE");
  const R=await doc.embedFont(StandardFonts.Helvetica),B=await doc.embedFont(StandardFonts.HelveticaBold);
  const INK=rgb(.12,.12,.12),MUT=rgb(.4,.4,.4),LINE=rgb(.86,.86,.86),RED=rgb(.92,.42,.12),BLUE=rgb(.92,.42,.12),SOFT=rgb(.96,.95,.94),BAND=rgb(.15,.15,.15);
  const W=595.28,H=841.89,M=42;let page,y;const pages=[];
  const txt=(s,x,yy,o={})=>{const font=o.b?B:R,size=o.s||10;s=pdfTxt(s);let xx=x;if(o.al==="r")xx=x-font.widthOfTextAtSize(s,size);if(o.al==="c")xx=x-font.widthOfTextAtSize(s,size)/2;page.drawText(s,{x:xx,y:yy,size,font,color:o.c||INK});};
  const fit=(s,max,size,font)=>{s=pdfTxt(s);if(font.widthOfTextAtSize(s,size)<=max)return s;while(s.length>1&&font.widthOfTextAtSize(s+"…",size)>max)s=s.slice(0,-1);return s+"…";};
  const newPage=(first)=>{page=doc.addPage([W,H]);pages.push(page);
    if(first){page.drawRectangle({x:0,y:H-96,width:W,height:96,color:BAND});page.drawRectangle({x:0,y:H-99,width:W,height:3,color:RED});
      txt("S P O R T   L I V E",M,H-50,{b:1,s:18,c:RED});txt("Kampagnerapport",W-M,H-49,{s:12,al:"r",c:rgb(.8,.84,.9)});y=H-130;}
    else{txt("SPORT LIVE · Kampagnerapport · "+f.kunde,M,H-40,{s:9,c:MUT});page.drawLine({start:{x:M,y:H-48},end:{x:W-M,y:H-48},thickness:.6,color:LINE});y=H-72;}};
  const need=h=>{if(y-h<70)newPage(false);};
  newPage(true);
  const d0=weekMon(f.year,f.fra),d1=new Date(weekMon(f.year,f.til).getTime()+6*864e5);
  txt(f.kunde,M,y,{b:1,s:24});y-=22;
  txt(`Uge ${f.fra}–${f.til}, ${f.year}  ·  ${dStr(d0)} – ${dStr(d1)}`,M,y,{s:11,c:MUT});y-=34;
  // nøgletal
  const kp=[["Visninger",fmtN(A.tot.spots)],["Sendetid",fmtDur(A.tot.sek)],["Uger med visninger",String(new Set(A.rows.flatMap(r=>r.ws)).size)],["Breaks",String(new Set(A.rows.map(r=>r.b.breakId)).size)]];
  const bw=(W-2*M-30)/4;kp.forEach((k,i)=>{const x=M+i*(bw+10);page.drawRectangle({x,y:y-46,width:bw,height:54,color:SOFT});txt(k[0].toUpperCase(),x+10,y-8,{s:7.5,b:1,c:MUT});txt(k[1],x+10,y-34,{b:1,s:18});});
  y-=78;
  // pr. break
  const sec=t=>{need(40);txt(t.toUpperCase(),M,y,{b:1,s:10});y-=8;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1,color:INK});y-=16;};
  const cols=[[M,"Break"],[M+95,"Spot / note"],[M+235,"Sek","r"],[M+250,"Uger"],[W-M-75,"Visninger","r"],[W-M,"Sendetid","r"]];
  sec("Fordeling pr. break");
  const head=()=>{cols.forEach(c=>txt(c[1],c[0],y,{s:8,b:1,c:MUT,al:c[2]}));y-=6;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.5,color:LINE});y-=13;};head();
  const rs=A.rows.slice().sort((a,b)=>S.cfg.breaks.findIndex(x=>x.id===a.b.breakId)-S.cfg.breaks.findIndex(x=>x.id===b.b.breakId));
  for(const r of rs){need(18);txt(r.br.navn,cols[0][0],y,{s:9});txt(fit([r.b.spot,r.b.note].filter(Boolean).join(" · ")||"-",cols[2][0]-cols[1][0]-40,9,R),cols[1][0],y,{s:9,c:MUT});
    txt(String(r.b.sek),cols[2][0],y,{s:9,al:"r"});txt(fit(ranges(r.ws),cols[4][0]-cols[3][0]-60,9,R),cols[3][0],y,{s:9});txt(fmtN(r.spots),cols[4][0],y,{s:9,al:"r"});txt(fmtDur(r.sek),cols[5][0],y,{s:9,al:"r"});
    y-=6;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.4,color:LINE});y-=12;}
  need(18);txt("I alt",M,y,{b:1,s:9});txt(fmtN(A.tot.spots),cols[4][0],y,{b:1,s:9,al:"r"});txt(fmtDur(A.tot.sek),cols[5][0],y,{b:1,s:9,al:"r"});y-=32;
  // graf
  const ws=[];for(let w=f.fra;w<=f.til;w++)ws.push(w);
  need(170);sec("Visninger pr. uge");const ch=110,cw=W-2*M-30,x0=M+30;const vals=ws.map(w=>A.perUge.get(w)?.spots||0);const mxv=Math.max(1,...vals);
  const step=niceStep(mxv/3),topv=Math.ceil(mxv/step)*step;
  for(let v=0;v<=topv+1e-9;v+=step){const yy=y-ch+ch*v/topv;page.drawLine({start:{x:x0,y:yy},end:{x:x0+cw,y:yy},thickness:.4,color:LINE});txt(fmtN(v),x0-6,yy-3,{s:7,c:MUT,al:"r"});}
  const bwd=cw/ws.length;ws.forEach((w,i)=>{const v=vals[i];if(v)page.drawRectangle({x:x0+i*bwd+bwd*.15,y:y-ch,width:Math.max(.8,bwd*.7),height:ch*v/topv,color:BLUE});
    if(ws.length<=20||i%Math.ceil(ws.length/18)===0)txt(String(w),x0+i*bwd+bwd/2,y-ch-11,{s:6.5,c:MUT,al:"c"});});
  y-=ch+34;
  // uge for uge
  sec("Uge for uge");const uc=[[M,"Uge"],[M+50,"Periode"],[W-M-90,"Visninger","r"],[W-M,"Sendetid","r"]];
  const uh=()=>{uc.forEach(c=>txt(c[1],c[0],y,{s:8,b:1,c:MUT,al:c[2]}));y-=6;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.5,color:LINE});y-=12;};uh();
  for(const w of ws){const o=A.perUge.get(w);if(!o)continue;if(y<90){newPage(false);uh();}
    txt(String(w),uc[0][0],y,{s:8.5});txt(weekLabel(f.year,w),uc[1][0],y,{s:8.5,c:MUT});txt(fmtN(o.spots),uc[2][0],y,{s:8.5,al:"r"});txt(fmtDur(o.sek),uc[3][0],y,{s:8.5,al:"r"});y-=13;}
  // fodnote på alle sider
  const note=`Visninger er planlagt afvikling: uger med booking × gange dagligt for breaket × ${S.cfg.dagePrUge||7} dage. Udskrevet ${new Date().toLocaleDateString("da-DK")}.`;
  pages.forEach((pg,i)=>{page=pg;page.drawLine({start:{x:M,y:48},end:{x:W-M,y:48},thickness:.5,color:LINE});txt(note,M,34,{s:7,c:MUT});txt(`Side ${i+1} af ${pages.length}`,W-M,34,{s:7,c:MUT,al:"r"});});
  const bytes=await doc.save();
  try{await S.dl.save({filename:`Kampagnerapport ${f.kunde} uge ${f.fra}-${f.til} ${f.year}.pdf`,data:new Blob([bytes])});toast("PDF gemt");}catch(e){if(e?.code!=="declined")toast(e?.code==="rate_limited"?"Vent et øjeblik og prøv igen":"PDF'en kunne ikke gemmes her");}
}

// --- Bookinger
function vBookinger(){
  const f=S.bf;const q=f.q.trim().toLowerCase();
  let rows=all().filter(b=>b.year===S.year);
  if(q)rows=rows.filter(b=>[b.kunde,b.spot,b.note,b.ordrenr,b.breakId].join(" ").toLowerCase().includes(q));
  if(f.type)rows=rows.filter(b=>brk(b.breakId).type===f.type);
  if(f.kanal)rows=rows.filter(b=>b.kanal===f.kanal);
  if(f.status)rows=rows.filter(b=>b.status===f.status);
  if(f.aktiv)rows=rows.filter(b=>live(b)&&(b.uger||[]).includes(S.week));
  rows.sort((a,b)=>a.kunde.localeCompare(b.kunde,"da")||a.breakId.localeCompare(b.breakId));
  const nW=weeksIn(S.year);
  const opt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option ${x===v?"selected":""}>${esc(x)}</option>`).join("");
  return `<div class="row between"><h2>Bookinger ${S.year}</h2><div class="row"><span class="muted small">${rows.length} af ${all().filter(b=>b.year===S.year).length}</span>${S.canWrite?`<button class="btn pri" data-a="new">+ Ny booking</button>`:""}</div></div>
  <div class="card pad filters">
    <div class="fld" style="flex:1;min-width:200px"><label for="bq">Søg</label><input id="bq" type="search" placeholder="Kunde, spot, note, ordrenr." value="${esc(f.q)}" data-f="q"></div>
    <div class="fld"><label for="bt">Breaktype</label><select id="bt" data-f="type">${opt(TYPES,f.type,"Alle")}</select></div>
    <div class="fld"><label for="bk">Salgskanal</label><select id="bk" data-f="kanal">${opt(KANALER,f.kanal,"Alle")}</select></div>
    <div class="fld"><label for="bs">Status</label><select id="bs" data-f="status">${opt(STATUSER,f.status,"Alle")}</select></div>
    <label class="row small" style="gap:6px;padding-bottom:8px"><input type="checkbox" id="ba" data-f="aktiv" ${f.aktiv?"checked":""}> Kun aktive i uge ${S.week}</label>
  </div>
  <div class="card tw"><table><thead><tr><th>Kunde</th><th>Break</th><th>Spot / note</th><th class="n">Sek</th><th>Kanal</th><th>Status</th><th>Uger ${S.year}</th><th class="n">Uger</th></tr></thead><tbody>
  ${rows.map(b=>{const set=new Set(b.uger||[]);let s="";for(let i=1;i<=53;i++)s+=`<i class="${i<=nW&&set.has(i)?"on":""}${i===S.week?" cur":""}"${i>nW?' style="opacity:0"':""}></i>`;
    return `<tr class="click" data-a="edit" data-id="${esc(b.id)}"><td><b>${esc(b.kunde)}</b>${b.ordrenr?`<div class="small muted">#${esc(b.ordrenr)}</div>`:""}</td><td>${esc(b.breakId)}</td><td class="small" style="max-width:260px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc([b.spot,b.note].filter(Boolean).join(" · "))||'<span class="muted">–</span>'}</div></td><td class="n">${b.sek}</td><td>${kanalChip(b.kanal)}</td><td>${statusChip(b.status)}</td><td><div class="strip" title="Uge ${esc(ranges(b.uger||[]))}">${s}</div></td><td class="n small muted">${(b.uger||[]).length}</td></tr>`;}).join("")||`<tr><td colspan="8" class="empty">Ingen bookinger matcher filtrene</td></tr>`}
  </tbody></table></div>`;
}

// --- Rapporter
function defaultRf(){return {year:S.year,fra:1,til:S.year===TODAY[0]?TODAY[1]:weeksIn(S.year),kunde:"",kanal:"",type:""};}
function aggregate(f){
  const dage=S.cfg.dagePrUge||7;
  const rows=[];const perUge=new Map();
  for(const b of all()){
    if(b.year!==f.year||!live(b))continue;
    if(f.kunde&&b.kunde!==f.kunde)continue;
    if(f.kanal&&b.kanal!==f.kanal)continue;
    const br=brk(b.breakId);if(f.type&&br.type!==f.type)continue;
    const ws=(b.uger||[]).filter(w=>w>=f.fra&&w<=f.til);if(!ws.length)continue;
    const spu=(br.perDag||0)*dage;const spots=ws.length*spu;const sek=spots*(+b.sek||0);
    rows.push({b,br,ws,spots,sek});
    for(const w of ws){const o=perUge.get(w)||{spots:0,sek:0};o.spots+=spu;o.sek+=spu*(+b.sek||0);perUge.set(w,o);}
  }
  const kmap=new Map();
  for(const r of rows){const k=r.b.kunde;const o=kmap.get(k)||{kunde:k,kanaler:new Set(),uger:new Set(),spots:0,sek:0,n:0};o.kanaler.add(r.b.kanal);r.ws.forEach(w=>o.uger.add(w));o.spots+=r.spots;o.sek+=r.sek;o.n++;kmap.set(k,o);}
  const perKunde=[...kmap.values()].sort((a,b)=>b.sek-a.sek);
  const cmap=new Map();for(const r of rows){const o=cmap.get(r.b.kanal)||{kanal:r.b.kanal,sek:0,spots:0,k:new Set()};o.sek+=r.sek;o.spots+=r.spots;o.k.add(r.b.kunde);cmap.set(r.b.kanal,o);}
  const perKanal=[...cmap.values()].map(o=>({...o,kunder:o.k.size})).sort((a,b)=>b.sek-a.sek);
  const tot={spots:rows.reduce((s,r)=>s+r.spots,0),sek:rows.reduce((s,r)=>s+r.sek,0)};
  return {rows,perKunde,perKanal,perUge,tot};
}
function vRapporter(){
  if(!S.rf)S.rf=defaultRf();const f=S.rf;const nW=weeksIn(f.year);
  const A=aggregate(f);
  const opt=(arr,v,a)=>`<option value="">${a}</option>`+arr.map(x=>`<option ${x===v?"selected":""}>${esc(x)}</option>`).join("");
  const wopt=v=>Array.from({length:nW},(_,i)=>`<option value="${i+1}" ${i+1===v?"selected":""}>${i+1}</option>`).join("");
  const q=[[1,13,"Q1"],[14,26,"Q2"],[27,39,"Q3"],[40,nW,"Q4"]];
  const presets=`<div class="seg" role="group" aria-label="Periode">${[[1,nW,"Hele året"],...q,[1,f.year===TODAY[0]?TODAY[1]:nW,"År til dato"]].map(([a,b,l])=>`<button data-a="rp" data-fra="${a}" data-til="${b}" class="${f.fra===a&&f.til===b?"on":""}">${l}</button>`).join("")}</div>`;
  const kTitle=f.kunde?esc(f.kunde):"Alle kunder";
  let detail;
  if(f.kunde){
    const rs=A.rows.slice().sort((a,b)=>a.b.breakId.localeCompare(b.b.breakId));
    detail=`<div class="card tw"><table><thead><tr><th>Break</th><th>Spot / note</th><th class="n">Sek</th><th>Uger i perioden</th><th class="n">Pr. uge</th><th class="n">Visninger</th><th class="n">Sendetid</th></tr></thead><tbody>
    ${rs.map(r=>`<tr class="click" data-a="edit" data-id="${esc(r.b.id)}"><td>${esc(r.br.navn)}</td><td class="small">${esc([r.b.spot,r.b.note].filter(Boolean).join(" · "))||"–"}</td><td class="n">${r.b.sek}</td><td class="small">${esc(ranges(r.ws))} <span class="muted">(${r.ws.length})</span></td><td class="n">${(r.br.perDag||0)*(S.cfg.dagePrUge||7)}</td><td class="n"><b>${fmtN(r.spots)}</b></td><td class="n">${fmtDur(r.sek)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Ingen visninger i perioden</td></tr>`}
    </tbody>${rs.length?`<tfoot><tr><td colspan="5"><b>I alt</b></td><td class="n"><b>${fmtN(A.tot.spots)}</b></td><td class="n"><b>${fmtDur(A.tot.sek)}</b></td></tr></tfoot>`:""}</table></div>`;
  } else {
    const mx=Math.max(1,...A.perKunde.map(r=>r.sek));
    detail=`<div class="card tw"><table><thead><tr><th>Kunde</th><th>Kanal</th><th class="n">Bookinger</th><th class="n">Uger</th><th class="n">Visninger</th><th class="n">Sendetid</th><th>Andel</th></tr></thead><tbody>
    ${A.perKunde.map(r=>`<tr class="click" data-a="rep-kunde" data-k="${esc(r.kunde)}"><td><b>${esc(r.kunde)}</b></td><td>${[...r.kanaler].map(kanalChip).join(" ")}</td><td class="n">${r.n}</td><td class="n">${r.uger.size}</td><td class="n">${fmtN(r.spots)}</td><td class="n"><b>${fmtDur(r.sek)}</b></td><td style="width:160px"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar" style="flex:1"><i style="width:${r.sek/mx*100}%"></i></div><span class="small muted num" style="width:38px;text-align:right">${(r.sek/(A.tot.sek||1)*100).toLocaleString("da-DK",{maximumFractionDigits:1})}%</span></div></td></tr>`).join("")||`<tr><td colspan="7" class="empty">Ingen visninger i perioden</td></tr>`}
    </tbody></table></div>`;
  }
  const kryds=S.rmode==="kryds";
  return `<div class="row between"><div class="row" style="gap:16px"><h2>Rapporter</h2><div class="seg" role="tablist"><button class="${!kryds?"on":""}" data-a="rmode" data-m="kunde">Kunde og periode</button><button class="${kryds?"on":""}" data-a="rmode" data-m="kryds">Krydsrapport</button></div></div><div class="row">${!kryds&&A.rows.length?`${f.kunde&&S.dl?`<button class="btn" data-a="pdf-kunde">Kunderapport (PDF)</button>`:""}<button class="btn" data-a="copy-rep">Kopiér opsummering</button>${S.dl?`<button class="btn pri" data-a="xlsx-rep">Hent Excel</button>`:""}`:""}</div></div>
  <div class="card pad filters">
    <div class="fld"><label for="ry">År</label><select id="ry" data-r="year">${years().map(y=>`<option ${y===f.year?"selected":""}>${y}</option>`).join("")}</select></div>
    <div class="fld"><label for="rfra">Fra uge</label><select id="rfra" data-r="fra">${wopt(f.fra)}</select></div>
    <div class="fld"><label for="rtil">Til uge</label><select id="rtil" data-r="til">${wopt(f.til)}</select></div>
    <div class="fld" style="min-width:200px"><label for="rk">Kunde</label><select id="rk" data-r="kunde">${opt(kunder(),f.kunde,"Alle kunder")}</select></div>
    <div class="fld"><label for="rka">Salgskanal</label><select id="rka" data-r="kanal">${opt(KANALER,f.kanal,"Alle")}</select></div>
    <div class="fld"><label for="rt">Breaktype</label><select id="rt" data-r="type">${opt(TYPES,f.type,"Alle")}</select></div>
    <div class="fld"><label>Hurtigvalg</label>${presets}</div>
  </div>
  ${kryds?vKryds():`<div class="row between"><h3 style="font-size:20px">${kTitle} · uge ${f.fra}–${f.til}, ${f.year}</h3><span class="note">${esc(dStr(weekMon(f.year,f.fra)))} – ${esc(dStr(new Date(weekMon(f.year,f.til).getTime()+6*864e5)))}</span></div>
  <div class="tiles">
    <div class="card tile"><div class="k">Visninger</div><div class="v">${fmtN(A.tot.spots)}</div><div class="s">planlagte spots i perioden</div></div>
    <div class="card tile"><div class="k">Sendetid</div><div class="v">${fmtDur(A.tot.sek)}</div><div class="s">${fmtHours(A.tot.sek)} reklame</div></div>
    <div class="card tile"><div class="k">${f.kunde?"Bookinger":"Kunder"}</div><div class="v">${f.kunde?A.rows.length:A.perKunde.length}</div><div class="s">${f.kunde?"breaks med visninger":"med visninger i perioden"}</div></div>
    <div class="card tile"><div class="k">Snit pr. uge</div><div class="v">${fmtN(A.tot.spots/Math.max(1,f.til-f.fra+1))}</div><div class="s">visninger</div></div>
  </div>
  <div class="card pad"><div class="row between"><h3>Sendetid pr. uge</h3><span class="note">Søjler = sendetid i minutter</span></div><div id="chart" style="margin-top:8px"></div></div>
  ${detail}
  <p class="note">Visninger er beregnet ud fra planen: uger med booking × gange dagligt for breaket × ${S.cfg.dagePrUge||7} dage. Det er planlagt afvikling, ikke as-run fra playout.${f.kunde?"":" Vælg en kunde for at lave en kunderapport som PDF."}</p>`}`;
}
function afterReport(){
  const el=$("#chart");if(!el)return;const f=S.rf;const A=aggregate(f);
  const W=Math.max(320,el.clientWidth||900),H=200,pl=44,pr=8,pt=10,pb=24;
  const ws=[];for(let w=f.fra;w<=f.til;w++)ws.push(w);
  const vals=ws.map(w=>(A.perUge.get(w)?.sek||0)/60);const mx=Math.max(1,...vals);
  const step=niceStep(mx/3);const top=Math.ceil(mx/step)*step;
  const bw=(W-pl-pr)/ws.length;const y=v=>pt+(H-pt-pb)*(1-v/top);
  let g="";for(let v=0;v<=top+1e-9;v+=step)g+=`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end">${fmtN(v)}</text>`;
  const lblEvery=ws.length>30?4:ws.length>14?2:1;
  const bars=ws.map((w,i)=>{const v=vals[i];const x=pl+i*bw+Math.max(1,bw*.15);const bwid=Math.max(1,bw*.7);
    return `<rect class="b" x="${x}" y="${y(v)}" width="${bwid}" height="${Math.max(0,y(0)-y(v))}" rx="1.5"><title>Uge ${w}: ${fmtN(v)} min · ${fmtN(A.perUge.get(w)?.spots||0)} visninger</title></rect>`+((i%lblEvery===0)?`<text x="${pl+i*bw+bw/2}" y="${H-6}" text-anchor="middle">${w}</text>`:"");}).join("");
  el.innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Sendetid pr. uge">${g}${bars}</svg>`;
}
function niceStep(x){if(x<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(x)));const n=x/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;}

// --- Indstillinger
function vKat(){
  if(!S.katDraft)S.katDraft=JSON.parse(JSON.stringify(S.kat));const D=S.katDraft;const own=S.isOwner!==false;const ro=own?"":"disabled";
  const ks=kunder();const opt=(v)=>`<option value="">–</option>`+D.kategorier.map(c=>`<option ${c===v?"selected":""}>${esc(c)}</option>`).join("");
  const copt=v=>D.kategorier.map(c=>`<option ${c===v?"selected":""}>${esc(c)}</option>`).join("");
  return `<div class="card pad"><div class="row between"><h3>Brancher og regler</h3>${own?`<button class="btn pri" data-a="kat-save">Gem brancher og regler</button>`:""}</div>
  ${own?"":`<p class="banner small">Kun ejeren kan ændre brancher og regler.</p>`}<p class="note">Giv kunderne en branche og bestem, hvilke brancher der ikke må stå i samme break. Planlægningen afviser de kombinationer, og eksisterende konflikter bliver markeret med rødt.</p>
  <div class="grid2" style="margin-top:10px">
    <div><div class="fld"><label>Regler: må ikke stå i samme break</label></div>
      <ul class="list-plain">${(D.regler||[]).map((r,i)=>`<li><span><b>${esc(r.a)}</b> og <b>${esc(r.b)}</b></span>${own?`<button class="btn sm ghost danger" data-a="kat-delrule" data-i="${i}">Fjern</button>`:""}</li>`).join("")||`<li class="muted">Ingen regler</li>`}</ul>
      ${own?`<div class="row small" style="margin-top:8px"><select id="kr-a">${copt(D.kategorier[0])}</select> og <select id="kr-b">${copt(D.kategorier[1]||D.kategorier[0])}</select><button class="btn sm" data-a="kat-addrule">Tilføj regel</button></div>`:""}
      <div class="fld" style="margin-top:16px"><label>Konkurrentadskillelse</label></div>
      <div class="radio">${D.kategorier.map(c=>`<label><input type="checkbox" data-kx="${esc(c)}" ${(D.eksklusiv||[]).includes(c)?"checked":""} ${ro}> Kun én kunde fra ${esc(c)} pr. break</label>`).join("")}</div>
      ${own?`<div class="row small" style="margin-top:16px"><input type="text" id="kc-new" placeholder="Ny branche, fx Forsikring" aria-label="Ny branche"><button class="btn sm" data-a="kat-addcat">Tilføj branche</button></div>`:""}
    </div>
    <div><div class="fld"><label>Kundernes branche</label></div>
      <div style="max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:6px"><table><tbody>${ks.map(k=>`<tr><td>${esc(k)}</td><td style="width:150px"><select data-kk="${esc(k)}" ${ro} aria-label="Branche for ${esc(k)}">${opt((D.kunder||{})[k])}</select></td></tr>`).join("")}</tbody></table></div>
    </div>
  </div></div>`;}
function vIndst(){
  const bs=S.cfg.breaks;const own=S.isOwner!==false;const ro=own?"":"disabled";
  const nextY=S.year+1;const lastW=weeksIn(S.year);
  const carry=all().filter(b=>b.year===S.year&&live(b)&&((b.uger||[]).includes(lastW)||(b.uger||[]).includes(52)));
  const already=new Set(all().filter(b=>b.year===nextY).map(b=>b.kunde+"|"+b.breakId));
  return `<div class="row between"><h2>Indstillinger</h2><span class="note">Version ${window.SL_VERSION||"Claude-udgave"}</span></div>${own?"":`<div class="banner small">Kun ejeren kan ændre breaks, brancher og regler. Du kan se dem her.</div>`}
  <div class="card pad"><div class="row between"><h3>Breaks</h3>${own?`<button class="btn pri" data-a="save-cfg">Gem breaks</button>`:""}</div>
    <p class="note">"Gange dagligt" bruges til at beregne visninger i rapporterne. Ind/ud lægges til breakets længde. Buffer lægges til snittet og giver placeholder-tiden i MediaTool. Maks længde bruges til at beregne belægning og ledig reklametid. "Med i snit" styrer hvilke breaks der indgår i gennemsnittet.</p>
    <div class="tw"><table><thead><tr><th>Break</th><th class="n">Gange dagligt</th><th class="n">Ind/ud (sek)</th><th class="n">Buffer (sek)</th><th class="n">Maks længde (sek)</th><th>Med i snit</th><th></th></tr></thead><tbody>
    ${bs.map((b,i)=>`${i===0||bs[i-1].type!==b.type?`<tr class="cfgsub"><td colspan="7">${b.type}s</td></tr>`:""}<tr><td><input type="text" value="${esc(b.navn)}" data-c="${i}" data-k="navn" ${ro} style="width:200px"></td><td class="n"><input type="number" min="0" value="${b.perDag}" data-c="${i}" data-k="perDag" ${ro} style="width:70px"></td><td class="n"><input type="number" min="0" value="${b.bumper}" data-c="${i}" data-k="bumper" ${ro} style="width:70px"></td><td class="n"><input type="number" min="0" value="${b.buffer}" data-c="${i}" data-k="buffer" ${ro} style="width:70px"></td><td class="n"><input type="number" min="0" value="${maksOf(b)}" data-c="${i}" data-k="maks" ${ro} style="width:80px"></td><td><input type="checkbox" ${b.snit?"checked":""} data-c="${i}" data-k="snit" ${ro} aria-label="Med i snit"></td><td>${isX(b)?'<span class="xtag">Ekstra</span> ':""}${own?`<button class="btn ghost icon sm danger rmx" data-force="1" data-a="rm-brk" data-id="${b.id}" title="Fjern ${esc(b.navn)}" aria-label="Fjern ${esc(b.navn)}">✕</button>`:""}</td></tr>`).join("")}
    </tbody></table></div>
    ${own?`<div class="row" style="margin-top:10px;gap:8px"><span class="small muted">Ekstraordinært break:</span>${TYPES.map(t=>`<button class="btn sm" data-a="add-brk" data-t="${t}">+ ${t}</button>`).join("")}</div><p class="note">Et ekstra break indgår i planlægning, ugeplan og alle rapporter som de andre. Det tæller kun med i belægning i de uger, hvor det har spots, og er som udgangspunkt ikke med i snittet. Et ekstra break kan slettes med det samme, også med bookinger, som så slettes med det. Et fast break kan kun fjernes, når det ikke har bookinger.</p>`:""}
    <div class="fld" style="margin-top:14px;max-width:760px"><label for="liveurl">Live-signal (stream-adresse .m3u8 eller indlejrings-link)</label><input id="liveurl" type="text" placeholder="https://… fra jeres streamingleverandør" value="${esc(S.cfg.liveUrl||"")}" ${ro}><span class="note">Bruges af Live-knappen øverst. Indsæt kun en adresse, som leverandøren har givet til visning på jeres egen side. Brug aldrig et login med kode.</span></div>
    <div class="row" style="margin-top:10px"><label for="dpu" class="small">Sendedage pr. uge</label><input id="dpu" type="number" min="1" max="7" value="${S.cfg.dagePrUge||7}" ${ro} style="width:70px"></div>
  </div>
  ${vKat()}
  ${S.canWrite?`<div class="grid2">
  <div class="card pad"><h3>Overfør løbende aftaler til ${nextY}</h3>
    <p class="note">Bookinger der kører i uge ${lastW} i ${S.year}. Markerede kopieres til ${nextY} med valgte uger og status Option, til de er bekræftet.</p>
    <div class="row small" style="margin:6px 0 10px"><label for="cfra">Uge</label><input id="cfra" type="number" min="1" max="${weeksIn(nextY)}" value="1" style="width:64px"><label for="ctil">til</label><input id="ctil" type="number" min="1" max="${weeksIn(nextY)}" value="${weeksIn(nextY)}" style="width:64px"><button class="btn sm" data-a="carry-all">Vælg alle</button></div>
    <div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:6px"><table><tbody>${carry.sort((a,b)=>a.kunde.localeCompare(b.kunde,"da")||a.breakId.localeCompare(b.breakId)).map(b=>{const dup=already.has(b.kunde+"|"+b.breakId);return `<tr><td style="width:30px"><input type="checkbox" class="carry" value="${esc(b.id)}" ${dup?"disabled":""} aria-label="Overfør ${esc(b.kunde)} ${b.breakId}"></td><td>${esc(b.kunde)}</td><td>${b.breakId}</td><td class="n">${b.sek}s</td><td class="small muted">${dup?"findes i "+nextY:""}</td></tr>`;}).join("")||`<tr><td class="muted">Ingen bookinger kører ved årsskiftet</td></tr>`}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn pri" data-a="carry">Opret i ${nextY}</button></div>
  </div>
  <div class="card pad"><h3>Ret kundenavn overalt</h3>
    <p class="note">Samler stavevarianter, så rapporterne tæller rigtigt. Ændrer navnet på alle bookinger i alle år.</p>
    <div class="row" style="margin-top:8px"><div class="fld" style="flex:1"><label for="rnfra">Nuværende navn</label><select id="rnfra">${kunder().map(k=>`<option>${esc(k)}</option>`).join("")}</select></div>
    <div class="fld" style="flex:1"><label for="rntil">Nyt navn</label><input id="rntil" type="text" list="kl"></div></div>
    <datalist id="kl">${kunder().map(k=>`<option value="${esc(k)}">`).join("")}</datalist>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="rename">Omdøb</button></div>
  </div>
  <div class="card pad"><h3>Navngiv eller omdøb spot</h3>
    <p class="note">Et spot er kunde + spotnavn + længde. Navnet skifter på alle bookinger med det spot, i alle år.</p>
    <div class="row" style="margin-top:8px"><div class="fld" style="flex:1"><label for="rsfra">Spot</label><select id="rsfra">${library().filter(x=>all().some(b=>sameSpot(b,x.kunde,x.spot,x.sek))).map(x=>`<option value="${esc(JSON.stringify([x.kunde,x.spot||"",+x.sek]))}">${esc(x.kunde)} · ${esc(x.spot||"(uden navn)")} · ${x.sek}s</option>`).join("")}</select></div>
    <div class="fld" style="flex:1"><label for="rstil">Nyt spotnavn</label><input id="rstil" type="text" maxlength="80" placeholder="fx R018 Julekampagne"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="rename-spot">Gem spotnavn</button></div>
  </div></div>`:""}`;
}

// ---------- Live-signal ----------
function loadHls(){return new Promise((res,rej)=>{if(window.Hls){res(window.Hls);return;}const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js";sc.onload=()=>res(window.Hls);sc.onerror=()=>rej(new Error("hls"));document.head.appendChild(sc);});}
let liveHls=null;
function stopLive(){if(liveHls){try{liveHls.destroy();}catch(e){}liveHls=null;}const box=$("#livebox");box.innerHTML="";box.hidden=true;}
async function drawLive(){const box=$("#livebox");const btn=$("#livebtn");btn&&btn.setAttribute("aria-pressed",S.liveOn?"true":"false");
  if(!S.liveOn){stopLive();return;}
  const url=(S.cfg.liveUrl||"").trim();if(box.dataset.url===url&&!box.hidden)return;stopLive();box.dataset.url=url;box.hidden=false;
  box.classList.toggle("big",!!S.liveBig);
  box.innerHTML=`<div class="lh"><span class="ld" aria-hidden="true"></span><span>SPORT LIVE · Live</span><span class="sp"></span><button class="btn ghost sm icon" data-a="live-size" title="Større/mindre" aria-label="Skift størrelse">⤢</button><button class="btn ghost sm icon" data-a="live" title="Luk" aria-label="Luk live-vindue">✕</button></div><div class="lv" id="lv"></div>`;
  const lv=$("#lv");const PM="https://playmakertv.dk";
  const pmBtn=`<div style="display:flex;flex-direction:column;gap:10px;align-items:center"><a class="btn pri" href="${PM}" target="_blank" rel="noopener" data-a="pm-open">Åbn SPORT LIVE på PlayMaker</a><span class="small">Log ind med dit eget login. Højreklik derefter på videoen og vælg <b>Billede-i-billede</b>, så svæver signalet over systemet.</span></div>`;
  const msg=(t,withPm)=>{lv.innerHTML=`<div class="lmsg"><div style="display:flex;flex-direction:column;gap:12px">${t?`<span>${t}</span>`:""}${withPm?pmBtn:""}</div></div>`;};
  if(!url){msg("",true);return;}
  if(/playmakertv\.dk\/login/i.test(url)){msg("PlayMakers login-side kan ikke vises inde i systemet.",true);return;}
  if(!window.__gas){msg("I Claude-versionen kan signalet ikke vises inde i siden.",true);return;}
  if(/\.m3u8(\?|$)/i.test(url)){const v=document.createElement("video");v.controls=true;v.muted=true;v.autoplay=true;v.playsInline=true;lv.appendChild(v);
    if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=url;}
    else{try{const Hls=await loadHls();if(!Hls||!Hls.isSupported()){msg("Browseren kan ikke afspille signalet.");return;}liveHls=new Hls({liveDurationInfinity:true});liveHls.loadSource(url);liveHls.attachMedia(v);
      liveHls.on(Hls.Events.ERROR,(e,d)=>{if(d.fatal)msg("Signalet kunne ikke hentes. Tjek adressen, eller om leverandøren tillader visning på denne side.");});}catch(e){msg("Afspilleren kunne ikke indlæses.");return;}}
    v.play().catch(()=>{});}
  else{const f=document.createElement("iframe");f.src=url;f.allow="autoplay; fullscreen; picture-in-picture";f.allowFullscreen=true;f.referrerPolicy="strict-origin-when-cross-origin";f.title="SPORT LIVE live-signal";lv.appendChild(f);}}

// ---------- Booking-modal ----------
function openModal(id){
  const ex=id?S.bookings.get(id):null;
  const d=ex?JSON.parse(JSON.stringify(ex)):{id:null,year:S.year,breakId:"",kunde:"",kanal:"Castory",spot:"",sek:20,pos:null,uger:[],status:"Bekræftet",note:"",ordrenr:""};
  S.modal={d,ex:!!ex,breaks:new Set(ex?[ex.breakId]:[]),confirmDel:false};
  drawModal();
}
function drawModal(){
  const M=S.modal;if(!M){$("#modalroot").innerHTML="";return;}const d=M.d;const nW=weeksIn(d.year);const set=new Set(d.uger);const ro=!S.canWrite?"disabled":"";
  const wb=Array.from({length:nW},(_,i)=>{const w=i+1;const m=weekMon(d.year,w);return `<button type="button" data-a="wtog" data-w="${w}" class="${set.has(w)?"on":""}${d.year===TODAY[0]&&w===TODAY[1]?" cur":""}" title="Uge ${w}: ${esc(weekLabel(d.year,w))}" ${ro}>${w}</button>`;}).join("");
  const bsel=M.ex?`<select id="m-break" ${ro}>${S.cfg.breaks.map(b=>`<option value="${b.id}" ${b.id===d.breakId?"selected":""}>${esc(b.navn)}</option>`).join("")}</select>`:
    `<div class="bchips">${S.cfg.breaks.map(b=>`<label><input type="checkbox" data-a="btog" value="${b.id}" ${M.breaks.has(b.id)?"checked":""}>${esc(b.navn)}</label>`).join("")}</div>`;
  const per=d.uger.length*(M.ex?spotsPrUge(d):0);
  const meta=M.ex&&d.updatedAt?`<span class="note" id="m-meta">Sidst ændret ${esc(new Date(d.updatedAt).toLocaleString("da-DK",{dateStyle:"medium",timeStyle:"short"}))}</span>`:"";
  $("#modalroot").innerHTML=`<div class="scrim" data-a="close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <header><h2 id="m-t">${M.ex?esc(d.kunde)+" · "+esc(brk(d.breakId).navn):"Ny booking"}</h2><button class="btn ghost" data-a="close" aria-label="Luk">✕</button></header>
    <form class="body" id="mform" autocomplete="off"><div class="errbox" id="m-err" hidden></div>
      <div class="fld s3"><label for="m-kunde">Kunde</label><input id="m-kunde" type="text" list="m-kl" value="${esc(d.kunde)}" required ${ro}><datalist id="m-kl">${kunder().map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      <div class="fld s2"><label for="m-kanal">Salgskanal</label><select id="m-kanal" ${ro}>${kanalerFor(d.year).map(k=>`<option ${k===kanalFor(d.year,d.kanal)?"selected":""}>${k}</option>`).join("")}</select></div>
      <div class="fld"><label for="m-ordre">Ordrenr.</label><input id="m-ordre" type="text" value="${esc(d.ordrenr)}" ${ro}></div>
      <div class="fld s3"><label for="m-spot">Spot-ID / filnavn</label><input id="m-spot" type="text" value="${esc(d.spot)}" ${ro}></div>
      <div class="fld"><label for="m-sek">Sekunder</label><input id="m-sek" type="number" min="1" max="300" value="${esc(d.sek)}" required ${ro}></div>
      <div class="fld s2"><label for="m-status">Status</label><select id="m-status" ${ro}>${STATUSER.map(s=>`<option ${s===d.status?"selected":""}>${s}</option>`).join("")}</select></div>
      <div class="fld s6"><label>${M.ex?"Break":"Breaks (vælg en eller flere)"}</label>${bsel}</div>
      <div class="fld s6"><div class="row between"><label>Uger i ${d.year} <span class="num" style="text-transform:none;letter-spacing:0">(${d.uger.length} valgt${d.uger.length?": "+esc(ranges(d.uger)):""})</span></label>
        <div class="row small" style="gap:6px">Uge <input id="m-fra" type="number" min="1" max="${nW}" value="${d.uger[0]||S.week}" style="width:58px" ${ro}> til <input id="m-til" type="number" min="1" max="${nW}" value="${d.uger.at(-1)||nW}" style="width:58px" ${ro}>
        <select id="m-mon" ${ro}><option value="1">hver uge</option><option value="2">hver 2. uge</option></select><button type="button" class="btn sm" data-a="wfill" ${ro}>Udfyld</button><button type="button" class="btn sm ghost" data-a="wclear" ${ro}>Ryd</button></div></div>
        <div class="wgrid" style="margin-top:6px">${wb}</div></div>
      <div class="fld s4"><label for="m-note">Note</label><textarea id="m-note" ${ro}>${esc(d.note)}</textarea></div>
      <div class="fld s2"><label for="m-pos">Fast placering i break</label><input id="m-pos" type="number" min="1" value="${d.pos??""}" placeholder="Automatisk" ${ro}>
        ${M.ex?`<span class="note" style="margin-top:6px">${fmtN(per)} visninger · ${fmtDur(per*(+d.sek||0))} sendetid i ${d.year}</span>`:""}</div>
    </form>
    <footer><div class="row">${M.ex&&S.canWrite?(M.confirmDel?`<span class="small">Slet bookingen permanent?</span><button class="btn danger" data-a="del-yes">Ja, slet</button><button class="btn ghost" data-a="del-no">Fortryd</button>`:`<button class="btn ghost danger" data-a="del">Slet</button><button class="btn ghost" data-a="dup">Kopiér til nye breaks</button>`):""}${meta}</div>
      <div class="row"><button class="btn" data-a="close">Annullér</button>${S.canWrite?`<button class="btn pri" data-a="save">${M.ex?"Gem":"Opret"}</button>`:""}</div></footer>
  </div></div>`;
  if(M.ex&&d.updatedBy&&S.user){S.user.profiles([d.updatedBy]).then(ps=>{const n=ps?.[d.updatedBy]?.name;const el=$("#m-meta");if(n&&el)el.textContent+=" af "+n;}).catch(()=>{});}
  setTimeout(()=>{const k=$("#m-kunde");if(k&&!M.ex)k.focus();},0);
}
function readForm(){const d=S.modal.d;d.kunde=$("#m-kunde").value.trim();d.kanal=$("#m-kanal").value;d.ordrenr=$("#m-ordre").value.trim();d.spot=$("#m-spot").value.trim();
  d.sek=Math.max(0,parseInt($("#m-sek").value,10)||0);d.status=$("#m-status").value;d.note=$("#m-note").value.trim();const p=parseInt($("#m-pos").value,10);d.pos=Number.isFinite(p)?p:null;
  if(S.modal.ex)d.breakId=$("#m-break").value;}

// ---------- Skift / fjern kunde ----------
function openAct(kind,id){const b=S.bookings.get(id);if(!b)return;S.act={kind,id,scope:kind==="rm"?"uge":"frem",kunde:"",sek:"",kanal:b.kanal};drawAct();}
function actWeeks(){const a=S.act,b=S.bookings.get(a.id);if(!b)return [];const w=S.week;
  return a.scope==="uge"?b.uger.filter(x=>x===w):a.scope==="frem"?b.uger.filter(x=>x>=w):[...b.uger];}
function actPreview(){const a=S.act,b=S.bookings.get(a.id);const W=actWeeks();const br=brk(b.breakId);const swap=a.kind==="swap";const newSek=+a.sek||0;const d=swap?(newSek?newSek-b.sek:null):-b.sek;
  const html=!W.length?`<b>${esc(b.kunde)}</b> kører ikke i de valgte uger.`:
    swap?(newSek?`${esc(br.navn)} ændres med <b>${d>0?"+":d<0?"−":"±"}${Math.abs(d)} sek</b> i ${W.length} ${W.length===1?"uge":"uger"} (uge ${esc(ranges(W))}). Uge ${S.week}: ${fmtDur(breakLen(S.year,S.week,b.breakId))} → <b>${fmtDur(breakLen(S.year,S.week,b.breakId)+(W.includes(S.week)?d:0))}</b>`:"Vælg den nye kunde og længde.")
    :`${esc(br.navn)} bliver <b>${b.sek} sek kortere</b> i ${W.length} ${W.length===1?"uge":"uger"} (uge ${esc(ranges(W))}).${a.scope==="alle"?" Bookingen slettes helt.":""}`;
  const bl=swap&&a.kunde?blocked(b.year,b.breakId,a.kunde.trim(),W,b.id):[];
  return {html:bl.length?`<span class="conf">Ikke tilladt: ${esc(blockMsg(a.kunde.trim(),b.breakId,bl))}</span>`:html,dis:!W.length||(swap&&(!a.kunde||!newSek))||bl.length>0};}
function updAct(){const p=actPreview();const el=$("#a-prev");if(el)el.innerHTML=p.html;const g=$("#a-go");if(g)g.disabled=p.dis;}
function drawAct(){const a=S.act;const root=$("#actroot");if(!a){root.innerHTML="";return;}const b=S.bookings.get(a.id);if(!b){S.act=null;root.innerHTML="";return;}
  const W=actWeeks();const br=brk(b.breakId);const swap=a.kind==="swap";
  const newSek=+a.sek||0;const d=swap?(newSek?newSek-b.sek:null):-b.sek;
  const lib=library();
  const scopes=[["uge",`Kun uge ${S.week}`],["frem",`Fra uge ${S.week} og frem`],["alle",swap?"Alle uger":"Hele bookingen (slet)"]];
  const prev=actPreview();
  root.innerHTML=`<div class="scrim" data-a="act-close-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="a-t" style="width:min(520px,100%)">
    <header><h2 id="a-t">${swap?"Skift kunde ud":"Fjern kunde"} · ${esc(br.navn)}</h2><button class="btn ghost" data-a="act-close" aria-label="Luk">✕</button></header>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
      <div class="row"><span class="sw" style="background:var(${KVAR[b.kanal]||"--k-eg"})"></span><b>${esc(b.kunde)}</b><span class="muted">${b.sek} sek · uge ${esc(ranges(b.uger))}</span></div>
      ${swap?`<div class="row" style="align-items:end"><div class="fld" style="flex:1"><label for="a-k">Ny kunde</label><input id="a-k" type="text" list="a-kl" value="${esc(a.kunde)}" autocomplete="off"><datalist id="a-kl">${[...new Set(lib.map(x=>x.kunde))].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
        <div class="fld" style="flex:1"><label for="a-sp">Spot</label><input id="a-sp" type="text" list="a-spl" value="${esc(a.spot||"")}" placeholder="Spotnavn" autocomplete="off"><datalist id="a-spl">${spotOpts(a.kunde)}</datalist></div>
        <div class="fld"><label for="a-s">Sek</label><input id="a-s" type="number" min="1" value="${esc(a.sek)}" style="width:76px"></div>
        <div class="fld"><label for="a-ka">Kanal</label><select id="a-ka">${kanalerFor(S.year).map(k=>`<option ${k===kanalFor(S.year,a.kanal)?"selected":""}>${k}</option>`).join("")}</select></div></div>`:""}
      <div class="fld"><label>Gælder</label><div class="radio">${scopes.map(([k,l])=>`<label><input type="radio" name="a-sc" value="${k}" ${a.scope===k?"checked":""}> ${l}</label>`).join("")}</div></div>
      <div class="preview" id="a-prev">${prev.html}</div>
    </div>
    <footer><span></span><div class="row"><button class="btn" data-a="act-close">Annullér</button><button class="btn ${swap?"pri":"danger"}" data-a="act-go" id="a-go" ${prev.dis?"disabled":""}>${swap?"Skift":"Fjern"}</button></div></footer>
  </div></div>`;}
async function doAct(){const a=S.act,b=S.bookings.get(a.id);if(!b)return;const W=actWeeks();if(!W.length)return;
  const rest=b.uger.filter(w=>!W.includes(w));
  if(a.kind==="swap"){const k=a.kunde.trim(),sk=+a.sek;if(!k||!sk)return;if(blocked(b.year,b.breakId,k,W,b.id).length)return;
    const src=libFind(k,a.spot,sk),nsp=a.spot!==undefined?(a.spot||""):(src.spot||"");
    const ex=all().find(x=>x.year===b.year&&x.breakId===b.breakId&&sameSpot(x,k,nsp,sk)&&live(x)&&x.id!==b.id);
    if(ex){await setWeeks(ex.id,[...ex.uger,...W],true);}
    else{const nid=S.db.collection("bookings").doc().id;await writeDoc(nid,clean({year:b.year,breakId:b.breakId,kunde:k,kanal:a.kanal,spot:nsp,sek:sk,pos:b.pos??null,uger:W,status:"Bekræftet",note:"",ordrenr:""}));}
    if(rest.length)await setWeeks(b.id,rest,true);else{await dbDel(b.id);}
    const d=sk-b.sek;toast(`${b.kunde} → ${k} i ${brk(b.breakId).navn}: ${d>0?"+":d<0?"−":"±"}${Math.abs(d)}s i uge ${ranges(W)}`);}
  else{if(rest.length)await setWeeks(b.id,rest,true);else{await dbDel(b.id);}
    toast(`${b.kunde} fjernet fra ${brk(b.breakId).navn}: −${b.sek}s i uge ${ranges(W)}`);}
  S.act=null;drawAct();}
document.addEventListener("change",e=>{if(!S.act)return;const el=e.target;if(el.name==="a-sc"){S.act.scope=el.value;}else if(el.id==="a-ka"){S.act.kanal=el.value;}
  else if(el.id==="a-k"){S.act.kunde=el.value.trim();const v=library().filter(x=>x.kunde===S.act.kunde);const dl=$("#a-spl");if(dl)dl.innerHTML=spotOpts(S.act.kunde);if(v.length){const f=v.find(x=>x.spot)||v[0];S.act.sek=f.sek;S.act.kanal=f.kanal;S.act.spot=f.spot||"";const sn=$("#a-s"),kn=$("#a-ka"),spn=$("#a-sp");if(sn)sn.value=S.act.sek;if(kn)kn.value=S.act.kanal;if(spn)spn.value=S.act.spot;}}
  else if(el.id==="a-sp"){S.act.spot=el.value.trim();const f=library().find(x=>x.kunde===S.act.kunde&&(x.spot||"")===S.act.spot);if(f){S.act.sek=f.sek;const sn=$("#a-s");if(sn)sn.value=f.sek;}}
  else if(el.id==="a-s"){S.act.sek=el.value;}else return;updAct();});
document.addEventListener("input",e=>{if(!S.act)return;const el=e.target;if(el.id==="a-sp"){S.act.spot=el.value.trim();return;}if(el.id==="a-s"){S.act.sek=el.value;updAct();}else if(el.id==="a-k"){S.act.kunde=el.value.trim();updAct();}});

// ---------- Skrivninger ----------
function clean(d){return {year:d.year,breakId:d.breakId,kunde:d.kunde,kanal:kanalFor(d.year,d.kanal),spot:d.spot||"",sek:+d.sek||0,pos:d.pos??null,uger:[...new Set(d.uger)].sort((a,b)=>a-b),status:d.status,note:d.note||"",ordrenr:d.ordrenr||"",updatedAt:new Date().toISOString(),updatedBy:S.meId||null};}
async function writeDoc(id,data){try{await dbSet(id,data);return true;}catch(e){failWrite(e);return false;}}
function failWrite(e){if(e?.code==="invalid_argument"&&S.canWrite===null){S.canWrite=false;render();}toast(e?.message?("Kunne ikke gemme: "+e.message):"Kunne ikke gemme. Prøv igen.");}
async function saveModal(){
  readForm();const M=S.modal,d=M.d;
  if(!d.kunde){toast("Angiv kunde");$("#m-kunde").focus();return;}
  if(!d.sek){toast("Angiv længde i sekunder");return;}
  if(!d.uger.length){toast("Vælg mindst én uge");return;}
  {const ids=M.ex?[d.breakId]:[...M.breaks];const msgs=[];for(const bId of ids){const bl=blocked(d.year,bId,d.kunde,d.uger,d.id);if(bl.length)msgs.push(blockMsg(d.kunde,bId,bl));}
   const box=$("#m-err");if(msgs.length){if(box){box.hidden=false;box.innerHTML="Ikke tilladt: "+msgs.map(esc).join("<br>");}return;}else if(box)box.hidden=true;}
  if(M.ex){const ok=await writeDoc(d.id,clean(d));if(ok){S.modal=null;drawModal();toast("Booking gemt");}}
  else{if(!M.breaks.size){toast("Vælg mindst ét break");return;}
    let n=0;for(const b of M.breaks){const id=S.db.collection("bookings").doc().id;if(await writeDoc(id,clean({...d,breakId:b})))n++;}
    if(n){S.modal=null;drawModal();toast(n===1?"Booking oprettet":`${n} bookinger oprettet`);}}
}
async function move(breakId,id,dir){
  const items=activeIn(S.year,S.week,breakId).sort(sortPos);const i=items.findIndex(x=>x.id===id);const j=i+dir;if(i<0||j<0||j>=items.length)return;
  [items[i],items[j]]=[items[j],items[i]];
  for(let k=0;k<items.length;k++){const b=items[k];if(b.pos!==k+1){await dbUpdate(b.id,{pos:k+1});}}
}

// ---------- Eksport ----------
function weekRows(){const y=S.year,w=S.week;const out=[];for(const t of TYPES){for(const b of S.cfg.breaks.filter(x=>x.type===t)){const items=activeIn(y,w,b.id).sort(sortPos);
  items.forEach((x,i)=>out.push({Break:b.navn,Rækkefølge:i+1,Kunde:x.kunde,"Spot/filnavn":x.spot,Sek:x.sek,Kanal:x.kanal,Status:x.status,Note:x.note}));
  if(items.length&&b.bumper)out.push({Break:b.navn,Rækkefølge:"",Kunde:"Breaker ind/ud",Sek:b.bumper});
  if(items.length){const L=breakLen(y,w,b.id);if(t==="Sponsorbreak")out.push({Break:b.navn,Rækkefølge:"",Kunde:"Total antal sekunder",Sek:L});else{out.push({Break:b.navn,Rækkefølge:"",Kunde:"Total antal sek.",Sek:L});out.push({Break:b.navn,Rækkefølge:"",Kunde:"Total antal min.",Sek:fmtDur(L)});}}}
  if(t!=="Sponsorbreak"){const a=Math.round(groupAvg(y,w,t)),buf=(S.cfg.breaks.find(x=>x.type===t)||{}).buffer||0;out.push({Break:t+"s",Kunde:"Gennemsnit alle breaks i sek.",Sek:a});out.push({Break:t+"s",Kunde:"Gennemsnit alle breaks i min.",Sek:fmtDur(a)});out.push({Break:t+"s",Kunde:"Placeholder tid i MediaTool",Sek:fmtDur(a+buf),Note:"snit + "+buf+" sek"});}out.push({});}
  return out;}
async function saveXlsx(name,sheets){
  if(!window.XLSX){toast("Excel-modulet kunne ikke indlæses");return;}
  const wb=XLSX.utils.book_new();for(const [n,rows] of sheets){const ws=XLSX.utils.json_to_sheet(rows);const keys=Object.keys(rows.find(r=>Object.keys(r).length)||{});ws["!cols"]=keys.map(k=>({wch:Math.min(48,Math.max(k.length,...rows.map(r=>String(r[k]??"").length))+2)}));XLSX.utils.book_append_sheet(wb,ws,n.slice(0,31));}
  const buf=XLSX.write(wb,{type:"array",bookType:"xlsx"});
  try{await S.dl.save({filename:name,data:new Blob([buf])});toast("Fil gemt");}catch(e){if(e?.code!=="declined")toast(e?.code==="rate_limited"?"Vent et øjeblik og prøv igen":"Filen kunne ikke gemmes her");}
}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast("Kopieret");}catch{toast("Kopiering blev afvist af browseren");}}
function repRows(){const f=S.rf;const A=aggregate(f);
  const over=A.perKunde.map(r=>({Kunde:r.kunde,Kanal:[...r.kanaler].join(", "),Bookinger:r.n,Uger:r.uger.size,Visninger:r.spots,"Sendetid (sek)":r.sek,"Sendetid":fmtDur(r.sek),"Andel %":+(r.sek/(A.tot.sek||1)*100).toFixed(1)}));
  const det=A.rows.slice().sort((a,b)=>a.b.kunde.localeCompare(b.b.kunde,"da")||a.b.breakId.localeCompare(b.b.breakId)).map(r=>({Kunde:r.b.kunde,Break:r.br.navn,"Spot/filnavn":r.b.spot,Sek:+r.b.sek,Kanal:r.b.kanal,Uger:ranges(r.ws),"Antal uger":r.ws.length,"Visninger pr. uge":(r.br.perDag||0)*(S.cfg.dagePrUge||7),Visninger:r.spots,"Sendetid (sek)":r.sek,Sendetid:fmtDur(r.sek)}));
  const uge=[];for(let w=f.fra;w<=f.til;w++){const o=A.perUge.get(w)||{spots:0,sek:0};uge.push({Uge:w,Periode:weekLabel(f.year,w),Visninger:o.spots,"Sendetid (sek)":o.sek,Sendetid:fmtDur(o.sek)});}
  const info=[{Felt:"Kunde",Værdi:f.kunde||"Alle kunder"},{Felt:"Periode",Værdi:`Uge ${f.fra}–${f.til}, ${f.year}`},{Felt:"Salgskanal",Værdi:f.kanal||"Alle"},{Felt:"Breaktype",Værdi:f.type||"Alle"},{Felt:"Visninger i alt",Værdi:A.tot.spots},{Felt:"Sendetid i alt",Værdi:fmtDur(A.tot.sek)},{Felt:"Beregning",Værdi:`Planlagt: uger × gange dagligt × ${S.cfg.dagePrUge||7} dage`},{Felt:"Udtrukket",Værdi:new Date().toLocaleString("da-DK")}];
  return {A,f,sheets:[["Rapport",info],...(f.kunde?[]:[["Pr. kunde",over]]),["Detaljer",det],["Pr. uge",uge]]};}

// ---------- Events ----------
document.addEventListener("click",e=>{const p=$("#histpop");if(p&&!p.hidden&&!e.target.closest(".hist")){p.hidden=true;$("#histbtn").setAttribute("aria-expanded","false");}},true);
document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-a]");if(!t)return;const a=t.dataset.a;
  if(a==="close-bg"&&e.target!==t)return;
  if(a==="pm-open"&&!window.__gas)return; // Claude-versionen: lad linket åbne normalt
  if(t.tagName==="A"||t.tagName==="BUTTON")e.preventDefault();
  if(a==="undo"){await undo();return;}
  await txRun(async()=>{
  switch(a){
    case "wk-prev":[S.year,S.week]=shiftWeek(S.year,S.week,-1);S.rf=null;render();break;
    case "wk-next":[S.year,S.week]=shiftWeek(S.year,S.week,1);S.rf=null;render();break;
    case "wk-now":[S.year,S.week]=TODAY;S.rf=null;render();break;
    case "go":location.hash=t.dataset.v;break;
    case "ptab":S.pt=t.dataset.t;render();break;
    case "pwin":S.pwin=t.dataset.k;render();break;
    case "pweek":S.week=+t.dataset.w;render();break;
    case "pcol":{const id=t.dataset.b;S.collapsed.has(id)?S.collapsed.delete(id):S.collapsed.add(id);render();break;}
    case "nl-add":{const k=$("#nl-k").value.trim(),sp=$("#nl-sp").value.trim(),sk=parseInt($("#nl-s").value,10);if(!k||!sp||!sk){toast("Angiv kunde, spotnavn og sekunder");break;}if(library().some(x=>sameSpot(x,k,sp,sk))){toast("Det spot findes allerede");S.pq=sp;render();break;}S.lib.push({kunde:k,sek:sk,kanal:$("#nl-ka").value,spot:sp});S.pq=k;render();toast("Træk "+k+" ind i en uge");break;}
    case "new":openModal(null);break;
    case "edit":openModal(t.dataset.id);break;
    case "close":case "close-bg":S.modal=null;drawModal();break;
    case "swap":openAct("swap",t.dataset.id);break;
    case "q-go":await runQuick(t.dataset.key);break;
    case "ovp":S.ovp=t.dataset.k;try{localStorage.setItem("sl-ovp",S.ovp);}catch(e){}render();break;
    case "ovprev":shiftPeriod(S.ovp||"uge",-1);break;
    case "ovnext":shiftPeriod(S.ovp||"uge",1);break;
    case "wk-nextnow":[S.year,S.week]=shiftWeek(TODAY[0],TODAY[1],1);render();break;
    case "hist":{const pop=$("#histpop");pop.hidden=!pop.hidden;$("#histbtn").setAttribute("aria-expanded",String(!pop.hidden));drawHist();break;}
    case "tip-ok":try{localStorage.setItem("sl-tip-ug","1");}catch(e){}render();break;
    case "godk":await doGodk();break;
    case "ugodk":{const g={...S.godk};delete g[S.year+"-"+S.week];try{await S.db.doc("status/godkendt").set({uger:g});toast(`Godkendelsen af uge ${S.week} er fjernet`);}catch(err){failWrite(err);}break;}
    case "live":S.liveOn=!S.liveOn;try{localStorage.setItem("sl-live",S.liveOn?"1":"");}catch(e){}drawLive();break;
    case "pm-open":{const w=window.open(t.href,"sl-live","popup=yes,width=720,height=460");if(!w)window.open(t.href,"_blank","noopener");break;}
    case "live-size":S.liveBig=!S.liveBig;$("#livebox").classList.toggle("big",S.liveBig);break;
    case "rmode":S.rmode=t.dataset.m;render();break;
    case "pvp":S.pv={r:t.dataset.r,c:t.dataset.c,m:t.dataset.m};render();break;
    case "xlsx-pv":saveXlsx(`Krydsrapport ${DIMS[S.pv.r]} x ${DIMS[S.pv.c]} uge ${S.rf.fra}-${S.rf.til} ${S.rf.year}.xlsx`,[["Krydsrapport",pvRows()]]);break;
    case "pdf-kunde":await kundePdf();break;
    case "q-close":S.q=null;drawQuick();break;
    case "q-close-bg":if(e.target===t){S.q=null;drawQuick();}break;
    case "hgo":S.week=+t.dataset.w;location.hash="ugeplan";render();break;
    case "rm":openQuick({kind:"rm",id:t.dataset.id});break;
    case "act-close":S.act=null;drawAct();break;
    case "act-close-bg":if(e.target===t){S.act=null;drawAct();}break;
    case "act-go":await doAct();break;
    case "base-reset":S.base=new Map();S.baseReady=false;primeBase();render();toast("Ændringer nulstillet");break;
    case "wtog":{readForm();const w=+t.dataset.w;const s=new Set(S.modal.d.uger);s.has(w)?s.delete(w):s.add(w);S.modal.d.uger=[...s].sort((a,b)=>a-b);drawModal();break;}
    case "wfill":{readForm();const nW=weeksIn(S.modal.d.year);const fra=Math.min(nW,Math.max(1,+$("#m-fra").value||1)),til=Math.min(nW,Math.max(fra,+$("#m-til").value||nW)),st=+$("#m-mon").value||1;const s=new Set(S.modal.d.uger);for(let w=fra;w<=til;w+=st)s.add(w);S.modal.d.uger=[...s].sort((a,b)=>a-b);drawModal();break;}
    case "wclear":readForm();S.modal.d.uger=[];drawModal();break;
    case "btog":{const s=S.modal.breaks;t.checked?s.add(t.value):s.delete(t.value);return;}
    case "save":await saveModal();break;
    case "del":S.modal.confirmDel=true;readForm();drawModal();break;
    case "del-no":S.modal.confirmDel=false;drawModal();break;
    case "del-yes":await dbDel(S.modal.d.id);S.modal=null;drawModal();toast("Booking slettet");break;
    case "dup":readForm();S.modal={d:{...S.modal.d,id:null,updatedAt:null},ex:false,breaks:new Set(),confirmDel:false};drawModal();toast("Vælg breaks til kopien");break;
    case "mv":await move(t.dataset.b,t.dataset.id,+t.dataset.d);break;
    case "rep-kunde":S.rf={...(S.rf||defaultRf()),kunde:t.dataset.k};location.hash="rapporter";render();break;
    case "rp":S.rf.fra=+t.dataset.fra;S.rf.til=+t.dataset.til;render();break;
    case "copy-week":{const rows=weekRows();copyText(`Afviklingsliste uge ${S.week} (${weekLabel(S.year,S.week)})\n\n`+rows.map(r=>Object.keys(r).length?[r.Break,r.Placering,r.Kunde,r.Sek!=null?(typeof r.Sek==="number"?r.Sek+" sek":r.Sek):"",r.Note||""].filter(x=>x!==""&&x!=null).join("  ·  "):"").join("\n"));break;}
    case "xlsx-week":saveXlsx(`Afvikling uge ${S.week} ${S.year}.xlsx`,[[`Uge ${S.week}`,weekRows()]]);break;
    case "xlsx-rep":{const R=repRows();saveXlsx(`Afviklingsrapport ${R.f.kunde||"alle kunder"} uge ${R.f.fra}-${R.f.til} ${R.f.year}.xlsx`,R.sheets);break;}
    case "copy-rep":{const R=repRows();const L=[`Afviklingsrapport: ${R.f.kunde||"alle kunder"}`,`Uge ${R.f.fra}–${R.f.til}, ${R.f.year}`,`Visninger: ${fmtN(R.A.tot.spots)}`,`Sendetid: ${fmtDur(R.A.tot.sek)}`,""];
      if(R.f.kunde)R.A.rows.forEach(r=>L.push(`${r.br.navn}: ${r.b.sek} sek, uge ${ranges(r.ws)}, ${fmtN(r.spots)} visninger`));else R.A.perKunde.forEach(r=>L.push(`${r.kunde}: ${fmtN(r.spots)} visninger, ${fmtDur(r.sek)}`));
      copyText(L.join("\n"));break;}
    case "save-cfg":{const bs=S.cfg.breaks.map(b=>({...b}));document.querySelectorAll("[data-c]").forEach(el=>{const b=bs[+el.dataset.c];const k=el.dataset.k;b[k]=k==="snit"?el.checked:k==="navn"?el.value.trim()||b.navn:Math.max(0,+el.value||0);});
      const dpu=Math.min(7,Math.max(1,+$("#dpu").value||7));const lu=($("#liveurl")?.value||"").trim();if(lu&&!/^https:\/\//.test(lu)){toast("Live-adressen skal starte med https://");break;}try{await S.db.doc("config/main").set({breaks:bs,dagePrUge:dpu,liveUrl:lu,updatedAt:new Date().toISOString()});toast("Breaks gemt");}catch(err){failWrite(err);}break;}
    case "pyear":setPlanYear(+t.dataset.y);S.planYear=S.year;render();break;
    case "sendklar":{if(!(window.__gas&&__gas.sendKlar))break;const ml=(__gas.st.mails||{})[`${S.year}-${String(S.week).padStart(2,"0")}`];if(!confirm(mailAsk(S.week,ml,false)))break;t.disabled=true;t.textContent="Sender …";await doSendKlar();render();break;}
    case "godk-mail":{if(!confirm(mailAsk(S.week,null,true)))break;t.disabled=true;t.textContent="Godkender og sender …";if(await doGodk())await doSendKlar();render();break;}
    case "theme":{const light=document.documentElement.dataset.theme!=="light";if(light)document.documentElement.dataset.theme="light";else delete document.documentElement.dataset.theme;try{localStorage.setItem("sl-theme",light?"light":"dark");}catch(e){}const b=$("#thbtn");if(b)b.textContent=light?"☾":"☀︎";render();break;}
    case "add-brk":{if(S.isOwner===false){toast("Kun ejeren kan oprette breaks");break;}const tp=t.dataset.t;const same=S.cfg.breaks.filter(b=>b.type===tp);const src=same[0]||{perDag:4,bumper:0,buffer:0,maks:0};
      let n=1;const ids=new Set(S.cfg.breaks.map(b=>b.id));while(ids.has("X"+TPRE[tp]+n))n++;
      const nb={id:"X"+TPRE[tp]+n,navn:`Ekstra ${tp.toLowerCase()}${n>1?" "+n:""}`,type:tp,perDag:src.perDag||0,bumper:src.bumper||0,buffer:src.buffer||0,maks:maksOf(src)||0,snit:false,ekstra:true};
      const bs=[...S.cfg.breaks.filter(b=>TYPES.indexOf(b.type)<TYPES.indexOf(tp)||b.type===tp),nb,...S.cfg.breaks.filter(b=>TYPES.indexOf(b.type)>TYPES.indexOf(tp))];
      try{await S.db.doc("config/main").set({...S.cfg,breaks:bs,updatedAt:new Date().toISOString()});toast(`${nb.navn} er oprettet. Træk kunder ind i det.`);if(S.view==="planlaegning"){S.pt=tp;render();}}catch(err){failWrite(err);}break;}
    case "rm-brk":{const b=S.cfg.breaks.find(x=>x.id===t.dataset.id);if(!b)break;if(S.isOwner===false){toast("Kun ejeren kan slette breaks");break;}
      const bk=all().filter(x=>x.breakId===b.id);
      if(bk.length&&!isX(b)&&!t.dataset.force){toast("Et fast break med bookinger slettes under Indstillinger.");break;}
      if(bk.length&&!confirm(isX(b)?`Slet ${b.navn} med ${bk.length} reklame${bk.length===1?"":"r"}?`:`${b.navn} er et fast break med ${bk.length} reklame${bk.length===1?"":"r"}. Slet breaket og reklamerne?`))break;
      try{let done=false;if(window.__gas&&__gas.deleteBreak){try{await __gas.deleteBreak(b.id);done=true;}catch(e){if(!/Ukendt handling/i.test(e?.message||""))throw e;}}
        if(!done){for(const x of bk)await S.db.collection("bookings").doc(x.id).delete();
          await S.db.doc("config/main").set({...S.cfg,breaks:S.cfg.breaks.filter(x=>x.id!==b.id),updatedAt:new Date().toISOString()});}
        toast(`${b.navn} er slettet`);}catch(err){failWrite(err);}break;}
    case "carry-all":document.querySelectorAll(".carry:not(:disabled)").forEach(c=>c.checked=true);break;
    case "carry":{const ids=[...document.querySelectorAll(".carry:checked")].map(c=>c.value);if(!ids.length){toast("Vælg bookinger");break;}
      const ny=S.year+1,nW=weeksIn(ny);const fra=Math.max(1,+$("#cfra").value||1),til=Math.min(nW,Math.max(fra,+$("#ctil").value||nW));const ug=[];for(let w=fra;w<=til;w++)ug.push(w);
      t.disabled=true;let n=0;const skip=[];for(const id of ids){const b=S.bookings.get(id);if(!b)continue;const bl=blocked(ny,b.breakId,b.kunde,ug);if(bl.length){skip.push(blockMsg(b.kunde,b.breakId,bl));continue;}const nid=S.db.collection("bookings").doc().id;if(await writeDoc(nid,clean({...b,year:ny,uger:ug,status:"Option"})))n++;}
      toast(`${n} bookinger oprettet i ${ny}`+(skip.length?`. ${skip.length} sprunget over pga. brancheregler: `+skip.join(" "):""));break;}
    case "kat-addrule":{const a2=$("#kr-a").value,b2=$("#kr-b").value;if(!a2||!b2)break;if(a2===b2){toast("Brug konkurrentadskillelse til samme branche");break;}S.katDraft.regler.push({a:a2,b:b2});render();break;}
    case "kat-delrule":S.katDraft.regler.splice(+t.dataset.i,1);render();break;
    case "kat-addcat":{const c=$("#kc-new").value.trim();if(!c||S.katDraft.kategorier.includes(c))break;S.katDraft.kategorier.push(c);render();break;}
    case "kat-save":{const cs=allConflicts(S.katDraft);if(cs.length){toast("Kan ikke gemmes, for det ville bryde reglerne for eksisterende bookinger: "+confSummary(cs)+". Flyt bookingerne først.");break;}}
    try{await S.db.doc("config/kategorier").set({...S.katDraft,updatedAt:new Date().toISOString()});S.katDraft=null;toast("Brancher og regler gemt");}catch(err){failWrite(err);}break;
    case "name-spot":{const b=S.bookings.get(t.dataset.id);if(!b)break;const nm=(prompt(`Spotnavn for ${b.kunde} (${b.sek} sek):`,"")||"").trim();if(!nm)break;
      const same=all().filter(x=>x.kunde===b.kunde&&+x.sek===+b.sek&&!(x.spot||""));
      const ids=same.length>1&&confirm(`Der er ${same.length} bookinger med ${b.kunde} · ${b.sek} sek uden spotnavn. Skal de alle hedde "${nm}"?\n\nOK = alle, Annuller = kun denne`)?same.map(x=>x.id):[b.id];
      await txRun(async()=>{for(const id of ids)await dbUpdate(id,{spot:nm});},"Spotnavn");toast(`${ids.length} booking${ids.length===1?"":"er"} har fået spotnavnet "${nm}"`);break;}
    case "rename-spot":{const v=$("#rsfra").value;if(!v)break;const [k,sp,sk]=JSON.parse(v);const til=$("#rstil").value.trim();if(!til||til===sp){toast("Skriv det nye spotnavn");break;}
      const bs=all().filter(x=>sameSpot(x,k,sp,sk));t.disabled=true;await txRun(async()=>{for(const b of bs)await dbUpdate(b.id,{spot:til});},"Omdøb spot");toast(`${bs.length} booking${bs.length===1?"":"er"} omdøbt til "${til}"`);break;}
    case "rename":{const fra=$("#rnfra").value,til=$("#rntil").value.trim();if(!til||til===fra){toast("Skriv det nye navn");break;}
      {const k2=JSON.parse(JSON.stringify(S.kat));if(k2.kunder[fra]&&!k2.kunder[til])k2.kunder[til]=k2.kunder[fra];const saved=S.kat;S.kat=k2;const bad=[];for(const b of all().filter(x=>x.kunde===fra&&live(x))){const bl=blocked(b.year,b.breakId,til,b.uger,b.id);if(bl.length)bad.push(blockMsg(til,b.breakId,bl));}S.kat=saved;if(bad.length){toast("Ikke tilladt: "+bad[0]);break;}}
      t.disabled=true;let n=0;for(const b of all().filter(x=>x.kunde===fra)){await dbUpdate(b.id,{kunde:til});n++;}
      if(S.kat.kunder&&S.kat.kunder[fra]&&!S.kat.kunder[til]){const kk={...S.kat.kunder,[til]:S.kat.kunder[fra]};delete kk[fra];try{await S.db.doc("config/kategorier").set({...S.kat,kunder:kk,updatedAt:new Date().toISOString()});}catch{}}
      toast(`${n} bookinger omdøbt til ${til}`);break;}
  }
  });
});
document.addEventListener("input",e=>{const el=e.target;if(el.dataset.pq){S.pq=el.value;const pos=el.selectionStart;render();const n=$("#pq");if(n){n.focus();n.setSelectionRange(pos,pos);}return;}if(el.dataset.f){S.bf[el.dataset.f]=el.type==="checkbox"?el.checked:el.value;const pos=el.selectionStart;render();const n=document.getElementById(el.id);if(n){n.focus();if(pos!=null&&n.setSelectionRange&&n.type==="search")n.setSelectionRange(pos,pos);}}});
document.addEventListener("change",e=>{const el=e.target;if(el.dataset.r){const k=el.dataset.r;S.rf[k]=["year","fra","til"].includes(k)?+el.value:el.value;if(k==="year"){const nW=weeksIn(S.rf.year);S.rf.til=Math.min(S.rf.til,nW);S.rf.fra=Math.min(S.rf.fra,S.rf.til);}if(S.rf.fra>S.rf.til)[S.rf.fra,S.rf.til]=[S.rf.til,S.rf.fra];render();}});
document.addEventListener("change",e=>{const el=e.target;if(!S.katDraft)return;if(el.dataset.kk!==undefined){const k=el.dataset.kk;if(el.value)S.katDraft.kunder[k]=el.value;else delete S.katDraft.kunder[k];}
  else if(el.dataset.kx!==undefined){const c=el.dataset.kx;const s2=new Set(S.katDraft.eksklusiv||[]);el.checked?s2.add(c):s2.delete(c);S.katDraft.eksklusiv=[...s2];}});
document.addEventListener("change",e=>{const el=e.target;if(el.dataset.pv){S.pv[el.dataset.pv]=el.value;render();}});
document.addEventListener("submit",e=>{e.preventDefault();});
document.addEventListener("keydown",e=>{if(S.q){if(e.key==="Escape"){S.q=null;drawQuick();return;}if(S.q.kind==="move"&&/^[fk]$/i.test(e.key)){S.q.copy=e.key.toLowerCase()==="k";S.moveCopy=S.q.copy;drawQuick();e.preventDefault();return;}const n=parseInt(e.key,10);if(n>=1&&n<=3){const o=quickOpts()[n-1];if(o){const btn=document.querySelector(`.qopt[data-key="${o.key}"]`);if(btn&&!btn.disabled){e.preventDefault();txRun(()=>runQuick(o.key));}}return;}}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!e.shiftKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||"")&&!S.modal&&!S.act){e.preventDefault();undo();return;}
  if(e.key==="Escape"&&S.act){S.act=null;drawAct();return;}if(e.key==="Escape"&&S.modal){S.modal=null;drawModal();}});
let rT;window.addEventListener("resize",()=>{clearTimeout(rT);rT=setTimeout(()=>{if(S.view==="rapporter")afterReport();if(S.view==="dashboard")drawYear();},150);});
function setPlanYear(y){S.year=y;S.week=y===TODAY[0]?TODAY[1]:1;}
function route(){let h0=location.hash.replace("#","")||"ugeplan";if(h0==="ugeplan"&&!S.ugeAuto){S.ugeAuto=true;const dow=(new Date().getDay()+6)%7;if(dow>=3&&S.year===TODAY[0]&&S.week===TODAY[1]){[S.year,S.week]=shiftWeek(TODAY[0],TODAY[1],1);setTimeout(()=>toast(`Ugeplanen viser næste uge (uge ${S.week}), fordi det er den, der skal gøres klar`),300);}}
  let h=location.hash.replace("#","");if(h==="bookinger")h="planlaegning";if(h==="overblik")h="dashboard";if(h==="udl")h="dashboard";
  const nv=["planlaegning","dashboard","ugeplan","rapporter","indstillinger"].includes(h)?h:"ugeplan",pv=S.view;
  if(nv==="planlaegning"&&(pv!=="planlaegning"||!S._uy)){S._uy=[S.year,S.week];setPlanYear(S.planYear||PLAN_START);}
  else if(nv!=="planlaegning"&&pv==="planlaegning"&&S._uy){S.planYear=S.year;[S.year,S.week]=S._uy;S._uy=null;}
  S.view=nv;render();window.scrollTo(0,0);}
window.addEventListener("hashchange",route);

// ---------- Planlægning: mal uger og træk-og-slip ----------
let lastCell=null;
document.addEventListener("pointerdown",e=>{const td=e.target.closest("td.c[data-id]");if(!td||S.canWrite===false||e.button!==0)return;e.preventDefault();
  const id=td.dataset.id;const b=S.bookings.get(id);if(!b)return;const w=+td.dataset.w;const set=new Set(b.uger);
  if(e.shiftKey&&lastCell&&lastCell.id===id){const [lo,hi]=[Math.min(lastCell.w,w),Math.max(lastCell.w,w)];for(let i=lo;i<=hi;i++)set.add(i);
    td.closest("tr").querySelectorAll("td.c").forEach(c=>{if(set.has(+c.dataset.w)){c.classList.add("on");}});S.paint={id,set,mode:true};for(let i=lo;i<=hi;i++)liveLen(td,i);return;}
  const mode=!set.has(w);mode?set.add(w):set.delete(w);td.classList.toggle("on",mode);S.paint={id,set,mode};lastCell={id,w};liveLen(td,w);});
document.addEventListener("pointermove",e=>{if(!S.paint)return;const el=document.elementFromPoint(e.clientX,e.clientY);const td=el&&el.closest&&el.closest("td.c[data-id]");if(!td||td.dataset.id!==S.paint.id)return;
  const w=+td.dataset.w;if(S.paint.mode)S.paint.set.add(w);else S.paint.set.delete(w);td.classList.toggle("on",S.paint.mode);liveLen(td,w);});
function liveLen(td,w){if(!S.paint)return;const id=S.paint.id;const b=S.bookings.get(id);if(!b)return;const L=lenWith(S.year,w,b.breakId,id,S.paint.set.has(w));
  const cell=td.closest("table").querySelector(`td[data-lw="${w}"]`);if(cell)cell.innerHTML=(L?fmtDur(L):"–")+deltaHtml(L-baseLen(S.year,w,b.breakId));}
async function endPaint(){if(!S.paint)return;const p=S.paint;S.paint=null;await txRun(()=>setWeeks(p.id,[...p.set]));if(S.dirty){S.dirty=false;render();}}
document.addEventListener("pointerup",endPaint);document.addEventListener("pointercancel",endPaint);
document.addEventListener("dragstart",e=>{const c=e.target.closest&&e.target.closest(".dchip");if(!c)return;e.dataTransfer.setData("text/plain",JSON.stringify({k:c.dataset.k,s:+c.dataset.s,sp:c.dataset.sp||""}));e.dataTransfer.effectAllowed="copy";});
document.addEventListener("dragover",e=>{const td=e.target.closest&&e.target.closest("td.c[data-b]");if(!td)return;e.preventDefault();e.dataTransfer.dropEffect="copy";
  document.querySelectorAll("td.dz").forEach(x=>x!==td&&x.classList.remove("dz"));td.classList.add("dz");});
document.addEventListener("dragleave",e=>{const td=e.target.closest&&e.target.closest("td.c[data-b]");if(td)td.classList.remove("dz");});
document.addEventListener("drop",async e=>{const td=e.target.closest&&e.target.closest("td.c[data-b]");if(!td)return;e.preventDefault();td.classList.remove("dz");
  let d;try{d=JSON.parse(e.dataTransfer.getData("text/plain"));}catch{return;}if(!d||!d.k)return;S.drag=null;await txRun(()=>dropLib(d.k,d.s,td.dataset.b,+td.dataset.w,d.sp||""));});
document.addEventListener("dragend",()=>document.querySelectorAll("td.dz").forEach(x=>x.classList.remove("dz")));
// ---------- Opstart ----------
[S.year,S.week]=TODAY;
try{S.liveOn=localStorage.getItem("sl-live")==="1";S.ovp=localStorage.getItem("sl-ovp")||"uge";}catch(e){}
route();
(async()=>{
  const timer=setTimeout(()=>{S.slow=true;render();},10000);
  const [db,user,dl]=await Promise.all([claude.use("db"),claude.use("user"),claude.use("downloads")]);
  S.dl=dl;S.user=user;
  if(!db){clearTimeout(timer);S.err="Forbindelsen kunne ikke startes.";render();return;}
  S.db=db;
  if(user){try{S.meId=await user.id();}catch{} try{S.isOwner=!!(await user.isOwner());}catch{S.isOwner=null;} try{const c=await user.can("data.write");S.canWrite=c===false?false:(c===true?true:null);}catch{S.canWrite=null;}}
  let gotB=false,gotC=false;const done=()=>{if(gotB&&gotC){S.loaded=true;S.slow=false;clearTimeout(timer);}};
  db.doc("config/kategorier").onSnapshot(s=>{if(s.exists){const c=s.data();S.kat={kunder:c.kunder||{},kategorier:Array.isArray(c.kategorier)&&c.kategorier.length?c.kategorier:["Bank","Betting"],regler:Array.isArray(c.regler)?c.regler:[],eksklusiv:Array.isArray(c.eksklusiv)?c.eksklusiv:[]};}if(!S.katDraft||S.view!=="indstillinger")S.katDraft=null;render();},()=>{});
  db.doc("status/godkendt").onSnapshot(s=>{S.godk=(s.exists&&s.data().uger)||{};render();},()=>{});
  db.doc("config/main").onSnapshot(s=>{if(s.exists){const c=s.data();S.cfg={breaks:Array.isArray(c.breaks)&&c.breaks.length?c.breaks:DEFAULT_BREAKS,dagePrUge:c.dagePrUge||7,liveUrl:c.liveUrl||""};if(S.liveOn)drawLive();}
    if(!s.metadata.fromCache)gotC=true;done();render();if(S.modal)drawModal();},e=>{gotC=true;done();render();});
  db.collection("bookings").onSnapshot(s=>{const m=new Map();for(const d of s.docs){const x=d.data();if(x&&typeof x.kunde==="string")m.set(d.id,{...x,id:d.id,uger:Array.isArray(x.uger)?x.uger:[]});}S.bookings=m;
    if(!s.metadata.fromCache)gotB=true;else if(m.size)S.loaded=true;if(S.act)drawAct();if(S.q)drawQuick();done();if(S.loaded&&!S.baseReady&&!s.metadata.fromCache)primeBase();render();},e=>{clearTimeout(timer);S.err=e?.message||"Google Sheets svarer ikke. Genindlæs siden senere.";render();});
})();
})();
