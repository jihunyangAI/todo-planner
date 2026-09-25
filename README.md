# 할 일 + 계획 관리 앱

오늘 할 일, 전체 목록, 주간 계획을 한곳에서 관리하는 개인용 반응형 웹 앱입니다.
요구사항은 [PRD.md](PRD.md), 구현 계획과 수용 기준(AC1~AC39)은 [PLAN.md](PLAN.md)에 있습니다.

| 폴더 | 내용 |
| --- | --- |
| `shared/` | 작업 타입과 zod 검증 스키마 (web·api가 함께 사용) |
| `api/` | Express + MongoDB API (`/api/tasks`, `/api/health`) |
| `web/` | React 18 + Vite 화면 (오늘·전체·주간·설정) |
| `e2e/` | Playwright E2E 테스트 |

## 사전 준비 (Windows 기준)

- Node.js 20 이상
- Docker Desktop (WSL2 백엔드): 로컬 개발용 MongoDB를 띄울 때만 필요합니다. 자동 테스트에는 필요 없습니다.
- 최초 1회: `npm install`, `npx playwright install chromium`
- 테스트는 `mongodb-memory-server`를 씁니다. 처음 실행할 때 MongoDB 7.0.14 실행 파일(약 590MB)을 내려받으므로 몇 분 걸릴 수 있습니다. 버전은 `package.json`의 `config.mongodbMemoryServer.version`에 고정되어 있습니다.

Windows PowerShell 5.1은 `&&`와 `VAR=값 명령` 문법을 지원하지 않습니다. 아래 명령은 모두 npm 스크립트이므로 한 줄씩 실행하면 됩니다.

## 실행

```
npm run db:up      # docker compose up -d (MongoDB)
npm run dev        # shared 빌드 감시 + api(:4000) + web(:5173) 동시 실행
```

브라우저에서 http://localhost:5173 을 엽니다. 끝낼 때는 `npm run db:stop`.

환경 변수는 `.env.example`을 복사해 `.env`로 만들어 바꿀 수 있습니다(api 개발 서버가 읽습니다).

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
| `WEB_ORIGIN` | api | CORS를 허용할 웹 주소 (하나) | `https://todo.example.com` |
| `TRUST_PROXY` | api | Express `trust proxy` 값. 프록시 뒤(Render·Railway)에서는 `1`. 이 값이 없으면 요청 수 제한이 모든 사용자를 한 IP로 셉니다 | `1` |
| `RATE_LIMIT_DISABLED` | api | `true`면 요청 수 제한(IP당 분당 120회)을 끕니다. 테스트·E2E 전용 | `false` |
| `LOG_LEVEL` | api | pino 로그 수준 | `info` |
| `VITE_API_URL` | web (빌드 시점) | API 주소 | `https://todo-api.example.com` |
| `MONGOMS_VERSION` | 테스트 | mongodb-memory-server 버전 | `7.0.14` |
| `MONGOMS_DISABLE_POSTINSTALL` | 배포 빌드 | `1`이면 `npm ci` 때 테스트용 MongoDB 실행 파일(약 590MB) 다운로드를 건너뜁니다 | `1` |

## 배포

MongoDB Atlas(DB) + Render(API·웹)로 배포합니다. Render 설정은 저장소 루트의 [`render.yaml`](render.yaml)(Blueprint)에 들어 있습니다.

### 1. MongoDB Atlas (DB)

1. https://www.mongodb.com/cloud/atlas 에 가입하고 **M0 (Free)** 클러스터를 만듭니다. 지역은 Render API와 가까운 곳(예: AWS Singapore)을 고릅니다.
2. **Database Access**: 데이터베이스 사용자(아이디·비밀번호)를 만듭니다.
3. **Network Access**: `0.0.0.0/0`(모든 IP)을 허용합니다. Render 무료 플랜은 고정 IP가 없기 때문입니다. 대신 비밀번호를 길고 무작위로 정하세요.
4. **Connect → Drivers**에서 연결 문자열을 복사하고, `<password>`를 실제 비밀번호로, 경로에 DB 이름을 넣습니다.
   예: `mongodb+srv://todo:비밀번호@cluster0.xxxxx.mongodb.net/todo-planner?retryWrites=true&w=majority`

