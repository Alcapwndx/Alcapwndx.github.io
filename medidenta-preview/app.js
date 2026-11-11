/* MediIdenta Alpha v0.21 – eigene MediIdenta-API / Identity-Snapshot.
   Keine Fotos, PZN oder Fachtexte ohne explizite Backend-Freigabe als identifiziert darstellen. */
'use strict';
/* Live-Supabase mode is detected from the server-provided public config. */
const IS_PUBLIC_PREVIEW=window.MEDIIDENTA_AUTH_CONFIG?.reviewApiBase!=='/api/v1';
const root=document.querySelector('#screen'),bar=document.querySelector('#system-status'),picker=document.querySelector('#photo-picker');
const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trim=x=>String(x==null?'':x).trim();
const normalize=x=>trim(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const safeUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:null}catch{return null}};
const D={page:'home',connected:false,meta:null,offline:[],hits:[],search:'',detail:null,detailError:'',photo:null,photoName:'',scanMessage:'',scanMatches:[],loading:false,seq:0,identifierSystem:'PZN8',compare:[],compareDetails:{},attributions:[],drafts:[],approved:[],draftLoadError:false,syncMeta:null,syncBusy:false,syncMessage:'',catalogRevision:null,draftRevision:null,features:{collaboration_enabled:false},pmsHits:[],pmsQuery:'',pmsPage:0,pmsHasMore:false,pmsBusy:false,pmsError:'',pmsDetail:null,pmsMessage:'',pmsOverview:null,pmsOverviewError:false,pmsCoverage:null,pmsCoverageError:false,searchPage:0,searchHasMore:false,pmsSearchHits:[],pmsSearchMore:false,pmsSearchError:false,detailKind:'catalog',pmsBack:'search',catalogSearchError:''};
try{D.favorites=JSON.parse(localStorage.getItem('medidenta_favs_v04')||'[]');if(!Array.isArray(D.favorites))D.favorites=[];}catch{D.favorites=[]}
const api=async path=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),path.startsWith('/products/')?18000:8000);try{const r=await fetch('/api/v1'+path,{signal:c.signal,cache:'no-store',headers:{Accept:'application/json'}});const data=await r.json();if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;}finally{clearTimeout(t)}};
function clinicalNotice(){return '<div class="notice warning"><strong>Alpha-Testversion – keine klinische Entscheidungsunterstützung.</strong> Die Informationen beruhen auf angegebenen EMA-/EU-Quellen; insbesondere EMA PMS Beta kann unvollständig sein. Bitte für konkrete Behandlungs-, Dosierungs- oder Austauschentscheidungen die aktuellen Original-Fachinformationen und ärztlichen Anordnungen heranziehen.</div>';}
function status(){
 const p=D.offline.length;
 bar.className='system-status'+(D.connected?'':' offline');
 bar.textContent=IS_PUBLIC_PREVIEW?
  '● ALPHA · Statischer Testbestand · '+p+' Identitäten · keine Live-API':
  D.connected?'● ALPHA · Live-Datenbank verbunden · '+p+' Identitäten':
  '● ALPHA · Verbindung derzeit nicht verfügbar · zuletzt geladener Datenstand';
}
function title(s){return '<div class="eyebrow">MediIdenta · Fachkreiskatalog</div><h1>'+escapeHtml(s)+'</h1>'}
function badge(s,cls){return '<span class="tag '+(cls||'')+'">'+escapeHtml(s)+'</span>'}
function fav(id){return '<button class="fav '+(D.favorites.includes(id)?'on':'')+'" data-action="fav" data-id="'+escapeHtml(id)+'" aria-label="Favorit">'+(D.favorites.includes(id)?'★':'☆')+'</button>'}
function row(p){
 const isPms=!!p.pms_id;
 const id=isPms?p.pms_id:p.id;
 const action=isPms?'pms-inline':'detail';
 const sub=isPms?'EMA-Quelldatensatz · Produktidentität nicht bestätigt':
  Array.isArray(p.substances)?p.substances.map(s=>s.name).join(', '):p.substances||'';
 const badgeText=isPms?'EMA PMS Beta':p.has_pms_candidate?'PMS Beta-Quellen verfügbar':(p.country_code||'EU');
 const badgeClass=isPms?'amber':'gray';
 return '<article class="card"><div class="row"><button class="med-button grow" data-action="'+action+
  '" data-id="'+escapeHtml(id)+'"><span class="round-icon">✚</span><span class="grow"><span class="med-title">'+
  escapeHtml(isPms?p.display_name:p.name)+'</span><span class="med-sub">'+
  escapeHtml(sub||'Keine Wirkstoffangabe')+'</span>'+
  badge(badgeText,badgeClass)+'</span></button>'+
  (isPms?'':fav(id)+'<button class="compare-toggle '+(D.compare.includes(id)?'on':'')+
  '" data-action="compare" data-id="'+escapeHtml(id)+
  '" aria-pressed="'+D.compare.includes(id)+'" title="Für den Vergleich markieren">⇄</button>')+
  '</div></article>';
}
function isPmsNamedCandidate(catalogName,pmsName){
 const name=normalize(catalogName).replace(/\s+/g,' ').trim();
 const candidate=normalize(pmsName).replace(/\s+/g,' ').trim();
 return name.length>=4&&(candidate===name||[' ',' ('].some(d=>candidate.startsWith(name+d)));
}
function combineSearchHits(catalog,pms){
 const named=Array.isArray(catalog)?catalog:[];
 const candidates=Array.isArray(pms)?pms:[];
 const attached=new Set();
 const normal=named.map(product=>{
  const related=candidates.filter(p=>isPmsNamedCandidate(product.name,p.display_name));
  related.forEach(p=>attached.add(p.pms_id));
  return {...product,has_pms_candidate:related.length>0};
 });
 const remaining=candidates.filter(p=>!attached.has(p.pms_id));
 return [...normal,...remaining];
}
function home(){return '<div class="hero"><div class="eyebrow">FÜR PFLEGE · MEDIZIN · APOTHEKE</div><h1>Arzneimittel schneller finden.</h1><p>Die eigene MediIdenta-Datenbank. Quellenbezogen. Transparent.</p><button class="hero-search" data-nav="search">⌕ &nbsp; Handelsname oder Wirkstoff suchen …</button></div><div class="grid2 spaced"><button class="tile" data-nav="scan"><span class="symbol">▣</span><strong>Identifikation</strong><small>Packungscode prüfen · Kamera bald verfügbar</small></button><button class="tile" data-nav="knowledge"><span class="symbol">◈</span><strong>Praxiswissen</strong><small>Allgemeines Wissen für die Praxis · SOON</small></button></div><div class="section-title"><h2>Aus dem Katalog</h2><button data-nav="search">Alle suchen →</button></div><p class="small muted">'+D.offline.length+' Produktidentitäten im aktuellen Katalog</p>'+D.offline.slice(0,3).map(row).join('')+clinicalNotice();}
function searchHtml(){const xs=D.hits;return title('Medikamente suchen')+'<label for="search" class="search-label">Wirkstoff oder Handelsname</label><input id="search" class="search-input" type="search" value="'+escapeHtml(D.search)+'" placeholder="z. B. Toujeo, Ozempic, Apixaban"><div class="filters"><button class="filter" data-filter="all">Alle Treffer</button><button class="filter" data-filter="fav">★ Favoriten</button></div><div class="small muted">'+(D.loading?'Suche läuft …':xs.length+' Treffer · '+(D.connected?'Live-API':'Offline-Snapshot'))+'</div><div id="hits">'+xs.map(row).join('')+'</div>'+(D.connected&&trim(D.search).length>=2?'<div class="row draft-pager"><button class="secondary" data-action="search-prev" '+(D.searchPage===0?'disabled':'')+'>← Zurück</button><span class="small muted">Seite '+(D.searchPage+1)+'</span><button class="secondary" data-action="search-next" '+(!D.searchHasMore?'disabled':'')+'>Weiter →</button></div>':'')+(D.compare.length?'<div class="compare-tray"><strong>⇄ '+D.compare.length+'/2 ausgewählt</strong><div class="row"><button class="secondary" data-action="compare-clear">Löschen</button><button class="primary" data-action="compare-view" '+(D.compare.length!==2?'disabled':'')+'>Vergleichen</button></div></div>':'')+(!xs.length&&!D.pmsSearchHits.length?'<div class="empty">Keine passenden Medikamenten- oder EMA-PMS-Quelldatensätze gefunden.</div>':'')+clinicalNotice();}
function factsHtml(facts){
 return facts.length?facts.map(f=>'<div class="fact"><strong>'+escapeHtml(f.fact_type||'Fachinformation')+'</strong><p>'+escapeHtml(f.content_text||'')+'</p></div>').join(''):
 '<p class="small muted">Noch keine Fachinformationen zu diesem Präparat hinterlegt.</p>';
}
/* One source dropdown at the END of each medicine, with unique EMA and PMS citations.
   Original review hashes, decisions and unmodified FHIR payloads stay in the backend. */
