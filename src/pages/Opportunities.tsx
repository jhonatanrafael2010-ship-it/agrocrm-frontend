import React, { useEffect, useState } from 'react'
import './Opportunities.css'
import DarkSelect from '../components/DarkSelect'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

type Opportunity = {
  id: number
  client_id?: number
  title?: string
  estimated_value?: number
  stage?: string
}
type Client = { id: number; name: string }

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const STAGES = [
  { key: 'prospecção', label: 'Prospecção' },
  { key: 'cotação', label: 'Cotação' },
  { key: 'negociação', label: 'Negociação' },
  { key: 'fechadas', label: 'Fechadas' },
  { key: 'perdidas', label: 'Perdidas' },
]

const OpportunitiesPage: React.FC = () => {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ client_id: '', title: '', estimated_value: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}opportunities`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}clients`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ops, cs]) => {
        if (!mounted) return
        setOpps(ops || [])
        setClients(cs || [])
      })
      .catch(err => { console.error(err); setError('Erro ao carregar oportunidades') })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])

  function clientName(id?: number) {
    return clients.find(c => c.id === id)?.name ?? '--'
  }

  async function changeStageRemote(opId: number, newStage: string) {
    try {
      const res = await fetch(`${API_BASE}opportunities/${opId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)
      const updated = body.opportunity || body
      setOpps(list => list.map(it => it.id === updated.id ? updated : it))
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar oportunidade')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleCreate() {
    if (!form.client_id || !form.title) return alert('Cliente e título são obrigatórios')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}opportunities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: Number(form.client_id), title: form.title, estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)
      const created = body.opportunity || body
      setOpps(o => [created, ...o])
      setOpen(false)
      setForm({ client_id: '', title: '', estimated_value: '' })
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar oportunidade')
    } finally { setSubmitting(false) }
  }

  async function deleteOpportunity(id?: number) {
    if (!id) return
    if (!confirm('Deseja excluir esta oportunidade?')) return
    try {
      const res = await fetch(`${API_BASE}opportunities/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `status ${res.status}`)
      }
      setOpps(list => list.filter(o => o.id !== id))
    } catch (err: any) {
      console.error('delete opportunity err', err)
      alert(err?.message || 'Erro ao excluir oportunidade')
    }
  }

  const grouped = STAGES.reduce((acc: Record<string, Opportunity[]>, s) => {
    acc[s.key] = opps.filter(o => (o.stage || 'prospecção').toLowerCase() === s.key)
    return acc
  }, {} as Record<string, Opportunity[]>)

  function onDragEnd(result: any) {
    const { source, destination, draggableId } = result
    if (!destination) return
    const fromStage = source.droppableId
    const toStage = destination.droppableId
    if (fromStage === toStage) return

    const opId = Number(draggableId)
    // optimistic update
    setOpps(list => list.map(it => it.id === opId ? { ...it, stage: toStage } : it))
    changeStageRemote(opId, toStage)
  }

  return (
    <div className="opportunities-page">
      <div className="clients-header">
        <h2>Oportunidades</h2>
        <button className="btn-new" onClick={() => setOpen(true)}>Nova Oportunidade</button>
      </div>

      {loading ? <div style={{ padding: 20, color: '#9fb3b6' }}>Carregando...</div> : error ? <div style={{ padding:20, color:'#f88' }}>{error}</div> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="kanban">
            {STAGES.map(s => (
              <Droppable droppableId={s.key} key={s.key}>
                {(provided: any) => (
                  <div className="kanban-col" ref={provided.innerRef} {...provided.droppableProps}>
                    <h4>{s.label}</h4>
                    <div className="kanban-list">
                      {(grouped[s.key] || []).map((op, idx) => (
                        <Draggable key={op.id} draggableId={`${op.id}`} index={idx}>
                          {(prov: any) => (
                            <div className="kanban-card" ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                              <div className="card-title">{op.title}</div>
                              <div className="card-sub">{clientName(op.client_id)}</div>
                              <div className="card-value">{op.estimated_value ? `R$ ${op.estimated_value}` : ''}</div>
                              <div className="card-actions">
                                {s.key !== 'fechadas' && <button className="btn-primary" onClick={() => changeStageRemote(op.id, 'fechadas')}>Fechar</button>}
                                <button className="btn-action btn-delete" onClick={() => deleteOpportunity(op.id)} style={{ marginLeft: 8 }}>Excluir</button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nova Oportunidade</h3>
            <div className="form-row"><label>Cliente</label>
              <DarkSelect name="client_id" value={form.client_id} placeholder="Selecione cliente" options={[{ value: '', label: 'Selecione cliente' }, ...clients.map(c => ({ value: String(c.id), label: c.name }))]} onChange={handleChange as any} />
            </div>
            <div className="form-row"><label>Título</label><input name="title" value={form.title} onChange={handleChange} /></div>
            <div className="form-row"><label>Valor estimado</label><input name="estimated_value" value={form.estimated_value} onChange={handleChange} placeholder="0" /></div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-save" onClick={handleCreate} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OpportunitiesPage
