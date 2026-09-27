# 할 일 + 계획 관리 앱

오늘 할 일, 전체 목록, 주간 계획을 한곳에서 관리하는 개인용 반응형 웹 앱입니다. GitHub 계정으로 로그인합니다.
요구사항은 [PRD.md](PRD.md), 구현 계획과 수용 기준(AC1~AC39)은 [PLAN.md](PLAN.md)에 있습니다.

| 폴더 | 내용 |
| --- | --- |
| `shared/` | 작업 타입과 zod 검증 스키마 (web·api가 함께 사용) |
| `server/` | Express + MongoDB API (`/api/tasks`, `/api/me`, `/auth/github`, `/api/health`). 운영에서는 웹도 함께 서빙 |
| `web/` | React 18 + Vite 화면 (오늘·전체·주간·설정) |
| `e2e/` | Playwright E2E 테스트 |

## 사전 준비 (Windows 기준)

- Node.js 20 이상
- Docker Desktop (WSL2 백엔드): 로컬 개발용 MongoDB를 띄울 때만 필요합니다. 자동 테스트에는 필요 없습니다.
- 최초 1회: `npm install`, `npx playwright install chromium`
- 테스트는 `mongodb-memory-server`를 씁니다. 처음 실행할 때 MongoDB 7.0.14 실행 파일(약 590MB)을 내려받으므로 몇 분 걸릴 수 있습니다. 버전은 `package.json`의 `config.mongodbMemoryServer.version`에 고정되어 있습니다.

Windows PowerShell 5.1은 `&&`와 `VAR=값 명령` 문법을 지원하지 않습니다. 아래 명령은 모두 npm 스크립트이므로 한 줄씩 실행하면 됩니다.

## GitHub 로그인 설정

로그인에는 GitHub OAuth App이 필요합니다. 로컬용과 운영용 콜백 주소가 다르므로 앱을 두 개 만드는 것을 권합니다.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. 값을 입력합니다.

   | 항목 | 로컬 개발 | 운영(Render) |
   | --- | --- | --- |
   | Application name | `todo-planner (local)` | `todo-planner` |
   | Homepage URL | `http://localhost:5173` | `https://<서비스>.onrender.com` |
   | Authorization callback URL | `http://localhost:5173/auth/github/callback` | `https://<서비스>.onrender.com/auth/github/callback` |

3. **Register application** → **Client ID**를 복사하고, **Generate a new client secret**으로 만든 **Client secret**을 복사합니다. Client secret은 한 번만 보입니다.
4. 로컬: `.env.example`을 `.env`로 복사하고 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`(32자 이상 무작위)을 채웁니다.
   운영: Render 서비스의 Environment에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`을 넣습니다(`SESSION_SECRET`은 Render가 자동 생성).

Client secret은 코드나 git에 넣지 마세요. 서버는 이 값을 환경 변수에서만 읽고, 없으면 시작하지 않습니다.

**동작 방식**: `/auth/github` → GitHub 로그인·허락 → `/auth/github/callback`에서 state를 확인하고 code를 토큰으로 바꾼 뒤 GitHub 사용자 정보(username, avatar_url)를 `users`에 저장합니다. 세션은 MongoDB `sessions` 컬렉션에 저장되고, 브라우저에는 HttpOnly·SameSite=Lax 쿠키(`todo.sid`)만 남습니다. 로그아웃하면 세션 문서를 지우고 쿠키를 삭제합니다. GitHub 권한은 `read:user`(공개 프로필 읽기)만 요청하며, GitHub 토큰은 저장하지 않습니다.

## 실행

```
npm run db:up      # docker compose up -d (MongoDB). 다른 MongoDB를 쓰면 생략
npm run dev        # shared 빌드 감시 + api(:4000) + web(:5173) 동시 실행
```

브라우저에서 http://localhost:5173 을 엽니다. Vite 개발 서버가 `/api`·`/auth` 요청을 API(:4000)로 전달하므로 웹과 API가 같은 출처가 되어 세션 쿠키가 동작합니다. 끝낼 때는 `npm run db:stop`.

api 개발 서버는 루트의 `.env`를 읽습니다. GitHub 값이 비어 있으면 API가 시작하지 않습니다.

### 기존 데이터 마이그레이션

로그인 도입 전의 작업(익명 ID로 저장된 문서)은 서버가 시작할 때 자동으로 새 스키마로 바뀝니다. 직접 실행하려면:

```
npm run migrate -w server
```

- 기존 문서에 `userId: null`을 넣고, 옛 익명 ID(`ownerId`)를 `legacyClientId`로 옮깁니다. 여러 번 실행해도 결과가 같습니다.
- 그 브라우저에서 처음 로그인하면, 브라우저에 남아 있던 옛 익명 ID의 작업을 로그인한 계정으로 자동으로 가져옵니다(`POST /api/tasks/claim`).

