"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),window={};
vm.runInNewContext(fs.readFileSync(path.join(dir,'rms-codes.js'),'utf8'),{window,console},{filename:'rms-codes.js'});
vm.runInNewContext(fs.readFileSync(path.join(dir,'data-display.js'),'utf8'),{window,console},{filename:'data-display.js'});
const {groupFacts,groupPmsFields,formatPms}=window.MediIdentaDisplay;

// ONE warning section per product; preserve all sources and per-fact review states.
const f1={id:'w1',fact_type:'warning',content_text:'Blutungsrisiko beachten.',editorial_status:'draft_unreviewed',risk_level:'high'};
const f2={...f1,id:'w2',content_text:'  BLUTUNGSRISIKO   beachten.  ',editorial_status:'clinically_reviewed'};
const f3={...f1,id:'w3',content_text:'Auf Wechselwirkungen achten.'};
const g=groupFacts([f1,f2,f3]);
assert.equal(g.length,1);
assert.equal(g[0].type,'warning');
assert.equal(g[0].items.length,2);
const duplicate=g[0].items.find(x=>x.records.length===2);
assert.ok(duplicate);
assert.equal(duplicate.reviewed,1);
assert.deepEqual([...duplicate.records.map(x=>x.id)],['w1','w2']);
assert.equal(groupFacts([{...f1,fact_type:'interaction',id:'i1'},f1]).length,2);

// Strict FHIR semantics: do not convert strengths to a dose or invent code labels.
const strength={attribute_key:'strength_raw_no_dose_conversion',value_json:[{
 presentationRatio:{numerator:{value:5,unit:'mg'},denominator:{value:1,unit:'Tablette'}}
}]};
assert.equal(formatPms(strength)[0],'Wirkstärke: 5 mg je 1 Tablette');
assert.equal(formatPms({attribute_key:'product_names',value_json:[{productName:'Testpräparat 5 mg'}]})[0],
 'Testpräparat 5 mg');
assert.equal(formatPms({attribute_key:'clinical_use_type_unverified',value_json:'warning'})[0],
 'Warnhinweis (nur FHIR-Kategorie)');
assert.match(formatPms({attribute_key:'administrable_dose_form',
 value_json:{coding:[{code:'999999',system:'https://spor.ema.europa.eu/list'}]}})[0],
 /Nicht aufgelöster EMA-Code/);
// EMA SPOR 100000073345: nasal, oral, intravenous; keep unknown code visible.
const route=code=>formatPms({attribute_key:'administration_routes',
 value_json:{coding:[{system:'http://spor.ema.europa.eu/v1/lists/100000073345',code}]}});
assert.equal(route('100000073615')[0],'Nasale Anwendung');
assert.equal(route('100000073619')[0],'Orale Anwendung');
assert.equal(route('100000073611')[0],'Intravenöse Anwendung');
assert.equal(formatPms({attribute_key:'administration_routes',value_json:'100000073633'})[0],
 'Subkutane Anwendung');
assert.equal(formatPms({attribute_key:'administration_routes',
 value_json:{code:'100000073615',system:'https://spor.ema.europa.eu/v1/lists/100000073345'}})[0],
 'Nasale Anwendung');
assert.match(route('01700009536')[0],/Nicht aufgelöster EMA-Code: 01700009536/);
assert.match(formatPms({attribute_key:'administration_routes',
 value_json:{coding:[{system:'http://example.org/unknown',
 code:'100000073615'}]}})[0],/Nicht aufgelöster EMA-Code/);
assert.equal(formatPms({attribute_key:'administrable_dose_form',
 value_json:{coding:[{system:'http://spor.ema.europa.eu/v1/lists/200000000004',
 code:'100000073665'}]}})[0],'Filmtablette');
assert.equal(formatPms({attribute_key:'authorised_dose_forms',
 value_json:'100000073664'})[0],'Tablette');

// EMA/SPOR controlled terminology v1.2.1. All maps are system-scoped.
const rms=window.MediIdentaRmsCodes;
const coding=(kind,list,code)=>formatPms({attribute_key:kind,value_json:{
 coding:[{system:'https://spor.ema.europa.eu/v1/lists/'+list,code}]}});
assert.equal(coding('product_status_codes','200000005003','200000005004')[0],
 'Aktueller Quelldatensatz');
assert.equal(coding('product_status_codes','200000005003','200000005005')[0],
 'Vorläufiger Quelldatensatz');
assert.equal(coding('authorization_status_raw','100000072049','100000072099')[0],
 'Regulatorische Berechtigung gültig laut Quelle');
assert.equal(coding('authorization_status_raw','100000072049','100000072122')[0],
 'Ruhend');
