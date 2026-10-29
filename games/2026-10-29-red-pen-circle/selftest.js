/* Node checks for round slope, stroke judgment, copy, and page wiring. */
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
check(L.RULES[0] === "ひとつだけちがう絵を見つける", "rule 1");
check(L.RULES[1] === "指でぐるっと○でかこむ", "rule 2");
check(L.RULES[2] === "まちがい・時間切れでハート−1(ハート2つ)", "rule 3");
L.RULES.forEach(function (rule) {
  check(!/\d+\s*[×x]\s*\d+/.test(rule), "rule has grid " + rule);
  check(!/\d+秒/.test(rule), "rule has seconds " + rule);
});
check(L.PRACTICE_NOTE === "ラウンド1は練習(ハートは減らない)", "practice note");
check(L.RANK_LINE === "はなまる:ノーミス全クリ / 合格:クリア / 補習:ゲームオーバー", "rank line");
check(L.PERCENT_NOTE.indexOf("実データではありません") >= 0, "percent note");
check(L.FAIL_WRONG === "ブブー！", "fail wrong");
check(L.FAIL_TIME === "時間切れ！", "fail time");
check(L.ANNOUNCE.length <= 140, "announce length " + L.ANNOUNCE.length);
check(L.ANNOUNCE.indexOf("{URL}") >= 0, "announce url");
check(L.ANNOUNCE.indexOf("ミケ先生") >= 0, "announce mike");
check(L.ANNOUNCE.indexOf("ぐるっと○") >= 0, "announce loop");
check(L.ANNOUNCE.indexOf("6ラウンド") >= 0, "announce rounds");
check(L.ANNOUNCE.indexOf("細かく") >= 0, "announce grid");

check(L.rankFor(true, 0) === "はなまる", "rank perfect");
check(L.rankFor(true, 1) === "合格", "rank clear");
check(L.rankFor(false, 0) === "補習", "rank over");
check(L.nextHearts(2, true) === 2, "practice heart");
check(L.nextHearts(2, false) === 1, "heart loss");
check(L.nextHearts(1, false) === 0, "heart zero");

check(L.percentile(25) === 2, "pct 25");
check(L.percentile(0) === 1, "pct clamp low");
check(L.percentile(200) === 99, "pct clamp high");
check(L.percentile(25 + 10 / 0.9) === 12, "pct +10");

var timeLine = L.speak("time", { practice: false }).text;
check(timeLine.indexOf("時間切れ") >= 0, "time line");
check(timeLine.indexOf("残り") < 0 && timeLine.indexOf("あと少し") < 0, "time line no countdown");
check(L.speak("time", { practice: true }).text.indexOf("ハートは減らない") >= 0, "practice timeout");
check(L.speak("low", { sec: 4 }).text === "残り4秒！", "low line");
check(L.speak("ok").text === "はなまる！" && L.speak("ok").mood === "happy", "ok line");
check(L.speak("bad", { practice: false }).mood === "shock", "bad mood");
check(L.speak("bad", { practice: true }).text.indexOf("ハートはそのまま") >= 0, "practice bad");
check(L.speak("end", { rank: "合格" }).text.indexOf("はなまる") < 0, "pass not hanamaru");
check(L.speak("end", { rank: "はなまる" }).mood === "happy", "end happy");
check(L.speak("end", { rank: "補習" }).mood === "shock", "end shock");
check(L.speak("card", { practice: true }).text.indexOf("ハートは減らない") >= 0, "card practice");
check(L.speak("card", { intro: true }).text.indexOf("ゆらゆら") >= 0, "card intro");
check(L.speak("hint-small").text === L.HINT_SMALL, "hint small");
check(L.speak("hint-close").text === L.HINT_CLOSE, "hint close");
check(L.speak("hint-circle").text === L.HINT_CIRCLE, "hint circle");
check(L.ROUNDS[3].note === "NEW! 絵がゆらゆら動く", "r4 note");
check(L.roundInfo(L.ROUNDS[3]).grid === "6×6", "r4 grid label");
check(L.roundInfo(L.ROUNDS[0]).title.indexOf("練習") >= 0, "r1 title");

function circle(cx, cy, r, n) {
  var pts = [];
  var steps = n || 36;
  for (var i = 0; i <= steps; i++) {
    var a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}
function tilesOf(n, cell) {
  var tiles = [];
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var x = c * cell, y = r * cell;
      tiles.push({ cx: x + cell / 2, cy: y + cell / 2, left: x, top: y, right: x + cell, bottom: y + cell });
    }
  }
  return tiles;
}
function line(x0, y0, x1, y1) {
  var pts = [];
  for (var i = 0; i <= 20; i++) {
    pts.push({ x: x0 + (x1 - x0) * i / 20, y: y0 + (y1 - y0) * i / 20 });
  }
  return pts;
}

var grid = tilesOf(3, 100);
var one = L.evaluateStroke(circle(50, 50, 30), grid, 100);
check(one.kind === "pick" && one.index === 0, "one tile " + one.kind + " " + one.index);
var many = L.evaluateStroke(circle(150, 150, 160), grid, 100);
check(many.kind === "small" && many.message === "もっと小さく○してね", "many " + many.kind);
var tap = L.evaluateStroke([{ x: 10, y: 10 }, { x: 12, y: 11 }], grid, 100);
check(tap.kind === "circle" && tap.message === "ぐるっと○でかこんでね", "tap");
var straight = L.evaluateStroke(line(0, 40, 280, 48), grid, 100);
check(straight.kind === "circle", "straight " + straight.kind + " " + straight.message);
var diag = L.evaluateStroke(line(10, 10, 240, 220), grid, 100);
check(diag.kind === "circle", "diag " + diag.kind);

