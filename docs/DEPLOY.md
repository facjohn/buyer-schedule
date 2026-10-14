# 배포 기록과 명령

## 지금 배포된 것

- 앱 주소(GitHub Pages): https://facjohn.github.io/buyer-schedule/
  - 저장소: https://github.com/facjohn/buyer-schedule (공개). `main`에 올리면 GitHub Actions가 시험·빌드한 뒤 1~2분 안에 앱 주소에 반영합니다.
- 시트와 Apps Script 주인: 시트를 만든 구글 계정(시트 이름 "바이어 스케줄", 구글 드라이브)
- 시트 ID와 스크립트 ID: `apps-script/.clasp.json`에만 있음(저장소에 안 올라감)
- 웹 앱 배포 ID: `AKfycbwnylSWqGdI9BkIqB7Qq4DQS5HSq68hEF5xkBmy-XnqEJLS1U09YxI6M-jNcR6lTzMS`
- 웹 앱 주소: https://script.google.com/macros/s/AKfycbwnylSWqGdI9BkIqB7Qq4DQS5HSq68hEF5xkBmy-XnqEJLS1U09YxI6M-jNcR6lTzMS/exec
  - 앱 코드에 들어가도 되는 주소입니다. 접속 코드가 없으면 데이터 없이 거절합니다.

## 화면(앱)을 고친 뒤

```bash
git add -A
git commit -m "고친 내용"
git push
```

GitHub Actions가 시험(npm test)을 통과해야 앱 주소에 반영됩니다. 폰에서는 앱을 닫았다 다시 열면 새 화면이 보입니다.

## Apps Script를 고친 뒤

이 폴더에서 아래 명령 하나면 코드를 올리고, 같은 배포를 새 버전으로 바꿉니다. 웹 앱 주소는 그대로입니다.

```bash
npm run gas:deploy
```

새 배포를 만들면(`clasp create-deployment`) 주소가 바뀌니 하지 않습니다.

## 시험

```bash
npm test
```

apps-script/ 코드를 가짜 시트로 시험합니다. 구글에 접속하지 않습니다.

## 처음 한 번 브라우저에서 할 일 (시트 주인 계정)

1. 구글 드라이브에서 "바이어 스케줄" 시트를 엽니다. 메뉴줄에 "바이어 스케줄" 메뉴가 생길 때까지 몇 초 기다립니다(안 보이면 새로고침).
2. 바이어 스케줄 > 처음 설정을 누릅니다. "승인 필요" 창이 뜨면 계정을 고르고 허용합니다. "Google에서 확인하지 않은 앱" 화면이 나오면 고급 > (안전하지 않음)으로 이동 > 허용을 누릅니다. 내가 만든 스크립트라서 나오는 화면입니다.
3. 권한을 허용하면 처음 설정이 끝나 알림창이 뜹니다. 허용 직후 아무 일도 없으면 처음 설정을 한 번 더 누릅니다.
4. 바이어 스케줄 > 예시 데이터 넣기를 누릅니다. 알림창에 예시 팀원 코드 두 개가 나옵니다. 앱을 시험할 때 씁니다.
5. 품목 탭의 "시즌 시작 월"을 과일마다 1~12로 채웁니다. 비우면 1월부터로 봅니다.
6. 바이어 스케줄 > 앱 주소 넣기에 앱 주소(https://facjohn.github.io/buyer-schedule/)를 넣습니다. 그다음부터 팀원 코드 만들기가 링크까지 만들어 줍니다.
