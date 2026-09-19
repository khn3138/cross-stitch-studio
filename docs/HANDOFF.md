# HANDOFF — claude.ai 세션에서 Claude Code로 이관

작성: 2026-09-20 (KST). 이 문서만 읽고 이어서 완성할 수 있도록 사용자 요구·결정·설계·진행상황을 모두 적는다.

## 1. 사용자 요구 (원문 요약)
- "십자수 도안 만드는 앱. 기본적으로 십자수 도안 만드는 기능은 다 되어야 함. **전부 다 만들어.**"
- "저장한 도안 나중에 확인, **도안 복사해서 수정**도 되게."
- "만들고 **깃허브에 올려서 푸시**까지."
- "푸시할 때 **릴리즈 버전 파일도 같이**. 다른 앱(주식 자동매매앱)처럼 **지켜야 할 것들, 나중에 내가 해야 할 것들, 릴리즈노트** 등 작성."
- "**깃허브 푸시하면 바로 앱 업데이트**되게."
- "안드 APK는 출처불분명 보안해제 때문에 귀찮았음 → **열기 편하고 호환 좋은 방식**으로. 웹앱도 OK."
- "**완성 상태, 배포 가능한 단계**로. 설정만 마무리하면 되게."
→ 결론: PWA + GitHub Pages + Actions 자동 배포/릴리즈 (CLAUDE.md 참고).

## 2. 진행 상황 (Claude Code 세션에서 v1.0.0으로 완성)
| 항목 | 상태 |
|---|---|
| CLAUDE.md / TODO_USER.md / RELEASE_NOTES.md / VERSION | 완료 |
| data/dmc.txt (DMC 454색, RGB 컬럼 기준으로 HEX 재계산 — 원본 CSV의 HEX 컬럼은 엑셀로 깨져 있음, 쓰지 말 것) | 완료 |
| src/style.css (디자인 토큰·레이아웃·모바일 대응 전부) | 완료 |
| src/index.html (마크업) | 완료 |
| src/app.js (앱 로직 전체) | 완료 |
| public/manifest.webmanifest, sw.js, icons | 완료 (아이콘은 scripts/gen_icons.py로 생성) |
| build.py | 완료 |
| .github/workflows/deploy.yml | 완료 |
| README.md | 완료 |

빌드(`python3 build.py`) 후 Playwright(크로미움)로 예시 도안 렌더링, 사진→도안 변환, PDF/PNG/JSON 내보내기, 저장·복제·되돌리기, 서비스워커 등록을 실제로 열어 확인함. 자세한 내용은 커밋 로그와 RELEASE_NOTES.md 참고.

## 3. 디자인 (style.css에 반영됨)
- 앱 이름: **땀땀 십자수 도안** (브랜드 표기 "땀땀"). `<title>땀땀 십자수 도안</title>`
- 폰트: IBM Plex Sans KR (본문/UI), IBM Plex Mono (DMC 번호·숫자). Google Fonts.
- 색: 바탕 #E9EDEA(린넨 회녹), 표면 #FFF, 잉크 #1B232A, 보조 #5B676E, 선 #D2D9D5, 포인트 **#0D6663(딥 틸, DMC 3809 계열)**. 다크모드 토큰 있음(포인트 #52C2B3). 캔버스 원단 영역은 다크모드에서도 흰색(실제 아이다처럼).
- 레이아웃: 상단바 / 좌측 세로 도구막대(64px) / 가운데 옵션바+캔버스 / 우측 패널(320px). **860px 이하**: 도구막대는 하단 가로 스크롤, 패널은 바텀시트(`.panel.open`).
- CSS 클래스 이미 정의됨: `.topbar .brand .title-input .save-state #library .lib-* .grid .card .card-thumb .card-body .card-name .card-meta .card-foot .progress .empty #editor .toolbar .tool(.on) .tool-sep .cur-thread .center .optbar .seg .chip(.on) .zoom-val .canvas-wrap #cv .selbar .hint .panel .panel-scroll .threads .thread(.on) .sw .t-main .t-code .t-name .t-cnt .kv .field .row2 .check .panel-close .overlay .modal(.wide) .modal-h/-b/-f .menu .toast .picker-* .pk(.used) .sym-grid .import .import-prev .drop(.over) .range .import-sum .btn(.primary/.danger/.ghost/.sm) .icon-btn .only-mobile`

