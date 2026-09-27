// ================= Screens, practice builders, events, boot =================
const UI = { tab: "heute", resetAsk: false, genBusy: false, voiceNote: false };
const EXAM_NAME = { A1: "Goethe-Zertifikat A1 · Start Deutsch 1", A2: "Goethe-Zertifikat A2" };
const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" });
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
const meterCls = v => v === null ? "" : v >= 0.75 ? "good" : v >= 0.55 ? "warn" : "bad";
const mrow = (label, v, valText, sub) => `<div class="mrow"><div><div class="lbl">${esc(label)}</div>${sub ? `<div class="tiny">${esc(sub)}</div>` : ""}</div><div class="meter ${meterCls(v)}"><b style="width:${v === null ? 0 : Math.max(3, pct(v))}%"></b></div><div class="val">${valText ?? (v === null ? "–" : pct(v) + "%")}</div></div>`;

// ---------- practice builders ----------
const P = {
  part(mod, part) {
    const lvl = S.level;
    if (mod === "hoeren") return { title: "Hören Teil " + part, tasks: chooseItems(allHoeren(), "hoeren", 5, x => x.lvl === lvl && x.part === part).map(it => ({ kind: "hoeren", id: it.id })) };
    if (mod === "lesen") return { title: "Lesen Teil " + part, tasks: chooseItems(LESEN, "lesen", 3, x => x.lvl === lvl && x.part === part).map(it => ({ kind: "lesen", id: it.id })) };
    if (mod === "schreiben") return { title: "Schreiben Teil " + part, tasks: chooseItems(SCHREIBEN, "schreiben", 1, x => x.lvl === lvl && x.part === part).map(it => ({ kind: "schreiben", id: it.id })) };
    return { title: "Sprechen Teil " + part, tasks: [{ kind: "sprechen", part }] };
  },
  drill(type, n = 10) { return { title: "Hörtraining", tasks: Array.from({ length: n }, (_, i) => makeDrill(type || weakestDrills(3)[i % 3])) }; },
  topic(tid) {
    const nw = shuffle(newWords(tid)).slice(0, 8);
    const seen = shuffle(TOPICS[tid].words.filter(w => S.words[w.id])).slice(0, 10);
    return { title: TOPICS[tid].de, tasks: [...nw.map(learnTask), ...shuffle([...nw.map(w => vocabTask(w, "recognize")), ...seen.map(w => vocabTask(w))])] };
  },
  due() { return { title: "Wiederholung", tasks: dueWords().slice(0, 25).map(w => vocabTask(w)) }; },
  articles() {
    const nouns = lvlWords().filter(w => w.art);
    const seen = nouns.filter(w => S.words[w.id]);
    const pool = seen.length >= 15 ? seen : nouns;
    return { title: "Artikel", tasks: shuffle(pool).slice(0, 15).map(w => ({ kind: "article", wid: w.id })) };
  },
  listenWords() {
    const seen = lvlWords().filter(w => S.words[w.id]);
    const pool = seen.length >= 10 ? seen : lvlWords();
    return { title: "Hör-Vokabeln", tasks: shuffle(pool).slice(0, 15).map(w => vocabTask(w, "listen")) };
  },
  trap(t) { return { title: "Hör-Fallen", tasks: chooseItems(allHoeren(), "hoeren", 6, x => x.lvl === S.level && (x.traps || []).includes(t)).map(it => ({ kind: "hoeren", id: it.id })) }; },
  mistakes() {
    const tasks = [];
    for (const m of S.mistakes.slice(0, 18)) {
      if (m.t === "w" && WORDS[m.id]) tasks.push(vocabTask(WORDS[m.id], S.words[m.id]?.b >= 3 ? "recall" : "choose"));
      if (m.t === "hoeren" && hItem(m.id)) tasks.push({ kind: "hoeren", id: m.id });
      if (m.t === "lesen" && lItem(m.id)) tasks.push({ kind: "lesen", id: m.id });
    }
    return { title: "Fehler", tasks };
  }
};
function goWeak(g) {
  if (g.mod) return startSession(P.part(g.mod, g.part));
  if (g.trap) return startSession(P.trap(g.trap));
  if (g.drill) return startSession(P.drill(g.drill));
  if (g.topic) return startSession(P.topic(g.topic));
  if (g.article) return startSession(P.articles());
}

