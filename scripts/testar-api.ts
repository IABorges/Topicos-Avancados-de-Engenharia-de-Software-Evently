// Executa o roteiro de cenários contra o servidor em execução (npm run dev) e grava a evidência
// (requisição, resposta e veredito de cada cenário) em docs/evidencias/execucao-api.md.
// Uso: npm run test:api   (variável BASE_URL opcional; padrão http://localhost:3000)

import { mkdirSync, writeFileSync } from "node:fs";
import { gerarToken } from "../src/infra/auth/jwt";
import { USUARIOS_TESTE } from "../src/infra/memoria/dadosIniciais";
import { CENARIOS } from "./cenarios";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const linhas: string[] = [];
let falhas = 0;

const reset = await fetch(`${BASE}/dev/reset`, { method: "POST" });
if (!reset.ok) throw new Error(`POST /dev/reset falhou (${reset.status}). O servidor está rodando em ${BASE}?`);

linhas.push(
  "# Evidência de execução da API - Serviço de Ingressos",
  "",
  `Execução: ${new Date().toISOString()} contra \`${BASE}\` (servidor Next.js em execução).`,
  "Antes do roteiro: `POST /dev/reset` (massa de dados inicial).",
  "",
  "| # | Cenário | Requisição | Esperado | Obtido | Resultado |",
  "|---|---|---|---|---|---|",
);
const detalhes: string[] = [];

for (const c of CENARIOS) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (c.usuario) {
    const u = USUARIOS_TESTE.find((x) => x.chave === c.usuario)!;
    headers.authorization = `Bearer ${await gerarToken(u)}`;
  }
  const resposta = await fetch(BASE + c.caminho, {
    method: c.metodo,
    headers,
    body: c.corpo === undefined ? undefined : JSON.stringify(c.corpo),
  });
  const corpo = await resposta.json().catch(() => null);

  const problemas: string[] = [];
  if (resposta.status !== c.esperado.status) problemas.push(`status ${resposta.status}`);
  if (c.esperado.codigo && corpo?.codigo !== c.esperado.codigo) problemas.push(`codigo ${corpo?.codigo}`);
  for (const [campo, valor] of Object.entries(c.esperado.campos ?? {})) {
    if (corpo?.[campo] !== valor) problemas.push(`${campo}=${JSON.stringify(corpo?.[campo])}`);
  }
  const ok = problemas.length === 0;
  if (!ok) falhas++;

  const esperado = `${c.esperado.status}${c.esperado.codigo ? ` ${c.esperado.codigo}` : ""}`;
  const obtido = `${resposta.status}${corpo?.codigo ? ` ${corpo.codigo}` : ""}`;
  const quem = c.usuario ? ` (${c.usuario})` : " (sem token)";
  linhas.push(`| ${c.nome.slice(0, 2)} | ${c.nome.slice(3)} | \`${c.metodo} ${c.caminho}\`${quem} | ${esperado} | ${obtido} | ${ok ? "OK" : "FALHOU: " + problemas.join(", ")} |`);
  detalhes.push(
    `### ${c.nome}`,
    "",
    "```http",
    `${c.metodo} ${c.caminho}`,
    c.usuario ? `Authorization: Bearer <token de ${c.usuario}>` : "(sem Authorization)",
    ...(c.corpo !== undefined ? ["", JSON.stringify(c.corpo, null, 2)] : []),
    "```",
    "",
    `Resposta: **HTTP ${resposta.status}**`,
    "",
    "```json",
    JSON.stringify(corpo, null, 2),
    "```",
    "",
  );
  console.log(`${ok ? "OK    " : "FALHOU"} ${c.nome} -> ${obtido}${ok ? "" : "  (" + problemas.join(", ") + ")"}`);
}

linhas.push("", `**Resumo:** ${CENARIOS.length - falhas} de ${CENARIOS.length} cenários conforme o contrato.`, "", "## Requisições e respostas", "", ...detalhes);
mkdirSync("docs/evidencias", { recursive: true });
writeFileSync("docs/evidencias/execucao-api.md", linhas.join("\n"));
console.log(`\n${CENARIOS.length - falhas}/${CENARIOS.length} cenários OK. Evidência: docs/evidencias/execucao-api.md`);
process.exit(falhas ? 1 : 0);
