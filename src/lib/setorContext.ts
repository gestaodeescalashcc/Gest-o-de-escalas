// Contexto de setor "fixo": uma vez escolhido um setor na tela inicial, o app
// inteiro fica preso a ele (lista, grade, e os modos Planejada/Troca/Realizada
// na sidebar). Persistido em localStorage para não se perder ao navegar.

const KEY = 'medscale.currentSetor';

export interface CurrentSetor {
  id: string;
  name?: string;
}

export function setCurrentSetor(id: string, name?: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, name }));
  } catch {
    /* ignore */
  }
}

export function getCurrentSetor(): CurrentSetor | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentSetor) : null;
  } catch {
    return null;
  }
}

export function getCurrentSetorId(): string | null {
  return getCurrentSetor()?.id ?? null;
}

export function clearCurrentSetor(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
