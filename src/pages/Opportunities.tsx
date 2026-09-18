import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Chip,
  LinearProgress,
  Grid,
  TableSortLabel,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  Grass as SeedIcon,
  Landscape as AreaIcon,
  People as PeopleIcon,
} from "@mui/icons-material";
import { API_BASE } from "../config";

type Property = {
  id: number;
  client_id: number;
  name: string;
  area_ha: number | null;
};

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
  quantity: number;
  unit: string;
  value: number | null;
  period_type: string;
  period_year: string;
  culture: string | null;
};

type Client = {
  id: number;
  name: string;
  region: string | null;
};

type Period = { type: string; year: string; label: string };

type ClientOpportunity = {
  client_id: number;
  client_name: string;
  region: string | null;
  total_area_ha: number;
  seed_potential: number;
  seed_sold: number;
  seed_opportunity: number;
  opportunity_percentage: number;
  coverage_percentage: number;
};

type SortField = "total_area_ha" | "seed_potential" | "seed_sold" | "seed_opportunity" | "coverage_percentage";
type SortDirection = "asc" | "desc";

const SEEDS_PER_HA_MILHO = 1.067;
const BB_SEEDS = 3_000_000;
const DEFAULT_SOJA_SEEDS_PER_HA = 300_000;

const Opportunities: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [filterPeriodType, setFilterPeriodType] = useState("");
  const [filterPeriodYear, setFilterPeriodYear] = useState("");
  const [filterRegion, setFilterRegion] = useState("");

  const [sortField, setSortField] = useState<SortField>("seed_opportunity");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const regions = useMemo(() => {
    const uniqueRegions = new Set(clients.map((c) => c.region).filter(Boolean));
    return Array.from(uniqueRegions) as string[];
  }, [clients]);

  const isSojaMode = filterPeriodType === "Safra";
  const unitLabel = isSojaMode ? "ha" : "scs";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [clientsRes, propertiesRes, salesRes, periodsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}clients`),
        fetch(`${API_BASE}properties`),
        fetch(`${API_BASE}sales`),
        fetch(`${API_BASE}sales/periods`),
        fetch(`${API_BASE}products`),
      ]);

      setClients(await clientsRes.json());
      setProperties(await propertiesRes.json());
      setSales(await salesRes.json());
      setPeriods(await periodsRes.json());
      setProducts(await productsRes.json());
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const productMap = useMemo(() => {
    const map: Record<number, Product> = {};
    for (const p of products) {
      map[p.id] = p;
    }
    return map;
  }, [products]);

  const opportunities = useMemo(() => {
    const clientMap: Record<number, ClientOpportunity> = {};

    for (const client of clients) {
      if (filterRegion && client.region !== filterRegion) continue;

      const clientProperties = properties.filter((p) => p.client_id === client.id);
      const totalArea = clientProperties.reduce((sum, p) => sum + (p.area_ha || 0), 0);

      if (totalArea === 0) continue;

      let seedPotential: number;
      let seedSold: number;

      if (isSojaMode) {
        seedPotential = totalArea;

        const clientSojaSales = sales.filter((s) => {
          if (s.client_id !== client.id) return false;
          if (s.product_category !== "Semente") return false;
          if (filterPeriodType && s.period_type !== filterPeriodType) return false;
          if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
          if (s.unit !== "BB") return false;
          const product = productMap[s.product_id];
          if (product && product.culture && product.culture !== "Soja") return false;
          return true;
        });

        let areaCovered = 0;
        for (const sale of clientSojaSales) {
          const product = productMap[sale.product_id];
          const seedsPerHa = product?.seeds_per_ha || DEFAULT_SOJA_SEEDS_PER_HA;
          const haPerBB = BB_SEEDS / seedsPerHa;
          areaCovered += sale.quantity * haPerBB;
        }
        seedSold = areaCovered;
      } else {
        seedPotential = totalArea * SEEDS_PER_HA_MILHO;

        const clientMilhoSales = sales.filter((s) => {
          if (s.client_id !== client.id) return false;
          if (s.product_category !== "Semente") return false;
          if (filterPeriodType && s.period_type !== filterPeriodType) return false;
          if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
          if (s.unit !== "Sacas") return false;
          const product = productMap[s.product_id];
          if (product && product.culture && product.culture !== "Milho") return false;
          return true;
        });

        seedSold = clientMilhoSales.reduce((sum, s) => sum + s.quantity, 0);
      }

      const seedOpportunity = Math.max(0, seedPotential - seedSold);
      const coveragePercentage = seedPotential > 0 ? (seedSold / seedPotential) * 100 : 0;
      const opportunityPercentage = seedPotential > 0 ? (seedOpportunity / seedPotential) * 100 : 0;

      clientMap[client.id] = {
        client_id: client.id,
        client_name: client.name,
        region: client.region,
        total_area_ha: totalArea,
        seed_potential: seedPotential,
        seed_sold: seedSold,
        seed_opportunity: seedOpportunity,
        coverage_percentage: coveragePercentage,
        opportunity_percentage: opportunityPercentage,
      };
    }

    return Object.values(clientMap);
  }, [clients, properties, sales, productMap, filterPeriodType, filterPeriodYear, filterRegion, isSojaMode]);

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [opportunities, sortField, sortDir]);

  const totals = useMemo(() => {
    return {
      totalArea: opportunities.reduce((sum, o) => sum + o.total_area_ha, 0),
      totalPotential: opportunities.reduce((sum, o) => sum + o.seed_potential, 0),
      totalSold: opportunities.reduce((sum, o) => sum + o.seed_sold, 0),
      totalOpportunity: opportunities.reduce((sum, o) => sum + o.seed_opportunity, 0),
      clientsCount: opportunities.length,
    };
  }, [opportunities]);

  const totalBBSold = useMemo(() => {
    if (!isSojaMode) return 0;
    return sales
      .filter((s) => {
        if (s.product_category !== "Semente") return false;
        if (filterPeriodType && s.period_type !== filterPeriodType) return false;
        if (filterPeriodYear && s.period_year !== filterPeriodYear) return false;
        if (s.unit !== "BB") return false;
        const product = productMap[s.product_id];
        if (product && product.culture && product.culture !== "Soja") return false;
        if (filterRegion) {
          const client = clients.find((c) => c.id === s.client_id);
          if (client?.region !== filterRegion) return false;
        }
        return true;
      })
      .reduce((sum, s) => sum + s.quantity, 0);
  }, [sales, productMap, clients, filterPeriodType, filterPeriodYear, filterRegion, isSojaMode]);

  const overallCoverage = totals.totalPotential > 0
    ? (totals.totalSold / totals.totalPotential) * 100
    : 0;

  function formatNumber(value: number): string {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function getCoverageColor(percentage: number): "success" | "warning" | "error" | "info" {
    if (percentage >= 80) return "success";
    if (percentage >= 50) return "info";
    if (percentage >= 20) return "warning";
    return "error";
  }

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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Oportunidades
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {isSojaMode
            ? "Potencial de crescimento em sementes de soja (área em ha, vendas em BB)"
            : `Potencial de crescimento em sementes de milho (1 ha = ${SEEDS_PER_HA_MILHO} scs)`}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
        </Box>
      </Card>

      {/* Cards de Resumo */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "primary.main", color: "white" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PeopleIcon fontSize="small" />
                <Typography variant="caption">Clientes</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {totals.clientsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "info.main", color: "white" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AreaIcon fontSize="small" />
                <Typography variant="caption">Área Total</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {formatNumber(totals.totalArea)} ha
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "secondary.main", color: "white" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SeedIcon fontSize="small" />
                <Typography variant="caption">Potencial</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {formatNumber(totals.totalPotential)} {unitLabel}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "success.main", color: "white" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SeedIcon fontSize="small" />
                <Typography variant="caption">
                  {isSojaMode ? "Área Coberta" : "Vendido"}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {formatNumber(totals.totalSold)} {unitLabel}
              </Typography>
              {isSojaMode && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  ({formatNumber(totalBBSold)} BB)
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "warning.main", color: "white" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TrendingUpIcon fontSize="small" />
                <Typography variant="caption">Oportunidade</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {formatNumber(totals.totalOpportunity)} {unitLabel}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Barra de Cobertura Geral */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Cobertura Geral
          </Typography>
          <Chip
            label={`${formatNumber(overallCoverage)}%`}
            size="small"
            color={getCoverageColor(overallCoverage)}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, overallCoverage)}
          sx={{
            height: 12,
            borderRadius: 2,
            bgcolor: "action.hover",
            "& .MuiLinearProgress-bar": {
              borderRadius: 2,
            },
          }}
          color={getCoverageColor(overallCoverage)}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {formatNumber(totals.totalSold)} {unitLabel} {isSojaMode ? "cobertos" : "vendidos"}
            {isSojaMode && ` (${formatNumber(totalBBSold)} BB)`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatNumber(totals.totalPotential)} {unitLabel} potencial
          </Typography>
        </Box>
      </Card>

      {/* Tabela de Oportunidades por Cliente */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Oportunidades por Cliente
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Região</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "total_area_ha"}
                      direction={sortField === "total_area_ha" ? sortDir : "desc"}
                      onClick={() => handleSort("total_area_ha")}
                    >
                      Área (ha)
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "seed_potential"}
                      direction={sortField === "seed_potential" ? sortDir : "desc"}
                      onClick={() => handleSort("seed_potential")}
                    >
                      Potencial ({unitLabel})
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "seed_sold"}
                      direction={sortField === "seed_sold" ? sortDir : "desc"}
                      onClick={() => handleSort("seed_sold")}
                    >
                      {isSojaMode ? `Coberto (${unitLabel})` : `Vendido (${unitLabel})`}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    <TableSortLabel
                      active={sortField === "seed_opportunity"}
                      direction={sortField === "seed_opportunity" ? sortDir : "desc"}
                      onClick={() => handleSort("seed_opportunity")}
                    >
                      Oportunidade ({unitLabel})
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    <TableSortLabel
                      active={sortField === "coverage_percentage"}
                      direction={sortField === "coverage_percentage" ? sortDir : "desc"}
                      onClick={() => handleSort("coverage_percentage")}
                    >
                      Cobertura
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedOpportunities.map((o, idx) => (
                  <TableRow key={o.client_id} hover>
                    <TableCell>
                      <Chip
                        label={`#${idx + 1}`}
                        size="small"
                        color={o.seed_opportunity > 0 ? "warning" : "success"}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{o.client_name}</TableCell>
                    <TableCell>{o.region || "-"}</TableCell>
                    <TableCell align="right">{formatNumber(o.total_area_ha)}</TableCell>
                    <TableCell align="right">{formatNumber(o.seed_potential)}</TableCell>
                    <TableCell align="right">{formatNumber(o.seed_sold)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 600,
                          color: o.seed_opportunity > 0 ? "warning.main" : "success.main",
                        }}
                      >
                        {formatNumber(o.seed_opportunity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, o.coverage_percentage)}
                          sx={{
                            width: 60,
                            height: 8,
                            borderRadius: 1,
                            bgcolor: "action.hover",
                          }}
                          color={getCoverageColor(o.coverage_percentage)}
                        />
                        <Typography variant="caption" sx={{ minWidth: 40 }}>
                          {formatNumber(o.coverage_percentage)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedOpportunities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Nenhum cliente com área cadastrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Opportunities;
