/* Node checks for the speed band, round slope, copy, and page wiring. */
var fs = require("fs");
var path = require("path");
var L = require("./logic.js");

var failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

var audit = L.auditRounds();
check(audit.ok, "audit " + audit.problems.join(", "));
console.log("scores", audit.scores.map(function (n) { return n.toFixed(1); }).join(" < "));

check(L.RULES.length === 3, "rules count");
check(L.RULES.join("\n").indexOf("速すぎ") >= 0, "rule fast");
check(L.RULES.join("\n").indexOf("遅すぎ") >= 0, "rule slow");
check(L.RULES.join("\n").indexOf("指が離れる") >= 0, "rule lift");
check(L.RULES.join("\n").indexOf("最初から") >= 0, "rule restart");
check(L.RULES.join("\n").indexOf("ハートは2つ") >= 0, "rule hearts");
check(L.RULES.join("\n").indexOf("帯がせまい") >= 0, "rule narrow");
check(L.RULES.join("\n").indexOf("帯がゆれる") >= 0, "rule drift");
check(L.RULES.join("\n").indexOf("こぶ") >= 0, "rule bumps");
check(L.RULES.join("\n").indexOf("マウス") >= 0 && L.RULES.join("\n").indexOf("指") >= 0, "rule inputs");
check(L.PRACTICE_NOTE.indexOf("ランクに入らない") >= 0, "practice rank");
check(L.PRACTICE_NOTE.indexOf("ハートは減らない") >= 0, "practice heart");
check(L.RANK_LINE.indexOf("ハロウィン王") >= 0 && L.RANK_LINE.indexOf("まるむき") >= 0 && L.RANK_LINE.indexOf("ちぎり") >= 0, "rank line");
check(L.REASON.fast === "速すぎ", "reason fast");
check(L.REASON.slow === "遅すぎ", "reason slow");
check(L.REASON.lift === "指が離れた", "reason lift");
check(L.CLEAR_WORD === "まるむき！", "clear word");
check(L.FAIL_HEAD === "ゲームオーバー", "fail head");
check(L.HERO === "ポル", "hero");
check(L.ANNOUNCE.length <= 140, "announce length " + L.ANNOUNCE.length);
check(L.ANNOUNCE.indexOf(L.PAGE) >= 0, "announce url");
check(L.ANNOUNCE.indexOf("ポル") >= 0, "announce hero");
check(L.PAGE.indexOf("2026-10-30-pumpkin-peel") >= 0, "page slug");
check(L.speak("title").text.indexOf("ねむ") < 0, "no sleepy title");
check(L.speak("end", { rank: "ちぎり" }).mood === "shock", "fail mood");
check(L.speak("end", { rank: "ハロウィン王" }).mood === "cheer", "win mood");
check(L.speak("ok").text.indexOf("まるむき") >= 0, "ok line");
check(L.speak("fast", { practice: true }).text.indexOf("ハートはそのまま") >= 0, "practice tear line");
check(L.speak("fast", { practice: false }).text.indexOf("最初から") >= 0, "ranked tear line");
check(L.speak("bump").mood === "worry", "bump mood");
check(L.speak("card", { practice: true }).text.indexOf("ランクに入らない") >= 0, "card practice");
check(L.speak("card", { practice: false, line: L.ROUNDS[3].line }).text.indexOf("こぶ") >= 0, "card bump");
check(L.tearDetail(true).indexOf("ハートはそのまま") >= 0, "tear detail practice");
check(L.tearDetail(false).indexOf("最初から") >= 0, "tear detail ranked");

check(L.rankFor(true, 0) === "ハロウィン王", "rank perfect");
check(L.rankFor(true, 1) === "まるむき", "rank clear");
check(L.rankFor(false, 0) === "ちぎり", "rank over");
check(L.rankFor(false, 2) === "ちぎり", "rank over tears");
check(L.nextHearts(2, true) === 2, "practice heart");
check(L.nextHearts(2, false) === 1, "heart loss");
check(L.nextHearts(1, false) === 0, "heart zero");
check(L.commitCm(0, L.ROUNDS[0]) === 0, "practice cm");
check(L.commitCm(0, L.ROUNDS[1]) === L.peelCm(L.ROUNDS[1]), "ranked cm");
var full = 0;
for (var r = 1; r < L.ROUNDS.length; r++) full = L.commitCm(full, L.ROUNDS[r]);
check(full === 612, "full cm " + full);
check(L.quote("ハロウィン王", full) === "かぼちゃらせん皮むき「ハロウィン王」皮612cm", "quote");
check(L.quote("ハロウィン王", full).indexOf("ねむ") < 0, "quote sleepy");