// ---------- Claude-made listening items ----------
async function genHoeren() {
  if (!SAMPLE || UI.genBusy) return;
  const lvl = S.level, part = weakestPart("hoeren", lvl);
  const traps = Object.keys(TRAP_INFO).map(t => ({ t, v: (skillVal("trap." + t) ?? 0.5) + Math.random() * 0.15 })).sort((a, b) => a.v - b.v).slice(0, 2).map(x => x.t);
  const topics = topicsFor(lvl).map(t => ({ t, v: (skillVal("topic." + t.id) ?? 0.55) + Math.random() * 0.2 })).sort((a, b) => a.v - b.v).slice(0, 2).map(x => x.t);
  const fmt = { A1: { 1: "a short everyday dialogue between two people (A and B), 3–5 lines; one question with 3 options a/b/c", 2: "one public announcement (speaker N: station, airport, shop, radio), 2–3 sentences; one statement with options [\"Richtig\",\"Falsch\"]", 3: "one phone/voicemail message (speaker A), 3–5 sentences; one question with 3 options" },
    A2: { 1: "a radio or public announcement (speaker N), 3–4 sentences; one question with 3 options", 3: "a short everyday dialogue (A and B), 4–6 lines; one question with 3 options", 4: "a radio interview (A interviewer, B guest), 6–8 lines; five statements with options [\"Ja\",\"Nein\"]" } }[lvl][part];
  UI.genBusy = true; render();
  try {
    const res = await SAMPLE.json(`Write 3 NEW original listening exercises for the Goethe-Zertifikat ${lvl} exam, Hören Teil ${part}. Format of each: ${fmt}.
Target these weak spots of the learner: listening traps ${traps.map(t => TRAP_INFO[t][0] + " (" + TRAP_INFO[t][1] + ")").join(", ")}; themes ${topics.map(t => t.de).join(", ")}.
Use only ${lvl} vocabulary and grammar. Write every number, price, time and date as German WORDS in the script (e.g. "zwei Euro vierzig", "halb sieben") because it will be read by text-to-speech. Distractor options must be things actually mentioned in the text, as in the real exam.
Reply with only a JSON array of 3 objects: {"s": [["A","German line"],["B","German line"]], "qs": [{"q": "German question or statement", "en": "English translation of q", "o": ["option", "option", "option"], "oen": ["English translation of each option"], "a": <index of correct option>}], "key": "<exact short phrase from the script that gives the answer>", "ex": "<one-sentence English explanation of the trap>", "trap": "<one of: ${Object.keys(TRAP_INFO).join(", ")}>"}`, { modelTier: "default", cache: false });
    const arr = (Array.isArray(res) ? res : [res]).filter(x => x && Array.isArray(x.s) && Array.isArray(x.qs) && x.qs.every(q => Array.isArray(q.o) && Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length));
    if (!arr.length) throw { code: "invalid_json" };
    const made = arr.map((x, i) => ({ id: "gen-" + Date.now() + "-" + i, lvl, part, gen: true, topic: topics[0].id, traps: TRAP_INFO[x.trap] ? [x.trap] : traps.slice(0, 1),
      s: x.s.filter(l => Array.isArray(l) && l[1]).map(([sp, tx]) => [["A", "B", "N"].includes(sp) ? sp : "A", String(tx)]), qs: x.qs.map(q => ({ q: String(q.q), en: q.en ? String(q.en) : "", oen: Array.isArray(q.oen) && q.oen.length === q.o.length ? q.oen.map(String) : null, o: q.o.map(String), a: q.a })), key: String(x.key || ""), ex: String(x.ex || "") }));
    S.gen = [...made, ...(S.gen || [])].slice(0, 30); Store.save();
    UI.genBusy = false;
    startSession({ title: "Claude-Übung", tasks: made.map(it => ({ kind: "hoeren", id: it.id })) });
  } catch (e) {
    UI.genBusy = false;
    if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled"].includes(e.code)) SAMPLE = null;
    else toast(e?.code === "rate_limited" ? "Claude is busy. Try again in a minute." : "That didn't work. Try again.");
    render();
  }
}

