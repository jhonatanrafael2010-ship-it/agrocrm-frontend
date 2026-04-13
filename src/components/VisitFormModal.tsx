import React, { useEffect, useMemo, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";

type Product = {
  product_name: string;
  dose: string;
  unit: string;
  application_date: string | null;
};

type Client = { id: number; name: string };
type Property = { id: number; client_id?: number; name: string };
type Plot = { id: number; property_id?: number; name: string };
type Culture = { id: number; name: string };
type Variety = { id: number; culture: string; name: string };
type Consultant = { id: number; name: string };

export type VisitFormModalData = {
  date: string;
  client_id: string;
  property_id: string;
  plot_id: string;
  consultant_id: string;
  culture: string;
  variety: string;
  recommendation: string;
  fenologia_real: string;
  latitude: number | null;
  longitude: number | null;
  products: Product[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: VisitFormModalData) => Promise<void> | void;
  theme?: string;
  title?: string;
  clients: Client[];
  properties: Property[];
  plots: Plot[];
  cultures: Culture[];
  varieties: Variety[];
  consultants: Consultant[];
  initialData?: Partial<VisitFormModalData>;
};

const buildEmptyForm = (): VisitFormModalData => ({
  date: "",
  client_id: "",
  property_id: "",
  plot_id: "",
  consultant_id: "",
  culture: "",
  variety: "",
  recommendation: "",
  fenologia_real: "",
  latitude: null,
  longitude: null,
  products: [],
});

const VisitFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  theme = "light",
  title = "Nova Visita",
  clients,
  properties,
  plots,
  cultures,
  varieties,
  consultants,
  initialData,
}) => {
  const [tab, setTab] = useState<"dados" | "produtos">("dados");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VisitFormModalData>(buildEmptyForm());

  useEffect(() => {
    if (!open) return;

    const now = new Date();
    const todayBR =
      String(now.getDate()).padStart(2, "0") +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      now.getFullYear();

    setForm({
      ...buildEmptyForm(),
      date: initialData?.date || todayBR,
      client_id: initialData?.client_id || "",
      property_id: initialData?.property_id || "",
      plot_id: initialData?.plot_id || "",
      consultant_id: initialData?.consultant_id || "",
      culture: initialData?.culture || "",
      variety: initialData?.variety || "",
      recommendation: initialData?.recommendation || "",
      fenologia_real: initialData?.fenologia_real || "",
      latitude: initialData?.latitude ?? null,
      longitude: initialData?.longitude ?? null,
      products: initialData?.products || [],
    });

    setTab("dados");
  }, [open, initialData]);

  const filteredProperties = useMemo(() => {
    return properties.filter(
      (p) => String(p.client_id || "") === String(form.client_id || "")
    );
  }, [properties, form.client_id]);

  const filteredPlots = useMemo(() => {
    return plots.filter(
      (pl) => String(pl.property_id || "") === String(form.property_id || "")
    );
  }, [plots, form.property_id]);

  const filteredVarieties = useMemo(() => {
    if (!form.culture) return [];
    return varieties.filter(
      (v) =>
        String(v.culture || "").toLowerCase() ===
        String(form.culture || "").toLowerCase()
    );
  }, [varieties, form.culture]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleGetLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });

      const { latitude, longitude } = position.coords;

      setForm((f) => ({
        ...f,
        latitude,
        longitude,
      }));

      alert(
        `📍 Localização salva: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );
    } catch (err) {
      console.error("Erro ao obter localização:", err);
      alert("⚠️ Falha ao capturar localização.");
    }
  };

  const handleSave = async () => {
    if (!form.date) {
      alert("Data é obrigatória.");
      return;
    }

    if (!form.client_id) {
      alert("Cliente é obrigatório.");
      return;
    }

    try {
      setSaving(true);
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        role="document"
        style={{
          maxWidth: "1000px",
          width: "96%",
        }}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{
            background: theme === "dark" ? "var(--panel)" : "#fff",
            color: theme === "dark" ? "var(--text)" : "#111",
            maxHeight: "90vh",
            overflowY: "auto",
            borderRadius: "14px",
            paddingBottom: "10px",
          }}
        >
          <div className="modal-header border-0">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Fechar"
              onClick={onClose}
            ></button>
          </div>

          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              marginBottom: "15px",
            }}
          >
            <button
              onClick={() => setTab("dados")}
              className="btn btn-link"
              style={{
                fontWeight: tab === "dados" ? 700 : 500,
                textDecoration: "none",
              }}
            >
              📝 Dados da Visita
            </button>

            <button
              onClick={() => setTab("produtos")}
              className="btn btn-link"
              style={{
                fontWeight: tab === "produtos" ? 700 : 500,
                textDecoration: "none",
              }}
            >
              🧪 Produtos Aplicados
            </button>
          </div>

          <div className="modal-body">
            {tab === "dados" && (
              <div className="row g-3">
                <div className="col-md-4">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <label className="form-label fw-semibold">Data</label>

                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const tStr =
                          String(now.getDate()).padStart(2, "0") +
                          "/" +
                          String(now.getMonth() + 1).padStart(2, "0") +
                          "/" +
                          now.getFullYear();

                        setForm((f) => ({ ...f, date: tStr }));
                      }}
                      className="btn btn-success btn-sm"
                    >
                      Hoje
                    </button>
                  </div>

                  <input
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    placeholder="dd/mm/aaaa"
                    className="form-control"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Cliente</label>
                  <select
                    name="client_id"
                    value={form.client_id}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">Selecione</option>
                    {clients.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Propriedade</label>
                  <select
                    name="property_id"
                    value={form.property_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        property_id: e.target.value,
                        plot_id: "",
                      }))
                    }
                    className="form-select"
                  >
                    <option value="">Selecione</option>
                    {filteredProperties.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Talhão</label>
                  <select
                    name="plot_id"
                    value={form.plot_id}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">Selecione</option>
                    {filteredPlots.map((pl) => (
                      <option key={pl.id} value={String(pl.id)}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Cultura</label>
                  <select
                    name="culture"
                    value={form.culture}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        culture: e.target.value,
                        variety: "",
                      }))
                    }
                    className="form-select"
                  >
                    <option value="">Selecione</option>
                    {cultures.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Variedade</label>
                  <select
                    name="variety"
                    value={form.variety}
                    onChange={handleChange}
                    className="form-select"
                    disabled={!form.culture}
                  >
                    <option value="">Selecione</option>
                    {filteredVarieties.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Consultor</label>
                  <select
                    name="consultant_id"
                    value={form.consultant_id}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">Selecione</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 mt-2">
                  <button
                    type="button"
                    className="btn btn-outline-info btn-sm"
                    onClick={handleGetLocation}
                  >
                    📍 Capturar Localização
                  </button>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Fenologia Observada</label>
                  <input
                    type="text"
                    name="fenologia_real"
                    value={form.fenologia_real}
                    onChange={handleChange}
                    placeholder="Ex: V6, R1, 6 folhas..."
                    className="form-control"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Observações</label>
                  <textarea
                    name="recommendation"
                    value={form.recommendation}
                    onChange={handleChange}
                    placeholder="Descreva observações..."
                    className="form-control"
                  />
                </div>
              </div>
            )}

            {tab === "produtos" && (
              <div>
                <h6 className="mb-3">Produtos Aplicados</h6>

                {form.products.map((p, i) => (
                  <div className="row g-2 mb-2" key={i}>
                    <div className="col-md-4">
                      <input
                        className="form-control"
                        placeholder="Produto"
                        value={p.product_name}
                        onChange={(e) => {
                          const updated = [...form.products];
                          updated[i].product_name = e.target.value;
                          setForm((f) => ({ ...f, products: updated }));
                        }}
                      />
                    </div>

                    <div className="col-md-2">
                      <input
                        className="form-control"
                        placeholder="Dose"
                        value={p.dose}
                        onChange={(e) => {
                          const updated = [...form.products];
                          updated[i].dose = e.target.value;
                          setForm((f) => ({ ...f, products: updated }));
                        }}
                      />
                    </div>

                    <div className="col-md-2">
                      <input
                        className="form-control"
                        placeholder="Unidade"
                        value={p.unit}
                        onChange={(e) => {
                          const updated = [...form.products];
                          updated[i].unit = e.target.value;
                          setForm((f) => ({ ...f, products: updated }));
                        }}
                      />
                    </div>

                    <div className="col-md-3">
                      <input
                        type="date"
                        className="form-control"
                        value={p.application_date || ""}
                        onChange={(e) => {
                          const updated = [...form.products];
                          updated[i].application_date = e.target.value;
                          setForm((f) => ({ ...f, products: updated }));
                        }}
                      />
                    </div>

                    <div className="col-md-1">
                      <button
                        className="btn btn-danger w-100"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            products: f.products.filter((_, idx) => idx !== i),
                          }))
                        }
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-primary btn-sm mt-2"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      products: [
                        ...f.products,
                        {
                          product_name: "",
                          dose: "",
                          unit: "",
                          application_date: null,
                        },
                      ],
                    }))
                  }
                >
                  ➕ Adicionar Produto
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer border-0">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>

            <button
              className="btn btn-success"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitFormModal;