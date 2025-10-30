import React, { useEffect, useState } from "react";
import DarkSelect from "../components/DarkSelect";

type Property = { id: number; name: string };
type Plot = {
  id: number;
  property_id: number;
  name: string;
  area_ha?: number;
  irrigated?: boolean;
};

const API_BASE = import.meta.env.VITE_API_URL || "/api/";

const Plots: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    name: "",
    area_ha: "",
    irrigated: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const theme = document.body.getAttribute("data-theme") || "light";

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}plots`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([ps, pls]) => {
        if (!mounted) return;
        setProperties(ps || []);
        setPlots(pls || []);
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === "checkbox") {
      setForm((f) => ({ ...f, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  async function createPlot() {
    if (!form.property_id || !form.name)
      return alert("Propriedade e nome são obrigatórios");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: Number(form.property_id),
          name: form.name,
          area_ha: form.area_ha ? Number(form.area_ha) : undefined,
          irrigated: form.irrigated,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.plot || body;
      setPlots((p) => [created, ...p]);
      setOpen(false);
      setForm({ property_id: "", name: "", area_ha: "", irrigated: false });
    } catch (err: any) {
      alert(err?.message || "Erro ao criar talhão");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePlot(id?: number) {
    if (!id) return;
    if (!confirm("Deseja excluir este talhão?")) return;
    try {
      const res = await fetch(`${API_BASE}plots/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `status ${res.status}`);
      }
      setPlots((list) => list.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir talhão");
    }
  }

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">🌾 Talhões</h2>
          <button className="btn btn-success btn-sm" onClick={() => setOpen(true)}>
            + Novo Talhão
          </button>
        </div>
      </div>

      <div className="col-12 col-lg-10 mx-auto">
        <div className={`card border-0 shadow-sm ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
          <div className="card-body">
            <div className="table-responsive">
              <table
                className={`table table-sm align-middle ${
                  theme === "dark" ? "table-dark" : "table-striped"
                }`}
              >
                <thead>
                  <tr>
                    <th>Fazenda</th>
                    <th>Talhão</th>
                    <th>Área (ha)</th>
                    <th>Irrigado</th>
                    <th className="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {plots.map((pl) => (
                    <tr key={pl.id}>
                      <td>
                        {properties.find((pp) => pp.id === pl.property_id)?.name ??
                          pl.property_id}
                      </td>
                      <td>{pl.name}</td>
                      <td>{pl.area_ha ?? "--"}</td>
                      <td>{pl.irrigated ? "Sim" : "—"}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => deletePlot(pl.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {plots.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-secondary py-3">
                        Nenhum talhão cadastrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CADASTRO */}
      {open && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">Novo Talhão</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setOpen(false)}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Propriedade</label>
                <DarkSelect
                  name="property_id"
                  value={form.property_id}
                  placeholder="Selecione uma propriedade"
                  options={[
                    { value: "", label: "Selecione uma propriedade" },
                    ...properties.map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    })),
                  ]}
                  onChange={handleChange as any}
                />

                <label className="form-label mt-3">Nome do Talhão</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Área (ha)</label>
                <input
                  name="area_ha"
                  value={form.area_ha}
                  onChange={handleChange}
                  className="form-control"
                />

                <div className="form-check mt-3">
                  <input
                    type="checkbox"
                    name="irrigated"
                    checked={form.irrigated}
                    onChange={handleChange as any}
                    className="form-check-input"
                    id="irrigatedCheck"
                  />
                  <label className="form-check-label" htmlFor="irrigatedCheck">
                    Irrigado
                  </label>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-success"
                  onClick={createPlot}
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

export default Plots;
