'use client';

import { useState } from 'react';
import type { Answers } from '@/lib/answers';
import type { Session } from '@/lib/session';
import { TOTAL } from '@/lib/questions';

type Props = { onDone: (session: Session, answers: Answers, created: boolean) => void };

/** 표지 제목. 글자마다 색과 기울기를 줘서 무지개 표지 느낌을 낸다. */
const TITLE = '술주도 이상형 설문지';
const TITLE_COLORS = [
  '#ff3b6b', '#ff8a1f', '#ffc700', '#39c26b', '#1fa8ff',
  '#6b5bff', '#c74bff', '#ff3b9e', '#ff6a1f', '#2bc4a8', '#1f6bff',
];

export default function Gate({ onDone }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '들어갈 수 없습니다.');
        setBusy(false);
        return;
      }
      onDone({ name: data.name, slug: data.slug, token: data.token }, data.answers ?? {}, data.created);
    } catch {
      setError('연결에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  const chars = [...TITLE];
  const mid = (chars.length - 1) / 2;

  return (
    <div className="gate">
      <div className="gate-box">
        <h1 className="cover-title" aria-label={TITLE}>
          {chars.map((ch, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                color: ch === ' ' ? 'transparent' : TITLE_COLORS[i % TITLE_COLORS.length],
                transform: `rotate(${((i - mid) * 3.2).toFixed(1)}deg) translateY(${(
                  Math.abs(i - mid) ** 1.7 * 1.1
                ).toFixed(1)}px)`,
              }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>

        <div className="cover-stage">
          <p className="bubble">
            설문 시작
            <br />
            할게용~
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cover-char" src="/char.webp" alt="" />
        </div>

        <div className="gate-card">
          <p className="gate-count">{TOTAL}문항 · 한 번에 다 못 채웁니다</p>

          <form onSubmit={submit}>
            <label className="gate-field">
              <span>이름</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="친구들이 알아볼 이름"
                autoComplete="username"
                maxLength={20}
                autoFocus
                required
              />
            </label>
            <label className="gate-field">
              <span>비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="네 자 이상"
                autoComplete="current-password"
                minLength={4}
                required
              />
            </label>

            {error && <p className="gate-err">{error}</p>}

            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? '확인하는 중…' : '시작하기'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
