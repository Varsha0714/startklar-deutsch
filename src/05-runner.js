// ================= Practice runner =================
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  words: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>',
  ear: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10l1.5 1.5 3-3M8.5 16h7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 5l7 7-7 7"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5 1 1.5 2 2 3 2-.5-2 0-4.5 0-6.5z"/>'
};
const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const LETTER = ["a", "b", "c", "d"];
const WAVE = () => '<div class="wave">' + Array.from({ length: 22 }, (_, i) => `<i style="height:${6 + Math.round(Math.abs(Math.sin(i * 1.7)) * 18)}px;animation-delay:${(i % 6) * 0.08}s"></i>`).join("") + "</div>";

let R = null; // current session

function startSession(sess) {
  if (!sess.tasks.length) { toast("Nothing to practise here yet."); return; }
  TTS.stop();
  R = { ...sess, i: 0, log: [], st: {}, started: Date.now(), requeued: 0 };
  document.body.style.overflow = "hidden";
  renderRunner(true);
}
function closeRunner() {
  TTS.stop(); R = null; const el = $("#runner"); el.hidden = true; el.innerHTML = ""; document.body.style.overflow = ""; render();
}
const task = () => R.tasks[R.i];
const hItem = id => allHoeren().find(x => x.id === id);
function toggleEn() { S.showEn = !enOn(); Store.save(); if (R) renderRunner(false); else render(); }
const lItem = id => LESEN.find(x => x.id === id);
const sItem = id => SCHREIBEN.find(x => x.id === id);
function playLimit(t) { if (!t.exam) return Infinity; const it = hItem(t.id); return (it.lvl === "A1" && it.part === 2) ? 1 : 2; }

function renderRunner(autoplay) {
  const el = $("#runner"); el.hidden = false;
  const t = task(), st = R.st;
  const view = VIEWS[t.kind](t, st);
  el.innerHTML = `
  <div class="runner-top">
    <button class="xbtn" data-act="quit" aria-label="Close session">${ic("x", 18)}</button>
    <div class="prog" role="progressbar" aria-valuenow="${R.i}" aria-valuemax="${R.tasks.length}"><b style="width:${(R.i / R.tasks.length) * 100}%"></b></div>
    <span class="tiny num">${R.i + 1}/${R.tasks.length}</span>
    <button class="pill ${enOn() ? "" : "ghost"}" data-act="toggle-en" aria-pressed="${enOn()}" title="English help on/off">EN</button>
  </div>
  <div class="runner-body"><div class="runner-in">${view}</div></div>
  <div class="runner-foot ${st.done && !R.mock ? (st.ok ? "good" : "bad") : ""}"><div class="runner-foot-in">${footer(t, st)}</div></div>`;
  el.querySelector(".runner-body").scrollTop = 0;
  if (autoplay) autoPlay(t);
}
function footer(t, st) {
  if (st.quitAsk) return `<div class="fb-title" style="color:var(--ink)">Stop this session?</div><div class="tiny">Your answers so far are saved.</div><div class="row"><button class="btn" data-act="quit-no" style="flex:1">Keep going</button><button class="btn primary" data-act="quit-yes" style="flex:1">Stop</button></div>`;
  if (st.done) {
    if (R.mock) return `<button class="btn primary block" data-act="next">Weiter</button>`;
    return `<div class="fb-title">${esc(st.fbTitle || (st.ok ? "Richtig!" : "Nicht ganz."))}</div>${st.fbHtml ? `<div class="small">${st.fbHtml}</div>` : ""}<button class="btn primary block" data-act="next">Weiter</button>`;
  }
  const f = FOOTS[t.kind]; return f ? f(t, st) : "";
}
function autoPlay(t) {
  if (t.kind === "learn" || (t.kind === "vocab" && (t.mode === "recognize" || t.mode === "listen"))) { const w = WORDS[t.wid]; TTS.say(w.de); }
  if (t.kind === "drill") playDrill();
}
function finishTask(ok, fbTitle, fbHtml) {
  Object.assign(R.st, { done: true, ok, fbTitle, fbHtml });
  Store.save(); renderRunner(false);
}
function next() {
  TTS.stop();
  const t = task();
  if (R.st.done && R.st.ok === false && !R.mock && t.kind === "vocab" && !t.retry && R.requeued < 8) { R.tasks.push({ ...t, mode: "recognize", retry: true }); R.requeued++; }
  R.i++; R.st = {};
  if (R.i >= R.tasks.length) return finishSession();
  renderRunner(true);
}

// ---------- normalising typed German ----------
const fold = s => String(s).toLowerCase().normalize("NFC").replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[.,!?;:„“"'()]/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const has = (text, kws) => { const f = " " + fold(text) + " "; return kws.some(k => f.includes(fold(k) ? (k.endsWith(" ") ? fold(k) + " " : fold(k)) : "")); };
const wordCount = s => (String(s).trim().match(/\S+/g) || []).length;

// ---------- option list ----------
const enOn = () => S.showEn !== false;
function optList(opts, st, qi = 0, correct = null, oen = null) {
  const sel = st.sel?.[qi], cls = "opts";
  if (!oen && opts.length === 2 && RF_EN[opts[0]]) oen = opts.map(o => RF_EN[o]);
  if (!enOn()) oen = null;
  return `<div class="${opts.length === 2 ? "rf" : cls}">` + opts.map((o, i) => {
    let c = "";
    if (st.done && !R.mock && correct !== null) { if (i === correct) c = "right"; else if (i === sel) c = "wrong"; }
    else if (i === sel) c = "sel";
    return `<button class="opt ${c}" data-act="pick" data-q="${qi}" data-i="${i}" ${st.done ? "disabled" : ""}><span class="box">${opts.length === 2 ? (o[0]) : LETTER[i]}</span><span class="otext"><span class="de">${esc(o)}</span>${oen && oen[i] ? `<span class="en">${esc(oen[i])}</span>` : ""}</span></button>`;
  }).join("") + "</div>";
}
function umlautRow(target) { return `<div class="umlauts">${["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"].map(c => `<button type="button" data-act="uml" data-t="${target}" data-c="${c}" aria-label="insert ${c}">${c}</button>`).join("")}</div>`; }

// ---------- views ----------
const VIEWS = {
  learn(t) {
    const w = WORDS[t.wid];
    return `<div class="tag">Neues Wort · ${esc(TOPICS[w.topic].de)}</div>
      <div class="card stack" style="align-items:flex-start">
        <div class="prompt de">${w.art ? `<span class="art">${w.art}</span> ${esc(w.noun)}` : esc(w.de)}</div>
        <div class="muted" style="font-size:18px">${esc(w.en)}</div>
        <button class="btn small" data-act="say" data-text="${esc(w.de)}">${ic("play", 14)} Anhören</button>
      </div>
      ${w.art ? `<div class="hand blue">${w.art === "der" ? "der — masculine" : w.art === "die" ? "die — feminine (or plural)" : "das — neuter"}. Learn the article with the word.</div>` : ""}
      <p class="tiny">Say it out loud twice. You'll be tested on it in a moment.</p>`;
  },
  vocab(t, st) {
    const w = WORDS[t.wid];
    if (!st.optW && t.mode !== "recall") {
      st.optW = shuffle([w, ...distractorWords(w, 3)]);
      st.opts = st.optW.map(x => t.mode === "choose" ? x.de : x.en);
    }
    // translations only after answering, so they don't give the answer away
    const oen = st.done && st.optW ? st.optW.map(x => t.mode === "choose" ? x.en : x.de) : null;
    const tag = { recognize: "Wortschatz · Was bedeutet das?", listen: "Hör-Vokabel · Was hören Sie?", choose: "Wortschatz · Wie heißt das auf Deutsch?", recall: "Wortschatz · Schreiben Sie das Wort" }[t.mode];
    let head = "";
    if (t.mode === "recognize") head = `<div class="row between"><div class="prompt de">${w.art ? `<span class="art">${w.art}</span> ${esc(w.noun)}` : esc(w.de)}</div><button class="xbtn" data-act="say" data-text="${esc(w.de)}" aria-label="Play">${ic("play", 16)}</button></div>`;
    if (t.mode === "listen") head = `<div class="player"><button class="play" data-act="say" data-text="${esc(w.de)}" aria-label="Play word">${ic("play", 24)}</button><div><div style="font-weight:600">Tap to hear the word again</div><div class="tiny">${st.done ? esc(w.de) : "No text — listen only"}</div></div></div>`;
    if (t.mode === "choose" || t.mode === "recall") head = `<div class="prompt">${esc(w.en)}</div>`;
    const correctIdx = st.opts ? st.opts.indexOf(t.mode === "choose" ? w.de : w.en) : null;
    const body = t.mode === "recall"
      ? `<div class="field"><label for="recall">German ${w.art ? "(with der / die / das)" : ""}</label>
          <input id="recall" class="input ${st.done ? (st.ok ? "right" : "wrong") : ""}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" value="${esc(st.typed || "")}" ${st.done ? "disabled" : ""} placeholder="${w.art ? "z. B. der Tisch" : ""}"></div>${st.done ? "" : umlautRow("recall")}`
      : optList(st.opts, st, 0, correctIdx, oen);
    const help = { recognize: "Tap the English meaning.", listen: "Listen, then tap the meaning.", choose: "Tap the German word.", recall: "Type the German word." }[t.mode];
    return `<div class="tag">${tag}</div>${enOn() ? `<div class="en-q">${help}</div>` : ""}${head}${body}`;
  },
  article(t, st) {
    const w = WORDS[t.wid];
    const opts = ["der", "die", "das"];
    return `<div class="tag">Artikel · der, die oder das?</div><div class="prompt de">${esc(w.noun)}</div><div class="muted">${esc(w.en)}</div>${optList(opts, st, 0, opts.indexOf(w.art))}`;
  },
  drill(t, st) {
    const info = DRILL_INFO[t.type];
    return `<div class="tag">Hörtraining · ${esc(info[0])}</div>
      <div class="player"><button class="play ${st.playing ? "playing" : ""}" data-act="drill-play" aria-label="Play">${ic("play", 24)}</button><div style="flex:1;min-width:0">${WAVE()}<div class="tiny">${st.done ? "Sie hörten: <b>" + esc(t.say) + "</b>" : "Hören Sie genau. Tap to replay."}</div></div></div>
      <div class="q">${t.type === "spell" ? "Welcher Name wird buchstabiert?" : t.type === "phone" ? "Welche Nummer hören Sie?" : t.type === "date" ? "Welches Datum hören Sie?" : t.type === "price" ? "Welcher Preis?" : t.type === "num" ? "Welche Zahl?" : "Wie spät ist es?"}</div>
      ${optList(t.opts, st, 0, t.opts.indexOf(t.ans))}`;
  },
  hoeren(t, st) {
    const it = hItem(t.id); if (!st.sel) st.sel = [];
    const limit = playLimit(t); const plays = st.plays || 0;
    const onceText = (it.lvl === "A1" && it.part === 2) ? "Im Test hören Sie den Text einmal." : "Im Test hören Sie den Text zweimal.";
    const qs = qBlock(it, st);
    const transcript = st.done && !R.mock ? `<div class="stack-s"><div class="eyebrow">Transkript</div><div class="transcript">${it.s.map(([sp, tx]) => `<div><span class="sp">${sp === "N" ? "📢" : sp === "A" ? "A" : "B"}</span>${hilite(tx, it.key)}</div>`).join("")}</div>${it.ex ? `<div class="hand">${esc(it.ex)}</div>` : ""}</div>` : "";
    return `<div class="row between"><div class="tag">Hören · Teil ${it.part}${it.gen ? " · made by Claude" : ""}</div>${t.exam ? `<span class="chip amber">Prüfungsmodus</span>` : ""}</div>
      <div class="steps"><span>1 Read the question</span><span>2 Tap ▶</span><span>3 Choose</span></div>
      <div class="tiny">${onceText} ${t.exam ? "" : "Here you can replay as often as you like."}</div>
      <div class="player"><button class="play ${st.playing ? "playing" : ""}" data-act="h-play" aria-label="Play recording" ${plays >= limit ? "disabled style='opacity:.4'" : ""}>${ic("play", 24)}</button>
        <div style="flex:1;min-width:0" class="${st.playing ? "playing-wave" : ""}">${WAVE()}<div class="tiny num">${plays >= limit ? "Keine Wiederholung im Test" : plays ? plays + "× gehört" : "Read the questions first, then play."}</div></div></div>
      ${t.exam ? "" : speedSeg()}
      ${qs}${transcript}`;
  },
  lesen(t, st) {
    const it = lItem(t.id); if (!st.sel) st.sel = [];
    let doc = "";
    if (it.kind === "ads") doc = `<div class="q">${esc(it.situation)}</div>${enOn() && it.sitEn ? `<div class="en-q">${esc(it.sitEn)}</div>` : ""}<div class="ads">${it.ads.map((a, i) => `<div class="ad"><b class="lt">${LETTER[i]}</b>${esc(a)}</div>`).join("")}</div>`;
    else doc = `<div class="text-doc ${it.kind === "sign" ? "sign" : ""}">${esc(it.text)}</div>`;
    const qs = qBlock(it, st);
    return `<div class="tag">Lesen · Teil ${it.part}</div><div class="tiny">${esc(PART_INFO[it.lvl].lesen[it.part] || "")}</div>${doc}${qs}`;
  },
  schreiben(t, st) {
    const it = sItem(t.id);
    if (it.fields) {
      return `<div class="tag">Schreiben · Teil 1 · Formular</div><div class="text-doc">${esc(it.text)}</div>
        <div class="card stack">${it.fields.map((f, i) => `<div class="field"><label for="f${i}">${esc(f.label)}</label><input id="f${i}" class="input ${st.done ? (st.fieldOk?.[i] ? "right" : "wrong") : ""}" autocomplete="off" autocorrect="off" spellcheck="false" value="${esc(st.vals?.[i] || "")}" ${st.done ? "disabled" : ""}>${st.done && !st.fieldOk?.[i] ? `<div class="hand">→ ${esc(f.acc[0].replace(/(^|\s)\S/g, s => s.toUpperCase()))}</div>` : ""}</div>`).join("")}</div>`;
    }
    const target = it.words || 30;
    return `<div class="tag">Schreiben · Teil ${it.part}</div><div class="q">${esc(it.task)}</div>
      <div class="checklist">${it.points.map((p, i) => ck(st.done ? st.pts[i] : null, p.label)).join("")}${st.done ? ck(st.greet, "Anrede (" + (it.formal ? "Sehr geehrte/r … / Liebe/r Frau …" : "Liebe/r … / Hallo …") + ")") + ck(st.close, "Gruß (" + (it.formal ? "Mit freundlichen Grüßen / Viele Grüße" : "Liebe Grüße / Viele Grüße") + ")") + ck(st.len, "Länge: " + st.wc + " / ~" + target + " Wörter") : ""}</div>
      <textarea id="wtext" class="input" placeholder="Liebe …" autocapitalize="sentences" spellcheck="false" ${st.done ? "readonly" : ""}>${esc(st.text || "")}</textarea>
      ${st.done ? "" : `<div class="row between">${umlautRow("wtext")}<span class="tiny num" id="wc">0 Wörter</span></div>`}
      ${st.done ? `<details class="more"><summary>Musterlösung ansehen</summary><div class="text-doc" style="margin-top:8px">${esc(it.model)}</div></details>${aiBlock("w")}` : ""}`;
  },
  sprechen(t, st) {
    const lvl = S.level, sp = SPRECHEN[lvl];
    const dictTip = `<div class="tiny">Tip: on iPhone, switch to the German keyboard and tap the microphone to <b>speak</b> your answer. If dictation understands you, the examiner will too.</div>`;
    if (!st.cards) {
      if (lvl === "A1" && t.part === 1) st.cards = [sp.intro];
      else if ((lvl === "A1" && t.part === 2) || (lvl === "A2" && t.part === 1)) st.cards = shuffle(sp.cards).slice(0, 2);
      else if (lvl === "A1" && t.part === 3) st.cards = shuffle(sp.requests).slice(0, 2);
      else if (lvl === "A2" && t.part === 2) st.cards = [pick(sp.tell)];
      else st.cards = [pick(sp.plan)];
      st.vals = st.cards.map(() => "");
    }
    const type = lvl === "A1" ? ["", "intro", "card", "req"][t.part] : ["", "card", "tell", "plan"][t.part];
    const head = `<div class="tag">Sprechen · Teil ${t.part}</div><div class="tiny">${esc(PART_INFO[lvl].sprechen[t.part])}</div>`;
    const area = (i, ph, rows = 3) => `<textarea id="sp${i}" class="input" style="min-height:${rows * 34}px" placeholder="${esc(ph)}" autocapitalize="sentences" spellcheck="false" ${st.done ? "readonly" : ""}>${esc(st.vals[i] || "")}</textarea>`;
    let body = "";
    if (type === "intro") {
      const c = st.cards[0];
      body = `<div class="q">Stellen Sie sich vor. Use every card:</div><div class="row">${c.prompts.map((p, i) => `<span class="chip ${st.done ? (st.pts[i] ? "green" : "red") : ""}">${esc(p.label)}?</span>`).join("")}</div>
        <div class="tiny">In the exam you'll also spell your name (<i>Buchstabieren</i>) and say a number (phone, house number).</div>${area(0, "Hallo! Ich heiße …", 5)}${dictTip}
        ${st.done ? `<div class="stack-s"><div class="row between"><div class="eyebrow">Beispiel</div><button class="btn small" data-act="say" data-text="${esc(c.model)}">${ic("play", 14)} Anhören</button></div><div class="text-doc">${esc(c.model)}</div></div>` : ""}`;
    } else if (type === "card") {
      body = st.cards.map((c, i) => `<div class="wortkarte"><div class="thema">Thema: ${esc(c.thema)}</div><div class="wort">${esc(c.wort)}</div></div>
        <div class="small">Ask your partner a question with this word${lvl === "A1" ? ", then answer it yourself" : ""}.</div>${area(i, "Frage … ? Antwort …", 3)}
        ${st.done ? `<div class="stack-s"><div class="checklist">${ck(st.pts[i][0], "Contains a question („?“)")}${ck(st.pts[i][1], "Uses the word / theme")}${ck(st.pts[i][2], "Verb in position 1 or a W-word")}</div><div class="transcript"><div><span class="sp">?</span>${esc(c.q)}</div><div><span class="sp">!</span>${esc(c.a)}</div></div><button class="btn small" data-act="say" data-text="${esc(c.q + " " + c.a)}">${ic("play", 14)} Anhören</button></div>` : ""}`).join('<hr class="rule">');
    } else if (type === "req") {
      body = st.cards.map((c, i) => `<div class="bildkarte" role="img" aria-label="${esc(c.hint)}">${c.pic}</div><div class="small" style="text-align:center">Make a polite request that fits the picture.</div>${area(i, "Können Sie bitte …?", 2)}
        ${st.done ? `<div class="stack-s"><div class="checklist">${ck(st.pts[i][0], "Polite form (bitte / Können Sie / Darf ich / Ich möchte)")}${ck(st.pts[i][1], "Names the thing: " + c.hint)}</div><div class="transcript"><div><span class="sp">A</span>${esc(c.req)}</div><div><span class="sp">B</span>${esc(c.resp)}</div></div><button class="btn small" data-act="say" data-text="${esc(c.req + " " + c.resp)}">${ic("play", 14)} Anhören</button></div>` : ""}`).join('<hr class="rule">');
    } else if (type === "tell") {
      const c = st.cards[0];
      body = `<div class="wortkarte"><div class="wort" style="font-size:20px">${esc(c.title)}</div><div class="row" style="justify-content:center;margin-top:8px">${c.prompts.map(p => `<span class="chip">${esc(p)}</span>`).join("")}</div></div>
        ${area(0, "Am Wochenende …", 6)}${dictTip}
        ${st.done ? `<div class="checklist">${ck(st.pts[0], "At least 40 words (" + wordCount(st.vals[0]) + ")")}${ck(st.pts[1], "Connectors: und, aber, dann, weil, oft …")}</div><details class="more"><summary>Beispiel ansehen</summary><div class="text-doc" style="margin-top:8px">${esc(c.model)}</div><button class="btn small" style="margin-top:8px" data-act="say" data-text="${esc(c.model)}">${ic("play", 14)} Anhören</button></details>` : ""}`;
    } else {
      const c = st.cards[0];
      body = `<div class="q">${esc(c.task)}</div>${area(0, "Hast du am Samstag um … Zeit?", 5)}
        ${st.done ? `<div class="checklist">${ck(st.pts[0], "Suggests a time")}${ck(st.pts[1], "Asks the partner / reacts")}</div><details class="more"><summary>Beispiel ansehen</summary><div class="text-doc" style="margin-top:8px">${esc(c.model)}</div></details>` : ""}`;
    }
    return head + body + (st.done ? aiBlock("s") : "");
  }
};
function qBlock(it, st) {
  return it.qs.map((q, qi) => `<div class="stack-s"><div><div class="q">${it.qs.length > 1 ? `<span class="tiny num">${qi + 1}.</span> ` : ""}${esc(q.q)}</div>${enOn() && q.en ? `<div class="en-q">${esc(q.en)}</div>` : ""}</div>${optList(q.o, st, qi, q.a, q.oen)}</div>`).join("");
}
function ck(state, label) { return `<div class="ck ${state === true ? "on" : state === false ? "off" : ""}"><i>${state === true ? "✓" : state === false ? "✗" : ""}</i><span>${esc(label)}</span></div>`; }
function hilite(text, key) { const e = esc(text); if (!key) return e; const k = esc(key); const i = e.indexOf(k); return i < 0 ? e : e.slice(0, i) + "<mark>" + k + "</mark>" + e.slice(i + k.length); }
function speedSeg() { const r = S.rate; return `<div class="row"><span class="tiny">Tempo</span><div class="seg" role="group" aria-label="Speech speed">${[[0.7, "langsam"], [0.9, "normal"], [1.02, "Prüfung"]].map(([v, l]) => `<button data-act="rate" data-v="${v}" aria-pressed="${Math.abs(r - v) < 0.01}">${l}</button>`).join("")}</div></div>`; }

// ---------- footers (before answering) ----------
const FOOTS = {
  learn: () => `<button class="btn primary block" data-act="learn-ok">Weiter</button>`,
  vocab: (t) => t.mode === "recall" ? `<div class="row"><button class="btn" data-act="recall-skip" style="flex:1">Weiß ich nicht</button><button class="btn primary" data-act="recall-check" style="flex:2">Prüfen</button></div>` : `<div class="tiny" style="text-align:center">Tap an answer</div>`,
  article: () => `<div class="tiny" style="text-align:center">Tap der, die or das</div>`,
  drill: () => `<div class="tiny" style="text-align:center">Tap an answer · replay as often as you need</div>`,
  hoeren: (t, st) => { const it = hItem(t.id); const ready = it.qs.every((_, i) => st.sel?.[i] !== undefined); return `<button class="btn primary block" data-act="multi-check" ${ready ? "" : "disabled"}>${R.mock ? "Antwort speichern" : "Prüfen"}</button>`; },
  lesen: (t, st) => { const it = lItem(t.id); const ready = it.qs.every((_, i) => st.sel?.[i] !== undefined); return `<button class="btn primary block" data-act="multi-check" ${ready ? "" : "disabled"}>${R.mock ? "Antwort speichern" : "Prüfen"}</button>`; },
  schreiben: () => `<button class="btn primary block" data-act="write-check">Prüfen</button>`,
  sprechen: () => `<button class="btn primary block" data-act="speak-check">Prüfen & Beispiel zeigen</button>`
};

// ---------- actions inside the runner ----------
function playDrill() {
  const t = task(); R.st.plays = (R.st.plays || 0) + 1;
  TTS.play([["A", t.say]], { rate: t.exam ? 1.0 : t.type === "spell" ? Math.min(S.rate, 0.85) : S.rate, onstart: () => setPlaying(true), onend: () => setPlaying(false) });
}
function setPlaying(on) { if (!R) return; R.st.playing = on; const b = $("#runner .play"); if (b) b.classList.toggle("playing", on); const w = $("#runner .wave")?.parentElement; if (w) w.classList.toggle("playing-wave", on); }
function playHoeren() {
  const t = task(), it = hItem(t.id); const lim = playLimit(t);
  if ((R.st.plays || 0) >= lim) return;
  R.st.plays = (R.st.plays || 0) + 1;
  TTS.play(it.s, { rate: t.exam ? 1.0 : S.rate, onstart: () => setPlaying(true), onend: () => { setPlaying(false); if (R && R.st.plays >= lim) renderRunner(false); else { const n = $("#runner .player .tiny"); if (n) n.textContent = R.st.plays + "× gehört"; } } });
  const n = $("#runner .player .tiny"); if (n) n.textContent = "läuft …";
}
function pickOption(q, i) {
  const t = task(), st = R.st; if (st.done) return;
  st.sel = st.sel || []; st.sel[q] = i;
  if (t.kind === "vocab") {
    const w = WORDS[t.wid]; const right = t.mode === "choose" ? w.de : w.en; const ok = st.opts[i] === right;
    gradeWord(w, ok, t.mode === "listen" ? "listen" : "recognize");
    if (ok) clearMistake("w", w.id);
    return finishTask(ok, ok ? pick(["Richtig!", "Genau!", "Super!", "Sehr gut!"]) : "Nicht ganz.", `<b>${esc(w.de)}</b> = ${esc(w.en)}`);
  }
  if (t.kind === "article") {
    const w = WORDS[t.wid]; const ok = ["der", "die", "das"][i] === w.art; record(["vocab.article", "topic." + w.topic], ok);
    return finishTask(ok, ok ? "Richtig!" : "Nicht ganz.", `<b>${w.art} ${esc(w.noun)}</b> — ${esc(w.en)}`);
  }
  if (t.kind === "drill") {
    const ok = t.opts[i] === t.ans; record(["drill." + t.type], ok);
    return finishTask(ok, ok ? "Richtig!" : "Nicht ganz.", `Sie hörten: <b>${esc(t.say)}</b> = ${esc(t.ans)}`);
  }
  renderRunner(false);
}
function checkMulti() {
  const t = task(), st = R.st, kind = t.kind;
  const it = kind === "hoeren" ? hItem(t.id) : lItem(t.id);
  let c = 0;
  it.qs.forEach((q, qi) => { const ok = st.sel[qi] === q.a; if (ok) c++; recordItem(kind, it, qi, ok); });
  if (c === it.qs.length) clearMistake(kind, it.id);
  R.log.push({ kind, part: it.part, n: it.qs.length, c, id: it.id, mock: R.mock });
  st.logged = true;
  TTS.stop();
  const ok = c === it.qs.length;
  finishTask(ok, ok ? (it.qs.length > 1 ? "Alles richtig!" : "Richtig!") : (it.qs.length > 1 ? c + " von " + it.qs.length + " richtig" : "Nicht ganz."), R.mock ? "" : (kind === "hoeren" ? "Check the highlighted phrase in the transcript." : ""));
}
function checkRecall() {
  const t = task(), w = WORDS[t.wid], st = R.st;
  const val = $("#recall").value.trim(); st.typed = val;
  if (!val) return;
  let artOk = true, wordOk;
  const f = fold(val);
  if (w.art) {
    const m = f.match(/^(der|die|das)\s+(.+)$/);
    const noun = m ? m[2] : f;
    artOk = !!m && m[1] === w.art;
    const target = fold(w.noun); const d = lev(noun, target);
    wordOk = d === 0 || (target.length >= 6 && d === 1);
    st.typo = d === 1 && wordOk;
  } else { const target = fold(w.de); const d = lev(f, target); wordOk = d === 0 || (target.length >= 6 && d === 1); st.typo = d === 1 && wordOk; }
  const ok = wordOk && artOk;
  gradeWord(w, ok, "recall", artOk);
  if (ok) clearMistake("w", w.id);
  let msg = `<b>${esc(w.de)}</b> = ${esc(w.en)}`;
  if (wordOk && !artOk) msg = `Word right, article ${val.match(/^(der|die|das)\b/i) ? "wrong" : "missing"}: <b>${esc(w.de)}</b>`;
  if (ok && st.typo) msg += " · small typo, check the spelling";
  if (ok && w.noun && !/^(der|die|das)\s+[A-ZÄÖÜ]/.test(val)) msg += " · Nouns start with a capital letter.";
  finishTask(ok, ok ? "Richtig!" : wordOk ? "Fast!" : "Nicht ganz.", msg);
}
function checkWriting() {
  const t = task(), it = sItem(t.id), st = R.st;
  const mark = ok => { const k = "schreiben:" + it.id; const x = S.items[k] || (S.items[k] = { n: 0, c: 0 }); x.n++; if (ok) x.c++; x.last = dayNum(); x.ok = ok; };
  if (it.fields) {
    st.vals = it.fields.map((_, i) => $("#f" + i).value.trim());
    st.fieldOk = it.fields.map((f, i) => f.acc.some(a => fold(a) === fold(st.vals[i])));
    let c = 0; st.fieldOk.forEach(ok => { record(["schreiben." + it.lvl + ".1"], ok); if (ok) c++; });
    mark(c === it.fields.length);
    return finishTask(c === it.fields.length, c + " von " + it.fields.length + " Feldern richtig", "Read the text again for the red fields. The exam gives 1 point per field.");
  }
  const text = $("#wtext").value; st.text = text;
  const low = fold(text);
  st.pts = it.points.map(p => has(text, p.kw));
  st.greet = /^(liebe|lieber|hallo|hi|sehr geehrte|guten tag)/.test(low);
  st.close = /(gruesse|gruss|bis bald|bis dann|tschuess|tschuss|herzlich)/.test(low);
  st.wc = wordCount(text); const target = it.words || 30; st.len = st.wc >= Math.round(target * 0.7);
  const all = [...st.pts, st.greet, st.close, st.len];
  all.forEach(ok => record(["schreiben." + it.lvl + "." + it.part], ok));
  const c = all.filter(Boolean).length;
  mark(c >= all.length - 1);
  finishTask(c >= all.length - 1, c + " / " + all.length + " Punkte erfüllt", "This is a quick keyword check. For grammar feedback, ask Claude below.");
}
function checkSpeaking() {
  const t = task(), st = R.st, lvl = S.level;
  st.vals = st.cards.map((_, i) => $("#sp" + i).value);
  const type = lvl === "A1" ? ["", "intro", "card", "req"][t.part] : ["", "card", "tell", "plan"][t.part];
  const key = "sprechen." + lvl + "." + t.part;
  let marks = [];
  if (type === "intro") { st.pts = st.cards[0].prompts.map(p => has(st.vals[0], p.kw)); marks = st.pts; }
  else if (type === "card") {
    const W = ["wann", "wo", "wie", "was", "wer", "warum", "welche", "welchen", "welcher", "woher", "wohin"];
    st.pts = st.cards.map((c, i) => { const v = st.vals[i]; const f = fold(v); const first = f.split(" ")[0] || ""; const stem = fold(c.wort.replace("?", "")).slice(0, 5); return [v.includes("?"), f.includes(stem) || has(v, [c.thema.split(" ")[0]]), W.includes(first) || /(st|en|t)$/.test(first)]; });
    marks = st.pts.flat();
  } else if (type === "req") {
    st.pts = st.cards.map((c, i) => { const v = st.vals[i]; return [/bitte|koennen sie|kannst du|darf ich|ich moechte|ich haette gern/.test(fold(v)), has(v, c.kw)]; });
    marks = st.pts.flat();
  } else if (type === "tell") { st.pts = [wordCount(st.vals[0]) >= 40, /\b(und|aber|dann|weil|oft|danach|meistens|manchmal)\b/.test(fold(st.vals[0]))]; marks = st.pts; }
  else { const f = fold(st.vals[0]); st.pts = [/(\d|uhr|um )/.test(f), /\?|was meinst|geht es|passt|einverstanden|gute idee/.test(st.vals[0].toLowerCase() + f)]; marks = st.pts; }
  marks.forEach(ok => record([key], ok));
  const c = marks.filter(Boolean).length;
  finishTask(c >= marks.length - 1, c + " / " + marks.length + " erfüllt", "Now read the example out loud. Copy the rhythm.");
}

// ---------- Claude feedback (sample capability) ----------
let SAMPLE = null;
function aiBlock(kind) {
  const st = R.st;
  if (!SAMPLE) return "";
  if (st.ai) return `<div class="stack-s"><div class="eyebrow">Feedback von Claude</div>${st.ai}</div>`;
  return `<button class="btn block" data-act="ai-feedback" data-k="${kind}" ${st.aiBusy ? "disabled" : ""}>${ic("spark", 16)} ${st.aiBusy ? "Claude liest …" : "Get grammar feedback from Claude"}</button>`;
}
async function aiFeedback(kind) {
  const t = task(), st = R.st; if (!SAMPLE || st.aiBusy) return;
  let taskText, answer;
  if (kind === "w") { const it = sItem(t.id); taskText = "Goethe " + it.lvl + " Schreiben Teil " + it.part + ": " + it.task + " Points to cover: " + it.points.map(p => p.label).join("; ") + ". Target length about " + (it.words || 30) + " words."; answer = st.text; }
  else { taskText = "Goethe " + S.level + " Sprechen Teil " + t.part + " (" + PART_INFO[S.level].sprechen[t.part] + "). Cards: " + JSON.stringify(st.cards.map(c => c.wort || c.hint || c.title || "self-introduction")); answer = st.vals.join("\n---\n"); }
  if (!answer || !answer.trim()) { toast("Write something first."); return; }
  st.aiBusy = true; renderRunner(false);
  try {
    const res = await SAMPLE.json(`You are a friendly, strict Goethe-Institut examiner for level ${S.level}. The learner's first language is English.
Task: ${taskText}
Learner's answer (German):
"""${answer.slice(0, 2500)}"""
Reply with only JSON: {"score": <0-10 how this would score in the exam>, "verdict": "<one short English sentence>", "corrections": [{"wrong": "<exact phrase from the answer>", "right": "<corrected German>", "why": "<very short English reason>"}], "better": "<the learner's text rewritten as a strong ${S.level} answer, same ideas>", "tip": "<one concrete tip in English>"}. At most 6 corrections; only real errors.`, { modelTier: "default", cache: false });
    const cor = Array.isArray(res.corrections) ? res.corrections.slice(0, 6) : [];
    st.ai = `<div class="ai-out"><div class="row between"><b>${esc(res.verdict || "")}</b>${typeof res.score === "number" ? `<span class="chip ${res.score >= 7 ? "green" : res.score >= 5 ? "amber" : "red"} num">${res.score}/10</span>` : ""}</div>
      ${cor.length ? `<div style="margin-top:8px">${cor.map(c => `<div class="correction"><div><s>${esc(c.wrong)}</s> → <ins>${esc(c.right)}</ins></div><div class="tiny">${esc(c.why)}</div></div>`).join("")}</div>` : `<div class="tiny" style="margin-top:6px">No grammar errors found.</div>`}
      ${res.better ? `<div class="eyebrow" style="margin-top:10px">Stronger version</div><div style="margin-top:4px">${esc(res.better)}</div><button class="btn small" style="margin-top:8px" data-act="say" data-text="${esc(res.better)}">${ic("play", 14)} Anhören</button>` : ""}
      ${res.tip ? `<div class="hand blue" style="margin-top:8px">${esc(res.tip)}</div>` : ""}</div>`;
    S.writing.unshift({ d: TODAY(), k: kind, score: res.score ?? null }); S.writing = S.writing.slice(0, 20); Store.save();
  } catch (e) {
    if (e && (e.code === "not_granted" || e.code === "sampling_disabled" || e.code === "capability_disabled" || e.code === "not_declared")) { SAMPLE = null; st.ai = ""; }
    else st.ai = `<div class="notice">${e?.code === "rate_limited" ? "Claude is busy right now. Try again in a minute." : "Feedback didn't come through. Try again."}</div>`;
  } finally { st.aiBusy = false; if (R) renderRunner(false); }
}

// ---------- end of session ----------
function finishSession() {
  TTS.stop();
  if (R.daily) { S.dailyDone = TODAY(); S.doneDays = S.doneDays || {}; S.doneDays[TODAY()] = true; }
  const answered = R.tasks.length;
  const el = $("#runner");
  let body;
  if (R.mock) {
    const h = R.log.filter(x => x.kind === "hoeren"), l = R.log.filter(x => x.kind === "lesen");
    const sc = arr => { const n = arr.reduce((a, x) => a + x.n, 0), c = arr.reduce((a, x) => a + x.c, 0); return { n, c, pts: n ? Math.round(c / n * 25 * 10) / 10 : 0 }; };
    const H = sc(h), L = sc(l);
    S.mocks.unshift({ d: TODAY(), lvl: S.level, h: H.pts, l: L.pts, hn: H.c + "/" + H.n, ln: L.c + "/" + L.n, min: Math.round((Date.now() - R.started) / 60000) });
    S.mocks = S.mocks.slice(0, 20); Store.save();
    const per = (H.pts + L.pts) / 50;
    const wrong = R.log.filter(x => x.c < x.n);
    body = `<div class="eyebrow">Modelltest · ${S.level}</div>
      <div class="row" style="align-items:flex-end;gap:18px"><div><div class="summary-num num">${H.pts}</div><div class="tiny">Hören / 25 · ${H.c}/${H.n}</div></div><div><div class="summary-num num">${L.pts}</div><div class="tiny">Lesen / 25 · ${L.c}/${L.n}</div></div></div>
      <div class="notice">${per >= 0.6 ? "<b>On track.</b> " : "<b>Not yet at the pass line.</b> "}You need 60 of 100 points overall; that's 15 of 25 per part on average. Here: ${Math.round(per * 100)}% of the Hören + Lesen points.</div>
      ${wrong.length ? `<div class="section-head"><h3>Your mistakes</h3></div>${wrong.map(x => { const it = x.kind === "hoeren" ? hItem(x.id) : lItem(x.id); return `<div class="card flat stack-s"><div class="tag">${MOD_NAME[x.kind]} · Teil ${it.part} · ${x.c}/${x.n}</div>${it.qs.map(q => `<div class="small"><b>${esc(q.q)}</b> → ${esc(q.o[q.a])}</div>`).join("")}${x.kind === "hoeren" ? `<div class="transcript">${it.s.map(([sp, tx]) => `<div>${hilite(tx, it.key)}</div>`).join("")}</div><div class="hand">${esc(it.ex || "")}</div>` : ""}</div>`; }).join("")}` : ""}`;
  } else {
    const today = S.days[TODAY()] || { q: 0, c: 0 };
    Store.save();
    const w = weaknesses(3);
    body = `<div class="eyebrow">${esc(R.title)} · geschafft</div>
      <div class="summary-num num">${today.q ? pct(today.c / today.q) : 0}%</div><div class="muted">correct today · ${today.q} answers</div>
      ${w.length ? `<div class="card flat stack-s"><div class="eyebrow">Still weak</div>${w.map(x => `<div class="row between"><span>${esc(x.label)}</span><b class="num" style="color:var(--red)">${pct(x.v)}%</b></div>`).join("")}<div class="tiny">Tomorrow's plan will focus on these.</div></div>` : ""}
      <div class="hand blue">Gut gemacht! ${daysLeft() > 0 ? "Noch " + daysLeft() + " Tage." : ""}</div>`;
  }
  el.innerHTML = `<div class="runner-top"><button class="xbtn" data-act="quit-yes" aria-label="Close">${ic("x", 18)}</button><div class="prog"><b style="width:100%"></b></div></div>
    <div class="runner-body"><div class="runner-in">${body}</div></div>
    <div class="runner-foot"><div class="runner-foot-in"><button class="btn primary block" data-act="quit-yes">Fertig</button></div></div>`;
}
