import React from "react";
import DarkSelect from "../components/DarkSelect";
import trashIcon from "../assets/trash.svg";
import pencilIcon from "../assets/pencil.svg";
import { API_BASE } from "../config";


type Client = { id: number; name: string };
type Property = {
  id: number;
  client_id: number;
  name: string;
  city_state?: string;
  area_ha?: number;
};
type Plot = {
  id: number;
  property_id: number;
  name: string;
  area_ha?: number;
  irrigated?: boolean;
};
type Planting = {
  id: number;
  plot_id: number;
  culture?: string;
  variety?: string;
  planting_date?: string;
};


const Properties: React.FC = () => {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [plots, setPlots] = React.useState<Plot[]>([]);
  const [plantings, setPlantings] = React.useState<Planting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // modais
  const [openProp, setOpenProp] = React.useState(false);
  const [openPlot, setOpenPlot] = React.useState(false);
  const [openPlanting, setOpenPlanting] = React.useState(false);
  const [editingProp, setEditingProp] = React.useState<Property | null>(null);

  // forms
  const [propForm, setPropForm] = React.useState({
    client_id: "",
    name: "",
    city_state: "",
    area_ha: "",
  });
  const [plotForm, setPlotForm] = React.useState({
    property_id: "",
    name: "",
    area_ha: "",
    irrigated: false,
  });
  const [plantForm, setPlantForm] = React.useState({
    plot_id: "",
    culture: "",
    variety: "",
    planting_date: "",
  });

  const [submitting, setSubmitting] = React.useState(false);

  // pega o tema atual do body (dark/light)
  const theme = document.body.getAttribute("data-theme") || "light";

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}clients`).then((r) => r.json()),
      fetch(`${API_BASE}properties`).then((r) => r.json()),
      fetch(`${API_BASE}plots`).then((r) => r.json()),
      fetch(`${API_BASE}plantings`).then((r) => r.json()),
    ])
      .then(([cs, ps, pls, pts]) => {
        if (!mounted) return;
        setClients(cs || []);
        setProperties(ps || []);
        setPlots(pls || []);
        setPlantings(pts || []);
      })
      .catch((err) => {
        console.error(err);
        setError("Erro ao carregar dados");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // handlers
  function handlePropChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setPropForm((f) => ({ ...f, [name]: value }));
  }
  function handlePlotChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === "checkbox") {
      setPlotForm((f) => ({ ...f, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setPlotForm((f) => ({ ...f, [name]: value }));
    }
  }
  function handlePlantChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setPlantForm((f) => ({ ...f, [name]: value }));
  }

  // salvar propriedade
  async function saveProperty() {
    if (!propForm.client_id || !propForm.name) {
      alert("Cliente e nome são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      let res, body;
      if (editingProp) {
        res = await fetch(`${API_BASE}properties/${editingProp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(propForm.client_id),
            name: propForm.name,
            city_state: propForm.city_state || undefined,
            area_ha: propForm.area_ha ? Number(propForm.area_ha) : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const updated = body.property || body;
        setProperties((p) => p.map((pr) => (pr.id === updated.id ? updated : pr)));
      } else {
        res = await fetch(`${API_BASE}properties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: Number(propForm.client_id),
            name: propForm.name,
            city_state: propForm.city_state || undefined,
            area_ha: propForm.area_ha ? Number(propForm.area_ha) : undefined,
          }),
        });
        body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        const created = body.property || body;
        setProperties((p) => [created, ...p]);
      }
      // fecha modal e limpa
      setOpenProp(false);
      setEditingProp(null);
      setPropForm({ client_id: "", name: "", city_state: "", area_ha: "" });
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar propriedade");
    } finally {
      setSubmitting(false);
    }
  }

  // criar talhão
  async function createPlot() {
    if (!plotForm.property_id || !plotForm.name) {
      alert("Propriedade e nome são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: Number(plotForm.property_id),
          name: plotForm.name,
          area_ha: plotForm.area_ha ? Number(plotForm.area_ha) : undefined,
          irrigated: plotForm.irrigated,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.plot || body;
      setPlots((p) => [created, ...p]);
      setOpenPlot(false);
      setPlotForm({ property_id: "", name: "", area_ha: "", irrigated: false });
    } catch (err: any) {
      alert(err?.message || "Erro ao criar talhão");
    } finally {
      setSubmitting(false);
    }
  }

  // criar plantio
  async function createPlanting() {
    if (!plantForm.plot_id) {
      alert("Talhão é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}plantings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plot_id: Number(plantForm.plot_id),
          culture: plantForm.culture || undefined,
          variety: plantForm.variety || undefined,
          planting_date: plantForm.planting_date || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      const created = body.planting || body;
      setPlantings((p) => [created, ...p]);
      setOpenPlanting(false);
      setPlantForm({ plot_id: "", culture: "", variety: "", planting_date: "" });
    } catch (err: any) {
      alert(err?.message || "Erro ao criar plantio");
    } finally {
      setSubmitting(false);
    }
  }

  // deletar (propriedade / talhão / plantio)
  async function deleteEntity(
    id: number | undefined,
    endpoint: "properties" | "plots" | "plantings",
    setter: React.Dispatch<React.SetStateAction<any[]>>
  ) {
    if (!id) return;
    if (!confirm("Deseja excluir este registro?")) return;
    try {
      const res = await fetch(`${API_BASE}${endpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setter((list) => list.filter((item: any) => item.id !== id));
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir");
    }
  }

  return (
    <div className={`container-fluid py-4 ${theme === "dark" ? "text-light" : "text-dark"}`}>
      {/* título e ações */}
      <div className="row mb-3">
        <div className="col-12 col-lg-10 mx-auto d-flex justify-content-between align-items-center">
          <h2 className="fw-bold">🏠 Propriedades & Talhões</h2>
          <div className="d-flex gap-2">
            <button className="btn btn-success btn-sm" onClick={() => setOpenProp(true)}>
              + Nova Propriedade
            </button>
            <button className="btn btn-success btn-sm" onClick={() => setOpenPlot(true)}>
              + Novo Talhão
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="row mb-3">
          <div className="col-12 col-lg-10 mx-auto">
            <div className="alert alert-danger">{error}</div>
          </div>
        </div>
      )}

      {/* listas principais */}
      <div className="row justify-content-center g-4">
        {/* Propriedades */}
        <div className="col-12 col-lg-5">
          <div className={`card shadow-sm border-0 ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
            <div className="card-body">
              <h5 className="card-title mb-3">Propriedades</h5>
              {loading ? (
                <div className="text-secondary py-3 text-center">Carregando...</div>
              ) : (
                <div className="table-responsive">
                  <table
                    className={`table table-sm align-middle ${
                      theme === "dark" ? "table-dark" : "table-striped"
                    }`}
                  >
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Propriedade</th>
                        <th>Cidade/UF</th>
                        <th>Área</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {properties.map((p) => (
                        <tr key={p.id}>
                          <td>{clients.find((c) => c.id === p.client_id)?.name ?? p.client_id}</td>
                          <td>{p.name}</td>
                          <td>{p.city_state ?? "--"}</td>
                          <td>{p.area_ha ?? "--"}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm me-1"
                              onClick={() => {
                                setOpenProp(true);
                                setEditingProp(p);
                                setPropForm({
                                  client_id: String(p.client_id),
                                  name: p.name || "",
                                  city_state: p.city_state || "",
                                  area_ha: p.area_ha ? String(p.area_ha) : "",
                                });
                              }}
                            >
                              <img src={pencilIcon} alt="Editar" width={18} />
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteEntity(p.id, "properties", setProperties)}
                            >
                              <img src={trashIcon} alt="Excluir" width={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!loading && properties.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-secondary py-3">
                            Nenhuma propriedade cadastrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Talhões */}
        <div className="col-12 col-lg-5">
          <div className={`card shadow-sm border-0 ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
            <div className="card-body">
              <h5 className="card-title mb-3">Talhões</h5>
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
                      <th>Área</th>
                      <th>Irrig.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plots.map((pl) => (
                      <tr key={pl.id}>
                        <td>{properties.find((pp) => pp.id === pl.property_id)?.name ?? pl.property_id}</td>
                        <td>{pl.name}</td>
                        <td>{pl.area_ha ?? "--"}</td>
                        <td>{pl.irrigated ? "Sim" : "—"}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => deleteEntity(pl.id, "plots", setPlots)}
                          >
                            <img src={trashIcon} alt="Excluir" width={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && plots.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-3 text-secondary">
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
      </div>

      {/* Plantios */}
      <div className="row justify-content-center mt-4">
        <div className="col-12 col-lg-10">
          <div className={`card shadow-sm border-0 ${theme === "dark" ? "bg-dark" : "bg-white"}`}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">🌾 Plantios</h5>
                <button className="btn btn-success btn-sm" onClick={() => setOpenPlanting(true)}>
                  + Novo Plantio
                </button>
              </div>
              <div className="table-responsive">
                <table
                  className={`table table-sm align-middle ${
                    theme === "dark" ? "table-dark" : "table-striped"
                  }`}
                >
                  <thead>
                    <tr>
                      <th>Talhão</th>
                      <th>Cultura</th>
                      <th>Variedade</th>
                      <th>Plantio</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantings.map((pt) => (
                      <tr key={pt.id}>
                        <td>{plots.find((pl) => pl.id === pt.plot_id)?.name ?? pt.plot_id}</td>
                        <td>{pt.culture ?? "--"}</td>
                        <td>{pt.variety ?? "--"}</td>
                        <td>{pt.planting_date ?? "--"}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => deleteEntity(pt.id, "plantings", setPlantings)}
                          >
                            <img src={trashIcon} alt="Excluir" width={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && plantings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-3 text-secondary">
                          Nenhum plantio cadastrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PROPRIEDADE */}
      {openProp && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  {editingProp ? "Editar Propriedade" : "Nova Propriedade"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setOpenProp(false);
                    setEditingProp(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Cliente</label>
                <DarkSelect
                  name="client_id"
                  value={propForm.client_id}
                  placeholder="Selecione um cliente"
                  options={[
                    { value: "", label: "Selecione um cliente" },
                    ...clients
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                  onChange={handlePropChange as any}
                />

                <label className="form-label mt-3">Nome</label>
                <input
                  name="name"
                  value={propForm.name}
                  onChange={handlePropChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Cidade/UF</label>
                <input
                  name="city_state"
                  value={propForm.city_state}
                  onChange={handlePropChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Área (ha)</label>
                <input
                  name="area_ha"
                  value={propForm.area_ha}
                  onChange={handlePropChange}
                  className="form-control"
                />
              </div>
              <div className="modal-footer border-0">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setOpenProp(false);
                    setEditingProp(null);
                  }}
                >
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={saveProperty} disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TALHÃO */}
      {openPlot && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">Novo Talhão</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setOpenPlot(false)}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Propriedade</label>
                <DarkSelect
                  name="property_id"
                  value={plotForm.property_id}
                  placeholder="Selecione uma propriedade"
                  options={[
                    { value: "", label: "Selecione uma propriedade" },
                    ...properties
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => ({ value: String(p.id), label: p.name })),
                  ]}
                  onChange={handlePlotChange as any}
                />

                <label className="form-label mt-3">Nome</label>
                <input
                  name="name"
                  value={plotForm.name}
                  onChange={handlePlotChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Área (ha)</label>
                <input
                  name="area_ha"
                  value={plotForm.area_ha}
                  onChange={handlePlotChange}
                  className="form-control"
                />

                <div className="form-check mt-3">
                  <input
                    id="irrigated"
                    type="checkbox"
                    name="irrigated"
                    checked={plotForm.irrigated}
                    onChange={handlePlotChange as any}
                    className="form-check-input"
                  />
                  <label htmlFor="irrigated" className="form-check-label">
                    Irrigado
                  </label>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setOpenPlot(false)}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={createPlot} disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PLANTIO */}
      {openPlanting && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className={`modal-content ${theme === "dark" ? "bg-dark text-light" : ""}`}>
              <div className="modal-header border-0">
                <h5 className="modal-title">Novo Plantio</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setOpenPlanting(false)}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Talhão</label>
                <DarkSelect
                  name="plot_id"
                  value={plantForm.plot_id}
                  placeholder="Selecione um talhão"
                  options={[
                    { value: "", label: "Selecione um talhão" },
                    ...plots
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => ({ value: String(p.id), label: p.name })),
                  ]}
                  onChange={handlePlantChange as any}
                />

                <label className="form-label mt-3">Cultura</label>
                <input
                  name="culture"
                  value={plantForm.culture}
                  onChange={handlePlantChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Variedade</label>
                <input
                  name="variety"
                  value={plantForm.variety}
                  onChange={handlePlantChange}
                  className="form-control"
                />

                <label className="form-label mt-3">Data plantio</label>
                <input
                  type="date"
                  name="planting_date"
                  value={plantForm.planting_date}
                  onChange={handlePlantChange}
                  className="form-control"
                />
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setOpenPlanting(false)}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={createPlanting} disabled={submitting}>
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

export default Properties;