// ---------- screens ----------
function topbar() {
  return `<div class="topbar"><div class="wordmark"><span class="dot"></span>Startklar</div>
    <div class="row" style="gap:8px"><span class="sync ${Store.status === "cloud" ? "ok" : ""}" title="${Store.status === "cloud" ? "Saved to your Claude account" : "Saved in this browser"}"><i></i>${Store.status === "cloud" ? "Sync" : "Lokal"}</span><button class="pill" data-act="tab" data-t="analyse">${S.level}</button></div></div>`;
}
function voiceNotice() {
  if (!TTS.ok) return `<div class="notice"><b>No audio here.</b> This browser can't read German aloud. Open the page in Safari on your iPhone for the listening practice.</div>`;
  if (UI.voiceNote && !TTS.hasGerman()) return `<div class="notice"><b>No German voice found.</b> On iPhone: Settings → Accessibility → Spoken Content → Voices → German, then download “Anna” or “Helena (Enhanced)”. <button class="linkbtn" data-act="test-voice">Test sound</button></div>`;
  return "";
}
function hd(de, en, right = "") { return `<div class="section-head"><div><h2>${de}</h2>${en ? `<div class="h-en">${esc(en)}</div>` : ""}</div>${right}</div>`; }
function countdownStrip() {
  const dl = daysLeft(); if (S.level !== "A1" || dl < 0 || dl > 9) return "";
  const cells = [];
  for (let k = 9; k >= 0; k--) {
    const date = addDays(S.exam.A1, -k), c = COUNTDOWN[k], dt = new Date(date + "T12:00:00");
    const done = S.doneDays?.[date];
    cells.push(`<div class="cd ${k === dl ? "today" : ""} ${k > dl ? "past" : ""} ${done ? "done" : ""}">
      <div class="cd-date">${dt.toLocaleDateString("de-DE", { weekday: "short" })} ${dt.getDate()}.${dt.getMonth() + 1}.</div>
      <div class="cd-mark">${done ? "✓" : k === 0 ? "Prüfung" : "Tag " + (10 - k)}</div>
      <div class="cd-t">${esc(c.t)}</div><div class="cd-en">${esc(c.en)}</div></div>`);
  }
  return `<div class="section">${hd("Dein Countdown", "Your plan until " + fmtDate(S.exam.A1) + " · swipe")}<div class="cd-strip" id="cdstrip">${cells.join("")}</div></div>`;
}
function examTips() {
  return `<div class="card stack-s"><div class="eyebrow">Am Prüfungstag · on exam day</div>
    <div class="checklist">
      ${ck(null, "Bring your passport or ID and your exam confirmation.")}
      ${ck(null, "Hören: read the questions before each recording starts. Teil 2 plays only once.")}
      ${ck(null, "Copy your answers onto the answer sheet (Antwortbogen) before time runs out.")}
      ${ck(null, "Lesen: stuck on a question? Mark a guess, move on, come back later.")}
      ${ck(null, "Sprechen: speak slowly. Didn't understand? „Können Sie das bitte wiederholen?“")}
    </div></div>`;
}
function screenHeute() {
  const d = daysLeft(), est = estimate();
  const plan = buildDailyCached();
  const doneToday = S.dailyDone === TODAY();
  const tday = S.days[TODAY()];
  const streak = (() => { let n = 0, day = TODAY(); if (!S.days[day]) day = addDays(day, -1); while (S.days[day]?.q) { n++; day = addDays(day, -1); } return n; })();
  const weak = weaknesses(3);
  const due = dueWords().length;
  const after = d < 0;
  const cd = countdownDay();
  return `${topbar()}
  <div class="card ink stack">
    <div class="eyebrow">${esc(EXAM_NAME[S.level])}</div>
    <div class="hero">
      <div class="days num">${after ? "✓" : d}<small>${after ? "Prüfung vorbei" : d === 0 ? "Heute ist Prüfung!" : d === 1 ? "Tag bis zur Prüfung" : "Tage bis zur Prüfung"}</small></div>
      <div class="stack-s">
        <div class="small">${esc(fmtDate(S.exam[S.level]))}</div>
        ${est.answered >= 10 ? `<div><div class="row between small"><span>Geschätzt</span><b class="num" style="font-size:20px">${est.total}<span style="font-size:13px;opacity:.8"> / 100</span></b></div><div class="scoreline"><b style="width:${est.total}%"></b><span class="pass" style="left:60%"></span></div></div><div class="tiny">Estimated score · pass mark 60</div>` : `<div class="tiny">Your score estimate appears after the first session.</div>`}
      </div>
    </div>
    <div class="today-box">
      <div class="eyebrow">${doneToday ? "Heute erledigt ✓" : cd ? "Heute · Tag " + (10 - d) + " von 10" : "Heute"}</div>
      <div class="today-t">${esc(plan.title)}</div>
      <div class="small" style="opacity:.85">${esc(plan.en || "")}${plan.mins ? " · about " + plan.mins + " min" : ""}</div>
    </div>
    <button class="btn ink-on block" data-act="start-daily">${ic("play", 16)} ${doneToday ? "Do another round" : plan.check ? "Start the level check" : plan.mock ? "Start the mock test" : "Start today's session"}</button>
    ${plan.check || plan.mock ? "" : `<button class="linkbtn on-ink" data-act="start-short">Only 10 minutes? Start the short version</button>`}
  </div>
  ${voiceNotice()}
  ${d >= 0 && d <= 1 && S.level === "A1" ? examTips() : ""}
  ${after && S.level === "A1" ? `<div class="card stack-s"><h3>How did the A1 exam go?</h3><div class="small muted">Switch to A2. Your A1 words stay in your reviews.</div><button class="btn primary" data-act="set-level" data-v="A2">Start A2 preparation</button></div>` : ""}
  ${countdownStrip()}
  <div class="section">
    ${hd(doneToday ? "Heute erledigt" : "Was heute drin ist", doneToday ? "Done for today" : "What's in today's session, and why")}
    <div class="card">
      ${doneToday && tday ? `<div class="hand green" style="margin-bottom:6px">${tday.q} answers today, ${pct(tday.c / tday.q)}% correct. Another round is optional.</div>` : ""}
      <div class="plan">${plan.blocks.map(b => `<div class="plan-row"><div class="plan-ico">${ic(b.ico, 16)}</div><div><div style="font-weight:600">${esc(b.t)}</div><div class="why">${esc(b.why)}</div></div><div></div></div>`).join("")}</div>
    </div>
  </div>
  <div class="section">
    ${hd("Schnell üben", "Quick practice", streak ? `<span class="chip blue">${ic("flame", 14)} ${streak} ${streak === 1 ? "Tag" : "Tage"}</span>` : "")}
    <div class="grid2">
      <button class="tile" data-act="p-due"><span class="eyebrow">Wörter · words</span><span class="t-title">Wiederholen</span><span class="tiny num">${due} due for review</span></button>
      <button class="tile" data-act="p-drill"><span class="eyebrow">Hören · 3 min</span><span class="t-title">Zahlen & Uhrzeiten</span><span class="tiny">Numbers and times</span></button>
      <button class="tile" data-act="p-mistakes" ${S.mistakes.length ? "" : "disabled"}><span class="eyebrow">Fehler · mistakes</span><span class="t-title">Fehler wiederholen</span><span class="tiny num">${S.mistakes.length ? S.mistakes.length + " to redo" : "None yet"}</span></button>
      <button class="tile ${cd && cd.mock ? "accent" : ""}" data-act="p-mock"><span class="eyebrow">Prüfung · exam</span><span class="t-title">Modelltest</span><span class="tiny">Mock test: Hören + Lesen</span></button>
    </div>
  </div>
  ${weak.length ? `<div class="section">${hd("Schwachstellen", "Your weak spots", `<button class="linkbtn" data-act="tab" data-t="analyse">See all</button>`)}<div class="card">${weak.map((w, i) => `<div class="weak"><div><div style="font-weight:600">${esc(w.label)}</div><div class="tiny">${esc(w.sub)} · ${w.n} answers</div></div><div class="row"><span class="pct num">${pct(w.v)}%</span><button class="btn small" data-act="weak" data-i="${i}">Practise</button></div></div>`).join("")}</div></div>` : ""}`;
}
let _daily = null, _dailyKey = "";
function buildDailyCached() { const key = TODAY() + S.level + (S.dailyDone || "") + Object.keys(S.words).length + (Object.values(S.days).reduce((a, d) => a + d.q, 0) >= 10); if (key !== _dailyKey || !_daily) { _daily = buildDaily(); _dailyKey = key; } return _daily; }

