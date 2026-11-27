/* AstroHub — bilingual (English + Tamil) UI, chart grids, and browser speech.
   Nothing here talks to any server except this app's own /api endpoints. */

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------ language mode */

// Default to "both" so every value shows in Tamil and English side by side.
let LANG = localStorage.getItem("astrohub-lang") || "both";   // "en" | "ta" | "both"

/** Pick the right string for the current language mode. */
function tx(en, ta) {
  if (ta == null || ta === "") return String(en ?? "");
  if (en == null || en === "") return String(ta ?? "");
  if (LANG === "en") return String(en);
  if (LANG === "ta") return String(ta);
  return `${ta} / ${en}`;
}
/** Two-line version, for table cells and metric tiles. */
function tx2(en, ta) {
  if (LANG === "en") return esc(en);
  if (LANG === "ta") return esc(ta);
  return `${esc(ta)}<small class="alt">${esc(en)}</small>`;
}

function applyStaticLang() {
  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = tx(el.dataset.en, el.dataset.ta);
  });
  document.querySelectorAll("#langSwitch .lang").forEach(b => {
    const active = b.dataset.lang === LANG;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  document.documentElement.lang = LANG === "ta" ? "ta" : "en";
}

document.querySelectorAll("#langSwitch .lang").forEach(b => b.onclick = () => {
  LANG = b.dataset.lang;
  localStorage.setItem("astrohub-lang", LANG);
  applyStaticLang();
  renderAll();
});

/* ------------------------------------------------------------------- tabs */

const tabs = document.querySelectorAll(".tab");
tabs.forEach(b => {
  b.setAttribute("aria-controls", b.dataset.tab);
  b.setAttribute("aria-pressed", b.classList.contains("active"));
  b.onclick = () => {
    tabs.forEach(tab => {
      const active = tab === b;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", active);
      $(tab.dataset.tab).classList.toggle("active", active);
    });
  };
});

/* --------------------------------------------------------------- speech: TTS */

const synth = window.speechSynthesis;
let voices = [];

const normLang = s => String(s || "").toLowerCase().replace(/_/g, "-");
// Some engines label a voice only by name, so match the language name/script too.
const NAME_HINT = { ta: /tamil|தமிழ/i, hi: /hindi|हिन्दी|हिन/i, en: /english/i };

function loadVoices() {
  voices = synth ? (synth.getVoices() || []) : [];
  fillVoicePicker();
  showVoiceAvailability();
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
  // Some browsers populate the list late; retry briefly so Tamil is not missed.
  let tries = 0;
  const poll = setInterval(() => {
    if (voices.length || ++tries > 12) { clearInterval(poll); if (voices.length) loadVoices(); }
    else voices = synth.getVoices() || [];
  }, 250);
}

/** All voices that can speak `target`, best first. */
function voicesFor(target) {
  const t = normLang(target), base = t.split("-")[0];
  let c = voices.filter(v => normLang(v.lang) === t);
  if (!c.length) c = voices.filter(v => normLang(v.lang).split("-")[0] === base);
  if (!c.length && NAME_HINT[base]) c = voices.filter(v => NAME_HINT[base].test(v.name));
  // Prefer an exact-region, locally installed, default voice.
  return c.slice().sort((a, b) =>
    (normLang(b.lang) === t) - (normLang(a.lang) === t) ||
    (b.localService === true) - (a.localService === true) ||
    (b.default === true) - (a.default === true));
}

/** The voice that will actually be used for `target`, or null if none exists. */
function pickVoice(target, honourPicker) {
  const list = voicesFor(target);
  if (honourPicker && $("voicePick") && $("voicePick").value) {
    const chosen = list.find(v => v.name === $("voicePick").value);
    if (chosen) return chosen;
  }
  return list[0] || null;
}

function fillVoicePicker() {
  const sel = $("voicePick");
  if (!sel) return;
  const want = ($("voiceLang") || {}).value || "en-IN";
  const list = voicesFor(want);
  sel.innerHTML = list.length
    ? list.map(v => `<option value="${esc(v.name)}">${esc(v.name)} — ${esc(v.lang)}</option>`).join("")
    : `<option value="">${esc(tx("No voice installed for this language",
        "இந்த மொழிக்கு குரல் நிறுவப்படவில்லை"))}</option>`;
}
if ($("voiceLang")) $("voiceLang").onchange = () => { fillVoicePicker(); showVoiceAvailability(); };

/** Tell the user up front whether a Tamil voice exists on this machine. */
function showVoiceAvailability() {
  const box = $("voiceInfo");
  if (!box) return;
  if (!synth) {
    box.innerHTML = `<span class="bad">${esc(tx("This browser has no speech engine.",
      "இந்த உலாவியில் பேச்சு வசதி இல்லை."))}</span>`;
    return;
  }
  const ta = voicesFor("ta-IN");
  if (ta.length) {
    box.innerHTML = `<span class="good">✓ ${esc(tx(
      `Tamil voice ready: ${ta[0].name} (${ta[0].lang}). The கேட்க buttons will speak Tamil.`,
      `தமிழ் குரல் தயார்: ${ta[0].name} (${ta[0].lang}). கேட்க பொத்தான்கள் தமிழில் பேசும்.`))}</span>`;
  } else {
    box.innerHTML = `<span class="bad">⚠ ${esc(tx(
      "This browser did not report a Tamil voice.", "இந்த உலாவியில் தமிழ் குரல் கண்டறியப்படவில்லை."))}</span>
      <p class="hint">${esc(tx(
        "For approximate Tamil playback, enable the English-voice option below. If you add a Tamil voice, refresh the voice list.",
        "தமிழைத் தோராயமான உச்சரிப்புடன் கேட்க, கீழே உள்ள ஆங்கிலக் குரல் விருப்பத்தைத் தேர்ந்தெடுக்கவும். தமிழ் குரலைச் சேர்த்த பிறகு குரல் பட்டியலைப் புதுப்பிக்கவும்."))}</p>`;
  }

  const list = $("voiceList");
  if (list) {
    list.innerHTML = voices.length
      ? voices.slice().sort((a, b) => String(a.lang).localeCompare(String(b.lang)))
          .map(v => `<div class="vrow${/^ta/i.test(normLang(v.lang)) || NAME_HINT.ta.test(v.name)
            ? " vta" : ""}"><code>${esc(v.lang)}</code> ${esc(v.name)}${
            v.localService ? ` <small>${esc(tx("offline", "ஆஃப்லைன்"))}</small>` : ""}</div>`).join("")
      : `<p class="muted small">${esc(tx("No voices reported yet — press Refresh voice list.",
          "இன்னும் குரல் எதுவும் இல்லை — 'குரல் பட்டியலை புதுப்பி' அழுத்தவும்."))}</p>`;
  }
}

/* Messages go to the Speech Studio status line AND to the note beside whichever
   Listen button was last pressed, so they are visible on every tab. */
let activeNote = null;

function status(msg, bad) {
  const el = $("speechStatus");
  if (el) {
    el.textContent = msg || "";
    el.className = "status" + (bad ? " bad" : "");
  }
  if (activeNote) {
    activeNote.textContent = msg || "";
    activeNote.className = "spnote" + (bad ? " bad" : "");
  }
}

/* ---------------------------------------------- Tamil via an English voice

   Chrome on Windows ships no Tamil voice at all. As an offline, no-network
   fallback we romanise the Tamil text and let an Indian-English voice read it.
   The result is approximate but recognisably Tamil — far better than silence. */

const TA_VIRAMA = "்";
// Chosen for how an English TTS voice will *pronounce* them, not for strict
// scholarly transliteration: ச -> "s" (sani, not chani), ற -> "r" (tharpothu),
// ழ -> "l" (thamil), since "zh" is unreadable to an English voice.
const TA_CONS = {
  "க": "k", "ங": "ng", "ச": "s", "ஞ": "ny", "ட": "t", "ண": "n", "த": "th",
  "ந": "n", "ப": "p", "ம": "m", "ய": "y", "ர": "r", "ல": "l", "வ": "v",
  "ழ": "l", "ள": "l", "ற": "r", "ன": "n", "ஜ": "j", "ஷ": "sh", "ஸ": "s",
  "ஹ": "h", "ஶ": "sh",
};
const TA_SIGN = {
  "ா": "aa", "ி": "i", "ீ": "ee", "ு": "u", "ூ": "oo",
  "ெ": "e", "ே": "e", "ை": "ai", "ொ": "o", "ோ": "o",
  "ௌ": "au",
};
const TA_VOWEL = {
  "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ee", "உ": "u", "ஊ": "oo", "எ": "e",
  "ஏ": "e", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au",
};

/** Romanise Tamil script so an English voice pronounces it roughly correctly. */
function tamilToLatin(text) {
  let out = "";
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], next = s[i + 1];
    if (TA_CONS[ch]) {
      // ச doubled (ச்ச) or after ட்/ண் is the "ch" sound, not "s".
      let base = TA_CONS[ch];
      if (ch === "ச" && (out.endsWith("s") || out.endsWith("t") || out.endsWith("n"))) base = "ch";
      if (next === TA_VIRAMA) { out += base; i++; }
      else if (TA_SIGN[next]) { out += base + TA_SIGN[next]; i++; }
      else out += base + "a";
    } else if (TA_VOWEL[ch]) out += TA_VOWEL[ch];
    else if (ch === "ஃ") out += "ak";
    else if (ch === TA_VIRAMA) { /* stray virama */ }
    else out += ch;
  }
  return out.replace(/\s+/g, " ");
}

