'use client';

import { useState } from 'react';
import type { Answers } from '@/lib/answers';
import SummaryText from './SummaryText';

type Props = { name: string; answers: Answers; answered: number; token?: string };

export default function Summary({ name, answers, answered, token }: Props) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function run() {
    setState('loading');
    setText('');
    setError('');
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 토큰을 실어야 끝난 요약이 내 기록에 저장되고 비교 화면에 뜬다.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, answers }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: '요약을 받지 못했습니다.' }));
        setError(data.error ?? '요약을 받지 못했습니다.');
        setState('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      setState('done');
    } catch {
      setError('네트워크가 끊겼습니다. 다시 시도해 주세요.');
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <div className="ai-idle">
        <p>
          답한 {answered}문항을 AI가 읽고, 어떤 사람인지 정리해 줍니다.
          <br />
          심리, 만날 사람, 만날 자리까지 열한 꼭지로 나옵니다.
          <br />
          많이 채웠을수록 길고 자세해집니다. 1분에서 2분 걸립니다.
        </p>
        <button type="button" className="btn primary" onClick={run}>
          요약 받기
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="ai-idle">
        <p className="ai-err">{error}</p>
        <button type="button" className="btn" onClick={run}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="ai">
      {text ? <SummaryText text={text} /> : <p>읽는 중입니다…</p>}
      {state === 'loading' && <span className="cursor" />}
    </div>
  );
}
