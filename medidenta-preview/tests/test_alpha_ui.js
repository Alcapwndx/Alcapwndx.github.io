"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const dir=path.resolve(__dirname,"..");
const read=n=>fs.readFileSync(path.join(dir,n),"utf8");
const html=read("index.html"),style=read("app.css"),app=read("app.js"),
 auth=read("review-auth.js"),sw=read("service-worker.js");
assert.match(html,/ALPHA · Kontrollierte öffentliche Testphase/);
assert.doesNotMatch(html,/Öffentliche Entwicklungs-Demo/);
assert.match(html,/data-theme-toggle/);
assert.match(html,/theme\.js\?v=0\.9/);
assert.match(style,/main\{padding-bottom:calc\(var\(--bottom-nav-size\)/);
assert.match(style,/@media \(min-width:700px\)/);
assert.match(style,/\.app-shell\{display:flex;flex-direction:column/);
assert.match(style,/main\{flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto/);
assert.match(style,/html\[data-theme="dark"\] \.app-shell/);
assert.doesNotMatch(style,/@media\(prefers-color-scheme:dark\)/);
assert.match(style,/\.theme-switch/);
assert.match(app,/data-action="pzn"/);
assert.match(app,/Barcode-Scanner/);
assert.match(app,/Tablette fotografieren/);
assert.match(app,/aria-disabled="true"/);
assert.doesNotMatch(app,/function syncHtml/);
assert.match(app,/Letzter überprüfter EMA-Quellenabgleich/);
assert.match(app,/target.*70|mindestens <strong>70 %/);
assert.match(app,/Keine.*automatische Beta|keine automatische Beta/i);
assert.match(auth,/medidenta_post_comment|\/facts\/.*comments/);
assert.match(auth,/A\.role!=='admin'/);
assert.match(auth,/Private Quellenprüfung/);
assert.match(auth,/data-role-form/);
assert.match(sw,/medidenta-pages-v0\.9/);
assert.match(sw,/theme\.js/);

// The OS preference is only the DEFAULT; manual selection persists.
const listeners={},storage={},doc={
 documentElement:{attributes:{},setAttribute(k,v){this.attributes[k]=v;},
   getAttribute(k){return this.attributes[k];}},
 querySelector(){return null;},
 addEventListener(k,cb){listeners[k]=cb;}
};
const ctx={window:{document:doc,localStorage:{
 getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}
},matchMedia:()=>({matches:true,addEventListener(){}})},console};
vm.runInNewContext(read("theme.js"),ctx);
assert.equal(doc.documentElement.attributes["data-theme"],"dark");
ctx.window.MediIdentaTheme.set("light");
assert.equal(doc.documentElement.attributes["data-theme"],"light");
assert.equal(storage.medidenta_theme_v09,"light");
ctx.window.MediIdentaTheme.set("dark");
assert.equal(doc.documentElement.attributes["data-theme"],"dark");
console.log("MediIdenta Alpha layout, theme, quality and RBAC contract: PASS");
