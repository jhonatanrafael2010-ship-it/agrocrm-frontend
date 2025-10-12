import React, { useEffect, useState } from 'react'
import './Properties.css'
import DarkSelect from '../components/DarkSelect'

type Plot = { id: number; name: string }
type Planting = { id: number; plot_id: number; culture?: string; variety?: string; planting_date?: string }

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const PlantingsPage: React.FC = () => {
  const [plots, setPlots] = useState<Plot[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [openPlanting, setOpenPlanting] = useState(false)
  const [plantForm, setPlantForm] = useState({ plot_id: '', culture: '', variety: '', planting_date: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([
      fetch(`${API_BASE}plots`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}plantings`).then(r => r.ok ? r.json() : []),
    ]).then(([pls, pts]) => { if (!mounted) return; setPlots(pls || []); setPlantings(pts || []) }).catch(console.error)
    return () => { mounted = false }
  }, [])

  function handlePlantChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setPlantForm(f => ({ ...f, [name]: value }))
  }

  async function createPlanting() {
    if (!plantForm.plot_id) return alert('Talhão é obrigatório')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}plantings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plot_id: Number(plantForm.plot_id), culture: plantForm.culture || undefined, variety: plantForm.variety || undefined, planting_date: plantForm.planting_date || undefined }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)
      const created = body.planting || body
      setPlantings(p => [created, ...p])
      setOpenPlanting(false)
      setPlantForm({ plot_id: '', culture: '', variety: '', planting_date: '' })
    } catch (err: any) { alert(err?.message || 'Erro ao criar plantio') } finally { setSubmitting(false) }
  }

  async function deletePlanting(id?: number) {
    if (!id) return
    if (!confirm('Deseja excluir este plantio?')) return
    try {
      const res = await fetch(`${API_BASE}plantings/${id}`, { method: 'DELETE' })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || `status ${res.status}`) }
      setPlantings(list => list.filter(p => p.id !== id))
    } catch (err: any) { alert(err?.message || 'Erro ao excluir plantio') }
  }

  return (
    <div className="properties-page">
      <div className="clients-header">
        <h2>Plantios</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-new" onClick={() => setOpenPlanting(true)}>Novo Plantio</button>
        </div>
      </div>

      <div className="clients-card" style={{ gridColumn: '1 / -1' }}>
        <h3>Plantios</h3>
        <table className="clients-table">
          <thead>
            <tr><th>Talhão</th><th>Cultura</th><th>Variedade</th><th>Plantio</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {plantings.map(pt => (
              <tr key={pt.id}><td>{plots.find(pl => pl.id === pt.plot_id)?.name ?? pt.plot_id}</td><td className="td-name">{pt.culture ?? '--'}</td><td>{pt.variety ?? '--'}</td><td>{pt.planting_date ?? '--'}</td><td><button className="btn-action btn-delete" onClick={() => deletePlanting(pt.id)}>Excluir</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {openPlanting && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Novo Plantio</h3>
            <div className="form-row">
              <label>Talhão</label>
              <DarkSelect name="plot_id" value={plantForm.plot_id} placeholder="Selecione um talhão" options={[{ value: '', label: 'Selecione um talhão' }, ...plots.map(p => ({ value: String(p.id), label: p.name }))]} onChange={handlePlantChange as any} />
            </div>
            <div className="form-row"><label>Cultura</label><input name="culture" value={plantForm.culture} onChange={handlePlantChange} /></div>
            <div className="form-row"><label>Variedade</label><input name="variety" value={plantForm.variety} onChange={handlePlantChange} /></div>
            <div className="form-row"><label>Data plantio</label><input type="date" name="planting_date" value={plantForm.planting_date} onChange={handlePlantChange} /></div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setOpenPlanting(false)}>Cancelar</button><button className="btn-save" onClick={createPlanting} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlantingsPage
