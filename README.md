# 술주도 이상형 설문지

543문항 이상형 설문지. 다 채우면 AI가 읽고 어떤 사람인지 정리해 준다.

## 구성

- Next.js 15 App Router, TypeScript
- 답변은 브라우저 `localStorage`(키 `suljudo-v3`)에만 남고 서버로 가지 않는다.
  서버로 보내는 건 AI 요약을 누른 그 순간뿐이고, 저장하지 않는다.
- `app/api/summary` 가 OpenAI Responses API로 요약을 만들어 스트리밍한다.

## 파일

| 경로 | 역할 |
| --- | --- |
| `lib/questions.ts` | 문항 원본 543개와 파서. 정적 페이지 버전에서 그대로 옮겨 왔다. |
| `lib/answers.ts` | 답변 타입, 진행률, 결과 구조화, 평문 변환 |
| `components/Survey.tsx` | 설문 화면 전체 |
| `components/QuestionField.tsx` | 문항 한 개 렌더링 |
| `components/Summary.tsx` | AI 요약 호출과 스트리밍 표시 |
| `app/api/summary/route.ts` | 요약 생성 |

## 환경변수

| 이름 | 필수 | 기본값 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 필수 | 없음 |
| `OPENAI_MODEL` | 선택 | `gpt-5.6-terra` |

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # OPENAI_API_KEY 채우기
npm run dev
```

## 배포

```bash
npx vercel login      # 배포할 계정으로 로그인
npx vercel link
npx vercel env add OPENAI_API_KEY production
npx vercel --prod
```

## 문항을 고칠 때

`lib/questions.ts` 상단의 `RAW` 배열만 고치면 된다. 표기법은 파일 첫 줄 주석에 있다.
장이 달라도 라벨이 겹치는 문항이 있어서 답변 키는 `장이름·라벨` 형태다.