## 4. 데이터 모델
```js
pat = {
  id, name, w, h,
  fabric: 'aida14',            // 아래 FABRICS 키
  strands: 2,                  // 풀스티치 가닥 수 (백스티치는 1 고정)
  palette: [{code:'321', sym:'●'}],   // DMC 코드 + 기호
  cells: Int16Array(w*h),      // 팔레트 인덱스, -1 = 비어있음
  types: Uint8Array(w*h),      // 0 없음, 1 풀, 2 하프'/', 3 하프'\', 4..7 쿼터(모서리 k), 8..11 3/4(모서리 k)
  backs: [[x1,y1,x2,y2,p]],    // 백스티치: 좌표는 "반 칸 단위"(격자점*2) → 모서리·중앙 스냅
  knots: [[x,y,p]],            // 프렌치 노트: 반 칸 단위
  done: Uint8Array(w*h),       // 진행 체크
  created, updated             // ms
}
// 모서리 k: 0 좌상, 1 우상, 2 우하, 3 좌하. 쿼터 = 해당 사분면 채움, 3/4 = 반대편(k+2)%4 사분면만 빼고 채움
// 좌우대칭 시 k → [1,0,3,2][k], 상하대칭 시 k → [3,2,1,0][k], 하프 2↔3
```
저장 직렬화(`serialize`): `{app:'ttamttam', v:1, id,name,w,h,fabric,strands,palette, cells: RLE, types: RLE, done: RLE, backs, knots, created, updated}`
- RLE: `"값*개수,값,값*개수"` 문자열. cells는 idx 그대로(-1 포함).
- db 문서 한도 256KiB 고려 → 최대 크기 300×300 제한, 초과 시 에러 안내.

FABRICS: aida11(11), aida14(14), aida16(16), aida18(18), aida20(20), linen28("린넨 28ct · 2올", 유효 14), linen32(유효 16).

## 5. 저장소(Storage) 어댑터
1순위 **IndexedDB** (`ttamttam` DB, store `patterns`), 실패 시 localStorage(`xstitch:p:<id>`), 둘 다 실패 시 메모리 + "저장 안 됨" 경고.
- `navigator.storage.persist()` 요청.
- (선택) `window.claude?.use` 가 있으면(claude.ai 아티팩트로 열었을 때) `db`+`user` 캡빌리티로 `data/users/<uid>/<patternId>` 에 저장. GitHub Pages에선 해당 없음.
- 자동저장: 변경 후 1.5초 디바운스, 도안 목록으로 나갈 때 즉시 flush. 상단에 "저장 중…/저장됨/저장 실패".
- **전체 백업/복원**: 모든 도안을 JSON 하나로 내보내기/불러오기(불러오기 시 id 충돌하면 새 id).

## 6. 화면·기능 명세
### 내 도안(라이브러리)
- 헤더: "내 도안", 저장 위치 안내("이 기기 브라우저에 저장됨 · 기기 변경 전 전체 백업"), 버튼: **새 도안**, **사진으로 만들기**, 파일 불러오기, 전체 백업.
- 카드: 썸네일(셀 1px → dataURL img, `image-rendering:pixelated`), 이름, `80×60 · 12색 · 9/20 05:40`, 진행률 바(진행 있을 때). 카드 하단: 열기, **복제**(이름 "(사본)"), 내보내기(JSON), 삭제(확인 모달).
- 도안이 하나도 없으면 **예시 도안 자동 생성**: 하트 (심장 방정식, 321/304/3705/B5200 음영 + 외곽선 백스티치 814 + 프렌치 노트 310 몇 개), 이름 "예시 · 하트".