## 검증

```
npm run typecheck   # tsc -b (shared, api, web, e2e)
npm run lint        # eslint
npm test            # 단위·컴포넌트·API 통합 테스트
npm run test:tz     # America/Los_Angeles 시간대에서 다시 실행
npm run test:e2e    # Playwright, 375×667·1280×800 두 뷰포트
npm run build       # shared → api → web 순서로 빌드
```

`pretest`, `predev` 등의 스크립트가 `shared`를 먼저 빌드하므로 처음 받은 저장소에서도 바로 실행됩니다.

## 환경 변수

| 이름 | 쓰는 곳 | 설명 | 예 |
| --- | --- | --- | --- |
| `MONGODB_URI` | api | MongoDB 연결 문자열 | `mongodb+srv://…/todo-planner` |
| `PORT` | api | 서버 포트 | `4000` |
| `GITHUB_CLIENT_ID` | api (필수) | GitHub OAuth App의 Client ID | `Iv1.abc…` |
| `GITHUB_CLIENT_SECRET` | api (필수) | GitHub OAuth App의 Client secret. 코드·git에 넣지 않는다 | (비밀) |
| `SESSION_SECRET` | api (필수) | 세션 쿠키 서명용 무작위 문자열, 32자 이상 | (비밀) |
| `PUBLIC_URL` | api | 사용자가 접속하는 주소. OAuth 콜백 주소를 만든다. 없으면 `RENDER_EXTERNAL_URL`, 그것도 없으면 `http://localhost:5173`. `https`면 쿠키에 Secure가 붙는다 | `https://todo.onrender.com` |
| `SERVE_WEB` | api | `true`면 API가 `web/dist`를 함께 서빙한다(운영) | `true` |
| `TRUST_PROXY` | api | Express `trust proxy` 값. 프록시 뒤(Render·Railway)에서는 `1`. 이 값이 없으면 요청 수 제한이 모든 사용자를 한 IP로 셉니다 | `1` |
| `RATE_LIMIT_DISABLED` | api | `true`면 요청 수 제한(IP당 분당 120회)을 끕니다. 테스트·E2E 전용 | `false` |
| `LOG_LEVEL` | api | pino 로그 수준 | `info` |
| `API_PROXY_TARGET` | web (Vite) | 개발·미리보기 서버가 `/api`·`/auth`를 전달할 API 주소 | `http://localhost:4000` |
| `MONGOMS_VERSION` | 테스트 | mongodb-memory-server 버전 | `7.0.14` |
| `MONGOMS_DISABLE_POSTINSTALL` | 배포 빌드 | `1`이면 `npm ci` 때 테스트용 MongoDB 실행 파일(약 590MB) 다운로드를 건너뜁니다 | `1` |

## 배포

MongoDB Atlas(DB) + Vercel(웹과 API를 한 프로젝트로)로 배포합니다. Render를 쓰려면 아래 "Render로 배포할 때"를 보세요.

웹과 API를 한 도메인에 두는 이유: 로그인 세션 쿠키가 브라우저에서 1st-party로 동작해야 하기 때문입니다.

### MongoDB Atlas (DB)

1. https://www.mongodb.com/cloud/atlas 에 가입하고 **M0 (Free)** 클러스터를 만듭니다. 지역은 사용자와 가까운 곳(예: AWS Seoul·Singapore)을 고릅니다.
2. **Database Access**: 데이터베이스 사용자(아이디·비밀번호)를 만듭니다.
3. **Network Access**: `0.0.0.0/0`(모든 IP)을 허용합니다. Render 무료 플랜은 고정 IP가 없기 때문입니다. 대신 비밀번호를 길고 무작위로 정하세요.
4. **Connect → Drivers**에서 연결 문자열을 복사하고, `<password>`를 실제 비밀번호로, 경로에 DB 이름을 넣습니다.
   예: `mongodb+srv://todo:비밀번호@cluster0.xxxxx.mongodb.net/todo-planner?retryWrites=true&w=majority`

### Vercel 구성

- 루트의 `app.ts`가 Vercel 진입 파일입니다. Express 앱(`server/src/vercel.ts`)을 default export하고, Vercel은 이를 함수 하나로 배포합니다. 첫 요청 때 DB에 연결하고 마이그레이션을 실행한 뒤, 인스턴스가 살아 있는 동안 연결을 재사용합니다.
- 빌드(`npm run build:vercel`)는 shared·server·web을 빌드합니다. Vercel의 Express 프리셋은 빌드 중에 만든 정적 파일을 CDN으로 서빙하지 않으므로, `vercel.json`의 `functions.app.ts.includeFiles`로 `web/dist`를 함수에 포함하고 Express가 웹 화면과 API를 함께 서빙합니다(Render와 같은 구조).
- 설정은 [`vercel.json`](vercel.json)에 있고, CLI로 배포할 때 올리지 않을 파일(특히 `.env`)은 [`.vercelignore`](.vercelignore)에 있습니다.
- Vercel에서는 `TRUST_PROXY`가 기본 1이고, `PUBLIC_URL`이 없으면 운영 도메인(`VERCEL_PROJECT_PRODUCTION_URL`)을 씁니다.

