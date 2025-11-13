import React, { useEffect, useState } from "react";
import pencilIcon from "../assets/pencil.svg";
import trashIcon from "../assets/trash.svg";
import { API_BASE } from "../config";



type Client = {
  id: number;
  name: string;
  document?: string;
  segment: string;
  vendor?: string;
};


const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: "",
    document: "",
    segment: "",
    vendor: "",
  });

  const theme = document.body.getAttribute("data-theme") || "light";

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}clients`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return await res.json();
      })
      .then((data) => setClients(data))
      .catch((err) => {
        console.error("fetch clients err", err);
        setError("Erro ao carregar clientes");
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return alert("Nome é obrigatório");
    setSubmitting(true);
    try {
      const method = editing ? "PUT" : "POST";
      const url = editing
        ? `${API_BASE}clients/${editing.id}`
        : `${API_BASE}clients`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      const client: Client = body.client || body;
      setClients((c) =>
        editing
          ? c.map((cl) => (cl.id === client.id ? client : cl))
          : [client, ...c]
      );
      setOpen(false);
      setEditing(null);
      setForm({ name: "", document: "", segment: "", vendor: "" });
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar cliente");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id?: number) {
    if (!id) return;
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      const res = await fetch(`${API_BASE}clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setClients((list) => list.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir cliente");
    }
  }

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">👤 Clientes</h2>
          <button
            className="btn btn-success btn-sm"
            onClick={() => {
              setOpen(true);
              setEditing(null);
              setForm({ name: "", document: "", segment: "", vendor: "" });
            }}
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      <div className="row justify-content-center">
        <div className="col-12 col-lg-10">
          {loading ? (
            <div className="text-secondary py-3 text-center">Carregando...</div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <div className={`card shadow-sm border-0 ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
              <div className="table-responsive">
                <table
                  className={`table table-sm align-middle ${
                    theme === "dark" ? "table-dark" : "table-striped"
                  }`}
                >
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Documento</th>
                      <th>Segmento</th>
                      <th>Vendedor</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.document || "--"}</td>
                        <td>{c.segment || "--"}</td>
                        <td>{c.vendor || "--"}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-primary btn-sm me-2"
                            onClick={() => {
                              setOpen(true);
                              setEditing(c);
                              setForm({
                                name: c.name || "",
                                document: c.document || "",
                                segment: c.segment || "",
                                vendor: c.vendor || "",
                              });
                            }}
                          >
                            <img src={pencilIcon} alt="Editar" width={18} />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDelete(c.id)}
                          >
                            <img src={trashIcon} alt="Excluir" width={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Bootstrap */}
      {open && (
        <div
          className="modal fade show d-block"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : "bg-white text-dark"}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {editing ? "Editar Cliente" : "Novo Cliente"}
                </h5>
                <button className="btn-close" onClick={() => setOpen(false)} />
              </div>
              <div className="modal-body">
                {["name", "document", "segment", "vendor"].map((field) => (
                  <div className="mb-3" key={field}>
                    <label className="form-label text-capitalize">
                      {field === "vendor" ? "Vendedor" : field}
                    </label>
                    <input
                      name={field}
                      value={(form as any)[field]}
                      onChange={handleChange}
                      className={`form-control ${
                        theme === "dark"
                          ? "bg-body-tertiary text-light border-secondary"
                          : ""
                      }`}
                      placeholder={
                        field === "name"
                          ? "Ex.: Fazenda Boa Vista"
                          : field === "vendor"
                          ? "Responsável"
                          : ""
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setOpen(false)}>
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

export default Clients;
