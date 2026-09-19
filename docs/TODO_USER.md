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
- 도안은 **그 기기의 브라우저 안에** 저장됨. 기기 바꾸거나 브라우저 데이터 삭제 전에 앱의 **"전체 백업"(JSON)** 으로 내보내 두기.
- 앱 설치(PWA)하면 브라우저 정리 시에도 비교적 안전하게 보존됨.

## 선택
- [ ] 나중에 스토어 배포가 필요하면: PWA를 TWA로 감싸 Play 스토어 등록 가능 (개발자 계정 $25). 지금은 불필요.