function screenWoerter() {
  const ts = topicsFor(S.level), all = lvlWords();
  const known = all.filter(w => (S.words[w.id]?.b || 0) >= 3).length, learning = all.filter(w => S.words[w.id] && S.words[w.id].b < 3).length;
  const art = skillVal("vocab.article"), lis = skillVal("vocab.listen");
  return `${topbar()}<h1>Wortschatz ${S.level}</h1><div class="h-en">Vocabulary · tap a theme to learn its words</div>
  <div class="card stack-s" style="margin-top:14px">
    <div class="row between"><span class="small muted">Sicher gelernt</span><b class="num">${known} / ${all.length}</b></div>
    <div class="meter good"><b style="width:${known / all.length * 100}%"></b></div>
    <div class="row between tiny"><span>${learning} im Lernen · ${all.length - known - learning} neu</span><span>Artikel ${art === null ? "–" : pct(art) + "%"} · Hören ${lis === null ? "–" : pct(lis) + "%"}</span></div>
  </div>
  <div class="grid2" style="margin-top:12px">
    <button class="tile" data-act="p-due"><span class="t-title">Fällig</span><span class="tiny num">${dueWords().length} Wörter</span></button>
    <button class="tile" data-act="p-listenwords"><span class="t-title">Hör-Vokabeln</span><span class="tiny">Audio only, pick the meaning</span></button>
    <button class="tile" data-act="p-articles"><span class="t-title">der · die · das</span><span class="tiny">Article drill</span></button>
    <button class="tile" data-act="level-toggle"><span class="t-title">${S.level === "A1" ? "A2-Wörter" : "A1-Wörter"}</span><span class="tiny">Switch level in Analyse</span></button>
  </div>
  <div class="section">${hd("Themen", "Themes from the Goethe word list")}
  <div class="stack-s">${ts.map(t => { const m = topicMastery(t.id), sv = skillVal("topic." + t.id), nw = newWords(t.id).length; return `<button class="list-btn" data-act="p-topic" data-t="${t.id}"><div class="stack-s" style="gap:5px"><div class="row between"><b>${esc(t.de)}</b><span class="tiny num">${t.words.length - nw}/${t.words.length}${sv !== null ? " · " + pct(sv) + "%" : ""}</span></div><div class="meter ${meterCls(sv)}"><b style="width:${Math.max(2, m * 100)}%"></b></div><div class="sub">${esc(t.en)}${nw ? " · " + nw + " new" : ""}</div></div><span class="chev">${ic("chev", 18)}</span></button>`; }).join("")}</div></div>`;
}