assert.equal(coding('authorization_region_codes','100000000002','100000000403')[0],
 'Deutschland');
assert.equal(coding('authorization_region_codes','100000000002','100000000390')[0],
 'Europäische Union');
assert.equal(coding('ingredient_role_codes','100000072050','100000072072')[0],
 'Wirkstoff');
assert.equal(coding('ingredient_role_codes','100000072050','100000072082')[0],
 'Hilfsstoff');
assert.equal(coding('legal_status_of_supply','100000072051','100000072084')[0],
 'Verschreibungspflichtig laut Quelle');
assert.equal(coding('marketing_status_raw','100000072052','100000072083')[0],
 'Im Handel laut Quelle');
assert.equal(coding('product_domain','100000000004','100000000012')[0],
 'Humanarzneimittel');
assert.equal(coding('regulatory_entitlement_type','220000000060','220000000061')[0],
 'Arzneimittelzulassung');
assert.equal(coding('ingredient_role_codes','220000000000','220000000004')[0],
 'Stärkenangabe im Produktnamen'); // Interpret the SOURCE system, not the field label.
assert.equal(formatPms({attribute_key:'ingredient_role_codes',
 value_json:{coding:[{system:'http://hl7.org/fhir/ingredient-role',
 code:'100000072073'}]}})[0],'Adjuvans');

// WRONG system, unknown code, and ambiguous kind are NEVER guessed.
assert.equal(rms.resolve('100000072072','http://example.org/wrong','ingredient_role_codes'),null);
assert.equal(rms.resolve('200000005004','http://spor.ema.europa.eu/v1/lists/100000072049',
 'product_status_codes'),null);
assert.equal(rms.resolve('200000005004',null,'authorization_status_raw'),null);
assert.equal(rms.resolve('100000072099',null,'product_status_codes'),null);
assert.equal(rms.resolve('100000000403',null,'classification'),null);
assert.equal(rms.resolve('100000110655',null,'strength_raw_no_dose_conversion'),null);
assert.equal(rms.resolve('100000110655','http://unitsofmeasure.org',
 'strength_raw_no_dose_conversion'),null);
assert.match(coding('product_status_codes','100000072049','200000005004')[0],
 /Nicht aufgelöster EMA-Code: 200000005004/);
assert.match(coding('authorization_region_codes','100000000002','100000000999')[0],
 /Nicht aufgelöster EMA-Code/);
assert.match(formatPms({attribute_key:'substance_identity_raw',
 value_json:{coding:[{system:'https://spor.ema.europa.eu/v1/lists/100000072050',
 code:'100000072072',display:'EMA display'}]}})[0],/Wirkstoff/);
assert.equal(rms.version,'EMA PMS IG v1.2.1 / 2026-06-26');
assert.equal(formatPms({attribute_key:'product_status_codes',
 value_json:{coding:[{code:200000005004}]}})[0],'Aktueller Quelldatensatz');
assert.equal(formatPms({attribute_key:'authorization_status_raw',value_json:'100000072099'})[0],
 'Regulatorische Berechtigung gültig laut Quelle');
assert.equal(formatPms({attribute_key:'authorization_region_codes',value_json:{
 coding:[{code:'999999999999',system:'http://spor.ema.europa.eu/v1/lists/100000000002'}],
 text:'Deutschland (EMA Quelltext)'}})[0],'Deutschland (EMA Quelltext)');
assert.equal(formatPms({attribute_key:'ingredient_role_codes',value_json:'100000072072'})[0],
 'Wirkstoff');


// FHIR Quantity: translate the UNIT CODE, not the dose or reference amount.
const rmsUnit=(num,code,system='http://spor.ema.europa.eu/v1/lists/100000110633')=>
 formatPms({attribute_key:'package_size_raw',
 value_json:{value:num,code,system}})[0];
assert.equal(rmsUnit(5,'100000110655'),'5 mg');
assert.equal(rmsUnit(0.5,'100000110656'),'0.5 µg');
assert.equal(rmsUnit(2,'100000110662'),'2 ml');
assert.equal(rmsUnit(100,'100000110671'),'100 I.E.');
assert.match(rmsUnit(5,'100000110655','https://example.org/other'),
 /5 \[Einheit nicht aufgelöst: 100000110655\]/);
assert.match(rmsUnit(5,'100000110999'),/Einheit nicht aufgelöst/);
assert.equal(rmsUnit(5,'mg','http://unitsofmeasure.org'),'5 mg');
assert.equal(formatPms({attribute_key:'strength_raw_no_dose_conversion',value_json:{
 presentationRatio:{numerator:{value:5,code:'100000110655',
 system:'http://spor.ema.europa.eu/v1/lists/100000110633'},
 denominator:{value:1,unit:'Tablette'}}}})[0],'Wirkstärke: 5 mg je 1 Tablette');

