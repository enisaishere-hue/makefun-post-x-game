# AGENT.md — post-x-the-agent-builds-a-game-from-20261122-1709

Build the entry for the make.fun bounty "The agent builds a game from one
prompt" (closes 25 Nov 2026 00:09 WIB; $20 total, 1st place $7).

## The task (from the bounty's RULES.txt)

Make a short video about an AI coding agent building a tiny browser game from
one prompt while the user watches, post it on X as a native video from a
public account, and hand the post in. The brief: show the prompt, the agent
working, and the finished game in one short clip. Keep it moving, show the
real result, and end on the game running with the call to come build on
make.fun. Places go by the post's score: views + 10 × (likes + reposts +
quotes + replies), read through FxTwitter after the deadline.

## What this repository holds

- `game/` — Orbit Blaster 3D, the tiny 3D browser game the agent built from
  one prompt: Three.js/WebGL, playable, with trauma shake, hit-stop, squash
  & stretch and particles. `?demo=1` autopilot plays it; `?capture=1`
  steps it deterministically for recording.
- `video/orbit-blaster-3d-x-video.mp4` — the 30.5 s, 1920×1080, 30 fps clip
  for X: the prompt (0–5 s), the agent working (5–10 s), real gameplay
  (10–28 s), then make.fun's referral end card from the press pack
  (16:9 transparent webm, used as-is) with referral code `m5sysagx` typed
  into its field, over a held last frame. Brand badge overlays 0–28 s.
  Rendered with ffmpeg from headless-captured gameplay frames. No audio.
- `POST.json` — the post's address. **PLACEHOLDER, NOT FINAL**: replace
  with the real `https://x.com/<handle>/status/<id>` before submitting.
- `main.ts` — Node 22, stdlib only: validates and copies POST.json to
  /output/POST.json. That is all the program does.
- `.makefun/owner.json` — claim file naming the payout wallet.

## The X post (for the person posting from their phone)

Video file: `video/orbit-blaster-3d-x-video.mp4`. Post it as a native video
from the public @FoxiZK account, between the opening (22 Nov 2026 17:09 UTC)
and the deadline (24 Nov 2026 17:09 UTC). Paste this text exactly:

```
My AI agent built a 3D game from ONE prompt — watch it play. 🚀
Made by my AI agent for a $20 bounty on @makefunai: https://make.fun/bounty/post-x-the-agent-builds-a-game-from-20261122-1709
makefun-boulder-ink-reef
```

Then put the post's URL into `POST.json` and submit. Keep the post up and
the account public until the results are out (due 8 Dec 2026).
