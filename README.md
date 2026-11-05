# Evently: Serviço de Ingressos

API REST que cuida do **ingresso do convidado** no Evently: confirmar presença, recusar o convite,
desistir, transferir para outra pessoa e consultar o ingresso. Toda a troca de dados é em **JSON sobre
HTTP**. O serviço é feito em **Next.js + TypeScript**, e a autenticação usa tokens JWT no formato do
**Supabase Auth**.

Este é o Serviço de Ingressos (interface IIngresso) do Bounded Context Ingresso, descrito no relatório
*Especificação e Implementação de Serviços*.

---

## Como funciona (resumo)

Cada chamada passa por três etapas:

```
Postman / Bruno  ──JSON──►  1. Rota (app/)  ──►  2. Regras (src/dominio/)  ──►  3. Resposta JSON
                            lê o caminho e       verifica tudo o que o          201/200 com o ingresso,
                            confere o token      contrato pede                  ou o erro { codigo, mensagem }
```

1. **A rota recebe a chamada.** Cada operação tem uma pasta em `app/`. A rota lê o número do convite na
   URL e confere o token do cabeçalho `Authorization` para saber quem está chamando.
2. **O serviço aplica as regras** (`src/dominio/ServicoIngressos.ts`). Por exemplo, ao confirmar
   presença ele verifica, nesta ordem: se o convite existe, se quem chama é o titular, se o convite já foi
   respondido, se ainda está na vigência e se há vaga. Depois reserva a vaga, libera a trilha de preparo
   e gera o QR Code. **Se algum passo falhar, o que já foi feito é desfeito** (por exemplo, a vaga
   volta ao saldo).
3. **A resposta sai em JSON.** No sucesso, vêm os dados do ingresso. No erro, vem sempre o mesmo formato:
   ```json
   { "codigo": "SEM_VAGAS", "mensagem": "O evento não tem vagas disponíveis." }
   ```

O ingresso passa por estas situações:

```
PENDENTE ──confirmar──► CONFIRMADO ──desistir──► DESISTENTE
   │                         │
   └──recusar──► RECUSADO    └──transferir──► TRANSFERIDO (o substituto recebe um convite novo, PENDENTE)
```

O QR Code só é válido quando o ingresso está **CONFIRMADO**.

**Sobre os outros sistemas:** Convites, Gestão do Evento, Preparação do Convidado, e-mail e banco de
dados ainda não existem de verdade. Eles foram **simulados em memória** (`src/infra/memoria/`). Por isso,
ao subir, o servidor já cria eventos e convites de exemplo, e os dados se perdem quando ele reinicia.

---

## Como rodar

Pré-requisito: **Node.js 18 ou superior** (testado no 22).

```bash
npm install
npm run dev
```

Espere aparecer `✓ Ready`. A API fica em **http://localhost:3000**. Abrindo esse endereço no navegador,
aparece a lista das operações.

---

## Como testar

Há três formas, da mais rápida para a mais detalhada.

### 1. Testes automatizados (não precisa subir o servidor)

```bash
npm test
```

Roda **37 testes** que cobrem todas as operações e todos os erros do contrato. O resultado esperado é
`Tests 37 passed`.

### 2. Cenários contra o servidor rodando

Com o `npm run dev` rodando em outro terminal:

```bash
npm run test:api
```

Executa **26 cenários** em sequência e mostra `OK` ou `FALHOU` em cada um. Cada requisição e resposta fica
salva em `docs/evidencias/execucao-api.md`.

### 3. Manualmente, pelo Postman ou pelo Bruno

1. Suba o servidor com `npm run dev`.
2. Importe os dois arquivos da pasta `postman/`:
   - `Evently-Servico-Ingressos.postman_collection.json`: as requisições, já numeradas.
   - `Evently-local.postman_environment.json`: o endereço da API e o token de cada usuário de teste.
3. Selecione o ambiente **Evently - local**.
4. Rode as requisições **na ordem numérica**, começando pela **00 Reset**, ou use **Run collection**.

---

## Passo a passo de teste

Siga a ordem abaixo, porque cada passo muda os dados para o seguinte. Para recomeçar do zero, chame
`POST /dev/reset`. Os números entre parênteses são os da coleção do Postman.

### Caminho feliz

| # | Requisição | Usuário (token) | Resultado esperado |
|---|---|---|---|
| 1 | `POST /dev/reset` (00) | nenhum | 200: dados de exemplo recriados |
| 2 | `POST /convites/10/confirmacao` (01) | ana | **201**, `CONFIRMADO` e um `qrCode` |
| 3 | `GET /eventos/1/vagas` (25) | organizador | `ocupadas: 3`, `disponiveis: 0` |
| 4 | `POST /convites/11/recusa` (09) | bruno | **200**, `RECUSADO` |
| 5 | `POST /convites/12/desistencia` (10) | carla | **200**, `DESISTENTE` |
| 6 | `POST /convites/13/transferencia` com o corpo abaixo (15) | diego | **200**, `TRANSFERIDO`, `novoConviteId: 1000` |
| 7 | `GET /eventos/1/vagas` (25) | organizador | `reservadas: 1`: a vaga ficou guardada para a substituta |
| 8 | `POST /convites/1000/confirmacao` (17) | maria | **201**: a substituta confirma usando a vaga reservada |
| 9 | `GET /ingressos?qrCode=EVT-C12A0001` (19) | portaria | **200**, `DESISTENTE`, `qrValido: false` |
| 10 | `GET /dev/eventos-publicados` (26) | nenhum | Lista de eventos (`IngressoConfirmado`, `IngressoRecusado`...) |

Corpo JSON da transferência (passo 6):

