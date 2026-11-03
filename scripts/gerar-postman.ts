// Gera a coleção Postman (com testes automáticos por requisição) a partir de scripts/cenarios.ts.
// Uso: npm run postman   -> postman/Evently-Servico-Ingressos.postman_collection.json
// Importe também o ambiente gerado por `npm run tokens`.

import { writeFileSync } from "node:fs";
import { CENARIOS } from "./cenarios";

const item = [
  {
    name: "00 Reset dos dados de demonstração",
    request: { method: "POST", url: "{{baseUrl}}/dev/reset" },
    event: [{ listen: "test", script: { exec: ["pm.test('200', () => pm.response.to.have.status(200));"] } }],
  },
  ...CENARIOS.map((c) => {
    const testes = [`pm.test("HTTP ${c.esperado.status}", () => pm.response.to.have.status(${c.esperado.status}));`];
    if (c.esperado.codigo) {
      testes.push(`pm.test("codigo ${c.esperado.codigo}", () => pm.expect(pm.response.json().codigo).to.eql("${c.esperado.codigo}"));`);
    }
    for (const [campo, valor] of Object.entries(c.esperado.campos ?? {})) {
      testes.push(`pm.test("${campo} = ${JSON.stringify(valor).replace(/"/g, "'")}", () => pm.expect(pm.response.json()["${campo}"]).to.eql(${JSON.stringify(valor)}));`);
    }
    const headers = [{ key: "Content-Type", value: "application/json" }];
    if (c.usuario) headers.push({ key: "Authorization", value: `Bearer {{token_${c.usuario}}}` });
    return {
      name: c.nome,
      request: {
        method: c.metodo,
        header: headers,
        url: `{{baseUrl}}${c.caminho}`,
        ...(c.corpo !== undefined ? { body: { mode: "raw", raw: JSON.stringify(c.corpo, null, 2) } } : {}),
      },
      event: [{ listen: "test", script: { type: "text/javascript", exec: testes } }],
    };
  }),
];

const colecao = {
  info: {
    name: "Evently - Serviço de Ingressos",
    description: "Cenários do contrato IIngresso. Execute em ordem (Run collection) começando pelo reset.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item,
};
writeFileSync("postman/Evently-Servico-Ingressos.postman_collection.json", JSON.stringify(colecao, null, 2));
console.log(`Coleção com ${item.length} requisições salva em postman/Evently-Servico-Ingressos.postman_collection.json`);
