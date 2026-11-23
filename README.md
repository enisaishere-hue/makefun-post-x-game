# Orbit Blaster 3D — one prompt, one agent, one game

[![make.fun · post-x-the-agent-builds-a-game-from-20261122-1709](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)
[![rank](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709/enisaishere-hue/makefun-post-x-game/rank.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)
[![reward](https://make.fun/badge/post-x-the-agent-builds-a-game-from-20261122-1709/enisaishere-hue/makefun-post-x-game/reward.svg)](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709?utm_source=github&utm_medium=readme&utm_campaign=post-x-the-agent-builds-a-game-from-20261122-1709)

Entry for the make.fun bounty **[The agent builds a game from one prompt](https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709)**: my AI agent built a tiny 3D browser game from a single prompt while I watched — and the video of it is the entry.

> **The prompt:** "Build me a tiny 3D space shooter I can play in the browser."

## The game

**Orbit Blaster 3D** (`game/`) is a playable Three.js space shooter: steer the ship, blast asteroids, chain combos, grab stars. Open `game/index.html` in a browser (or serve the folder) and play:

- **← → / A D** or mouse to steer, **Space** or click to fire, **R** toggles reduce-shake.
- **?demo=1** runs the autopilot, which plays the game by itself — that is how the gameplay in the video was recorded.
- **?capture=1** steps the game deterministically (1/30 s per step) for frame-perfect recording.

The game has real game feel, not just motion: trauma-based screen shake (`shake = trauma²`, summed sines on the camera only, decaying in real time), hit-stop on a real-time timer owned by the newest hit, squash & stretch that always returns exactly to its rest scale, and particle bursts in three tiers (small 0.15 / medium 0.40 + 0.05 s stop / large 0.85 + 0.12 s stop). Verified headless: 14/14 checks pass — overlapping hit-stops restore time scale to 1.0, trauma decays to 0, every scale tween ends at its rest value, and the demo survives and scores (see `test-juice.mjs` in the build folder).

## The video

`video/orbit-blaster-3d-x-video.mp4` (1920×1080, 30 fps, 30.5 s, no audio) is the clip for the X post: the prompt, the agent working, 18 seconds of real gameplay, and it ends with make.fun's referral end card from the press pack, carrying my referral code. The clip was rendered with ffmpeg from the recorded gameplay frames — no AI video generator was used.

## The entry

`POST.json` holds the address of the X post carrying the video. **`POST.json` currently holds the starter placeholder — it is NOT final: it must be replaced with the real post URL (`https://x.com/<handle>/status/<id>`) before this entry is submitted.** `main.ts` (Node 22, standard library only) copies `POST.json` to `/output/POST.json`, which is all the program has to do; the house reads the post itself from X.

Run it locally:

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Build on make.fun

make.fun is where people and their AI agents build things, enter paid bounties and earn real money. Come build with your own agent — join with my referral code **m5sysagx**: https://make.fun/r/m5sysagx

## License

MIT — see `LICENSE`.
