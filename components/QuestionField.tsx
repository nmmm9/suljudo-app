'use client';

import { SCALE, type Question } from '@/lib/questions';
import { isAnswered, type Answer, type Answers } from '@/lib/answers';

type Props = {
  q: Question;
  answers: Answers;
  set: (key: string, value: Answer | undefined) => void;
};

/** 객체형 답(나이·키·단위)의 한 칸만 바꾼다. */
function patch(answers: Answers, key: string, field: string, value: string | boolean): Answer {
  const cur = answers[key];
  const obj = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {};
  return { ...obj, [field]: value };
}
function field(answers: Answers, key: string, name: string): string {
  const cur = answers[key];
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return '';
  const v = cur[name];
  return typeof v === 'string' ? v : '';
}
function flag(answers: Answers, key: string, name: string): boolean {
  const cur = answers[key];
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return false;
  return cur[name] === true;
}

export default function QuestionField({ q, answers, set }: Props) {
  const a = answers[q.key];
  const done = isAnswered(q, answers);

  const pickOne = (v: string) => set(q.key, a === v ? undefined : v);
  const pickMany = (v: string) => {
    const cur = Array.isArray(a) ? a : [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set(q.key, next.length ? next : undefined);
  };

  const num = (name: string, placeholder: string, disabled = false) => (
    <input
      type="number"
      inputMode="numeric"
      value={field(answers, q.key, name)}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => set(q.key, patch(answers, q.key, name, e.target.value))}
    />
  );

  const anyChip = (label = '상관없음') => {
    const on = flag(answers, q.key, 'any');
    return (
      <button type="button" className="chip" data-on={on} onClick={() => set(q.key, patch(answers, q.key, 'any', !on))}>
        {label}
      </button>
    );
  };

  let body: React.ReactNode = null;
  let showLabel = true;

  switch (q.type) {
    case 'text':
      body = (
        <input
          type="text"
          value={typeof a === 'string' ? a : ''}
          placeholder={q.placeholder ?? '자유롭게 입력'}
          onChange={(e) => set(q.key, e.target.value || undefined)}
        />
      );
      break;

    case 'area':
      body = (
        <textarea
          value={typeof a === 'string' ? a : ''}
          placeholder="자유롭게 적어주세요"
          onChange={(e) => set(q.key, e.target.value || undefined)}
        />
      );
      break;

    case 'scale':
      body = (
        <>
          <div className="chips scale">
            {SCALE.map((v) => (
              <button key={v} type="button" className="chip" data-on={a === v} onClick={() => pickOne(v)}>
                {v.replace('점', '')}
              </button>
            ))}
          </div>
          <p className="hint">1 덜 중요 → 5 매우 중요</p>
        </>
      );
      break;

    case 'choice':
      body = (
        <>
          <div className="chips">
            {q.options?.map((v) => (
              <button
                key={v}
                type="button"
                className="chip"
                data-on={q.multi ? Array.isArray(a) && a.includes(v) : a === v}
                onClick={() => (q.multi ? pickMany(v) : pickOne(v))}
              >
                {v}
              </button>
            ))}
          </div>
          {q.multi && <p className="hint">복수 선택 가능</p>}
        </>
      );
      break;

    case 'vs':
      showLabel = !q.bare;
      body = (
        <div className="vs" data-n={q.options?.length ?? 2}>
          {q.options?.map((v, i) => (
            <span key={v} style={{ display: 'contents' }}>
              {i > 0 && <em>VS</em>}
              <button type="button" className="opt" data-on={a === v} onClick={() => pickOne(v)}>
                {v}
              </button>
            </span>
          ))}
        </div>
      );
      break;

    case 'unit':
      body = (
        <div className="row">
          {num('v', '')} <span className="unit">{q.unit}</span>
        </div>
      );
      break;

    case 'age':
      body = (
        <div className="row">
          아래로 {num('down', '3')} 살까지, 위로 {num('up', '5')} 살까지 가능
        </div>
      );
      break;

    case 'height': {
      const any = flag(answers, q.key, 'any');
      body = (
        <div className="row">
          {num('min', '170', any)} ~ {num('max', '185', any)} <span className="unit">cm</span> {anyChip()}
        </div>
      );
      break;
    }

    case 'weight': {
      const any = flag(answers, q.key, 'any');
      body = (
        <div className="row">
          {num('v', '70', any)} <span className="unit">kg</span> {anyChip()}
        </div>
      );
      break;
    }
  }

  return (
    <div className="q" data-done={done}>
      {showLabel && <p className="lbl">{q.label}</p>}
      {body}
    </div>
  );
}