function screenHoeren() {
  const lvl = S.level, parts = partsOf("hoeren", lvl);
  return `${topbar()}<h1>Hören</h1><div class="h-en">Listening</div><p class="muted small">${lvl === "A1" ? "About 20 minutes, 15 questions in 3 parts. Teil 2 is played only once." : "About 30 minutes, 20 questions in 4 parts."} Read the questions before the audio starts.</p>
  ${voiceNotice()}
  <div class="card" style="margin-top:6px">${speedSeg()}<div class="tiny" style="margin-top:6px">Practice slowly, then switch to “Prüfung” speed in the last week.</div></div>
  <div class="section">${hd("Prüfungsteile", "Exam parts: practise one")}<div class="stack-s">
  ${parts.map(p => { const v = modulePart("hoeren", p), n = skillN("hoeren." + lvl + "." + p), cnt = allHoeren().filter(x => x.lvl === lvl && x.part === p).length; return `<button class="list-btn" data-act="p-part" data-m="hoeren" data-p="${p}"><div class="stack-s" style="gap:5px"><div class="row between"><b>Teil ${p}</b><span class="tiny num">${v === null ? "neu" : pct(v) + "% · " + n}</span></div><div class="meter ${meterCls(v)}"><b style="width:${v === null ? 0 : pct(v)}%"></b></div><div class="sub">${esc(PART_INFO[lvl].hoeren[p])} · ${cnt} Aufgaben</div></div><span class="chev">${ic("chev", 18)}</span></button>`; }).join("")}
  </div></div>
  <div class="section">${hd("Hörtraining", "Number & time drills, unlimited")}
  <div class="grid2">${Object.entries(DRILL_INFO).map(([k, [de, en]]) => { const v = skillVal("drill." + k); return `<button class="tile" data-act="p-drilltype" data-t="${k}"><span class="t-title">${esc(de)}</span><span class="tiny">${esc(en)}</span><div class="meter ${meterCls(v)}" style="margin-top:auto"><b style="width:${v === null ? 0 : pct(v)}%"></b></div></button>`; }).join("")}</div></div>
  <div class="section">${hd("Hör-Fallen", "Listening traps: where points get lost")}
  <div class="card">${Object.entries(TRAP_INFO).map(([k, [de, en]]) => { const v = skillVal("trap." + k), n = skillN("trap." + k); return `<div class="mrow"><div><div class="lbl">${esc(de)}</div><div class="tiny">${esc(en)}</div></div><div class="meter ${meterCls(n >= 2 ? v : null)}"><b style="width:${v === null ? 0 : pct(v)}%"></b></div><div class="val">${n ? `<button class="linkbtn" data-act="p-trap" data-t="${k}">${pct(v)}%</button>` : "–"}</div></div>`; }).join("")}</div></div>
  ${SAMPLE ? `<div class="section"><div class="card stack-s"><div class="eyebrow">${ic("spark", 14)} Mit Claude</div><h3>New exercises for your weak spots</h3><div class="small muted">Claude writes 3 fresh Teil ${weakestPart("hoeren", lvl)} recordings aimed at your weakest traps and themes. Uses your Claude usage.</div><button class="btn primary" data-act="gen-hoeren" ${UI.genBusy ? "disabled" : ""}>${UI.genBusy ? "Claude schreibt … (up to a minute)" : "Create 3 exercises"}</button>${(S.gen || []).filter(x => x.lvl === lvl).length ? `<div class="tiny">${S.gen.filter(x => x.lvl === lvl).length} Claude exercises are already mixed into your practice.</div>` : ""}</div></div>` : ""}`;
}

