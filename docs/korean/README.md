# Buzz Korean 개인용 개발판

설치된 macOS Buzz 0.5.28과 같은 `desktop-v0.5.28` 태그(`f87c10895ea35a9a2cea629fef1d7532a3fecbc5`)를 기준으로 만든 한국어 개발 브랜치입니다. 공식 제품이나 공식 지원 확정판을 뜻하지 않습니다.

## 구현

- i18next/react-i18next 기반 언어 선택, 즉시 전환, 로컬 저장, 시스템 언어 해석, 영어 대체 표시를 사용합니다.
- 한국어 전용 빌드는 첫 실행에 한국어를 선택하며, 이후에는 사용자가 저장한 선택이 우선합니다. 일반 빌드는 시스템 언어를 따릅니다.
- 화면에 작성된 문구만 소스에서 번역합니다. 사용자 메시지, 코드, 파일명, 프롬프트, 비밀 값, 프로토콜 식별자에는 일괄 치환을 적용하지 않습니다.
- 문자열 안의 숫자와 이름은 변수로 유지하고, 링크와 버튼이 들어간 문장은 `uiMessage`로 React 요소를 보존합니다.
- macOS 앱 메뉴와 트레이의 앱 소유 문구도 언어 설정을 따릅니다. 외부 프로그램이 출력하는 오류와 OS 권한 창은 해당 프로그램/OS의 언어를 따릅니다.
- 기존 중국어 기반 자원은 보존했습니다. 중국어에 없는 확장 UI 문구는 영어로 표시됩니다.

## 원본 앱과 데이터 격리

이 브랜치의 전용 빌드 스크립트는 기존 프로젝트의 demo identity 기능을 사용하며 아래 식별자를 고정합니다. 개인용 업데이트에서도 값을 유지해야 합니다.

| 항목 | 개인용 값 |
|---|---|
| 앱 이름 | Buzz Korean |
| 번들 ID | `xyz.block.buzz.app.demo.korean-0000000000000002` |
| 키체인 서비스 | `buzz-desktop-demo.korean-0000000000000002` |
| 에이전트 작업 폴더 | `~/.buzz-demo-korean-0000000000000002` |
| URL 스킴 | `buzz-demo-korean-0000000000000002` |

공식 Buzz의 데이터 폴더를 복사하거나 덮어쓰지 않습니다. 기존 계정 연결이나 키 가져오기는 별도 사용 단계입니다. 공식 updater 키/주소는 전용 빌드에서 비웁니다.

## 빌드

저장소 루트에서 Hermit 도구 환경을 활성화하고 의존성을 설치합니다.

```bash
source bin/activate-hermit
pnpm install --frozen-lockfile
node desktop/scripts/build-korean.mjs --build-number 2 --sidecars-from '/path/to/official/Buzz.app'
```

보조 실행 파일은 동일 버전 공식 앱에서 가져옵니다. 이 개발판은 보조 실행 파일을 다시 컴파일했다고 주장하지 않습니다. 스크립트는 공식 앱의 버전과 호스트 아키텍처를 검사하고 원본 해시와 패키지 재서명 후 해시를 각각 JSON으로 남깁니다. 개인용 번들 안의 사본만 로컬에서 재서명하고 `codesign --verify --deep --strict`로 검사합니다. 결과 앱은 `desktop/src-tauri/target/release/bundle/macos/Buzz Korean.app`입니다.

개인용 빌드는 로컬 서명을 사용합니다. Block의 배포 서명이나 Apple 공증을 대신하지 않습니다. macOS 보안 설정을 일괄 해제하는 설치 절차는 사용하지 않습니다.

`--build-number`는 같은 프로필을 사용하는 개인 업데이트를 구분합니다.
소스 커밋·파일 지문·빌드 번호는 번들의 `buzz-korean-build.json`과
`desktop/output/korean-build/build-manifest.json`으로 확인합니다.
자세한 교체·복귀 조건은 [MAINTENANCE.md](MAINTENANCE.md)에 있습니다.

## 번역 유지보수

현재 자원은 `desktop/src/locales/en.ui.json`, `ko.ui.json`, `ui-keys.json`에 있습니다. 새 번역이나 수정은 `ko.additional.json`을 우선 편집합니다. 고정 출처에서 추출해 저장소에 보관한 `ko.source.snapshot.json`의 리터럴 데이터로 자원을 재생성합니다. 임시 다운로드 파일이나 네트워크 없이 실행할 수 있습니다.

```bash
pnpm --dir desktop i18n:generate
pnpm --dir desktop i18n:check
```

원본 patch를 명시적으로 입력하는 기존 사용법도 지원합니다. 입력 바이트의 SHA-256이 고정 출처와 일치해야 하며, 출처 정보와 스냅샷 해시는 `korean-source.json`에 기록합니다. 재생성은 모든 출력을 먼저 계산한 뒤 달라진 파일만 기록합니다. `i18n:check`는 파일을 쓰지 않고 생성 결과가 오래됐는지 검사합니다. 공개 패치의 실행 코드는 가져오지 않습니다.

`localize-korean-ui.mjs`는 소스 이전을 위한 도구입니다. 출력은 반드시 소스 diff와 화면으로 검토해야 합니다. 기술 식별자와 사용자 콘텐츠를 번역 대상으로 간주해서는 안 됩니다. `--report /path/to/report.json`으로 남은 후보를 기록할 수 있습니다. 후보 수는 번역 누락률이 아니며, 브랜드·URL·코드 토큰도 포함합니다.

## 검증과 남은 범위

변경 후 타입 검사, Biome 검사, 파일 크기 검사, 전체 desktop 테스트를 수행합니다. 원본과 같은 기능 선택으로 실제 macOS `.app`을 빌드하고 실행 화면을 확인합니다. 브라우저 mock 검증과 네이티브 앱 검증은 구분해서 기록합니다.

2026-10-23 후보에서는 저장소 전체 `just ci`, desktop 테스트 7,010개, 실제 macOS 앱의 로컬 릴레이 연결·메시지 저장·한글 파일명 첨부/다운로드, 검색과 시험 하네스의 시작·중지 경로를 검증했습니다. 키체인 승인 후 패키지 교체·재실행에서 한국어 설정·신원·초안 복원과 번들 도구 실행, 공식 앱 복귀도 확인했습니다. 이 과거 결과는 `ACCEPTANCE.md`에 보존합니다. 2026-10-24 후속 변경과 새 후보의 결과는 [FOLLOWUP.md](FOLLOWUP.md)로 구분합니다. 3~5일 실사용은 제외하며, VoiceOver 직접 검증은 사용자 요청으로 다시 포함했습니다. upstream 제출은 별도 제출 요청 후 진행하며, 사람의 최종 직접 시험을 완료로 대신 표시하지 않습니다.

출처와 작성자는 [THIRD_PARTY.md](THIRD_PARTY.md)에 기록했습니다.
실제로 수행한 검사와 남은 범위는 [ACCEPTANCE.md](ACCEPTANCE.md)에 기록했습니다. 첫 개발판의 과거 기록은 [VALIDATION.md](VALIDATION.md)에 보존했습니다.

용어와 번역 경계는 [GLOSSARY.md](GLOSSARY.md), 업데이트·복귀 절차는 [MAINTENANCE.md](MAINTENANCE.md), 공개 제안 비교와 PR 초안·사람의 확인 절차는 [CONTRIBUTION.md](CONTRIBUTION.md)에 정리했습니다.
