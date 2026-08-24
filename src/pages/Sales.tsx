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
} from "@mui/icons-material";
import { API_BASE } from "../config";
import { notify, confirm as toastConfirm } from "../utils/toast";

type Product = {
  id: number;
  name: string;
  category: string;
  default_unit: string;
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
  sale_date: string | null;
  notes: string | null;
};

type Client = { id: number; name: string; region: string | null };
type Consultant = { id: number; name: string };
type Period = { type: string; year: string; label: string };

type ReportSummary = {
  total_sales: number;
  total_value: number;
  total_quantity: number;
  unique_clients: number;
};

type RegionReport = {
  region: string;
  sales_count: number;
  total_value: number;
  total_quantity: number;
  clients_count: number;
};

type CategoryReport = {
  category: string;
  sales_count: number;
  total_value: number;
  total_quantity: number;
  percentage: number;
};

type ClientReport = {
  rank: number;
  client_id: number;
  client_name: string;
  region: string | null;
  sales_count: number;
  total_value: number;
  total_quantity: number;
};

type SortDirection = "asc" | "desc";
type SortField = "sales_count" | "total_value" | "total_quantity" | "avg_value";

const Sales: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
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

  // Filtros
  const [filterPeriodType, setFilterPeriodType] = useState("");
  const [filterPeriodYear, setFilterPeriodYear] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [reportFilterCategory, setReportFilterCategory] = useState("");

  // Relatórios
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [regionReport, setRegionReport] = useState<RegionReport[]>([]);
  const [categoryReport, setCategoryReport] = useState<CategoryReport[]>([]);
  const [clientReport, setClientReport] = useState<ClientReport[]>([]);

  // Ordenação
  const [regionSortField, setRegionSortField] = useState<SortField>("total_value");
  const [regionSortDir, setRegionSortDir] = useState<SortDirection>("desc");
  const [categorySortField, setCategorySortField] = useState<SortField>("total_value");
  const [categorySortDir, setCategorySortDir] = useState<SortDirection>("desc");
  const [clientSortField, setClientSortField] = useState<SortField>("total_value");
  const [clientSortDir, setClientSortDir] = useState<SortDirection>("desc");

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
    sale_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Modal de produto
  const [openProduct, setOpenProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    default_unit: "",
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

  // Recarregar relatórios quando filtros mudam
  useEffect(() => {
    if (tabIndex === 1) {
      loadReports();
    }
  }, [tabIndex, filterPeriodType, filterPeriodYear, filterRegion, reportFilterCategory]);

  async function loadData() {
    setLoading(true);
    try {
      const [salesRes, productsRes, clientsRes, consultantsRes, periodsRes, categoriesRes, unitsRes] =
        await Promise.all([
          fetch(`${API_BASE}sales`),
          fetch(`${API_BASE}products`),
          fetch(`${API_BASE}clients`),
          fetch(`${API_BASE}consultants`),
          fetch(`${API_BASE}sales/periods`),
          fetch(`${API_BASE}products/categories`),
          fetch(`${API_BASE}products/units`),
        ]);

      setSales(await salesRes.json());
      setProducts(await productsRes.json());
      setClients(await clientsRes.json());
      setConsultants(await consultantsRes.json());
      setPeriods(await periodsRes.json());
      setCategories(await categoriesRes.json());
      setUnits(await unitsRes.json());
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    try {
      const params = new URLSearchParams();
      if (filterPeriodType) params.append("period_type", filterPeriodType);
      if (filterPeriodYear) params.append("period_year", filterPeriodYear);
      if (filterRegion) params.append("region", filterRegion);
      if (reportFilterCategory) params.append("category", reportFilterCategory);

      const queryStr = params.toString() ? `?${params}` : "";

      const [summaryRes, regionRes, categoryRes, clientRes] = await Promise.all([
        fetch(`${API_BASE}sales/report/summary${queryStr}`),
        fetch(`${API_BASE}sales/report/by-region${queryStr}`),
        fetch(`${API_BASE}sales/report/by-category${queryStr}`),
        fetch(`${API_BASE}sales/report/by-client${queryStr}`),
      ]);

      setSummary(await summaryRes.json());
      setRegionReport(await regionRes.json());
      setCategoryReport(await categoryRes.json());
      setClientReport(await clientRes.json());
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
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

  // Vendas filtradas
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (filterPeriodType && s.period_type !== filterPeriodType) return false;
      if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
      if (filterRegion && s.client_region !== filterRegion) return false;
      if (filterCategory && s.product_category !== filterCategory) return false;
      return true;
    });
  }, [sales, filterPeriodType, filterPeriodYear, filterRegion, filterCategory]);

  // Ordenação de relatórios
  function sortData<T extends { sales_count: number; total_value: number; total_quantity: number }>(
    data: T[],
    field: SortField,
    direction: SortDirection
  ): T[] {
    return [...data].sort((a, b) => {
      let aVal: number, bVal: number;
      if (field === "avg_value") {
        aVal = a.sales_count > 0 ? a.total_value / a.sales_count : 0;
        bVal = b.sales_count > 0 ? b.total_value / b.sales_count : 0;
      } else {
        aVal = a[field];
        bVal = b[field];
      }
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  const sortedRegionReport = useMemo(
    () => sortData(regionReport, regionSortField, regionSortDir),
    [regionReport, regionSortField, regionSortDir]
  );

  const sortedCategoryReport = useMemo(
    () => sortData(categoryReport, categorySortField, categorySortDir),
    [categoryReport, categorySortField, categorySortDir]
  );

  const sortedClientReport = useMemo(
    () => sortData(clientReport, clientSortField, clientSortDir),
    [clientReport, clientSortField, clientSortDir]
  );

  // Vendas agrupadas por cliente e produto
  const clientProductBreakdown = useMemo(() => {
    const breakdown: Record<number, { product_name: string; product_category: string; total_value: number; quantity: number; unit: string }[]> = {};

    // Filtra vendas pelo filtro de categoria do relatório
    const relevantSales = reportFilterCategory
      ? sales.filter(s => s.product_category === reportFilterCategory)
      : sales;

    // Também aplica filtros de período e região
    const filteredReportSales = relevantSales.filter(s => {
      if (filterPeriodType && s.period_type !== filterPeriodType) return false;
      if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
      if (filterRegion && s.client_region !== filterRegion) return false;
      return true;
    });

    for (const sale of filteredReportSales) {
      if (!breakdown[sale.client_id]) {
        breakdown[sale.client_id] = [];
      }
      const existing = breakdown[sale.client_id].find(
        (p) => p.product_name === sale.product_name
      );
      if (existing) {
        existing.total_value += sale.value || 0;
        existing.quantity += sale.quantity;
      } else {
        breakdown[sale.client_id].push({
          product_name: sale.product_name,
          product_category: sale.product_category,
          total_value: sale.value || 0,
          quantity: sale.quantity,
          unit: sale.unit,
        });
      }
    }
    return breakdown;
  }, [sales, reportFilterCategory, filterPeriodType, filterPeriodYear, filterRegion]);

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

  function handleSort(
    currentField: SortField,
    currentDir: SortDirection,
    newField: SortField,
    setField: (f: SortField) => void,
    setDir: (d: SortDirection) => void
  ) {
    if (currentField === newField) {
      setDir(currentDir === "asc" ? "desc" : "asc");
    } else {
      setField(newField);
      setDir("desc");
    }
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

  function openProductModal() {
    setProductForm({ name: "", category: "", default_unit: "" });
    setOpenProduct(true);
  }

  async function saveProduct() {
    if (!productForm.name || !productForm.category || !productForm.default_unit) {
      notify.warning("Todos os campos são obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      notify.success("Produto cadastrado");
      setOpenProduct(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar produto";
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Handler para quando produto é selecionado
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

  // Handler para quando período é selecionado
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

  // Valor médio
  const avgValue = summary && summary.total_sales > 0
    ? summary.total_value / summary.total_sales
    : 0;

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
            onClick={openProductModal}
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
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        sx={{ mb: 3 }}
      >
        <Tab label="Vendas" icon={<MoneyIcon />} iconPosition="start" />
        <Tab label="Relatórios" icon={<BarChartIcon />} iconPosition="start" />
        <Tab label="Produtos" icon={<InventoryIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab: Vendas */}
      {tabIndex === 0 && (
        <>
          {/* Filtros */}
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

          {/* Tabela de Vendas */}
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
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => openSaleModal(s)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteSale(s.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            Nenhuma venda registrada
                          </Typography>
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

      {/* Tab: Relatórios */}
      {tabIndex === 1 && (
        <>
          {/* Filtros de Relatório */}
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
                value={reportFilterCategory}
                onChange={(e) => setReportFilterCategory(e.target.value)}
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

          {/* Cards de Resumo */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <Card sx={{ bgcolor: "primary.main", color: "white" }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <MoneyIcon fontSize="small" />
                    <Typography variant="caption">Faturamento</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {formatCurrency(summary?.total_value || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <Card sx={{ bgcolor: "success.main", color: "white" }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TrendingUpIcon fontSize="small" />
                    <Typography variant="caption">Vendas</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {summary?.total_sales || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <Card sx={{ bgcolor: "warning.main", color: "white" }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <InventoryIcon fontSize="small" />
                    <Typography variant="caption">Volume</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {formatNumber(summary?.total_quantity || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <Card sx={{ bgcolor: "info.main", color: "white" }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PeopleIcon fontSize="small" />
                    <Typography variant="caption">Clientes</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {summary?.unique_clients || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <Card sx={{ bgcolor: "secondary.main", color: "white" }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BarChartIcon fontSize="small" />
                    <Typography variant="caption">Ticket Médio</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {formatCurrency(avgValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Por Região */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Por Região
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={regionSortField === "sales_count"}
                              direction={regionSortField === "sales_count" ? regionSortDir : "desc"}
                              onClick={() => handleSort(regionSortField, regionSortDir, "sales_count", setRegionSortField, setRegionSortDir)}
                            >
                              Vendas
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={regionSortField === "total_value"}
                              direction={regionSortField === "total_value" ? regionSortDir : "desc"}
                              onClick={() => handleSort(regionSortField, regionSortDir, "total_value", setRegionSortField, setRegionSortDir)}
                            >
                              Faturamento
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={regionSortField === "avg_value"}
                              direction={regionSortField === "avg_value" ? regionSortDir : "desc"}
                              onClick={() => handleSort(regionSortField, regionSortDir, "avg_value", setRegionSortField, setRegionSortDir)}
                            >
                              Ticket Médio
                            </TableSortLabel>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedRegionReport.map((r) => (
                          <TableRow key={r.region} hover>
                            <TableCell sx={{ fontWeight: 500 }}>{r.region}</TableCell>
                            <TableCell align="right">{r.sales_count}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(r.total_value)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(r.sales_count > 0 ? r.total_value / r.sales_count : 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {sortedRegionReport.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
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
            </Grid>

            {/* Por Categoria */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Mix de Produtos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Categoria</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={categorySortField === "sales_count"}
                              direction={categorySortField === "sales_count" ? categorySortDir : "desc"}
                              onClick={() => handleSort(categorySortField, categorySortDir, "sales_count", setCategorySortField, setCategorySortDir)}
                            >
                              Vendas
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={categorySortField === "total_value"}
                              direction={categorySortField === "total_value" ? categorySortDir : "desc"}
                              onClick={() => handleSort(categorySortField, categorySortDir, "total_value", setCategorySortField, setCategorySortDir)}
                            >
                              Faturamento
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            %
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedCategoryReport.map((c) => (
                          <TableRow key={c.category} hover>
                            <TableCell sx={{ fontWeight: 500 }}>{c.category}</TableCell>
                            <TableCell align="right">{c.sales_count}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(c.total_value)}
                            </TableCell>
                            <TableCell align="right">{c.percentage}%</TableCell>
                          </TableRow>
                        ))}
                        {sortedCategoryReport.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
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
            </Grid>

            {/* Ranking de Clientes */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Ranking de Clientes
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }} width={50}>
                            #
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={clientSortField === "sales_count"}
                              direction={clientSortField === "sales_count" ? clientSortDir : "desc"}
                              onClick={() => handleSort(clientSortField, clientSortDir, "sales_count", setClientSortField, setClientSortDir)}
                            >
                              Vendas
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={clientSortField === "total_value"}
                              direction={clientSortField === "total_value" ? clientSortDir : "desc"}
                              onClick={() => handleSort(clientSortField, clientSortDir, "total_value", setClientSortField, setClientSortDir)}
                            >
                              Faturamento
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">
                            <TableSortLabel
                              active={clientSortField === "avg_value"}
                              direction={clientSortField === "avg_value" ? clientSortDir : "desc"}
                              onClick={() => handleSort(clientSortField, clientSortDir, "avg_value", setClientSortField, setClientSortDir)}
                            >
                              Ticket Médio
                            </TableSortLabel>
                          </TableCell>
                          <TableCell width={50}></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedClientReport.map((c, idx) => {
                          const isExpanded = expandedClients.has(c.client_id);
                          const breakdown = clientProductBreakdown[c.client_id] || [];
                          return (
                            <React.Fragment key={c.client_id}>
                              <TableRow
                                hover
                                onClick={() => breakdown.length > 0 && toggleClientExpand(c.client_id)}
                                sx={{ cursor: breakdown.length > 0 ? "pointer" : "default" }}
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
                                <TableCell align="right">
                                  {formatCurrency(c.total_value)}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(c.sales_count > 0 ? c.total_value / c.sales_count : 0)}
                                </TableCell>
                                <TableCell>
                                  {breakdown.length > 0 && (
                                    <IconButton size="small">
                                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                  )}
                                </TableCell>
                              </TableRow>
                              {breakdown.length > 0 && (
                                <TableRow>
                                  <TableCell colSpan={7} sx={{ py: 0, borderBottom: isExpanded ? 1 : 0, borderColor: "divider" }}>
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
                                              <TableCell sx={{ fontWeight: 600 }} align="right">Valor</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {breakdown.map((p, i) => (
                                              <TableRow key={i}>
                                                <TableCell>{p.product_name}</TableCell>
                                                <TableCell>
                                                  <Chip label={p.product_category} size="small" />
                                                </TableCell>
                                                <TableCell align="right">
                                                  {formatNumber(p.quantity)} {p.unit}
                                                </TableCell>
                                                <TableCell align="right">
                                                  {formatCurrency(p.total_value)}
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
                        {sortedClientReport.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} align="center">
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
            </Grid>
          </Grid>
        </>
      )}

      {/* Tab: Produtos */}
      {tabIndex === 2 && (
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
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
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
                      <TableCell>
                        <Chip
                          label={p.active ? "Ativo" : "Inativo"}
                          size="small"
                          color={p.active ? "success" : "default"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Nenhum produto cadastrado
                        </Typography>
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
            {/* Cliente com autocomplete */}
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
                          <ListItemText
                            primary={c.name}
                            secondary={c.region || "Sem região"}
                          />
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

            {/* Produto */}
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

            {/* Quantidade e Unidade */}
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

            {/* Valor Total */}
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

            {/* Período */}
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

            {/* Data e Consultor */}
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
                  onChange={(e) =>
                    setSaleForm((f) => ({ ...f, consultant_id: e.target.value }))
                  }
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

            {/* Observações */}
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
        onClose={() => setOpenProduct(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Novo Produto</DialogTitle>
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
              onChange={(e) =>
                setProductForm((f) => ({ ...f, default_unit: e.target.value }))
              }
              fullWidth
              required
            >
              {units.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenProduct(false)} color="inherit">
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
