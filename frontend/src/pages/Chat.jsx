import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

function Estimate({ est, onLog, onSave }) {
  return (
    <div className="estimate-card">
      <strong>{est.name}</strong>
      <div className="muted" style={{ fontSize: '0.85rem' }}>
        Confidence: {est.confidence} · {est.servings} serving{est.servings === 1 ? '' : 's'}
      </div>
      <div className="est-grid">
        <div><b>{Math.round(est.calories)}</b>cal</div>
        <div><b>{Math.round(est.protein_g)}g</b>protein</div>
        <div><b>{Math.round(est.carbs_g)}g</b>carbs</div>
        <div><b>{Math.round(est.fat_g)}g</b>fat</div>
      </div>
      {est.notes && <div className="muted" style={{ fontSize: '0.85rem' }}>{est.notes}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => onLog(est)}>Log this</button>
        <button className="secondary" onClick={() => onSave(est)}>Save as recipe</button>
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([]) // {role, content, estimate?}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const logRef = useRef(null)

  useEffect(() => {
    api.chatHistory().then((rows) => {
      setMessages(rows.map((r) => ({ role: r.role, content: r.content })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    const userMsg = input.trim()
    setInput('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setBusy(true)
    try {
      const history = messages.map(({ role, content }) => ({ role, content }))
      const res = await api.chat(userMsg, history)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, estimate: res.estimate }])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const logEstimate = async (est) => {
    try {
      await api.createEntry({
        name: est.name,
        servings: est.servings,
        calories: est.calories,
        protein_g: est.protein_g,
        carbs_g: est.carbs_g,
        fat_g: est.fat_g,
        notes: est.notes || 'Logged from chat',
      })
      setToast('Logged!')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err.message)
    }
  }

  const saveAsRecipe = async (est) => {
    try {
      await api.createRecipe({
        name: est.name,
        description: est.notes || null,
        calories: est.calories,
        protein_g: est.protein_g,
        carbs_g: est.carbs_g,
        fat_g: est.fat_g,
        default_servings: est.servings,
        is_favorite: false,
      })
      setToast('Saved as recipe!')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Ask Claude</h1>
      <p className="muted">
        Describe a recipe, paste a menu item, or ask anything about nutrition.
        Claude will estimate calories and macros — you can log them with one click.
      </p>

      <div className="card">
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && (
            <p className="muted">
              Try: "I made a stir-fry with 2 chicken breasts, 1 tbsp oil, broccoli, and 1 cup of jasmine rice. What does that work out to?"
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={`chat-bubble ${m.role}`}>{m.content}</div>
              {m.estimate && (
                <Estimate est={m.estimate} onLog={logEstimate} onSave={saveAsRecipe} />
              )}
            </div>
          ))}
          {busy && <div className="chat-bubble assistant"><em>Thinking…</em></div>}
        </div>

        {toast && <p className="success">{toast}</p>}
        {error && <p className="error">{error}</p>}

        <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Ask about a food, recipe, or menu item…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>
    </>
  )
}
