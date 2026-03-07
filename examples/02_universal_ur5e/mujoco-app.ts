import loadMujoco from 'mujoco-js';
import type { MainModule, MjModel, MjData } from 'mujoco-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const REPO_BASE =
  'https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/universal_robots_ur5e/';

const ASSET_FILES = [
  'scene.xml',
  'ur5e.xml',
  'assets/base_0.obj',
  'assets/base_1.obj',
  'assets/shoulder_0.obj',
  'assets/shoulder_1.obj',
  'assets/shoulder_2.obj',
  'assets/upperarm_0.obj',
  'assets/upperarm_1.obj',
  'assets/upperarm_2.obj',
  'assets/upperarm_3.obj',
  'assets/forearm_0.obj',
  'assets/forearm_1.obj',
  'assets/forearm_2.obj',
  'assets/forearm_3.obj',
  'assets/wrist1_0.obj',
  'assets/wrist1_1.obj',
  'assets/wrist1_2.obj',
  'assets/wrist2_0.obj',
  'assets/wrist2_1.obj',
  'assets/wrist2_2.obj',
  'assets/wrist3.obj',
];

const MJ_GEOM_MESH = 7;

export class MujocoApp {
  private mujoco!: MainModule;
  private model!: MjModel;
  private data!: MjData;
  private canvas: HTMLCanvasElement;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private mujocoRoot!: THREE.Group;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private geomMeshes = new Map<number, THREE.Mesh>();
  private tmpMat4 = new THREE.Matrix4();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    const statusEl = document.getElementById('status');
    const setStatus = (msg: string) => { if (statusEl) statusEl.textContent = msg; };

    setStatus('Loading MuJoCo WASM...');
    this.mujoco = await loadMujoco();

    // Prepare Virtual File System
    try { this.mujoco.FS.mkdir('/assets'); } catch (_) {}

    setStatus('Downloading UR5e model assets...');
    await Promise.all(
      ASSET_FILES.map(async (file) => {
        const res = await fetch(`${REPO_BASE}${file}`);
        if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
        this.mujoco.FS.writeFile(`/${file}`, new Uint8Array(await res.arrayBuffer()));
      })
    );

    setStatus('Building model...');
    this.model = this.mujoco.MjModel.loadFromXML('/scene.xml');
    this.data = new this.mujoco.MjData(this.model);

    this.mujoco.mj_forward(this.model, this.data);

    setStatus('Setting up renderer...');
    this.setupThree();
    this.buildGeomMeshes();
    this.buildUI();

