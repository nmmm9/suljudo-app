import { SECTIONS, SCALE, type Question, type Section } from './questions';

/** 한 문항의 답. 문자열(단일선택·서술), 배열(복수선택), 객체(나이·키·단위 입력). */
export type Answer = string | string[] | Record<string, string | boolean>;
export type Answers = Record<string, Answer>;

export const STORAGE_KEY = 'suljudo-v3';

export function isAnswered(q: Question, answers: Answers): boolean {
  const a = answers[q.key];
  if (a == null) return false;
  if (typeof a === 'string') return a.trim() !== '';
  if (Array.isArray(a)) return a.length > 0;
  return Object.values(a).some((v) => (typeof v === 'string' ? v.trim() !== '' : v === true));
}

export function answeredCount(section: Section, answers: Answers): number {
  return section.items.filter((i) => i.kind === 'q' && isAnswered(i, answers)).length;
}

export function totalAnswered(answers: Answers): number {
  return SECTIONS.reduce((n, s) => n + answeredCount(s, answers), 0);
}

/** 답 하나를 사람이 읽는 한 줄로. */
export function formatAnswer(q: Question, answers: Answers): string {
  const a = answers[q.key];
  if (a == null) return '';
  if (typeof a === 'string') return a.trim();
  if (Array.isArray(a)) return a.join(', ');

  const o = a as Record<string, string | boolean>;
  switch (q.type) {
    case 'age':
      return `아래로 ${o.down || '?'}살, 위로 ${o.up || '?'}살까지`;
    case 'height':
      return o.any ? '상관없음' : `${o.min || '?'}~${o.max || '?'}cm`;
    case 'weight':
      return o.any ? '상관없음' : `${o.v || '?'}kg`;
    case 'unit':
      return `${o.v || '?'}${q.unit ?? ''}`;
    default:
      return Object.values(o).filter(Boolean).join(' ');
  }
}

export type ResultGroup = { sub: string; rows: [string, string][] };
export type ResultSection = { title: string; groups: ResultGroup[] };

/** 답한 문항만 장·소제목 구조 그대로 묶는다. */
export function buildResult(answers: Answers): ResultSection[] {
  const out: ResultSection[] = [];
  for (const s of SECTIONS) {
    const groups: ResultGroup[] = [];
    let g: ResultGroup | null = null;
    for (const item of s.items) {
      if (item.kind === 'heading') {
        g = { sub: item.label, rows: [] };
        groups.push(g);
        continue;
      }
      if (!isAnswered(item, answers)) continue;
      if (!g) {
        g = { sub: '', rows: [] };
        groups.push(g);
      }
      g.rows.push([item.label, formatAnswer(item, answers)]);
    }
    const filled = groups.filter((x) => x.rows.length > 0);
    if (filled.length) out.push({ title: s.title, groups: filled });
  }
  return out;
}

/** 결과를 평문으로. 복사용이자 AI에게 보내는 본문. */
export function resultText(answers: Answers, name: string, answered: number, total: number): string {
  const lines = [`술주도 이상형 설문지${name ? ` · ${name}` : ''}`, `${answered}/${total} 답변`];
  for (const s of buildResult(answers)) {
    lines.push('', `■ ${s.title}`);
    for (const g of s.groups) {
      if (g.sub) lines.push(`[${g.sub}]`);
      for (const [k, v] of g.rows) lines.push(`· ${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

/** 5점척도 답을 0~5 숫자로. 요약 프롬프트에 중요도 상위 항목을 뽑을 때 쓴다. */
export function scaleValue(a: Answer | undefined): number | null {
  if (typeof a !== 'string') return null;
  const i = (SCALE as readonly string[]).indexOf(a);
  return i < 0 ? null : i;
}
