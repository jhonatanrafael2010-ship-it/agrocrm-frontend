import React, { useEffect, useState } from 'react'
import './Clients.css'

type Client = {
  id: number
  name: string
  document?: string
  segment: string
  vendor?: string
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/'

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', document: '', segment: '', vendor: '' })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch(`${API_BASE}clients`)
      .then(async res => {
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data = await res.json()
        if (mounted) setClients(data)
      })
      .catch(err => {
        console.error('fetch clients err', err)
        setError('Erro ao carregar clientes')
      })
      .finally(() => setLoading(false))

    return () => { mounted = false }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Nome é obrigatório')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || `status ${res.status}`)

      // backend returns {message, client}
      const created: Client = body.client || body
      setClients(c => [created, ...c])
      setOpen(false)
      setForm({ name: '', document: '', segment: '', vendor: '' })
    } catch (err: any) {
      console.error('create client err', err)
      alert(err?.message || 'Erro ao criar cliente')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    try {
      const res = await fetch(`${API_BASE}clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `status ${res.status}`)
      }
      setClients(list => list.filter(c => c.id !== id))
    } catch (err: any) {
      console.error('delete client err', err)
      alert(err?.message || 'Erro ao excluir cliente')
    }
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h2>Clientes</h2>
        <button className="btn-new" onClick={() => setOpen(true)}>Novo Cliente</button>
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
                <th>Nome</th>
                <th>Documento</th>
                <th>Segmento</th>
                <th>Vendedor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td className="td-name">{c.name}</td>
                  <td>{c.document ?? '--'}</td>
                  <td>{c.segment ?? '--'}</td>
                  <td>{c.vendor ?? '--'}</td>
                  <td>
                    <button className="btn-action btn-delete" onClick={() => handleDelete(c.id)} style={{ marginLeft: 8 }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Novo Cliente</h3>

            <div className="form-row">
              <label>Nome</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Ex.: Fazenda Boa Vista S/A" />
            </div>

            <div className="form-row">
              <label>Documento</label>
              <input name="document" value={form.document} onChange={handleChange} placeholder="CPF/CNPJ" />
            </div>

            <div className="form-row">
              <label>Segmento</label>
              <input name="segment" value={form.segment} onChange={handleChange} placeholder="Agronegócio" />
            </div>

            <div className="form-row">
              <label>Vendedor</label>
              <input name="vendor" value={form.vendor} onChange={handleChange} placeholder="Nome do vendedor responsável" />
            </div>

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

export default Clients