```json
{
  "dadosSubstituto": {
    "nome": "Maria Souza",
    "email": "maria.souza@empresa.com"
  }
}
```

As outras chamadas **não têm corpo**: o convite vai na URL e o usuário vai no token.

### Cenários de erro

Estes não alteram os dados e podem ser rodados a qualquer momento depois do reset.

| Requisição | Usuário (token) | Resultado esperado |
|---|---|---|
| `POST /convites/11/confirmacao` sem o cabeçalho Authorization (03) | nenhum | **401** `NAO_AUTENTICADO` |
| `POST /convites/11/confirmacao` (05) | intruso | **403** `NAO_TITULAR` |
| `POST /convites/999/confirmacao` (04) | ana | **404** `CONVITE_NAO_ENCONTRADO` |
| `POST /convites/21/confirmacao` (07) | gustavo | **409** `SEM_VAGAS`: o evento 2 está lotado |
| `POST /convites/14/confirmacao` (06) | elisa | **422** `CONVITE_EXPIRADO` |
| `POST /convites/50/confirmacao` (08) | julia | **503** `FALHA_DEPENDENCIA`: a trilha falha e a vaga é devolvida |
| `POST /convites/13/transferencia` com o corpo do passo 6, mas `"email": "invalido"` (13) | diego | **400** `DADOS_INVALIDOS` |
| `POST /convites/40/transferencia` com o corpo do passo 6 (16) | igor | **422** `TRANSFERENCIA_NAO_PERMITIDA` |

Depois do erro 503, `GET /eventos/5/vagas` (usuário organizador) continua com `ocupadas: 0`. Isso mostra
que a confirmação foi desfeita.

### Sobre os tokens

O token de cada usuário já está no arquivo de ambiente do Postman (`token_ana`, `token_portaria`...).
Para gerar tokens novos, rode `npm run tokens`. O usuário é identificado pelo e-mail do token, e **só o
titular do convite** pode confirmar, recusar, desistir ou transferir.

---

## Referência

### Operações

| Operação | Método e caminho | Sucesso |
|---|---|---|
| confirmarPresenca | `POST /convites/{conviteId}/confirmacao` | 201 |
| recusarConvite | `POST /convites/{conviteId}/recusa` | 200 |
| registrarDesistencia | `POST /convites/{conviteId}/desistencia` | 200 |
| transferirConvite | `POST /convites/{conviteId}/transferencia` (corpo JSON com `dadosSubstituto`) | 200 |
| consultarIngresso | `GET /ingressos/{ingressoId}`, `GET /ingressos?conviteId=`, `GET /ingressos?qrCode=` | 200 |
| Saldo de vagas | `GET /eventos/{eventoId}/vagas` (organizador do evento) | 200 |

Rotas de apoio, que só funcionam em desenvolvimento: `POST /dev/reset` recria os dados e
`GET /dev/eventos-publicados` lista os eventos de domínio publicados.

### Dados de exemplo

| Convite | Titular (e-mail @evently.test) | Evento | Situação inicial | Serve para testar |
|---|---|---|---|---|
| 10 | ana | 1 (capacidade 3) | PENDENTE | confirmação |
| 11 | bruno | 1 | PENDENTE | recusa |
| 12 | carla | 1 | CONFIRMADO (`EVT-C12A0001`) | desistência |
| 13 | diego | 1 | CONFIRMADO (`EVT-D13B0002`) | transferência |
| 14 | elisa | 1 | PENDENTE, vigência encerrada | convite expirado |
| 20 / 21 | fernanda / gustavo | 2 (capacidade 1, lotado) | CONFIRMADO / PENDENTE | sem vagas |
| 30 | helena | 3 (já começou) | CONFIRMADO | evento iniciado |
| 40 | igor | 4 (não permite transferência) | CONFIRMADO | transferência não permitida |
| 50 | julia | 5 (a trilha falha) | PENDENTE | falha de dependência (503) |

Outros usuários: `intruso` (sem convite), `organizador` (dono dos eventos), `outroOrganizador`,
`portaria` (operador de portaria) e `maria` (`maria.souza@empresa.com`, a substituta).

### Organização das pastas

```
app/                              Rotas da API (uma pasta por operação)
src/dominio/ServicoIngressos.ts   Regras das 5 operações
src/dominio/ServicoVagas.ts       Controle de vagas (reserva, liberação, transferência)
src/dominio/erros.ts              Lista de erros: código -> status HTTP
src/portas/index.ts               Interfaces dos outros sistemas (Convites, Eventos, Vagas...)
src/infra/auth/jwt.ts             Validação do token JWT
src/infra/memoria/                Simulação dos outros sistemas e dados de exemplo
src/http/respostas.ts             Conversão do resultado e dos erros em JSON
tests/api.test.ts                 Testes automatizados
scripts/                          Ferramentas de teste (cenários, tokens, coleção do Postman)
postman/                          Coleção e ambiente do Postman
docs/evidencias/                  Resultados das execuções de teste
```

### Limitações

- Os outros sistemas e o banco de dados são **simulados em memória**: os dados se perdem quando o
  servidor reinicia. Para usar os sistemas reais, basta trocar as implementações em `src/infra/`, sem
  mudar as regras.
- A proteção da última vaga funciona com um único servidor. Com vários, ela precisaria ser feita no
  banco de dados.
- Quando o convite do substituto vence sem resposta, a vaga não é liberada automaticamente (isso exigiria
  um agendador). Quando o substituto **recusa**, ela é liberada.
- Em desenvolvimento, sem a variável `SUPABASE_JWT_SECRET`, o servidor usa um segredo local fixo para
  validar os tokens.
