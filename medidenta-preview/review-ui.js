/* MediIdenta 0.6 – öffentlich gekennzeichnete REDAKTIONELLE ENTWÜRFE.
 * Keine klinische Freigabe, keine Therapie- oder Dosierungsanweisungen.
 * Review-Markierungen bleiben lokal; ohne Backend-Review keine Publikation. */
(function(global){
'use strict';
const TYPES={summary:'Kurzbeschreibung',indication:'Indikation',mechanism:'Wirkmechanismus',warning:'Warnhinweis',contraindication:'Kontraindikation',adverse_effect:'Nebenwirkung',interaction:'Wechselwirkung',renal:'Nierenfunktion',hepatic:'Leberfunktion',pregnancy:'Schwangerschaft',administration:'Anwendung',monitoring:'Überwachung',good_to_know:'Good-to-Know'};
const RISKS={critical:'Kritische Prüfpriorität',high:'Erhöhte Prüfpriorität',normal:'Allgemeine Prüfpriorität'};
const MARKS={open:'Noch nicht geprüft',checking:'In Prüfung',revise:'Überarbeitung notwendig',seen:'Persönlich gesichtet – keine klinische Freigabe'};
const riskRank={critical:0,high:1,normal:2};
const R={query:'',risk:'all',assignment:'all',page:0,marks:{},saveError:false};
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\u0027':'&#39;'}[c]));
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const https=x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='www.ema.europa.eu'?u.href:null;}catch{return null;}};
function readMarks(){try{const x=JSON.parse(localStorage.getItem('medidenta_review_marks_06')||'{}');if(x&&typeof x==='object'&&!Array.isArray(x))R.marks=x;}catch{R.marks={};}}
function saveMarks(){try{localStorage.setItem('medidenta_review_marks_06',JSON.stringify(R.marks));R.saveError=false;}catch{R.saveError=true;}}
function mark(f){const m=R.marks[f.id];return m&&typeof m==='object'?m:{};}
function notice(){return '<div class="notice danger"><strong>ACHTUNG: Alle Aussagen sind fachlich UNGEPRÜFTE Entwürfe.</strong> Quellen, Stand, Präparat und Darreichungsform müssen vor einer späteren Freigabe geprüft werden. Keine Anwendung für Medikamentengabe, Dosierungen oder Therapieentscheidungen.</div>';}
function ref(f){
 const r=f.reference||{},u=https(r.document_url);
 return '<div class="review-ref">'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Originalquelle bei der EMA öffnen ↗</a>':'Originalquelle nicht verfügbar')+
 '<div>'+esc(r.document_title||'Quellenangabe offen')+'</div>'+
 '<div>Abschnitt: '+esc(r.locator||'nicht angegeben')+'</div>'+
 (r.publication_date?'<div>Quellendatum: '+esc(r.publication_date)+'</div>':'')+
 (r.accessed_on?'<div>Abgerufen am: '+esc(r.accessed_on)+'</div>':'')+'</div>';
}
function card(f,editable){
 const m=mark(f),status=m.status&&Object.hasOwn(MARKS,m.status)?m.status:'open',risk=String(f.risk_level||'normal');
 return '<article class="clinical-draft '+(risk==='critical'?'draft-critical':risk==='high'?'draft-high':'')+'">'+
 '<div class="draft-head"><strong>'+esc(f.target_name)+' · '+esc(TYPES[f.fact_type]||f.fact_type)+'</strong><span class="tag amber">ENTWURF · ungeprüft</span></div>'+
 '<div class="draft-meta"><span class="tag '+(risk==='critical'?'red':risk==='high'?'amber':'gray')+'">'+esc(RISKS[risk]||risk)+'</span> '+
 '<span class="tag gray">'+esc(f.assignment_status==='unmatched'?'Zuordnung ungeklärt':f.target_type==='substance'?'Wirkstoffbezug':'Produktbezug')+'</span></div>'+
 '<p class="draft-text">'+esc(f.content_text)+'</p>'+
 (f.target_type==='substance'?'<p class="tiny muted">Wirkstoffbezogene Aussage: nicht automatisch für jede Präparatevariante übertragbar.</p>':'')+
 ref(f)+
 (editable?'<div class="review-fields"><label for="rm-'+esc(f.id)+'">Private Prüfmarkierung</label>'+
 '<select id="rm-'+esc(f.id)+'" data-review-mark="'+esc(f.id)+'">'+Object.entries(MARKS).map(([k,v])=>'<option value="'+k+'" '+(status===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>'+
 '<label for="rn-'+esc(f.id)+'">Eigene Prüfnotiz</label>'+
 '<textarea id="rn-'+esc(f.id)+'" data-review-note="'+esc(f.id)+'" rows="2" maxlength="3000" placeholder="Was muss an der Quelle nachgeprüft werden?">'+esc(m.note||'')+'</textarea></div>':'')+
 '<div class="tiny muted">Charge: '+esc(f.batch)+' · Datenbankstatus: draft · '+esc(f.id)+'</div></article>';
}
function linked(D,p){return (D.drafts||[]).filter(f=>Array.isArray(f.linked_product_ids)&&f.linked_product_ids.includes(p.id)).sort((a,b)=>(riskRank[a.risk_level]??3)-(riskRank[b.risk_level]??3));}
function details(D,p){
 const a=linked(D,p);
 return '<section class="card draft-section"><h2>Fachinformationen – Entwurfsansicht</h2>'+notice()+
 '<p class="small muted">'+a.length+' exakt zugeordnete redaktionelle Aussagen. Dies ist keine freigegebene Fachinformation.</p>'+
 (a.length?a.map(f=>card(f,false)).join(''):'<p class="small muted">Hier sind noch keine Aussagen eindeutig zugeordnet.</p>')+
 '<button class="secondary full spaced" data-nav="knowledge">Alle Fachtexte prüfen</button></section>';
}
function filtered(D){
 const q=norm(R.query);
 return (D.drafts||[]).filter(f=>(R.risk==='all'||R.risk===f.risk_level)&&
 (R.assignment==='all'||(R.assignment==='unmatched'?(f.assignment_status==='unmatched'):(f.assignment_status!=='unmatched')))&&
 (!q||norm([f.target_name,f.fact_type,f.content_text,f.reference?.document_title,f.id].join(' ')).includes(q)))
 .slice().sort((a,b)=>(riskRank[a.risk_level]??3)-(riskRank[b.risk_level]??3)||String(a.target_name).localeCompare(String(b.target_name),'de'));
}
function option(k,v,current){return '<option value="'+k+'" '+(current===k?'selected':'')+'>'+esc(v)+'</option>';}
function knowledge(D){
 const all=filtered(D),size=12,pages=Math.max(1,Math.ceil(all.length/size));R.page=Math.min(Math.max(0,R.page),pages-1);
 const list=all.slice(R.page*size,(R.page+1)*size);
 const unassigned=(D.drafts||[]).filter(f=>f.assignment_status==='unmatched').length;
 return '<div class="eyebrow">MediIdenta · Redaktionsansicht</div><h1>Fachinformationen prüfen</h1>'+notice()+
 '<div class="stats"><div class="stat"><strong>'+D.drafts.length+'</strong><span>Fachtextentwürfe (0 freigegeben)</span></div>'+
 '<div class="stat"><strong>'+unassigned+'</strong><span>Zuordnung noch offen</span></div></div>'+
 '<section class="card"><label class="search-label" for="clinical-search">Suche nach Präparat, Wirkstoff oder Text</label>'+
 '<input id="clinical-search" class="search-input" value="'+esc(R.query)+'" placeholder="z. B. Toujeo, Wechselwirkung …">'+
 '<div class="draft-filters"><label>Prüfpriorität<select id="clinical-risk" class="search-input">'+
 option('all','Alle Prioritäten',R.risk)+Object.entries(RISKS).map(([k,v])=>option(k,v,R.risk)).join('')+'</select></label>'+
 '<label>Zuordnung<select id="clinical-assignment" class="search-input">'+
 option('all','Alle Einträge',R.assignment)+option('matched','Produktbezug vorhanden',R.assignment)+option('unmatched','Nicht zugeordnet ('+unassigned+')',R.assignment)+'</select></label></div>'+
 '<p class="small muted">'+all.length+' Treffer · Seite '+(R.page+1)+' von '+pages+'. Alle Angaben sind Entwürfe.</p>'+
 '<button class="secondary full" data-review-action="export">Prüfnotizen als JSON exportieren</button>'+
 '<p class="tiny muted">Markierungen bleiben nur auf diesem Gerät. Keine automatische Übertragung an GitHub und keine fachliche Freigabe.</p>'+
 (R.saveError?'<p class="notice warning">Notizen konnten nicht dauerhaft gespeichert werden. Bitte exportieren.</p>':'')+'</section>'+
 (D.draftLoadError?'<div class="notice danger">Fachtextdatei nicht geladen. Eine vollständige Prüfung ist derzeit nicht möglich.</div>':'')+
 (list.length?list.map(f=>card(f,true)).join(''):'<div class="empty">Keine passenden Entwürfe.</div>')+
 '<div class="row draft-pager"><button class="secondary" data-review-action="prev" '+(R.page===0?'disabled':'')+'>← Zurück</button>'+
 '<span class="small muted">'+(R.page+1)+' / '+pages+'</span>'+
 '<button class="secondary" data-review-action="next" '+(R.page===pages-1?'disabled':'')+'>Weiter →</button></div>';
}
function quality(D){
 const a=D.drafts||[],unassigned=a.filter(f=>f.assignment_status==='unmatched').length;
 return '<section class="card"><h2>Redaktioneller Datenbestand</h2><div class="stats">'+
 '<div class="stat"><strong>'+a.length+'</strong><span>Öffentlich sichtbare Fachtextentwürfe</span></div>'+
 '<div class="stat"><strong>'+unassigned+'</strong><span>Zuordnung offen</span></div></div>'+
 '<p class="small muted">Redaktionschargen: 45 ältere Fachtexte, 47 v0.8-Entwürfe, 86 zusätzliche EMA-Entwürfe. Keine Aussage ist klinisch freigegeben.</p>'+
 '<button class="secondary full" data-nav="knowledge">Entwürfe jetzt prüfen</button></section>';
}
function exportMarks(D){
 const entries=(D.drafts||[]).map(f=>({fact_id:f.id,target_name:f.target_name,source_url:f.reference?.document_url||null,decision:mark(f).status||'open',note:mark(f).note||''}));
 const payload={format:'medidenta-personal-review-v1',notice:'Private lokale Prüfliste. Kein klinischer Freigabenachweis.',clinical_release_ready:false,generated_at:new Date().toISOString(),entries};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='medidenta-fachtext-pruefnotizen.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function configure(D,draw){
 readMarks();
 let searchTimer;
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-review-action]');if(!b)return;
  if(b.dataset.reviewAction==='prev')R.page=Math.max(0,R.page-1);
  else if(b.dataset.reviewAction==='next')R.page++;
  else if(b.dataset.reviewAction==='export'){exportMarks(D);return;}
  draw();
 });
 document.addEventListener('input',e=>{
  if(e.target.id!=='clinical-search')return;
  R.query=e.target.value;R.page=0;const pos=e.target.selectionStart;
  clearTimeout(searchTimer);searchTimer=setTimeout(()=>{
   draw();const input=document.querySelector('#clinical-search');
   if(input){input.focus();try{input.setSelectionRange(pos,pos);}catch{}}
  },260);
 });
 document.addEventListener('change',e=>{
  if(e.target.id==='clinical-risk'){R.risk=e.target.value;R.page=0;draw();return;}
  if(e.target.id==='clinical-assignment'){R.assignment=e.target.value;R.page=0;draw();return;}
  const id=e.target.dataset.reviewMark||e.target.dataset.reviewNote;
  if(!id||!D.drafts.some(f=>f.id===id))return;
  const prior=mark({id});
  if(e.target.dataset.reviewMark){
   if(!Object.hasOwn(MARKS,e.target.value))return;
   R.marks[id]={...prior,status:e.target.value,updated_at:new Date().toISOString()};
  }else R.marks[id]={...prior,note:e.target.value.slice(0,3000),updated_at:new Date().toISOString()};
  saveMarks();if(e.target.dataset.reviewMark)draw();
 });
}
global.MediIdentaReviewUI={details,knowledge,quality,configure};
})(window);
