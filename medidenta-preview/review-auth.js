/* MediIdenta Alpha v0.9 – Magic Link login, private checks and tiered RLS.
 * Publishable project key only; NO service_role key and no medicine publication.
 * The audited SHA-256 is an evidence pointer, not proof of clinical correctness.
 */
(function(global){
'use strict';
const SESSION_KEY='medidenta_editorial_auth_session_v07';
const REVIEW_TABLE='medidenta_review_events';
const ROLES_TABLE='medidenta_reviewer_roles';
const DECISIONS={verified:'Fachlich freigegeben – Aussage korrekt',needs_revision:'Überarbeitung erforderlich',rejected:'Aussage fachlich nicht bestätigt'};
const A={configured:false,base:'',key:'',reviewApiBase:null,session:null,user:null,role:null,events:[],message:'',error:false,busy:false,pendingEmail:'',getState:null,draw:null};
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function config(){
 const c=global.MEDIIDENTA_AUTH_CONFIG||{};
 let u;
 try{u=new URL(c.supabaseUrl||'');}catch{return false;}
 if(u.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/.test(u.hostname)||u.pathname!=='/'||u.search||u.hash||u.port)return false;
 if(typeof c.publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(c.publishableKey))return false;
 A.base=u.origin;A.key=c.publishableKey;A.reviewApiBase=c.reviewApiBase==='/api/v1'?'/api/v1':null;A.configured=true;return true;
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
 if(!session){A.session=null;try{sessionStorage.removeItem(SESSION_KEY);}catch{}return;}
 A.session={
  access_token:session.access_token,
  refresh_token:session.refresh_token,
  expires_at:session.expires_at || (Math.floor(Date.now()/1000)+(session.expires_in||3600))
 };
 try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(A.session));}catch{}
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
 A.role=Array.isArray(p)&&p[0]&&['reviewer','moderator','admin'].includes(p[0].role)?(p[0].role==='reviewer'?'moderator':p[0].role):null;
 A.events=[];
 if(A.role==='admin'){
  const list=await request('/rest/v1/'+REVIEW_TABLE+
   '?select=fact_id,source_commit,statement_sha256,decision,created_at&order=created_at.desc&limit=1000',{token});
  A.events=Array.isArray(list)?list:[];
 }
 return true;
}
function busy(msg){A.busy=true;A.error=false;A.message=msg;A.draw?.();}
function done(msg,error=false){A.busy=false;A.message=msg;A.error=error;A.draw?.();}
function redirectPath(){
 // Explicitly allow the callback only on this application's own HTTPS origin.
 // Supabase independently validates this URL against its Auth Redirect URL allowlist.
 try{
   const l=global.location;
   if(l?.protocol==='https:'&&l.pathname.startsWith('/medidenta-preview/')){
     return l.origin+'/medidenta-preview/';
   }
 }catch{}
 return '';
}
async function consumeMagicLink(){
 const l=global.location;
 if(!A.configured||!l?.hash||!l.hash.startsWith('#'))return false;
 const p=new URLSearchParams(l.hash.slice(1));
 const hasAuth=p.has('access_token')||p.has('refresh_token')||p.has('error');
 if(!hasAuth)return false;
 // Clear the sensitive fragment *before* any network request or user interaction.
 // URL fragment never needs to be copied, logged or retained in browser history.
 try{global.history?.replaceState?.(null,'',l.pathname+l.search);}catch{}
 if(p.has('error')){
   done('Der Anmeldelink konnte nicht bestätigt werden. Bitte einen neuen Link anfordern.',true);
   return true;
 }
 const token=p.get('access_token')||'';
 const refresh=p.get('refresh_token')||'';
 const expires=Number(p.get('expires_in')||3600);
 const tokenType=p.get('token_type')||'bearer';
 const flow=p.get('type')||'magiclink';
 if(token.length<16||refresh.length<8||!Number.isFinite(expires)||
    expires<=0||expires>86400||tokenType.toLowerCase()!=='bearer'||
    !['magiclink','signup','email'].includes(flow)){
   done('Der Anmeldelink enthält keine gültige Sitzung. Bitte neu anmelden.',true);
   return true;
 }
 try{
   saveSession({access_token:token,refresh_token:refresh,expires_in:expires});
   await loadProfile(); // Verify access token with Supabase before displaying a user.
   done(A.role==='admin'?'Erfolgreich als Administrator/in angemeldet.':
        A.role==='moderator'?'Erfolgreich als Moderator/in angemeldet.':
        'Erfolgreich angemeldet. Dein Konto hat noch keine Prüfberechtigung.');
 }catch{
   clearUser();
   done('Anmeldelink konnte nicht sicher verifiziert werden. Bitte erneut anmelden.',true);
 }
 return true;
}
async function sendOtp(email){
 if(A.busy)return;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){done('Bitte eine gültige E-Mail-Adresse eingeben.',true);return;}
 busy('Anmeldelink wird angefordert …');
 try{
  const redirect=redirectPath();
  const endpoint='/auth/v1/otp'+(redirect?'?redirect_to='+encodeURIComponent(redirect):'');
  await request(endpoint,{method:'POST',body:JSON.stringify({email,create_user:true})});
  A.pendingEmail=email;
  done('Wenn die Anmeldung zugelassen ist, erhältst du einen Anmeldelink per E-Mail. Bitte den Link auf diesem Gerät öffnen und den Spamordner prüfen.');
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
  done(A.role==='admin'?'Als Administrator/in angemeldet.':A.role==='moderator'?'Als Moderator/in angemeldet.':'Als User angemeldet. Kommentare sind möglich.');
 }catch(e){clearUser();done(e.message,true);}
}
async function logout(){
 try{const token=await validToken();if(token)await request('/auth/v1/logout',{method:'POST',token});}catch{}
 clearUser();done('Abgemeldet.');
}
function accountHtml(){
 const info='<div class="notice warning"><strong>Alpha-Test:</strong> User können Kommentare einreichen. Moderatoren prüfen Quellen und Kommentare, erteilen aber keine klinische Freigabe. Nur Administratoren dürfen einzelne Aussagen fachlich validieren. Keine Patientendaten in die App eingeben.</div>';
 const heading='<div class="eyebrow">MediIdenta · Mein Konto</div><h1>Konto & Mitwirkung</h1>';
 if(!A.configured)return heading+info+
  '<section class="card"><h2>Anmeldung vorbereitet</h2><p>Die geschützte Kontoverwaltung muss noch einmalig mit Supabase verbunden werden.</p>'+
  '<p class="small muted">Bis dahin können Fachtexte wie bisher gelesen und lokale Prüfnotizen erstellt werden. Eine gespeicherte, authentifizierte Bestätigung ist noch nicht möglich.</p></section>';
 if(A.user){
  const role=A.role==='admin'?'Administrator/in':A.role==='moderator'?'Moderator/in':'User (Kommentieren)';
  const history=A.events.slice(0,15).map(x=>'<div class="auth-history"><strong>'+esc(x.fact_id)+'</strong> · '+esc(DECISIONS[x.decision]||x.decision)+
   '<div class="tiny muted">'+esc(new Date(x.created_at).toLocaleString('de-DE'))+' · Revision '+esc(x.source_commit?.slice(0,12))+'</div></div>').join('');
  return heading+info+'<section class="card"><h2>Mein Konto</h2><p><strong>'+esc(A.user.email)+'</strong></p>'+
   '<p class="account-role small"><strong>Rolle:</strong> '+esc(role)+'</p>'+
   (!A.role?'<div class="notice">Du kannst Kommentare zu Fachtexten einreichen. Diese werden vor öffentlicher Anzeige moderiert. Die Moderator-/Adminrolle wird nur von der Projektverwaltung zugewiesen.</div>'+
   '<p class="tiny muted">Benutzer-ID zur einmaligen Rollenvergabe: <code>'+esc(A.user.id)+'</code></p>':'')+
   '<button class="secondary full spaced" data-editor-action="logout">Abmelden</button></section>'+
   (A.role==='admin'?'<section class="card"><h2>Meine letzten Freigabeentscheidungen</h2>'+(history||'<p class="muted">Noch keine Entscheidungen protokolliert.</p>')+'</section>':'')+
   (A.message?'<div class="notice '+(A.error?'danger':'warning')+'">'+esc(A.message)+'</div>':'');
 }
 return heading+info+
 '<section class="card"><h2>Per E-Mail anmelden oder Konto erstellen</h2>'+
 '<p class="small muted">Ohne Passwort: Du erhältst einen sicheren Anmeldelink per E-Mail. Der Link führt zurück in diese MediIdenta-App. Ein neues Konto erhält nicht automatisch medizinische Prüfrechte.</p>'+
 '<form data-editor-form="request" class="editor-form"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" required maxlength="254" value="'+esc(A.pendingEmail)+'" placeholder="name@beispiel.de"></label>'+
 '<button type="submit" class="primary full" '+(A.busy?'disabled':'')+'>Anmeldelink per E-Mail senden</button></form>'+
 '<p class="tiny muted">Für die kostenlose Supabase-Standard-E-Mail ist keine eigene SMTP-Vorlage erforderlich. Falls du später einen SMTP-Anbieter und einen Code-Versand einrichtest, kann der Code-Login wieder aktiviert werden.</p>'+
 (A.message?'<div class="notice '+(A.error?'danger':'warning')+'">'+esc(A.message)+'</div>':'')+
 '</section>';
}
function isActiveRevision(D){
 const commit=D?.syncMeta?.source_commit;
 return typeof commit==='string'&&/^[0-9a-f]{40}$/.test(commit)&&
 D.catalogRevision===commit&&D.draftRevision===commit&&
 ['STATIC_PUBLIC_PREVIEW','LIVE_SUPABASE'].includes(D.syncMeta.mode)&&D.draftLoadError===false;
}
function lastReview(f,D){
 const c=D.syncMeta?.source_commit;
 return A.events.find(x=>x.fact_id===f.id&&x.source_commit===c);
}
function reviewActionHtml(f){
 const D=A.getState?.();
 if(!D||!A.configured||!A.user||!A.reviewApiBase||D.syncMeta?.mode!=='LIVE_SUPABASE')return '';
 const role=A.role==='admin'?'admin':A.role==='moderator'?'moderator':'user';
 const id=esc(f.id);
 const marker=role==='admin'?'Redaktion & Freigabe':role==='moderator'?'Private Prüfung & Moderation':'Diskussion & Kommentare';
 const canCheck=role==='admin'||role==='moderator';
 const current=lastReview(f,D);
 const status=role==='admin'&&current?
   '<p class="small muted">Deine letzte Entscheidung: '+esc(DECISIONS[current.decision]||current.decision)+'</p>':'';
 const opts=Object.entries(DECISIONS).filter(([k])=>!(f.assignment_status==='unmatched'&&k==='verified'));
 const review=role==='admin'&&isActiveRevision(D)?status+
  '<form class="editor-review-form" data-editor-fact="'+id+'">'+
  '<label>Admin-Entscheidung<select name="decision" required>'+opts.map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label>'+
  '<label>Begründung / Korrekturhinweis<textarea name="notes" rows="2" maxlength="3000" placeholder="Ohne Patientendaten"></textarea></label>'+
  '<label class="editor-attest"><input name="source_checked" type="checkbox" required> Ich habe Originalquelle, Fundstelle und Produktbezug persönlich geprüft.</label>'+
  '<button class="primary full" type="submit" '+(A.busy?'disabled':'')+'>Fachentscheidung protokollieren</button>'+
  '<p class="tiny muted">Nur diese konkrete Textfassung kann durch einen Admin validiert werden.</p></form>':'';
 const check=canCheck&&isActiveRevision(D)?
  '<form data-note-form="'+id+'" class="editor-form private-check-panel">'+
  '<strong>Private Quellenprüfung (keine Freigabe)</strong>'+
  '<label>Prüfergebnis<select name="assessment" class="search-input"><option value="checked">Quelle geprüft – ohne Freigabewirkung</option>'+
  '<option value="needs_revision">Überarbeitung erforderlich</option><option value="source_question">Quellenbezug unklar</option></select></label>'+
  '<label>Interne Notiz<textarea name="note" rows="2" maxlength="3000" required placeholder="Begründung; keine Patientendaten"></textarea></label>'+
  '<button class="secondary full" type="submit">Private Prüfung speichern</button></form>':'';
 const comments=
  '<section class="collaboration-comments" data-comment-list="'+id+'"><p class="tiny muted">Kommentare werden beim Öffnen geladen.</p></section>'+
  '<form data-comment-form="'+id+'" class="editor-form">'+
  '<label>Kommentar zur Aussage<textarea name="body" rows="2" minlength="10" maxlength="2000" required placeholder="Sachlicher Hinweis oder Frage zur Quelle – keine Patientendaten"></textarea></label>'+
  '<button type="submit" class="secondary full">Kommentar zur Moderation einreichen</button>'+
  '<p class="tiny muted">Kommentare werden erst nach Freigabe durch die Moderation öffentlich angezeigt. Eine Kommentarfreigabe ist keine fachliche Validierung.</p></form>';
 return '<details class="editor-tools" data-collab-id="'+id+'"><summary>'+esc(marker)+'</summary>'+
  '<div class="tiny muted" data-collab-feedback role="status"></div>'+comments+check+review+'</details>';
}
async function digestFact(f){
 if(!global.crypto?.subtle||typeof TextEncoder==='undefined')throw Error('Sichere Prüfsummenbildung wird auf diesem Gerät nicht unterstützt.');
 const r=f.reference||{};
 const canonical=JSON.stringify([f.id,f.target_type,f.target_name,f.fact_type,f.content_text,r.document_url,r.locator,r.publication_date||null,r.accessed_on||null]);
 const bytes=new TextEncoder().encode(canonical);
 const hash=await global.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function submitLiveReview(data,token){
 const payload={
   fact_id:data.fact_id,source_commit:data.source_commit,
   statement_sha256:data.statement_sha256,decision:data.decision,
   source_checked:data.source_checked,notes:data.notes
 };
 const response=await fetch('/api/v1/reviews',{method:'POST',cache:'no-store',
    headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(payload)});
 let body;try{body=await response.json();}catch{body=null;}
 if(!response.ok)throw Error(
   typeof body?.detail==='string'&&body.detail.length<220?body.detail:
   'Die zentrale Prüfdatenbank hat die Anfrage abgelehnt (HTTP '+response.status+').'
 );
 return body;
}
async function submitReview(id,form){
 if(A.busy)return;
 const D=A.getState?.();
 if(!A.configured||!A.user||A.role!=='admin'||!D||!isActiveRevision(D)){done('Kein freigeschaltetes Prüfkonto oder unklarer Datenstand.',true);return;}
 const f=[...(D.drafts||[]),...(D.approved||[])].find(x=>x.id===id);
 if(!f||!['draft_unreviewed','clinically_reviewed'].includes(f.editorial_status)){done('Die geprüfte Aussage ist nicht mehr verfügbar.',true);return;}
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
  const result=A.reviewApiBase
   ? await submitLiveReview(data,token)
   : await request('/rest/v1/'+REVIEW_TABLE+'?select=fact_id,source_commit,statement_sha256,decision,created_at',{
       method:'POST',token,body:JSON.stringify(data),
       headers:headers(token,{'Content-Type':'application/json','Prefer':'return=representation'})
     });
  if(!Array.isArray(result)||result.length!==1||result[0].fact_id!==f.id||
     result[0].source_commit!==data.source_commit||result[0].statement_sha256!==data.statement_sha256)
   throw Error('Die Datenbankbestätigung konnte nicht verifiziert werden.');
  A.events.unshift(result[0]);
  if(A.reviewApiBase)await global.MediIdentaReloadCatalog?.();
  done(decision==='verified'?'Fachliche Freigabe dokumentiert. Nach dem nächsten gesicherten Abgleich wird genau diese Textfassung im Katalog als fachlich freigegeben angezeigt.':'Deine Entscheidung wurde dokumentiert. Eine ältere Freigabe wird nach dem nächsten gesicherten Abgleich widerrufen.');
 }catch(e){done(e.message,true);}
}

