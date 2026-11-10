# MediIdenta Alpha 0.16 – EMA PMS/SPOR-Codes verständlich und nach Codesystem anzeigen

## Änderung

Die bestehende Übersetzung von Applikationswegen und Arzneiformen wurde **ausschließlich für die Anzeige** ergänzt:

| EMA/SPOR-Referenzliste | Bereich | Beispiele |
|---|---|---|
| 200000005003 | PMS-Datensatzstatus | `200000005004` = „Aktueller Quelldatensatz“, `200000005005` = „Vorläufiger Quelldatensatz“ |
| 100000072049 | regulatorischer Zulassungsstatus | `100000072099` = „Zulassung gültig laut Quelle“, `100000072122` = „Ruhend“ |
| 100000072052 | Vermarktungsstatus | `100000072083` = „Im Handel laut Quelle“ |
| 100000072050 / FHIR R5 `ingredient-role` | Stoffrolle | `100000072072` = Wirkstoff, `100000072082` = Hilfsstoff |
| 100000000002 | Länder / Gebiete | `100000000403` = Deutschland, `100000000390` = Europäische Union |
| 100000110633 | Maßeinheiten | `100000110655` = mg, `100000110662` = ml, `100000110671` = I.E. |
| 100000072051 | Abgabestatus | `100000072084` = Verschreibungspflichtig laut Quelle (keine verbindliche DE-Einstufung) |
| 100000000004 | Produktbereich | `100000000012` = Humanarzneimittel |
| 220000000060 | Art der regulatorischen Berechtigung | `220000000061` = Arzneimittelzulassung |
| 220000000000 | Namensbestandteile | `220000000004` = Stärkenangabe im Produktnamen |

Bekannte Codes werden nur aufgelöst, wenn das **passende CodeSystem** mitgeliefert wurde, oder wenn der bereits extrahierte Feldtyp genau eine Referenzliste vorgibt. Für Klassifizierung, Wirkstoffidentität oder allgemeine FHIR-Kennungen wird **kein Codesystem vermutet**. Eine numerische ID aus einem fremden CodeSystem wird nicht anhand ähnlicher Ziffern übersetzt. Unbekannte IDs bleiben als `Nicht aufgelöster EMA-Code` sichtbar. Die vollständigen JSON-Originaldaten, einzelnen Prüfstatus, Referenzen und Hashes bleiben in der App erhalten.

**FHIR Quantity:** Bei einer kodierten Maßeinheit aus der offiziellen RMS-Liste zeigen wir die lesbare Einheit (z. B. `5 mg`) statt der Zahl-ID. Zähler, Nenner und numerischer Wert bleiben unverändert. Ein unbekanntes Zahlensystem wird nicht als mg interpretiert, und die App führt **keine Dosisberechnung oder automatische Umrechnung** aus. UCUM-Codes (z. B. `mg` mit System `http://unitsofmeasure.org`) werden unverändert übernommen.

**Medizinisch wichtige Bedeutungsunterschiede:** `Current` kennzeichnet den **PMS-Datensatzstatus**, nicht die Gültigkeit der Zulassung. `Marketed` in einem europäischen PMS-Datensatz ist **kein Nachweis einer tatsächlich in Deutschland verfügbaren Packung**. Rechtliche Verschreibungspflicht kann national abweichen. Einzelne PMS-Beta-Daten bleiben ohne Adminprüfung **nicht fachlich validiert**, unabhängig von einer verbesserten Klartextdarstellung.

## Umsetzung und Wartung

- Client-Wörterbuch: `medidenta-preview/rms-codes.js` (versioniert, mehr Quelllisten; ausschließlich Anzeige)
- Strukturierte FHIR-Wertedarstellung: `medidenta-preview/data-display.js`
- Regressionstests: `medidenta-preview/tests/test_data_display.js`, unter anderem Positiv-/Negativtests zu **exakt gleichen Codes bei verschiedenen Systemen**, alten und unbekannten Codes, Ratio-Einheiten und Statusverwechslungen
- Original-Datenbanktabellen/Import-Historie werden nicht umgeschrieben, keine Supabase-Migration nötig

**Ausbauschritte:** Offizielle EMA-RMS-CodeSysteme maschinenlesbar gegen lokale Codebücher verifizieren und versionieren; für weitere Felder Quellenfamilie und CodeSystem-ID aus FHIR speichern; Statistik der nicht übersetzten Feld-Codes aus der echten Supabase-Alpha prüfen und anschließend gezielt die am häufigsten vorkommenden Referenzlisten erweitern. Einen unbekannten Arzneistoffcode nie aus der Zahl ableiten, sondern nur bei verfügbarem, zulässigem Quelltext.

## Quellen (offizielle EMA IG 1.2.1 / 26.06.2026)

- [PMS Public API](https://api.pms.ema.europa.eu/public/v1/swagger)
- [Record Status – 200000005003](https://pms.ema.europa.eu/fhir/ig/CodeSystem-200000005003.html)
- [Regulatory Entitlement Status – 100000072049](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000072049.html)
- [Marketing Status – 100000072052](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000072052.html)
- [Country – 100000000002](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000000002.html)
- [Units of Measurement – 100000110633](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000110633.html)
- [Legal Status of Supply – 100000072051](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000072051.html)
- [EMA Product Name Part Type – 220000000000](https://pms.ema.europa.eu/fhir/ig/CodeSystem-220000000000.html)
- [Regulatory Entitlement Type – 220000000060](https://pms.ema.europa.eu/fhir/ig/CodeSystem-220000000060.html)
- [Domain – 100000000004](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000000004.html)
- [HL7 FHIR R5 Ingredient Role](https://hl7.org/fhir/R5/codesystem-ingredient-role.html)
- [EMA ISO IDMP ingredient role mapping](https://www.ema.europa.eu/system/files/documents/regulatory-procedural-guideline/eu-iso-idmp-ig_chapter-2_data-elements_august-2026-tc-en.pdf)
