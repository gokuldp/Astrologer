# AstroHub Vedic Calculation Demo

A responsive, **bilingual (English + Tamil)** Flask web app that demonstrates:

- Sidereal Moon Rasi, Nakshatra and Pada using Swiss Ephemeris with Lahiri ayanamsa
- Lagna, the twelve houses, and full planetary detail (degree in D° M' S", nakshatra,
  pada, house, dignity, retrograde status)
- **South Indian rasi chart grids** — one for the birth chart, one for the live sky
- **Birth vs. now**: where each planet stood at birth, where it is at this moment,
  and how far it has travelled since
- Vimshottari dasha: balance at birth, the full mahadasha sequence, and the running
  mahadasha / bhukti
- Panchang: tithi, paksha, nakshatra, yoga, karana, weekday and Tamil month
- Sunrise, sunset, Rahu Kalam, Yamagandam, Gulikai and Abhijit muhurta
- A preliminary two-person Rasi/Nakshatra comparison
- **Written summaries in both languages**, with a Listen button on every result
- A **Speech Studio**: type text and hear it spoken (text-to-speech), or speak and
  have it typed (speech-to-text)

## Requirements

- Python 3.10+
- Internet connection for installing packages and loading Google Fonts
  (the calculations themselves all run locally)
- For speech-to-text: Chrome or Edge. Text-to-speech works in most modern browsers.

## Run locally (Windows)

1. Extract the ZIP.
2. Open Command Prompt in the extracted `astrohub_web_demo` folder.
3. Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

5. Start the app:

```bash
python app.py
```

6. Open `http://127.0.0.1:5000` in your browser.

## Using the app

### Chart Chat with a local pretrained model

Chart Chat sends each question to Gemma 3 4B through Ollama to identify its
topic and whether it asks about timing. An animated reply bubble appears while
the model works. AstroHub supplies the chart facts and dates. The model receives
the question text through the local Ollama service.

Install [Ollama for Windows](https://ollama.com/download/windows), open it, then
download the model from PowerShell:

```powershell
ollama pull gemma3:4b
```

Keep Ollama running while using AstroHub. Chart Chat uses its built-in rules
when the model is unavailable.

**Language** — the switch in the top right toggles `English` / `தமிழ்` / `Both`.
It changes every label, table, chart and summary on the page at once, and your
choice is remembered in the browser.

**Birth Chart tab** — enter the birth date, time, place, coordinates and IANA
timezone. You get the core results, both rasi charts, the planet table, per-planet
detail cards, the twelve houses, birth panchang, the dasha tables, the birth-vs-now
travel table, and a full written summary.

**Planets Now tab** — live transit positions for your coordinates, with an optional
60-second auto-refresh.

**Compatibility tab** — a transparent Rasi/Nakshatra comparison of two charts.

**Daily Timings tab** — panchang and the day's auspicious/inauspicious segments.

**Speech Studio tab** — type anything into the box and press **Speak** (or
`Ctrl+Enter`) to hear it. Press **Start dictation** to talk and have it typed. Pick
the voice language, specific voice, speed and pitch. The 🎙 buttons next to the name
and birth place fields dictate straight into those inputs.

Every result block also has a 🔊 **Listen** button that reads the summary aloud in
whichever language you are currently viewing.

### Tamil voice note

Speech uses your browser's and operating system's built-in speech engine, so no
audio ever leaves your device. If no Tamil voice is installed, Tamil playback falls
back to a default voice and the app tells you so. On Windows, add one under
**Settings → Time & language → Speech → Manage voices**.

## API

All endpoints accept and return JSON.

| Endpoint | Body |
|---|---|
| `POST /api/chart` | `date`, `time`, `place`, `lat`, `lon`, `timezone`, optional `full_name` |
| `POST /api/now` | `lat`, `lon`, `timezone` |
| `POST /api/match` | `person1`, `person2` (each the same shape as `/api/chart`) |
| `POST /api/panchang` | `date`, `lat`, `lon`, `timezone` |

`calculate_chart()` takes exactly the keyword names the browser sends, so
`calculate_chart(**payload)` works directly — this is what `/api/match` relies on.

## Important accuracy and licensing notes

- Enter the birth location's latitude, longitude and IANA timezone. The included
  defaults are for Cuddalore, Tamil Nadu.
- Moon Rasi, Nakshatra, Pada and planetary positions are calculated from Swiss
  Ephemeris in Lahiri sidereal mode.
- This is a demonstration, not a certified Panchangam or astrology product. Validate
  outputs against a trusted, tradition-specific reference before presenting them as
  authoritative.
- The compatibility endpoint only compares Rasi and Nakshatra. It does **not**
  calculate the traditional 10 poruthams and must not be presented as a marriage
  verdict.
- Manglik/Chevvaai, Kala Sarpa and other dosha rules are not implemented.
- Dasha dates use a 365.2425-day year and are approximate to within a few days
  compared with a traditional panchangam.
- Tithi, yoga and karana are reported for the given instant (local noon on the Daily
  Timings tab), not as start/end spans across the day.
- Houses use Placidus cusps for the ascendant degree; the house tables themselves are
  whole-sign from the Lagna, which is the common South Indian convention.
- Sunrise/sunset and derived day segments depend on accurate coordinates, timezone
  and local horizon assumptions.
- Check Swiss Ephemeris licensing carefully before commercial deployment. The Python
  package may be subject to AGPL or a separate professional licence.
- For production, disable Flask debug mode, add input validation/rate limiting,
  HTTPS, tests, monitoring and secure deployment configuration.
