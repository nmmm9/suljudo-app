import { totalAnswered, type Answers } from '@/lib/answers';
import {
  hashPassword,
  issueToken,
  loadPerson,
  savePerson,
  slugify,
  verifyPassword,
  type Person,
} from '@/lib/store';

export const runtime = 'nodejs';

/** 이름과 비밀번호로 이어서 하기. 없으면 새로 만든다. */
export async function POST(req: Request) {
  let body: { name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const password = (body.password ?? '').trim();
  if (name.length < 1 || name.length > 20) {
    return Response.json({ error: '이름은 1자에서 20자 사이로 적어주세요.' }, { status: 400 });
  }
  if (password.length < 4) {
    return Response.json({ error: '비밀번호는 4자 이상으로 정해주세요.' }, { status: 400 });
  }

  const slug = slugify(name);
  if (!slug) return Response.json({ error: '쓸 수 없는 이름입니다.' }, { status: 400 });

  const existing = await loadPerson(slug);

  if (existing) {
    if (!verifyPassword(password, existing.salt, existing.hash)) {
      return Response.json(
        { error: '이 이름은 이미 있습니다. 비밀번호가 다릅니다. 다른 이름을 쓰거나 비밀번호를 확인해 주세요.' },
        { status: 401 }
      );
    }
    return Response.json({
      created: false,
      name: existing.name,
      slug,
      token: issueToken(slug),
      answers: existing.answers,
      answered: totalAnswered(existing.answers),
    });
  }

  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const person: Person = { name, slug, salt, hash, answers: {} as Answers, createdAt: now, updatedAt: now };
  await savePerson(person);

  return Response.json({
    created: true,
    name,
    slug,
    token: issueToken(slug),
    answers: {},
    answered: 0,
  });
}
