/* Pizza_App: Rechenlogik. Kein Zugriff auf DOM oder Speicher. */
/* ---------- Daten ---------- */
const SEED = [
  {id:'biga100', name:'Meine Biga-Pizza (100 % Biga)', methode:'biga', bigaKalt:true, dauer:14, ballen:280, hyd:65, salz:2.8, oel:0, zucker:0,
   anteil:100, bigaHyd:45, vtHefe:0.8, htHefe:0, reserve:0.36, stockMin:45, stueckMin:180, knetMin:20, maschine:true, parkStd:0,
   wasserVT:'kaltes Wasser', wasserHT:'eiskaltes Wasser',
   oben:'450 (max.)', unten:'430–450', backMin:2, backMax:3,
   txt:{
     vorteig:['Alles vermengen, bis eine krümelige Biga entsteht.','3 Stunden bei Zimmertemperatur im Behälter lassen, dann in den Kühlschrank.'],
     kneten:['Biga direkt aus dem Kühlschrank in die Knetmaschine geben.','Das eiskalte Wasser schluckweise zugeben. Vor dem letzten Schluck das Salz zugeben.','Kneten, bis der Teig glatt ist. Die Teigtemperatur darf nicht über 24 °C gehen.'],
     stock:['Teig aus der Maschine nehmen, ein paar Mal dehnen und falten, zur Kugel formen.','30 Minuten zugedeckt gehen lassen.','Nochmals dehnen und falten, weitere 15 Minuten gehen lassen.'],
     ballen:['In geschlossenen Behältern etwa 3 Stunden gären lassen, bis sie schön aufgegangen sind.','Sind sie zu früh bereit: in den Kühlschrank legen und später direkt kalt zu Pizza formen.']},
   formen:'Von Hand formen. Teiglinge, die im Kühlschrank geparkt waren, direkt aus dem Kühlschrank formen.',
   notiz:'Grundrezept für 3 Teiglinge: 500 g Pizzamehl, 4 g Frischhefe, 225 g kaltes Wasser für die Biga, dann 100 g eiskaltes Wasser und 14 g Salz. Für 6 Teiglinge alles verdoppeln.'},
  {id:'avpn', name:'Vera Pizza Napoletana (AVPN 2024)', methode:'direkt', dauer:24, ballen:280, hyd:58.8, salz:2.94, oel:0, zucker:0, anteil:40,
   hefeProLiter:[0.1,3], dauerRange:[12,24], knetMin:30,
   oben:'450 (max.)', unten:'430', backMin:2, backMax:3,
   txt:{
     kneten:['Mit dem Wasser beginnen: zuerst das Salz darin lösen, dann die Hefe. Salz und Hefe dürfen höchstens 5 Minuten direkt in Kontakt sein, also gleich weiterarbeiten.','Das Mehl nach und nach zugeben, über etwa 10 Minuten, bis der Teig zusammenkommt.','Danach höchstens weitere 20 Minuten kneten. Der Teig soll feucht, weich und formbar sein, aber nicht kleben, und sich leicht aus der Schüssel lösen.','Kein Fett und kein Zucker im Teig.'],
     stock:['Teig auf die Arbeitsfläche legen und mit einem feuchten Tuch abdecken, damit die Oberfläche nicht antrocknet.'],
     ballen:['In die Teigbox legen und bei Raumtemperatur reifen lassen, ideal sind 18–20 °C.','Reif, wenn der Teig weich, dehnbar und kaum noch elastisch ist.']},
   formen:'Teigling mit der Spachtel aus der Box heben, kurz in Mehl wenden. Mit den Fingern beider Hände von der Mitte nach aussen drücken, so wandert die Luft in den Rand. Dann mit beiden Händen dehnen und drehen. So wenig Mehl wie möglich, kein Nudelholz. Margherita: 60–80 g von Hand zerdrückte Schältomaten, 80–100 g Mozzarella oder Fior di Latte in Streifen, Basilikum, 6–7 g Olivenöl in Spirale. Das Salz kommt in die Tomaten, nicht auf den Teig.',
   notiz:'Nach dem Disciplinare der AVPN von 2024: auf 1 Liter Wasser 1600–1800 g Mehl, 40–60 g Salz und 0,1–3 g Frischhefe, direkte Teigführung, insgesamt 12–24 Stunden Gare. Hinterlegt sind die Mittelwerte (1700 g Mehl, 50 g Salz). Das Original verlangt 60–90 Sekunden bei etwa 485 °C in der Kuppel und 380–430 °C am Boden. Der Don Luigi schafft 450 °C, im Heimofen ist es also eine Nachbildung nach Originalrezept.'},
  {id:'donkarl', name:'Pizza nach Don Karl-Heinz (Kenwood-Adaption nach Patrizzio)', methode:'kuehl', dauer:24, dauerMin:24, ballen:224.5, hyd:68, salz:3, oel:2.8, zucker:0.4, anteil:40,
   hefeFix:1.4, hefeArt:'trocken', oelMl:true, zuckerTL:true, zusatz:[['inaktive Lievito Madre',4]], reserve:0, stdAnzahl:4,
   ballNachKuehl:true, aktivMin:15, stockRtMin:90, akklMin:120, knetMin:23, maschine:true,
   oben:'400', unten:'380', backMin:3, backMax:4,
   txt:{
     aktiv:['In die Kenwood-Schüssel geben und mit den Fingern zerrühren, bis sich Hefe und Zucker aufgelöst haben.','Rund 15 Minuten warten, bis die Hefe Aktivität zeigt.'],
     kneten:['Mehl, Lievito Madre und Olivenöl in die Schüssel geben und mit dem Knethaken etwa 3 Minuten auf Stufe 1 kneten.','Nach etwa 10 Sekunden das restliche Wasser langsam, Milliliter für Milliliter, dazugiessen. Nach etwa 1 Minute das Salz zugeben.','Nach den 3 Minuten auf Stufe 2 stellen und 20 Minuten kneten lassen.','Tipp: Ist der Teig nach dem Kneten noch leicht klebrig, etwas Mehl auf den Tisch geben und ganz kurz von Hand kneten. Nach wenigen Minuten ist er glänzend und perfekt.'],
     stock:['Teig aus der Schüssel nehmen, zur Kugel formen und in eine leicht geölte Schüssel geben.','Mit einem feuchten Tuch abdecken und 1 bis 2 Stunden bei Zimmertemperatur gehen lassen.'],
     kuehl:['Schüssel zugedeckt in den Kühlschrank stellen, mindestens 24 Stunden.'],
     ballen:['Zugedeckt etwa 2 Stunden Zimmertemperatur annehmen lassen.']},
   formen:'Pizza aus den portionierten Kugeln formen, belegen und backen.',
   notiz:'Für 4 Pizzen: 500 g Mehl, 340 g Wasser (68 % Hydration), 20 g inaktive Lievito Madre, ein Päckchen Hefe (7 g), ½ TL Zucker, 15 g Salz (wenn möglich unjodiert), 15 ml Olivenöl. Für 2 Pizzen alles halbieren: 250 g Mehl, 170 g Wasser. Das ursprüngliche Rezept hatte 70 % Hydration (350 g Wasser). Erfahrung: Pizzamehl wird klebriger als normales Weissmehl.'},
  {id:'svens48', name:'Svens 48-Stunden-Pizzateig (Teichners)', methode:'kuehl', dauer:44, ballen:280, hyd:64, salz:3, oel:0, zucker:0, anteil:40,
   hefeFix:0.3, reserve:-0.417, autolyseMin:30, stockKuehlH:24, akklMin:240, knetMin:15, wasserHT:'kaltes Wasser',
   oben:'450 (max.)', unten:'430–450', backMin:2, backMax:3,
   txt:{
     autolyse:['Einen Schluck vom Wasser für die Hefe zurückbehalten.','Mehl und restliches Wasser grob vermengen und 30 Minuten abgedeckt ruhen lassen.'],
     kneten:['Hefe im zurückbehaltenen Wasser auflösen, zum Teig geben und gut einarbeiten.','Salz zugeben und 10–15 Minuten kneten, bis der Teig geschmeidig ist.'],
     stock:['Teig dehnen und falten und zu einer Kugel formen.','In einer verschlossenen Box etwa 24 Stunden im Kühlschrank ruhen lassen.'],
     ballen:['In die Box legen und im Kühlschrank ruhen lassen, im Original etwa 20 Stunden.'],
     raus:['Box 4 Stunden vor dem Backen aus dem Kühlschrank nehmen und bei Raumtemperatur reifen lassen.','Danach sind die Teiglinge bereit zum Formen und Belegen.']},
   formen:'Von Hand formen, Rand freilassen, belegen und in den Ofen.',
   notiz:'Community-Rezept von Sven (Teichners) für Pizza napoletana mit kalter Teigführung. Original für 3 Teiglinge à ca. 280 g: 500 g Weizenmehl Type 00, 320 g kaltes Wasser, 1,5 g frische oder 0,5 g trockene Hefe, 15 g feines Meersalz. Ablauf über drei Tage: 24 h im Ganzen und 20 h als Teiglinge im Kühlschrank, dann 4 h bei Raumtemperatur.'},
  {id:'lewizza51', name:'100 % Biga, 51 h (nach Lewizza)', methode:'biga', bigaKalt:true, dauer:27, ballen:280, hyd:68, salz:2.95, oel:0, zucker:0,
   anteil:100, bigaHyd:57.8, vtHefe:0.3, htHefe:0, reserve:0.1, stdAnzahl:6, stockMin:85, optFaltenMin:35, stockKuehlH:21, ballNachKuehl:true, stueckMin:190, knetMin:15, parkStd:0,
   wasserVT:'kaltes Wasser', wasserHT:'kaltes Wasser',
   oben:'450 (max.)', unten:'430–450', backMin:2, backMax:3,
   txt:{
     vorteig:['Hefe im Wasser auflösen, zum Mehl geben und grob vermengen, bis kein trockenes Mehl mehr da ist.','Zugedeckt 3 Stunden bei Raumtemperatur ruhen lassen, dann 24 Stunden in den Kühlschrank.'],
     kneten:['Das Salz im kalten Wasser auflösen.','Zur Biga geben und von Hand einarbeiten, bis kein Wasser mehr sichtbar ist. Mit der Knetmaschine geht es auch.'],
     stock:['45 Minuten zugedeckt bei Raumtemperatur ruhen lassen.','Kurz kneten, falten und rund schleifen.','30 Minuten zugedeckt ruhen lassen.','Nochmals dehnen, falten und rund schleifen.'],
     kuehl:['Den Behälter leicht mit Olivenöl ölen und den Teig als Ganzes hineinlegen.','Zugedeckt 21 Stunden in den Kühlschrank stellen.'],
     ballen:['Zugedeckt 3 Stunden bei Raumtemperatur gehen lassen.']},
   formen:'Von Hand formen, nie mit dem Nudelholz: mit den Fingerspitzen von der Mitte nach aussen drücken, Rand freilassen, dann auf Grösse ziehen.',
   notiz:'Community-Rezept von @lewizza_macht_pizza (Instagram). Original für 6 Teiglinge à 280 g: 982 g Mehl, 668 g kaltes Wasser (568 g für die Biga, 100 g für den Hauptteig), 29 g Salz, 3 g Frischhefe. Olivenöl nur zum Ölen des Behälters. Ruhezeiten zusammen 52 h 15 min, der Autor nennt gerundet 51 h. Mehl: beste Ergebnisse mit Caputo Nuvola, Friessinger La Farina 14 oder Das Mehl. Ebenfalls geeignet: Molino UniquaBlu Tipo 1, Caputo Tipo 1, Caputo Manitoba, Costa Amalfi Molino Pizzuti, Caputo Chef, Lidl Nuvola. Lidl Doppio Zero funktioniert, Lidl Nuvola ist zuverlässiger.'},
  {id:'napo', name:'Napoletana', methode:'direkt', dauer:10, ballen:280, hyd:62, salz:2.6, oel:0, zucker:0, anteil:40,
   oben:'450 (max.)', unten:'430–450', backMin:2, backMax:3,
   formen:'Von Hand formen, nie mit dem Nudelholz: mit den Fingerspitzen von der Mitte nach aussen drücken, 1–1,5 cm Rand freilassen, dann auf Grösse ziehen.',
   notiz:'Nur Mehl, Wasser, Salz, Hefe. Wenig belegen. Ab 90 Sekunden kontrollieren.'},
  {id:'napo-poolish', name:'Napoletana mit Poolish', methode:'poolish', dauer:16, ballen:280, hyd:62, salz:2.6, oel:0, zucker:0, anteil:40,
   oben:'450 (max.)', unten:'430–450', backMin:2, backMax:3,
   formen:'Von Hand formen, Rand von 1–1,5 cm freilassen, Gase im Rand nicht ausdrücken.',
   notiz:'Milder, leicht nussiger Geschmack, sehr luftiger Rand.'},
  {id:'ny', name:'New York Style', methode:'kuehl', dauer:48, ballen:280, hyd:62, salz:2, oel:2.5, zucker:1.5, anteil:40,
   oben:'340–360', unten:'300–320', backMin:5, backMax:7,
   formen:'Von Hand auf ca. 28–30 cm ziehen, Rand ca. 1 cm hoch lassen. Käse bis fast an den Rand.',
   notiz:'Kräftiges Mehl mit 12,5–14 % Protein. Geriebener Block-Mozzarella.'},
  {id:'roma-biga', name:'Roma mit Biga', methode:'biga', bigaKalt:true, dauer:24, ballen:280, hyd:58, salz:2.3, oel:3, zucker:0, anteil:40,
   oben:'380–400', unten:'330–350', backMin:4, backMax:6,
   formen:'Mit dem Nudelholz 2–3 mm dünn ausrollen, kaum Rand. Sparsam belegen, sonst wird die Mitte weich.',
   notiz:'Biga reift im Kühlschrank und wird direkt kalt verarbeitet, damit der Teig beim Kneten unter 24 °C bleibt.'},
  {id:'thin', name:'Thin Slice', methode:'kuehl', dauer:24, ballen:280, hyd:54, salz:2, oel:4, zucker:1, anteil:40,
   oben:'340–360', unten:'320–340', backMin:4, backMax:6,
   formen:'Mit dem Nudelholz auf ca. 2 mm ausrollen, mit der Gabel mehrfach einstechen. Käse bis an den Rand.',
   notiz:'Nach dem Backen kurz auf ein Gitter, damit der Boden knusprig bleibt.'},
  {id:'pfanne', name:'Pfannenpizza', methode:'kuehl', dauer:24, ballen:280, hyd:72, salz:2.2, oel:2, zucker:0, anteil:40,
   oben:'270–290', unten:'240–260', backMin:10, backMax:14,
   formen:'2–3 EL Olivenöl in die Backform, Teigling darin dehnen, 30–60 min ruhen lassen bis er den Boden füllt. Dann belegen.',
   notiz:'Backform auf den Stein stellen. Sehr weicher, klebriger Teig.'}
];
const METHODEN = {
  direkt:{name:'Direkt, Raumtemperatur', dauerLbl:'Gehzeit gesamt', min:3, max:24},
  kuehl:{name:'Kaltführung im Kühlschrank', dauerLbl:'Zeit im Kühlschrank', min:12, max:96},
  poolish:{name:'Poolish (flüssiger Vorteig)', dauerLbl:'Reifezeit Poolish', min:8, max:20},
  biga:{name:'Biga (fester Vorteig)', dauerLbl:'Reifezeit Biga', min:12, max:48}
};
const DIREKT_HEFE={3:2.0,4:1.4,6:0.8,8:0.45,12:0.2,16:0.13,24:0.08};
const KUEHL_HEFE={24:0.6,48:0.4,72:0.3};
const POOLISH_HEFE={8:0.45,12:0.25,16:0.12,20:0.07};
const TAGE=['So','Mo','Di','Mi','Do','Fr','Sa'];
const TAGE_LANG=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

