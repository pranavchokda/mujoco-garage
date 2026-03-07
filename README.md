# MuJoCo Garage

Interactive browser-based robotics simulations powered by [MuJoCo](https://mujoco.org/) (via WebAssembly) and rendered with [Three.js](https://threejs.org/).

**Live site:** https://pranavchokda.github.io/mujoco-garage/

---

## Examples

### 02 — Universal Robots UR5e

**Live demo:** https://pranavchokda.github.io/mujoco-garage/examples/02_universal_ur5e/

An interactive, physics-accurate simulation of the [Universal Robots UR5e](https://www.universal-robots.com/products/ur5-robot/) 6-DOF robotic arm, running entirely in the browser with no server-side computation.

#### What it does

- Loads the UR5e model directly from [Google DeepMind's MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) — a curated library of high-quality robot models
- Runs a real MuJoCo physics simulation (WASM) in the browser at each animation frame
- Renders the robot using Three.js with shadow mapping and cinematic lighting
- Provides a live joint control panel so you can pose the arm interactively

#### Components

| File | Role |
|------|------|
| [main.ts](examples/02_universal_ur5e/main.ts) | Entry point — creates the canvas, instantiates `MujocoApp`, and handles top-level errors |
| [mujoco-app.ts](examples/02_universal_ur5e/mujoco-app.ts) | Core application class — all physics, rendering, and UI logic |
| [style.css](examples/02_universal_ur5e/style.css) | Full-screen canvas layout, loading overlay, and joint control panel styles |
| [index.html](examples/02_universal_ur5e/index.html) | HTML shell — loads the service worker and the app entry point |
| [public/coi-serviceworker.js](examples/02_universal_ur5e/public/coi-serviceworker.js) | Service worker that injects COOP/COEP headers so SharedArrayBuffer/WASM works on GitHub Pages |
| [vite.demo.config.ts](examples/02_universal_ur5e/vite.demo.config.ts) | Vite config for dev server (with COOP/COEP headers) and production build |

#### How `mujoco-app.ts` works

**`init()`** — async startup sequence:
1. Loads the MuJoCo WASM module (`mujoco-js`)
2. Creates a virtual filesystem inside WASM (`FS.mkdir`, `FS.writeFile`)
3. Fetches the UR5e scene XML and all `.obj` mesh assets from GitHub in parallel
4. Parses the model with `MjModel.loadFromXML` and allocates simulation state with `MjData`
5. Runs `mj_forward` once to compute the initial world transforms
6. Sets up Three.js, builds geometry, and creates the UI panel

**`setupThree()`** — Three.js scene:
- Full-screen `WebGLRenderer` with shadow maps, ACES filmic tone mapping, and anti-aliasing
- A root `THREE.Group` rotated −90° around X to convert MuJoCo's Z-up convention to Three.js Y-up
- Three-point lighting rig (key, fill, rim) plus a hemisphere light for ambient
- A ground plane and semi-transparent grid for spatial reference
- `OrbitControls` for mouse/touch camera navigation with damping

**`buildGeomMeshes()`** — geometry bridge:
- Iterates every geom in the MuJoCo model; skips non-mesh geoms
- Reads raw vertex positions and face indices directly from MuJoCo's internal buffers (`mesh_vert`, `mesh_face`)
- Uploads them to a `THREE.BufferGeometry` and computes smooth vertex normals
- Derives `MeshStandardMaterial` colours from MuJoCo's material/geom RGBA arrays, with metalness and roughness tuned by luminance

**`buildUI()`** — joint control panel:
- Reads actuator names from MuJoCo's `names` byte array
- Creates a slider (−π to +π rad) per actuator, writing directly to `data.ctrl`
- "Reset" button calls `mj_resetData` + `mj_forward` and zeroes all sliders

**`loop()`** — render loop (via `requestAnimationFrame`):
1. Steps the simulation 5× per frame (`mj_step`) for smoother physics at 60 fps
2. Syncs every Three.js mesh position and rotation from `data.geom_xpos` / `data.geom_xmat`
3. Updates orbit controls damping and renders the scene

---

## Running locally

```sh
npm install
./dev.sh start   # starts the Vite dev server at http://localhost:5173
./dev.sh stop    # stops it
```

`dev.sh` runs the dev server in the background and tracks the process via `.dev.pid`.

## Building for production

```sh
npm run build:ur5e  # outputs to dist/examples/02_universal_ur5e/
```

Deployment to GitHub Pages is automated via `.github/workflows/deploy.yml` on every push to `main`.

---

## References & Thanks

- **[MuJoCo](https://mujoco.org/)** — DeepMind's physics engine, now open source. The core simulator running in the browser via WebAssembly.
- **[mujoco-js](https://github.com/zalo/mujoco-js)** — WebAssembly port of MuJoCo that makes browser-based simulation possible.
- **[MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie)** — Google DeepMind's collection of high-quality robot models. The UR5e model and all mesh assets are sourced from here.
- **[Universal Robots](https://www.universal-robots.com/)** — Creators of the UR5e 6-DOF collaborative robot arm featured in example 02.
- **[Three.js](https://threejs.org/)** — 3D rendering library used for the WebGL scene, lighting, and camera controls.
- **[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)** — Guido Zuidhof's service worker trick that enables SharedArrayBuffer on GitHub Pages by injecting COOP/COEP headers client-side.
- **[Claude](https://claude.ai/) by [Anthropic](https://www.anthropic.com/)** — AI assistant that helped with this project.

---

## Licenses & Attribution

| Component | License | Notes |
|-----------|---------|-------|
| [mujoco-js](https://github.com/google-deepmind/mujoco) | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | © Google DeepMind |
| [Three.js](https://threejs.org/) | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | © 2010–2025 three.js authors |
| [MuJoCo Menagerie — UR5e model](https://github.com/google-deepmind/mujoco_menagerie/tree/main/universal_robots_ur5e) | [BSD-3-Clause](https://github.com/google-deepmind/mujoco_menagerie/blob/main/universal_robots_ur5e/LICENSE) | © Universal Robots; assets fetched at runtime, not bundled |
| [coi-serviceworker concept](https://github.com/gzuidhof/coi-serviceworker) | [MIT](https://github.com/gzuidhof/coi-serviceworker/blob/master/LICENSE) | Original concept by Guido Zuidhof; `public/coi-serviceworker.js` is an independent implementation |
| Project source code | MIT | © mujoco-garage contributors |