async function liveRequest(path,method,body){
 if(!A.reviewApiBase)throw Error('Nur in der Live-Anwendung verfügbar.');
 const token=await validToken();if(!token)throw Error('Deine Sitzung ist abgelaufen.');
 const r=await fetch('/api/v1'+path,{
  method,cache:'no-store',
  headers:{Accept:'application/json','Content-Type':'application/json','Authorization':'Bearer '+token},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 let data;try{data=await r.json();}catch{data=null;}
 if(!r.ok)throw Error(typeof data?.detail==='string'&&data.detail.length<200?
   data.detail:'Datenbankaktion derzeit nicht verfügbar (HTTP '+r.status+').');
 return data;
}
function collaborationFeedback(details,msg,isError=false){
 const el=details?.querySelector('[data-collab-feedback]');
 if(el){el.className=isError?'notice warning':'small muted';el.textContent=msg;}
}
async function loadComments(details){
 if(!details?.open)return;
 const id=details.dataset.collabId;
 const element=details.querySelector('[data-comment-list]');if(!element)return;
 element.textContent='Kommentare laden …';
 try{
  const data=await liveRequest('/facts/'+encodeURIComponent(id)+'/comments','GET');
  if(!details.isConnected)return;
  const comments=data?.comments||[];
  const mod=A.role==='moderator'||A.role==='admin';
  element.innerHTML=comments.length?comments.map(x=>{
    const state=x.moderation_status;
    const date=x.created_at?new Date(x.created_at).toLocaleDateString('de-DE'):'';
    const buttons=mod&&state==='pending'?
      '<div class="row"><button type="button" class="secondary" data-comment-moderate="'+esc(x.id)+'" data-comment-approve="true">Sichtbar machen</button>'+
      '<button type="button" class="secondary" data-comment-moderate="'+esc(x.id)+'" data-comment-approve="false">Zurückweisen</button></div>':'';
    return '<div class="collaboration-comment"><span class="tag gray">'+
      esc(state==='visible'?'Öffentlicher Kommentar':state==='pending'?'Wartet auf Moderation':'Zurückgewiesen')+
      '</span><p>'+esc(x.body||'')+'</p><time>'+esc(date)+'</time>'+buttons+'</div>';
  }).join(''):'<p class="tiny muted">Noch keine Kommentare zu diesem Fachtext.</p>';
 }catch(e){
  if(details.isConnected)element.textContent='Kommentare derzeit nicht verfügbar. '+String(e.message||'');
 }
}
async function submitComment(form){
 const details=form.closest('details[data-collab-id]'),id=form.dataset.commentForm;
 if(!A.user||!details)return;
 const body=String(form.querySelector('[name="body"]')?.value||'').trim();
 if(body.length<10||body.length>2000){collaborationFeedback(details,'10 bis 2000 Zeichen erforderlich.',true);return;}
 try{
  await liveRequest('/facts/'+encodeURIComponent(id)+'/comments','POST',{body});
  form.reset();
  collaborationFeedback(details,'Kommentar eingereicht. Er wird vor der Veröffentlichung moderiert.');
  await loadComments(details);
 }catch(e){collaborationFeedback(details,String(e.message||e),true);}
}
async function submitModeratorNote(form){
 const details=form.closest('details[data-collab-id]'),id=form.dataset.noteForm,D=A.getState?.();
 if(!details||!D||(A.role!=='moderator'&&A.role!=='admin')||!isActiveRevision(D))return;
 const f=[...(D.approved||[]),...(D.drafts||[])].find(f=>f.id===id);
 if(!f)return;
 const note=String(form.querySelector('[name="note"]')?.value||'').trim();
 const assessment=form.querySelector('[name="assessment"]')?.value;
 if(note.length<10||note.length>3000){collaborationFeedback(details,'Private Notiz: 10–3000 Zeichen erforderlich.',true);return;}
 try{
  await liveRequest('/facts/'+encodeURIComponent(id)+'/moderator-notes','POST',{
    source_commit:D.syncMeta.source_commit,statement_sha256:await digestFact(f),
    assessment,note
  });
  form.reset();
  collaborationFeedback(details,'Private Quellenprüfung revisionsbezogen gespeichert. Keine klinische Freigabe.');
 }catch(e){collaborationFeedback(details,String(e.message||e),true);}
}
async function moderateComment(button){
 const details=button.closest('details[data-collab-id]');
 if(!details||(A.role!=='moderator'&&A.role!=='admin'))return;
 try{
  await liveRequest('/comments/'+encodeURIComponent(button.dataset.commentModerate)+'/moderate',
   'POST',{approve:button.dataset.commentApprove==='true'});
  collaborationFeedback(details,'Kommentarstatus durch Moderatorrolle aktualisiert.');
  await loadComments(details);
 }catch(e){collaborationFeedback(details,String(e.message||e),true);}
}

function init(getState,draw){
 A.getState=getState;A.draw=draw;
 config();
 try{const raw=sessionStorage.getItem(SESSION_KEY);if(raw){const x=JSON.parse(raw);if(x.access_token&&x.refresh_token)A.session=x;}}catch{}
 if(A.configured){
  consumeMagicLink().then(handled=>{
    if(!handled&&A.session){
      loadProfile().then(()=>draw?.()).catch(()=>{clearUser();draw?.();});
    }
  }).catch(()=>{clearUser();done('Anmeldung konnte nicht verarbeitet werden.',true);});
 }
 document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form?.dataset?.editorForm&&!form?.dataset?.editorFact&&!form?.dataset?.commentForm&&!form?.dataset?.noteForm)return;
  e.preventDefault();
  if(form.dataset.editorForm==='request'){
   await sendOtp(form.querySelector('[name="email"]')?.value?.trim()||'');return;
  }
  if(form.dataset.editorForm==='verify'){
   await verifyOtp(form.querySelector('[name="email"]')?.value?.trim()||'',form.querySelector('[name="otp"]')?.value?.trim()||'');return;
  }
  if(form.dataset.commentForm){await submitComment(form);return;}
  if(form.dataset.noteForm){await submitModeratorNote(form);return;}
  if(form.dataset.editorFact)await submitReview(form.dataset.editorFact,form);
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-editor-action]');if(!b)return;
  if(b.dataset.editorAction==='logout')logout();
  if(b.dataset.commentModerate)moderateComment(b);
 });
 document.addEventListener('toggle',e=>{
  const element=e.target;
  if(element?.matches?.('details[data-collab-id]')&&element.open)loadComments(element);
 },true);
}
global.MediIdentaReviewAuth={init,accountHtml,reviewActionHtml,
 _debug:{isActiveRevision,digestFact,configured:()=>A.configured,role:()=>A.role,events:()=>A.events.length}};
})(window);
