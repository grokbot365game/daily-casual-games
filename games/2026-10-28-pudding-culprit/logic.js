/* プリン消失事件 — case generator and rules.
   No DOM. Safe to require() from the node self-test.

   Difficulty score (higher = harder) must rise every round:
     suspects * 10    more people to separate
     evidence * 6     more cards; also the minimum useful questions
     lying ? 16 : 0   one answer is reversed, marked by sweat, wobble, and a sound
     spare * 5        subtracted. spare = question budget - evidence count
     (45 - time)      a shorter clock is slightly harder

   Round 4 introduces lying and lightens two other knobs versus round 3
   (fewer suspects, more spare questions). The score still rises because
   the lie weight is larger than that relief. Round 6 is the maximum. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PuddingLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TRAITS = ["alibi", "paw", "spoon", "reach", "sweet"];

  var QUESTION_TEXT = {
    alibi: "3時どこにいた？",
    paw: "手(足)を見せて",
    spoon: "スプーン使える？",
    reach: "背は届く？",
    sweet: "甘い匂いは？"
  };

  var TRAIT_SHORT = {
    alibi: "3時",
    paw: "手足",
    spoon: "スプーン",
    reach: "背",
    sweet: "匂い"
  };

  /* Culprit evidence traits are always the positive reading, so these
     phrases are the cards the player actually sees. */
  var EVIDENCE_TEXT = {
    alibi: "犯行は3時ごろ",
    paw: "肉球のあと",
    spoon: "小さいスプーン",
    reach: "カラメルが高い棚に",
    sweet: "甘い匂い"
  };

  var ANSWER = {
    alibi: ["外出してた", "家にいた"],
    paw: ["ついてない", "肉球がついてる"],
    spoon: ["使えない", "使える"],
    reach: ["届かない", "届く"],
    sweet: ["匂いなし", "甘い匂い"]
  };

  var ROSTER = [
    { id: "papa", name: "パパ", look: "papa" },
    { id: "mama", name: "ママ", look: "mama" },
    { id: "sister", name: "妹", look: "sister" },
    { id: "grandma", name: "おばあちゃん", look: "grandma" },
    { id: "dog", name: "犬", look: "dog" },
    { id: "cat", name: "猫", look: "cat" },
    { id: "bird", name: "インコ", look: "bird" }
  ];

  /* time is the round limit in seconds. budget = evidence + spare.
     intro "lie" is the teaching round for the new mechanic. */
  var ROUNDS = [
    { id: 1, practice: true, suspects: 3, evidence: 2, spare: 2, lying: false, time: 45 },
    { id: 2, practice: false, suspects: 3, evidence: 2, spare: 1, lying: false, time: 42 },
    { id: 3, practice: false, suspects: 4, evidence: 2, spare: 1, lying: false, time: 38 },
    { id: 4, practice: false, suspects: 3, evidence: 2, spare: 2, lying: true, time: 34, intro: "lie" },
    { id: 5, practice: false, suspects: 4, evidence: 3, spare: 1, lying: true, time: 30 },
    { id: 6, practice: false, suspects: 5, evidence: 3, spare: 0, lying: true, time: 25 }
  ];

  var RULES = [
    "3つの質問から1つタップして聞きこみ",
    "証拠に合う1人をタップして『犯人だ！』",
    "まちがい・時間切れでハート−1（練習はノーカウント）"
  ];

  var RANK_LINE = "名探偵＝ハート減らずに全解決／一人前＝ハート1つ減で全解決／見習い＝途中で失敗";
  var LIE_LINE = "汗だ！いまのは逆だよ";
  var PLAY_URL = "https://grokbot365game.github.io/daily-casual-games/games/2026-10-28-pudding-culprit/";
  var ANNOUNCE = "プリン消失事件。3つの質問をタップして犯人を当てよう。回数限定、ハート2つで6件。練習はノーカウント。";

  function difficultyScore(r) {
    return r.suspects * 10 + r.evidence * 6 + (r.lying ? 16 : 0) - r.spare * 5 + (45 - r.time);
  }

  function budgetOf(r) {
    return r.evidence + r.spare;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return {
      next: function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      getSeed: function () {
        return a >>> 0;
      }
    };
  }

  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng.next() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function combinations(arr, k) {
    var out = [];
    function rec(start, acc) {
      if (acc.length === k) {
        out.push(acc.slice());
        return;
      }
      for (var i = start; i < arr.length; i++) {
        acc.push(arr[i]);
        rec(i + 1, acc);
        acc.pop();
      }
    }
    rec(0, []);
    return out;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function mixSeed(runSeed, roundId, attempt) {
    var x = (runSeed >>> 0) ^ Math.imul(roundId, 10007) ^ Math.imul(attempt + 1, 7919);
    x = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    return x || 1;
  }

  function traitSig(s) {
    var bits = "";
    for (var i = 0; i < TRAITS.length; i++) bits += s.traits[TRAITS[i]] ? "1" : "0";
    return bits;
  }

  function whoMatch(suspects, evidence) {
    var hits = [];
    for (var i = 0; i < suspects.length; i++) {
      var s = suspects[i];
      var ok = true;
      for (var k = 0; k < evidence.length; k++) {
        if (s.traits[evidence[k].trait] !== evidence[k].value) ok = false;
      }
      if (ok) hits.push(s);
    }
    return hits;
  }

  function isEvidenceTrait(state, trait) {
    for (var i = 0; i < state.evidence.length; i++) {
      if (state.evidence[i].trait === trait) return true;
    }
    return false;
  }

  function caseProblems(state, spec) {
    var problems = [];
    if (state.suspects.length !== spec.suspects) problems.push("suspect count");
    if (state.evidence.length !== spec.evidence) problems.push("evidence count");
    if (state.questionsMax !== budgetOf(spec)) problems.push("budget");
    if (state.questionsLeft !== state.questionsMax) problems.push("budget start");
    var hits = whoMatch(state.suspects, state.evidence);
    if (hits.length !== 1) problems.push("unique " + hits.length);
    else if (hits[0].id !== state.culpritId) problems.push("culprit mismatch");
    var ev = state.evidence;
    for (var i = 0; i < ev.length; i++) {
      var sub = [];
      for (var k = 0; k < ev.length; k++) if (k !== i) sub.push(ev[k]);
      if (whoMatch(state.suspects, sub).length < 2) problems.push("subset " + ev[i].trait);
    }
    var evMap = {};
    for (i = 0; i < ev.length; i++) evMap[ev[i].trait] = true;
    for (i = 0; i < TRAITS.length; i++) {
      var t = TRAITS[i];
      if (evMap[t]) {
        var culprit = null;
        for (var s = 0; s < state.suspects.length; s++) {
          if (state.suspects[s].id === state.culpritId) culprit = state.suspects[s];
        }
        if (!culprit || culprit.traits[t] !== true) problems.push("culprit polarity " + t);
      } else {
        var v0 = state.suspects[0].traits[t];
        for (s = 1; s < state.suspects.length; s++) {
          if (state.suspects[s].traits[t] !== v0) problems.push("trap split " + t);
        }
      }
    }
    var seen = {};
    for (s = 0; s < state.suspects.length; s++) {
      var sig = traitSig(state.suspects[s]);
      if (seen[sig]) problems.push("clone traits");
      seen[sig] = true;
    }
    if (spec.lying && !state.liarId) problems.push("missing liar");
    if (!spec.lying && state.liarId) problems.push("unexpected liar");
    if (state.offers.length !== 3) problems.push("offer count " + state.offers.length);
    var progress = 0;
    var zeros = 0;
    for (i = 0; i < state.offers.length; i++) {
      if (isProgress(state, state.offers[i])) progress++;
      if (isZero(state, state.offers[i])) zeros++;
    }
    if (progress < 1) problems.push("no progress offer");
    if (zeros < 1) problems.push("no trap offer");
    return problems;
  }

  function buildOffers(state) {
    var rng = mulberry32(state.seed || 1);
    var progress = [];
    var zeros = [];
    var others = [];
    for (var i = 0; i < TRAITS.length; i++) {
      var t = TRAITS[i];
      var group = { kind: "group", trait: t };
      var target = { kind: "target", trait: t };
      if (!state.asked[t] && isEvidenceTrait(state, t)) {
        progress.push(group);
        others.push(target);
      } else {
        zeros.push(group);
        zeros.push(target);
      }
    }
    progress = shuffle(rng, progress);
    zeros = shuffle(rng, zeros);
    others = shuffle(rng, others);
    var offers = [];
    function has(q) {
      for (var n = 0; n < offers.length; n++) {
        if (offers[n].kind === q.kind && offers[n].trait === q.trait) return true;
      }
      return false;
    }
    function take(list) {
      while (list.length && offers.length < 3) {
        var q = list.pop();
        if (!has(q)) offers.push(q);
      }
    }
    if (progress.length) offers.push(progress.pop());
    if (zeros.length) offers.push(zeros.pop());
    take(progress);
    take(zeros);
    take(others);
    offers = shuffle(rng, offers);
    state.seed = rng.getSeed();
    return offers;
  }

  function assignSuspects(set, culpritId, evTraits, rng) {
    var shared = {};
    var i;
    for (i = 0; i < TRAITS.length; i++) shared[TRAITS[i]] = rng.next() < 0.5;
    var evMap = {};
    for (i = 0; i < evTraits.length; i++) evMap[evTraits[i]] = true;
    var suspects = [];
    for (i = 0; i < set.length; i++) {
      var traits = {};
      for (var k = 0; k < TRAITS.length; k++) {
        var t = TRAITS[k];
        traits[t] = evMap[t] ? true : shared[t];
      }
      suspects.push({
        id: set[i].id,
        name: set[i].name,
        look: set[i].look,
        traits: traits,
        eliminated: false,
        revealed: {},
        lied: false
      });
    }
    var others = [];
    for (i = 0; i < suspects.length; i++) {
      if (suspects[i].id !== culpritId) others.push(suspects[i]);
    }
    others = shuffle(rng, others);
    for (i = 0; i < evTraits.length; i++) others[i].traits[evTraits[i]] = false;
    for (var e = evTraits.length; e < others.length; e++) {
      others[e].traits[evTraits[0]] = false;
      if (evTraits.length > 1) others[e].traits[evTraits[1]] = false;
    }
    return suspects;
  }

  function generateCase(spec, seed) {
    var rng = mulberry32(seed || 1);
    var set = shuffle(rng, ROSTER).slice(0, spec.suspects);
    var culprit = set[Math.floor(rng.next() * set.length)];
    var combos = combinations(TRAITS, spec.evidence);
    var evTraits = combos[Math.floor(rng.next() * combos.length)].slice();
    evTraits = shuffle(rng, evTraits);
    var suspects = assignSuspects(set, culprit.id, evTraits, rng);
    var liarId = spec.lying ? suspects[Math.floor(rng.next() * suspects.length)].id : null;
    var asked = {};
    for (var i = 0; i < TRAITS.length; i++) asked[TRAITS[i]] = false;
    var evidence = [];
    for (i = 0; i < evTraits.length; i++) {
      evidence.push({ trait: evTraits[i], value: true, text: EVIDENCE_TEXT[evTraits[i]] });
    }
    var state = {
      roundId: spec.id,
      seed: rng.getSeed() || 1,
      suspects: suspects,
      culpritId: culprit.id,
      liarId: liarId,
      lieUsed: false,
      evidence: evidence,
      asked: asked,
      questionsLeft: budgetOf(spec),
      questionsMax: budgetOf(spec),
      offers: []
    };
    state.offers = buildOffers(state);
    var offerProblems = caseProblems(state, spec);
    if (offerProblems.length) {
      throw new Error("bad case r" + spec.id + " seed " + seed + ": " + offerProblems.join(","));
    }
    var proof = solveGreedy(state);
    if (!proof.ok) throw new Error("unsolvable r" + spec.id + " seed " + seed);
    return state;
  }

  function remainingIds(state) {
    var ids = [];
    for (var i = 0; i < state.suspects.length; i++) {
      if (!state.suspects[i].eliminated) ids.push(state.suspects[i].id);
    }
    return ids;
  }

  function remainingCount(state) {
    return remainingIds(state).length;
  }

  function findSuspect(state, id) {
    for (var i = 0; i < state.suspects.length; i++) {
      if (state.suspects[i].id === id) return state.suspects[i];
    }
    return null;
  }

  function isProgress(state, q) {
    return !!(q && q.kind === "group" && !state.asked[q.trait] && isEvidenceTrait(state, q.trait));
  }

  function isZero(state, q) {
    if (!q) return false;
    if (q.kind === "group") return !isProgress(state, q);
    if (q.kind === "target") {
      if (!state.asked[q.trait] && isEvidenceTrait(state, q.trait)) return false;
      return true;
    }
    return false;
  }

  function applyQuestion(state, q, selectedId) {
    if (!q) return { state: state, consumed: false, reason: "empty" };
    if (state.questionsLeft <= 0) return { state: state, consumed: false, reason: "empty" };
    if (q.kind === "target") {
      if (!selectedId) return { state: state, consumed: false, reason: "need-select" };
      var picked = findSuspect(state, selectedId);
      if (!picked || picked.eliminated) return { state: state, consumed: false, reason: "need-select" };
    }
    var next = cloneState(state);
    next.questionsLeft -= 1;
    var involved = q.kind === "group" ? next.suspects.slice() : [findSuspect(next, selectedId)];
    var lie = false;
    var lieId = null;
    for (var i = 0; i < involved.length; i++) {
      var s = involved[i];
      var truth = !!s.traits[q.trait];
      var shown = truth;
      var wasLie = false;
      if (next.liarId && s.id === next.liarId && !next.lieUsed) {
        shown = !truth;
        wasLie = true;
        lie = true;
        lieId = s.id;
        next.lieUsed = true;
        s.lied = true;
      }
      s.revealed[q.trait] = { truth: truth, shown: shown, lie: wasLie };
    }
    var eliminatedIds = [];
    if (isEvidenceTrait(next, q.trait)) {
      var targets = q.kind === "group" ? next.suspects : [findSuspect(next, selectedId)];
      for (i = 0; i < targets.length; i++) {
        var person = targets[i];
        if (person.eliminated) continue;
        if (person.traits[q.trait] !== true) {
          person.eliminated = true;
          eliminatedIds.push(person.id);
        }
      }
    }
    if (q.kind === "group") next.asked[q.trait] = true;
    next.offers = next.questionsLeft > 0 ? buildOffers(next) : [];
    return {
      state: next,
      consumed: true,
      lie: lie,
      lieId: lieId,
      eliminatedIds: eliminatedIds,
      eliminatedCount: eliminatedIds.length
    };
  }

  function solveGreedy(state) {
    var current = cloneState(state);
    var guard = 0;
    var lies = 0;
    while (remainingCount(current) > 1 && current.questionsLeft > 0 && guard++ < 12) {
      var q = null;
      for (var i = 0; i < current.offers.length; i++) {
        if (isProgress(current, current.offers[i])) q = current.offers[i];
      }
      if (!q) return { ok: false, state: current, lies: lies, reason: "no-progress" };
      var res = applyQuestion(current, q, null);
      if (!res.consumed) return { ok: false, state: current, lies: lies, reason: "not-consumed" };
      if (res.lie) lies++;
      current = res.state;
    }
    var ids = remainingIds(current);
    var ok = ids.length === 1 && ids[0] === current.culpritId;
    return { ok: ok, state: current, lies: lies };
  }

  function exhaustCareless(state) {
    var current = cloneState(state);
    var guard = 0;
    while (current.questionsLeft > 0 && remainingCount(current) > 1 && guard++ < 12) {
      var q = null;
      for (var i = 0; i < current.offers.length; i++) {
        if (isZero(current, current.offers[i])) q = current.offers[i];
      }
      if (!q) return { state: current, reason: "no-trap" };
      var selected = null;
      if (q.kind === "target") {
        var live = remainingIds(current);
        selected = live[0];
      }
      var before = remainingCount(current);
      var res = applyQuestion(current, q, selected);
      if (!res.consumed) return { state: current, reason: "not-consumed" };
      if (remainingCount(res.state) !== before) {
        return { state: res.state, reason: "trap-eliminated" };
      }
      current = res.state;
    }
    return { state: current, reason: "spent" };
  }

  function statusLine(n) {
    if (n <= 1) return "この人しか残ってないよ";
    return "まだ候補が" + n + "人";
  }

  function lineAfter(state, info) {
    if (info && info.liePending) return LIE_LINE;
    var n = remainingCount(state);
    var core = statusLine(n);
    if (info && info.eliminatedCount === 0 && n > 1) core = "候補は減らない。" + core;
    if (state.questionsLeft <= 0) core = "質問はもうない。" + core;
    return core;
  }

  function culpritName(state) {
    var s = findSuspect(state, state.culpritId);
    return s ? s.name : "";
  }

  function failLine(name) {
    return "ちがう…犯人は" + name + "だった！";
  }

  function timeoutLine(name) {
    return "時間切れ…犯人は" + name + "だった！";
  }

  function successLine(name) {
    return "そのとおり！犯人は" + name + "だ";
  }

  function evidenceLine(state) {
    var parts = [];
    for (var i = 0; i < state.evidence.length; i++) parts.push(state.evidence[i].text);
    return "証拠：" + parts.join("・");
  }

  function failSub(practice) {
    if (practice) return "練習なので♥は減らない。新しい条件でやりなおし";
    return "♥−1。新しい条件で、この事件をやりなおし";
  }

  function briefNotes(spec) {
    var lines = [];
    if (spec.practice) lines.push("練習：まちがえても♥は減らない");
    if (spec.intro === "lie") lines.push("新ルール：1人が一度だけウソ。汗・ゆれ・音は逆");
    else if (spec.lying) lines.push("ウソあり：汗・ゆれ・音が出たら逆");
    lines.push("まちがい・時間切れは、新しい条件でやりなおし");
    return lines;
  }

  function briefHam(spec) {
    if (spec.practice) return "練習だよ。まちがえてもハートは減らない";
    if (spec.intro === "lie") return "新しいルール。1人が一度だけウソをつく";
    if (spec.lying) return "ウソに注意。汗と音が出たら逆だ";
    if (spec.id === 6) return "最後の事件だ。質問は無駄にできない";
    return "証拠に合う質問をタップだ";
  }

  function startHam(spec) {
    if (spec.intro === "lie") return "汗が出たら、その答えは逆だよ";
    if (spec.practice) return "証拠の言葉に合う質問をタップ";
    return "証拠を見て、質問をタップだ";
  }

  function endReaction(rank, hearts) {
    if (rank === "名探偵" && hearts === 2) return { mood: "smug", line: "完璧だ。プリンの謎は解けた" };
    if (rank === "一人前" && hearts === 1) return { mood: "think", line: "全件解けた。ハートは1つ減った" };
    return { mood: "shock", line: "途中で失敗しちゃった" };
  }

  function rankFor(cleared, hearts) {
    if (cleared >= 6 && hearts === 2) return "名探偵";
    if (cleared >= 6 && hearts === 1) return "一人前";
    return "見習い";
  }

  function nextHearts(hearts, practice) {
    if (practice) return hearts;
    return hearts - 1;
  }

  function questionLabel(q) {
    var base = QUESTION_TEXT[q.trait];
    if (q.kind === "group") return "全員・" + base;
    return "この人・" + base;
  }

  function answerText(trait, value) {
    return ANSWER[trait][value ? 1 : 0];
  }

  function shareText(rank, cleared, hearts) {
    return "プリン消失事件「" + rank + "」" + cleared + "/6解決 残りハート" + hearts + "。質問をタップして犯人を当てる";
  }

  function auditRounds() {
    var problems = [];
    if (ROUNDS.length !== 6) problems.push("round count");
    var scores = ROUNDS.map(difficultyScore);
    for (var i = 0; i < ROUNDS.length; i++) {
      var r = ROUNDS[i];
      if (r.time < 25 || r.time > 45) problems.push("time range " + r.id);
      if (r.suspects < r.evidence + 1) problems.push("not enough suspects " + r.id);
      if (budgetOf(r) !== r.evidence + r.spare) problems.push("budget " + r.id);
      if (i > 0 && !(scores[i] > scores[i - 1])) problems.push("score " + r.id);
      if (i > 0 && !(r.time < ROUNDS[i - 1].time)) problems.push("time slope " + r.id);
    }
    if (ROUNDS[0].time !== 45 || ROUNDS[5].time !== 25) problems.push("time ends");
    if (!ROUNDS[0].practice) problems.push("practice");
    for (i = 1; i < ROUNDS.length; i++) if (ROUNDS[i].practice) problems.push("late practice");
    if (ROUNDS[3].intro !== "lie" || !ROUNDS[3].lying) problems.push("lie intro");
    if (ROUNDS[0].lying || ROUNDS[1].lying || ROUNDS[2].lying) problems.push("early lie");
    if (!ROUNDS[4].lying || !ROUNDS[5].lying) problems.push("late lie");
    if (ROUNDS[4].intro || ROUNDS[5].intro) problems.push("extra intro");
    if (!(ROUNDS[3].suspects < ROUNDS[2].suspects)) problems.push("intro suspects");
    if (!(ROUNDS[3].spare > ROUNDS[2].spare)) problems.push("intro spare");
    if (!(scores[5] > scores[4] && scores[5] > scores[0])) problems.push("final not hardest");
    var maxSuspects = 0;
    var minSpare = 99;
    var minTime = 99;
    var maxEvidence = 0;
    for (i = 0; i < ROUNDS.length; i++) {
      if (ROUNDS[i].suspects > maxSuspects) maxSuspects = ROUNDS[i].suspects;
      if (ROUNDS[i].spare < minSpare) minSpare = ROUNDS[i].spare;
      if (ROUNDS[i].time < minTime) minTime = ROUNDS[i].time;
      if (ROUNDS[i].evidence > maxEvidence) maxEvidence = ROUNDS[i].evidence;
    }
    if (ROUNDS[5].suspects !== maxSuspects) problems.push("r6 suspects");
    if (ROUNDS[5].spare !== minSpare) problems.push("r6 spare");
    if (ROUNDS[5].time !== minTime) problems.push("r6 time");
    if (ROUNDS[5].evidence !== maxEvidence) problems.push("r6 evidence");
    if (ROUNDS[5].spare !== 0) problems.push("r6 spare zero");
    if (RULES.length !== 3) problems.push("rules length");
    if (RULES[2].indexOf("練習") < 0 || RULES[2].indexOf("ノーカウント") < 0) problems.push("practice rule");
    if (RANK_LINE !== "名探偵＝ハート減らずに全解決／一人前＝ハート1つ減で全解決／見習い＝途中で失敗") {
      problems.push("rank line");
    }
    if (/\d人|まだ候補|この人しか/.test(LIE_LINE)) problems.push("lie line count");
    if (briefHam(ROUNDS[0]).indexOf("減らない") < 0) problems.push("practice ham");
    if (briefNotes(ROUNDS[0]).join(" ").indexOf("減らない") < 0) problems.push("practice note");
    return { ok: problems.length === 0, problems: problems, scores: scores };
  }

  return {
    TRAITS: TRAITS,
    QUESTION_TEXT: QUESTION_TEXT,
    TRAIT_SHORT: TRAIT_SHORT,
    EVIDENCE_TEXT: EVIDENCE_TEXT,
    ROSTER: ROSTER,
    ROUNDS: ROUNDS,
    RULES: RULES,
    RANK_LINE: RANK_LINE,
    LIE_LINE: LIE_LINE,
    PLAY_URL: PLAY_URL,
    ANNOUNCE: ANNOUNCE,
    difficultyScore: difficultyScore,
    budgetOf: budgetOf,
    mixSeed: mixSeed,
    cloneState: cloneState,
    generateCase: generateCase,
    applyQuestion: applyQuestion,
    solveGreedy: solveGreedy,
    exhaustCareless: exhaustCareless,
    remainingCount: remainingCount,
    remainingIds: remainingIds,
    isProgress: isProgress,
    isZero: isZero,
    statusLine: statusLine,
    lineAfter: lineAfter,
    culpritName: culpritName,
    failLine: failLine,
    timeoutLine: timeoutLine,
    successLine: successLine,
    evidenceLine: evidenceLine,
    failSub: failSub,
    briefNotes: briefNotes,
    briefHam: briefHam,
    startHam: startHam,
    endReaction: endReaction,
    rankFor: rankFor,
    nextHearts: nextHearts,
    questionLabel: questionLabel,
    answerText: answerText,
    shareText: shareText,
    findSuspect: findSuspect,
    auditRounds: auditRounds
  };
});
