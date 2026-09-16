import 'server-only';
import { put, list, get } from '@vercel/blob';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import type { Answers } from './answers';

/** 한 사람의 답변지. Blob에 people/<slug>.json 으로 한 덩이씩 저장한다. */
export type Person = {
  name: string;
  slug: string;
  salt: string;
  hash: string;
  answers: Answers;
  createdAt: string;
  updatedAt: string;
  /** 마지막으로 만든 AI 요약. 비교 화면에서 서로 읽을 수 있게 남겨 둔다. */
  summary?: string;
  summaryAt?: string;
  /** 요약을 만들 때 답한 문항 수. 그 뒤로 더 채웠는지 알려면 필요하다. */
  summaryAnswered?: number;
};
export type PublicPerson = { name: string; slug: string; answered: number; updatedAt: string };

const PREFIX = 'people/';

/** 이름을 파일 경로로 쓸 수 있게 다듬는다. 한글은 그대로 두고 경로 문자만 막는다. */
export function slugify(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
}

// ── 비밀번호 ──────────────────────────────────
// 간단한 비밀번호를 쓰는 곳이라 평문으로 두지 않는다. scrypt로 늘려 저장한다.
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 32).toString('hex') };
}
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const got = scryptSync(password, salt, 32);
  const want = Buffer.from(hash, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

// ── 세션 토큰 ─────────────────────────────────
// 매 요청마다 비밀번호를 다시 보내지 않도록 서명한 토큰을 쓴다.
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
function secret(): string {
  // Blob 토큰은 이 프로젝트에만 있고 배포마다 바뀌지 않는다. 서명 키로 재사용한다.
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.OPENAI_API_KEY ?? 'suljudo-dev-secret';
}
export function issueToken(slug: string): string {
  const body = `${slug}.${Date.now()}`;
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}
export function readToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let body: string;
  try {
    body = Buffer.from(b64, 'base64url').toString();
  } catch {
    return null;
  }
  const want = createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const at = body.lastIndexOf('.');
  const slug = body.slice(0, at);
  const issued = Number(body.slice(at + 1));
  if (!slug || !Number.isFinite(issued) || Date.now() - issued > TOKEN_TTL_MS) return null;
  return slug;
}

// ── 읽고 쓰기 ─────────────────────────────────
export async function loadPerson(slug: string): Promise<Person | null> {
  try {
    // 비공개 스토어는 get()으로 읽는다. head()의 downloadUrl은 그냥 가져올 수 없다.
    // useCache:false — 방금 저장한 답을 다른 기기에서 곧바로 이어받아야 한다.
    const res = await get(`${PREFIX}${slug}.json`, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return (await new Response(res.stream).json()) as Person;
  } catch (err) {
    console.error('loadPerson failed', slug, err);
    return null;
  }
}

export async function savePerson(person: Person): Promise<void> {
  await put(`${PREFIX}${person.slug}.json`, JSON.stringify(person), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function listPeople(): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const slug = b.pathname.slice(PREFIX.length).replace(/\.json$/, '');
      if (slug) out.push(slug);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}
