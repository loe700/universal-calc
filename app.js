/*! 萬用計算機 — 介面層(手機優先)
 *  所有計算與數字格式都在 calc.js(已與原程式逐筆比對),這裡只負責畫面與互動。 */
(function () {
  'use strict';

  var C = window.Calc;
  var CalcError = C.CalcError;
  var fmt = C.fmt;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  /* ======================= 小工具 ======================= */
  function append(el, kids) {
    if (kids == null || kids === false) return;
    if (Array.isArray(kids)) { for (var i = 0; i < kids.length; i++) append(el, kids[i]); return; }
    el.appendChild(typeof kids === 'object' ? kids : document.createTextNode(String(kids)));
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    append(el, kids);
    return el;
  }

  var ICONS = {
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevd: '<path d="M6 9l6 6 6-6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4 4.5V9h4.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    swap: '<path d="M4 8h14"/><path d="M14.5 4.5L18 8l-3.5 3.5"/><path d="M20 16H6"/><path d="M9.5 12.5L6 16l3.5 3.5"/>',
    thrust: '<path d="M4 12h11"/><path d="M11 7l5 5-5 5"/><path d="M20 5v14"/>',
    gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.5l3.6-3.6"/><circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none"/>',
    piston: '<rect x="3" y="8" width="11" height="8" rx="1.6"/><path d="M14 12h7"/><path d="M8 8v8"/>',
    pulse: '<path d="M3 12h4l2.2-6 3.6 12 2.2-6H21"/>',
    disc: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/><path d="M12 4v5.6M12 14.4V20M4 12h5.6M14.4 12H20"/>',
    trend: '<path d="M4 17.5l5.2-5.2 3.8 3 7-8"/><path d="M15.5 7.5H20V12"/>',
    lift: '<path d="M12 20V7"/><path d="M7 12l5-5 5 5"/><path d="M5 20h14"/>',
    belt: '<rect x="3" y="8.5" width="18" height="7" rx="3.5"/><circle cx="7" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.2" fill="currentColor" stroke="none"/>'
  };

  function icon(name) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ico');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.innerHTML = ICONS[name];
    return s;
  }

  /* ======================= 偏好與輸入記憶 ======================= */
  var KEY = 'wcalc.v1';
  var store = {
    data: { ui: {}, tabs: {} },
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return;
        var d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          store.data = {
            ui: d.ui && typeof d.ui === 'object' ? d.ui : {},
            tabs: d.tabs && typeof d.tabs === 'object' ? d.tabs : {}
          };
        }
      } catch (e) { /* 無痕模式或儲存空間被封鎖:不記憶也能正常使用 */ }
    },
    save: function () {
      try { window.localStorage.setItem(KEY, JSON.stringify(store.data)); } catch (e) { /* 同上 */ }
    }
  };
  var saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(store.save, 250);
  }
  function flushSave() {
    clearTimeout(saveTimer);
    store.save();
  }

  /* ======================= 提示訊息 ======================= */
  var toastEl = $('toast');
  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = h('textarea', { 'aria-hidden': 'true', readonly: true, tabindex: '-1' });
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-1000px';
      ta.style.opacity = '0';
      ta.style.fontSize = '16px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { ta.setSelectionRange(0, text.length); document.execCommand('copy'); toast(okMsg); } catch (e) { toast('這個瀏覽器無法複製'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else {
      fallback();
    }
  }

  /* ======================= 底部彈出面板 ======================= */
  var sheet = (function () {
    var root = null, titleEl, bodyEl, closeBtn, opener = null, isOpen = false;

    function onKey(e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {                       // 簡易焦點鎖定
        var f = root.querySelectorAll('button, select, input');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    function build() {
      titleEl = h('h2', { id: 'sheetTitle' });
      closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': '關閉', onclick: close }, icon('close'));
      bodyEl = h('div', { class: 'sheet-body' });
      var panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheetTitle' }, [
        h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }),
        h('div', { class: 'sheet-head' }, [titleEl, closeBtn]),
        bodyEl
      ]);
      root = h('div', { class: 'sheet-root', hidden: true }, [h('div', { class: 'sheet-backdrop', onclick: close }), panel]);
      document.body.appendChild(root);
      document.addEventListener('keydown', onKey);
    }

    function open(title, content) {
      if (!root) build();
      opener = document.activeElement;
      titleEl.textContent = title;
      bodyEl.textContent = '';
      append(bodyEl, content);
      bodyEl.scrollTop = 0;
      root.hidden = false;
      isOpen = true;
      document.body.classList.add('modal-open');
      closeBtn.focus();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      root.hidden = true;
      document.body.classList.remove('modal-open');
      if (opener && typeof opener.focus === 'function') { try { opener.focus(); } catch (e) { /* 忽略 */ } }
      opener = null;
    }

    return { open: open, close: close };
  })();

  /* ======================= 元件:分段選擇、欄位、表單 ======================= */
  function makeSeg(options, def, label, onChange) {
    var idx = def || 0;
    var root = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    var btns = options.map(function (txt, i) {
      var b = h('button', { type: 'button', class: 'seg-btn', role: 'radio', onclick: function () { set(i, true); } }, txt);
      root.appendChild(b);
      return b;
    });
    function paint() {
      btns.forEach(function (b, i) { b.setAttribute('aria-checked', i === idx ? 'true' : 'false'); });
    }
    function set(i, fire) {
      var n = Number(i);
      if (!(n >= 0 && n < options.length)) n = 0;
      var changed = n !== idx;
      idx = n;
      paint();
      if (fire && changed && onChange) onChange(idx);
    }
    paint();
    return { el: root, get: function () { return idx; }, set: function (i) { set(i, false); } };
  }

  var uid = 0;

  function makeField(spec, emit, onEnter) {
    var f = { spec: spec };

    if (spec.type === 'custom') {                 // 自訂區塊(例如單位換算的「從／到」)
      var c = spec.build(emit);
      f.wrap = h('div', { class: 'field' }, c.node);
      f.read = c.read; f.write = c.write; f.reset = c.reset; f.update = c.update;
      return f;
    }
    if (spec.type === 'block') {                  // 靜態區塊(例如皮帶輪輔助計算)
      f.wrap = h('div', { class: 'field' }, spec.node);
      f.read = f.write = f.reset = function () {};
      return f;
    }

    var id = 'f' + (++uid);
    var hintId = id + 'h';
    var wrap = h('div', { class: 'field' });
    f.wrap = wrap;

    var label = h('label', { for: id }, spec.label);
    if (spec.unit) label.appendChild(h('span', { class: 'sr' }, '（' + spec.unit + '）'));
    var head = h('div', { class: 'field-head' }, label);
    if (spec.ref) {
      head.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { spec.ref.open(); } }, [spec.ref.label, icon('chev')]));
    }
    wrap.appendChild(head);

    if (spec.type === 'select') {
      var sel = h('select', { id: id, 'aria-describedby': spec.hint ? hintId : null });
      spec.options.forEach(function (t, i) { sel.appendChild(h('option', { value: i }, t)); });
      sel.value = String(spec.def || 0);
      sel.addEventListener('change', function () { emit(spec.key); });
      wrap.appendChild(h('div', { class: 'sel' }, sel));
      f.read = function (v) { v[spec.key] = Number(sel.value); };
      f.write = function (o) { if (o[spec.key] != null) sel.value = String(o[spec.key]); };
      f.reset = function () { sel.value = String(spec.def || 0); };
    } else {                                      // 數字輸入
      var input = h('input', {
        id: id, type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
        autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
        placeholder: spec.placeholder || null, 'aria-describedby': spec.hint ? hintId : null
      });
      input.value = spec.def || '';
      input.addEventListener('input', function () { emit(spec.key); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); onEnter(); }
      });
      var box = h('div', { class: 'inp', onclick: function () { input.focus(); } }, input);
      if (spec.unit) box.appendChild(h('span', { class: 'unit', 'aria-hidden': 'true' }, spec.unit));
      var row = h('div', { class: 'num-row' }, box);
      var seg = null;
      if (spec.seg) {
        seg = makeSeg(spec.seg.options, spec.seg.def, spec.label + '的單位', function () { emit(spec.seg.key); });
        row.appendChild(seg.el);
      }
      wrap.appendChild(row);
      f.input = input;
      f.read = function (v) { v[spec.key] = input.value; if (seg) v[spec.seg.key] = seg.get(); };
      f.write = function (o) {
        if (o[spec.key] != null) input.value = String(o[spec.key]);
        if (seg && o[spec.seg.key] != null) seg.set(o[spec.seg.key]);
      };
      f.reset = function () { input.value = spec.def || ''; if (seg) seg.set(spec.seg.def || 0); };
    }

    if (spec.hint) wrap.appendChild(h('p', { class: 'hint', id: hintId }, spec.hint));
    return f;
  }

  function buildForm(specs, onEnter) {
    var listeners = [];
    var fields = [];
    var root = h('div', { class: 'fields' });

    function values() {
      var v = {};
      fields.forEach(function (f) { f.read(v); });
      return v;
    }
    function refresh() {
      var v = values();
      fields.forEach(function (f) { if (f.update) f.update(v); });
      v = values();
      fields.forEach(function (f) { if (f.spec.showIf) f.wrap.hidden = !f.spec.showIf(v); });
    }
    function emit(src) {
      refresh();
      listeners.forEach(function (cb) { cb(src); });
    }

    specs.forEach(function (s) {
      var f = makeField(s, emit, function () { if (onEnter) onEnter(); });
      fields.push(f);
      root.appendChild(f.wrap);
    });
    refresh();

    return {
      el: root,
      get: values,
      set: function (o) { fields.forEach(function (f) { f.write(o || {}); }); refresh(); },
      reset: function () { fields.forEach(function (f) { f.reset(); }); refresh(); },
      onChange: function (cb) { listeners.push(cb); },
      emit: emit
    };
  }

  /* ======================= 結果顯示 ======================= */
  // 單一數值結果(可切換單位、複製)
  function bigResult(cfg) {
    var res = null;
    var api = { onUnitChange: null, onRender: null, miniData: null };
    var unitSeg = cfg.units && cfg.units.length > 1
      ? makeSeg(cfg.units.map(function (u) { return u.t; }), 0, cfg.label + '的單位', function () { render(); if (api.onUnitChange) api.onUnitChange(); })
      : null;

    var valueEl = h('div', { class: 'res-value empty' }, '-');
    var unitEl = h('span', { class: 'res-unit' });
    var copyBtn = h('button', { type: 'button', class: 'icon-btn small', 'aria-label': '複製結果數值', hidden: true, onclick: function () {
      copyText(valueEl.textContent.replace(/,/g, ''), '已複製 ' + valueEl.textContent);
    } }, icon('copy'));
    var detailEl = h('p', { class: 'res-detail', hidden: true });
    var verdictEl = h('p', { class: 'verdict', hidden: true });
    var root = h('div', { class: 'result', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
      h('div', { class: 'res-head' }, [h('div', { class: 'res-label' }, cfg.label), copyBtn]),
      h('div', { class: 'res-main' }, [valueEl, unitEl, unitSeg ? unitSeg.el : null]),
      detailEl, verdictEl,
      cfg.hint ? h('p', { class: 'hint' }, cfg.hint) : null,
      cfg.note ? h('p', { class: 'note' }, cfg.note) : null
    ]);

    function render() {
      if (!res) {
        valueEl.textContent = '-';
        valueEl.className = 'res-value empty';
        unitEl.textContent = '';
        unitEl.hidden = true;
        copyBtn.hidden = true;
        detailEl.hidden = true;
        verdictEl.hidden = true;
        api.miniData = null;
        if (api.onRender) api.onRender();
        return;
      }
      var text, unitText = '';
      if (cfg.units) {
        var u = cfg.units[unitSeg ? unitSeg.get() : 0];
        text = fmt.n(u.f(res.base), cfg.d);
        if (!unitSeg) unitText = u.t;
      } else {
        text = cfg.text ? cfg.text(res) : fmt.n(res.base, cfg.d);
        unitText = res.unit || '';
      }
      valueEl.textContent = text;
      valueEl.className = 'res-value' + (text.length > 18 ? ' xs' : text.length > 13 ? ' s' : text.length > 9 ? ' m' : '');
      unitEl.textContent = unitText;
      unitEl.hidden = !unitText;
      copyBtn.hidden = false;
      detailEl.textContent = '';
      (res.lines || []).forEach(function (ln) { detailEl.appendChild(h('span', null, ln)); });
      detailEl.hidden = !(res.lines && res.lines.length);
      if (res.verdict) {
        verdictEl.textContent = res.verdict;
        verdictEl.className = 'verdict ' + (res.level || '');
        verdictEl.hidden = false;
      } else {
        verdictEl.hidden = true;
      }
      api.miniData = { label: cfg.label, text: text, unit: unitSeg ? cfg.units[unitSeg.get()].t : unitText };
      if (api.onRender) api.onRender();
    }

    api.el = root;
    api.show = function (r) { res = r; render(); };
    api.clear = function () { res = null; render(); };
    api.getUnit = function () { return unitSeg ? unitSeg.get() : 0; };
    api.setUnit = function (i) { if (unitSeg) { unitSeg.set(i); render(); } };
    return api;
  }

  // 多列結果(伺服脈波換算)
  function rowsResult(title, labels) {
    var list = h('dl', { class: 'rows' });
    var dts = [], dds = [];
    labels.forEach(function (l) {
      var dt = h('dt', null, l);
      var dd = h('dd', { class: 'empty' }, '-');
      list.appendChild(h('div', { class: 'row' }, [dt, dd]));
      dts.push(dt); dds.push(dd);
    });
    return {
      el: h('div', { class: 'result', 'aria-live': 'polite' }, [h('div', { class: 'res-label' }, title), list]),
      show: function (rows) {
        rows.forEach(function (r, i) { dts[i].textContent = r.label; dds[i].textContent = fmt.n(r.value, r.d); dds[i].className = ''; });
      },
      clear: function () { dds.forEach(function (dd) { dd.textContent = '-'; dd.className = 'empty'; }); }
    };
  }

  /* ======================= 迷你結果列 ======================= */
  // 結果卡片捲出畫面(例如手機鍵盤打開時)時,在上方固定顯示目前這個計算機的結果
  var mini = { el: $('mini'), label: $('miniLabel'), val: $('miniVal'), unit: $('miniUnit'), active: null };
  var inView = typeof WeakMap === 'function' ? new WeakMap() : null;
  var io = null;
  try {
    if ('IntersectionObserver' in window && inView) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView.set(en.target, en.isIntersecting); });
        updateMini();
      }, { rootMargin: '-150px 0px 0px 0px' });   // 扣掉上方固定列遮住的高度
    }
  } catch (e) { io = null; }

  function updateMini() {
    var v = mini.active;
    var data = v && v.miniData;
    var visible = !!(data && io && inView.get(v.el) === false);
    mini.el.hidden = !visible;
    if (visible) {
      mini.label.textContent = data.label;
      mini.val.textContent = data.text;
      mini.unit.textContent = data.unit;
    }
  }
  function setActiveView(v) {
    mini.active = v && v.miniData !== undefined ? v : null;
    updateMini();
  }

  /* ======================= 計算器卡片 ======================= */
  var panels = {};
  var TABS = [];

  function persist() {
    TABS.forEach(function (t) { if (panels[t.id]) store.data.tabs[t.id] = panels[t.id].getState(); });
    scheduleSave();
  }

  function reveal(el) {
    setTimeout(function () {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { el.scrollIntoView(); }
    }, 90);
  }

  // cfg: {title, bare, button, fields, view, compute(values)→顯示用資料, extra:{get,set,reset,onChange}}
  function makeCalculator(cfg) {
    var view = cfg.view;
    var errEl = h('p', { class: 'err', role: 'alert', hidden: true });
    var form = buildForm(cfg.fields, function () { recalc(true); });

    function recalc(explicit) {
      // iPhone 的數字鍵盤沒有「完成」鍵:按下「計算」就順便收起鍵盤,結果才看得到
      if (explicit && document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
      try {
        view.show(cfg.compute(form.get()));
        errEl.hidden = true;
        if (explicit) reveal(view.el);
      } catch (e) {
        if (!(e instanceof CalcError)) throw e;
        view.clear();
        if (explicit) { errEl.textContent = e.message; errEl.hidden = false; } else { errEl.hidden = true; }
      }
    }

    function reset() {
      form.reset();
      if (cfg.extra) cfg.extra.reset();
      view.clear();
      errEl.hidden = true;
      persist();
    }

    form.onChange(function () { recalc(false); persist(); });
    if (view.onUnitChange !== undefined) view.onUnitChange = persist;
    if (cfg.extra) cfg.extra.onChange(persist);
    if (view.onRender !== undefined) view.onRender = function () { if (mini.active === view) updateMini(); };

    var resetBtn = h('button', { type: 'button', class: 'ghost-btn', onclick: reset }, [icon('reset'), '清除']);
    var head = h('div', { class: 'card-head' }, [cfg.title ? h('h2', null, cfg.title) : h('span'), resetBtn]);
    var el = h(cfg.bare ? 'div' : 'section', { class: cfg.bare ? 'calc' : 'card' }, [
      head,
      form.el,
      h('button', { type: 'button', class: 'btn primary', onclick: function () { recalc(true); } }, cfg.button),
      errEl,
      view.el
    ]);
    el.addEventListener('focusin', function () { setActiveView(view); });
    if (io && view.miniData !== undefined) io.observe(view.el);

    return {
      el: el,
      form: form,
      getState: function () {
        var s = { f: form.get() };
        if (view.getUnit) s.u = view.getUnit();
        if (cfg.extra) s.x = cfg.extra.get();
        return s;
      },
      setState: function (s) {
        if (!s || typeof s !== 'object') return;
        if (s.f) form.set(s.f);
        if (view.setUnit && s.u != null) view.setUnit(s.u);
        if (cfg.extra && s.x) cfg.extra.set(s.x);
        recalc(false);
      }
    };
  }

  function makePanel(children, calcs) {
    return {
      el: h('div', { class: 'panel', hidden: true }, children),
      getState: function () {
        var s = {};
        Object.keys(calcs).forEach(function (k) { s[k] = calcs[k].getState(); });
        return s;
      },
      setState: function (s) {
        if (!s) return;
        Object.keys(calcs).forEach(function (k) { if (s[k]) calcs[k].setState(s[k]); });
      }
    };
  }

  /* ======================= 參考資料(取自原程式)與參考表 ======================= */
  var TORQUE_REF = [
    ['50W', 3000, 0.16, 0.48], ['100W', 3000, 0.32, 0.96], ['200W', 3000, 0.64, 1.92],
    ['400W', 3000, 1.27, 3.81], ['750W', 3000, 2.4, 7.2], ['1kW', 2000, 4.78, 14.4],
    ['1.5kW', 2000, 7.16, 21.6], ['2kW', 2000, 9.55, 28.5], ['3kW', 2000, 14.3, 43.0]
  ];
  var EFF_REF = [
    ['聯軸器直驅螺桿（無中間傳動）', '88 ~ 94%，建議抓 90%', 90],
    ['皮帶／同步輪連結螺桿', '85 ~ 93%，建議抓 88%', 88],
    ['齒輪嚙合直驅螺桿（無減速機）', '87 ~ 94%，建議抓 90%', 90]
  ];
  var ROD_REF = [[32, 12], [40, 16], [50, 20], [63, 20], [80, 25], [100, 25], [125, 32], [160, 40], [200, 40]];
  var INERTIA_REF = [
    ['50W', 0.0295, null], ['100W', 0.0518, null], ['200W', 0.161, null], ['400W', 0.277, null], ['750W', 1.07, null],
    ['1kW', 6.1, 10.3], ['1.5kW', 8.8, 15.0], ['2kW', 11.5, 32.1], ['3kW', 16.7, 61.2]
  ];

  function pickValue(form, patch, msg) {
    form.set(patch);
    form.emit('ref');
    sheet.close();
    toast(msg);
  }

  function torqueRef(getForm) {
    function cell(v) {
      var t = v.toFixed(2);
      return h('td', null, h('button', { type: 'button', class: 'pick', onclick: function () {
        pickValue(getForm(), { torque: t, tUnit: 0 }, '已帶入扭力 ' + t + ' N·m');
      } }, t));
    }
    return h('div', null, [
      h('p', { class: 'note' }, '資料來源：士林電機 SDE系列（SME伺服馬達）官方型錄 Ver.201811'),
      h('p', { class: 'note' }, '額定扭力為連續運轉可承受值；最大扭力為短時間可承受值。點選數值可直接帶入扭力欄位，實際仍以馬達銘牌或驅動器規格書為準'),
      h('table', { class: 'ref-table' }, [
        h('thead', null, h('tr', null, ['容量', '額定轉速', '額定扭力(N·m)', '最大扭力(N·m)'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, TORQUE_REF.map(function (r) {
          return h('tr', null, [h('th', { scope: 'row' }, r[0]), h('td', null, r[1] + ' rpm'), cell(r[2]), cell(r[3])]);
        }))
      ])
    ]);
  }

  function effRef(getForm) {
    return h('div', null, [
      h('p', { class: 'note' }, '以下已包含滾珠螺桿本身效率(約90~95%)，為經驗概估值，確切效率請以供應商型錄為準。點選可帶入傳動效率欄位'),
      h('div', { class: 'opt-list' }, EFF_REF.map(function (o) {
        return h('button', { type: 'button', class: 'opt', onclick: function () {
          pickValue(getForm(), { eff: String(o[2]) }, '已帶入傳動效率 ' + o[2] + '%');
        } }, [h('strong', null, o[0]), h('span', null, o[1])]);
      }))
    ]);
  }

  function rodRef(getForm) {
    return h('div', null, [
      h('p', { class: 'note' }, '資料來源：AirTAC（亞德客）SI系列標準氣缸型錄，符合ISO15552標準。部分系列同一缸徑可能有加粗活塞桿選配，實際仍以氣缸型號規格為準。點選可同時帶入缸徑與活塞桿徑'),
      h('div', { class: 'rod-grid' }, ROD_REF.map(function (r) {
        return h('button', { type: 'button', class: 'pick rod', onclick: function () {
          pickValue(getForm(), { bore: String(r[0]), rod: String(r[1]) }, '已帶入缸徑 ' + r[0] + ' mm、活塞桿徑 ' + r[1] + ' mm');
        } }, [h('span', { class: 'rod-bore' }, '缸徑 ' + r[0]), h('span', { class: 'rod-rod' }, '桿徑 ' + r[1])]);
      }))
    ]);
  }

  function inertiaRef(getForm) {
    function cell(v) {
      if (v == null) return h('td', { class: 'dash' }, '—');
      var t = String(v);
      return h('td', null, h('button', { type: 'button', class: 'pick', onclick: function () {
        pickValue(getForm(), { motorJ: t }, '已帶入馬達轉子慣量 ' + t + ' ×10⁻⁴ kg·m²');
      } }, t));
    }
    return h('div', null, [
      h('p', { class: 'note' }, '資料來源：士林電機 SDE系列（SME伺服馬達）官方型錄 Ver.201811'),
      h('p', { class: 'note' }, '單位為 ×10⁻⁴ kg·m²；1kW 以下僅低慣量(L)機種。點選數值可直接帶入馬達轉子慣量欄位'),
      h('table', { class: 'ref-table' }, [
        h('thead', null, h('tr', null, ['容量', '低慣量(L)', '中慣量(M)'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, INERTIA_REF.map(function (r) {
          return h('tr', null, [h('th', { scope: 'row' }, r[0]), cell(r[1]), cell(r[2])]);
        }))
      ])
    ]);
  }

  function refLink(title, builder, getForm) {
    return { label: '參考表', open: function () { sheet.open(title, builder(getForm)); } };
  }

  /* ======================= 共用欄位 ======================= */
  var MECH = ['滾珠螺桿 (Ball Screw)', '皮帶/同步輪 (Belt & Pulley)', '齒條齒輪 (Rack & Pinion)'];
  function mechField(hint, lastLabel) {
    return { key: 'mech', type: 'select', label: '傳動機構', options: MECH.concat([lastLabel]), hint: hint };
  }
  function gearField(hint) {
    return {
      key: 'gear', type: 'num', label: '減速比 i (輸出/輸入)', def: '1',
      hint: hint || '馬達後方若有加裝減速機，填減速機的減速比；沒有減速機請填 1',
      showIf: function (v) { return v.mech !== 3; }
    };
  }
  function leadField() {
    return {
      key: 'lead', type: 'num', label: '導程 L', unit: 'mm/rev',
      hint: '螺桿每轉一圈，螺帽移動的距離，查螺桿規格表',
      showIf: function (v) { return v.mech === 0; }
    };
  }
  function radiusField(hint) {
    return {
      key: 'radius', type: 'num', label: '節圓半徑 r', unit: 'mm',
      hint: hint || '皮帶輪/齒輪的節圓半徑（非直徑），查機構圖面或型錄',
      showIf: function (v) { return v.mech !== 0; }
    };
  }

  // 皮帶/同步輪:由齒數＋節距計算減速比與節圓半徑,並帶入主表單
  function makeBeltHelper(getForm, descText) {
    var form = buildForm([
      { key: 'z1', type: 'num', label: '主動輪（馬達側）齒數 Z1', unit: '齒' },
      { key: 'z2', type: 'num', label: '從動輪（輸出側）齒數 Z2', unit: '齒' },
      { key: 'pitch', type: 'num', label: '節距 P', unit: 'mm' }
    ], apply);
    var err = h('p', { class: 'err', role: 'alert', hidden: true });

    function apply() {
      try {
        var r = C.beltHelper(form.get());
        err.hidden = true;
        var main = getForm();
        main.set({ gear: fmt.f(r.gear, 3), radius: fmt.f(r.radius, 2) });
        main.emit('belt');
        toast('已帶入：減速比 i = ' + fmt.f(r.gear, 3) + '、節圓半徑 r = ' + fmt.f(r.radius, 2) + ' mm');
      } catch (e) {
        if (!(e instanceof CalcError)) throw e;
        err.textContent = e.message;
        err.hidden = false;
      }
    }
    form.onChange(function () { err.hidden = true; });

    var node = h('div', { class: 'helper' }, [
      h('h3', null, '皮帶/同步輪：由齒數＋節距計算減速比與節圓半徑'),
      h('p', { class: 'hint' }, descText),
      form.el,
      h('button', { type: 'button', class: 'btn secondary', onclick: apply }, '帶入減速比與節圓半徑'),
      err
    ]);
    return { node: node, get: form.get, set: form.set, reset: form.reset, onChange: form.onChange };
  }

  var BELT_DESC = '節距查同步帶型號（如 GT2 節距2mm、5M節距5mm、T10節距10mm）。若馬達直接以單一皮帶輪帶動荷重（無減速），此區留空即可';

  /* ======================= 9 個分頁 ======================= */
  // 1. 馬達扭力計算機(推力 + 螺桿挫曲檢核)
  function buildForce() {
    var thrust, buck;
    var getThrustForm = function () { return thrust.form; };
    var belt = makeBeltHelper(getThrustForm, BELT_DESC);

    thrust = makeCalculator({
      title: '推力計算機',
      button: '計算推力',
      fields: [
        mechField('選擇馬達扭力實際傳到直線運動的機構方式', '簡易 (T / r)'),
        {
          key: 'torque', type: 'num', label: '扭力 T', seg: { key: 'tUnit', options: ['N·m', 'kgf·cm'] },
          hint: '馬達/伺服馬達輸出軸的扭力，查驅動器規格或型錄，也可點右側「參考表」',
          ref: refLink('伺服馬達額定扭力參考值', torqueRef, getThrustForm)
        },
        { type: 'block', node: belt.node, showIf: function (v) { return v.mech === 1; } },
        gearField(),
        {
          key: 'eff', type: 'num', label: '傳動效率 η', unit: '%', def: '90',
          hint: '機構傳動過程的能量損耗，可點右側「參考表」，不確定時先用 90%',
          ref: refLink('傳動效率參考值', effRef, getThrustForm),
          showIf: function (v) { return v.mech !== 3; }
        },
        leadField(),
        radiusField()
      ],
      view: bigResult({
        label: '推力 F', units: C.UNITS.force, d: 2,
        hint: 'N 是力的單位；kgf(公斤力)是換算成「相當於幾公斤重物」的力，1 kgf ≈ 9.80665 N（例：200N ≈ 20.39 kgf）'
      }),
      compute: function (v) {
        return { base: C.thrust({ mech: v.mech, torque: v.torque, torqueUnit: v.tUnit, gear: v.gear, eff: v.eff, lead: v.lead, radius: v.radius }).forceN };
      },
      extra: belt
    });

    buck = makeCalculator({
      bare: true,
      button: '計算容許推力',
      fields: [
        { key: 'outer', type: 'num', label: '螺桿外徑 D', unit: 'mm', hint: '選型型錄公稱直徑（大部分廠商規格表都有標示這個）' },
        { key: 'ratio', type: 'num', label: '谷徑/外徑比例（概估）', def: '0.85', hint: '沒有谷徑實測值時的概估比例，不同廠牌/導程約落在 0.82~0.92，建議向螺桿廠商確認後修正此比例' },
        { key: 'span', type: 'num', label: '支撐跨距 Lb', unit: 'mm', hint: '兩端支撐(軸承座)之間的距離，通常接近行程長度' },
        {
          key: 'fix', type: 'select', label: '兩端固定方式', options: ['固定-固定', '固定-支撐', '支撐-支撐', '固定-自由'], def: 1,
          hint: '固定：以螺帽/軸承座鎖死，不可轉動、不可位移，抗挫曲能力最強\n支撐：軸承支撐，可轉動但限制橫向位移，居中\n自由：末端無任何支撐、懸空（懸臂狀態），抗挫曲能力最弱\n兩端條件依實際軸承/鎖付方式選擇，不確定時建議先選較保守的「固定-支撐」'
        },
        { key: 'sf', type: 'num', label: '安全係數', def: '2', hint: '容許推力＝臨界挫曲負荷÷安全係數，型錄常用 2，保守可用 3' }
      ],
      view: bigResult({ label: '容許軸向推力 F_allow', units: [{ t: 'N', f: function (x) { return x; } }], d: 0 }),
      compute: function (v) {
        var r = C.buckling({ outer: v.outer, ratio: v.ratio, span: v.span, fix: v.fix, sf: v.sf });
        return { base: r.allowN, lines: C.LINES.buckling(r) };
      }
    });

    var acc = h('details', { class: 'card acc' }, [
      h('summary', null, ['螺桿容許軸向推力（挫曲強度）檢核', icon('chevd')]),
      h('div', { class: 'acc-body' }, [
        h('p', { class: 'note' }, '以歐拉挫曲(Euler buckling)公式概估螺桿在推力下不產生挫曲變形的容許軸向推力，供設計初期評估使用。假設材質為碳鋼/軸承鋼(E≈206 GPa)。選型型錄通常只標示外徑，此處直接輸入外徑，並用可調整的比例概估谷徑，正式選型仍須以螺桿廠商提供之谷徑數值或型錄為準'),
        buck.el
      ])
    ]);

    return makePanel([thrust.el, acc], { thrust: thrust, buck: buck });
  }

  // 2. 速度計算機
  function buildSpeed() {
    var calc;
    var belt = makeBeltHelper(function () { return calc.form; }, '節距查同步帶型號（如 GT2 節距2mm、5M節距5mm、T10節距10mm）。若馬達直接以單一皮帶輪帶動荷重（無減速），此區留空，直接在下方節圓半徑欄位輸入即可');
    calc = makeCalculator({
      title: '速度計算機',
      button: '計算速度',
      fields: [
        mechField('選擇馬達轉速實際傳到直線運動的機構方式', '簡易 (直接以節圓半徑計算)'),
        { key: 'rpm', type: 'num', label: '馬達轉速 N', unit: 'rpm', hint: '馬達/伺服馬達的運轉轉速，查驅動器監控畫面或速度設定值' },
        { type: 'block', node: belt.node, showIf: function (v) { return v.mech === 1; } },
        gearField(),
        leadField(),
        radiusField()
      ],
      view: bigResult({ label: '速度 v', units: C.UNITS.speed, d: 2 }),
      compute: function (v) {
        return { base: C.speed({ mech: v.mech, rpm: v.rpm, gear: v.gear, lead: v.lead, radius: v.radius }).mmPerS };
      },
      extra: belt
    });
    return makePanel([calc.el], { speed: calc });
  }

  // 3. 氣缸推力計算機
  function buildCylinder() {
    var calc;
    var getForm = function () { return calc.form; };
    calc = makeCalculator({
      title: '氣缸推力計算機',
      button: '計算出力',
      fields: [
        {
          key: 'dir', type: 'select', label: '動作方向',
          options: ['推出（伸缸行程，使用全缸徑面積）', '拉回（縮缸行程，扣除活塞桿截面積）'],
          hint: '推出使用整個活塞面積；拉回因活塞桿占掉一部分面積，出力會較小'
        },
        {
          key: 'bore', type: 'num', label: '缸徑 D', unit: 'mm',
          hint: '氣缸活塞直徑，查氣缸型號規格（如 CDQ2B32 的 32 即為缸徑 32mm），也可點右側「參考表」',
          ref: refLink('標準氣缸缸徑／活塞桿徑參考值', rodRef, getForm)
        },
        {
          key: 'rod', type: 'num', label: '活塞桿徑 d', unit: 'mm',
          hint: '活塞桿（伸出桿）的直徑，僅拉回行程需要，可點右側「參考表」',
          ref: refLink('標準氣缸缸徑／活塞桿徑參考值', rodRef, getForm),
          showIf: function (v) { return v.dir === 1; }
        },
        {
          key: 'pressure', type: 'num', label: '使用氣壓 P', seg: { key: 'pUnit', options: ['MPa', 'kgf/cm²', 'bar'] },
          hint: '實際供氣壓力，查空壓機/調壓閥設定值。一般工廠內配氣壓約 0.5~0.7 MPa（約5~7 kgf/cm²）'
        },
        {
          key: 'eff', type: 'num', label: '效率 η', unit: '%', def: '80',
          hint: '扣除活塞環摩擦、配管壓降等損耗後的實際出力比例，屬工程經驗概估，非特定廠牌實測數據，設計抓 70~85%，不確定時先用 80%'
        }
      ],
      view: bigResult({
        label: '出力 F', units: C.UNITS.force, d: 2,
        hint: 'N 是力的單位；kgf(公斤力)是換算成「相當於幾公斤重物」的力，1 kgf ≈ 9.80665 N（例：200N ≈ 20.39 kgf）'
      }),
      compute: function (v) {
        return { base: C.cylinder({ dir: v.dir, bore: v.bore, rod: v.rod, pressure: v.pressure, pUnit: v.pUnit, eff: v.eff }).forceN };
      }
    });
    return makePanel([calc.el], { cyl: calc });
  }

  // 4. 伺服脈波換算
  function numF(key, label, unit, ph, hint) {
    return { key: key, type: 'num', label: label, unit: unit, placeholder: ph, hint: hint };
  }
  function pulseCalc(o) {
    return makeCalculator({
      title: o.title,
      button: o.button,
      fields: o.fields,
      view: rowsResult(o.resTitle, o.labels),
      compute: function (v) { return o.fn({ a: v.a, b: v.b, c: v.c, d: v.d }); }
    });
  }
  function buildPulse() {
    var sf = pulseCalc({
      title: '正向計算（轉速 → 脈波與速度）', button: '計算脈波與速度', fn: C.speedForward,
      fields: [
        numF('a', '伺服馬達轉速', 'RPM', '例如 3000'),
        numF('b', '電子齒輪比', 'PPR', '例如 10000', '一圈脈波數，例如 10000'),
        numF('c', '減速比', '', '例如 7'),
        numF('d', '螺桿導程', 'mm/圈', '例如 5')
      ],
      resTitle: '正向計算結果', labels: ['脈波頻率 (PPS)', '輸出轉速 (RPS)', '線性速度 (mm/s)']
    });
    var sr = pulseCalc({
      title: '反推計算（脈波 → 轉速與速度）', button: '反推轉速與速度', fn: C.speedReverse,
      fields: [
        numF('a', '脈波', 'PPS', '例如 500000', '每秒脈衝數，例如 500000'),
        numF('b', '電子齒輪比', 'PPR', '例如 10000', '一圈脈波數，例如 10000'),
        numF('c', '減速比', '', '例如 7'),
        numF('d', '螺桿導程', 'mm/圈', '例如 5')
      ],
      resTitle: '反推計算結果', labels: ['伺服馬達轉速 (RPM)', '輸出轉速 (RPS)', '線性速度 (mm/s)']
    });
    var pf = pulseCalc({
      title: '正向計算（距離 → 脈衝）', button: '計算脈衝數', fn: C.pulseForward,
      fields: [
        numF('a', '移動距離', 'mm', '例如 100'),
        numF('b', '螺桿導程', 'mm/圈', '例如 5'),
        numF('c', '減速比', '', '例如 7'),
        numF('d', '馬達每圈脈衝數', '', '例如 1400')
      ],
      resTitle: '正向計算結果', labels: ['輸出轉數 (圈)', '馬達轉數 (圈)', '總脈衝數 (pulse)']
    });
    var pr = pulseCalc({
      title: '反推計算（脈衝 → 距離）', button: '反推距離', fn: C.pulseReverse,
      fields: [
        numF('a', '總脈衝數', 'pulse', '例如 196000'),
        numF('b', '螺桿導程', 'mm/圈', '例如 5'),
        numF('c', '減速比', '', '例如 7'),
        numF('d', '馬達每圈脈衝數', '', '例如 1400')
      ],
      resTitle: '反推計算結果', labels: ['馬達轉數 (圈)', '輸出轉數 (圈)', '移動距離 (mm)']
    });
    return makePanel([
      h('h2', { class: 'group-title' }, '伺服馬達轉速計算器（含減速比、導程與線性速度）'),
      h('p', { class: 'formula' }, [
        h('span', null, '正向公式：脈波 PPS = (轉速 RPM / 60) × 電子齒輪比 (PPR)；線性速度 (mm/s) = ((RPM / 60) / 減速比) × 導程'),
        h('span', null, '反推公式：轉速 RPM = (脈波 PPS / 電子齒輪比 PPR) × 60；線性速度 (mm/s) = ((RPM / 60) / 減速比) × 導程')
      ]),
      sf.el, sr.el,
      h('h2', { class: 'group-title' }, '伺服馬達脈衝計算器（含反推）'),
      h('p', { class: 'formula' }, [
        h('span', null, '正向公式：總脈衝數 = (移動距離 / 導程) × 減速比 × (馬達每圈脈衝數)'),
        h('span', null, '反推公式：移動距離 = (總脈衝數 / (減速比 × 馬達每圈脈衝數)) × 導程')
      ]),
      pf.el, pr.el
    ], { speedF: sf, speedR: sr, pulseF: pf, pulseR: pr });
  }

  // 5. 負載慣量比計算機
  function buildInertia() {
    var calc;
    calc = makeCalculator({
      title: '負載慣量比計算機',
      button: '計算慣量比',
      fields: [
        mechField('選擇負載經由哪種機構連接到馬達', '簡易 (T / r)'),
        { key: 'mass', type: 'num', label: '負載質量 m', unit: 'kg', hint: '移動平台/工件等實際負載的總質量（不含馬達與傳動機構本身）' },
        gearField(),
        leadField(),
        radiusField(),
        {
          key: 'motorJ', type: 'num', label: '馬達轉子慣量 J', unit: '×10⁻⁴ kg·m²',
          hint: '馬達規格書上的轉子慣量，通常以 ×10⁻⁴ kg·m² 表示，可點右側「參考表」',
          ref: refLink('伺服馬達轉子慣量參考值', inertiaRef, function () { return calc.form; })
        }
      ],
      view: bigResult({ label: '慣量比（負載 / 馬達）', units: null, d: 2 }),
      compute: function (v) {
        var r = C.inertia({ mech: v.mech, mass: v.mass, gear: v.gear, lead: v.lead, radius: v.radius, motorJ: v.motorJ });
        return { base: r.ratio, verdict: r.verdict, level: r.level };
      }
    });
    var judge = h('section', { class: 'card' }, [
      h('div', { class: 'card-head' }, [h('h2', null, '慣量比參考判斷')]),
      h('p', { class: 'note' }, '≤ 5：理想，伺服自動增益調諧容易穩定\n5 ~ 10：可接受，多數應用仍可正常運作\n> 10：偏高，建議加大馬達容量、提高減速比或降低負載質量\n以上為業界常見經驗範圍，非嚴格規範，實際仍需視伺服調機結果判斷')
    ]);
    return makePanel([calc.el, judge], { inertia: calc });
  }

  // 6. 加速轉矩計算機
  function buildAccel() {
    var calc = makeCalculator({
      title: '加速轉矩計算機',
      button: '計算加速轉矩',
      fields: [
        { key: 'deltaRpm', type: 'num', label: '轉速變化量 ΔN', unit: 'rpm', hint: '加減速前後的轉速差，例如從靜止加速到 3000rpm，此處填 3000' },
        { key: 'time', type: 'num', label: '加減速時間 t', unit: 'sec', hint: '伺服驅動器設定的加速時間或減速時間' },
        { key: 'inertiaJ', type: 'num', label: '總慣量 J', unit: '×10⁻⁴ kg·m²', hint: '馬達轉子慣量 + 負載慣量（已反映至馬達軸）的總和，負載慣量可用「負載慣量比計算機」分頁換算' }
      ],
      view: bigResult({
        label: '加速轉矩 T', units: C.UNITS.torque, d: 4,
        note: '提醒：此為僅克服慣量所需的加速扭力，實際馬達所需總扭力還要加上負載/摩擦扭力（可用「馬達扭力計算機」換算），並與馬達最大扭力比較是否足夠'
      }),
      compute: function (v) {
        var r = C.accelTorque({ deltaRpm: v.deltaRpm, time: v.time, inertiaJ: v.inertiaJ });
        return { base: r.torqueNm, lines: C.LINES.accel(r) };
      }
    });
    return makePanel([calc.el], { accel: calc });
  }

  // 7. 垂直升降負載計算機
  function buildLift() {
    var calc = makeCalculator({
      title: '垂直升降負載計算機',
      button: '計算所需馬達扭力',
      fields: [
        mechField('選擇馬達扭力實際傳到升降平台的機構方式', '簡易 (T / r)'),
        { key: 'mass', type: 'num', label: '負載質量 m', unit: 'kg', hint: '升降平台 + 工件的總質量' },
        gearField(),
        leadField(),
        radiusField('皮帶輪/齒輪/鏈輪的節圓半徑（非直徑），查機構圖面或型錄'),
        { key: 'eff', type: 'num', label: '傳動效率 η', unit: '%', def: '90', hint: '機構傳動過程的能量損耗，不確定時先用 90%（可參考「馬達扭力計算機」的效率參考表）' },
        { key: 'sf', type: 'num', label: '安全係數 SF', def: '1.3', hint: '垂直升降建議留設計餘裕，常見抓 1.2~1.5，用以吸收啟動衝擊、鋼索/鏈條摩擦等不確定因素。此為工程經驗值，非嚴格規範，實際仍需依應用場合評估' }
      ],
      view: bigResult({
        label: '所需馬達扭力 T', units: C.UNITS.torque, d: 4,
        note: '提醒：此為等速上升/維持所需扭力，未含加減速扭力（可用「加速轉矩計算機」另行加總）。下降時若負載會反拖馬達，仍須確認馬達/煞車系統可安全控速'
      }),
      compute: function (v) {
        var r = C.verticalLift({ mech: v.mech, mass: v.mass, gear: v.gear, lead: v.lead, radius: v.radius, eff: v.eff, sf: v.sf });
        return { base: r.torqueNm, lines: C.LINES.vertical(r) };
      }
    });
    return makePanel([calc.el], { lift: calc });
  }

  // 8. 輸送帶馬達扭力計算機
  function buildConveyor() {
    var calc = makeCalculator({
      title: '輸送帶馬達扭力計算機',
      button: '計算馬達扭力',
      fields: [
        { key: 'loadMass', type: 'num', label: '負載重量', unit: 'kg', hint: '輸送帶上實際承載的貨物/工件總重量' },
        { key: 'beltMass', type: 'num', label: '輸送帶/滾筒自重', unit: 'kg', def: '0', hint: '輸送帶本身、滾筒等隨動件的重量，不確定時可先填 0（僅忽略此項損耗）' },
        { key: 'friction', type: 'num', label: '摩擦係數 μ', hint: '滾筒支撐型輸送機常抓 0.02~0.05（滾動摩擦）；無滾筒的滑動式輸送機常抓 0.3~0.5（滑動摩擦）。此為經驗範圍，確切數值需依實際輸送帶/滾筒材質查證' },
        { key: 'rollerDia', type: 'num', label: '驅動滾筒直徑 D', unit: 'mm', hint: '馬達直接驅動的滾筒外徑（非半徑），查滾筒規格' },
        { key: 'gear', type: 'num', label: '減速比 i (輸出/輸入)', def: '1', hint: '馬達後方減速機的減速比，沒有減速機請填 1' },
        { key: 'eff', type: 'num', label: '傳動效率 η', unit: '%', def: '90', hint: '減速機/鏈條等傳動損耗，不確定時先用 90%' }
      ],
      view: bigResult({ label: '馬達所需扭力 T', units: C.UNITS.torque, d: 4 }),
      compute: function (v) {
        var r = C.conveyor({ loadMass: v.loadMass, beltMass: v.beltMass, friction: v.friction, rollerDia: v.rollerDia, gear: v.gear, eff: v.eff });
        return { base: r.torqueNm, lines: C.LINES.conveyor(r) };
      }
    });
    return makePanel([calc.el], { conveyor: calc });
  }

  // 9. 通用單位換算機
  function buildUnits() {
    var fromTo = {
      type: 'custom',
      build: function (emit) {
        var id1 = 'f' + (++uid), id2 = 'f' + (++uid);
        var lastCat = -1;
        var fromSel = h('select', { id: id1 });
        var toSel = h('select', { id: id2 });
        function fill(cat) {
          lastCat = cat;
          [fromSel, toSel].forEach(function (s) {
            s.textContent = '';
            C.CATEGORIES[cat].units.forEach(function (u, i) { s.appendChild(h('option', { value: i }, u[0])); });
          });
        }
        function defaults() {
          fromSel.value = '0';
          toSel.value = String(Math.min(1, C.CATEGORIES[lastCat].units.length - 1));
        }
        fill(0);
        defaults();
        fromSel.addEventListener('change', function () { emit('from'); });
        toSel.addEventListener('change', function () { emit('to'); });
        var swap = h('button', { type: 'button', class: 'swap-btn', 'aria-label': '交換單位', onclick: function () {
          var t = fromSel.value; fromSel.value = toSel.value; toSel.value = t; emit('swap');
        } }, icon('swap'));
        var node = h('div', { class: 'pair' }, [
          h('div', { class: 'pc' }, [h('label', { for: id1 }, '從'), h('div', { class: 'sel' }, fromSel)]),
          swap,
          h('div', { class: 'pc' }, [h('label', { for: id2 }, '到'), h('div', { class: 'sel' }, toSel)])
        ]);
        return {
          node: node,
          read: function (v) { v.from = Number(fromSel.value); v.to = Number(toSel.value); },
          write: function (o) {
            if (o.cat != null) fill(Number(o.cat) || 0);
            if (o.from != null) fromSel.value = String(o.from);
            if (o.to != null) toSel.value = String(o.to);
          },
          reset: function () { fill(0); defaults(); },
          update: function (v) { if (v.cat !== lastCat) { fill(v.cat); defaults(); } }
        };
      }
    };
    var calc = makeCalculator({
      title: '通用單位換算機',
      button: '換算',
      fields: [
        { key: 'cat', type: 'select', label: '換算類別', options: C.CATEGORIES.map(function (c) { return c.name; }) },
        { key: 'value', type: 'num', label: '數值' },
        fromTo
      ],
      view: bigResult({ label: '換算結果', units: null, text: function (r) { return fmt.g6(r.base); } }),
      compute: function (v) {
        var r = C.convert({ value: v.value, cat: v.cat, from: v.from, to: v.to });
        return { base: r.value, unit: r.unit };
      }
    });
    return makePanel([calc.el], { units: calc });
  }

  TABS = [
    { id: 'force', name: '馬達扭力計算機', desc: '馬達扭力 → 直線推力（螺桿／皮帶／齒條）', icon: 'thrust', build: buildForce },
    { id: 'speed', name: '速度計算機', desc: '馬達轉速 → 直線速度', icon: 'gauge', build: buildSpeed },
    { id: 'cyl', name: '氣缸推力計算機', desc: '缸徑、氣壓 → 推出／拉回出力', icon: 'piston', build: buildCylinder },
    { id: 'pulse', name: '伺服脈波換算', desc: '轉速、距離與脈波數互換', icon: 'pulse', build: buildPulse },
    { id: 'inertia', name: '負載慣量比計算機', desc: '負載慣量 ÷ 馬達轉子慣量', icon: 'disc', build: buildInertia },
    { id: 'accel', name: '加速轉矩計算機', desc: '克服慣量所需的加速扭力', icon: 'trend', build: buildAccel },
    { id: 'lift', name: '垂直升降負載計算機', desc: '升降平台所需的馬達扭力', icon: 'lift', build: buildLift },
    { id: 'conveyor', name: '輸送帶馬達扭力計算機', desc: '輸送帶驅動滾筒所需扭力', icon: 'belt', build: buildConveyor },
    { id: 'units', name: '通用單位換算機', desc: '力、扭力、壓力、長度、速度、質量', icon: 'swap', build: buildUnits }
  ];
  var TAB_BY_ID = {};
  TABS.forEach(function (t) { TAB_BY_ID[t.id] = t; });

  /* ======================= 應用程式外框 ======================= */
  var main = $('main');
  var barName = $('barName');
  var pageTitle = $('pageTitle');
  var hintBtn = $('hintBtn');
  var current = null;

  function show(id) {
    var tab = TAB_BY_ID[id] || TABS[0];
    TABS.forEach(function (t) { panels[t.id].el.hidden = t.id !== tab.id; });
    current = tab.id;
    setActiveView(null);
    barName.textContent = tab.name;
    pageTitle.textContent = tab.name;
    document.title = tab.name + '・萬用計算機';
    store.data.ui.tab = tab.id;
    scheduleSave();
    try { history.replaceState(null, '', '#' + tab.id); } catch (e) { /* file:// 等情況不支援,忽略 */ }
    window.scrollTo(0, 0);
  }

  function openMenu() {
    var list = h('ul', { class: 'menu-list' }, TABS.map(function (t) {
      var cur = t.id === current;
      return h('li', null, h('button', {
        type: 'button', class: 'menu-item', 'aria-current': cur ? 'true' : null,
        onclick: function () { sheet.close(); show(t.id); }
      }, [
        h('span', { class: 'menu-ico' }, icon(t.icon)),
        h('span', { class: 'menu-txt' }, [h('strong', null, t.name), h('span', null, t.desc)]),
        cur ? h('span', { class: 'check' }, icon('check')) : null
      ]));
    }));
    sheet.open('選擇計算機', list);
  }

  function setHints(on) {
    document.body.classList.toggle('no-hints', !on);
    hintBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    hintBtn.setAttribute('aria-label', on ? '隱藏欄位說明' : '顯示欄位說明');
    store.data.ui.hints = on;
    scheduleSave();
  }

  function maybeInstallTip() {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!ios || standalone || store.data.ui.tipDismissed) return null;
    var tip = h('div', { class: 'tip', role: 'note' }, [
      h('p', null, '想像 App 一樣使用？點瀏覽器的「分享」按鈕，再選「加入主畫面」，之後沒有網路也能用。'),
      h('button', { type: 'button', class: 'icon-btn small', 'aria-label': '關閉提示', onclick: function () {
        tip.hidden = true;
        store.data.ui.tipDismissed = true;
        scheduleSave();
      } }, icon('close'))
    ]);
    return tip;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) return;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) toast('已更新到新版本，重新開啟即可使用最新內容');
      hadController = true;
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function () {
        return navigator.serviceWorker.ready;
      }).then(function () {
        if (!store.data.ui.offlineNotice) {
          store.data.ui.offlineNotice = true;
          scheduleSave();
          toast('已儲存到手機，之後沒有網路也能使用');
        }
      }).catch(function () { /* 註冊失敗不影響計算功能 */ });
    });
  }

  function init() {
    store.load();

    TABS.forEach(function (t) {
      panels[t.id] = t.build();
      main.appendChild(panels[t.id].el);
    });
    TABS.forEach(function (t) { panels[t.id].setState(store.data.tabs[t.id]); });

    var tip = maybeInstallTip();
    if (tip) main.insertBefore(tip, panels[TABS[0].id].el);

    setHints(store.data.ui.hints !== false);
    hintBtn.addEventListener('click', function () { setHints(document.body.classList.contains('no-hints')); });
    $('switchBtn').addEventListener('click', openMenu);

    var fromHash = (location.hash || '').replace('#', '');
    show(TAB_BY_ID[fromHash] ? fromHash : (TAB_BY_ID[store.data.ui.tab] ? store.data.ui.tab : TABS[0].id));
    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#', '');
      if (TAB_BY_ID[id] && id !== current) show(id);
    });

    // 點一下空白處就收起鍵盤(iPhone 數字鍵盤沒有「完成」鍵);拖曳捲動不算點擊
    var touchMoved = false;
    document.addEventListener('touchstart', function () { touchMoved = false; }, { passive: true });
    document.addEventListener('touchmove', function () { touchMoved = true; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var a = document.activeElement;
      if (touchMoved || !a || a.tagName !== 'INPUT') return;
      if (e.target && e.target.closest && e.target.closest('input, select, textarea, label, button, summary, .inp')) return;
      a.blur();
    }, { passive: true });

    // 鍵盤開啟時多留空白,iOS 才捲得動到被鍵盤遮住的欄位
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.tagName === 'INPUT') document.body.classList.add('kb');
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        var a = document.activeElement;
        if (!a || a.tagName !== 'INPUT') document.body.classList.remove('kb');
      }, 80);
    });

    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushSave(); });
    window.addEventListener('pagehide', flushSave);

    registerServiceWorker();
  }

  init();
})();