/* Official EMA Annex I sections are content, not a text-review or PMS status.
   All exact document citations appear only in the bottom disclosure. */
function smpcHtml(sections,unavailable=false,linkedFacts=[]){
 const specs=[
  ['indication','Indikationen','4.1'],
  ['contraindication','Kontraindikationen','4.3'],
  ['interaction','Wechselwirkungen','4.5'],
  ['adverse_effect','Nebenwirkungen','4.8']
 ];
 const list=Array.isArray(sections)?sections:[];
 return '<section class="smpc-overview" aria-label="EMA-Fachinformationen">'+
  '<h2>EMA-Fachinformationen</h2>'+
  '<p class="small muted">Originalabschnitte aus der offiziellen Fachinformation (SmPC). Nur eindeutig zugeordnete und technisch überprüfte Dokumente werden übernommen; bei fehlenden Quellen wird nichts ergänzt oder erfunden.</p>'+
  (unavailable?'<p class="notice warning">Die SmPC-Quellendatenbank ist derzeit nicht verfügbar. Vorhandene ältere Kurztexte sind davon getrennt.</p>':'')+
  specs.map(([type,label,code])=>{
   const sec=list.find(x=>x.fact_type===type&&x.section_code===code);
   const data=sec&&typeof sec.content_text==='string'?sec.content_text:'';
   const fallback=[],unique=new Set();
   if(!data)for(const fact of Array.isArray(linkedFacts)?linkedFacts:[]){
    const ref=fact?.reference?.document_url||'';
    let official=false;
    try{const u=new URL(ref);official=u.protocol==='https:'&&u.hostname==='www.ema.europa.eu';}catch{}
    if(fact?.fact_type!==type||!official||typeof fact.content_text!=='string')continue;
    const body=fact.content_text.trim();
    if(!body)continue;
    const key=window.MediIdentaDisplay?.norm?.(body)||body.toLocaleLowerCase('de');
    if(unique.has(key))continue;
    unique.add(key);fallback.push(body);
   }
   return '<section class="card smpc-topic" data-smpc-fact="'+type+'">'+
    '<h3>'+label+'</h3>'+
    (data?
     '<p class="tiny muted">EMA-SmPC Abschnitt '+code+' · Originalsprache: '+
     (sec.source_language==='de'?'Deutsch':'Englisch')+'</p>'+
     '<div class="smpc-original" lang="'+(sec.source_language==='de'?'de':'en')+'">'+escapeHtml(data)+'</div>':
     (fallback.length?
      '<p class="tiny muted">EMA-verlinkter redaktioneller Kurztext (Alpha) · kein vollständiger SmPC-Abschnitt '+code+'. Quellen unten.</p>'+
      fallback.map(body=>'<p class="smpc-short-fact">'+escapeHtml(body)+'</p>').join(''):
      '<p class="small muted">Noch kein eindeutig zugeordneter, vollständig auslesbarer EMA-SmPC-Abschnitt '+code+' verfügbar.</p>'))+
    '</section>';
  }).join('')+'</section>';
}
function sourcesDisclosure(product,pmsSources,facts,smpcSections=[]){
 const p=product||{},src=p.source||{},entries=[];
 const catalogUrl=safeUrl(src.url||p.source_url);
 if(src.name||p.source_name||catalogUrl){
  entries.push('<li><strong>Produktidentität:</strong> '+escapeHtml(src.name||p.source_name||'EU-/EMA-Datenquelle')+
    (catalogUrl?' · <a href="'+escapeHtml(catalogUrl)+'" target="_blank" rel="noopener noreferrer">Originalquelle öffnen</a>':'')+
    (src.license||p.license?' · '+escapeHtml(src.license||p.license):'')+'</li>');
 }
 const citations=new Map();
 for(const f of Array.isArray(facts)?facts:[]){
  const r=f.reference||{};
  const link=safeUrl(r.document_url);
  const key=JSON.stringify([r.document_url||'',r.document_title||'',r.locator||'']);
  if(!citations.has(key)&&(link||r.document_title)){
   citations.set(key,'<li><strong>EMA-Fachinformation:</strong> '+escapeHtml(r.document_title||'EMA-Originalquelle')+
    (r.locator?' · Abschnitt '+escapeHtml(r.locator):'')+
    (r.publication_date?' · Stand '+escapeHtml(r.publication_date):'')+
    (link?' · <a href="'+escapeHtml(link)+'" target="_blank" rel="noopener noreferrer">Originalquelle öffnen</a>':'')+'</li>');
  }
 }
 entries.push(...citations.values());
 const smpcSeen=new Set();
 for(const record of Array.isArray(smpcSections)?smpcSections:[]){
  const u=safeUrl(record.source_document_url);
  const section=String(record.section_code||'');
  const lang=record.source_language==='de'?'Deutsch':'Englisch';
  const key=JSON.stringify([u,section,lang]);
  if(!u||!/^4\.(1|3|5|8)$/.test(section)||smpcSeen.has(key))continue;
  smpcSeen.add(key);
  entries.push('<li><strong>EMA-Fachinformation (SmPC):</strong> Abschnitt '+
   escapeHtml(section)+' · '+lang+
   ' · PDF-Seiten '+escapeHtml(record.source_page_start||'–')+
   '–'+escapeHtml(record.source_page_end||'–')+
   ' · <a href="'+escapeHtml(u)+'" target="_blank" rel="noopener noreferrer">EMA-Original-PDF öffnen</a>'+
   (record.source_document_sha256?
    '<p class="tiny muted">Dokumentprüfsumme (SHA-256): '+escapeHtml(record.source_document_sha256)+'</p>':'')+
   '</li>');
 }
 const seen=new Set();
 for(const entry of Array.isArray(pmsSources)?pmsSources:[]){
  const item=entry.product||{},id=trim(item.pms_id);
  if(!id||seen.has(id))continue;
  seen.add(id);
  const u=safeUrl(item.source_url),fields=Array.isArray(entry.fields)?entry.fields:[];
  entries.push('<li><strong>EMA PMS Beta:</strong> '+escapeHtml(item.display_name||'Produktquelle')+
    ' · PMS-ID '+escapeHtml(id)+
    (item.imported_at?' · Import '+escapeHtml(item.imported_at):'')+
    (u?' · <a href="'+escapeHtml(u)+'" target="_blank" rel="noopener noreferrer">FHIR-Originalquelle öffnen</a>':'')+
    '<p class="tiny muted">'+fields.length+' strukturierte Quellfelder. Die namentliche Zuordnung allein beweist keine Übereinstimmung von Stärke, Arzneiform oder Packung.</p>'+
    (fields.length?'<details class="source-raw"><summary>Technische FHIR-Feldnachweise ('+fields.length+')</summary>'+
      '<ul>'+fields.map(f=>{
        const fieldUrl=safeUrl(f.source_url);
        return '<li>'+escapeHtml(f.resource_type||'FHIR')+' / '+escapeHtml(f.resource_id||'–')+
          ' · '+escapeHtml(f.attribute_key||'Quellfeld')+
          (fieldUrl?' · <a href="'+escapeHtml(fieldUrl)+'" target="_blank" rel="noopener noreferrer">Quelle</a>':'')+
          '</li>';
      }).join('')+'</ul></details>':'')+'</li>');
 }
 return '<section class="card sources-bottom"><details class="source-accordion">'+
  '<summary>Quellen & Nachweise <span class="source-count">('+entries.length+')</span></summary>'+
  '<p class="small muted">EMA-/EU-Originalquellen und Fundstellen. PMS-Beta-Produktzuordnungen nach Namen sind keine bestätigten Packungsidentitäten.</p>'+
  (entries.length?'<ul class="source-list">'+entries.join('')+'</ul>':'<p class="small muted">Für diesen Eintrag sind noch keine Quellenangaben hinterlegt.</p>')+
  '</details></section>';
}
function detailHtml(){
 if(D.detailKind==='pms')return pmsDetailHtml();
 const p=D.detail;
 if(!p)return '<button class="back" data-nav="search">← Zur Suche</button>'+title('Medikamentendetails')+
  (D.detailError?'<div class="notice warning">'+escapeHtml(D.detailError)+'</div>':'<p class="small muted">Produktdaten werden geladen …</p>');
 const subst=Array.isArray(p.substances)?p.substances.map(x=>x.name).join(', '):p.substances||'–';
 const facts=Array.isArray(p.facts)?p.facts:[];
 const photos=Array.isArray(p.photos)?p.photos:[];
 const presentations=Array.isArray(p.presentations)?p.presentations:[];
 const pms=Array.isArray(p.pms_sources)?p.pms_sources:[];
 const smpc=Array.isArray(p.smpc_sections)?p.smpc_sections:[];
 const linked=window.MediIdentaReviewUI?.sourceRecords?.(D,p)||[];
 return '<button class="back" data-nav="search">← Zur Suche</button>'+title(p.name)+
  '<p class="detail-sub">'+escapeHtml(subst)+'</p>'+badge('Produktidentität hinterlegt')+' '+badge('Alpha · Testbestand','amber')+
  '<section class="card"><h2>Produktdetails</h2><div class="detail-list">'+
  '<div><span>Marktgebiet</span><strong>'+escapeHtml(p.country_code||'–')+'</strong></div>'+
  '<div><span>Zulassung laut Quelle</span><strong>'+escapeHtml(p.marketing_status||'unknown')+'</strong></div>'+
  '<div><span>Zulassungsinhaber</span><strong>'+escapeHtml(p.marketing_holder||'Nicht hinterlegt')+'</strong></div>'+
  '<div><span>Letzte Datenänderung</span><strong>'+escapeHtml(p.updated_at||'Nicht hinterlegt')+'</strong></div></div>'+
  '<div class="notice warning">EU-Zulassung belegt weder aktuelle deutsche Marktverfügbarkeit noch Stärke oder Packungsgröße.</div></section>'+
  '<section class="card"><h2>Originalbilder</h2>'+
  (photos.length?photos.map(photo=>{const u=safeUrl(photo.media_url);return u?
    '<img alt="Präparatebild laut Quelle" loading="lazy" style="width:100%;border-radius:12px" src="'+escapeHtml(u)+'">':
    '<p>Bilddatei nicht abrufbar.</p>'}).join(''):'<div class="photo-box">▧<br>Kein verifiziertes Originalbild vorhanden</div>')+'</section>'+
  '<section class="card"><h2>Darreichungsformen und Stärken</h2>'+
  (presentations.length?presentations.map(x=>'<p>'+escapeHtml([x.dosage_form,x.strength_label,x.administration_route].filter(Boolean).join(' · '))+'</p>').join(''):
   '<p class="muted small">Noch keine präparatespezifischen Angaben hinterlegt.</p>')+'</section>'+
  embeddedPmsHtml(pms,p.pms_unavailable===true)+
  smpcHtml(smpc,p.smpc_unavailable===true,linked)+
  (window.MediIdentaReviewUI?.details(D,p)??'<section class="card"><h2>Weitere Fachinformationen & Good-to-Know</h2><div class="facts">'+factsHtml(facts)+'</div></section>')+
  clinicalNotice()+sourcesDisclosure(p,pms,[...linked,...facts],smpc);
}
// PMS Beta metadata remains SEPARATE from the known/verified product catalog.
// Every field is an explicit, source-versioned unverified candidate until admin review.
function pmsReviewForm(f){
 const id=escapeHtml(f.id),sha=escapeHtml(f.statement_sha256);
 return '<form data-pms-review-field="'+id+'" data-pms-sha="'+sha+'" class="editor-review-form">'+
  '<label>Entscheidung<select name="decision"><option value="verified">Einzelangabe geprüft</option>'+
  '<option value="needs_revision">Überarbeitung erforderlich</option><option value="rejected">Angabe zurückweisen</option></select></label>'+
  '<label>Prüfnotiz<textarea name="notes" maxlength="3000" rows="2" placeholder="Quelle und Identität dokumentieren; keine Patientendaten"></textarea></label>'+
  '<label><input type="checkbox" name="source_checked" required> EMA-Originalangabe, Einheit, Stärke und Produktbezug selbst geprüft.</label>'+
  '<button type="submit" class="primary full">Einzelentscheidung speichern</button></form>';
}
function pmsCardsHtml(entry){
 const p=entry.product||{},fields=Array.isArray(entry.fields)?entry.fields:[];
 const sections=window.MediIdentaDisplay?.groupPmsSections?.(fields)||[];
 const association=entry.identity_association||'PMS_SOURCE_ONLY_UNCONFIRMED';
 const warning=association==='ADMIN_CONFIRMED_SOURCE_LINK_ONLY'?
   'Diese PMS-Quelle ist einer Katalogidentität zugeordnet. Die Angaben bleiben EMA-Beta-Quelldaten.':
   association==='NAME_SIMILARITY_UNCONFIRMED'?
   'Diese EMA-PMS-Quelle wird wegen eines ähnlichen Produktnamens angezeigt. Wirkstärke, Arzneiform, Wirkstoff und Marktgebiet können abweichen.':
   'Eigenständiger EMA-PMS-Beta-Quelldatensatz ohne bestätigte Verbindung zu einer Katalogidentität.';
 const cards=sections.map(section=>'<section class="card pms-topic" data-pms-section="'+escapeHtml(section.title)+'">'+
  '<h2>'+escapeHtml(section.title)+'</h2>'+
  section.groups.map(g=>'<div class="pms-subtopic" data-pms-topic="'+escapeHtml(g.key)+'">'+
   '<h3>'+escapeHtml(g.label)+'</h3>'+
   '<ul class="pms-readable-values">'+g.items.map(item=>
    '<li><span class="pms-readable-text">'+escapeHtml(item.text)+'</span></li>').join('')+
   '</ul></div>').join('')+'</section>').join('');
 return '<div class="pms-beta-intro">'+badge('EMA PMS Beta','amber')+
  '<p class="small muted">'+escapeHtml(warning)+'</p></div>'+
  (sections.length?cards:'<div class="notice warning">Keine strukturierten PMS-Quellfelder für dieses Produkt verfügbar.</div>');
}
function embeddedPmsHtml(sources,unavailable=false){
 const list=Array.isArray(sources)?sources:[];
 if(!list.length&&!unavailable){
  return '<section class="card pms-integrated"><h2>EMA PMS Beta · Datenstand</h2>'+
   '<p class="small muted">'+(D.connected?
    'Für diese Identität ist noch keine passende EMA-PMS-Beta-Quelle importiert. '+
    'Bei dieser Verbindung ist noch keine PMS-Quelle abrufbar; es werden keine fehlenden Daten ergänzt oder erfunden.':
    'EMA-PMS-Beta-Quelldaten benötigen die Live-Verbindung. Im Offline-Snapshot liegen dazu keine Daten vor.')+
   '</p>'+badge('PMS-Beta-Quelle noch offen','amber')+'</section>';
 }
 return '<section class="pms-integrated"><h2>EMA PMS Beta · Strukturierte Quelldaten</h2>'+
  '<p class="small muted">Strukturierte Angaben aus der offiziellen EMA PMS Beta. '+
  'Sie ergänzen die Fachinformationen, belegen aber allein keine Gleichheit von Arzneiform, Stärke, Packung oder Austauschbarkeit.</p>'+
  (D.pmsMessage?'<div class="notice" role="status">'+escapeHtml(D.pmsMessage)+'</div>':'')+
  (unavailable?'<div class="notice warning">EMA-PMS-Quelldaten können derzeit nicht geladen werden.</div>':'')+
  list.map(pmsCardsHtml).join('')+'</section>';
}
function pmsDetailHtml(){
 const entry=D.pmsDetail;
 if(!entry)return '<button class="back" data-nav="search">← Zur Suche</button>'+title('Medikamentendaten laden')+
  (D.pmsError?'<div class="notice warning">'+escapeHtml(D.pmsError)+'</div>':'');
 const p=entry.product||{};
 return '<button class="back" data-nav="search">← Zur Suche</button>'+
  title(p.display_name||'Medikament')+'<p class="detail-sub">EMA PMS Beta · Produkt- und Quelldaten</p>'+
  badge('EMA PMS Beta','amber')+
  '<section class="card"><h2>Medikamentendetails</h2>'+
  '<p class="small muted">Dieser Eintrag ist bislang nur in der EMA-PMS-Quelle vorhanden. '+
  'Es liegt keine bestätigte Verknüpfung mit einem MediIdenta-Katalogprodukt vor.</p></section>'+
  pmsCardsHtml({...entry,identity_association:'PMS_SOURCE_ONLY_UNCONFIRMED'})+
  clinicalNotice()+sourcesDisclosure(null,[entry],[]);
}
async function loadPms(){
 if(!D.connected){D.pmsError='Der PMS-Livebereich ist nur über die Render-Live-Datenbank erreichbar.';D.pmsHits=[];draw(true);return;}
 const n=++D.seq;D.pmsBusy=true;D.pmsError='';draw(true);
 try{
  const x=await api('/pms/products?q='+encodeURIComponent(D.pmsQuery)+'&limit=25&offset='+(D.pmsPage*25));
  if(n!==D.seq)return;
  D.pmsHits=Array.isArray(x.results)?x.results:[];D.pmsHasMore=x.has_more===true;
 }catch(e){if(n!==D.seq)return;D.pmsHits=[];D.pmsError='PMS-Quelldaten derzeit nicht verfügbar. '+String(e.message||'');}
 finally{if(n===D.seq){D.pmsBusy=false;draw(true);}}
}
async function openPms(id,back='search'){
 D.detailKind='pms';D.pmsBack=back;D.page='detail';D.pmsDetail=null;D.pmsError='';D.pmsMessage='';draw();
 try{D.pmsDetail=await api('/pms/products/'+encodeURIComponent(id));}
 catch(e){D.pmsError='PMS-Datensatz konnte nicht geladen werden: '+String(e.message||'');}
 draw();
}
async function submitPmsField(form){
 const fieldId=form.dataset.pmsReviewField,hash=form.dataset.pmsSha;
 if(window.MediIdentaReviewAuth?._debug?.role?.()!=='admin')return;
 // The same editorial action must also work when PMS fields are EMBEDDED
 // inside a standard MediIdenta medication record.
 const entries=D.detailKind==='pms'?[D.pmsDetail]:(D.detail?.pms_sources||[]);
 const entry=entries.find(e=>e?.fields?.some(f=>f.id===fieldId&&f.statement_sha256===hash));
 if(!entry)return;
 const checked=!!form.querySelector('[name="source_checked"]')?.checked;
 const decision=form.querySelector('[name="decision"]')?.value;
 const notes=trim(form.querySelector('[name="notes"]')?.value);
 if(!checked||!['verified','needs_revision','rejected'].includes(decision)||
   (decision!=='verified'&&notes.length<10)){
   D.pmsMessage='Quellencheck bestätigen und bei Ablehnung mindestens zehn Zeichen begründen.';draw();return;
 }
 try{
  await window.MediIdentaReviewAuth.submitPmsReview({
   field_id:fieldId,statement_sha256:hash,decision,source_checked:true,notes
  });
  if(D.detailKind==='pms'){
   D.pmsDetail=await api('/pms/products/'+encodeURIComponent(entry.product.pms_id));
  }else{
   D.detail=await api('/products/'+encodeURIComponent(D.detail.id));
  }
  D.pmsMessage='Entscheidung revisionsgebunden gespeichert. Der PMS-Einzelwert wurde aktualisiert.';
 }catch(e){D.pmsMessage='Entscheidung nicht gespeichert: '+String(e.message||'');}
 draw();
}

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
function knowledgeHtml(){
 return title('Praxiswissen')+
  '<section class="coming-soon knowledge-soon"><h2>Allgemeines Praxiswissen '+badge('SOON','soon')+'</h2>'+
  '<p>Hier entsteht später ein eigenständiger Bereich mit allgemeinem Wissen für den Pflege- und Medizinalltag.</p>'+
  '<p class="small muted">Medikamentenbezogene Fachinformationen findest du bereits direkt beim jeweiligen Präparat.</p></section>';
}
function qualityHtml(){
 const lastImport=D.syncMeta?.last_catalog_import_at;
 const lastEma=D.syncMeta?.last_ema_check_at;
 const showDate=x=>{if(!x)return 'Noch nicht dokumentiert';const d=new Date(x);
  return Number.isNaN(+d)?'Nicht verfügbar':d.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});};
 const textCount=(D.drafts||[]).length+(D.approved||[]).length;
 return title('Datenqualität & Transparenz')+
  '<p class="small muted">Quellen, Datenstand und Abdeckung des MediIdenta-Alpha-Katalogs. Die frühere redaktionelle Fachfreigabe ist kein sichtbarer Schritt mehr.</p>'+
  '<div class="stats">'+
   '<div class="stat"><strong>'+D.offline.length+'</strong><span>Produktidentitäten</span></div>'+
   '<div class="stat"><strong>'+textCount+'</strong><span>Quellenbezogene Fachtextangaben</span></div>'+
   '<div class="stat"><strong>'+escapeHtml(D.connected?'Live':'Offline')+'</strong><span>Datenverbindung</span></div></div>'+
  '<section class="card"><h2>Datenherkunft und Aktualität</h2>'+
   '<p class="small"><strong>Katalogdatenbank:</strong> '+escapeHtml(D.connected?'Supabase PostgreSQL':'Offline-Snapshot / keine Live-Verbindung')+'</p>'+
   '<p class="small"><strong>Letzter Datenbankimport:</strong> <span class="quality-timestamp">'+escapeHtml(showDate(lastImport||(!D.connected?D.syncMeta?.source_date:null)))+'</span></p>'+
   '<p class="small"><strong>Letzter dokumentierter EMA-Quellenabgleich:</strong> <span class="quality-timestamp">'+escapeHtml(showDate(lastEma))+'</span></p>'+
   '<p class="tiny muted">Importdatum und erneute Quellenprüfung sind verschiedene Vorgänge. Ohne separat dokumentierten Abgleich wird kein Prüfdatum behauptet.</p></section>'+
  '<section class="card"><h2>EMA-PMS-Abdeckung der Demo</h2>'+
   (D.pmsCoverage?'<div class="stats"><div class="stat"><strong>'+
      escapeHtml(D.pmsCoverage.with_pms_source)+' / '+escapeHtml(D.pmsCoverage.identity_total)+
      '</strong><span>Identitäten mit PMS-Beta-Quellen</span></div>'+
      '<div class="stat"><strong>'+escapeHtml(String(D.pmsCoverage.coverage_percent).replace('.',','))+
      '%</strong><span>Abdeckung des Demo-Katalogs</span></div></div>'+
      '<p class="tiny muted">Der Zahlenwert beschreibt Quellenabdeckung nach Namen, nicht die Vollständigkeit von Wirkstärken und Packungen.</p>'+
      '<details><summary>Alle '+escapeHtml(D.pmsCoverage.identity_total)+' Medikamentenidentitäten anzeigen</summary>'+
      (Array.isArray(D.pmsCoverage.items)?D.pmsCoverage.items:[]).map(p=>
        '<div class="fact"><div class="row"><button class="med-button grow" data-action="detail" data-id="'+escapeHtml(p.id)+'"><strong>'+escapeHtml(p.name)+'</strong></button>'+
        badge(p.pms_source_count?'PMS Beta verfügbar':'Quelle noch offen',p.pms_source_count?'gray':'amber')+
        '</div></div>').join('')+'</details>':
     '<p class="small muted">'+(D.pmsCoverageError?
      'Die PMS-Abdeckung ist momentan nicht erreichbar.':
      'Die aktuelle PMS-Abdeckung wird geladen …')+'</p>')+'</section>'+
  '<section class="card"><h2>EMA-PMS-Beta-Datenbestand</h2>'+
   (D.pmsOverview?
     '<div class="stats"><div class="stat"><strong>'+escapeHtml(D.pmsOverview.pms_products)+'</strong><span>PMS-Quellprodukte</span></div>'+
     '<div class="stat"><strong>'+escapeHtml(D.pmsOverview.pms_fields)+'</strong><span>Öffentliche PMS-Quellfelder</span></div></div>'+
     '<p class="small"><strong>Letzter PMS-Import:</strong> '+escapeHtml(showDate(D.pmsOverview.last_pms_source_import_at))+'</p>':
     '<p class="small muted">'+(D.pmsOverviewError?'PMS-Statistik derzeit nicht abrufbar.':'PMS-Statistik wird geladen …')+'</p>')+
   '<p class="tiny muted">EMA PMS ist eine externe Beta-Quelle. Sie kann unvollständig sein. PMS-IDs sind keine deutschen PZN.</p></section>'+
  '<section class="card"><h2>Quellen und Transparenz</h2>'+
   (D.attributions.length?D.attributions.map(x=>'<div class="fact"><strong>'+escapeHtml(x.name||x.source_key)+'</strong><p class="tiny">Lizenz: '+escapeHtml(x.license_code||'Nicht angegeben')+'</p></div>').join(''):'<p class="small muted">Quellenliste nicht verfügbar.</p>')+
   '</section>'+
  clinicalNotice();
}
function draw(preserveFocus){let active=preserveFocus&&document.activeElement&&document.activeElement.id==='search';let focusId=active?document.activeElement.id:null;let pos=active?document.activeElement.selectionStart:null;root.innerHTML=({home:home,search:searchHtml,detail:detailHtml,compare:compareHtml,scan:scanHtml,knowledge:knowledgeHtml,quality:qualityHtml,account:()=>window.MediIdentaReviewAuth?.accountHtml()||title('Prüfkonto noch nicht verfügbar')}[D.page]||home)();document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.nav===D.page));status();if(D.photo&&document.querySelector('#photo'))document.querySelector('#photo').src=D.photo;if(active&&document.querySelector('#'+focusId)){let el=document.querySelector('#'+focusId);el.focus();try{el.setSelectionRange(pos,pos)}catch{}}}
function localSearch(q){if(trim(q).length<2)return D.offline.slice(0,50);const tokens=normalize(q).split(/\s+/).filter(Boolean);return D.offline.filter(x=>tokens.every(t=>normalize(x.name+' '+x.substances).includes(t))).slice(0,50)}
async function find(q){
 const n=++D.seq;
 D.loading=true;D.pmsSearchHits=[];D.pmsSearchError=false;D.pmsSearchMore=false;D.catalogSearchError='';
 D.hits=D.connected?[]:localSearch(q);draw(true);
 if(D.connected&&trim(q).length>=2){
  const [catalog,pms]=await Promise.allSettled([
   api('/search?q='+encodeURIComponent(q)+'&limit=50&offset='+(D.searchPage*50)),
   api('/pms/products?q='+encodeURIComponent(q)+'&limit=50&offset='+(D.searchPage*50))
  ]);
  if(n!==D.seq)return;
  if(catalog.status==='fulfilled'){
   const x=catalog.value;
   D.hits=(x.results||[]).map(p=>({id:p.id,name:p.name,substances:p.substances||'',
     country_code:p.country_code,marketing_status:p.marketing_status}));
   D.searchHasMore=x.has_more===true;
  }else{D.hits=[];D.searchHasMore=false;D.catalogSearchError='Die Live-Medikamentensuche ist momentan nicht erreichbar.';}
  if(pms.status==='fulfilled'){
   const x=pms.value;
   D.pmsSearchHits=Array.isArray(x.results)?x.results:[];D.pmsSearchMore=x.has_more===true;
  }else{D.pmsSearchHits=[];D.pmsSearchError=true;}
  D.hits=combineSearchHits(D.hits,D.pmsSearchHits);
  D.searchHasMore=D.searchHasMore||D.pmsSearchMore;
 }
 if(n===D.seq){D.loading=false;draw(true);}
}
async function openProduct(id){
 D.detailKind='catalog';D.page='detail';D.detail=null;D.detailError='';D.pmsMessage='';draw();
 const p=D.offline.find(x=>x.id===id);
 try{
  if(D.connected)D.detail=await api('/products/'+encodeURIComponent(id));
  else if(p)D.detail={...p,substances:trim(p.substances).split(', ').map(name=>({name})),
   facts:[],photos:[],presentations:[],source:{name:p.source_name,url:p.source_url,license:p.license}};
  else throw Error('Produktidentität nicht im lokalen Testbestand');
 }catch{
  // A failed LIVE lookup is never replaced with a stale offline identity.
  D.detailError='Medikamentendaten sind derzeit nicht vollständig erreichbar. Bitte erneut versuchen.';
 }
 draw();
}
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
async function loadPmsOverview(){
 if(!D.connected)return;
 const [overview,coverage]=await Promise.allSettled([
  api('/pms/overview'),api('/pms/demo-coverage')
 ]);
 D.pmsOverview=overview.status==='fulfilled'?overview.value:null;
 D.pmsOverviewError=overview.status!=='fulfilled';
 D.pmsCoverage=coverage.status==='fulfilled'?coverage.value:null;
 D.pmsCoverageError=coverage.status!=='fulfilled';
 if(D.page==='quality')draw(true);
}
function go(where){window.MediIdentaIdentifiers?.stopCamera?.();D.page=where;D.scanMessage='';D.scanMatches=[];draw();if(where==='quality')loadPmsOverview();document.documentElement.scrollTop=0;}
async function connect(){if(IS_PUBLIC_PREVIEW){D.connected=false;D.meta=null;D.features={collaboration_enabled:false};D.attributions=[{source_key:'EU_UR',name:'European Commission – Union Register',license_code:'CC-BY-4.0',attribution_text:'Quellgebundene Produktidentitäten aus dem EU-Register.'},{source_key:'EMA_EPAR',name:'European Medicines Agency – EPAR',license_code:'EMA-REUSE-ATTRIBUTION',attribution_text:'Produktidentitäten und unabhängig formulierte Entwürfe mit EMA-Quellenverweisen.'}];draw();return;}try{D.meta=await api('/meta');D.connected=true;try{const f=await api('/features');D.features={collaboration_enabled:f.collaboration_enabled===true};}catch{D.features={collaboration_enabled:false};}try{const x=await api('/attributions');D.attributions=Array.isArray(x.sources)?x.sources:[];}catch{D.attributions=[];}}catch{D.meta=null;D.connected=false;D.attributions=[];D.features={collaboration_enabled:false};}if(D.page==='search')find(D.search);else if(D.page==='quality')loadPmsOverview();else draw();}
let debounce;
document.addEventListener('click',e=>{const b=e.target.closest('[data-nav],[data-action],[data-filter]');if(!b)return;if(b.dataset.nav){go(b.dataset.nav);return;}if(b.dataset.filter){D.hits=b.dataset.filter==='fav'?D.offline.filter(x=>D.favorites.includes(x.id)):localSearch(D.search);draw();return;}const a=b.dataset.action;if(a==='detail')openProduct(b.dataset.id);else if(a==='pms-inline')openPms(b.dataset.id,'search');else if(a==='search-next'){D.searchPage++;find(D.search);}else if(a==='search-prev'){D.searchPage=Math.max(0,D.searchPage-1);find(D.search);}else if(a==='fav'){const id=b.dataset.id;D.favorites=D.favorites.includes(id)?D.favorites.filter(x=>x!==id):[id,...D.favorites];try{localStorage.setItem('medidenta_favs_v04',JSON.stringify(D.favorites))}catch{}draw();}else if(a==='compare'){const id=b.dataset.id;D.compare=D.compare.includes(id)?D.compare.filter(x=>x!==id):[...D.compare,id].slice(-2);draw();}else if(a==='compare-clear'){D.compare=[];D.compareDetails={};draw();}else if(a==='compare-view')showCompare();else if(a==='pzn')identify();else if(a==='photo')picker.click();else if(a==='reconnect')connect();else if(a==='sync-check')checkForCatalogUpdates(true);});
document.addEventListener('input',e=>{if(e.target.id!=='search')return;D.search=e.target.value;D.searchPage=0;D.searchHasMore=false;D.pmsSearchHits=[];clearTimeout(debounce);debounce=setTimeout(()=>find(D.search),220)});
document.addEventListener('submit',e=>{const form=e.target.closest('form[data-pms-review-field]');if(!form)return;e.preventDefault();submitPmsField(form);});
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
