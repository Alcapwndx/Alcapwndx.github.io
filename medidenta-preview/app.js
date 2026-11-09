/* MediIdenta Alpha v0.9 – eigene MediIdenta-API / Identity-Snapshot.
   Keine Fotos, PZN oder Fachtexte ohne explizite Backend-Freigabe als identifiziert darstellen. */
'use strict';
/* Live-Supabase mode is detected from the server-provided public config. */
const IS_PUBLIC_PREVIEW=window.MEDIIDENTA_AUTH_CONFIG?.reviewApiBase!=='/api/v1';
const root=document.querySelector('#screen'),bar=document.querySelector('#system-status'),picker=document.querySelector('#photo-picker');
const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trim=x=>String(x==null?'':x).trim();
const normalize=x=>trim(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const safeUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:null}catch{return null}};
const D={page:'home',connected:false,meta:null,offline:[],hits:[],search:'',detail:null,photo:null,photoName:'',scanMessage:'',scanMatches:[],loading:false,seq:0,identifierSystem:'PZN8',compare:[],compareDetails:{},attributions:[],drafts:[],approved:[],draftLoadError:false,syncMeta:null,syncBusy:false,syncMessage:'',catalogRevision:null,draftRevision:null};
try{D.favorites=JSON.parse(localStorage.getItem('medidenta_favs_v04')||'[]');if(!Array.isArray(D.favorites))D.favorites=[];}catch{D.favorites=[]}
const api=async path=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),5000);try{const r=await fetch('/api/v1'+path,{signal:c.signal,cache:'no-store',headers:{Accept:'application/json'}});const data=await r.json();if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;}finally{clearTimeout(t)}};
function clinicalNotice(){return '<div class="notice warning"><strong>Entwicklungsstand – keine klinische Einsatzfreigabe der App.</strong> Einzelne Fachtextaussagen können nach persönlicher Kontrolle fachlich freigegeben sein, nicht jedoch automatisch ganze Präparate oder Dosierungen. Aktuelle Originalquellen und Anordnungen bleiben maßgeblich.</div>'}
function status(){
 const p=D.offline.length,c=D.approved.length;
 if(IS_PUBLIC_PREVIEW){
  bar.className='system-status offline';
  bar.textContent='● ALPHA · Statischer Testbestand · '+p+' Identitäten · '+c+' validierte Einzeltexte · keine Live-API';
  return;
 }
 bar.className='system-status'+(D.connected?'':' offline');
 bar.textContent=D.connected?'● ALPHA · Live-Datenbank verbunden · '+p+' Identitäten · '+c+' validierte Einzeltexte':
  '● ALPHA · Verbindung derzeit nicht verfügbar · zuletzt geladener Datenstand';
}
function title(s){return '<div class="eyebrow">MediIdenta · Fachkreiskatalog</div><h1>'+escapeHtml(s)+'</h1>'}
function badge(s,cls){return '<span class="tag '+(cls||'')+'">'+escapeHtml(s)+'</span>'}
function fav(id){return '<button class="fav '+(D.favorites.includes(id)?'on':'')+'" data-action="fav" data-id="'+escapeHtml(id)+'" aria-label="Favorit">'+(D.favorites.includes(id)?'★':'☆')+'</button>'}
function row(p){const subs=Array.isArray(p.substances)?p.substances.map(s=>s.name).join(', '):p.substances||'';return '<article class="card"><div class="row"><button class="med-button grow" data-action="detail" data-id="'+escapeHtml(p.id)+'"><span class="round-icon">✚</span><span class="grow"><span class="med-title">'+escapeHtml(p.name)+'</span><span class="med-sub">'+escapeHtml(subs||'Keine Wirkstoffangabe')+'</span>'+badge(p.country_code||'EU','gray')+'</span></button>'+fav(p.id)+'<button class="compare-toggle '+(D.compare.includes(p.id)?'on':'')+'" data-action="compare" data-id="'+escapeHtml(p.id)+'" aria-pressed="'+D.compare.includes(p.id)+'" title="Für den Vergleich markieren">⇄</button></div></article>'}
function home(){return '<div class="hero"><div class="eyebrow">FÜR PFLEGE · MEDIZIN · APOTHEKE</div><h1>Arzneimittel schneller finden.</h1><p>Die eigene MediIdenta-Datenbank. Quellenbezogen. Transparent.</p><button class="hero-search" data-nav="search">⌕ &nbsp; Handelsname oder Wirkstoff suchen …</button></div><div class="grid2 spaced"><button class="tile" data-nav="scan"><span class="symbol">▣</span><strong>Identifikation</strong><small>Packungscode prüfen · Kamera bald verfügbar</small></button><button class="tile" data-nav="knowledge"><span class="symbol">◈</span><strong>Fachinformationen</strong><small>Quellenbasierte Informationen entdecken</small></button></div><div class="section-title"><h2>Aus dem Katalog</h2><button data-nav="search">Alle suchen →</button></div><p class="small muted">'+D.offline.length+' Produktidentitäten im aktuellen Katalog</p>'+D.offline.slice(0,3).map(row).join('')+clinicalNotice();}
function searchHtml(){const xs=D.hits;return title('Medikamente suchen')+'<label for="search" class="search-label">Wirkstoff oder Handelsname</label><input id="search" class="search-input" type="search" value="'+escapeHtml(D.search)+'" placeholder="z. B. Toujeo, Ozempic, Apixaban"><div class="filters"><button class="filter" data-filter="all">Alle Treffer</button><button class="filter" data-filter="fav">★ Favoriten</button></div><div class="small muted">'+(D.loading?'Suche läuft …':xs.length+' Treffer · '+(D.connected?'Live-API':'Offline-Snapshot'))+'</div><div id="hits">'+xs.map(row).join('')+'</div>'+(D.compare.length?'<div class="compare-tray"><strong>⇄ '+D.compare.length+'/2 ausgewählt</strong><div class="row"><button class="secondary" data-action="compare-clear">Löschen</button><button class="primary" data-action="compare-view" '+(D.compare.length!==2?'disabled':'')+'>Vergleichen</button></div></div>':'')+(!xs.length?'<div class="empty">Kein Treffer. Keine alternative Arzneimittelidentität ableitbar.</div>':'')+clinicalNotice();}
function factsHtml(facts){return facts.length?facts.map(f=>'<div class="fact"><strong>'+escapeHtml(f.fact_type||'Fachinformation')+'</strong><p>'+escapeHtml(f.content_text||'')+'</p>'+((f.references||[]).map(r=>{const u=safeUrl(r.document_url);return u?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(u)+'">'+escapeHtml(r.document_title||'Originalquelle')+'</a>':''}).join(''))+'</div>').join(''):'<div class="notice warning">Noch keine medizinisch freigegebenen Fachtexte verfügbar. Die noch ungeprüften redaktionellen Entwürfe stehen darunter separat gekennzeichnet.</div>'}
function detailHtml(){const p=D.detail;if(!p)return title('Lade Produkt …');const subst=Array.isArray(p.substances)?p.substances.map(x=>x.name).join(', '):p.substances||'–';const src=p.source||{};const sourceLink=safeUrl(src.url);const facts=Array.isArray(p.facts)?p.facts:[],photos=Array.isArray(p.photos)?p.photos:[],presentations=Array.isArray(p.presentations)?p.presentations:[];return '<button class="back" data-nav="search">← Zur Suche</button>'+title(p.name)+'<p class="detail-sub">'+escapeHtml(subst)+'</p>'+badge('Produktidentität hinterlegt')+' '+badge('Alpha · Testbestand','amber')+'<section class="card"><h2>Produktdetails</h2><div class="detail-list"><div><span>Marktgebiet</span><strong>'+escapeHtml(p.country_code||'–')+'</strong></div><div><span>Zulassung laut Quelle</span><strong>'+escapeHtml(p.marketing_status||'unknown')+'</strong></div><div><span>Zulassungsinhaber</span><strong>'+escapeHtml(p.marketing_holder||'Nicht hinterlegt')+'</strong></div><div><span>Letzte Datenänderung</span><strong>'+escapeHtml(p.updated_at||'Nicht hinterlegt')+'</strong></div></div><div class="notice warning">EU-Zulassung belegt weder aktuelle deutsche Marktverfügbarkeit noch Stärke oder Packungsgröße.</div></section><section class="card"><h2>Originalbilder</h2>'+(photos.length?photos.map(photo=>{const u=safeUrl(photo.media_url);return u?'<img alt="Freigegebenes Präparatebild" loading="lazy" style="width:100%;border-radius:12px" src="'+escapeHtml(u)+'">':'<p>Bilddatei nicht abrufbar.</p>'}).join(''):'<div class="photo-box">▧<br>Kein freigegebenes Originalbild vorhanden</div>')+'</section><section class="card"><h2>Darreichungsformen und Stärken</h2>'+(presentations.length?presentations.map(x=>'<p>'+escapeHtml([x.dosage_form,x.strength_label,x.administration_route].filter(Boolean).join(' · '))+'</p>').join(''):'<p class="muted small">Noch keine präparatespezifisch geprüften Angaben.</p>')+'</section><section class="card"><h2>Fachinformationen & Good-to-Know</h2><div class="facts">'+factsHtml(facts)+'</div></section>'+(window.MediIdentaReviewUI?.details(D,p)||'')+'<section class="card"><h2>Datenquelle</h2><p class="small">'+escapeHtml(src.name||p.source_name||'Nicht hinterlegt')+'</p><p class="tiny muted">'+escapeHtml(src.license||p.license||'')+'</p>'+(sourceLink?'<p><a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(sourceLink)+'">Offizielle Quelle ansehen ↗</a></p>':'')+'</section>'+clinicalNotice();}
function compareHtml(){
 const xs=D.compare.map(id=>D.compareDetails[id]||D.offline.find(p=>p.id===id)).filter(Boolean);
 const sub=p=>Array.isArray(p.substances)?p.substances.map(x=>x.name).join(', '):p.substances||'–';
 return '<button class="back" data-nav="search">← Zur Suche</button>'+title('Präparate vergleichen')+
 '<div class="notice danger"><strong>Keine Aussage über Austauschbarkeit.</strong> Gleiche Wirkstoffe oder ähnliche Namen belegen weder gleiche Stärke, Darreichungsform noch Austauschbarkeit.</div>'+
 '<div class="comparison">'+xs.map(p=>{
  const src=p.source||{},url=safeUrl(src.url||p.source_url);
  return '<section class="compare-card"><h2>'+escapeHtml(p.name)+'</h2>'+badge('Produktidentität')+
  '<dl><dt>Wirkstoffe</dt><dd>'+escapeHtml(sub(p))+'</dd>'+
  '<dt>Marktgebiet</dt><dd>'+escapeHtml(p.country_code||'–')+'</dd>'+
  '<dt>Zulassungsstatus</dt><dd>'+escapeHtml(p.marketing_status||'–')+'</dd>'+
  '<dt>Wirkstärke / Packungsgröße</dt><dd>Hier nicht bestätigt</dd>'+
  '<dt>Quelle</dt><dd>'+escapeHtml(src.name||p.source_name||'Nicht verfügbar')+'</dd></dl>'+
  (url?'<a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Quellenbeleg ansehen ↗</a>':'')+'</section>';
 }).join('')+'</div>'+clinicalNotice();
}
async function showCompare(){
 if(D.compare.length!==2)return;
 if(D.connected){
  const ids=[...D.compare];
  const results=await Promise.allSettled(ids.map(id=>api('/products/'+encodeURIComponent(id))));
  results.forEach((x,i)=>{if(x.status==='fulfilled')D.compareDetails[ids[i]]=x.value;});
 }
 D.page='compare';draw();document.documentElement.scrollTop=0;
}
function scanHtml(){
 return title('Medikament identifizieren')+
 '<div class="notice warning"><strong>Alpha-Funktion.</strong> Derzeit werden keine Packungen automatisch identifiziert. Die formale Prüfzifferprüfung ersetzt keine Produktidentifikation.</div>'+
 '<section class="card"><h2>Packungskennung prüfen</h2><p class="small muted">PZN oder GTIN manuell prüfen. Ohne geprüften Packungsdatenbestand können wir daraus keine Arzneimittelidentität ableiten.</p>'+
 '<label class="search-label" for="code-system">Kennungstyp</label><select id="code-system" class="search-input"><option value="PZN8" '+(D.identifierSystem==='PZN8'?'selected':'')+'>PZN (8 Stellen)</option><option value="GTIN" '+(D.identifierSystem==='GTIN'?'selected':'')+'>GTIN (8, 12, 13 oder 14 Stellen)</option></select>'+
 '<label class="search-label spaced" for="pzn">Kennung der Verpackung</label><input id="pzn" class="search-input" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="Kennung eingeben">'+
 '<button class="primary full spaced" data-action="pzn">Kennung prüfen</button>'+
 (D.scanMessage?'<div class="notice warning">'+escapeHtml(D.scanMessage)+'</div>':'')+
 D.scanMatches.map(x=>'<div class="fact"><strong>'+escapeHtml(x.name||'Packungstreffer')+'</strong><button class="secondary" data-action="detail" data-id="'+escapeHtml(x.id)+'">Eintrag öffnen</button></div>').join('')+'</section>'+
 '<section class="coming-soon"><h2>Barcode-Scanner '+badge('SOON','soon')+'</h2><p>Die Kamerafunktion folgt, sobald die Erkennung und der Abgleich mit verifizierten Packungsdaten ausreichend getestet sind.</p><button class="secondary" disabled aria-disabled="true">▣ Barcode scannen · demnächst</button></section>'+
 '<section class="coming-soon"><h2>Tablette fotografieren '+badge('SOON','soon')+'</h2><p>Fotoerkennung wird erst nach geeigneter Bilddatenbasis und Qualitätsprüfung freigeschaltet. Keine Identifikation anhand eines Fotos möglich.</p><button class="secondary" disabled aria-disabled="true">📷 Fotoerkennung · demnächst</button></section>'+
 clinicalNotice();
}
function knowledgeHtml(){return window.MediIdentaReviewUI?.knowledge(D)||title('Fachtextprüfung nicht verfügbar');}
function qualityHtml(){
 const m=D.meta||{};
 const lastImport=D.syncMeta?.last_catalog_import_at;
 const lastEma=D.syncMeta?.last_ema_check_at;
 const showDate=x=>{if(!x)return 'Noch nicht dokumentiert';const d=new Date(x);return Number.isNaN(+d)?'Nicht verfügbar':d.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});};
 const knownProducts=new Set(D.offline.map(p=>p.id));
 const reviewedProducts=new Set((D.approved||[]).flatMap(f=>f.linked_product_ids||[]).filter(id=>knownProducts.has(id)));
 const coverage=D.offline.length?Math.round(1000*reviewedProducts.size/D.offline.length)/10:0;
 const totalFacts=D.drafts.length+D.approved.length;
 return title('Datenqualität & Transparenz')+
 '<p class="small muted">Aktueller Datenbestand der kontrollierten öffentlichen Alpha-Phase. Validierung gilt für einzelne Textfassungen, nicht für die gesamte Anwendung oder das ganze Medikament.</p>'+
 '<div class="stats"><div class="stat"><strong>'+D.offline.length+'</strong><span>Produktidentitäten</span></div>'+
 '<div class="stat"><strong>'+D.approved.length+'</strong><span>Fachlich validierte Einzeltexte</span></div>'+
 '<div class="stat"><strong>'+D.drafts.length+'</strong><span>Nicht fachlich validierte Einzeltexte</span></div>'+
 '<div class="stat"><strong>'+escapeHtml(String(coverage).replace('.',','))+'%</strong><span>Medikamente mit mindestens einer validierten Aussage</span></div></div>'+
 '<section class="card"><h2>Datenherkunft</h2>'+
 '<p class="small"><strong>Live-Verbindung:</strong> '+escapeHtml(D.connected?'Supabase PostgreSQL':'Aktuell keine Live-Verbindung')+'</p>'+
 '<p class="small"><strong>Letzter Datenbankimport:</strong> <span class="quality-timestamp">'+escapeHtml(showDate(lastImport||(!D.connected?D.syncMeta?.source_date:null)))+'</span></p>'+
 '<p class="small"><strong>Letzter überprüfter EMA-Quellenabgleich:</strong> <span class="quality-timestamp">'+escapeHtml(showDate(lastEma))+'</span></p>'+
 '<p class="tiny muted">Datenbankimport und EMA-Quellenabgleich sind unterschiedliche Vorgänge. Ein erfolgreicher Import belegt keine erneute Prüfung der aktuellen EMA-Originalquelle. Solange ein Quellenabgleich nicht gesondert protokolliert wird, zeigen wir dafür kein erfundenes Datum.</p></section>'+
 '<section class="card"><h2>Weg von Alpha zu Beta</h2>'+
 '<p class="small">Eine Beta-Phase ist erst nach expliziter Freigabe vorgesehen, wenn die folgenden Bedingungen erfüllt sind:</p>'+
 '<ol class="phase-checks"><li>Ein ausreichend breiter, fachlich bewerteter Medikamentenkatalog ist verfügbar.</li>'+
 '<li>Für mindestens <strong>70 % der erfassten Medikamente</strong> liegt wenigstens eine individuell fachlich validierte Information vor. Der aktuelle Wert beträgt '+escapeHtml(String(coverage).replace('.',','))+' %.</li>'+
 '<li>Identifikationsfunktionen und dazugehörige Packungsinformationen sind mit belastbaren Quelldaten und Tests nutzbar.</li>'+
 '<li>Sicherheits-, Datenqualitäts- und Freigabeprüfungen für eine Beta sind bestanden.</li></ol>'+
 '<p class="tiny muted">Die 70-%-Marke allein löst keine automatische Beta-Umbenennung aus. Aktuelle Phase: ALPHA. '+totalFacts+' klinische Einzeltexte erfasst.</p></section>'+
 '<section class="card"><h2>Quellen und Transparenz</h2>'+
 (D.attributions.length?D.attributions.map(x=>'<div class="fact"><strong>'+escapeHtml(x.name||x.source_key)+'</strong><p class="tiny">Lizenz: '+escapeHtml(x.license_code||'Nicht angegeben')+'</p></div>').join(''):'<p class="small muted">Quellenliste nicht verfügbar.</p>')+
 '</section>'+clinicalNotice();
}
function draw(preserveFocus){let active=preserveFocus&&document.activeElement&&document.activeElement.id==='search';let pos=active?document.activeElement.selectionStart:null;root.innerHTML=({home:home,search:searchHtml,detail:detailHtml,compare:compareHtml,scan:scanHtml,knowledge:knowledgeHtml,quality:qualityHtml,account:()=>window.MediIdentaReviewAuth?.accountHtml()||title('Prüfkonto noch nicht verfügbar')}[D.page]||home)();document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.nav===D.page));status();if(D.photo&&document.querySelector('#photo'))document.querySelector('#photo').src=D.photo;if(active&&document.querySelector('#search')){let el=document.querySelector('#search');el.focus();try{el.setSelectionRange(pos,pos)}catch{}}}
function localSearch(q){if(trim(q).length<2)return D.offline.slice(0,50);const tokens=normalize(q).split(/\s+/).filter(Boolean);return D.offline.filter(x=>tokens.every(t=>normalize(x.name+' '+x.substances).includes(t))).slice(0,50)}
async function find(q){const n=++D.seq;D.loading=true;D.hits=localSearch(q);draw(true);if(D.connected&&trim(q).length>=2){try{const r=await api('/search?q='+encodeURIComponent(q)+'&limit=50');if(n!==D.seq)return;D.hits=(r.results||[]).map(x=>({id:x.id,name:x.name,substances:x.substances||'',country_code:x.country_code,marketing_status:x.marketing_status}));}catch{D.connected=false;D.hits=localSearch(q)}}if(n===D.seq){D.loading=false;draw(true)}}
async function openProduct(id){D.page='detail';D.detail=null;draw();const p=D.offline.find(x=>x.id===id);try{if(D.connected)D.detail=await api('/products/'+encodeURIComponent(id));else if(p)D.detail={...p,substances:trim(p.substances).split(', ').map(name=>({name})),facts:[],photos:[],presentations:[],source:{name:p.source_name,url:p.source_url,license:p.license}};else throw Error('Kein freigegebener Produktdatensatz');}catch{D.detail=p?{...p,substances:trim(p.substances).split(', ').map(name=>({name})),facts:[],photos:[],presentations:[],source:{name:p.source_name,url:p.source_url,license:p.license}}:null;}draw();}
function validPzn(x){return !!window.MediIdentaIdentifiers?.pzn8(x);}
async function identify(){
 window.MediIdentaIdentifiers?.stopCamera?.();
 const code=trim(document.querySelector('#pzn')?.value);
 const system=document.querySelector('#code-system')?.value||D.identifierSystem;
 if(!window.MediIdentaIdentifiers?.validate(system,code)){
  D.scanMessage='Ungültige '+(system==='PZN8'?'PZN':'GTIN')+' bzw. Prüfziffer. Keine Identifizierung möglich.';
  D.scanMatches=[];draw();return;
 }
 if(!D.connected){D.scanMessage='Keine Live-Verbindung. Ohne verifizierte Packungsdaten keine Identifizierung.';D.scanMatches=[];draw();return;}
 try{
  const data=await api('/identify/'+encodeURIComponent(system)+'/'+encodeURIComponent(code));
  D.scanMatches=Array.isArray(data.matches)?data.matches:[];
  D.scanMessage=D.scanMatches.length?'Datenbanktreffer vorhanden – Packung, Stärke und Präparat zusätzlich fachlich prüfen.':'Kein verifizierter Packungstreffer. Keine Identifizierung möglich.';
 }catch{D.scanMessage='Packungsabfrage fehlgeschlagen. Keine Identifizierung möglich.';D.scanMatches=[];}
 draw();
}
function go(where){window.MediIdentaIdentifiers?.stopCamera?.();D.page=where;D.scanMessage='';D.scanMatches=[];draw();document.documentElement.scrollTop=0;}
async function connect(){if(IS_PUBLIC_PREVIEW){D.connected=false;D.meta=null;D.attributions=[{source_key:'EU_UR',name:'European Commission – Union Register',license_code:'CC-BY-4.0',attribution_text:'Quellgebundene Produktidentitäten aus dem EU-Register.'},{source_key:'EMA_EPAR',name:'European Medicines Agency – EPAR',license_code:'EMA-REUSE-ATTRIBUTION',attribution_text:'Produktidentitäten und unabhängig formulierte Entwürfe mit EMA-Quellenverweisen.'}];draw();return;}try{D.meta=await api('/meta');D.connected=true;try{const x=await api('/attributions');D.attributions=Array.isArray(x.sources)?x.sources:[];}catch{D.attributions=[];}}catch{D.meta=null;D.connected=false;D.attributions=[];}if(D.page==='search')find(D.search);else draw();}
let debounce;
document.addEventListener('click',e=>{const b=e.target.closest('[data-nav],[data-action],[data-filter]');if(!b)return;if(b.dataset.nav){go(b.dataset.nav);return;}if(b.dataset.filter){D.hits=b.dataset.filter==='fav'?D.offline.filter(x=>D.favorites.includes(x.id)):localSearch(D.search);draw();return;}const a=b.dataset.action;if(a==='detail')openProduct(b.dataset.id);else if(a==='fav'){const id=b.dataset.id;D.favorites=D.favorites.includes(id)?D.favorites.filter(x=>x!==id):[id,...D.favorites];try{localStorage.setItem('medidenta_favs_v04',JSON.stringify(D.favorites))}catch{}draw();}else if(a==='compare'){const id=b.dataset.id;D.compare=D.compare.includes(id)?D.compare.filter(x=>x!==id):[...D.compare,id].slice(-2);draw();}else if(a==='compare-clear'){D.compare=[];D.compareDetails={};draw();}else if(a==='compare-view')showCompare();else if(a==='pzn')identify();else if(a==='photo')picker.click();else if(a==='reconnect')connect();else if(a==='sync-check')checkForCatalogUpdates(true);});
document.addEventListener('input',e=>{if(e.target.id!=='search')return;D.search=e.target.value;clearTimeout(debounce);debounce=setTimeout(()=>find(D.search),220)});
document.addEventListener('change',e=>{if(e.target.id==='code-system'){window.MediIdentaIdentifiers?.stopCamera?.();D.identifierSystem=e.target.value==='GTIN'?'GTIN':'PZN8';D.scanMessage='';D.scanMatches=[];draw();}});
picker.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f||!f.type.startsWith('image/')||f.size>8e6)return;if(D.photo)URL.revokeObjectURL(D.photo);D.photo=URL.createObjectURL(f);D.photoName=f.name;draw()});
async function checkForCatalogUpdates(force=false){
 if(D.syncBusy||document.hidden||document.activeElement?.matches?.('textarea[data-review-note]'))return;
 D.syncBusy=true;
 try{
  const res=await fetch('./sync_status.json',{cache:'no-store'});
  if(!res.ok)throw Error('Datenstand nicht erreichbar');
  const meta=await res.json();
  if(meta.format!=='medidenta-public-sync-v1'||meta.medical_release_ready!==false||!meta.source_commit)throw Error('Ungültiger Synchronisationsstatus');
  const unchanged=D.syncMeta?.source_commit===meta.source_commit;
  if(unchanged&&!force&&meta.mode!=='LIVE_SUPABASE'){D.syncBusy=false;return;}
  const [pr,dr]=await Promise.all([
   fetch('./catalog_snapshot.json',{cache:'no-store'}),
   fetch('./clinical_review_drafts.json',{cache:'no-store'})
  ]);
  if(!pr.ok||!dr.ok)throw Error('Die neuen Datendateien konnten nicht geladen werden');
  const [catalog,drafts]=await Promise.all([pr.json(),dr.json()]);
  if(catalog.format!=='medidenta-identity-only-v1'||catalog.clinical_release_ready!==false||
     drafts.format!=='medidenta-editorial-review-only-v1'||drafts.clinical_release_ready!==false||
     !Array.isArray(catalog.products)||!Array.isArray(drafts.facts)||
     (drafts.reviewed_facts_list!==undefined&&!Array.isArray(drafts.reviewed_facts_list))||
     meta.identity_count!==catalog.products.length||meta.draft_count!==drafts.facts.length||
     (meta.reviewed_count!==undefined&&meta.reviewed_count!==(drafts.reviewed_facts_list||[]).length)||
     catalog.products.length<1)throw Error('Datenstände stimmen nicht überein');
  const products=catalog.products.filter(x=>typeof x.id==='string'&&typeof x.name==='string');
  const facts=drafts.facts.filter(x=>x.editorial_status==='draft_unreviewed'&&Array.isArray(x.linked_product_ids)&&x.id&&x.target_name);
  const approved=(drafts.reviewed_facts_list||[]).filter(x=>x.editorial_status==='clinically_reviewed'&&Array.isArray(x.linked_product_ids)&&x.id&&x.target_name);
  if(products.length!==catalog.products.length||facts.length!==drafts.facts.length||approved.length!==(drafts.reviewed_facts_list||[]).length)throw Error('Unvollständige Einträge');
  if(catalog.source_commit&&catalog.source_commit!==meta.source_commit)throw Error('Unterschiedliche Katalogrevisionen');
  if(drafts.source_commit&&drafts.source_commit!==meta.source_commit)throw Error('Unterschiedliche Fachtextrevisionen');
  const ids=new Set(products.map(x=>x.id));
  if([...facts,...approved].some(x=>x.linked_product_ids.some(id=>!ids.has(id))))throw Error('Unbekannte Produktzuordnungen');
  if(new Set([...facts,...approved].map(x=>x.id)).size!==facts.length+approved.length)throw Error('Doppelte Redaktions-ID');
  D.offline=products;D.drafts=facts;D.approved=approved;D.syncMeta=meta;D.draftLoadError=false;D.catalogRevision=catalog.source_commit||null;D.draftRevision=drafts.source_commit||null;
  D.hits=localSearch(D.search);D.compareDetails={};
  if(D.page==='detail'&&D.detail){
   const p=D.offline.find(x=>x.id===D.detail.id);
   if(!p){D.page='search';D.detail=null;}
   else D.detail={...p,substances:trim(p.substances).split(', ').map(name=>({name})),facts:[],photos:[],presentations:[],
     source:{name:p.source_name,url:p.source_url,license:p.license}};
  }
  D.syncMessage=unchanged?'Keine neuen öffentlichen Daten gefunden.':'Aktualisierter Testkatalog erfolgreich geladen.';
 }catch(e){D.syncMessage='Aktualisierung nicht möglich: '+String(e.message||'Netzwerkfehler')+'. Vorheriger Datenstand bleibt sichtbar.';}
 finally{D.syncBusy=false;draw();}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForCatalogUpdates(false);});
