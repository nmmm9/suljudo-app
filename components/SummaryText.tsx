'use client';

/** 모델에 허용한 문법만 그린다: '## 소제목', '- 목록', 빈 줄로 나뉜 문단, **강조**. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{part}</span>
    )
  );
}

export default function SummaryText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (i: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${i}`}>
        {list.map((li, j) => (
          <li key={j}>{renderInline(li, `li-${i}-${j}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('- ')) {
      list.push(t.slice(2));
      return;
    }
    flushList(i);
    if (!t) return;
    if (t.startsWith('## ')) blocks.push(<h2 key={i}>{t.slice(3)}</h2>);
    else if (t.startsWith('# ')) blocks.push(<h2 key={i}>{t.slice(2)}</h2>);
    else blocks.push(<p key={i}>{renderInline(t, `p-${i}`)}</p>);
  });
  flushList(-1);

  return <>{blocks}</>;
}