function screenPruefung() {
  const lvl = S.level, pi = PART_INFO[lvl];
  const block = mod => `<div class="section"><div class="section-head"><h2>${MOD_NAME[mod]}</h2><span class="tiny num">${pct(moduleScore(mod).v)}% geschätzt</span></div><div class="stack-s">${Object.keys(pi[mod]).map(Number).map(p => { const v = modulePart(mod, p); return `<button class="list-btn" data-act="p-part" data-m="${mod}" data-p="${p}"><div class="stack-s" style="gap:5px"><div class="row between"><b>Teil ${p}</b><span class="tiny num">${v === null ? "neu" : pct(v) + "%"}</span></div><div class="meter ${meterCls(v)}"><b style="width:${v === null ? 0 : pct(v)}%"></b></div><div class="sub">${esc(pi[mod][p])}</div></div><span class="chev">${ic("chev", 18)}</span></button>`; }).join("")}</div></div>`;
  const mocks = S.mocks.filter(m => m.lvl === lvl);
  return `${topbar()}<h1>Prüfung ${lvl}</h1><div class="h-en">Exam practice: reading, writing, speaking, mock test</div>
  <div class="card stack-s" style="margin-top:14px"><div class="eyebrow">Modelltest</div><h3>Hören + Lesen under exam rules</h3>
    <div class="small muted">Audio plays at exam speed with the real replay limits. No feedback until the end. About ${lvl === "A1" ? "40" : "55"} minutes.</div>
    <button class="btn primary" data-act="p-mock">Start mock test</button>
    ${mocks.length ? `<hr class="rule"><div class="stack-s">${mocks.slice(0, 5).map(m => `<div class="row between small"><span>${esc(fmtDate(m.d))}</span><span class="num">Hören <b>${m.h}</b> · Lesen <b>${m.l}</b> <span class="tiny">/ 25</span></span></div>`).join("")}</div>` : ""}
  </div>
  ${block("lesen")}${block("schreiben")}${block("sprechen")}
  <div class="section"><details class="card more"><summary>How the ${lvl} exam works</summary><div class="small stack-s" style="margin-top:10px">
    ${lvl === "A1" ? `<div><b>Hören</b> · ~20 min · 3 parts, 15 questions</div><div><b>Lesen</b> · ~25 min · 3 parts, 15 questions</div><div><b>Schreiben</b> · ~20 min · fill in a form + write a short message (~30 words)</div><div><b>Sprechen</b> · ~15 min in a small group · introduce yourself, ask & answer with word cards, make requests with picture cards</div>` : `<div><b>Lesen</b> · 30 min · 4 parts</div><div><b>Hören</b> · 30 min · 4 parts</div><div><b>Schreiben</b> · 30 min · a text message and an email</div><div><b>Sprechen</b> · ~15 min with a partner · questions about yourself, talk about your life, plan something together</div>`}
    <div>Each part is worth 25 points. You pass with <b>60 of 100</b>. Check the official Goethe-Institut model test for your exam centre's exact rules.</div></div></details></div>`;
}

