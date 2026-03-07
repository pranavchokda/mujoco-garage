import loadMujoco from 'mujoco-js';

// Minimal MJCF model: a ball with a free joint falling onto a plane
const MODEL_XML = `
<mujoco>
  <worldbody>
    <light diffuse=".5 .5 .5" pos="0 0 3" dir="0 0 -1"/>
    <geom type="plane" size="1 1 0.1" rgba=".9 .9 .9 1"/>
    <body pos="0 0 1">
      <joint type="free"/>
      <geom type="sphere" size="0.1" rgba="0 .9 0 1"/>
    </body>
  </worldbody>
</mujoco>
`;

const mujoco = await loadMujoco();

mujoco.FS.writeFile('simulation.xml', MODEL_XML);
const model = mujoco.MjModel.loadFromXML('simulation.xml');
const data  = new mujoco.MjData(model);

console.log(`Model loaded — ${model.nq} generalized coordinates`);
console.log('Step | Time (s)  | Ball Z');
console.log('-----|-----------|-------');

for (let i = 0; i < 100; i++) {
  mujoco.mj_step(model, data);
  if (i % 10 === 0) {
    console.log(
      `${String(i).padEnd(4)} | ${data.time.toFixed(3).padEnd(9)} | ${data.qpos[2].toFixed(4)}`
    );
  }
}

// Free C-side memory (no GC for WASM objects)
model.delete();
data.delete();
