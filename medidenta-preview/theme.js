/* MediIdenta v0.9 – explicit, accessible light/dark appearance control. */
(function(root){
 'use strict';
 const KEY='medidenta_theme_v09';
 function stored(){try{return root.localStorage.getItem(KEY)}catch{return null}}
 function auto(){return root.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light'}
 function apply(mode){
   const final=mode==='dark'?'dark':'light';
   root.document.documentElement.setAttribute('data-theme',final);
   const meta=root.document.querySelector('meta[name="theme-color"]');
   if(meta)meta.setAttribute('content',final==='dark'?'#122b36':'#103f52');
   const button=root.document.querySelector('[data-theme-toggle]');
   if(button){
     button.setAttribute('aria-label',final==='dark'?'Helles Design aktivieren':'Dunkles Design aktivieren');
     button.setAttribute('title',final==='dark'?'Zum hellen Design wechseln':'Zum dunklen Design wechseln');
     button.setAttribute('aria-pressed',String(final==='dark'));
     button.textContent=final==='dark'?'☀':'☾';
   }
 }
 const initial=stored();
 apply(initial==='light'||initial==='dark'?initial:auto());
 root.document.addEventListener('click',function(e){
   if(!e.target.closest?.('[data-theme-toggle]'))return;
   const next=root.document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
   try{root.localStorage.setItem(KEY,next)}catch{}
   apply(next);
 });
 root.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change',()=>{
   if(!['light','dark'].includes(stored()))apply(auto());
 });
 root.MediIdentaTheme={set:mode=>{
   if(mode!=='dark'&&mode!=='light')return;
   try{root.localStorage.setItem(KEY,mode)}catch{}
   apply(mode);
 },current:()=>root.document.documentElement.getAttribute('data-theme')};
})(window);