### 편집기
- 상단바: ← 목록, 제목 input(이름 변경), 저장상태, 되돌리기/다시하기, 내보내기 메뉴(PDF, PNG, 도안 파일 JSON), 더보기 메뉴(캔버스 크기 변경, 사본으로 저장, 모두 진행 해제).
- 도구(단축키): 이동 H, 풀 스티치 B, 하프 /(방향 옵션 `/` `\`), 쿼터 Q(포인터 위치로 모서리 자동), 3/4 T, 백스티치 L(반칸 스냅, 드래그로 선), 프렌치 노트 K, 지우개 E(스티치 + 근처 백스티치/노트), 채우기 G(4방향 플러드), 스포이드 I(후 이전 도구로 복귀), 선택 S, 진행 체크 D(첫 칸 상태 반전값으로 칠하기). 도구막대 끝에 현재 실 스와치.
- 옵션바: 보기 seg(컬러/기호/컬러+기호), 좌우대칭·상하대칭 chip, "선택한 실만" 강조 chip, 진행표시 chip, 줌 − % + 맞춤, (모바일) 실·정보 버튼.
- 캔버스: 눈금자(상/좌 26px, 10칸마다 번호), 1칸 얇은 선(줌≥5), 10칸 굵은 선, 중앙 화살표 표시, 호버 칸 윤곽, 선택 영역 점선, 붙여넣기 미리보기(반투명, 포인터 중심), 백스티치 미리보기선.
- 입력: Pointer Events. 두 손가락 = 핀치 줌 + 이동(시작 150ms 내 한 손가락 획은 취소). 휠: 마우스 휠이면 줌, 트랙패드면 이동(ctrl+휠 = 줌). Space 누르고 드래그/가운데버튼 = 이동. 획 사이 Bresenham 보간. 대칭 적용.
- 선택 후 selbar: 복사, 잘라내기, 붙여넣기, 좌우반전, 상하반전, 지우기, 선택영역으로 자르기(crop), 해제. 클립보드는 코드 기준 저장 → 붙여넣을 때 팔레트에 없으면 자동 추가.
- 되돌리기: 스냅샷(cells/types/done 복사 + backs/knots/palette 복제), 최대 80단계. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S.
- 캔버스 크기 변경 모달: 가로/세로 + 기준(좌상단/가운데). 백스티치·노트 좌표도 이동, 범위 밖은 제거.

### 우측 패널
- "실 목록" + [+ 실 추가]: 행 = 스와치(색+대비 기호), `DMC 321`, 이름, 스티치 수/타래, ⋯ 메뉴(색 바꾸기, 기호 바꾸기, 다른 실로 합치기, 이 실 스티치 모두 지우기). 클릭 = 현재 실 선택. "안 쓰는 실 정리" 버튼.
- DMC 선택 모달: 검색(번호/영문 이름), 스와치 그리드(CSV 순서 = 색상 순), 이미 쓰는 실은 흐리게.
- 기호 선택 모달: SYMBOLS 그리드, 사용 중은 표시, 고르면 기존 사용자와 교환.
- "도안 정보": 크기(스티치), 원단 select, 가닥 수 select(1~3), 여유분 cm(기본 5), 완성 크기 cm, 재단 원단 크기 cm, 총 스티치, 색 수, 필요 타래 합계, 진행률.
- SYMBOLS(72개, PDF는 이미지로 렌더하므로 유니코드 OK): `●■▲◆★♥♠♣○□△◇☆♡✕+×÷=#%@&$?!` + `ABCDEFGHJKLMNPRSTUVWXYZ` + `abdefghkmnqrtuy` + `23456789`
- 기호 대비색: 상대휘도 > 0.55 → 검정, 아니면 흰색.

### 타래 추정
cell(cm)=2.54/ct, 풀 1개 경로=(2√2+2)·cell. 사용량(단일가닥 cm)= strands×(풀×경로 + 3/4×0.8경로 + 하프×0.5경로 + 쿼터×0.35경로) + 백스티치길이(칸)×cell×2×1 + 노트×3×strands. ×1.3(여유) ÷ 4800(8m×6가닥) = 타래. 표시는 소수1자리, 합계는 색별 올림 합.

### 사진 → 도안 (import 모달, `.modal.wide` + `.import` 2단)
- 파일 선택/드래그앤드롭 → 미리보기 캔버스 + 설정: 가로 스티치 수(20~300, 세로는 비율 자동), 최대 색 수(2~60, 기본 24), 디더링(기본 끔), 배경 제거(가장자리에서 연결된 배경색 플러드, 기본 끔), 외톨이 점 정리(기본 켬), 원단, 이름(파일명 기본). 요약: "80×64 스티치 · 18색 · 14ct에서 14.5×11.6cm". 설정 변경 250ms 디바운스 재변환.
- 알고리즘: 반씩 단계 축소 후 `imageSmoothingQuality='high'`로 w×h 리샘플 → 알파<128 비움 → Lab 변환 → (배경제거) → k-means++(시드 고정 mulberry32(42)) k=최대색, 8회 반복 → 중심을 **CIEDE2000**으로 가장 가까운 DMC에 매칭·중복 제거 → 픽셀을 선택된 DMC Lab에 유클리드 최근접 배정(디더링 시 Floyd–Steinberg, 오차×0.75) → 외톨이 정리 2패스(8이웃에 같은 색 없으면 최다 이웃색으로) → 안 쓰는 색 제거, 개수 내림차순 정렬 → 기호 배정.

### 출력
- 다운로드: `window.claude?.use('downloads')` 있으면 그걸로, 아니면 `<a download>` + Blob.
- **PDF**(jsPDF 2.5.1 UMD, `window.jspdf.jsPDF`): 한글·기호 때문에 **각 페이지를 캔버스로 그려 JPEG(0.92)로 삽입**. 기준 1240×1754(A4 150dpi) 좌표로 그리고 2배 스케일 렌더.
  1) 표지: 제목, 컬러 미리보기, 크기/원단/완성·재단 크기/색 수/총 스티치, 페이지 구성 맵
  2) 범례(여러 장 가능): 기호(흰 바탕) | 색+기호 | DMC | 이름 | 스티치 | 백·노트 | 타래, 하단에 가닥 수 안내
  3) 도안 페이지: 한 장 50×70칸(칸 21px), 헤더 "이름 · 페이지 n/N · 열 a–b, 행 c–d", 절대 번호 눈금자, 10칸 굵은선, 중앙 표시, 백스티치·노트 포함. 모드 옵션(기호 / 컬러+기호).
