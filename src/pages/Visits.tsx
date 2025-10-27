import React, { useEffect, useState } from 'react'
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

  // filtros padrão: últimos 5 anos
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
  const fiveYearsISO = fiveYearsAgo.toISOString().slice(0, 10)

  const [filterStart, setFilterStart] = useState<string>(fiveYearsISO)
  const [filterEnd, setFilterEnd] = useState<string>(todayISO)
  const [filterClient, setFilterClient] = useState('')
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
      .catch(err => {
        console.error(err)
        setError('Erro ao carregar acompanhamentos')
      })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])

  function formatDateBR(dateStr?: string) {
    if (!dateStr) return '--'
    const parts = String(dateStr).split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return String(dateStr)
  }

  function openView(v: Visit) {
    setActiveVisit(v)
    setViewOpen(true)
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
      console.error('Erro ao excluir visita', err)
      alert(err?.message || 'Erro ao excluir visita')
    }
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h2>Acompanhamentos</h2>
      </div>

      {/* Filtros */}
      <div
        className="visits-filter-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 18,
          background: 'rgba(20,32,40,0.9)',
          borderRadius: 8,
          padding: '12px 18px',
          boxShadow: '0 2px 8px #0002',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 110 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Início</label>
          <input
            type="date"
            value={filterStart}
            onChange={e => setFilterStart(e.target.value)}
            style={{
              background: '#16222a',
              color: '#e2e8f0',
              border: '1px solid #253544',
              borderRadius: 5,
              padding: '4px 8px',
              fontSize: 15,
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 110 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Fim</label>
          <input
            type="date"
            value={filterEnd}
            onChange={e => setFilterEnd(e.target.value)}
            style={{
              background: '#16222a',
              color: '#e2e8f0',
              border: '1px solid #253544',
              borderRadius: 5,
              padding: '4px 8px',
              fontSize: 15,
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
          <label style={{ fontSize: 13, color: '#9fb3b6', marginBottom: 2 }}>Cliente</label>
          <DarkSelect
            name="filterClient"
            value={filterClient}
            options={[{ value: '', label: 'Todos' }, ...clients.map(c => ({ value: String(c.id), label: c.name }))]}
            onChange={(e: any) => setFilterClient(e.target.value)}
            placeholder="Todos"
          />
        </div>

        <button
          className="btn-new"
          style={{
            marginLeft: 12,
            height: 36,
            fontWeight: 500,
            fontSize: 15,
            background: '#1db954',
            color: '#fff',
            borderRadius: 6,
            border: 'none',
            padding: '0 18px',
            cursor: 'pointer',
          }}
          onClick={() => {
            setFilterStart(fiveYearsISO)
            setFilterEnd(todayISO)
            setFilterClient('')
          }}
        >
          Limpar filtros
        </button>
      </div>

      {/* Tabela de visitas */}
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
                <th>Recomendação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visits
                .filter(v => {
                  if (filterClient && String(v.client_id) !== filterClient) return false
                  if (filterStart && v.date && v.date < filterStart) return false
                  if (filterEnd && v.date && v.date > filterEnd) return false
                  return true
                })
                .sort((a, b) => {
                  if (!a.date) return 1
                  if (!b.date) return -1
                  return new Date(a.date).getTime() - new Date(b.date).getTime()
                })
                .map(v => (
                  <tr key={v.id}>
                    <td>{formatDateBR(v.date)}</td>
                    <td>{clients.find(c => c.id === v.client_id)?.name ?? v.client_id}</td>
                    <td>{properties.find(p => p.id === v.property_id)?.name ?? v.property_id}</td>
                    <td>{plots.find(p => p.id === v.plot_id)?.name ?? v.plot_id}</td>
                    <td>{v.recommendation ?? '--'}</td>
                    <td>
                      <button className="btn-action" onClick={() => openView(v)}>Ver</button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDelete(v.id)}
                        style={{ marginLeft: 8 }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de visualização */}
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
    </div>
  )
}

export default VisitsPage