check(L.judgeSpeed(0.8, { min: 0.5, max: 1.1 }) === "ok", "judge ok");
check(L.judgeSpeed(0.2, { min: 0.5, max: 1.1 }) === "slow", "judge slow");
check(L.judgeSpeed(1.4, { min: 0.5, max: 1.1 }) === "fast", "judge fast");
check(L.torn(0.2, 0.3) === false, "not torn");
check(L.torn(0.3, 0.3) === true, "torn");
var danger = 0;
danger = L.stepDanger(danger, 0.1, "fast");
danger = L.stepDanger(danger, 0.1, "ok");
check(danger < 0.1, "danger decays");

var drifted = L.bandAt(L.ROUNDS[2], L.ROUNDS[2].driftPeriod / 4);
check(Math.abs(drifted.center - (L.ROUNDS[2].center + L.ROUNDS[2].driftAmp)) < 1e-6, "drift peak");
check(L.wartAngles(L.ROUNDS[3]).length === 3, "3 warts");
check(L.wartAngles(L.ROUNDS[5]).length === 4, "4 warts");
check(L.nearWart(L.ROUNDS[3], L.wartAngles(L.ROUNDS[3])[0], 0.05) === true, "on wart");
check(L.nearWart(L.ROUNDS[3], 0, 0.05) === false, "off wart");

function hold(speed) {
  return function () { return speed; };
}
L.ROUNDS.forEach(function (spec) {
  var ideal = L.simulate(spec, L.idealPolicy(spec));
  check(ideal.result === "clear", "ideal r" + spec.id + " " + ideal.result + " @" + ideal.t.toFixed(2));
  var fast = L.simulate(spec, hold(1.75));
  check(fast.result === "fast", "fast r" + spec.id + " " + fast.result);
  var slow = L.simulate(spec, hold(0.02));
  check(slow.result === "slow", "slow r" + spec.id + " " + slow.result);
});
check(L.simulate(L.ROUNDS[1], function (t) { return t > 0.25 ? "lift" : 0.82; }).result === "lift", "lift");
check(L.simulate(L.ROUNDS[2], hold(L.ROUNDS[2].center)).result === "slow", "drift punishes fixed speed");
check(L.simulate(L.ROUNDS[3], hold(L.ROUNDS[3].center)).result === "fast", "bump punishes center");
check(L.simulate(L.ROUNDS[5], hold(L.ROUNDS[5].center)).result !== "clear", "r6 fixed fails");
check(L.ROUNDS[5].driftAmp > 0 && L.ROUNDS[5].bumps > 0 && L.ROUNDS[5].width < L.ROUNDS[1].width, "r6 combines");

var root = path.join(__dirname, "..", "..");
var gallery = fs.readFileSync(path.join(root, "index.html"), "utf8");
var game = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
check(gallery.indexOf("games/2026-10-30-pumpkin-peel/index.html") >= 0, "gallery link");
check(gallery.indexOf("games/2026-10-30-pumpkin-peel") < gallery.indexOf("games/2026-10-29-red-pen-circle"), "gallery first");
check(gallery.indexOf("Day 35") >= 0, "day 35");
check(game.indexOf("ねむねむ") < 0, "no sleepy theme");
check(game.indexOf("logic.js") >= 0, "logic src");
check(!/href="\//.test(game), "no root href");
check(!/src="\//.test(game), "no root src");
L.RULES.forEach(function (rule) {
  check(game.indexOf(rule) >= 0, "html rule " + rule);
});
check(game.indexOf(L.PRACTICE_NOTE) >= 0, "html practice");
check(game.indexOf(L.RANK_LINE) >= 0, "html rank line");
check(game.indexOf("速すぎ") >= 0 && game.indexOf("遅すぎ") >= 0 && game.indexOf("指が離れた") >= 0, "html reasons");
check(game.indexOf("pointerdown") >= 0 && game.indexOf("pointermove") >= 0 && game.indexOf("pointerup") >= 0, "pointer");
check(game.indexOf("touch-action: none") >= 0, "touch action");
check(game.indexOf("gauge") >= 0, "gauge");
check(game.indexOf("ポル") >= 0, "hero visible");
check(game.indexOf("id=\"hearts\"") >= 0, "hearts");
check(game.indexOf("id=\"brief\"") >= 0, "intro card");
check(game.indexOf("id=\"end\"") >= 0, "end card");
check(game.indexOf("まるむき") >= 0, "success word");
check(game.indexOf("ゲームオーバー") >= 0, "fail word");
check(!/\.go\s*\{[^}]*animation/.test(game), "go not animated");
check(!/\.retry\s*\{[^}]*animation/.test(game), "retry not animated");
check(game.indexOf("ランクに入らない") >= 0, "rank exclusion copy");

if (failures.length) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ok", L.ANNOUNCE.length, "announce chars");
console.log(L.ANNOUNCE);
