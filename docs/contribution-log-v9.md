# PortPlan V9 · 실제 기여 기록

AI 작성 준비 자료. 참가자 본인의 창작·검증·이해·참가자격 확인서가 아닙니다.

| 작업 | 실제 수행 주체 | 범위 |
| --- | --- | --- |
| 이전 V8 후퇴·G0 진단 보존 | AI | 과거 결과를 변경하지 않음; 새 holdout과 분리 |
| V9 후보 전달·잠금·guard 구현 | AI | 동기식 gate·전체 receipt·수락/거부 증거 보존 |
| 명시적 가격·권한 메뉴 자원 보완 구현 | AI | 현재 모델의 반사실 권고; 실제 구매·배차 없음 |
| 고정 새 평가·물리 검산 | AI | 완결 원본과 검산을 같은 SHA로 연결 |
| 별도 scenario-cluster 통계 검산 | AI | 동일 원본 SHA와 frozen manifest의 구간 재계산 |
| 한국어 HTML/PDF/PPTX·영어 노트 | AI | 동일 18개 slide 객체에서 문자·표·도형 편집 가능 자료 생성 |
| 사용자 본인 개발·검증·이해·발표 | pending | AI 작업을 개인 창작이나 이해 증명으로 옮기지 않음 |
| 전문가·기업·청구서·현장 검증 | 미수행 | 인터뷰·실현 절감·현장 수락 증거 없음 |
| 등록·서약·본인 발표·AI 규정 확인 | pending | 자료 준비이며 대회 제출·서명·자격 인증 아님 |

GLPK, HiGHS, SciPy, 원 연구·데이터·공개 방법의 저작권과 notice는 각 소유자에게 귀속합니다. 내부 독립 구현은 외부 제3자 인증이 아닙니다. PDF는 Noto Sans CJK KR의 필요한 glyph를 변환·부분 내장하며 SIL Open Font License 귀속을 유지합니다.

## 실제 자료 입력

| 증거 입력 | SHA-256 |
| --- | --- |
| data/v9-results.json | fe021614be03707bde070e499f7d626170f48add832bffe1ac38de1987399d1c |
| data/evidence-v9/v9-frozen-first/first-run/complete.json | 83d165a965e421af0ebc0b399f426eab3ae48eddc4a564374a6074f9edad7204 |
| data/protocol-v9.json | 1f8c22e173bba58165d3e641a28a1ce959ec2f9810baac880bc5553b5a6d1273 |
| data/review-v9.json | 7716e885b7ea673bba6e552b1e6c52f3137cad4157058b8d59696175f10c6c50 |
| data/bootstrap-review-v9.json | e8de544d3bd7203c4e044e104f46798d3a7e1ef9cf83a7a7b2af0d3caff87f51 |
| data/v8-results.json | e033704ef2e27a6f1b2fc8d55ba94809b8fd8a77c6aa3d50d19a77a3199ed92b |
| data/evidence-v8/v8-frozen-first/first-run/complete.json | e873aae0c65fcf51d7335fb3aa57f5285bdbb12bf9c286fb4018c8b2213205b6 |
| data/review-v8.json | e641527d79883fc467fdf7b1246a257cc5d622f31686c90179c065652f00d3e0 |
| data/failure-diagnosis-v8.json | b17cef73f79c8259cab5d68e194a36e858c4c1adc8613f16c5a18a5b51be99e7 |
| data/resource-validation-v9.json | 32b6e1d89bafaec31914a98661c256aed4ceb2e6257eef2077e20fba1fc44227 |
| data/resource-review-v9.json | 6befb3ab1211cad8a784fe1a1a8a16d4324f7ec03d369920e0bd2b182a0d1b48 |
