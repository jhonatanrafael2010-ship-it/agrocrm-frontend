import React, { useEffect, useState } from 'react'


const API_BASE = import.meta.env.VITE_API_URL || '/api/'

type Client = { id: number; name: string }
type Property = { id: number; name: string; client_id?: number }
type Plot = { id: number; name: string }
type Planting = { id: number; culture?: string }
type Visit = { id: number; date?: string; client_id?: number; property_id?: number }
type Opportunity = { id: number; title?: string; stage?: string; estimated_value?: number; created_at?: string; client_id?: number }

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [opps, setOpps] = useState<Opportunity[]>([])

  // date filters
  const today = new Date()
  const defaultEnd = formatDate(today)
  const defaultStart = formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000))
  const [startDate, setStartDate] = useState<string>(defaultStart)
  const [endDate, setEndDate] = useState<string>(defaultEnd)

  // lookup maps
  const [clientsMap, setClientsMap] = useState<Record<number, string>>({})
  const [propsMap, setPropsMap] = useState<Record<number, string>>({})

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}clients`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}properties`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}plots`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}plantings`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}visits`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}opportunities`).then(r => r.ok ? r.json() : []),
    ])
      .then(([cs, ps, pls, pts, vs, os]) => {
        if (!mounted) return
        setClients(cs || [])
        setProperties(ps || [])
        setPlots(pls || [])
        setPlantings(pts || [])
        setVisits((vs || []).slice(0, 12))
        setOpps(os || [])

        // build maps
        const cMap: Record<number, string> = {}
        ;(cs || []).forEach((c: any) => { cMap[c.id] = c.name })
        setClientsMap(cMap)
        const pMap: Record<number, string> = {}
        ;(ps || []).forEach((p: any) => { pMap[p.id] = p.name })
        setPropsMap(pMap)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])


  // filter opportunities by selected date range
  function inRange(dateStr?: string) {
    if (!dateStr) return false
    const d = dateStr.slice(0, 10)
    return d >= startDate && d <= endDate
  }

  const filteredOpps = opps.filter(o => inRange(o.created_at))
  const closedOpps = filteredOpps.filter(o => (o.stage || '').toLowerCase() === 'fechadas')
  const totalSales = closedOpps.reduce((s, o) => s + (o.estimated_value || 0), 0)

  // build daily sums for the range
  const days: string[] = []
  const dailySums: number[] = []
  {
    const sDate = new Date(startDate)
    const eDate = new Date(endDate)
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(new Date(d))
      days.push(ds)
      const sum = opps.reduce((acc, o) => {
        if (!o.created_at) return acc
        const odate = o.created_at.slice(0, 10)
        if (odate === ds && (o.stage || '').toLowerCase() === 'fechadas') return acc + (o.estimated_value || 0)
        return acc
      }, 0)
      dailySums.push(sum)
    }
  }

  const maxSum = Math.max(...dailySums, 1)
  // tooltip state for chart
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  function fmtCurrency(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="dashboard-page">
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>
      {loading ? <div style={{ color: '#9fb3b6' }}>Carregando...</div> : (
        <>
          <div className="cards">
            <div className="card card-client"><span className="card-icon">👤</span><div className="card-title">Clientes</div><div className="card-value">{clients.length}</div></div>
            <div className="card card-property"><span className="card-icon">🏠</span><div className="card-title">Propriedades</div><div className="card-value">{properties.length}</div></div>
            <div className="card card-plot"><span className="card-icon">🌱</span><div className="card-title">Talhões</div><div className="card-value">{plots.length}</div></div>
            <div className="card card-planting"><span className="card-icon">🌾</span><div className="card-title">Plantios</div><div className="card-value">{plantings.length}</div></div>
            <div className="card card-visit"><span className="card-icon">📝</span><div className="card-title">Acompanhamentos</div><div className="card-value">{visits.length}</div></div>
            <div className="card card-opportunity"><span className="card-icon">💼</span><div className="card-title">Oportunidades</div><div className="card-value">{opps.length}</div></div>
          </div>

          <div className="dashboard-section dashboard-filters" style={{ marginBottom: 0 }}>
            <div className="clients-card" style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 0 }}>
              <div className="date-filters" style={{ display: 'flex', gap: 16 }}>
                <label>De <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
                <label>Até <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
              </div>
              <div className="sales-summary" style={{ marginLeft: 'auto' }}>Vendas (fechadas): <strong>R$ {totalSales.toFixed(2)}</strong></div>
            </div>
          </div>

          <div className="dashboard-section dashboard-charts">
            <div className="chart-card">
              <h3>Vendas por dia</h3>
              <svg width="100%" height="100" viewBox={`0 0 ${days.length * 30} 100`} preserveAspectRatio="xMidYMid meet">
                {dailySums.map((v, i) => {
                  const barH = Math.round((v / maxSum) * 60)
                  const x = i * 30 + 10
                  const y = 80 - barH
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={18} height={barH} fill="url(#barGradient)" rx="5"
                        onMouseEnter={(ev: any) => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${days[i]}: ${fmtCurrency(v)}` })}
                        onMouseMove={(ev: any) => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${days[i]}: ${fmtCurrency(v)}` })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 6px #2dd36f44)' }}
                      />
                      <text x={x + 9} y={96} fontSize={10} fill="#9fb3b6" textAnchor="middle">{days[i].slice(5)}</text>
                    </g>
                  )
                })}
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd36f" />
                    <stop offset="100%" stopColor="#0a3d2c" />
                  </linearGradient>
                </defs>
              </svg>
              {tooltip && (
                <div className="chart-tooltip" style={{ left: tooltip.x - 240, top: tooltip.y - 60 }}>{tooltip.text}</div>
              )}
            </div>

            <div className="clients-card dashboard-visits">
              <h3>Últimas Visitas</h3>
              <table className="clients-table">
                <thead>
                  <tr><th>Data</th><th>Cliente</th><th>Propriedade</th></tr>
                </thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v.id}>
                      <td>{v.date ?? '--'}</td>
                      <td><span className="visit-avatar">👤</span> {clientsMap[v.client_id as number] ?? v.client_id}</td>
                      <td>{propsMap[v.property_id as number] ?? v.property_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-section dashboard-opps">
            <div className="clients-card">
              <h3>Últimas Oportunidades</h3>
              <ul className="recent-list">
                {filteredOpps.slice(0, 12).map(o => (
                  <li key={o.id}>
                    <strong>{o.title ?? 'Sem título'}</strong>
                    {o.stage && <span className={`badge badge-${o.stage.toLowerCase()}`}>{o.stage}</span>}
                    <span className="muted">R$ {(o.estimated_value||0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
