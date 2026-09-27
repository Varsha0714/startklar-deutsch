// ================= Core: data, state, storage, speech, number drills, learning engine =================
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pct = x => Math.round(x * 100);

// ---------- vocabulary ----------
const TOPICS = {};   // id -> {id, de, en, lvl, words:[]}
const WORDS = {};    // wid -> word
for (const lvl of ["A1", "A2"]) for (const t of VOCAB_SRC[lvl]) {
  const topic = { id: t.id, de: t.de, en: t.en, lvl, words: [] };
  t.w.trim().split("\n").forEach(line => {
    const [de, en] = line.split(" = ").map(s => s.trim());
    if (!de || !en) return;
    const m = de.match(/^(der|die|das) (.+)$/);
    const w = { id: lvl + ":" + de, de, en, lvl, topic: t.id, art: m ? m[1] : null, noun: m ? m[2] : null };
    topic.words.push(w); WORDS[w.id] = w;
  });
  TOPICS[t.id] = topic;
}
const topicsFor = lvl => Object.values(TOPICS).filter(t => t.lvl === lvl);

// ---------- labels for the analysis ----------
const PART_INFO = {
  A1: {
    hoeren: { 1: "Kurze Gespräche · 2× hören", 2: "Durchsagen · 1× hören", 3: "Telefonansagen · 2× hören" },
    lesen: { 1: "E-Mails & Briefe", 2: "Anzeigen: a oder b?", 3: "Schilder & Aushänge" },
    schreiben: { 1: "Formular ausfüllen", 2: "Kurze Nachricht (~30 Wörter)" },
    sprechen: { 1: "Sich vorstellen", 2: "Fragen & Antworten (Themenkarten)", 3: "Bitten formulieren (Bildkarten)" }
  },
  A2: {
    hoeren: { 1: "Radio & Durchsagen", 3: "Kurze Gespräche", 4: "Interview · Ja/Nein" },
    lesen: { 2: "Wegweiser & Infos", 3: "E-Mails" },
    schreiben: { 1: "SMS (20–30 Wörter)", 2: "E-Mail (30–40 Wörter)" },
    sprechen: { 1: "Fragen zur Person", 2: "Über sich erzählen", 3: "Gemeinsam etwas planen" }
  }
};
const TRAP_INFO = {
  price: ["Preise", "prices like „zwei Euro vierzig“"],
  time: ["Uhrzeiten", "times: halb, Viertel, 24-hour"],
  number: ["Zahlen", "13 vs 30, 42 = zwei-und-vierzig"],
  day: ["Wochentage", "Dienstag vs Donnerstag"],
  date: ["Datum", "am dritten vs dreizehnten"],
  phone: ["Telefonnummern", "digit groups"],
  change: ["Planänderungen", "„nicht X, sondern Y“, first answer rejected"],
  negation: ["Verneinung", "„haben wir noch“, „kein“, „nicht“"],
  place: ["Orte & Stockwerke", "Erdgeschoss, erster Stock, Gleis"]
};
const DRILL_INFO = {
  num: ["Zahlen", "Hear a number, pick the digits"],
  price: ["Preise", "Euro and cent amounts"],
  time: ["Uhrzeit (Alltag)", "halb, Viertel nach/vor"],
  clock: ["Uhrzeit (offiziell)", "vierzehn Uhr fünfunddreißig"],
  date: ["Datum", "am dreiundzwanzigsten März"],
  phone: ["Telefonnummern", "Digit pairs, backwards tens"],
  spell: ["Buchstabieren", "German alphabet: E/I, V/W, J/Y"]
};

