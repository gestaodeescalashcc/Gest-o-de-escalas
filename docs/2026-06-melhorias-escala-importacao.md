# Registro de mudanças — Junho/2026

Camadas da escala (Planejada/Troca/Realizada), trilha de auditoria imutável e
importação de escalas via Excel. Documento de referência do que foi entregue,
por que, e como validar.

> Branch base: `main` (a partir de `89e6896`). Todas as entregas abaixo já estão
> mergeadas na `main`.

---

## 1. Sincronização dos tipos do banco (`database.types.ts`)

**Problema:** o `src/lib/database.types.ts` estava desatualizado — só 19 tabelas
tipadas contra 30+ usadas via `.from()`. Tabelas reais (`punch_records`,
`absences`, `establishments`, `schedule_audit_log`, etc.) ficavam como `never`,
mascarando 95 erros do TypeScript.

**O que foi feito:**
- Regenerado a partir do projeto Supabase de produção:
  ```bash
  npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts
  ```
  (de 748 → 2.136 linhas, com todas as tabelas + tipos das RPCs).
- Corrigidos os 95 erros que a verdade dos tipos expôs:
  - remoção de imports/variáveis/funções mortas (`noUnusedLocals`);
  - interfaces locais alinhadas à nulabilidade real das colunas (`| null`);
  - casts dos retornos `Json` das RPCs (`UsersView`, `usePermissions`, `EditProfessionalModal`);
  - bug de tipo em `HourBankEntriesView` (`entry_type` agora `'credit' | 'debit'`);
  - payloads dos testes alinhados aos tipos `Insert`/`Update`.

**Como manter:** sempre que o schema mudar em produção, **regenerar** o arquivo
(não editar à mão). Commits: `b6ee7b1`.

---

## 2. Camadas da escala: Planejada / Troca / Realizada

O `ConsolidatedScheduleView` exibe a mesma grade (profissionais × dias) em três
momentos do ciclo de vida do plantão, via 3 URLs:
`/escala/:id/planejada | troca | realizada`.

### Regras implementadas

- **Planejada** — o plano. Nasce editável (status `Rascunho`). Ao **Finalizar
  Planejamento** (`finalize_schedule_planning`) é **congelada** (snapshot em
  `original_*`, `published_at` setado) e fica **somente leitura**.
  - Para editar de novo é preciso **Reabrir planejamento** explicitamente
    (`reopen_schedule_planning`) — botão disponível para **Administrador** ou
    **Coordenador do setor** da escala (respeita `allowed_departments`).
- **Troca e Remanejamento** — camada **sempre editável**; aplica trocas/
  remanejamentos sobre o plano (`shift_swaps`, RPC `create_and_apply_swap`).
- **Realizada** — **somente leitura** (resultado). É derivada de
  Planejada/Troca + ausências (overlay) + coberturas. Clicar numa célula não
  edita; faltas/atestados entram pelo módulo **Absenteísmo**.

Propagação só num sentido: editar a Planejada (antes de congelar) reflete na
Realizada; editar a Realizada nunca volta para a Planejada.

Commits: `be36baa`.

---

## 3. Trilha de auditoria imutável e unificada

**Migration:** `supabase/migrations/20260629120000_create_schedule_audit_log.sql`
(idempotente; rodar no SQL Editor do Supabase — já aplicada em produção).

Cria a tabela **`schedule_audit_log`** + 2 triggers que registram, numa única
linha do tempo, tudo o que acontece numa escala:

| Origem | Eventos |
|---|---|
| trigger em `shifts` | criação, edição, **troca/remanejamento**, soft-delete, restore, exclusão |
| trigger em `monthly_schedules` | **publicar** / **reabrir** planejamento |

Cada registro guarda **quem** (id + e-mail + nome), **quando** (timestamp) e o
**diff** (turno e profissional, antes→depois). Imutável: só `INSERT` via trigger;
`UPDATE`/`DELETE` bloqueados por RLS. Leitura restrita por setor
(`allowed_departments`).

