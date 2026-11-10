# MediIdenta Demo 0.18 – PMS-Beta-Quellen für die bestehenden 36 Identitäten

**Ziel:** Gute, überprüfbare Demo-Ansicht mit **allen 36 bisherigen** Medikamentenidentitäten, nicht vorschnell 100 unvollständigen Produktkarten.

## Benutzeransicht

Die bestehende reguläre Medikamentensuche bleibt erhalten; sie zeigt auch PMS-only-Quellen. Jedes der 36 MediIdenta-Katalogmedikamente hat jetzt in seiner normalen Detailansicht einen **EMA PMS Beta**-Bereich.

- **Passende Quellprodukte importiert:** PMS-Beta-Informationsblöcke mit lesbaren Begriffen, Herkunft, Original-FHIR-Werten, Quellenverknüpfung und unabhängigen redaktionellen Status. Eine bloße Namensähnlichkeit ist ausdrücklich **keine** Arzneimittelidentitätsbestätigung.
- **Noch keine PMS-Quelle importiert:** Der Bereich bleibt sichtbar und zeigt offen `PMS-Beta-Quelle noch offen`, statt spurlos zu fehlen. Dieses Label bedeutet **nicht**, dass EMA grundsätzlich nie einen passenden Datensatz liefern kann.
- **PMS-Quelle technisch nicht erreichbar:** Ein gesonderter Verbindungsfehler; bereits vorhandene MediIdenta-Identität und klinische Fachtexte bleiben lesbar.
- **Fachliche Freigaben:** Öffentlich lesbare PMS-Quellen brauchen vorher keine Adminfreigabe. Eine unabhängige, source-bound fachliche Einzelfeldfreigabe bleibt ausschließlich Adminaktion.

Unter **Qualität → EMA-PMS-Abdeckung der Demo** sieht man live, wie viele der vorhandenen Medikamentenidentitäten eine namensbezogene EMA-PMS-Quelle in Supabase besitzen (z. B. `x/36`). Die aufklappbare alphabetische Übersicht führt jede Identität mit ihrem Status einzeln auf. Ein Klick auf ein Medikament führt zur normalen Detailansicht.

Der Endpunkt `GET /api/v1/pms/demo-coverage` liest ausschließlich öffentliche Katalog-/PMS-Produktnamen aus Supabase, nie private Cursor, OAuth-Tokens oder persönliche Revisionsnotizen. Er verweigert bei abgeschnittenen Datenbankergebnissen irreführende Erfolgsquoten.

## Quellenimport im privaten Repository

Im privaten Projekt liegt `tools/pms_demo_36.py` plus geschützter GitHub-Actions-Workflow `.github/workflows/pms-demo-36.yml`. Dieser überprüft zuerst das tatsächlich veröffentlichte 36er-Supabase-Katalogset und sucht pro noch fehlendem Handelsnamen über die offizielle EMA-FHIR-Public-Beta-API (OAuth2).

Jede gefundene, plausible **PMS-Quelldefinition** wird durch die unveränderte FHIR-`$everything`-Pipeline importiert. Die auf diese Weise angezeigten Produktquellen sind **nicht medizinisch auf identische Stärke, Zulassung oder Packungskennungen geprüft**. Der Workflow erstellt einen maschinenlesbaren Bericht über vorhandene und fehlende Quellangebote; fehlende PMS-Quellen werden niemals erfunden.

Für reale vollständige `36/36` muss der bestätigte Import-/Quellenstatus nach dem Workflow abgelesen werden. Die offizielle EMA-PMS-Public-API bietet nur einen beschränkten Beta-Datenbestand; eine garantierte PMS-Quelle pro Handelsname ist daher ohne echte API-Antwort nicht seriös.

## Abnahme vor dem 100er-Ausbau

1. Tatsächliche Abdeckung in `/api/v1/pms/demo-coverage` und im Qualitätsbereich prüfen; alle 36 Identitäten sichtbar.
2. Mehrere Detailseiten mit/ohne Quellen öffnen, inklusive Diabetes-/Antikoagulanzien-/Onkologie-Beispielen.
3. PMS-Einzelwertprüfung (Admin), Editorstatus, Quellprotokolle, Abstände in Mobilansicht, Light-/Dark-Mode und fehlende Codes testen.
4. Nur nach expliziter Entscheidung weitere **64 amtlich dokumentierte** Arzneimittelidentitäten importieren. Sie werden zunächst **nicht automatisch angelegt**.

**Offizielle API:** <https://api.pms.ema.europa.eu/public/v1/swagger>. Keine zusätzlichen Supabase-Tabellen oder Berechtigungen erforderlich.
