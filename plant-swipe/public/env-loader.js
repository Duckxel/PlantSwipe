/*
  Robust runtime environment loader.
  - Tries /api/env.js first (served by Node server with proper JS MIME).
  - Falls back to /env.js (static) if needed.
  - Avoids executing HTML accidentally returned by SPA fallbacks.
  - Guarantees window.__ENV__ exists before app module runs.
*/
;(function loadRuntimeEnv() {
  try {
    if (typeof window !== 'object') return
    if (window.__ENV__ && typeof window.__ENV__ === 'object') return

    function normalizeBase(path) {
      if (typeof path !== 'string' || !path.length) return '/'
      if (!path.startsWith('/')) path = '/' + path
      if (!path.endsWith('/')) path += '/'
      return path.replace(/\/{2,}/g, '/')
    }

    var baseFromScript = '/'
    var currentScript = document.currentScript
    if (currentScript && currentScript.getAttribute('data-base')) {
      baseFromScript = normalizeBase(currentScript.getAttribute('data-base'))
    } else if (currentScript && currentScript.src) {
      try {
        var srcUrl = new URL(currentScript.src, window.location.origin)
        baseFromScript = normalizeBase(srcUrl.pathname.replace(/env-loader\.js(?:\?.*)?$/, ''))
      } catch (_) {
        baseFromScript = '/'
      }
    }
    var basePath = normalizeBase((window.__PLANTSWIPE_BASE_PATH__ || baseFromScript || '/'))
    window.__PLANTSWIPE_BASE_PATH__ = basePath

    function join(base, resource) {
      if (/^(https?:)?\/\//.test(resource)) return resource
      var cleanBase = normalizeBase(base)
      var cleanResource = resource.replace(/^\//, '')
      if (!cleanResource) return cleanBase
      if (cleanBase === '/') return '/' + cleanResource
      return (cleanBase + cleanResource).replace(/\/{2,}/g, '/')
    }

    var candidates = []
    function pushCandidate(url) {
      if (!url) return
      if (candidates.indexOf(url) === -1) {
        candidates.push(url)
      }
    }

    pushCandidate(join(basePath, 'api/env.js'))
    pushCandidate('/api/env.js')
    pushCandidate(join(basePath, 'env.js'))
    pushCandidate('/env.js')

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
              injectInline(txt)
              setTimeout(function () {
                onDone(window.__ENV__ && typeof window.__ENV__ === 'object')
              }, 0)
            })
          })
          .catch(function () { onDone(false) })
      } catch (e) { onDone(false) }
    }

    ;(function tryNext(i) {
      if (i >= candidates.length) {
        setEmptyEnv()
        return
      }
      loadFrom(candidates[i], function (ok) {
        if (ok) {
          return
        }
        tryNext(i + 1)
      })
    })(0)
  } catch (e) {
    try { window.__ENV__ = window.__ENV__ || {} } catch (_) {}
  }
})();