**UI:** o painel *Histórico* dentro da escala foi repontado de `audit_logs` para
`schedule_audit_log`, com rótulos legíveis (Criou/Editou/Trocou/Removeu/
Restaurou/Excluiu/Publicou/Reabriu), diff por campo, filtros e export CSV.

Commits: `be36baa` (migration), `5b54e42` (UI).

---

## 4. Importação de escalas via Excel

Importa o modelo de planilha usado pelo HECC/FESF (aba `CGR`, uma por setor).

### Arquitetura

- **Catálogo compartilhado** — `src/lib/shiftTypes.ts`: `SHIFT_TYPES` (extraído do
  componente) + códigos novos do modelo (**FC**=Facultativo, **OU**=Outros,
  **INSS**) e aliases (FD→Feriado, FÉRIAS, FOLGA…). `resolveShiftCode()`
  normaliza acento/caixa.
- **Parser** — `src/utils/excelImport.ts` (usa `exceljs`): lê setor (`B4`),
  mês/ano (`AH2`, com fallback para o nome do arquivo; datas em UTC), dias
  (linha 6), valida o dia-da-semana, profissionais (linha 7+) com o código por
  dia, detecta códigos desconhecidos e ignora o rodapé/assinaturas.
- **Modal** — `src/components/Schedule/ImportScheduleModal.tsx`: upload →
  pré-visualização → confirmação.
  - casa **setor** com o departamento (normaliza acento e sufixo "- HECC");
  - **mês/ano** editável;
  - casa **profissionais** por matrícula, depois por nome; não-encontrados com
    escolha **Criar / Pular**;
  - detecta **escala existente** (setor+mês) e **substitui com confirmação**;
  - lista **códigos desconhecidos** (ignorados).
- **Inserção:** cria profissionais marcados (função→categoria quando casar),
  cria/substitui `monthly_schedules`, insere `shifts` em lote (com `original_*`),
  cria os vínculos de **setor** (`professional_department_links`) e **escala**
  (`schedule_professional_links`), e **publica** a Planejada (a auditoria
  registra tudo). Botão **Importar Excel** na lista de escalas.

### Testes
`src/tests/utils/excelImport.test.ts` (5 casos) + validação contra os 2 arquivos
reais (Nutrição/Julho e Farmácia/Junho).

Commits: `1a1062c` (fundação), `8c7f7c0` (modal/inserção), `10de0be` (vínculos),
`b4962ff` (setor primário), `7d8fc18` (CH semanal × mensal).

### Decisões de comportamento (acordadas)
- Profissional não encontrado → **listar e o usuário decide** (criar/pular).
- Escala já existente (setor+mês) → **substituir com confirmação**.
- Códigos novos (FC/FD/OU/INSS) → **mapeados** no catálogo.
- Importa como **Planejada já publicada** (congelada).

### Aprendizados/correções feitos durante a importação real
- **Visibilidade na grade:** um profissional só aparece se tiver setor primário
  **ou** vínculo em `professional_department_links` **e** estiver na escala
  (plantão ou `schedule_professional_links`). A importação passou a criar esses
  vínculos; profissional casado **sem setor primário** adota o setor da escala.
- **CH é semanal, não mensal:** a coluna CH da planilha (40h/36h) é carga
  **semanal**. Não é importada para `contracted_hours_per_month` (mensal, padrão
  **180**), para não gerar limites irreais.

---

## 5. Importações executadas em produção

| Setor | Mês | Plantões | Profissionais |
|---|---|---|---|
| Nutrição | Julho/2026 | 45 | 3 (2 casados + 1 criado) |
| Farmácia | Junho/2026 | 177 | 15 (11 casados + 4 criados) |

Ambas publicadas; auditoria com 222 inserções + 2 publicações.

**Coordenadores** dos setores (contas ativas, role Coordenador, login por e-mail):
- Nutrição — Deivson Nunes Ventura (`deivsonventura@fesfsus.ba.gov.br`)
- Farmácia — Lais Cardoso dos Anjos (`laisestrela@fesfsus.ba.gov.br`)

---

## Estado de qualidade ao final

- `npm run typecheck` → **0 erros**
- `npm run test` → **440 testes passando**
- `npm run build` → **OK**
