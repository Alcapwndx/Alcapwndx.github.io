/* MediIdenta v0.14 – presentation only.
   Groups duplicate text for readability, but never combines underlying approval
   IDs or declares product identities equivalent. No clinical release logic. */
(function(global){
'use strict';
const text=x=>String(x==null?'':x);
const clean=x=>text(x).normalize('NFKC').replace(/\s+/gu,' ').trim();
const fingerprint=x=>clean(x).toLocaleLowerCase('de');
const TYPE_LABELS={
  summary:'Kurzbeschreibung',indication:'Indikationen',mechanism:'Wirkmechanismus',
  warning:'Warnhinweise',contraindication:'Kontraindikationen',
  adverse_effect:'Nebenwirkungen',interaction:'Wechselwirkungen',
  renal:'Nierenfunktion',hepatic:'Leberfunktion',pregnancy:'Schwangerschaft',
  administration:'Anwendung',monitoring:'Überwachung',good_to_know:'Gut zu wissen'
};
const PMS_LABELS={
  product_names:'Produktnamen',product_identifiers:'Produktkennungen (keine bestätigte PZN)',
  product_status_codes:'Produktstatus',classification:'Klassifizierung',
  combined_dose_form:'Arzneiformen',authorised_dose_forms:'Zugelassene Arzneiformen',
  package_identifiers_not_pzn:'Packungskennungen (keine bestätigte PZN)',
  package_descriptions:'Packungsinformationen',package_size_raw:'Packungsgrößen (Rohangaben)',
  authorization_identifiers:'Zulassungskennungen',
  authorization_region_codes:'Zulassungsgebiete',
  authorization_status_raw:'Zulassungsstatus',
  administrable_dose_form:'Anwendbare Arzneiformen',
  administration_routes:'Applikationswege',manufactured_dose_form:'Herstellungsarzneiformen',
  ingredient_role_codes:'Rolle des Inhaltsstoffs',substance_identity_raw:'Stoffbezeichnungen',
  strength_raw_no_dose_conversion:'Wirkstärken und Bezugsgrößen',
  clinical_use_type_unverified:'Klinische Kategorien der Quelle (ungeprüft)',
  clinical_use_subjects_unverified:'Quellverknüpfungen (ungeprüft)',
  clinical_use_status_unverified:'Klinischer Quellenstatus (ungeprüft)'
};
const PMS_SECTION={
 product_names:'Produktidentität (Quellangaben)',
 product_identifiers:'Produktidentität (Quellangaben)',
 product_status_codes:'Produktidentität (Quellangaben)',
 classification:'Produktidentität (Quellangaben)',
 combined_dose_form:'Arzneiformen und Anwendung',
 authorised_dose_forms:'Arzneiformen und Anwendung',
 administrable_dose_form:'Arzneiformen und Anwendung',
 manufactured_dose_form:'Arzneiformen und Anwendung',
 administration_routes:'Arzneiformen und Anwendung',
 substance_identity_raw:'Wirkstoffe und Stärken',
 ingredient_role_codes:'Wirkstoffe und Stärken',
 strength_raw_no_dose_conversion:'Wirkstoffe und Stärken',
 package_descriptions:'Packungsinformationen',
 package_identifiers_not_pzn:'Packungsinformationen',
 package_size_raw:'Packungsinformationen',
 authorization_identifiers:'Zulassung',
 authorization_region_codes:'Zulassung',
 authorization_status_raw:'Zulassung',
 clinical_use_type_unverified:'Klinische Quellmetadaten – ohne Fachtext',
 clinical_use_subjects_unverified:'Klinische Quellmetadaten – ohne Fachtext',
 clinical_use_status_unverified:'Klinische Quellmetadaten – ohne Fachtext'
};
const KEY_LABELS={
 text:'Text',name:'Name',productName:'Produktname',part:'Namensbestandteil',
 value:'Wert',unit:'Einheit',code:'Quellcode (ungeprüft)',system:'Kennungssystem',
 reference:'Quellverweis',display:'Bezeichnung',type:'Typ',status:'Status',
 identifier:'Kennung',numerator:'Zähler',denominator:'Bezugsgröße',
 presentationRatio:'Wirkstärke je Darreichungsform',
 concentrationRatio:'Konzentration je Bezugsgröße',
 strength:'Wirkstärke',quantity:'Menge',form:'Arzneiform',
 routeOfAdministration:'Anwendungsweg',target:'Bezugsangabe',
 item:'Eintrag',coding:'Klassifikation',substance:'Stoff',
 organization:'Organisation',legalStatusOfSupply:'Abgabestatus',
 country:'Land',region:'Region',role:'Rolle',id:'Quellkennung'
};
function sortedJson(v){
 if(Array.isArray(v))return '['+v.map(sortedJson).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+sortedJson(v[k])).join(',')+'}';
 return JSON.stringify(v);
}
function groupClinical(facts,perProduct=false){
 const groups=new Map();
 for(const f of facts||[]){
  if(!f||!f.fact_type||typeof f.content_text!=='string'||!clean(f.content_text))continue;
  // One product's tabs can group by type. Global knowledge view additionally
  // requires matching target and linked IDs; never merge across products.
  const owner=perProduct?'':[
    text(f.target_type),text(f.target_name),
    [...(Array.isArray(f.linked_product_ids)?f.linked_product_ids:[])].sort().join('|')
  ].join('\u0001');
  const key=owner+'\u0002'+text(f.fact_type);
  if(!groups.has(key))groups.set(key,{
   type:f.fact_type, title:TYPE_LABELS[f.fact_type]||f.fact_type,
   target_name:f.target_name||'',records:[],items:[],_items:new Map()
  });
  const group=groups.get(key);
  group.records.push(f);
  const contentKey=fingerprint(f.content_text);
  if(!group._items.has(contentKey)){
   const item={text:clean(f.content_text),records:[]};
   group._items.set(contentKey,item);group.items.push(item);
  }
  group._items.get(contentKey).records.push(f);
 }
 return [...groups.values()].map(g=>{
  delete g._items;
  g.reviewed=g.records.filter(r=>r.editorial_status==='clinically_reviewed').length;
  g.unreviewed=g.records.length-g.reviewed;
  g.duplicates=g.records.length-g.items.length;
  return g;
 });
}
function groupPms(fields){
 const groups=new Map();
 for(const f of fields||[]){
  if(!f||!f.attribute_key)continue;
  const title=PMS_SECTION[f.attribute_key]||'Weitere PMS-Quellangaben';
  if(!groups.has(title))groups.set(title,{title,items:[],_values:new Map(),records:[]});
  const group=groups.get(title);
  group.records.push(f);
  // Only collapse identical values from the SAME FHIR attribute type.
  // Distinct strengths, units, ingredients, sources and FHIR paths remain separate.
  const key=f.attribute_key+'\u0001'+sortedJson(f.value_json);
  if(!group._values.has(key)){
   const item={attribute_key:f.attribute_key,title:PMS_LABELS[f.attribute_key]||f.attribute_key,
      value:f.value_json,records:[]};
   group._values.set(key,item);group.items.push(item);
  }
  group._values.get(key).records.push(f);
 }
 return [...groups.values()].map(g=>{
  delete g._values;
  g.reviewed=g.records.filter(r=>r.editorial_status==='clinically_reviewed').length;
  g.unreviewed=g.records.length-g.reviewed;
  g.duplicates=g.records.length-g.items.length;
  return g;
 });
}
function stringValue(v){return v===true?'Ja':v===false?'Nein':text(v);}
function displayPms(v,depth=0){
 if(v===null||v===undefined||v==='')return 'Nicht angegeben';
 if(depth>8)return 'Weitere technische Unterangaben vorhanden';
 if(Array.isArray(v)){
  const xs=v.map(x=>displayPms(x,depth+1)).filter(s=>s&&s!=='Nicht angegeben');
  return xs.join('\n')||'Nicht angegeben';
 }
 if(typeof v!=='object')return stringValue(v);
 if('numerator' in v&&'denominator' in v)
  return displayPms(v.numerator,depth+1)+' je '+displayPms(v.denominator,depth+1)+' (Quellverhältnis, keine Dosisempfehlung)';
 if('value' in v && (v.unit||v.code) && typeof v.value!=='object')
  return text(v.value)+' '+text(v.unit||v.code);
 if(typeof v.productName==='string'){
  const parts=[v.productName];
  if(Array.isArray(v.namePart))parts.push(...v.namePart.map(x=>displayPms(x,depth+1)));
  return parts.join(' · ');
 }
 if(Array.isArray(v.coding)){
  const names=v.coding.map(x=>(x&&typeof x==='object')?
       (x.display||('Quellcode '+text(x.code||'unbekannt')+' (nicht interpretiert)')):'').filter(Boolean);
  return [v.text, ...names].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' · ')||'Klassifikation ohne lesbare Bezeichnung';
 }
 if(typeof v.display==='string')return v.display;
 if(typeof v.text==='string' && Object.keys(v).every(k=>['text','coding','id'].includes(k)))return v.text;
 if(typeof v.reference==='string' && Object.keys(v).every(k=>['reference','type','identifier','display'].includes(k)))
  return v.display||'FHIR-Quellverweis: '+v.reference;
 if(typeof v.value==='string' && typeof v.system==='string')
  return 'Kennung '+v.value+' (Codesystem: '+v.system+'; Zuordnung nicht geprüft)';
 if(typeof v.valueCodeableConcept==='object')
  return displayPms(v.valueCodeableConcept,depth+1);
 const lines=[];
 for(const [key,val] of Object.entries(v)){
  if(val===null||val===undefined||val===''||(Array.isArray(val)&&!val.length))continue;
  const label=KEY_LABELS[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2');
  const value=displayPms(val,depth+1);
  if(value==='Nicht angegeben')continue;
  lines.push(label+': '+value);
 }
 return lines.join('\n')||'Keine verständliche Quellangabe vorhanden';
}
global.MediIdentaPresentation={groupClinical,groupPms,displayPms,
  TYPE_LABELS,PMS_LABELS,PMS_SECTION,clean};
if(typeof module!=='undefined'&&module.exports)module.exports=global.MediIdentaPresentation;
})(typeof window!=='undefined'?window:globalThis);
