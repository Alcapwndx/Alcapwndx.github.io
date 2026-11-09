"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const {TextEncoder}=require("node:util");
const src=fs.readFileSync(path.resolve(__dirname,"..","review-auth.js"),"utf8");
const REV="a".repeat(40),USER="11111111-1111-4111-8111-111111111111";
const fact={
 id:"legacy-v05-001",target_type:"product",target_name:"Toujeo",fact_type:"summary",
 content_text:"Synthetischer Fachtext für Login-/Rechtest; nicht zur Anwendung.",
 editorial_status:"draft_unreviewed",assignment_status:"exact_match",linked_product_ids:["ema_toujeo"],
 reference:{document_url:"https://www.ema.europa.eu/en/medicines/human/EPAR/toujeo",locator:"Overview / How used?"}
};
function make(role,configured=true){
 const listeners={},storage={},calls=[];
 const state={drafts:[fact],approved:[],draftLoadError:false,
   syncMeta:{source_commit:REV,mode:"LIVE_SUPABASE"},catalogRevision:REV,draftRevision:REV,features:{collaboration_enabled:true}};
 const window={
  MEDIIDENTA_AUTH_CONFIG:configured?{supabaseUrl:"https://demo123.supabase.co",
   publishableKey:"sb_publishable_"+"X".repeat(32),reviewApiBase:"/api/v1"}:{},
  crypto:webcrypto
 };
 const context={window,document:{addEventListener:(event,cb)=>(listeners[event]??=[]).push(cb)},
  sessionStorage:{getItem:key=>storage[key]||null,setItem:(key,v)=>{storage[key]=v;},
    removeItem:key=>{delete storage[key]}},
  URL,TextEncoder,Uint8Array,Date,JSON,Object,Array,Math,RegExp,Promise,
  URLSearchParams,String,Number,Boolean,console,
  fetch:async(url,opts={})=>{
   url=String(url);calls.push({url,opts});
   let data=null;
   if(url.includes("/auth/v1/otp"))data={};
   else if(url.includes("/auth/v1/verify"))data={access_token:"token.1",refresh_token:"r.1",expires_in:3600};
   else if(url.includes("/auth/v1/user"))data={id:USER,email:"user@example.org"};
   else if(url.includes("medidenta_reviewer_roles"))data=role?[{role}]:[];
   else if(url.includes("medidenta_review_events"))data=[];
   else if(url==="/api/v1/reviews"){
     const p=JSON.parse(opts.body);data=[{...p,created_at:new Date().toISOString()}];
   }else throw Error("Unexpected fetch: "+url);
   return {ok:true,status:200,json:async()=>data};
  }};
 vm.runInNewContext(src,context,{filename:"review-auth.js"});
 const auth=window.MediIdentaReviewAuth;
 auth.init(()=>state,()=>{});
 return {auth,listeners,calls,state,storage};
}
async function post(x,kind,inputs){
 const form={dataset:kind==="fact"?{editorFact:fact.id}:{editorForm:kind},
  querySelector:s=>inputs[s]||{value:"",checked:false}};
 await x.listeners.submit[0]({target:form,preventDefault(){}});
}
async function login(x){
 await post(x,"request",{'[name="email"]':{value:"user@example.org"}});
 await post(x,"verify",{'[name="email"]':{value:"user@example.org"},'[name="otp"]':{value:"123456"}});
}
(async()=>{
 const missing=make(null,false);
 assert.equal(missing.auth._debug.configured(),false);
 assert.equal(missing.auth.reviewActionHtml(fact),"");
 const guest=make("admin");
 assert.equal(guest.auth.reviewActionHtml(fact),"","Guests see no action controls");
 await login(guest);
 assert.equal(guest.auth._debug.role(),"admin");
 assert.match(guest.auth.reviewActionHtml(fact),/Admin-Entscheidung/);
 assert.match(guest.auth.reviewActionHtml(fact),/data-comment-form/);
 assert.match(guest.auth.reviewActionHtml(fact),/data-note-form/);
 await post(guest,"fact",{
  '[name="decision"]':{value:"verified"},
  '[name="notes"]':{value:"Aktuelle Originalquelle genau kontrolliert."},
  '[name="source_checked"]':{checked:true}
 });
 const actions=guest.calls.filter(c=>c.url==="/api/v1/reviews");
 assert.equal(actions.length,1);
 const sent=JSON.parse(actions[0].opts.body);
 assert.equal(sent.fact_id,fact.id);
 assert.match(sent.statement_sha256,/^[0-9a-f]{64}$/);
 assert.equal(sent.source_checked,true);
 assert.ok(!("reviewer_id" in sent));
 assert.equal(guest.auth._debug.events(),1);

 const user=make(null);await login(user);
 assert.equal(user.auth._debug.role(),null);
 assert.match(user.auth.accountHtml(),/User \(Kommentieren\)/);
 const userTools=user.auth.reviewActionHtml(fact);
 assert.match(userTools,/Kommentar zur Moderation/);
 assert.doesNotMatch(userTools,/Admin-Entscheidung/);
 assert.doesNotMatch(userTools,/data-note-form/);
 await post(user,"fact",{'[name="decision"]':{value:"verified"},'[name="source_checked"]':{checked:true}});
 assert.equal(user.calls.filter(c=>c.url==="/api/v1/reviews").length,0);

 const mod=make("moderator");await login(mod);
 assert.equal(mod.auth._debug.role(),"moderator");
 const modTools=mod.auth.reviewActionHtml(fact);
 assert.match(modTools,/Private Quellenprüfung/);
 assert.doesNotMatch(modTools,/Admin-Entscheidung/);
 await post(mod,"fact",{'[name="decision"]':{value:"verified"},'[name="source_checked"]':{checked:true}});
 assert.equal(mod.calls.filter(c=>c.url==="/api/v1/reviews").length,0);

 const oldRole=make("reviewer");await login(oldRole);
 assert.equal(oldRole.auth._debug.role(),"moderator","Legacy reviewers are never admins");

 const preMigration=make("admin");await login(preMigration);
 preMigration.state.features.collaboration_enabled=false;
 const preTools=preMigration.auth.reviewActionHtml(fact);
 assert.match(preTools,/Admin-Entscheidung/,"Existing clinical approval remains usable");
 assert.doesNotMatch(preTools,/data-comment-form/,"Pending migration never exposes unusable comments");
 assert.doesNotMatch(preTools,/data-note-form/);
 const beforeUser=make(null);await login(beforeUser);
 beforeUser.state.features.collaboration_enabled=false;
 assert.equal(beforeUser.auth.reviewActionHtml(fact),"","User controls require migration");

 const stale=make("admin");await login(stale);
 stale.state.draftRevision="b".repeat(40);
 assert.doesNotMatch(stale.auth.reviewActionHtml(fact),/Admin-Entscheidung/);
 await post(stale,"fact",{'[name="decision"]':{value:"verified"},'[name="source_checked"]':{checked:true}});
 assert.equal(stale.calls.filter(c=>c.url==="/api/v1/reviews").length,0);

 const unmatched=make("admin");await login(unmatched);
 unmatched.state.drafts=[{...fact,assignment_status:"unmatched"}];
 assert.doesNotMatch(unmatched.auth.reviewActionHtml(unmatched.state.drafts[0]),/value="verified"/);
 console.log("MediIdenta Alpha RBAC/login: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