const hasTamilScript = s => /[஀-௿]/.test(String(s));
const romanOn = () => {
  const el = $("romanFallback");
  return el ? !!el.checked : localStorage.getItem("astrohub-roman") === "1";
};

/** Split long text so long Tamil paragraphs do not get cut off mid-sentence. */
function chunkText(text) {
  const parts = String(text).replace(/\s+/g, " ").trim().split(/(?<=[.!?।])\s+/);
  const out = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).trim().length > 180) { if (buf) out.push(buf.trim()); buf = p; }
    else buf = (buf + " " + p).trim();
  }
  if (buf) out.push(buf);
  return out.length ? out : [String(text)];
}

/* Chrome stops synthesis after ~15s of continuous speech; a periodic
   pause/resume keeps a long summary going to the end. */
let keepAlive = null;
function startKeepAlive() {
  clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    if (!synth || !synth.speaking) { clearInterval(keepAlive); return; }
    if (!synth.paused) { synth.pause(); synth.resume(); }
  }, 9000);
}
function stopKeepAlive() { clearInterval(keepAlive); keepAlive = null; }

/**
 * Speak a list of {text, lang} segments one after another.
 * Segments whose language has no installed voice are dropped, so Tamil text is
 * never mangled by an English voice.
 */
let speakToken = 0;
function speakSegments(segments, honourPicker, extraNote) {
  if (!synth) {
    status(tx("This browser has no speech engine.", "இந்த உலாவியில் பேச்சு வசதி இல்லை."), true);
    return;
  }
  synth.cancel();
  stopKeepAlive();
  const myToken = ++speakToken;

  const rate = $("rate") ? parseFloat($("rate").value) : 0.95;
  const pitch = $("pitch") ? parseFloat($("pitch").value) : 1;

  const parts = [];
  const skipped = [];
  let romanised = false;
  for (const seg of segments) {
    let text = String(seg.text || "").trim();
    if (!text) continue;
    let voice = pickVoice(seg.lang, honourPicker);

    // No Tamil voice? Romanise and borrow an Indian-English voice instead.
    if (!voice && romanOn() && (/^ta/i.test(normLang(seg.lang)) || hasTamilScript(text))) {
      const en = pickVoice("en-IN", false) || pickVoice("en-US", false);
      if (en) { text = tamilToLatin(text); voice = en; romanised = true; }
    }
    if (!voice) { skipped.push(seg.lang); continue; }
    for (const piece of chunkText(text)) parts.push({ piece, voice, lang: voice.lang || seg.lang });
  }

  if (!parts.length) {
    status(skipped.length
      ? tx(`No installed voice for ${[...new Set(skipped)].join(", ")}. Nothing was spoken.`,
           `${[...new Set(skipped)].join(", ")} மொழிக்கு குரல் இல்லை. எதுவும் பேசப்படவில்லை.`)
      : tx("Nothing to speak.", "பேச எதுவும் இல்லை."), true);
    return;
  }

  const note = (romanised
      ? tx(" (Tamil spoken through an English voice — approximate)",
           " (தமிழ் ஆங்கில குரலில் படிக்கப்பட்டது — தோராயமானது)")
      : "")
    + (extraNote ? " " + extraNote : "") + (skipped.length
    ? tx(` (skipped ${[...new Set(skipped)].join(", ")} — no voice installed)`,
         ` (${[...new Set(skipped)].join(", ")} தவிர்க்கப்பட்டது — குரல் இல்லை)`)
    : "");

  let i = 0;
  const next = () => {
    if (myToken !== speakToken) return;             // a newer request took over
    if (i >= parts.length) { stopKeepAlive(); status(tx("Finished.", "முடிந்தது.") + note); return; }
    const { piece, voice, lang } = parts[i++];
    const u = new SpeechSynthesisUtterance(piece);
    u.voice = voice;
    u.lang = voice.lang || lang;
    u.rate = rate; u.pitch = pitch;
    u.onend = next;
    u.onerror = e => {
      if (myToken !== speakToken || e.error === "interrupted" || e.error === "canceled") return;
      stopKeepAlive();
      status(tx("Speech failed: ", "பேச்சு தோல்வி: ") + (e.error || ""), true);
    };
    synth.speak(u);
  };

  status(tx(`Speaking with ${parts[0].voice.name}…`, `${parts[0].voice.name} குரலில் பேசுகிறது…`) + note,
         !!skipped.length);
  startKeepAlive();
  next();
}

/** Speak one block of text in one language (Speech Studio). */
function speak(text, lang) {
  const selected = lang || $("voiceLang")?.value || "en-IN";
  const target = hasTamilScript(text) && normLang(selected).split("-")[0] !== "ta" ? "ta-IN" : selected;
  speakSegments([{ text, lang: target }], true);
}

/** Speak a result summary in whichever language(s) the user is viewing. */
function speakSummary(en, ta) {
  if (LANG === "en") return speakSegments([{ text: en, lang: "en-IN" }], false);

  // The romanised fallback counts as "can speak Tamil" for routing purposes.
  const haveTamil = voicesFor("ta-IN").length > 0 || romanOn();
  if (LANG === "ta") {
    // Reading Tamil with an English voice produces gibberish, so when no Tamil
    // voice exists fall back to the English text rather than to silence.
    if (haveTamil) return speakSegments([{ text: ta, lang: "ta-IN" }], false);
    return speakSegments([{ text: en, lang: "en-IN" }], false,
      tx("No Tamil voice installed, so the English summary was read. Open the Speech Studio tab for the one-time setup steps.",
         "தமிழ் குரல் நிறுவப்படவில்லை, எனவே ஆங்கில சுருக்கம் படிக்கப்பட்டது. 'பேச்சு கருவி' தாவலில் நிறுவல் படிகள் உள்ளன."));
  }
  // "Both" — Tamil first, then English, each with its own voice.
  speakSegments([{ text: ta, lang: "ta-IN" }, { text: en, lang: "en-IN" }], false);
}

if ($("testTamilBtn")) {
  $("testTamilBtn").onclick = () => {
    const ta = voicesFor("ta-IN");
    if (!ta.length && !romanOn()) {
      status(tx("No Tamil voice detected. Enable the English-voice option for approximate Tamil playback.",
                "தமிழ் குரல் கண்டறியப்படவில்லை. தமிழைத் தோராயமாகக் கேட்க ஆங்கிலக் குரல் விருப்பத்தைத் தேர்ந்தெடுக்கவும்."), true);
      return;
    }
    speakSegments([{ text: "வணக்கம். இது தமிழ் குரல் சோதனை. உங்கள் ஜாதகம் தமிழில் படிக்கப்படும்.",
                     lang: "ta-IN" }], false);
  };
  if ($("romanFallback")) {
    $("romanFallback").checked = localStorage.getItem("astrohub-roman") === "1";
    $("romanFallback").onchange = e => {
      localStorage.setItem("astrohub-roman", e.target.checked ? "1" : "0");
      status(e.target.checked
        ? tx("Tamil will be read through an English voice when no Tamil voice is installed.",
             "தமிழ் குரல் இல்லாதபோது தமிழ் ஆங்கில குரலில் படிக்கப்படும்.")
        : tx("Romanised fallback turned off.", "ஆங்கில குரல் மாற்று நிறுத்தப்பட்டது."));
    };
  }
  $("refreshVoicesBtn").onclick = () => {
    loadVoices();
    const ta = voicesFor("ta-IN");
    status(ta.length
      ? tx(`Found Tamil voice: ${ta[0].name}`, `தமிழ் குரல் கிடைத்தது: ${ta[0].name}`)
      : tx(`${voices.length} voices found, none Tamil.`, `${voices.length} குரல்கள் உள்ளன, தமிழ் இல்லை.`),
      !ta.length);
  };
}

if ($("speakBtn")) {
  $("speakBtn").onclick = () => speak($("speechText").value, $("voiceLang").value);
  $("pauseBtn").onclick = () => { stopKeepAlive(); synth.pause(); status(tx("Paused.", "இடைநிறுத்தப்பட்டது.")); };
  $("resumeBtn").onclick = () => { synth.resume(); startKeepAlive(); status(tx("Speaking…", "பேசுகிறது…")); };
  $("stopBtn").onclick = () => { speakToken++; stopKeepAlive(); synth.cancel(); status(tx("Stopped.", "நிறுத்தப்பட்டது.")); };
  $("clearBtn").onclick = () => { $("speechText").value = ""; status(""); };
  // Ctrl+Enter inside the box speaks it.
  $("speechText").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      speak($("speechText").value, $("voiceLang").value);
    }
  });
}

/* --------------------------------------------------------------- speech: STT */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, recogTarget = null;

function startDictation(targetEl, lang, btn) {
  if (!SR) {
    status(tx("Speech-to-text needs Chrome or Edge.", "பேச்சை உரையாக்க Chrome அல்லது Edge தேவை."), true);
    alert(tx("Speech recognition is not supported in this browser. Please use Chrome or Edge.",
             "இந்த உலாவியில் பேச்சு அங்கீகாரம் இல்லை. Chrome அல்லது Edge பயன்படுத்தவும்."));
    return;
  }
  if (recog) { recog.stop(); recog = null; }
  recog = new SR();
  recog.lang = lang;
  recog.continuous = targetEl.tagName === "TEXTAREA";
  recog.interimResults = true;
  recogTarget = targetEl;
  const base = targetEl.value;
  let finalText = "";

  recog.onstart = () => {
    if (btn) btn.classList.add("listening");
    status(tx("Listening… speak now.", "கேட்கிறது… இப்போது பேசுங்கள்."));
  };
  recog.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t + " "; else interim += t;
    }
    const joined = (base ? base.replace(/\s*$/, " ") : "") + finalText + interim;
    targetEl.value = joined.replace(/\s+/g, " ").trimStart();
  };
  recog.onerror = e => {
    if (btn) btn.classList.remove("listening");
    const msg = e.error === "not-allowed"
      ? tx("Microphone permission was denied.", "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது.")
      : tx("Dictation error: ", "பேச்சு பிழை: ") + e.error;
    status(msg, true);
  };
  recog.onend = () => {
    if (btn) btn.classList.remove("listening");
    if ($("dictateBtn")) $("dictateBtn").classList.remove("listening");
    status(tx("Dictation stopped.", "பேச்சு பதிவு நிறுத்தப்பட்டது."));
    recog = null;
  };
  recog.start();
}

