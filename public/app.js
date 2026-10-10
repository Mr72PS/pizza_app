import {SEED, METHODEN, TAGE, TAGE_LANG, BELAEGE, SEED_MEHL, DEF_DAUER, KURZ,
  p2, hm, dm, dayKey, g, add, toInput, interp, tf, hefeTxt, tl, oelA, zuA, hefeName, span,
  mehlOf, mehlTxt, eff, plan, vorschlaege, belagOf, einkauf, gastCalc, gastTxt} from './calc.js';

let state={recipes:[], events:[]};
let ui={view:'events', id:null, step:0, calcN:3, calcM:'', draft:null};
let loaded=false, loadErr=false, saveErr=false;
let me=null; // angemeldeter Benutzer

/* ---------- Speicher: REST-API, ein Datensatz pro Rezept und pro Event ---------- */
const KINDS=['recipes','events'];
// Stand auf dem Server: pro Datensatz das zuletzt bestätigte JSON und die Versionsmarke
let synced={recipes:new Map(), events:new Map()};
async function api(method,url,body){
  const res=await fetch(url,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  // Sitzung abgelaufen oder widerrufen: zurück zur Anmeldung
  if(res.status===401&&url!=='/api/login'&&me){me=null; loaded=false; ui.msg=''; render();}
  return {status:res.status, data:res.status===204?null:await res.json().catch(()=>null)};
}
function adopt(s){
  fotoIds={}; for(const f of s.photos||[]) (fotoIds[f.eventId]=fotoIds[f.eventId]||[]).push(f.id);
  fotoSig=JSON.stringify(s.photos||[]);
  for(const k of KINDS){state[k]=s[k].map(x=>x.data); synced[k]=new Map(s[k].map(x=>[x.id,{json:JSON.stringify(x.data),ver:x.updatedAt}]));}
}
async function loadState(){
  const r=await api('GET','/api/state'); if(r.status!==200) throw new Error('state '+r.status);
  adopt(r.data); loaded=true; loadErr=false;
}
let saving=false, dirty=false, retry=null;
function save(){dirty=true; pump();}
// Vergleicht den Zustand mit dem Stand auf dem Server und schickt nur, was sich geändert hat
async function pump(){
  if(!me||saving||!dirty) return;
  saving=true; clearTimeout(retry);
  try{
    while(dirty){
      dirty=false;
      for(const k of KINDS){
        const now=new Map(state[k].map(x=>[x.id,JSON.stringify(x)]));
        for(const [id,json] of now){
          const old=synced[k].get(id); if(old&&old.json===json) continue;
          const r=await api('PUT',`/api/${k}/${id}`,{data:JSON.parse(json),updatedAt:old?old.ver:null});
          if(r.status===409) return await conflict();
          if(r.status===400) return await conflict('Der Server hat die Änderung abgelehnt, weil ein Wert ungültig ist. Die App hat den gespeicherten Stand geladen.');
          if(r.status>=300) throw new Error(k+' '+r.status);
          synced[k].set(id,{json,ver:r.data.updatedAt});
        }
        for(const id of [...synced[k].keys()]){
          if(now.has(id)) continue;
          const r=await api('DELETE',`/api/${k}/${id}`); if(r.status>=300) throw new Error(k+' '+r.status);
          synced[k].delete(id);
        }
      }
    }
    if(saveErr){saveErr=false; render();}
  }catch(e){
    dirty=true; if(!saveErr){saveErr=true; render();}
    retry=setTimeout(pump,5000);
  }finally{saving=false;}
}
// Veraltete Versionsmarke: jemand anderes war schneller. Neu laden statt überschreiben.
async function conflict(msg){
  dirty=false; ui.draft=null;
  try{await loadState();}catch(e){}
  alert(msg||'Jemand hat diese Daten inzwischen geändert. Die App hat den aktuellen Stand geladen. Bitte wiederhole deine letzte Änderung.');
  render();
}
// Änderungen anderer Benutzer nachladen, ohne offene Formulare zu stören
async function refresh(){
  if(!me||!loaded||saving||dirty||fotoBusy||document.hidden) return;
  try{
    const r=await api('GET','/api/state'); if(r.status!==200||saving||dirty||fotoBusy) return;
    if(KINDS.every(k=>r.data[k].length===synced[k].size&&r.data[k].every(x=>(synced[k].get(x.id)||{}).ver===x.updatedAt))&&JSON.stringify(r.data.photos||[])===fotoSig) return;
    adopt(r.data);
    if(!['eventForm','recipeForm','log'].includes(ui.view)&&!document.querySelector('details[open]')) render();
  }catch(e){}
}

/* ---------- Helfer ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const recipes=()=>state.recipes;
const meth=m=>METHODEN[m]||METHODEN.direkt;
const recipe=id=>recipes().find(r=>r.id===id);
const uid=()=>Math.random().toString(36).slice(2,10);
function methodeOptions(r,sel){
  return `<option value="">${KURZ[r.methode]} (wie im Rezept)</option>`+['biga','direkt'].filter(m=>m!==r.methode).map(m=>`<option value="${m}" ${sel===m?'selected':''}>${KURZ[m]}</option>`).join('');
}

/* ---------- Fotos zum Backprotokoll ---------- */
// Als Dateien auf dem Server, mehrere pro Event. `fotoIds` hält pro Event die Kennungen in der Reihenfolge des Hochladens.
let fotoIds={}, fotoSig='[]', fotoBusy=0;
const MAX_FOTOS=10;
// Frisch gewählte Fotos als data:-Adresse, damit die Ansicht nicht auf den Upload wartet
const fotoLokal={};
const FOTO_FEHLER={400:'Der Server kann die Datei nicht als JPEG lesen.',401:'Du bist nicht mehr angemeldet.',403:'Die Adresse im Browser passt nicht zur Einstellung BASE_URL.',404:'Das Event ist auf dem Server noch nicht gespeichert. Versuche es gleich nochmals.',409:'Dieses Event hat schon '+MAX_FOTOS+' Fotos.',413:'Das Bild ist grösser als 2 MB.'};
const fotoUrl=(id,pid)=>`/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}`;
const fotoSrc=(id,pid)=>fotoLokal[pid]||fotoUrl(id,pid);
const fotosOf=id=>fotoIds[id]||[];
async function saveFoto(id,pid,data){
  fotoLokal[pid]=data; fotoIds[id]=[...fotosOf(id),pid]; fotoBusy++;
  try{
    // Die data:-Adresse von Hand in Bytes wandeln: Die Content-Security-Policy erlaubt Verbindungen nur zur eigenen Adresse
    const bin=atob(data.slice(data.indexOf(',')+1)), bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const blob=new Blob([bytes],{type:'image/jpeg'});
    const res=await fetch(fotoUrl(id,pid),{method:'PUT',headers:{'content-type':'image/jpeg'},body:blob});
    if(!res.ok) throw new Error(FOTO_FEHLER[res.status]||'Der Server meldet Fehler '+res.status+'.');
  }catch(e){
    fotoIds[id]=fotosOf(id).filter(x=>x!==pid); delete fotoLokal[pid];
    alert('Ein Foto konnte nicht gespeichert werden. '+(e instanceof TypeError?'Der Server ist nicht erreichbar.':e.message));
    if(['event','galerie','foto'].includes(ui.view)) render();
  }finally{fotoBusy--;}
}
function delFoto(id,pid){fotoIds[id]=fotosOf(id).filter(x=>x!==pid); fetch(fotoUrl(id,pid),{method:'DELETE'}).catch(()=>{});}
function shrink(file){return new Promise((res,rej)=>{
  const fr=new FileReader(); fr.onerror=rej;
  fr.onload=()=>{const img=new Image(); img.onerror=rej; img.onload=()=>{
    const k=Math.min(1,800/Math.max(img.width,img.height)), c=document.createElement('canvas');
    c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    let d=c.toDataURL('image/jpeg',0.6); if(d.length>230000) d=c.toDataURL('image/jpeg',0.35); res(d);};
    img.src=fr.result;};
  fr.readAsDataURL(file);});}
const sterne=x=>{const n=Math.min(5,Math.max(0,Math.round(Number(x))||0)); return n?`<span class="stars" role="img" aria-label="${n} von 5 Sternen">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>`:'';};

/* ---------- Herkunft der Rezepte ---------- */
const QUELLEN={
  mein:{name:'Mein Rezept', gruppe:'Meine Rezepte', svg:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'},
  web:{name:'Internet oder Community', gruppe:'Internet und Community', svg:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 3 2.8 15 0 18c-2.8-3-2.8-15 0-18z"/>'},
  vorlage:{name:'Vorlage mit Durchschnittswerten', gruppe:'Vorlagen', svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'}
};
const IMG_KOPF='/img/kopf.webp';
const IMG_SIEGEL='/img/siegel.webp';
const SEED_QUELLE={donkarl:'mein',biga100:'mein',avpn:'web',svens48:'web'};
const SEED_URL={svens48:'https://www.teichners.de/blogs/blog/der-absolute-favorit-svens-48-stunden-pizzateig-rezept',avpn:'https://www.pizzanapoletana.org/public/pdf/Disciplinare-2024-ENG.pdf'};
function src(r){return (r.quelle&&QUELLEN[r.quelle]?r.quelle:null)||SEED_QUELLE[r.id]||(SEED.some(x=>x.id===r.id)?'vorlage':'mein');}
function srcUrl(r){const u=r.quelleUrl??SEED_URL[r.id]??''; return /^https?:\/\//i.test(u)?u:'';}
function srcIcon(r){const q=src(r);
  if(q==='mein') return `<span class="src mein" title="${QUELLEN.mein.name}"><img src="${IMG_KOPF}" alt="${QUELLEN.mein.name}"></span>`;
  return `<span class="src ${q}" role="img" aria-label="${QUELLEN[q].name}" title="${QUELLEN[q].name}"><svg viewBox="0 0 24 24" aria-hidden="true">${QUELLEN[q].svg}</svg></span>`;}

/* ---------- Ansichten ---------- */
const app=document.getElementById('app');
function go(view,id=null,extra={}){ui={...ui,view,id,...extra}; render(); window.scrollTo(0,0);}

function amountsTable(p,r){
  const row=(a,b)=>`<tr><td>${a}</td><td>${b}</td></tr>`;
  const m=p.m; let h='<table class="amounts">'; const ml=mehlOf(r);
  const mrow=x=>row('Mehl',g(x)+' g')+ml.mix.map(k=>`<tr class="sub"><td>davon ${esc(k.n)}</td><td>${g(x*k.p/100)} g</td></tr>`).join('');
  if(p.pf){
    h+=`<tr class="grp"><td colspan="2">${p.pf.nm}</td></tr>`+mrow(p.pf.mehl)+row('Wasser',g(p.pf.wasser)+' g')+row('Frische Hefe',g(p.pf.hefe,2)+' g');
    h+=`<tr class="grp"><td colspan="2">${p.pf.anteil>=1?'Am Backtag dazu':'Hauptteig'}</td></tr>`+(p.pf.hMehl>0.5?mrow(p.pf.hMehl):'')+row('Wasser',g(p.pf.hWasser)+' g')+row('Salz',g(m.salz,1)+' g');
    if(m.oel) h+=row('Olivenöl',oelA(r,m.oel)); if(m.zucker) h+=row('Zucker',zuA(r,m.zucker)); m.zusatz.forEach(z=>h+=row(esc(z[0]),g(z[1])+' g'));
    if(p.pf.hHefe>0.005) h+=row('Frische Hefe',g(p.pf.hHefe,2)+' g');
  } else {
    h+=mrow(m.mehl)+row('Wasser',g(m.wasser)+' g')+row('Salz',g(m.salz,1)+' g');
    m.zusatz.forEach(z=>h+=row(esc(z[0].charAt(0).toUpperCase()+z[0].slice(1)),g(z[1])+' g'));
    if(m.oel) h+=row('Olivenöl',oelA(r,m.oel)); if(m.zucker) h+=row('Zucker',zuA(r,m.zucker));
    h+=row(hefeName(r),g(m.hefe,r.hefeArt==='trocken'?1:2)+' g');
  }
  h+='</table>';
  if(ml.text) h+=`<p class="small" style="margin-top:10px"><strong>Mehl-Empfehlung für die besten Ergebnisse:</strong> ${esc(ml.mix.map(k=>g(k.p)+' % '+k.n).concat(ml.notes).join(', '))}.</p>`;
  h+=`<p class="small muted" style="margin-top:10px">Ergibt ${esc(p.n)} Teiglinge à ${g(r.ballen)} g${(r.reserve??2)>=1?', mit '+g(r.reserve??2)+' % Reserve':''}. ${r.vtHefe!=null||r.hefeFix!=null?'Die Hefemenge ist im Rezept fest hinterlegt':'Hefemengen sind Richtwerte für '+(p.pf?'den Vorteig':'die gewählte Zeit')}${r.hefeArt==='trocken'?'':'; statt frischer Hefe geht ein Drittel der Menge als Instanthefe'}.</p>`;
  return h;
}

function viewEvents(){
  const now=Date.now();
  const evs=[...state.events].sort((a,b)=>new Date(a.essen)-new Date(b.essen));
  const kommend=evs.filter(e=>new Date(e.essen).getTime()+4*3600e3>=now), vorbei=evs.filter(e=>!kommend.includes(e)).reverse();
  const li=e=>{const d=new Date(e.essen), r=recipe(e.recipeId);
    return `<li class="hasdel"><button class="item" data-open-event="${e.id}"><span class="when"><span>${d.getFullYear()}</span>${TAGE[d.getDay()]} ${dm(d)}<span>${hm(d)} Uhr</span></span><span><span class="t">${esc(e.name||'Pizza-Abend')}</span><br><span class="small muted">${esc(e.anzahl)} × ${esc(r?r.name:'Rezept gelöscht')}${r&&KURZ[e.methode]&&e.methode!==r.methode?', '+KURZ[e.methode].toLowerCase():''}</span>${e.log&&e.log.sterne?'<br>'+sterne(e.log.sterne):''}</span><span class="chev" aria-hidden="true">›</span></button><button class="del" data-del-event="${e.id}" aria-label="${esc(e.name||'Pizza-Abend')} löschen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></li>`;};
  return `<div class="top"><h1>Pizza App</h1></div>
  <p class="muted">Sag, wann die Pizza auf dem Teller sein soll. Die App rechnet zurück, wann du mit dem Teig anfangen musst.</p>
  <p style="margin:18px 0 0"><button class="btn primary" data-new-event>Event planen</button></p>
  <h2>Geplant</h2>
  ${kommend.length?`<ul class="list">${kommend.map(li).join('')}</ul>`:'<p class="empty">Noch kein Event geplant.</p>'}
  ${vorbei.length?`<h2>Vorbei</h2><ul class="list">${vorbei.map(li).join('')}</ul>`:''}`;
}

// Alle Fotos aus den Backprotokollen, das neueste Event zuerst
function galerieListe(){
  return state.events.filter(e=>fotosOf(e.id).length).sort((a,b)=>(new Date(b.essen)-new Date(a.essen))||0).flatMap(e=>fotosOf(e.id).map(p=>({e,p})));
}
const fotoDatum=e=>{const d=new Date(e.essen); return isNaN(d)?'':`${TAGE[d.getDay()]}, ${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`;};
const fotoStern=e=>{const n=Math.min(5,Math.max(0,Math.round(Number((e.log||{}).sterne))||0)); return n?`<span class="gs" role="img" aria-label="${n} von 5 Sternen">★ ${n}</span>`:'';};
function viewGalerie(){
  const l=galerieListe();
  return `<div class="top"><h1>Galerie</h1></div>
  ${l.length?`<ul class="galerie">${l.map(({e,p})=>`<li><button data-lb-e="${esc(e.id)}" data-lb-p="${esc(p)}" data-lb-alle="1"><img src="${esc(fotoSrc(e.id,p))}" alt="Foto: ${esc(e.name||'Pizza-Abend')}" loading="lazy"><span class="gz small muted"><span>${fotoDatum(e)}</span>${fotoStern(e)}</span></button></li>`).join('')}</ul>`:'<p class="empty">Noch keine Fotos. Füge im Backprotokoll eines Events ein Foto hinzu.</p>'}`;
}

/* Grossansicht: blättert durch die ganze Galerie oder, aus einem Event geöffnet, nur durch dessen Fotos.
   `ui.lb` hält Event und Foto, damit die Ansicht ein Nachladen der Daten übersteht. */
function lbListe(){
  if(ui.lb.alle) return galerieListe();
  const e=state.events.find(x=>x.id===ui.lb.e); return e?fotosOf(e.id).map(p=>({e,p})):[];
}
const lbIndex=l=>l.findIndex(x=>x.e.id===ui.lb.e&&x.p===ui.lb.p);
function viewFoto(){
  const l=lbListe(), i=lbIndex(l);
  if(i<0) return ui.lb.alle?viewGalerie():viewEvents();
  const {e,p}=l[i];
  const nav=(x,cls,txt,lbl)=>x?`<button class="${cls}" data-lb-e="${esc(x.e.id)}" data-lb-p="${esc(x.p)}" ${ui.lb.alle?'data-lb-alle="1"':''} aria-label="${lbl}">${txt}</button>`:'';
  return `<div class="lb">
    <div class="lbkopf"><button data-lb-zu>‹ ${ui.lb.alle?'Galerie':'Zeitplan'}</button><span>${i+1} / ${l.length}</span></div>
    <div class="lbbild"><img src="${esc(fotoSrc(e.id,p))}" alt="Foto: ${esc(e.name||'Pizza-Abend')}">${nav(l[i-1],'lbvor','‹','Vorheriges Foto')}${nav(l[i+1],'lbnach','›','Nächstes Foto')}</div>
    <div class="lbfuss"><span><strong>${esc(e.name||'Pizza-Abend')}</strong><br>${fotoDatum(e)} ${fotoStern(e)}</span>${ui.lb.alle?`<button class="lbev" data-zum-event="${esc(e.id)}">Zum Event</button>`:''}</div>
  </div>`;
}
function lbSchritt(k){
  const l=lbListe(), x=l[lbIndex(l)+k];
  if(x) go('foto',null,{lb:{...ui.lb,e:x.e.id,p:x.p}});
}
function lbZu(){
  const y=ui.lbY||0;
  if(ui.lb.alle) go('galerie'); else go('event',ui.lb.e);
  window.scrollTo(0,y);
}

function naechsterSamstag(){const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7)); d.setHours(19,0,0,0); return d;}

function viewEventForm(){
  const e=ui.id?state.events.find(x=>x.id===ui.id):null;
  const def=naechsterSamstag();
  const r0=(!e&&ui.preRecipe&&recipe(ui.preRecipe))||recipes()[0];
  const m0=(!e&&ui.preRecipe&&ui.calcM)||'';
  const v=ui.draft||e||{name:'',essen:toInput(def),recipeId:r0.id,methode:m0,anzahl:r0.stdAnzahl||3,raumtemp:21,maschine:!!r0.maschine,dauer:'',park:m0?0:(r0.parkStd||0)};
  const r=recipe(v.recipeId)||recipes()[0], er=eff(r,v), M=meth(er.methode), vt=er.methode==='biga'||er.methode==='poolish';
  return `<button class="back" data-nav="${e?'':'events'}" ${e?`data-open-event="${e.id}"`:''}>‹ Zurück</button>
  <h1 style="font-size:2rem;margin-bottom:18px">${e?'Event ändern':'Event planen'}</h1>
  <form id="eventForm">
    <label>Name<input name="name" value="${esc(v.name)}" placeholder="Pizza-Abend mit Freunden" autocomplete="off"></label>
    <label>Erste Pizza auf dem Teller<input type="datetime-local" name="essen" value="${esc(v.essen)}" required></label>
    <label>Rezept<select name="recipeId">${recipes().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${esc(x.name)}${src(x)==='mein'?'':src(x)==='web'?' (Internet)':' (Vorlage)'}</option>`).join('')}</select></label>
    <label>Teigführung<select name="methode">${methodeOptions(r,v.methode)}</select>
      <span class="hint">Wasser, Salz und Teiglingsgewicht bleiben gleich. Hefemenge und Zeitplan werden neu gerechnet.</span></label>
    <div class="two">
      <label>Erwachsene<input type="number" name="erw" min="0" max="60" value="${esc(v.erw??'')}" inputmode="numeric" placeholder="freiwillig"></label>
      <label>Kinder<input type="number" name="kind" min="0" max="60" value="${esc(v.kind??'')}" inputmode="numeric" placeholder="freiwillig"></label>
    </div>
    <p class="hint small muted" id="gastHint" style="margin:-8px 0 0">${gastTxt(v.erw,v.kind)||'Mit Gästezahl schlägt die App die Anzahl Pizzen vor: eine pro Erwachsenen, eine halbe pro Kind, plus eine Reserve.'}</p>
    <div class="two">
      <label>Anzahl Pizzen<input type="number" name="anzahl" min="1" max="40" value="${esc(v.anzahl)}" inputmode="numeric" required></label>
      <label>Küche in °C<input type="number" name="raumtemp" min="10" max="35" value="${esc(v.raumtemp)}" inputmode="numeric" required></label>
    </div>
    <label><span id="dauerLbl">${M.dauerLbl} in Stunden</span><input type="number" name="dauer" min="1" max="96" step="1" value="${esc(v.dauer||er.dauer)}" inputmode="numeric">
      <span class="hint">Aus dem Rezept übernommen. Hier nur für diesen Event ändern, zum Beispiel wenn ein Schritt in die Nacht fällt.</span></label>
    <label id="parkRow" ${vt?'':'hidden'}>Fertige Teiglinge im Kühlschrank parken, in Stunden<input type="number" name="park" min="0" max="24" step="0.5" value="${esc(v.park??0)}" inputmode="decimal">
      <span class="hint">0 heisst: direkt nach der Gare backen. Mit Parkzeit beginnt alles entsprechend früher, und die Teiglinge kommen kalt aus dem Kühlschrank auf den Schieber.</span></label>
    <label class="check"><input type="checkbox" name="maschine" ${v.maschine?'checked':''}>Ich knete mit der Küchenmaschine</label>
    <div class="row"><button class="btn primary grow" type="submit">${e?'Änderungen speichern':'Zeitplan berechnen'}</button></div>
  </form>`;
}


function nextIdx(e,p){return p.steps.findIndex(s=>!(e.done||{})[s.k]);}

function viewEvent(){
  const e=state.events.find(x=>x.id===ui.id); if(!e) return viewEvents();
  const r=recipe(e.recipeId);
  if(!r) return `<button class="back" data-nav="events">‹ Events</button><h1 style="font-size:2rem">${esc(e.name||'Pizza-Abend')}</h1><p class="note">Das Rezept zu diesem Event wurde gelöscht.</p><p style="margin-top:16px"><button class="btn" data-edit-event="${e.id}">Anderes Rezept wählen</button></p>`;
  const R=eff(r,e), p=plan(R,e), s0=p.steps[0], ni=nextIdx(e,p), done=e.done||{}, sug=vorschlaege(R,e), L=e.log;
  let tl='', last='';
  p.steps.forEach((s,i)=>{
    if(dayKey(s.t)!==last){last=dayKey(s.t); tl+=`<li class="day">${TAGE[s.t.getDay()]} ${dm(s.t)}</li>`;}
    tl+=`<li class="st ${done[s.k]?'done':''} ${i===ni?'next':''}"><span class="time">${hm(s.t)}</span>
      <button class="dot" data-toggle="${s.k}" aria-label="${esc(s.ttl)} ${done[s.k]?'als offen markieren':'als erledigt markieren'}"></button>
      <details class="body"><summary><span class="ttl">${esc(s.ttl)}</span><span class="dur">${s.k==='backen'?'bis ca. '+hm(p.letzte):'dauert '+span(s.min)} · Details</span></summary><ul>${s.d.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></li>`;
  });
  return `${ui.von==='galerie'?'<button class="back" data-nav="galerie">‹ Galerie</button>':'<button class="back" data-nav="events">‹ Events</button>'}
  <h1 style="font-size:2rem">${esc(e.name||'Pizza-Abend')}</h1>
  <p class="muted">${esc(p.n)} × ${esc(r.name)}${R!==r?' ('+(KURZ[R.methode]||'').toLowerCase()+')':''}, essen am ${TAGE_LANG[p.E.getDay()]}, ${dm(p.E)} um ${hm(p.E)} Uhr</p>
  <div class="start"><div class="lbl">Starte am ${TAGE_LANG[s0.t.getDay()]}, ${dm(s0.t)} um</div><div class="big">${hm(s0.t)}</div><div class="what">${esc(s0.ttl)}</div></div>
  ${p.warn.map(w=>`<p class="note">${esc(w)}</p>`).join('')}
  ${sug.length?`<div class="sug"><h3>${p.nacht?'Vorschläge, damit alles tagsüber liegt':'Vorschläge, die zeitlich noch reichen'}</h3>${sug.map(c=>`<button class="sugb" data-apply="${c.D}|${c.P}"><strong>Start ${TAGE[c.t.getDay()]} ${dm(c.t)} um ${hm(c.t)}</strong><span>${esc(c.txt)}. Antippen zum Übernehmen.</span></button>`).join('')}</div>`:((p.nacht||p.past)?'<p class="small muted" style="margin-top:8px">Für dieses Rezept findet die App keine passende Variante. Wähle einen späteren Termin oder ein anderes Rezept.</p>':'')}
  <div class="row" style="margin-top:14px"><button class="btn primary grow" data-guide="${e.id}">${ni>0?'Anleitung fortsetzen':'Schritt für Schritt starten'}</button></div>
  <div class="row" style="margin-top:10px"><button class="btn grow" data-shop="${e.id}">Einkaufsliste</button><button class="btn grow" data-edit-event="${e.id}">Ändern</button></div>
  <div class="row" style="margin-top:10px"><button class="btn grow" data-again="${e.id}">Nochmals so</button></div>
  <h2>Zeitplan</h2><p class="small muted">${esc(p.info)}. Tippe auf einen Schritt für die Details, auf den Punkt zum Abhaken.</p>
  <ol class="tl">${tl}</ol>
  <h2>Zutaten</h2>${amountsTable(p,R)}
  <h2>Ofen</h2><p>Oben ${esc(r.oben)} °C, unten ${esc(r.unten)} °C, ${esc(r.backMin)}–${esc(r.backMax)} min pro Pizza. Das sind Startwerte: nach der ersten Pizza nachstellen.</p>
  <h2>Backprotokoll</h2>
  ${L?`<div class="card">${sterne(L.sterne)}
    ${eventFotos(e)}
    ${[L.raum?`Küche ${esc(L.raum)} °C`:'',L.oben?`oben ${esc(L.oben)} °C`:'',L.unten?`unten ${esc(L.unten)} °C`:'',L.backzeit?`Backzeit ${esc(L.backzeit)}`:''].filter(Boolean).length?`<p style="margin-top:8px">${[L.raum?`Küche ${esc(L.raum)} °C`:'',L.oben?`oben ${esc(L.oben)} °C`:'',L.unten?`unten ${esc(L.unten)} °C`:'',L.backzeit?`Backzeit ${esc(L.backzeit)}`:''].filter(Boolean).join(', ')}</p>`:''}
    ${L.gut?`<p><strong>Gut war:</strong> ${esc(L.gut)}</p>`:''}${L.aendern?`<p><strong>Nächstes Mal:</strong> ${esc(L.aendern)}</p>`:''}
    <div class="row" style="margin-top:10px"><button class="btn quiet" data-log="${e.id}">Bearbeiten</button>${L.oben||L.unten?`<button class="btn quiet" data-log-apply="${e.id}">Ofenwerte ins Rezept übernehmen</button>`:''}</div></div>`
  :`<p class="muted">Freiwillig: Halte nach dem Backen fest, wie es war. So werden aus Startwerten deine erprobten Werte.</p><p><button class="btn" data-log="${e.id}">Protokoll erfassen</button></p>`}
  <p style="margin-top:28px"><button class="btn danger" data-del-event="${e.id}">Event löschen</button></p>`;
}

// Ein einzelnes Foto in voller Breite, mehrere als Raster; Antippen öffnet die Grossansicht
function eventFotos(e){
  const ids=fotosOf(e.id); if(!ids.length) return '';
  return `<ul class="galerie${ids.length===1?' eins':''}" style="margin:10px 0">${ids.map(p=>`<li><button data-lb-e="${esc(e.id)}" data-lb-p="${esc(p)}"><img src="${esc(fotoSrc(e.id,p))}" alt="Foto vom Pizza-Abend" loading="lazy"></button></li>`).join('')}</ul>`;
}

function viewShop(){
  const e=state.events.find(x=>x.id===ui.id), r=e&&recipe(e.recipeId); if(!e||!r) return viewEvents();
  const R=eff(r,e), k=einkauf(e,R), b=belagOf(e), sh=e.shop||{}, ok=sh.ok||{}, extra=sh.extra||[];
  const item=(key,nm,amt,x)=>`<label class="chk ${ok[key]?'on':''}"><input type="checkbox" data-shopkey="${esc(key)}" ${ok[key]?'checked':''}><span>${esc(nm)}</span><span class="amt">${esc(amt)}</span>${x?`<button type="button" class="x" data-shop-del="${esc(x)}" aria-label="${esc(nm)} entfernen">×</button>`:''}</label>`;
  return `<button class="back" data-open-event="${e.id}">‹ Zeitplan</button>
  <h1 style="font-size:2rem">Einkaufsliste</h1>
  <p class="muted">${esc(e.name||'Pizza-Abend')}, ${esc(e.anzahl)} × ${esc(r.name)}</p>
  <h2>Welche Pizzen?</h2>
  ${BELAEGE.map(B=>`<div class="belag"><span><strong>${B.name}</strong><br><span class="small muted">${B.z.map(z=>z[0]).join(', ')}</span></span><span class="stepper" style="margin-left:auto"><button data-belag="${B.id}|-1" aria-label="Eine ${B.name} weniger">−</button><output>${esc(b[B.id]||0)}</output><button data-belag="${B.id}|1" aria-label="Eine ${B.name} mehr">+</button></span></div>`).join('')}
  <p class="${k.verteilt===e.anzahl?'small muted':'note'}" style="margin-top:10px">${k.verteilt} von ${esc(e.anzahl)} Pizzen verteilt.${k.verteilt===e.anzahl?'':' Der Teig reicht für '+esc(e.anzahl)+'.'}</p>
  <h2>Für den Teig</h2>${k.teig.map(([n,a])=>item('teig:'+n,n,a)).join('')}
  <h2>Für den Belag</h2>${k.belag.length?k.belag.map(([n,a])=>item('belag:'+n,n,a)).join(''):'<p class="muted">Noch keine Pizza gewählt.</p>'}
  <p class="small muted" style="margin-top:8px">Die Belagsmengen sind Richtwerte pro Pizza.</p>
  <h2>Sonst noch</h2>${extra.map(x=>item('x:'+x.id,x.txt,'',x.id)).join('')}
  <form id="shopAdd" style="margin-top:12px"><div class="row"><input name="txt" class="grow" style="flex:1;width:auto" placeholder="Wein, Servietten, …" autocomplete="off" required><button class="btn" type="submit">Dazu</button></div></form>`;
}

// Fotos im Formular: die gespeicherten ohne die zum Entfernen vorgemerkten, dazu die frisch gewählten
function fotoWahl(e){
  return [...fotosOf(e.id).filter(p=>!(ui.fotoWeg||[]).includes(p)).map(p=>({id:p,src:fotoSrc(e.id,p)})),...(ui.fotoNeu||[]).map(n=>({id:n.id,src:n.data}))];
}
function fotoBox(e){
  const l=fotoWahl(e);
  return l.length?`<ul class="galerie">${l.map(f=>`<li><img src="${esc(f.src)}" alt="Foto vom Pizza-Abend"><button type="button" class="btn quiet" data-foto-del="${esc(f.id)}">Entfernen</button></li>`).join('')}</ul>`:'';
}

function viewLog(){
  const e=state.events.find(x=>x.id===ui.id), r=e&&recipe(e.recipeId); if(!e) return viewEvents();
  const L=e.log||{}, st=Math.min(5,Math.max(0,Math.round(Number(L.sterne))||0));
  return `<button class="back" data-open-event="${e.id}">‹ Zeitplan</button>
  <h1 style="font-size:2rem;margin-bottom:6px">Backprotokoll</h1>
  <p class="muted" style="margin-bottom:18px">${esc(e.name||'Pizza-Abend')}. Alle Felder sind freiwillig.</p>
  <form id="logForm">
    <div><span style="font-weight:600">Wie war die Pizza?</span><input type="hidden" name="sterne" value="${st}">
      <div class="starpick">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" class="${n<=st?'on':''}" aria-label="${n} von 5 Sternen">★</button>`).join('')}</div></div>
    <div class="two"><label>Küche (°C)<input name="raum" inputmode="decimal" value="${esc(L.raum??e.raumtemp??'')}"></label><label>Backzeit<input name="backzeit" value="${esc(L.backzeit||'')}" placeholder="z. B. 2:30"></label></div>
    <div class="two"><label>Oberhitze (°C)<input name="oben" value="${esc(L.oben??(r?r.oben:''))}"></label><label>Unterhitze (°C)<input name="unten" value="${esc(L.unten??(r?r.unten:''))}"></label></div>
    <label>Was war gut?<textarea name="gut">${esc(L.gut||'')}</textarea></label>
    <label>Was änderst du nächstes Mal?<textarea name="aendern">${esc(L.aendern||'')}</textarea></label>
    <label>Fotos<input type="file" id="fotoIn" accept="image/*" multiple><span class="hint">Höchstens ${MAX_FOTOS} pro Event.</span></label>
    <div id="fotoBox">${fotoBox(e)}</div>
    <button class="btn primary" type="submit">Protokoll speichern</button>
  </form>
  ${e.log?`<p style="margin-top:20px"><button class="btn danger" data-log-del="${e.id}">Protokoll löschen</button></p>`:''}`;
}

function viewGuide(){
  const e=state.events.find(x=>x.id===ui.id), r=e&&recipe(e.recipeId); if(!e||!r) return viewEvents();
  const p=plan(eff(r,e),e), i=Math.min(Math.max(ui.step,0),p.steps.length-1), s=p.steps[i], last=i===p.steps.length-1;
  const diff=(s.t-new Date())/60000;
  const wann=diff>1?'in '+span(diff):(diff>-s.min?'jetzt':'');
  return `<div class="guide"><button class="back" data-open-event="${e.id}">‹ Zeitplan</button>
  <div class="count">Schritt ${i+1} von ${p.steps.length}</div><div class="bar"><i style="width:${(i+1)/p.steps.length*100}%"></i></div>
  <div class="time">${hm(s.t)}</div><div class="muted">${TAGE_LANG[s.t.getDay()]}, ${dm(s.t)}${wann?' · '+wann:''}</div>
  <h2>${esc(s.ttl)}</h2><ul>${s.d.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <p class="muted">${s.k==='backen'?'':'Danach: '+span(s.min)+(last?'':' bis «'+esc(p.steps[i+1].ttl)+'» um '+hm(p.steps[i+1].t))}</p>
  <div class="row" style="margin-top:22px">${i>0?`<button class="btn" data-step="${i-1}">Zurück</button>`:''}<button class="btn primary grow" data-done="${s.k}" data-step="${last?-1:i+1}">${last?'Fertig, guten Appetit':'Erledigt, weiter'}</button></div></div>`;
}

function viewRecipes(){
  const li=r=>`<li><button class="item" data-open-recipe="${r.id}">${srcIcon(r)}<span><span class="t">${esc(r.name)}</span><br><span class="small muted">${meth(r.methode).name}, ${g(r.dauer)} h, ${g(r.hyd)} % Wasser</span></span><span class="chev" aria-hidden="true">›</span></button></li>`;
  const groups=['mein','web','vorlage'].map(q=>{const rs=recipes().filter(r=>src(r)===q); return rs.length?`<h2>${QUELLEN[q].gruppe}</h2><ul class="list">${rs.map(li).join('')}</ul>`:'';}).join('');
  return `<div class="top"><h1>Rezepte</h1></div>
  <p class="muted">Alle Mengen stehen in Bäckerprozenten und werden pro Event auf die Anzahl Pizzen umgerechnet.</p>
  <p style="margin:18px 0 0"><button class="btn primary" data-new-recipe>Neues Rezept</button></p>
  ${groups}`;
}

function viewRecipe(){
  const r=recipe(ui.id); if(!r) return viewRecipes();
  const rr=eff(r,{methode:ui.calcM}), p=plan(rr,{anzahl:ui.calcN,raumtemp:21});
  const logs=state.events.filter(e=>e.recipeId===r.id&&e.log).sort((a,b)=>new Date(b.essen)-new Date(a.essen));
  const row=(a,b)=>`<tr><td>${a}</td><td>${b}</td></tr>`;
  return `<button class="back" data-nav="recipes">‹ Rezepte</button>
  <div class="titlerow"><h1 style="font-size:2rem">${esc(r.name)}</h1>${src(r)==='mein'?`<img class="seal" src="${IMG_SIEGEL}" alt="Siegel Pizzeria Pizzaiolo Patricio">`:''}</div>
  <p class="srcline">${srcIcon(r)}<span>${QUELLEN[src(r)].name}${srcUrl(r)?` · <a href="${esc(srcUrl(r))}" target="_blank" rel="noopener noreferrer">Quelle öffnen</a>`:''}</span></p>
  <p class="muted" style="margin-top:10px">${meth(rr.methode).name}, ${meth(rr.methode).dauerLbl} ${g(rr.dauer)} h</p>
  ${r.notiz?`<p>${esc(r.notiz)}</p>`:''}
  <div class="row" style="margin-top:14px"><button class="btn primary grow" data-new-event="${r.id}">Event damit planen</button><button class="btn" data-edit-recipe="${r.id}">Bearbeiten</button></div>
  <h2>Zutaten</h2>
  <label style="margin-bottom:14px">Teigführung<select id="calcM">${methodeOptions(r,ui.calcM)}</select></label>
  <div class="row" style="justify-content:space-between;margin-bottom:10px"><span>Pizzen</span><span class="stepper"><button data-calc="-1" aria-label="Eine Pizza weniger">−</button><output>${ui.calcN}</output><button data-calc="1" aria-label="Eine Pizza mehr">+</button></span></div>
  ${amountsTable(p,rr)}
  <h2>Teig</h2><table class="amounts">${row('Teigling',g(r.ballen)+' g')}${row('Wasser',g(r.hyd,1)+' %')}${row('Salz',g(r.salz,1)+' %')}${row('Olivenöl',g(r.oel,1)+' %')}${row('Zucker',g(r.zucker,1)+' %')}${rr.methode==='poolish'||rr.methode==='biga'?row('Mehl im Vorteig',g(rr.anteil||40)+' %'):''}</table>
  <h2>Ablauf</h2><ol style="padding-left:20px">${p.steps.map(s=>`<li style="margin-bottom:8px"><strong>${esc(s.ttl)}</strong>${s.k==='backen'?'':' ('+span(s.min)+')'}<br><span class="muted small">${esc(s.d[s.k==='kneten'||s.k==='vorteig'?1:0])}</span></li>`).join('')}</ol>
  <h2>Formen und Backen</h2><p>${esc(r.formen)}</p><p>Oben ${esc(r.oben)} °C, unten ${esc(r.unten)} °C, ${esc(r.backMin)}–${esc(r.backMax)} min pro Pizza.</p>
  ${logs.length?`<h2>Backprotokolle</h2><ul class="list">${logs.map(e=>{const d=new Date(e.essen); return `<li><button class="item" data-open-event="${e.id}"><span class="when">${dm(d)}<span>${d.getFullYear()}</span></span><span>${sterne(e.log.sterne)}<br><span class="small muted">${esc(e.log.aendern||e.log.gut||e.name||'')}</span></span><span class="chev" aria-hidden="true">›</span></button></li>`;}).join('')}</ul>`:''}
  <p style="margin-top:28px"><button class="btn danger" data-del-recipe="${r.id}">Rezept löschen</button></p>`;
}

function viewRecipeForm(){
  const e=ui.id?recipe(ui.id):null;
  const v=e||{name:'',methode:'direkt',dauer:10,ballen:280,hyd:62,salz:2.6,oel:0,zucker:0,anteil:40,bigaKalt:true,oben:'450',unten:'430',backMin:2,backMax:3,formen:'',notiz:''};
  // step="any": Rezepte mit krummen Prozentwerten (donkarl, avpn) müssen sich speichern lassen
  const num=(n,l,val,step=1,min=0,max=999)=>`<label>${l}<input type="number" name="${n}" value="${esc(val)}" step="any" min="${min}" max="${max}" inputmode="decimal" required></label>`;
  return `<button class="back" ${e?`data-open-recipe="${e.id}"`:'data-nav="recipes"'}>‹ Zurück</button>
  <h1 style="font-size:2rem;margin-bottom:18px">${e?'Rezept bearbeiten':'Neues Rezept'}</h1>
  <form id="recipeForm">
    <label>Name<input name="name" value="${esc(v.name)}" required autocomplete="off"></label>
    <label>Herkunft<select name="quelle">${Object.entries(QUELLEN).filter(([k])=>k!=='vorlage'||(e&&src(e)==='vorlage')).map(([k,q])=>`<option value="${k}" ${k===(e?src(e):'mein')?'selected':''}>${q.name}</option>`).join('')}</select></label>
    <label>Link zur Quelle<input name="quelleUrl" type="url" inputmode="url" placeholder="https://" value="${esc(e?(e.quelleUrl??SEED_URL[e.id]??''):'')}"><span class="hint">Freiwillig, für Rezepte aus dem Internet.</span></label>
    <label>Teigführung<select name="methode">${Object.entries(METHODEN).map(([k,m])=>`<option value="${k}" ${k===v.methode?'selected':''}>${m.name}</option>`).join('')}</select></label>
    <div class="two">${num('dauer','<span id="rDauerLbl">'+meth(v.methode).dauerLbl+' (h)</span>',v.dauer,1,1,96)}${num('ballen','Teigling (g)',v.ballen,5,80,600)}</div>
    <div class="two">${num('hyd','Wasser (%)',v.hyd,0.5,40,90)}${num('salz','Salz (%)',v.salz,0.1,0,5)}</div>
    <div class="two">${num('oel','Olivenöl (%)',v.oel,0.5,0,10)}${num('zucker','Zucker (%)',v.zucker,0.5,0,5)}</div>
    <div id="vorteigFields" ${v.methode==='poolish'||v.methode==='biga'?'':'hidden'}>
      ${num('anteil','Anteil Mehl im Vorteig (%)',v.anteil||40,5,10,100)}
      <label class="check" id="bigaKaltRow" style="margin-top:12px" ${v.methode==='biga'?'':'hidden'}><input type="checkbox" name="bigaKalt" ${v.bigaKalt?'checked':''}>Biga reift im Kühlschrank und wird kalt verarbeitet</label>
    </div>
    <div class="two"><label>Oberhitze (°C)<input name="oben" value="${esc(v.oben)}" required></label><label>Unterhitze (°C)<input name="unten" value="${esc(v.unten)}" required></label></div>
    <div class="two">${num('backMin','Backzeit von (min)',v.backMin,1,1,30)}${num('backMax','Backzeit bis (min)',v.backMax,1,1,30)}</div>
    <label>Mehl-Empfehlung<textarea name="mehl" style="min-height:76px" placeholder="50 % Caputo Pizzeria Tipo 00">${esc(e?mehlOf(e).text:'')}</textarea><span class="hint">Eine Zeile pro Mehl. Mit Prozentangabe am Anfang rechnet die App die Gramm aus.</span></label>
    <label>Formen und Belegen<textarea name="formen">${esc(v.formen)}</textarea></label>
    <label>Notizen<textarea name="notiz" placeholder="Mehlsorte, Erfahrungen, was beim letzten Mal gut war">${esc(v.notiz)}</textarea></label>
    <button class="btn primary" type="submit">Rezept speichern</button>
  </form>`;
}

/* ---------- Anmeldung und Konto ---------- */
const FEHLER={origin:'Die Adresse im Browser passt nicht zur Einstellung BASE_URL des Servers. Trage dort genau die Adresse ein, unter der du die App aufrufst.',login:'Benutzername oder Passwort stimmt nicht.',locked:'Dieses Konto ist nach zu vielen Fehlversuchen für 15 Minuten gesperrt.',exists:'Diesen Benutzernamen gibt es schon.',current:'Das aktuelle Passwort stimmt nicht.',self:'Das geht beim eigenen Konto nicht.',lastadmin:'Es muss mindestens ein aktiver Admin bleiben.'};
const fehlerTxt=r=>FEHLER[r.data&&r.data.error]||(r.status===429?'Zu viele Versuche. Bitte versuche es später nochmals.':r.status===400?'Die Eingabe ist ungültig. Das Passwort braucht mindestens 8 Zeichen.':'Das hat nicht geklappt.');
const msgBox=()=>ui.msg?`<p class="note" style="margin:0 0 6px">${esc(ui.msg)}</p>`:'';

function viewLogin(){
  return `<div class="top"><h1>Pizza App</h1></div>
  <form id="loginForm">
    <label>Benutzername<input name="username" value="${esc(ui.loginName||'')}" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    <label>Passwort<input type="password" name="password" autocomplete="current-password" required></label>
    ${msgBox()}
    <button class="btn primary" type="submit">Anmelden</button>
  </form>`;
}

function viewKonto(){
  const li=u=>`<li style="padding:14px 0"><span class="t" style="font-weight:600">${esc(u.username)}</span><br><span class="small muted">${[u.role==='admin'?'Admin':'Benutzer',u.disabled?'gesperrt':'',u.locked?'nach Fehlversuchen vorübergehend gesperrt':'',u.id===me.id?'das bist du':''].filter(Boolean).join(', ')}</span>
    <div class="row" style="margin-top:8px"><button class="btn quiet" data-user-pw="${u.id}">Passwort setzen</button>${u.locked?`<button class="btn quiet" data-user-patch="${u.id}|unlock">Entsperren</button>`:''}${u.id===me.id?'':`<button class="btn quiet" data-user-patch="${u.id}|${u.disabled?'enable':'disable'}">${u.disabled?'Freigeben':'Sperren'}</button><button class="btn quiet" data-user-patch="${u.id}|${u.role==='admin'?'user':'admin'}">${u.role==='admin'?'Admin-Rechte entziehen':'Zum Admin machen'}</button><button class="btn danger" data-user-del="${u.id}">Löschen</button>`}</div></li>`;
  return `<div class="top"><h1>Konto</h1></div>
  ${msgBox()}
  <p class="muted">Angemeldet als <strong>${esc(me.username)}</strong>${me.role==='admin'?' (Admin)':''}.</p>
  <p style="margin:18px 0 0"><button class="btn" data-logout>Abmelden</button></p>
  <h2>Passwort ändern</h2>
  <form id="pwForm">
    <input type="text" name="username" autocomplete="username" value="${esc(me.username)}" hidden>
    <label>Aktuelles Passwort<input type="password" name="current" autocomplete="current-password" required></label>
    <label>Neues Passwort<input type="password" name="password" autocomplete="new-password" minlength="8" required><span class="hint">Mindestens 8 Zeichen. Andere Geräte werden dabei abgemeldet.</span></label>
    <button class="btn primary" type="submit">Passwort ändern</button>
  </form>
  ${me.role==='admin'?`<h2>Benutzer</h2><p class="small muted">Alle Benutzer sehen dieselben Rezepte und Events. Die Anmeldung regelt nur den Zugang.</p>
  ${ui.users?`<ul class="list">${ui.users.map(li).join('')}</ul>`:'<p class="muted">Lädt …</p>'}
  <h2>Neuer Benutzer</h2>
  <form id="userForm">
    <label>Benutzername<input name="username" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="2" maxlength="40" required></label>
    <label>Passwort<input type="password" name="password" autocomplete="new-password" minlength="8" required><span class="hint">Mindestens 8 Zeichen. Die Person kann es danach selbst ändern.</span></label>
    <label class="check"><input type="checkbox" name="admin">Darf Benutzer verwalten (Admin)</label>
    <button class="btn primary" type="submit">Benutzer anlegen</button>
  </form>`:''}`;
}

async function loadUsers(){
  if(!me||me.role!=='admin') return;
  const r=await api('GET','/api/users'); if(r.status===200){ui.users=r.data.users; if(ui.view==='konto') render();}
}
function kontoMsg(txt){ui.msg=txt; render(); window.scrollTo(0,0);}
async function doLogin(v){
  ui.loginName=v.username;
  const r=await api('POST','/api/login',{username:v.username,password:v.password});
  if(r.status!==200){ui.msg=fehlerTxt(r); return render();}
  me=r.data.user; ui.msg=''; dirty=false;
  try{await loadState();}catch(e){loadErr=true;}
  go('events');
}
async function doPw(v){
  const r=await api('POST','/api/me/password',{current:v.current,password:v.password});
  kontoMsg(r.status===204?'Das Passwort ist geändert.':fehlerTxt(r));
}
async function doUser(v){
  const name=v.username.trim(), r=await api('POST','/api/users',{username:name,password:v.password,role:v.admin?'admin':'user'});
  await loadUsers(); kontoMsg(r.status===201?`«${name}» ist angelegt.`:fehlerTxt(r));
}
async function changeUser(method,id,body,ok){
  const r=await api(method,'/api/users/'+id,body);
  await loadUsers(); kontoMsg(r.status<300?ok:fehlerTxt(r));
}
async function start(){
  try{const r=await api('GET','/api/me'); if(r.status===200){me=r.data.user; await loadState();} else if(r.status!==401) loadErr=true;}
  catch(e){loadErr=true;}
  render();
}

function render(){
  document.querySelector('nav').hidden=!me;
  if(!me&&!loadErr){app.innerHTML=viewLogin(); return;}
  const V={events:viewEvents,eventForm:viewEventForm,event:viewEvent,guide:viewGuide,shop:viewShop,log:viewLog,recipes:viewRecipes,recipe:viewRecipe,recipeForm:viewRecipeForm,galerie:viewGalerie,foto:viewFoto,konto:viewKonto};
  if(!loaded){app.innerHTML=loadErr?'<h1>Pizza App</h1><p class="note">Die Daten konnten nicht geladen werden.</p><p style="margin-top:16px"><button class="btn" data-reload>Nochmals versuchen</button></p>':'<p class="muted">Lädt …</p>'; return;}
  app.innerHTML=(saveErr?'<p class="note" style="margin:0 0 14px">Die letzte Änderung ist noch nicht gespeichert. Die App versucht es weiter.</p>':'')+(V[ui.view]||viewEvents)();
  const tab=ui.view==='konto'?'konto':['recipes','recipe','recipeForm'].includes(ui.view)?'recipes':ui.view==='galerie'||(ui.view==='foto'&&ui.lb.alle)||ui.von==='galerie'?'galerie':'events';
  document.querySelectorAll('nav button').forEach(b=>b.dataset.nav===tab?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
}

/* ---------- Aktionen ---------- */
function ownRecipes(){return state.recipes;}

document.addEventListener('click',ev=>{
  const t=ev.target.closest('button'); if(!t) return; const d=t.dataset;
  if('reload' in d) return location.reload();
  if(!loaded) return;
  if(d.openEvent) return go('event',d.openEvent);
  if(d.nav==='konto'){ui.msg=''; ui.users=null; loadUsers(); return go('konto');}
  if(d.nav) return go(d.nav,null,{von:null});
  if(d.lbP){if(ui.view!=='foto') ui.lbY=window.scrollY; return go('foto',null,{lb:{e:d.lbE,p:d.lbP,alle:!!d.lbAlle}});}
  if('lbZu' in d) return lbZu();
  if(d.zumEvent) return go('event',d.zumEvent,{von:'galerie'});
  if(d.again){const e=state.events.find(x=>x.id===d.again); if(!e) return;
    ui.preRecipe=null; ui.draft={name:e.name||'',essen:toInput(naechsterSamstag()),recipeId:e.recipeId,methode:e.methode||'',anzahl:e.anzahl,raumtemp:e.raumtemp,maschine:!!e.maschine,dauer:e.dauer,park:e.park,erw:e.erw??'',kind:e.kind??''};
    return go('eventForm',null);}
  if('logout' in d){api('POST','/api/logout').finally(()=>location.reload()); return;}
  if(d.userPw){const u=ui.users.find(x=>x.id===Number(d.userPw)), pw=prompt(`Neues Passwort für «${u.username}» (mindestens 8 Zeichen). Die Person wird überall abgemeldet.`); if(pw) changeUser('PATCH',u.id,{password:pw},`Das Passwort von «${u.username}» ist neu gesetzt.`); return;}
  if(d.userPatch){const [id,was]=d.userPatch.split('|'), u=ui.users.find(x=>x.id===Number(id));
    const body={unlock:{unlock:true},disable:{disabled:true},enable:{disabled:false},admin:{role:'admin'},user:{role:'user'}}[was];
    const ok={unlock:'ist entsperrt',disable:'ist gesperrt und überall abgemeldet',enable:'ist wieder freigegeben',admin:'ist jetzt Admin',user:'ist kein Admin mehr'}[was];
    changeUser('PATCH',u.id,body,`«${u.username}» ${ok}.`); return;}
  if(d.userDel){const u=ui.users.find(x=>x.id===Number(d.userDel)); if(confirm(`Benutzer «${u.username}» löschen?`)) changeUser('DELETE',u.id,undefined,`«${u.username}» ist gelöscht.`); return;}
  if('newEvent' in d){ui.preRecipe=d.newEvent||null; ui.draft=null; return go('eventForm',null);}
  if(d.editEvent){ui.draft=null; return go('eventForm',d.editEvent);}
  if(d.delEvent){ if(confirm('Diesen Event löschen? Zeitplan, Einkaufsliste und Protokoll gehen dabei verloren.')){state.events=state.events.filter(e=>e.id!==d.delEvent); delete fotoIds[d.delEvent]; save(); go('events');} return; }
  if(d.apply){const e=state.events.find(x=>x.id===ui.id), [D,P]=d.apply.split('|').map(Number); e.dauer=D; e.park=P; save(); return go('event',e.id);}
  if(d.shop) return go('shop',d.shop);
  if(d.belag){const e=state.events.find(x=>x.id===ui.id), [id,k]=d.belag.split('|'); e.shop=e.shop||{}; e.shop.belag={...belagOf(e)}; e.shop.belag[id]=Math.max(0,(e.shop.belag[id]||0)+Number(k)); save(); return render();}
  if(d.shopDel){const e=state.events.find(x=>x.id===ui.id); e.shop.extra=(e.shop.extra||[]).filter(x=>x.id!==d.shopDel); save(); return render();}
  if(d.log){ui.fotoNeu=[]; ui.fotoWeg=[]; return go('log',d.log);}
  if(d.star){const f=t.closest('form'), n=Number(d.star), v=Number(f.sterne.value)===n?0:n; f.sterne.value=v; f.querySelectorAll('[data-star]').forEach(b=>b.classList.toggle('on',Number(b.dataset.star)<=v)); return;}
  if(d.fotoDel){const e=state.events.find(x=>x.id===ui.id);
    if(ui.fotoNeu.some(n=>n.id===d.fotoDel)) ui.fotoNeu=ui.fotoNeu.filter(n=>n.id!==d.fotoDel); else ui.fotoWeg.push(d.fotoDel);
    document.getElementById('fotoBox').innerHTML=fotoBox(e); return;}
  if(d.logDel){ if(confirm('Dieses Protokoll löschen?')){const e=state.events.find(x=>x.id===d.logDel); delete e.log; fotosOf(e.id).forEach(p=>delFoto(e.id,p)); save(); go('event',e.id);} return; }
  if(d.logApply){const e=state.events.find(x=>x.id===d.logApply), L=e.log, r0=recipe(e.recipeId);
    if(r0&&confirm(`Ofenwerte im Rezept «${r0.name}» ersetzen?`)){const r=ownRecipes().find(x=>x.id===e.recipeId); if(L.oben) r.oben=L.oben; if(L.unten) r.unten=L.unten; save(); render();} return; }
  if(d.toggle){const e=state.events.find(x=>x.id===ui.id); e.done=e.done||{}; e.done[d.toggle]=!e.done[d.toggle]; save(); return render();}
  if(d.guide){const e=state.events.find(x=>x.id===d.guide), p=plan(eff(recipe(e.recipeId),e),e); const ni=nextIdx(e,p); return go('guide',e.id,{step:ni<0?0:ni});}
  if(d.done){const e=state.events.find(x=>x.id===ui.id); e.done=e.done||{}; e.done[d.done]=true; save();}
  if(d.step!==undefined){const n=Number(d.step); return n<0?go('event',ui.id):go('guide',ui.id,{step:n});}
  if(d.openRecipe){ui.calcM=''; ui.calcN=(recipe(d.openRecipe)||{}).stdAnzahl||3; return go('recipe',d.openRecipe);}
  if('newRecipe' in d) return go('recipeForm',null);
  if(d.editRecipe) return go('recipeForm',d.editRecipe);
  if(d.delRecipe){ if(confirm('Dieses Rezept löschen?')){state.recipes=ownRecipes().filter(r=>r.id!==d.delRecipe); save(); go('recipes');} return; }
  if(d.calc){ui.calcN=Math.min(40,Math.max(1,ui.calcN+Number(d.calc))); return render();}
});

document.addEventListener('input',ev=>{
  const f=ev.target.form; if(!f||f.id!=='eventForm'||!['erw','kind'].includes(ev.target.name)) return;
  const c=gastCalc(f.erw.value,f.kind.value); if(c){f.anzahl.value=c.n; document.getElementById('gastHint').textContent=gastTxt(f.erw.value,f.kind.value);}
});
document.addEventListener('change',async ev=>{
  if(ev.target.id==='calcM'){ui.calcM=ev.target.value; return render();}
  if(ev.target.dataset.shopkey){const e=state.events.find(x=>x.id===ui.id); e.shop=e.shop||{}; e.shop.ok=e.shop.ok||{}; e.shop.ok[ev.target.dataset.shopkey]=ev.target.checked; ev.target.closest('.chk').classList.toggle('on',ev.target.checked); return save();}
  if(ev.target.id==='fotoIn'){const e=state.events.find(x=>x.id===ui.id), files=[...(ev.target.files||[])]; if(!e||!files.length) return;
    const frei=Math.max(0,MAX_FOTOS-fotoWahl(e).length);
    if(files.length>frei) alert(frei?`Höchstens ${MAX_FOTOS} Fotos pro Event, es hat noch Platz für ${frei}.`:`Dieses Event hat schon ${MAX_FOTOS} Fotos.`);
    for(const file of files.slice(0,frei)){
      try{ui.fotoNeu.push({id:uid(),data:await shrink(file)});}catch(err){alert('Ein Foto konnte nicht gelesen werden.');}
    }
    // Leeren, damit dieselbe Datei nach dem Entfernen nochmals gewählt werden kann
    ev.target.value=''; const box=document.getElementById('fotoBox'); if(box) box.innerHTML=fotoBox(e); return;}
  const f=ev.target.form; if(!f) return;
  if(f.id==='eventForm'&&(ev.target.name==='recipeId'||ev.target.name==='methode')){
    const v=Object.fromEntries(new FormData(f)), r=recipe(v.recipeId);
    v.maschine=!!v.maschine;
    if(ev.target.name==='recipeId'){v.methode=''; v.maschine=!!r.maschine;}
    const er=eff(r,v); v.dauer=er.dauer; v.park=(er.methode==='biga'||er.methode==='poolish')?(er.parkStd||0):0;
    ui.draft=v; return render();
  }
  if(f.id==='recipeForm'&&ev.target.name==='methode'){const m=ev.target.value;
    document.getElementById('rDauerLbl').textContent=METHODEN[m].dauerLbl+' (h)';
    document.getElementById('vorteigFields').hidden=!(m==='poolish'||m==='biga');
    document.getElementById('bigaKaltRow').hidden=m!=='biga';
    f.dauer.value={direkt:10,kuehl:24,poolish:16,biga:24}[m];}
});

document.addEventListener('submit',ev=>{
  ev.preventDefault(); const f=ev.target, v=Object.fromEntries(new FormData(f));
  if(f.id==='loginForm') return doLogin(v);
  if(f.id==='pwForm') return doPw(v);
  if(f.id==='userForm') return doUser(v);
  if(f.id==='eventForm'){
    const r=eff(recipe(v.recipeId),v), dauer=Number(v.dauer)||r.dauer;
    const data={name:v.name.trim(),essen:v.essen,recipeId:v.recipeId,methode:v.methode||'',anzahl:Math.max(1,Number(v.anzahl)||3),raumtemp:Number(v.raumtemp)||21,maschine:!!v.maschine,dauer,park:Math.max(0,Number(String(v.park||0).replace(',','.'))||0),erw:v.erw===''?'':Math.max(0,Number(v.erw)||0),kind:v.kind===''?'':Math.max(0,Number(v.kind)||0)};
    let e=ui.id&&state.events.find(x=>x.id===ui.id);
    if(e){ if(e.recipeId!==data.recipeId||(e.methode||'')!==data.methode) e.done={}; Object.assign(e,data); } else { e={id:uid(),done:{},...data}; state.events.push(e); }
    ui.draft=null; save(); go('event',e.id);
  }
  if(f.id==='shopAdd'){const e=state.events.find(x=>x.id===ui.id), t=(v.txt||'').trim(); if(!t) return; e.shop=e.shop||{}; e.shop.extra=(e.shop.extra||[]).concat({id:uid(),txt:t}); save(); render(); const i=document.querySelector('#shopAdd input'); if(i&&i.focus) i.focus(); return;}
  if(f.id==='logForm'){const e=state.events.find(x=>x.id===ui.id);
    (ui.fotoWeg||[]).forEach(p=>delFoto(e.id,p)); (ui.fotoNeu||[]).forEach(n=>saveFoto(e.id,n.id,n.data));
    e.log={sterne:Number(v.sterne)||0,raum:(v.raum||'').trim(),oben:(v.oben||'').trim(),unten:(v.unten||'').trim(),backzeit:(v.backzeit||'').trim(),gut:(v.gut||'').trim(),aendern:(v.aendern||'').trim(),ts:Date.now()};
    ui.fotoNeu=[]; ui.fotoWeg=[]; save(); return go('event',e.id);}
  if(f.id==='recipeForm'){
    const n=k=>Number(String(v[k]).replace(',','.'))||0;
    const data={name:v.name.trim(),quelle:QUELLEN[v.quelle]?v.quelle:'mein',quelleUrl:(v.quelleUrl||'').trim(),methode:v.methode,dauer:n('dauer')||10,ballen:n('ballen')||280,hyd:n('hyd'),salz:n('salz'),oel:n('oel'),zucker:n('zucker'),anteil:n('anteil')||40,bigaKalt:!!v.bigaKalt,oben:v.oben.trim(),unten:v.unten.trim(),backMin:n('backMin')||2,backMax:Math.max(n('backMax'),n('backMin'))||3,mehl:(v.mehl||'').trim(),formen:v.formen.trim(),notiz:v.notiz.trim()};
    const list=ownRecipes(); let r=ui.id&&list.find(x=>x.id===ui.id);
    if(r) Object.assign(r,data); else { r={id:uid(),...data}; list.push(r); }
    save(); go('recipe',r.id);
  }
});

start();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
let wischX=null;
document.addEventListener('touchstart',ev=>{wischX=ui.view==='foto'&&ev.touches.length===1?ev.touches[0].clientX:null;},{passive:true});
document.addEventListener('touchend',ev=>{
  if(wischX===null) return; const dx=ev.changedTouches[0].clientX-wischX; wischX=null;
  if(ui.view==='foto'&&Math.abs(dx)>50) lbSchritt(dx<0?1:-1);
});
document.addEventListener('keydown',ev=>{
  if(ui.view!=='foto') return;
  if(ev.key==='ArrowRight') lbSchritt(1); else if(ev.key==='ArrowLeft') lbSchritt(-1); else if(ev.key==='Escape') lbZu();
});
document.addEventListener('visibilitychange',refresh);
setInterval(refresh,60000);
setInterval(()=>{if(ui.view==='guide'&&!document.querySelector('details[open]')) render();},60000);
