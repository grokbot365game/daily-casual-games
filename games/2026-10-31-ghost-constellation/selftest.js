/* Node checks for the memory score, round slope, copy, and page wiring. */
var fs = require("fs");
var path = require("path");
var L = require("./logic.js");

var failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

var audit = L.auditRounds();
check(audit.ok, "audit " + audit.problems.join(", "));
console.log(audit.table.join("\n"));
console.log("deltas", audit.deltas.map(function (n) { return n.toFixed(1); }).join(" < "));
console.log("ratio", audit.ratio.toFixed(2));

check(L.RULES.length === 3, "rules count");
check(L.RULES[0] === "見えた星をおぼえて、同じ順にタップ", "rule a");
check(L.RULES[1].indexOf("ずれが大きいとハート1つ減る") >= 0, "rule b stake");
check(L.RULES[1].indexOf("ハート3つ") >= 0 && L.RULES[1].indexOf("練習はノーカウント") >= 0, "rule b hearts");
check(L.RULES[2] === "R4から おばけ雲 が星をかくす", "rule c");
L.RULES.forEach(function (rule) {
  check(rule.indexOf("\n") < 0, "rule one line");
  check(rule.length <= 42, "rule short " + rule.length);
});
check(L.RULES.join("").indexOf("秒") < 0, "rules omit per-round seconds");
check(L.PRACTICE_NOTE.indexOf("練習") >= 0 && L.PRACTICE_NOTE.indexOf("ハートは減らない") >= 0, "practice note");
check(L.RANK_LINE === "全クリア＋ハート3＝大魔女 / 全クリア＝魔女 / R4以上＝見習い / それ未満＝かけだし", "rank line");
check(L.FAIL_HEAD === "ずれが大きい", "fail head");
check(L.PASS_HEAD === "合格", "pass head");
check(L.HERO === "ミャジョ", "hero");
check(L.HEARTS === 3, "3 hearts");
check(L.COMMIT_MS === 400, "commit 0.4s");
check(L.UNDO_PER_ROUND === 1, "one undo");
check(L.ANNOUNCE.length <= 140, "announce length " + L.ANNOUNCE.length);
check(L.ANNOUNCE.indexOf(L.PAGE) >= 0, "announce url");
check(L.ANNOUNCE.indexOf("#ハロウィン") >= 0, "announce tag");
check(L.ANNOUNCE.indexOf("タップ") >= 0, "announce tap");
check(L.ANNOUNCE.indexOf("ハート") >= 0, "announce hearts");
check(L.PAGE.indexOf("2026-10-31-ghost-constellation") >= 0, "page slug");

check(L.isTap(120, 4) === true, "short tap");
check(L.isTap(L.TAP_MAX_MS, L.TAP_MAX_MOVE) === true, "edge tap");
check(L.isTap(L.TAP_MAX_MS + 1, 0) === false, "hold is not a tap");
check(L.isTap(80, L.TAP_MAX_MOVE + 1) === false, "drag is not a tap");
check(L.canUndo(0, 1) === true, "undo available");
check(L.canUndo(1, 2) === false, "undo spent");
check(L.canUndo(0, 0) === false, "undo empty");

check(L.nextHearts(3, true, false) === 3, "practice keeps heart");
check(L.nextHearts(3, false, false) === 2, "ranked miss");
check(L.nextHearts(1, false, false) === 0, "last heart");
check(L.nextHearts(2, false, true) === 2, "pass keeps heart");
check(L.rankFor(true, 3, 6) === "大魔女", "rank perfect");
check(L.rankFor(true, 2, 6) === "魔女", "rank clear");
check(L.rankFor(true, 1, 6) === "魔女", "rank clear low hearts");
check(L.rankFor(false, 2, 4) === "見習い", "rank r4");
check(L.rankFor(false, 0, 6) === "見習い", "rank r6 fail");
check(L.rankFor(false, 3, 3) === "かけだし", "rank early");
check(L.rankFor(false, 3, 0) === "かけだし", "rank practice only");

var perfect = [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.75, y: 0.4 }];
check(L.accuracyPercent(perfect, perfect, 0.3) === 100, "perfect acc");
var far = perfect.map(function () { return { x: 0.02, y: 0.02 }; });
check(L.accuracyPercent(perfect, far, 0.2) === 0, "far acc");
L.ROUNDS.forEach(function (spec) {
  var rng = L.mulberry32(1000 + spec.id * 17);
  var pat = L.createPattern(spec, rng);
  check(L.accuracyPercent(pat.stars, pat.stars, spec.tol) === 100, "perfect r" + spec.id);
  check(L.passed(100, spec) === true, "pass ceiling " + spec.id);
  check(L.passed(spec.pass, spec) === true, "pass line inclusive " + spec.id);
  check(L.passed(spec.pass - 1, spec) === false, "below line " + spec.id);
  var onLine = pat.stars.map(function (p) {
    return { x: p.x + spec.tol * (1 - spec.pass / 100), y: p.y };
  });
  check(L.accuracyPercent(pat.stars, onLine, spec.tol) === spec.pass, "distance maps to pass " + spec.id);
});

