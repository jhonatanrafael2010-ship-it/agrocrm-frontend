// src/utils/offlineParser.ts
// Parser local para criar visitas quando offline

import { getAllFromStore } from "./indexedDB";

type Client = { id: number; name: string };
type Property = { id: number; name: string; client_id?: number };
type Culture = { id: number; name: string };

interface ParsedVisit {
  client_id: number | null;
  client_name: string;
  property_id: number | null;
  property_name: string;
  culture: string;
  variety: string;
  fenologia_real: string;
  date: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
}

// Normaliza texto para comparação
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Fuzzy match simples - retorna score de 0 a 1
function fuzzyMatch(input: string, target: string): number {
  const inputNorm = normalize(input);
  const targetNorm = normalize(target);

  if (inputNorm === targetNorm) return 1;
  if (targetNorm.includes(inputNorm) || inputNorm.includes(targetNorm)) return 0.8;

  // Verifica palavras em comum
  const inputWords = inputNorm.split(/\s+/);
  const targetWords = targetNorm.split(/\s+/);
  let matches = 0;
  for (const word of inputWords) {
    if (word.length >= 3 && targetWords.some(tw => tw.includes(word) || word.includes(tw))) {
      matches++;
    }
  }
  if (matches > 0) return Math.min(0.7, matches * 0.3);

  return 0;
}

// Encontra melhor match em uma lista
function findBestMatch<T extends { name: string }>(
  input: string,
  items: T[],
  minScore = 0.5
): T | null {
  let best: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = fuzzyMatch(input, item.name);
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}

// Extrai data do texto
function extractDate(text: string): string {
  // Formatos: dd/mm/yyyy, dd-mm-yyyy, dd/mm, yyyy-mm-dd
  const patterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})-(\d{2})-(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})\/(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].includes("-") && match[1].length === 4) {
        // yyyy-mm-dd
        return match[0];
      }
      if (match.length === 4) {
        // dd/mm/yyyy
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
      // dd/mm (assume ano atual)
      const year = new Date().getFullYear();
      return `${year}-${match[2]}-${match[1]}`;
    }
  }

  // Padrões textuais
  const today = new Date();
  const textLower = text.toLowerCase();

  if (textLower.includes("hoje")) {
    return today.toISOString().split("T")[0];
  }
  if (textLower.includes("ontem")) {
    today.setDate(today.getDate() - 1);
    return today.toISOString().split("T")[0];
  }

  // Default: hoje
  return new Date().toISOString().split("T")[0];
}

// Extrai fenologia do texto
function extractPhenology(text: string): string {
  const patterns = [
    /\b(VE|V[1-9]|V1[0-2]|R[1-8]|R5\.[1-5])\b/i,
    /\bfenologia[:\s]+([A-Za-z0-9.]+)/i,
    /\bestágio[:\s]+([A-Za-z0-9.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return "";
}

// Extrai cultura do texto (prioriza variedade, que define a cultura)
async function extractCulture(text: string): Promise<{ culture: string; variety: string }> {
  const cultures = await getAllFromStore<Culture>("cultures");
  const varieties = await getAllFromStore<{ name: string; culture: string }>("varieties");

  const textNorm = normalize(text);
  const lines = text.split("\n").map(l => l.trim());

  // Primeiro: procura variedade (variedade define a cultura automaticamente)
  let foundVariety = "";
  let foundCulture = "";

  for (const v of varieties) {
    const varietyNorm = normalize(v.name);
    // Match exato ou parcial da variedade
    if (textNorm.includes(varietyNorm) || lines.some(line => normalize(line) === varietyNorm)) {
      foundVariety = v.name;
      foundCulture = v.culture; // Cultura vem da variedade
      break;
    }
  }

  // Se não encontrou variedade, procura cultura diretamente
  if (!foundCulture) {
    for (const c of cultures) {
      if (textNorm.includes(normalize(c.name))) {
        foundCulture = c.name;
        break;
      }
    }
  }

  return { culture: foundCulture, variety: foundVariety };
}

// Parser principal
export async function parseOfflineMessage(message: string): Promise<ParsedVisit> {
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = message;

  // Carrega dados do cache
  const clients = await getAllFromStore<Client>("clients");
  const properties = await getAllFromStore<Property>("properties");

  // Tenta encontrar cliente na primeira linha
  const firstLine = lines[0] || "";
  let matchedClient = findBestMatch(firstLine, clients, 0.4);

  // Se não encontrou, procura em todo o texto
  if (!matchedClient) {
    for (const client of clients) {
      if (normalize(fullText).includes(normalize(client.name))) {
        matchedClient = client;
        break;
      }
    }
  }

  // Procura propriedade
  let matchedProperty: Property | null = null;
  if (matchedClient) {
    const clientProperties = properties.filter(p => p.client_id === matchedClient!.id);
    for (const line of lines) {
      const match = findBestMatch(line, clientProperties, 0.4);
      if (match) {
        matchedProperty = match;
        break;
      }
    }
  }

  // Extrai outros campos
  const { culture, variety } = await extractCulture(fullText);
  const fenologia = extractPhenology(fullText);
  const date = extractDate(fullText);

  // Recomendação: linhas que não são cliente/propriedade/metadata
  const skipPatterns = [
    /^\d{2}[\/\-]/,  // datas
    /^(VE|V\d|R\d)/i,  // fenologia
    /^(soja|milho|algod|feij|trigo)/i,  // culturas
  ];

  const recommendationLines = lines.filter((line, idx) => {
    if (idx === 0 && matchedClient) return false; // primeira linha é cliente
    if (matchedProperty && normalize(line).includes(normalize(matchedProperty.name))) return false;
    if (skipPatterns.some(p => p.test(line))) return false;
    return true;
  });

  const recommendation = recommendationLines.join("\n").trim();

  // Calcula confiança
  let confidence: "high" | "medium" | "low" = "low";
  if (matchedClient && culture) confidence = "high";
  else if (matchedClient) confidence = "medium";

  return {
    client_id: matchedClient?.id || null,
    client_name: matchedClient?.name || firstLine,
    property_id: matchedProperty?.id || null,
    property_name: matchedProperty?.name || "",
    culture,
    variety,
    fenologia_real: fenologia,
    date,
    recommendation,
    confidence,
  };
}

// Gera mensagem de confirmação
export function buildOfflineConfirmation(parsed: ParsedVisit): string {
  const lines: string[] = [];

  lines.push("📴 *Modo Offline*");
  lines.push("");

  if (parsed.confidence === "high") {
    lines.push("Visita registrada localmente:");
  } else if (parsed.confidence === "medium") {
    lines.push("Visita registrada (verifique os dados):");
  } else {
    lines.push("Visita registrada com dados parciais:");
  }

  lines.push("");
  lines.push(`Cliente: ${parsed.client_name}${parsed.client_id ? "" : " (não encontrado)"}`);

  if (parsed.property_name) {
    lines.push(`Propriedade: ${parsed.property_name}`);
  }

  if (parsed.culture) {
    lines.push(`Cultura: ${parsed.culture}${parsed.variety ? ` - ${parsed.variety}` : ""}`);
  }

  if (parsed.fenologia_real) {
    lines.push(`Fenologia: ${parsed.fenologia_real}`);
  }

  lines.push(`Data: ${parsed.date.split("-").reverse().join("/")}`);

  if (parsed.recommendation) {
    lines.push(`Observação: ${parsed.recommendation.slice(0, 100)}${parsed.recommendation.length > 100 ? "..." : ""}`);
  }

  lines.push("");
  lines.push("Será sincronizado quando a conexão voltar.");

  return lines.join("\n");
}
