import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, localDateString } from '../api'

function Metric({ label, value, target, suffix = '', tone }) {
  const hasTarget = target != null && target > 0
  const pct = hasTarget ? Math.min(100, (value / target) * 100) : 0

  return (
    <div className={`metric ${tone ? `tile-${tone}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{Math.round(value)}{suffix}</div>
      {hasTarget && (
        <>
          <div className="metric-bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
          <div className="metric-sub">of {Math.round(target)}{suffix}</div>
        </>
      )}
    </div>
  )
}

// Date math in LOCAL time (avoid Date.parse on YYYY-MM-DD which uses UTC).
function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function shiftDate(s, deltaDays) {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + deltaDays)
  return localDateString(d)
}

function dayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today'
  if (dateStr === shiftDate(todayStr, -1)) return 'Yesterday'
  if (dateStr === shiftDate(todayStr, 1)) return 'Tomorrow'
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const today = localDateString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [chart, setChart] = useState(null)        // /dashboard response
  const [entries, setEntries] = useState([])      // entries for selectedDate
  const [goals, setGoals] = useState(null)
  const [error, setError] = useState(null)
  const [loadingEntries, setLoadingEntries] = useState(false)

  const isToday = selectedDate === today
  const isFuture = selectedDate > today

  // Load chart + goals once.
  useEffect(() => {
    (async () => {
      try {
        const [c, g] = await Promise.all([
          api.dashboard(),
          api.getGoals().catch(() => null),
        ])
        setChart(c); setGoals(g)
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [])

  // Re-load entries whenever the selected date changes.
  const reloadEntries = async () => {
    setLoadingEntries(true)
    try {
      setEntries(await api.listEntries(selectedDate))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingEntries(false)
    }
  }
  useEffect(() => { reloadEntries() }, [selectedDate])

  // Re-fetch chart in the background when entries change so the 7-day chart stays fresh.
  const refreshChart = async () => {
    try { setChart(await api.dashboard()) } catch {}
  }

  const removeEntry = async (id) => {
    await api.deleteEntry(id)
    await Promise.all([reloadEntries(), refreshChart()])
  }

  // Totals for the selected day, computed from its entries.
  const totals = useMemo(() => {
    const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    for (const e of entries) {
      const s = e.servings || 1
      t.calories += (e.calories || 0) * s
      t.protein_g += (e.protein_g || 0) * s
      t.carbs_g += (e.carbs_g || 0) * s
      t.fat_g += (e.fat_g || 0) * s
    }
    return t
  }, [entries])

  if (error) return <p className="error">{error}</p>
  if (!chart) return <p>Loading…</p>

  const maxCals = Math.max(1, ...chart.last_7_days.map((d) => d.calories))
  const hasAnyGoal = goals && (
    goals.calorie_target != null ||
    goals.protein_target_g != null ||
    goals.carbs_target_g != null ||
    goals.fat_target_g != null
  )

  return (
    <>
      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="secondary" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
          ← Prev
        </button>
        <h1 style={{ margin: 0, flex: 1, textAlign: 'center', minWidth: 180 }}>
          {dayLabel(selectedDate, today)}
          <div style={{
            fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value) }}
              aria-label="Pick a date"
              style={{
                width: 'auto', padding: '2px 6px', fontSize: '0.85rem',
                border: '1px solid var(--border)', borderRadius: 4,
                background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer',
              }}
            />
          </div>
        </h1>
        <button
          className="secondary"
          onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          disabled={isFuture}
          title={isFuture ? "Can't navigate past today" : ''}
        >
          Next →
        </button>
        {!isToday && (
          <button onClick={() => setSelectedDate(today)} title="Jump to today">
            Today
          </button>
        )}
      </div>

      {!hasAnyGoal && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          No daily targets set. <Link to="/goals">Set goals</Link> to see progress bars here.
        </p>
      )}

      <div className="metric-grid">
        <Metric tone="yellow"   label="Calories" value={totals.calories} target={goals?.calorie_target} />
        <Metric tone="orange"   label="Protein"  value={totals.protein_g} target={goals?.protein_target_g} suffix="g" />
        <Metric tone="green"    label="Carbs"    value={totals.carbs_g}   target={goals?.carbs_target_g}   suffix="g" />
        <Metric tone="blue"     label="Fat"      value={totals.fat_g}     target={goals?.fat_target_g}     suffix="g" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Last 7 days · calories</h2>
        <div className="bars">
          {chart.last_7_days.map((d) => (
            <div
              key={d.date}
              className={`bar ${d.date === selectedDate ? 'bar-selected' : ''}`}
              style={{
                height: `${Math.max(2, (d.calories / maxCals) * 100)}%`,
                cursor: 'pointer',
                opacity: d.date === selectedDate ? 1 : 0.7,
              }}
              title={`${d.date}: ${Math.round(d.calories)} cal — click to view`}
              onClick={() => setSelectedDate(d.date)}
            >
              <span className="bar-label">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 24 }} />
      </div>

      <div className="card">
        <h2>Entries · {dayLabel(selectedDate, today)}</h2>
        {loadingEntries && <p className="muted">Loading…</p>}
        {!loadingEntries && entries.length === 0 && (
          <p className="muted">Nothing logged on this day.</p>
        )}
        <div className="entry-list">
          {entries.map((e) => (
            <div key={e.id} className="entry-row">
              <div>
                <div><strong>{e.name}</strong> <span className="muted">× {e.servings}</span></div>
                <div className="meta">
                  {Math.round(e.calories * e.servings)} cal ·
                  {' '}{Math.round(e.protein_g * e.servings)}p
                  /{Math.round(e.carbs_g * e.servings)}c
                  /{Math.round(e.fat_g * e.servings)}f
                  {e.meal && ` · ${e.meal}`}
                  {' · '}
                  {new Date(e.consumed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <button className="secondary" onClick={() => removeEntry(e.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
