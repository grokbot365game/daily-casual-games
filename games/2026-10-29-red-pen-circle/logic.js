/* 赤ペン○さがし — rules, stroke judgment, and round table.
   No DOM. Safe to require() from the node self-test.

   Input is a closed loop drawn with a pointer. It is not a tap,
   not a flick, and not a hold-and-release.

   Difficulty (higher = harder) rises every round:
     grid * 1000     finer board. Strictly +1 column each round.
     sway ? 80 : 0   pictures wobble. Introduced alone on round 4.
     (100 - delta)   smaller delta = subtler difference.
     Round 4 keeps round 3's delta, size, detail, and clock
     (the other load is not tightened) and adds sway.
     No rotate-type difference while sway is on.
     Round 6 has the finest grid and the smallest delta. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RedLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CLOSE_MIN_PX = 28;
  var CLOSE_BBOX_RATIO = 0.35;

  var ICONS = ["onigiri", "pencil", "eraser", "apple", "fish", "star", "cup"];

  /* delta is how obvious the difference is (higher = easier).
     It never rises. It stays flat only on the sway intro (round 4),
     then drops again. Time is generous and never below 20s. */
  var ROUNDS = [
    {
      id: 1, practice: true, grid: 3, time: 25, delta: 100, sway: null,
      kinds: ["shade"],
      shade: { mode: "hue", min: 110, max: 145 },
      size: 0, detail: 0, rotate: 0,
      note: "練習：ハートは減らない",
      banner: "練習：ハートは減らない"
    },
    {
      id: 2, practice: false, grid: 4, time: 25, delta: 70, sway: null,
      kinds: ["shade", "detail", "size", "mirror", "rotate"],
      shade: { mode: "either", hueMin: 34, hueMax: 52, light: 26 },
      size: 0.30, detail: 0.22, rotate: 90,
      note: "", banner: ""
    },
    {
      id: 3, practice: false, grid: 5, time: 24, delta: 48, sway: null,
      kinds: ["shade", "detail", "size", "mirror", "rotate"],
      shade: { mode: "light", light: 17 },
      size: 0.18, detail: 0.16, rotate: 32,
      note: "", banner: ""
    },
    {
      id: 4, practice: false, grid: 6, time: 24, delta: 48,
      sway: { rot: 0.075, px: 2.4, speed: 2.05 },
      kinds: ["shade", "detail", "size", "mirror"],
      shade: { mode: "light", light: 17 },
      size: 0.18, detail: 0.16, rotate: 0,
      note: "NEW! 絵がゆらゆら動く",
      banner: "NEW! 絵がゆらゆら動く"
    },
    {
      id: 5, practice: false, grid: 7, time: 22, delta: 32,
      sway: { rot: 0.075, px: 2.4, speed: 2.05 },
      kinds: ["shade", "detail", "size"],
      shade: { mode: "light", light: 14 },
      size: 0.16, detail: 0.13, rotate: 0,
      note: "ゆらゆらつづき", banner: ""
    },
    {
      id: 6, practice: false, grid: 8, time: 22, delta: 20,
      sway: { rot: 0.075, px: 2.4, speed: 2.05 },
      kinds: ["shade", "detail", "size"],
      shade: { mode: "light", light: 11 },
      size: 0.15, detail: 0.10, rotate: 0,
      note: "ゆらゆら・いちばんむずかしい", banner: ""
    }
  ];

  var RULES = [
    "ひとつだけちがう絵を見つける",
    "指でぐるっと○でかこむ",
    "まちがい・時間切れでハート−1(ハート2つ)"
  ];
  var PRACTICE_NOTE = "ラウンド1は練習(ハートは減らない)";
  var RANK_LINE = "はなまる:ノーミス全クリ / 合格:クリア / 補習:ゲームオーバー";
  var PERCENT_NOTE = "※タイムからの目安(実データではありません)";
  var FAIL_WRONG = "ブブー！";
  var FAIL_TIME = "時間切れ！";
  var ANNOUNCE = "本日の1本、赤ペン○さがし。ミケ先生と、ひとつだけちがう絵を指でぐるっと○。6ラウンド、マスはどんどん細かくなるよ。{URL}";

  var HINT_CIRCLE = "ぐるっと○でかこんでね";
  var HINT_CLOSE = "ぐるっと一周かこんでね";
  var HINT_SMALL = "もっと小さく○してね";

  function hardness(spec) {
    return spec.grid * 1000 + (spec.sway ? 80 : 0) + (100 - spec.delta);
  }

  function auditRounds() {
    var problems = [];
    if (ROUNDS.length !== 6) problems.push("round count");
    var prev = null;
    var swayIntro = 0;
    for (var i = 0; i < ROUNDS.length; i++) {
      var spec = ROUNDS[i];
      if (spec.id !== i + 1) problems.push("id " + spec.id);
      if (spec.time < 20) problems.push("time " + spec.id);
      if (spec.sway && spec.kinds.indexOf("rotate") >= 0) problems.push("rotate+sway " + spec.id);
      if (spec.sway && spec.rotate !== 0) problems.push("rotate value " + spec.id);
      if (spec.note.indexOf("NEW!") === 0) {
        swayIntro++;
        if (!spec.sway) problems.push("new without sway");
        if (spec.note !== "NEW! 絵がゆらゆら動く") problems.push("new wording");
      }
      if (prev) {
        if (spec.grid !== prev.grid + 1) problems.push("grid " + spec.id);
        if (spec.delta > prev.delta) problems.push("delta up " + spec.id);
        if (hardness(spec) <= hardness(prev)) problems.push("hardness " + spec.id);
        if (spec.time > prev.time + 0.001 && spec.note.indexOf("NEW!") !== 0) {
          problems.push("time up " + spec.id);
        }
      }
      prev = spec;
    }
    if (swayIntro !== 1) problems.push("sway intros " + swayIntro);
    var r1 = ROUNDS[0];
    var r3 = ROUNDS[2];
    var r4 = ROUNDS[3];
    var r5 = ROUNDS[4];
    var r6 = ROUNDS[5];
    if (!r1.practice) problems.push("r1 practice");
    if (r1.kinds.length !== 1 || r1.kinds[0] !== "shade" || r1.shade.mode !== "hue") problems.push("r1 shade");
    if (r1.shade.min < 100) problems.push("r1 hue");
    if (r3.delta !== r4.delta || r3.size !== r4.size || r3.detail !== r4.detail || r3.time !== r4.time) {
      problems.push("r4 not lightened to r3");
    }
    if (r3.sway || !r4.sway) problems.push("sway intro slot");
    if (r4.kinds.indexOf("rotate") >= 0) problems.push("r4 rotate");
    if (r5.delta >= r4.delta) problems.push("r5 delta");
    if (r6.delta >= r5.delta) problems.push("r6 delta");
    if (r6.grid !== 8) problems.push("r6 grid");
    if (r6.delta !== 20) problems.push("r6 not hardest delta");
    if (!r6.sway) problems.push("r6 sway");
    if (r5.kinds.indexOf("mirror") >= 0 || r5.kinds.indexOf("rotate") >= 0) problems.push("r5 obvious kind");
    if (r6.kinds.indexOf("mirror") >= 0 || r6.kinds.indexOf("rotate") >= 0) problems.push("r6 obvious kind");
    if (r6.size >= r5.size || r5.size >= r4.size) problems.push("size slope");
    if (r6.detail >= r5.detail || r5.detail >= r4.detail) problems.push("detail slope");
    if (r6.shade.light >= r5.shade.light || r5.shade.light >= r4.shade.light) problems.push("light slope");
    return { ok: problems.length === 0, problems: problems, scores: ROUNDS.map(hardness) };
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

  function clampLight(l) {
    if (l < 32) return 32;
    if (l > 68) return 68;
    return l;
  }

  function createPuzzle(spec, rng) {
    var n = spec.grid;
    var icon = ICONS[Math.floor(rng() * ICONS.length)];
    var kinds = spec.kinds.filter(function (k) {
      return !(spec.sway && k === "rotate");
    });
    if (!kinds.length) kinds = ["shade"];
    var kind = kinds[Math.floor(rng() * kinds.length)];
    var odd = Math.floor(rng() * n * n);
    var hue = Math.floor(rng() * 360);
    var sat = 70 + Math.floor(rng() * 14);
    var light = 46 + Math.floor(rng() * 8);
    var sign = rng() < 0.5 ? -1 : 1;
    var normal = { h: hue, s: sat, l: light };
    var oddCol = { h: hue, s: sat, l: light };
    var amount = 0;
    var shadeBy = "";
    if (kind === "shade") {
      var sh = spec.shade;
      if (sh.mode === "hue") {
        amount = sh.min + rng() * (sh.max - sh.min);
        oddCol = { h: hue + sign * amount, s: Math.min(90, sat + 8), l: light };
        shadeBy = "hue";
      } else if (sh.mode === "either" && rng() < 0.5) {
        amount = sh.hueMin + rng() * (sh.hueMax - sh.hueMin);
        oddCol = { h: hue + sign * amount, s: sat, l: light };
        shadeBy = "hue";
      } else {
        var target = sh.light;
        oddCol = { h: hue, s: sat, l: clampLight(light + sign * target) };
        if (Math.abs(oddCol.l - light) < target * 0.75) {
          oddCol = { h: hue, s: sat, l: clampLight(light - sign * target) };
        }
        amount = Math.abs(oddCol.l - light);
        shadeBy = "light";
      }
    }
    var scale = 1;
    if (kind === "size") scale = 1 + sign * spec.size;
    var mark = "";
    var mode = "";
    if (kind === "detail") {
      var marks = ["dot", "line", "leaf"];
      mark = marks[Math.floor(rng() * marks.length)];
      mode = rng() < 0.5 ? "extra" : "missing";
    }
    var deg = 0;
    if (kind === "rotate" && !spec.sway) {
      if (spec.rotate >= 90) deg = (rng() < 0.5 ? 90 : 180) * sign;
      else deg = sign * (spec.rotate - 4 + rng() * 8);
    }
    var phases = [];
    for (var i = 0; i < n * n; i++) phases.push(rng() * Math.PI * 2);
    return {
      icon: icon,
      kind: kind,
      odd: odd,
      n: n,
      hue: hue,
      sway: spec.sway ? { rot: spec.sway.rot, px: spec.sway.px, speed: spec.sway.speed } : null,
      phases: phases,
      diff: {
        kind: kind,
        normal: normal,
        odd: oddCol,
        amount: amount,
        shadeBy: shadeBy,
        scale: scale,
        mark: mark,
        mode: mode,
        detail: kind === "detail" ? spec.detail : 0,
        deg: deg,
        mirror: kind === "mirror"
      }
    };
  }

  function pathLength(points) {
    var len = 0;
    for (var i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
  }

  /* bbox size is the longer side. Closure distance is strictly under
     max(28px, 35% of that side). */
  function loopMetrics(points) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    var w = maxX - minX;
    var h = maxY - minY;
    var size = Math.max(w, h);
    var endDist = 0;
    if (points.length >= 2) {
      var a = points[0];
      var b = points[points.length - 1];
      endDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    var closeLimit = Math.max(CLOSE_MIN_PX, CLOSE_BBOX_RATIO * size);
    return {
      w: w, h: h, size: size, length: pathLength(points),
      endDist: endDist, closeLimit: closeLimit,
      closed: points.length >= 4 && endDist < closeLimit && size >= 16
    };
  }

  function polygonArea(points) {
    var n = points.length;
    if (n < 3) return 0;
    var a = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      a += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(a) * 0.5;
  }

  function corridorRms(points) {
    var n = points.length;
    if (n < 2) return 0;
    var mx = 0, my = 0;
    for (var i = 0; i < n; i++) { mx += points[i].x; my += points[i].y; }
    mx /= n;
    my /= n;
    var sxx = 0, syy = 0, sxy = 0;
    for (var k = 0; k < n; k++) {
      var dx = points[k].x - mx;
      var dy = points[k].y - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    var tr = sxx + syy;
    var det = sxx * syy - sxy * sxy;
    var disc = Math.sqrt(Math.max(0, tr * tr * 0.25 - det));
    var lam2 = tr * 0.5 - disc;
    return Math.sqrt(Math.max(0, lam2) / n);
  }

  function pointInPoly(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var yi = pts[i].y;
      var yj = pts[j].y;
      if ((yi > y) !== (yj > y)) {
        var xCross = (pts[j].x - pts[i].x) * (y - yi) / ((yj - yi) || 1e-9) + pts[i].x;
        if (x < xCross) inside = !inside;
      }
    }
    return inside;
  }

  function polygonCentroid(points) {
    var n = points.length;
    var a = 0, cx = 0, cy = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var cross = points[i].x * points[j].y - points[j].x * points[i].y;
      a += cross;
      cx += (points[i].x + points[j].x) * cross;
      cy += (points[i].y + points[j].y) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) < 1) {
      var sx = 0, sy = 0;
      for (var k = 0; k < n; k++) { sx += points[k].x; sy += points[k].y; }
      return { x: sx / n, y: sy / n };
    }
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }

  function tileAt(tiles, x, y) {
    var best = -1;
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (x >= t.left && x <= t.right && y >= t.top && y <= t.bottom) best = i;
    }
    return best;
  }

  function isStraight(points, metrics, area) {
    var rms = corridorRms(points);
    if (metrics.closed) return area < 280 && rms < 14;
    return rms < 16 && area < Math.max(220, metrics.length * 3);
  }

  /* kind: circle | close | small | pick
     circle and close and small never cost a heart.
     pick is the only judged stroke. */
  function evaluateStroke(points, tiles, cell) {
    if (!points || points.length < 2) {
      return { kind: "circle", index: null, message: HINT_CIRCLE };
    }
    var m = loopMetrics(points);
    if (m.length < 28 || m.size < 16) {
      return { kind: "circle", index: null, message: HINT_CIRCLE };
    }
    var area = polygonArea(points);
    if (isStraight(points, m, area)) {
      return { kind: "circle", index: null, message: HINT_CIRCLE };
    }
    if (!m.closed) {
      return { kind: "close", index: null, message: HINT_CLOSE };
    }
    if (m.length < 52 || area < 300) {
      return { kind: "circle", index: null, message: HINT_CIRCLE };
    }
    var inside = [];
    for (var i = 0; i < tiles.length; i++) {
      if (pointInPoly(tiles[i].cx, tiles[i].cy, points)) inside.push(i);
    }
    if (inside.length >= 2) {
      return { kind: "small", index: null, message: HINT_SMALL };
    }
    if (inside.length === 1) {
      return { kind: "pick", index: inside[0], message: "" };
    }
    var reasonablySmall = m.size <= cell * 1.65 && area <= cell * cell * 2.2;
    if (!reasonablySmall) {
      return { kind: "small", index: null, message: HINT_SMALL };
    }
    var c = polygonCentroid(points);
    var hit = tileAt(tiles, c.x, c.y);
    if (hit < 0) return { kind: "circle", index: null, message: HINT_CIRCLE };
    return { kind: "pick", index: hit, message: "" };
  }

  function nextHearts(hearts, practice) {
    if (practice) return hearts;
    return hearts > 0 ? hearts - 1 : 0;
  }

  function rankFor(clearedAll, misses) {
    if (!clearedAll) return "補習";
    if (misses === 0) return "はなまる";
    return "合格";
  }

  /* pct = clamp(round(2 + (totalSec - 25) * 0.9), 1, 99) */
  function percentile(totalSec) {
    var pct = Math.round(2 + (totalSec - 25) * 0.9);
    if (pct < 1) pct = 1;
    if (pct > 99) pct = 99;
    return pct;
  }

  function roundInfo(spec) {
    return {
      id: spec.id,
      title: spec.practice ? ("第" + spec.id + "ラウンド・練習") : ("第" + spec.id + "ラウンド"),
      grid: spec.grid + "×" + spec.grid,
      time: spec.time + "秒",
      note: spec.note || ""
    };
  }

  /* Lines describe only the situation passed in. The caller must not
     pass "low" once time has hit zero, and must not pass "time" while
     the clock is still running. */
  function speak(situation, extra) {
    extra = extra || {};
    switch (situation) {
      case "title":
        return { mood: "neutral", text: "ちがう絵を、○でかこもう。" };
      case "card":
        if (extra.practice) return { mood: "neutral", text: "練習だよ。ハートは減らない。" };
        if (extra.intro) return { mood: "neutral", text: "絵がゆらゆら動くよ。" };
        if (extra.sway) return { mood: "neutral", text: "ゆらゆらしても、ひとつだけ。" };
        return { mood: "neutral", text: "ひとつだけ、ちがうよ。" };
      case "play":
        return { mood: "neutral", text: "赤ペンで、ぐるっと○。" };
      case "low":
        return { mood: "neutral", text: "残り" + extra.sec + "秒！" };
      case "hint-circle":
        return { mood: "neutral", text: HINT_CIRCLE };
      case "hint-close":
        return { mood: "neutral", text: HINT_CLOSE };
      case "hint-small":
        return { mood: "neutral", text: HINT_SMALL };
      case "ok":
        return { mood: "happy", text: "はなまる！" };
      case "bad":
        if (extra.practice) return { mood: "shock", text: "練習だから、ハートはそのまま。" };
        return { mood: "shock", text: "そこじゃないよ。" };
      case "time":
        if (extra.practice) return { mood: "shock", text: "時間切れ。ハートは減らない。" };
        return { mood: "shock", text: "時間切れだよ。" };
      case "retry":
        return { mood: "neutral", text: "新しい絵だよ。" };
      case "end":
        if (extra.rank === "はなまる") return { mood: "happy", text: "ぜんぶはなまる！" };
        if (extra.rank === "合格") return { mood: "glad", text: "クリアだよ。" };
        return { mood: "shock", text: "ここまでだったね。" };
      default:
        return { mood: "neutral", text: "" };
    }
  }

  return {
    CLOSE_MIN_PX: CLOSE_MIN_PX,
    CLOSE_BBOX_RATIO: CLOSE_BBOX_RATIO,
    ICONS: ICONS,
    ROUNDS: ROUNDS,
    RULES: RULES,
    PRACTICE_NOTE: PRACTICE_NOTE,
    RANK_LINE: RANK_LINE,
    PERCENT_NOTE: PERCENT_NOTE,
    FAIL_WRONG: FAIL_WRONG,
    FAIL_TIME: FAIL_TIME,
    ANNOUNCE: ANNOUNCE,
    HINT_CIRCLE: HINT_CIRCLE,
    HINT_CLOSE: HINT_CLOSE,
    HINT_SMALL: HINT_SMALL,
    hardness: hardness,
    auditRounds: auditRounds,
    mulberry32: mulberry32,
    createPuzzle: createPuzzle,
    loopMetrics: loopMetrics,
    polygonArea: polygonArea,
    evaluateStroke: evaluateStroke,
    nextHearts: nextHearts,
    rankFor: rankFor,
    percentile: percentile,
    roundInfo: roundInfo,
    speak: speak
  };
});
