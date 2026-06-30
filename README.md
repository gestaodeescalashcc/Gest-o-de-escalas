# MedScale — Gestão de Escalas Hospitalares (HECC)

Plataforma web para gestão de escalas de plantão, ponto eletrônico e jornada de
profissionais de saúde, usada no HECC (Fundação Estatal de Saúde da Família —
FESF/SUS). Cobre desde o planejamento mensal da escala até a apuração da jornada
com conformidade fiscal (REP-P / Portaria MTP 671/2021).

## Visão geral

- **Escalas mensais** em três camadas (Planejada / Troca / Realizada).
- **Profissionais**, categorias, empresas, setores (departamentos) e
  estabelecimentos.
- **Trocas e remanejamentos** de plantão com aprovação.
- **Absenteísmo** (faltas, licenças, férias, atestados) com overlay na escala.
- **Refeições** geradas automaticamente por jornada.
- **Ponto eletrônico** com reconhecimento facial + liveness e **REP-P**
  (cadeia de hash imutável, NSR, comprovante, AFD/AEJ).
- **Banco de horas** (créditos/débitos/compensações, multiplicadores, feriados).
- **Importação de escalas via Excel** (modelo padrão por setor).
- **Trilha de auditoria** imutável das escalas (quem/quando/o quê).
- **Usuários, papéis e permissões** com restrição por setor.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS |
| Roteamento | React Router (lazy-loading por rota) |
| Backend | Supabase (PostgreSQL + RLS + Auth + Edge Functions/Deno) |
| Planilhas | ExcelJS (import/export `.xlsx`) |
| Biometria | face-api.js (no navegador) |
| Ícones | lucide-react |
| Testes | Vitest + Testing Library (happy-dom) |
| Deploy | Vercel (SPA) |

## Conceito central: as 3 camadas da escala

A mesma grade (profissionais × dias) é vista em três momentos, via URLs
`/escala/:id/{planejada|troca|realizada}`:

- **Planejada** — o plano. Editável enquanto `Rascunho`; ao **Finalizar
  Planejamento** é congelada (somente leitura). Para editar de novo, é preciso
  **Reabrir planejamento** (Administrador ou Coordenador do setor).
- **Troca e Remanejamento** — camada **sempre editável**; aplica trocas sobre o
  plano.
- **Realizada** — **somente leitura**; resultado = Planejada/Troca + ausências +
  coberturas. Ausências entram pelo módulo **Absenteísmo**.

Detalhes e histórico recente em [`docs/2026-06-melhorias-escala-importacao.md`](docs/2026-06-melhorias-escala-importacao.md).

## Começando

### Pré-requisitos
- Node.js 18+
- Um projeto Supabase (URL + anon key)

### Variáveis de ambiente
Crie um arquivo `.env` na raiz:

```bash
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

### Instalação e execução

```bash
npm install
npm run dev        # ambiente de desenvolvimento (Vite)
npm run build      # build de produção
npm run preview    # serve o build localmente
```

### Qualidade

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
npm run test:coverage
```

## Banco de dados (Supabase)

- **Migrations:** `supabase/migrations/` (aplicar via Supabase CLI ou SQL Editor).
- **Edge Functions:** `supabase/functions/` — `create-user`, `register-punch`,
  `generate-afd`, `generate-aej`, `verify-chain-integrity`, `setup-admin`.
- **Tipos TypeScript:** `src/lib/database.types.ts` é **gerado** a partir do
  schema — não editar à mão:
  ```bash
  npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
  ```

### Segurança (RLS)
Acesso multi-camada: políticas **permissivas** por setor (`allowed_departments`
em `system_users`) combinadas com políticas **restritivas** por permissão
(`user_roles.permissions`, via `user_has_permission`). Papéis típicos:
Administrador, Gestor, Coordenador, Médico, Visualizador.

## Estrutura do projeto

```
src/
  components/
    Schedule/      escalas (ConsolidatedScheduleView, importação, refeições…)
    Swaps/         trocas de plantão
    Absenteeism/   absenteísmo
    Timesheet/     ponto eletrônico (REP-P)
    HourBank/      banco de horas
    FacialRecognition/  captura facial
    Professionals/ Users/ Departments/ Tables/ Reports/ Dashboard/ …
  lib/             supabase client, database.types, shiftTypes (catálogo)
  utils/           excelExport, excelImport, pdfExport
  hooks/           usePermissions, useToast
  contexts/        AuthContext
  tests/           Vitest
supabase/
  migrations/      schema versionado
  functions/       Edge Functions (Deno)
docs/              documentação e registro de mudanças
```

## Importação de escalas (Excel)

Na lista de escalas, **Importar Excel** lê o modelo padrão (aba `CGR`, uma por
setor): identifica setor, mês/ano e profissionais, casa com o cadastro
(matrícula → nome), permite criar os ausentes, e importa como **Planejada
publicada**. A trilha de auditoria registra cada inserção. Parser e regras em
`src/utils/excelImport.ts` e `src/lib/shiftTypes.ts`.

## Deploy

Configurado para **Vercel** (`vercel.json`, SPA com rewrites). O build é
`npm run build` (saída em `dist/`). Configure as variáveis `VITE_SUPABASE_*` no
provedor.