setInterval(()=>{if(!document.hidden)checkForCatalogUpdates(false);},5*60*1000);
async function init(){try{const x=await (await fetch('./catalog_snapshot.json',{cache:'no-store'})).json();if(x.format!=='medidenta-identity-only-v1')throw Error('Unbekanntes Snapshot-Format');D.offline=(x.products||[]).filter(x=>x.id&&x.name);D.catalogRevision=x.source_commit||null;}catch{D.offline=Array.isArray(window.MEDIIDENTA_EMBEDDED_SNAPSHOT)?window.MEDIIDENTA_EMBEDDED_SNAPSHOT:[]}try{
  const response=await fetch('./clinical_review_drafts.json',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const file=await response.json();
  if(file.format!=='medidenta-editorial-review-only-v1'||file.clinical_release_ready!==false||!Array.isArray(file.facts))throw Error('Unexpected draft data');
  D.drafts=file.facts.filter(x=>x.editorial_status==='draft_unreviewed'&&Array.isArray(x.linked_product_ids)&&x.id&&x.target_name);D.approved=(file.reviewed_facts_list||[]).filter(x=>x.editorial_status==='clinically_reviewed'&&Array.isArray(x.linked_product_ids)&&x.id&&x.target_name);D.draftRevision=file.source_commit||null;
 }catch{D.draftLoadError=true;D.drafts=[];}
 try{const r=await fetch('./sync_status.json',{cache:'no-store'});if(r.ok){const x=await r.json();if(x.format==='medidenta-public-sync-v1'&&x.medical_release_ready===false)D.syncMeta=x;}}catch{}D.hits=D.offline.slice(0,50);draw();await connect();if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}
window.MediIdentaReviewUI?.configure(D,draw);
window.MediIdentaReviewAuth?.init(()=>D,()=>draw());
window.MediIdentaReloadCatalog=()=>checkForCatalogUpdates(true);
init();