### Vercel 배포 절차

1. 위 "MongoDB Atlas"대로 DB를 준비합니다. Vercel은 고정 IP가 없으므로 Network Access에 `0.0.0.0/0`을 허용합니다.
2. Vercel 로그인: `npx vercel login`
3. 프로젝트 연결: `npx vercel link` (처음 한 번). 운영 도메인(예: `todo-planner.vercel.app`)이 정해집니다.
4. 운영용 GitHub OAuth App을 만듭니다. Homepage URL `https://<운영 도메인>`, Authorization callback URL `https://<운영 도메인>/auth/github/callback`
5. 환경 변수(Production)를 등록합니다: `npx vercel env add MONGODB_URI production` 처럼 `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`(32자 이상 무작위)
6. 배포: `npx vercel --prod`

## Render로 배포할 때

### Render 서비스

1. https://render.com 에 GitHub 계정으로 가입하고, 이 저장소에 대한 접근을 허용합니다.
2. **New → Blueprint** → 이 저장소를 고릅니다. `render.yaml`을 읽어 서비스 `todo-planner`(Node, 무료 플랜, Singapore, 상태 점검 `/api/health`)를 보여 줍니다.
3. 입력을 요구하는 `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`을 넣고 **Apply**를 누릅니다.
   `SESSION_SECRET`은 Render가 만들고, `SERVE_WEB=true`, `TRUST_PROXY=1`은 미리 설정되어 있습니다. 서비스 주소는 Render가 `RENDER_EXTERNAL_URL`로 알려 줍니다.
4. 서비스 주소(`https://todo-planner….onrender.com`)가 정해지면, 운영용 GitHub OAuth App의 Homepage URL과 Authorization callback URL을 그 주소로 맞춥니다.
5. 서비스 주소로 접속해 GitHub로 로그인합니다.

이후 `main`에 푸시하면 Render가 자동으로 다시 배포합니다.

### 다른 호스팅을 쓸 때

- 빌드: `npm ci && npm run build -w shared && npm run build -w server && npm run build -w web`
- 시작: `npm run start -w server`
- 환경 변수: `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `PUBLIC_URL`(서비스 주소), `SERVE_WEB=true`, `TRUST_PROXY=1`, `MONGOMS_DISABLE_POSTINSTALL=1`

### Render 무료 인스턴스의 휴면

Render 무료 인스턴스는 한동안 요청이 없으면 잠들고, 다시 깨어나는 데 최대 1분쯤 걸립니다. 앱은 다음과 같이 대응합니다.

- 첫 목록 요청이 3초 넘게 걸리면 "서버에 연결하는 중입니다" 안내를 보여 주고, 최대 4회(2·4·8초 간격, 60초 상한) 다시 시도합니다. 목록을 받기 전에는 쓰기를 막습니다.
- 모든 요청의 시간 초과는 20초입니다. 서버가 그보다 늦게 깨어나면 저장이 실패로 표시되고 [다시 시도]로 복구합니다.

자주 불편하다면 잠들지 않는 요금제나 호스팅으로 옮기세요.

### 로그에 세션 쿠키가 남지 않는지 확인

세션 쿠키(`todo.sid`)는 로그인 자격입니다. API는 `pino-http`의 `redact`로 요청의 `Cookie` 헤더, 응답의 `Set-Cookie` 헤더, 요청 본문을 로그에서 지웁니다. 배포한 뒤 호스팅의 로그 화면(Render: Logs)에서 `todo.sid`를 검색해 결과가 없는지 확인하세요.

## 데이터와 보안에 대한 안내

- GitHub 계정으로 로그인해야 쓸 수 있습니다. 로그인하지 않은 요청은 `/api/tasks`에서 401을 받습니다.
- 할 일은 로그인한 사용자(`tasks.userId`)에 묶여 있어 본인 것만 조회·수정·삭제할 수 있습니다.
- 상태를 바꾸는 요청에는 `X-Requested-With` 헤더가 필요합니다. SameSite=Lax 쿠키와 함께 다른 사이트에서 보내는 요청(CSRF)을 막습니다.
- 서버에는 GitHub 사용자 id·username·avatar_url만 저장하고, GitHub 토큰은 저장하지 않습니다.
