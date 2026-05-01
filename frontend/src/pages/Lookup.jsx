import { useState } from 'react'
import { api } from '../api'

function EstimateCard({ est, onLog }) {
  if (!est) return null
  return (
    <div className="estimate-card" style={{ maxWidth: 'unset', alignSelf: 'stretch' }}>
      <strong>{est.name}</strong>
      <div className="muted" style={{ fontSize: '0.85rem' }}>Confidence: {est.confidence}</div>
      <div className="est-grid">
        <div><b>{Math.round(est.calories)}</b>cal</div>
        <div><b>{Math.round(est.protein_g)}g</b>protein</div>
        <div><b>{Math.round(est.carbs_g)}g</b>carbs</div>
        <div><b>{Math.round(est.fat_g)}g</b>fat</div>
      </div>
      {est.notes && <div className="muted" style={{ fontSize: '0.85rem' }}>{est.notes}</div>}
      <div style={{ marginTop: 8 }}>
        <button onClick={() => onLog(est)}>Log this</button>
      </div>
    </div>
  )
}

export default function Lookup() {
  const [barcode, setBarcode] = useState('')
  const [barcodeResult, setBarcodeResult] = useState(null)
  const [photoResult, setPhotoResult] = useState(null)
  const [photoDescription, setPhotoDescription] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const lookupBarcode = async (e) => {
    e.preventDefault()
    setError(null); setBusy(true); setBarcodeResult(null)
    try {
      const res = await api.barcodeLookup(barcode.trim())
      if (res.found) setBarcodeResult(res.estimate)
      else setError('Barcode not found in OpenFoodFacts.')
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setBusy(true); setPhotoResult(null); setPhotoDescription(null)
    try {
      const res = await api.photoLookup(file)
      setPhotoResult(res.estimate)
      setPhotoDescription(res.description)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const log = async (est) => {
    try {
      await api.createEntry({
        name: est.name,
        servings: est.servings || 1,
        calories: est.calories, protein_g: est.protein_g, carbs_g: est.carbs_g, fat_g: est.fat_g,
        notes: est.notes,
      })
      setToast('Logged!')
      setTimeout(() => setToast(null), 2000)
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <h1>Barcode + Photo lookup</h1>
      {toast && <p className="success">{toast}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Barcode</h2>
        <p className="muted">Type or paste a UPC/EAN. Data comes from OpenFoodFacts.</p>
        <form onSubmit={lookupBarcode} style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="e.g. 0123456789012"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <button type="submit" disabled={busy || !barcode.trim()}>Look up</button>
        </form>
        <div style={{ height: 12 }} />
        <EstimateCard est={barcodeResult} onLog={log} />
      </div>

      <div className="card">
        <h2>Photo</h2>
        <p className="muted">Snap or upload a photo of food. Claude's vision API will estimate it.</p>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={busy} />
        {busy && <p className="muted">Analyzing image…</p>}
        {photoDescription && <p style={{ marginTop: 12 }}>{photoDescription}</p>}
        <div style={{ height: 8 }} />
        <EstimateCard est={photoResult} onLog={log} />
      </div>
    </>
  )
}
