# Commute Time - Vercel 배포 가이드

## 필수 환경 변수

Vercel 대시보드의 **Settings > Environment Variables**에서 다음 환경 변수를 설정하세요.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열. Vercel Postgres 사용 권장 | `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `NEXTAUTH_SECRET` | NextAuth.js 세션 암호화 키. `openssl rand -base64 32`로 생성 | `K7gNx...` (base64 문자열) |
| `NEXTAUTH_URL` | 프로덕션 배포 URL | `https://your-app.vercel.app` |
| `KAKAO_REST_API_KEY` | Kakao REST API 키. [developers.kakao.com](https://developers.kakao.com)에서 발급 | `abcdef1234567890` |
| `DATA_GO_KR_API_KEY` | 공공데이터포털 API 키. [data.go.kr](https://www.data.go.kr)에서 발급 | `서비스키 문자열` |
| `SEOUL_OPENDATA_API_KEY` | 서울 열린데이터 광장 API 키. [data.seoul.go.kr](https://data.seoul.go.kr)에서 발급 | `서비스키 문자열` |

## 배포 단계

### 1. GitHub 저장소 연결

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인합니다.
2. **New Project**를 클릭합니다.
3. GitHub 저장소를 Import합니다.
4. Framework Preset이 **Next.js**로 자동 감지되는지 확인합니다.

### 2. 환경 변수 설정

1. 프로젝트 설정 > **Environment Variables** 탭으로 이동합니다.
2. 위 표의 모든 환경 변수를 추가합니다.
3. `NEXTAUTH_SECRET`은 터미널에서 다음 명령으로 생성할 수 있습니다:
   ```bash
   openssl rand -base64 32
   ```
4. 환경(Production, Preview, Development)별로 적절히 설정합니다.

### 3. 데이터베이스 설정

#### Vercel Postgres 사용 (권장)

1. Vercel 대시보드에서 **Storage** 탭으로 이동합니다.
2. **Create Database > Postgres**를 선택합니다.
3. 데이터베이스를 생성하면 `DATABASE_URL`이 자동으로 환경 변수에 추가됩니다.

#### 외부 PostgreSQL 사용

1. 외부 PostgreSQL 인스턴스의 연결 문자열을 `DATABASE_URL`에 설정합니다.
2. SSL 연결이 필요한 경우 `?sslmode=require`를 URL에 추가합니다.

### 4. Prisma 마이그레이션

첫 배포 전에 데이터베이스 스키마를 적용해야 합니다:

```bash
# 로컬에서 프로덕션 DATABASE_URL을 사용하여 마이그레이션 실행
DATABASE_URL="프로덕션_연결_문자열" npx prisma migrate deploy
```

또는 Vercel CLI를 사용할 수 있습니다:

```bash
vercel env pull .env.local
npx prisma migrate deploy
```

### 5. 배포

1. 모든 설정이 완료되면 **Deploy**를 클릭합니다.
2. 빌드 로그를 확인하여 오류가 없는지 확인합니다.
3. 배포된 URL에서 애플리케이션이 정상 동작하는지 확인합니다.

## 빌드 스크립트

`package.json`의 빌드 스크립트는 Prisma Client 생성을 포함합니다:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

- `postinstall`: `npm install` 후 자동으로 Prisma Client를 생성합니다.
- `build`: 빌드 시 Prisma Client가 최신 스키마와 동기화되도록 합니다.

## 주의사항

### Prisma 엔진 바이너리

`prisma/schema.prisma`에 Vercel 서버리스 런타임용 바이너리 타겟이 설정되어 있습니다:

```prisma
binaryTargets = ["native", "rhel-openssl-3.0.x"]
```

- `native`: 로컬 개발 환경
- `rhel-openssl-3.0.x`: Vercel 서버리스 환경

### 경로 검색 캐시

경로 검색 결과는 데이터베이스(RouteCache 테이블)에 24시간 동안 캐시됩니다. 이를 통해 카카오맵 API 호출 횟수를 줄여 성능을 개선합니다.

### 환경별 NEXTAUTH_URL

- **프로덕션**: `https://your-app.vercel.app` (실제 도메인으로 교체)
- **프리뷰**: Vercel이 자동으로 `VERCEL_URL`을 제공하므로, NextAuth.js가 이를 감지합니다.
- **로컬 개발**: `http://localhost:3000`
