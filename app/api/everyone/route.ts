import { formatAnswer, isAnswered, totalAnswered, type Answers } from '@/lib/answers';
import { QUESTIONS } from '@/lib/questions';
import { listPeople, loadPerson, readToken } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export type ComparePerson = {
  name: string;
  slug: string;
  answered: number;
  updatedAt: string;
  /** 마지막으로 만든 AI 요약. 아직 안 돌렸으면 없다. */
  summary?: string;
  summaryAt?: string;
  summaryAnswered?: number;
};
export type CompareData = {
  people: ComparePerson[];
  /** 문항 키 → 사람 slug → 사람이 읽는 답. 답하지 않았으면 키가 없다. */
  rows: Record<string, Record<string, string>>;
};

/** 모두의 답을 한 번에 내려준다. 로그인한 사람만 볼 수 있다. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const me = readToken(auth.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!me) return Response.json({ error: '다시 로그인해 주세요.' }, { status: 401 });

  const slugs = await listPeople();
  const loaded = await Promise.all(slugs.map((s) => loadPerson(s)));

  const people: ComparePerson[] = [];
  const rows: CompareData['rows'] = {};

  for (const person of loaded) {
    if (!person) continue;
    const answers = person.answers as Answers;
    people.push({
      name: person.name,
      slug: person.slug,
      answered: totalAnswered(answers),
      updatedAt: person.updatedAt,
      summary: person.summary,
      summaryAt: person.summaryAt,
      summaryAnswered: person.summaryAnswered,
    });
    for (const q of QUESTIONS) {
      if (!isAnswered(q, answers)) continue;
      (rows[q.key] ??= {})[person.slug] = formatAnswer(q, answers);
    }
  }

  // 많이 채운 사람부터
  people.sort((a, b) => b.answered - a.answered);

  return Response.json({ people, rows } satisfies CompareData, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
