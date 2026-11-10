/* MediIdenta – official EMA SPOR RMS route code descriptions.
   Source: EMA PMS FHIR Implementation Guide CodeSystem 100000073345 v1.2.1
   https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000073345.html
   This is a presentation-only dictionary. Raw FHIR values remain unchanged.
   Do not guess labels for codes outside the verified reference vocabulary. */
(function(root){
 'use strict';
 const routeValues=[
 '100000073564|Auricular use|Anwendung am Ohr',
 '100000073566|Cutaneous use|Anwendung auf der Haut',
 '100000073567|Dental use|Dentale Anwendung',
 '100000073569|Endocervical use|Endozervikale Anwendung',
 '100000073570|Endosinusial use|Anwendung in den Nasennebenhöhlen',
 '100000073571|Endotracheopulmonary use|Endotracheopulmonale Anwendung',
 '100000073572|Epidural use|Epidurale Anwendung',
 '100000073576|Gastroenteral use|Gastroenterale Anwendung',
 '100000073577|Gastric use|Gastrale Anwendung',
 '100000073578|Gingival use|Anwendung am Zahnfleisch',
 '100000073579|Haemodialysis|Hämodialyse',
 '100000073584|Inhalation use|Inhalative Anwendung',
 '100000073585|Intestinal use|Intestinale Anwendung',
 '100000073587|Intraarterial use|Intraarterielle Anwendung',
 '100000073588|Intraarticular use|Intraartikuläre Anwendung',
 '100000073590|Intracardiac use|Intrakardiale Anwendung',
 '100000073594|Intracoronary use|Intrakoronare Anwendung',
 '100000073595|Intradermal use|Intradermale Anwendung',
 '100000073597|Intralesional use|Intraläsionale Anwendung',
 '100000073600|Intramuscular use|Intramuskuläre Anwendung',
 '100000073601|Intraocular use|Intraokulare Anwendung',
 '100000073602|Intraosseous use|Intraossäre Anwendung',
 '100000073604|Intraperitoneal use|Intraperitoneale Anwendung',
 '100000073608|Intrathecal use|Intrathekale Anwendung',
 '100000073610|Intrauterine use|Intrauterine Anwendung',
 '100000073611|Intravenous use|Intravenöse Anwendung',
 '100000073612|Intravesical use|Intravesikale Anwendung',
 '100000073613|Intravitreal use|Intravitreal Anwendung',
 '100000073615|Nasal use|Nasale Anwendung',
 '100000073616|Nebulisation use|Verneblung',
 '100000073617|Ocular use|Anwendung am Auge',
 '100000073618|Oculonasal use|Okulonasale Anwendung',
 '100000073619|Oral use|Orale Anwendung',
 '100000073620|Oromucosal use|Anwendung in der Mundhöhle',
 '100000073621|Oropharyngeal use|Oropharyngeale Anwendung',
 '100000073628|Rectal use|Rektale Anwendung',
 '100000073629|Route of administration not applicable|Applikationsweg nicht zutreffend',
 '100000073632|Subconjunctival use|Subkonjunktivale Anwendung',
 '100000073633|Subcutaneous use|Subkutane Anwendung',
 '100000073634|Sublingual use|Sublinguale Anwendung',
 '100000073637|Transdermal use|Transdermale Anwendung',
 '100000073638|Urethral use|Urethrale Anwendung',
 '100000073639|Vaginal use|Vaginale Anwendung',
 '100000075238|Intragastric use|Intragastrale Anwendung',
 '100000075239|Intraepidermal use|Intraepidermale Anwendung',
 '100000075242|Intranasal use|Intranasale Anwendung',
 '100000075243|Local use|Lokale Anwendung',
 '100000075244|Not mentioned|Nicht angegeben',
 '100000075248|Infiltration|Infiltration',
 '100000075249|Implantation|Implantation',
 '100000075250|Enteral use|Enterale Anwendung',
 '100000075251|Conjunctival use|Konjunktivale Anwendung',
 '100000075252|Transmucosal use|Transmukosale Anwendung',
 '100000075254|Percutaneous use|Perkutane Anwendung',
 '100000075255|Nasogastric use|Nasogastrale Anwendung',
 '100000075259|Intrapulmonary use|Intrapulmonale Anwendung',
 '100000075261|Unknown use|Unbekannter Applikationsweg',
 '100000075262|Topical use|Topische Anwendung',
 '100000075263|Subdermal use|Subdermale Anwendung',
 '100000075265|Respiratory use|Anwendung über die Atemwege',
 '100000075266|Parenteral use|Parenterale Anwendung',
 '100000075267|Other use|Sonstiger Applikationsweg',
 '100000075268|Ophthalmic use|Ophthalmologische Anwendung',
 '100000075270|Intravenous drip use|Intravenöse Tropfinfusion',
 '100000075271|Intravenous bolus use|Intravenöse Bolusgabe',
 '100000075272|Intratracheal use|Intratracheale Anwendung',
 '100000075275|Buccal use|Bukkale Anwendung',
 '100000075554|Submucosal use|Submukosale Anwendung',
 '100000075555|Intramuscular and intravenous use|Intramuskuläre und intravenöse Anwendung',
 '100000075559|Epicutaneous use|Epikutane Anwendung',
 '100000125763|Intracameral use|Intrakamerale Anwendung',
 '100000170084|Subretinal use|Subretinale Anwendung',
 '200000010643|Topical|Topische Anwendung',
 '200000016447|Injection|Injektion',
 '200000016448|Solution for infusion|Infusionslösung',
 '200000016449|Infusion|Infusion',
 '200000017716|External use|Äußerliche Anwendung',
 '200000017724|Solution for injection|Injektionslösung',
 '200000017725|Irrigation|Spülung'
 ];
 const routes=Object.freeze(Object.fromEntries(routeValues.map(row=>{
    const [code,en,de]=row.split('|');return [code,{de,en}];
 })));
 // Distinct EMA RMS term list: medicinal/product forms, never infer if
 // FHIR explicitly identifies an unrelated system.
 const misc=Object.freeze({
   '100000073665':{de:'Filmtablette',en:'Film-coated tablet'},
   '100000073498':{de:'Schachtel',en:'Box'},
   '200000002152':{de:'Tablette',en:'Tablet'}
 });
 function resolve(code, system, kind){
  const c=String(code??'').trim(),sys=String(system??'').trim();
  if(!/^[0-9]{8,15}$/.test(c))return null;
  const isRoute=kind==='administration_routes'||sys.includes('/lists/100000073345');
  if(isRoute&&(!sys||sys.includes('/lists/100000073345'))&&routes[c]){
   return {...routes[c],system:'http://spor.ema.europa.eu/v1/lists/100000073345',code:c};
  }
  if((!sys||sys.includes('spor.ema.europa.eu'))&&misc[c]){
    return {...misc[c],system:sys||'EMA RMS',code:c};
  }
  return null;
 }
 root.MediIdentaRmsCodes={resolve,
   source:'https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000073345.html'};
})(window);
