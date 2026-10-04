/*!
 * 萬用計算機 — 計算核心(純函式,不碰 DOM)
 * 公式、單位換算、驗證順序與錯誤訊息,皆逐項對照原程式 ForceCalculatorCS(C#)。
 * 所有輸入都以「使用者輸入的原始字串」傳入,與原程式 ReadFloat 的讀取順序一致。
 */
(function (root) {
  'use strict';

  var PI = Math.PI;
  var G = 9.80665;           // 1 kgf = 9.80665 N
  var KGFCM = 0.0980665;     // 1 kgf·cm = 0.0980665 N·m
  var SCREW_E = 206000;      // 螺桿材質(碳鋼/軸承鋼)楊氏模數 E ≈ 206 GPa = 206000 N/mm²

  /* ---------- 錯誤型別 ---------- */
  class CalcError extends Error {
    constructor(message) {
      super(message);
      this.name = 'CalcError';
    }
  }

  /* ---------- 輸入解析 ---------- */
  var FULLWIDTH = /[！-～]/g;

  // 全形數字/符號(中文輸入法常見)轉半形;頭尾空白去除,中間有空白視為非數字
  function normalize(s) {
    return String(s)
      .replace(/　/g, ' ')
      .replace(FULLWIDTH, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[−–—]/g, '-')
      .trim();
  }

  // 回傳 {empty:true} | {bad:true} | {value:number}
  function parseNum(raw) {
    var s = normalize(raw == null ? '' : raw);
    if (s === '') return { empty: true };
    s = s.replace(/(\d),$/, '$1');                                              // 5, → 5(與原程式相同,尾端逗號忽略)
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');   // 1,234.5 → 千分位
    else if (/^[+-]?\d*,\d+$/.test(s)) s = s.replace(',', '.');                // 0,5 → 小數逗號
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return { bad: true };
    var v = Number(s);
    return isFinite(v) ? { value: v } : { bad: true };
  }

  function readFloat(raw, name) {
    var r = parseNum(raw);
    if (r.empty) throw new CalcError('請輸入' + name);
    if (r.bad) throw new CalcError(name + '必須為數字');
    return r.value;
  }

  function positive(v, msg) {
    if (!(v > 0)) throw new CalcError(msg);
    return v;
  }

  function efficiency(v, msg) {
    var e = v / 100;
    if (!(e > 0 && e <= 1)) throw new CalcError(msg);
    return e;
  }

  function finite(v) {
    if (!isFinite(v)) throw new CalcError('計算結果超出範圍,請檢查輸入數值');
    return v;
  }

  /* ---------- 數字格式(對應 .NET 的 N / F / G6)---------- */
  function groupInt(s) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var nfBig = {};
  function bigFormat(x, d) {
    var nf = nfBig[d] || (nfBig[d] = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return nf.format(x);
  }

  // 固定小數位(ax ≥ 0):以精確二進位值四捨五入;恰為「剛好一半」時捨入到偶數
  // (與 .NET Core 3.0+ 的 ToString("F/N") 相同,例如 0.8125 → "0.812"、2.5 → "2")
  function toFixedEven(ax, d) {
    var s = ax.toFixed(d);
    var y = ax * Math.pow(2, d + 1);                 // 乘 2 的次方是精確運算
    if (Number.isInteger(y) && y % 2 === 1) {        // y 為奇數 ⇔ 小數展開恰好 d+1 位且尾數為 5
      var lower = ax.toFixed(d + 1).slice(0, -1);    // 去掉尾數 5 = 向零捨去
      if (lower.charAt(lower.length - 1) === '.') lower = lower.slice(0, -1);
      if (Number(lower.charAt(lower.length - 1)) % 2 === 0) s = lower;
    }
    return s;
  }

  // N{d}:千分位 + 固定小數位
  function fmtN(x, d) {
    if (!isFinite(x)) return String(x);
    if (Math.abs(x) >= 1e21) return bigFormat(x, d);
    var neg = x < 0;
    var parts = toFixedEven(Math.abs(x), d).split('.');
    parts[0] = groupInt(parts[0]);
    return (neg ? '-' : '') + parts.join('.');
  }

  // F{d}:固定小數位、無千分位
  function fmtF(x, d) {
    if (!isFinite(x)) return String(x);
    if (Math.abs(x) >= 1e21) return x.toFixed(d);
    return (x < 0 ? '-' : '') + toFixedEven(Math.abs(x), d);
  }

  // 約 6 位有效數字;一般大小的數以一般小數表示(並加千分位),極大/極小才用科學記號
  function fmtG6(x) {
    if (x === 0) return '0';
    if (!isFinite(x)) return String(x);
    var neg = x < 0;
    var ax = Math.abs(x);
    var ex = ax.toExponential(5).split('e');          // 已四捨五入到 6 位有效數字
    var exp = Number(ex[1]);
    var out;
    if (exp < -9 || exp >= 15) {
      var mant = ex[0].replace(/\.?0+$/, '');
      out = mant + 'E' + (exp < 0 ? '-' : '+') + (Math.abs(exp) < 10 ? '0' : '') + Math.abs(exp);
    } else {
      var dec = Math.max(0, 5 - exp);
      var s = toFixedEven(ax, dec);
      if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
      var p = s.split('.');
      p[0] = groupInt(p[0]);
      out = p.join('.');
    }
    return (neg ? '-' : '') + out;
  }

  /* ---------- 1. 馬達扭力 → 推力 ---------- */
  // p: {mech(0滾珠螺桿/1皮帶/2齒條/3簡易), torque, torqueUnit(0 N·m/1 kgf·cm), gear, eff, lead, radius}
  function thrust(p) {
    var t = readFloat(p.torque, '扭力 T');
    positive(t, '扭力必須大於 0');
    var tNm = p.torqueUnit === 1 ? t * KGFCM : t;
    var f;
    if (p.mech === 3) {
      var r0 = readFloat(p.radius, '節圓半徑 r');
      positive(r0, '半徑必須大於 0');
      f = tNm / (r0 / 1000);
    } else {
      var i = readFloat(p.gear, '減速比 i');
      var eta = readFloat(p.eff, '傳動效率 η') / 100;
      positive(i, '減速比必須大於 0');
      if (!(eta > 0 && eta <= 1)) throw new CalcError('傳動效率必須介於 0~100%');
      if (p.mech === 0) {
        var lead = readFloat(p.lead, '導程 L');
        positive(lead, '導程必須大於 0');
        f = PI * 2 * eta * tNm * i / (lead / 1000);
      } else {
        var r1 = readFloat(p.radius, '節圓半徑 r');
        positive(r1, '半徑必須大於 0');
        f = eta * tNm * i / (r1 / 1000);
      }
    }
    return { forceN: finite(f) };
  }

  // 皮帶/同步輪輔助:由齒數+節距求減速比與節圓半徑
  function beltHelper(p) {
    var z1 = readFloat(p.z1, '主動輪齒數 Z1');
    var z2 = readFloat(p.z2, '從動輪齒數 Z2');
    var pitch = readFloat(p.pitch, '節距 P');
    if (z1 <= 0 || z2 <= 0 || pitch <= 0) throw new CalcError('齒數與節距必須大於 0');
    return { gear: z2 / z1, radius: pitch * z2 / (PI * 2) };
  }

  // 螺桿容許軸向推力(歐拉挫曲)。fix: 0固定-固定 1固定-支撐 2支撐-支撐 3固定-自由
  var FIX_FACTORS = [4.0, 2.0, 1.0, 0.25];
  function buckling(p) {
    var D = readFloat(p.outer, '螺桿外徑 D');
    var ratio = readFloat(p.ratio, '谷徑/外徑比例');
    var span = readFloat(p.span, '支撐跨距 Lb');
    var sf = readFloat(p.sf, '安全係數');
    positive(D, '螺桿外徑必須大於 0');
    if (!(ratio > 0 && ratio <= 1)) throw new CalcError('谷徑/外徑比例必須介於 0~1 之間');
    positive(span, '支撐跨距必須大於 0');
    positive(sf, '安全係數必須大於 0');
    var d = D * ratio;
    var k = FIX_FACTORS[p.fix];
    var I = PI * Math.pow(d, 4) / 64;
    var pcr = k * PI * PI * SCREW_E * I / (span * span);
    var allow = pcr / sf;
    return { dMm: d, ratio: ratio, sf: sf, pcrN: finite(pcr), allowN: finite(allow), allowKgf: allow / G };
  }

  /* ---------- 2. 速度 ---------- */
  function speed(p) {
    var n = readFloat(p.rpm, '馬達轉速 N');
    positive(n, '馬達轉速必須大於 0');
    var nOut;
    if (p.mech === 3) {
      nOut = n;
    } else {
      var i = readFloat(p.gear, '減速比 i');
      positive(i, '減速比必須大於 0');
      nOut = n / i;
    }
    var v;
    if (p.mech === 0) {
      var lead = readFloat(p.lead, '導程 L');
      positive(lead, '導程必須大於 0');
      v = nOut * lead / 60;
    } else {
      var r = readFloat(p.radius, '節圓半徑 r');
      positive(r, '半徑必須大於 0');
      v = nOut * 2 * PI * r / 60;
    }
    return { mmPerS: finite(v) };
  }

  /* ---------- 3. 氣缸推力 ---------- */
  var PRESSURE_TO_PA = [1000000, 98066.5, 100000];   // MPa, kgf/cm², bar
  // p: {dir(0推出/1拉回), bore, rod, pressure, pUnit, eff}
  function cylinder(p) {
    var D = readFloat(p.bore, '缸徑 D');
    positive(D, '缸徑必須大於 0');
    var P = readFloat(p.pressure, '使用氣壓 P');
    positive(P, '氣壓必須大於 0');
    var pa = P * PRESSURE_TO_PA[p.pUnit];
    var eta = readFloat(p.eff, '效率 η') / 100;
    if (!(eta > 0 && eta <= 1)) throw new CalcError('效率必須介於 0~100%');
    var area = PI * Math.pow(D / 1000, 2) / 4;
    if (p.dir === 1) {
      var d = readFloat(p.rod, '活塞桿徑 d');
      positive(d, '活塞桿徑必須大於 0');
      if (d >= D) throw new CalcError('活塞桿徑必須小於缸徑');
      var rodArea = PI * Math.pow(d / 1000, 2) / 4;
      area = area - rodArea;
    }
    return { forceN: finite(pa * area * eta) };
  }

  /* ---------- 4. 伺服脈波換算 ---------- */
  function readFour(p, names) {
    var a = readFloat(p.a, names[0]);
    var b = readFloat(p.b, names[1]);
    var c = readFloat(p.c, names[2]);
    var d = readFloat(p.d, names[3]);
    if (a <= 0 || b <= 0 || c <= 0 || d <= 0) throw new CalcError('所有數值必須大於 0');
    return [a, b, c, d];
  }
  function row(label, value, decimals) {
    return { label: label, value: finite(value), d: decimals };
  }

  // 轉速 → 脈波與速度。a=RPM b=PPR c=減速比 d=導程
  function speedForward(p) {
    var v = readFour(p, ['伺服馬達轉速 RPM', '電子齒輪比 PPR', '減速比', '螺桿導程']);
    var pps = v[0] / 60 * v[1];
    var rps = v[0] / 60 / v[2];
    var mm = rps * v[3];
    return [row('脈波頻率 (PPS)', pps, 5), row('輸出轉速 (RPS)', rps, 5), row('線性速度 (mm/s)', mm, 5)];
  }
  // 脈波 → 轉速與速度。a=PPS b=PPR c=減速比 d=導程
  function speedReverse(p) {
    var v = readFour(p, ['脈波 PPS', '電子齒輪比 PPR', '減速比', '螺桿導程']);
    var rpm = v[0] / v[1] * 60;
    var rps = rpm / 60 / v[2];
    var mm = rps * v[3];
    return [row('伺服馬達轉速 (RPM)', rpm, 5), row('輸出轉速 (RPS)', rps, 5), row('線性速度 (mm/s)', mm, 5)];
  }
  // 距離 → 脈衝。a=距離 b=導程 c=減速比 d=馬達每圈脈衝數
  function pulseForward(p) {
    var v = readFour(p, ['移動距離', '螺桿導程', '減速比', '馬達每圈脈衝數']);
    var outTurns = v[0] / v[1];
    var motorTurns = outTurns * v[2];
    var pulses = motorTurns * v[3];
    return [row('輸出轉數 (圈)', outTurns, 2), row('馬達轉數 (圈)', motorTurns, 2), row('總脈衝數 (pulse)', pulses, 0)];
  }
  // 脈衝 → 距離。a=總脈衝 b=導程 c=減速比 d=馬達每圈脈衝數
  function pulseReverse(p) {
    var v = readFour(p, ['總脈衝數', '螺桿導程', '減速比', '馬達每圈脈衝數']);
    var motorTurns = v[0] / v[3];
    var outTurns = motorTurns / v[2];
    var mm = outTurns * v[1];
    return [row('馬達轉數 (圈)', motorTurns, 2), row('輸出轉數 (圈)', outTurns, 2), row('移動距離 (mm)', mm, 2)];
  }

  /* ---------- 5. 負載慣量比 ---------- */
  // p: {mech, mass, gear, lead, radius, motorJ}(motorJ 單位 ×10⁻⁴ kg·m²)
  function inertia(p) {
    var m = readFloat(p.mass, '負載質量 m');
    positive(m, '負載質量必須大於 0');
    var jm = readFloat(p.motorJ, '馬達轉子慣量 J');
    positive(jm, '馬達轉子慣量必須大於 0');
    var jmSi = jm * 0.0001;
    var i;
    if (p.mech === 3) {
      i = 1;
    } else {
      i = readFloat(p.gear, '減速比 i');
      positive(i, '減速比必須大於 0');
    }
    var jl;
    if (p.mech === 0) {
      var lead = readFloat(p.lead, '導程 L');
      positive(lead, '導程必須大於 0');
      var l = lead / 1000;
      jl = m * Math.pow(l / (PI * 2), 2) / (i * i);
    } else {
      var r = readFloat(p.radius, '節圓半徑 r');
      positive(r, '半徑必須大於 0');
      var rm = r / 1000;
      jl = m * rm * rm / (i * i);
    }
    var ratio = finite(jl / jmSi);
    var level, verdict;
    if (ratio <= 5) {
      level = 'ok';
      verdict = '理想範圍（≤5），伺服調機通常容易穩定';
    } else if (ratio <= 10) {
      level = 'warn';
      verdict = '可接受範圍（5~10），多數應用仍可正常運作';
    } else {
      level = 'bad';
      verdict = '偏高（>10），建議加大馬達容量、提高減速比或降低負載質量';
    }
    return { ratio: ratio, level: level, verdict: verdict };
  }

  /* ---------- 6. 加速轉矩 ---------- */
  function accelTorque(p) {
    var dn = readFloat(p.deltaRpm, '轉速變化量 ΔN');
    positive(dn, '轉速變化量必須大於 0');
    var t = readFloat(p.time, '加減速時間 t');
    positive(t, '加減速時間必須大於 0');
    var j = readFloat(p.inertiaJ, '總慣量 J');
    positive(j, '總慣量必須大於 0');
    var jSi = j * 0.0001;
    var alpha = PI * 2 * (dn / 60) / t;
    return { torqueNm: finite(jSi * alpha), alpha: alpha };
  }

  /* ---------- 7. 垂直升降負載 ---------- */
  // p: {mech, mass, gear, lead, radius, eff, sf}
  function verticalLift(p) {
    var m = readFloat(p.mass, '負載質量 m');
    positive(m, '負載質量必須大於 0');
    var eta = readFloat(p.eff, '傳動效率 η') / 100;
    if (!(eta > 0 && eta <= 1)) throw new CalcError('傳動效率必須介於 0~100%');
    var sf = readFloat(p.sf, '安全係數 SF');
    positive(sf, '安全係數必須大於 0');
    var i;
    if (p.mech === 3) {
      i = 1;
    } else {
      i = readFloat(p.gear, '減速比 i');
      positive(i, '減速比必須大於 0');
    }
    var force = m * G * sf;
    var t;
    if (p.mech === 0) {
      var lead = readFloat(p.lead, '導程 L');
      positive(lead, '導程必須大於 0');
      t = force * (lead / 1000) / (PI * 2 * eta * i);
    } else {
      var r = readFloat(p.radius, '節圓半徑 r');
      positive(r, '半徑必須大於 0');
      t = force * (r / 1000) / (eta * i);
    }
    return { torqueNm: finite(t), forceN: force };
  }

  /* ---------- 8. 輸送帶馬達扭力 ---------- */
  function conveyor(p) {
    var load = readFloat(p.loadMass, '負載重量');
    positive(load, '負載重量必須大於 0');
    var belt = readFloat(p.beltMass, '輸送帶/滾筒自重');
    if (belt < 0) throw new CalcError('輸送帶/滾筒自重不可為負數');
    var mu = readFloat(p.friction, '摩擦係數 μ');
    positive(mu, '摩擦係數必須大於 0');
    var dia = readFloat(p.rollerDia, '驅動滾筒直徑 D');
    positive(dia, '驅動滾筒直徑必須大於 0');
    var i = readFloat(p.gear, '減速比 i');
    positive(i, '減速比必須大於 0');
    var eta = readFloat(p.eff, '傳動效率 η') / 100;
    if (!(eta > 0 && eta <= 1)) throw new CalcError('傳動效率必須介於 0~100%');
    var force = mu * (load + belt) * G;
    var r = dia / 1000 / 2;
    var t = force * r / (i * eta);
    return { torqueNm: finite(t), forceN: force };
  }

  /* ---------- 9. 通用單位換算 ---------- */
  // 「真空」類別(原程式沒有,為網頁版新增):各種真空/壓力表示法互換,全部經「絕對壓力 Pa」中轉。
  // 單位格式 [名稱, 係數, 種類, 群組];種類:
  //   'abs'   絕對壓力(完全真空 = 0):Pa = v × 係數
  //   'gauge' 表壓(以大氣壓為 0,真空為負值):Pa = 大氣壓 + v × 係數
  //   'vac'   真空度(正值,低於大氣壓的量):Pa = 大氣壓 − v × 係數
  //   'pct'   真空度 %(0% = 大氣壓,100% = 完全真空):Pa = 大氣壓 × (1 − v/100)
  var TORR = 101325 / 760;   // 1 Torr = 1 mmHg(視為相同,這樣 −760 mmHg 剛好是完全真空)
  var INHG = 25.4 * TORR;    // 1 inHg = 25.4 mmHg
  var PSI = 6894.757293168;
  var G_VAC = '真空度(正值:低於大氣壓的量)';
  var G_GAUGE = '表壓(負值 = 真空)';
  var G_ABS = '絕對壓力(完全真空 = 0)';
  var ATM_DEFAULT = '101.325';   // 標準大氣壓,kPa

  var CATEGORIES = [
    { name: '力 (Force)', units: [['N', 1], ['kgf', 9.80665], ['lbf', 4.4482216153]] },
    { name: '扭力 (Torque)', units: [['N·m', 1], ['kgf·cm', 0.0980665], ['kgf·m', 9.80665], ['lbf·ft', 1.3558179483]] },
    { name: '壓力 (Pressure)', units: [['Pa', 1], ['kPa', 1000], ['MPa', 1000000], ['bar', 100000], ['kgf/cm²', 98066.5], ['psi', 6894.757293168]] },
    { name: '長度 (Length)', units: [['mm', 1], ['cm', 10], ['m', 1000], ['inch', 25.4]] },
    { name: '速度 (Speed)', units: [['mm/s', 1], ['mm/min', 1 / 60], ['m/s', 1000], ['m/min', 16.666666666666668]] },
    { name: '質量 (Mass)', units: [['kg', 1], ['g', 0.001], ['lb', 0.45359237], ['ton (公噸)', 1000]] },
    {
      name: '真空 (Vacuum)',
      vacuum: true,
      units: [
        ['kPa 真空度', 1000, 'vac', G_VAC],
        ['mmHg 真空度', TORR, 'vac', G_VAC],
        ['inHg 真空度', INHG, 'vac', G_VAC],
        ['真空度 %', 1, 'pct', G_VAC],
        ['kPa 表壓', 1000, 'gauge', G_GAUGE],
        ['mmHg 表壓', TORR, 'gauge', G_GAUGE],
        ['inHg 表壓', INHG, 'gauge', G_GAUGE],
        ['bar 表壓', 100000, 'gauge', G_GAUGE],
        ['psi 表壓', PSI, 'gauge', G_GAUGE],
        ['Pa 絕對', 1, 'abs', G_ABS],
        ['kPa 絕對', 1000, 'abs', G_ABS],
        ['mbar 絕對', 100, 'abs', G_ABS],
        ['bar 絕對', 100000, 'abs', G_ABS],
        ['Torr 絕對', TORR, 'abs', G_ABS],
        ['mTorr 絕對', TORR / 1000, 'abs', G_ABS],
        ['atm', 101325, 'abs', G_ABS],
        ['psi 絕對', PSI, 'abs', G_ABS]
      ]
    }
  ];

  function toAbsPa(u, v, atm) {
    switch (u[2]) {
      case 'gauge': return atm + v * u[1];
      case 'vac': return atm - v * u[1];
      case 'pct': return atm * (1 - v / 100);
      default: return v * u[1];
    }
  }

  function fromAbsPa(u, a, atm) {
    switch (u[2]) {
      case 'gauge': return (a - atm) / u[1];
      case 'vac': return (atm - a) / u[1];
      case 'pct': return (1 - a / atm) * 100;
      default: return a / u[1];
    }
  }

  // p: {value, cat, from, to, atm(僅真空類別:大氣壓力基準,kPa)}
  function convert(p) {
    var v = readFloat(p.value, '數值');
    var cat = CATEGORIES[p.cat];
    var from = cat.units[p.from];
    var to = cat.units[p.to];
    if (!cat.vacuum) {   // 原本的 6 個類別:運算與原程式完全相同
      return { value: finite(v * from[1] / to[1]), unit: to[0] };
    }
    var relative = function (u) { return u[2] !== 'abs'; };
    var atm = 101325;
    if (relative(from) || relative(to)) {   // 只有「表壓/真空度」與絕對壓力互換時才需要大氣壓力
      var kpa = readFloat(p.atm, '大氣壓力基準');
      positive(kpa, '大氣壓力必須大於 0');
      atm = kpa * 1000;
    }
    var a = toAbsPa(from, v, atm);
    if (a < 0) {
      if (a > -0.5) a = 0;   // 容許微小誤差,例如 −760 mmHg、−14.696 psi 都視為完全真空
      else throw new CalcError('換算後的絕對壓力小於 0,請檢查數值(真空度不可超過大氣壓力)');
    }
    return { value: finite(fromAbsPa(to, a, atm)), unit: to[0] };
  }

  /* ---------- 結果顯示:單位切換與說明文字 ---------- */
  function same(x) { return x; }
  var UNITS = {
    force: [{ t: 'N', f: same }, { t: 'kgf', f: function (x) { return x / G; } }],
    torque: [{ t: 'N·m', f: same }, { t: 'kgf·cm', f: function (x) { return x / KGFCM; } }],
    speed: [
      { t: 'mm/s', f: same },
      { t: 'mm/min', f: function (x) { return x * 60; } },
      { t: 'm/min', f: function (x) { return x * 60 / 1000; } }
    ]
  };

  // 對應 .NET 的 "G"(最短可還原表示),僅用於回顯使用者輸入的比例/安全係數
  function fmtGen(x) { return String(x); }

  var LINES = {
    buckling: function (r) {
      return [
        '≈ ' + fmtN(r.allowKgf, 1) + ' kgf　|　估算谷徑 d ≈ ' + fmtF(r.dMm, 2) + ' mm（外徑×' + fmtGen(r.ratio) + '）',
        '臨界挫曲負荷 Pcr ≈ ' + fmtN(r.pcrN, 0) + ' N（安全係數 ' + fmtGen(r.sf) + '）',
        '谷徑為概估值非實測，正式設計請以螺桿廠商提供之谷徑數值或型錄核對'
      ];
    },
    accel: function (r) {
      return ['角加速度 α = ' + fmtN(r.alpha, 2) + ' rad/s²'];
    },
    vertical: function (r) {
      return ['已含安全係數的靜態負載力 = ' + fmtN(r.forceN, 2) + ' N（' + fmtN(r.forceN / G, 2) + ' kgf）'];
    },
    conveyor: function (r) {
      return ['滾筒驅動力 = ' + fmtN(r.forceN, 2) + ' N（' + fmtN(r.forceN / G, 2) + ' kgf）'];
    }
  };

  root.Calc = {
    CalcError: CalcError,
    G: G,
    KGFCM: KGFCM,
    parseNum: parseNum,
    readFloat: readFloat,
    UNITS: UNITS,
    LINES: LINES,
    fmt: { n: fmtN, f: fmtF, g6: fmtG6 },
    thrust: thrust,
    beltHelper: beltHelper,
    buckling: buckling,
    speed: speed,
    cylinder: cylinder,
    speedForward: speedForward,
    speedReverse: speedReverse,
    pulseForward: pulseForward,
    pulseReverse: pulseReverse,
    inertia: inertia,
    accelTorque: accelTorque,
    verticalLift: verticalLift,
    conveyor: conveyor,
    CATEGORIES: CATEGORIES,
    ATM_DEFAULT: ATM_DEFAULT,
    convert: convert
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.Calc;
})(typeof window !== 'undefined' ? window : globalThis);
