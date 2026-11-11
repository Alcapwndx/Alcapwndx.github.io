"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const dir=path.resolve(__dirname,"..");
const read=n=>fs.readFileSync(path.join(dir,n),"utf8");
const html=read("index.html"),style=read("app.css"),app=read("app.js"),
 auth=read("review-auth.js"),sw=read("service-worker.js");
assert.match(html,/ALPHA · Kontrollierte öffentliche Testphase/);
assert.match(html,/<span class="version">ALPHA 0\.21<\/span>/);
assert.doesNotMatch(html,/<span class="version">ALPHA 0\.9<\/span>/);
assert.match(app,/function smpcHtml\(/);
assert.match(app,/source_document_sha256/);
assert.match(app,/MediIdenta Alpha v0\.21/);
assert.doesNotMatch(html,/Öffentliche Entwicklungs-Demo/);
assert.match(html,/data-theme-toggle/);
assert.match(html,/theme\.js\?v=0\.9\.1/);
assert.match(style,/main\{padding-bottom:calc\(var\(--bottom-nav-size\)/);
assert.match(style,/@media \(min-width:700px\)/);
assert.match(style,/\.app-shell\{display:flex;flex-direction:column/);
assert.match(style,/main\{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto/);
assert.match(style,/html\[data-theme="dark"\] \.app-shell/);
assert.doesNotMatch(style,/@media\(prefers-color-scheme:dark\)/);
assert.match(style,/\.theme-switch/);
assert.match(style,/\.smpc-original/);
assert.match(app,/data-action="pzn"/);
assert.match(app,/Barcode-Scanner/);
assert.match(app,/Tablette fotografieren/);
assert.match(app,/aria-disabled="true"/);
assert.doesNotMatch(app,/function syncHtml/);
assert.match(app,/Letzter dokumentierter EMA-Quellenabgleich/);
assert.match(app,/api\('\/pms\/demo-coverage'\)/);
assert.match(app,/EMA-PMS-Abdeckung der Demo/);
assert.match(app,/PMS-Beta-Quelle noch offen/);
assert.match(app,/Identitäten mit PMS-Beta-Quellen/);
assert.match(app,/data-action="detail"/);

assert.match(app,/function sourcesDisclosure\(/);
assert.match(app,/function knowledgeHtml\(\)/);
assert.match(app,/Praxiswissen/);
assert.match(app,/Quellen & Nachweise/);
assert.doesNotMatch(app,/mindestens <strong>70 %/);
assert.doesNotMatch(app,/Fachlich validierte Einzeltexte/);
assert.match(auth,/medidenta_post_comment|\/facts\/.*comments/);
assert.match(auth,/A\.role!=='admin'/);
assert.match(auth,/Private Quellenprüfung/);
assert.match(auth,/if\(form\.dataset\.roleForm\)/); // Secure role handler is retained.
assert.doesNotMatch(html,/data-role-form/); // Public page hides the role editor.
assert.match(html,/Praxiswissen – bald verfügbar/);
assert.match(html,/Quellenbezogene Arzneimittelinformationen|quellenbezogene Arzneimittelinformationen/i);
assert.match(sw,/medidenta-pages-v0\.21\.1/);
assert.match(sw,/rms-codes\.js/);
assert.match(sw,/data-display\.js/);
assert.match(html,/data-display\.js\?v=0\.20\.1/);
assert.match(html,/rms-codes\.js\?v=0\.16/);
assert.match(html,/app\.js\?v=0\.21\.1/);
assert.match(sw,/theme\.js/);

// The OS preference is only the DEFAULT; manual selection persists.
let themeButton=null;
const listeners={},storage={},doc={
 documentElement:{attributes:{},setAttribute(k,v){this.attributes[k]=v;},
   getAttribute(k){return this.attributes[k];}},
 readyState:"loading",
 querySelector(selector){return selector==="[data-theme-toggle]"?themeButton:null;},
 addEventListener(k,cb){listeners[k]=cb;}
};
const ctx={window:{document:doc,localStorage:{
 getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}
},matchMedia:()=>({matches:true,addEventListener(){}})},console};
vm.runInNewContext(read("theme.js"),ctx);
assert.equal(doc.documentElement.attributes["data-theme"],"dark");
// The theme script runs in <head>, while the header button is only parsed later.
// After DOMContentLoaded the initial dark theme MUST display a sun (switch to light).
themeButton={
 attributes:{},textContent:"☾",
 setAttribute(k,v){this.attributes[k]=v;}
};
assert.equal(themeButton.textContent,"☾","Button has its static HTML placeholder before DOM ready");
assert.equal(typeof listeners.DOMContentLoaded,"function");
listeners.DOMContentLoaded();
assert.equal(themeButton.textContent,"☀");
assert.equal(themeButton.attributes["aria-label"],"Helles Design aktivieren");
assert.equal(themeButton.attributes["aria-pressed"],"true");
assert.equal(themeButton.attributes.title,"Zum hellen Design wechseln");
ctx.window.MediIdentaTheme.set("light");
assert.equal(doc.documentElement.attributes["data-theme"],"light");
assert.equal(themeButton.textContent,"☾");
assert.equal(themeButton.attributes["aria-label"],"Dunkles Design aktivieren");
assert.equal(themeButton.attributes["aria-pressed"],"false");
assert.equal(storage.medidenta_theme_v09,"light");
ctx.window.MediIdentaTheme.set("dark");
assert.equal(doc.documentElement.attributes["data-theme"],"dark");
assert.equal(themeButton.textContent,"☀");
listeners.click({target:{closest:selector=>selector==="[data-theme-toggle]"?themeButton:null}});
assert.equal(doc.documentElement.attributes["data-theme"],"light");
assert.equal(themeButton.textContent,"☾");
console.log("MediIdenta Alpha layout, theme, quality and RBAC contract: PASS");