// ---------- German numbers ----------
const ONES = ["null","eins","zwei","drei","vier","fünf","sechs","sieben","acht","neun","zehn","elf","zwölf","dreizehn","vierzehn","fünfzehn","sechzehn","siebzehn","achtzehn","neunzehn"];
const TENS = ["","","zwanzig","dreißig","vierzig","fünfzig","sechzig","siebzig","achtzig","neunzig"];
function deNum(n) {
  if (n < 20) return ONES[n];
  if (n < 100) { const t = Math.floor(n / 10), o = n % 10; return o ? (o === 1 ? "ein" : ONES[o]) + "und" + TENS[t] : TENS[t]; }
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? "ein" : ONES[h]) + "hundert" + (r ? deNum(r) : ""); }
  const th = Math.floor(n / 1000), r = n % 1000; return (th === 1 ? "ein" : deNum(th)) + "tausend" + (r ? deNum(r) : "");
}
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
function deOrd(n) { // dative: am ersten, am dritten ...
  const irr = { 1: "ersten", 3: "dritten", 7: "siebten", 8: "achten" };
  if (irr[n]) return irr[n];
  return n < 20 ? deNum(n) + "ten" : deNum(n) + "sten";
}
const LETTERS = {a:"A",b:"Be",c:"Tse",d:"De",e:"E",f:"Eff",g:"Ge",h:"Ha",i:"I",j:"Jott",k:"Ka",l:"Ell",m:"Emm",n:"Enn",o:"O",p:"Pe",q:"Kuh",r:"Err",s:"Ess",t:"Te",u:"U",v:"Fau",w:"We",x:"Iks",y:"Ypsilon",z:"Zett","ä":"Ä","ö":"Ö","ü":"Ü"};
const SPELL_NAMES = ["Berger","Weiß","Vogel","Jansen","Kiefer","Brehm","Pieper","Seidel","Wagner","Yilmaz","Diehl","Tietz","Engel","Ivanov","Jäger","Gerber","Heine","Wiegand"];
const SWAPS = [["e","i"],["i","e"],["v","w"],["w","v"],["b","p"],["p","b"],["d","t"],["t","d"],["j","y"],["g","k"],["ie","ei"],["ei","ie"],["h","a"]];

function uniqOpts(correct, cands, n = 3) {
  const out = [correct];
  for (const c of shuffle(cands)) { if (out.length >= n) break; if (!out.includes(c)) out.push(c); }
  let guard = 0; while (out.length < n && guard++ < 20) { const c = correct.replace(/(\d)(\D*)$/, (m, d, rest) => ((+d + guard) % 10) + rest); if (!out.includes(c)) out.push(c); }
  return shuffle(out);
}
function fmtTime(h, m) { return h + ":" + String(m).padStart(2, "0"); }

function makeDrill(type) {
  let say, ans, cands;
  if (type === "num") {
    const pairs = [[13,30],[14,40],[15,50],[16,60],[17,70],[18,80],[19,90]];
    if (Math.random() < .45) { const p = pick(pairs); const n = pick(p); say = deNum(n); ans = String(n); cands = [String(p[0]), String(p[1]), String(p[0] + (p[1] === n ? 1 : 10))]; }
    else { let n = 21 + rnd(78); if (n % 10 === 0) n++; const sw = Number(String(n).split("").reverse().join("")); const big = Math.random() < .35 ? 100 * (1 + rnd(8)) : 0; say = deNum(big + n); ans = String(big + n); cands = [String(big + sw), String(big + n + 10), String(big + n - 1)]; }
  } else if (type === "price") {
    const e = 1 + rnd(19), c = 10 + rnd(89); const cs = String(c).padStart(2, "0"); const csw = String(Number(String(c).split("").reverse().join(""))).padStart(2, "0");
    say = deNum(e) + " Euro " + deNum(c); if (e === 1) say = "ein Euro " + deNum(c);
    ans = e + "," + cs + " €"; cands = [e + "," + csw + " €", (e + 1) + "," + cs + " €", c + "," + String(e).padStart(2, "0") + " €"];
  } else if (type === "time") {
    const h = 1 + rnd(11); const kind = pick(["halb", "halb", "nach", "vor", "min"]); let hh = h, mm = 0;
    const next = h % 12 + 1;
    if (kind === "halb") { say = "halb " + deNum(next); hh = h; mm = 30; cands = [fmtTime(next, 30), fmtTime(h, 15), fmtTime(next, 0)]; }
    else if (kind === "nach") { say = "Viertel nach " + deNum(h === 1 ? 1 : h).replace(/^eins$/, "eins"); mm = 15; cands = [fmtTime(h, 45), fmtTime(next, 15), fmtTime(h, 30)]; }
    else if (kind === "vor") { say = "Viertel vor " + deNum(next); mm = 45; cands = [fmtTime(next, 45), fmtTime(next, 15), fmtTime(h, 15)]; }
    else { const m = pick([5, 10, 20]); const v = Math.random() < .5; if (v) { say = deNum(m) + " vor " + deNum(next); hh = h; mm = 60 - m; cands = [fmtTime(next, m), fmtTime(h, m), fmtTime(next, 60 - m)]; } else { say = deNum(m) + " nach " + deNum(h); mm = m; cands = [fmtTime(h, 60 - m), fmtTime(h - 1 || 12, 60 - m), fmtTime(next, m)]; } }
    say = "Es ist " + say + "."; ans = fmtTime(hh, mm);
  } else if (type === "clock") {
    const h = 6 + rnd(17), m = pick([5, 10, 15, 20, 25, 35, 40, 45, 50, 52, 13, 17, 38]);
    say = deNum(h) + " Uhr " + deNum(m); ans = fmtTime(h, m);
    const msw = Number(String(m).padStart(2, "0").split("").reverse().join(""));
    cands = [fmtTime(h, msw < 60 ? msw : (m + 10) % 60), fmtTime((h + 12) % 24, m), fmtTime(h, (m + 30) % 60)];
  } else if (type === "date") {
    const d = 1 + rnd(28), mo = rnd(12);
    say = "am " + deOrd(d) + " " + MONTHS[mo]; ans = d + ". " + MONTHS[mo];
    const d2 = d < 10 ? d + 10 : d <= 20 ? (d === 10 ? 20 : d - 10) : d - 20;
    const moAlt = mo === 2 ? 4 : mo === 4 ? 2 : mo === 5 ? 6 : mo === 6 ? 5 : (mo + 1) % 12;
    cands = [d2 + ". " + MONTHS[mo], d + ". " + MONTHS[moAlt], d2 + ". " + MONTHS[moAlt]];
  } else if (type === "phone") {
    const g = [rnd(90) + 10, rnd(90) + 10, rnd(90) + 10].map(x => (x % 10 && x % 11) ? x : (x > 95 ? x - 3 : x + 2));
    const pre = pick(["0176", "0151", "030", "089", "0221"]);
    say = pre.split("").map(d => ONES[+d]).join(" ") + ", " + g.map(deNum).join(", ");
    const f = a => pre + " " + a.join(" ");
    ans = f(g); const rev = n => Number(String(n).split("").reverse().join(""));
    cands = [f([rev(g[0]), g[1], g[2]]), f([g[0], rev(g[1]), g[2]]), f([g[0], g[1], rev(g[2])])];
  } else { // spell
    const name = pick(SPELL_NAMES); const low = name.toLowerCase();
    say = low.split("").map(ch => ch === "ß" ? "Eszett" : LETTERS[ch] || ch).join(", ");
    ans = name; cands = [];
    for (const [x, y] of shuffle(SWAPS)) { if (low.includes(x)) { const alt = low.replace(x, y); cands.push(alt[0].toUpperCase() + alt.slice(1)); } if (cands.length >= 4) break; }
    if (cands.length < 2) cands.push(name + "e", name.slice(0, -1));
  }
  return { kind: "drill", type, say, ans, opts: uniqOpts(ans, cands.filter(c => c !== ans), 3) };
}

