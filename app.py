"""Astrologer Vedic Calculation Studio - bilingual (English + Tamil) Flask demo.

Everything is computed from Swiss Ephemeris in Lahiri sidereal mode.
This is a demonstration tool, not a certified Panchangam product.
"""

from flask import Flask, render_template, request, jsonify
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import json
from urllib.request import Request, ProxyHandler, build_opener
from urllib.error import URLError
import swisseph as swe
from astral import Observer
from astral.sun import sun

app = Flask(__name__)
swe.set_sid_mode(swe.SIDM_LAHIRI)

CHAT_MODEL = "gemma3:4b"
CHAT_INTENTS = {
    "moon_rasi": "What is my Moon Rasi?",
    "nakshatra": "What is my Nakshatra?",
    "lagna": "What is my Lagna?",
    "planets": "Show my birth planets",
    "transits": "Show my current transits",
    "dasha": "When does my next dasha start?",
    "birth_details": "Show my birth details",
    "age": "How old am I?",
    "summary": "Show my chart summary",
    "future": "What is my future?",
    "marriage": "When will I get married?",
    "marriage_type": "Love marriage or arranged marriage?",
    "relationships": "Love and relationships",
    "career": "When will I get a job?",
    "business": "Business",
    "finance": "Finance",
    "education": "Education",
    "travel": "Foreign travel",
    "family": "Family",
    "children": "Children",
    "health": "Health",
    "property": "Property",
    "compatibility": "Marriage compatibility",
    "muhurta": "Auspicious timing",
    "death": "When will I die?",
}


@app.post("/api/chat/intent")
def chat_intent():
    body = request.get_json(silent=True)
    question = body.get("question") if isinstance(body, dict) else None
    if not isinstance(question, str) or not question.strip() or len(question) > 300:
        return jsonify(success=False, error="Enter a question of up to 300 characters."), 400

    payload = {
        "model": CHAT_MODEL,
        "stream": False,
        "format": {
            "type": "object",
            "properties": {
                "intent": {"type": "string", "enum": [*CHAT_INTENTS, "unknown"]},
                "asks_timing": {"type": "boolean"},
            },
            "required": ["intent", "asks_timing"],
        },
        "options": {"temperature": 0, "num_ctx": 2048, "num_predict": 64},
        "messages": [
            {"role": "system", "content": (
                "Classify the user's question for a Vedic astrology app. "
                "Understand English, Tamil, Tanglish, Hindi, and other languages where possible. "
                "Return the matching intent and set asks_timing to true if the user asks when "
                "something will happen or asks for a date, year, age, or suitable period. "
                "Classify the subject independently of time words. Buying or building a house "
                "or home, buying land, and inheritance are property questions. "
                "Choose marriage only for questions about getting married or a spouse. "
                "Use unknown for unrelated or unclear questions. "
                "These labels describe the available intents: " + json.dumps(CHAT_INTENTS)
            )},
            {"role": "user", "content": question.strip()},
        ],
    }
    local_request = Request(
        "http://127.0.0.1:11434/api/chat", data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with build_opener(ProxyHandler({})).open(local_request, timeout=30) as response:
            result = json.load(response)
        classification = json.loads(result["message"]["content"])
        intent = classification.get("intent")
        canonical = CHAT_INTENTS.get(intent) if isinstance(intent, str) else None
        asks_timing = canonical is not None and classification.get("asks_timing") is True
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError, AttributeError):
        canonical, asks_timing = None, False
    return jsonify(success=True, canonical_question=canonical, asks_timing=asks_timing)

# ---------------------------------------------------------------- reference data

RASI_TA = ["மேஷம்", "ரிஷபம்", "மிதுனம்", "கடகம்", "சிம்மம்", "கன்னி",
           "துலாம்", "விருச்சிகம்", "தனுசு", "மகரம்", "கும்பம்", "மீனம்"]
RASI_EN = ["Mesham", "Rishabam", "Mithunam", "Kadagam", "Simmam", "Kanni",
           "Thulam", "Viruchigam", "Dhanusu", "Magaram", "Kumbam", "Meenam"]
RASI_WEST = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
             "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
RASI_LORD = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
             "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"]
RASI_ELEMENT_EN = ["Fire", "Earth", "Air", "Water", "Fire", "Earth",
                   "Air", "Water", "Fire", "Earth", "Air", "Water"]
RASI_ELEMENT_TA = ["அக்னி", "பூமி", "வாயு", "நீர்", "அக்னி", "பூமி",
                   "வாயு", "நீர்", "அக்னி", "பூமி", "வாயு", "நீர்"]

NAK_TA = ["அசுவினி", "பரணி", "கார்த்திகை", "ரோகிணி", "மிருகசீரிடம்", "திருவாதிரை",
          "புனர்பூசம்", "பூசம்", "ஆயில்யம்", "மகம்", "பூரம்", "உத்திரம்", "அஸ்தம்",
          "சித்திரை", "சுவாதி", "விசாகம்", "அனுஷம்", "கேட்டை", "மூலம்", "பூராடம்",
          "உத்திராடம்", "திருவோணம்", "அவிட்டம்", "சதயம்", "பூரட்டாதி", "உத்திரட்டாதி", "ரேவதி"]
NAK_EN = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
          "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
          "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
          "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
          "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"]

# Vimshottari dasha lords repeat every 9 nakshatras, starting from Ashwini = Ketu.
DASHA_CYCLE = [("Ketu", 7), ("Venus", 20), ("Sun", 6), ("Moon", 10), ("Mars", 7),
               ("Rahu", 18), ("Jupiter", 16), ("Saturn", 19), ("Mercury", 17)]
NAK_LORD = [DASHA_CYCLE[i % 9][0] for i in range(27)]

PLANETS = [("Sun", swe.SUN), ("Moon", swe.MOON), ("Mars", swe.MARS),
           ("Mercury", swe.MERCURY), ("Jupiter", swe.JUPITER),
           ("Venus", swe.VENUS), ("Saturn", swe.SATURN),
           ("Rahu", swe.MEAN_NODE)]

PLANET_TA = {"Sun": "சூரியன்", "Moon": "சந்திரன்", "Mars": "செவ்வாய்",
             "Mercury": "புதன்", "Jupiter": "குரு", "Venus": "சுக்கிரன்",
             "Saturn": "சனி", "Rahu": "ராகு", "Ketu": "கேது"}
PLANET_SYMBOL = {"Sun": "☉", "Moon": "☾", "Mars": "♂", "Mercury": "☿",
                 "Jupiter": "♃", "Venus": "♀", "Saturn": "♄",
                 "Rahu": "☊", "Ketu": "☋"}