check(L.speak("title").text.indexOf("タップ") >= 0, "title tap");
check(L.speak("title").text.indexOf("秒") < 0, "title no seconds");
check(L.speak("card", { practice: true }).text.indexOf("ハートは減らない") >= 0, "card practice");
check(L.speak("card", { cloud: true, last: false }).text.indexOf("おばけ雲") >= 0, "card cloud");
check(L.speak("card", { cloud: true, last: true }).text.indexOf("いちばん短い") >= 0, "card last");
check(L.speak("card", { cloud: false, practice: false }).text.indexOf("雲") < 0, "card no fake cloud");
check(L.speak("now").text.indexOf("いま！") >= 0, "now line");
check(L.speak("recall", { placed: 0 }).text.indexOf("1つめ") >= 0, "recall first");
check(L.speak("recall", { placed: 2 }).text.indexOf("3つめ") >= 0, "recall third");
check(L.speak("commit").text.indexOf("ぜんぶ置いた") >= 0, "commit line");
check(L.speak("undo", { placed: 1 }).text.indexOf("ひとつ戻した") >= 0, "undo line");
check(L.speak("undo", { placed: 1 }).text.indexOf("2つめ") >= 0, "undo next");
check(L.speak("view").text.indexOf("タップ") < 0, "view does not ask for taps yet");
check(L.speak("cloud").text.indexOf("かくしてる") >= 0, "cloud line");
var practiceFail = L.speak("result", { practice: true, hearts: 3, passed: false }).text;
check(practiceFail.indexOf("ハートは減らない") >= 0 && practiceFail.indexOf("ハート−1") < 0, "practice fail speech");
var rankedFail = L.speak("result", { practice: false, hearts: 2, passed: false }).text;
check(rankedFail.indexOf("ハート−1") >= 0, "ranked fail speech");
var dead = L.speak("result", { practice: false, hearts: 0, passed: false }).text;
check(dead.indexOf("ハートがなくなった") >= 0 && dead.indexOf("ハート−1") < 0, "dead speech");
check(L.speak("result", { practice: false, hearts: 3, passed: true }).text === "合格！", "pass speech");
check(L.speak("result", { practice: true, hearts: 3, passed: true }).text.indexOf("ハートはそのまま") >= 0, "practice pass");
check(L.resultCopy(true, 3, false).head === "ずれが大きい", "copy head");
check(L.resultCopy(true, 3, false).sub.indexOf("減らない") >= 0, "copy practice");
check(L.resultCopy(false, 2, false).sub === "ハート−1", "copy minus");
check(L.resultCopy(false, 0, false).sub === "ハートがなくなった", "copy zero");
check(L.speak("end", { rank: "大魔女" }).text.indexOf("ハート3") >= 0, "end perfect");
check(L.speak("end", { rank: "魔女" }).text.indexOf("大魔女") < 0, "end witch not arch");
check(L.speak("end", { rank: "魔女" }).text.indexOf("全クリア") >= 0, "end witch clear");
check(L.speak("end", { rank: "見習い", reached: "R5" }).text.indexOf("R5") >= 0, "end apprentice round");
check(L.speak("end", { rank: "見習い", reached: "R5" }).text.indexOf("全クリア") < 0, "apprentice not clear");
check(L.speak("end", { rank: "かけだし" }).text.indexOf("見習い") < 0, "early not apprentice");
L.ROUNDS.forEach(function (spec) {
  var info = L.roundInfo(spec);
  check(info.stars === String(spec.stars), "info stars");
  check(info.view === spec.view.toFixed(1), "info view");
  check(info.pass === String(spec.pass), "info pass");
  check(info.cloud === !!spec.cloud, "info cloud");
});
check(L.roundInfo(L.ROUNDS[0]).title === "練習", "practice title");
check(L.roundInfo(L.ROUNDS[6]).last === true, "r6 last");
check(L.roundInfo(L.ROUNDS[4]).last === false, "r4 not last");

