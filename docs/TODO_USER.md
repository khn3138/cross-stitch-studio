# 나중에 내가(사용자) 해야 할 것

## 최초 1회 설정
- [x] GitHub에 `khn3138/cross-stitch-studio` 저장소 만들기
- [ ] Claude Code 세션에 이 저장소 연결 (웹: claude.ai/code에서 저장소 선택 / PC: `git clone` 후 폴더에서 `claude` 실행)
- [ ] 저장소 **Settings → Pages → Build and deployment → Source: "GitHub Actions"** 선택
- [ ] 저장소 **Settings → Actions → General → Workflow permissions: "Read and write permissions"** 선택 (릴리즈 생성용)
- [ ] 저장소가 Private이면: 무료 플랜은 Pages가 안 됨 → Public으로 바꾸거나 GitHub Pro 필요
- [ ] 첫 배포 후 주소 확인: `https://khn3138.github.io/cross-stitch-studio/`

## 폰에 설치 (보안해제 없음)
- [ ] 안드로이드 크롬으로 위 주소 열기 → 메뉴(⋮) → **"앱 설치"** 또는 "홈 화면에 추가"
- [ ] 아이폰 사파리: 공유 버튼 → **"홈 화면에 추가"**
- [ ] PC 크롬/엣지: 주소창 오른쪽 설치 아이콘

## 사용 중 주의
- **Google 로그인을 하지 않으면** 도안은 그 기기의 브라우저 안에만 저장됨. 기기 바꾸거나 브라우저 데이터 삭제 전에 앱의 **"전체 백업"(JSON)** 으로 내보내 두기.
- 앱 설치(PWA)하면 브라우저 정리 시에도 비교적 안전하게 보존됨.
- **Google 로그인을 하면** 도안이 그 구글 계정으로 실시간 동기화되어 다른 기기에서도 같은 계정으로 로그인하면 보임(오프라인에서도 계속 쓸 수 있고, 인터넷 연결되면 자동 동기화).
- **PDF·PNG·JSON을 구글드라이브 등 특정 폴더에 바로 저장하고 싶으면** 두 가지 방법이 있어요:
  1. 크롬/엣지 **설정 → 다운로드 → "다운로드 전에 각 파일의 저장 위치를 확인"** 켜기 → 내보낼 때마다 저장 위치를 고를 수 있음(구글드라이브 동기화 폴더 선택 가능).
  2. "내 도안" 화면의 **"자동 백업 폴더 설정"**으로 구글드라이브 동기화 폴더를 한 번 지정해두면, 도안이 바뀔 때마다 그 폴더의 백업 파일이 자동으로 갱신됨(크롬/엣지 PC에서만 가능).

## 여러 기기 동기화(Google 로그인) 켜기 — 최초 1회, 무료
동기화 기능은 지금 꺼져 있어요(`firebase-config.json`의 `enabled: false`). 켜려면 **Firebase**(구글의 무료 백엔드 서비스)에 프로젝트를 하나 만들어야 하는데, 이건 저장소 소유자(구글 계정) 본인만 할 수 있는 절차라 아래를 직접 진행해주세요. 다 하시면 Claude Code 세션에 알려주시면 나머지(코드 반영·빌드·배포)는 제가 할게요.

1. https://console.firebase.google.com 접속 → **"프로젝트 추가"** → 아무 이름(예: `ttamttam`)으로 생성 (Google Analytics는 꺼도 됨)
2. 왼쪽 메뉴 **빌드 → Authentication → "시작하기"** → **로그인 방법** 탭 → **Google** 제공업체 **사용 설정**
3. **Authentication → Settings → 승인된 도메인**에 `khn3138.github.io` 추가 (`localhost`는 이미 기본으로 있음)
4. 왼쪽 메뉴 **빌드 → Firestore Database → "데이터베이스 만들기"** → 위치는 아무 곳(예: `asia-northeast3` 서울)이나 선택, 프로덕션 모드로 생성
5. **Firestore Database → 규칙** 탭 → 저장소의 `firestore.rules` 파일 내용을 그대로 붙여넣고 **게시**
6. 프로젝트 설정(톱니바퀴 아이콘) → **일반** 탭 → 맨 아래 "내 앱"에서 **웹 앱 추가**(`</>` 아이콘, 앱 이름 아무거나, Firebase Hosting 설정은 체크 안 해도 됨) → 나오는 `firebaseConfig` 객체 값(apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) 전체를 복사
7. 그 값을 저장소 루트의 `firebase-config.json`에 붙여넣고(각 필드 채우고) `enabled`를 `true`로 바꿔서 Claude Code에 전달(또는 직접 커밋)해주세요. **이 값들은 비밀번호가 아니라 공개돼도 되는 값**이라 그냥 저장소에 커밋해도 안전해요(실제 보안은 3번·5번에서 설정한 도메인 제한과 Firestore 규칙이 담당).
8. 무료(Spark) 플랜 한도 안에서 개인 사용은 충분해요. 결제 정보 등록 없이도 됨.

## 선택
- [ ] 나중에 스토어 배포가 필요하면: PWA를 TWA로 감싸 Play 스토어 등록 가능 (개발자 계정 $25). 지금은 불필요.
