/* MediIdenta 0.6 – öffentlich gekennzeichnete REDAKTIONELLE ENTWÜRFE.
 * Keine klinische Freigabe, keine Therapie- oder Dosierungsanweisungen.
 * Review-Markierungen bleiben lokal; ohne Backend-Review keine Publikation. */
(function(global){
'use strict';
const TYPES={summary:'Kurzbeschreibung',indication:'Indikation',mechanism:'Wirkmechanismus',warning:'Warnhinweis',contraindication:'Kontraindikation',adverse_effect:'Nebenwirkung',interaction:'Wechselwirkung',renal:'Nierenfunktion',hepatic:'Leberfunktion',pregnancy:'Schwangerschaft',administration:'Anwendung',monitoring:'Überwachung',good_to_know:'Good-to-Know'};
const RISKS={critical:'Kritische Prüfpriorität',high:'Erhöhte Prüfpriorität',normal:'Allgemeine Prüfpriorität'};
const MARKS={open:'Noch nicht geprüft',checking:'In Prüfung',revise:'Überarbeitung notwendig',seen:'Persönlich gesichtet – keine klinische Freigabe'};
const riskRank={critical:0,high:1,normal:2};
const R={query:'',risk:'all',assignment:'all',reviewState:'all',page:0,marks:{},saveError:false};
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\u0027':'&#39;'}[c]));
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const https=x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='www.ema.europa.eu'?u.href:null;}catch{return null;}};
function readMarks(){try{const x=JSON.parse(localStorage.getItem('medidenta_review_marks_06')||'{}');if(x&&typeof x==='object'&&!Array.isArray(x))R.marks=x;}catch{R.marks={};}}
function saveMarks(){try{localStorage.setItem('medidenta_review_marks_06',JSON.stringify(R.marks));R.saveError=false;}catch{R.saveError=true;}}
function mark(f){const m=R.marks[f.id];return m&&typeof m==='object'?m:{};}
function notice(){return '<div class="notice warning"><strong>Wichtiger Hinweis zur Alpha:</strong> Nicht fachlich validierte Aussagen können veraltet, unvollständig oder fehlerhaft sein. Auch validierte Einzeltexte ersetzen weder Original-Fachinformation noch ärztliche Anordnung. Keine selbstständigen Therapie- oder Dosierungsentscheidungen auf Grundlage dieser Testanwendung.</div>';}
function ref(f){
 const r=f.reference||{},u=https(r.document_url);
 return '<div class="review-ref">'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Originalquelle bei der EMA öffnen ↗</a>':'Originalquelle nicht verfügbar')+
 '<div>'+esc(r.document_title||'Quellenangabe offen')+'</div>'+
 '<div>Abschnitt: '+esc(r.locator||'nicht angegeben')+'</div>'+
 (r.publication_date?'<div>Quellendatum: '+esc(r.publication_date)+'</div>':'')+
 (r.accessed_on?'<div>Abgerufen am: '+esc(r.accessed_on)+'</div>':'')+'</div>';
}
function card(f){
 const risk=String(f.risk_level||'normal'),approved=f.editorial_status==='clinically_reviewed';
 const status=approved?'Fachlich validiert':'Nicht fachlich validiert';
 const body='<article class="clinical-draft '+(risk==='critical'?'draft-critical':risk==='high'?'draft-high':'')+'">'+
 '<div class="draft-head"><strong>'+esc(f.target_name)+' · '+esc(TYPES[f.fact_type]||f.fact_type)+'</strong>'+
 '<span class="tag public-fact-status '+(approved?'reviewed-tag':'amber')+'">'+status+'</span></div>'+
 (f.assignment_status==='unmatched'?'<p class="tiny muted">Produktzuordnung derzeit noch ungeklärt.</p>':'')+
 '<p class="draft-text">'+esc(f.content_text)+'</p>'+
 '<details class="reference-disclosure"><summary>EMA-Originalquelle & Fundstelle</summary>'+ref(f)+'</details>'+
 (global.MediIdentaReviewAuth?.reviewActionHtml(f)||'')+'</article>';
 return body;
}
function sourceRecords(D,p){
 return [...(D.approved||[]),...(D.drafts||[])].filter(f=>
  Array.isArray(f.linked_product_ids)&&f.linked_product_ids.includes(p.id));
}
function linked(D,p){
 const smpc=new Set((Array.isArray(p.smpc_sections)?p.smpc_sections:[])
  .filter(s=>s&&typeof s.content_text==='string'&&s.content_text.trim())
  .map(s=>s.fact_type));
 // An original SmPC chapter supersedes only its corresponding short drafts
 // in the visible product view. The original draft records and citations remain.
 return sourceRecords(D,p).filter(f=>!smpc.has(f.fact_type)).sort((a,b)=>
  (a.editorial_status==='clinically_reviewed'?-1:0)-
  (b.editorial_status==='clinically_reviewed'?-1:0)||
  (riskRank[a.risk_level]??3)-(riskRank[b.risk_level]??3));
}
function groupedRecords(records){
 const display=global.MediIdentaDisplay;
 if(!display)return records.map(f=>'<div class="fact"><strong>'+esc(TYPES[f.fact_type]||f.fact_type)+'</strong><p>'+esc(f.content_text)+'</p></div>').join('');
 const groups=display.groupFacts(records);
 const count=groups.reduce((n,g)=>n+g.items.length,0);
 const duplicates=records.length-count;
 return (duplicates?'<p class="tiny muted">'+duplicates+' wortgleiche Einträge zusammengefasst.</p>':'')+
  groups.map(g=>'<section class="clinical-topic" data-fact-topic="'+esc(g.type)+'">'+
    '<h3>'+esc(g.label)+'</h3>'+
    g.items.map(item=>'<div class="grouped-fact-item">'+
      '<p class="draft-text">'+esc(item.text)+'</p></div>').join('')+
    '</section>').join('');
}


