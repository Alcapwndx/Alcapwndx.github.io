"use strict";
const assert=require("node:assert/strict");
const view=require("../medication-view.js");

function fact(id,type,content,status="draft_unreviewed",target="P A",productId="id-a"){
 return {id,fact_type:type,content_text:content,editorial_status:status,
  target_type:"product",target_name:target,linked_product_ids:[productId],
  reference:{document_url:"https://www.ema.europa.eu/en/medicines/human/EPAR/test"}};
}

const input=[
 fact("f1","warning"," Vor Anwendung prüfen. "),
 fact("f2","warning","Vor  Anwendung  prüfen.","clinically_reviewed"),
 fact("f3","warning","Andere Warnung."),
 fact("f4","indication","Indikation X."),
 fact("f5","warning","Vor Anwendung prüfen.","draft_unreviewed","P B","id-b")
];
const one=view.groupClinical(input.slice(0,4),true);
assert.equal(one.length,2,"Warning and indication each get one topic");
const warning=one.find(x=>x.type==="warning");
assert.equal(warning.records.length,3);
assert.equal(warning.items.length,2,"Identical warning text appears once");
assert.equal(warning.items[0].records.length,2,"Both source records are retained");
assert.equal(warning.reviewed,1);
assert.equal(warning.unreviewed,2,"One approval never validates the duplicate draft");
assert.equal(warning.duplicates,1);
assert.equal(view.groupClinical(input,false).filter(x=>x.type==="warning").length,2,
 "Separate medications must never have their warnings merged");
assert.equal(view.groupClinical([
 fact("one","warning","Nur bei Niereninsuffizienz"),
 fact("two","warning","Nicht bei Niereninsuffizienz")
],true)[0].items.length,2,"Clinically different warnings must remain separate");
const pms=[
 {id:"pms_a",attribute_key:"strength_raw_no_dose_conversion",
  value_json:{presentationRatio:{numerator:{value:5,unit:"mg"},denominator:{value:1,unit:"Tablette"}}},
  editorial_status:"clinically_reviewed"},
 {id:"pms_b",attribute_key:"strength_raw_no_dose_conversion",
  value_json:{presentationRatio:{denominator:{unit:"Tablette",value:1},numerator:{unit:"mg",value:5}}},
  editorial_status:"draft_unreviewed"},
 {id:"pms_c",attribute_key:"strength_raw_no_dose_conversion",
  value_json:{presentationRatio:{numerator:{value:10,unit:"mg"},denominator:{value:1,unit:"Tablette"}}},
  editorial_status:"draft_unreviewed"},
 {id:"pms_d",attribute_key:"substance_identity_raw",value_json:{text:"Testwirkstoff"},
  editorial_status:"draft_unreviewed"},
 {id:"pms_e",attribute_key:"clinical_use_type_unverified",value_json:"warning",
  editorial_status:"draft_unreviewed"}
];
const groups=view.groupPms(pms),strength=groups.find(x=>x.title==="Wirkstoffe und Stärken");
assert.equal(strength.items.length,3,"Distinct strength and substance fields retained");
assert.equal(strength.records.length,4);
assert.equal(strength.duplicates,1,"Equivalent JSON key order deduplicated for display");
assert.equal(strength.items[0].records.length,2);
assert.equal(strength.reviewed,1);
assert.equal(strength.unreviewed,3);
assert.equal(groups.filter(x=>x.title.includes("Klinische Quellmetadaten")).length,1);
assert.match(view.displayPms(pms[0].value_json),/5 mg je 1 Tablette/);
assert.match(view.displayPms({coding:[{code:"12345",display:"Oral"}]}),/Oral/);
assert.match(view.displayPms({coding:[{code:"12345"}]}),/Quellcode 12345/);
assert.match(view.displayPms({productName:"Testwirkstoff 5 mg"}),/Testwirkstoff 5 mg/);
assert.match(view.displayPms([{value:3,unit:"mg"},{value:5,unit:"mg"}]),/3 mg\n5 mg/);
console.log("Clinical and PMS grouping, exact source retention and readable FHIR rendering: PASS");