PLANET_SHORT_EN = {"Sun": "Su", "Moon": "Mo", "Mars": "Ma", "Mercury": "Me",
                   "Jupiter": "Ju", "Venus": "Ve", "Saturn": "Sa",
                   "Rahu": "Ra", "Ketu": "Ke"}
PLANET_SHORT_TA = {"Sun": "சூ", "Moon": "சந்", "Mars": "செ", "Mercury": "பு",
                   "Jupiter": "கு", "Venus": "சுக்", "Saturn": "ச",
                   "Rahu": "ரா", "Ketu": "கே"}
PLANET_SIGNIFIES_EN = {
    "Sun": "Soul, father, authority, vitality, government",
    "Moon": "Mind, mother, emotions, memory, comfort",
    "Mars": "Courage, energy, siblings, land, conflict",
    "Mercury": "Intellect, speech, trade, education, writing",
    "Jupiter": "Wisdom, wealth, children, dharma, teachers",
    "Venus": "Love, marriage, art, luxury, vehicles",
    "Saturn": "Discipline, delay, labour, longevity, karma",
    "Rahu": "Ambition, foreign matters, sudden rise, obsession",
    "Ketu": "Detachment, spirituality, past karma, liberation",
}
PLANET_SIGNIFIES_TA = {
    "Sun": "ஆத்மா, தந்தை, அதிகாரம், உடல் வலிமை, அரசு",
    "Moon": "மனம், தாய், உணர்ச்சி, நினைவாற்றல், நிம்மதி",
    "Mars": "தைரியம், சக்தி, சகோதரர், நிலம், சண்டை",
    "Mercury": "அறிவு, பேச்சு, வியாபாரம், கல்வி, எழுத்து",
    "Jupiter": "ஞானம், செல்வம், குழந்தை, தர்மம், குரு",
    "Venus": "காதல், திருமணம், கலை, சுகபோகம், வாகனம்",
    "Saturn": "ஒழுக்கம், தாமதம், உழைப்பு, ஆயுள், கர்மா",
    "Rahu": "ஆசை, வெளிநாடு, திடீர் உயர்வு, மோகம்",
    "Ketu": "விரக்தி, ஆன்மிகம், பூர்வ ஜென்ம கர்மா, மோட்சம்",
}
# Average daily motion in degrees (sidereal, approximate) - used for plain-language speed notes.
PLANET_DAILY_EN = {"Sun": "about 1° a day (~1 rasi a month)",
                   "Moon": "about 13° a day (~1 rasi in 2.25 days)",
                   "Mars": "about 0.5° a day (~1 rasi in 45 days)",
                   "Mercury": "about 1.4° a day (~1 rasi in 3 weeks)",
                   "Jupiter": "about 0.08° a day (~1 rasi a year)",
                   "Venus": "about 1.2° a day (~1 rasi a month)",
                   "Saturn": "about 0.03° a day (~1 rasi in 2.5 years)",
                   "Rahu": "about -0.05° a day (~1 rasi in 18 months, reverse)",
                   "Ketu": "about -0.05° a day (~1 rasi in 18 months, reverse)"}
PLANET_DAILY_TA = {"Sun": "நாளுக்கு சுமார் 1° (மாதம் ஒரு ராசி)",
                   "Moon": "நாளுக்கு சுமார் 13° (2¼ நாளில் ஒரு ராசி)",
                   "Mars": "நாளுக்கு சுமார் 0.5° (45 நாளில் ஒரு ராசி)",
                   "Mercury": "நாளுக்கு சுமார் 1.4° (3 வாரத்தில் ஒரு ராசி)",
                   "Jupiter": "நாளுக்கு சுமார் 0.08° (வருடம் ஒரு ராசி)",
                   "Venus": "நாளுக்கு சுமார் 1.2° (மாதம் ஒரு ராசி)",
                   "Saturn": "நாளுக்கு சுமார் 0.03° (2½ வருடம் ஒரு ராசி)",
                   "Rahu": "நாளுக்கு சுமார் -0.05° (18 மாதம் ஒரு ராசி, வக்ரம்)",
                   "Ketu": "நாளுக்கு சுமார் -0.05° (18 மாதம் ஒரு ராசி, வக்ரம்)"}

# Dignity tables (sign indexes are 0-based: 0 = Mesham)
EXALT_SIGN = {"Sun": 0, "Moon": 1, "Mars": 9, "Mercury": 5,
              "Jupiter": 3, "Venus": 11, "Saturn": 6, "Rahu": 2, "Ketu": 8}
OWN_SIGNS = {"Sun": [4], "Moon": [3], "Mars": [0, 7], "Mercury": [2, 5],
             "Jupiter": [8, 11], "Venus": [1, 6], "Saturn": [9, 10],
             "Rahu": [10], "Ketu": [7]}

HOUSE_MEANING_EN = [
    "Self, body, personality", "Wealth, family, speech", "Siblings, courage, effort",
    "Mother, home, comfort", "Children, learning, fortune", "Debt, disease, enemies",
    "Marriage, partnership", "Longevity, hidden matters", "Dharma, father, luck",
    "Career, status, action", "Gains, friends, wishes", "Loss, expense, liberation"]
HOUSE_MEANING_TA = [
    "தான், உடல், சுபாவம்", "பணம், குடும்பம், பேச்சு", "சகோதரர், தைரியம், முயற்சி",
    "தாய், வீடு, சுகம்", "குழந்தை, கல்வி, பூர்வ புண்ணியம்", "கடன், நோய், எதிரி",
    "திருமணம், வாழ்க்கைத் துணை", "ஆயுள், மறைபொருள்", "தர்மம், தந்தை, அதிர்ஷ்டம்",
    "தொழில், அந்தஸ்து, செயல்", "லாபம், நண்பர், ஆசை", "செலவு, இழப்பு, மோட்சம்"]

TITHI_EN = ["Prathamai", "Dwithiyai", "Thrithiyai", "Chaturthi", "Panchami",
            "Shashti", "Sapthami", "Ashtami", "Navami", "Dasami",
            "Ekadasi", "Dwadasi", "Trayodasi", "Chaturdasi"]
TITHI_TA = ["பிரதமை", "துவிதியை", "திருதியை", "சதுர்த்தி", "பஞ்சமி",
            "சஷ்டி", "சப்தமி", "அஷ்டமி", "நவமி", "தசமி",
            "ஏகாதசி", "துவாதசி", "திரயோதசி", "சதுர்த்தசி"]
