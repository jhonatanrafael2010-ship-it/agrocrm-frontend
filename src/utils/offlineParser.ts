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
  estagio: string; // Plantio, Emergência, Vegetativo, Reprodutivo, Colheita
  date: string;
  recommendation: string;
  cv_percent: string; // Coeficiente de variação (só para plantio)
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
  const textLower = normalize(text);

  if (textLower.includes("hoje")) {
    return today.toISOString().split("T")[0];
  }
  if (textLower.includes("ontem")) {
    today.setDate(today.getDate() - 1);
    return today.toISOString().split("T")[0];
  }
  if (textLower.includes("anteontem")) {
    today.setDate(today.getDate() - 2);
    return today.toISOString().split("T")[0];
  }

  // "X dias atrás" / "há X dias" / "X dias atras"
  const diasAtrasMatch = textLower.match(/(\d+)\s*dias?\s*(atras|atrás|ha)/i) ||
                         textLower.match(/(ha|há)\s*(\d+)\s*dias?/i);
  if (diasAtrasMatch) {
    const dias = parseInt(diasAtrasMatch[1]) || parseInt(diasAtrasMatch[2]);
    if (dias > 0 && dias <= 365) {
      today.setDate(today.getDate() - dias);
      return today.toISOString().split("T")[0];
    }
  }

  // Dias da semana (assume semana passada se já passou)
  const diasSemana: Record<string, number> = {
    domingo: 0, dom: 0,
    segunda: 1, seg: 1,
    terca: 2, ter: 2,
    quarta: 3, qua: 3,
    quinta: 4, qui: 4,
    sexta: 5, sex: 5,
    sabado: 6, sab: 6,
  };

  for (const [nome, diaSemana] of Object.entries(diasSemana)) {
    if (textLower.includes(nome)) {
      const todayDay = today.getDay();
      let diff = diaSemana - todayDay;
      if (diff >= 0) diff -= 7; // Sempre assume passado
      today.setDate(today.getDate() + diff);
      return today.toISOString().split("T")[0];
    }
  }

  // Default: hoje
  return new Date().toISOString().split("T")[0];
}

// Extrai estágio macro (Plantio, Emergência, Vegetativo, Reprodutivo, Colheita)
function extractEstagio(text: string): string {
  const textLower = normalize(text);

  if (textLower.includes("plantio")) return "Plantio";
  if (textLower.includes("emergencia") || textLower.includes("emergência")) return "Emergência";
  if (textLower.includes("vegetativo")) return "Vegetativo";
  if (textLower.includes("reprodutivo")) return "Reprodutivo";
  if (textLower.includes("colheita")) return "Colheita";

  return "";
}

// Extrai fenologia do texto (V1-V14, R1-R8, etc.)
function extractPhenology(text: string): string {
  const patterns = [
    /\b(VE|V[1-9]|V1[0-4]|R[1-8]|R5\.[1-5])\b/gi,
    /\bestádio[s]?\s*(de\s+)?(V[1-9]|V1[0-4]|R[1-8])\s*(a\s+(V[1-9]|V1[0-4]|R[1-8]))?/gi,
    /\bfenologia[:\s]+([A-Za-z0-9.]+)/i,
    /\bestágio[:\s]+([A-Za-z0-9.]+)/i,
  ];

  // Procura padrões como "V12 a V14"
  const rangeMatch = text.match(/\b(V\d{1,2})\s*(a|até)\s*(V\d{1,2})\b/i);
  if (rangeMatch) {
    return `${rangeMatch[1].toUpperCase()} a ${rangeMatch[3].toUpperCase()}`;
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].toUpperCase() : match[0].toUpperCase();
    }
  }

  return "";
}