// ---------- state ----------
const TODAY = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dayNum = (iso = TODAY()) => Math.floor(Date.parse(iso + "T12:00:00") / 864e5);
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function freshState() {
  return { v: 2, level: "A1", exam: { A1: "2026-10-06", A2: "2026-12-15" }, rate: 0.9, showEn: true, doneDays: {},
    words: {}, items: {}, skills: {}, days: {}, mocks: [], writing: [], gen: [], mistakes: [], updatedAt: 0, created: Date.now() };
}
let S = freshState();

const Store = {
  db: null, uid: null, status: "local", saving: false, dirty: false, timer: null,
  LS: "startklar-v1",
  loadLocal() { try { const raw = localStorage.getItem(this.LS); if (raw) return JSON.parse(raw); } catch (e) {} return null; },
  saveLocal() { try { localStorage.setItem(this.LS, JSON.stringify(S)); } catch (e) {} },
  ref() { return this.db.doc("data/users/" + this.uid + "/progress"); },
  async connect(onChange) {
    try {
      if (!window.claude?.use) return;
      const [user, db] = await Promise.all([window.claude.use("user"), window.claude.use("db")]);
      if (!user || !db) return;
      const uid = await user.id(); if (!uid) return;
      this.db = db; this.uid = uid;
      const snap = await this.ref().get();
      if (snap.exists) {
        const remote = snap.data();
        if ((remote.updatedAt || 0) > (S.updatedAt || 0)) { S = normalize(JSON.parse(JSON.stringify(remote))); this.saveLocal(); onChange(); }
        else if ((S.updatedAt || 0) > (remote.updatedAt || 0)) this.queue(0);
      } else if (S.updatedAt) this.queue(0);
      this.status = "cloud"; onChange();
    } catch (e) { this.db = null; this.status = "local"; onChange(); }
  },
  save() { S.updatedAt = Date.now(); this.saveLocal(); if (this.db) this.queue(2500); },
  queue(ms) { this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); },
  async flush() {
    if (!this.db || !this.dirty) return;
    if (this.saving) { this.queue(1500); return; }
    this.saving = true; this.dirty = false;
    try { await this.ref().set(JSON.parse(JSON.stringify(S))); }
    catch (e) { if (e && e.code === "unavailable") this.queue(4000); else if (e && (e.code === "revoked" || e.code === "invalid_argument")) { this.db = null; this.status = "local"; } }
    finally { this.saving = false; }
  }
};
function normalize(s) {
  const f = freshState(); for (const k in f) if (s[k] === undefined) s[k] = f[k];
  if (!s.v || s.v < 2) { s.exam.A1 = "2026-10-06"; s.v = 2; } // exam booked for Tue 6 Oct 2026
  if (!s.exam.A2) s.exam.A2 = f.exam.A2; return s;
}