    if (statusEl) statusEl.remove();
    this.loop();
  }

  // ---------------------------------------------------------------------------
  // Three.js setup
  // ---------------------------------------------------------------------------

  private setupThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e3260);
    this.scene.fog = new THREE.Fog(0x1e3260, 10, 25);

    // MuJoCo uses Z-up. Rotate a root group -90° around X so the scene
    // appears Y-up in Three.js without touching any MuJoCo transforms.
    this.mujocoRoot = new THREE.Group();
    this.mujocoRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.mujocoRoot);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
    this.camera.position.set(2.0, 1.5, 2.0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0.6, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    this.mujocoRoot.add(new THREE.HemisphereLight(0x88bbff, 0x445566, 1.2));

    const key = new THREE.DirectionalLight(0xffffff, 4.0);
    key.position.set(2, 2, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 15;
    key.shadow.camera.top = 2;
    key.shadow.camera.bottom = -0.5;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.bias = -0.001;
    this.mujocoRoot.add(key);

    const fill = new THREE.DirectionalLight(0x66aaff, 1.4);
    fill.position.set(-3, 0, 2);
    this.mujocoRoot.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.0);
    rim.position.set(0, -2, -3);
    this.mujocoRoot.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a3f66, roughness: 0.7, metalness: 0.1 })
    );
    ground.receiveShadow = true;
    this.mujocoRoot.add(ground);

    const grid = new THREE.GridHelper(12, 24, 0x5577cc, 0x334488);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.001;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.7;
    this.mujocoRoot.add(grid);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ---------------------------------------------------------------------------
  // Build Three.js meshes from MuJoCo model mesh data
  // ---------------------------------------------------------------------------

  private buildGeomMeshes() {
    const model = this.model;
    const matCache = new Map<number, THREE.MeshStandardMaterial>();

    const getMaterial = (geomIdx: number): THREE.MeshStandardMaterial => {
      const matId = model.geom_matid[geomIdx];

      if (matId >= 0) {
        if (matCache.has(matId)) return matCache.get(matId)!;
        const r = Math.min(1, model.mat_rgba[matId * 4 + 0] * 1.8);
        const g = Math.min(1, model.mat_rgba[matId * 4 + 1] * 1.8);
        const b = Math.min(1, model.mat_rgba[matId * 4 + 2] * 1.8);
        const color = new THREE.Color(r, g, b);
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const mat = new THREE.MeshStandardMaterial({
          color,
          metalness: luminance < 0.2 ? 0.7 : 0.5,
          roughness: luminance < 0.2 ? 0.3 : 0.25,
          envMapIntensity: 1.5,
        });
        matCache.set(matId, mat);
        return mat;
      }

      const r = Math.min(1, model.geom_rgba[geomIdx * 4 + 0] * 1.8);
      const g = Math.min(1, model.geom_rgba[geomIdx * 4 + 1] * 1.8);
      const b = Math.min(1, model.geom_rgba[geomIdx * 4 + 2] * 1.8);
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(r, g, b),
        metalness: 0.5,
        roughness: 0.3,
      });
    };

    for (let g = 0; g < model.ngeom; g++) {
      if (model.geom_type[g] !== MJ_GEOM_MESH) continue;
      const meshId = model.geom_dataid[g];
      if (meshId < 0) continue;

      const vStart = model.mesh_vertadr[meshId];
      const vCount = model.mesh_vertnum[meshId];
      const fStart = model.mesh_faceadr[meshId];
      const fCount = model.mesh_facenum[meshId];

      const positions = Float32Array.from(
        { length: vCount * 3 },
        (_, i) => model.mesh_vert[vStart * 3 + i]
      );
      const indices = Uint32Array.from(
        { length: fCount * 3 },
        (_, i) => model.mesh_face[fStart * 3 + i]
      );

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, getMaterial(g));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.mujocoRoot.add(mesh);
      this.geomMeshes.set(g, mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Joint control UI
  // ---------------------------------------------------------------------------

  private buildUI() {
    const model = this.model;
    const nu = model.nu;
    if (nu === 0) return;

    const panel = document.createElement('div');
    panel.id = 'joint-panel';
    panel.innerHTML = '<b>UR5e Joints</b>';

    for (let i = 0; i < nu; i++) {
      const nameAdr = model.name_actuatoradr[i];
      let name = '';
      for (let c = nameAdr; model.names[c] !== 0; c++) {
        name += String.fromCharCode(model.names[c]);
      }

      const row = document.createElement('div');
      row.className = 'joint-row';

      const header = document.createElement('div');
      header.className = 'joint-label';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = name || `joint_${i}`;

      const valSpan = document.createElement('span');
      valSpan.className = 'joint-val';
      valSpan.textContent = '0.00';

      header.appendChild(nameSpan);
      header.appendChild(valSpan);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '-3.14';
      slider.max = '3.14';
      slider.step = '0.01';
      slider.value = '0';

      const idx = i;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        this.data.ctrl[idx] = v;
        valSpan.textContent = v.toFixed(2);
      });

      row.appendChild(header);
      row.appendChild(slider);
      panel.appendChild(row);
    }

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'reset-btn';
    resetBtn.addEventListener('click', () => {
      this.mujoco.mj_resetData(this.model, this.data);
      this.mujoco.mj_forward(this.model, this.data);
      panel.querySelectorAll('input[type=range]').forEach((el) => {
        (el as HTMLInputElement).value = '0';
      });
      panel.querySelectorAll('.joint-val').forEach((el) => {
        el.textContent = '0.00';
      });
    });
    panel.appendChild(resetBtn);

    document.body.appendChild(panel);
  }

  // ---------------------------------------------------------------------------
  // Per-frame: sync Three.js meshes with MuJoCo geom world transforms
  // ---------------------------------------------------------------------------

  private updateGeomTransforms() {
    const xpos = this.data.geom_xpos;
    const xmat = this.data.geom_xmat;

    for (const [g, mesh] of this.geomMeshes) {
      const p = g * 3;
      const m = g * 9;

      mesh.position.set(xpos[p], xpos[p + 1], xpos[p + 2]);

      this.tmpMat4.set(
        xmat[m + 0], xmat[m + 1], xmat[m + 2], 0,
        xmat[m + 3], xmat[m + 4], xmat[m + 5], 0,
        xmat[m + 6], xmat[m + 7], xmat[m + 8], 0,
        0, 0, 0, 1
      );
      mesh.quaternion.setFromRotationMatrix(this.tmpMat4);
    }
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  private loop() {
    for (let i = 0; i < 5; i++) {
      this.mujoco.mj_step(this.model, this.data);
    }

    this.updateGeomTransforms();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }
}
