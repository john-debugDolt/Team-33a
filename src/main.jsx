import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Debug helper: in DevTools, run `__imageStats()` to see image load times
// per host (provider), sorted fastest first. Backed by the browser's
// performance resource timing — no extra instrumentation needed.
if (typeof window !== 'undefined') {
  window.__imageStats = (sortBy = 'avg') => {
    const stats = {}
    for (const e of performance.getEntriesByType('resource')) {
      if (e.initiatorType !== 'img') continue
      let host
      try { host = new URL(e.name, location.origin).host } catch { continue }
      const s = stats[host] || { host, count: 0, totalMs: 0, maxMs: 0 }
      s.count++
      s.totalMs += e.duration
      if (e.duration > s.maxMs) s.maxMs = e.duration
      stats[host] = s
    }
    const rows = Object.values(stats)
      .map(s => ({ host: s.host, count: s.count, avg: Math.round(s.totalMs / s.count), max: Math.round(s.maxMs) }))
      .sort((a, b) => a[sortBy] - b[sortBy])
    console.table(rows)
    return rows
  }
}

// Render the app
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
