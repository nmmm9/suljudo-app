'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SECTIONS, TOTAL } from '@/lib/questions';
import {
  STORAGE_KEY,
  answeredCount,
  buildResult,
  resultText,
  totalAnswered,
  type Answer,
  type Answers,
} from '@/lib/answers';
import QuestionField from './QuestionField';
import Summary from './Summary';

const NAME_KEY = '__name';

export default function Survey() {
  const [answers, setAnswers] = useState<Answers>({});
  const [cur, setCur] = useState(0);
  const [result, setResult] = useState<'closed' | 'list' | 'ai'>('closed');
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 저장된 답 복원. 브라우저에만 남는다.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAnswers(JSON.parse(saved) as Answers);
    } catch {
      /* 시크릿 모드 등에서 읽기 실패 — 빈 상태로 시작한다 */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      /* 저장 못 해도 진행은 막지 않는다 */
    }
  }, [answers, ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const set = useCallback((key: string, value: Answer | undefined) => {
    setAnswers((prev) => {
      if (value === undefined) {
        const { [key]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const name = typeof answers[NAME_KEY] === 'string' ? (answers[NAME_KEY] as string) : '';
  const answered = useMemo(() => totalAnswered(answers), [answers]);
  const counts = useMemo(() => SECTIONS.map((s) => answeredCount(s, answers)), [answers]);
  const section = SECTIONS[cur];

  const go = (i: number) => {
    setCur(i);
    window.scrollTo({ top: 0 });
  };

  const download = () => {
    const blob = new Blob([JSON.stringify({ name, savedAt: new Date().toISOString(), answers }, null, 1)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `술주도_${name || '답변'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setToast('파일로 저장했어요');
  };

  const load = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      const wrapped = (parsed as { answers?: unknown }).answers;
      const next = (wrapped && typeof wrapped === 'object' ? wrapped : parsed) as Answers;
      setAnswers(next);
      setToast('불러왔어요');
    } catch {
      setToast('파일을 읽을 수 없어요');
    }
  };

  const copy = async () => {
    const text = resultText(answers, name, answered, TOTAL);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setToast('복사했어요');
  };

  const reset = () => {
    if (!confirm('모든 답변을 지울까요?')) return;
    setAnswers({});
    setCur(0);
    setToast('초기화했어요');
  };

  const sections = buildResult(answers);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="head">
            <h1>
              술주도 이상형 설문지
              <small>
                {answered} / {TOTAL} 답변
              </small>
            </h1>
            <label className="name">
              이름
              <input
                type="text"
                value={name}
                placeholder="입력"
                autoComplete="off"
                onChange={(e) => set(NAME_KEY, e.target.value || undefined)}
              />
            </label>
          </div>
          <nav className="tabs">
            {SECTIONS.map((s, i) => (
              <button key={s.tab} type="button" className="tab" data-on={i === cur} onClick={() => go(i)}>
                {s.tab}
                <small>
                  {counts[i]}/{s.count}
                </small>
              </button>
            ))}
          </nav>
        </div>
        <div className="prog">
          <i style={{ width: `${TOTAL ? (answered / TOTAL) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="wrap">
        <h2 className="sec-title">{section.title}</h2>
        <p className="sec-sub">{section.count}문항</p>
        {section.items.map((item, i) =>
          item.kind === 'heading' ? (
            <h3 className="sub-head" key={`h-${i}`}>
              {item.label}
            </h3>
          ) : (
            <QuestionField key={item.key} q={item} answers={answers} set={set} />
          )
        )}

        <div className="foot">
          <button type="button" onClick={download}>
            파일로 저장
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            불러오기
          </button>
          <button type="button" onClick={() => setResult('ai')}>
            결과 보기
          </button>
          <button type="button" className="danger" onClick={reset}>
            전체 초기화
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void load(f);
            }}
          />
        </div>
      </main>

      <div className="bar">
        <div className="wrap">
          <button type="button" className="btn" disabled={cur === 0} onClick={() => go(cur - 1)}>
            이전
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => (cur < SECTIONS.length - 1 ? go(cur + 1) : setResult('ai'))}
          >
            {cur < SECTIONS.length - 1 ? '다음' : '결과 보기'}
          </button>
        </div>
      </div>

      {result !== 'closed' && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setResult('closed')}>
          <div className="panel">
            <h2>결과</h2>
            <div className="panel-tabs">
              <button type="button" data-on={result === 'ai'} onClick={() => setResult('ai')}>
                AI 요약
              </button>
              <button type="button" data-on={result === 'list'} onClick={() => setResult('list')}>
                내 답변
              </button>
            </div>

            <div className="out">
              {result === 'ai' ? (
                <Summary name={name} answers={answers} answered={answered} />
              ) : (
                <>
                  <div className="rs-h">
                    <b>{name || '이름 없음'}</b>
                    <span>
                      {answered} / {TOTAL} 답변
                    </span>
                  </div>
                  {sections.length === 0 ? (
                    <p className="rs-empty">아직 답한 항목이 없어요.</p>
                  ) : (
                    sections.map((s) => (
                      <div className="rs-s" key={s.title}>
                        <h4>{s.title}</h4>
                        {s.groups.map((g, gi) => (
                          <div key={gi}>
                            {g.sub && <p className="rs-sub">{g.sub}</p>}
                            <dl>
                              {g.rows.map(([k, v]) => (
                                <span key={k} style={{ display: 'contents' }}>
                                  <dt>{k}</dt>
                                  <dd>{v}</dd>
                                </span>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="acts">
              <button type="button" className="btn" onClick={copy}>
                텍스트 복사
              </button>
              <button type="button" className="btn" onClick={() => setResult('closed')}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
