# PortPlan V8 — understanding and defense notes

AI-created preparation from complete formal evidence. Not evidence of entrant understanding, authorship, registration or field acceptance.

## 01. 오늘 어떤 컨테이너를 반출하고, 언제 적출·반납해야 할까요?

PortPlan supports a planner coordinating known import containers and daily transport/warehouse resources. It connects published tariffs to a complete pickup–unload–return plan. This is a synthetic daily-model research prototype, not realized business savings. The V8 completion-improvement hypothesis was not supported: same-distribution V8 80/216 versus V7 156/216; stress V8 48/216 versus V7 89/216.

## 02. 세 행동은 같은 자원을 공유합니다.

Pickup and return each consume a daily transport movement. Unloading occupies consecutive days; staging spans pickup to before return. This is not a route, appointment, driver-hours or newly arriving order model.

## 03. 가격을 먼저 정확히 계산하고, 전체 계획에서 선택합니다.

Published PNC retroactive tiers and an explicit Maersk D&D interpretation determine model fees. A one-container tariff exposure is not a global delay cost. Private contracts, actual invoices, taxes and transport/warehouse operating costs are not validated.

## 04. G0: 실패를 모두 같은 문제로 취급하지 않습니다.

G0 reconstructs all archived V7 failures in four layers: nominal from start, observed snapshot with executed prefix, hindsight actual from start, and hindsight actual with the same prefix. The latter two are offline counterfactuals, never online information.

## 05. G0는 개선 가능한 대상을 구체적으로 좁힙니다.

The diagnosis bounds what can be recovered under unchanged resources and deadlines. A feasible offline witness alone does not establish that more time given to the original algorithm would recover it. Subsequent original-seed frozen-V7 extra-budget probes were actually performed and are reported separately as old-input development evidence; they do not add formal holdout scenarios.

## 06. 같은 실행 이력의 개발 검사에서도 단순 기준과 비교합니다.

The independently reviewed development run has 28 fixed snapshots and 392 calls. V8 versus simple retain/recover has 63 timely common pairs, fee lower/equal/higher 0/63/0. V8 did not outperform simple retention here; these warm development snapshots do not add new holdout scenarios. An additional 8 original-seed fresh-factory frozen-V7 calls compared 200ms and 1000ms on 4 old snapshots; 1 became timely complete only at 1000ms and 3 remained incomplete at both budgets. miss-v7-new-arrivals-tight-n50-r2 at D3 preserves 17 executed events and returns a model total fee of KRW 9100 at 1000ms. These extra-budget development probes do not restore the private archived V7 cache or replay a whole cold episode, and do not increase the prospective denominator.

## 07. V8: 유효한 계획을 유지하고, 필요할 때만 개선·복구합니다.

V8 audits its cached plan, retains or conditionally polishes valid dates, and rebuilds invalid plans under exact locks. Date-change and near-term pressure guards are heuristics, not future feasibility or full-path cost guarantees.

## 08. 분모와 반복을 먼저 고정했습니다.

The complete formal run contains 144 business scenarios, 5 fixed methods and 3 retained repeats, totaling 2160 episodes. Panels stay separate. The common parent deadline includes startup, all decisions, cleanup, message receipt and terminal validation; internal call clocks differ.

## 09. 동일 생성분포 · 새 시드 먼저 완주와 미확보 이력을 확인합니다.

Read completion before fees. Chart bars show completed episodes; all-three-repeat scenario counts and unavailable histories remain separate. No pooled ranking combines the two panels.

## 10. 동일 생성분포 · 새 시드 같은 사례의 완주 쌍만 요금을 비교합니다.

Positive savings means baseline minus candidate. Average matching jointly completed repeats inside each scenario, then weight scenarios equally. Every comparison has its own selected completed-pair denominator; incomplete costs are null.

## 11. 새 충격 스트레스 먼저 완주와 미확보 이력을 확인합니다.

Read completion before fees. Chart bars show completed episodes; all-three-repeat scenario counts and unavailable histories remain separate. No pooled ranking combines the two panels.

## 12. 새 충격 스트레스 같은 사례의 완주 쌍만 요금을 비교합니다.

Positive savings means baseline minus candidate. Average matching jointly completed repeats inside each scenario, then weight scenarios equally. Every comparison has its own selected completed-pair denominator; incomplete costs are null.

## 13. 불리한 결과도 같은 화면에 남깁니다.

Report adverse fee scenarios, worst scenario-average loss and gained/lost completions for every declared comparison. All negative scenario/repeat identifiers and lost-completion identifiers are retained in the Korean report. HiGHS also sharply increases date revisions within the paired completed paths: same-distribution: 6300 to 49350 across 147 episode pairs; stress: 9394 to 29876 across 82 episode pairs.

## 14. 계산 기한과 날짜 변경의 대가도 공개합니다.

Timing includes native startup in the common parent budget. Date revisions count pending event-date edits, not labor cost or distinct containers. Unknown counters remain unknown rather than zero.

## 15. 독립 구현은 무엇을 확인했을까요?

The internal Python implementation independently reconstructs input generation, causal observations, execution locks, fees, resources, V8 acceptance guards and point estimates. Bootstrap intervals were separately reproduced by the independent Python statistical review bound to the same formal index. Completed-pair selection bias remains; independent interval reproduction does not establish operational validity or third-party certification.

## 16. 내 입력으로 성공과 중단을 직접 확인할 수 있습니다.

The local page imports a custom scenario, configures simulator-owned events, compares two sequential workers, and exports exact inputs/results. The ten-container examples are illustrative synthetic teaching fixtures, not formal experimental evidence or field deployment.

## 17. 증거와 기여의 경계를 끝까지 유지합니다.

AI performed implementation, experiments and material preparation; original research and software remain attributed. Entrant understanding, expert/enterprise validation, field acceptance, registration and applicable AI conditions are pending and are not certified by these documents.

## 18. 심사위원이 같은 결정을 다시 계산할 수 있게 전달합니다.

Deliver complete inputs, every repeat, all failures, frozen source, independent audits and adverse identifiers with exact hash bindings. Reproductions write new paths. The materials are preparation, not a submission, signature or entrant-understanding attestation.

## Exact evidence bindings

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

See submission-v8.ko.md for every pair-specific total/incremental denominator, all adverse scenario and repeat IDs, gained/lost completions and conditional bootstrap intervals. Intervals were separately reproduced by the independent Python statistical review bound to the same formal index; completed-pair selection bias remains. No pooled panel leaderboard, full-path non-regression, SOTA, operational ROI or first-place probability is supported.
