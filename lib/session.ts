/** 로그인 상태. 브라우저에만 둔다. 토큰은 서버가 서명해 준 것이고 30일 뒤 만료된다. */
export type Session = { name: string; slug: string; token: string };

export const SESSION_KEY = 'suljudo-session';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.token && s?.slug ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* 저장 못 해도 이번 방문은 쓸 수 있다 */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 무시 */
  }
}