/* ---------- Helfer ---------- */
const p2=n=>String(n).padStart(2,'0');
const hm=d=>p2(d.getHours())+':'+p2(d.getMinutes());
const dm=d=>p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.';
const dayKey=d=>d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
const g=(x,nd=0)=>x.toFixed(nd);
const add=(d,min)=>new Date(d.getTime()+min*60000);
function toInput(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'T'+hm(d);}
function interp(t,x){
  const xs=Object.keys(t).map(Number).sort((a,b)=>a-b);
  if(x<=xs[0]) return t[xs[0]]; if(x>=xs[xs.length-1]) return t[xs[xs.length-1]];
  for(let i=0;i<xs.length-1;i++){const a=xs[i],b=xs[i+1]; if(x>=a&&x<=b){const k=(x-a)/(b-a); return Math.exp(Math.log(t[a])*(1-k)+Math.log(t[b])*k);}}
}
const tf=(raum,ref=21)=>Math.pow(2,(ref-raum)/8);
function hefeTxt(h){
  let s=g(h,h<10?1:0)+' g frische Hefe';
  if(h<1) s=g(h,2)+' g frische Hefe (1 g Hefe in 100 g Wasser lösen, davon '+g(h*100)+' g nehmen und vom Rezeptwasser abziehen)';
  return s+', oder '+g(h/3,2)+' g Instanthefe';
}
const BRUCH={0.25:'¼',0.5:'½',0.75:'¾'};
function tl(x){const q=Math.round(x*4)/4, n=Math.floor(q), f=q-n; return q?((n||'')+(BRUCH[f]||''))+' TL':'';}
const oelA=(r,x)=>r.oelMl?g(x/0.92)+' ml':g(x,1)+' g';
const zuA=(r,x)=>g(x,1)+' g'+(r.zuckerTL&&tl(x/4)?' ('+tl(x/4)+')':'');
const hefeName=r=>r.hefeArt==='trocken'?'Trockenhefe':'Frische Hefe';
function span(min){const h=Math.floor(min/60), m=Math.round(min%60); return ((h?h+' h ':'')+(m||!h?m+' min':'')).trim();}

/* Mehl-Empfehlung: eine Zeile pro Mehl, «50 % Name» wird in Gramm umgerechnet */
const SEED_MEHL={svens48:'Weizenmehl Tipo 00',lewizza51:'Tipo 0, 00 oder 1, mindestens 12 g Eiweiss pro 100 g',biga100:'50 % Caputo Pizzeria «Tipo 00»\n50 % Caputo Nuvola «Tipo 0»'};
function mehlOf(r){const t=String(r.mehl??SEED_MEHL[r.id]??''); const mix=[],notes=[];
  t.split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{const m=l.match(/^(\d+(?:[.,]\d+)?)\s*%\s*(.+)$/); m?mix.push({p:Number(m[1].replace(',','.')),n:m[2]}):notes.push(l);});
  return {mix,notes,text:t};}
function mehlTxt(r,x){const {mix}=mehlOf(r); return g(x)+' g Mehl'+(mix.length?' ('+mix.map(k=>g(x*k.p/100)+' g '+k.n).join(', ')+')':'');}
/* Teigführung pro Event umschalten: gleiches Rezept (Wasser, Salz, Teigling), andere Führung */
const DEF_DAUER={direkt:10,kuehl:24,poolish:16,biga:24};
const KURZ={direkt:'Direkt, ohne Vorteig',kuehl:'Kaltführung',poolish:'Mit Poolish',biga:'Mit Biga'};
function eff(r,o){
  const m=o&&o.methode; if(!r||!m||m===r.methode) return r;
  const x={...r,methode:m,dauer:DEF_DAUER[m]};
  for(const k of ['txt','vtHefe','htHefe','stockMin','stueckMin','knetMin','wasserVT','wasserHT','parkStd','bigaHyd','hefeProLiter','dauerRange','hefeFix','autolyseMin','stockKuehlH','akklMin','hefeArt','dauerMin','aktivMin','ballNachKuehl','stockRtMin','stdAnzahl','optFaltenMin']) delete x[k];
  if(m==='biga'){x.bigaKalt=true; x.anteil=40;}
  return x;
}
/* ---------- Rechnen: Mengen und Zeitachse rückwärts ---------- */
function plan(r,o){
  const n=o.anzahl||3, raum=o.raumtemp??21, masch=!!(o.maschine??r.maschine);
  const D=Number(o.dauer)||r.dauer;
  const E=o.essen?new Date(o.essen):new Date();
  const B=add(E,-3), ofen=add(B,-45), knet=r.knetMin||(masch?12:18);
  const steps=[]; let hefePct, pf=null, ziel=24, info; const T=r.txt||{};
  const ball=`${n} Teiglinge à ${g(r.ballen)} g abstechen und rund schleifen, bis die Oberfläche gespannt ist.`;

  if(r.methode==='direkt'){
    const stock=2, stueck=Math.max(D-stock,1);
    const tB=add(B,-stueck*60), tS=add(tB,-stock*60), tK=add(tS,-knet);
    hefePct=interp(DIREKT_HEFE,stock+stueck)*tf(raum);
    if(r.hefeProLiter) hefePct=Math.min(Math.max(hefePct,r.hefeProLiter[0]*r.hyd/1000),r.hefeProLiter[1]*r.hyd/1000);
    info=`Direkt bei Raumtemperatur, ${g(D)} h Gehzeit`;
    steps.push({k:'kneten',t:tK,min:knet,ttl:'Teig kneten'},
      {k:'stock',t:tS,min:stock*60,ttl:'Stockgare',d:T.stock||['Teig im Ganzen in eine Schüssel, abdecken, bei Raumtemperatur stehen lassen.']},
      {k:'ballen',t:tB,min:stueck*60,ttl:'Teiglinge formen',d:[ball].concat(T.ballen||['In die Teigbox, abgedeckt, bei Raumtemperatur reifen lassen.','Reif, wenn die Teiglinge luftig und weich sind und ein Fingerdruck langsam zurückfedert.'])});
  } else if(r.methode==='kuehl'&&r.ballNachKuehl){
    const akk=r.akklMin||120, rt=r.stockRtMin||90, akt=r.aktivMin||0, out=add(B,-akk), tF=add(out,-D*60), tS=add(tF,-rt), tK=add(tS,-knet);
    hefePct=r.hefeFix??interp(KUEHL_HEFE,D); ziel=22;
    info=`Kaltführung, ${g(D)} h im Ganzen im Kühlschrank, portioniert wird erst danach`;
    if(akt) steps.push({k:'aktiv',t:add(tK,-akt),min:akt,ttl:'Hefe ansetzen'});
    steps.push({k:'kneten',t:tK,min:knet,ttl:'Teig kneten'},
      {k:'stock',t:tS,min:rt,ttl:'Teig gehen lassen',d:T.stock||['Teig im Ganzen, abgedeckt, bei Raumtemperatur gehen lassen.']},
      {k:'kuehl',t:tF,min:D*60,ttl:'Teig in den Kühlschrank',d:T.kuehl||['Schüssel zugedeckt in den Kühlschrank stellen.']},
      {k:'ballen',t:out,min:akk,ttl:'Aus dem Kühlschrank, sofort portionieren',d:[`Teig aus dem Kühlschrank nehmen und sofort in ${n} Kugeln à ${g(r.ballen)} g portionieren.`].concat(T.ballen||['Zugedeckt bei Raumtemperatur akklimatisieren lassen.'])});
  } else if(r.methode==='kuehl'){
    const akk=r.akklMin||90, sk=r.stockKuehlH||0, aut=r.autolyseMin||0, out=add(B,-akk);
    const ballH=sk?Math.max(D-sk,4):D, stockMin=sk?sk*60:90;
    const tB=add(out,-ballH*60), tS=add(tB,-stockMin), tK=add(tS,-knet);
    hefePct=r.hefeFix??interp(KUEHL_HEFE,D); ziel=22;
    info=sk?`Kaltführung, ${g(sk)} h im Ganzen und ${g(ballH)} h als Teiglinge im Kühlschrank`:`Kaltführung, ${g(D)} h im Kühlschrank`;
    if(aut) steps.push({k:'autolyse',t:add(tK,-aut),min:aut,ttl:'Mehl und Wasser mischen (Autolyse)'});
    steps.push({k:'kneten',t:tK,min:knet,ttl:'Teig kneten'},
      {k:'stock',t:tS,min:stockMin,ttl:sk?'Teig im Ganzen in den Kühlschrank':'Stockgare',d:T.stock||['Teig im Ganzen, abgedeckt, bei Raumtemperatur stehen lassen.']},
      {k:'ballen',t:tB,min:ballH*60,ttl:'Teiglinge formen, ab in den Kühlschrank',d:[ball].concat(T.ballen||['In eine dicht schliessende Box legen und in den Kühlschrank stellen.'])},
      {k:'raus',t:out,min:akk,ttl:'Teiglinge aus dem Kühlschrank',d:T.raus||['Box geschlossen bei Raumtemperatur akklimatisieren lassen.','Reif, wenn ein Fingerdruck langsam zurückfedert. Springt er sofort zurück: 30–60 min länger warten.']});
  } else {
    const isP=r.methode==='poolish', nm=isP?'Poolish':'Biga';
    const falten=o.extraFalten?(r.optFaltenMin||0):0, sk=r.ballNachKuehl?(r.stockKuehlH||0):0;
    const stueck=r.stueckMin||180, stockMin=(r.stockMin||60)+falten, park=Math.max(0,Number(o.park??r.parkStd)||0)*60;
    const tPark=add(B,-park), tB=add(tPark,-stueck), tF=add(tB,-sk*60), tS=add(tF,-stockMin), tM=add(tS,-knet), tP=add(tM,-D*60);
    const pct=r.vtHefe??(isP?interp(POOLISH_HEFE,D)*tf(raum):(r.bigaKalt?1.0:Math.min(Math.max(1.0*tf(raum,17)*Math.pow(17/D,1.5),0.3),1.5)));
    pf={nm,isP,pct,anteil:(r.anteil||40)/100,fin:r.htHefe??0.1};
    hefePct=pct*pf.anteil+pf.fin;
    info=`${nm} ${g(D)} h, `+(sk?`${g(sk)} h im Ganzen im Kühlschrank, `:'')+`Teiglinge ${span(stueck)} bei Raumtemperatur`+(park?`, danach ${span(park)} im Kühlschrank`:'');
    steps.push({k:'vorteig',t:tP,min:D*60,ttl:nm+' ansetzen'},
      {k:'kneten',t:tM,min:knet,ttl:pf.anteil>=1?'Biga zum Teig kneten':'Hauptteig kneten'},
      {k:'stock',t:tS,min:stockMin,ttl:T.stock?'Dehnen, falten, ruhen lassen':'Stockgare',d:(T.stock||['Teig im Ganzen, abgedeckt, bei Raumtemperatur stehen lassen.']).concat(falten?[`Zusätzliche Runde für mehr Luftigkeit (${span(falten)}): nochmals zugedeckt ruhen lassen, dann dehnen, falten und rund schleifen.`]:[])},
      {k:'ballen',t:tB,min:stueck,ttl:sk?'Aus dem Kühlschrank, sofort portionieren':'Teiglinge formen',d:[sk?'Teig direkt aus dem Kühlschrank nehmen. '+ball:ball].concat(T.ballen||['In die Teigbox, abgedeckt, 3 h bei Raumtemperatur reifen lassen.','Reif, wenn die Teiglinge luftig sind und ein Fingerdruck langsam zurückfedert.'])});
    if(sk) steps.push({k:'kuehl',t:tF,min:sk*60,ttl:'Teig in den Kühlschrank',d:T.kuehl||['Teig im Ganzen zugedeckt in den Kühlschrank stellen.']});
    if(park) steps.push({k:'park',t:tPark,min:park,ttl:'Teiglinge in den Kühlschrank',d:['Die aufgegangenen Teiglinge im geschlossenen Behälter in den Kühlschrank stellen.','Zum Backen direkt aus dem Kühlschrank zu Pizza formen, nicht akklimatisieren.']});
  }

  const zus=r.zusatz||[];
  const proz=1+(r.hyd+r.salz+r.oel+r.zucker+hefePct+zus.reduce((a,z)=>a+z[1],0))/100;
  const total=n*r.ballen*(1+(r.reserve??2)/100), mehl=total/proz, wasser=mehl*r.hyd/100;
  const m={total,mehl,wasser,salz:mehl*r.salz/100,oel:mehl*r.oel/100,zucker:mehl*r.zucker/100,hefe:mehl*hefePct/100,hefePct,zusatz:zus.map(z=>[z[0],mehl*z[1]/100])};
  const HT=h=>r.hefeArt==='trocken'?g(h,1)+' g Trockenhefe':hefeTxt(h);
  const wtemp=Math.min(Math.max(3*ziel-2*raum-(masch?12:4),4),35);
  const knetTxt=masch?'In der Küchenmaschine 10–12 min kneten, bis der Teig glatt und elastisch ist.':'Von Hand 15–20 min kneten und falten, bis der Teig glatt und elastisch ist.';
  const extra=[]; if(m.oel) extra.push(oelA(r,m.oel)+' Olivenöl'); if(m.zucker) extra.push(zuA(r,m.zucker)+' Zucker'); m.zusatz.forEach(z=>extra.push(g(z[1])+' g '+z[0]));

  if(pf){
    pf.mehl=mehl*pf.anteil; pf.wasser=pf.mehl*(pf.isP?1:(r.bigaHyd||45)/100); pf.hefe=pf.mehl*pf.pct/100;
    pf.hMehl=mehl-pf.mehl; pf.hWasser=wasser-pf.wasser; pf.hHefe=mehl*pf.fin/100;
    const v=steps.find(s=>s.k==='vorteig');
    v.d=[`${mehlTxt(r,pf.mehl)}, ${g(pf.wasser)} g ${r.wasserVT||'Wasser'}, ${HT(pf.hefe)}.`].concat(T.vorteig?T.vorteig:pf.isP?
      ['Hefe im Wasser lösen, Mehl einrühren, bis keine trockenen Stellen bleiben.','Abdecken, aber nicht luftdicht. Bei 18–21 °C stehen lassen.','Reif, wenn die Oberfläche gewölbt und voller Blasen ist und in der Mitte gerade leicht einfällt.']:
      ['Hefe im Wasser lösen, mit dem Mehl nur grob mischen. Die Biga bleibt krümelig, nicht glatt kneten.',
       r.bigaKalt?'1–2 h bei Raumtemperatur anspringen lassen, dann abgedeckt in den Kühlschrank.':'Abgedeckt bei 16–18 °C reifen lassen.',
       'Reif, wenn sich das Volumen verdoppelt bis verdreifacht hat und sie innen schwammartig ist.']);
    const zut=[pf.hMehl>0.5?mehlTxt(r,pf.hMehl):'', g(pf.hWasser)+' g '+(r.wasserHT||`Wasser (ca. ${g(wtemp)} °C)`), g(m.salz,1)+' g Salz', ...extra, pf.hHefe>0.005?HT(pf.hHefe):''].filter(Boolean).join(', ')+'.';
    steps.find(s=>s.k==='kneten').d=[zut].concat(T.kneten||[
      pf.isP?'Poolish mit dem Wasser verrühren, dann Mehl, Hefe und zuletzt Salz zugeben.':
        (r.bigaKalt?'Biga direkt aus dem Kühlschrank in Stücken ins Wasser geben und 1–2 min aufweichen. Nicht vorher akklimatisieren.':'Biga in Stücken ins Wasser geben und 1–2 min aufweichen.')+' Dann Mehl, Hefe, Salz'+(m.oel?' und Öl':'')+' zugeben.',
      knetTxt, r.bigaKalt&&!pf.isP?'Teigtemperatur messen: Der Teig soll nicht über 24 °C gehen.':'Zielteigtemperatur 23–25 °C.']);
  } else if(r.ballNachKuehl){
    const w1=wasser/3, ak=steps.find(s=>s.k==='aktiv');
    if(ak) ak.d=[`${g(w1)} g Wasser (rund ein Drittel), ${HT(m.hefe)}${m.zucker?', '+zuA(r,m.zucker)+' Zucker':''}.`].concat(T.aktiv||['Hefe im Wasser auflösen und warten, bis sie Aktivität zeigt.']);
    steps.find(s=>s.k==='kneten').d=[[mehlTxt(r,mehl), ...m.zusatz.map(z=>g(z[1])+' g '+z[0]), m.oel?oelA(r,m.oel)+' Olivenöl':'', g(ak?wasser-w1:wasser)+' g '+(ak?'restliches Wasser':'Wasser'), g(m.salz,1)+' g Salz', ak?'':HT(m.hefe)].filter(Boolean).join(', ')+'.'].concat(T.kneten||[knetTxt]);
  } else if(r.autolyseMin&&steps.some(s=>s.k==='autolyse')){
    steps.find(s=>s.k==='autolyse').d=[`${mehlTxt(r,mehl)}, ${g(wasser)} g ${r.wasserHT||'Wasser'}.`].concat(T.autolyse||['Mehl und Wasser grob vermengen und abgedeckt ruhen lassen.']);
    steps.find(s=>s.k==='kneten').d=[`${HT(m.hefe)}, ${g(m.salz,1)} g Salz${extra.length?', '+extra.join(', '):''}.`].concat(T.kneten||[knetTxt]);
  } else {
    steps.find(s=>s.k==='kneten').d=[
      `${mehlTxt(r,mehl)}, ${g(wasser)} g Wasser (ca. ${g(wtemp)} °C), ${g(m.salz,1)} g Salz${extra.length?', '+extra.join(', '):''}, ${HT(m.hefe)}.`].concat(T.kneten||[
      'Hefe im Wasser lösen, Mehl nach und nach einarbeiten, Salz nach etwa zwei Dritteln des Mehls zugeben'+(m.oel?', Öl zum Schluss':'')+'.',
      knetTxt, `Zielteigtemperatur ${ziel-1}–${ziel+1} °C.`]);
  }

  const letzte=add(B,n*(r.backMax+2));
  steps.push({k:'ofen',t:ofen,min:45,ttl:'Ofen einschalten',d:[`Oberhitze ${r.oben} °C, Unterhitze ${r.unten} °C.`,'Den Stein 45 min durchheizen, auch wenn die Anzeige früher fertig ist.','In der Zwischenzeit Belag vorbereiten: Mozzarella abtropfen, Tomaten passieren, Schieber mit Semola bestäuben.']},
    {k:'backen',t:B,min:n*(r.backMax+2),ttl:'Erste Pizza in den Ofen',d:[r.formen,'Erst belegen, wenn der Ofen heiss ist. Belegt höchstens 1–2 min auf dem Schieber liegen lassen.',`Backzeit ${r.backMin}–${r.backMax} min pro Pizza, zwischen zwei Pizzen 1–2 min warten.`,`Die letzte von ${n} Pizzen ist etwa um ${hm(letzte)} fertig.`].filter(Boolean)});
  steps.sort((a,b)=>a.t-b.t);

  const warn=[];
  const nachts=steps.filter(s=>s.t.getHours()>=23||s.t.getHours()<6);
  if(nachts.length) warn.push(`«${nachts[0].ttl}» fällt auf ${hm(nachts[0].t)} Uhr, also mitten in der Nacht.`);
  if(o.essen&&steps[0].t<new Date()&&E>new Date()) warn.push(`Der Start liegt ${span((new Date()-steps[0].t)/60000)} in der Vergangenheit.`);
  if(r.dauerMin&&D<r.dauerMin) warn.push(`Das Rezept verlangt mindestens ${r.dauerMin} Stunden im Kühlschrank. Mit ${g(D)} Stunden weichst du davon ab.`);
  if(r.dauerRange&&(D<r.dauerRange[0]||D>r.dauerRange[1])) warn.push(`Das Originalrezept sieht ${r.dauerRange[0]}–${r.dauerRange[1]} Stunden Gare vor. Mit ${g(D)} Stunden weichst du davon ab.`);
  if(pf&&pf.hWasser<0) warn.push('Die Hydration ist zu tief für diesen Vorteig-Anteil. Senke den Anteil im Rezept.');
  return {steps,m,pf,info,E,B,letzte,warn,n,nacht:nachts.length>0,past:!!(o.essen&&steps[0].t<new Date()&&E>new Date())};
}

