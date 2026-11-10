"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),
 path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.resolve(__dirname,"..","app.js"),"utf8");
const start=src.indexOf("async function submitPmsField(form){"),
 end=src.indexOf("\nfunction compareHtml()",start);
assert.ok(start>0&&end>start,"Source-bound editor action must exist");
const code=src.slice(start,end);
const fact={id:"pms_"+"a".repeat(40),statement_sha256:"b".repeat(64),
 editorial_status:"draft_unreviewed"};
function setup(role="admin",embedded=true){
 const calls=[],requests=[];
 const D={detailKind:embedded?"catalog":"pms",
  detail:{id:"catalog001",pms_sources:[{product:{pms_id:"600000000000"},fields:[fact]}]},
  pmsDetail:{product:{pms_id:"600000000000"},fields:[fact]},pmsMessage:""};
 const window={MediIdentaReviewAuth:{
  _debug:{role:()=>role},
  submitPmsReview:async data=>{calls.push(data);}
 }};
 const context={D,window,trim:x=>String(x??"").trim(),
  api:async route=>{requests.push(route);return embedded?
     {id:"catalog001",pms_sources:[{product:{pms_id:"600000000000"},
       fields:[{...fact,editorial_status:"clinically_reviewed"}]}]}:
     {product:{pms_id:"600000000000"},
      fields:[{...fact,editorial_status:"clinically_reviewed"}]};},
  draw:()=>{}};
 vm.runInNewContext(code,context,{filename:"pms-editor-action.js"});
 const form={dataset:{pmsReviewField:fact.id,pmsSha:fact.statement_sha256},
  querySelector:selector=>{
   if(selector==='[name="source_checked"]')return {checked:true};
   if(selector==='[name="decision"]')return {value:"verified"};
   if(selector==='[name="notes"]')return {value:"Quellenversion geprüft"};
   return null;
  }};
 return {context,form,calls,requests};
}
(async()=>{
 const inside=setup();
 await inside.context.submitPmsField(inside.form);
 assert.equal(inside.calls.length,1,"Embedded admin review must call the protected endpoint");
 assert.equal(inside.calls[0].field_id,fact.id);
 assert.equal(inside.calls[0].statement_sha256,fact.statement_sha256);
 assert.equal(inside.calls[0].source_checked,true);
 assert.deepEqual(inside.requests,["/products/catalog001"]);
 assert.equal(inside.context.D.detail.pms_sources[0].fields[0].editorial_status,
              "clinically_reviewed");
 assert.match(inside.context.D.pmsMessage,/revisionsgebunden/);
 const only=setup("admin",false);
 await only.context.submitPmsField(only.form);
 assert.deepEqual(only.requests,["/pms/products/600000000000"]);
 const guest=setup("moderator");
 await guest.context.submitPmsField(guest.form);
 assert.equal(guest.calls.length,0);
 assert.deepEqual(guest.requests,[]);
 const stale=setup();
 stale.form.dataset.pmsSha="c".repeat(64);
 await stale.context.submitPmsField(stale.form);
 assert.equal(stale.calls.length,0,"Changed PMS source digest must never be reviewed");
 assert.match(src,/data-pms-review-field/);
 assert.match(src,/D\.detail\?\.pms_sources/);
 assert.match(src,/\/pms\/overview/);
 assert.match(src,/embeddedPmsHtml/);
 assert.match(src,/terminologyReport/);
 console.log("MediIdenta combined PMS Beta detail + admin review regression: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
