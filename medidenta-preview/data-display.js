/* MediIdenta v0.14: human-readable FHIR source fields and lossless visual grouping.
   This module changes PRESENTATION ONLY. Every original field/fact and its
   exact SHA-256/reviewer action remain individually accessible and auditable. */
(function(global){
'use strict';
const norm=x=>String(x??'').normalize('NFKC').replace(/[\u00a0\s]+/g,' ').trim().toLocaleLowerCase('de');
const unique=x=>[...new Set(x.map(v=>String(v??'').trim()).filter(Boolean))];
const TYPES={summary:'Kurzbeschreibung',indication:'Indikation',mechanism:'Wirkmechanismus',warning:'Warnhinweise',contraindication:'Kontraindikationen',adverse_effect:'Nebenwirkungen',interaction:'Wechselwirkungen',renal:'Nierenfunktion',hepatic:'Leberfunktion',pregnancy:'Schwangerschaft',administration:'Anwendung',monitoring:'Überwachung',good_to_know:'Good-to-Know'};
const riskOrder={critical:0,high:1,normal:2};
const PMS_LABELS={
 product_names:'Produktnamen laut EMA',product_identifiers:'Produktkennungen',
 product_status_codes:'EMA-Datensatzstatus (nicht Zulassungsstatus)',classification:'Klassifizierung',
 combined_dose_form:'Arzneiform',authorised_dose_forms:'Zugelassene Arzneiformen',
 package_identifiers_not_pzn:'Packungskennungen – keine bestätigte PZN',
 package_descriptions:'Packungsangaben',package_size_raw:'Packungsmenge',
 authorization_identifiers:'Zulassungskennungen',authorization_region_codes:'Zulassungsgebiet',
 legal_status_of_supply:'Rechtlicher Abgabestatus laut EMA (nicht deutsche Verschreibungspflicht)',
 marketing_status_raw:'Vermarktungsstatus laut Quelle',regulatory_entitlement_type:'Art der regulatorischen Berechtigung',
 product_domain:'Anwendungsbereich (Human-/Tierarzneimittel)',
 authorization_status_raw:'Status der regulatorischen Berechtigung',administrable_dose_form:'Arzneiform zur Anwendung',
 administration_routes:'Applikationswege',manufactured_dose_form:'Herstellungsarzneiform',
 ingredient_role_codes:'Stoffrolle',substance_identity_raw:'Stoffbezeichnungen laut Quelle',
 strength_raw_no_dose_conversion:'Wirkstärke laut Quelle (keine Dosisempfehlung)',
 clinical_use_type_unverified:'Arten klinischer Hinweise – Inhalte nicht freigegeben',
 clinical_use_subjects_unverified:'FHIR-Produktreferenzen – Zuordnung ungeprüft',
 clinical_use_status_unverified:'Quellstatus klinischer Informationen'
};
const TYPE_HINTS={warning:'Warnhinweis (nur FHIR-Kategorie)',indication:'Indikation (nur FHIR-Kategorie)',contraindication:'Kontraindikation (nur FHIR-Kategorie)',interaction:'Wechselwirkung (nur FHIR-Kategorie)',undesirableEffect:'Nebenwirkung (nur FHIR-Kategorie)',undesirable_effect:'Nebenwirkung (nur FHIR-Kategorie)'};

function sourceCode(v,kind){
 const code=typeof v?.code==='string'&&v.code.trim()?v.code.trim():null;
 const resolved=code?global.MediIdentaRmsCodes?.resolve?.(code,v.system,kind):null;
 if(resolved)return resolved.de||resolved.en;
 const label=typeof v?.display==='string'&&v.display.trim()?v.display.trim():
  typeof v?.text==='string'&&v.text.trim()?v.text.trim():null;
 if(label)return label;
 return code?'Nicht aufgelöster EMA-Code: '+code:null;
}
function readableConcept(v,kind){
 if(!v||typeof v!=='object')return [];
 if(v.concept&&typeof v.concept==='object')return readableConcept(v.concept,kind);
 const named=Array.isArray(v.coding)?
   unique(v.coding.map(x=>sourceCode(x,kind))):
   [];
 if(named.length)return named;
 if(typeof v.text==='string'&&v.text.trim())return [v.text.trim()];
 const single=sourceCode(v,kind);return single?[single]:[];
}
function quantity(v){
 if(!v||typeof v!=='object'||v.value===null||v.value===undefined)return null;
 const number=typeof v.value==='number'&&Number.isFinite(v.value)?String(v.value):
  typeof v.value==='string'&&v.value.trim()?v.value.trim():null;
 if(!number)return null;
 const rawCode=typeof v.code==='string'?v.code.trim():'';
 const originalUnit=typeof v.unit==='string'?v.unit.trim():'';
 const rms=rawCode?global.MediIdentaRmsCodes?.resolveUnit?.(rawCode,v.system):null;
 // Keep the original quantity and denominator exactly. Never calculate or
 // convert any dose, and never infer that an unknown numeric code means mg.
 const unit=rms?.de||rms?.en||
  (originalUnit&&!/^[0-9]{9,15}$/.test(originalUnit)?originalUnit:'')||
  (rawCode&&!/^[0-9]{9,15}$/.test(rawCode)?rawCode:'');
 return number+(unit?' '+unit:
  (rawCode||originalUnit?' [Einheit nicht aufgelöst: '+(rawCode||originalUnit)+']':''));
}
function ratio(v){
 if(!v||typeof v!=='object')return null;
 const n=quantity(v.numerator),d=quantity(v.denominator);
 return n&&d?n+' je '+d:(n? n+' (Bezugsgröße aus Quelle prüfen)':null);
}
function strength(v){
 if(!v||typeof v!=='object')return [];
 const parts=[
  ['presentationRatio','Wirkstärke'],['concentrationRatio','Konzentration'],
  ['strengthRatio','Wirkstärke'],['presentationQuantity','Menge'],
  ['concentrationQuantity','Konzentration']
 ];
 const out=[];
 for(const [k,label] of parts){
  const data=v[k];if(data===undefined||data===null)continue;
  const vals=Array.isArray(data)?data:[data];
  for(const q of vals){const formatted=k.endsWith('Ratio')?ratio(q):quantity(q);
   if(formatted)out.push(label+': '+formatted);}
 }
 return out;
}
function formatSingle(v,kind,depth=0){
 if(v===null||v===undefined||depth>6)return [];
 if(Array.isArray(v))return unique(v.flatMap(x=>formatSingle(x,kind,depth+1)));
 if(typeof v==='number'&&Number.isFinite(v))return formatSingle(String(v),kind,depth+1);
 if(typeof v==='boolean')return [v?'Ja':'Nein'];
 if(typeof v==='string'){
  const s=v.trim();if(!s)return [];
  if(kind==='clinical_use_type_unverified')return [TYPE_HINTS[s]||'FHIR-Kategorie: '+s+' (ungeprüft)'];
  const known=global.MediIdentaRmsCodes?.resolve?.(s,null,kind);
  if(known)return [known.de||known.en];
  if(/^[0-9]{8,15}$/.test(s))return ['Nicht aufgelöster EMA-Code: '+s];
  return [s];
 }
 if(typeof v!=='object')return [];
 if(kind==='product_names'){
  if(typeof v.productName==='string'&&v.productName.trim())return [v.productName.trim()];
  return ['Produktname: Quelle ohne Klartext'];
 }
 if(kind==='product_identifiers'||kind==='package_identifiers_not_pzn'||kind==='authorization_identifiers'){
  if(typeof v.value==='string'&&v.value.trim()){
   const name=readableConcept(v.type,kind)[0];
   return [(name?name+': ':'EMA-Quellkennung: ')+v.value.trim()+
     (kind==='package_identifiers_not_pzn'?' (nicht als PZN bestätigt)':'')];
  }
 }
 if(kind==='strength_raw_no_dose_conversion'){
  const x=strength(v);if(x.length)return x;
 }
 if(kind==='package_size_raw'){
  const q=quantity(v);if(q)return [q];
 }
 if(kind==='clinical_use_subjects_unverified'&&typeof v.reference==='string')
  return ['FHIR-Referenz: '+v.reference+' (Zuordnung nicht bestätigt)'];
 if(typeof v.description==='string'&&v.description.trim())return [v.description.trim()];
 if(typeof v.display==='string'&&v.display.trim())return [sourceCode(v,kind)||v.display.trim()];
 if(typeof v.reference==='string'&&v.reference.trim())return ['FHIR-Referenz: '+v.reference.trim()];
 if(typeof v.code==='string'&&v.code.trim())return [sourceCode(v,kind)];
 if(v.concept||v.coding||v.text){
  const c=readableConcept(v,kind);if(c.length)return c;
 }
 if(v.presentationRatio||v.concentrationRatio||v.strengthRatio||v.presentationQuantity||v.concentrationQuantity){
  const x=strength(v);if(x.length)return x;
 }
 if(v.code&&typeof v.code==='object'){
  const out=formatSingle(v.code,kind,depth+1);if(out.length)return out;
 }
 if(v.role&&typeof v.role==='object'){
  const out=formatSingle(v.role,kind,depth+1);if(out.length)return out;
 }
 if(v.route&&typeof v.route==='object'){
  const out=formatSingle(v.route,kind,depth+1);if(out.length)return out;
 }
 if(v.routeOfAdministration){
  const out=formatSingle(v.routeOfAdministration,kind,depth+1);if(out.length)return out;
 }
 if(v.valueCodeableConcept){const out=formatSingle(v.valueCodeableConcept,kind,depth+1);if(out.length)return out;}
 // Do not invent meanings of unknown coded attributes. Raw original remains
 // available in a disclosure and the EMA source stays directly linked.
 return ['Weitere strukturierte Angabe – Originalquelle ansehen'];
}
function formatPms(f){
 const value=f?.value_json;
 const lines=unique(formatSingle(value,f?.attribute_key));
 return lines.length?lines:['Quellangabe vorhanden – Originaldaten prüfen'];
}
function groupFacts(facts){
 const topics=new Map();
 for(const f of Array.isArray(facts)?facts:[]){
  if(!f||typeof f!=='object')continue;
  const topic=String(f.fact_type||'other');
  if(!topics.has(topic))topics.set(topic,{type:topic,label:TYPES[topic]||topic,items:[],index:new Map()});
  const g=topics.get(topic);
  const key=norm(f.content_text)||'__empty__:'+String(f.id||g.items.length);
  let item=g.index.get(key);
  if(!item){
   item={text:String(f.content_text||''),records:[]};
   g.index.set(key,item);g.items.push(item);
  }
  item.records.push(f);
  if(f.editorial_status==='clinically_reviewed')
   item.text=String(f.content_text||''); // prefer editorially checked spelling, never change content
 }
 return [...topics.values()].map(g=>({
  type:g.type,label:g.label,
  items:g.items.map(x=>({
   text:x.text,records:x.records,
   reviewed:x.records.filter(r=>r.editorial_status==='clinically_reviewed').length,
   risk:x.records.reduce((best,r)=>{
    const rank=riskOrder[r.risk_level]??3;
    return rank<(riskOrder[best]??3)?r.risk_level:best;
   },'unspecified'),
  }))
 })).sort((a,b)=>(a.type==='warning'?-1:0)-(b.type==='warning'?-1:0)||
  a.label.localeCompare(b.label,'de'));
}
function groupPmsFields(fields){
 const topics=new Map();
 for(const f of Array.isArray(fields)?fields:[]){
  if(!f||typeof f!=='object')continue;
  const key=String(f.attribute_key||'unknown');
  if(!topics.has(key))topics.set(key,{key,label:PMS_LABELS[key]||'EMA-Quellfeld: '+key,items:[],records:[],index:new Map()});
  const g=topics.get(key);g.records.push(f);
  for(const text of formatPms(f)){
   const normalized=norm(text);
   let item=g.index.get(normalized);
   if(!item){item={text,records:[]};g.items.push(item);g.index.set(normalized,item);}
   // Preserve all source records, admin review IDs, SHA-256 and differing
   // relationship states even when display text is identical.
   if(!item.records.some(r=>r.id===f.id))item.records.push(f);
  }
 }
 return [...topics.values()].map(g=>({key:g.key,label:g.label,items:g.items,
  records:g.records,source_count:g.records.length})).sort((a,b)=>
  a.label.localeCompare(b.label,'de'));
}
// A broader visual topic combines related PMS keys in ONE card.
// Each field keeps its own key, source IDs and individual admin review action.
const PMS_TOPICS={
 product_names:'Produktidentität und Kennungen',
 product_identifiers:'Produktidentität und Kennungen',
 product_status_codes:'Produktidentität und Kennungen',
 classification:'Produktidentität und Kennungen',
 combined_dose_form:'Arzneiform und Anwendung',
 authorised_dose_forms:'Arzneiform und Anwendung',
 administrable_dose_form:'Arzneiform und Anwendung',
 manufactured_dose_form:'Arzneiform und Anwendung',
 administration_routes:'Arzneiform und Anwendung',
 substance_identity_raw:'Wirkstoffe und Wirkstärken',
 ingredient_role_codes:'Wirkstoffe und Wirkstärken',
 strength_raw_no_dose_conversion:'Wirkstoffe und Wirkstärken',
 package_identifiers_not_pzn:'Packung und Inhalt',
 package_descriptions:'Packung und Inhalt',
 package_size_raw:'Packung und Inhalt',
 authorization_identifiers:'Zulassung und Status',
 authorization_region_codes:'Zulassung und Status',
 authorization_status_raw:'Zulassung und Status',
 clinical_use_type_unverified:'Klinische Quellkategorien (keine Fachtexte)',
 clinical_use_subjects_unverified:'Klinische Quellkategorien (keine Fachtexte)',
 clinical_use_status_unverified:'Klinische Quellkategorien (keine Fachtexte)'
};
function groupPmsSections(fields){
 const buckets=new Map();
 for(const group of groupPmsFields(fields)){
  const title=PMS_TOPICS[group.key]||'Weitere Quellenangaben';
  if(!buckets.has(title))buckets.set(title,{
   title,groups:[],records:[],unique_items:0
  });
  const section=buckets.get(title);
  section.groups.push(group);
  section.records.push(...group.records);
  section.unique_items+=group.items.length;
 }
 return [...buckets.values()];
}
global.MediIdentaDisplay={groupFacts,groupPmsFields,groupPmsSections,formatPms,norm,TYPES,PMS_LABELS};
})(window);
