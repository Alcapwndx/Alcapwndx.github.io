/* MediIdenta review accounts v0.7 – Supabase email OTP + RLS-backed audit.
 * Publishable project key only; NO service_role key and no medicine publication.
 * The audited SHA-256 is an evidence pointer, not proof of clinical correctness.
 */
(function(global){
'use strict';
const SESSION_KEY='medidenta_editorial_auth_session_v07';
const REVIEW_TABLE='medidenta_review_events';
const ROLES_TABLE='medidenta_reviewer_roles';
const DECISIONS={verified:'Fachlich geprüft – Aussage korrekt',needs_revision:'Überarbeitung erforderlich',rejected:'Aussage fachlich nicht bestätigt'};
const A={configured:false,base:'',key:'',session:null,user:null,role:null,events:[],message:'',error:false,busy:false,pendingEmail:'',getState:null,draw:null};
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function config(){
 const c=global.MEDIIDENTA_AUTH_CONFIG||{};
 let u;
 try{u=new URL(c.supabaseUrl||'');}catch{return false;}
 if(u.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/.test(u.hostname)||u.pathname!=='/'||u.search||u.hash||u.port)return false;
 if(typeof c.publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(c.publishableKey))return false;
 A.base=u.origin;A.key=c.publishableKey;A.configured=true;return true;
}
function headers(token,extra={}){
 return {'apikey':A.key,...(token?{'Authorization':'Bearer '+token}:{}),...extra};
}
async function request(path,opts={}){
 if(!A.configured)throw Error('Die Kontenverwaltung ist noch nicht eingerichtet.');
 const url=A.base+path;
 const r=await fetch(url,{cache:'no-store',...opts,headers:headers(opts.token,{...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})})});
 let data;try{data=await r.json();}catch{data=null;}
 if(!r.ok){
  if(r.status===401||r.status===403)throw Error('Anmeldung oder Berechtigung ungültig. Bitte erneut anmelden.');
  if(r.status===429)throw Error('Zu viele Versuche. Bitte später erneut versuchen.');
  throw Error((data&&typeof data.msg==='string'&&data.msg.length<180?data.msg:
              data&&typeof data.message==='string'&&data.message.length<180?data.message:
              'Serverfehler HTTP '+r.status));
 }
 return data;
}
function saveSession(session){
 A.session=session;
 if(!session){try{sessionStorage.removeItem(SESSION_KEY);}catch{}return;}
 try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({
  access_token:session.access_token,
  refresh_token:session.refresh_token,
  expires_at:session.expires_at || (Math.floor(Date.now()/1000)+(session.expires_in||3600))
 }));}catch{}
}
async function validToken(){
 if(!A.session?.access_token)return null;
 const expiry=A.session.expires_at||0;
 if(expiry>Date.now()/1000+60)return A.session.access_token;
 if(!A.session.refresh_token){clearUser();return null;}
 try{
  const data=await request('/auth/v1/token?grant_type=refresh_token',{
   method:'POST',body:JSON.stringify({refresh_token:A.session.refresh_token})
  });
  if(!data.access_token||!data.refresh_token)throw Error('Keine neue Session');
  saveSession(data);return data.access_token;
 }catch{clearUser();return null;}
}
function clearUser(){A.user=null;A.role=null;A.events=[];saveSession(null);}
async function loadProfile(){
 const token=await validToken();if(!token)return false;
 const user=await request('/auth/v1/user',{method:'GET',token});
 if(!user?.id)throw Error('Konto konnte nicht zugeordnet werden.');
 A.user={id:user.id,email:String(user.email||'')};
 const p=await request('/rest/v1/'+ROLES_TABLE+'?select=role&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{token});
 A.role=Array.isArray(p)&&p[0]&&['reviewer','admin'].includes(p[0].role)?p[0].role:null;
 A.events=[];
 if(A.role){
  const list=await request('/rest/v1/'+REVIEW_TABLE+
   '?select=fact_id,source_commit,statement_sha256,decision,created_at&order=created_at.desc&limit=1000',{token});
  A.events=Array.isArray(list)?list:[];
 }
 return true;
}
function busy(msg){A.busy=true;A.error=false;A.message=msg;A.draw?.();}
function done(msg,error=false){A.busy=false;A.message=msg;A.error=error;A.draw?.();}
async function sendOtp(email){
 if(A.busy)return;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){done('Bitte eine gültige E-Mail-Adresse eingeben.',true);return;}
 busy('Einmalcode wird angefordert …');
 try{
  await request('/auth/v1/otp',{method:'POST',body:JSON.stringify({email,create_user:true})});
  A.pendingEmail=email;
  done('Wenn die Anmeldung zugelassen ist, erhältst du einen Einmalcode per E-Mail. Bitte auch den Spamordner prüfen.');
 }catch(e){done(e.message,true);}
}
async function verifyOtp(email,token){
 if(A.busy)return;
 if(!email||!/^\d{6,8}$/.test(token)){done('Bitte den vollständigen E-Mail-Code eingeben.',true);return;}
 busy('Einmalcode wird überprüft …');
 try{
  const data=await request('/auth/v1/verify',{method:'POST',body:JSON.stringify({email,token,type:'email'})});
  if(!data?.access_token||!data?.refresh_token)throw Error('Anmeldung nicht bestätigt.');
  saveSession(data);
  await loadProfile();
  A.pendingEmail='';
  done(A.role?'Erfolgreich angemeldet. Prüfentscheidungen können sicher dokumentiert werden.':'Konto angemeldet, aber noch keine Prüfberechtigung freigeschaltet.');
 }catch(e){clearUser();done(e.message,true);}
}
async function logout(){
 try{const token=await validToken();if(token)await request('/auth/v1/logout',{method:'POST',token});}catch{}
 clearUser();done('Abgemeldet.');
}
function accountHtml(){
 const info='<div class="notice warning"><strong>Prüfprotokoll ist keine klinische Veröffentlichung.</strong> Eine Bestätigung speichert nur einen nachvollziehbaren redaktionellen Prüfentscheid. Die private Arzneimitteldatenbank bleibt vorerst unverändert. Keine Patientendaten in die Notizen eintragen.</div>';
 const heading='<div class="eyebrow">MediIdenta · Redaktionskonto</div><h1>Anmeldung und Prüfberechtigung</h1>';
 if(!A.configured)return heading+info+
  '<section class="card"><h2>Anmeldung vorbereitet</h2><p>Die geschützte Kontoverwaltung muss noch einmalig mit Supabase verbunden werden.</p>'+
  '<p class="small muted">Bis dahin können Fachtexte wie bisher gelesen und lokale Prüfnotizen erstellt werden. Eine gespeicherte, authentifizierte Bestätigung ist noch nicht möglich.</p></section>';
 if(A.user){
  const role=A.role==='admin'?'Administrator/in':A.role==='reviewer'?'Fachliche/r Prüfer/in':'Noch keine Prüfberechtigung';
  const history=A.events.slice(0,15).map(x=>'<div class="auth-history"><strong>'+esc(x.fact_id)+'</strong> · '+esc(DECISIONS[x.decision]||x.decision)+
   '<div class="tiny muted">'+esc(new Date(x.created_at).toLocaleString('de-DE'))+' · Revision '+esc(x.source_commit?.slice(0,12))+'</div></div>').join('');
  return heading+info+'<section class="card"><h2>Mein Konto</h2><p><strong>'+esc(A.user.email)+'</strong></p>'+
   '<p class="small">Rolle: '+esc(role)+'</p>'+
   (!A.role?'<div class="notice warning">Für die ersten Prüfungen muss dein Konto von der Projektverwaltung in der Supabase-Datenbank als „reviewer“ oder „admin“ freigeschaltet werden.</div>'+
   '<p class="tiny muted">Benutzer-ID zur einmaligen Rollenvergabe: <code>'+esc(A.user.id)+'</code></p>':'')+
   '<button class="secondary full spaced" data-editor-action="logout">Abmelden</button></section>'+
   (A.role?'<section class="card"><h2>Meine letzten Prüfentscheidungen</h2>'+(history||'<p class="muted">Noch keine Entscheidungen protokolliert.</p>')+'</section>':'')+
   (A.message?'<div class="notice '+(A.error?'danger':'warning')+'">'+esc(A.message)+'</div>':'');
 }
 return heading+info+
 '<section class="card"><h2>Per E-Mail anmelden oder Konto erstellen</h2>'+
 '<p class="small muted">Einmalcode statt Passwort. Ein neues Konto erhält nicht automatisch die Berechtigung, Fachinformationen zu prüfen.</p>'+
 '<form data-editor-form="request" class="editor-form"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" required maxlength="254" value="'+esc(A.pendingEmail)+'" placeholder="name@beispiel.de"></label>'+
 '<button type="submit" class="primary full" '+(A.busy?'disabled':'')+'>Einmalcode senden</button></form>'+
 '<form data-editor-form="verify" class="editor-form"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" required maxlength="254" value="'+esc(A.pendingEmail)+'"></label>'+
 '<label>Code aus der E-Mail<input name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8" pattern="[0-9]{6,8}" required placeholder="6-stelliger Code"></label>'+
 '<button type="submit" class="secondary full" '+(A.busy?'disabled':'')+'>Anmelden und Code bestätigen</button></form>'+
 (A.message?'<div class="notice '+(A.error?'danger':'warning')+'">'+esc(A.message)+'</div>':'')+
 '</section>';
}
function isActiveRevision(D){
 const commit=D?.syncMeta?.source_commit;
 return typeof commit==='string'&&/^[0-9a-f]{40}$/.test(commit)&&
 D.catalogRevision===commit&&D.draftRevision===commit&&
 D.syncMeta.mode==='STATIC_PUBLIC_PREVIEW'&&D.draftLoadError===false;
}
function lastReview(f,D){
 const c=D.syncMeta?.source_commit;
 return A.events.find(x=>x.fact_id===f.id&&x.source_commit===c);
}
function reviewActionHtml(f){
 const D=A.getState?.();if(!D)return '';
 const current=lastReview(f,D);
 const status=current?'<div class="notice warning"><strong>Zu dieser Katalogrevision dokumentiert:</strong> '+
   esc(DECISIONS[current.decision]||current.decision)+'. <span class="tiny">Dies ist keine klinische Veröffentlichung.</span></div>':'';
 if(!A.configured)return '<p class="tiny muted">Verbindliche Prüfbestätigung: Einrichtung der geschützten Kontenverwaltung ausstehend.</p>';
 if(!A.user)return '<div class="review-auth-gate"><p class="small muted">Zum Dokumentieren einer Prüfung bitte anmelden.</p><button class="secondary" data-nav="account">Mit Prüfkonto anmelden</button></div>';
 if(!A.role)return '<div class="review-auth-gate"><p class="tiny muted">Dein Konto hat noch keine Prüfberechtigung.</p><button class="secondary" data-nav="account">Mein Konto ansehen</button></div>';
 if(!isActiveRevision(D))return '<div class="notice warning">Prüfung nicht übertragbar: Der öffentliche Datenstand ist noch nicht eindeutig mit einer GitHub-Revision verknüpft. Bitte zuerst den Katalog aktualisieren.</div>';
 const nonmatch=f.assignment_status==='unmatched';
 const opts=Object.entries(DECISIONS).filter(([k])=>!(nonmatch&&k==='verified'));
 return status+'<form class="editor-review-form" data-editor-fact="'+esc(f.id)+'">'+
 '<label>Meine fachliche Prüfentscheidung<select name="decision" required>'+opts.map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label>'+
 '<label>Begründung / Korrekturhinweis (ohne Patientendaten)<textarea name="notes" rows="2" maxlength="3000" placeholder="Bei Korrekturbedarf bitte konkret begründen."></textarea></label>'+
 '<label class="editor-attest"><input name="source_checked" type="checkbox" value="yes" required> Ich habe die aktuelle Originalquelle, die genaue Fundstelle, den Produkt- beziehungsweise Wirkstoffbezug sowie die Aussage fachlich geprüft.</label>'+
 '<button class="primary full" type="submit" '+(A.busy?'disabled':'')+'>Prüfentscheidung verbindlich protokollieren</button>'+
 '<p class="tiny muted">Gespeichert werden Benutzer-ID, Datum, Quellrevision und SHA-256 der geprüften Aussage. Die medizinische Veröffentlichung bleibt gesperrt.</p></form>';
}
async function digestFact(f){
 if(!global.crypto?.subtle||typeof TextEncoder==='undefined')throw Error('Sichere Prüfsummenbildung wird auf diesem Gerät nicht unterstützt.');
 const r=f.reference||{};
 const canonical=JSON.stringify([f.id,f.target_type,f.target_name,f.fact_type,f.content_text,r.document_url,r.locator]);
 const bytes=new TextEncoder().encode(canonical);
 const hash=await global.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function submitReview(id,form){
 if(A.busy)return;
 const D=A.getState?.();
 if(!A.configured||!A.user||!A.role||!D||!isActiveRevision(D)){done('Kein freigeschaltetes Prüfkonto oder unklarer Datenstand.',true);return;}
 const f=(D.drafts||[]).find(x=>x.id===id);
 if(!f||f.editorial_status!=='draft_unreviewed'){done('Die geprüfte Aussage ist nicht mehr verfügbar.',true);return;}
 const decision=form.querySelector('[name="decision"]')?.value;
 const notes=String(form.querySelector('[name="notes"]')?.value||'').trim();
 const checked=!!form.querySelector('[name="source_checked"]')?.checked;
 if(!(decision in DECISIONS)||!checked){done('Bitte die Quellenprüfung ausdrücklich bestätigen.',true);return;}
 if(decision==='verified'&&f.assignment_status==='unmatched'){done('Nicht zugeordnete Entwürfe dürfen nicht als korrekt bestätigt werden.',true);return;}
 if(decision!=='verified'&&notes.length<10){done('Für einen Korrektur- oder Ablehnungsvermerk bitte mindestens zehn Zeichen Begründung ergänzen.',true);return;}
 if(notes.length>3000){done('Notiz ist zu lang.',true);return;}
 if(!/^https:\/\/www\.ema\.europa\.eu\//.test(f.reference?.document_url||'')){done('Unzulässige Originalquelle.',true);return;}
 busy('Prüfentscheidung wird revisionsbezogen gespeichert …');
 try{
  const token=await validToken();if(!token||!A.user)throw Error('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  const data={
    fact_id:f.id,source_commit:D.syncMeta.source_commit,statement_sha256:await digestFact(f),
    source_url:f.reference.document_url,source_locator:f.reference.locator,
    decision,source_checked:checked,notes
  };
  const result=await request('/rest/v1/'+REVIEW_TABLE+'?select=fact_id,source_commit,statement_sha256,decision,created_at',{
   method:'POST',token,body:JSON.stringify(data),
   headers:headers(token,{'Content-Type':'application/json','Prefer':'return=representation'})
  });
  if(!Array.isArray(result)||result.length!==1||result[0].fact_id!==f.id||
     result[0].source_commit!==data.source_commit||result[0].statement_sha256!==data.statement_sha256)
   throw Error('Die Datenbankbestätigung konnte nicht verifiziert werden.');
  A.events.unshift(result[0]);
  done('Prüfentscheidung erfolgreich und nachvollziehbar gespeichert. Keine klinische Freigabe der App.');
 }catch(e){done(e.message,true);}
}
function init(getState,draw){
 A.getState=getState;A.draw=draw;
 config();
 try{const raw=sessionStorage.getItem(SESSION_KEY);if(raw){const x=JSON.parse(raw);if(x.access_token&&x.refresh_token)A.session=x;}}catch{}
 if(A.configured&&A.session){
  loadProfile().then(()=>draw?.()).catch(()=>{clearUser();draw?.();});
 }
 document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.matches?.('[data-editor-form],[data-editor-fact]'))return;
  e.preventDefault();
  if(form.dataset.editorForm==='request'){
   await sendOtp(form.querySelector('[name="email"]')?.value?.trim()||'');return;
  }
  if(form.dataset.editorForm==='verify'){
   await verifyOtp(form.querySelector('[name="email"]')?.value?.trim()||'',form.querySelector('[name="otp"]')?.value?.trim()||'');return;
  }
  if(form.dataset.editorFact)await submitReview(form.dataset.editorFact,form);
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-editor-action]');if(!b)return;
  if(b.dataset.editorAction==='logout')logout();
 });
}
global.MediIdentaReviewAuth={init,accountHtml,reviewActionHtml,
 _debug:{isActiveRevision,digestFact,configured:()=>A.configured,role:()=>A.role,events:()=>A.events.length}};
})(window);
