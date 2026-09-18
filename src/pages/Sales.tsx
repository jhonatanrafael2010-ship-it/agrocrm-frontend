import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Tabs,
  Tab,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Collapse,
  TableSortLabel,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Grass as SeedIcon,
  Science as FertilizerIcon,
  Spa as BiologicalIcon,
  WaterDrop as NutritionIcon,
  Dashboard as OverviewIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { notify, confirm as toastConfirm } from "../utils/toast";

type Product = {
  id: number;
  name: string;
  category: string;
  default_unit: string;
  culture: string | null;
  seeds_per_ha: number | null;
  active: boolean;
};

type Sale = {
  id: number;
  client_id: number;
  client_name: string;
  client_region: string | null;
  product_id: number;
  product_name: string;
  product_category: string;
  consultant_id: number | null;
  consultant_name: string | null;
  quantity: number;
  unit: string;
  value: number | null;
  period_type: string;
  period_year: string;
  period_label: string;
  culture: string | null;
  sale_date: string | null;
  notes: string | null;
};

type Client = { id: number; name: string; region: string | null };
type Consultant = { id: number; name: string };
type Period = { type: string; year: string; label: string };

type SortDirection = "asc" | "desc";
type SortField = "sales_count" | "total_value" | "total_quantity" | "unit_value";

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; unit: string }> = {
  "Semente": { icon: <SeedIcon />, color: "#22c55e", unit: "Sacas" },
  "Fertilizante": { icon: <FertilizerIcon />, color: "#3b82f6", unit: "Ton" },
  "Biológico": { icon: <BiologicalIcon />, color: "#8b5cf6", unit: "L/Kg" },
  "Nutrição Foliar": { icon: <NutritionIcon />, color: "#f59e0b", unit: "L/Kg" },
  "Defensivo": { icon: <InventoryIcon />, color: "#ef4444", unit: "L/Kg" },
};

