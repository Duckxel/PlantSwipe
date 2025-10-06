/*
  Robust runtime environment loader.
  - Tries /api/env.js first (served by Node server with proper JS MIME).
  - Falls back to /env.js (static) if needed.
  - Avoids executing HTML accidentally returned by SPA fallbacks.
  - Guarantees window.__ENV__ exists before app module runs.
*/
(function loadRuntimeEnv() {
  try {
    if (typeof window !== 'object') return
    if (window.__ENV__ && typeof window.__ENV__ === 'object') return

    var candidates = ['/api/env.js', '/env.js']
    var loaded = false

    function isProbablyHtml(text) {
      if (!text) return false
      var t = text.trim().slice(0, 200).toLowerCase()
      return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<head') || t.includes('<body')
    }

    function injectInline(jsText) {
      var s = document.createElement('script')
      s.text = jsText
      document.head.appendChild(s)
    }

    function setEmptyEnv() {
      if (!window.__ENV__) {
        window.__ENV__ = {}
      }
    }

    function loadFrom(url, onDone) {
      try {
        fetch(url, { cache: 'no-store', credentials: 'same-origin' })
          .then(function (res) {
            if (!res.ok) throw new Error('status ' + res.status)
            var ct = (res.headers.get('content-type') || '').toLowerCase()
            return res.text().then(function (txt) {
              if (isProbablyHtml(txt) || (ct && ct.includes('text/html'))) {
                throw new Error('html response for ' + url)
              }
              if (!/window\.__ENV__\s*=\s*\{/.test(txt)) {
                // Allow bare object assignment or module export format fallback if present
                // but primary expected pattern is window.__ENV__ = {...}
              }
              injectInline(txt)
              // small delay to allow execution
              setTimeout(function () {
                onDone(window.__ENV__ && typeof window.__ENV__ === 'object')
              }, 0)
            })
          })
          .catch(function () { onDone(false) })
      } catch (e) { onDone(false) }
    }

    (function tryNext(i) {
      if (i >= candidates.length) {
        setEmptyEnv()
        return
      }
      loadFrom(candidates[i], function (ok) {
        if (ok) {
          loaded = true
          return
        }
        tryNext(i + 1)
      })
    })(0)
  } catch (e) {
    try { window.__ENV__ = window.__ENV__ || {} } catch (_) {}
  }
})();