// No implicit therapeutic equivalence or German regulatory assertion.
assert.doesNotMatch(coding('authorization_status_raw','100000072049','100000072099')[0],
 /Deutschland|lieferbar|verschreibungspflichtig/i);
assert.doesNotMatch(coding('product_status_codes','200000005003','200000005004')[0],
 /zugelassen/i);

// Complete displayed public PMS metadata, without inventing regulatory claims.
const market=formatPms({attribute_key:'marketing_status_raw',value_json:[{
 status:{coding:[{system:'http://spor.ema.europa.eu/v1/lists/100000072052',
 code:'100000072083'}]},
 country:{coding:[{system:'http://spor.ema.europa.eu/v1/lists/100000000002',
 code:'100000000403'}]},
 dateRange:{start:'2026-01-01',end:'2026-12-31'}
}]});
assert.match(market[0],/Vermarktungsstatus: Im Handel laut Quelle/);
assert.match(market[0],/Gebiet: Deutschland/);
assert.match(market[0],/2026-01-01 bis 2026-12-31/);
assert.equal(formatPms({attribute_key:'authorization_validity_raw',
 value_json:{start:'2026-01-01',end:'2026-12-31'}})[0],
 'Zeitraum: 2026-01-01 bis 2026-12-31');
assert.match(formatPms({attribute_key:'authorization_holder_raw',
 value_json:{reference:'Organization/OMS123',display:'Beispiel GmbH'}})[0],
 /Beispiel GmbH.*Organization\/OMS123.*nicht unabhängig bestätigt/);
assert.equal(formatPms({attribute_key:'package_quantity_raw',value_json:2})[0],'2');
assert.equal(formatPms({attribute_key:'package_type_raw',
 value_json:{text:'Schachtel'}})[0],'Schachtel');
assert.equal(formatPms({attribute_key:'product_domain',value_json:{
 coding:[{system:'http://spor.ema.europa.eu/v1/lists/100000000004',
 code:'100000000012'}]}})[0],'Humanarzneimittel');
const pending=window.MediIdentaDisplay.terminologyReport([
 {attribute_key:'administration_routes',value_json:'01700009536'},
 {attribute_key:'administration_routes',value_json:'01700009536'},
 {attribute_key:'administration_routes',value_json:'100000073615'},
 {attribute_key:'strength_raw_no_dose_conversion',
  value_json:{concentrationQuantity:{value:5,system:'http://example.org/invalid',
   code:'100000110655'}}}
]);
assert.equal(pending.total_fields,4);
assert.equal(pending.fields_with_unknown_codes,3);
assert.equal(pending.code_types_unknown,2);
assert.equal(pending.examples[0].code,'01700009536');
assert.equal(pending.examples[0].count,2);
// The exact source id and SHA must still be in each unmerged record.
assert.ok(window.MediIdentaDisplay.PMS_LABELS.authorization_holder_raw);
const extraSections=window.MediIdentaDisplay.groupPmsSections([
 {id:'pack',attribute_key:'package_material_raw',value_json:{text:'Glas'}},
 {id:'holder',attribute_key:'authorization_holder_raw',
  value_json:{reference:'Organization/OMS1'}}
]);
assert.ok(extraSections.some(x=>x.title==='Packung und Inhalt'));
assert.ok(!extraSections.some(x=>x.title==='Zulassungskennungen'),
 'An authorization holder reference must not appear in the compact approval area.');

