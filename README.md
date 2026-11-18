# world-in-one-day-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/qaz19qpl/world-in-one-day-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/qaz19qpl/world-in-one-day-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**The World in One Day** — a one-page news poster of Wednesday 18 November 2026, drawn entirely by code.

`main.ts` (Node 22, standard library only) renders a 1024×1024 PNG from a
framebuffer with its own drawing primitives and a 5×7 bitmap font: no image
assets, no network, fully deterministic. Six panels sum up the day as
reported around the world:

- **Gulf** — Iran strikes Kuwait and Bahrain hours after US jets hit a missile site on Qeshm Island.
- **Ukraine** — Ukraine hits the Kerch Bridge for a second day and part of its road span collapses into the strait.
- **China** — Xi meets Putin in Shenzhen ahead of Thursday's first US–China–Russia trilateral summit.
- **Gaza** — Trump's Board of Peace faults both Israel and Hamas for failing to meet their ceasefire commitments.
- **Pacific** — Category 5 Cyclone Xavier hits the Northern Cook Islands with gusts to 315 km/h.
- **Tech** — Nvidia posts a record $115.8 billion quarter, its first results since Jensen Huang resigned; the board rejects his return.

A footer ticker adds the day's other stories: the WHO keeping the Ebola
emergency in DR Congo as cases pass 11,000, a 6.0 quake in Papua New Guinea,
Trump meeting Marcos before his China trip, and Myanmar reviewing its ASEAN ties.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes the poster to `out/entry.png` (in the grader, `/output/entry.png`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=mq95vk6b&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