var arc = [];
for (var i = 0; i <= 18; i++) {
  var a = -Math.PI / 2 + (i / 18) * Math.PI * 1.35;
  arc.push({ x: 150 + Math.cos(a) * 46, y: 150 + Math.sin(a) * 46 });
}
var open = L.evaluateStroke(arc, grid, 100);
check(open.kind === "close" && open.message === "ぐるっと一周かこんでね", "open " + open.kind + " " + open.message);

var corner = L.evaluateStroke(circle(22, 24, 16), grid, 100);
check(corner.kind === "pick" && corner.index === 0, "centroid fallback " + corner.kind + " " + corner.index);

var loose = circle(-220, -180, 130);
check(L.evaluateStroke(loose, grid, 100).kind === "small", "loose outside");

var big = circle(0, 0, 40, 48);
big[big.length - 1] = { x: big[0].x + 27.9, y: big[0].y };
check(L.loopMetrics(big).closed, "gap 27.9 closes");
big[big.length - 1] = { x: big[0].x + 28, y: big[0].y };
check(!L.loopMetrics(big).closed, "gap 28 stays open");
var smallLoop = circle(0, 0, 20, 32);
smallLoop[smallLoop.length - 1] = { x: smallLoop[0].x + 27, y: smallLoop[0].y };
var sm = L.loopMetrics(smallLoop);
check(sm.closeLimit === 28 && sm.closed, "floor 28 closes a small loop");

var icons = {}, kinds = {}, odds = {}, hues = {};
for (var s = 1; s <= 80; s++) {
  var puz = L.createPuzzle(L.ROUNDS[1], L.mulberry32(s));
  icons[puz.icon] = 1;
  kinds[puz.kind] = 1;
  odds[puz.odd] = 1;
  hues[puz.hue] = 1;
  check(puz.odd >= 0 && puz.odd < 16, "odd range");
  check(!puz.sway, "r2 no sway");
}
check(Object.keys(icons).length >= 5, "icon variety " + Object.keys(icons).length);
check(Object.keys(kinds).length >= 4, "kind variety " + Object.keys(kinds).join(","));
check(Object.keys(odds).length >= 8, "odd variety");
check(Object.keys(hues).length >= 20, "hue variety");

for (var s2 = 1; s2 <= 40; s2++) {
  var a = L.createPuzzle(L.ROUNDS[0], L.mulberry32(1000 + s2));
  var b = L.createPuzzle(L.ROUNDS[0], L.mulberry32(2000 + s2));
  check(a.kind === "shade" && a.diff.shadeBy === "hue" && a.diff.amount >= 110, "r1 hue");
  check(a.icon !== b.icon || a.odd !== b.odd || a.hue !== b.hue, "retry changes");
  var sway = L.createPuzzle(L.ROUNDS[3], L.mulberry32(3000 + s2));
  check(!!sway.sway && sway.kind !== "rotate" && sway.diff.deg === 0, "r4 no rotate");
  var hard = L.createPuzzle(L.ROUNDS[5], L.mulberry32(4000 + s2));
  check(hard.kind !== "rotate" && hard.kind !== "mirror", "r6 kind " + hard.kind);
  check(!!hard.sway, "r6 sway");
  if (hard.kind === "shade") check(hard.diff.amount >= 7, "r6 shade visible " + hard.diff.amount);
}

var page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
var gallery = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
L.RULES.forEach(function (rule) { check(page.indexOf(rule) >= 0, "page rule " + rule); });
check(page.indexOf(L.PRACTICE_NOTE) >= 0, "page practice");
check(page.indexOf(L.RANK_LINE) >= 0, "page rank");
check(page.indexOf(L.PERCENT_NOTE) >= 0, "page percent");
check(page.indexOf("briefNote.textContent = info.note") >= 0, "page shows round note");
check(page.indexOf("pointerdown") >= 0, "pointerdown");
check(page.indexOf("touch-action: none") >= 0, "touch action");
check(page.indexOf('href="../../index.html"') >= 0, "gallery link");
check(page.indexOf("ミケ先生") >= 0, "mike name");
check(page.indexOf("はなまる") >= 0, "hanamaru");
check(page.indexOf("ねむねむ") < 0 && page.indexOf("おやすみ") < 0 && page.indexOf("あと少し") < 0, "page banned");
check(page.indexOf("logic.js") >= 0, "logic script");
var first = gallery.slice(gallery.indexOf("<nav>"), gallery.indexOf("</nav>"));
var firstHref = first.match(/href="([^"]+)"/);
check(firstHref && firstHref[1].indexOf("2026-10-29-red-pen-circle") >= 0, "gallery first " + (firstHref && firstHref[1]));
check(gallery.indexOf("ねむねむ") >= 0, "older sleepy titles stay in gallery");
check(gallery.indexOf("2026-10-29-red-pen-circle") < gallery.indexOf("2026-10-28-pudding-culprit"), "newest before day 33");

var banned = ["ねむねむ", "おやすみ", "あと少し"];
var logicSrc = fs.readFileSync(path.join(__dirname, "logic.js"), "utf8");
banned.forEach(function (word) {
  check(logicSrc.indexOf(word) < 0, "logic banned " + word);
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("selftest ok", L.ANNOUNCE.length);
