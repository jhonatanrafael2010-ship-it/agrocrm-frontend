import React, { useEffect, useState } from 'react'
import './Visits.css'
import DarkSelect from '../components/DarkSelect'

type Visit = {
  id: number
  date?: string
  client_id?: number
  property_id?: number
  plot_id?: number
  checklist?: string
  diagnosis?: string
  recommendation?: string
}
type Client = { id: number; name: string }
type Property = { id: number; name: string }
type Plot = { id: number; name: string }

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const VisitsPage: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // filters (default: last 5 years until today)
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
  const fiveYearsISO = fiveYearsAgo.toISOString().slice(0, 10)
  const [filterStart, setFilterStart] = useState<string>(fiveYearsISO)
  const [filterEnd, setFilterEnd] = useState<string>(todayISO)
  const [filterClient, setFilterClient] = useState('')

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
  date: '',
  client_id: '',
  property_id: '',
  plot_id: '',
  recommendation: '',
  quantidade: 1,
  intervalo: 'dia',
  })
  const [viewOpen, setViewOpen] = useState(false)
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}visits`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}clients`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}properties`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}plots`).then(r => r.ok ? r.json() : []),
    ])
      .then(([vs, cs, ps, pls]) => {
        if (!mounted) return
        setVisits(vs || [])
        setClients(cs || [])
        setProperties(ps || [])
        setPlots(pls || [])
      })
      .catch(err => { console.error(err); setError('Erro ao carregar acompanhamentos') })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
  setForm(f => ({ ...f, [name]: name === 'quantidade' ? Number(value) : value }))
  }

  function formatDateBR(dateStr?: string) {
    if (!dateStr) return '--';
    // Espera YYYY-MM-DD
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return String(dateStr);
  }

  function openView(v: Visit) {
    setActiveVisit(v)
    setViewOpen(true)
  }

  async function handleSave() {
    if (!form.date || !form.client_id || !form.property_id || !form.plot_id) return alert('Data, cliente, propriedade e talhão são obrigatórios')
    if (!form.quantidade || form.quantidade < 1) return alert('Quantidade deve ser pelo menos 1')
    setSubmitting(true)
    try {
      const visitasCriadas: Visit[] = [];
      // Manipula a data como string para evitar problemas de fuso horário
      let dataBaseStr = form.date;
      for (let i = 0; i < form.quantidade; i++) {
        const res = await fetch(`${API_BASE}visits`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dataBaseStr,
            client_id: Number(form.client_id),
            property_id: Number(form.property_id),
            plot_id: Number(form.plot_id),
            recommendation: form.recommendation,
            intervalo: form.intervalo,
          })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created: Visit = body.visit || body;
        visitasCriadas.push(created);
        // Avança a data conforme intervalo
        let [yyyy, mm, dd] = dataBaseStr.split('-').map(Number);
        const dateObj = new Date(yyyy, mm - 1, dd);
        if (form.intervalo === 'dia') dateObj.setDate(dateObj.getDate() + 1);
        else if (form.intervalo === 'semana') dateObj.setDate(dateObj.getDate() + 7);
        else if (form.intervalo === 'mes') dateObj.setMonth(dateObj.getMonth() + 1);
        // Gera nova string no formato YYYY-MM-DD
        dataBaseStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }
      setVisits(v => [...visitasCriadas, ...v])
      setOpen(false)
  setForm({ date: '', client_id: '', property_id: '', plot_id: '', recommendation: '', quantidade: 1, intervalo: 'dia' })
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar acompanhamento')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Deseja excluir esta visita?')) return
    try {
      const res = await fetch(`${API_BASE}visits/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `status ${res.status}`)
      }
      setVisits(list => list.filter(v => v.id !== id))
    } catch (err: any) {
      console.error('delete visit err', err)
      alert(err?.message || 'Erro ao excluir visita')
    }
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h2>Acompanhamentos</h2>
        <button className="btn-new" onClick={() => setOpen(true)}>Nova Visita</button>
      </div>

      {/* Improved filter bar above table */}
      <div className="visits-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, background: 'rgba(20,32,40,0.9)', borderRadius: 8, padding: '12px 18px', boxShadow: '0 2px 8px #0002' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 110 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Início</label>
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} style={{ background: '#16222a', color: '#e2e8f0', border: '1px solid #253544', borderRadius: 5, padding: '4px 8px', fontSize: 15 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 110 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Fim</label>
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={{ background: '#16222a', color: '#e2e8f0', border: '1px solid #253544', borderRadius: 5, padding: '4px 8px', fontSize: 15 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Cliente</label>
          <DarkSelect name="filterClient" value={filterClient} options={[{ value: '', label: 'Todos' }, ...clients.map(c => ({ value: String(c.id), label: c.name }))]} onChange={(e: any) => setFilterClient(e.target.value)} placeholder="Todos" />
        </div>
        <button className="btn-new" style={{ marginLeft: 12, height: 36, fontWeight: 500, fontSize: 15, background: '#1db954', color: '#fff', borderRadius: 6, border: 'none', padding: '0 18px', cursor: 'pointer' }} onClick={() => { setFilterStart(''); setFilterEnd(''); setFilterClient('') }}>Limpar filtros</button>
      </div>

      <div className="clients-card">
        {loading ? (
          <div style={{ padding: 20, color: '#9fb3b6' }}>Carregando...</div>
        ) : error ? (
          <div style={{ padding: 20, color: '#f88' }}>{error}</div>
        ) : (
          <table className="clients-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Fazenda</th>
                <th>Talhão</th>
                <th>Cultura</th>
                <th>Recomendação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(
                // apply filters and sort by date ascending (nearest first)
                visits
                  .filter(v => {
                    if (filterClient && String(v.client_id) !== filterClient) return false
                    if (filterStart && v.date && v.date < filterStart) return false
                    if (filterEnd && v.date && v.date > filterEnd) return false
                    return true
                  })
                  .sort((a, b) => {
                    if (!a.date) return 1
                    if (!b.date) return -1
                    const ta = new Date(a.date).getTime()
                    const tb = new Date(b.date).getTime()
                    return ta - tb
                  })
                  .map(v => (
                    <tr key={v.id}>
                      <td>{formatDateBR(v.date)}</td>
                      <td>{clients.find(c => c.id === v.client_id)?.name ?? v.client_id}</td>
                      <td>{properties.find(p => p.id === v.property_id)?.name ?? v.property_id}</td>
                      <td>{plots.find(p => p.id === v.plot_id)?.name ?? v.plot_id}</td>
                      <td>{'--'}</td>
                      <td>{v.recommendation ?? '--'}</td>
                      <td>
                        <button className="btn-action" onClick={() => openView(v)}>Ver</button>
                        <button className="btn-action btn-delete" onClick={() => handleDelete(v.id)} style={{ marginLeft: 8 }}>Excluir</button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}
      </div>


      {/* View modal */}
      {viewOpen && activeVisit && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Visita</h3>
            <div className="form-row"><label>Data</label><div>{formatDateBR(activeVisit.date)}</div></div>
            <div className="form-row"><label>Cliente</label><div>{clients.find(c => c.id === activeVisit.client_id)?.name ?? activeVisit.client_id}</div></div>
            <div className="form-row"><label>Fazenda</label><div>{properties.find(p => p.id === activeVisit.property_id)?.name ?? activeVisit.property_id}</div></div>
            <div className="form-row"><label>Talhão</label><div>{plots.find(p => p.id === activeVisit.plot_id)?.name ?? activeVisit.plot_id}</div></div>
            <div className="form-row"><label>Recomendação</label><div>{activeVisit.recommendation ?? '--'}</div></div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setViewOpen(false); setActiveVisit(null) }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Nova Visita</h3>
            <div className="form-row"><label>Data</label><input name="date" type="date" value={form.date} onChange={handleChange} /></div>
            <div className="form-row"><label>Quantidade</label><input name="quantidade" type="number" min={1} value={form.quantidade} onChange={handleChange} /></div>
            <div className="form-row"><label>Intervalo</label>
              <select name="intervalo" value={form.intervalo} onChange={handleChange} style={{ background: '#16222a', color: '#e2e8f0', border: '1px solid #253544', borderRadius: 5, padding: '4px 8px', fontSize: 15 }}>
                <option value="dia">Por dia</option>
                <option value="semana">Por semana</option>
                <option value="mes">Por mês</option>
              </select>
            </div>
            <div className="form-row">
              <label>Cliente</label>
              <DarkSelect name="client_id" value={form.client_id} placeholder="Selecione cliente" options={[{ value: '', label: 'Selecione cliente' }, ...clients.map(c => ({ value: String(c.id), label: c.name }))]} onChange={handleChange as any} />
            </div>
            <div className="form-row">
              <label>Propriedade</label>
              <DarkSelect name="property_id" value={form.property_id} placeholder="Selecione propriedade" options={[{ value: '', label: 'Selecione propriedade' }, ...properties.map(p => ({ value: String(p.id), label: p.name }))]} onChange={handleChange as any} />
            </div>
            <div className="form-row">
              <label>Talhão</label>
              <DarkSelect name="plot_id" value={form.plot_id} placeholder="Selecione talhão" options={[{ value: '', label: 'Selecione talhão' }, ...plots.map(p => ({ value: String(p.id), label: p.name }))]} onChange={handleChange as any} />
            </div>
            <div className="form-row"><label>Recomendação</label><textarea name="recommendation" value={form.recommendation} onChange={handleChange} /></div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-save" onClick={handleSave} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VisitsPage
