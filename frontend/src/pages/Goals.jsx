import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

// ---------- Daily nutrition targets ----------

function DailyTargetsCard({ goals, onSaved }) {
  const [form, setForm] = useState(() => ({
    calorie_target: goals?.calorie_target ?? '',
    protein_target_g: goals?.protein_target_g ?? '',
    carbs_target_g: goals?.carbs_target_g ?? '',
    fat_target_g: goals?.fat_target_g ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const numOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      // Preserve weight-goal fields by sending them back unchanged.
      const payload = {
        calorie_target: numOrNull(form.calorie_target),
        protein_target_g: numOrNull(form.protein_target_g),
        carbs_target_g: numOrNull(form.carbs_target_g),
        fat_target_g: numOrNull(form.fat_target_g),
        start_weight_lb: goals?.start_weight_lb ?? null,
        target_weight_lb: goals?.target_weight_lb ?? null,
        weekly_rate_lb: goals?.weekly_rate_lb ?? null,
        start_date: goals?.start_date ?? null,
      }
      const updated = await api.updateGoals(payload)
      onSaved(updated)
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Daily nutrition targets</h2>
      <p className="muted">Leave a field blank to skip tracking that one.</p>
      <div className="row">
        <div><label>Calories</label><input type="number" min="0" step="10" value={form.calorie_target} onChange={set('calorie_target')} placeholder="e.g. 2000" /></div>
        <div><label>Protein (g)</label><input type="number" min="0" step="1" value={form.protein_target_g} onChange={set('protein_target_g')} placeholder="e.g. 140" /></div>
        <div><label>Carbs (g)</label><input type="number" min="0" step="1" value={form.carbs_target_g} onChange={set('carbs_target_g')} placeholder="e.g. 220" /></div>
        <div><label>Fat (g)</label><input type="number" min="0" step="1" value={form.fat_target_g} onChange={set('fat_target_g')} placeholder="e.g. 65" /></div>
      </div>
      {toast && <p className="success">{toast}</p>}
      {error && <p className="error">{error}</p>}
      <div style={{ height: 12 }} />
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save daily targets'}</button>
    </form>
  )
}

// ---------- Weight goal ----------

function WeightGoalCard({ goals, weights, onSaved }) {
  // direction: lose | gain | maintain (derived from sign of weekly_rate_lb)
  const initialDirection = (() => {
    const r = goals?.weekly_rate_lb
    if (r == null || r === 0) return 'maintain'
    return r < 0 ? 'lose' : 'gain'
  })()

  const [form, setForm] = useState(() => ({
    direction: initialDirection,
    start_weight_lb: goals?.start_weight_lb ?? '',
    target_weight_lb: goals?.target_weight_lb ?? '',
    weekly_rate_lb_abs: goals?.weekly_rate_lb != null ? Math.abs(goals.weekly_rate_lb) : '',
    start_date: goals?.start_date ?? new Date().toISOString().slice(0, 10),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const numOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }

  // Most recent weight from the log.
  const currentWeight = useMemo(() => {
    if (!weights?.length) return null
    return weights[weights.length - 1].weight_lb
  }, [weights])

  // Progress: (start - current) / (start - target). Works for both lose & gain.
  const progress = useMemo(() => {
    const s = goals?.start_weight_lb
    const t = goals?.target_weight_lb
    if (s == null || t == null || currentWeight == null || s === t) return null
    const total = Math.abs(s - t)
    const done = Math.abs(s - currentWeight)
    const pct = Math.max(0, Math.min(100, (done / total) * 100))
    return pct
  }, [goals, currentWeight])

  // Projected finish date based on the (signed) weekly rate.
  const projection = useMemo(() => {
    const t = goals?.target_weight_lb
    const r = goals?.weekly_rate_lb
    if (t == null || r == null || r === 0 || currentWeight == null) return null
    const remaining = t - currentWeight
    // Direction must match: rate sign should equal sign of remaining.
    if (Math.sign(remaining) !== Math.sign(r)) return null
    const weeks = remaining / r
    if (!Number.isFinite(weeks) || weeks <= 0) return null
    const finish = new Date()
    finish.setDate(finish.getDate() + Math.round(weeks * 7))
    return { weeks: Math.round(weeks * 10) / 10, date: finish.toISOString().slice(0, 10) }
  }, [goals, currentWeight])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const absRate = numOrNull(form.weekly_rate_lb_abs)
      const signedRate =
        form.direction === 'maintain' || absRate == null ? 0
        : form.direction === 'lose' ? -Math.abs(absRate)
        : Math.abs(absRate)

      const payload = {
        // Keep daily targets as-is.
        calorie_target: goals?.calorie_target ?? null,
        protein_target_g: goals?.protein_target_g ?? null,
        carbs_target_g: goals?.carbs_target_g ?? null,
        fat_target_g: goals?.fat_target_g ?? null,
        // Update weight goal.
        start_weight_lb: numOrNull(form.start_weight_lb),
        target_weight_lb: numOrNull(form.target_weight_lb),
        weekly_rate_lb: form.direction === 'maintain' ? 0 : signedRate,
        start_date: form.start_date || null,
      }
      const updated = await api.updateGoals(payload)
      onSaved(updated)
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Weight goal</h2>

      <div className="row">
        <div>
          <label>I want to</label>
          <select value={form.direction} onChange={set('direction')}>
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain weight</option>
            <option value="gain">Gain weight</option>
          </select>
        </div>
        <div>
          <label>Start weight (lb)</label>
          <input type="number" step="0.1" min="0" value={form.start_weight_lb} onChange={set('start_weight_lb')} />
        </div>
        <div>
          <label>Target weight (lb)</label>
          <input type="number" step="0.1" min="0" value={form.target_weight_lb} onChange={set('target_weight_lb')}
                 disabled={form.direction === 'maintain'} />
        </div>
        <div>
          <label>Rate (lb/week)</label>
          <input type="number" step="0.1" min="0" value={form.weekly_rate_lb_abs} onChange={set('weekly_rate_lb_abs')}
                 disabled={form.direction === 'maintain'} placeholder="e.g. 0.5" />
        </div>
        <div>
          <label>Start date</label>
          <input type="date" value={form.start_date} onChange={set('start_date')} />
        </div>
      </div>

      {toast && <p className="success">{toast}</p>}
      {error && <p className="error">{error}</p>}

      <div style={{ height: 12 }} />
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save weight goal'}</button>

      {(progress != null || projection || currentWeight != null) && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <h3>Progress</h3>
          {currentWeight != null && (
            <p className="muted">
              Current weight: <strong>{currentWeight} lb</strong>
              {goals?.start_weight_lb != null && goals?.target_weight_lb != null && (
                <> · Goal: {goals.start_weight_lb} → {goals.target_weight_lb} lb</>
              )}
            </p>
          )}
          {progress != null && (
            <>
              <div style={{ height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--c-pink)' }} />
              </div>
              <p className="muted" style={{ marginTop: 4 }}>{Math.round(progress)}% to goal</p>
            </>
          )}
          {projection && (
            <p className="muted">
              At {Math.abs(goals.weekly_rate_lb)} lb/week, projected to hit goal in
              {' '}<strong>{projection.weeks} weeks</strong> (~{projection.date}).
            </p>
          )}
          {!projection && goals?.weekly_rate_lb != null && goals.weekly_rate_lb !== 0 && currentWeight != null && (
            <p className="muted">
              Heads up — your weekly rate direction doesn't match the gap between your current and target weight.
            </p>
          )}
        </div>
      )}
    </form>
  )
}

// ---------- Weight log + chart ----------

function WeightChart({ weights }) {
  // Inline SVG line chart of weight over time.
  if (!weights || weights.length < 2) {
    return (
      <p className="muted">Add at least two weigh-ins to see a trend chart.</p>
    )
  }

  const W = 600
  const H = 200
  const padL = 40, padR = 12, padT = 12, padB = 28

  const xs = weights.map((w) => new Date(w.measured_at).getTime())
  const ys = weights.map((w) => w.weight_lb)
  const xMin = xs[0]
  const xMax = xs[xs.length - 1]
  const yMin = Math.min(...ys) - 1
  const yMax = Math.max(...ys) + 1
  const xRange = Math.max(1, xMax - xMin)
  const yRange = Math.max(0.1, yMax - yMin)

  const xPx = (x) => padL + ((x - xMin) / xRange) * (W - padL - padR)
  const yPx = (y) => padT + (1 - (y - yMin) / yRange) * (H - padT - padB)

  const points = weights.map((w) => `${xPx(new Date(w.measured_at).getTime())},${yPx(w.weight_lb)}`).join(' ')
  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (yRange * i) / yTicks)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Weight over time">
      {/* Gridlines + y-axis labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={yPx(t)} y2={yPx(t)} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 6} y={yPx(t)} fontSize="10" textAnchor="end" alignmentBaseline="middle" fill="var(--muted)">
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {/* X-axis: just first/last date */}
      <text x={padL} y={H - 8} fontSize="10" fill="var(--muted)">
        {new Date(xMin).toISOString().slice(0, 10)}
      </text>
      <text x={W - padR} y={H - 8} fontSize="10" textAnchor="end" fill="var(--muted)">
        {new Date(xMax).toISOString().slice(0, 10)}
      </text>
      {/* Line */}
      <polyline fill="none" stroke="var(--c-pink)" strokeWidth="2" points={points} />
      {/* Dots */}
      {weights.map((w) => (
        <circle
          key={w.id}
          cx={xPx(new Date(w.measured_at).getTime())}
          cy={yPx(w.weight_lb)}
          r="3"
          fill="var(--c-pink)"
        />
      ))}
    </svg>
  )
}

function WeightLogCard({ weights, reload }) {
  const [weightInput, setWeightInput] = useState('')
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const w = parseFloat(weightInput)
    if (!Number.isFinite(w) || w <= 0) {
      setError('Enter a valid weight')
      return
    }
    setBusy(true)
    try {
      // Use noon UTC of the chosen date so timezone wobble doesn't put it on the wrong day.
      const measured = dateInput ? new Date(`${dateInput}T12:00:00Z`).toISOString() : null
      await api.addWeight({ weight_lb: w, measured_at: measured })
      setWeightInput('')
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this weigh-in?')) return
    await api.deleteWeight(id)
    reload()
  }

  // Newest-first list, but chart wants oldest-first (we already get oldest-first from the API).
  const recent = [...(weights || [])].reverse().slice(0, 12)

  return (
    <div className="card">
      <h2>Weight log</h2>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label>Weight (lb)</label>
          <input type="number" step="0.1" min="0" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label>Date</label>
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
        </div>
        <button type="submit" disabled={busy}>Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div style={{ marginTop: 16 }}>
        <h3>Trend</h3>
        <WeightChart weights={weights} />
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Recent weigh-ins</h3>
          <div className="entry-list">
            {recent.map((w) => (
              <div key={w.id} className="entry-row">
                <div>
                  <strong>{w.weight_lb} lb</strong>{' '}
                  <span className="muted">· {new Date(w.measured_at).toISOString().slice(0, 10)}</span>
                </div>
                <button className="danger" onClick={() => remove(w.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Page ----------

export default function Goals() {
  const [goals, setGoals] = useState(null)
  const [weights, setWeights] = useState([])
  const [error, setError] = useState(null)

  const loadAll = async () => {
    try {
      const [g, w] = await Promise.all([api.getGoals(), api.listWeights(180)])
      setGoals(g); setWeights(w)
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { loadAll() }, [])
  const reloadWeights = async () => {
    try { setWeights(await api.listWeights(180)) }
    catch (err) { setError(err.message) }
  }

  if (error) return <p className="error">{error}</p>
  if (!goals) return <p>Loading…</p>

  return (
    <>
      <h1>Goals</h1>
      <DailyTargetsCard goals={goals} onSaved={setGoals} />
      <WeightGoalCard goals={goals} weights={weights} onSaved={setGoals} />
      <WeightLogCard weights={weights} reload={reloadWeights} />
    </>
  )
}
