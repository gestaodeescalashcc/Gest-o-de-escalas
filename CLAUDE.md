# CLAUDE.md — instruções para o Claude Code neste repositório

**MedScale** — SPA Vite + React (TypeScript) de gestão de escalas hospitalares
(HECC / FESF-SUS). O backend é o **Supabase hospedado** (não há servidor próprio).
Deploy: **push na `main` → a Vercel builda e publica automaticamente** (e há
`Dockerfile`/`nginx.conf` para deploy alternativo no EasyPanel).

Credenciais do Supabase para rodar SQL/migrations (Management API) estão em
`claude-supabase.env.local` (gitignored) — leia esse arquivo quando precisar.

---

## Commits e deploy — SEMPRE seguir

1. **Commitar e dar `git push origin main` automaticamente** ao concluir uma
   mudança de código verificada — **sem pedir confirmação**. O push dispara o
   deploy. (Se estiver na branch padrão, pode commitar direto na `main`: é o
   fluxo deste projeto.)

2. **Só os arquivos da tarefa.** Nunca use `git add .` / `git add -A`. Faça
   `git add <arquivos que você mudou>`. **Nunca commite:**
   - segredos: `.env.local`, `claude-supabase.env.local`, qualquer chave/token;
   - dados soltos na raiz: `*.xlsx`, `*.csv`, `*.sql`, `_*`;
   - `node_modules`, `dist`.

3. **Mensagem — Conventional Commits, em português**, resumo no imperativo,
   corpo em bullets, e trailer de co-autoria:
   ```
   tipo(escopo): resumo curto no imperativo

   - o que mudou (bullet)
   - outro ponto relevante

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
   - **Tipos:** `feat`, `fix`, `refactor`, `style`, `chore`, `docs`.
   - **Escopo** mais comum: `escala` (use `deploy` para infra/CI).
   - No trailer, use o nome do **seu** modelo (ex.: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).
   - Dica: passe a mensagem via heredoc — `git commit -F - <<'EOF' … EOF`.

4. **Verifique antes de commitar** algo não-trivial:
   - `npm run typecheck` — sempre.
   - `npm run build` — quando o deploy puder quebrar (muitas mudanças, infra,
     mexidas em rota/build). Não deixe a `main` quebrar o build da Vercel.

5. **Nunca** use `--no-verify`, `--force`/`--force-with-lease`, nem pule hooks
   ou assinatura, a menos que o usuário peça explicitamente.

### Exemplos reais deste repo
```
feat(escala): setor vira contexto fixo (nunca mais lista misturada)
fix(escala): Escala do Dia respeita o setor do contexto
style(escala): troca barra colorida por sombra na cor da categoria no hub médico
chore(deploy): Dockerfile + nginx para EasyPanel; corrige .env do projeto
```