function screenAnalyse() {
  const est = estimate(), lvl = S.level;
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY(), i - 13));
  const maxQ = Math.max(10, ...days.map(d => S.days[d]?.q || 0));
  const weak = weaknesses(6);
  const all = lvlWords(); const boxes = [0, 0, 0]; all.forEach(w => { const b = S.words[w.id]?.b; if (b === undefined) boxes[0]++; else if (b < 3) boxes[1]++; else boxes[2]++; });
  return `${topbar()}<h1>Analyse</h1><div class="h-en">Your progress and settings</div>
  <div class="section"><div class="section-head"><div><h2>Geschätztes Ergebnis</h2><div class="h-en">Estimated score</div></div><b class="num" style="font-family:var(--f-display);font-size:22px">${est.total}<span class="tiny"> / 100</span></b></div>
    <div class="card">${est.mods.map(m => mrow(MOD_NAME[m.m], m.v, Math.round(m.v * 25) + "/25", m.n < 5 ? "little data yet" : m.n + " answers")).join("")}
    <div class="tiny" style="margin-top:8px">Recent answers count more than old ones. Parts you haven't practised count as 45% until you try them, so the estimate starts low on purpose. Pass mark: 60.</div></div></div>
  <div class="section">${hd("Schwachstellen", "Weak spots, weakest first")}
    <div class="card">${weak.length ? weak.map((w, i) => `<div class="weak"><div><div style="font-weight:600">${esc(w.label)}</div><div class="tiny">${esc(w.sub)} · ${w.n} answers</div></div><div class="row"><span class="pct num">${pct(w.v)}%</span><button class="btn small" data-act="weak6" data-i="${i}">Üben</button></div></div>`).join("") : `<div class="small muted">Nothing below 80% yet, or not enough answers. Keep practising and this list fills in.</div>`}</div></div>
  <div class="section">${hd("Aktivität", "Answers per day, last 14 days")}
    <div class="card"><div class="bars" role="img" aria-label="Answers per day over the last 14 days">${days.map(d => { const x = S.days[d]; const q = x?.q || 0; return `<div class="bar ${d === TODAY() ? "today" : ""} ${q ? "" : "zero"}" title="${esc(fmtDate(d))}: ${q} answers${q ? ", " + pct(x.c / q) + "% correct" : ""}"><b style="height:${q / maxQ * 100}%"></b></div>`; }).join("")}</div>
    <div class="bars-x">${days.map((d, i) => `<span>${i % 2 === 1 ? "" : new Date(d + "T12:00:00").getDate()}</span>`).join("")}</div></div></div>
  <div class="section">${hd("Wortschatz", "Vocabulary")}<div class="card">
    ${mrow("Sicher", boxes[2] / all.length, boxes[2] + "")}${mrow("Im Lernen", boxes[1] / all.length, boxes[1] + "")}${mrow("Neu", boxes[0] / all.length, boxes[0] + "")}
    ${mrow("Artikel", skillVal("vocab.article"), null, "der/die/das when typing")}${mrow("Hör-Vokabeln", skillVal("vocab.listen"), null, "audio only")}</div></div>
  <div class="section">${hd("Einstellungen", "Settings")}<div class="card">
    <div class="set-row"><div><b>Level</b><div class="tiny">Switching keeps all progress</div></div><select class="input" id="set-level" data-act-change="level"><option ${lvl === "A1" ? "selected" : ""}>A1</option><option ${lvl === "A2" ? "selected" : ""}>A2</option></select></div>
    <div class="set-row"><div><b>A1 exam date</b></div><input type="date" class="input" id="set-a1" value="${S.exam.A1}" data-act-change="date" data-l="A1"></div>
    <div class="set-row"><div><b>A2 exam date</b></div><input type="date" class="input" id="set-a2" value="${S.exam.A2}" data-act-change="date" data-l="A2"></div>
    <div class="set-row"><div><b>English help</b><div class="tiny">Translations beside questions and options</div></div><button class="btn small" data-act="toggle-en" aria-pressed="${enOn()}">${enOn() ? "On" : "Off"}</button></div>
    <div class="set-row"><div><b>Speech speed</b><div class="tiny">${TTS.voices[0] ? "Voice: " + esc(TTS.voices[0].name) : "System German voice"}</div></div><div class="row">${speedSeg().replace('<span class="tiny">Tempo</span>', "")}<button class="btn small" data-act="test-voice">Test</button></div></div>
    <div class="set-row"><div><b>Saved</b><div class="tiny">${Store.status === "cloud" ? "To your Claude account. Open this page on any device to continue." : "On this device only. Always open the app the same way (for example from your Home Screen icon) so your progress is there."}</div></div><span class="sync ${Store.status === "cloud" ? "ok" : ""}"><i></i></span></div>
    <div class="set-row"><div><b>Reset progress</b><div class="tiny">Deletes all answers and word history</div></div>${UI.resetAsk ? `<div class="row"><button class="btn small" data-act="reset-no">Cancel</button><button class="btn small" style="color:var(--red)" data-act="reset-yes">Delete</button></div>` : `<button class="btn small" data-act="reset-ask">Reset</button>`}</div>
  </div></div>`;
}

const TABS = [["heute", "Heute", "home"], ["woerter", "Wörter", "words"], ["hoeren", "Hören", "ear"], ["pruefung", "Prüfung", "exam"], ["analyse", "Analyse", "chart"]];
function render() {
  const scr = { heute: screenHeute, woerter: screenWoerter, hoeren: screenHoeren, pruefung: screenPruefung, analyse: screenAnalyse }[UI.tab];
  $("#app").innerHTML = `<main class="app">${scr()}</main>
  <nav class="tabbar" aria-label="Main"><div class="tabbar-in">${TABS.map(([k, l, i]) => `<button class="tab" data-act="tab" data-t="${k}" ${UI.tab === k ? 'aria-current="page"' : ""}>${ic(i, 22)}<span>${l}</span></button>`).join("")}</div></nav>`;
  const strip = $("#cdstrip"), cell = strip && strip.querySelector(".today"); if (cell && strip.scrollTo) strip.scrollLeft = Math.max(0, cell.offsetLeft - 16);
}

