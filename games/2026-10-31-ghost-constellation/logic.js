/* おばけ星座うろおぼえ — rounds, memory score, cloud, copy.
   No DOM. Safe to require() from the node self-test.

   Input is a tap: pointerup with almost no movement and a short press.
   It is not a drag-loop (Day 34 赤ペン○) and not a circular drag
   (Day 35 かぼちゃ皮むき). Holding and releasing does not place a star.
   Dragging does not place a star.

   Rounds: 練習 then R1..R6. Hardness rises every step.
   R4 introduces おばけ雲 alone and lightens view time, pass line,
   tolerance, and does not add a star (a pure slope would have gone to 5).
   R5 and R6 keep the cloud and tighten everything else.
   R6 is the hardest on stars, view time, pass line, tolerance, and cloud. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StarLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HEARTS = 3;
  var COMMIT_MS = 400;
  var NOW_MS = 600;
  var TAP_MAX_MS = 450;
  var TAP_MAX_MOVE = 14;
  var UNDO_PER_ROUND = 1;
  var PAGE = "https://grokbot365game.github.io/daily-casual-games/games/2026-10-31-ghost-constellation/";
  var ANNOUNCE = "おばけ星座うろおぼえ。星を見て同じ順にタップ。ずれるとハート−1。R4から雲。#ハロウィン " + PAGE;

  /* Hardness weights. Higher score = harder.
     star: one more point to memorize
     view: less time to look (seconds below 4)
     pass: higher accuracy bar
     tol:  smaller miss still counts (tighter)
     cloud: bigger ghost cloud, on screen for more of the look */
  var WEIGHT = {
    star: 5,
    view: 10,
    pass: 0.7,
    tol: 55,
    cloudR: 48,
    cloudDur: 20,
    viewBase: 4,
    passBase: 40,
    tolBase: 0.55
  };
  var MAX_STEP_RATIO = 1.95;
  var MAX_VIEW_DROP = 0.7;

  var ROUNDS = [
    {
      id: 0, practice: true, stars: 3, view: 3.4, pass: 50, tol: 0.46, cloud: null,
      note: "練習：ハートは減らない",
      line: "練習だよ。ハートは減らない"
    },
    {
      id: 1, practice: false, stars: 3, view: 2.9, pass: 56, tol: 0.40, cloud: null,
      note: "",
      line: "消えたら、同じ順にタップ"
    },
    {
      id: 2, practice: false, stars: 4, view: 2.6, pass: 59, tol: 0.36, cloud: null,
      note: "",
      line: "星が1つ増えた。順番もおぼえて"
    },
    {
      id: 3, practice: false, stars: 4, view: 2.0, pass: 64, tol: 0.31, cloud: null,
      note: "",
      line: "見る時間が短い。よく見て"
    },
    {
      id: 4, practice: false, stars: 4, view: 2.5, pass: 59, tol: 0.35,
      cloud: { r: 0.28, dur: 0.66 },
      note: "NEW! おばけ雲",
      line: "おばけ雲が星をかくすよ"
    },
    {
      id: 5, practice: false, stars: 5, view: 2.1, pass: 65, tol: 0.29,
      cloud: { r: 0.32, dur: 0.74 },
      note: "雲＋星5つ",
      line: "おばけ雲が星をかくすよ"
    },
    {
      id: 6, practice: false, stars: 6, view: 1.5, pass: 70, tol: 0.26,
      cloud: { r: 0.37, dur: 0.86 },
      note: "いちばんむずかしい",
      line: "雲が大きくて、見る時間がいちばん短い"
    }
  ];

  var RULES = [
    "見えた星をおぼえて、同じ順にタップ",
    "ずれが大きいとハート1つ減る（ハート3つ・練習はノーカウント）",
    "R4から おばけ雲 が星をかくす"
  ];
  var PRACTICE_NOTE = "最初の1回は練習（ハートは減らない）";
  var RANK_LINE = "全クリア＋ハート3＝大魔女 / 全クリア＝魔女 / R4以上＝見習い / それ未満＝かけだし";
  var FAIL_HEAD = "ずれが大きい";
  var PASS_HEAD = "合格";
  var HERO = "ミャジョ";
  var SHAPES = ["walk", "arc", "zig", "hook", "crown"];

  function hardness(spec) {
    var cloud = spec.cloud ? (spec.cloud.r * WEIGHT.cloudR + spec.cloud.dur * WEIGHT.cloudDur) : 0;
    return spec.stars * WEIGHT.star
      + (WEIGHT.viewBase - spec.view) * WEIGHT.view
      + (spec.pass - WEIGHT.passBase) * WEIGHT.pass
      + (WEIGHT.tolBase - spec.tol) * WEIGHT.tol
      + cloud;
  }

  function auditRounds() {
    var problems = [];
    var i;
    if (ROUNDS.length !== 7) problems.push("round count");
    if (ROUNDS[0].practice !== true || ROUNDS[0].id !== 0) problems.push("practice");
    var prev = null;
    var scores = [];
    for (i = 0; i < ROUNDS.length; i++) {
      var spec = ROUNDS[i];
      scores.push(hardness(spec));
      if (!spec.practice && spec.id !== i) problems.push("id " + spec.id);
      if (spec.practice !== (i === 0)) problems.push("practice flag " + i);
      if (spec.stars < 3 || spec.stars > 7) problems.push("stars " + spec.id);
      if (!(spec.view > 0) || !(spec.pass > 0) || !(spec.tol > 0)) problems.push("bad " + spec.id);
      if (spec.cloud && !(spec.cloud.r > 0 && spec.cloud.dur > 0 && spec.cloud.dur < 1)) {
        problems.push("cloud " + spec.id);
      }
      if (i < 4 && spec.cloud) problems.push("early cloud " + spec.id);
      if (i >= 4 && !spec.cloud) problems.push("missing cloud " + spec.id);
      if (spec.note.indexOf("NEW!") === 0) {
        if (i !== 4) problems.push("NEW slot " + spec.id);
        if (!spec.cloud) problems.push("NEW without cloud");
      }
      if (prev) {
        if (scores[i] <= scores[i - 1] + 1e-6) problems.push("hardness " + spec.id);
        if (spec.stars > prev.stars + 1) problems.push("star jump " + spec.id);
        var intro = spec.note.indexOf("NEW!") === 0;
        if (intro) {
          if (!(spec.view > prev.view)) problems.push("intro view");
          if (!(spec.pass < prev.pass)) problems.push("intro pass");
          if (!(spec.tol > prev.tol)) problems.push("intro tol");
          if (!(spec.stars <= prev.stars)) problems.push("intro stars");
          if (prev.cloud) problems.push("intro not first cloud");
        } else {
          if (!(spec.view < prev.view)) problems.push("view " + spec.id);
          if (!(spec.tol < prev.tol)) problems.push("tol " + spec.id);
          if (!(spec.pass > prev.pass)) problems.push("pass " + spec.id);
          if (prev.view - spec.view > MAX_VIEW_DROP + 1e-9) problems.push("view drop " + spec.id);
        }
        if (spec.cloud && prev.cloud) {
          if (!(spec.cloud.r > prev.cloud.r && spec.cloud.dur > prev.cloud.dur)) {
            problems.push("cloud grow " + spec.id);
          }
        }
      }
      prev = spec;
    }
    var last = ROUNDS[ROUNDS.length - 1];
    for (i = 0; i < ROUNDS.length - 1; i++) {
      var s = ROUNDS[i];
      if (!(last.stars > s.stars)) problems.push("r6 stars");
      if (!(last.view < s.view)) problems.push("r6 view");
      if (!(last.pass > s.pass)) problems.push("r6 pass");
      if (!(last.tol < s.tol)) problems.push("r6 tol");
      var cr = s.cloud ? s.cloud.r : 0;
      var cd = s.cloud ? s.cloud.dur : 0;
      if (!(last.cloud && last.cloud.r > cr && last.cloud.dur > cd)) problems.push("r6 cloud");
    }
    if (ROUNDS[4].stars !== ROUNDS[3].stars) problems.push("r4 stars not held");
    if (ROUNDS[3].cloud || !ROUNDS[4].cloud) problems.push("cloud intro");
    var deltas = [];
    for (i = 1; i < scores.length; i++) deltas.push(scores[i] - scores[i - 1]);
    var minD = Math.min.apply(null, deltas);
    var maxD = Math.max.apply(null, deltas);
    var ratio = maxD / minD;
    if (!(minD > 0)) problems.push("flat");
    if (ratio > MAX_STEP_RATIO) problems.push("step ratio " + ratio.toFixed(2));
    return {
      ok: problems.length === 0,
      problems: problems,
      scores: scores,
      deltas: deltas,
      ratio: ratio,
      table: roundTable()
    };
  }

  function roundTable() {
    return ROUNDS.map(function (s) {
      var cloud = s.cloud
        ? ("雲 r" + s.cloud.r.toFixed(2) + " " + Math.round(s.cloud.dur * 100) + "%")
        : "雲なし";
      return (s.practice ? "練習" : ("R" + s.id))
        + " " + s.stars + "星"
        + " " + s.view.toFixed(1) + "s"
        + " 合格" + s.pass + "%"
        + " tol" + s.tol.toFixed(2)
        + " " + cloud
        + " h" + hardness(s).toFixed(1);
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

  function minSep(n) {
    if (n <= 3) return 0.28;
    if (n === 4) return 0.22;
    if (n === 5) return 0.19;
    return 0.16;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function valid(pts, n) {
    if (!pts || pts.length !== n) return false;
    var sep = minSep(n);
    var m = 0.1;
    var i, j;
    for (i = 0; i < n; i++) {
      if (pts[i].x < m || pts[i].y < m || pts[i].x > 1 - m || pts[i].y > 1 - m) return false;
      for (j = 0; j < i; j++) {
        if (dist(pts[i], pts[j]) < sep - 1e-6) return false;
      }
    }
    return true;
  }

  function transform(pts, rng) {
    var ang = rng() * Math.PI * 2;
    var mirror = rng() < 0.5;
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var out = pts.map(function (p) {
      var x = p.x - 0.5;
      var y = p.y - 0.5;
      if (mirror) x = -x;
      return { x: 0.5 + c * x - s * y, y: 0.5 + s * x + c * y };
    });
    if (rng() < 0.5) out.reverse();
    return out;
  }

  function genWalk(n, rng) {
    var sep = minSep(n);
    var m = 0.2;
    var pts = [{ x: m + rng() * (1 - 2 * m), y: m + rng() * (1 - 2 * m) }];
    var ang = rng() * Math.PI * 2;
    var i, t, j;
    for (i = 1; i < n; i++) {
      var placed = false;
      for (t = 0; t < 28 && !placed; t++) {
        ang += (rng() - 0.5) * 2.0;
        var len = sep + 0.03 + rng() * 0.1;
        var x = pts[i - 1].x + Math.cos(ang) * len;
        var y = pts[i - 1].y + Math.sin(ang) * len;
        if (x < m || y < m || x > 1 - m || y > 1 - m) continue;
        var ok = true;
        for (j = 0; j < i; j++) {
          if (Math.hypot(x - pts[j].x, y - pts[j].y) < sep) ok = false;
        }
        if (!ok) continue;
        pts.push({ x: x, y: y });
        placed = true;
      }
      if (!placed) return null;
    }
    return pts;
  }

  function genArc(n, rng) {
    var sep = minSep(n);
    var rad = 0.24 + rng() * 0.08;
    var minStep = sep / rad * 1.25;
    var minSweep = minStep * (n - 1);
    if (minSweep > 4.6) return null;
    var sweep = minSweep + rng() * Math.max(0.2, 4.8 - minSweep);
    var a0 = rng() * Math.PI * 2;
    var cx = 0.5 + (rng() - 0.5) * 0.08;
    var cy = 0.5 + (rng() - 0.5) * 0.08;
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
      var a = a0 + sweep * (n === 1 ? 0 : i / (n - 1));
      pts.push({
        x: cx + Math.cos(a) * rad,
        y: cy + Math.sin(a) * rad
      });
    }
    return pts;
  }

  function genZigzag(n, rng) {
    var sep = minSep(n);
    var horiz = rng() < 0.5;
    var amp = 0.16 + rng() * 0.12;
    var span = Math.max(sep * (n - 1), 0.42);
    if (span > 0.62) span = 0.62;
    var start = 0.5 - span / 2;
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var main = start + span * t;
      var cross = 0.5 + (i % 2 === 0 ? -amp : amp);
      pts.push(horiz ? { x: main, y: cross } : { x: cross, y: main });
    }
    return pts;
  }

  function genHook(n, rng) {
    var arcN = Math.max(2, n - 1);
    var arc = genArc(arcN, rng);
    if (!arc) return null;
    var last = arc[arc.length - 1];
    var prev = arc[arc.length - 2];
    var ang = Math.atan2(last.y - prev.y, last.x - prev.x) + (rng() < 0.5 ? 0.9 : -0.9);
    var len = minSep(n) + 0.04;
    var tip = { x: last.x + Math.cos(ang) * len, y: last.y + Math.sin(ang) * len };
    if (n === arcN) return arc;
    return arc.concat([tip]);
  }

  function genCrown(n, rng) {
    var sep = minSep(n);
    var amp = 0.14 + rng() * 0.1;
    var span = Math.min(0.6, Math.max(0.4, sep * (n - 1)));
    var start = 0.5 - span / 2;
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var y = 0.5 + (i % 2 === 0 ? -amp : amp * 0.35);
      pts.push({ x: start + span * t, y: y });
    }
    return pts;
  }

  function generate(shape, n, rng) {
    if (shape === "walk") return genWalk(n, rng);
    if (shape === "arc") return genArc(n, rng);
    if (shape === "zig") return genZigzag(n, rng);
    if (shape === "hook") return genHook(n, rng);
    if (shape === "crown") return genCrown(n, rng);
    return null;
  }

  function ring(n, rng) {
    var rad = 0.26 + rng() * 0.04;
    var a0 = rng() * Math.PI * 2;
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
      var a = a0 + i * (Math.PI * 2 / n);
      pts.push({ x: 0.5 + Math.cos(a) * rad, y: 0.5 + Math.sin(a) * rad });
    }
    return pts;
  }

  function cloudAt(cloud, u) {
    if (!cloud || u < cloud.t0 - 1e-9 || u > cloud.t1 + 1e-9) return null;
    var span = cloud.t1 - cloud.t0;
    var p = span <= 1e-6 ? 0 : (u - cloud.t0) / span;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    var e = p * p * (3 - 2 * p);
    return {
      x: cloud.x0 + (cloud.x1 - cloud.x0) * e,
      y: cloud.y0 + (cloud.y1 - cloud.y0) * e,
      r: cloud.r
    };
  }

  function starHidden(star, cloud, u) {
    var c = cloudAt(cloud, u);
    if (!c) return false;
    return dist(star, c) < c.r;
  }

  function coverCount(stars, cloud, u) {
    var n = 0;
    var i;
    for (i = 0; i < stars.length; i++) {
      if (starHidden(stars[i], cloud, u)) n++;
    }
    return n;
  }

  function maxCover(stars, cloud) {
    var best = 0;
    var i;
    for (i = 0; i <= 8; i++) {
      var u = cloud.t0 + (cloud.t1 - cloud.t0) * (i / 8);
      var n = coverCount(stars, cloud, u);
      if (n > best) best = n;
    }
    return best;
  }

  function randomCloud(spec, rng) {
    var dur = spec.cloud.dur;
    var endPad = 0.02;
    var lead = Math.min(0.22, Math.max(0.1, 1 - dur - endPad));
    var room = 1 - endPad - lead - dur;
    if (room < -1e-6) {
      lead = Math.max(0.08, 1 - endPad - dur);
      room = 1 - endPad - lead - dur;
    }
    if (room < 0) room = 0;
    var t0 = lead + rng() * room;
    var t1 = t0 + dur;
    var horizontal = rng() < 0.5;
    var along0 = -0.08;
    var along1 = 1.08;
    if (rng() < 0.5) {
      along0 = 1.08;
      along1 = -0.08;
    }
    var cross0 = 0.18 + rng() * 0.64;
    var cross1 = 0.18 + rng() * 0.64;
    if (horizontal) {
      return { x0: along0, y0: cross0, x1: along1, y1: cross1, r: spec.cloud.r, t0: t0, t1: t1 };
    }
    return { x0: cross0, y0: along0, x1: cross1, y1: along1, r: spec.cloud.r, t0: t0, t1: t1 };
  }

  function makeCloud(spec, stars, rng) {
    var best = null;
    var bestScore = -1;
    var attempt;
    for (attempt = 0; attempt < 16; attempt++) {
      var cloud = randomCloud(spec, rng);
      var covered = maxCover(stars, cloud);
      var score = covered <= 0 ? -1 : (covered >= stars.length ? 0.2 : covered);
      if (score > bestScore) {
        best = cloud;
        bestScore = score;
      }
      if (covered >= 1 && covered < stars.length) return cloud;
    }
    return best;
  }

  function createPattern(spec, rng) {
    var shape = SHAPES[Math.floor(rng() * SHAPES.length)];
    var pts = null;
    var used = shape;
    var guard = 0;
    while (guard < 40 && !valid(pts, spec.stars)) {
      var raw = generate(shape, spec.stars, rng);
      pts = raw ? transform(raw, rng) : null;
      guard++;
    }
    if (!valid(pts, spec.stars)) {
      used = "ring";
      guard = 0;
      pts = null;
      while (guard < 12 && !valid(pts, spec.stars)) {
        pts = transform(ring(spec.stars, rng), rng);
        guard++;
      }
      if (!valid(pts, spec.stars)) pts = ring(spec.stars, rng);
    }
    var cloud = spec.cloud ? makeCloud(spec, pts, rng) : null;
    return { stars: pts.map(function (p) { return { x: p.x, y: p.y }; }), cloud: cloud, shape: used };
  }

  function placementScore(d, tol) {
    if (!(tol > 0)) return 0;
    if (d >= tol) return 0;
    if (d <= 0) return 1;
    return 1 - d / tol;
  }

  function accuracyPercent(stars, taps, tol) {
    if (!stars || !taps || taps.length !== stars.length || !stars.length) return 0;
    var sum = 0;
    var i;
    for (i = 0; i < stars.length; i++) {
      sum += placementScore(dist(stars[i], taps[i]), tol);
    }
    return Math.round((sum / stars.length) * 100);
  }

  function passed(pct, spec) {
    return pct >= spec.pass;
  }

  function nextHearts(hearts, practice, didPass) {
    if (didPass || practice) return hearts;
    return hearts > 0 ? hearts - 1 : 0;
  }

  function rankFor(cleared, hearts, reachedId) {
    if (cleared && hearts >= HEARTS) return "大魔女";
    if (cleared) return "魔女";
    if (reachedId >= 4) return "見習い";
    return "かけだし";
  }

  function isTap(dt, movedPx) {
    return dt >= 0 && dt <= TAP_MAX_MS && movedPx <= TAP_MAX_MOVE;
  }

  function canUndo(used, tapCount) {
    return used < UNDO_PER_ROUND && tapCount > 0;
  }

  function roundInfo(spec) {
    return {
      title: spec.practice ? "練習" : ("R" + spec.id),
      kicker: spec.practice ? "練習ラウンド" : "ラウンド開始",
      index: spec.practice ? "練習" : ("R" + spec.id + " / R6"),
      stars: String(spec.stars),
      view: spec.view.toFixed(1),
      pass: String(spec.pass),
      note: spec.note || "",
      cloud: !!spec.cloud,
      last: spec.id === ROUNDS[ROUNDS.length - 1].id && !spec.practice
    };
  }

  function resultCopy(practice, heartsAfter, didPass) {
    if (didPass && practice) return { head: PASS_HEAD, sub: "ハートはそのまま" };
    if (didPass) return { head: PASS_HEAD, sub: "次のラウンドへ" };
    if (practice) return { head: FAIL_HEAD, sub: "ハートは減らない" };
    if (heartsAfter <= 0) return { head: FAIL_HEAD, sub: "ハートがなくなった" };
    return { head: FAIL_HEAD, sub: "ハート−1" };
  }

  function speak(kind, ctx) {
    ctx = ctx || {};
    if (kind === "title") return { mood: "cheer", text: "ハロウィンの夜。星を見て、同じ順にタップしてね" };
    if (kind === "card") {
      if (ctx.practice) return { mood: "happy", text: "練習だよ。ハートは減らない" };
      if (ctx.cloud && ctx.last) return { mood: "worry", text: "雲が大きくて、見る時間がいちばん短い" };
      if (ctx.cloud) return { mood: "worry", text: "おばけ雲が星をかくすよ" };
      return { mood: "cheer", text: "消えたら、同じ順にタップ" };
    }
    if (kind === "view") return { mood: "focus", text: "よく見て。線の順番だよ" };
    if (kind === "cloud") return { mood: "worry", text: "雲が星をかくしてる" };
    if (kind === "now") return { mood: "cheer", text: "いま！同じ順にタップ" };
    if (kind === "recall") {
      var placed = ctx.placed || 0;
      if (placed <= 0) return { mood: "focus", text: "1つめの星をタップ" };
      return { mood: "focus", text: (placed + 1) + "つめの星をタップ" };
    }
    if (kind === "commit") return { mood: "cheer", text: "ぜんぶ置いたよ" };
    if (kind === "undo") {
      var next = (ctx.placed || 0) + 1;
      return { mood: "happy", text: "ひとつ戻した。" + next + "つめをタップ" };
    }
    if (kind === "outside") return { mood: "worry", text: "空の枠の中をタップしてね" };
    if (kind === "result") {
      var copy = resultCopy(!!ctx.practice, ctx.hearts, !!ctx.passed);
      if (ctx.passed && ctx.practice) return { mood: "cheer", text: "合格！ハートはそのまま" };
      if (ctx.passed) return { mood: "cheer", text: "合格！" };
      return { mood: "shock", text: copy.head + "。" + copy.sub };
    }
    if (kind === "end") {
      if (ctx.rank === "大魔女") return { mood: "cheer", text: "ハート3つのまま全クリア。大魔女だよ" };
      if (ctx.rank === "魔女") return { mood: "happy", text: "全クリア！魔女だよ" };
      if (ctx.rank === "見習い") return { mood: "happy", text: (ctx.reached || "R4") + "まで届いた。見習いだよ" };
      return { mood: "shock", text: "また星を見にきてね" };
    }
    return { mood: "idle", text: "" };
  }

  function quote(rank, hearts) {
    return "おばけ星座うろおぼえ「" + rank + "」ハート" + hearts;
  }

  return {
    HEARTS: HEARTS,
    COMMIT_MS: COMMIT_MS,
    NOW_MS: NOW_MS,
    TAP_MAX_MS: TAP_MAX_MS,
    TAP_MAX_MOVE: TAP_MAX_MOVE,
    UNDO_PER_ROUND: UNDO_PER_ROUND,
    PAGE: PAGE,
    ANNOUNCE: ANNOUNCE,
    ROUNDS: ROUNDS,
    RULES: RULES,
    PRACTICE_NOTE: PRACTICE_NOTE,
    RANK_LINE: RANK_LINE,
    FAIL_HEAD: FAIL_HEAD,
    PASS_HEAD: PASS_HEAD,
    HERO: HERO,
    SHAPES: SHAPES,
    WEIGHT: WEIGHT,
    MAX_STEP_RATIO: MAX_STEP_RATIO,
    hardness: hardness,
    auditRounds: auditRounds,
    roundTable: roundTable,
    mulberry32: mulberry32,
    minSep: minSep,
    createPattern: createPattern,
    cloudAt: cloudAt,
    starHidden: starHidden,
    coverCount: coverCount,
    placementScore: placementScore,
    accuracyPercent: accuracyPercent,
    passed: passed,
    nextHearts: nextHearts,
    rankFor: rankFor,
    isTap: isTap,
    canUndo: canUndo,
    roundInfo: roundInfo,
    resultCopy: resultCopy,
    speak: speak,
    quote: quote
  };
});
