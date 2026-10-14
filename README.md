# 바이어 스케줄 앱

스케줄마다 ETA, 산지가, 바이어가를 폰으로 보고 고치는 앱입니다. 앱 주소: https://facjohn.github.io/buyer-schedule/ 구글시트가 원본이고, 폰 앱은 Apps Script 창구를 거쳐 시트를 읽고 씁니다. 2026년 10월 14일에 단순화 방향으로 기획을 고쳤습니다(docs/DECISIONS.md 맨 위).

## 들어 있는 것

| 파일 | 내용 |
| --- | --- |
| CLAUDE.md | Claude Code가 세션마다 자동으로 읽는 규칙. 짧게 유지합니다 |
| docs/SPEC.md | 기획서 전체 |
| docs/DECISIONS.md | 정한 것 |
| docs/DESIGN.md | 색, 글꼴, 크기, 화면 목록, 시안과 달라진 점 |
| docs/PROMPTS.md | Claude Code에 순서대로 붙여 넣을 지시문 (1단계 ~ 4단계) |
| docs/DEPLOY.md | 배포 기록, Apps Script 고친 뒤 올리는 명령, 처음 한 번 할 일 |
| docs/mockups/*.png | 화면 시안 (개정 전. 05·06은 안 씀) |
| docs/mockups/html/*.html | 같은 시안을 정적 HTML로 찍은 것 (색과 간격 참고용) |
| docs/diagrams/*.png | 개정 전 흐름 그림 (참고하지 않음) |
| apps-script/ | 구글시트에 붙는 연결 창구 (clasp로 올림) |
| tests/ | 창구 코드를 컴퓨터에서 시험하는 테스트 |

## 미리 준비할 것

- GitHub 계정 (화면을 GitHub Pages에 올립니다)
- 시트와 Apps Script의 주인이 될 구글 계정. 앱이 이 계정 권한으로 시트를 고치니, 회사 일에 계속 쓸 계정으로 정합니다
- 컴퓨터에 Node.js (최신 LTS)
- 아이폰과 컴퓨터가 같은 와이파이 (개발 중 아이폰으로 바로 확인)

## 주의

- 접속 코드와 시트 ID는 저장소에 올리지 않습니다. GitHub Pages 사이트는 공개됩니다.
- 시트는 PC로 일하는 직원 계정에만 이름으로 공유하고, 링크 공유는 하지 않습니다. 폰 앱은 Apps Script 창구로만 시트를 읽고 씁니다.
- 시안 PNG는 비슷한 글꼴(Noto Sans CJK KR)로 찍혀서 글자 모양이 실제 글꼴(IBM Plex Sans KR)과 조금 다릅니다.