// ---------- speech ----------
const TTS = {
  ok: "speechSynthesis" in window, voices: [], playing: false, token: 0,
  init() {
    if (!this.ok) return;
    const load = () => {
      const all = speechSynthesis.getVoices().filter(v => /^de(-|_|$)/i.test(v.lang));
      const score = v => (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) + (/de-DE/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
      this.voices = all.sort((a, b) => score(b) - score(a));
    };
    load(); speechSynthesis.onvoiceschanged = load;
  },
  hasGerman() { return this.voices.length > 0; },
  stop() { this.token++; this.playing = false; if (this.ok) speechSynthesis.cancel(); },
  // lines: [[speaker, text], ...]
  play(lines, { rate = S.rate, onend, onstart } = {}) {
    if (!this.ok) { onend && onend(false); return; }
    this.stop(); const my = ++this.token; this.playing = true; onstart && onstart();
    const v0 = this.voices[0], v1 = this.voices.find(v => v !== v0 && v.name.split(" ")[0] !== v0?.name.split(" ")[0]) || this.voices[1];
    let i = 0;
    const next = () => {
      if (my !== this.token) return;
      if (i >= lines.length) { this.playing = false; onend && onend(true); return; }
      const [sp, text] = lines[i++];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE"; u.rate = rate;
      if (sp === "B") { if (v1) u.voice = v1; else { if (v0) u.voice = v0; u.pitch = 0.75; } }
      else { if (v0) u.voice = v0; u.pitch = sp === "N" ? 0.95 : 1.05; }
      u.onend = () => setTimeout(next, 380); u.onerror = () => setTimeout(next, 50);
      speechSynthesis.speak(u);
    };
    next();
  },
  say(text, opts) { this.play([["A", text]], opts); }
};

// ---------- learning engine ----------
const BOX_DAYS = [0, 1, 2, 4, 7, 14, 30];
function skill(key) { return S.skills[key] || (S.skills[key] = { n: 0, c: 0, e: 0.5 }); }
function record(keys, ok) {
  for (const k of keys) { const s = skill(k); s.n++; if (ok) s.c++; s.e = s.e * 0.78 + (ok ? 1 : 0) * 0.22; s.t = dayNum(); }
  const d = S.days[TODAY()] || (S.days[TODAY()] = { q: 0, c: 0 }); d.q++; if (ok) d.c++;
}
function skillVal(key) { const s = S.skills[key]; return s ? s.e : null; }
function skillN(key) { return S.skills[key]?.n || 0; }

function wordState(wid) { return S.words[wid]; }
function gradeWord(w, ok, mode, artOk = true) {
  const st = S.words[w.id] || (S.words[w.id] = { b: 0, d: 0, n: 0, c: 0, x: 0 });
  st.n++;
  if (ok) { st.c++; st.b = Math.min(6, st.b + 1); }
  else { st.x++; st.b = Math.max(1, st.b - 2); }
  st.d = dayNum() + (ok ? BOX_DAYS[st.b] : 0);
  record(["topic." + w.topic, "vocab." + mode], ok);
  if (w.art && mode === "recall") record(["vocab.article"], artOk);
  if (!ok) addMistake({ t: "w", id: w.id });
}
function recordItem(kind, item, qi, ok) {
  const key = kind + ":" + item.id + (item.qs.length > 1 ? "#" + qi : "");
  const st = S.items[key] || (S.items[key] = { n: 0, c: 0 });
  st.n++; if (ok) st.c++; st.last = dayNum(); st.ok = ok;
  const keys = [kind + "." + item.lvl + "." + item.part, "topic." + item.topic];
  if (item.traps) item.traps.forEach(t => keys.push("trap." + t));
  record(keys, ok);
  if (!ok) addMistake({ t: kind, id: item.id });
}
function addMistake(m) { S.mistakes = S.mistakes.filter(x => !(x.t === m.t && x.id === m.id)); S.mistakes.unshift({ ...m, d: dayNum() }); S.mistakes = S.mistakes.slice(0, 60); }
function clearMistake(t, id) { S.mistakes = S.mistakes.filter(x => !(x.t === t && x.id === id)); }

const lvlWords = (lvl = S.level) => Object.values(WORDS).filter(w => w.lvl === lvl);
const dueWords = (lvl = S.level) => lvlWords(lvl).filter(w => { const s = S.words[w.id]; return s && s.d <= dayNum(); }).sort((a, b) => S.words[a.id].d - S.words[b.id].d);
const newWords = (topic) => TOPICS[topic].words.filter(w => !S.words[w.id]);
function topicMastery(tid) {
  const ws = TOPICS[tid].words; let sum = 0;
  for (const w of ws) { const s = S.words[w.id]; if (s) sum += Math.min(1, s.b / 4); }
  return sum / ws.length;
}
function vocabMastery(lvl = S.level) { const ts = topicsFor(lvl); return ts.reduce((a, t) => a + topicMastery(t.id) * t.words.length, 0) / ts.reduce((a, t) => a + t.words.length, 0); }

const allHoeren = () => HOEREN.concat(S.gen || []);
function partsOf(mod, lvl = S.level) { return Object.keys(PART_INFO[lvl][mod]).map(Number); }
function modulePart(mod, part, lvl = S.level) { return skillVal(mod + "." + lvl + "." + part); }
function moduleScore(mod, lvl = S.level) {
  // blend of the parts; unseen parts count as 0.45 (unknown = risky)
  const ps = partsOf(mod, lvl); let sum = 0, n = 0;
  for (const p of ps) { const k = mod + "." + lvl + "." + p; const s = S.skills[k]; const v = s ? (s.n < 3 ? (s.e + 0.45) / 2 : s.e) : 0.45; sum += v; n += s ? s.n : 0; }
  let v = sum / ps.length;
  if (mod === "hoeren") { const dk = Object.keys(DRILL_INFO).map(t => skillVal("drill." + t)).filter(x => x !== null); if (dk.length) v = v * 0.8 + (dk.reduce((a, b) => a + b, 0) / dk.length) * 0.2; }
  return { v, n };
}
function estimate(lvl = S.level) {
  const mods = ["hoeren", "lesen", "schreiben", "sprechen"].map(m => ({ m, ...moduleScore(m, lvl) }));
  const total = Math.round(mods.reduce((a, x) => a + x.v * 25, 0));
  const answered = mods.reduce((a, x) => a + x.n, 0);
  return { mods, total, answered };
}
function weaknesses(limit = 5) {
  const out = [];
  const lvl = S.level;
  for (const mod of ["hoeren", "lesen", "schreiben", "sprechen"]) for (const p of partsOf(mod, lvl)) {
    const k = mod + "." + lvl + "." + p, s = S.skills[k]; if (s && s.n >= 2) out.push({ k, v: s.e, n: s.n, label: MOD_NAME[mod] + " Teil " + p, sub: PART_INFO[lvl][mod][p], go: { mod, part: p } });
  }
  for (const t in TRAP_INFO) { const s = S.skills["trap." + t]; if (s && s.n >= 3) out.push({ k: "trap." + t, v: s.e, n: s.n, label: "Hör-Falle: " + TRAP_INFO[t][0], sub: TRAP_INFO[t][1], go: { trap: t } }); }
  for (const t in DRILL_INFO) { const s = S.skills["drill." + t]; if (s && s.n >= 4) out.push({ k: "drill." + t, v: s.e, n: s.n, label: "Hörtraining: " + DRILL_INFO[t][0], sub: DRILL_INFO[t][1], go: { drill: t } }); }
  for (const t of topicsFor(lvl)) { const s = S.skills["topic." + t.id]; if (s && s.n >= 4) out.push({ k: "topic." + t.id, v: s.e, n: s.n, label: "Thema: " + t.de, sub: t.en, go: { topic: t.id } }); }
  const a = S.skills["vocab.article"]; if (a && a.n >= 5) out.push({ k: "vocab.article", v: a.e, n: a.n, label: "Artikel (der/die/das)", sub: "noun genders", go: { article: true } });
  return out.filter(x => x.v < 0.8).sort((x, y) => x.v - y.v).slice(0, limit);
}
const MOD_NAME = { hoeren: "Hören", lesen: "Lesen", schreiben: "Schreiben", sprechen: "Sprechen" };

function daysLeft() { return dayNum(S.exam[S.level]) - dayNum(); }
function phase() {
  const d = daysLeft();
  if (d < 0) return { key: "after", label: "Prüfung vorbei", sub: "Time to move on to the next level." };
  if (d <= 2) return { key: "final", label: "Letzte Tage", sub: "Light review: your mistakes, due words, one short Hören set. Sleep well." };
  if (d <= 7) return { key: "mock", label: "Prüfungstraining", sub: "Exam-mode practice and a mock test every other day." };
  return { key: "build", label: "Aufbau", sub: "Build vocabulary and fix your weakest exam parts." };
}

// ---------- choosing items ----------
function itemScore(kind, it) {
  // lower = more useful now: previously wrong first, then unseen, then least recently seen
  let best = 99;
  const qs = it.qs || [0];
  qs.forEach((q, i) => {
    const st = S.items[kind + ":" + it.id + (qs.length > 1 ? "#" + i : "")];
    const sc = !st ? 1 : (st.ok === false ? 0 : 2 + Math.min(20, dayNum() - (st.last || 0)) * -0.05 + st.c * 0.3);
    best = Math.min(best, sc);
  });
  return best + Math.random() * 0.4;
}
function chooseItems(pool, kind, n, filter = () => true) {
  return pool.filter(filter).map(it => ({ it, s: itemScore(kind, it) })).sort((a, b) => a.s - b.s).slice(0, n).map(x => x.it);
}
function weakestPart(mod, lvl = S.level) {
  const ps = partsOf(mod, lvl).filter(p => (mod === "hoeren" ? allHoeren() : mod === "lesen" ? LESEN : SCHREIBEN).some(x => x.lvl === lvl && x.part === p) || mod === "sprechen");
  return ps.map(p => ({ p, v: modulePart(mod, p, lvl) ?? 0.45 - Math.random() * 0.1 })).sort((a, b) => a.v - b.v)[0]?.p;
}
function weakestDrills(n = 2) {
  const lvlTypes = Object.keys(DRILL_INFO);
  return lvlTypes.map(t => ({ t, v: (skillVal("drill." + t) ?? 0.4) + Math.random() * 0.12 })).sort((a, b) => a.v - b.v).slice(0, n).map(x => x.t);
}
function weakestTopicWithNew(lvl = S.level) {
  const ts = topicsFor(lvl).filter(t => newWords(t.id).length);
  if (!ts.length) return null;
  // prefer topics you are weak at but have started; otherwise the least covered
  return ts.map(t => ({ t, v: (skillVal("topic." + t.id) ?? 0.55) * 0.6 + topicMastery(t.id) * 0.4 + Math.random() * 0.08 })).sort((a, b) => a.v - b.v)[0].t.id;
}

// ---------- building tasks ----------
function vocabTask(w, forceMode) {
  const st = S.words[w.id]; const b = st ? st.b : 0;
  const mode = forceMode || (b <= 1 ? "recognize" : b === 2 ? "listen" : b === 3 ? "choose" : "recall");
  return { kind: "vocab", wid: w.id, mode };
}
function learnTask(w) { return { kind: "learn", wid: w.id }; }
function distractorWords(w, n) {
  const same = TOPICS[w.topic].words.filter(x => x.id !== w.id && !!x.art === !!w.art && x.en !== w.en);
  const pool = same.length >= n ? same : lvlWords(w.lvl).filter(x => x.id !== w.id && x.en !== w.en);
  return shuffle(pool).slice(0, n);
}

// Fixed day-by-day countdown for the last 9 days before the A1 exam (keyed by days left).
// Each day has a focus; the words, drills and extra listening inside it still follow your weak spots.
const COUNTDOWN = {
  9: { t: "Zahlen & Namen", en: "Numbers, spelling, introducing yourself", topics: ["person", "zeit"], hp: 1, lp: 3, prod: ["sprechen", 1], drills: ["num", "spell"] },
  8: { t: "Uhrzeiten · Hören Teil 1", en: "Times and short dialogues", topics: ["zeit", "einkaufen"], hp: 1, lp: 3, prod: ["schreiben", 1], drills: ["time", "clock"] },
  7: { t: "Durchsagen · Hören Teil 2", en: "Announcements (played once)", topics: ["verkehr", "stadt"], hp: 2, lp: 2, prod: ["sprechen", 2], drills: ["clock", "num"] },
  6: { t: "Telefonansagen · Hören Teil 3", en: "Phone messages, prices, dates", topics: ["essen", "wohnen"], hp: 3, lp: 1, prod: ["schreiben", 2], drills: ["price", "date"] },
  5: { mock: true, t: "Modelltest 1", en: "Mock test: Hören + Lesen under exam rules" },
  4: { t: "Schwächen reparieren", en: "Fix what the mock test showed", topics: "weak", hp: "weak", lp: "weak", prod: ["sprechen", 3], drills: "weak" },
  3: { t: "Schreiben & Sprechen", en: "Writing a message, question cards", topics: ["arbeit", "freizeit"], hp: "weak", lp: "weak", prod: ["schreiben", 2], prod2: ["sprechen", 2], drills: "weak" },
  2: { mock: true, t: "Modelltest 2", en: "Second mock test, then your mistakes" },
  1: { light: true, t: "Leicht wiederholen", en: "Light review, then rest" },
  0: { light: true, examDay: true, t: "Prüfungstag", en: "15-minute warm-up. Viel Erfolg!" }
};
function countdownDay(dl = daysLeft()) { return S.level === "A1" && dl >= 0 && dl <= 9 ? COUNTDOWN[dl] : null; }

function buildDaily(opts = {}) {
  const lvl = S.level, tasks = [], short = !!opts.short;
  const answered = Object.values(S.days).reduce((a, d) => a + d.q, 0);
  const cd = countdownDay();
  if (answered < 10 && !(cd && (cd.mock || cd.light))) {
    // first run: a broad check so the plan can find your level
    const ts = shuffle(topicsFor(lvl)).slice(0, 8);
    ts.forEach(t => tasks.push(vocabTask(pick(t.words), "recognize")));
    ["num", "time", "price", "spell"].forEach(t => tasks.push(makeDrill(t)));
    partsOf("hoeren", lvl).forEach(p => chooseItems(allHoeren(), "hoeren", 1, x => x.lvl === lvl && x.part === p).forEach(it => tasks.push({ kind: "hoeren", id: it.id })));
    chooseItems(LESEN, "lesen", 1, x => x.lvl === lvl && x.part === (lvl === "A1" ? 3 : 2)).forEach(it => tasks.push({ kind: "lesen", id: it.id }));
    return { title: "Einstufung", en: "5-minute level check", check: true, tasks, mins: 7, blocks: [
      { ico: "words", t: "8 words from 8 themes", why: "Finds which themes you already know." },
      { ico: "ear", t: "4 number & time drills", why: "Numbers and times cost the most points in A1 Hören." },
      { ico: "ear", t: partsOf("hoeren", lvl).length + " listening questions, one per part", why: "A starting score for each part." },
      { ico: "doc", t: "1 reading task", why: "A starting score for Lesen." }] };
  }
  if (cd && cd.mock && !short) {
    const m = buildMock();
    return { title: cd.t, en: cd.en, tasks: m.tasks, mock: true, mins: 40, blocks: [
      { ico: "ear", t: "Hören: 15 questions in 3 parts", why: "Exam speed. Teil 2 plays once, Teil 1 and 3 twice." },
      { ico: "doc", t: "Lesen: 3 parts", why: "No feedback until the end, like the real exam." },
      { ico: "chart", t: "Then: your mistakes", why: "Afterwards tap “Fehler wiederholen” on the home screen." }] };
  }
  const blocks = [];
  const addDrills = (types, n, exam) => { for (let i = 0; i < n; i++) tasks.push({ ...makeDrill(types[i % types.length]), exam }); };
  if (cd && cd.light) {
    const due = dueWords(lvl).slice(0, cd.examDay ? 0 : (short ? 8 : 20));
    due.forEach(w => tasks.push(vocabTask(w)));
    if (due.length) blocks.push({ ico: "words", t: due.length + " words due for review", why: "Keep them fresh. No new words now." });
    if (!cd.examDay) {
      const ms = S.mistakes.filter(m => m.t !== "w").slice(0, short ? 2 : 5);
      ms.forEach(m => { if (m.t === "hoeren" && hItem(m.id)) tasks.push({ kind: "hoeren", id: m.id }); if (m.t === "lesen" && lItem(m.id)) tasks.push({ kind: "lesen", id: m.id }); });
      if (ms.length) blocks.push({ ico: "ear", t: ms.length + " questions you got wrong before", why: "One more try while it's fresh." });
    }
    addDrills(weakestDrills(2), 5, true);
    blocks.push({ ico: "ear", t: "5 number & time drills at exam speed", why: "Warm up your ears." });
    tasks.push({ kind: "sprechen", part: 1 });
    blocks.push({ ico: "mic", t: "Introduce yourself out loud", why: "The first thing you'll do in Sprechen." });
    return { title: cd.t, en: cd.en, tasks, blocks, mins: Math.max(8, Math.round(tasks.length * 0.6)) };
  }
  const ph = phase();
  const due = dueWords(lvl).slice(0, short ? 8 : 15);
  due.forEach(w => tasks.push(vocabTask(w)));
  if (due.length) blocks.push({ ico: "words", t: due.length + " words due for review", why: "Spaced repetition: they're about to slip." });
  const nNew = short ? 4 : cd ? (cd.topics === "weak" ? 6 : 10) : ph.key === "mock" ? 4 : 7;
  let tid = null;
  if (cd && Array.isArray(cd.topics)) tid = cd.topics.find(t => newWords(t).length);
  if (!tid) tid = weakestTopicWithNew(lvl);
  if (tid) {
    const nw = shuffle(newWords(tid)).slice(0, nNew);
    nw.forEach(w => tasks.push(learnTask(w)));
    nw.forEach(w => tasks.push(vocabTask(w, "recognize")));
    const sv = skillVal("topic." + tid);
    blocks.push({ ico: "plus", t: nw.length + " new words · " + TOPICS[tid].de, why: cd && Array.isArray(cd.topics) ? "Today's theme: " + TOPICS[tid].en.toLowerCase() + "." : sv !== null ? "Your accuracy in this theme: " + pct(sv) + "%." : "A theme you haven't covered yet." });
  }
  const dts = cd && Array.isArray(cd.drills) ? cd.drills : weakestDrills(2);
  addDrills(dts, short ? 3 : 5, ph.key !== "build");
  blocks.push({ ico: "ear", t: (short ? 3 : 5) + " drills · " + dts.map(t => DRILL_INFO[t][0]).join(" + "), why: dts.map(t => { const v = skillVal("drill." + t); return v === null ? DRILL_INFO[t][0] + ": new" : DRILL_INFO[t][0] + ": " + pct(v) + "%"; }).join(" · ") });
  const hp = cd && cd.hp !== "weak" ? cd.hp : weakestPart("hoeren", lvl);
  const hItems = chooseItems(allHoeren(), "hoeren", short ? 2 : 3, x => x.lvl === lvl && x.part === hp);
  const other = short ? [] : chooseItems(allHoeren(), "hoeren", 1, x => x.lvl === lvl && x.part !== hp);
  hItems.concat(other).forEach(it => tasks.push({ kind: "hoeren", id: it.id, exam: ph.key !== "build" }));
  const hv = modulePart("hoeren", hp, lvl);
  blocks.push({ ico: "ear", t: (hItems.length + other.length) + " Hören questions · Teil " + hp, why: PART_INFO[lvl].hoeren[hp] + (hv !== null ? ". You're at " + pct(hv) + "%." : ".") });
  if (!short) {
    const lp = cd && cd.lp !== "weak" ? cd.lp : weakestPart("lesen", lvl);
    chooseItems(LESEN, "lesen", 1, x => x.lvl === lvl && x.part === lp).forEach(it => tasks.push({ kind: "lesen", id: it.id }));
    blocks.push({ ico: "doc", t: "1 Lesen task · Teil " + lp, why: PART_INFO[lvl].lesen[lp] + "." });
    const prods = cd ? [cd.prod, cd.prod2].filter(Boolean) : [dayNum() % 2 === 0 ? ["sprechen", weakestPart("sprechen", lvl)] : ["schreiben", weakestPart("schreiben", lvl)]];
    for (const [mod, part] of prods) {
      if (mod === "sprechen") { tasks.push({ kind: "sprechen", part }); blocks.push({ ico: "mic", t: "Sprechen Teil " + part, why: PART_INFO[lvl].sprechen[part] + ". Say it out loud, then type or dictate it." }); }
      else { const it = chooseItems(SCHREIBEN, "schreiben", 1, x => x.lvl === lvl && x.part === part)[0]; if (it) { tasks.push({ kind: "schreiben", id: it.id }); blocks.push({ ico: "pen", t: "Schreiben Teil " + part, why: PART_INFO[lvl].schreiben[part] + "." }); } }
    }
  }
  const mins = Math.round(tasks.reduce((a, t) => a + ({ vocab: .35, learn: .25, drill: .3, hoeren: 1.3, lesen: 2, sprechen: 4, schreiben: 6 }[t.kind] || 1), 0));
  return { title: cd ? cd.t : "Heute", en: cd ? cd.en : "Today's plan", tasks, blocks, mins };
}

function buildMock() {
  const lvl = S.level, tasks = [];
  const plan = lvl === "A1" ? [[1, 6], [2, 4], [3, 5]] : [[1, 4], [3, 3], [4, 1]];
  for (const [p, n] of plan) chooseItems(allHoeren(), "hoeren", n, x => x.lvl === lvl && x.part === p).forEach(it => tasks.push({ kind: "hoeren", id: it.id, exam: true, mock: true }));
  const lplan = lvl === "A1" ? [[1, 2], [2, 5], [3, 5]] : [[2, 1], [3, 1]];
  for (const [p, n] of lplan) chooseItems(LESEN, "lesen", n, x => x.lvl === lvl && x.part === p).forEach(it => tasks.push({ kind: "lesen", id: it.id, mock: true }));
  return { title: "Modelltest", tasks, mock: true };
}
