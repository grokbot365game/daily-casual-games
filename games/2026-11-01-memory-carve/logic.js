/* おぼえてきざめ — rounds, carve score, mirror, copy.
   No DOM. Safe to require() from the node self-test.

   Input is a HOLD while the chisel auto-sweeps left to right.
   It is not a drag (Day 35 かぼちゃらせん皮むき: the pointer path
   steers the peel) and not a tap (Day 36 おばけ星座: a short
   pointerup with almost no movement places a star).
   Horizontal finger movement does not choose a column.
   Cutting happens only while the hold is down, at CUT_RATE,
   on whichever column the sweep is over. Release stops the cut.
   Over-cutting is permanent.

   Rounds: 練習 then R1..R6. Hardness rises every step, including
   inside each round's column-count and sweep-speed band
   (easiest roll of a round is still harder than the hardest
   roll of the previous round).
   R4 introduces 左右反転 alone and lightens columns, show time,
   sweep, and pass line. R5 and R6 keep the flip and tighten.
   R6 is the hardest on columns, show time, sweep, and pass line. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CarveLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HEARTS = 3;
  var CUT_RATE = 0.85;
  var GOOD_BAND = 0.06;
  var BROKEN_OVER = 0.22;
  var NOW_MS = 450;
  var SETTLE_MS = 220;
  var PAGE = "https://grokbot365game.github.io/daily-casual-games/games/2026-11-01-memory-carve/";
  var ANNOUNCE = "おぼえてきざめ。ノミは自動で進む。長押しで削る（離すと止まる）。精度不足か割れでハート−1。#ブラウザゲーム " + PAGE;

  /* Hardness. Higher = harder.
     cols: more heights to remember and to cut
     view: less time to look
     pass: higher accuracy bar
     speed: 1/seconds-per-column, faster sweep
     mirror: must carve the left-right reverse (flat cost).
     The mirror weight is larger than one parameter because R4
     lightens every other load; the NET step stays in line with
     the other gaps. Audit checks both the net slope and that
     R4's non-mirror score is below R3. */
  var WEIGHT = { cols: 5, view: 10, pass: 0.5, speed: 7, mirror: 24, viewBase: 3, passBase: 60 };
  var MAX_STEP_RATIO = 2.4;

  var ROUNDS = [
    { id: 0, practice: true, mirror: false, cols: [3, 4], view: 2.6, sweep: [1.72, 1.80], pass: 64, note: "練習：ハートは減らない" },
    { id: 1, practice: false, mirror: false, cols: [4, 5], view: 2.3, sweep: [1.52, 1.60], pass: 76, note: "" },
    { id: 2, practice: false, mirror: false, cols: [5, 6], view: 2.0, sweep: [1.36, 1.44], pass: 82, note: "" },
    { id: 3, practice: false, mirror: false, cols: [6, 7], view: 1.8, sweep: [1.22, 1.28], pass: 88, note: "" },
    { id: 4, practice: false, mirror: true, cols: [5, 6], view: 2.1, sweep: [1.40, 1.48], pass: 80, note: "NEW! 左右反転" },
    { id: 5, practice: false, mirror: true, cols: [6, 7], view: 1.7, sweep: [1.14, 1.20], pass: 91, note: "反転のまま、さらにきびしい" },
    { id: 6, practice: false, mirror: true, cols: [8, 9], view: 1.3, sweep: [1.02, 1.08], pass: 95, note: "いちばんむずかしい" }
  ];

  var RULES = [
    "ノミは自動で進む。長押しで削る（離すと止まる）",
    "精度%は高さの近さ。届かないか割れでハート−1（3つ・練習は減らない）",
    "割れ＝ブロックの22%より深く削りすぎ（赤・戻せない）"
  ];
  var PRACTICE_NOTE = "最初の1回は練習（ハートは減らない）";
  var CUE_LINE = "金色のあいだに離す。赤く光ったら割れ";
  var SWEEP_NOTE = "秒/列が短いほど速い";
  var RANK_LINE = "全クリア＋ハート3＝巨匠 / 全クリア＝彫り師 / R4以上＝助手 / それ未満＝石ころ";
  var FAIL_BROKEN = "割れ";
  var FAIL_LOW = "精度不足";
  var PASS_HEAD = "合格";
  var HERO = "ベル";

  var SHAPES = [
    { id: "neko", name: "ねこ", samples: [0.30, 0.36, 0.44, 0.58, 0.66, 0.60, 0.70, 0.82, 0.92, 0.68, 0.46, 0.34] },
    { id: "roket", name: "ロケット", samples: [0.32, 0.48, 0.40, 0.52, 0.60, 0.70, 0.78, 0.88, 0.74, 0.56, 0.40, 0.28] },
    { id: "ki", name: "木", samples: [0.26, 0.34, 0.48, 0.70, 0.88, 0.72, 0.50, 0.38, 0.30, 0.26, 0.24, 0.22] },
    { id: "kinoko", name: "きのこ", samples: [0.22, 0.34, 0.62, 0.80, 0.86, 0.70, 0.46, 0.34, 0.40, 0.52, 0.36, 0.24] },
    { id: "kagi", name: "かぎ", samples: [0.80, 0.90, 0.78, 0.58, 0.40, 0.34, 0.52, 0.32, 0.48, 0.30, 0.40, 0.26] },
    { id: "shiro", name: "しろ", samples: [0.36, 0.32, 0.46, 0.40, 0.52, 0.48, 0.60, 0.56, 0.78, 0.92, 0.66, 0.42] },
    { id: "sakana", name: "さかな", samples: [0.28, 0.40, 0.34, 0.50, 0.64, 0.76, 0.84, 0.68, 0.54, 0.66, 0.48, 0.32] },
    { id: "ie", name: "いえ", samples: [0.34, 0.50, 0.68, 0.86, 0.64, 0.44, 0.40, 0.40, 0.40, 0.56, 0.74, 0.46] },
    { id: "fune", name: "ふね", samples: [0.28, 0.44, 0.66, 0.84, 0.58, 0.40, 0.32, 0.28, 0.26, 0.30, 0.36, 0.24] },
    { id: "tori", name: "とり", samples: [0.32, 0.56, 0.80, 0.62, 0.42, 0.50, 0.60, 0.46, 0.36, 0.48, 0.34, 0.26] }
  ];

  function hardness(cols, view, sweep, pass, mirror) {
    return cols * WEIGHT.cols
      + (WEIGHT.viewBase - view) * WEIGHT.view
      + (pass - WEIGHT.passBase) * WEIGHT.pass
      + (1 / sweep) * WEIGHT.speed
      + (mirror ? WEIGHT.mirror : 0);
  }

  function bandEdges(spec) {
    return {
      easy: hardness(spec.cols[0], spec.view, spec.sweep[1], spec.pass, spec.mirror),
      hard: hardness(spec.cols[1], spec.view, spec.sweep[0], spec.pass, spec.mirror),
      easyNum: hardness(spec.cols[0], spec.view, spec.sweep[1], spec.pass, false),
      hardNum: hardness(spec.cols[1], spec.view, spec.sweep[0], spec.pass, false)
    };
  }

  function auditRounds() {
    var problems = [];
    var i;
    if (ROUNDS.length !== 7) problems.push("round count");
    if (ROUNDS[0].practice !== true || ROUNDS[0].id !== 0) problems.push("practice");
    if (Math.abs(BROKEN_OVER - 0.22) > 1e-9) problems.push("broken constant");
    var prev = null;
    var gaps = [];
    var scores = [];
    for (i = 0; i < ROUNDS.length; i++) {
      var spec = ROUNDS[i];
      var edge = bandEdges(spec);
      scores.push(edge);
      if (!spec.practice && spec.id !== i) problems.push("id " + spec.id);
      if (spec.practice !== (i === 0)) problems.push("practice flag " + i);
      if (!(spec.cols[0] >= 3 && spec.cols[1] >= spec.cols[0] && spec.cols[1] <= 9)) problems.push("cols " + spec.id);
      if (spec.cols[1] === spec.cols[0]) problems.push("cols fixed " + spec.id);
      if (!(spec.sweep[1] > spec.sweep[0])) problems.push("sweep band " + spec.id);
      if (!(spec.view > 0) || !(spec.pass > 0)) problems.push("bad " + spec.id);
      if (i < 4 && spec.mirror) problems.push("early mirror " + spec.id);
      if (i >= 4 && !spec.mirror) problems.push("missing mirror " + spec.id);
      if (spec.note.indexOf("NEW!") === 0) {
        if (i !== 4) problems.push("NEW slot " + spec.id);
        if (!spec.mirror) problems.push("NEW without mirror");
      }
      if (prev) {
        var gap = edge.easy - scores[i - 1].hard;
        gaps.push(gap);
        if (!(gap > 0)) problems.push("hardness " + spec.id);
        var intro = spec.note.indexOf("NEW!") === 0;
        if (intro) {
          if (!(spec.view > prev.view)) problems.push("intro view");
          if (!(spec.pass < prev.pass)) problems.push("intro pass");
          if (!(spec.sweep[0] > prev.sweep[1])) problems.push("intro sweep");
          if (!(spec.cols[1] < prev.cols[1] && spec.cols[0] < prev.cols[0])) problems.push("intro cols");
          if (!(edge.hardNum < scores[i - 1].easyNum)) problems.push("intro numeric");
          if (prev.mirror) problems.push("intro not first mirror");
        } else {
          if (!(spec.view < prev.view)) problems.push("view " + spec.id);
          if (!(spec.pass > prev.pass)) problems.push("pass " + spec.id);
          if (!(spec.sweep[1] < prev.sweep[0])) problems.push("sweep " + spec.id);
          if (!(spec.cols[0] > prev.cols[0] && spec.cols[1] > prev.cols[1])) problems.push("cols up " + spec.id);
        }
      }
      prev = spec;
    }
    var last = ROUNDS[ROUNDS.length - 1];
    var lastEdge = scores[scores.length - 1];
    for (i = 0; i < ROUNDS.length - 1; i++) {
      var s = ROUNDS[i];
      if (!(last.view < s.view)) problems.push("r6 view");
      if (!(last.pass > s.pass)) problems.push("r6 pass");
      if (!(last.sweep[1] < s.sweep[0])) problems.push("r6 sweep");
      if (!(last.cols[0] > s.cols[1])) problems.push("r6 cols");
      if (!(lastEdge.easy > scores[i].hard)) problems.push("r6 hardest");
    }
    if (ROUNDS[3].mirror || !ROUNDS[4].mirror) problems.push("mirror intro");
    var minD = Math.min.apply(null, gaps);
    var maxD = Math.max.apply(null, gaps);
    var ratio = maxD / minD;
    if (!(minD > 0)) problems.push("flat");
    if (ratio > MAX_STEP_RATIO) problems.push("step ratio " + ratio.toFixed(2));
    return {
      ok: problems.length === 0,
      problems: problems,
      gaps: gaps,
      ratio: ratio,
      scores: scores.map(function (s) { return s.hard; }),
      table: roundTable()
    };
  }

  function roundTable() {
    return ROUNDS.map(function (s) {
      var edge = bandEdges(s);
      return (s.practice ? "練習" : ("R" + s.id))
        + " " + s.cols[0] + "-" + s.cols[1] + "列"
        + " " + s.view.toFixed(1) + "s"
        + " " + s.sweep[0].toFixed(2) + "-" + s.sweep[1].toFixed(2) + "s/列"
        + " 合格" + s.pass + "%"
        + (s.mirror ? " 反転" : "")
        + " h" + edge.easy.toFixed(1) + "-" + edge.hard.toFixed(1);
    });
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function sampleAt(samples, x) {
    var i = Math.floor(x);
    if (i < 0) i = 0;
    if (i >= samples.length - 1) return samples[samples.length - 1];
    var t = x - i;
    return samples[i] + (samples[i + 1] - samples[i]) * t;
  }

  function resample(samples, n) {
    var out = [];
    var i;
    var k;
    for (i = 0; i < n; i++) {
      var a = i * samples.length / n;
      var b = (i + 1) * samples.length / n;
      var sum = 0;
      var c = 0;
      for (k = a; k < b - 1e-6; k += 0.05) {
        sum += sampleAt(samples, Math.min(k, samples.length - 1.0001));
        c++;
      }
      if (!c) {
        sum = sampleAt(samples, (a + b) / 2);
        c = 1;
      }
      out.push(sum / c);
    }
    return out;
  }

  function mirrorGap(h) {
    var sum = 0;
    var i;
    for (i = 0; i < h.length; i++) sum += Math.abs(h[i] - h[h.length - 1 - i]);
    return sum / h.length;
  }

  function meanOf(h) {
    var sum = 0;
    var i;
    for (i = 0; i < h.length; i++) sum += h[i];
    return sum / h.length;
  }

  function contrast(h) {
    var min = h[0];
    var max = h[0];
    var i;
    for (i = 1; i < h.length; i++) {
      if (h[i] < min) min = h[i];
      if (h[i] > max) max = h[i];
    }
    return max - min;
  }

  function prepareHeights(samples, n, sweep, rng) {
    var h = resample(samples, n);
    var i;
    var guard;
    for (i = 0; i < h.length; i++) h[i] += (rng() - 0.5) * 0.03;
    var minH = Math.max(0.18, 1 - sweep * CUT_RATE * 0.9);
    var hi = 0.94;
    for (guard = 0; guard < 4 && contrast(h) < 0.3; guard++) {
      var mid = meanOf(h);
      var span = Math.max(0.001, contrast(h));
      for (i = 0; i < h.length; i++) h[i] = mid + (h[i] - mid) / span * 0.4;
    }
    for (guard = 0; guard < 10 && mirrorGap(h) < 0.3; guard++) {
      for (i = 0; i < h.length; i++) {
        var t = n === 1 ? 0.5 : i / (n - 1);
        h[i] += (t - 0.5) * 0.07;
      }
    }
    var extra = meanOf(h) - 0.54;
    if (extra > 0) {
      for (i = 0; i < h.length; i++) h[i] -= extra;
    }
    for (i = 0; i < h.length; i++) h[i] = clamp(h[i], minH, hi);
    for (guard = 0; guard < 8 && mirrorGap(h) < 0.26; guard++) {
      for (i = 0; i < h.length; i++) {
        var u = n === 1 ? 0.5 : i / (n - 1);
        h[i] = clamp(h[i] + (u - 0.5) * 0.06, minH, hi);
      }
    }
    if (mirrorGap(h) < 0.26 || contrast(h) < 0.24) {
      for (i = 0; i < h.length; i++) {
        var p = n === 1 ? 0.5 : i / (n - 1);
        var v = 0.32 + Math.sin(p * Math.PI) * 0.16 + p * 0.3;
        h[i] = clamp(v, minH, hi);
      }
    }
    return h;
  }

  function rollSweep(spec, rng) {
    var raw = spec.sweep[0] + rng() * (spec.sweep[1] - spec.sweep[0]);
    var sweep = Math.round(raw * 100) / 100;
    if (sweep < spec.sweep[0]) sweep = Math.round(spec.sweep[0] * 100) / 100;
    if (sweep > spec.sweep[1]) sweep = Math.round(spec.sweep[1] * 100) / 100;
    return sweep;
  }

  function rollRound(spec, rng, avoidId) {
    var cols = spec.cols[0] + Math.floor(rng() * (spec.cols[1] - spec.cols[0] + 1));
    var sweep = rollSweep(spec, rng);
    var idx = Math.floor(rng() * SHAPES.length);
    if (avoidId && SHAPES[idx].id === avoidId) idx = (idx + 1 + Math.floor(rng() * (SHAPES.length - 1))) % SHAPES.length;
    var shape = SHAPES[idx];
    var heights = prepareHeights(shape.samples, cols, sweep, rng);
    var shown = heights.slice();
    var targets = spec.mirror ? heights.slice().reverse() : heights.slice();
    var speed = Math.round((1 / sweep) * 100) / 100;
    return {
      id: spec.id,
      practice: !!spec.practice,
      mirror: !!spec.mirror,
      intro: spec.note.indexOf("NEW!") === 0,
      last: spec.id === ROUNDS[ROUNDS.length - 1].id && !spec.practice,
      cols: cols,
      sweep: sweep,
      speed: speed,
      view: spec.view,
      pass: spec.pass,
      shapeId: shape.id,
      shapeName: shape.name,
      shown: shown,
      targets: targets,
      note: spec.note || ""
    };
  }

  function cut(remain, dt) {
    if (!(dt > 0)) return remain;
    var next = remain - CUT_RATE * dt;
    if (next < 0) next = 0;
    return next;
  }

  function isBroken(target, remain) {
    return target - remain >= BROKEN_OVER - 1e-6;
  }

  function zone(target, remain) {
    if (isBroken(target, remain)) return "broken";
    if (Math.abs(remain - target) <= GOOD_BAND + 1e-6) return "good";
    if (remain < target) return "deep";
    return "high";
  }

  function crossedGood(before, after, target) {
    var line = target + GOOD_BAND;
    return before > line + 1e-9 && after <= line + 1e-6;
  }

  function crossedBroken(before, after, target) {
    var line = target - BROKEN_OVER;
    return before > line + 1e-6 && after <= line + 1e-6;
  }

  function columnIndex(u, cols) {
    if (!(u >= 0) || !(cols > 0)) return 0;
    if (u >= 1) return cols - 1;
    var i = Math.floor(u * cols);
    if (i < 0) return 0;
    if (i > cols - 1) return cols - 1;
    return i;
  }

  function accuracyPercent(targets, remains) {
    if (!targets || !remains || remains.length !== targets.length || !targets.length) return 0;
    var sum = 0;
    var i;
    for (i = 0; i < targets.length; i++) {
      var err = Math.abs(remains[i] - targets[i]);
      if (err > 1) err = 1;
      sum += 1 - err;
    }
    return Math.round((sum / targets.length) * 100);
  }

  function brokenCount(targets, remains) {
    if (!targets || !remains) return 0;
    var n = 0;
    var i;
    for (i = 0; i < targets.length; i++) {
      if (isBroken(targets[i], remains[i])) n++;
    }
    return n;
  }

  function reasonFor(pct, broken, pass) {
    if (broken > 0) return "broken";
    if (pct < pass) return "low";
    return "pass";
  }

  function passed(pct, broken, pass) {
    return reasonFor(pct, broken, pass) === "pass";
  }

  function nextHearts(hearts, practice, didPass) {
    if (didPass || practice) return hearts;
    return hearts > 0 ? hearts - 1 : 0;
  }

  function rankFor(cleared, hearts, reachedId) {
    if (cleared && hearts >= HEARTS) return "巨匠";
    if (cleared) return "彫り師";
    if (reachedId >= 4) return "助手";
    return "石ころ";
  }

  function labelFor(roll) {
    return roll.practice ? "練習" : ("R" + roll.id);
  }

  function roundInfo(roll) {
    return {
      title: roll.practice ? "練習" : ("R" + roll.id),
      kicker: roll.practice ? "練習ラウンド" : "ラウンド開始",
      index: roll.practice ? "練習" : ("R" + roll.id + " / R6"),
      cols: String(roll.cols),
      view: roll.view.toFixed(1),
      speed: roll.speed.toFixed(2),
      perCol: roll.sweep.toFixed(2),
      pass: String(roll.pass),
      note: roll.note || "",
      mirror: !!roll.mirror,
      intro: !!roll.intro,
      last: !!roll.last,
      shapeName: roll.shapeName
    };
  }

  function resultCopy(practice, heartsAfter, reason) {
    if (reason === "pass" && practice) return { head: PASS_HEAD, sub: "ハートはそのまま" };
    if (reason === "pass") return { head: PASS_HEAD, sub: "次のラウンドへ" };
    var head = reason === "broken" ? FAIL_BROKEN : FAIL_LOW;
    if (practice) return { head: head, sub: "ハートは減らない" };
    if (heartsAfter <= 0) return { head: head, sub: "ハートがなくなった" };
    return { head: head, sub: "ハート−1" };
  }

  function speak(kind, ctx) {
    ctx = ctx || {};
    if (kind === "title") return { mood: "cheer", text: "形を見て、長押しでノミが削るよ" };
    if (kind === "card") {
      if (ctx.practice) return { mood: "happy", text: "練習だよ。ハートは減らない" };
      if (ctx.mirror && ctx.last) return { mood: "worry", text: "左右反対。ノミがいちばん速く、合格ラインも最高" };
      if (ctx.intro) return { mood: "cheer", text: "見た形の左右反対を彫るよ" };
      if (ctx.mirror) return { mood: "focus", text: "左右反対を彫るよ" };
      return { mood: "cheer", text: "消えたら、長押しで削ろう" };
    }
    if (kind === "show") {
      if (ctx.mirror) return { mood: "focus", text: "見た形の左右反対だよ" };
      return { mood: "focus", text: "この形をおぼえて" };
    }
    if (kind === "now") return { mood: "cheer", text: "彫れ！長押しだよ" };
    if (kind === "sweep") {
      if (ctx.broken) return { mood: "shock", text: "割れ！" };
      if (ctx.deep) return { mood: "worry", text: "オレンジは削りすぎ" };
      if (ctx.good) return { mood: "cheer", text: "金色！離して" };
      if (ctx.holding) return { mood: "focus", text: "削ってるよ" };
      return { mood: "idle", text: "指かスペースを長押し" };
    }
    if (kind === "result") {
      var copy = resultCopy(!!ctx.practice, ctx.hearts, ctx.reason);
      if (ctx.reason === "pass" && ctx.practice) return { mood: "cheer", text: "合格！ハートはそのまま" };
      if (ctx.reason === "pass") return { mood: "cheer", text: "合格！" };
      return { mood: "shock", text: copy.head + "。" + copy.sub };
    }
    if (kind === "end") {
      if (ctx.rank === "巨匠") return { mood: "cheer", text: "ハート3つのまま全クリア。巨匠だよ" };
      if (ctx.rank === "彫り師") return { mood: "happy", text: "全クリア！彫り師だよ" };
      if (ctx.rank === "助手") return { mood: "happy", text: (ctx.reached || "R4") + "まで届いた。助手だよ" };
      return { mood: "shock", text: "また彫りにきてね" };
    }
    return { mood: "idle", text: "" };
  }

  function hint(phase, ctx) {
    ctx = ctx || {};
    if (phase === "show") return ctx.mirror ? "左右反対に彫る" : "形をおぼえて";
    if (phase === "now") return "彫れ！";
    if (phase === "sweep" || phase === "settle") {
      if (ctx.broken) return "赤は割れ";
      if (ctx.deep) return "オレンジは削りすぎ";
      if (ctx.good) return "金色で離す";
      if (ctx.holding) return "削ってる";
      return "指かスペースを長押し";
    }
    if (phase === "result") {
      if (ctx.reason === "pass") return "合格";
      if (ctx.reason === "broken") return "割れ";
      return "精度不足";
    }
    return "";
  }

  function recordRound(log, row) {
    var i;
    for (i = 0; i < log.length; i++) {
      if (log[i].id === row.id) {
        log[i] = row;
        return log;
      }
    }
    log.push(row);
    return log;
  }

  function quote(rank, hearts, rows) {
    var parts = ["おぼえてきざめ「" + rank + "」ハート" + hearts];
    var i;
    for (i = 0; i < rows.length; i++) parts.push(rows[i].label + "\u00A0" + rows[i].pct + "%");
    return parts.join(" ");
  }

  function shareText(rank, hearts, rows) {
    return quote(rank, hearts, rows) + " " + PAGE;
  }

  function reachable(target, sweep) {
    return (1 - target) <= sweep * CUT_RATE * 0.9 + 1e-6;
  }

  return {
    HEARTS: HEARTS,
    CUT_RATE: CUT_RATE,
    GOOD_BAND: GOOD_BAND,
    BROKEN_OVER: BROKEN_OVER,
    NOW_MS: NOW_MS,
    SETTLE_MS: SETTLE_MS,
    PAGE: PAGE,
    ANNOUNCE: ANNOUNCE,
    ROUNDS: ROUNDS,
    RULES: RULES,
    PRACTICE_NOTE: PRACTICE_NOTE,
    CUE_LINE: CUE_LINE,
    SWEEP_NOTE: SWEEP_NOTE,
    RANK_LINE: RANK_LINE,
    FAIL_BROKEN: FAIL_BROKEN,
    FAIL_LOW: FAIL_LOW,
    PASS_HEAD: PASS_HEAD,
    HERO: HERO,
    SHAPES: SHAPES,
    WEIGHT: WEIGHT,
    MAX_STEP_RATIO: MAX_STEP_RATIO,
    hardness: hardness,
    bandEdges: bandEdges,
    auditRounds: auditRounds,
    roundTable: roundTable,
    mulberry32: mulberry32,
    mirrorGap: mirrorGap,
    meanOf: meanOf,
    rollRound: rollRound,
    cut: cut,
    isBroken: isBroken,
    zone: zone,
    crossedGood: crossedGood,
    crossedBroken: crossedBroken,
    columnIndex: columnIndex,
    accuracyPercent: accuracyPercent,
    brokenCount: brokenCount,
    reasonFor: reasonFor,
    passed: passed,
    nextHearts: nextHearts,
    rankFor: rankFor,
    labelFor: labelFor,
    roundInfo: roundInfo,
    resultCopy: resultCopy,
    speak: speak,
    hint: hint,
    recordRound: recordRound,
    quote: quote,
    shareText: shareText,
    reachable: reachable
  };
});
