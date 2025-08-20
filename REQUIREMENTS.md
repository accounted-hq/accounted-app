# Überarbeitetes Anforderungsdokument (Requirements Engineering-konform)

Dieses Dokument spezifiziert alle funktionalen und nicht-funktionalen Anforderungen an das System. Ziel ist, dass das Entwicklerteam alle notwendigen Informationen besitzt, um die Funktionen zu programmieren. Alle Anforderungen sind überprüfbar und mit Akzeptanzkriterien versehen.

## 1. Mandantenfähigkeit & Sicherheit
- Alle Daten müssen mandantenspezifisch gespeichert werden.
- Row-Level Security (RLS) ist strikt enforced: Queries dürfen nur Daten des eigenen Mandanten zurückliefern.
- **Testkriterium:** Query von Tenant A auf Daten von Tenant B muss `0 rows` zurückliefern.
- Rollenmodell:
  - `accountant`: darf Buchungen erstellen, ändern (nur vor Posting) und reporten.
  - `auditor`: read-only Zugriff auf Journale und Audit-Logs.
  - `admin`: technische Administration, kein Zugriff auf Geschäftsdaten anderer Mandanten.
  - `integration-bot`: API-Import/Export, eingeschränkte Rechte.
- API-RPCs laufen unter `SECURITY DEFINER` mit Least Privilege. Jeder RPC muss dokumentierte Berechtigungen haben.
- Datenverschlüsselung:
  - At-Rest: AES-256 mit Key-Rotation alle 90 Tage.
  - In-Transit: TLS ≥ 1.2.

## 2. Journale & Unveränderlichkeit
- Nach erfolgreichem Posting sind Journale unveränderlich.
- Änderungen sind nur über Storno-/Reversal-Journale möglich.
- **Testkriterium:** API-PATCH auf `journal/:id` nach Posting → HTTP 405.
- Journale enthalten kryptographische Hash-Verkettung (`hash_prev`, `hash_self = SHA256(serialized_data + hash_prev)`).
- **Testkriterium:** Manipulation eines Journals führt zu inkonsistenter Kette, validiert durch Hash-Check.

## 3. Periodenabschluss
- Eine Buchung darf nur in Perioden mit Status `open` erfolgen.
- Buchungen in geschlossenen Perioden sind zu verwerfen.
- Stornos für alte Perioden werden automatisch in der nächsten offenen Periode erstellt.
- **Testkriterium:** POST in `closed`-Periode → HTTP 409 mit Fehlercode `PERIOD_CLOSED`.
- Jahresabschluss:
  - Erfolgskonten werden auf null gesetzt.
  - Gewinn/Verlust wird auf Eigenkapitalvortragskonto gebucht.
  - Eröffnungsjournale im neuen Jahr werden automatisch erzeugt.

## 4. Mehrwährung & Wechselkurse
- Jeder Buchungssatz speichert:
  - Originalwährung
  - Buchungswährung
  - Wechselkurs zum Posting-Zeitpunkt
- Wechselkurse sind nach Posting unveränderlich.
- **Testkriterium:** PATCH auf `fx_rate` einer geposteten Buchung → HTTP 409 mit Fehlercode `FX_001`.
- Monatliche Neubewertung offener Posten:
  - Stichtag: letzter Bankarbeitstag des Monats (UTC).
  - Kursquelle: EZB-Mittelkurs.
  - Rundung: Decimal(18,4), bankers rounding.
- **Testkriterium:** Bekannter Input (10.000 USD Forderung, Kurs 1,10 → 9.090,91 EUR; neuer Kurs 1,20 → 8.333,33 EUR) → Differenz 757,58 EUR auf `FX_GAIN_LOSS`.

## 5. Steuern
- Jede Transaktion weist Steuerpositionen explizit aus.
- Steuerpositionen sind unveränderlich nach Posting.
- Steuerregeln sind mandantenabhängig konfigurierbar.
- Export muss Umsatzsteuer-Voranmeldungen generieren können (Format: XML/CSV, abhängig von Land).

## 6. Idempotenz
- Mutierende API-Endpunkte akzeptieren Header `Idempotency-Key`.
- Keys werden 30 Tage gespeichert.
- Wiederholte Requests mit identischem Key liefern identische Response ohne Seiteneffekte.
- Konfliktfall (gleicher Key, anderer Payload) → HTTP 409 `IDEMPOTENCY_CONFLICT`.
- **Testkriterium:** Doppelte Anfrage mit Key → nur ein Journal gespeichert.

## 7. Bankimport & Deduplikation
- Import identifiziert Einträge per `ext_uid` oder Hash(datenfelder).
- Bereits importierte Einträge dürfen nicht erneut verbucht werden.
- **Testkriterium:** Zweiter Import derselben Datei → keine Duplikate.

## 8. Audit & Observability
- Alle mutierenden Operationen erzeugen Audit-Eintrag:
  - Zeitstempel (UTC)
  - Benutzer / Service
  - Request-ID
- Audit-Logs sind schreibgeschützt, signiert und für mindestens 10 Jahre aufbewahrt.
- Monitoring:
  - Fehlerquote > 1 % über 5 Minuten → PagerDuty-Alarm.
  - Latenz 95-Perzentil für Reads < 300 ms.

## 9. Compliance & Retention
- Datenaufbewahrung: mind. 10 Jahre gemäß UGB.
- Nach Ablauf: automatische Löschung oder Archivierung.
- DSGVO: Prozesse für DSAR (Data Subject Access Request) müssen implementiert sein.

## 10. Backup & Recovery
- Backups: kontinuierliches PITR (Point-In-Time Recovery).
- RTO ≤ 4h, RPO ≤ 15min.
- Backups werden mindestens 1× monatlich testweise wiederhergestellt.

## 11. Öffentliche API (`/api`)
- Basis-URL: `/api`.
- Authentifizierung: OAuth 2.0 mit Client-Credentials Flow.
- Endpunkte (Auszug):
  - `POST /api/journals`: erstellt Journalbuchung.
  - `GET /api/journals/:id`: ruft Journal ab.
  - `POST /api/journals/:id/reverse`: erstellt Storno.
  - `POST /api/import/bank`: importiert Bankdaten.
  - `GET /api/reports/trial-balance`: liefert Summen- und Saldenliste.
- Standard-Fehlerformat: `{ "code": "ERROR_CODE", "message": "Beschreibung" }`.
- **Testkriterium:** Alle Endpunkte liefern bei ungültiger Authentifizierung HTTP 401.

## 12. Nicht-funktionale Anforderungen
- Verfügbarkeit: 99,9 % SLA.
- Skalierbarkeit: ≥ 1000 Transaktionen/Sekunde.
- Performance: POST-Buchung < 500 ms (95-Perzentil).
- Fehlerbehandlung: Alle Fehler liefern eindeutige Codes (z. B. `PERIOD_CLOSED`, `FX_001`).

---

## Glossar (Auszug)
- **Journal:** Verbuchungseinheit mit Soll-/Haben-Zeilen.
- **Periode:** Abrechnungszeitraum (Monat, Jahr) mit Status open/closing/closed.
- **Idempotency-Key:** Client-generierter eindeutiger Schlüssel, um doppelte Requests zu vermeiden.
- **RTO:** Recovery Time Objective.
- **RPO:** Recovery Point Objective.

