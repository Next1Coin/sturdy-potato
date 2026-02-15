# sturdy-potato

A browser-based airplane flying simulator with:

- Flight dynamics (throttle, lift, drag, gravity, stall behavior)
- Core controls (pitch, roll, yaw, throttle, air brake)
- Mission objectives (fly through waypoints, return and land)
- HUD and tactical map
- Crash and mission-complete states

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- `W` / `S`: pitch down/up
- `A` / `D`: roll left/right
- `Q` / `E`: yaw left/right
- `Arrow Up` / `Arrow Down`: throttle up/down
- `Space`: air brake
- `R`: reset simulation
