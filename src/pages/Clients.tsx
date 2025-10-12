import React, { useEffect, useState } from 'react'
import pencilIcon from '../assets/pencil.svg'
import trashIcon from '../assets/trash.svg'
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
  const [editing, setEditing] = useState<Client | null>(null)
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
      let res, body
      if (editing) {
        res = await fetch(`${API_BASE}clients/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        body = await res.json()
        if (!res.ok) throw new Error(body.message || `status ${res.status}`)
        const updated: Client = body.client || body
        setClients(c => c.map(cl => cl.id === updated.id ? updated : cl))
      } else {
        res = await fetch(`${API_BASE}clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        body = await res.json()
        if (!res.ok) throw new Error(body.message || `status ${res.status}`)
        const created: Client = body.client || body
        setClients(c => [created, ...c])
      }
      setOpen(false)
      setEditing(null)
      setForm({ name: '', document: '', segment: '', vendor: '' })
    } catch (err: any) {
      console.error('save client err', err)
      alert(err?.message || 'Erro ao salvar cliente')
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
        <button className="btn-new" onClick={() => {
          setOpen(true)
          setEditing(null)
          setForm({ name: '', document: '', segment: '', vendor: '' })
        }}>Novo Cliente</button>
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
                    <button className="btn-action btn-edit" title="Editar" style={{ marginRight: 8, padding: '4px 6px', background: 'none', border: 'none' }} onClick={() => {
                      setOpen(true)
                      setEditing(c)
                      setForm({
                        name: c.name || '',
                        document: c.document || '',
                        segment: c.segment || '',
                        vendor: c.vendor || ''
                      })
                    }}>
                      <img src={pencilIcon} alt="Editar" style={{ width: 20, height: 20, verticalAlign: 'middle', filter: 'drop-shadow(0 0 2px #1976d2)' }} />
                    </button>
                    <button className="btn-action btn-delete" title="Excluir" style={{ background: 'none', border: 'none', padding: '4px 6px' }} onClick={() => handleDelete(c.id)}>
                      <img src={trashIcon} alt="Excluir" style={{ width: 20, height: 20, verticalAlign: 'middle', filter: 'drop-shadow(0 0 2px #d32f2f)' }} />
                    </button>
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
            <h3>{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>

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
              <button className="btn-cancel" onClick={() => {
                setOpen(false)
                setEditing(null)
              }}>Cancelar</button>
              <button className="btn-save" onClick={handleSave} disabled={submitting}>{submitting ? (editing ? 'Salvando...' : 'Salvando...') : (editing ? 'Salvar alterações' : 'Salvar')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clients