// Microphone buttons attached to individual text inputs.
document.querySelectorAll(".mic").forEach(btn => btn.onclick = () => {
  const el = $(btn.dataset.mic);
  if (recog) { recog.stop(); return; }
  startDictation(el, LANG === "ta" ? "ta-IN" : "en-IN", btn);
});

if ($("dictateBtn")) {
  $("dictateBtn").onclick = () => {
    if (recog) { recog.stop(); return; }
    startDictation($("speechText"), $("voiceLang").value, $("dictateBtn"));
  };
}

/* ------------------------------------------------------------------ network */

async function post(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw Error(j.error || "Calculation failed");
  return j;
}

const busy = () => `<p class="busy">${esc(tx("Calculating…", "கணக்கிடுகிறது…"))}</p>`;
const fail = m => `<p class="error">${esc(m)}</p>`;

/* ------------------------------------------------------- South Indian chart */

// Fixed sign positions in a 4x4 South Indian chart (row, column), 1-indexed.
const SIGN_CELL = {
  11: [1, 1], 0: [1, 2], 1: [1, 3], 2: [1, 4],
  3: [2, 4], 4: [3, 4], 5: [4, 4],
  6: [4, 3], 7: [4, 2], 8: [4, 1],
  9: [3, 1], 10: [2, 1]
};
const RASI_TA_JS = ["மேஷம்", "ரிஷபம்", "மிதுனம்", "கடகம்", "சிம்மம்", "கன்னி",
  "துலாம்", "விருச்சிகம்", "தனுசு", "மகரம்", "கும்பம்", "மீனம்"];
const RASI_EN_JS = ["Mesham", "Rishabam", "Mithunam", "Kadagam", "Simmam", "Kanni",
  "Thulam", "Viruchigam", "Dhanusu", "Magaram", "Kumbam", "Meenam"];

/**
 * Draw a South Indian rasi chart.
 * planets: array of planet blocks, lagnaIndex: sign index of the ascendant.
 */
function chartGrid(planets, lagnaIndex, titleEn, titleTa, subtitle) {
  let cells = "";
  for (let s = 0; s < 12; s++) {
    const [r, c] = SIGN_CELL[s];
    const here = planets.filter(p => p.rasi_index === s);
    const isLagna = s === lagnaIndex;
    const chips = here.map(p => {
      // Chips use one script to fit the grid. Tooltips follow the language setting.
      const face = LANG === "en" ? p.short : p.short_ta;
      const tip = `${tx(p.name, p.name_ta)} — ${tx(p.rasi_en, p.rasi)} ${p.degree_dms}` +
        (p.retrograde ? ` (${tx("retrograde", "வக்ரம்")})` : "");
      return `<span class="chip${p.retrograde ? " retro" : ""}" title="${esc(tip)}">${
        esc(face)}${p.retrograde ? "℞" : ""}</span>`;
    }).join("");
    const cellName = LANG === "en" ? esc(RASI_EN_JS[s])
      : LANG === "ta" ? esc(RASI_TA_JS[s])
      : `${esc(RASI_TA_JS[s])}<span class="alt2">${esc(RASI_EN_JS[s])}</span>`;
    cells += `<div class="cell${isLagna ? " lagnacell" : ""}" style="grid-area:${r}/${c}/${r + 1}/${c + 1}">
      <div class="cellname">${cellName}</div>
      ${isLagna ? `<div class="asc">${esc(tx("Asc", "லக்னம்"))}</div>` : ""}
      <div class="chips">${chips}</div></div>`;
  }
  return `<div class="chartwrap"><div class="sichart">${cells}
    <div class="center" style="grid-area:2/2/4/4">
      <strong>${esc(tx(titleEn, titleTa))}</strong>
      <small>${esc(subtitle || "")}</small>
      <small>${esc(tx("South Indian · Lahiri", "தென்னிந்திய · லாஹிரி"))}</small>
    </div></div></div>`;
}

/* ----------------------------------------------------------- render helpers */

