/* MediIdenta 0.5 – Packungscode-Kamera. Kein Identitätsnachweis durch Bild oder Prüfziffer.
   Die Kamera wird lokal verarbeitet; weder Foto noch Videoframe verlassen das Gerät. */
(function(root) {
  'use strict';
  function pzn8(raw) {
    const v=String(raw||'');
    if(!/^[0-9]{8}$/.test(v)) return false;
    const check=[...v.slice(0,7)].reduce((sum,n,i)=>sum+Number(n)*(i+1),0)%11;
    return check!==10&&check===Number(v[7]);
  }
  function gtin(raw) {
    const v=String(raw||'');
    if(!/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(v)) return false;
    const body=[...v.slice(0,-1)].reverse();
    const sum=body.reduce((s,n,i)=>s+Number(n)*(i%2===0?3:1),0);
    return (10-sum%10)%10===Number(v[v.length-1]);
  }
  function validate(system,value) {
    return system==='PZN8'?pzn8(value):system==='GTIN'?gtin(value):false;
  }
  const core={validate,pzn8,gtin};
  if(typeof module!=='undefined'&&module.exports) module.exports=core;
  if(!root.document) return;
  let stream=null,interval=null,timeout=null,active=false,busy=false;
  function message(text){const el=root.document.querySelector('#camera-status');if(el)el.textContent=text;}
  function stopCamera() {
    active=false;
    if(interval){clearInterval(interval);interval=null;}
    if(timeout){clearTimeout(timeout);timeout=null;}
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    const video=root.document.querySelector('#barcode-video');
    if(video){video.pause();video.srcObject=null;video.hidden=true;}
    const btn=root.document.querySelector('[data-action="barcode-stop"]');
    if(btn)btn.hidden=true;
  }
  async function startCamera() {
    if(active)return;
    const video=root.document.querySelector('#barcode-video');
    if(!video)return;
    if(!root.isSecureContext||!root.navigator.mediaDevices?.getUserMedia){
      message('Kamera benötigt HTTPS oder localhost und eine Gerätefreigabe. Bitte Kennung manuell eingeben.');return;
    }
    if(typeof root.BarcodeDetector!=='function'){
      message('Die Barcode-Erkennung wird von diesem Browser nicht unterstützt. Kennung bitte manuell eingeben.');return;
    }
    try{
      const formats=await root.BarcodeDetector.getSupportedFormats();
      const usable=['ean_8','ean_13','upc_a','code_128','data_matrix'].filter(f=>formats.includes(f));
      if(!usable.length){message('Keine geeigneten Barcodeformate verfügbar. Bitte Kennung manuell eingeben.');return;}
      const detector=new root.BarcodeDetector({formats:usable});
      stream=await root.navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
      if(!root.document.contains(video)){stopCamera();return;}
      active=true;
      video.srcObject=stream;
      video.hidden=false;
      await video.play();
      const stop=root.document.querySelector('[data-action="barcode-stop"]');
      if(stop)stop.hidden=false;
      message('Barcode der Verpackung in die Kamera halten. Daten bleiben lokal; Treffer erst nach Datenbankabgleich.');
      interval=setInterval(async()=>{
        if(!active||busy||!root.document.contains(video))return;
        busy=true;
        try{
          const detected=await detector.detect(video);
          for(const item of detected){
            const value=String(item.rawValue||'').trim();
            const type=root.document.querySelector('#code-system')?.value||'PZN8';
            if(!validate(type,value))continue;
            const input=root.document.querySelector('#pzn');
            if(!input)break;
            input.value=value;
            stopCamera();
            message('Kennung erfasst. Prüfziffer formal gültig – bitte mit der Packung vergleichen und anschließend den Datenbankabgleich starten.');
            root.dispatchEvent(new CustomEvent('medidenta:identifier-captured',{detail:{system:type,value}}));
            break;
          }
        }catch(e){message('Barcode konnte nicht gelesen werden. Bitte Kennung manuell eingeben.');stopCamera();}
        finally{busy=false;}
      },350);
      timeout=setTimeout(()=>{if(active){stopCamera();message('Kamera nach 45 Sekunden beendet. Kennung manuell eingeben oder erneut scannen.');}},45000);
    }catch(e){
      stopCamera();
      message('Kamera nicht verfügbar oder Berechtigung verweigert. Bitte Kennung manuell eingeben.');
    }
  }
  root.document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action]');
    if(!el)return;
    if(el.dataset.action==='barcode')startCamera();
    if(el.dataset.action==='barcode-stop')stopCamera();
  });
  root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)stopCamera();});
  root.addEventListener('pagehide',stopCamera);
  root.MediIdentaIdentifiers={...core,startCamera,stopCamera};
})(typeof window!=='undefined'?window:globalThis);
