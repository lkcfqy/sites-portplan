# Competition and tariff rule status — V2

Checked 2026-10-12 UTC against public primary sources. No organizer, author, carrier, or other person has been contacted. Unknown means not established by this public-source check, not prohibited or permitted. This file supplements `docs/source-audit.md`; it does not overwrite V1 evidence.

## 2026 LogisticSolver

The [official 2026 program page](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n) describes a smart-logistics problem-solving competition. Participants identify issues in port, international or multimodal logistics and propose technology/data-based services, solutions, policies or strategies.

| Item | Public-source finding | Practical interpretation |
|---|---|---|
| University / graduate status | Explicit wording: “국립창원대학교 재학생(대학원생 포함)” | The notice expressly includes graduate students. Doctoral students belong to that category; individual enrollment and registration are still checked by the organizer. This is not inferred solely from the word “student.” |
| Team size | Teams of no more than four | A minimum size and explicit one-person-team permission are not stated. Solo eligibility remains to be confirmed. |
| Registration | Free; 40-person capacity; first come until full; members-only login | November 6 is not a guarantee that registration capacity remains available until then. No registration was submitted. |
| Submission | November 6, 2026, 18:00 | University local schedule is understood as Korea time; the page itself does not print a timezone label. |
| First review / presentation | November 13 / November 20, 2026 | Presentation duration and Q&A duration are not published on the inspected page. |
| Documents | Report and all data/code; presentation material no more than 20 pages | No report page limit or mandated report template was found. A 6–8-page report is our drafting choice, not an official limit. |
| English presentation / slides | Not stated | English materials may be prepared, but permission for English oral presentation, English slides or bilingual summary has not been established. |
| AI assistance | Not stated | No public prohibition or permission was found; silence does not settle disclosure, authorship or tool-use conditions. Keep an accurate tool/contribution record. |
| Scoring | Numerical weights / rubric not found | Any internal quality score is a self-assessment, never the official judging rubric. |
| Awards | 대상: Governor award; 최우수상: Changwon Mayor award | These are distinct award levels. Do not translate last year's 최우수상 as evidence of the grand prize. |

Searches covered the current page and poster evidence already preserved in V1, official university notices, and Korean/English queries for solo participation, AI, English and judging criteria. They did not establish missing conditions. Older 2025 notices are historical context, not substitutes for 2026 rules.

## Verified previous award example

The [university department's November 5, 2025 article](https://www.changwon.ac.kr/ie/na/ntt/selectNttInfo.do?mi=13934&nttSn=1400175) reports a **최우수상** for “방산 수출을 고려한 국내외 물류센터 입지선정 최적화” (domestic/international logistics-center location optimization for defense exports). It describes LRP/VRPPD, a mixed-integer model and CPLEX, with transport and time costs around a Changwon hub and foreign distribution locations. This establishes that an applied mathematical logistics model won an award. It establishes neither the full field of entries nor the grand-prize project nor the 2026 scoring standard.

## Korean inquiry draft for the entrant to send, if desired

**Draft only — not sent. No personal identity fields are included.**

제목: 2nd LogisticSolver 2026 참가 및 발표 언어 문의

안녕하세요. 2nd LogisticSolver 2026 참가를 준비하고 있습니다.

1. 공고의 “4인 이내 팀”에 1인 팀도 포함되어 개인 참가가 가능한지 확인 부탁드립니다.
2. 발표심사에서 영어로 발표와 질의응답을 진행할 수 있는지 궁금합니다. 영어 PPT와 한국어 요약문을 함께 제출하는 방식도 가능한지 안내 부탁드립니다.
3. 생성형 AI를 보조 도구로 사용하는 경우 사용 내역 공개 등 별도 준수사항이 있는지도 확인 부탁드립니다.

감사합니다.

## Maersk Korea: what the additional examples establish

The [Korea import tariff page](https://www.maersk.com/local-information/asia-pacific/south-korea/import) and [June 10, 2024 adjustment notice](https://www.maersk.com/news/articles/2024/06/10/export-import-demurrage-and-detention-rate-korea-south-to-from-world) list the current dry-container import combined D&D bands, effective July 15, 2024 PCD. Calendar-day counting includes discharge and empty gate-in. Standard free time is 10 days; 20′/40′ rates are ₩15,000/₩30,000 on days 11–15, ₩30,000/₩50,000 on days 16–20, and ₩50,000/₩90,000 from day 21. The 40′ category includes high-cube/45′ high-cube in the tariff. Earlier special deals may retain earlier rates through their validity. PCD and contract applicability must be checked for a real shipment.

| Official example | Observed values | What it establishes / does not establish |
|---|---|---|
| [Current Korean free-time / pre-DO guide](https://www.maersk.com/~/media_sc9/maersk/local-information/files/asia-pacific/korea/import/freetime-pre-do-check-guideline.pdf), page 1 | 40 Dry High; free December 3–12, 2025; return December 15; 3 chargeable days; ₩90,000 | Supports ten inclusive free days and three days at ₩30,000. All chargeable days are in the first band; it cannot distinguish cross-band accumulation from repricing all excess days at the highest band. |
| [Legacy Sealand Korea customer guide](https://www.maersk.com/~/media_sc9/maersk/local-information/files/asia-pacific/korea/import/sl/1-guideline-for-import-customers.pdf), page 7 | 40′ dry; special 21-day free time; October 9, 2020 last free day; October 10 return; 1 chargeable day; ₩88,000 | Historical example of charging a high band after extended free time rather than resetting to the first band. It does not establish the current 2024 tariff's cross-band accumulation formula. |

Both PDFs were downloaded and the example screenshots visually checked. Their publication dates are not supplied publicly; the dates above belong to examples. Local copies: `data/public/v2-maersk-korea-calculator-guide.pdf` and `data/public/v2-sealand-korea-calculator-guide.pdf`, with hashes in `v2-research-source-manifest.json`.

**Still unresolved:** no explicit current Korean multi-band numerical example or formula was found that settles daily slab accumulation versus highest-band retrospective repricing. The safe project statement is: **“The published Korean bands are verified; summing the daily slabs is the model's billing interpretation, pending confirmation against a cross-band official example or shipment contract.”**

The [global calculation FAQ](https://www.maersk.com/support/faqs/demurrage-calculation) points to local-country rules. [Global D&D terms](https://terms.maersk.com/dnd) establish contract/published-rate applicability and combined endpoints, but do not supply the missing Korean arithmetic. Other countries' use of “progressive” often concerns whether an extended free period resets the rate band; it must not be used as proof of Korea's cross-band sum. If free time is changed in a scenario, state the chosen band convention and test it; do not silently move all Korean bands along with the extra free days.

## PNC boundary retained from V1

The [2026 standard tariff](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf) supports the retroactive highest-band storage formula, the four free days and the 08:00 counting boundary. The cargo-owner inquiry page still shows rates matching 2025 and a VAT-inclusive total label. That conflict is unresolved. A public-tariff model excluding VAT/contract adjustments is not an actual PNC invoice quote. Combining PNC storage with Maersk combined D&D is supported by the Korean direct-storage-billing notice, but the applicable payer, contract, effective date and taxes still matter.

The project must keep tariff evidence, assumed billing arithmetic, and simulated demand as separate layers. Neither publicly observed Gwangyang vehicle visits nor Incheon anonymized gate events constitute a shipment-level PNC order book or validate operational savings.
