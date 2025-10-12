
import React from 'react'
import DarkSelect from '../components/DarkSelect'
import trashIcon from '../assets/trash.svg'
import pencilIcon from '../assets/pencil.svg'

type Client = { id: number; name: string }
type Property = { id: number; client_id: number; name: string; city_state?: string; area_ha?: number }
type Plot = { id: number; property_id: number; name: string; area_ha?: number; irrigated?: boolean }
type Planting = { id: number; plot_id: number; culture?: string; variety?: string; planting_date?: string }

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const PropertiesTalhoesPage: React.FC = () => {
  // States for all entities
  const [clients, setClients] = React.useState<Client[]>([])
  const [properties, setProperties] = React.useState<Property[]>([])
  const [plots, setPlots] = React.useState<Plot[]>([])
  const [plantings, setPlantings] = React.useState<Planting[]>([])

  // Loading and error
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Modals
  const [openProp, setOpenProp] = React.useState(false)
  const [openPlot, setOpenPlot] = React.useState(false)
  const [openPlanting, setOpenPlanting] = React.useState(false)
  const [editingProp, setEditingProp] = React.useState<Property | null>(null)
  const [editingPlot, setEditingPlot] = React.useState<Plot | null>(null)
  const [editingPlanting, setEditingPlanting] = React.useState<Planting | null>(null)

  // Forms
  const [propForm, setPropForm] = React.useState({ client_id: '', name: '', city_state: '', area_ha: '' })
  const [plotForm, setPlotForm] = React.useState({ property_id: '', name: '', area_ha: '', irrigated: false })
  const [plantForm, setPlantForm] = React.useState({ plot_id: '', culture: '', variety: '', planting_date: '' })

  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}clients`).then(r => r.json()),
      fetch(`${API_BASE}properties`).then(r => r.json()),
      fetch(`${API_BASE}plots`).then(r => r.json()),
      fetch(`${API_BASE}plantings`).then(r => r.json()),
    ])
      .then(([cs, ps, pls, pts]) => {
        if (!mounted) return
        setClients(cs || [])
        setProperties(ps || [])
        setPlots(pls || [])
        setPlantings(pts || [])
      })
      .catch(err => { console.error(err); setError('Erro ao carregar dados') })
      .finally(() => setLoading(false))
    return () => { mounted = false }
  }, [])

  // Handlers
  function handlePropChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setPropForm(f => ({ ...f, [name]: value }))
  }
  function handlePlotChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement
    if (type === 'checkbox') setPlotForm(f => ({ ...f, [name]: (e.target as HTMLInputElement).checked }))
    else setPlotForm(f => ({ ...f, [name]: value }))
  }
  function handlePlantChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setPlantForm(f => ({ ...f, [name]: value }))
  }

  // Create functions
  async function saveProperty() {
    if (!propForm.client_id || !propForm.name) return alert('Cliente e nome são obrigatórios')
    setSubmitting(true)
    try {
      let res, body
      if (editingProp) {
        res = await fetch(`${API_BASE}properties/${editingProp.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: Number(propForm.client_id), name: propForm.name, city_state: propForm.city_state || undefined, area_ha: propForm.area_ha ? Number(propForm.area_ha) : undefined })
        })
        body = await res.json()
        if (!res.ok) throw new Error(body.message || `status ${res.status}`)
        const updated = body.property || body
        setProperties(p => p.map(pr => pr.id === updated.id ? updated : pr))
      } else {
        res = await fetch(`${API_BASE}properties`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: Number(propForm.client_id), name: propForm.name, city_state: propForm.city_state || undefined, area_ha: propForm.area_ha ? Number(propForm.area_ha) : undefined })
        })
        body = await res.json()
        if (!res.ok) throw new Error(body.message || `status ${res.status}`)
        const created = body.property || body
        setProperties(p => [created, ...p])
      }
      setOpenProp(false)
      setEditingProp(null)
      setPropForm({ client_id: '', name: '', city_state: '', area_ha: '' })
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar propriedade')
    } finally { setSubmitting(false) }
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

  // Delete functions
  async function deleteProperty(id?: number) {
    if (!id) return
    if (!confirm('Deseja excluir esta propriedade?')) return
    try {
      const res = await fetch(`${API_BASE}properties/${id}`, { method: 'DELETE' })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || `status ${res.status}`) }
      setProperties(list => list.filter(p => p.id !== id))
    } catch (err: any) { alert(err?.message || 'Erro ao excluir propriedade') }
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
    <div>
      <div style={{ flex: 1, padding: '0 32px' }}>
        <div className="clients-header">
          <h2>Propriedades & Talhões</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-new" onClick={() => setOpenProp(true)}>Nova Propriedade</button>
            <button className="btn-new" onClick={() => setOpenPlot(true)}>Novo Talhão</button>
            <button className="btn-new" onClick={() => setOpenPlanting(true)}>Novo Plantio</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="clients-card">
            <h3>Propriedades</h3>
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Propriedade</th>
                  <th>Cidade/UF</th>
                  <th>Área (ha)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 20, color: '#9fb3b6' }}>Carregando...</td></tr>
                ) : error ? (
                  <tr><td colSpan={5} style={{ padding: 20, color: '#f88' }}>{error}</td></tr>
                ) : properties.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 20, color: '#9fb3b6' }}>Nenhuma propriedade cadastrada</td></tr>
                ) : (
                  properties.map(p => (
                    <tr key={p.id}>
                      <td>{clients.find(c => c.id === p.client_id)?.name ?? p.client_id}</td>
                      <td className="td-name">{p.name}</td>
                      <td>{p.city_state ?? '--'}</td>
                      <td>{p.area_ha ?? '--'}</td>
                      <td>
                        <button className="btn-action btn-edit" title="Editar" style={{ marginRight: 8, background: 'none', border: 'none', padding: '4px 6px' }} onClick={() => {
                          setOpenProp(true)
                          setEditingProp(p)
                          setPropForm({
                            client_id: String(p.client_id),
                            name: p.name || '',
                            city_state: p.city_state || '',
                            area_ha: p.area_ha ? String(p.area_ha) : ''
                          })
                        }}>
                          <img src={pencilIcon} alt="Editar" style={{ width: 20, height: 20, verticalAlign: 'middle', filter: 'drop-shadow(0 0 2px #1976d2)' }} />
                        </button>
                        <button className="btn-action btn-delete" onClick={() => deleteProperty(p.id)} title="Excluir" style={{ background: 'none', border: 'none', padding: '4px 6px' }}>
                          <img src={trashIcon} alt="Excluir" style={{ width: 20, height: 20, verticalAlign: 'middle', filter: 'drop-shadow(0 0 2px #d32f2f)' }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="clients-card">
            <h3>Talhões</h3>
            <table className="clients-table">
              <thead>
                <tr><th>Fazenda</th><th>Talhão</th><th>Área (ha)</th><th>Irrig.</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {plots.map(pl => (
                  <tr key={pl.id}><td>{properties.find(pp => pp.id === pl.property_id)?.name ?? pl.property_id}</td><td className="td-name">{pl.name}</td><td>{pl.area_ha ?? '--'}</td><td>{pl.irrigated ? 'Sim' : '—'}</td><td><button className="btn-action btn-delete" onClick={() => deletePlot(pl.id)} title="Excluir"><img src={trashIcon} alt="Excluir" style={{ width: 20, height: 20, verticalAlign: 'middle' }} /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="clients-card" style={{ marginTop: 16 }}>
          <h3>Plantios</h3>
          <table className="clients-table">
            <thead>
              <tr><th>Talhão</th><th>Cultura</th><th>Variedade</th><th>Plantio</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {plantings.map(pt => (
                <tr key={pt.id}><td>{plots.find(pl => pl.id === pt.plot_id)?.name ?? pt.plot_id}</td><td className="td-name">{pt.culture ?? '--'}</td><td>{pt.variety ?? '--'}</td><td>{pt.planting_date ?? '--'}</td><td><button className="btn-action btn-delete" onClick={() => deletePlanting(pt.id)} title="Excluir"><img src={trashIcon} alt="Excluir" style={{ width: 20, height: 20, verticalAlign: 'middle' }} /></button></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        {openProp && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>{editingProp ? 'Editar Propriedade' : 'Nova Propriedade'}</h3>
              <div className="form-row">
                <label>Cliente</label>
                <DarkSelect name="client_id" value={propForm.client_id} placeholder="Selecione um cliente" options={[{ value: '', label: 'Selecione um cliente' }, ...[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: String(c.id), label: c.name }))]} onChange={handlePropChange as any} />
              </div>
              <div className="form-row"><label>Nome</label><input name="name" value={propForm.name} onChange={handlePropChange} /></div>
              <div className="form-row"><label>Cidade/UF</label><input name="city_state" value={propForm.city_state} onChange={handlePropChange} /></div>
              <div className="form-row"><label>Área (ha)</label><input name="area_ha" value={propForm.area_ha} onChange={handlePropChange} /></div>
              <div className="modal-actions"><button className="btn-cancel" onClick={() => { setOpenProp(false); setEditingProp(null); }}>Cancelar</button><button className="btn-save" onClick={saveProperty} disabled={submitting}>{submitting ? (editingProp ? 'Salvando...' : 'Salvando...') : (editingProp ? 'Salvar alterações' : 'Salvar')}</button></div>
            </div>
          </div>
        )}
        {openPlot && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Novo Talhão</h3>
              <div className="form-row">
                <label>Propriedade</label>
                <DarkSelect name="property_id" value={plotForm.property_id} placeholder="Selecione uma propriedade" options={[{ value: '', label: 'Selecione uma propriedade' }, ...[...properties].sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: String(p.id), label: p.name }))]} onChange={handlePlotChange as any} />
              </div>
              <div className="form-row"><label>Nome</label><input name="name" value={plotForm.name} onChange={handlePlotChange} /></div>
              <div className="form-row"><label>Área (ha)</label><input name="area_ha" value={plotForm.area_ha} onChange={handlePlotChange} /></div>
              <div className="form-row"><label><input type="checkbox" name="irrigated" checked={plotForm.irrigated} onChange={handlePlotChange as any} /> Irrigado</label></div>
              <div className="modal-actions"><button className="btn-cancel" onClick={() => setOpenPlot(false)}>Cancelar</button><button className="btn-save" onClick={createPlot} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button></div>
            </div>
          </div>
        )}
        {openPlanting && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>Novo Plantio</h3>
              <div className="form-row">
                <label>Talhão</label>
                <DarkSelect name="plot_id" value={plantForm.plot_id} placeholder="Selecione um talhão" options={[{ value: '', label: 'Selecione um talhão' }, ...[...plots].sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: String(p.id), label: p.name }))]} onChange={handlePlantChange as any} />
              </div>
              <div className="form-row"><label>Cultura</label><input name="culture" value={plantForm.culture} onChange={handlePlantChange} /></div>
              <div className="form-row"><label>Variedade</label><input name="variety" value={plantForm.variety} onChange={handlePlantChange} /></div>
              <div className="form-row"><label>Data plantio</label><input type="date" name="planting_date" value={plantForm.planting_date} onChange={handlePlantChange} /></div>
              <div className="modal-actions"><button className="btn-cancel" onClick={() => setOpenPlanting(false)}>Cancelar</button><button className="btn-save" onClick={createPlanting} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertiesTalhoesPage

