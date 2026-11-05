# Evently: Serviço de Ingressos

Implementação do **Serviço de Ingressos (interface IIngresso)** do Bounded Context **Ingresso**, conforme
o relatório *Especificação e Implementação de Serviços* (seções 3.1 a 3.5). As operações ficam expostas
como API REST sobre HTTP, com JSON, em **Next.js (Route Handlers) + TypeScript**. Os tokens JWT seguem o
formato do **Supabase Auth**.

## Como executar

```bash
npm install
npm run dev          # API em http://localhost:3000
```

Testes:

```bash
npm test             # 37 testes automatizados (Vitest) sobre os Route Handlers
npm run test:api     # 26 cenários contra o servidor em execução; gera docs/evidencias/execucao-api.md
```

Postman: importe `postman/Evently-Servico-Ingressos.postman_collection.json` e o ambiente
`postman/Evently-local.postman_environment.json`. Depois rode **Run collection** em ordem. A primeira
requisição recria a massa de dados. Para regerar a coleção e os tokens, use `npm run postman` e `npm run tokens`.

## Operações

| Operação | Método e caminho | Sucesso |
|---|---|---|
| confirmarPresenca | `POST /convites/{conviteId}/confirmacao` | 201 |
| recusarConvite | `POST /convites/{conviteId}/recusa` | 200 |
| registrarDesistencia | `POST /convites/{conviteId}/desistencia` | 200 |
| transferirConvite | `POST /convites/{conviteId}/transferencia` com corpo `{ "dadosSubstituto": { "nome", "email" } }` | 200 |
| consultarIngresso | `GET /ingressos/{ingressoId}`, `GET /ingressos?conviteId=`, `GET /ingressos?qrCode=` | 200 |
| saldo de vagas (Serviço de Vagas) | `GET /eventos/{eventoId}/vagas` (organizador do evento) | 200 |

Todas as operações exigem `Authorization: Bearer <token>`. Os erros seguem o formato
`{ "codigo": "SEM_VAGAS", "mensagem": "..." }`, com os códigos da seção 3.5.

Rotas de apoio (somente fora de produção): `POST /dev/reset` recria os dados e `GET /dev/eventos-publicados`
lista os eventos de domínio publicados.

## Organização

```
app/                          Route Handlers (camada HTTP, uma pasta por operação)
src/dominio/ServicoIngressos.ts   Regras de negócio das 5 operações (independente do Next.js)
src/dominio/ServicoVagas.ts       Serviço de Vagas: reserva atômica, liberação e transferência de vaga
src/dominio/erros.ts              Catálogo de erros do contrato (código -> status HTTP)
src/portas/index.ts               Interfaces requeridas: IConvites, IEventos, IVagas, IPreparacao, INotificacao...
src/infra/auth/jwt.ts             Validação do JWT (Supabase Auth, HS256, perfis em app_metadata.perfis)
src/infra/memoria/                Adaptadores em memória dos contextos vizinhos + massa de dados
src/http/respostas.ts             Autenticação, conversão de erros e respostas JSON
tests/api.test.ts                 Testes automatizados
scripts/                          Roteiro de cenários, execução contra o servidor, geração de tokens e da coleção Postman
docs/evidencias/                  Saídas das execuções de teste
```

## Massa de dados de demonstração

| Convite | Titular (e-mail @evently.test) | Evento | Situação inicial | Usado para |
|---|---|---|---|---|
| 10 | ana | 1 (cap. 3) | PENDENTE | confirmação |
| 11 | bruno | 1 | PENDENTE | recusa |
| 12 | carla | 1 | CONFIRMADO (`EVT-C12A0001`) | desistência |
| 13 | diego | 1 | CONFIRMADO (`EVT-D13B0002`) | transferência |
| 14 | elisa | 1 | PENDENTE, vigência encerrada | CONVITE_EXPIRADO |
| 20 / 21 | fernanda / gustavo | 2 (cap. 1, lotado) | CONFIRMADO / PENDENTE | SEM_VAGAS |
| 30 | helena | 3 (já iniciado) | CONFIRMADO | EVENTO_INICIADO |
| 40 | igor | 4 (sem transferência) | CONFIRMADO | TRANSFERENCIA_NAO_PERMITIDA |
| 50 | julia | 5 (trilha falha) | PENDENTE | FALHA_DEPENDENCIA (503) |

Outros usuários: `intruso` (convidado sem convite), `organizador` (dono dos eventos), `outroOrganizador`,
`portaria` (operador de portaria) e `maria` (`maria.souza@empresa.com`, substituta).

## Limitações conhecidas

- Os contextos vizinhos (Convites, Gestão do Evento, Preparação, Comunicação) e a persistência são
  adaptadores **em memória** atrás das interfaces de `src/portas`. Os dados se perdem quando o servidor
  reinicia. Trocar por Supabase/Resend exige apenas novos adaptadores, sem mudar o domínio.
- A reserva atômica de vagas usa a execução em uma única thread do Node.js. Com várias instâncias, ela
  precisaria de uma operação atômica no banco (por exemplo, `UPDATE ... WHERE ocupadas < capacidade`).
- A liberação automática da vaga quando o convite do substituto **expira** sem resposta não está
  implementada, porque depende de um agendador. A liberação na **recusa** do substituto está implementada.
- Fora de produção, sem `SUPABASE_JWT_SECRET`, o serviço usa um segredo local fixo para validar os tokens.
