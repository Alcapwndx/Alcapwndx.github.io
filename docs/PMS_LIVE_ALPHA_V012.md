# MediIdenta PMS Live-Alpha v0.12 (Render + Supabase)

Ein separater PMS-Quellendatenbestand wird öffentlich als **NICHT KLINISCH VALIDIERT** angezeigt. Die bisherigen Daten bleiben separat.

- Die öffentliche Suche/Details: `GET /api/v1/pms/products?q=&limit=25&offset=0`, `GET /api/v1/pms/products/{pms_id}`.
- Die Weboberfläche ist über **Medikamente suchen → EMA PMS · Strukturierte Quelldaten** erreichbar.
- Der Admin kann pro **Einzelwert** einen Quellencheck bestätigen oder den Wert ablehnen/überarbeiten. Der Schreibendpunkt `POST /api/v1/pms/reviews` verwendet den eingeloggten Nutzer-JWT, niemals einen Admin-Datenbankschlüssel im Browser.
- Die Supabase-RPC `medidenta_submit_pms_review` erzwingt serverseitig Admin-Rolle, aktuelle revisionsgebundene SHA-256, Quellbestätigung und append-only Audit.
- Veränderte Werte sind **nicht mehr** administrativ validiert. Eine bestätigte einzelne Wirkstärke ersetzt nicht die klinische Fachinformation und erlaubt keine Dosierung oder Austauschentscheidung.
- PMS-IDs werden niemals als identisch mit deutschen Artikel-57-Produkt-, PZN- oder GTIN-Identitäten angenommen.
- Render-Seitensuche ist paginiert. Der vorhandene Katalog-Snapshot lädt in 900er-Seiten, begrenzt auf 27.000 Einträge; vor einem echten Massenausbau sollte die Hauptsuche vollständig auf serverseitig gefilterte Datenbankabfragen umgestellt werden.

Aktueller sicherer Importumfang: zunächst **ein authentifiziertes EMA-PMS-Produkt** mit getrennten, revisionsgebundenen Feldangaben. Die Ausweitung auf weitere Produkte erfolgt erst nach Validierung dieses Pfads und Klärung der EMA-Datenweiterverwendung.

Nicht für Arzneimittelgabe, Therapie- oder Dosierungsentscheidungen verwenden.