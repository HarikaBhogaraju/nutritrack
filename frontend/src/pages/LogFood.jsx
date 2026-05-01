import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const empty = {
  name: '', servings: 1, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
  meal: '', notes: '',
}

export default function LogFood() {
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, [field]: v }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      await api.createEntry({
        ...form,
        servings: parseFloat(form.servings) || 1,
        calories: parseFloat(form.calories) || 0,
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        meal: form.meal || null,
        notes: form.notes || null,
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Log a food</h1>
      <p className="muted">
        Manually entering a food. Don't know the numbers? Try
        {' '}<a href="/chat">Ask Claude</a> or{' '}
        <a href="/lookup">Barcode + Photo</a>.
      </p>
      <form className="card" onSubmit={submit}>
        <label>Name</label>
        <input value={form.name} onChange={set('name')} required />

        <div style={{ height: 12 }} />
        <div className="row">
          <div>
            <label>Servings</label>
            <input type="number" step="0.1" min="0" value={form.servings} onChange={set('servings')} />
          </div>
          <div>
            <label>Meal</label>
            <select value={form.meal} onChange={set('meal')}>
              <option value="">—</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="row">
          <div><label>Calories (per serving)</label><input type="number" step="1" min="0" value={form.calories} onChange={set('calories')} /></div>
          <div><label>Protein (g)</label><input type="number" step="0.1" min="0" value={form.protein_g} onChange={set('protein_g')} /></div>
          <div><label>Carbs (g)</label><input type="number" step="0.1" min="0" value={form.carbs_g} onChange={set('carbs_g')} /></div>
          <div><label>Fat (g)</label><input type="number" step="0.1" min="0" value={form.fat_g} onChange={set('fat_g')} /></div>
        </div>

        <div style={{ height: 12 }} />
        <label>Notes</label>
        <textarea value={form.notes} onChange={set('notes')} placeholder="optional" />

        {error && <p className="error">{error}</p>}
        <div style={{ height: 12 }} />
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Log it'}</button>
      </form>
    </>
  )
}
