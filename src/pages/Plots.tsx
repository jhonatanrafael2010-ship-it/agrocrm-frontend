import React, { useEffect, useState } from 'react'
import './Properties.css'
import DarkSelect from '../components/DarkSelect'

type Property = { id: number; name: string }
type Plot = { id: number; property_id: number; name: string; area_ha?: number; irrigated?: boolean }

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const PlotsPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [openPlot, setOpenPlot] = useState(false)
  const [plotForm, setPlotForm] = useState({ property_id: '', name: '', area_ha: '', irrigated: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([
      fetch(`${API_BASE}properties`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}plots`).then(r => r.ok ? r.json() : []),
    ]).then(([ps, pls]) => { if (!mounted) return; setProperties(ps || []); setPlots(pls || []) }).catch(console.error)
    return () => { mounted = false }
  }, [])

  function handlePlotChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement
    if (type === 'checkbox') setPlotForm(f => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
    else setPlotForm(f => ({ ...f, [name]: value }))
  }

  async function createPlot() {
    if (!plotForm.property_id || !plotForm.name) return alert('Propriedade e nome são obrigatórios')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}plots`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: Number(plotForm.property_id), name: plotForm.name, area_ha: plotForm.area_ha ? Number(plotForm.area_ha) : undefined, irrigated: plotForm.irrigated }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)
      const created = body.plot || body
      setPlots(p => [created, ...p])
      setOpenPlot(false)
      setPlotForm({ property_id: '', name: '', area_ha: '', irrigated: false })
    } catch (err: any) { alert(err?.message || 'Erro ao criar talhão') } finally { setSubmitting(false) }
  }

  async function deletePlot(id?: number) {
    if (!id) return
    if (!confirm('Deseja excluir este talhão?')) return
    try {
      const res = await fetch(`${API_BASE}plots/${id}`, { method: 'DELETE' })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || `status ${res.status}`) }
      setPlots(list => list.filter(p => p.id !== id))
    } catch (err: any) { alert(err?.message || 'Erro ao excluir talhão') }
  }

  return (
    <div className="properties-page">
      <div className="clients-header">
        <h2>Talhões</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-new" onClick={() => setOpenPlot(true)}>Novo Talhão</button>
        </div>
      </div>

      <div className="clients-card">
        <h3>Talhões</h3>
        <table className="clients-table">
          <thead>
            <tr><th>Fazenda</th><th>Talhão</th><th>Área (ha)</th><th>Irrig.</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {plots.map(pl => (
              <tr key={pl.id}><td>{properties.find(pp => pp.id === pl.property_id)?.name ?? pl.property_id}</td><td className="td-name">{pl.name}</td><td>{pl.area_ha ?? '--'}</td><td>{pl.irrigated ? 'Sim' : '—'}</td><td><button className="btn-action btn-delete" onClick={() => deletePlot(pl.id)}>Excluir</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {openPlot && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Novo Talhão</h3>
            <div className="form-row">
              <label>Propriedade</label>
              <DarkSelect name="property_id" value={plotForm.property_id} placeholder="Selecione uma propriedade" options={[{ value: '', label: 'Selecione uma propriedade' }, ...properties.map(p => ({ value: String(p.id), label: p.name }))]} onChange={handlePlotChange as any} />
            </div>
            <div className="form-row"><label>Nome</label><input name="name" value={plotForm.name} onChange={handlePlotChange} /></div>
            <div className="form-row"><label>Área (ha)</label><input name="area_ha" value={plotForm.area_ha} onChange={handlePlotChange} /></div>
            <div className="form-row"><label><input type="checkbox" name="irrigated" checked={plotForm.irrigated} onChange={handlePlotChange as any} /> Irrigado</label></div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setOpenPlot(false)}>Cancelar</button><button className="btn-save" onClick={createPlot} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlotsPage
