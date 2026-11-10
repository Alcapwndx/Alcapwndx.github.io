"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),window={};
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
 /Nicht übersetzter EMA-Code/);
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
assert.match(app,/pms-raw-disclosure/);
assert.match(app,/pmsInlineSearch/);
assert.match(app,/Promise\.allSettled/);
assert.match(app,/MediIdentaReviewUI\?\.details/);
const ui=fs.readFileSync(path.join(dir,'review-ui.js'),'utf8');
assert.match(ui,/groupFacts\(records\)/);
assert.match(ui,/grouped-fact-item/);
console.log('MediIdenta grouped clinical facts and human-readable FHIR: PASS');