var shapes = {};
var orders = { lo: 0, hi: 0 };
var cloudDir = { lr: 0, rl: 0, other: 0 };
var coverOk = 0;
var badPattern = 0;
var seenPos = {};
var s;
for (s = 1; s <= 48; s++) {
  var pat = L.createPattern(L.ROUNDS[6], L.mulberry32(s * 7919));
  shapes[pat.shape] = (shapes[pat.shape] || 0) + 1;
  if (pat.stars.length !== 6 || !pat.cloud) badPattern++;
  var key = pat.stars.map(function (p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join("|");
  seenPos[key] = true;
  if (pat.stars[0].x <= pat.stars[pat.stars.length - 1].x) orders.lo++;
  else orders.hi++;
  if (pat.cloud.x1 > pat.cloud.x0 + 0.3) cloudDir.lr++;
  else if (pat.cloud.x0 > pat.cloud.x1 + 0.3) cloudDir.rl++;
  else cloudDir.other++;
  if (Math.abs((pat.cloud.t1 - pat.cloud.t0) - L.ROUNDS[6].cloud.dur) > 0.021) badPattern++;
  var covered = 0;
  var step;
  for (step = 0; step <= 8; step++) {
    var u = pat.cloud.t0 + (pat.cloud.t1 - pat.cloud.t0) * (step / 8);
    covered = Math.max(covered, L.coverCount(pat.stars, pat.cloud, u));
  }
  if (covered >= 1) coverOk++;
  var i, j;
  for (i = 0; i < pat.stars.length; i++) {
    if (pat.stars[i].x < 0.09 || pat.stars[i].x > 0.91) badPattern++;
    for (j = 0; j < i; j++) {
      var d = Math.hypot(pat.stars[i].x - pat.stars[j].x, pat.stars[i].y - pat.stars[j].y);
      if (d < L.minSep(6) - 1e-6) badPattern++;
    }
  }
}
check(Object.keys(shapes).length >= 3, "shape variety " + JSON.stringify(shapes));
check(orders.lo > 0 && orders.hi > 0, "order varies");
check(cloudDir.lr > 0 && cloudDir.rl > 0, "cloud path varies");
check(coverOk >= 40, "cloud hides a star " + coverOk);
check(Object.keys(seenPos).length >= 40, "positions vary");
check(badPattern === 0, "bad patterns " + badPattern);
var again = L.createPattern(L.ROUNDS[2], L.mulberry32(42));
var again2 = L.createPattern(L.ROUNDS[2], L.mulberry32(42));
check(JSON.stringify(again) === JSON.stringify(again2), "seed stable");
var other = L.createPattern(L.ROUNDS[2], L.mulberry32(43));
check(JSON.stringify(again.stars) !== JSON.stringify(other.stars), "seed changes stars");

var root = path.join(__dirname, "..", "..");
var gallery = fs.readFileSync(path.join(root, "index.html"), "utf8");
var game = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
check(gallery.indexOf("games/2026-10-31-ghost-constellation/index.html") >= 0, "gallery link");
check(gallery.indexOf("games/2026-10-31-ghost-constellation") < gallery.indexOf("games/2026-10-30-pumpkin-peel"), "gallery first");
check(gallery.indexOf("Day 36") >= 0, "day 36");
check(game.indexOf("logic.js") >= 0, "logic src");
check(!/href="\//.test(game), "no root href");
check(!/src="\//.test(game), "no root src");
check(game.indexOf("../../index.html") >= 0, "gallery back");
L.RULES.forEach(function (rule) {
  check(game.indexOf(rule) >= 0, "html rule");
});
check(game.indexOf(L.PRACTICE_NOTE) >= 0, "html practice");
check(game.indexOf(L.RANK_LINE) >= 0, "html rank line");
check(game.indexOf("いま！") >= 0, "html now");
check(game.indexOf("ひとつ戻す") >= 0, "html undo");
check(game.indexOf("id=\"pass-line\"") >= 0, "pass line el");
check(game.indexOf("id=\"meter\"") >= 0, "countdown bar");
check(game.indexOf("ミャジョ") >= 0, "hero visible");
check(game.indexOf("id=\"hearts\"") >= 0, "hearts");
check(game.indexOf("id=\"brief\"") >= 0, "round card");
check(game.indexOf("id=\"end\"") >= 0, "end card");
check(game.indexOf("L.isTap") >= 0, "tap gate");
check(game.indexOf("L.COMMIT_MS") >= 0, "commit constant");
check(game.indexOf("pointerdown") >= 0 && game.indexOf("pointerup") >= 0, "pointer");
var down = game.split("function onDown")[1].split("function onMove")[0];
var move = game.split("function onMove")[1].split("function onUp")[0];
var up = game.split("function onUp")[1].split("function onCancel")[0];
check(down.indexOf("placeAt") < 0, "down does not place");
check(move.indexOf("placeAt") < 0, "move does not place");
check(up.indexOf("L.isTap") >= 0 && up.indexOf("placeAt") >= 0, "up places taps");
check(game.indexOf("タップに制限時間はない") >= 0, "no recall timeout cue");
check(game.indexOf("時間切れ") < 0, "no timeout fail copy");
var title = game.split('id="title"')[1].split('id="brief"')[0];
check(title.indexOf("秒") < 0, "title has no seconds");
check(title.indexOf("合格ライン") < 0, "title has no pass line");
check(title.indexOf("%") < 0, "title has no percent");
check(game.indexOf("合格ライン") >= 0, "pass line somewhere");
check(game.indexOf("function drawCloudCore") >= 0, "cloud drawn");

if (failures.length) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ok", L.ANNOUNCE.length, "announce chars");
console.log(L.ANNOUNCE);
