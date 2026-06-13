#!/usr/bin/env python3
"""Build RateRadar v1.2.0 App Store metadata from the canonical v1.1.0 files.

Applies the research-backed en-US ASO package, sets v1.2.0 release notes per
locale, and strips dash punctuation everywhere (Levin's brand rule: no em dash,
en dash, or spaced hyphen separators; list bullets become a real bullet glyph).
Run from repo root. Writes metadata/version/1.2.0/*.json + metadata/app-info/en-US.json.
"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "metadata", "version", "1.1.0")
DST = os.path.join(ROOT, "metadata", "version", "1.2.0")
APPINFO = os.path.join(ROOT, "metadata", "app-info")
os.makedirs(DST, exist_ok=True)

def dedash(s: str) -> str:
    if not s:
        return s
    s = s.replace("—", ", ").replace("–", ", ")  # em / en dash
    s = s.replace("\n- ", "\n• ")                          # list bullets
    s = s.replace(" - ", ", ")                                       # spaced separator
    return s

# en-US (research + adversarial critique, all limits verified, dash free)
EN_NAME = "RateRadar: Fed Rate Tracker"
EN_SUBTITLE = "Cut, Hold & Hike Odds, ECB"
EN_KEYWORDS = "fomc,probability,forecast,monetary,policy,inflation,basis,watch,decision,meeting,curve,path,central"
EN_PROMO = ("See the live odds of every Fed and ECB rate decision. Track 60 days of "
            "probability history, compare Fed vs ECB, and watch the most likely rate path unfold.")
EN_DESC = (
"RateRadar tracks the market implied probability of every upcoming Federal Reserve (Fed) "
"and European Central Bank (ECB) interest rate decision, plus 60 days of how those odds have moved. "
"See a cut, hold, or hike coming before the meeting.\n\n"
"WHAT YOU GET\n"
"• Live odds for every Fed and ECB meeting: hold, cut, or hike, each with a clean probability.\n"
"• The most likely rate path, chained meeting by meeting.\n"
"• The implied forward rate curve, priced from real market data.\n"
"• Fed vs ECB divergence at a glance.\n"
"• 60 days of probability history: odds saved daily and kept, so you see the shift, not just today.\n"
"• Meeting reminders and sharp move alerts, on your device, refreshed on our after session cadence.\n\n"
"JARGON, EXPLAINED\n"
"New to this? The FOMC is the Fed committee that sets US rates. Basis points (bps) are hundredths of a "
"percent. Hold, cut, and hike mean no change, lower, or higher. Every term links to a plain English glossary in the app.\n\n"
"HOW IT WORKS\n"
"We compute our own numbers from 30 Day Fed Funds Futures and STR and DFR data using the published step "
"function method. We never scrape CME FedWatch or ECB Watch. The full method lives in the app under "
"Methodology, versioned so you can trust the history.\n\n"
"Built for retail first. Not financial advice."
)

# Short, clean v1.2.0 release notes per locale (announce the new Alerts feature).
WHATS_NEW = {
"en-US": ("New: Alerts. Get a heads up the evening before and the morning of every Fed and ECB decision, "
          "plus an on device nudge when the odds move sharply since you last checked. Turn them on under Alerts."),
"de-DE": ("Neu: Alerts. Eine Erinnerung am Vorabend und am Morgen jeder Fed und ECB Entscheidung, dazu ein "
          "Hinweis auf deinem Gerät, wenn sich die Wahrscheinlichkeiten seit deinem letzten Blick stark bewegen. "
          "Aktivieren unter Alerts."),
"nl-NL": ("Nieuw: Alerts. Een seintje de avond ervoor en de ochtend van elk Fed en ECB besluit, plus een melding "
          "op je toestel wanneer de kansen sterk bewegen sinds je laatste check. Zet ze aan onder Alerts."),
"es-ES": ("Nuevo: Alertas. Un aviso la noche antes y la mañana de cada decisión de la Fed y el BCE, además "
          "de un aviso en tu dispositivo cuando las probabilidades se mueven con fuerza desde tu última consulta. "
          "Actívalas en Alerts."),
"fr-FR": ("Nouveauté : Alertes. Un rappel la veille au soir et le matin de chaque décision de la Fed et de la "
          "BCE, plus une notification sur votre appareil quand les probabilités bougent fortement depuis votre "
          "dernière visite. Activez les alertes dans Alerts."),
"it":    ("Novità: Avvisi. Un promemoria la sera prima e la mattina di ogni decisione della Fed e della BCE, più "
          "una notifica sul dispositivo quando le probabilità si muovono molto dall’ultima volta. Attivali in Alerts."),
}

# German feature bullet to add to the de-DE description (after dash cleanup).
DE_ALERT_BULLET = "\n• Meeting Erinnerungen und Hinweise bei starken Bewegungen, auf deinem Gerät, im gewohnten Rhythmus nach Sitzungsschluss."

for path in sorted(glob.glob(os.path.join(SRC, "*.json"))):
    locale = os.path.splitext(os.path.basename(path))[0]
    data = json.load(open(path, encoding="utf-8"))

    data["description"] = dedash(data.get("description", ""))
    data["promotionalText"] = dedash(data.get("promotionalText", ""))
    if locale in WHATS_NEW:
        data["whatsNew"] = WHATS_NEW[locale]

    if locale == "en-US":
        data["description"] = EN_DESC
        data["keywords"] = EN_KEYWORDS
        data["promotionalText"] = EN_PROMO
    elif locale == "de-DE":
        if "Meeting Erinnerungen" not in data["description"]:
            data["description"] = data["description"].replace(
                "\n\nSO FUNKTIONIERT", DE_ALERT_BULLET + "\n\nSO FUNKTIONIERT", 1)

    out = os.path.join(DST, f"{locale}.json")
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"wrote {out}  (keywords={len(data.get('keywords',''))} chars, whatsNew={'yes' if data.get('whatsNew') else 'no'})")

# app-info: en-US name + subtitle only (other locales unchanged)
ai_path = os.path.join(APPINFO, "en-US.json")
ai = json.load(open(ai_path, encoding="utf-8"))
ai["name"] = EN_NAME
ai["subtitle"] = EN_SUBTITLE
json.dump(ai, open(ai_path, "w", encoding="utf-8"), ensure_ascii=False)
print(f"app-info en-US: name='{EN_NAME}' ({len(EN_NAME)}c) subtitle='{EN_SUBTITLE}' ({len(EN_SUBTITLE)}c)")
print(f"en-US keywords: {len(EN_KEYWORDS)} chars; promo: {len(EN_PROMO)} chars")
