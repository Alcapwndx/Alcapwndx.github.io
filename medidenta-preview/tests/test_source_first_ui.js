"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const dir=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(dir,"app.js"),"utf8");
function section(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"missing UI function: "+start);
 return app.slice(a,b);
}
const window={};
vm.runInNewContext(fs.readFileSync(path.join(dir,"data-display.js"),"utf8"),{window,URL,console});
vm.runInNewContext(fs.readFileSync(path.join(dir,"review-ui.js"),"utf8"),{window,URL,console});
const ref={document_url:"https://www.ema.europa.eu/en/medicines/human/EPAR/lantus",document_title:"EMA Lantus",locator:"SmPC 4.1"};
const fact={id:"f1",target_name:"Lantus",fact_type:"summary",content_text:"Synthetischer Testinhalt",
 editorial_status:"draft_unreviewed",linked_product_ids:["prod-lantus"],reference:ref};
const field={id:"pms_123",attribute_key:"product_names",resource_type:"MedicinalProductDefinition",
 resource_id:"600000993602",source_url:"https://api.pms.ema.europa.eu/public/v1/MedicinalProductDefinition/600000993602/$everything",
 value_json:[{productName:"Lantus"}],editorial_status:"draft_unreviewed"};
const pms={product:{display_name:"Lantus",pms_id:"600000993602",
 source_url:field.source_url,imported_at:"2026-11-11"},fields:[field],
 identity_association:"NAME_SIMILARITY_UNCONFIRMED"};
const product={id:"prod-lantus",name:"Lantus",country_code:"EU",substances:[{name:"Insulin glargin"}],
 photos:[],presentations:[],pms_sources:[pms],source:{name:"EMA EPAR",url:ref.document_url,license:"EMA"},
 marketing_status:"unknown"};
const D={detail:product,detailKind:"catalog",connected:true,offline:[product],drafts:[fact],approved:[],
 attributions:[],pmsCoverage:{with_pms_source:1,identity_total:1,coverage_percent:100,items:[{id:product.id,name:product.name,pms_source_count:1}]},
 pmsOverview:{pms_products:1,pms_fields:1,last_pms_source_import_at:"2026-11-11"},
 syncMeta:{last_catalog_import_at:"2026-11-11"},pmsMessage:"",pms_unavailable:false};
const body=section("const escapeHtml=","const D=")+
 section("function clinicalNotice()","function row(")+
 section("function factsHtml(","// PMS Beta metadata remains SEPARATE")+
 section("function pmsCardsHtml(","async function loadPms(")+
 section("function knowledgeHtml()","function draw(")+
 "\nwindow._testUI={detailHtml,pmsDetailHtml,sourcesDisclosure,qualityHtml,knowledgeHtml,pmsCardsHtml};";
vm.runInNewContext(body,{window,URL,D,console});
const ui=window._testUI;
const medicine=ui.detailHtml();
assert.match(medicine,/Synthetischer Testinhalt/);
assert.match(medicine,/EMA PMS Beta/);
assert.equal((medicine.match(/class="source-accordion"/g)||[]).length,1);
assert.ok(medicine.indexOf("Quellen & Nachweise")>medicine.indexOf("Synthetischer Testinhalt"));
assert.match(medicine,/SmPC 4\.1/);
assert.match(medicine,/600000993602/);
assert.doesNotMatch(medicine,/data-pms-review-field=|data-editor-fact=|Adminprüfung|Fachlich validiert|Quellen und Einzelprüfungen/);
assert.match(medicine,/Wirkstärke, Arzneiform, Wirkstoff und Marktgebiet können abweichen/);
D.pmsDetail=pms;
D.detailKind="pms";
const pmsOnly=ui.pmsDetailHtml();
assert.match(pmsOnly,/EMA PMS Beta/); // when the PMS-specific data is loaded below
const knowledge=ui.knowledgeHtml();
assert.match(knowledge,/Praxiswissen/);
assert.match(knowledge,/SOON/);
assert.doesNotMatch(knowledge,/data-review-action|clinical-search|Fachlich validierte Einzeltexte/);
const quality=ui.qualityHtml();
assert.match(quality,/EMA-PMS-Abdeckung der Demo/);
assert.match(quality,/Quellenbezogene Fachtextangaben/);
assert.doesNotMatch(quality,/mindestens <strong>70 %|individuell fachlich validiert|Einzeln fachlich geprüft|Freigabeprüfungen/);
const attack=ui.sourcesDisclosure({source:{name:"Fake <script>"}},[],[{reference:{
 document_title:"<img src=x onerror=alert(1)>",document_url:"javascript:alert(1)"}}]);
assert.doesNotMatch(attack,/<script>|<img|href="javascript:/);
assert.match(attack,/&lt;script&gt;/);
console.log("MediIdenta unified bottom-source / SOON / quality UI: PASS");