- PNG: 현재 보기 모드, 칸 크기 clamp(floor(4000/max(w,h)),8,24), 격자 포함.
- JSON: serialize 결과. 불러오기는 검증 후 새 id.

### 공통 렌더 함수
`renderRegion(ctx, pat, {sx,sy,ex,ey, cell, ox, oy, mode, grid, fabric, done, highlight})` 를 편집기·PDF·PNG가 공유. 칸 (x,y) 화면위치 = (ox+x·cell, oy+y·cell). 영역 clip 후 그림. 기호 모드에서 부분 스티치는 색을 35% 알파로 + 작은 기호.

## 7. PWA / 배포
- `public/manifest.webmanifest`: name "땀땀 십자수 도안", short_name "땀땀", display standalone, theme_color #0D6663, background #E9EDEA, start_url "./", scope "./", icons 192/512/maskable(512).
- `public/sw.js`: 캐시명 `ttamttam-__VERSION__`(빌드 치환). install 시 index.html, manifest, icons, vendor/jspdf 캐시. fetch: 내비게이션은 network-first(오프라인 시 캐시), 나머지 cache-first. `message: 'SKIP_WAITING'` 처리. 구버전 캐시 activate 시 삭제.
- 앱: SW 등록 후 `registration.waiting` 또는 `updatefound` → 하단 배너 "새 버전(vX.Y.Z)이 있어요 [지금 적용]" → SKIP_WAITING → controllerchange 시 reload. 앱 실행/포커스 시 `registration.update()`. 앱 하단/메뉴에 현재 버전 표시.
- `build.py`: src/index.html의 `/*__CSS__*/`, `/*__APP__*/`, `__DMC__`, `__VERSION__` 치환 → dist/index.html. public/* 복사(sw.js 버전 치환). jsPDF를 `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`에서 dist/vendor/로 다운로드(오프라인용; index.html은 `vendor/jspdf.umd.min.js` 로드). `dist/version.json` = `{"version":..., "built":...}`.
- `.github/workflows/deploy.yml`: on push main + workflow_dispatch. jobs: build(python build.py, upload-pages-artifact dist) → deploy(actions/deploy-pages) → release(태그 `v$VERSION` 없으면: dist zip → `softprops/action-gh-release` 또는 `gh release create`, 본문=RELEASE_NOTES.md의 해당 섹션 awk 추출). permissions: contents write, pages write, id-token write.
- `.gitignore`: dist/, *.zip, .DS_Store.

## 8. 남은 작업 순서 (Claude Code에서)
1. src/index.html, src/app.js 작성 (위 명세 전부)
2. public/ (manifest, sw.js, 아이콘 PNG — Pillow로 생성: 틸 바탕에 흰 X 스티치 모양)
3. build.py, deploy.yml, .gitignore, README.md
4. `python3 build.py` → `npx playwright`(또는 python -m http.server + 크롬)로 dist 열어 콘솔 에러 확인, 예시 도안 렌더, 사진 변환, PDF 생성 테스트
5. 커밋 `[v1.0.0] 최초 릴리즈` → push → Actions 성공 확인 → Pages 주소 알려주기
