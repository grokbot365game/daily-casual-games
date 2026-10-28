/* Self-play the deduction: many random cases, the difficulty table, and the page copy. */
var fs = require("fs");
var path = require("path");
var L = require("./logic.js");

var failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

var audit = L.auditRounds();
check(audit.ok, "audit " + audit.problems.join(", "));
console.log("scores", audit.scores.join(" < "));

check(L.RULES.length === 3, "rules count");
check(L.RULES[0] === "3つの質問から1つタップして聞きこみ", "rule 1");
check(L.RULES[1] === "証拠に合う1人をタップして『犯人だ！』", "rule 2");
check(L.RULES[2] === "まちがい・時間切れでハート−1（練習はノーカウント）", "rule 3");
check(L.ANNOUNCE.length <= 120, "announce length " + L.ANNOUNCE.length);
check(L.ANNOUNCE.indexOf("タップ") >= 0, "announce tap");
check(L.ANNOUNCE.indexOf("ハート2") >= 0, "announce hearts");
check(L.ANNOUNCE.indexOf("6件") >= 0, "announce cases");
check(L.ANNOUNCE.indexOf("ノーカウント") >= 0, "announce practice");
check(L.ANNOUNCE.indexOf("質問") >= 0, "announce questions");

for (var n = 1; n <= 5; n++) {
  var line = L.statusLine(n);
  if (n === 1) {
    check(line === "この人しか残ってないよ", "status 1");
    check(line.indexOf("2人") < 0 && line.indexOf("まだ候補") < 0, "status 1 no leftover");
  } else {
    check(line === "まだ候補が" + n + "人", "status " + n);
    check(line.indexOf("この人しか") < 0, "status " + n + " not singular");
  }
}
check(L.LIE_LINE.indexOf("人") < 0, "lie line has no person count");

check(L.rankFor(6, 2) === "名探偵", "rank perfect");
check(L.rankFor(6, 1) === "一人前", "rank one heart");
check(L.rankFor(5, 2) === "見習い", "rank incomplete");
check(L.rankFor(3, 0) === "見習い", "rank zero");
check(L.nextHearts(2, true) === 2, "practice heart");
check(L.nextHearts(2, false) === 1, "real heart");
check(L.endReaction("名探偵", 2).mood === "smug", "smug");
check(L.endReaction("見習い", 0).mood === "shock", "shock");
check(L.endReaction("一人前", 1).line.indexOf("1つ") >= 0, "one heart line");
check(L.failLine("猫") === "ちがう…犯人は猫だった！", "fail line");
check(L.timeoutLine("犬") === "時間切れ…犯人は犬だった！", "timeout line");
check(L.failSub(true).indexOf("減らない") >= 0, "fail sub practice");
check(L.failSub(false).indexOf("♥−1") >= 0, "fail sub heart");

var phrases = ["3時どこにいた？", "手(足)を見せて", "スプーン使える？", "背は届く？", "甘い匂いは？"];
phrases.forEach(function (p) {
  var found = false;
  L.TRAITS.forEach(function (t) {
    if (L.QUESTION_TEXT[t] === p) found = true;
  });
  check(found, "question phrase " + p);
});
check(L.questionLabel({ kind: "group", trait: "alibi" }) === "全員・3時どこにいた？", "group label");
check(L.questionLabel({ kind: "target", trait: "paw" }) === "この人・手(足)を見せて", "target label");

