"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {TextEncoder}=require('node:util');
const script=fs.readFileSync(path.resolve(__dirname,'..','review-auth.js'),'utf8');
const COMMIT='a'.repeat(40),USER='11111111-1111-4111-8111-111111111111';
const sample={
 id:'legacy-v05-001',target_type:'product',target_name:'Toujeo',
 fact_type:'summary',content_text:'Ungeprüfte Testbeschreibung, keine klinische Aussage',
 editorial_status:'draft_unreviewed',assignment_status:'exact_match',
 reference:{document_url:'https://www.ema.europa.eu/en/medicines/human/EPAR/toujeo',locator:'Overview / How used?'}
};
function make(options={}){
 const listeners={};const stored={};const calls=[];
 const config=options.configured?{supabaseUrl:'https://demo123.supabase.co',publishableKey:'sb_publishable_'+'X'.repeat(32)}:{supabaseUrl:'',publishableKey:''};
 const state={drafts:[sample],draftLoadError:false,syncMeta:{source_commit:COMMIT,mode:'STATIC_PUBLIC_PREVIEW'},catalogRevision:COMMIT,draftRevision:COMMIT};
 const context={
  window:{MEDIIDENTA_AUTH_CONFIG:config,crypto:webcrypto},
  document:{addEventListener:(kind,fn)=>(listeners[kind]??=[]).push(fn)},
  sessionStorage:{getItem(k){return stored[k]||null},setItem(k,v){stored[k]=v},removeItem(k){delete stored[k]}},
  URL,TextEncoder,fetch:async(url,opts={})=>{
   const u=String(url);calls.push({url:u,opts});
   let data;
   if(u.endsWith('/auth/v1/otp'))data={};
   else if(u.endsWith('/auth/v1/verify'))data={access_token:'token.1',refresh_token:'r.1',expires_in:3600};
   else if(u.endsWith('/auth/v1/user'))data={id:USER,email:'reviewer@example.org'};
   else if(u.includes('medidenta_reviewer_roles'))data=options.role?[{role:options.role}]:[];
   else if(u.includes('medidenta_review_events')){
    if(opts.method==='POST'){
     const posted=JSON.parse(opts.body);
     data=options.errorPost?{message:'Rejected by RLS'}:[{fact_id:posted.fact_id,source_commit:posted.source_commit,statement_sha256:posted.statement_sha256,decision:posted.decision,created_at:'2026-11-09T15:00:00+01:00'}];
     return {ok:!options.errorPost,status:options.errorPost?403:201,json:async()=>data};
    }
    data=[];
   }else if(u.endsWith('/auth/v1/logout'))data={};
   else throw Error('Unexpected fetch '+u);
   return {ok:true,status:200,json:async()=>data};
  },
  Date,JSON,Uint8Array,Object,Math,RegExp,Promise,Array,String,Number,Boolean,console
 };
 vm.runInNewContext(script,context,{filename:'review-auth.js'});
 let renders=0;
 const api=context.window.MediIdentaReviewAuth;
 api.init(()=>state,()=>renders++);
 return {api,listeners,calls,state,stored,get renders(){return renders;}};
}
function form(kind,data){
 return {
  matches:sel=>sel==='[data-editor-form],[data-editor-fact]',
  dataset:kind==='fact'?{editorFact:sample.id}:{editorForm:kind},
  querySelector:selector=>({value:data[selector]?.value,checked:data[selector]?.checked})
 };
}
async function submit(api,kind,data){
 const fn=api.listeners.submit[0],el=form(kind,data);
 await fn({target:el,preventDefault(){}});
}
async function login(x){
 await submit(x,'request',{'[name="email"]':{value:'reviewer@example.org'}});
 await submit(x,'verify',{'[name="email"]':{value:'reviewer@example.org'},'[name="otp"]':{value:'123456'}});
}
(async()=>{
 const unconfigured=make();
 assert.equal(unconfigured.api._debug.configured(),false);
 assert.match(unconfigured.api.accountHtml(),/Anmeldung vorbereitet/);
 assert.match(unconfigured.api.reviewActionHtml(sample),/Einrichtung/);
 assert.equal(unconfigured.calls.length,0);
 const guest=make({configured:true,role:'reviewer'});
 assert.match(guest.api.reviewActionHtml(sample),/anmelden/);
 assert.equal(guest.calls.length,0);
 await login(guest);
 assert.equal(guest.api._debug.role(),'reviewer');
 assert.match(guest.api.reviewActionHtml(sample),/verbindlich protokollieren/);
 assert.ok(guest.stored.medidenta_editorial_auth_session_v07);
 await submit(guest,'fact',{'[name="decision"]':{value:'verified'},'[name="notes"]':{value:'Aktuelle EMA-Quelle geprüft.'},'[name="source_checked"]':{checked:true}});
 const posts=guest.calls.filter(x=>x.opts.method==='POST'&&x.url.includes('medidenta_review_events'));
 assert.equal(posts.length,1);
 const obj=JSON.parse(posts[0].opts.body);
 assert.equal(obj.fact_id,sample.id);assert.equal(obj.source_commit,COMMIT);
 assert.match(obj.statement_sha256,/^[0-9a-f]{64}$/);
 assert.equal(obj.source_checked,true);
 assert.ok(!('reviewer_id' in obj));assert.ok(!('created_at' in obj));
 assert.equal(posts[0].opts.headers.Prefer,'return=representation');
 assert.equal(guest.api._debug.events(),1);
 const unauthorized=make({configured:true});await login(unauthorized);
 assert.equal(unauthorized.api._debug.role(),null);
 assert.match(unauthorized.api.reviewActionHtml(sample),/noch keine Prüfberechtigung/);
 await submit(unauthorized,'fact',{'[name="decision"]':{value:'verified'},'[name="source_checked"]':{checked:true}});
 assert.equal(unauthorized.calls.filter(x=>x.url.includes('medidenta_review_events')&&x.opts.method==='POST').length,0);
 const stale=make({configured:true,role:'admin'});await login(stale);
 stale.state.draftRevision='b'.repeat(40);
 assert.match(stale.api.reviewActionHtml(sample),/nicht übertragbar/);
 await submit(stale,'fact',{'[name="decision"]':{value:'verified'},'[name="source_checked"]':{checked:true}});
 assert.equal(stale.calls.filter(x=>x.url.includes('medidenta_review_events')&&x.opts.method==='POST').length,0);
 const notMatched=make({configured:true,role:'reviewer'});await login(notMatched);
 notMatched.state.drafts=[{...sample,assignment_status:'unmatched'}];
 assert.doesNotMatch(notMatched.api.reviewActionHtml(notMatched.state.drafts[0]),/value="verified"/);
 await submit(notMatched,'fact',{'[name="decision"]':{value:'verified'},'[name="source_checked"]':{checked:true}});
 assert.equal(notMatched.calls.filter(x=>x.url.includes('medidenta_review_events')&&x.opts.method==='POST').length,0);
 console.log('MediIdenta review auth: PASS – 19 auth/role/revision/audit assertions');
})().catch(err=>{console.error(err);process.exitCode=1;});