const Sales: React.FC = () => {
  const [activeTab, setActiveTab] = useState("vendas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [cultures, setCultures] = useState<string[]>([]);

  // Filtros
  const [filterPeriodType, setFilterPeriodType] = useState("");
  const [filterPeriodYear, setFilterPeriodYear] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  // Ordenação
  const [sortField, setSortField] = useState<SortField>("total_value");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Expansão de clientes
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());

  // Modal de venda
  const [openSale, setOpenSale] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleForm, setSaleForm] = useState({
    client_id: "",
    product_id: "",
    consultant_id: "",
    quantity: "",
    unit: "",
    value: "",
    period_type: "",
    period_year: "",
    culture: "",
    sale_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Modal de produto
  const [openProduct, setOpenProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    default_unit: "",
    culture: "",
    seeds_per_ha: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Busca de cliente
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Regiões únicas
  const regions = useMemo(() => {
    const uniqueRegions = new Set(clients.map((c) => c.region).filter(Boolean));
    return Array.from(uniqueRegions) as string[];
  }, [clients]);

  // Categorias que possuem vendas
  const categoriesWithSales = useMemo(() => {
    const cats = new Set(sales.map((s) => s.product_category));
    return Array.from(cats);
  }, [sales]);

  // Clientes filtrados para autocomplete
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const sorted = clients.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 15);
    return sorted.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15);
  }, [clients, clientSearch]);

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [salesRes, productsRes, clientsRes, consultantsRes, periodsRes, categoriesRes, unitsRes, culturesRes] =
        await Promise.all([
          fetch(`${API_BASE}sales`),
          fetch(`${API_BASE}products`),
          fetch(`${API_BASE}clients`),
          fetch(`${API_BASE}consultants`),
          fetch(`${API_BASE}sales/periods`),
          fetch(`${API_BASE}products/categories`),
          fetch(`${API_BASE}products/units`),
          fetch(`${API_BASE}sales/cultures`),
        ]);

      setSales(await salesRes.json());
      setProducts(await productsRes.json());
      setClients(await clientsRes.json());
      setConsultants(await consultantsRes.json());
      setPeriods(await periodsRes.json());
      setCategories(await categoriesRes.json());
      setUnits(await unitsRes.json());
      setCultures(await culturesRes.json());
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  // Vendas filtradas (para tab Vendas)
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (filterPeriodType && s.period_type !== filterPeriodType) return false;
      if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
      if (filterRegion && s.client_region !== filterRegion) return false;
      if (filterCategory && s.product_category !== filterCategory) return false;
      if (filterDateStart && s.sale_date && s.sale_date < filterDateStart) return false;
      if (filterDateEnd && s.sale_date && s.sale_date > filterDateEnd) return false;
      return true;
    });
  }, [sales, filterPeriodType, filterPeriodYear, filterRegion, filterCategory, filterDateStart, filterDateEnd]);

  // Dados para uma categoria específica ou visão geral
  function getCategoryData(category: string | null) {
    let relevantSales = sales;

    // Aplica filtros de período, região e data
    relevantSales = relevantSales.filter((s) => {
      if (filterPeriodType && s.period_type !== filterPeriodType) return false;
      if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
      if (filterRegion && s.client_region !== filterRegion) return false;
      if (category && s.product_category !== category) return false;
      if (filterDateStart && s.sale_date && s.sale_date < filterDateStart) return false;
      if (filterDateEnd && s.sale_date && s.sale_date > filterDateEnd) return false;
      return true;
    });

    const totalValue = relevantSales.reduce((sum, s) => sum + (s.value || 0), 0);
    const totalQuantity = relevantSales.reduce((sum, s) => sum + s.quantity, 0);
    const totalSales = relevantSales.length;
    const uniqueClients = new Set(relevantSales.map((s) => s.client_id)).size;
    const unitValue = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // Agrupar por cliente
    const clientMap: Record<number, {
      client_id: number;
      client_name: string;
      region: string | null;
      sales_count: number;
      total_value: number;
      total_quantity: number;
      products: { product_name: string; product_category: string; quantity: number; unit: string; value: number }[];
    }> = {};

    for (const sale of relevantSales) {
      if (!clientMap[sale.client_id]) {
        clientMap[sale.client_id] = {
          client_id: sale.client_id,
          client_name: sale.client_name,
          region: sale.client_region,
          sales_count: 0,
          total_value: 0,
          total_quantity: 0,
          products: [],
        };
      }
      clientMap[sale.client_id].sales_count += 1;
      clientMap[sale.client_id].total_value += sale.value || 0;
      clientMap[sale.client_id].total_quantity += sale.quantity;

      // Agrupar produtos
      const existingProduct = clientMap[sale.client_id].products.find(
        (p) => p.product_name === sale.product_name
      );
      if (existingProduct) {
        existingProduct.quantity += sale.quantity;
        existingProduct.value += sale.value || 0;
      } else {
        clientMap[sale.client_id].products.push({
          product_name: sale.product_name,
          product_category: sale.product_category,
          quantity: sale.quantity,
          unit: sale.unit,
          value: sale.value || 0,
        });
      }
    }

    const clientRanking = Object.values(clientMap).sort((a, b) => b.total_value - a.total_value);

    // Mix de categorias (só para visão geral)
    const categoryMix: { category: string; total_value: number; sales_count: number; percentage: number }[] = [];
    if (!category) {
      const catMap: Record<string, { total_value: number; sales_count: number }> = {};
      for (const sale of relevantSales) {
        if (!catMap[sale.product_category]) {
          catMap[sale.product_category] = { total_value: 0, sales_count: 0 };
        }
        catMap[sale.product_category].total_value += sale.value || 0;
        catMap[sale.product_category].sales_count += 1;
      }
      for (const [cat, data] of Object.entries(catMap)) {
        categoryMix.push({
          category: cat,
          total_value: data.total_value,
          sales_count: data.sales_count,
          percentage: totalValue > 0 ? Math.round((data.total_value / totalValue) * 1000) / 10 : 0,
        });
      }
      categoryMix.sort((a, b) => b.total_value - a.total_value);
    }

    // Ranking de produtos (só para categoria específica)
    const productRanking: { product_name: string; total_value: number; total_quantity: number; unit: string }[] = [];
    if (category) {
      const prodMap: Record<string, { total_value: number; total_quantity: number; unit: string }> = {};
      for (const sale of relevantSales) {
        if (!prodMap[sale.product_name]) {
          prodMap[sale.product_name] = { total_value: 0, total_quantity: 0, unit: sale.unit };
        }
        prodMap[sale.product_name].total_value += sale.value || 0;
        prodMap[sale.product_name].total_quantity += sale.quantity;
      }
      for (const [name, data] of Object.entries(prodMap)) {
        productRanking.push({ product_name: name, ...data });
      }
      productRanking.sort((a, b) => b.total_value - a.total_value);
    }

    // Detectar unidade predominante das vendas filtradas
    const unitCounts: Record<string, number> = {};
    for (const sale of relevantSales) {
      unitCounts[sale.unit] = (unitCounts[sale.unit] || 0) + sale.quantity;
    }
    const predominantUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    return {
      totalValue,
      totalQuantity,
      totalSales,
      uniqueClients,
      unitValue,
      clientRanking,
      categoryMix,
      productRanking,
      predominantUnit,
    };
  }

  function toggleClientExpand(clientId: number) {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortClientRanking<T extends { sales_count: number; total_value: number; total_quantity: number }>(
    data: T[]
  ): T[] {
    return [...data].sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortField === "unit_value") {
        aVal = a.total_quantity > 0 ? a.total_value / a.total_quantity : 0;
        bVal = b.total_quantity > 0 ? b.total_value / b.total_quantity : 0;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  // ============================================================
  // CRUD Vendas
  // ============================================================

  function openSaleModal(sale?: Sale) {
    refreshClients();
    if (sale) {
      setEditingSale(sale);
      const client = clients.find((c) => c.id === sale.client_id);
      setSaleForm({
        client_id: String(sale.client_id),
        product_id: String(sale.product_id),
        consultant_id: sale.consultant_id ? String(sale.consultant_id) : "",
        quantity: String(sale.quantity),
        unit: sale.unit,
        value: sale.value ? String(sale.value) : "",
        period_type: sale.period_type,
        period_year: sale.period_year,
        culture: sale.culture || "",
        sale_date: sale.sale_date || "",
        notes: sale.notes || "",
      });
      setClientSearch(client?.name || "");
    } else {
      setEditingSale(null);
      setSaleForm({
        client_id: "",
        product_id: "",
        consultant_id: "",
        quantity: "",
        unit: "",
        value: "",
        period_type: "",
        period_year: "",
        culture: "",
        sale_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setClientSearch("");
    }
    setShowClientSuggestions(false);
    setOpenSale(true);
  }

  async function refreshClients() {
    try {
      const res = await fetch(`${API_BASE}clients`);
      const data = await res.json();
      setClients(data || []);
    } catch (err) {
      console.error("Erro ao atualizar clientes:", err);
    }
  }

  function closeSaleModal() {
    setOpenSale(false);
    setEditingSale(null);
    setClientSearch("");
    setShowClientSuggestions(false);
  }

  async function saveSale() {
    if (!saleForm.client_id || !saleForm.product_id || !saleForm.quantity) {
      notify.warning("Cliente, produto e quantidade são obrigatórios");
      return;
    }
    if (!saleForm.period_type || !saleForm.period_year) {
      notify.warning("Selecione o período (Safra/Safrinha)");
      return;
    }
    if (!saleForm.unit) {
      notify.warning("Selecione a unidade");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_id: Number(saleForm.client_id),
        product_id: Number(saleForm.product_id),
        consultant_id: saleForm.consultant_id ? Number(saleForm.consultant_id) : null,
        quantity: Number(saleForm.quantity),
        unit: saleForm.unit,
        value: saleForm.value ? Number(saleForm.value) : null,
        period_type: saleForm.period_type,
        period_year: saleForm.period_year,
        culture: saleForm.culture || null,
        sale_date: saleForm.sale_date || null,
        notes: saleForm.notes || null,
      };

      let res;
      if (editingSale) {
        res = await fetch(`${API_BASE}sales/${editingSale.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}sales`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      notify.success(editingSale ? "Venda atualizada" : "Venda registrada");
      closeSaleModal();
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar venda";
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function deleteSale(id: number) {
    toastConfirm("Deseja excluir esta venda?", async () => {
      try {
        const res = await fetch(`${API_BASE}sales/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setSales((list) => list.filter((s) => s.id !== id));
        notify.success("Venda excluída");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao excluir";
        notify.error(message);
      }
    });
  }

  // ============================================================
  // CRUD Produtos
  // ============================================================

  function openProductModal(product?: Product) {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        category: product.category,
        default_unit: product.default_unit,
        culture: product.culture || "",
        seeds_per_ha: product.seeds_per_ha ? String(product.seeds_per_ha) : "",
      });
    } else {
      setEditingProduct(null);
      setProductForm({ name: "", category: "", default_unit: "", culture: "", seeds_per_ha: "" });
    }
    setOpenProduct(true);
  }

  async function saveProduct() {
    if (!productForm.name || !productForm.category || !productForm.default_unit) {
      notify.warning("Nome, categoria e unidade são obrigatórios");
      return;
    }

    if (productForm.category === "Semente" && productForm.default_unit === "BB" && !productForm.seeds_per_ha) {
      notify.warning("Para sementes em BB, informe a população de sementes/ha");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: productForm.name,
        category: productForm.category,
        default_unit: productForm.default_unit,
        culture: productForm.culture || null,
        seeds_per_ha: productForm.seeds_per_ha ? Number(productForm.seeds_per_ha) : null,
      };

      let res;
      if (editingProduct) {
        res = await fetch(`${API_BASE}products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      notify.success(editingProduct ? "Produto atualizado" : "Produto cadastrado");
      setOpenProduct(false);
      setEditingProduct(null);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar produto";
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function deleteProduct(id: number) {
    toastConfirm("Deseja excluir este produto? Se houver vendas vinculadas, ele será desativado.", async () => {
      try {
        const res = await fetch(`${API_BASE}products/${id}`, { method: "DELETE" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || `status ${res.status}`);
        notify.success(body.message || "Produto excluído");
        loadData();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao excluir";
        notify.error(message);
      }
    });
  }

  function handleProductChange(productId: string) {
    setSaleForm((f) => {
      const product = products.find((p) => p.id === Number(productId));
      return {
        ...f,
        product_id: productId,
        unit: product?.default_unit || f.unit,
      };
    });
  }

  function handlePeriodChange(periodLabel: string) {
    const period = periods.find((p) => p.label === periodLabel);
    if (period) {
      setSaleForm((f) => ({
        ...f,
        period_type: period.type,
        period_year: period.year,
      }));
    }
  }

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  function renderFilters() {
    return (
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            label="Período"
            value={
              filterPeriodType && filterPeriodYear
                ? `${filterPeriodType} ${filterPeriodYear}`
                : ""
            }
            onChange={(e) => {
              const period = periods.find((p) => p.label === e.target.value);
              if (period) {
                setFilterPeriodType(period.type);
                setFilterPeriodYear(period.year);
              } else {
                setFilterPeriodType("");
                setFilterPeriodYear("");
              }
            }}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {periods.map((p) => (
              <MenuItem key={p.label} value={p.label}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Região"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {regions.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="date"
            label="Data Início"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            type="date"
            label="Data Fim"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Card>
    );
  }

  function renderClientRanking(
    clientRanking: ReturnType<typeof getCategoryData>["clientRanking"],
    showQuantity: boolean,
    unit?: string
  ) {
    const sorted = sortClientRanking(clientRanking);

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Ranking de Clientes
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }} width={50}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "sales_count"}
                      direction={sortField === "sales_count" ? sortDir : "desc"}
                      onClick={() => handleSort("sales_count")}
                    >
                      Vendas
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "total_value"}
                      direction={sortField === "total_value" ? sortDir : "desc"}
                      onClick={() => handleSort("total_value")}
                    >
                      Faturamento
                    </TableSortLabel>
                  </TableCell>
                  {showQuantity && (
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      <TableSortLabel
                        active={sortField === "total_quantity"}
                        direction={sortField === "total_quantity" ? sortDir : "desc"}
                        onClick={() => handleSort("total_quantity")}
                      >
                        Volume ({unit})
                      </TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "unit_value"}
                      direction={sortField === "unit_value" ? sortDir : "desc"}
                      onClick={() => handleSort("unit_value")}
                    >
                      Valor Unitário
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width={50}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((c, idx) => {
                  const isExpanded = expandedClients.has(c.client_id);
                  return (
                    <React.Fragment key={c.client_id}>
                      <TableRow
                        hover
                        onClick={() => c.products.length > 0 && toggleClientExpand(c.client_id)}
                        sx={{ cursor: c.products.length > 0 ? "pointer" : "default" }}
                      >
                        <TableCell>
                          <Chip
                            label={`#${idx + 1}`}
                            size="small"
                            color={idx < 3 ? "primary" : "default"}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{c.client_name}</TableCell>
                        <TableCell>{c.region || "-"}</TableCell>
                        <TableCell align="right">{c.sales_count}</TableCell>
                        <TableCell align="right">{formatCurrency(c.total_value)}</TableCell>
                        {showQuantity && (
                          <TableCell align="right">{formatNumber(c.total_quantity)}</TableCell>
                        )}
                        <TableCell align="right">
                          {formatCurrency(c.total_quantity > 0 ? c.total_value / c.total_quantity : 0)}
                        </TableCell>
                        <TableCell>
                          {c.products.length > 0 && (
                            <IconButton size="small">
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                      {c.products.length > 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={showQuantity ? 8 : 7}
                            sx={{ py: 0, borderBottom: isExpanded ? 1 : 0, borderColor: "divider" }}
                          >
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, pl: 6, pr: 2, bgcolor: "action.hover", borderRadius: 1, my: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  Detalhamento por Produto
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600 }}>Produto</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Categoria</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">Quantidade</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }} align="right">Valor Unitário</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {c.products.map((p, i) => (
                                      <TableRow key={i}>
                                        <TableCell>{p.product_name}</TableCell>
                                        <TableCell>
                                          <Chip label={p.product_category} size="small" />
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatNumber(p.quantity)} {p.unit}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatCurrency(p.quantity > 0 ? p.value / p.quantity : 0)}/{p.unit}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showQuantity ? 8 : 7} align="center">
                      <Typography color="text.secondary" variant="body2">
                        Sem dados
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Build tabs dynamically
  const tabs: { key: string; label: string; icon: React.ReactElement }[] = [
    { key: "vendas", label: "Vendas", icon: <MoneyIcon /> },
    { key: "visao-geral", label: "Visão Geral", icon: <OverviewIcon /> },
    ...categoriesWithSales.map((cat) => ({
      key: cat,
      label: cat,
      icon: (CATEGORY_CONFIG[cat]?.icon as React.ReactElement) || <InventoryIcon />,
    })),
    { key: "produtos", label: "Produtos", icon: <InventoryIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Vendas
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
            onClick={() => openProductModal()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Novo Produto
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openSaleModal()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Nova Venda
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{
              textTransform: "none",
              minHeight: 48,
              ...(CATEGORY_CONFIG[tab.key] && {
                "&.Mui-selected": {
                  color: CATEGORY_CONFIG[tab.key].color,
                },
              }),
            }}
          />
        ))}
      </Tabs>

      {/* Tab: Vendas */}
      {activeTab === "vendas" && (
        <>
          <Card sx={{ mb: 3, p: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                select
                label="Período"
                value={
                  filterPeriodType && filterPeriodYear
                    ? `${filterPeriodType} ${filterPeriodYear}`
                    : ""
                }
                onChange={(e) => {
                  const period = periods.find((p) => p.label === e.target.value);
                  if (period) {
                    setFilterPeriodType(period.type);
                    setFilterPeriodYear(period.year);
                  } else {
                    setFilterPeriodType("");
                    setFilterPeriodYear("");
                  }
                }}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {periods.map((p) => (
                  <MenuItem key={p.label} value={p.label}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Região"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {regions.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Categoria"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Card>

          <Card>
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Produto</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Qtd</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Valor</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Período</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSales.map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{s.client_name}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{s.product_name}</Typography>
                            <Chip
                              label={s.product_category}
                              size="small"
                              sx={{ mt: 0.5, fontSize: "0.7rem", height: 20 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          {formatNumber(s.quantity)} {s.unit}
                        </TableCell>
                        <TableCell>{formatCurrency(s.value)}</TableCell>
                        <TableCell>{s.period_label}</TableCell>
                        <TableCell>{s.client_region || "-"}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="primary" onClick={() => openSaleModal(s)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteSale(s.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">Nenhuma venda registrada</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Visão Geral */}
      {activeTab === "visao-geral" && (() => {
        const data = getCategoryData(null);
        return (
          <>
            {renderFilters()}

            {/* Cards de Resumo (sem volume) */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "primary.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <MoneyIcon fontSize="small" />
                      <Typography variant="caption">Faturamento</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatCurrency(data.totalValue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "success.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TrendingUpIcon fontSize="small" />
                      <Typography variant="caption">Vendas</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {data.totalSales}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "info.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PeopleIcon fontSize="small" />
                      <Typography variant="caption">Clientes</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {data.uniqueClients}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "secondary.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BarChartIcon fontSize="small" />
                      <Typography variant="caption">Valor Unitário Médio</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatCurrency(data.unitValue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Mix de Categorias */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Mix de Produtos
                </Typography>
                <Grid container spacing={2}>
                  {data.categoryMix.map((cat) => {
                    const config = CATEGORY_CONFIG[cat.category];
                    return (
                      <Grid key={cat.category} size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Card
                          variant="outlined"
                          sx={{
                            p: 2,
                            textAlign: "center",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: config?.color || "primary.main",
                              transform: "translateY(-2px)",
                            },
                          }}
                          onClick={() => setActiveTab(cat.category)}
                        >
                          <Box sx={{ color: config?.color || "primary.main", mb: 1 }}>
                            {config?.icon || <InventoryIcon />}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {cat.category}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: config?.color }}>
                            {cat.percentage}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatCurrency(cat.total_value)}
                          </Typography>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>

            {/* Ranking de Clientes */}
            {renderClientRanking(data.clientRanking, false)}
          </>
        );
      })()}

      {/* Tab: Categoria específica */}
      {categoriesWithSales.includes(activeTab) && (() => {
        const data = getCategoryData(activeTab);
        const config = CATEGORY_CONFIG[activeTab];
        const unit = data.predominantUnit || config?.unit || "un";

        return (
          <>
            {renderFilters()}

            {/* Cards de Resumo (com volume) */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: config?.color || "primary.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <MoneyIcon fontSize="small" />
                      <Typography variant="caption">Faturamento</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatCurrency(data.totalValue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "success.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TrendingUpIcon fontSize="small" />
                      <Typography variant="caption">Vendas</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {data.totalSales}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "warning.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <InventoryIcon fontSize="small" />
                      <Typography variant="caption">Volume ({unit})</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatNumber(data.totalQuantity)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Card sx={{ bgcolor: "secondary.main", color: "white" }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BarChartIcon fontSize="small" />
                      <Typography variant="caption">Valor Unitário Médio</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatCurrency(data.unitValue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Produtos mais vendidos */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Produtos Mais Vendidos
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Produto</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Volume ({unit})</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Faturamento</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.productRanking.map((p, idx) => (
                        <TableRow key={p.product_name} hover>
                          <TableCell>
                            <Chip label={`#${idx + 1}`} size="small" color={idx < 3 ? "primary" : "default"} />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{p.product_name}</TableCell>
                          <TableCell align="right">{formatNumber(p.total_quantity)}</TableCell>
                          <TableCell align="right">{formatCurrency(p.total_value)}</TableCell>
                        </TableRow>
                      ))}
                      {data.productRanking.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography color="text.secondary" variant="body2">Sem dados</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Ranking de Clientes */}
            {renderClientRanking(data.clientRanking, true, unit)}
          </>
        );
      })()}

      {/* Tab: Produtos */}
      {activeTab === "produtos" && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Catálogo de Produtos
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Categoria</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Unidade</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Cultura</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>População</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>
                        <Chip label={p.category} size="small" />
                      </TableCell>
                      <TableCell>{p.default_unit}</TableCell>
                      <TableCell>{p.culture || "-"}</TableCell>
                      <TableCell>
                        {p.seeds_per_ha ? `${formatNumber(p.seeds_per_ha)} sem/ha` : "-"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={p.active ? "Ativo" : "Inativo"}
                          size="small"
                          color={p.active ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="primary" onClick={() => openProductModal(p)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteProduct(p.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">Nenhum produto cadastrado</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Modal de Venda */}
      <Dialog
        open={openSale}
        onClose={closeSaleModal}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingSale ? "Editar Venda" : "Nova Venda"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ position: "relative" }}>
              <TextField
                label="Cliente"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientSuggestions(true);
                  setSaleForm((f) => ({ ...f, client_id: "" }));
                }}
                onFocus={() => setShowClientSuggestions(true)}
                placeholder="Digite o nome do cliente"
                fullWidth
                error={!saleForm.client_id && clientSearch.length > 0}
                helperText={
                  saleForm.client_id
                    ? `Cliente selecionado: ${clientSearch}`
                    : "Selecione um cliente da lista"
                }
                color={saleForm.client_id ? "success" : undefined}
              />
              {showClientSuggestions && (
                <Paper
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    maxHeight: 220,
                    overflow: "auto",
                    mt: 0.5,
                  }}
                  elevation={4}
                >
                  <List disablePadding>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c) => (
                        <ListItemButton
                          key={c.id}
                          onClick={() => {
                            setSaleForm((f) => ({ ...f, client_id: String(c.id) }));
                            setClientSearch(c.name);
                            setShowClientSuggestions(false);
                          }}
                        >
                          <ListItemText primary={c.name} secondary={c.region || "Sem região"} />
                        </ListItemButton>
                      ))
                    ) : (
                      <ListItemButton disabled>
                        <ListItemText primary="Nenhum cliente encontrado" />
                      </ListItemButton>
                    )}
                  </List>
                </Paper>
              )}
            </Box>

            <TextField
              select
              label="Produto"
              value={saleForm.product_id}
              onChange={(e) => handleProductChange(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="">Selecione um produto</MenuItem>
              {products
                .filter((p) => p.active)
                .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
                .map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    [{p.category}] {p.name}
                  </MenuItem>
                ))}
            </TextField>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Quantidade"
                  type="number"
                  value={saleForm.quantity}
                  onChange={(e) => setSaleForm((f) => ({ ...f, quantity: e.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Unidade"
                  value={saleForm.unit}
                  onChange={(e) => setSaleForm((f) => ({ ...f, unit: e.target.value }))}
                  fullWidth
                  required
                >
                  {units.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Valor Total (R$)"
              type="number"
              value={saleForm.value}
              onChange={(e) => setSaleForm((f) => ({ ...f, value: e.target.value }))}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                },
              }}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Período"
                  value={
                    saleForm.period_type && saleForm.period_year
                      ? `${saleForm.period_type} ${saleForm.period_year}`
                      : ""
                  }
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="">Selecione o período</MenuItem>
                  {periods.map((p) => (
                    <MenuItem key={p.label} value={p.label}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Cultura"
                  value={saleForm.culture}
                  onChange={(e) => setSaleForm((f) => ({ ...f, culture: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="">Nenhuma</MenuItem>
                  {cultures.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Data da Venda"
                  type="date"
                  value={saleForm.sale_date}
                  onChange={(e) => setSaleForm((f) => ({ ...f, sale_date: e.target.value }))}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Consultor"
                  value={saleForm.consultant_id}
                  onChange={(e) => setSaleForm((f) => ({ ...f, consultant_id: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {consultants.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Observações"
              value={saleForm.notes}
              onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeSaleModal} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveSale} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Produto */}
      <Dialog
        open={openProduct}
        onClose={() => { setOpenProduct(false); setEditingProduct(null); }}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingProduct ? "Editar Produto" : "Novo Produto"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Nome do Produto"
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              select
              label="Categoria"
              value={productForm.category}
              onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
              fullWidth
              required
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Unidade Padrão"
              value={productForm.default_unit}
              onChange={(e) => setProductForm((f) => ({ ...f, default_unit: e.target.value }))}
              fullWidth
              required
            >
              {units.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>

            {productForm.category === "Semente" && (
              <>
                <TextField
                  select
                  label="Cultura"
                  value={productForm.culture}
                  onChange={(e) => setProductForm((f) => ({ ...f, culture: e.target.value }))}
                  fullWidth
                  helperText="Cultura da semente (Soja, Milho, Algodão)"
                >
                  <MenuItem value="">Não especificada</MenuItem>
                  {cultures.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>

                {productForm.default_unit === "BB" && (
                  <TextField
                    label="População (sementes/ha)"
                    type="number"
                    value={productForm.seeds_per_ha}
                    onChange={(e) => setProductForm((f) => ({ ...f, seeds_per_ha: e.target.value }))}
                    fullWidth
                    required
                    helperText="Ex: 300000 (300 mil sementes/ha). BB = 3.000.000 sementes"
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">sem/ha</InputAdornment>,
                      },
                    }}
                  />
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setOpenProduct(false); setEditingProduct(null); }} color="inherit">
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveProduct} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Sales;