function metricTile(labelEn, labelTa, value, sub) {
  return `<div class="metric"><small>${tx2(labelEn, labelTa)}</small>
    <strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
}

function speakBtn(en, ta) {
  const id = "sp" + Math.random().toString(36).slice(2, 9);
  setTimeout(() => {
    const b = $(id);
    if (b) b.onclick = () => {
      if (activeNote) activeNote.textContent = "";   // clear the previous button's note
      activeNote = $(id + "n");
      speakSummary(en, ta);
    };
  }, 0);
  return `<span class="spwrap"><button type="button" class="ghost small" id="${id}">🔊 ${
    esc(tx("Listen", "கேட்க"))}</button><span class="spnote" id="${id}n"></span></span>`;
}

function summaryBlock(en, ta, titleEn, titleTa) {
  const lines = LANG === "ta" ? ta : LANG === "en" ? en : null;
  let body;
  if (lines) {
    body = (Array.isArray(lines) ? lines : [lines]).map(l => `<p>${esc(l)}</p>`).join("");
  } else {
    const t = Array.isArray(ta) ? ta : [ta], e = Array.isArray(en) ? en : [en];
    body = `<div class="bothcol"><div><h4>தமிழ்</h4>${t.map(l => `<p>${esc(l)}</p>`).join("")}</div>
            <div><h4>English</h4>${e.map(l => `<p>${esc(l)}</p>`).join("")}</div></div>`;
  }
  const enText = Array.isArray(en) ? en.join(" ") : en;
  const taText = Array.isArray(ta) ? ta.join(" ") : ta;
  return `<div class="summary"><div class="sumhead"><h3>${esc(tx(titleEn, titleTa))}</h3>
    ${speakBtn(enText, taText)}</div>${body}</div>`;
}

/* ------------------------------------------------------------- birth chart */

/**
 * Planet table. House numbers are only meaningful when the rows were built
 * against a real ascendant, so `withHouse` is false for the noon/reference table.
 */
function tableStart(en, ta, className = "") {
  return `<div class="table-scroll" role="region" tabindex="0" aria-label="${esc(tx(en, ta))}"><table class="table ${className}">`;
}

function planetTable(planets, withHouse = true) {
  const head = `<tr>
    <th>${tx2("Planet", "கிரகம்")}</th><th>${tx2("Rasi", "ராசி")}</th>
    <th>${tx2("Degree", "பாகை")}</th><th>${tx2("Nakshatra", "நட்சத்திரம்")}</th>
    <th>${tx2("Pada", "பாதம்")}</th>${withHouse ? `<th>${tx2("House", "வீடு")}</th>` : ""}
    <th>${tx2("Status", "நிலை")}</th><th>${tx2("Motion", "கதி")}</th></tr>`;
  const rows = planets.map(p => `<tr>
    <td class="pname"><span class="sym">${esc(p.symbol)}</span>${tx2(p.name, p.name_ta)}</td>
    <td>${tx2(p.rasi_en, p.rasi)}</td>
    <td class="num">${esc(p.degree_dms)}</td>
    <td>${tx2(p.nakshatra_en, p.nakshatra)}</td>
    <td class="num">${p.pada}</td>
    ${withHouse ? `<td class="num" title="${esc(LANG === "ta" ? p.house_meaning_ta : p.house_meaning_en)}">${p.house}</td>` : ""}
    <td>${tx2(p.dignity_en, p.dignity_ta)}</td>
    <td>${p.retrograde ? `<span class="warn">${tx2("Retrograde", "வக்ரம்")}</span>` : tx2("Direct", "நேர்")}</td>
  </tr>`).join("");
  return tableStart("Planet positions", "கிரக நிலைகள்", "planets") + head + rows + `</table></div>`;
}

function planetDetailCards(planets) {
  return `<div class="cards">` + planets.map(p => `<div class="card">
    <div class="cardtop"><span class="sym big">${esc(p.symbol)}</span>
      <div><strong>${tx2(p.name, p.name_ta)}</strong>
      <small>${esc(tx(p.signifies_en, p.signifies_ta))}</small></div></div>
    <ul>
      <li>${esc(tx("Rasi", "ராசி"))}: <b>${esc(tx(p.rasi_en, p.rasi))}</b>${LANG === "ta" ? "" : ` (${esc(p.rasi_west)})`} · ${esc(tx("lord", "அதிபதி"))} ${esc(tx(p.rasi_lord, p.rasi_lord_ta))}</li>
      <li>${esc(tx("Position", "நிலை"))}: <b>${esc(p.degree_dms)}</b> · ${esc(tx("longitude", "தீர்க்கம்"))} ${p.longitude}°</li>
      <li>${esc(tx("Star", "நட்சத்திரம்"))}: <b>${esc(tx(p.nakshatra_en, p.nakshatra))}</b> ${esc(tx("pada", "பாதம்"))} ${p.pada} · ${esc(tx("lord", "அதிபதி"))} ${esc(tx(p.nak_lord, p.nak_lord_ta))}</li>
      <li>${esc(tx("House", "வீடு"))}: <b>${p.house}</b> — ${esc(tx(p.house_meaning_en, p.house_meaning_ta))}</li>
      <li>${esc(tx("Strength", "பலம்"))}: <b>${esc(tx(p.dignity_en, p.dignity_ta))}</b> · ${esc(tx(p.motion_en, p.motion_ta))}</li>
      <li>${esc(tx("Average speed", "சராசரி வேகம்"))}: ${esc(tx(p.daily_en, p.daily_ta))}</li>
    </ul></div>`).join("") + `</div>`;
}

function houseTable(houses) {
  return tableStart("Houses", "வீடுகள்") + `<tr>
    <th>${tx2("House", "வீடு")}</th><th>${tx2("Rasi", "ராசி")}</th>
    <th>${tx2("Lord", "அதிபதி")}</th><th>${tx2("Signifies", "காரகத்துவம்")}</th>
    <th>${tx2("Planets inside", "உள்ள கிரகங்கள்")}</th></tr>` +
    houses.map(h => `<tr><td class="num">${h.house}</td>
      <td>${tx2(h.rasi_en, h.rasi)}</td>
      <td>${tx2(h.lord, h.lord_ta)}</td>
      <td class="small">${esc(tx(h.meaning_en, h.meaning_ta))}</td>
      <td>${h.planets.length
        ? tx2(h.planets.join(", "), (h.planets_ta || h.planets).join(", "))
        : "—"}</td></tr>`).join("") + `</table></div>`;
}

function dashaBlock(d) {
  const cur = d.current, bh = d.current_bhukti;
  let html = `<h3>${esc(tx("Vimshottari Dasha", "விம்சோத்தரி தசை"))}</h3>
    <div class="metrics">
      ${metricTile("Dasha at birth", "பிறப்பு திசை", tx(d.birth_lord, d.birth_lord_ta))}
      ${metricTile("Balance at birth", "பிறப்பு பாக்கி", d.balance_years + " " + tx("years", "வருடம்"))}
      ${cur ? metricTile("Running mahadasha", "நடப்பு மகா திசை", tx(cur.lord, cur.lord_ta), cur.start + " → " + cur.end) : ""}
      ${bh ? metricTile("Running bhukti", "நடப்பு புக்தி", tx(bh.lord, bh.lord_ta), bh.start + " → " + bh.end) : ""}
    </div>`;
  html += tableStart("Mahadasha", "மகா திசை") + `<tr><th>${tx2("Mahadasha", "மகா திசை")}</th>
    <th>${tx2("Years", "வருடம்")}</th><th>${tx2("From", "முதல்")}</th><th>${tx2("To", "வரை")}</th></tr>` +
    d.sequence.map(s => `<tr class="${s.current ? "hl" : ""}"><td>${tx2(s.lord, s.lord_ta)}${s.current ? ` <span class="badge">${esc(tx("now", "இப்போது"))}</span>` : ""}</td>
      <td class="num">${s.years}</td><td class="num">${esc(s.start)}</td><td class="num">${esc(s.end)}</td></tr>`).join("") + `</table></div>`;
  if (d.bhukti && d.bhukti.length) {
    html += `<details><summary>${esc(tx("Sub-periods (bhukti) inside the running mahadasha",
      "நடப்பு மகா திசையின் உள் புக்திகள்"))}</summary>
      ${tableStart("Bhukti", "புக்தி")}<tr><th>${tx2("Bhukti", "புக்தி")}</th><th>${tx2("From", "முதல்")}</th><th>${tx2("To", "வரை")}</th></tr>` +
      d.bhukti.map(b => `<tr class="${b.current ? "hl" : ""}"><td>${tx2(b.lord, b.lord_ta)}</td>
        <td class="num">${esc(b.start)}</td><td class="num">${esc(b.end)}</td></tr>`).join("") + `</table></div></details>`;
  }
  return html;
}

function panchangStrip(p) {
  return `<div class="metrics">
    ${metricTile("Weekday", "கிழமை", tx(p.weekday_en, p.weekday_ta), tx("lord " + p.weekday_lord, "அதிபதி " + p.weekday_lord_ta))}
    ${metricTile("Tithi", "திதி", tx(p.tithi_en, p.tithi_ta), tx(p.paksha_en, p.paksha_ta))}
    ${metricTile("Nakshatra", "நட்சத்திரம்", tx(p.nakshatra_en, p.nakshatra_ta), tx("pada " + p.nakshatra_pada, "பாதம் " + p.nakshatra_pada))}
    ${metricTile("Yoga", "யோகம்", tx(p.yoga_en, p.yoga_ta))}
    ${metricTile("Karana", "கரணம்", tx(p.karana_en, p.karana_ta))}
    ${metricTile("Tamil month", "தமிழ் மாதம்", tx(p.tamil_month_en, p.tamil_month_ta), tx("Sun in " + p.sun_rasi_en, "சூரியன் " + p.sun_rasi_ta))}
  </div>`;
}

function transitTable(tc) {
  return tableStart("Birth and current transits", "பிறப்பு மற்றும் தற்போதைய கோச்சாரம்") + `<tr>
    <th>${tx2("Planet", "கிரகம்")}</th>
    <th>${tx2("At birth", "பிறப்பில்")}</th>
    <th>${tx2("Right now", "தற்போது")}</th>
    <th>${tx2("Movement since birth", "பிறப்பில் இருந்து பயணம்")}</th></tr>` +
    tc.rows.map(r => `<tr>
      <td class="pname"><span class="sym">${esc(r.symbol)}</span>${tx2(r.name, r.name_ta)}</td>
      <td><b>${esc(tx(r.birth_rasi_en, r.birth_rasi))}</b><small class="alt">${esc(r.birth_degree_dms)} · ${esc(tx(r.birth_nakshatra_en, r.birth_nakshatra))} · ${esc(tx("house", "வீடு"))} ${r.birth_house}</small></td>
      <td><b>${esc(tx(r.now_rasi_en, r.now_rasi))}</b>${r.now_motion_en === "Retrograde" ? ` <span class="warn">℞</span>` : ""}<small class="alt">${esc(r.now_degree_dms)} · ${esc(tx(r.now_nakshatra_en, r.now_nakshatra))} · ${esc(tx("house", "வீடு"))} ${r.now_house_from_natal_lagna}</small></td>
      <td class="small">${esc(tx(r.returned_en, r.returned_ta))}<small class="alt">${esc(tx(
        `${r.rounds} rounds of the zodiac · ${r.total_travel_deg}° total`,
        `${r.rounds} முறை ராசி சக்கரம் சுற்றி · மொத்தம் ${r.total_travel_deg}°`))}</small></td>
    </tr>`).join("") + `</table></div>`;
}

function chartHtml(x) {
  const t = x.transit, tc = x.transit_compare;
  return `<div class="result">

    <div class="sumhead"><h3>${esc(tx("Core birth results", "முக்கிய ஜாதக முடிவுகள்"))}</h3>
      ${speakBtn(x.summary.en_text, x.summary.ta_text)}</div>

    <div class="metrics">
      ${metricTile("Moon Rasi", "சந்திர ராசி", tx(x.rasi_en, x.rasi), tx(x.rasi_west + " · lord " + x.rasi_lord, x.rasi + " · அதிபதி " + x.rasi_lord_ta))}
      ${metricTile("Nakshatra", "நட்சத்திரம்", tx(x.nakshatra_en, x.nakshatra), tx("lord " + x.nakshatra_lord, "அதிபதி " + x.nakshatra_lord_ta))}
      ${metricTile("Pada", "பாதம்", x.pada, tx("Quarter of the star", "நட்சத்திர கால் பகுதி"))}
      ${metricTile("Lagna", "லக்னம்", tx(x.lagna_en, x.lagna), x.lagna_degree_dms + " · " + tx("lord " + x.lagna_lord, "அதிபதி " + x.lagna_lord_ta))}
      ${metricTile("Moon degree", "சந்திர பாகை", x.degree_dms, tx(x.nak_elapsed_pct + "% of star crossed", "நட்சத்திரத்தில் " + x.nak_elapsed_pct + "% கடந்தது"))}
      ${metricTile("Ayanamsa", "அயனாம்சம்", tx(x.ayanamsa, "லாஹிரி"), x.ayanamsa_value + "°")}
      ${metricTile("Birth weekday", "பிறந்த கிழமை", tx(x.birth_weekday_en, x.birth_weekday_ta))}
      ${metricTile("Lagna star", "லக்ன நட்சத்திரம்", tx(x.lagna_nakshatra_en, x.lagna_nakshatra), tx("pada " + x.lagna_pada, "பாதம் " + x.lagna_pada))}
      ${metricTile("Age today", "இன்றைய வயது", tx(tc.age_text_en, tc.age_text_ta), tc.age_days + " " + tx("days", "நாட்கள்"))}
    </div>

    <h3>${esc(tx("Rasi chart — birth and right now", "ராசி கட்டம் — பிறப்பு மற்றும் தற்போது"))}</h3>
    <div class="twocharts">
      ${chartGrid(x.planets, x.lagna_index, "Birth chart (Rasi)", "ஜாதக ராசி கட்டம்", x.birth_date + " " + x.birth_time)}
      ${chartGrid(t.planets, t.lagna_index, "Transit now (Gochara)", "தற்போதைய கோச்சாரம்", t.moment_local)}
    </div>
    <p class="muted small">${esc(tx("℞ marks a retrograde planet. The highlighted box in the birth chart is the Lagna.",
      "℞ என்பது வக்ர கிரகம். ஜாதக கட்டத்தில் தனியாகக் காட்டப்பட்ட கட்டம் லக்னம்."))}</p>

    <h3>${esc(tx("Planetary positions at birth", "பிறப்பு கால கிரக நிலைகள்"))}</h3>
    ${planetTable(x.planets)}

    <details><summary>${esc(tx("Full detail for every planet", "ஒவ்வொரு கிரகத்தின் முழு விவரம்"))}</summary>
      ${planetDetailCards(x.planets)}</details>

    <h3>${esc(tx("Twelve houses from the Lagna", "லக்னத்தில் இருந்து பன்னிரண்டு வீடுகள்"))}</h3>
    ${houseTable(x.houses)}

    <h3>${esc(tx("Panchang at the moment of birth", "பிறந்த நேரத்து பஞ்சாங்கம்"))}</h3>
    ${panchangStrip(x.panchang)}

    ${dashaBlock(x.dasha)}

    <h3>${esc(tx("Birth position vs. where each planet travels today", "பிறப்பு நிலை மற்றும் இன்றைய கிரக பயணம்"))}</h3>
    <p class="muted small">${esc(tx("Transit positions are for " + t.moment_local + " in " + x.timezone + ".",
      "கோச்சார நிலைகள் " + t.moment_local + " (" + x.timezone + ") நேரத்திற்கானவை."))}</p>
    ${transitTable(tc)}

    <h3>${esc(tx("Panchang right now", "தற்போதைய பஞ்சாங்கம்"))}</h3>
    ${panchangStrip(t.panchang)}

    ${summaryBlock(x.summary.en, x.summary.ta, "Full written summary", "முழு விளக்கச் சுருக்கம்")}

    <p class="muted small">${esc(tx(
      "Birth details: " + x.birth_date + " " + x.birth_time + " · " + x.birth_place + " · " + x.timezone +
      " · lat " + x.latitude + ", lon " + x.longitude + " · Julian day " + x.julian_day,
      "பிறப்பு விவரம்: " + x.birth_date + " " + x.birth_time + " · " + x.birth_place + " · " + x.timezone +
      " · அட்சரேகை " + x.latitude + ", தீர்க்கரேகை " + x.longitude + " · ஜூலியன் நாள் " + x.julian_day))}</p>
  </div>`;
}

/* ------------------------------------------------------------- planets now */

function nowHtml(s) {
  return `<div class="result">
    <div class="sumhead"><h3>${esc(tx("Live sky — " + s.moment_local, "தற்போதைய வானம் — " + s.moment_local))}</h3>
      ${speakBtn(s.summary_en, s.summary_ta)}</div>
    <div class="metrics">
      ${metricTile("Rising sign now", "தற்போதைய லக்னம்", tx(s.lagna_en, s.lagna), s.lagna_degree_dms)}
      ${metricTile("Moon now", "சந்திரன் இப்போது", tx(s.panchang.nakshatra_en, s.panchang.nakshatra_ta), tx("pada " + s.panchang.nakshatra_pada, "பாதம் " + s.panchang.nakshatra_pada))}
      ${metricTile("Tithi", "திதி", tx(s.panchang.tithi_en, s.panchang.tithi_ta), tx(s.panchang.paksha_en, s.panchang.paksha_ta))}
      ${metricTile("Tamil month", "தமிழ் மாதம்", tx(s.panchang.tamil_month_en, s.panchang.tamil_month_ta))}
      ${metricTile("Ayanamsa", "அயனாம்சம்", s.ayanamsa_value + "°")}
      ${metricTile("Timezone", "நேர மண்டலம்", s.timezone)}
    </div>
    ${chartGrid(s.planets, s.lagna_index, "Sky right now", "இந்த நிமிட வானம்", s.moment_local)}
    ${planetTable(s.planets)}
    ${panchangStrip(s.panchang)}
    <details><summary>${esc(tx("Full detail for every planet", "ஒவ்வொரு கிரகத்தின் முழு விவரம்"))}</summary>
      ${planetDetailCards(s.planets)}</details>
    ${summaryBlock(s.summary_en, s.summary_ta, "Spoken summary", "விளக்கச் சுருக்கம்")}
  </div>`;
}

/* ------------------------------------------------------------ compatibility */

function matchHtml(j) {
  const c = j.preliminary_comparison, a = j.person1, b = j.person2;
  const person = (p, labEn, labTa) => `<div class="pcol"><h4>${esc(tx(labEn, labTa))}</h4>
    <p>${esc(tx("Moon Rasi", "சந்திர ராசி"))}: <b>${esc(tx(p.rasi_en, p.rasi))}</b></p>
    <p>${esc(tx("Nakshatra", "நட்சத்திரம்"))}: <b>${esc(tx(p.nakshatra_en, p.nakshatra))}</b> · ${esc(tx("pada", "பாதம்"))} ${p.pada}</p>
    <p>${esc(tx("Lagna", "லக்னம்"))}: <b>${esc(tx(p.lagna_en, p.lagna))}</b></p>
    <p>${esc(tx("Star lord", "நட்சத்திர அதிபதி"))}: ${esc(tx(p.nakshatra_lord, p.nakshatra_lord_ta))}</p>
    <p class="small muted">${esc(tx("Running dasha", "நடப்பு திசை"))}: ${p.dasha.current ? esc(tx(p.dasha.current.lord, p.dasha.current.lord_ta)) : "—"}</p></div>`;
  return `<div class="result">
    <div class="sumhead"><h3>${esc(tx("Preliminary comparison", "முதற்கட்ட ஒப்பீடு"))}</h3>
      ${speakBtn(c.summary_en, c.summary_ta)}</div>
    <div class="two">${person(a, "Person 1", "முதலாம் நபர்")}${person(b, "Person 2", "இரண்டாம் நபர்")}</div>
    <div class="metrics">
      ${metricTile("Same Rasi", "ஒரே ராசி", c.same_rasi ? tx("Yes", "ஆம்") : tx("No", "இல்லை"))}
      ${metricTile("Same Nakshatra", "ஒரே நட்சத்திரம்", c.same_nakshatra ? tx("Yes", "ஆம்") : tx("No", "இல்லை"))}
      ${metricTile("Rasi count forward", "ராசி எண் (முன்)", c.rasi_distance_forward)}
      ${metricTile("Rasi count backward", "ராசி எண் (பின்)", c.rasi_distance_backward)}
      ${metricTile("Nakshatra gap", "நட்சத்திர இடைவெளி", c.nakshatra_gap)}
      ${metricTile("Shared placements", "ஒரே ராசியில் கிரகம்", c.shared_placements.length)}
    </div>
    ${c.shared_placements.length ? `<p class="muted">${esc(tx("Planets in the same rasi for both charts", "இரு ஜாதகத்திலும் ஒரே ராசியில் உள்ள கிரகங்கள்"))}: ` +
      c.shared_placements.map(s => esc(tx(s.name, s.name_ta)) + " (" + esc(tx(s.rasi_en, s.rasi)) + ")").join(", ") + `</p>` : ""}
    ${summaryBlock(c.summary_en, c.summary_ta, "Written comparison", "ஒப்பீட்டு விளக்கம்")}
    <p class="warnbox">${esc(tx(c.note_en, c.note_ta))}</p>
  </div>`;
}

/* ------------------------------------------------------------ daily timings */

function panHtml(x) {
  return `<div class="result">
    <div class="sumhead"><h3>${esc(tx("Timings for " + x.date, x.date + " நாளுக்கான நேரங்கள்"))}</h3>
      ${speakBtn(x.summary_en, x.summary_ta)}</div>
    <div class="metrics">
      ${metricTile("Sunrise", "சூரிய உதயம்", x.sunrise)}
      ${metricTile("Sunset", "சூரிய அஸ்தமனம்", x.sunset)}
      ${metricTile("Day length", "பகல் நேரம்", tx(x.day_length, x.day_length.replace(/^(\d+)h (\d+)m$/, "$1 மணி $2 நிமிடம்")))}
      ${metricTile("Rahu Kalam", "ராகு காலம்", x.rahu_kalam, tx("avoid new starts", "புதிய தொடக்கம் தவிர்க்க"))}
      ${metricTile("Yamagandam", "யமகண்டம்", x.yamagandam)}
      ${metricTile("Gulikai", "குளிகை", x.gulikai)}
      ${metricTile("Abhijit muhurta", "அபிஜித் முகூர்த்தம்", x.abhijit, tx("generally auspicious", "பொதுவாக நல்ல நேரம்"))}
    </div>
    <h3>${esc(tx("Panchang — the five limbs", "பஞ்சாங்கம் — ஐந்து அங்கங்கள்"))}</h3>
    ${panchangStrip(x)}
    <h3>${esc(tx("Planet positions at noon", "நண்பகல் கிரக நிலைகள்"))}</h3>
    ${planetTable(x.planets, false)}
    ${summaryBlock(x.summary_en, x.summary_ta, "Written summary", "விளக்கச் சுருக்கம்")}
  </div>`;
}

/* ------------------------------------------------------------- form wiring */

function personFields(id) {
  return `
  <label><span>${esc(tx("Date", "தேதி"))}</span><input id="${id}date" type="date" required></label>
  <label><span>${esc(tx("Time", "நேரம்"))}</span><input id="${id}time" type="time" value="11:00"></label>
  <label><span>${esc(tx("Birth place", "பிறந்த ஊர்"))}</span><input id="${id}place" value="Cuddalore"></label>
  <label><span>${esc(tx("Latitude", "அட்சரேகை"))}</span><input id="${id}lat" type="number" step="any" value="11.748"></label>
  <label><span>${esc(tx("Longitude", "தீர்க்கரேகை"))}</span><input id="${id}lon" type="number" step="any" value="79.7714"></label>
  <label><span>${esc(tx("Timezone", "நேர மண்டலம்"))}</span><input id="${id}timezone" value="Asia/Kolkata"></label>`;
}

function readPerson(id) {
  return {
    date: $(`${id}date`).value, time: $(`${id}time`).value, place: $(`${id}place`).value,
    lat: $(`${id}lat`).value, lon: $(`${id}lon`).value, timezone: $(`${id}timezone`).value
  };
}

function buildPersonForms() {
  const keep = ["a", "b"].map(id => {
    const out = {};
    ["date", "time", "place", "lat", "lon", "timezone"].forEach(f => {
      const el = $(id + f); if (el) out[f] = el.value;
    });
    return out;
  });
  $("p1").innerHTML = personFields("a");
  $("p2").innerHTML = personFields("b");
  ["a", "b"].forEach((id, i) => Object.entries(keep[i]).forEach(([f, v]) => {
    const el = $(id + f); if (el && v) el.value = v;
  }));
}

/* ------------------------------------------------------------ state + render */

const state = { chart: null, now: null, match: null, pan: null };

/* -------------------------------------------------------------- chart chat */

const chatBirth = $("chatBirth");
const chatQuestion = $("chatQuestion");
const chatLog = $("chatLog");
const chatPlace = chatBirth.elements.namedItem("place");
const chatReplies = new Map();
let chatStatusText = null;
let chatChart = null;

function chatLocation() {
  const cuddalore = /^(cuddalore(?:,\s*tamil nadu)?|கடலூர்)$/i.test(chatPlace.value.trim());
  const custom = !cuddalore && chatPlace.value.trim() !== "";
  $("chatLocation").hidden = !custom;
  $("chatLocation").querySelectorAll("input").forEach(input => {
    input.disabled = !custom;
    input.required = custom;
  });
  return cuddalore ? { lat: "11.7480", lon: "79.7714", timezone: "Asia/Kolkata" } : {};
}
chatPlace.addEventListener("input", chatLocation);
chatLocation();

function chatMessage(content) {
  const message = document.createElement("p");
  const isReply = typeof content === "function";
  message.className = isReply ? "chat-reply" : "chat-message";
  message.textContent = isReply ? content() : content;
  if (isReply) chatReplies.set(message, content);
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
  return message;
}

function resetChatLog() {
  chatLog.replaceChildren();
  chatReplies.clear();
}

function setChatStatus(message = null) {
  chatStatusText = message;
  $("chatStatus").textContent = message ? message() : "";
}

const chatTopics = [
  ["Marriage", "திருமணம்", /marri|wedding|spouse|life partner|திருமண|மணமக|வாழ்க்கைத்? துணை|शादी|विवाह|thirumanam/, 7,
    "Your chart cannot establish when you will marry, whom you will marry, or whether it will be a love or arranged marriage.",
    "திருமணம் எப்போது, யாருடன், காதல் திருமணமாகவா அல்லது ஏற்பாடு செய்த திருமணமாகவா அமையும் என்பதை ஜாதகத்திலிருந்து உறுதியாகக் கூற முடியாது."],
  ["Love & relationships", "காதல் மற்றும் உறவு", /\blove\b|relationship|break.?up|காதல|மீண்டும்.*பேச|உறவு|प्यार|kadhal/, 7,
    "A chart cannot tell you how another person feels or whether they will return.", "மற்றவர் என்ன உணர்கிறார் அல்லது மீண்டும் வருவாரா என்பதை ஜாதகம் தெரிவிக்காது."],
  ["Career & jobs", "வேலை மற்றும் தொழில்", /\bjobs?\b|career|promotion|salary|interview|வேலை|தொழில்|பதவி|சம்பள|नौकरी|velai/, 10,
    "The chart can show career-related placements used in Vedic astrology, but cannot confirm a job offer, promotion, or salary change.",
    "வேலை தொடர்பாக ஜோதிடத்தில் பார்க்கப்படும் கிரக நிலைகளைக் காட்டலாம். வேலை கிடைக்குமா, பதவி அல்லது சம்பளம் உயருமா என்பதை உறுதிப்படுத்த முடியாது."],
  ["Business", "வியாபாரம்", /business|startup|branch|profit|வியாபார|வர்த்தக|லாபம்|व्यापार|viyabaram/, 10,
    "The chart cannot determine whether a business will succeed, make a profit, or qualify for a loan.",
    "வியாபாரம் வெற்றி பெறுமா, லாபம் தருமா அல்லது கடன் கிடைக்குமா என்பதை ஜாதகம் தீர்மானிக்காது."],
  ["Finance", "பணம் மற்றும் பொருளாதாரம்", /financ|money|debt|loan|savings|income|investment|பணவரவு|பணம்|பணநிலை|கடன்|சேமிப்பு|பொருளாதார|पैसा|कर्ज़|panam/, 2,
    "The chart cannot forecast income, savings, losses, or when a debt will be cleared.",
    "வருமானம், சேமிப்பு, இழப்பு அல்லது கடன் எப்போது தீரும் என்பதை ஜாதகத்திலிருந்து கணிக்க முடியாது."],
  ["Education", "கல்வி", /education|study|studies|exam|college|course|neet|jee|கல்வி|படிப்|தேர்வு|கல்லூரி|पढ़ाई|padippu/, 5,
    "The chart cannot predict exam results or admission to a course or college.", "தேர்வு முடிவுகளையோ, படிப்பு அல்லது கல்லூரிச் சேர்க்கையையோ ஜாதகம் கணிக்காது."],
  ["Foreign travel", "வெளிநாட்டுப் பயணம்", /\bvisa\b|foreign|abroad|immigra|overseas|travel|வெளிநாட்|விசா|பயணம்|विदेश|velinaadu/, 9,
    "The chart cannot confirm visa approval, migration, or an overseas job or admission.",
    "விசா அனுமதி, குடியேற்றம், வெளிநாட்டு வேலை அல்லது படிப்புச் சேர்க்கை ஆகியவற்றை ஜாதகம் உறுதிப்படுத்தாது."],
  ["Family", "குடும்பம்", /famil|parents?|sibling|குடும்ப|பெற்றோர்|உடன்பிற|परिवार|kudumbam/, 4,
    "The chart cannot tell how family members will respond or when a family dispute will be resolved.",
    "குடும்பத்தினர் எப்படி நடந்துகொள்வார்கள் அல்லது குடும்பப் பிரச்சினை எப்போது தீரும் என்பதை ஜாதகம் தெரிவிக்காது."],
  ["Children", "குழந்தைகள்", /child|pregnan|fertil|குழந்தை|கர்ப்ப|संतान|गर्भ|kuzhandhai/, 5,
    "A chart cannot establish fertility, pregnancy timing, or a child’s future.", "கருவுறும் திறன், கர்ப்பம் ஏற்படும் காலம் அல்லது குழந்தையின் எதிர்காலத்தை ஜாதகத்தால் தீர்மானிக்க முடியாது."],
  ["Health", "உடல்நலம்", /health|illness|disease|stress|mental|உடல்நல|ஆரோக்கிய|மன அழுத்த|மன அமைதி|स्वास्थ्य|arokkiyam/, 6,
    "A chart cannot assess your health or diagnose an illness. For a health concern, consult a healthcare professional.",
    "உடல்நிலையை மதிப்பிடவோ நோயைக் கண்டறியவோ ஜாதகத்தால் முடியாது. உடல்நலக் கவலை இருந்தால் மருத்துவரை அணுகுங்கள்."],
  ["Property", "வீடு மற்றும் சொத்து", /property|real estate|\b(?:buy|build|move)\b.*\b(?:house|home|land)\b|சொத்து|வீடு|நிலம்|संपत्ति|சொந்த வீ|sothu/, 4,
    "The chart cannot establish when you can buy or build a home, inherit property, or resolve a dispute.",
    "வீடு வாங்கும் அல்லது கட்டும் காலம், பரம்பரைச் சொத்து கிடைக்குமா, சொத்துத் தகராறு தீருமா என்பவற்றை ஜாதகம் உறுதிப்படுத்தாது."],
  ["General horoscope", "பொதுவான ஜாதகம்", /general horoscope|good time|luck|yoga|this year|next \d+ years|நல்ல கால|அதிர்ஷ்ட|யோக|இந்த வருட|பொதுவான ஜாதக|राशिफल/, 1,
    "AstroHub can show calculated placements and dasha dates. It cannot establish future events or verify specific yogas.",
    "கணக்கிடப்பட்ட கிரக நிலைகளையும் திசைத் தேதிகளையும் ஆஸ்ட்ரோஹப் காட்டும். எதிர்கால நிகழ்வுகளையோ குறிப்பிட்ட யோகங்களையோ உறுதிப்படுத்த முடியாது."],
];

for (const [en, ta] of chatTopics) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost small";
  button.dataset.en = en;
  button.dataset.ta = ta;
  button.onclick = () => {
    const input = chatQuestion.elements.namedItem("question");
    input.value = LANG === "ta" ? ta : en;
    chatQuestion.requestSubmit();
    input.focus();
  };
  $("chatTopics").append(button);
}

function chatPeriodDates(dasha, includeNext = false) {
  const periods = [];
  const current = dasha.current;
  const bhukti = dasha.current_bhukti;
  if (current) periods.push(tx(`Current Mahadasha: ${current.lord}, ${current.start} to ${current.end}.`,
    `நடப்பு மகா திசை: ${current.lord_ta}, ${current.start} முதல் ${current.end} வரை.`));
  if (bhukti) periods.push(tx(`Current Bhukti: ${bhukti.lord}, ${bhukti.start} to ${bhukti.end}.`,
    `நடப்பு புக்தி: ${bhukti.lord_ta}, ${bhukti.start} முதல் ${bhukti.end} வரை.`));
  if (includeNext) {
    const subperiods = dasha.bhukti || [];
    const bhuktiIndex = subperiods.findIndex(period => period.current);
    const nextBhukti = bhuktiIndex >= 0 ? subperiods[bhuktiIndex + 1] : null;
    if (nextBhukti) periods.push(tx(`Next Bhukti: ${nextBhukti.lord}, ${nextBhukti.start} to ${nextBhukti.end}.`,
      `அடுத்த புக்தி: ${nextBhukti.lord_ta}, ${nextBhukti.start} முதல் ${nextBhukti.end} வரை.`));
    const index = dasha.sequence.findIndex(period => period.current);
    const next = index >= 0 ? dasha.sequence[index + 1] : null;
    if (next) periods.push(tx(`Next Mahadasha: ${next.lord}, ${next.start} to ${next.end}.`,
      `அடுத்த மகா திசை: ${next.lord_ta}, ${next.start} முதல் ${next.end} வரை.`));
  }
  return periods;
}

function chartAnswer(question, chart, modelTiming = false) {
  const q = question.normalize("NFKC").toLowerCase()
    .replace(/मृत्यु|मौत|मरूँगा|मरूंगा|मरूँगी|मरूंगी|कब मर/g, " death ")
    .replace(/भविष्य|आने वाला समय|\b(?:en future|en ethirkaalam|my feature|my futre)\b/g, " future ")
    .replace(/चंद्र राशि|राशि|\braasi\b/g, " rasi ")
    .replace(/नक्षत्र|\b(?:natchathiram|natchatiram|nakshatram)\b/g, " nakshatra ")
    .replace(/लग्न|\b(?:lagnam|laknam)\b/g, " lagna ")
    .replace(/महादशा|दशा|\bthisai\b/g, " dasha ")
    .replace(/उम्र|आयु|\bvayasu\b/g, " age ")
    .replace(/ग्रहों|ग्रह स्थिति/g, " planets ")
    .replace(/अभी|आज|பெயர்ச்சி|\bpeyarchi\b/g, " transit ");
  if (/\b(?:death|die|dying|lifespan|life expectancy|end of my life|maranam|saavu)\b|மரணம்|இறப்பு|இறப்பேன்|சாவு/.test(q)) {
    return tx("Your birth chart does not contain a death date. Astrology cannot reliably predict when someone will die.",
      "உங்கள் ஜாதகத்தில் இறப்புத் தேதி இல்லை. ஒருவர் எப்போது இறப்பார் என்பதை ஜோதிடத்தால் நம்பகமாகக் கணிக்க முடியாது.");
  }
  const current = /\b(now|today|current|transits?)\b|இன்று|தற்போத|கோச்சாரம்/i.test(q);
  const planets = current ? chart.transit.planets : chart.planets;
  const planetQuestion = q.replace(/\bmoon (?:rasi|rashi|sign)\b|சந்திர ராசி/g, "");
  const matches = planets.filter(p => new RegExp(`\\b${p.name.toLowerCase()}\\b`).test(planetQuestion) || planetQuestion.includes(p.name_ta));
  const moon = current ? planets.find(p => p.name === "Moon") : chart;
  const replies = [];
  const topics = chatTopics.filter(([, , pattern]) => pattern.test(q));
  const asksWhen = modelTiming || /\b(when|what date|which year|what age|how soon|timing)\b|எப்போது|எப்பொழுது|வாங்கும் காலம்|கட்டும் காலம்|எந்த (?:வயதில்|ஆண்டு|வருடம்|காலம்)|\bkab\b|कब/.test(q);
  const marriageType = /love marriage|arranged marriage|காதல் திருமண|ஏற்பாடு செய்த திருமண/.test(q);
  const dateQuestion = /\b(dasha|dasa|bhukti|mahadasha)\b|தசை|திசை|புக்தி/.test(q);
  const futureQuestion = /\b(future|prediction|what will happen)\b|எதிர்கால/.test(q);
  const nextPeriod = /\bnext (?:(?:maha)?dasha|bhukti)\b|அடுத்த (?:மகா )?(?:திசை|தசை|புக்தி)/.test(q);
  // Health and fertility questions take precedence over incidental topic words.
  const sensitive = topics.find(([topic]) => topic === "Health" || topic === "Children");
  const answeredHouses = new Set();
  for (const [en, ta, , house, limitEn, limitTa] of (sensitive ? [sensitive] : topics.slice(0, 2))) {
    if (answeredHouses.has(house)) continue;
    answeredHouses.add(house);
    const data = chart.houses?.find(item => item.house === house);
    if (data) replies.push(tx(
      `For ${en.toLowerCase()}, a traditional reading looks at house ${house}. In your birth chart, it falls in ${data.rasi_en}, ruled by ${data.lord}. Planets there: ${data.planets.join(", ") || "none"}.`,
      `${ta} குறித்துப் பாரம்பரிய ஜோதிடத்தில் ${house}ஆம் வீட்டைப் பார்ப்பார்கள். உங்கள் பிறப்பு ஜாதகத்தில் அந்த வீடு ${data.rasi} ராசியில் உள்ளது. அதன் அதிபதி ${data.lord_ta}. அங்குள்ள கிரகங்கள்: ${data.planets_ta.join(", ") || "இல்லை"}.`));
    if (en === "Marriage" && marriageType) {
      replies.push(tx("The seventh house shows relationship-related placements. These do not tell whether your marriage will be love or arranged.",
        "ஏழாம் வீடு திருமணம் தொடர்பான கிரக நிலைகளைக் காட்டுகிறது. அவை காதல் திருமணமா அல்லது ஏற்பாடு செய்த திருமணமா என்பதைத் தீர்மானிக்காது."));
    } else if (en === "Marriage" && asksWhen) {
      replies.push(tx("AstroHub can show your chart periods, but it cannot calculate your wedding date.",
        "ஆஸ்ட்ரோஹப் உங்கள் ஜாதகத் திசைக் காலங்களைக் காட்டும். திருமணத் தேதியைக் கணக்கிட முடியாது."));
    } else {
      replies.push(tx(limitEn, limitTa));
    }
  }
  if (sensitive) return replies.join("\n");
  if (/compatib|matching|பொருத்த/.test(q))
    replies.push(tx("Use the Compatibility tab to compare both people’s Moon Rasi and Nakshatra.", "இருவரின் சந்திர ராசியையும் நட்சத்திரத்தையும் ஒப்பிடப் பொருத்தம் தாவலைப் பயன்படுத்துங்கள்."));
  if (/auspicious|muhurta|நல்ல நேர|முகூர்த்த/.test(q))
    replies.push(tx("Daily Timings shows general Panchang timings for a date and location. It does not calculate a personalized Muhurta.",
      "நல்ல நேரம் தாவல், தேதி மற்றும் இடத்திற்கான பொதுப் பஞ்சாங்க நேரங்களைக் காட்டும். தனிப்பட்ட முகூர்த்தத்தைக் கணக்கிடாது."));
  if (futureQuestion && !topics.length) {
    replies.push(tx("Your chart cannot tell me what events will happen in your future.",
      "எதிர்காலத்தில் என்ன நிகழும் என்பதை உங்கள் ஜாதகத்திலிருந்து உறுதியாகக் கூற முடியாது."));
  }
  const topicTiming = topics.length > 0 && asksWhen;
  if (dateQuestion || futureQuestion || topicTiming) {
    const periods = chatPeriodDates(chart.dasha, nextPeriod || futureQuestion || topicTiming);
    if (periods.length && topicTiming) replies.push(tx(
      "Chart period dates (DD-MM-YYYY). These dates describe Dasha periods only.",
      "ஜாதகத் திசைக் காலத் தேதிகள் (நாள்-மாதம்-ஆண்டு). இவை திசை மற்றும் புக்திக் காலங்களைக் குறிக்கும்."));
    replies.push(...periods);
    if (!periods.length && dateQuestion) replies.push(tx("No current period is available in this chart.", "இந்த ஜாதகத்தில் நடப்புத் திசைக் காலம் கிடைக்கவில்லை."));
  }
  if (/\b(?:birth details|date of birth|birth date|birth time|birthplace|when was i born|dob)\b|பிறப்பு விவர|பிறந்த தேதி|பிறந்த நேரம்|பிறந்த ஊர்|எப்போது பிறந்த/.test(q))
    replies.push(tx(
      `Birth details: ${chart.birth_date}, ${chart.birth_time}, ${chart.birth_place} (${chart.timezone}).`,
      `பிறப்பு விவரங்கள்: ${chart.birth_date}, ${chart.birth_time}, ${chart.birth_place} (${chart.timezone}).`));
  if (/\b(r[āa][sś]i|rashi|moon sign)\b|ராசி/.test(q) && !matches.length)
    replies.push(tx(`${current ? "Current" : "Birth"} Moon Rasi: ${moon.rasi_en}.`,
      `${current ? "தற்போதைய" : "பிறப்புச்"} சந்திர ராசி: ${moon.rasi}.`));
  if (/\b(nakshatra|birth star|pada)\b|நட்சத்திரம்|பாதம்/.test(q) && !matches.length)
    replies.push(tx(`${current ? "Current" : "Birth"} Nakshatra: ${moon.nakshatra_en}, Pada ${moon.pada}.`,
      `${current ? "தற்போதைய" : "பிறப்பு"} நட்சத்திரம்: ${moon.nakshatra}, பாதம் ${moon.pada}.`));
  if (/\b(lagna|ascendant|rising sign)\b|லக்னம்|லக்ன/.test(q)) {
    const frame = current ? chart.transit : chart;
    replies.push(tx(`Lagna: ${frame.lagna_en}, ${frame.lagna_degree_dms}.`, `லக்னம்: ${frame.lagna}, ${frame.lagna_degree_dms}.`));
  }
  if (/\b(age|how old)\b|வயது/.test(q))
    replies.push(tx(chart.transit_compare.age_text_en, chart.transit_compare.age_text_ta));
  if (matches.length || /\b(planets|transits?)\b|கிரகங்கள்|கிரக நிலை|கோச்சாரம்/.test(q)) {
    replies.push(tx(current ? "Current positions" : "Birth positions", current ? "தற்போதைய கிரக நிலைகள்" : "பிறப்பு கிரக நிலைகள்"));
    for (const p of (matches.length ? matches : planets)) {
      replies.push(tx(`${p.name}: ${p.rasi_en}, ${p.degree_dms}, ${p.nakshatra_en} (Pada ${p.pada}).`,
        `${p.name_ta}: ${p.rasi}, ${p.degree_dms}, ${p.nakshatra} (பாதம் ${p.pada}).`));
    }
  }
  if (/\b(summary|overview)\b|சுருக்கம்/.test(q))
    replies.push(tx(chart.summary.en.join("\n"), chart.summary.ta.join("\n")));
  return replies.join("\n");
}

function chatUnknownAnswer() {
  return tx(
    "I couldn’t match that question to your chart data. Try “What is my Moon Rasi?” or “When does my next dasha start?”",
    "இந்தக் கேள்விக்கான பதிலை உங்கள் ஜாதகத் தரவிலிருந்து கண்டறிய முடியவில்லை. “என் சந்திர ராசி என்ன?” அல்லது “என் அடுத்த திசை எப்போது தொடங்கும்?” என்று கேட்டுப் பாருங்கள்.");
}

chatBirth.onsubmit = async e => {
  e.preventDefault();
  const submit = chatBirth.querySelector("button[type=submit]");
  if (submit.disabled) return;
  const location = chatLocation();
  if (!chatBirth.reportValidity()) return;
  const data = Object.fromEntries(new FormData(chatBirth));
  data.full_name = data.full_name.trim();
  data.place = data.place.trim();
  if (!data.full_name || !data.place) {
    setChatStatus(() => tx("Enter a name and birth place.", "பெயரையும் பிறந்த இடத்தையும் உள்ளிடுங்கள்."));
    return;
  }
  submit.disabled = true;
  setChatStatus(() => tx("Calculating your chart…", "உங்கள் ஜாதகம் கணக்கிடப்படுகிறது…"));
  try {
    const response = await post("/api/chart", { ...data, ...location });
    chatChart = response.result;
    resetChatLog();
    chatMessage(() => tx(`${data.full_name}, your chart is ready. Try asking “What is my Nakshatra?”`,
      `${data.full_name}, உங்கள் ஜாதகம் தயார். “என் நட்சத்திரம் என்ன?” என்று கேட்டுப் பாருங்கள்.`));
    chatBirth.hidden = true;
    chatQuestion.hidden = false;
    chatQuestion.elements.namedItem("question").focus();
    setChatStatus();
  } catch (err) {
    setChatStatus(() => tx(`Could not calculate your chart. ${err.message}`,
      "ஜாதகத்தைக் கணக்கிட முடியவில்லை. பிறப்பு விவரங்களைச் சரிபார்க்கவும்."));
  } finally {
    submit.disabled = false;
  }
};

let pendingChatChart = null;
chatQuestion.onsubmit = async e => {
  e.preventDefault();
  const input = chatQuestion.elements.namedItem("question");
  const question = input.value.trim();
  const chart = chatChart;
  if (!question || !chart || pendingChatChart === chart) return;
  chatMessage(question);
  input.value = "";
  pendingChatChart = chart;
  const pendingReply = chatMessage(() => tx("Preparing your chart answer", "உங்கள் ஜாதகப் பதிலைத் தயாரிக்கிறேன்"));
  pendingReply.classList.add("chat-pending");
  chatLog.scrollTop = chatLog.scrollHeight;
  let model;
  try {
    model = await post("/api/chat/intent", { question });
  } catch {
    // The built-in reply is available when the optional model is offline.
  } finally {
    chatReplies.delete(pendingReply);
    pendingReply.remove();
    if (pendingChatChart === chart) pendingChatChart = null;
  }
  if (chatChart !== chart) return;
  chatMessage(() => {
    const timing = model?.asks_timing === true;
    return chartAnswer(question, chart, timing) ||
      (model?.canonical_question && chartAnswer(model.canonical_question, chart, timing)) ||
      chatUnknownAnswer();
  });
};

$("chatEdit").onclick = () => {
  chatChart = null;
  setChatStatus();
  chatQuestion.reset();
  chatQuestion.hidden = true;
  chatBirth.hidden = false;
  resetChatLog();
  chatMessage(() => tx("Update your birth details to start a new chat.", "புதிய உரையாடலைத் தொடங்க பிறப்பு விவரங்களை மாற்றுங்கள்."));
  chatBirth.elements.namedItem("full_name").focus();
};

function renderAll() {
  chatReplies.forEach((message, element) => { element.textContent = message(); });
  setChatStatus(chatStatusText);
  buildPersonForms();
  if (state.chart) $("chartResult").innerHTML = chartHtml(state.chart);
  if (state.now) $("nowResult").innerHTML = nowHtml(state.now);
  if (state.match) $("matchResult").innerHTML = matchHtml(state.match);
  if (state.pan) $("panResult").innerHTML = panHtml(state.pan);
  fillVoicePicker();
  showVoiceAvailability();
}

$("chartForm").onsubmit = async e => {
  e.preventDefault();
  $("chartResult").innerHTML = busy();
  try {
    const j = await post("/api/chart", {
      full_name: $("name").value, date: $("date").value, time: $("time").value,
      place: $("place").value, lat: $("lat").value, lon: $("lon").value,
      timezone: $("timezone").value
    });
    state.chart = j.result;
    $("chartResult").innerHTML = chartHtml(j.result);
    $("chartResult").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) { $("chartResult").innerHTML = fail(err.message); }
};

let nowTimer = null;
async function loadNow() {
  $("nowResult").innerHTML = state.now ? $("nowResult").innerHTML : busy();
  try {
    const j = await post("/api/now", {
      lat: $("nowLat").value, lon: $("nowLon").value, timezone: $("nowTz").value
    });
    state.now = j.result;
    $("nowResult").innerHTML = nowHtml(j.result);
  } catch (err) { $("nowResult").innerHTML = fail(err.message); }
}
$("nowForm").onsubmit = e => { e.preventDefault(); loadNow(); };
$("autoRefresh").onchange = e => {
  clearInterval(nowTimer);
  if (e.target.checked) { loadNow(); nowTimer = setInterval(loadNow, 60000); }
};

$("matchBtn").onclick = async () => {
  $("matchResult").innerHTML = busy();
  try {
    const j = await post("/api/match", { person1: readPerson("a"), person2: readPerson("b") });
    state.match = j;
    $("matchResult").innerHTML = matchHtml(j);
  } catch (err) { $("matchResult").innerHTML = fail(err.message); }
};

$("panForm").onsubmit = async e => {
  e.preventDefault();
  $("panResult").innerHTML = busy();
  try {
    const j = await post("/api/panchang", {
      date: $("panDate").value, lat: $("panLat").value,
      lon: $("panLon").value, timezone: $("panTz").value
    });
    state.pan = j.result;
    $("panResult").innerHTML = panHtml(j.result);
  } catch (err) { $("panResult").innerHTML = fail(err.message); }
};

/* ------------------------------------------------------------------- start */

const universeBackdrop = document.querySelector(".universe-backdrop");
const pauseGalaxy = $("pauseGalaxy");
const backgroundReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let spaceScrollFrame = null;

function queueSpaceScroll() {
  if (spaceScrollFrame !== null || pauseGalaxy.checked || backgroundReducedMotion.matches) return;
  spaceScrollFrame = requestAnimationFrame(() => {
    spaceScrollFrame = null;
    if (pauseGalaxy.checked || backgroundReducedMotion.matches) return;
    const offset = Math.min(5, Math.max(0, (window.scrollY / window.innerHeight) * 3));
    universeBackdrop.style.setProperty("--space-scroll", `${offset}vh`);
  });
}

window.addEventListener("scroll", queueSpaceScroll, { passive: true });
window.addEventListener("resize", queueSpaceScroll);
pauseGalaxy.addEventListener("change", queueSpaceScroll);
backgroundReducedMotion.addEventListener("change", queueSpaceScroll);
queueSpaceScroll();

(function init() {
  const today = new Date().toISOString().slice(0, 10);
  if (!$("panDate").value) $("panDate").value = today;
  // "Now" and "Daily timings" default to the viewer's own zone; the birth
  // Birth Chart uses the fixed timezone from its hidden form field.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) ["nowTz", "panTz"].forEach(id => { if ($(id)) $(id).value = tz; });
  } catch (e) { /* keep the Asia/Kolkata default */ }
  applyStaticLang();
  showVoiceAvailability();
  buildPersonForms();
})();
