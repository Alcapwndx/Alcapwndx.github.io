"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const {TextEncoder}=require("node:util");

const src=fs.readFileSync(path.resolve(__dirname,"..","review-auth.js"),"utf8");
const origin="https://alcapwndx-github-io.onrender.com";
const pathname="/medidenta-preview/";
const pubkey="sb_publishable_"+"X".repeat(32);
const USER="11111111-1111-4111-8111-111111111111";
const events=[];
function make(hash="",role=null){
 const handlers={},calls=[],storage={};let fragment=hash;
 const location={protocol:"https:",origin,pathname,search:"",get hash(){return fragment;},set hash(x){fragment=x;}};
 const history={replaceState(_state,_title,url){
   events.push({kind:"cleared",url});
   location.hash="";
 }};
 const window={location,history,crypto:webcrypto,MEDIIDENTA_AUTH_CONFIG:{
  supabaseUrl:"https://demo123.supabase.co",publishableKey:pubkey,reviewApiBase:"/api/v1"
 }};
 const context={window,URL,URLSearchParams,TextEncoder,Date,JSON,Uint8Array,
   Object,Math,RegExp,Promise,Array,String,Number,Boolean,console,
   document:{addEventListener(type,cb){(handlers[type]??=[]).push(cb);}},
   sessionStorage:{
      getItem(k){return storage[k]??null;},
      setItem(k,v){storage[k]=v;},
      removeItem(k){delete storage[k];}
   },
   fetch:async(u,opts={})=>{
     calls.push({url:String(u),opts});
     if(String(u).includes("/auth/v1/otp"))return {ok:true,json:async()=>({})};
     if(String(u).endsWith("/auth/v1/user")){
       events.push({kind:"user-lookup",cleanFragment:location.hash===""});
       return {ok:true,json:async()=>({id:USER,email:"editor@example.org"})};
     }
     if(String(u).includes("medidenta_reviewer_roles")){
       return {ok:true,json:async()=>role?[{role}]:[]};
     }
     if(String(u).includes("medidenta_review_events")){
       return {ok:true,json:async()=>([])};
     }
     throw Error("Unexpected URL "+u);
   }
 };
 vm.runInNewContext(src,context,{filename:"review-auth.js"});
 let rendered=0;
 const auth=window.MediIdentaReviewAuth;
 auth.init(()=>({}),()=>{rendered++;});
 return {auth,window,calls,handlers,storage,location,get rendered(){return rendered;}};
}
function flush(){return new Promise(resolve=>setImmediate(resolve));}
async function send(x,email="editor@example.org"){
 const form={
   matches(sel){return sel==="[data-editor-form],[data-editor-fact]";},
   dataset:{editorForm:"request"},
   querySelector(){return {value:email};}
 };
 await x.handlers.submit[0]({target:form,preventDefault(){}});
}
(async()=>{
 const plain=make();
 assert.match(plain.auth.accountHtml(),/Anmeldelink per E-Mail senden/);
 assert.doesNotMatch(plain.auth.accountHtml(),/Code aus der E-Mail/);
 await send(plain);
 const sent=plain.calls.find(c=>c.url.includes("/auth/v1/otp"));
 assert.ok(sent,"Magic Link request reached Supabase");
 const redirect=new URL(sent.url).searchParams.get("redirect_to");
 assert.equal(redirect,origin+pathname,"Callback must return to the actual PWA path");
 assert.equal(JSON.parse(sent.opts.body).email,"editor@example.org");
 assert.ok(!("service_role" in sent.opts.headers));
 assert.match(plain.auth.accountHtml(),/Anmeldelink/);

 events.length=0;
 const hash="#access_token="+encodeURIComponent("ey."+("a".repeat(60))+".sig")+
   "&refresh_token="+encodeURIComponent("refresh-"+("c".repeat(48)))+
   "&expires_in=3600&token_type=bearer&type=magiclink";
 const signed=make(hash,"admin");
 await flush();await flush();await flush();
 assert.equal(signed.location.hash,"","Sensitive Supabase token fragment must be removed");
 assert.ok(events.some(e=>e.kind==="cleared"&&e.url===pathname));
 assert.ok(events.some(e=>e.kind==="user-lookup"&&e.cleanFragment));
 assert.equal(signed.auth._debug.role(),"admin","Verified callback grants only database-assigned admin");
 assert.ok(signed.storage.medidenta_editorial_auth_session_v07);
 assert.match(signed.auth.accountHtml(),/Administrator\/in/);

 events.length=0;
 const guest=make(hash);
 await flush();await flush();await flush();
 assert.equal(guest.auth._debug.role(),null,"Magic link never grants a reviewer role");
 assert.match(guest.auth.accountHtml(),/Noch keine Prüfberechtigung/);

 events.length=0;
 const failed=make("#error=access_denied&error_description=expired");
 await flush();await flush();
 assert.equal(failed.location.hash,"");
 assert.ok(!failed.storage.medidenta_editorial_auth_session_v07);
 assert.match(failed.auth.accountHtml(),/Anmeldelink konnte nicht bestätigt/);
 assert.equal(failed.calls.length,0,"Errors must not request Supabase user data");

 console.log("MediIdenta Free-tier Magic Link tests: PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
