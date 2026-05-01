import { useEffect, useState } from 'react'
import { api } from '../api'

const emptyRecipe = {
  name: '', description: '',
  calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
  default_servings: 1, is_favorite: false,
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyRecipe)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const reload = async () => {
    try { setRecipes(await api.listRecipes()) }
    catch (err) { setError(err.message) }
  }
  useEffect(() => { reload() }, [])

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: v }))
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.createRecipe({
        ...form,
        calories: parseFloat(form.calories) || 0,
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        default_servings: parseFloat(form.default_servings) || 1,
        description: form.description || null,
      })
      setForm(emptyRecipe); setShowForm(false); reload()
    } catch (err) { setError(err.message) }
  }

  const toggleFavorite = async (r) => {
    await api.updateRecipe(r.id, { ...r, is_favorite: !r.is_favorite, description: r.description || null })
    reload()
  }
  const remove = async (r) => {
    if (!confirm(`Delete "${r.name}"?`)) return
    await api.deleteRecipe(r.id); reload()
  }
  const logIt = async (r) => {
    await api.logRecipe(r.id)
    setToast(`Logged ${r.name}`)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Recipes & favorites</h1>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New recipe'}
        </button>
      </div>

      {toast && <p className="success">{toast}</p>}
      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="card" onSubmit={submit}>
          <label>Name</label>
          <input value={form.name} onChange={set('name')} required />
          <div style={{ height: 12 }} />
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} />
          <div style={{ height: 12 }} />
          <div className="row">
            <div><label>Calories</label><input type="number" min="0" value={form.calories} onChange={set('calories')} /></div>
            <div><label>Protein (g)</label><input type="number" step="0.1" min="0" value={form.protein_g} onChange={set('protein_g')} /></div>
            <div><label>Carbs (g)</label><input type="number" step="0.1" min="0" value={form.carbs_g} onChange={set('carbs_g')} /></div>
            <div><label>Fat (g)</label><input type="number" step="0.1" min="0" value={form.fat_g} onChange={set('fat_g')} /></div>
            <div><label>Servings</label><input type="number" step="0.1" min="0" value={form.default_servings} onChange={set('default_servings')} /></div>
          </div>
          <div style={{ height: 12 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.is_favorite} onChange={set('is_favorite')} />
            Pin as favorite
          </label>
          <div style={{ height: 12 }} />
          <button type="submit">Save recipe</button>
        </form>
      )}

      <div className="entry-list">
        {recipes.length === 0 && <p className="muted">No saved recipes yet.</p>}
        {recipes.map((r) => (
          <div key={r.id} className="entry-row">
            <div>
              <div>
                <strong>{r.name}</strong>{' '}
                {r.is_favorite && <span title="Favorite">★</span>}
              </div>
              <div className="meta">
                {Math.round(r.calories)} cal · {Math.round(r.protein_g)}p / {Math.round(r.carbs_g)}c / {Math.round(r.fat_g)}f
                {' · '}{r.default_servings} serving{r.default_servings === 1 ? '' : 's'}
              </div>
              {r.description && <div className="muted" style={{ fontSize: '0.85rem' }}>{r.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => logIt(r)}>Log</button>
              <button className="secondary" onClick={() => toggleFavorite(r)}>
                {r.is_favorite ? 'Unfav' : 'Fav'}
              </button>
              <button className="danger" onClick={() => remove(r)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
