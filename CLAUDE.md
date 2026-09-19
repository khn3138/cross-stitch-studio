# CLAUDE.md — 땀땀 십자수 도안 (cross-stitch-studio)

이 파일은 Claude Code가 이 저장소에서 작업할 때 **항상 지켜야 할 규칙**이다. 작업 시작 전에 반드시 읽고, `docs/HANDOFF.md`(전체 사양·결정사항)도 함께 읽는다.

## 제품 한 줄 요약
사진 → 십자수 도안 변환 + 직접 그리기/편집 + 저장/복제 + PDF 출력까지 되는 **설치형 웹앱(PWA)**. GitHub Pages로 배포하고, main에 푸시하면 자동 배포·자동 업데이트된다.

## 배포 방식 (확정)
- **안드로이드 APK 사이드로딩 안 함.** (출처를 알 수 없는 앱 허용 → 업데이트마다 수동 설치가 번거로워서 사용자가 거부함)
- **PWA + GitHub Pages**: 폰/PC 크롬·엣지·사파리에서 주소 열고 "앱 설치/홈 화면에 추가". 스토어·보안해제 불필요.
- 업데이트: main 푸시 → GitHub Actions가 Pages 배포 → 앱 실행 시 서비스워커가 새 버전 감지 → "새 버전 적용" 배너 → 탭 한 번으로 갱신.
- 릴리즈: `VERSION` 값이 바뀐 푸시마다 Actions가 `v<VERSION>` 태그 + GitHub Release 생성, 빌드 결과 zip(`cross-stitch-studio-v<VERSION>.zip`)을 첨부. 릴리즈 본문은 `RELEASE_NOTES.md`의 해당 버전 섹션.

## 모든 변경에서 반드시 할 것 (체크리스트)
1. `VERSION` 올리기 (SemVer: 버그수정=patch, 기능추가=minor, 저장형식 비호환=major).
2. `RELEASE_NOTES.md` 맨 위에 새 버전 섹션 추가 (날짜 KST, 추가/변경/수정/주의 구분, 한국어).
3. 저장 형식(`serialize`)을 바꾸면 `v` 필드 올리고 **이전 버전 도안을 읽는 마이그레이션 코드 유지**. 사용자 저장 도안이 깨지면 안 된다.
4. `python3 build.py` 로 `dist/` 빌드 성공 확인 후 커밋. `dist/`는 커밋하지 않는다(Actions가 빌드).
5. 서비스워커 캐시 이름은 빌드 시 버전으로 자동 치환됨 — 수동 수정 금지.
6. 사용자가 나중에 직접 해야 할 일이 생기면 `docs/TODO_USER.md`에 추가.
7. 커밋 메시지는 한국어, `[vX.Y.Z] 요약` 형식.

## 금지
- 외부 서버/계정/API 키 필요한 기능 추가 금지 (완전 오프라인 동작 유지). 예외: jsPDF CDN(cdnjs) 1개 — 빌드 시 vendor로 복사해 오프라인 캐시.
- 사용자 도안 데이터를 외부로 전송 금지.
- `alert/confirm/prompt` 사용 금지 (자체 모달 사용).
- 저장 데이터 삭제는 반드시 확인 모달 거치기.

## 구조
```
src/            앱 소스 (index.html, style.css, app.js)
data/dmc.txt    DMC 실 454색 "번호|이름|HEX;..." (build가 app에 인라인)
data/dmc-source.csv  원본 (adrianj/CrossStitchCreator)
public/         manifest.webmanifest, sw.js, icons/
build.py        src+data → dist/ (단일 index.html + PWA 파일 + version.json)
.github/workflows/deploy.yml   Pages 배포 + 릴리즈 생성
docs/HANDOFF.md 전체 사양·설계 결정
docs/TODO_USER.md 사용자가 할 일
RELEASE_NOTES.md, VERSION
```
