"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'..','review-ui.js'),'utf8');
const window={};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..','data-display.js'),'utf8'),{window,console},{filename:'data-display.js'});
vm.runInNewContext(source,{window,URL,console},{filename:'review-ui.js'});
const ui=window.MediIdentaReviewUI;
const ref={document_url:'https://www.ema.europa.eu/en/medicines/human/EPAR/toujeo',document_title:'EMA – Toujeo',locator:'SmPC 4.1'};
const draft={id:'draft1',target_name:'Toujeo',target_type:'product',fact_type:'summary',risk_level:'normal',content_text:'Wird fachlich erst geprüft.',editorial_status:'draft_unreviewed',assignment_status:'exact_match',linked_product_ids:['p1'],reference:ref,batch:'v0.8'};
const reviewed={...draft,id:'review1',content_text:'Individuell fachlich freigegebene Aussage.',editorial_status:'clinically_reviewed',reviewed_at:'2026-11-09T15:25:00Z'};
const data={drafts:[draft],approved:[reviewed],draftLoadError:false};
const html=ui.knowledge(data);
assert.match(html,/Fachlich validiert/);
assert.match(html,/Nicht fachlich validiert/);
assert.match(html,/Fachlich validierte Einzeltexte/);
assert.match(html,/2 Treffer/);
const details=ui.details(data,{id:'p1'});
assert.match(details,/1 individuell bestätigte Fachtexte/);
assert.equal((details.match(/data-fact-topic="summary"/g)||[]).length,1);
assert.match(details,/Individuell fachlich freigegebene Aussage/);
assert.match(details,/Wird fachlich erst geprüft/);
// Knowledge view: one summary topic per product, identical text shown once
// inside each product but never merged across unrelated product identities.
const duplicateDraft={...draft,id:'draft-duplicate'};
const otherProduct={...draft,id:'other-product',target_name:'Other test product',
 linked_product_ids:['p2']};
const groupedKnowledge=ui.knowledge({
 drafts:[draft,duplicateDraft,otherProduct],approved:[],draftLoadError:false
});
assert.equal((groupedKnowledge.match(/data-fact-topic="summary"/g)||[]).length,2);
assert.equal((groupedKnowledge.match(/Wird fachlich erst geprüft\./g)||[]).length,2);
assert.match(groupedKnowledge,/3 Einzeltexten/);
const quality=ui.quality(data);
assert.match(quality,/1<\/strong><span>Fachlich freigegebene Fachtexte/);
assert.match(quality,/1<\/strong><span>Öffentlich sichtbare Fachtextentwürfe/);
assert.ok(details.indexOf('Individuell fachlich')<details.indexOf('Wird fachlich'));
assert.doesNotMatch(html,/Prüfentscheidung verbindlich protokollieren/);
console.log('MediIdenta clinical approval UI: PASS');
