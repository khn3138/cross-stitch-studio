# 땀땀 십자수 도안

사진을 십자수 도안으로 변환하고, 직접 그리고 편집하고, PDF로 출력할 수 있는 **오프라인 웹앱(PWA)**입니다.
스토어 설치나 "출처를 알 수 없는 앱" 허용 없이, 브라우저에서 주소만 열면 바로 쓸 수 있어요.

## 사용하기

1. `https://khn3138.github.io/cross-stitch-studio/` 접속 (첫 배포 후 실제 주소는 저장소 Settings → Pages에서 확인)
2. 모바일: 브라우저 메뉴에서 **"홈 화면에 추가" / "앱 설치"**
   PC(크롬/엣지): 주소창 오른쪽 설치 아이콘
3. 앱이 열리면 "내 도안" 목록에 예시 도안(하트)이 자동으로 준비되어 있어요.

## 주요 기능

- **사진 → 도안 변환**: 가로 스티치 수, 최대 색 수, 디더링, 배경 제거, 외톨이 점 정리 옵션. DMC 454색에 CIEDE2000 기준으로 자동 매칭.
- **편집 도구**: 이동, 풀/하프/쿼터/3·4 스티치, 백스티치, 프렌치 노트, 지우개, 채우기, 스포이드, 선택(복사·잘라내기·붙여넣기·반전·자르기), 좌우/상하 대칭, 진행 체크, 되돌리기·다시하기(최대 80단계). 도구막대에서 바로 최근 쓴 색 2개 · 실 선택 · 스포이드로 색을 빠르게 바꿀 수 있음.
- **보기 모드**: 컬러 / 기호 / 컬러+기호, 10칸 굵은 눈금, 중앙 표시, 확대·축소(트랙패드·핀치 지원).
- **실 관리**: DMC 번호·이름, 기호, 스티치 수, 필요 타래 자동 추정, 색 바꾸기·합치기·기호 바꾸기, 안 쓰는 실 정리.
- **원단·크기**: Aida 11~20ct, 린넨 28/32ct(2올). 완성 크기·재단 원단 크기 자동 계산.
- **내 도안**: 자동 저장(이 기기 브라우저), 열기, **복제해서 수정**, 이름 변경, 삭제, JSON 내보내기/불러오기, 전체 백업/복원.
- **여러 기기 동기화 (선택)**: 우측 상단 "Google로 로그인"을 누르면 도안이 그 계정으로 실시간 동기화됨 — 오프라인에서도 계속 쓸 수 있고 재연결 시 자동 반영. 로그인하지 않으면 완전 로컬로만 동작.
- **자동 백업 폴더 (선택, 크롬/엣지)**: "내 도안" 화면에서 폴더를 하나 지정해두면 도안이 바뀔 때마다 그 폴더에 백업 JSON을 자동으로 다시 써줌. 그 폴더가 구글드라이브 등 클라우드 동기화 폴더 안이면 결과적으로 자동 백업됨.
- **출력**: PDF(표지 + 범례 + 분할 도안 페이지), PNG, 도안 파일(JSON). 크롬/엣지에서 "다운로드 전 저장 위치 확인" 설정을 켜두면 내보낼 때마다 저장 위치(구글드라이브 폴더 등)를 고를 수 있음.
- **오프라인 PWA**: 설치형, 오프라인 동작, 새 버전 자동 감지 후 배너로 안내.

## 저장 위치와 백업 (중요)

**Google 로그인을 하지 않으면** 도안은 **이 기기의 브라우저 안에만** 저장됩니다(IndexedDB, 실패 시 localStorage).
기기를 바꾸거나 브라우저 데이터를 지우기 전에는 반드시 **"내 도안" 화면의 "전체 백업"**으로 JSON 파일을 내려받아 두세요.
앱을 설치(PWA)해두면 브라우저 정리 시에도 비교적 안전하게 보존됩니다.

**Google 로그인을 하면** 도안이 계정(Firestore)에 저장되어 같은 계정으로 로그인한 다른 기기에서도 실시간으로 보이고 편집됩니다. 이 기능은 저장소 소유자가 `firebase-config.json`에 본인의 Firebase 프로젝트 값을 채워야 켜지며, 자세한 설정 방법은 `docs/TODO_USER.md`를 참고하세요.

## 개발자용

### 구조

```
src/            앱 소스 (index.html, style.css, app.js)
data/dmc.txt    DMC 실 454색 "번호|이름|HEX;..." (build가 app에 인라인)
data/dmc-source.csv  원본 색상표 (adrianj/CrossStitchCreator)
public/         manifest.webmanifest, sw.js, icons/
firebase-config.json  Google 로그인/Firestore 동기화 설정 (기본 enabled:false, 비밀값 아님)
firestore.rules       Firestore 보안 규칙 (Firebase 콘솔에 수동 등록)
build.py        src+data+public+firebase-config -> dist/ (단일 index.html + PWA 파일 + version.json)
.github/workflows/deploy.yml   Pages 배포 + 릴리즈 자동 생성
docs/HANDOFF.md 전체 사양·설계 결정 (세션 인계 문서)
docs/TODO_USER.md 사용자가 나중에 할 일
RELEASE_NOTES.md, VERSION
```

### 빌드

```sh
python3 build.py
python3 -m http.server 8000 -d dist   # http://localhost:8000 에서 확인
```

빌드는 jsPDF(2.5.1)를 cdnjs에서 받아 `dist/vendor/`에 넣어 오프라인 캐시에 포함시킵니다.
네트워크가 막혀 있으면 이전에 받아둔 `.build-cache/jspdf.umd.min.js`를 대신 사용합니다(최초 1회는 네트워크가 필요).

### 배포

`main` 브랜치에 푸시하면 GitHub Actions가:

1. `python3 build.py`로 빌드
2. GitHub Pages에 배포
3. `VERSION`이 바뀐 푸시라면 `v<VERSION>` 태그 + GitHub Release 생성 (`RELEASE_NOTES.md`의 해당 섹션을 본문으로 사용, 빌드 결과 zip 첨부)

최초 1회, 저장소에서 다음을 설정해야 합니다 (`docs/TODO_USER.md` 참고):

- Settings → Pages → Build and deployment → Source: **GitHub Actions**
- Settings → Actions → General → Workflow permissions: **Read and write permissions**
- 저장소가 Private이면 Pages 사용을 위해 Public으로 전환하거나 GitHub Pro 필요

### 변경 시 체크리스트

`CLAUDE.md` 참고. 요약:

1. `VERSION` 올리기 (SemVer)
2. `RELEASE_NOTES.md`에 새 버전 섹션 추가
3. 저장 형식(`serialize`)을 바꾸면 `v` 필드를 올리고 이전 버전 마이그레이션 코드 유지
4. `python3 build.py` 빌드 성공 확인 후 커밋 (`dist/`는 커밋하지 않음)
5. 커밋 메시지: 한국어, `[vX.Y.Z] 요약` 형식

## 라이선스 / 데이터 출처

- DMC 색상표: `data/dmc-source.csv` (adrianj/CrossStitchCreator 프로젝트의 공개 데이터 기반, RGB 값으로 HEX 재계산)
- PDF 생성: [jsPDF](https://github.com/parallax/jsPDF) (MIT)
