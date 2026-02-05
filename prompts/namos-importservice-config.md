# Namos Importservice Konfiguration finden

## Kontext

Das **BCS-Programm** (C:\Sources\bcs) exportiert Artikeldaten im XML-Format für das **Namos Kassensystem**. Der Export funktioniert einwandfrei.

**Problem:** Der Namos Prozessmanager startet den Importservice nicht automatisch, daher werden die exportierten XML-Dateien nicht importiert.

## Relevante Dateien

Im Verzeichnis `C:\Sources\bcs\docs\JET-AT-Param\` befinden sich:
- Parameter-Dateien (Konfiguration)
- Log-Ausgaben
- Binary-Ordner des Prozessmanagers

## Aufgabe

1. **Analysiere die Dateien** im `docs/JET-AT-Param` Ordner
2. **Finde heraus**, in welcher Konfigurationsdatei der Importservice aktiviert wird
3. **Identifiziere** die relevanten Parameter/Einstellungen
4. **Erkläre**, wie der Importservice im Prozessmanager gestartet werden kann

## Erwartetes Ergebnis

- Name der Konfigurationsdatei(en)
- Relevante Parameter und deren Werte
- Schritt-für-Schritt Anleitung zur Aktivierung des Importservice
- Hinweise auf mögliche Fallstricke

## Zusätzliche Informationen

- Das Kassensystem ist von **Namos**
- Der **Prozessmanager** von Namos verwaltet die Services
- Der **Importservice** soll beim Start des Prozessmanagers automatisch mitgestartet werden
