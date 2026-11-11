"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dir=path.resolve(__dirname,'..');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(dir,'data-display.js'),'utf8'),{window,console},{filename:'data-display.js'});
vm.runInNewContext(fs.readFileSync(path.join(dir,'review-ui.js'),'utf8'),{window,URL,console},{filename:'review-ui.js'});
const ui=window.MediIdentaReviewUI;
const ref={document_url:'https://www.ema.europa.eu/en/medicines/human/EPAR/toujeo',document_title:'EMA – Toujeo',locator:'SmPC 4.1'};
const draft={id:'draft1',target_name:'Toujeo',target_type:'product',fact_type:'summary',risk_level:'normal',content_text:'EMA-bezogene Übungsaussage.',editorial_status:'draft_unreviewed',assignment_status:'exact_match',linked_product_ids:['p1'],reference:ref};
const reviewed={...draft,id:'review1',content_text:'Weitere quellenbezogene Übungsaussage.',editorial_status:'clinically_reviewed'};
const data={drafts:[draft],approved:[reviewed],draftLoadError:false};
const details=ui.details(data,{id:'p1'});
assert.equal((details.match(/data-fact-topic="summary"/g)||[]).length,1);
assert.match(details,/EMA-bezogene Übungsaussage/);
assert.match(details,/Weitere quellenbezogene Übungsaussage/);
assert.doesNotMatch(details,/Freigab|Prüfentscheidung|Fachlich validiert|Ungeprüft|data-editor-fact|reviewActionHtml|reference-disclosure/i);
assert.match(details,/Quellen & Nachweise/);
const refs=ui.sourceRecords(data,{id:'p1'});
assert.equal(refs.length,2);
assert.equal(refs[0].reference.locator,'SmPC 4.1');
const duplicateDraft={...draft,id:'draft-duplicate'};
const dedup=ui.details({drafts:[draft,duplicateDraft],approved:[]},{id:'p1'});
assert.equal((dedup.match(/EMA-bezogene Übungsaussage/g)||[]).length,1);
assert.match(dedup,/1 wortgleiche Einträge zusammengefasst/);
const otherProduct={...draft,id:'other',linked_product_ids:['p2']};
const isolated=ui.details({drafts:[otherProduct],approved:[]},{id:'p1'});
assert.doesNotMatch(isolated,/EMA-bezogene Übungsaussage/);
// A verified source chapter replaces only the matching legacy short view.
// All old source records remain accessible to the shared source dropdown.
const oldInteraction={...draft,id:'old-int',fact_type:'interaction',
 content_text:'Legacy synthetic interaction text.'};
const sourceBacked={id:'p1',smpc_sections:[
 {fact_type:'interaction',content_text:'Official original EMA test chapter.'}]};
assert.equal(ui.details({drafts:[oldInteraction],approved:[]},sourceBacked),'');
assert.equal(ui.sourceRecords({drafts:[oldInteraction],approved:[]},sourceBacked).length,1);
console.log('MediIdenta source-first clinical detail regression: PASS');
