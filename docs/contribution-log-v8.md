# PortPlan V8 · 실제 기여 기록

AI 작성 초안. 참가자 본인의 창작·검증·이해·참가자격 확인서가 아닙니다.

| 작업 | 실제 수행 주체 | 범위 |
| --- | --- | --- |
| G0 독립 실패 진단 | AI | 기존 V7 실패의 사후 모델·잠금·요금 검산; 새 holdout 아님 |
| V8 의사결정·native HiGHS·시뮬레이션 구현 | AI | source·protocol·실행 장부에 실제 범위 보존 |
| 고정 새 실험 및 독립 Python 검산 | AI | 완결 원자료와 검산의 동일 SHA 연결 |
| scenario-cluster 구간의 별도 통계 검산 | AI | 동일 원본 SHA에 연결된 별도 Python 구간 재계산 |
| 한국어 자료·PDF·영어 노트 작성 | AI | 완결 결과에 따른 자동 생성; 발표 숙련 증명 아님 |
| 사용자 본인 개발·검증·이해 | pending | 대신 완료로 표시하거나 AI 작업을 개인 창작으로 옮기지 않음 |
| 전문가·기업·현장 검증 | 미수행 | 인터뷰·도입 약속·실현 절감·현장 수락 증거 없음 |
| 등록·서약·본인 발표·AI 규정 확인 | pending | 이 자료는 제출·서명·자격 확인이 아님 |

GLPK, HiGHS, SciPy, 공개 방법과 원 연구·데이터의 저작권 및 notice는 각 소유자에게 귀속합니다. 내부 독립 구현은 제3자 인증이 아닙니다. PDF는 Noto Sans CJK KR의 필요한 글리프를 변환·부분 내장하며 폰트의 SIL Open Font License 귀속을 유지합니다.

## 실제 자료 입력

| 증거 입력 | SHA-256 |
| --- | --- |
| data/v8-results.json | e033704ef2e27a6f1b2fc8d55ba94809b8fd8a77c6aa3d50d19a77a3199ed92b |
| data/evidence-v8/v8-frozen-first/first-run/complete.json | e873aae0c65fcf51d7335fb3aa57f5285bdbb12bf9c286fb4018c8b2213205b6 |
| data/protocol-v8.json | fa886fe62cd2fdb08097bff97e64bc20cd4fe00198c2b4b9caff9d8a7bb3deb5 |
| data/review-v8.json | e641527d79883fc467fdf7b1246a257cc5d622f31686c90179c065652f00d3e0 |
| data/bootstrap-review-v8.json | 11acbc4de3c73edff3cd203028d1beca13e9e635415b3cecdf00d77af9bd30f7 |
| data/failure-diagnosis-v8.json | b17cef73f79c8259cab5d68e194a36e858c4c1adc8613f16c5a18a5b51be99e7 |
| data/evidence-v8/mechanism-v8-first/results.json | 537140a831fb5807bb703b2757b9203c328d3062a6e486006c3780e44c0eaf23 |
| data/evidence-v8/mechanism-v8-first/audit.json | d1c84d369197ff6cf4520d09cb77af30c3d1addd1ddcf5c377860a5e742d2f93 |