/* ---------- Automatische Zeitvorschläge ---------- */
function vorschlaege(R,e){
  const p0=plan(R,e); if(!p0.nacht&&!p0.past) return [];
  const M=METHODEN[R.methode], vt=R.methode==='biga'||R.methode==='poolish';
  let lo=M.min, hi=M.max; if(R.dauerRange){lo=R.dauerRange[0]; hi=R.dauerRange[1];} if(R.stockKuehlH&&!vt) lo=Math.max(lo,R.stockKuehlH+4); if(R.dauerMin) lo=Math.max(lo,R.dauerMin);
  const cD=Number(e.dauer)||R.dauer, cP=Number(e.park??R.parkStd)||0, ok=[];
  for(let D=lo;D<=hi;D++) for(let P=0;P<=(vt?12:0);P++){
    if(D===cD&&P===cP) continue;
    const p=plan(R,{...e,dauer:D,park:P}); if(p.past||p.steps.some(s=>s.t.getHours()<7||s.t.getHours()>=22)) continue;
    ok.push({D,P,t:p.steps[0].t,ttl:p.steps[0].ttl,score:Math.abs(D-R.dauer)/R.dauer*10+P*0.4});
  }
  ok.sort((a,b)=>a.score-b.score);
  const pick=[], add1=c=>{if(c&&!pick.includes(c)&&pick.length<3) pick.push(c);};
  add1(ok.find(c=>c.D===R.dauer)); add1(ok.find(c=>c.P===0));
  add1(ok.find(c=>!pick.some(q=>Math.abs(q.t-c.t)<3*3600e3)));
  return pick.sort((a,b)=>a.score-b.score).map(c=>({...c,txt:`${M.dauerLbl} ${c.D} h${c.D===R.dauer?' wie im Rezept':''}`+(vt?(c.P?`, fertige Teiglinge ${c.P} h im Kühlschrank parken`:', ohne Parkzeit'):'')}));
}