// Extrai CV% (Coeficiente de variação) - só para plantio
function extractCV(text: string): string {
  const patterns = [
    /cv[%]?\s*(?:de\s+)?(\d+[.,]\d+)\s*%?/i,
    /coeficiente\s*(?:de\s+)?(?:variação|variacao)\s*(?:de\s+)?(\d+[.,]\d+)\s*%?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(",", ".") + "%";
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

// Detecta se é formato estruturado (linha 1=data, linha 2=cliente, linha 3=estágio+variedade)
function isStructuredFormat(lines: string[]): boolean {
  if (lines.length < 3) return false;
  // Linha 1 deve ser uma data
  const datePattern = /^\d{2}[\/\-]\d{2}[\/\-]?\d{0,4}$/;
  if (!datePattern.test(lines[0].trim())) return false;
  // Linha 3 deve conter estágio
  const line3Lower = normalize(lines[2]);
  return (
    line3Lower.includes("plantio") ||
    line3Lower.includes("emergencia") ||
    line3Lower.includes("vegetativo") ||
    line3Lower.includes("reprodutivo") ||
    line3Lower.includes("colheita")
  );
}

// Parser principal
export async function parseOfflineMessage(message: string): Promise<ParsedVisit> {
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = message;

  // Carrega dados do cache
  const clients = await getAllFromStore<Client>("clients");
  const properties = await getAllFromStore<Property>("properties");

  let matchedClient: Client | null = null;
  let matchedProperty: Property | null = null;
  let date = "";
  let estagio = "";
  let fenologia = "";
  let variety = "";
  let culture = "";
  let cv_percent = "";
  let recommendationLines: string[] = [];

  // Verifica se é formato estruturado
  if (isStructuredFormat(lines)) {
    // Formato estruturado:
    // Linha 1: Data
    // Linha 2: Cliente
    // Linha 3: Estágio + Variedade
    // Linhas 4+: Observações

    date = extractDate(lines[0]);

    // Linha 2: Cliente
    const clientLine = lines[1];
    matchedClient = findBestMatch(clientLine, clients, 0.3);
    if (!matchedClient) {
      // Tenta match mais flexível
      for (const client of clients) {
        if (normalize(clientLine).includes(normalize(client.name)) ||
            normalize(client.name).includes(normalize(clientLine))) {
          matchedClient = client;
          break;
        }
      }
    }

    // Linha 3: Estágio + Variedade
    const estagioLine = lines[2];
    estagio = extractEstagio(estagioLine);
    fenologia = extractPhenology(estagioLine);

    // Extrai variedade da linha 3
    const cultureData = await extractCulture(estagioLine);
    variety = cultureData.variety;
    culture = cultureData.culture;

    // Se não encontrou variedade na linha 3, procura nas próximas
    if (!variety) {
      for (let i = 3; i < Math.min(lines.length, 6); i++) {
        const lineCulture = await extractCulture(lines[i]);
        if (lineCulture.variety) {
          variety = lineCulture.variety;
          culture = lineCulture.culture;
          break;
        }
      }
    }

    // Extrai CV% se for plantio
    if (estagio === "Plantio") {
      cv_percent = extractCV(fullText);
    }

    // Observações: linhas 4+ (exceto linha do CV)
    recommendationLines = lines.slice(3).filter(line => {
      const lineNorm = normalize(line);
      // Não inclui linha de CV nas observações (será tratada separadamente)
      if (lineNorm.match(/cv[%]?\s*(?:de\s+)?[\d]/i)) return false;
      return true;
    });

  } else {
    // Formato livre (comportamento original)
    const firstLine = lines[0] || "";
    matchedClient = findBestMatch(firstLine, clients, 0.4);

    if (!matchedClient) {
      for (const client of clients) {
        if (normalize(fullText).includes(normalize(client.name))) {
          matchedClient = client;
          break;
        }
      }
    }

    const { culture: c, variety: v } = await extractCulture(fullText);
    culture = c;
    variety = v;
    estagio = extractEstagio(fullText);
    fenologia = extractPhenology(fullText);
    date = extractDate(fullText);
    cv_percent = extractCV(fullText);

    const skipPatterns = [
      /^\d{2}[\/\-]/,
      /^(VE|V\d|R\d)/i,
      /^(soja|milho|algod|feij|trigo)/i,
    ];

    recommendationLines = lines.filter((line, idx) => {
      if (idx === 0 && matchedClient) return false;
      if (skipPatterns.some(p => p.test(line))) return false;
      return true;
    });
  }

  // Procura propriedade
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

  // Se não tem fenologia específica mas tem estágio, mapeia
  if (!fenologia && estagio) {
    const fenologiaMap: Record<string, string> = {
      "Plantio": "",
      "Emergência": "VE",
      "Vegetativo": "V6",
      "Reprodutivo": "R1",
      "Colheita": "",
    };
    fenologia = fenologiaMap[estagio] || "";
  }

  const recommendation = recommendationLines.join("\n").trim();

  // Calcula confiança
  let confidence: "high" | "medium" | "low" = "low";
  if (matchedClient && (culture || variety)) confidence = "high";
  else if (matchedClient && estagio) confidence = "high";
  else if (matchedClient) confidence = "medium";

  return {
    client_id: matchedClient?.id || null,
    client_name: matchedClient?.name || lines[1] || lines[0] || "",
    property_id: matchedProperty?.id || null,
    property_name: matchedProperty?.name || "",
    culture,
    variety,
    fenologia_real: fenologia,
    estagio,
    date,
    recommendation,
    cv_percent,
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
  lines.push(`📅 Data: ${parsed.date.split("-").reverse().join("/")}`);
  lines.push(`👤 Cliente: ${parsed.client_name}${parsed.client_id ? "" : " (não encontrado)"}`);

  if (parsed.property_name) {
    lines.push(`📍 Propriedade: ${parsed.property_name}`);
  }

  if (parsed.estagio) {
    lines.push(`🌱 Estágio: ${parsed.estagio}`);
  }

  if (parsed.variety) {
    lines.push(`🌾 Variedade: ${parsed.variety}`);
  } else if (parsed.culture) {
    lines.push(`🌾 Cultura: ${parsed.culture}`);
  }

  if (parsed.fenologia_real) {
    lines.push(`📊 Fenologia: ${parsed.fenologia_real}`);
  }

  if (parsed.cv_percent) {
    lines.push(`📈 CV%: ${parsed.cv_percent}`);
  }

  if (parsed.recommendation) {
    lines.push("");
    lines.push(`📝 Observações:`);
    // Mostra até 200 caracteres
    const obs = parsed.recommendation.slice(0, 200);
    lines.push(obs + (parsed.recommendation.length > 200 ? "..." : ""));
  }

  lines.push("");
  lines.push("✅ Será sincronizado quando a conexão voltar.");

  return lines.join("\n");
}