const sourceFields=[
 {id:'pms_name',attribute_key:'product_names',value_json:[{productName:'Testpräparat'}],statement_sha256:'a'.repeat(64)},
 {id:'pms_domain',attribute_key:'product_domain',value_json:'Humanarzneimittel'},
 {id:'pms_identifier',attribute_key:'product_identifiers',value_json:[{value:'PRODUCT-ID-1'}]},
 {id:'pms_type',attribute_key:'product_type_codes',value_json:'OTHER'},
 {id:'pms_status',attribute_key:'product_status_codes',value_json:'OTHER'},
 {id:'pms_class',attribute_key:'classification',value_json:'OTHER'},
 {id:'pms_form',attribute_key:'combined_dose_form',value_json:{text:'Tablette'}},
 {id:'pms_authorised',attribute_key:'authorised_dose_forms',value_json:'Tablette'},
 {id:'pms_route',attribute_key:'administration_routes',value_json:'oral'},
 {id:'pms_admin_form',attribute_key:'administrable_dose_form',value_json:'Tablette'},
 {id:'pms_manuf_form',attribute_key:'manufactured_dose_form',value_json:'Tablette'},
 {id:'pms_auth',attribute_key:'authorization_identifiers',value_json:[{value:'EU/1/99/999'}]},
 {id:'pms_area',attribute_key:'authorization_region_codes',value_json:'EU'},
 {id:'pms_auth_status',attribute_key:'authorization_status_raw',value_json:'OTHER'},
 {id:'pms_auth_holder',attribute_key:'authorization_holder_raw',value_json:{reference:'Organization/TEST'}},
 {id:'pms_auth_legal',attribute_key:'legal_status_of_supply',value_json:'OTHER'},
 {id:'pms_market',attribute_key:'marketing_status_raw',value_json:'OTHER'},
 {id:'pms_auth_kind',attribute_key:'regulatory_entitlement_type',value_json:'OTHER'},
 {id:'pms_validity',attribute_key:'authorization_validity_raw',value_json:{start:'2026-01-01'}},
 {id:'pms_ingredient',attribute_key:'substance_identity_raw',value_json:'Testsubstanz'},
 {id:'pms_pack',attribute_key:'package_size_raw',value_json:{value:14,unit:'Tabletten'}},
 {id:'pms_clinical',attribute_key:'clinical_use_type_unverified',value_json:'warning'}
];
const displaySections=window.MediIdentaDisplay.groupPmsSections(sourceFields);
const keys=title=>displaySections.find(s=>s.title===title)?.groups.map(g=>g.key);
assert.deepEqual(Array.from(keys('Produktidentität')),['product_domain','product_names'].sort((a,b)=>
 window.MediIdentaDisplay.PMS_LABELS[a].localeCompare(window.MediIdentaDisplay.PMS_LABELS[b],'de')));
assert.deepEqual(Array.from(keys('Arzneiform')),['combined_dose_form']);
assert.deepEqual(Array.from(keys('Zulassungskennungen')),['authorization_identifiers']);
assert.ok(!displaySections.some(s=>['Produktidentität und Kennungen','Arzneiform und Anwendung',
 'Zulassung und Status'].includes(s.title)), 'Outdated section titles must be removed');
assert.deepEqual(Array.from(keys('Wirkstoffe und Wirkstärken')),['substance_identity_raw']);
assert.deepEqual(Array.from(keys('Packung und Inhalt')),['package_size_raw']);
assert.deepEqual(Array.from(keys('Klinische Quellkategorien (keine Fachtexte)')),
 ['clinical_use_type_unverified']);
// Full source records remain available for the existing final-source disclosure.
const allOriginalGroups=groupPmsFields(sourceFields);
assert.equal(allOriginalGroups.length,sourceFields.length);
assert.equal(allOriginalGroups.find(g=>g.key==='product_names').records[0].statement_sha256,'a'.repeat(64));
assert.ok(allOriginalGroups.some(g=>g.key==='authorization_holder_raw'));

const p1={id:'pms_a',attribute_key:'package_size_raw',value_json:[{value:14,unit:'Tabletten'}],
 resource_id:'box1',editorial_status:'draft_unreviewed'};
const p2={...p1,id:'pms_b',resource_id:'box2',editorial_status:'clinically_reviewed'};
const grouped=groupPmsFields([p1,p2,{...p1,id:'pms_c',attribute_key:'product_names',
 value_json:[{productName:'Testprodukt'}]}]);
assert.equal(grouped.length,2);
const packageGroup=grouped.find(x=>x.key==='package_size_raw');
assert.equal(packageGroup.items.length,1);
assert.equal(packageGroup.items[0].records.length,2);
assert.equal(packageGroup.records.length,2);
assert.equal(packageGroup.items[0].text,'14 Tabletten');

// Real UI contract: no user-facing mandatory JSON blocks as the primary display.
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
assert.match(app,/groupPmsSections/);
assert.match(app,/pms-readable-values/);
assert.match(app,/sourcesDisclosure/);
assert.match(app,/source-accordion/);
assert.doesNotMatch(app,/g\.records\.map\(f=>pmsSourceRecord\(f,admin\)\)/);
assert.doesNotMatch(app,/function pmsInlineSearch/);
assert.match(app,/embeddedPmsHtml/);
assert.match(app,/combineSearchHits/);
assert.doesNotMatch(app,/data-nav="pms"/);
assert.match(app,/Promise\.allSettled/);
assert.match(app,/MediIdentaReviewUI\?\.details/);
const ui=fs.readFileSync(path.join(dir,'review-ui.js'),'utf8');
assert.match(ui,/groupFacts\(records\)/);
assert.match(ui,/grouped-fact-item/);
console.log('MediIdenta grouped clinical facts and human-readable FHIR: PASS');