/* ---------- Beläge und Einkaufsliste ---------- */
const BELAEGE=[
  {id:'margherita',name:'Margherita',z:[['Schältomaten',70,'g'],['Mozzarella oder Fior di Latte',90,'g'],['Basilikum',3,'Blätter'],['Olivenöl',7,'g']]},
  {id:'marinara',name:'Marinara',z:[['Schältomaten',90,'g'],['Knoblauch',1,'Zehen'],['Oregano',0,''],['Olivenöl',8,'g']]},
  {id:'diavola',name:'Diavola',z:[['Schältomaten',70,'g'],['Mozzarella oder Fior di Latte',80,'g'],['Scharfe Salami',40,'g'],['Olivenöl',5,'g']]},
  {id:'funghi',name:'Prosciutto e Funghi',z:[['Schältomaten',70,'g'],['Mozzarella oder Fior di Latte',80,'g'],['Kochschinken',40,'g'],['Champignons',50,'g']]},
  {id:'crudo',name:'Crudo e Rucola',z:[['Schältomaten',70,'g'],['Mozzarella oder Fior di Latte',80,'g'],['Rohschinken',40,'g'],['Rucola',20,'g'],['Parmesan',10,'g']]},
  {id:'bianca',name:'Pizza Bianca',z:[['Mozzarella oder Fior di Latte',100,'g'],['Parmesan',15,'g'],['Knoblauch',1,'Zehen'],['Olivenöl',10,'g'],['Rosmarin',0,''],['Mortadella (optional)',40,'g']]},
  {id:'formaggi',name:'Quattro Formaggi',z:[['Mozzarella oder Fior di Latte',60,'g'],['Gorgonzola',30,'g'],['Taleggio oder Fontina',30,'g'],['Parmesan',15,'g']]}
];
function belagOf(e){const b=e.shop&&e.shop.belag; return b?b:{margherita:e.anzahl};}
function einkauf(e,R){
  const p=plan(R,e), ml=mehlOf(R), teig=[];
  if(ml.mix.length) ml.mix.forEach(k=>teig.push([k.n,g(p.m.mehl*k.p/100)+' g'])); else teig.push(['Pizzamehl'+(ml.notes.length?' ('+ml.notes.join(', ')+')':''),g(p.m.mehl)+' g']);
  teig.push(['Salz',g(p.m.salz)+' g'],[hefeName(R),g(p.m.hefe,p.m.hefe<10?1:0)+' g']);
  p.m.zusatz.forEach(z=>teig.push([z[0].charAt(0).toUpperCase()+z[0].slice(1),g(z[1])+' g']));
  if(p.m.oel) teig.push(['Olivenöl für den Teig',oelA(R,p.m.oel)]); if(p.m.zucker) teig.push(['Zucker',zuA(R,p.m.zucker)]);
  teig.push(['Semola zum Formen','']);
  const sum=new Map(), b=belagOf(e);
  BELAEGE.forEach(B=>{const n=b[B.id]||0; if(!n) return; B.z.forEach(([nm,q,u])=>{const k=nm+'|'+u, o=sum.get(k)||{nm,u,q:0}; o.q+=q*n; sum.set(k,o);});});
  const ein={Zehen:'Zehe','Blätter':'Blatt'};
  const belag=[...sum.values()].map(o=>[o.nm,o.q?(g(o.q)+' '+(o.q===1&&ein[o.u]?ein[o.u]:o.u)):'nach Bedarf']);
  return {teig,belag,verteilt:Object.values(b).reduce((a,x)=>a+(x||0),0)};
}

/* ---------- Gästerechner ---------- */
function gastCalc(erw,kind){const a=Math.max(0,Number(erw)||0), k=Math.max(0,Number(kind)||0); if(!a&&!k) return null; const basis=Math.ceil(a+k*0.5); return {a,k,basis,n:basis+1};}
function gastTxt(erw,kind){const c=gastCalc(erw,kind); if(!c) return ''; const t=[]; if(c.a) t.push(c.a+(c.a===1?' Erwachsener':' Erwachsene')); if(c.k) t.push(c.k+(c.k===1?' Kind':' Kinder')); return `${t.join(' und ')}: ${c.basis} ${c.basis===1?'Pizza':'Pizzen'} plus 1 Reserve = ${c.n}.`;}

export {SEED, METHODEN, DIREKT_HEFE, KUEHL_HEFE, POOLISH_HEFE, TAGE, TAGE_LANG, BELAEGE, SEED_MEHL, DEF_DAUER, KURZ,
  p2, hm, dm, dayKey, g, add, toInput, interp, tf, hefeTxt, tl, oelA, zuA, hefeName, span,
  mehlOf, mehlTxt, eff, plan, vorschlaege, belagOf, einkauf, gastCalc, gastTxt};
