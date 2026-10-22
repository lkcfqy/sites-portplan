# PortPlan V6 실제 기여 기록

생성 2026-10-13T05:33:08+00:00. 이 문서는 AI 자체 수행 기록이며 사용자 본인 창작·검증·참가 자격 확인서가 아니다.

| 작업 | 실제 수행 주체 | 근거 / 범위 |
|---|---|---|
| 공개 규칙·선례·자료 조사 | AI | 원문·다운로드·SHA·접근 실패를 보존; 연락/등록 없음 |
| 실행 잠금 복구·1일 예측·필요조건 구현 | AI | 소스와 최초 실행 snapshot, 고정 synthetic fixture 검증 |
| 기존 실패 native 진단·독립 Python 감사 | AI | 별도 구현/추가 오프라인 예산; 외부 기관 인증 아님 |
| 새 고정 36입력과 개발24×4정책 실행 | AI | 최초 프로토콜·전체240episode와 음성 결과 |
| 실제 공개 입력 CSV·행렬 독립 감사 | AI |39 checks/11 gaps; 원실측/PNC 주문으로 승격하지 않음 |
| 웹·자료·韓文 발표·영문 이해 노트 작성 | AI |18쪽 초안; PDF/화면 최종 검토 별도 |
| 사용자 본인의 직접 구현·검증·이해 완료 | 확인되지 않음 |자체 개발이나 검토 완료라고 대리 기재하지 않음 |

기반 라이브러리 GLPK/HiGHS/SciPy 및 기존 연구, 공개 요율, 데이터 저작권·라이선스는 원 소유자에 귀속한다. 이 기록은 AI 수행을 사용자 개인 기여로 옮기지 않는다. 2025 창작 서약의 직접 창작 및 대리 작성/발표 금지와 2026의 확인되지 않은 적용·AI 해석을 구분한다. 참가 신청·연락·대리 서명/발표는 하지 않았다.

새 주 평가를 본 뒤 파라미터·seed를 교체하거나 개발24로 새 방법을 재선택하지 않았다. 비용 음성·미완료·0원·unknown을 제외하지 않은 자료를 유지한다. 본인의 검토/수정이 실제로 생기면 범위와 날짜·증거를 따로 기록해야 하며 자동으로 완료 표시하지 않는다.

Git 전송용으로 V6 원본 112,117,733바이트를 순서 있는 29개 분할본(각 최대 4,000,000바이트, 마지막은 더 작음)과 `data/archives-v6/rolling-v6/manifest.json`에 저장한다. `npm run build`와 `npm run verify:v6`는 복원기를 호출해 각 조각과 전체 SHA-256을 검사하고 누락된 원본만 복원한다. Git clone이나 npm ci 자체는 복원을 실행하지 않으며 다른 직접 실행 전에 `python scripts/restore-evidence-v6.py`를 쓸 수 있다. 웹사이트의 기존 세 ZIP을 합치면 완전 원본·웹뷰·분할본·manifest가 모두 있고 같은 portplan/ 루트로 풀면 된다. 기존 원본은 대체하지 않으며 이는 무손실 전송 변경일 뿐 실험·프로토콜·최초 소스나 원본 SHA를 바꾸지 않는다.

## 이번 자료 생성 입력

| 실제 입력 | SHA-256 |
| --- | --- |
| data/protocol-v6.json | `6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311` |
| data/rolling-v6.json | `695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4` |
| data/failure-diagnosis-v6.json | `57f9a34ed16a20c9fab115c0666b8c826d1c77bbe0d2a660a777d7ef0c2c419d` |
| data/feasibility-witnesses-v6.json | `2a5f76e5c8df79c889b0840d3a901fa68579d247978156bf0e40fe875aafbc94` |
| data/feasibility-review-v6.json | `eae5e16cda332f6935598b2812e7e0d58cf87182b3a3eeeeb3ef475b640ee5a0` |
| data/public-orders-audit-v6.json | `57f011bc3f16d083ef4063a26735da526a142d0a20f1ff57e187653af28604f5` |
| data/public-sources-v6.json | `22f9fdf51a1977c48549d6dd4d952509a9ece91fa1e1c187206d3bcb9b585a7b` |
| data/rolling-v5.json | `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592` |
| data/benchmark-v5.json | `d04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e` |
| data/public/v5-rules/manifest.json | `1d849beb9a5a2ab11ac106dc56dbc28e6c08ade7ea1ed1723448e5414098c267` |
| vendor/experiments/v6-first-run-source/manifest.json | `bff94bc20dbfcc261f8b43fa92ba186a5b1ff602dad781472ee3beb5ee54f70b` |
