# MediIdenta Alpha – PMS Beta direkt in Medikamenten-Details und verständliche EMA-RMS-Begriffe

**Änderung vom 10. November 2026.** EMA-PMS-Daten sind öffentliche Beta-Quelldaten, **keine** schon klinisch validierten Informationen.

## Einheitliche Suche und Detailansicht

- Im Suchbildschirm gibt es **eine** Medikamenten-Trefferliste. Die gesonderte PMS-Spalte und der PMS-eigene Suchbutton wurden entfernt.
- Bestehende MediIdenta-Katalogeinträge bleiben Haupteinträge. PMS-Datensätze, die unter demselben Handelsnamen gefunden werden, erscheinen als eigenständige EMA-Quellabschnitte **innerhalb** der regulären Medikamentendetailansicht.
- Gibt es zu einem Suchbegriff nur ein PMS-Produkt, kann auch dieses direkt in der normalen Medikamentendetaildarstellung geöffnet werden; das Quellenlabel bleibt sichtbar.
- Eine **Adminprüfung ist keine Voraussetzung**, um öffentliche, unvalidierte PMS-Beta-Metadaten anzusehen. Adminrechte werden weiterhin für eine **verbindliche** medizinische Einzelfeldfreigabe, eine belastbare Identitätsbestätigung sowie klinische Freigaben benötigt.
- **Automatische Quellenzuordnung über Handelsnamensähnlichkeit ist keine Identitätsbestätigung.** Arzneistärke, Wirkstoff/Salz, Dosierungsform, Marktgebiet und Packungskennungen können abweichen. Solche Quellen erhalten `NAME_SIMILARITY_UNCONFIRMED`; nur separat bestätigte Identitätslinks bekommen `ADMIN_CONFIRMED_SOURCE_LINK_ONLY`.
- Hyphenierte ähnliche Handelsnamen und beliebige Namensfragmente dürfen nicht allein wegen eines gemeinsamen Anfangs als dasselbe Präparat auftreten. Sie bleiben eigenständige Treffer.
- Ein Ausfall des optionalen PMS-Quellenendpunkts darf die normale Medikamentendetailseite nicht blockieren: die App zeigt die bestehenden Daten weiterhin an und kennzeichnet PMS als gerade nicht erreichbar.

## Numerische Codes werden verständlich

Die öffentliche EMA PMS API verwendet **SPOR/RMS-Referenzterminologie**. Ein `Coding.code` muss über seine **System-ID** und den tatsächlichen **Term-ID** aus dem offiziellen Codesystem aufgelöst werden.

Für nachgewiesene Beispiele:
- `100000073615` aus `100000073345`: **Nasal use → Nasale Anwendung**
- `100000073619`: **Oral use → Orale Anwendung**
- `100000073611`: **Intravenous use → Intravenöse Anwendung**
- `100000073633`: **Subcutaneous use → Subkutane Anwendung**
- `100000073665` aus `200000000004`: **Film-coated tablet → Filmtablette**

Das im Chat erwähnte Beispiel `01700009536` wurde **nicht** als Nasal-Code in den offiziellen EMA-RMS-Listen bestätigt. Ohne gültigen Quellen-/Codesystemnachweis erhält es daher **keine erratene Bedeutung**.

Die Datei `medidenta-preview/rms-codes.js` enthält eine erste versionierte, dokumentierte Menge offiziell referenzierter EMA-Codes (häufige Applikationswege und Arzneiformen). `data-display.js` zeigt die deutschen Bezeichnungen in den PMS-Karten an. **Unbekannte Codes bleiben ausdrücklich „Nicht aufgelöster EMA-Code: …“**; der Original-Code, dessen FHIR-System, die Quelle, der SHA-256 und der Prüfstatus bleiben in einer aufklappbaren Detailansicht erhalten. Fachlich verschiedene Daten werden nicht durch Code-Normalisierung zusammengeführt.

Offizielle Quellen:
- [EMA PMS Public API / SPOR Referenzdaten](https://api.pms.ema.europa.eu/public/v1/swagger)
- [EMA Routes and Methods of Administration – RMS 100000073345](https://pms.ema.europa.eu/fhir/ig/CodeSystem-100000073345.html)
- [EMA Pharmaceutical Dose Form – RMS 200000000004](https://pms.ema.europa.eu/fhir/ig/CodeSystem-200000000004.html)
- [EDQM Standard Terms](https://standardterms.edqm.eu/)

## Tests und verbleibende Aufgaben

- Regressionstests für die einheitliche Suche, PMS-Namenszuordnung, nicht bestätigte Identität, Einzeltextstatus, FHIR-Quellfelder, EMA-RMS-Bezeichnungen sowie unbekannte Codewerte.
- Keine neuen Supabase-Migrationen oder DB-Schreibrechte für die Anzeige nötig. Die Live-Namenszuordnung verwendet die bereits vorhandenen `medidenta_pms_products` und `medidenta_pms_fields` (RLS-lesend). Das bereits vorhandene Admin-Review und das Audit bleiben vollständig unberührt.
- Die Codeübersetzung deckt noch **nicht alle** der mehr als 200 SPOR-RMS-Referenzlisten ab. Für unbekannte Angaben müssen weitere offizielle Referenzbegriffe nachgeladen bzw. nachweisbar als zusätzliches versioniertes Wörterbuch aufgenommen werden.
- Nach dem Render-Deployment echte Stichproben mit mehreren Produkten, Darreichungsformen und Wirkstärken durchführen. PMS-Beta-Quelldaten dürfen nicht als geprüfte Identifikation, Dosierung oder Therapieempfehlung dargestellt werden.
