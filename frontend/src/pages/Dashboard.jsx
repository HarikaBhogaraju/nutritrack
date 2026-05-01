import { useEffect, useState } from 'react'
import { api } from '../api'

function Metric({ label, value, suffix = '' }) {
  return (
    <div className="metric">
      <div className="value">{Math.round(value)}{suffix}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)

  const reload = async () => {
    try {
      const [d, e] = await Promise.all([api.dashboard(), api.listEntries()])
      setData(d); setEntries(e)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { reload() }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p>Loading…</p>

  const maxCals = Math.max(1, ...data.last_7_days.map((d) => d.calories))

  const removeEntry = async (id) => {
    await api.deleteEntry(id)
    reload()
  }

  return (
    <>
      <h1>Today</h1>
      <div className="metric-grid">
        <Metric label="Calories" value={data.today.calories} />
        <Metric label="Protein" value={data.today.protein_g} suffix="g" />
        <Metric label="Carbs" value={data.today.carbs_g} suffix="g" />
        <Metric label="Fat" value={data.today.fat_g} suffix="g" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Last 7 days · calories</h2>
        <div className="bars">
          {data.last_7_days.map((d) => (
            <div
              key={d.date}
              className="bar"
              style={{ height: `${Math.max(2, (d.calories / maxCals) * 100)}%` }}
              title={`${d.date}: ${Math.round(d.calories)} cal`}
            >
              <span className="bar-label">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 24 }} />
      </div>

      <div className="card">
        <h2>Today's entries</h2>
        {entries.length === 0 && <p className="muted">Nothing logged yet today.</p>}
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
