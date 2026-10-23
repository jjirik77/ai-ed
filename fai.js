/* Faculty AI Integration Studio — shared behavior. Widgets register with FAI.widget(id, init). */
(function () {
  'use strict';
  var FAI = window.FAI = {};

  /* storage that never throws */
  FAI.store = {
    get: function (k, d) { try { var v = localStorage.getItem('fai:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('fai:' + k, JSON.stringify(v)); FAI.progress && FAI.progress.touch(); } catch (e) {} }
  };
  FAI.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* sidebar toggle */
  document.addEventListener('click', function (e) {
    var mb = e.target.closest('.menu-btn');
    if (mb) { var open = document.body.classList.toggle('side-open'); mb.setAttribute('aria-expanded', open); return; }
    if (document.body.classList.contains('side-open') && !e.target.closest('.side')) document.body.classList.remove('side-open');
  });

  /* flip cards */
  document.querySelectorAll('.flip-card').forEach(function (c) {
    c.addEventListener('click', function () { var f = c.classList.toggle('flipped'); c.setAttribute('aria-pressed', f); });
  });

  /* copy buttons on prompts */
  document.querySelectorAll('.prompt[data-copy]').forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec'; b.textContent = 'Copy';
    b.style.cssText = 'position:absolute;top:.5rem;right:.5rem;padding:.2rem .6rem;font-size:.66rem';
    b.addEventListener('click', function () {
      var t = p.cloneNode(true); t.querySelectorAll('button').forEach(function (x) { x.remove(); });
      (navigator.clipboard ? navigator.clipboard.writeText(t.textContent.trim()) : Promise.reject()).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }, function () { b.textContent = 'Select & copy'; });
    });
    p.appendChild(b);
  });

  /* predict box persistence */
  document.querySelectorAll('.predict textarea').forEach(function (t) {
    var k = 'predict:' + location.pathname.split('/').pop();
    t.value = FAI.store.get(k, '');
    t.addEventListener('input', function () { FAI.store.set(k, t.value); });
  });

  /* knowledge check */
  FAI.grade = function () {
    var qs = document.querySelectorAll('#quiz .q'), score = 0, answered = 0;
    qs.forEach(function (q) {
      var ans = q.dataset.answer, chk = q.querySelector('input:checked');
      q.querySelectorAll('.opt').forEach(function (o) { o.classList.remove('correct', 'wrong'); });
      q.querySelector('input[value="' + ans + '"]').closest('.opt').classList.add('correct');
      if (chk) { answered++; if (chk.value === ans) score++; else chk.closest('.opt').classList.add('wrong'); }
      q.querySelector('.rationale').classList.add('show');
    });
    var s = document.getElementById('score');
    s.textContent = 'Score: ' + score + ' / ' + qs.length + (answered < qs.length ? ' (' + (qs.length - answered) + ' unanswered)' : '') + '. This check is unscored practice; read every rationale.';
  };
  FAI.resetQuiz = function () {
    document.getElementById('quiz').reset();
    document.querySelectorAll('#quiz .opt').forEach(function (o) { o.classList.remove('correct', 'wrong'); });
    document.querySelectorAll('#quiz .rationale').forEach(function (r) { r.classList.remove('show'); });
    document.getElementById('score').textContent = '';
  };

  /* interactive shell: expand overlay with focus trap; same layout, larger */
  var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function setupShell(iw) {
    var btn = iw.querySelector('.iw-exp'); if (!btn) return;
    var back = null;
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(iw.querySelectorAll(FOCUSABLE), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    function open() {
      back = document.createElement('div'); back.className = 'iw-backdrop'; back.addEventListener('click', close);
      iw.parentNode.insertBefore(back, iw);
      iw.classList.add('is-expanded'); iw.setAttribute('role', 'dialog'); iw.setAttribute('aria-modal', 'true');
      document.body.classList.add('iw-lock'); btn.textContent = '✕ Close'; btn.setAttribute('aria-label', 'Close expanded view');
      document.addEventListener('keydown', onKey); btn.focus();
      window.dispatchEvent(new Event('resize'));
    }
    function close() {
      if (!iw.classList.contains('is-expanded')) return;
      iw.classList.remove('is-expanded'); iw.removeAttribute('role'); iw.removeAttribute('aria-modal');
      if (back) back.remove(); back = null;
      document.body.classList.remove('iw-lock'); btn.textContent = '⤢ Expand'; btn.setAttribute('aria-label', 'Expand interactive');
      document.removeEventListener('keydown', onKey); btn.focus();
      window.dispatchEvent(new Event('resize'));
    }
    btn.addEventListener('click', function () { iw.classList.contains('is-expanded') ? close() : open(); });
  }
  document.querySelectorAll('.iw').forEach(setupShell);



  /* progress file: everything under fai:* saved to and loaded from one JSON file the participant keeps */
  FAI.progress = (function () {
    var APP = 'faculty-ai-integration-studio', NAME = 'ai-studio-progress.json', META = 'fai-meta';
    var canFS = !!(window.showSaveFilePicker && window.showOpenFilePicker), handle = null;
    function meta(m) { try { if (m) localStorage.setItem(META, JSON.stringify(m)); return JSON.parse(localStorage.getItem(META) || '{}'); } catch (e) { return {}; } }
    function keys() { var a = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('fai:') === 0) a.push(k); } } catch (e) {} return a; }
    function collect() {
      var d = {}; keys().forEach(function (k) { try { d[k.slice(4)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} });
      return { app: APP, version: 1, saved: new Date().toISOString(), data: d };
    }
    function touch() { var m = meta(); m.changed = Date.now(); meta(m); status(); }
    function stamp(name) { var m = meta(); m.saved = Date.now(); m.changed = 0; if (name) m.file = name; meta(m); status(); }
    /* keep the chosen file handle across pages (Chrome, Edge) */
    function idb(mode, val) {
      return new Promise(function (res) {
        try {
          var r = indexedDB.open('fai-progress', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('h'); };
          r.onsuccess = function () { var tx = r.result.transaction('h', mode ? 'readwrite' : 'readonly'), st = tx.objectStore('h'); var q = mode ? st.put(val, 'file') : st.get('file'); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; };
          r.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    }
    function text() { return JSON.stringify(collect(), null, 2); }
    function download() {
      var b = new Blob([text()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = NAME; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); stamp(NAME);
    }
    function write(h) {
      return h.createWritable().then(function (w) { return w.write(text()).then(function () { return w.close(); }); }).then(function () { handle = h; idb(true, h); stamp(h.name); });
    }
    function save(forceNew) {
      if (!canFS) return download();
      var p = (!forceNew && handle) ? Promise.resolve(handle) : (!forceNew ? idb(false) : Promise.resolve(null));
      return p.then(function (h) {
        if (h && h.queryPermission) {
          return h.queryPermission({ mode: 'readwrite' }).then(function (q) { return q === 'granted' ? q : h.requestPermission({ mode: 'readwrite' }); })
            .then(function (q) { if (q === 'granted') return write(h); return pick(); });
        }
        return pick();
      }).catch(function (e) { if (e && e.name !== 'AbortError') download(); });
      function pick() { return window.showSaveFilePicker({ suggestedName: NAME, types: [{ description: 'Progress file', accept: { 'application/json': ['.json'] } }] }).then(write); }
    }
    function apply(txt, name) {
      var o; try { o = JSON.parse(txt); } catch (e) { return alert('That file could not be read. Choose a progress file saved from this course.'); }
      var d = null;
      if (o && o.app === APP && o.data) d = o.data;
      else if (o && (o.portfolio || o.readiness || o.local || o.build)) d = { portfolio: o.portfolio, readiness: o.readiness, local: o.local, build: o.build };
      if (!d) return alert('That file is not a progress file from this course.');
      var when = o.saved ? new Date(o.saved).toLocaleString() : 'an earlier date';
      if (!confirm('Load your progress from ' + (name || 'this file') + ' (saved ' + when + ')? It replaces what is in this browser now.')) return;
      keys().forEach(function (k) { localStorage.removeItem(k); });
      Object.keys(d).forEach(function (k) { if (d[k] !== undefined) localStorage.setItem('fai:' + k, JSON.stringify(d[k])); });
      stamp(name); location.reload();
    }
    function open() {
      if (canFS) {
        return window.showOpenFilePicker({ types: [{ description: 'Progress file', accept: { 'application/json': ['.json'] } }] })
          .then(function (hs) { var h = hs[0]; return h.getFile().then(function (f) { return f.text().then(function (t) { handle = h; return idb(true, h).then(function () { apply(t, h.name); }); }); }); })
          .catch(function () {});
      }
      var inp = document.querySelector('[data-prog-input]'); if (inp) { inp.value = ''; inp.click(); }
    }
    function fmt(t) { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    function status() {
      var m = meta(), any = keys().length, txt, cls;
      if (!m.saved) { txt = any ? 'Not saved to a file yet.' : 'Nothing to save yet.'; cls = any ? 'warn' : ''; }
      else if (m.changed && m.changed > m.saved) { txt = 'Unsaved changes since ' + fmt(m.saved) + '.'; cls = 'warn'; }
      else { txt = '\u2713 Saved ' + fmt(m.saved) + (m.file ? ' \u00b7 ' + m.file : ''); cls = 'ok'; }
      document.querySelectorAll('[data-prog-box]').forEach(function (box) {
        box.classList.remove('warn', 'ok'); if (cls) box.classList.add(cls);
        var st = box.querySelector('.sp-status'); if (st) st.textContent = txt;
      });
    }
    /* Save strips sit where participants enter work; data-save-strip="open" adds Open for start-of-session places */
    function strips() {
      document.querySelectorAll('[data-save-strip]:not([data-done])').forEach(function (el) {
        var open = el.getAttribute('data-save-strip') === 'open';
        el.setAttribute('data-done', ''); el.setAttribute('data-prog-box', ''); el.className = 'save-strip';
        el.innerHTML = '<button type="button" class="btn" data-prog="save">Save progress</button>' +
          (canFS ? '<button type="button" class="btn sec" data-prog="saveas">Save as\u2026</button>' : '') +
          (open ? '<button type="button" class="btn sec" data-prog="open">Open progress file</button>' : '') +
          '<span class="ss-txt"><span class="sp-status" aria-live="polite"></span><span class="ss-note">Saves all your course progress to one file' + (open ? '. Open loads a file you saved before.' : '.') + '</span></span>';
      });
      status();
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-prog]'); if (!b) return;
      if (b.dataset.prog === 'save') save(); else if (b.dataset.prog === 'open') open(); else if (b.dataset.prog === 'saveas') save(true);
    });
    document.addEventListener('change', function (e) {
      if (!e.target.matches('[data-prog-input]')) return;
      var f = e.target.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { apply(rd.result, f.name); }; rd.readAsText(f);
    });
    window.addEventListener('storage', status);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', strips); else setTimeout(strips, 0);
    return { touch: touch, save: save, open: open, collect: collect, apply: apply, strips: strips };
  })();

  /* institution profile: one set of local answers fills every Local policy blank */
  FAI.LOCAL = [
    ['Institution and policy', [
      ['institution', 'Institution name', 'Name of your college or university'],
      ['policy', 'Institutional AI policy or interim guidance', 'Link, date, or "interim guidance in development"'],
      ['grading', 'Policy on student data and AI in grading', 'Link or section'],
      ['ip', 'Intellectual property policy for course materials', 'Link'],
      ['pilotapproval', 'Who approves a course-level AI pilot', 'Department chair, teaching center, or none']]],
    ['Tools and data', [
      ['tools', 'Approved AI tools and the data each is cleared for', 'For example: "Tool X: public and internal data; not student records"'],
      ['toolaccess', 'How faculty access the approved tool', 'Sign-in steps or link'],
      ['uploadtool', 'Approved tool with a project or file-upload space', 'Tool name and how to access it'],
      ['studenttool', 'Approved tool for students, and no-cost access', 'Tool and access steps'],
      ['feedbacktool', 'Approved tool for feedback on student work', 'Tool and the data it is cleared for'],
      ['dataclass', 'Data-classification guide', 'Link'],
      ['toolreview', 'How to request review of a new AI tool', 'Office, process, and contact']]],
    ['People and offices', [
      ['teaching', 'Teaching center contact', 'Name, email'],
      ['library', 'Library contact (sources, licensed materials, copyright)', 'Name, email'],
      ['researchguide', 'Library research or lateral-reading guide', 'Link'],
      ['access', 'Accessibility office contact and checker', 'Name, email, tool'],
      ['privacy', 'Privacy or information security contact', 'Name, email'],
      ['integrity', 'Academic integrity process and contact', 'Link, name, email']]],
    ['Teaching and assessment rules', [
      ['appeal', 'Student appeal or clarification pathway', 'Office, link'],
      ['detectors', 'Institutional position on AI detectors', 'Allowed, discouraged, or not licensed'],
      ['syllabus', 'Syllabus AI-statement requirement', 'Template or link'],
      ['disclosure', 'Expected format for student AI disclosure', 'Link or template'],
      ['a11ystd', 'Accessibility standard for course materials', 'For example: WCAG 2.1 AA, with policy link'],
      ['share', 'Where to share prompts and pilot results', 'Shared drive, repository, or showcase']]]
  ];
  var local = FAI.store.get('local', {}), page = location.pathname.split('/').pop() || 'index.html';
  function paint() {
    document.querySelectorAll('.fill').forEach(function (el, i) {
      if (!el.dataset.local) el.dataset.local = page.replace('.html', '') + '-' + i;
      if (!el.dataset.ph) el.dataset.ph = el.textContent;
      var v = local[el.dataset.local];
      el.textContent = v ? v : el.dataset.ph;
      el.classList.toggle('filled', !!v);
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
      el.setAttribute('title', v ? 'Your answer. Select to edit.' : 'Select to fill in for your institution');
    });
    document.querySelectorAll('[data-local-form] input').forEach(function (inp) { if (document.activeElement !== inp) inp.value = local[inp.dataset.key] || ''; });
  }
  function setLocal(k, v) { v = v.trim(); if (v) local[k] = v; else delete local[k]; FAI.store.set('local', local); paint(); }
  function editInline(el) {
    if (el.querySelector('input')) return;
    var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'fill-input';
    inp.value = local[el.dataset.local] || ''; inp.placeholder = el.dataset.ph; inp.setAttribute('aria-label', 'Fill in: ' + el.dataset.ph);
    el.textContent = ''; el.appendChild(inp); inp.focus();
    var done = false;
    function finish(save) { if (done) return; done = true; if (save) setLocal(el.dataset.local, inp.value); else paint(); el.focus(); }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    inp.addEventListener('blur', function () { finish(true); });
  }
  document.addEventListener('click', function (e) { var f = e.target.closest('.fill'); if (f && e.target.tagName !== 'INPUT') editInline(f); });
  document.addEventListener('keydown', function (e) { var f = e.target.classList && e.target.classList.contains('fill') ? e.target : null; if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); editInline(f); } });
  document.querySelectorAll('[data-local-form]').forEach(function (box) {
    box.innerHTML = FAI.LOCAL.map(function (g) {
      return '<fieldset class="lf-group"><legend>' + FAI.esc(g[0]) + '</legend>' + g[1].map(function (f) {
        return '<div class="lf-f"><label for="lf-' + f[0] + '">' + FAI.esc(f[1]) + '<span>' + FAI.esc(f[2]) + '</span></label><input type="text" id="lf-' + f[0] + '" data-key="' + f[0] + '"></div>';
      }).join('') + '</fieldset>';
    }).join('') + '<p class="lf-status" aria-live="polite"></p>';
    var st = box.querySelector('.lf-status'), t;
    box.addEventListener('input', function (e) {
      var k = e.target.dataset.key; if (!k) return;
      clearTimeout(t); t = setTimeout(function () { setLocal(k, e.target.value); var n = Object.keys(local).filter(function (x) { return FAI.LOCAL.some(function (g) { return g[1].some(function (f) { return f[0] === x; }); }); }).length; st.textContent = '✓ Saved. ' + n + ' of 24 answered. These answers now appear in every Local policy box.'; }, 350);
    });
  });
  paint();

  /* widget registry: init runs with the widget root element */
  FAI.widget = function (id, init) {
    var root = document.getElementById(id);
    if (root) { try { init(root); } catch (e) { console.error('widget ' + id, e); } }
  };

  /* radar helper used by several widgets: draws on a canvas, series = [{values:[0..1], color, fill}] */
  FAI.radar = function (cvs, labels, series) {
    var r = cvs.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(240, r.width), h = Math.max(220, r.height || w * 0.8);
    cvs.width = w * dpr; cvs.height = h * dpr;
    var c = cvs.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 54, n = labels.length;
    function pt(i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; }
    c.strokeStyle = '#cfcbe2'; c.lineWidth = 1;
    for (var g = 1; g <= 4; g++) { c.beginPath(); for (var i = 0; i < n; i++) { var p = pt(i, g / 4); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.closePath(); c.stroke(); }
    c.fillStyle = '#3b3757'; c.font = '11px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (i = 0; i < n; i++) { var e = pt(i, 1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(e[0], e[1]); c.stroke(); var l = pt(i, 1.2); c.fillText(labels[i], l[0], l[1]); }
    series.forEach(function (s) {
      c.beginPath(); s.values.forEach(function (v, i) { var p = pt(i, Math.max(0.02, v)); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath();
      c.fillStyle = s.fill; c.fill(); c.strokeStyle = s.color; c.lineWidth = 2.5; if (s.dash) c.setLineDash([6, 4]); c.stroke(); c.setLineDash([]);
      s.values.forEach(function (v, i) { var p = pt(i, Math.max(0.02, v)); c.beginPath(); c.arc(p[0], p[1], 3.5, 0, 7); c.fillStyle = s.color; c.fill(); });
    });
  };
})();
