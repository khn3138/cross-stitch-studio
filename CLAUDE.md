# CLAUDE.md — 땀땀 십자수 도안 (cross-stitch-studio)

이 파일은 Claude Code가 이 저장소에서 작업할 때 **항상 지켜야 할 규칙**이다. 작업 시작 전에 반드시 읽고, `docs/HANDOFF.md`(전체 사양·결정사항)도 함께 읽는다.

## 제품 한 줄 요약
사진 → 십자수 도안 변환 + 직접 그리기/편집 + 저장/복제 + PDF 출력까지 되는 **설치형 웹앱(PWA)**. GitHub Pages로 배포하고, main에 푸시하면 자동 배포·자동 업데이트된다. 로그인 없이 완전 로컬/오프라인으로 쓸 수 있고, **선택적으로 Google 로그인하면 여러 기기 간 실시간 동기화**(오프라인에서도 계속 동작, 재연결 시 자동 반영)가 된다.

## 배포 방식 (확정)
- **안드로이드 APK 사이드로딩 안 함.** (출처를 알 수 없는 앱 허용 → 업데이트마다 수동 설치가 번거로워서 사용자가 거부함)
- **PWA + GitHub Pages**: 폰/PC 크롬·엣지·사파리에서 주소 열고 "앱 설치/홈 화면에 추가". 스토어·보안해제 불필요.
- 업데이트: main 푸시 → GitHub Actions가 Pages 배포 → 앱 실행 시 서비스워커가 새 버전 감지 → "새 버전 적용" 배너 → 탭 한 번으로 갱신.
- 릴리즈: `VERSION` 값이 바뀐 푸시마다 Actions가 `v<VERSION>` 태그 + GitHub Release 생성, 빌드 결과 zip(`cross-stitch-studio-v<VERSION>.zip`)을 첨부. 릴리즈 본문은 `RELEASE_NOTES.md`의 해당 버전 섹션.

## 클라우드 동기화 (선택, Firebase)
- `firebase-config.json`(저장소 루트)이 동기화 기능을 켜고 끈다. `enabled:false`면 앱은 100% 이전과 동일하게 로컬/오프라인으로만 동작 (기본값).
- 사용자가 화면 우측 상단 "Google로 로그인"을 눌러야만 활성화됨. 로그인하지 않으면 어떤 데이터도 외부로 전송되지 않는다.
- 로그인 시: Firestore(`users/{uid}/patterns/{patternId}`)로 도안을 저장·실시간 구독. Firestore 자체 오프라인 캐시(`enablePersistence`) 덕분에 오프라인에서도 읽기/쓰기 가능, 재연결되면 자동 동기화.
- 최초 로그인 시 그 기기의 로컬(비로그인) 도안이 있으면 "계정에 업로드할지" 확인 모달을 띄우고, 업로드 후에는 로컬 사본을 지운다(중복 방지).
- `firebase-config.json`의 값(apiKey 등)은 비밀값이 아니다 — Firebase 웹 앱의 공개 식별자이며, 보안은 `firestore.rules`(각자 자기 uid 데이터만 read/write)와 Firebase 콘솔의 "승인된 도메인" 목록으로 보장한다. 그래도 실제 프로젝트 값을 채우는 건 저장소 소유자만 할 수 있는 일 — 필요한 설정은 `docs/TODO_USER.md` 참고.
- app.js의 `LocalStore`(IndexedDB/localStorage)와 `CloudStore`(Firestore)는 동일한 인터페이스(`init/put/get/del/listAll`)를 구현하고, `Data` 파사드가 로그인 여부에 따라 자동으로 골라 쓴다. 새 저장 관련 기능은 반드시 `Data.*`를 통해서만 접근한다(`LocalStore`/`CloudStore`를 직접 호출하지 말 것).

## 모든 변경에서 반드시 할 것 (체크리스트)
1. `VERSION` 올리기 (SemVer: 버그수정=patch, 기능추가=minor, 저장형식 비호환=major).
2. `RELEASE_NOTES.md` 맨 위에 새 버전 섹션 추가 (날짜 KST, 추가/변경/수정/주의 구분, 한국어).
3. 저장 형식(`serialize`)을 바꾸면 `v` 필드 올리고 **이전 버전 도안을 읽는 마이그레이션 코드 유지**. 사용자 저장 도안이 깨지면 안 된다.
4. `python3 build.py` 로 `dist/` 빌드 성공 확인 후 커밋. `dist/`는 커밋하지 않는다(Actions가 빌드).
5. 서비스워커 캐시 이름은 빌드 시 버전으로 자동 치환됨 — 수동 수정 금지.
6. 사용자가 나중에 직접 해야 할 일이 생기면 `docs/TODO_USER.md`에 추가.
7. 커밋 메시지는 한국어, `[vX.Y.Z] 요약` 형식.

## 금지
- 사용자가 로그인하지 않은 상태에서는 외부 서버로 어떤 도안 데이터도 전송 금지 (완전 오프라인 동작 유지).
- 외부 서버/계정/API 키 필요한 기능은 함부로 추가 금지. 현재 허용된 예외는 딱 둘: (1) jsPDF CDN(cdnjs) — 빌드 시 vendor로 복사해 오프라인 캐시, (2) 사용자가 명시적으로 켠 Google 로그인 + Firebase(Auth/Firestore) 동기화(위 "클라우드 동기화" 항목). 그 외 새로운 외부 연동은 사용자에게 먼저 확인.
- `alert/confirm/prompt` 사용 금지 (자체 모달 사용).
- 저장 데이터 삭제는 반드시 확인 모달 거치기.

## 구조
```
src/            앱 소스 (index.html, style.css, app.js)
data/dmc.txt    DMC 실 454색 "번호|이름|HEX;..." (build가 app에 인라인)
data/dmc-source.csv  원본 (adrianj/CrossStitchCreator)
public/         manifest.webmanifest, sw.js, icons/
firebase-config.json  Google 로그인/Firestore 동기화 설정 (enabled:false가 기본, 비밀값 아님)
firestore.rules       Firestore 보안 규칙 (Firebase 콘솔에 수동으로 붙여넣어야 함)
build.py        src+data+firebase-config → dist/ (단일 index.html + PWA 파일 + version.json)
.github/workflows/deploy.yml   Pages 배포 + 릴리즈 생성
docs/HANDOFF.md 전체 사양·설계 결정
docs/TODO_USER.md 사용자가 할 일
RELEASE_NOTES.md, VERSION
```