YOGA_EN = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
           "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
           "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha",
           "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"]
YOGA_TA = ["விஷ்கம்பம்", "பிரீதி", "ஆயுஷ்மான்", "சௌபாக்யம்", "சோபனம்", "அதிகண்டம்",
           "சுகர்மா", "திருதி", "சூலம்", "கண்டம்", "விருத்தி", "துருவம்", "வியாகாதம்",
           "ஹர்ஷணம்", "வஜ்ரம்", "சித்தி", "வியதீபாதம்", "வரியான்", "பரிகம்",
           "சிவம்", "சித்தம்", "சாத்யம்", "சுபம்", "சுக்லம்", "பிரம்மம்", "இந்திரம்", "வைதிருதி"]
KARANA7_EN = ["Bava", "Balava", "Kaulava", "Taitila", "Garija", "Vanija", "Vishti"]
KARANA7_TA = ["பவ", "பாலவ", "கௌலவ", "தைதுல", "கரசை", "வணிசை", "பத்திரை"]
KARANA_FIX_EN = {0: "Kimstughna", 57: "Shakuni", 58: "Chatushpada", 59: "Naga"}
KARANA_FIX_TA = {0: "கிம்ஸ்துக்னம்", 57: "சகுனி", 58: "சதுஷ்பாதம்", 59: "நாகம்"}

WEEKDAY_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WEEKDAY_TA = ["திங்கட்கிழமை", "செவ்வாய்க்கிழமை", "புதன்கிழமை", "வியாழக்கிழமை",
              "வெள்ளிக்கிழமை", "சனிக்கிழமை", "ஞாயிற்றுக்கிழமை"]
WEEKDAY_LORD = ["Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Sun"]

# Tamil solar months, indexed by the Sun's sidereal sign.
TAMIL_MONTH_TA = ["சித்திரை", "வைகாசி", "ஆனி", "ஆடி", "ஆவணி", "புரட்டாசி",
                  "ஐப்பசி", "கார்த்திகை", "மார்கழி", "தை", "மாசி", "பங்குனி"]
TAMIL_MONTH_EN = ["Chithirai", "Vaikasi", "Aani", "Aadi", "Aavani", "Purattasi",
                  "Aippasi", "Karthigai", "Margazhi", "Thai", "Maasi", "Panguni"]


# ---------------------------------------------------------------- helpers

def normalize(x):
    return x % 360.0


def local_to_jd(date_s, time_s, tz_name):
    """Local civil date/time -> (julian day UT, aware local datetime)."""
    time_s = (time_s or "00:00").strip()
    if len(time_s.split(":")) == 2:
        time_s += ":00"
    dt = datetime.strptime(f"{date_s} {time_s}", "%Y-%m-%d %H:%M:%S")
    local = dt.replace(tzinfo=ZoneInfo(tz_name))
    utc = local.astimezone(timezone.utc)
    hour = utc.hour + utc.minute / 60 + utc.second / 3600
    return swe.julday(utc.year, utc.month, utc.day, hour), local


def sign_info(longitude):
    lon = normalize(longitude)
    return int(lon // 30), lon % 30


def dms(degree):
    """Decimal degrees within a sign -> 12° 34' 56" string."""
    d = int(degree)
    m_full = (degree - d) * 60
    m = int(m_full)
    s = int(round((m_full - m) * 60))
    if s == 60:
        s, m = 0, m + 1
    if m == 60:
        m, d = 0, d + 1
    return f"{d}° {m:02d}' {s:02d}\""


def nak_of(longitude):
    """Nakshatra index, pada and fraction elapsed for any longitude."""
    lon = normalize(longitude)
    span = 360.0 / 27.0
    idx = int(lon / span)
    within = lon - idx * span
    return idx, int(within / (span / 4)) + 1, within / span


def dignity(name, sign):
    """Plain-language dignity of a planet in a sign."""
    if sign == EXALT_SIGN.get(name):
        return "Exalted", "உச்சம்"
    if sign == (EXALT_SIGN.get(name, 0) + 6) % 12:
        return "Debilitated", "நீசம்"
    if sign in OWN_SIGNS.get(name, []):
        return "Own sign", "சொந்த வீடு"
    return "Neutral", "சமம்"


def planet_block(name, longitude, speed, lagna_sign):
    """One fully described planet row, in English and Tamil."""
    sign, deg = sign_info(longitude)
    nidx, pada, _ = nak_of(longitude)
    dig_en, dig_ta = dignity(name, sign)
    retro = speed is not None and speed < 0
    house = ((sign - lagna_sign) % 12) + 1
    return {
        "name": name,
        "name_ta": PLANET_TA[name],
        "symbol": PLANET_SYMBOL[name],
        "short": PLANET_SHORT_EN[name],
        "short_ta": PLANET_SHORT_TA[name],
        "rasi": RASI_TA[sign],
        "rasi_en": RASI_EN[sign],
        "rasi_west": RASI_WEST[sign],
        "rasi_index": sign,
        "rasi_lord": RASI_LORD[sign],
        "rasi_lord_ta": PLANET_TA[RASI_LORD[sign]],
        "degree": round(deg, 3),
        "degree_dms": dms(deg),
        "longitude": round(normalize(longitude), 4),
        "nakshatra": NAK_TA[nidx],
        "nakshatra_en": NAK_EN[nidx],
        "nak_lord": NAK_LORD[nidx],
        "nak_lord_ta": PLANET_TA[NAK_LORD[nidx]],
        "pada": pada,
        "house": house,
        "house_meaning_en": HOUSE_MEANING_EN[house - 1],
        "house_meaning_ta": HOUSE_MEANING_TA[house - 1],
        "retrograde": retro,
        "motion_en": "Retrograde" if retro else "Direct",
        "motion_ta": "வக்ர கதி" if retro else "நேர் கதி",
        "speed": round(speed, 4) if speed is not None else None,
        "dignity_en": dig_en,
        "dignity_ta": dig_ta,
        "signifies_en": PLANET_SIGNIFIES_EN[name],
        "signifies_ta": PLANET_SIGNIFIES_TA[name],
        "daily_en": PLANET_DAILY_EN[name],
        "daily_ta": PLANET_DAILY_TA[name],
    }


def raw_positions(jd):
    """Sidereal longitude + speed for every planet, plus Ketu."""
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED
    out = {}
    for name, body in PLANETS:
        xx, _ = swe.calc_ut(jd, body, flags)
        out[name] = (normalize(xx[0]), xx[3])
    rahu_lon, rahu_speed = out["Rahu"]
    out["Ketu"] = (normalize(rahu_lon + 180), rahu_speed)
    return out


def lagna_of(jd, lat, lon):
    cusps, ascmc = swe.houses_ex(jd, float(lat), float(lon), b'P', swe.FLG_SIDEREAL)
    return normalize(ascmc[0]), cusps, normalize(ascmc[1])


def chart_frame(jd, lat, lon):
    """Positions + lagna + houses for a single moment."""
    pos = raw_positions(jd)
    lagna_lon, cusps, mc_lon = lagna_of(jd, lat, lon)
    lagna_sign, lagna_deg = sign_info(lagna_lon)
    planets = [planet_block(n, pos[n][0], pos[n][1], lagna_sign)
               for n in ["Sun", "Moon", "Mars", "Mercury", "Jupiter",
                         "Venus", "Saturn", "Rahu", "Ketu"]]
    lnidx, lpada, _ = nak_of(lagna_lon)
    houses = []
    for h in range(12):
        hsign = (lagna_sign + h) % 12
        houses.append({
            "house": h + 1,
            "rasi": RASI_TA[hsign], "rasi_en": RASI_EN[hsign], "rasi_index": hsign,
            "lord": RASI_LORD[hsign], "lord_ta": PLANET_TA[RASI_LORD[hsign]],
            "meaning_en": HOUSE_MEANING_EN[h], "meaning_ta": HOUSE_MEANING_TA[h],
            "planets": [p["name"] for p in planets if p["rasi_index"] == hsign],
            "planets_ta": [p["name_ta"] for p in planets if p["rasi_index"] == hsign],
        })
    return {
        "planets": planets,
        "houses": houses,
        "lagna": RASI_TA[lagna_sign],
        "lagna_en": RASI_EN[lagna_sign],
        "lagna_west": RASI_WEST[lagna_sign],
        "lagna_index": lagna_sign,
        "lagna_degree": round(lagna_deg, 3),
        "lagna_degree_dms": dms(lagna_deg),
        "lagna_lord": RASI_LORD[lagna_sign],
        "lagna_lord_ta": PLANET_TA[RASI_LORD[lagna_sign]],
        "lagna_nakshatra": NAK_TA[lnidx],
        "lagna_nakshatra_en": NAK_EN[lnidx],
        "lagna_pada": lpada,
        "madhya_lagna": RASI_TA[int(mc_lon // 30)],
        "madhya_lagna_en": RASI_EN[int(mc_lon // 30)],
        "ayanamsa_value": round(swe.get_ayanamsa_ut(jd), 4),
    }


def lunar_info(moon_long):
    """Moon rasi / nakshatra / pada details."""
    lon = normalize(moon_long)
    idx, pada, frac = nak_of(lon)
    sign, degree = sign_info(lon)
    return {
        "rasi": RASI_TA[sign], "rasi_en": RASI_EN[sign], "rasi_west": RASI_WEST[sign],
        "rasi_lord": RASI_LORD[sign], "rasi_lord_ta": PLANET_TA[RASI_LORD[sign]],
        "rasi_element_en": RASI_ELEMENT_EN[sign], "rasi_element_ta": RASI_ELEMENT_TA[sign],
        "nakshatra": NAK_TA[idx], "nakshatra_en": NAK_EN[idx],
        "nakshatra_lord": NAK_LORD[idx], "nakshatra_lord_ta": PLANET_TA[NAK_LORD[idx]],
        "pada": pada, "degree": round(degree, 4), "degree_dms": dms(degree),
        "nak_elapsed_pct": round(frac * 100, 2),
        "moon_longitude": round(lon, 6), "nak_index": idx, "rasi_index": sign,
    }


def vimshottari(moon_long, birth_local, now_local):
    """Dasha balance at birth, the full mahadasha sequence, and the running period."""
    idx, _, frac = nak_of(moon_long)
    start_pos = idx % 9
    lord, years = DASHA_CYCLE[start_pos]
    remaining = years * (1 - frac)

    def add_years(dt, y):
        return dt + timedelta(days=y * 365.2425)

    seq, cursor = [], birth_local
    for step in range(9):
        p = (start_pos + step) % 9
        name, full = DASHA_CYCLE[p]
        span = remaining if step == 0 else full
        end = add_years(cursor, span)
        seq.append({
            "lord": name, "lord_ta": PLANET_TA[name],
            "years": round(span, 3),
            "start": cursor.strftime("%d-%m-%Y"), "end": end.strftime("%d-%m-%Y"),
            "current": cursor <= now_local < end,
        })
        cursor = end

    current = next((s for s in seq if s["current"]), None)
    bhukti = []
    if current:
        c_start = datetime.strptime(current["start"], "%d-%m-%Y").replace(tzinfo=now_local.tzinfo)
        c_pos = [i for i, (n, _) in enumerate(DASHA_CYCLE) if n == current["lord"]][0]
        maha_years = dict(DASHA_CYCLE)[current["lord"]]
        bcur = c_start
        for step in range(9):
            p = (c_pos + step) % 9
            name, full = DASHA_CYCLE[p]
            span = maha_years * full / 120.0
            bend = add_years(bcur, span)
            bhukti.append({
                "lord": name, "lord_ta": PLANET_TA[name],
                "years": round(span, 3),
                "start": bcur.strftime("%d-%m-%Y"), "end": bend.strftime("%d-%m-%Y"),
                "current": bcur <= now_local < bend,
            })
            bcur = bend

    return {
        "birth_lord": lord, "birth_lord_ta": PLANET_TA[lord],
        "balance_years": round(remaining, 3),
        "balance_text_en": f"{int(remaining)}y {int((remaining % 1) * 12)}m {lord} dasha remaining at birth",
        "balance_text_ta": f"பிறக்கும்போது {PLANET_TA[lord]} திசை "
                           f"{int(remaining)} வருடம் {int((remaining % 1) * 12)} மாதம் பாக்கி",
        "sequence": seq,
        "current": current,
        "current_bhukti": next((b for b in bhukti if b["current"]), None),
        "bhukti": bhukti,
    }


def panchang_core(jd, sun_long, moon_long, weekday_index):
    """Tithi, paksha, yoga, karana, weekday and Tamil month from two longitudes."""
    diff = normalize(moon_long - sun_long)
    t_index = int(diff / 12)          # 0..29
    t_frac = (diff % 12) / 12
    waxing = t_index < 15
    pos = t_index % 15
    if pos == 14:
        t_en = "Pournami" if waxing else "Amavasai"
        t_ta = "பௌர்ணமி" if waxing else "அமாவாசை"
    else:
        t_en, t_ta = TITHI_EN[pos], TITHI_TA[pos]

    y_index = int(normalize(sun_long + moon_long) / (360.0 / 27.0))
    k_index = int(diff / 6)           # 0..59
    if k_index in KARANA_FIX_EN:
        k_en, k_ta = KARANA_FIX_EN[k_index], KARANA_FIX_TA[k_index]
    else:
        k_en = KARANA7_EN[(k_index - 1) % 7]
        k_ta = KARANA7_TA[(k_index - 1) % 7]

    m_idx, m_pada, _ = nak_of(moon_long)
    sun_sign = int(normalize(sun_long) // 30)
    lord = WEEKDAY_LORD[weekday_index]
    return {
        "tithi_en": t_en, "tithi_ta": t_ta, "tithi_number": t_index + 1,
        "tithi_elapsed_pct": round(t_frac * 100, 1),
        "paksha_en": "Shukla (waxing)" if waxing else "Krishna (waning)",
        "paksha_ta": "வளர்பிறை" if waxing else "தேய்பிறை",
        "nakshatra_ta": NAK_TA[m_idx], "nakshatra_en": NAK_EN[m_idx],
        "nakshatra_pada": m_pada,
        "nakshatra_lord": NAK_LORD[m_idx], "nakshatra_lord_ta": PLANET_TA[NAK_LORD[m_idx]],
        "yoga_en": YOGA_EN[y_index], "yoga_ta": YOGA_TA[y_index],
        "karana_en": k_en, "karana_ta": k_ta,
        "weekday_en": WEEKDAY_EN[weekday_index], "weekday_ta": WEEKDAY_TA[weekday_index],
        "weekday_lord": lord, "weekday_lord_ta": PLANET_TA[lord],
        "tamil_month_ta": TAMIL_MONTH_TA[sun_sign], "tamil_month_en": TAMIL_MONTH_EN[sun_sign],
        "sun_rasi_ta": RASI_TA[sun_sign], "sun_rasi_en": RASI_EN[sun_sign],
        "moon_phase_pct": round(diff / 360 * 100, 1),
    }


def transit_comparison(natal, transit, birth_local, now_local):
    """For each planet: where it was at birth, where it is now, and how far it has travelled."""
    age_days = (now_local - birth_local).total_seconds() / 86400.0
    natal_map = {p["name"]: p for p in natal["planets"]}
    rows = []
    for t in transit["planets"]:
        n = natal_map[t["name"]]
        moved = normalize(t["longitude"] - n["longitude"])
        signs_moved = (t["rasi_index"] - n["rasi_index"]) % 12
        # how many whole rounds of the zodiac, using the planet's real average speed
        avg = {"Sun": 0.9856, "Moon": 13.176, "Mars": 0.524, "Mercury": 1.383,
               "Jupiter": 0.083, "Venus": 1.602, "Saturn": 0.0335,
               "Rahu": -0.0529, "Ketu": -0.0529}[t["name"]]
        total = abs(avg) * age_days
        rows.append({
            "name": t["name"], "name_ta": t["name_ta"], "symbol": t["symbol"],
            "birth_rasi": n["rasi"], "birth_rasi_en": n["rasi_en"],
            "birth_degree_dms": n["degree_dms"], "birth_nakshatra": n["nakshatra"],
            "birth_nakshatra_en": n["nakshatra_en"], "birth_house": n["house"],
            "now_rasi": t["rasi"], "now_rasi_en": t["rasi_en"],
            "now_degree_dms": t["degree_dms"], "now_nakshatra": t["nakshatra"],
            "now_nakshatra_en": t["nakshatra_en"],
            "now_house_from_natal_lagna": ((t["rasi_index"] - natal["lagna_index"]) % 12) + 1,
            "now_motion_en": t["motion_en"], "now_motion_ta": t["motion_ta"],
            "moved_in_sign": round(moved, 2),
            "signs_moved": signs_moved,
            "rounds": round(total / 360.0, 2),
            "total_travel_deg": round(total, 1),
            "same_rasi_as_birth": n["rasi_index"] == t["rasi_index"],
            "returned_en": "Back in the birth rasi" if n["rasi_index"] == t["rasi_index"]
                           else f"Moved {signs_moved} rasi ahead of the birth position",
            "returned_ta": "பிறந்த ராசியிலேயே உள்ளது" if n["rasi_index"] == t["rasi_index"]
                           else f"பிறந்த இடத்தில் இருந்து {signs_moved} ராசி முன்னேறி உள்ளது",
            "daily_en": t["daily_en"], "daily_ta": t["daily_ta"],
        })
    years = age_days / 365.2425
    return {
        "age_years": round(years, 2),
        "age_text_en": f"{int(years)} years {int((years % 1) * 12)} months old",
        "age_text_ta": f"வயது {int(years)} வருடம் {int((years % 1) * 12)} மாதம்",
        "age_days": round(age_days, 1),
        "rows": rows,
    }


def build_summary(res):
    """Readable narrative summary in English and Tamil (also used for speech)."""
    m, t = res, res["transit_compare"]
    pl = {p["name"]: p for p in res["planets"]}
    cur = res["dasha"]["current"]
    curb = res["dasha"]["current_bhukti"]
    name = res.get("full_name") or "This chart"
    name_ta = res.get("full_name") or "இந்த ஜாதகம்"

    en = [
        f"{name} was born on {m['birth_date']} at {m['birth_time']} in {m['birth_place']} "
        f"({m['timezone']}, latitude {m['latitude']}, longitude {m['longitude']}).",
        f"The Moon sign (Rasi) is {m['rasi_en']} ({m['rasi']}), ruled by {m['rasi_lord']}, "
        f"{'an' if m['rasi_element_en'][0] in 'AEIOU' else 'a'} {m['rasi_element_en'].lower()} sign. "
        f"The Moon stands at {m['degree_dms']} in that sign.",
        f"The birth star (Nakshatra) is {m['nakshatra_en']} ({m['nakshatra']}), pada {m['pada']}, "
        f"whose lord is {m['nakshatra_lord']}. The Moon had crossed {m['nak_elapsed_pct']} percent of this star.",
        f"The rising sign (Lagna) is {m['lagna_en']} ({m['lagna']}) at {m['lagna_degree_dms']}, "
        f"ruled by {m['lagna_lord']}, with Lagna star {m['lagna_nakshatra_en']} pada {m['lagna_pada']}.",
        f"The Sun was in {pl['Sun']['rasi_en']} and the Tamil month was {m['panchang']['tamil_month_en']}. "
        f"The day was {m['panchang']['weekday_en']}, tithi {m['panchang']['tithi_en']} in "
        f"{m['panchang']['paksha_en']}, yoga {m['panchang']['yoga_en']}, karana {m['panchang']['karana_en']}.",
        "Planet placements at birth: " + "; ".join(
            f"{p['name']} in {p['rasi_en']} house {p['house']} "
            f"({p['dignity_en'].lower()}{', retrograde' if p['retrograde'] else ''})"
            for p in res["planets"]) + ".",
        f"At birth, {res['dasha']['balance_text_en']}.",
    ]
    if cur:
        en.append(f"The running Vimshottari mahadasha is {cur['lord']}, "
                  f"from {cur['start']} to {cur['end']}"
                  + (f", with {curb['lord']} bhukti inside it ({curb['start']} to {curb['end']})." if curb else "."))
    en.append(f"Today, {t['age_text_en']}, the transit positions are: " + "; ".join(
        f"{r['name']} in {r['now_rasi_en']}" + (" (retrograde)" if r['now_motion_en'] == "Retrograde" else "")
        for r in t["rows"]) + ".")
    same = [r["name"] for r in t["rows"] if r["same_rasi_as_birth"]]
    en.append(("Planets currently back in their birth rasi: " + ", ".join(same) + ".")
              if same else "No planet is currently in the same rasi as at birth.")
    en.append("These are astronomical calculations in the Lahiri sidereal zodiac. "
              "Please confirm with a qualified astrologer before acting on them.")

    ta = [
        f"{name_ta} {m['birth_date']} அன்று {m['birth_time']} மணிக்கு {m['birth_place']} இல் பிறந்தது. "
        f"நேர மண்டலம் {m['timezone']}, அட்சரேகை {m['latitude']}, தீர்க்கரேகை {m['longitude']}.",
        f"சந்திர ராசி {m['rasi']}. இதன் அதிபதி {m['rasi_lord_ta']}, "
        f"தத்துவம் {m['rasi_element_ta']}. சந்திரன் அந்த ராசியில் {m['degree_dms']} பாகையில் உள்ளார்.",
        f"பிறப்பு நட்சத்திரம் {m['nakshatra']}, {m['pada']} ஆம் பாதம். "
        f"நட்சத்திர அதிபதி {m['nakshatra_lord_ta']}. இந்த நட்சத்திரத்தில் {m['nak_elapsed_pct']} சதவீதம் கடந்து இருந்தது.",
        f"உதய லக்னம் {m['lagna']}, {m['lagna_degree_dms']} பாகை. "
        f"லக்னாதிபதி {m['lagna_lord_ta']}, லக்ன நட்சத்திரம் {m['lagna_nakshatra']} {m['lagna_pada']} ஆம் பாதம்.",
        f"சூரியன் {pl['Sun']['rasi']} ராசியில் இருந்தார், தமிழ் மாதம் {m['panchang']['tamil_month_ta']}. "
        f"அன்று {m['panchang']['weekday_ta']}, {m['panchang']['paksha_ta']} {m['panchang']['tithi_ta']} திதி, "
        f"{m['panchang']['yoga_ta']} யோகம், {m['panchang']['karana_ta']} கரணம்.",
        "பிறப்பு கிரக நிலைகள்: " + "; ".join(
            f"{p['name_ta']} {p['rasi']} ராசியில், {p['house']} ஆம் வீடு "
            f"({p['dignity_ta']}{', வக்ரம்' if p['retrograde'] else ''})"
            for p in res["planets"]) + ".",
        f"{res['dasha']['balance_text_ta']}.",
    ]
    if cur:
        ta.append(f"தற்போது நடப்பது {cur['lord_ta']} மகா திசை, {cur['start']} முதல் {cur['end']} வரை"
                  + (f". அதில் {curb['lord_ta']} புக்தி, {curb['start']} முதல் {curb['end']} வரை." if curb else "."))
    ta.append(f"இன்று, {t['age_text_ta']}, கோச்சார நிலைகள்: " + "; ".join(
        f"{r['name_ta']} {r['now_rasi']} ராசியில்" + (" (வக்ரம்)" if r['now_motion_en'] == "Retrograde" else "")
        for r in t["rows"]) + ".")
    same_ta = [r["name_ta"] for r in t["rows"] if r["same_rasi_as_birth"]]
    ta.append(("பிறந்த ராசியிலேயே தற்போது உள்ள கிரகங்கள்: " + ", ".join(same_ta) + ".")
              if same_ta else "பிறந்த ராசியில் தற்போது எந்த கிரகமும் இல்லை.")
    ta.append("இவை லாஹிரி நிரயன முறையில் கணக்கிடப்பட்ட வானியல் தகவல்கள். "
              "முடிவு எடுக்கும் முன் தகுதியான ஜோதிடரிடம் உறுதி செய்யுங்கள்.")

    return {"en": en, "ta": ta,
            "en_text": " ".join(en), "ta_text": " ".join(ta)}


# ---------------------------------------------------------------- main calculation

def calculate_chart(date, time, place="", lat=0.0, lon=0.0, timezone="Asia/Kolkata",
                    full_name="", **_ignored):
    """Full natal chart + live transit comparison.

    Keyword names match the JSON the browser sends (date, time, place, lat, lon,
    timezone), so ``calculate_chart(**payload)`` works directly.
    """
    tz_name = timezone
    jd, local = local_to_jd(date, time, tz_name)
    natal = chart_frame(jd, lat, lon)

    pos = raw_positions(jd)
    moon = lunar_info(pos["Moon"][0])
    pan = panchang_core(jd, pos["Sun"][0], pos["Moon"][0], local.weekday())

    now_local = datetime.now(ZoneInfo(tz_name))
    jd_now, _ = local_to_jd(now_local.strftime("%Y-%m-%d"),
                            now_local.strftime("%H:%M:%S"), tz_name)
    transit = chart_frame(jd_now, lat, lon)
    pos_now = raw_positions(jd_now)
    pan_now = panchang_core(jd_now, pos_now["Sun"][0], pos_now["Moon"][0], now_local.weekday())

    res = {
        "full_name": (full_name or "").strip(),
        "birth_date": date, "birth_time": time, "birth_place": place,
        "timezone": tz_name, "latitude": float(lat), "longitude": float(lon),
        "birth_weekday_en": WEEKDAY_EN[local.weekday()],
        "birth_weekday_ta": WEEKDAY_TA[local.weekday()],
        **moon,
        "lagna": natal["lagna"], "lagna_en": natal["lagna_en"],
        "lagna_west": natal["lagna_west"], "lagna_index": natal["lagna_index"],
        "lagna_degree": natal["lagna_degree"],
        "lagna_degree_dms": natal["lagna_degree_dms"],
        "lagna_lord": natal["lagna_lord"], "lagna_lord_ta": natal["lagna_lord_ta"],
        "lagna_nakshatra": natal["lagna_nakshatra"],
        "lagna_nakshatra_en": natal["lagna_nakshatra_en"],
        "lagna_pada": natal["lagna_pada"],
        "madhya_lagna": natal["madhya_lagna"], "madhya_lagna_en": natal["madhya_lagna_en"],
        "planets": natal["planets"], "houses": natal["houses"],
        "natal": natal,
        "transit": {
            "planets": transit["planets"], "houses": transit["houses"],
            "lagna": transit["lagna"], "lagna_en": transit["lagna_en"],
            "lagna_index": transit["lagna_index"],
            "lagna_degree_dms": transit["lagna_degree_dms"],
            "lagna_lord": transit["lagna_lord"], "lagna_lord_ta": transit["lagna_lord_ta"],
            "moment_local": now_local.strftime("%d-%m-%Y %I:%M %p"),
            "moment_date": now_local.strftime("%Y-%m-%d"),
            "panchang": pan_now,
            "ayanamsa_value": transit["ayanamsa_value"],
        },
        "panchang": pan,
        "julian_day": round(jd, 6),
        "julian_day_now": round(jd_now, 6),
        "ayanamsa": "Lahiri",
        "ayanamsa_value": natal["ayanamsa_value"],
    }
    res["dasha"] = vimshottari(pos["Moon"][0], local, now_local)
    res["transit_compare"] = transit_comparison(natal, transit, local, now_local)
    res["summary"] = build_summary(res)
    return res


def panchang_timings(date, lat, lon, timezone="Asia/Kolkata", **_ignored):
    """Sunrise/sunset derived day segments plus the five panchang limbs."""
    tz_name = timezone
    day = datetime.strptime(date, "%Y-%m-%d").date()
    observer = Observer(latitude=float(lat), longitude=float(lon))
    local_sun = sun(observer, date=day, tzinfo=ZoneInfo(tz_name))
    sunrise, sunset = local_sun["sunrise"], local_sun["sunset"]
    day_len = (sunset - sunrise).total_seconds()
    segment = day_len / 8

    rahu_idx = {6: 1, 0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3}[day.weekday()]
    yama_idx = {6: 4, 0: 3, 1: 2, 2: 1, 3: 0, 4: 6, 5: 5}[day.weekday()]
    gulika_idx = {6: 6, 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0}[day.weekday()]

    def fmt(ts):
        return datetime.fromtimestamp(ts, ZoneInfo(tz_name)).strftime("%I:%M %p")

    def interval(idx):
        a = sunrise.timestamp() + segment * idx
        return f"{fmt(a)} – {fmt(a + segment)}"

    midday = sunrise.timestamp() + day_len / 2
    abhijit = f"{fmt(midday - day_len / 30)} – {fmt(midday + day_len / 30)}"

    # Panchang limbs are reported for local noon of the requested day.
    jd, _ = local_to_jd(date, "12:00", tz_name)
    pos = raw_positions(jd)
    pan = panchang_core(jd, pos["Sun"][0], pos["Moon"][0], day.weekday())

    return {
        "date": date,
        "sunrise": sunrise.strftime("%I:%M %p"), "sunset": sunset.strftime("%I:%M %p"),
        "day_length": f"{int(day_len // 3600)}h {int((day_len % 3600) // 60)}m",
        "rahu_kalam": interval(rahu_idx),
        "yamagandam": interval(yama_idx),
        "gulikai": interval(gulika_idx),
        "abhijit": abhijit,
        **pan,
        "planets": [planet_block(n, pos[n][0], pos[n][1], 0)
                    for n in ["Sun", "Moon", "Mars", "Mercury", "Jupiter",
                              "Venus", "Saturn", "Rahu", "Ketu"]],
        "summary_en": (
            f"On {date} ({pan['weekday_en']}, lord {pan['weekday_lord']}), sunrise is at "
            f"{sunrise.strftime('%I:%M %p')} and sunset at {sunset.strftime('%I:%M %p')}. "
            f"The tithi is {pan['tithi_en']} in {pan['paksha_en']}, the star is {pan['nakshatra_en']} "
            f"pada {pan['nakshatra_pada']}, the yoga is {pan['yoga_en']} and the karana is {pan['karana_en']}. "
            f"The Tamil month is {pan['tamil_month_en']}. Rahu Kalam runs {interval(rahu_idx)}, "
            f"Yamagandam {interval(yama_idx)} and Gulikai {interval(gulika_idx)}. "
            f"The auspicious Abhijit muhurta is {abhijit}."),
        "summary_ta": (
            f"{date} அன்று ({pan['weekday_ta']}, அதிபதி {pan['weekday_lord_ta']}) சூரிய உதயம் "
            f"{sunrise.strftime('%I:%M %p')}, சூரிய அஸ்தமனம் {sunset.strftime('%I:%M %p')}. "
            f"திதி {pan['paksha_ta']} {pan['tithi_ta']}, நட்சத்திரம் {pan['nakshatra_ta']} "
            f"{pan['nakshatra_pada']} ஆம் பாதம், யோகம் {pan['yoga_ta']}, கரணம் {pan['karana_ta']}. "
            f"தமிழ் மாதம் {pan['tamil_month_ta']}. ராகு காலம் {interval(rahu_idx)}, "
            f"யமகண்டம் {interval(yama_idx)}, குளிகை {interval(gulika_idx)}. "
            f"நல்ல நேரம் அபிஜித் முகூர்த்தம் {abhijit}."),
    }


def live_sky(lat, lon, timezone="Asia/Kolkata", **_ignored):
    """Where every planet is standing right now."""
    tz_name = timezone
    now_local = datetime.now(ZoneInfo(tz_name))
    jd, _ = local_to_jd(now_local.strftime("%Y-%m-%d"),
                        now_local.strftime("%H:%M:%S"), tz_name)
    frame = chart_frame(jd, lat, lon)
    pos = raw_positions(jd)
    pan = panchang_core(jd, pos["Sun"][0], pos["Moon"][0], now_local.weekday())
    retro = [p["name_ta"] for p in frame["planets"] if p["retrograde"]]
    return {
        "moment_local": now_local.strftime("%d-%m-%Y %I:%M:%S %p"),
        "timezone": tz_name, **frame, "panchang": pan,
        "summary_en": "Right now: " + "; ".join(
            f"{p['name']} in {p['rasi_en']} at {p['degree_dms']} ({p['nakshatra_en']})"
            for p in frame["planets"]) + f". Rising sign now is {frame['lagna_en']}.",
        "summary_ta": "தற்போதைய கிரக நிலை: " + "; ".join(
            f"{p['name_ta']} {p['rasi']} ராசி {p['degree_dms']} ({p['nakshatra']})"
            for p in frame["planets"]) + f". தற்போதைய உதய லக்னம் {frame['lagna']}."
            + (f" வக்ரமாக உள்ள கிரகங்கள்: {', '.join(retro)}." if retro else ""),
    }


# ---------------------------------------------------------------- routes

def friendly_error(e):
    """Turn an exception into a readable bilingual message for the browser."""
    name, msg = type(e).__name__, str(e)
    if isinstance(e, TypeError) and "required positional argument" in msg:
        field = msg.split("'")[-2] if "'" in msg else "a field"
        return (f"Please fill in the '{field}' field. / "
                f"'{field}' புலத்தை நிரப்பவும்.")
    if name == "ZoneInfoNotFoundError":
        return ("Unknown timezone. Use an IANA name such as Asia/Kolkata. / "
                "நேர மண்டலம் தவறு. Asia/Kolkata போன்ற IANA பெயரை பயன்படுத்தவும்.")
    if isinstance(e, ValueError) and "does not match format" in msg:
        return ("Date or time format is wrong. Date must be YYYY-MM-DD and time HH:MM. / "
                "தேதி அல்லது நேர வடிவம் தவறு. தேதி YYYY-MM-DD, நேரம் HH:MM ஆக இருக்க வேண்டும்.")
    if isinstance(e, (ValueError, TypeError)) and ("float" in msg or "could not convert" in msg):
        return ("Latitude and longitude must be numbers. / "
                "அட்சரேகை மற்றும் தீர்க்கரேகை எண்ணாக இருக்க வேண்டும்.")
    if name == "KeyError":
        return (f"A required field is missing: {msg}. / தேவையான புலம் இல்லை: {msg}.")
    return f"{name}: {msg}"


@app.route("/")
def home():
    return render_template("index.html")


@app.post("/api/chart")
def chart_api():
    try:
        d = request.get_json(force=True)
        return jsonify({"success": True, "result": calculate_chart(**d)})
    except Exception as e:
        return jsonify({"success": False, "error": friendly_error(e)}), 400


@app.post("/api/now")
def now_api():
    try:
        d = request.get_json(force=True)
        return jsonify({"success": True, "result": live_sky(**d)})
    except Exception as e:
        return jsonify({"success": False, "error": friendly_error(e)}), 400


@app.post("/api/match")
def match_api():
    try:
        d = request.get_json(force=True)
        a = calculate_chart(**d["person1"])
        b = calculate_chart(**d["person2"])
        # Transparent preliminary comparison - NOT a certified 10-porutham engine.
        same_rasi = a["rasi_index"] == b["rasi_index"]
        same_nak = a["nak_index"] == b["nak_index"]
        # Rasi-count distance both ways (used informally in Tamil practice).
        fwd = (b["rasi_index"] - a["rasi_index"]) % 12 + 1
        bwd = (a["rasi_index"] - b["rasi_index"]) % 12 + 1
        nak_gap = (b["nak_index"] - a["nak_index"]) % 27
        shared = []
        for p in a["planets"]:
            q = next(x for x in b["planets"] if x["name"] == p["name"])
            if p["rasi_index"] == q["rasi_index"]:
                shared.append({"name": p["name"], "name_ta": p["name_ta"],
                               "rasi": p["rasi"], "rasi_en": p["rasi_en"]})
        note_en = ("This is a transparent Rasi / Nakshatra comparison only. Full 10-porutham "
                   "matching needs a tradition-specific, astrologer-validated ruleset, so no "
                   "marriage verdict is given here.")
        note_ta = ("இது ராசி மற்றும் நட்சத்திர ஒப்பீடு மட்டுமே. முழு 10 பொருத்தம் பார்க்க "
                   "சம்பிரதாயத்திற்கு ஏற்ற, ஜோதிடரால் சரிபார்க்கப்பட்ட விதிகள் தேவை. எனவே இங்கு "
                   "திருமண முடிவு கூறப்படவில்லை.")
        return jsonify({"success": True, "person1": a, "person2": b,
                        "preliminary_comparison": {
                            "same_rasi": same_rasi, "same_nakshatra": same_nak,
                            "rasi_distance_forward": fwd, "rasi_distance_backward": bwd,
                            "nakshatra_gap": nak_gap,
                            "shared_placements": shared,
                            "note": note_en, "note_en": note_en, "note_ta": note_ta,
                            "summary_en": (
                                f"Person 1 Moon rasi is {a['rasi_en']} with star {a['nakshatra_en']} "
                                f"pada {a['pada']}. Person 2 Moon rasi is {b['rasi_en']} with star "
                                f"{b['nakshatra_en']} pada {b['pada']}. Counting from person 1, "
                                f"person 2's rasi is {fwd}; counting back it is {bwd}. The nakshatra "
                                f"gap is {nak_gap}. " + note_en),
                            "summary_ta": (
                                f"முதலாம் நபரின் சந்திர ராசி {a['rasi']}, நட்சத்திரம் {a['nakshatra']} "
                                f"{a['pada']} ஆம் பாதம். இரண்டாம் நபரின் சந்திர ராசி {b['rasi']}, "
                                f"நட்சத்திரம் {b['nakshatra']} {b['pada']} ஆம் பாதம். முதலாம் நபரில் "
                                f"இருந்து எண்ணினால் இரண்டாம் நபரின் ராசி {fwd}; பின்னோக்கி எண்ணினால் "
                                f"{bwd}. நட்சத்திர இடைவெளி {nak_gap}. " + note_ta),
                        }})
    except Exception as e:
        return jsonify({"success": False, "error": friendly_error(e)}), 400


@app.post("/api/panchang")
def panchang_api():
    try:
        d = request.get_json(force=True)
        return jsonify({"success": True, "result": panchang_timings(**d)})
    except Exception as e:
        return jsonify({"success": False, "error": friendly_error(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
