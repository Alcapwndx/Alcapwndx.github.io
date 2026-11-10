# EMA PMS Beta – MediIdenta Detailansicht und Transparenz 0.17

**Ein gemeinsamer Nutzungsablauf:** Medikament in MediIdenta suchen → Medikamentendetail öffnen → EMA-PMS-Beta-Datensätze im selben Kontext lesen → die exakten Originalcodes, FHIR-Quellen und einzelnen Redaktionsstatus auf Wunsch aufklappen. Ohne fachliche Adminfreigabe sichtbar, aber **als EMA PMS Beta / nicht fachlich validiert** gekennzeichnet. Bei einem nur ähnlich benannten Produkt wird die Quellassoziation **nicht** zur bestätigten Identität erklärt.

## Weitere lesbare PMS-Informationen

Die vorherigen Applikationswege, Arzneiformen, Stoffrollen, Statusbegriffe, Länder und Referenz-Maßeinheiten werden nun durch eine erweiterte Ausgabe aus den öffentlich gelieferten FHIR-Feldern ergänzt:

- Domain / Produkttyp, rechtlicher Abgabestatus, Vermarktungsstatus mit Gebiet und Datumsbereich (wenn tatsächlich von EMA geliefert)
- Packungsart, Packungsmaterial, Anzahl aus der Quelldefinition – **keine** automatisch gültige PZN oder deutsche Packungsgröße
- Status und Art der regulatorischen Berechtigung, Quelldatum / Gültigkeitszeitraum und ggf. die FHIR-/OMS-Inhaberreferenz
- Quellverweis, Versions-/Hash-Referenz und Protokoll der unabhängigen Freigabe **pro PMS-Feld**

Die Darstellung versucht keine Arzneimittelähnlichkeit aus gleichen Handelsnamen abzuleiten. Sie übersetzt ausschließlich offiziell zuordnungsfähige EMA-RMS-Codes oder übernimmt bereits von EMA mitgelieferte Klartexte. Unbekannte Codes werden gesammelt und in einem aufklappbaren **„Unbekannte EMA-Codes“**-Bereich pro PMS-Datensatz transparent ausgewiesen, nicht mit unbewiesenen Bedeutungen gefüllt.

**Status ≠ Gültigkeit ≠ Marktverfügbarkeit:** `Current` als PMS-Quelldatensatzstatus ist kein klinischer Zulassungsnachweis, `Marketed` gilt nur als die jeweilige Quellenangabe, und eine EU-Regulierung beweist nicht automatisch aktuelle Lieferbarkeit oder Abgabebedingungen in Deutschland.

## Administrationsworkflow im eingebetteten PMS-Bereich

Bisher konnten PMS-Feldprüfungen nur beim separat geöffneten PMS-Kandidat gespeichert werden. Seit 0.17 funktioniert derselbe sichere, serverseitig geprüfte **Einzelwertentscheid** auch in der eingebetteten regulären Medikamentendetailseite. Der JWT und der unveränderte SHA-256 des konkreten FHIR-Feldes werden bei jeder Entscheidung geprüft. Eine einzelne bestätigte Angabe bestätigt **weder** das gesamte PMS-Produkt **noch** die konkrete Medikation. User und Moderator können keine fachlichen PMS-Freigaben erteilen.

## Qualitätsanzeige

Die Rubrik „Qualität“ lädt ergänzend `GET /api/v1/pms/overview` (öffentlicher, schreibgeschützter Endpunkt) mit:
`pms_products`, `pms_fields`, `individually_reviewed_fields`, `not_reviewed_fields` und `last_pms_source_import_at`.
Diese Kennzahlen sind **keine klinische Medikamentenfreigabe**. Der geschützte Cursor und EMA-/Supabase-Zugangsschlüssel werden niemals ausgegeben.

## Aktualisierung und Grenzen

Der private GitHub-Importer kann täglich bis zu drei sicher validierte Zehnerseiten fortsetzen; die EMA API ist paginiert, rate-limitiert und benötigt OAuth2. Nachdem die erste Auflistung abgeschlossen ist, werden alte Quellprodukte gestaffelt erneut eingelesen. Der Bestand kann deshalb **nicht** durch eine einzelne Codeauslieferung als vollständig eingelesen gelten.

Wenn EMA ein Datenfeld **nicht** in der öffentlichen API bereitstellt oder die zugehörige RMS-/SMS-/OMS-Codebezeichnung nicht verfügbar ist, zeigen wir den belegbaren Ausgangswert oder „nicht aufgelöst“; keine Vermutung, keine Rekonstruktion geschützter Daten und keine Therapieempfehlung.

Weiterführend: [EMA PMS Public API](https://api.pms.ema.europa.eu/public/v1/swagger), [EMA PMS-Beta Release](https://plm-portal.ema.europa.eu/Guidance/article/KA-02917/en-us), [RMS Code-Dokumentation](EMA_RMS_TERMINOLOGY_V016.md), [Einheitliche PMS-Detailansicht](UNIFIED_PMS_DETAIL_RMS_V015.md).

**Kein neues Supabase-Schema erforderlich.** Bestehende Auth-/Review- und Quellenberechtigungen bleiben unverändert.
