import { useMemo, useState } from 'react'
import './CategorySortBar.css'

// Sorting options exposed to the user. Each entry has a stable key and a
// comparator over the (already-loaded) games array. The default 'default'
// preserves the order the provider returned games in.
const SORT_OPTIONS = [
  { key: 'default', label: 'Default' },
  { key: 'name_asc', label: 'Name A→Z' },
  { key: 'name_desc', label: 'Name Z→A' },
  { key: 'hot_first', label: 'Hot first' },
  { key: 'new_first', label: 'New first' },
]

const SORT_FNS = {
  default: null,
  name_asc: (a, b) => (a.name || '').localeCompare(b.name || ''),
  name_desc: (a, b) => (b.name || '').localeCompare(a.name || ''),
  hot_first: (a, b) => (b.isHot ? 1 : 0) - (a.isHot ? 1 : 0),
  new_first: (a, b) => {
    const aIsNew = a.isNew ? 1 : 0
    const bIsNew = b.isNew ? 1 : 0
    if (aIsNew !== bIsNew) return bIsNew - aIsNew
    // Tiebreak by release date if available
    const aD = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
    const bD = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
    return bD - aD
  },
}

// Title-case a raw category id for the chip label when no explicit label
// has been provided. Strips underscores and capitalizes.
const titleCase = (raw) => {
  if (raw == null) return 'Unknown'
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * useCategoryAndSort
 *
 * Builds chip + sort controls for a provider's games list based on the
 * actual raw category values present. Returns:
 *   - bar: the JSX to render above the grid
 *   - filteredGames: the games array with filter + sort applied
 *
 * Options:
 *   - labels: map from rawCategory string -> human label (e.g. JDB gType ids)
 *   - groupBy: 'rawCategory' (default) or a custom function (game) => string
 *   - hideIfSingle: bool, hide the chip row if only one category exists
 *   - title: optional heading shown to the left of the controls
 */
export function useCategoryAndSort(games, {
  labels = {},
  groupBy,
  hideIfSingle = true,
  title,
} = {}) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortKey, setSortKey] = useState('default')

  const getCategoryKey = (g) => {
    if (typeof groupBy === 'function') return groupBy(g) || 'uncategorized'
    const raw = g?.rawCategory ?? g?.category ?? null
    if (raw == null || raw === '' || raw === '-') return 'uncategorized'
    return String(raw)
  }

  // Distinct categories with counts, sorted by count desc so the most
  // populated chips show first.
  const categoryCounts = useMemo(() => {
    const counts = {}
    for (const g of games || []) {
      const key = getCategoryKey(g)
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [games])

  const categories = useMemo(() => {
    const entries = Object.entries(categoryCounts).map(([key, count]) => ({
      key,
      count,
      label: labels[key] || titleCase(key),
    }))
    entries.sort((a, b) => b.count - a.count)
    return entries
  }, [categoryCounts, labels])

  // Filter then sort.
  const filteredGames = useMemo(() => {
    const arr = (games || []).filter((g) =>
      selectedCategory === 'all' ? true : getCategoryKey(g) === selectedCategory
    )
    const sortFn = SORT_FNS[sortKey]
    return sortFn ? [...arr].sort(sortFn) : arr
  }, [games, selectedCategory, sortKey])

  const totalCount = games?.length || 0
  const shouldHideChips = hideIfSingle && categories.length <= 1

  const bar = (
    <div className="category-sort-bar">
      {!shouldHideChips && (
        <div className="csb-chips">
          {title && <span className="csb-title">{title}</span>}
          <button
            className={`csb-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All <span className="csb-chip-count">{totalCount.toLocaleString()}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              className={`csb-chip ${selectedCategory === c.key ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c.key)}
            >
              {c.label}
              <span className="csb-chip-count">{c.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
      <div className="csb-sort">
        <label className="csb-sort-label" htmlFor="csb-sort-select">Sort</label>
        <select
          id="csb-sort-select"
          className="csb-sort-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )

  return { bar, filteredGames, selectedCategory, sortKey }
}