function knowledgeTopics(records){
 const buckets=new Map();
 for(const f of records){
  // Keep different products/salts/targets separate, including unmatched facts.
  const linked=Array.isArray(f.linked_product_ids)?[...f.linked_product_ids].sort().join('|'):'';
  const key=JSON.stringify([f.target_type||'',f.target_name||'',linked,f.fact_type||'']);
  if(!buckets.has(key))buckets.set(key,{
   target_name:f.target_name||'Produktzuordnung offen',
   fact_type:f.fact_type||'',
   records:[]
  });
  buckets.get(key).records.push(f);
 }
 return [...buckets.values()];
}
function details(D,p){
 const records=linked(D,p);
 if(!records.length&&(p.smpc_sections||[]).length)return '';
 return '<section class="card draft-section"><h2>Weitere Fachinformationen & Good-to-Know</h2>'+
  '<p class="small muted">Quellenbezogene Fachtextinformationen. Die genauen EMA-Fundstellen sind ganz unten unter „Quellen & Nachweise“ zusammengefasst.</p>'+
  (records.length?groupedRecords(records):'<p class="small muted">Noch keine Fachinformationen zu diesem Präparat zugeordnet.</p>')+
  '</section>';
}
function filtered(D){
 const q=norm(R.query);
 return [...(D.approved||[]),...(D.drafts||[])].filter(f=>(R.risk==='all'||R.risk===f.risk_level)&&
 (R.reviewState==='all'||(R.reviewState==='approved'?f.editorial_status==='clinically_reviewed':f.editorial_status!=='clinically_reviewed'))&&
 (R.assignment==='all'||(R.assignment==='unmatched'?(f.assignment_status==='unmatched'):(f.assignment_status!=='unmatched')))&&
 (!q||norm([f.target_name,f.fact_type,f.content_text,f.reference?.document_title,f.id].join(' ')).includes(q)))
 .slice().sort((a,b)=>(riskRank[a.risk_level]??3)-(riskRank[b.risk_level]??3)||String(a.target_name).localeCompare(String(b.target_name),'de'));
}
function option(k,v,current){return '<option value="'+k+'" '+(current===k?'selected':'')+'>'+esc(v)+'</option>';}
function knowledge(D){
 const all=filtered(D),topics=knowledgeTopics(all),size=10,pages=Math.max(1,Math.ceil(topics.length/size));R.page=Math.min(Math.max(0,R.page),pages-1);
 const list=topics.slice(R.page*size,(R.page+1)*size);
 const approved=(D.approved||[]).length;
 const editor=global.MediIdentaReviewAuth?._debug?.role?.();
 const privileged=editor==='admin'||editor==='moderator';
 return '<div class="eyebrow">MediIdenta · Wissen</div><h1>Fachinformationen</h1>'+
 '<p class="small muted">Unabhängig formulierte Informationen mit direktem Verweis auf die Originalquelle. Du kannst auch noch nicht fachlich validierte Aussagen lesen – mit entsprechendem Hinweis.</p>'+
 notice()+
 '<div class="stats"><div class="stat"><strong>'+approved+'</strong><span>Fachlich validierte Einzeltexte</span></div>'+
 '<div class="stat"><strong>'+D.drafts.length+'</strong><span>Noch nicht fachlich validiert</span></div></div>'+
 '<section class="card"><label class="search-label" for="clinical-search">Suche in Fachinformationen</label>'+
 '<input id="clinical-search" class="search-input" value="'+esc(R.query)+'" placeholder="Wirkstoff, Präparat, Thema …">'+
 '<div class="draft-filters"><label>Prüfstatus<select id="clinical-review-state" class="search-input">'+
 option('all','Alle Informationen',R.reviewState)+option('approved','Fachlich validiert',R.reviewState)+
 option('draft','Nicht fachlich validiert',R.reviewState)+'</select></label>'+
 '<label>Zuordnung<select id="clinical-assignment" class="search-input">'+
 option('all','Alle Einträge',R.assignment)+option('matched','Mit Produktbezug',R.assignment)+
 option('unmatched','Zuordnung offen',R.assignment)+'</select></label>'+
 '<label>Prüfpriorität<select id="clinical-risk" class="search-input">'+
 option('all','Alle Prioritäten',R.risk)+Object.entries(RISKS).map(([k,v])=>option(k,v,R.risk)).join('')+'</select></label></div>'+
 '<p class="small muted">'+topics.length+' Themenbereiche aus '+all.length+' Einzeltexten · Seite '+(R.page+1)+' von '+pages+'</p>'+
 (privileged?'<details><summary class="small">Legacy: private lokale Prüfnotizen exportieren</summary>'+
 '<p class="tiny muted">Ältere lokale Markierungen bleiben auf diesem Gerät; neue Moderatorprüfungen werden in der geschützten Datenbank dokumentiert.</p>'+
 '<button class="secondary full" data-review-action="export">Lokale Notizen als JSON exportieren</button></details>':'')+
 (R.saveError?'<p class="notice warning">Lokale Notizen konnten nicht gespeichert werden.</p>':'')+'</section>'+
 (D.draftLoadError?'<div class="notice danger">Fachinformationen konnten nicht vollständig geladen werden.</div>':'')+
 (list.length?list.map(topic=>'<article class="card knowledge-topic"><h2>'+esc(topic.target_name)+'</h2>'+groupedRecords(topic.records)+'</article>').join(''):'<div class="empty">Keine passenden Informationen gefunden.</div>')+
 '<div class="row draft-pager"><button class="secondary" data-review-action="prev" '+(R.page===0?'disabled':'')+'>← Zurück</button>'+
 '<span class="small muted">'+(R.page+1)+' / '+pages+'</span>'+
 '<button class="secondary" data-review-action="next" '+(R.page===pages-1?'disabled':'')+'>Weiter →</button></div>';
}
function quality(D){
 const a=D.drafts||[],approved=D.approved||[],unassigned=a.filter(f=>f.assignment_status==='unmatched').length;
 return '<section class="card"><h2>Redaktioneller Datenbestand</h2><div class="stats">'+
 '<div class="stat"><strong>'+a.length+'</strong><span>Öffentlich sichtbare Fachtextentwürfe</span></div>'+
 '<div class="stat"><strong>'+unassigned+'</strong><span>Zuordnung offen</span></div><div class="stat"><strong>'+approved.length+'</strong><span>Fachlich freigegebene Fachtexte</span></div></div>'+
 '<p class="small muted">Die Redaktion trennt weiterhin ungeprüfte Entwürfe und einzelne nachweislich von einem Prüfkonto freigegebene Aussagen. Keine pauschale medizinische Produktfreigabe.</p>'+
 '<button class="secondary full" data-nav="knowledge">Entwürfe jetzt prüfen</button><button class="secondary full spaced" data-nav="account">Prüfkonto öffnen</button></section>';
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
  if(e.target.id==='clinical-review-state'){R.reviewState=e.target.value;R.page=0;draw();return;}
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
global.MediIdentaReviewUI={details,sourceRecords,knowledge,quality,configure};
})(window);