### 2. Render (API + 웹)

1. https://render.com 에 GitHub 계정으로 가입하고, 이 저장소에 대한 접근을 허용합니다.
2. **New → Blueprint** → 이 저장소를 고릅니다. `render.yaml`을 읽어 두 서비스를 보여 줍니다.
   - `todo-planner-api`: Node, 무료 플랜, Singapore, 상태 점검 `/api/health`
   - `todo-planner-web`: 정적 사이트, `web/dist`
3. 입력을 요구하는 `MONGODB_URI`에 1단계의 연결 문자열을 넣고 **Apply**를 누릅니다.
   `WEB_ORIGIN`, `VITE_API_URL`은 서로의 주소가 자동으로 들어가고, `TRUST_PROXY=1`은 미리 설정되어 있습니다.
4. 두 서비스의 배포가 끝나면 `todo-planner-web`의 주소(`https://todo-planner-web….onrender.com`)로 접속합니다.

이후 `main`에 푸시하면 Render가 자동으로 다시 배포합니다. 해시 주소(`#/today`)를 쓰므로 정적 사이트에 rewrite 설정은 필요 없습니다.

### 다른 호스팅을 쓸 때

| 서비스 | 빌드 명령 | 시작 명령·출력 | 환경 변수 |
| --- | --- | --- | --- |
| API | `npm ci && npm run build -w shared && npm run build -w api` | `npm run start -w api` | `MONGODB_URI`, `WEB_ORIGIN`, `TRUST_PROXY=1`, `MONGOMS_DISABLE_POSTINSTALL=1` |
| 웹 | `npm ci && npm run build -w shared && npm run build -w web` | 출력 폴더 `web/dist` | `VITE_API_URL`, `MONGOMS_DISABLE_POSTINSTALL=1` |

`WEB_ORIGIN`과 `VITE_API_URL`은 `https://`를 빼고 도메인만 넣어도 됩니다.

### Render 무료 인스턴스의 휴면

Render 무료 인스턴스는 한동안 요청이 없으면 잠들고, 다시 깨어나는 데 최대 1분쯤 걸립니다. 앱은 다음과 같이 대응합니다.

- 첫 목록 요청이 3초 넘게 걸리면 "서버에 연결하는 중입니다" 안내를 보여 주고, 최대 4회(2·4·8초 간격, 60초 상한) 다시 시도합니다. 목록을 받기 전에는 쓰기를 막습니다.
- 모든 요청의 시간 초과는 20초입니다. 서버가 그보다 늦게 깨어나면 저장이 실패로 표시되고 [다시 시도]로 복구합니다.

자주 불편하다면 잠들지 않는 요금제나 호스팅으로 옮기세요.

### 로그에 클라이언트 ID가 남지 않는지 확인

클라이언트 ID(`X-Client-Id`)는 사실상 비밀번호입니다. API는 `pino-http`의 `redact`로 이 헤더와 요청 본문을 로그에서 지웁니다(AC37). 배포한 뒤에는 다음을 확인하세요.

1. 앱에서 작업을 하나 추가합니다.
2. 설정 화면에서 현재 ID를 복사합니다.
3. 호스팅 서비스의 로그 화면(Render: Logs, Railway: Deploy Logs / HTTP Logs)에서 그 ID를 검색합니다. 결과가 없어야 합니다.
4. 호스팅이 자체 요청 로그에 헤더를 남기는 옵션이 있다면 끕니다.

## 데이터와 보안에 대한 안내

- 로그인이 없습니다. 브라우저가 처음 접속할 때 만든 익명 ID(UUID v4)로 데이터를 구분합니다.
- 브라우저 데이터를 지우면 ID가 사라져 데이터에 접근할 수 없습니다. 설정 화면에서 ID를 복사해 두면 다른 브라우저에서도 같은 데이터를 쓸 수 있습니다.
- ID를 아는 사람은 누구나 그 데이터를 볼 수 있으므로 민감한 정보는 저장하지 마세요.