// ---------- events ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case "tab": UI.tab = el.dataset.t; UI.resetAsk = false; render(); scrollTo(0, 0); try { localStorage.setItem("startklar-tab", UI.tab); } catch (_) {} break;
    case "start-daily": { const p = buildDaily(); startSession({ ...p, daily: true }); break; }
    case "start-short": { const p = buildDaily({ short: true }); startSession({ ...p, title: p.title + " (kurz)", daily: true }); break; }
    case "toggle-en": toggleEn(); break;
    case "p-due": startSession(P.due()); break;
    case "p-drill": startSession(P.drill(null, 10)); break;
    case "p-drilltype": startSession(P.drill(el.dataset.t, 10)); break;
    case "p-mistakes": startSession(P.mistakes()); break;
    case "p-mock": startSession(buildMock()); break;
    case "p-topic": startSession(P.topic(el.dataset.t)); break;
    case "p-articles": startSession(P.articles()); break;
    case "p-listenwords": startSession(P.listenWords()); break;
    case "p-part": startSession(P.part(el.dataset.m, +el.dataset.p)); break;
    case "p-trap": startSession(P.trap(el.dataset.t)); break;
    case "weak": goWeak(weaknesses(3)[+el.dataset.i].go); break;
    case "weak6": goWeak(weaknesses(6)[+el.dataset.i].go); break;
    case "level-toggle": UI.tab = "analyse"; render(); break;
    case "set-level": S.level = el.dataset.v; Store.save(); render(); break;
    case "gen-hoeren": genHoeren(); break;
    case "test-voice": TTS.say("Hallo! Ich bin Ihre Stimme für die Hörübungen. Viel Erfolg bei der Prüfung!"); break;
    case "rate": S.rate = +el.dataset.v; Store.save(); document.querySelectorAll('[data-act="rate"]').forEach(b => b.setAttribute("aria-pressed", b === el || +b.dataset.v === S.rate)); break;
    case "reset-ask": UI.resetAsk = true; render(); break;
    case "reset-no": UI.resetAsk = false; render(); break;
    case "reset-yes": { const keep = { level: S.level, exam: S.exam, rate: S.rate }; S = { ...freshState(), ...keep }; Store.save(); UI.resetAsk = false; _daily = null; render(); toast("Progress deleted."); break; }
    // runner
    case "quit": if (R) { R.st.quitAsk = true; renderRunner(false); } break;
    case "quit-no": if (R) { R.st.quitAsk = false; renderRunner(false); } break;
    case "quit-yes": closeRunner(); break;
    case "next": next(); break;
    case "say": TTS.say(el.dataset.text); break;
    case "learn-ok": { const w = WORDS[task().wid]; if (!S.words[w.id]) S.words[w.id] = { b: 0, d: dayNum(), n: 0, c: 0, x: 0 }; Store.save(); next(); break; }
    case "pick": pickOption(+el.dataset.q, +el.dataset.i); break;
    case "drill-play": playDrill(); break;
    case "h-play": playHoeren(); break;
    case "multi-check": checkMulti(); break;
    case "recall-check": checkRecall(); break;
    case "recall-skip": { const w = WORDS[task().wid]; gradeWord(w, false, "recall", false); finishTask(false, "Kein Problem.", `<b>${esc(w.de)}</b> = ${esc(w.en)}. It comes back soon.`); break; }
    case "write-check": checkWriting(); break;
    case "speak-check": checkSpeaking(); break;
    case "ai-feedback": aiFeedback(el.dataset.k); break;
    case "uml": { const t = document.getElementById(el.dataset.t); if (t) { const s = t.selectionStart ?? t.value.length, en = t.selectionEnd ?? s; t.value = t.value.slice(0, s) + el.dataset.c + t.value.slice(en); t.focus(); t.setSelectionRange(s + 1, s + 1); t.dispatchEvent(new Event("input", { bubbles: true })); } break; }
  }
});
document.addEventListener("change", e => {
  const el = e.target; const a = el.dataset.actChange; if (!a) return;
  if (a === "level") { S.level = el.value; Store.save(); _daily = null; render(); }
  if (a === "date" && el.value) { S.exam[el.dataset.l] = el.value; Store.save(); _daily = null; render(); }
});
document.addEventListener("input", e => {
  if (e.target.id === "wtext") { const n = wordCount(e.target.value); const c = $("#wc"); if (c) c.textContent = n + " Wörter"; if (R) R.st.text = e.target.value; }
  if (R && /^sp\d$/.test(e.target.id)) { R.st.vals[+e.target.id.slice(2)] = e.target.value; }
  if (R && /^f\d$/.test(e.target.id)) { R.st.vals = R.st.vals || []; R.st.vals[+e.target.id.slice(1)] = e.target.value; }
  if (R && e.target.id === "recall") R.st.typed = e.target.value;
});
document.addEventListener("keydown", e => {
  if (!R || e.key !== "Enter") return;
  if (e.target.id === "recall" && !R.st.done) { e.preventDefault(); checkRecall(); }
  else if (R.st.done && e.target.tagName !== "TEXTAREA") { e.preventDefault(); next(); }
});

// ---------- boot ----------
(function boot() {
  const local = Store.loadLocal(); if (local) S = normalize(local);
  try { const t = localStorage.getItem("startklar-tab"); if (t && TABS.some(x => x[0] === t)) UI.tab = t; } catch (_) {}
  if (location.hash && TABS.some(x => x[0] === location.hash.slice(1))) UI.tab = location.hash.slice(1);
  TTS.init(); render();
  setTimeout(() => { UI.voiceNote = true; if (!R && UI.tab !== "analyse") render(); }, 2500);
  Store.connect(() => { _daily = null; if (!R) render(); });
  (async () => { try { if (window.claude?.use) { const s = await window.claude.use("sample"); if (s) { SAMPLE = s; if (!R) render(); } } } catch (_) {} })();
})();
