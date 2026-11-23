# Property Viewer

A web-based 3D real estate viewer. Buyers open a link on a phone or desktop, orbit a 3D exterior of the building (from a drone-video Gaussian splat), tap a unit, and walk through the interior (from a walkthrough-video splat).

Every property is **data, not code**: a folder under `public/projects/<projectId>/` holding a `project.json` and the splat files. The app picks the project from the URL hash, e.g. `https://viewer.example.com/#demo-project`.

---

## 1. Setup

Requires Node 20+ (developed on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173/#demo-project
npm run dev:lan      # same, exposed on your LAN for testing on a phone
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ locally
npm run lint         # ESLint
npm run format       # Prettier
```

All dependency versions are pinned exactly (`.npmrc` has `save-exact=true`).

The demo project ships **without** splat files. The app detects that and renders a procedural building and apartment instead, so it always runs. Drop real `.ply` files into place (see `public/projects/demo-project/README.txt`) and they load instead.

**URL options**

| URL                  | Effect                                              |
| -------------------- | --------------------------------------------------- |
| `/#my-project`       | Load `public/projects/my-project/project.json`      |
| `/?debug#my-project` | Same, plus the debug panel, helpers and FPS meter   |
| `/#my-project?debug` | Also works (handy when the link already has a hash) |
| `/` (no hash)        | Loads `demo-project`                                |

---

## 2. Folder structure

```
public/projects/<projectId>/   project.json + splat files (one folder per property)
src/
  config/     project.json schema (zod), loader, transform helpers
  state/      Zustand store, project loader hook
  scene/      R3F scene: Experience (Canvas), camera director, placeholders, hotspots
    splat/    SplatScene interface + the gaussian-splats-3d adapter (the only library-specific code)
  controls/   first-person walker, collision, room detection, exterior orbit controls
  ui/         HTML overlay: top bar, unit card, room bar, help, loading/error screens, CSS
  debug/      leva panel, helpers, camera HUD (lazy-loaded only with ?debug)
```

### Swapping the splat library

The app only ever talks to the `SplatScene` interface (`src/scene/splat/SplatScene.ts`). To move to another renderer (e.g. Spark):

1. Write `src/scene/splat/SparkAdapter.ts` implementing `SplatScene`. Its `object3D` must honour its parent's world transform, because the config transform is applied to a wrapper group.
2. Return it from `createSplatScene()` in `src/scene/splat/createSplatScene.ts`.
3. Remove `@mkkellogg/gaussian-splats-3d` and `GaussianSplats3DAdapter.ts`.

Nothing else changes.

---

## 3. Adding a new project

1. Create `public/projects/<projectId>/` (letters, numbers, `-`, `_`).
2. Add the splat files, e.g. `exterior.ply` and `units/<unitId>/interior.ply`.
3. Write `project.json` (copy the demo one as a starting point).
4. Open `/?debug#<projectId>`, align everything (section 5), and paste the values back.

If `project.json` is invalid, the app shows the exact field and problem on screen.

### Conventions

- **Units:** metres. Y is up. Three.js right-handed axes.
- **Rotations** in config are Euler angles in **degrees** (order XYZ).
- **Yaw** is in **degrees** around +Y. `0` looks toward −Z. Positive turns left (counter-clockwise seen from above). `90` looks toward −X, `180` toward +Z, `-90` toward +X.
- **Floor-plan points** (spawn, rooms, collision boxes) are 2D `[x, z]` pairs. The walker's eye height is always `floorHeight + 1.6`.
- **Asset paths** are relative to the project folder. Supported formats: `.ply`, `.splat`, `.ksplat`, `.spz`.

### `project.json` reference

```jsonc
{
  "project": { "name": "…", "location": "…", "description": "…" },

  "exterior": {
    "splat": "exterior.ply",
    "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": 1 }, // scale: number or [x,y,z]
    "camera": {
      "position": [40, 24, 44], // initial camera
      "target": [0, 15, 0], // orbit centre
      "minDistance": 18,
      "maxDistance": 110, // zoom limits (m)
      "minPolarAngle": 20,
      "maxPolarAngle": 85, // pitch limits (deg from straight up)
    },
    "hotspots": [{ "unitId": "a-704", "position": [0, 24, 7.6], "label": "Residence 704" }],
  },

  "units": [
    {
      "id": "a-704",
      "name": "Residence 704",
      "type": "2BHK",
      "areaSqFt": 861,
      "floor": 7,
      "status": "available", // available | sold | on-hold
      "interior": {
        "splat": "units/a-704/interior.ply",
        "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": 1 },
        "floorHeight": 0, // Y of the walkable floor after the transform
        "ceilingHeight": 2.7, // only used for placeholder walls + debug wireframes
        "spawn": { "position": [-3.8, -2.8], "yaw": -130 },
        "rooms": [
          {
            "name": "Kitchen",
            "position": [1.8, -3.2],
            "yaw": -135, // where the room shortcut takes you
            "bounds": { "min": [1, -4], "max": [5, 0] }, // optional; drives the "current room" label
          },
        ],
        "collision": [{ "min": [0.925, -4], "max": [1.075, -2.5] }], // axis-aligned boxes, [x, z]
      },
    },
  ],
}
```

Hotspot colours: available = green, on hold = amber, sold = grey.

**Current room** is the room whose `bounds` contain the walker. If no room has bounds, it is the nearest room `position`.

---

## 4. Turning video into a splat

### Capturing

**Exterior (drone)**

- Fly 2–3 full orbits around the building at different heights (e.g. podium, mid-height, roof), camera pointed at the building, 60–80% overlap between frames.
- Shoot in flat, overcast light if possible. Hard shadows and sun glare bake in.
- Use 4K at 30 fps, locked exposure and white balance, and slow, steady motion.

**Interior (phone or gimbal)**

- Walk slowly through every room at chest height. In each room, do a slow 360° turn along the walls, plus a second pass at a lower height.
- Turn all lights on, open the doors, and lock exposure, focus and white balance.
- Avoid people, pets, moving curtains, and pointing straight at mirrors or bright windows.
- 4K at 30 fps; 2–5 minutes per apartment is typical.

### Quick results (cloud, minutes to an hour)

- **Polycam** (web or app): create a _Gaussian Splat_ capture, upload the video, then export as `.ply`.
- **Luma AI**: upload the video as an interactive scene, then download the Gaussian splat `.ply`. Luma's capture product has changed over time; check that splat export is still offered.

### Higher quality (local GPU)

- **Jawset Postshot** (Windows, NVIDIA GPU): import the video directly, train (start with the default profile, then raise the splat budget), and export `.ply`. The easiest route to high quality.
- **nerfstudio** (Linux or Windows, NVIDIA GPU):

  ```bash
  ns-process-data video --data walkthrough.mp4 --output-dir processed/   # COLMAP camera poses
  ns-train splatfacto --data processed/                                   # or splatfacto-big
  ns-export gaussian-splat --load-config outputs/…/config.yml --output-dir export/
  ```

### Cleanup and compression (recommended)

1. Open the `.ply` in **SuperSplat** (PlayCanvas's free browser editor). Delete floaters, sky and neighbouring buildings, crop interiors at the walls, and roughly level the scene. Export `.ply`.
2. Optionally convert to `.ksplat` for smaller and faster loads, using the converter in the GaussianSplats3D repo:
   `node util/create-ksplat.js in.ply out.ksplat 1` (compression level 1).
   `.spz` is also supported.
3. Budget for phones: aim for roughly **≤1.5 M splats** per scene. Interiors are loaded one at a time, and on mobile the exterior is freed while you are inside a unit.

---

## 5. Aligning splats with the debug panel

Splats from different videos come out at arbitrary positions, rotations and scales. Open `/?debug#<projectId>`. The **Splat transform** folder edits whichever splat is on screen: the exterior, or the current unit's interior once you've entered it.

**Interior**

1. **Level it.** Turn on _axes/grid_. Adjust rotation X/Z until the floor sits flush with the grid, then rotate Y so the walls run along the grid lines (axes: X orange, Y green, Z blue).
2. **Scale it.** Splats from video have no real-world scale. Each grid square is 1 m. Use a known dimension, such as a 2.1 m door or the floor-plan width of a room. Uniform scale is locked by default; click the lock to edit axes separately.
3. **Position it.** Move the floor to `y = floorHeight` (usually 0) and line the walls up with the collision boxes (blue wireframes).
4. **Copy config** copies the transform plus `cameraHere` (your current `[x, z]` and yaw). Paste `interior.transform` into the unit, and use `cameraHere` as the `spawn` or as a room's `position`/`yaw`. The HUD at the bottom left shows the live camera position and yaw.

**Exterior**

1. Same idea: level the ground, scale using a known dimension (e.g. a floor-to-floor height of about 3.2 m), and centre the building near the origin.
2. Orbit to the view buyers should land on, then **Copy config**. Its `camera.position` / `camera.target` are the initial view.

**Placing hotspots.** In debug mode only, panning is enabled (right-drag or two-finger drag). A dark marker shows the orbit target. Pan and orbit until the marker sits on the unit's facade or balcony, then **Copy config**. `camera.target` is the hotspot `position`.

Transforms are applied to a wrapper object, so changes show instantly with no reload. Nothing is saved automatically; reload the page to discard changes.

---

## 6. Defining collision boxes from a floor plan

The walker is a circle of radius **0.25 m** that slides along axis-aligned boxes.

1. **Pick an origin and axes on the plan.** Use x to the right and z _down_ the page; that matches a top-down view in three.js. A corner or the centre of the apartment works well as the origin.
2. **Convert to metres** (1 ft = 0.3048 m) and read each wall's rectangle: `{ "min": [x1, z1], "max": [x2, z2] }`. A 15 cm wall on the line x = 1 from z = −4 to −2.5 becomes `{ "min": [0.925, -4], "max": [1.075, -2.5] }`.
3. **Leave door gaps**: split a wall into two boxes around each door. Gaps should be at least 0.8 m (the player is 0.5 m wide).
4. Optionally add **furniture** you don't want people walking through (kitchen island, bed) as extra boxes. The placeholder draws every box as a full-height wall, but with a real splat the boxes are invisible.
5. Add each room's `bounds` from the same plan, so the current-room label works.
6. Check in `?debug`. The blue wireframes are the collision boxes, the green outlines are room bounds, and the cones are spawn/room cameras pointing along their yaw. Then align the interior splat to them (section 5).

Diagonal or curved walls: approximate them with a few small boxes.

---

## 7. Hosting

`npm run build` produces a static site in `dist/` with relative paths, so it can be served from any folder or CDN. Notes:

- Serve splat files with a correct `Content-Length` so the loading bar can show a percentage. Without it, the bar is indeterminate.
- Large splats are better on a CDN or Git LFS than in git. Patterns to uncomment are in `.gitignore`.
- Optional: serving with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` enables `SharedArrayBuffer`, which makes splat sorting a little faster. The app detects it and works without it.

---

## 8. Design notes

- **Transitions:** the camera flies toward the unit's hotspot and the screen fades to white. The interior then loads (behind the loading screen if needed), and the camera eases into the spawn point. Going back reverses this and restores the exact orbit view the buyer left from.
- **Exterior splat on mobile:** the exterior is disposed while inside a unit and reloaded on exit, because two splats in GPU memory is too much for many phones. Desktop keeps it loaded (hidden) so going back is instant.
- **Pixel ratio** is capped at 2 on desktop and 1.5 on mobile. MSAA is off on mobile.
- **Look direction** uses "grab the world" dragging (like Street View): drag left to look right. This feels natural on touch, and desktop uses the same rule for consistency. Change it in `FirstPersonControls.tsx` if you prefer the opposite.
- **Room shortcuts** fly straight to the saved camera, ignoring walls (they are animated teleports). Tap-to-move and keyboard walking always collide.
# Three_D
