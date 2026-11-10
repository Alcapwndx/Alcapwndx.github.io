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
 // Official EMA dose-form CodeSystem 200000000004:
 // https://pms.ema.europa.eu/fhir/ig/CodeSystem-200000000004.html
 const doseForms=[
 '100000073649|Powder for oral suspension|Pulver zur Herstellung einer Suspension zum Einnehmen',
 '100000073650|Granules for oral suspension|Granulat zur Herstellung einer Suspension zum Einnehmen',
 '100000073652|Syrup|Sirup',
 '100000073654|Dispersible tablet|Dispergierbare Tablette',
 '100000073655|Oral powder|Pulver zum Einnehmen',
 '100000073660|Capsule, soft|Weichkapsel',
 '100000073661|Gastro-resistant capsule, soft|Magensaftresistente Weichkapsel',
 '100000073662|Prolonged-release capsule, hard|Hartkapsel mit verlängerter Wirkstofffreisetzung',
 '100000073663|Modified-release capsule, hard|Hartkapsel mit veränderter Wirkstofffreisetzung',
 '100000073664|Tablet|Tablette',
 '100000073665|Film-coated tablet|Filmtablette',
 '100000073666|Orodispersible tablet|Schmelztablette',
 '100000073667|Gastro-resistant tablet|Magensaftresistente Tablette',
 '100000073668|Modified-release tablet|Tablette mit veränderter Wirkstofffreisetzung',
 '100000073681|Effervescent tablet|Brausetablette',
 '100000073682|Oral lyophilisate|Lyophilisat zum Einnehmen',
 '100000073683|Prolonged-release tablet|Retardtablette',
 '100000073684|Chewable tablet|Kautablette',
 '100000073693|Sublingual spray|Sublingualspray'
 ];
 const forms=Object.freeze(Object.fromEntries(doseForms.map(row=>{
  const [code,en,de]=row.split('|');return [code,{de,en}];
 })));

 // Controlled terms: each group is tied to exactly ONE official reference
 // system. A numeric term in an unrelated system MUST NOT be translated.
 // Source snapshots: EMA PMS FHIR IG 1.2.1 (2026-06-26), FHIR R5 ingredient-role.
 const TERMINOLOGY={
  // Product record status != authorization status.
  '200000005003':[
   '200000005004|Current|Aktueller Quelldatensatz',
   '200000005005|Provisional|Vorläufiger Quelldatensatz',
   '200000005006|Non-current|Nicht mehr aktueller Quelldatensatz',
   '200000005007|Nullified|Annullierter Quelldatensatz'
  ],
  // Regulatory entitlement: do not conflate "valid" with market availability.
  '100000072049':[
   '100000072097|Application received|Antrag eingegangen',
   '100000072098|Application withdrawn|Antrag zurückgezogen',
   '100000072099|Valid|Zulassung gültig laut Quelle',
   '100000072100|Expired|Zulassung abgelaufen laut Quelle',
   '100000072110|Application not accepted|Antrag nicht angenommen',
   '100000072111|Application rejected|Antrag abgelehnt',
   '100000072112|Not renewed|Nicht verlängert',
   '100000072113|Withdrawn|Zurückgezogen',
   '100000072114|Withdrawn, unspecified|Zurückgezogen (nicht näher angegeben)',
   '100000072121|Revoked|Widerrufen',
   '100000072122|Suspended|Ruhend',
   '100000072123|Expired due to Sunset Clause|Durch Sunset-Klausel erloschen',
   '200000010409|Surrendered|Verzichtet',
   '200000017707|Valid - Transferred marketing authorisation|Gültig – Zulassung übertragen',
   '200000017708|Valid - Renewed/Varied|Gültig – verlängert oder geändert',
   '200000026056|Presubmission|Vor Einreichung',
   '200000029967|Harmonised|Harmonisiert',
   '200000032262|Not valid - Superseded by marketing authorisation renewal/variation|Nicht gültig – durch Zulassungsverlängerung/-änderung ersetzt',
   '200000032263|Not valid - Superseded by marketing authorisation transfer|Nicht gültig – durch Zulassungsübertragung ersetzt',
   '200000032495|Pending national phase|Nationale Phase ausstehend',
   '220000000066|Pending|Ausstehend',
   '220000000067|Rejected|Abgelehnt'
  ],
  // Marketing status is not the same as regulatory entitlement status.
  '100000072052':[
   '100000072074|Not marketed|Nicht im Handel laut Quelle',
   '100000072075|No data provided|Keine Angaben zum Marktstatus',
   '100000072083|Marketed|Im Handel laut Quelle',
   '200000026055|Never marketed|Bisher nicht vermarktet',
   '230000000000|Temporarily unavailable|Vorübergehend nicht verfügbar'
  ],
  '100000072050':[
   '100000072072|Active|Wirkstoff',
   '100000072073|Adjuvant|Adjuvans',
   '100000072082|Excipient|Hilfsstoff',
   '100000136065|Starting material for excipient|Ausgangsmaterial für Hilfsstoff',
   '100000136066|Solvent / Diluent|Lösungsmittel / Verdünnungsmittel',
   '100000136178|Raw materials used in the manufacture of the product|Rohmaterial zur Herstellung',
   '100000136179|Starting material for active substance|Ausgangsmaterial für Wirkstoff',
   '100000136561|Overage|Herstellungszuschlag',
   '200000003427|bioenhancer|Bioenhancer'
  ],
  '100000072051':[
   '100000072076|Medicinal product not subject to medical prescription|Nicht verschreibungspflichtig laut Quelle',
   '100000072077|Medicinal product on medical prescription for renewable or non-renewable delivery|Verschreibungspflichtig – wiederholbar oder einmalig',
   '100000072078|Medicinal product subject to restricted medical prescription|Eingeschränkte Verschreibungspflicht',
   '100000072079|Medicinal product on medical prescription for non-renewable delivery|Verschreibungspflichtig – einmalige Abgabe',
   '100000072084|Medicinal product subject to medical prescription|Verschreibungspflichtig laut Quelle',
   '100000072085|Medicinal product subject to special medical prescription|Besondere Verschreibungspflicht',
   '100000072086|Medicinal product on medical prescription for renewable delivery|Verschreibungspflichtig – wiederholbare Abgabe',
   '100000157313|Medicinal product subject to special and restricted medical prescription|Besondere und eingeschränkte Verschreibungspflicht',
   '200000002239|Medicinal product subject to medical prescription exempt for some pack sizes|Verschreibungspflicht mit Ausnahmen für einzelne Packungsgrößen'
  ],
  // EMA geographic terms, not evidence of German market availability.
  '100000000002':[
   '100000000330|Austria|Österreich',
   '100000000337|Belgium|Belgien',
   '100000000349|Bulgaria|Bulgarien',
   '100000000373|Croatia|Kroatien',
   '100000000375|Cyprus|Zypern',
   '100000000376|Czechia|Tschechien',
   '100000000377|Denmark|Dänemark',
   '100000000388|Estonia|Estland',
   '100000000390|European Union|Europäische Union',
   '100000000394|Finland|Finnland',
   '100000000395|France|Frankreich',
   '100000000403|Germany|Deutschland',
   '100000000406|Greece|Griechenland',
   '100000000421|Hungary|Ungarn',
   '100000000422|Iceland|Island',
   '100000000427|Ireland|Irland',
   '100000000430|Italy|Italien',
   '100000000443|Latvia|Lettland',
   '100000000449|Liechtenstein|Liechtenstein',
   '100000000450|Lithuania|Litauen',
   '100000000451|Luxembourg|Luxemburg',
   '100000000459|Malta|Malta',
   '100000000478|Netherlands|Niederlande',
   '100000000489|Norway|Norwegen',
   '100000000500|Poland|Polen',
   '100000000501|Portugal|Portugal',
   '100000000505|Romania|Rumänien',
   '100000000523|Slovakia|Slowakei',
   '100000000524|Slovenia|Slowenien',
   '100000000529|Spain|Spanien',
   '100000000535|Sweden|Schweden',
   '100000000536|Switzerland|Schweiz',
   '100000000556|United Kingdom|Vereinigtes Königreich',
   '100000000557|United States|Vereinigte Staaten',
   '240000000000|United Kingdom (Northern Ireland)|Vereinigtes Königreich (Nordirland)'
  ],
  '100000000004':[
   '100000000012|Human use|Humanarzneimittel',
   '100000000013|Veterinary use|Tierarzneimittel',
   '100000000014|Human and Veterinary use|Human- und Tierarzneimittel'
  ],
  // Official EMA RMS units, as written by the source; NO dose conversion.
  '100000110633':[
   '100000110653|kilogram(s)|kg',
   '100000110654|gram(s)|g',
   '100000110655|milligram(s)|mg',
   '100000110656|microgram(s)|µg',
   '100000110657|milligram(s)/kilogram|mg/kg',
   '100000110658|microgram(s)/kilogram|µg/kg',
   '100000110659|milligram(s)/square metre|mg/m²',
   '100000110660|microgram(s)/square metre|µg/m²',
   '100000110661|litre(s)|l',
   '100000110662|millilitre(s)|ml',
   '100000110663|microlitre(s)|µl',
   '100000110664|becquerel(s)|Bq',
   '100000110665|megabecquerel(s)|MBq',
   '100000110666|kilobecquerel(s)|kBq',
   '100000110670|mole(s)|mol',
   '100000110671|international unit(s)|I.E.',
   '100000110672|international unit(s)/kilogram|I.E./kg',
   '100000110673|milliequivalent(s)|mEq',
   '100000110674|percent|%',
   '100000110675|drop(s)|Tropfen',
   '100000110879|second|s',
   '100000110883|square metre|m²',
   '100000110897|unit(s)/millilitre|Einheiten/ml',
   '100000110901|milligram(s)/hour|mg/h',
   '100000110908|milligram(s)/kilogram/hour|mg/kg/h',
   '100000110911|microgram(s)/24 hours|µg/24 h',
   '100000110912|milligram(s)/24 hours|mg/24 h',
   '100000110920|microgram(s)/dose|µg/Dosis',
   '100000110921|milligram(s)/dose|mg/Dosis',
   '100000110925|cells/microlitre|Zellen/µl',
   '100000155670|millilitre(s)/gram|ml/g',
   '100000155671|millilitre(s)/kilogram|ml/kg',
   '100000156970|milligram(s)/unit(s)|mg/Einheit',
   '100000166092|microgram(s)/hour|µg/h'
  ],
  // Types of regulatory entitlement (do not conflate with legal status).
  '220000000060':[
   '200000015756|Homeopathic Registration|Homöopathische Registrierung',
   '200000051585|Manufacturing Authorisation|Herstellungserlaubnis',
   '220000000061|Marketing Authorisation|Arzneimittelzulassung',
   '220000000062|Orphan Designation|Orphan-Drug-Ausweisung',
   '220000000063|Parallel Trade Authorisation|Parallelhandelsgenehmigung',
   '220000000077|Market Protection|Vermarktungsschutz'
  ],
  '220000000000':[
   '220000000001|Full name|Vollständiger Produktname',
   '220000000002|Invented name part|Erfundener Namensbestandteil',
   '220000000003|Scientific name part|Wissenschaftlicher Namensbestandteil',
   '220000000004|Strength part|Stärkenangabe im Produktnamen',
   '220000000005|Pharmaceutical dose form part|Arzneiform im Produktnamen',
   '220000000006|Formulation part|Formulierungsangabe im Produktnamen',
   '220000000009|Container or pack part|Packungsbestandteil im Produktnamen'
  ]
 };
 const terms=Object.create(null);
 const SOURCES=Object.freeze(Object.fromEntries(Object.keys(TERMINOLOGY).map(k=>[
  k,'https://pms.ema.europa.eu/fhir/ig/CodeSystem-'+k+'.html'
 ])));
 for(const [id,rows] of Object.entries(TERMINOLOGY)){
  const result=Object.create(null);
  for(const row of rows){
   const parts=row.split('|');
   if(parts.length!==3||!(/^[0-9]{9,15}$/).test(parts[0])||result[parts[0]])
    throw Error('Invalid EMA RMS vocabulary entry in '+id);
   result[parts[0]]=Object.freeze({code:parts[0],system:'http://spor.ema.europa.eu/v1/lists/'+id,
     source:SOURCES[id],en:parts[1],de:parts[2]});
  }
  terms[id]=Object.freeze(result);
 }
 Object.freeze(terms);
 const routeId='100000073345',formId='200000000004';
 const defaultByKind=Object.freeze({
  administration_routes:routeId,
  authorised_dose_forms:formId,
  administrable_dose_form:formId,
  manufactured_dose_form:formId,
  product_status_codes:'200000005003',
  authorization_status_raw:'100000072049',
  authorization_region_codes:'100000000002',
  ingredient_role_codes:'100000072050',
  // NO default for ambiguous FHIR classification, product identifiers,
  // substance names or combined dose forms. The exact system is required.
 });
 const validSystem=raw=>{
  const x=String(raw??'').trim();
  if(!x)return null;
  const m=/^https?:\/\/spor\.ema\.europa\.eu\/v1\/lists\/([0-9]{12})(?:\/terms\/[0-9]{9,15})?\/?$/.exec(x);
  return m?m[1]:null;
 };
 function resolve(code, system, kind){
  const c=String(code??'').trim(),raw=String(system??'').trim();
  if(!/^[0-9]{9,15}$/.test(c))return null;
  let listId;
  if(raw){
   listId=validSystem(raw);
   if(!listId&&raw==='http://hl7.org/fhir/ingredient-role')
    listId='100000072050';
   // NEVER fall back from an unfamiliar system to a kind-based guess.
   if(!listId)return null;
  }else listId=defaultByKind[kind]||null;
  if(!listId)return null;
  const codebook=listId===routeId?routes:listId===formId?forms:terms[listId];
  const item=codebook?.[c];
  return item?{
   code:c,system:'http://spor.ema.europa.eu/v1/lists/'+listId,
   source:SOURCES[listId]||'https://pms.ema.europa.eu/fhir/ig/CodeSystem-'+listId+'.html',
   en:item.en,de:item.de
  }:null;
 }
 function resolveUnit(code,system){
  // Unit codes in a FHIR Quantity require the RMS units system. UCUM is
  // a DIFFERENT system and is never rewritten with these referentials.
  const list=validSystem(system);
  return list==='100000110633'?resolve(code,system,''):null;
 }
 root.MediIdentaRmsCodes=Object.freeze({
  resolve,resolveUnit,
  sources:Object.freeze({...SOURCES,[routeId]:'https://pms.ema.europa.eu/fhir/ig/CodeSystem-'+routeId+'.html',
    [formId]:'https://pms.ema.europa.eu/fhir/ig/CodeSystem-'+formId+'.html'}),
  version:'EMA PMS IG v1.2.1 / 2026-06-26',
  source:'https://pms.ema.europa.eu/fhir/ig/'
 });

})(window);
