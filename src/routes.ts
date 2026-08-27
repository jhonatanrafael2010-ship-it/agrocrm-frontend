// Mapeamento de rotas: label -> path
export const ROUTE_PATHS: Record<string, string> = {
  "Dashboard": "/",
  "Assistente": "/assistente",
  "Clientes": "/clientes",
  "Propriedades": "/propriedades",
  "Mapa": "/mapa",
  "Calendário": "/calendario",
  "Acompanhamentos": "/acompanhamentos",
  "Vincular Visitas": "/vincular-visitas",
  "Oportunidades": "/oportunidades",
  "Vendas": "/vendas",
  "Usuários": "/usuarios",
};

// Mapeamento reverso: path -> label
export const PATH_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_PATHS).map(([label, path]) => [path, label])
);
