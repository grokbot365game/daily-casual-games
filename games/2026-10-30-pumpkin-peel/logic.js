/* かぼちゃらせん皮むき — rounds, speed band, bumps, rank.
   No DOM. Safe to require() from the node self-test.

   The gesture is a continuous circle around the pumpkin, like a crank.
   It is not a tap and not a flick. The peel grows only while the
   pointer stays down and keeps turning. Speed is revolutions per second.

   One new trap per round, then the last round stacks them:
     R1 practice, wide band. Rank and hearts ignore it.
     R2 narrow band.
     R3 the band drifts (same width as R2).
     R4 bumps kick the needle up (drift off, same width).
     R5 narrower band and more bumps. Not a new trap.
     R6 narrow + drift + bumps together. Hardest, not a shorter clock.
   There is no fail timer. Too slow already ends a stall. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PeelLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CM_PER_TURN = 24;
  var GAUGE_MAX = 1.85;
  var PAGE = "https://grokbot365game.github.io/daily-casual-games/games/2026-10-30-pumpkin-peel/";

  var ROUNDS = [
    {
      id: 1, practice: true,
      turns: 3, width: 1.02, center: 0.78,
      driftAmp: 0, driftPeriod: 4.2,
      bumps: 0, bumpAdd: 0, bumpHold: 0, bumpArc: 0, warnArc: 0,
      sustain: 0.58, grace: 0.85,
      note: "練習：ランクに入らない・ハートは減らない",
      line: "広い帯で、一定の速さで回そう"
    },
    {
      id: 2, practice: false,
      turns: 4, width: 0.5, center: 0.82,
      driftAmp: 0, driftPeriod: 4.2,
      bumps: 0, bumpAdd: 0, bumpHold: 0, bumpArc: 0, warnArc: 0,
      sustain: 0.38, grace: 0.62,
      note: "NEW! 速度の帯がせまい",
      line: "緑の帯がせまいよ。針を帯の中に置いて"
    },
    {
      id: 3, practice: false,
      turns: 4.5, width: 0.5, center: 0.82,
      driftAmp: 0.32, driftPeriod: 3.6,
      bumps: 0, bumpAdd: 0, bumpHold: 0, bumpArc: 0, warnArc: 0,
      sustain: 0.38, grace: 0.62,
      note: "NEW! 緑の帯がゆれる",
      line: "帯が上下する。針を追いかけて"
    },
    {
      id: 4, practice: false,
      turns: 5, width: 0.5, center: 0.82,
      driftAmp: 0, driftPeriod: 3.6,
      bumps: 3, bumpAdd: 0.32, bumpHold: 0.5, bumpArc: 0.42, warnArc: 0.55,
      sustain: 0.34, grace: 0.75,
      note: "NEW! こぶで速度が跳ねる",
      line: "こぶに乗ると針が跳ねる。手前でゆるめて"
    },
    {
      id: 5, practice: false,
      turns: 5.6, width: 0.42, center: 0.86,
      driftAmp: 0, driftPeriod: 3.2,
      bumps: 4, bumpAdd: 0.28, bumpHold: 0.46, bumpArc: 0.4, warnArc: 0.34,
      sustain: 0.3, grace: 0.7,
      note: "帯がさらにせまく、こぶが増える",
      line: "帯はもっとせまい。こぶも4つあるよ"
    },
    {
      id: 6, practice: false,
      turns: 6.4, width: 0.4, center: 0.9,
      driftAmp: 0.28, driftPeriod: 3.1,
      bumps: 4, bumpAdd: 0.26, bumpHold: 0.44, bumpArc: 0.4, warnArc: 0.32,
      sustain: 0.26, grace: 0.7,
      note: "せまい帯・ゆれ・こぶ同時",
      line: "せまい帯がゆれて、こぶもある。全部いっしょ"
    }
  ];

  var RULES = [
    "マウスでも指でも、押したままかぼちゃのまわりをくるくる回す",
    "速すぎ・遅すぎ・指が離れると切れて、そのラウンドは最初から",
    "ハートは2つ。帯がせまい・帯がゆれる・こぶで速度が跳ねる"
  ];
  var PRACTICE_NOTE = "ラウンド1は練習（ランクに入らない・ハートは減らない）";
  var RANK_LINE = "ハロウィン王:ノーミス全クリ / まるむき:クリア / ちぎり:ゲームオーバー";
  var REASON = { fast: "速すぎ", slow: "遅すぎ", lift: "指が離れた" };
  var CLEAR_WORD = "まるむき！";
  var FAIL_HEAD = "ゲームオーバー";
  var HERO = "ポル";
  var ANNOUNCE = "本日の1本、かぼちゃらせん皮むき。ポルとくるくる。速すぎ・遅すぎ・はなすと切れる。" + PAGE;

  function wrapPi(d) {
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function angDist(a, b) {
    return Math.abs(wrapPi(a - b));
  }

  function mechanics(spec) {
    return {
      narrow: spec.width < 0.75,
      drift: spec.driftAmp > 0.001,
      bumps: spec.bumps > 0
    };
  }

  function hardness(spec) {
    return (1 / spec.width) * 100
      + spec.driftAmp * 360
      + spec.bumps * spec.bumpAdd * 200
      + spec.turns * 26
      + (0.62 - spec.sustain) * 80;
  }

  function bandAt(spec, t) {
    var amp = spec.driftAmp || 0;
    var period = spec.driftPeriod || 1;
    var wave = amp ? Math.sin((t / period) * Math.PI * 2) : 0;
    var center = spec.center + wave * amp;
    var half = spec.width / 2;
    return { min: center - half, max: center + half, center: center };
  }

  function judgeSpeed(speed, band) {
    if (speed < band.min - 1e-9) return "slow";
    if (speed > band.max + 1e-9) return "fast";
    return "ok";
  }

  function stepDanger(danger, dt, verdict) {
    if (verdict === "ok") return Math.max(0, danger - dt * 2.2);
    return danger + dt;
  }

  function torn(danger, sustain) {
    return danger >= sustain;
  }

  function wartAngles(spec) {
    var list = [];
    var n = spec.bumps || 0;
    var origin = -Math.PI / 2 + 1.15;
    for (var i = 0; i < n; i++) {
      list.push(wrapPi(origin + i * (Math.PI * 2 / n)));
    }
    return list;
  }

  function nearWart(spec, head, arc) {
    var warts = wartAngles(spec);
    var limit = arc == null ? spec.bumpArc : arc;
    for (var i = 0; i < warts.length; i++) {
      if (angDist(head, warts[i]) <= limit) return true;
    }
    return false;
  }

  function createPeel(spec) {
    var warts = wartAngles(spec);
    var armed = [];
    var until = [];
    var i;
    for (i = 0; i < warts.length; i++) {
      armed.push(true);
      until.push(-1);
    }
    return {
      warts: warts,
      boost: function (head, t) {
        var add = 0;
        var warn = false;
        var active = false;
        var marks = [];
        for (var k = 0; k < warts.length; k++) {
          var d = angDist(head, warts[k]);
          var hot = false;
          if (spec.bumpAdd > 0 && d <= spec.bumpArc && armed[k]) {
            until[k] = t + spec.bumpHold;
            armed[k] = false;
          }
          if (d > spec.bumpArc + 0.55) armed[k] = true;
          if (spec.bumpAdd > 0 && t < until[k]) {
            add = spec.bumpAdd;
            active = true;
            hot = true;
          } else if (armed[k] && spec.warnArc > 0 && d <= spec.bumpArc + spec.warnArc) {
            warn = true;
          }
          marks.push({ hot: hot, d: d });
        }
        return { add: add, warn: warn && !active, active: active, marks: marks };
      }
    };
  }

  function peelCm(spec) {
    return Math.round(spec.turns * CM_PER_TURN * 10) / 10;
  }

  function commitCm(total, spec) {
    if (spec.practice) return total;
    return Math.round((total + peelCm(spec)) * 10) / 10;
  }

  function nextHearts(hearts, practice) {
    if (practice) return hearts;
    return hearts - 1;
  }

  function rankFor(cleared, rankedTears) {
    if (!cleared) return "ちぎり";
    if (!rankedTears) return "ハロウィン王";
    return "まるむき";
  }

  function quote(rank, cm) {
    return "かぼちゃらせん皮むき「" + rank + "」皮" + Math.round(cm) + "cm";
  }

  function shareText(rank, cm) {
    return quote(rank, cm) + " " + PAGE;
  }

  function tearDetail(practice) {
    if (practice) return "皮が切れた。練習なのでハートはそのまま。最初から";
    return "皮が切れた。ハート−1。このラウンドは最初から";
  }

  function bandWord(spec) {
    if (spec.width >= 0.8) return "広い";
    if (spec.width <= 0.42) return "さらにせまい";
    return "せまい";
  }

  function roundInfo(spec) {
    return {
      title: spec.practice ? "練習ラウンド" : "第" + spec.id + "ラウンド",
      round: spec.id + "/6",
      cm: peelCm(spec).toFixed(1) + "cm",
      band: bandWord(spec),
      note: spec.note,
      line: spec.line
    };
  }

  function speak(kind, ctx) {
    ctx = ctx || {};
    if (kind === "title") return { mood: "cheer", text: "ハロウィン前夜！一本のらせんでむききろう" };
    if (kind === "card") {
      if (ctx.practice) return { mood: "happy", text: "練習だよ。ランクに入らないし、ハートも減らない" };
      return { mood: "cheer", text: ctx.line || "押したまま、まわりを回して" };
    }
    if (kind === "fast" || kind === "slow" || kind === "lift") {
      var word = REASON[kind];
      var tail = ctx.practice ? "練習だからハートはそのまま" : "このラウンドは最初から";
      return { mood: "shock", text: word + "！" + tail };
    }
    if (kind === "ok") return { mood: "cheer", text: "きれいならせん！まるむきだよ" };
    if (kind === "good") return { mood: "happy", text: "いい回転！その調子" };
    if (kind === "edge-fast") return { mood: "worry", text: "ちょっと速い。ゆるめて" };
    if (kind === "edge-slow") return { mood: "worry", text: "ちょっと遅い。もう少し" };
    if (kind === "bump") return { mood: "worry", text: "こぶだよ。針が跳ねる前にゆるめて" };
    if (kind === "bump-on") return { mood: "worry", text: "こぶ！いまはゆっくり" };
    if (kind === "end") {
      if (ctx.rank === "ハロウィン王") return { mood: "cheer", text: "完璧ならせん！ハロウィン王だよ" };
      if (ctx.rank === "まるむき") return { mood: "happy", text: "むききった！まるむきだよ" };
      return { mood: "shock", text: "皮がちぎれた。また挑戦してね" };
    }
    if (kind === "ready") return { mood: "idle", text: "押したまま、かぼちゃのまわりを回して" };
    return { mood: "idle", text: "" };
  }

  function idealPolicy(spec) {
    var slowUntil = -1;
    return function (t, head) {
      var band = bandAt(spec, t);
      if (spec.bumpAdd > 0 && nearWart(spec, head, spec.bumpArc + 0.35)) {
        slowUntil = Math.max(slowUntil, t + spec.bumpHold + 0.12);
      }
      if (t < slowUntil && spec.bumpAdd > 0) {
        return Math.max(0.05, band.max - spec.bumpAdd - 0.045);
      }
      return band.center;
    };
  }

  function simulate(spec, policy, opts) {
    opts = opts || {};
    var dt = opts.dt || 0.02;
    var peel = createPeel(spec);
    var progress = 0;
    var danger = 0;
    var t = 0;
    var head = -Math.PI / 2;
    var maxT = opts.maxT || (spec.turns / 0.15 + spec.grace + 4);
    while (t < maxT) {
      var raw = policy(t, head, spec);
      if (raw === "lift") return { result: "lift", t: t, progress: progress };
      if (typeof raw !== "number") raw = 0;
      head = wrapPi(head + raw * dt * Math.PI * 2);
      progress += Math.max(0, raw) * dt;
      t += dt;
      if (progress >= spec.turns - 1e-9) return { result: "clear", t: t, progress: progress };
      var boost = peel.boost(head, t);
      if (t < spec.grace) continue;
      var band = bandAt(spec, t);
      var eff = raw + (raw > 0 ? boost.add : 0);
      var verdict = judgeSpeed(eff, band);
      danger = stepDanger(danger, dt, verdict);
      if (torn(danger, spec.sustain)) {
        return { result: verdict === "fast" ? "fast" : "slow", t: t, progress: progress };
      }
    }
    return { result: "timeout", t: t, progress: progress };
  }

  function auditRounds() {
    var problems = [];
    if (ROUNDS.length !== 6) problems.push("round count");
    var seen = { narrow: false, drift: false, bumps: false };
    var prev = null;
    var news = 0;
    var i;
    for (i = 0; i < ROUNDS.length; i++) {
      var spec = ROUNDS[i];
      if (spec.id !== i + 1) problems.push("id " + spec.id);
      if (spec.practice !== (i === 0)) problems.push("practice " + spec.id);
      if (!(spec.turns > 0) || !(spec.width > 0)) problems.push("bad spec " + spec.id);
      if (spec.sustain < 0.2) problems.push("sustain " + spec.id);
      if (spec.grace < spec.bumpHold) problems.push("grace " + spec.id);
      var m = mechanics(spec);
      var introduced = 0;
      if (m.narrow && !seen.narrow) introduced++;
      if (m.drift && !seen.drift) introduced++;
      if (m.bumps && !seen.bumps) introduced++;
      if (introduced > 1) problems.push("two new " + spec.id);
      if (spec.note.indexOf("NEW!") === 0) {
        news++;
        if (introduced !== 1) problems.push("NEW mismatch " + spec.id);
      } else if (introduced > 0 && i !== 0) {
        problems.push("new without NEW " + spec.id);
      }
      if (m.drift && !(spec.driftAmp > spec.width / 2)) problems.push("drift weak " + spec.id);
      if (m.bumps && !(spec.bumpAdd > spec.width / 2)) problems.push("bump weak " + spec.id);
      if (m.bumps && !(spec.bumpHold > spec.sustain)) problems.push("hold short " + spec.id);
      if (m.bumps && !(spec.width > spec.bumpAdd + 0.06)) problems.push("bump no window " + spec.id);
      var period = spec.driftPeriod || 1;
      var sample;
      for (sample = 0; sample < 8; sample++) {
        var b = bandAt(spec, period * sample / 8);
        if (!(b.min > 0.08) || !(b.max < GAUGE_MAX - 0.08)) problems.push("band off gauge " + spec.id);
        if (!(b.max - b.min > 0.2)) problems.push("band thin " + spec.id);
      }
      if (prev) {
        var pm = mechanics(prev);
        var turned = 0;
        if (m.narrow && !pm.narrow) turned++;
        if (m.drift && !pm.drift) turned++;
        if (m.bumps && !pm.bumps) turned++;
        if (turned > 1) problems.push("stack " + spec.id);
        if (hardness(spec) <= hardness(prev) + 1e-6) problems.push("hardness " + spec.id);
        if (spec.turns <= prev.turns) problems.push("turns " + spec.id);
        if (spec.width > prev.width + 1e-9) problems.push("width up " + spec.id);
        if (spec.sustain > prev.sustain + 1e-9) problems.push("sustain up " + spec.id);
      }
      seen.narrow = seen.narrow || m.narrow;
      seen.drift = seen.drift || m.drift;
      seen.bumps = seen.bumps || m.bumps;
      prev = spec;
    }
    if (news !== 3) problems.push("NEW count " + news);
    if (!seen.narrow || !seen.drift || !seen.bumps) problems.push("missing trap");
    var allThree = 0;
    for (i = 0; i < ROUNDS.length; i++) {
      var mm = mechanics(ROUNDS[i]);
      if (mm.narrow && mm.drift && mm.bumps) allThree++;
    }
    if (allThree !== 1 || !mechanics(ROUNDS[5]).drift || !mechanics(ROUNDS[5]).bumps) {
      problems.push("combine");
    }
    if (mechanics(ROUNDS[0]).narrow || mechanics(ROUNDS[0]).drift || mechanics(ROUNDS[0]).bumps) {
      problems.push("r1 traps");
    }
    if (ROUNDS[1].driftAmp || ROUNDS[1].bumps) problems.push("r2 extra");
    if (!ROUNDS[2].driftAmp || ROUNDS[2].bumps) problems.push("r3");
    if (ROUNDS[3].driftAmp || !ROUNDS[3].bumps) problems.push("r4");
    if (ROUNDS[4].driftAmp || !ROUNDS[4].bumps) problems.push("r5");
    if (ROUNDS[3].width !== ROUNDS[2].width) problems.push("r4 width changed");
    if (ROUNDS[2].width !== ROUNDS[1].width) problems.push("r3 width changed");
    return { ok: problems.length === 0, problems: problems, scores: ROUNDS.map(hardness) };
  }

  return {
    ROUNDS: ROUNDS,
    RULES: RULES,
    PRACTICE_NOTE: PRACTICE_NOTE,
    RANK_LINE: RANK_LINE,
    REASON: REASON,
    CLEAR_WORD: CLEAR_WORD,
    FAIL_HEAD: FAIL_HEAD,
    HERO: HERO,
    ANNOUNCE: ANNOUNCE,
    PAGE: PAGE,
    CM_PER_TURN: CM_PER_TURN,
    GAUGE_MAX: GAUGE_MAX,
    mechanics: mechanics,
    hardness: hardness,
    bandAt: bandAt,
    judgeSpeed: judgeSpeed,
    stepDanger: stepDanger,
    torn: torn,
    wartAngles: wartAngles,
    nearWart: nearWart,
    createPeel: createPeel,
    peelCm: peelCm,
    commitCm: commitCm,
    nextHearts: nextHearts,
    rankFor: rankFor,
    quote: quote,
    shareText: shareText,
    tearDetail: tearDetail,
    roundInfo: roundInfo,
    speak: speak,
    idealPolicy: idealPolicy,
    simulate: simulate,
    auditRounds: auditRounds,
    wrapPi: wrapPi
  };
});
