import React, { useEffect, useState } from "react";
import pencilIcon from "../assets/pencil.svg";
import trashIcon from "../assets/trash.svg";
import DarkSelect from "../components/DarkSelect";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

type Opportunity = {
  id: number;
  client_id?: number;
  title?: string;
  estimated_value?: number;
  stage?: string;
};

type Client = { id: number; name: string };

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

const STAGES = [
  { key: "prospecção", label: "Prospecção" },
  { key: "cotação", label: "Cotação" },
  { key: "negociação", label: "Negociação" },
  { key: "fechadas", label: "Fechadas" },
  { key: "perdidas", label: "Perdidas" },
];

const Opportunities: React.FC = () => {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", estimated_value: "" });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);

  const theme = document.body.getAttribute("data-theme") || "light";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}opportunities`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([ops, cs]) => {
        if (!mounted) return;
        setOpps(ops || []);
        setClients(cs || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Erro ao carregar oportunidades");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function clientName(id?: number) {
    return clients.find((c) => c.id === id)?.name ?? "--";
  }

  async function changeStageRemote(opId: number, newStage: string) {
    try {
      const res = await fetch(`${API_BASE}opportunities/${opId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const updated = body.opportunity || body;
      setOpps((list) => list.map((it) => (it.id === updated.id ? updated : it)));
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar oportunidade");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.client_id || !form.title) return alert("Cliente e título são obrigatórios");
    setSubmitting(true);
    try {
      let res, body;
      if (editing) {
        res = await fetch(`${API_BASE}opportunities/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(form.client_id),
            title: form.title,
            estimated_value: form.estimated_value
              ? Number(form.estimated_value)
              : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const updated = body.opportunity || body;
        setOpps((o) => o.map((op) => (op.id === updated.id ? updated : op)));
      } else {
        res = await fetch(`${API_BASE}opportunities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(form.client_id),
            title: form.title,
            estimated_value: form.estimated_value
              ? Number(form.estimated_value)
              : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created = body.opportunity || body;
        setOpps((o) => [created, ...o]);
      }
      setOpen(false);
      setEditing(null);
      setForm({ client_id: "", title: "", estimated_value: "" });
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar oportunidade");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOpportunity(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir esta oportunidade?")) return;
    try {
      const res = await fetch(`${API_BASE}opportunities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `status ${res.status}`);
      }
      setOpps((list) => list.filter((o) => o.id !== id));
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir oportunidade");
    }
  }

  const grouped = STAGES.reduce((acc: Record<string, Opportunity[]>, s) => {
    acc[s.key] = opps.filter(
      (o) => (o.stage || "prospecção").toLowerCase() === s.key
    );
    return acc;
  }, {} as Record<string, Opportunity[]>);

  function onDragEnd(result: any) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const fromStage = source.droppableId;
    const toStage = destination.droppableId;
    if (fromStage === toStage) return;

    const opId = Number(draggableId);
    setOpps((list) =>
      list.map((it) => (it.id === opId ? { ...it, stage: toStage } : it))
    );
    changeStageRemote(opId, toStage);
  }

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">💼 Oportunidades</h2>
          <button className="btn btn-success btn-sm" onClick={() => setOpen(true)}>
            + Nova Oportunidade
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary py-3">Carregando...</div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="row justify-content-center g-3">
            {STAGES.map((s) => (
              <div key={s.key} className="col-12 col-md-6 col-lg-2">
                <div
                  className={`card shadow-sm border-0 h-100 ${
                    theme === "dark" ? "bg-dark" : "bg-white"
                  }`}
                >
                  <div className="card-header fw-bold text-center text-capitalize">
                    {s.label}
                  </div>
                  <Droppable droppableId={s.key}>
                    {(provided) => (
                      <div
                        className="card-body p-2"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {(grouped[s.key] || []).map((op, idx) => (
                          <Draggable key={op.id} draggableId={`${op.id}`} index={idx}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`p-2 mb-2 rounded border ${
                                  theme === "dark" ? "border-secondary bg-secondary" : "bg-light"
                                }`}
                              >
                                <div className="fw-semibold">{op.title}</div>
                                <div className="text-secondary small mb-1">
                                  {clientName(op.client_id)}
                                </div>
                                {op.estimated_value && (
                                  <div className="small text-success fw-bold">
                                    R$ {op.estimated_value.toLocaleString("pt-BR")}
                                  </div>
                                )}
                                <div className="d-flex justify-content-end gap-1 mt-2">
                                  {s.key !== "fechadas" && (
                                    <button
                                      className="btn btn-outline-success btn-sm"
                                      onClick={() =>
                                        changeStageRemote(op.id, "fechadas")
                                      }
                                    >
                                      Fechar
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => {
                                      setOpen(true);
                                      setEditing(op);
                                      setForm({
                                        client_id: op.client_id
                                          ? String(op.client_id)
                                          : "",
                                        title: op.title || "",
                                        estimated_value: op.estimated_value
                                          ? String(op.estimated_value)
                                          : "",
                                      });
                                    }}
                                  >
                                    <img src={pencilIcon} alt="Editar" width={16} />
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => deleteOpportunity(op.id)}
                                  >
                                    <img src={trashIcon} alt="Excluir" width={16} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* MODAL NOVA/EDITAR */}
      {open && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {editing ? "Editar Oportunidade" : "Nova Oportunidade"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Cliente</label>
                <DarkSelect
                  name="client_id"
                  value={form.client_id}
                  placeholder="Selecione cliente"
                  options={[
                    { value: "", label: "Selecione cliente" },
                    ...clients
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                  onChange={handleChange as any}
                />

                <label className="form-label mt-3">Título</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Valor estimado</label>
                <input
                  name="estimated_value"
                  value={form.estimated_value}
                  onChange={handleChange}
                  placeholder="0"
                  className="form-control"
                />
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleSave}
                  disabled={submitting}
                >
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Opportunities;