var SEEDS = 200;
L.ROUNDS.forEach(function (spec) {
  var culprits = {};
  var evidenceKeys = {};
  var orders = {};
  var offerKeys = {};
  var lieFlippedInnocent = 0;
  var lieFlippedCulprit = 0;
  for (var seed = 1; seed <= SEEDS; seed++) {
    var state = L.generateCase(spec, L.mixSeed(0xabc, spec.id, seed));
    check(state.questionsMax === spec.evidence + spec.spare, "budget r" + spec.id);
    check(state.offers.length === 3, "3 offers r" + spec.id + " seed " + seed);
    var progressN = 0;
    var zeroN = 0;
    state.offers.forEach(function (q) {
      if (L.isProgress(state, q)) progressN++;
      if (L.isZero(state, q)) zeroN++;
      check(L.questionLabel(q).indexOf(L.QUESTION_TEXT[q.trait]) >= 0, "label has phrase");
    });
    check(progressN >= 1 && zeroN >= 1, "offer mix r" + spec.id);

    var greedy = L.solveGreedy(state);
    check(greedy.ok, "greedy r" + spec.id + " seed " + seed);
    check(greedy.state.questionsLeft === spec.spare, "spare left r" + spec.id + " seed " + seed + " left " + (greedy.ok ? greedy.state.questionsLeft : "?"));
    check(L.remainingCount(state) === spec.suspects, "original untouched");
    if (spec.lying) check(greedy.lies === 1, "one lie on the smart path r" + spec.id + " lies " + greedy.lies);
    else check(greedy.lies === 0, "no lie");

    var careless = L.exhaustCareless(state);
    check(careless.reason !== "trap-eliminated", "trap eliminated r" + spec.id + " " + careless.reason);
    check(careless.reason !== "no-trap", "no trap r" + spec.id);
    check(L.remainingCount(careless.state) >= 2, "careless left " + L.remainingCount(careless.state) + " r" + spec.id + " seed " + seed);

    var after = L.lineAfter(greedy.state, { eliminatedCount: 1 });
    check(after.indexOf("この人しか残ってないよ") >= 0, "solved line");
    check(!/[2-9]人/.test(after), "solved line count " + after);

    culprits[state.culpritId] = true;
    evidenceKeys[state.evidence.map(function (e) { return e.trait; }).sort().join(",")] = true;
    orders[state.suspects.map(function (s) { return s.id; }).join(",")] = true;
    offerKeys[state.offers.map(function (q) { return q.kind + ":" + q.trait; }).join("|")] = true;

    if (spec.lying) {
      var q0 = null;
      for (var i = 0; i < state.offers.length; i++) if (L.isProgress(state, state.offers[i])) q0 = state.offers[i];
      var first = L.applyQuestion(state, q0, null);
      check(first.lie === true, "first group lies");
      check(first.consumed === true, "consumed");
      var liar = L.findSuspect(first.state, state.liarId);
      var rev = liar.revealed[q0.trait];
      check(rev && rev.lie && rev.shown !== rev.truth, "shown is flipped");
      check(liar.lied === true, "lied flag");
      if (rev.truth === false) {
        check(liar.eliminated === true, "false truth still out");
        lieFlippedInnocent++;
      }
      if (liar.id === state.culpritId) {
        check(liar.eliminated === false, "culprit stays");
        lieFlippedCulprit++;
      }
      var secondTrait = null;
      for (var t = 0; t < state.evidence.length; t++) {
        if (state.evidence[t].trait !== q0.trait) secondTrait = state.evidence[t].trait;
      }
      if (secondTrait) {
        var again = L.applyQuestion(first.state, { kind: "group", trait: secondTrait }, null);
        check(again.lie === false, "second answer honest");
      }
      var untouched = L.applyQuestion(state, { kind: "target", trait: q0.trait }, null);
      check(untouched.consumed === false && untouched.state === state, "target needs a person");
    }

    var mid = L.lineAfter(state, { eliminatedCount: 0 });
    check(mid.indexOf("まだ候補が" + spec.suspects + "人") >= 0, "open line " + mid);
    check(mid.indexOf("この人しか") < 0, "open line not singular");
  }
  check(Object.keys(culprits).length >= 4, "culprit variety r" + spec.id + " " + Object.keys(culprits).length);
  check(Object.keys(evidenceKeys).length >= 4, "evidence variety r" + spec.id + " " + Object.keys(evidenceKeys).length);
  check(Object.keys(orders).length >= 5, "order variety r" + spec.id + " " + Object.keys(orders).length);
  check(Object.keys(offerKeys).length >= 3, "offer variety r" + spec.id + " " + Object.keys(offerKeys).length);
  if (spec.lying) {
    check(lieFlippedInnocent > 0, "saw a lying innocent r" + spec.id);
    check(lieFlippedCulprit > 0, "saw a lying culprit r" + spec.id);
  }
});

var a = L.generateCase(L.ROUNDS[0], L.mixSeed(99, 1, 0));
var b = L.generateCase(L.ROUNDS[0], L.mixSeed(99, 1, 1));
var sig = function (s) {
  return s.culpritId + "/" + s.evidence.map(function (e) { return e.trait; }).join(",") + "/" + s.suspects.map(function (p) { return p.id + L.TRAITS.map(function (t) { return p.traits[t] ? 1 : 0; }).join(""); }).join("|");
};
check(sig(a) !== sig(b), "retry changes the case");

var html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var title = html.split('id="title"')[1].split('id="brief"')[0];
L.RULES.forEach(function (rule) {
  check(title.indexOf(rule) >= 0, "title has rule " + rule);
});
check(!/45秒|25秒|容疑者|残り質問/.test(title), "title has no round numbers");
check(html.indexOf('href="../../index.html"') >= 0, "gallery link");
check(html.indexOf("pointerdown") < 0 && html.indexOf("pointermove") < 0, "no hold or drag handlers");
check(html.indexOf("犯人だ！") >= 0, "accuse label");
check(html.indexOf("結果をXでシェア") >= 0, "share button");
check(html.indexOf("PuddingLogic") >= 0 || html.indexOf("logic.js") >= 0, "uses logic");
check(html.indexOf("ねむ") < 0, "no sleepy theme");

if (failures.length) {
  console.error("FAIL " + failures.length);
  failures.slice(0, 40).forEach(function (f) { console.error(" - " + f); });
  process.exit(1);
}
console.log("PASS " + SEEDS + " cases x " + L.ROUNDS.length + " rounds");
console.log("announce (" + L.ANNOUNCE.length + ")", L.ANNOUNCE);
