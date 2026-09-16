import { totalAnswered, type Answers } from '@/lib/answers';
import { loadPerson, readToken, savePerson } from '@/lib/store';

export const runtime = 'nodejs';

function slugFrom(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  return readToken(auth.startsWith('Bearer ') ? auth.slice(7) : null);
}

/** 내 답변 가져오기. 다른 기기에서 이어서 할 때 쓴다. */
export async function GET(req: Request) {
  const slug = slugFrom(req);
  if (!slug) return Response.json({ error: '다시 로그인해 주세요.' }, { status: 401 });

  const person = await loadPerson(slug);
  if (!person) return Response.json({ error: '답변을 찾을 수 없습니다.' }, { status: 404 });

  return Response.json({
    name: person.name,
    answers: person.answers,
    answered: totalAnswered(person.answers),
    updatedAt: person.updatedAt,
  });
}

/** 내 답변 저장. 통째로 덮어쓴다. */
export async function PUT(req: Request) {
  const slug = slugFrom(req);
  if (!slug) return Response.json({ error: '다시 로그인해 주세요.' }, { status: 401 });

  let body: { answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 });
  }
  if (!body.answers || typeof body.answers !== 'object') {
    return Response.json({ error: '답변이 없습니다.' }, { status: 400 });
  }

  const person = await loadPerson(slug);
  if (!person) return Response.json({ error: '답변을 찾을 수 없습니다.' }, { status: 404 });

  person.answers = body.answers;
  person.updatedAt = new Date().toISOString();
  await savePerson(person);

  return Response.json({ ok: true, answered: totalAnswered(person.answers), updatedAt: person.updatedAt });
}
