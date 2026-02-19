
/*
Run:
  npm install
  npm run dev
*/

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import GUI from "lil-gui";

const Y_MIN = -4.5;
const Y_MAX = 4.5;

const NET_MODES = {
  "Men (2.43m top, 1.43m bottom)": { top: 2.43, bottom: 1.43 },
  "Women (2.24m top, 1.24m bottom)": { top: 2.24, bottom: 1.24 },
};

const ZONE_COLORS = {
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  red: 0xe74c3c,
  neutral: 0x8fa3ad,
};

const G = new THREE.Vector3(0, 0, -9.81);
const CAMERA_DEFAULT_POS = new THREE.Vector3(12, -10, 8);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 1);

const app = document.getElementById("app");
const debugEl = document.getElementById("debug");
const contactLabelEl = document.getElementById("contact-label");

const legendEl = document.createElement("div");
legendEl.style.position = "absolute";
legendEl.style.top = "12px";
legendEl.style.right = "12px";
legendEl.style.padding = "10px 12px";
legendEl.style.background = "rgba(8,12,14,0.78)";
legendEl.style.color = "#e9f1f5";
legendEl.style.border = "1px solid rgba(255,255,255,0.2)";
legendEl.style.borderRadius = "8px";
legendEl.style.fontSize = "12px";
legendEl.style.lineHeight = "1.4";
legendEl.style.zIndex = "12";
legendEl.innerHTML = [
  `<b>Contact Quality Zones</b>`,
  `<span style="color:#2ecc71">Green</span> = best contact (straight arm, high contact)`,
  `<span style="color:#f1c40f">Yellow</span> = usable contact`,
  `<span style="color:#e74c3c">Red</span> = difficult contact`,
  `<b>Goal:</b> maximize green time`,
].join("<br>");
app.appendChild(legendEl);

const spinPanelEl = document.createElement("div");
spinPanelEl.style.position = "absolute";
spinPanelEl.style.left = "12px";
spinPanelEl.style.bottom = "12px";
spinPanelEl.style.padding = "8px 10px";
spinPanelEl.style.background = "rgba(8,12,14,0.78)";
spinPanelEl.style.color = "#e9f1f5";
spinPanelEl.style.border = "1px solid rgba(255,255,255,0.2)";
spinPanelEl.style.borderRadius = "8px";
spinPanelEl.style.fontSize = "12px";
spinPanelEl.style.lineHeight = "1.35";
spinPanelEl.style.zIndex = "12";
app.appendChild(spinPanelEl);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1418);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 200);
camera.up.set(0, 0, 1);
camera.position.copy(CAMERA_DEFAULT_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CAMERA_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = 1.35;
controls.minDistance = 5;
controls.maxDistance = 60;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.zoomSpeed = 1.0;
controls.panSpeed = 1.0;
controls.rotateSpeed = 1.0;
controls.update();

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.shiftKey && event.button === 0) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  else controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
});

controls.addEventListener("change", () => {
  controls.target.z = Math.max(controls.target.z, 0.5);
  if (camera.position.z < 0.5) camera.position.z = 0.5;
});

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(10, -6, 14);
scene.add(sun);

const staticGroup = new THREE.Group();
const netGroup = new THREE.Group();
const dynamicGroup = new THREE.Group();
scene.add(staticGroup, netGroup, dynamicGroup);

const params = {
  netHeightMode: "Men (2.43m top, 1.43m bottom)",
  contactModel: "Single contact point",
  trajectoryControlMode: "Auto: reach contact point at chosen time",

  setterDistanceFromNet: -3.0,
  setterLateralPosition: 0.0,
  setterReleaseHeight: 2.3,

  hitterPreset: "Position 4",
  hitterDistanceFromNet: -0.8,
  hitterLateralPosition: 3.8,
  standingReachHeight: 2.35,
  jumpHeight: 0.7,

  singleTimeUntilContact: 0.55,
  contactTimeMarker: 0.55,

  launchSpeed: 12,
  launchElevationAngle: 45,
  launchDirectionLeftRight: 25,
  spinType: "Topspin",
  spinRateRps: 10,
  spinAxisTilt: 0,
  airDrag: true,
  magnusEffect: true,
  dragStrength: 0.012,
  magnusStrength: 0.0009,

  contactBandOffsetFromHitter: 0.2,
  contactBandWidth: 1.4,
  contactBandHeightRange: 0.6,
  contactBandThickness: 0.18,
  rainbowCurveAmount: 0.7,
  jumpTimingModel: true,
  timeToPeakJump: 0.25,
  totalAirTime: 0.6,
  timingAlignment: "Peak at contact",
  showJumpMotion: false,
  searchQuality: "Balanced",

  nominalTimeUntilContact: 0.55,
  timingTolerance: 0.08,
  hittingWindowSamples: 30,
  envelopeSampleFocus: "Balanced",

  landingAreaResolution: 60,
  trajectorySmoothness: 12,
  numberOfSpikePathsShown: 800,
  showPossibleSpikeSpace: true,
  show3DBoundaryStructure: false,
  showBlockedSpikePaths: false,

  numberOfBlockers: 2,
  blockShadeInside: 0.35,
  blockerGap: 0.05,
  handsWidthPerBlocker: 0.6,
  handsReachAboveNet: 0.5,
  pressOverNet: 0.15,
  pressOverAngle: 12,
  wristOverAmount: 8,
  handGap: 0.03,
  blockTiming: "Normal",
  blockReactionSpeed: 0.7,
  blockFollowsBall: true,
  followStrength: 0.25,
  followDelayMs: 120,

  pauseSpikeSpaceWhileAdjusting: true,
  cameraSensitivity: 1.0,
};

let currentContactLabelPoint = new THREE.Vector3(-0.8, 3.8, 3.1);
let poleVerticalCheck = new THREE.Vector3(0, 0, 1);
let pendingHeavyRebuild = null;
let blockerTrackY = clamp(params.hitterLateralPosition - Math.sign(params.hitterLateralPosition || 1) * params.blockShadeInside, -4.5, 4.5);
let lastRebuildTs = Date.now();
const uiControllers = { single: [], window: [] };
uiControllers.auto = [];
uiControllers.manual = [];
const controlRefs = {};
const autoTuneState = {
  running: false,
  status: "Idle",
  bestGreen: 0,
  baselineGreen: 0,
  improvement: 0,
  best: null,
  greenPointsCount: 0,
  candidatesTried: 0,
  validGreenCandidates: 0,
  failReasons: {},
  targetPoint: null,
};
const domeVisualDebug = {
  topZ: 0,
  maxVertexZ: 0,
  minVertexZ: 0,
  anchorOk: true,
};
let activeBandPivot = null;
let activeBandWindow = null;
let activeBandNominalTime = 0;
const sceneClock = new THREE.Clock();
let trajectoryLineMaterials = [];

const linspace = (a, b, n) => (n <= 1 ? [a] : Array.from({ length: n }, (_, i) => a + ((b - a) / (n - 1)) * i));

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
    });
  }
}

function makeLine(points, color, opacity = 1.0) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1.0, opacity })
  );
}

function makeThickLine2(points, color, widthMeters, opacity = 1.0) {
  if (!points || points.length < 2) return null;
  const flat = [];
  for (let i = 0; i < points.length; i++) flat.push(points[i].x, points[i].y, points[i].z);
  const geom = new LineGeometry();
  geom.setPositions(flat);
  const mat = new LineMaterial({
    color,
    linewidth: widthMeters,
    transparent: opacity < 1.0,
    opacity,
    worldUnits: true,
    depthTest: true,
    depthWrite: false,
  });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  trajectoryLineMaterials.push(mat);
  return new Line2(geom, mat);
}

function makeThickSegments2(points, color, widthMeters, opacity = 1.0) {
  if (!points || points.length < 2) return null;
  const flat = [];
  for (let i = 0; i < points.length; i++) flat.push(points[i].x, points[i].y, points[i].z);
  const geom = new LineSegmentsGeometry();
  geom.setPositions(flat);
  const mat = new LineMaterial({
    color,
    linewidth: widthMeters,
    transparent: opacity < 1.0,
    opacity,
    worldUnits: true,
    depthTest: true,
    depthWrite: false,
  });
  mat.resolution.set(window.innerWidth, window.innerHeight);
  trajectoryLineMaterials.push(mat);
  return new LineSegments2(geom, mat);
}

function drawStaticWorld() {
  clearGroup(staticGroup);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })
  );
  floor.position.set(0, 0, 0);
  staticGroup.add(floor);

  const z = 0.01;
  staticGroup.add(
    makeLine([
      new THREE.Vector3(-9, -4.5, z),
      new THREE.Vector3(-9, 4.5, z),
      new THREE.Vector3(9, 4.5, z),
      new THREE.Vector3(9, -4.5, z),
      new THREE.Vector3(-9, -4.5, z),
    ], 0xe7f0f5)
  );
  staticGroup.add(makeLine([new THREE.Vector3(0, -4.5, z), new THREE.Vector3(0, 4.5, z)], 0xff8a80));
  staticGroup.add(makeLine([new THREE.Vector3(-3, -4.5, z), new THREE.Vector3(-3, 4.5, z)], 0x6f8792));
  staticGroup.add(makeLine([new THREE.Vector3(3, -4.5, z), new THREE.Vector3(3, 4.5, z)], 0x6f8792));
}

function buildNetFabricLines(bottom, top) {
  const seg = [];
  for (let y = Y_MIN; y <= Y_MAX + 1e-6; y += 0.25) seg.push(new THREE.Vector3(0, y, bottom), new THREE.Vector3(0, y, top));
  for (let z = bottom; z <= top + 1e-6; z += 0.1) seg.push(new THREE.Vector3(0, Y_MIN, z), new THREE.Vector3(0, Y_MAX, z));

  const pos = new Float32Array(seg.length * 3);
  for (let i = 0; i < seg.length; i++) {
    pos[i * 3] = seg[i].x;
    pos[i * 3 + 1] = seg[i].y;
    pos[i * 3 + 2] = seg[i].z;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe5edf3, transparent: true, opacity: 0.78 }));
}

function drawNetSystem(modeLabel) {
  clearGroup(netGroup);
  const { top, bottom } = NET_MODES[modeLabel];

  netGroup.add(buildNetFabricLines(bottom, top));
  const topTape = new THREE.Mesh(new THREE.BoxGeometry(0.05, 9, 0.06), new THREE.MeshStandardMaterial({ color: 0xf9f9f9 }));
  topTape.position.set(0, 0, top);
  netGroup.add(topTape);

  const bottomBand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 9, 0.025), new THREE.MeshStandardMaterial({ color: 0xd2dae0 }));
  bottomBand.position.set(0, 0, bottom);
  netGroup.add(bottomBand);

  const poleGeom = new THREE.CylinderGeometry(0.045, 0.045, 2.55, 18);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7b7b7b });
  const py = 5.0;

  const poleL = new THREE.Mesh(poleGeom, poleMat);
  poleL.rotation.x = Math.PI / 2;
  poleL.position.set(0, -py, 1.275);
  netGroup.add(poleL);

  const poleR = new THREE.Mesh(poleGeom, poleMat);
  poleR.rotation.x = Math.PI / 2;
  poleR.position.set(0, py, 1.275);
  netGroup.add(poleR);

  netGroup.add(makeLine([new THREE.Vector3(0, -py, 2.55), new THREE.Vector3(0, -4.5, top)], 0xf4f7f9, 0.9));
  netGroup.add(makeLine([new THREE.Vector3(0, py, 2.55), new THREE.Vector3(0, 4.5, top)], 0xf4f7f9, 0.9));
  netGroup.add(makeLine([new THREE.Vector3(0, -py, bottom + 0.05), new THREE.Vector3(0, -4.5, bottom)], 0xcfd8dc, 0.9));
  netGroup.add(makeLine([new THREE.Vector3(0, py, bottom + 0.05), new THREE.Vector3(0, 4.5, bottom)], 0xcfd8dc, 0.9));

  const antGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.8, 12);
  const antMat = new THREE.MeshStandardMaterial({ color: 0xff3d3d });
  const ax = 0.012;

  const antL = new THREE.Mesh(antGeom, antMat);
  antL.rotation.x = Math.PI / 2;
  antL.position.set(ax, -4.5, top + 0.4);
  netGroup.add(antL);

  const antR = new THREE.Mesh(antGeom, antMat);
  antR.rotation.x = Math.PI / 2;
  antR.position.set(ax, 4.5, top + 0.4);
  netGroup.add(antR);

  poleVerticalCheck = new THREE.Vector3(0, 1, 0).applyQuaternion(poleL.getWorldQuaternion(new THREE.Quaternion()));
  return { netTop: top, netBottom: bottom };
}
function solveBallPathToContact(setterPoint, contactPoint, timeUntilContact) {
  const gravityTerm = G.clone().multiplyScalar(0.5 * timeUntilContact * timeUntilContact);
  return contactPoint.clone().sub(setterPoint).sub(gravityTerm).multiplyScalar(1 / timeUntilContact);
}

function sampleSetPath(setterPoint, launchVelocity, tEnd, dt = 0.005) {
  const points = [];
  const times = [];
  const steps = Math.max(2, Math.floor(tEnd / dt));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tEnd;
    const p = setterPoint.clone().add(launchVelocity.clone().multiplyScalar(t)).add(G.clone().multiplyScalar(0.5 * t * t));
    points.push(p);
    times.push(t);
  }
  return { points, times };
}

function velocityFromLaunchControls() {
  const elev = (params.launchElevationAngle * Math.PI) / 180;
  const dir = (params.launchDirectionLeftRight * Math.PI) / 180;
  const horizontal = params.launchSpeed * Math.cos(elev);
  return new THREE.Vector3(
    horizontal * Math.cos(dir),
    horizontal * Math.sin(dir),
    params.launchSpeed * Math.sin(elev)
  );
}

function velocityFromLaunchValues(speed, elevationDeg, directionDeg) {
  const elev = (elevationDeg * Math.PI) / 180;
  const dir = (directionDeg * Math.PI) / 180;
  const horizontal = speed * Math.cos(elev);
  return new THREE.Vector3(horizontal * Math.cos(dir), horizontal * Math.sin(dir), speed * Math.sin(elev));
}

function omegaVectorFromControls() {
  const mag = params.spinRateRps * 2 * Math.PI;
  const tilt = (params.spinAxisTilt * Math.PI) / 180;
  const sign = params.spinType === "Topspin" ? 1 : -1;
  const axis = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0).normalize();
  return axis.multiplyScalar(sign * mag);
}

function accelerationAt(v, omega) {
  const a = new THREE.Vector3(0, 0, -9.81);
  if (params.airDrag) {
    const speed = v.length();
    if (speed > 1e-6) a.add(v.clone().multiplyScalar(-params.dragStrength * speed));
  }
  if (params.magnusEffect) {
    a.add(omega.clone().cross(v).multiplyScalar(params.magnusStrength));
  }
  return a;
}

function integrateTrajectoryRK4(r0, v0, tEnd, dt, omega) {
  const points = [r0.clone()];
  const times = [0];
  const velocities = [v0.clone()];
  const magnusZ = [];

  let r = r0.clone();
  let v = v0.clone();
  let t = 0;

  while (t < tEnd - 1e-9) {
    const h = Math.min(dt, tEnd - t);

    const a1 = accelerationAt(v, omega);
    const k1r = v.clone();
    const k1v = a1.clone();

    const v2 = v.clone().add(k1v.clone().multiplyScalar(h / 2));
    const a2 = accelerationAt(v2, omega);
    const k2r = v2.clone();
    const k2v = a2.clone();

    const v3 = v.clone().add(k2v.clone().multiplyScalar(h / 2));
    const a3 = accelerationAt(v3, omega);
    const k3r = v3.clone();
    const k3v = a3.clone();

    const v4 = v.clone().add(k3v.clone().multiplyScalar(h));
    const a4 = accelerationAt(v4, omega);
    const k4r = v4.clone();
    const k4v = a4.clone();

    const dr = k1r.clone().add(k2r.clone().multiplyScalar(2)).add(k3r.clone().multiplyScalar(2)).add(k4r).multiplyScalar(h / 6);
    const dv = k1v.clone().add(k2v.clone().multiplyScalar(2)).add(k3v.clone().multiplyScalar(2)).add(k4v).multiplyScalar(h / 6);

    r = r.clone().add(dr);
    v = v.clone().add(dv);
    t += h;

    points.push(r.clone());
    times.push(t);
    velocities.push(v.clone());

    if (params.magnusEffect) {
      const am = omega.clone().cross(v).multiplyScalar(params.magnusStrength);
      magnusZ.push(am.z);
    }

    if (r.z < 0) break;
  }

  return { points, times, velocities, magnusZ };
}

function samplePointAtTime(points, times, tTarget) {
  if (!points.length) return new THREE.Vector3(0, 0, 0);
  if (tTarget <= times[0]) return points[0].clone();
  if (tTarget >= times[times.length - 1]) return points[points.length - 1].clone();
  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i];
    const t1 = times[i + 1];
    if (tTarget >= t0 && tTarget <= t1) {
      const u = (tTarget - t0) / Math.max(1e-9, t1 - t0);
      return points[i].clone().lerp(points[i + 1], u);
    }
  }
  return points[points.length - 1].clone();
}

function sampleVectorAtTime(vectors, times, tTarget) {
  if (!vectors.length) return new THREE.Vector3(0, 0, 0);
  if (tTarget <= times[0]) return vectors[0].clone();
  if (tTarget >= times[times.length - 1]) return vectors[vectors.length - 1].clone();
  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i];
    const t1 = times[i + 1];
    if (tTarget >= t0 && tTarget <= t1) {
      const u = (tTarget - t0) / Math.max(1e-9, t1 - t0);
      return vectors[i].clone().lerp(vectors[i + 1], u);
    }
  }
  return vectors[vectors.length - 1].clone();
}

async function yieldFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function estimateNetApproachTime(points, times) {
  if (!points.length || !times.length) return 0.35;
  let bestIdx = 0;
  let bestAbsX = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const ax = Math.abs(points[i].x);
    if (ax < bestAbsX) {
      bestAbsX = ax;
      bestIdx = i;
    }
  }
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = points[i].x;
    const x1 = points[i + 1].x;
    if ((x0 <= 0 && x1 >= 0) || (x0 >= 0 && x1 <= 0)) {
      const denom = x1 - x0;
      if (Math.abs(denom) < 1e-9) return times[i];
      const u = (0 - x0) / denom;
      return times[i] + (times[i + 1] - times[i]) * clamp(u, 0, 1);
    }
  }
  return times[bestIdx];
}

function computeBlockHeightMultiplier(tNet) {
  const baseMap = { Early: 1.0, Normal: 0.85, Late: 0.65 };
  const base = baseMap[params.blockTiming] ?? 0.85;
  const reaction = clamp(params.blockReactionSpeed, 0, 1);
  const k = 2 + reaction * 12;
  const ramp = 1 / (1 + Math.exp(-k * (tNet - 0.35)));
  const minForm = 0.45 + (1 - reaction) * 0.15;
  return clamp(minForm + (base - minForm) * ramp, 0.35, 1.0);
}

function getJumpPeakTime(contactTime) {
  if (params.timingAlignment === "Contact on way up") return contactTime + 0.12;
  if (params.timingAlignment === "Contact on way down") return contactTime - 0.12;
  return contactTime;
}

function getJumpHeightAtTime(t, nominalContactTime) {
  if (!params.jumpTimingModel) return params.jumpHeight;
  const airTime = Math.max(0.2, params.totalAirTime);
  const tPeak = getJumpPeakTime(nominalContactTime);
  const peakT = clamp(params.timeToPeakJump, 0.05, airTime - 0.05);
  const jumpStart = tPeak - peakT;
  const rel = t - jumpStart;
  if (rel <= 0 || rel >= airTime) return 0;
  if (rel <= peakT) {
    const u = rel / peakT;
    return params.jumpHeight * Math.sin((u * Math.PI) / 2);
  }
  const u = (rel - peakT) / (airTime - peakT);
  return params.jumpHeight * Math.cos((u * Math.PI) / 2);
}

function getDomeParams(window) {
  const alphaMax = THREE.MathUtils.degToRad(55);
  const betaMin = THREE.MathUtils.degToRad(15);
  const betaMax = THREE.MathUtils.degToRad(89.5);
  const dUp = Math.max(0.2, window?.heightRange ?? 0.6);
  const dSide = 1.40;
  const dForward = 0.25;
  const eps = clamp(window.thickness / Math.max(1e-6, Math.min(dForward, dSide, dUp)), 0.09, 0.35);
  return { alphaMax, betaMin, betaMax, dUp, dSide, dForward, eps };
}

function getZoneThresholds() {
  return { greenStart: 0.7, yellowStart: 0.35 };
}

function colorForQuality(q) {
  const colorRed = new THREE.Color("#e74c3c");
  const colorYellow = new THREE.Color("#f1c40f");
  const colorGreen = new THREE.Color("#2ecc71");
  const { greenStart, yellowStart } = getZoneThresholds();
  if (q >= greenStart) {
    const u = (q - greenStart) / Math.max(1e-6, 1 - greenStart);
    return colorYellow.clone().lerp(colorGreen, clamp(u, 0, 1));
  }
  if (q >= yellowStart) {
    const u = (q - yellowStart) / Math.max(1e-6, greenStart - yellowStart);
    return colorRed.clone().lerp(colorYellow, clamp(u, 0, 1));
  }
  return colorRed;
}

function getBandFrameAtTime(window, t, nominalContactTime) {
  const zTop = params.standingReachHeight + params.jumpHeight;
  const position = new THREE.Vector3(window.hitterX, window.hitterY, zTop - window.heightRange);
  const quat = new THREE.Quaternion();
  return { position, rotationY: 0, quat, zTop };
}

function worldToBandLocal(point, frame) {
  return point.clone().sub(frame.position).applyQuaternion(frame.quat.clone().invert());
}

function bandLocalToWorld(localPoint, frame) {
  return localPoint.clone().applyQuaternion(frame.quat).add(frame.position);
}

function evaluateDomePoint(local, window) {
  const p = getDomeParams(window);
  const fp = local.x - window.forwardOffset;
  const l = local.y;
  const u = local.z;
  if (fp < 0 || u < 0) return { inside: false, q: 0, hNorm: 0, E: 0 };
  if (Math.abs(l) > window.width / 2) return { inside: false, q: 0, hNorm: 0, E: 0 };

  const E = (fp / p.dForward) ** 2 + (l / p.dSide) ** 2 + (u / p.dUp) ** 2;
  if (Math.abs(E - 1) > p.eps) return { inside: false, q: 0, hNorm: 0, E };

  const zNorm = clamp(u / p.dUp, 0, 1);
  const q = zNorm;
  return { inside: true, q, hNorm: zNorm, E };
}

function classifyPointInWindow(point, window, t, nominalContactTime) {
  if (!window) return "outside";
  const frame = getBandFrameAtTime(window, t, nominalContactTime);
  const local = worldToBandLocal(point, frame);
  const dome = evaluateDomePoint(local, window);
  if (!dome.inside) return "outside";
  const { greenStart, yellowStart } = getZoneThresholds();
  if (dome.q >= greenStart) return "green";
  if (dome.q >= yellowStart) return "yellow";
  return "red";
}

function evaluateLaunchCandidate(context, speed, elev, dir) {
  const v0 = velocityFromLaunchValues(speed, elev, dir);
  const sim = context.useManualIntegration
    ? integrateTrajectoryRK4(context.setterPoint, v0, context.tEnd, context.dt, context.omega)
    : sampleSetPath(context.setterPoint, v0, context.tEnd, context.dt);
  const points = sim.points;
  const times = sim.times;
  const stats = analyzeTrajectoryAgainstWindow(points, times, context.window, context.nominalTime, context.hitterY);

  let crossesNet = false;
  let hitGroundEarly = false;
  for (let i = 0; i < points.length; i++) {
    if (points[i].x >= 0) crossesNet = true;
    if (i > 0 && points[i].z < 0 && points[i].x < context.hitterX + 0.2) hitGroundEarly = true;
  }

  const objective = stats.greenTime + 0.35 * stats.yellowTime;
  return {
    score: objective,
    greenTime: stats.greenTime,
    yellowTime: stats.yellowTime,
    redTime: stats.redTime,
    intersectsGreen: stats.intersectsGreen,
    intersectsShell: stats.intersectsShell,
    bestLateralError: stats.bestLateralError,
    bestForwardDist: stats.bestForwardDist,
    peakQ: stats.peakQ,
    crossesNet,
    hitGroundEarly,
    speed,
    elev,
    dir,
    points,
    times,
  };
}

function findClosestTrajectoryPoint(points, times, target) {
  let bestDist = Number.POSITIVE_INFINITY;
  let bestIndex = 0;
  for (let i = 0; i < points.length; i++) {
    const d = points[i].distanceTo(target);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return { distance: bestDist, index: bestIndex, time: times[bestIndex] ?? 0 };
}

function betterCandidate(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.greenTime !== a.greenTime) return b.greenTime > a.greenTime ? b : a;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  if (b.peakQ !== a.peakQ) return b.peakQ > a.peakQ ? b : a;
  return b.bestLateralError < a.bestLateralError ? b : a;
}

function autoTuneGreenTargetForAuto(context) {
  const greenPoints = generateGreenContactCandidates(context.window, context.nominalTime, 31, 12)
    .filter((p) => p.z >= context.netTopHeight && Math.abs(p.y - context.hitterY) <= 0.8);
  if (!greenPoints.length) return { ok: false, reason: "No green targets above net near hitter lane." };

  const tCenter = clamp(context.nominalTime, 0.25, 0.9);
  const tCandidates = linspace(Math.max(0.22, tCenter - 0.2), Math.min(0.95, tCenter + 0.2), 7);

  let best = null;
  for (let gi = 0; gi < greenPoints.length; gi++) {
    const pg = greenPoints[gi];
    for (let ti = 0; ti < tCandidates.length; ti++) {
      const t = tCandidates[ti];
      const gravityTerm = G.clone().multiplyScalar(0.5 * t * t);
      const v0 = pg.clone().sub(context.setterPoint).sub(gravityTerm).multiplyScalar(1 / t);
      const speed = v0.length();
      const horiz = Math.hypot(v0.x, v0.y);
      const elev = THREE.MathUtils.radToDeg(Math.atan2(v0.z, Math.max(1e-9, horiz)));
      if (speed < 5 || speed > 16 || elev < 20 || elev > 75) continue;

      const sampled = sampleSetPath(context.setterPoint, v0, context.tEnd, context.dt);
      const stats = analyzeTrajectoryAgainstWindow(sampled.points, sampled.times, context.window, t, context.hitterY);
      if (!stats.intersectsGreen) continue;
      const objective = stats.greenTime + 0.35 * stats.yellowTime - 0.4 * stats.bestLateralError;
      if (!best || objective > best.objective) {
        best = { pg: pg.clone(), t, v0: v0.clone(), objective, stats, points: sampled.points, times: sampled.times };
      }
    }
  }

  if (!best) return { ok: false, reason: "No feasible green-intersecting trajectory under current constraints." };
  return { ok: true, ...best };
}

function summarizeFailReasons(reasons) {
  const entries = Object.entries(reasons || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "none";
  return entries.map(([k, v]) => `${k}:${v}`).join(", ");
}

function generateGreenContactCandidates(window, nominalTime, alphaCount = 31, betaCount = 12) {
  const p = getDomeParams(window);
  const frame = getBandFrameAtTime(window, nominalTime, nominalTime);
  const greenStart = getZoneThresholds().greenStart;
  const betaGreenMin = THREE.MathUtils.lerp(p.betaMin, p.betaMax, 0.68);
  const pts = [];
  for (let ia = 0; ia < alphaCount; ia++) {
    const alpha = THREE.MathUtils.lerp(-p.alphaMax, p.alphaMax, ia / Math.max(1, alphaCount - 1));
    for (let ib = 0; ib < betaCount; ib++) {
      const beta = THREE.MathUtils.lerp(betaGreenMin, p.betaMax, ib / Math.max(1, betaCount - 1));
      const fp = p.dForward * Math.cos(beta) * Math.cos(alpha);
      const l = p.dSide * Math.cos(beta) * Math.sin(alpha);
      const u = p.dUp * Math.sin(beta);
      const local = new THREE.Vector3(window.forwardOffset + fp, l, u);
      const dome = evaluateDomePoint(local, window);
      if (!dome.inside || dome.q < greenStart) continue;
      pts.push(bandLocalToWorld(local, frame));
    }
  }
  return pts;
}

async function runAutoTuneSet() {
  if (autoTuneState.running) return;
  if (params.contactModel !== "Hitting window (contact region + timing window)") {
    autoTuneState.status = "Auto tune is available in Hitting Window mode.";
    rebuild({ computeSpikeSpace: true });
    return;
  }

  autoTuneState.running = true;
  autoTuneState.status = "Searching...";
  autoTuneState.greenPointsCount = 0;
  autoTuneState.candidatesTried = 0;
  autoTuneState.validGreenCandidates = 0;
  autoTuneState.failReasons = {};
  autoTuneState.targetPoint = null;

  try {
    rebuild({ computeSpikeSpace: false });
    const qualityCfg = {
      Fast: { refineIters: 80, batch: 20 },
      Balanced: { refineIters: 140, batch: 24 },
      Thorough: { refineIters: 220, batch: 32 },
    };
    const cfg = qualityCfg[params.searchQuality] ?? qualityCfg.Balanced;

    const hitterMax = getHitterHighestPoint();
    const model = getActiveContactModel(hitterMax);
    const context = {
      setterPoint: new THREE.Vector3(params.setterDistanceFromNet, params.setterLateralPosition, params.setterReleaseHeight),
      window: model.window,
      nominalTime: model.nominalTime,
      omega: omegaVectorFromControls(),
      tEnd: 1.8,
      dt: 0.008,
      hitterY: params.hitterLateralPosition,
      hitterX: params.hitterDistanceFromNet,
      useManualIntegration: params.trajectoryControlMode === "Manual: launch speed + angles + spin",
      speedMin: 5,
      speedMax: 16,
      elevMin: 20,
      elevMax: 75,
      dirCenter: clamp(((params.hitterLateralPosition - params.setterLateralPosition) / 4.5) * 20, -20, 20),
    };
    context.dirMin = context.dirCenter - 20;
    context.dirMax = context.dirCenter + 20;

    const baseline = evaluateLaunchCandidate(context, params.launchSpeed, params.launchElevationAngle, params.launchDirectionLeftRight);
    autoTuneState.baselineGreen = baseline.greenTime;

    const greenPoints = generateGreenContactCandidates(context.window, context.nominalTime, 31, 12);
    autoTuneState.greenPointsCount = greenPoints.length;
    if (!greenPoints.length) {
      autoTuneState.status = "No feasible solution: green surface has no candidates.";
      rebuild({ computeSpikeSpace: true });
      return;
    }

    const tSamples = linspace(0.25, 0.85, 8);
    const hitTolBase = 0.18;
    let best = null;

    for (let gi = 0; gi < greenPoints.length; gi++) {
      const pg = greenPoints[gi];
      if (gi % 6 === 0) {
        autoTuneState.targetPoint = pg.clone();
        autoTuneState.status = `Searching... target ${gi + 1}/${greenPoints.length}`;
        rebuild({ computeSpikeSpace: false });
        await yieldFrame();
      }

      for (let ti = 0; ti < tSamples.length; ti++) {
        const t = tSamples[ti];
        const gravityTerm = G.clone().multiplyScalar(0.5 * t * t);
        const v0 = pg.clone().sub(context.setterPoint).sub(gravityTerm).multiplyScalar(1 / t);
        const speed = v0.length();
        const horiz = Math.hypot(v0.x, v0.y);
        const elev = THREE.MathUtils.radToDeg(Math.atan2(v0.z, Math.max(1e-9, horiz)));
        const dir = THREE.MathUtils.radToDeg(Math.atan2(v0.y, v0.x));

        if (speed < context.speedMin || speed > context.speedMax) {
          autoTuneState.failReasons.speed = (autoTuneState.failReasons.speed || 0) + 1;
          continue;
        }
        if (elev < context.elevMin || elev > context.elevMax) {
          autoTuneState.failReasons.elevation = (autoTuneState.failReasons.elevation || 0) + 1;
          continue;
        }
        if (dir < context.dirMin || dir > context.dirMax) {
          autoTuneState.failReasons.direction = (autoTuneState.failReasons.direction || 0) + 1;
          continue;
        }

        let cand = evaluateLaunchCandidate(context, speed, elev, dir);
        autoTuneState.candidatesTried += 1;
        const closest = findClosestTrajectoryPoint(cand.points, cand.times, pg);

        let hitTol = hitTolBase;
        if (context.useManualIntegration && (params.airDrag || params.magnusEffect)) {
          let stepS = 0.35;
          let stepA = 1.6;
          let sBest = speed;
          let eBest = elev;
          let dBest = dir;
          let bestMiss = closest.distance;
          for (let it = 0; it < 9; it++) {
            const trials = [
              [sBest + stepS, eBest, dBest],
              [sBest - stepS, eBest, dBest],
              [sBest, eBest + stepA, dBest],
              [sBest, eBest - stepA, dBest],
              [sBest, eBest, dBest + stepA],
              [sBest, eBest, dBest - stepA],
            ];
            for (let k = 0; k < trials.length; k++) {
              const sT = clamp(trials[k][0], context.speedMin, context.speedMax);
              const eT = clamp(trials[k][1], context.elevMin, context.elevMax);
              const dT = clamp(trials[k][2], context.dirMin, context.dirMax);
              const cT = evaluateLaunchCandidate(context, sT, eT, dT);
              autoTuneState.candidatesTried += 1;
              const miss = findClosestTrajectoryPoint(cT.points, cT.times, pg).distance;
              if (miss < bestMiss) {
                bestMiss = miss;
                sBest = sT;
                eBest = eT;
                dBest = dT;
                cand = cT;
              }
            }
            stepS *= 0.8;
            stepA *= 0.8;
          }
          hitTol = 0.18;
        }

        const missFinal = findClosestTrajectoryPoint(cand.points, cand.times, pg).distance;
        if (missFinal > hitTol) {
          autoTuneState.failReasons.missTolerance = (autoTuneState.failReasons.missTolerance || 0) + 1;
          continue;
        }
        if (!cand.intersectsGreen) {
          autoTuneState.failReasons.noGreenIntersection = (autoTuneState.failReasons.noGreenIntersection || 0) + 1;
          continue;
        }
        autoTuneState.validGreenCandidates += 1;
        cand.targetPoint = pg.clone();
        best = betterCandidate(best, cand);
      }
    }

    if (!best) {
      autoTuneState.status = `No feasible solution with current constraints (${summarizeFailReasons(autoTuneState.failReasons)})`;
      autoTuneState.targetPoint = null;
      rebuild({ computeSpikeSpace: true });
      return;
    }

    let refined = best;
    const deltas = { s: 0.2, a: 1.2, d: 1.2 };
    for (let it = 0; it < cfg.refineIters; it++) {
      const sT = clamp(refined.speed + (Math.random() * 2 - 1) * deltas.s, context.speedMin, context.speedMax);
      const eT = clamp(refined.elev + (Math.random() * 2 - 1) * deltas.a, context.elevMin, context.elevMax);
      const dT = clamp(refined.dir + (Math.random() * 2 - 1) * deltas.d, context.dirMin, context.dirMax);
      const cT = evaluateLaunchCandidate(context, sT, eT, dT);
      autoTuneState.candidatesTried += 1;
      if (!cT.intersectsGreen) continue;
      autoTuneState.validGreenCandidates += 1;
      refined = betterCandidate(refined, cT);
      if (it % cfg.batch === 0) {
        autoTuneState.status = `Refining... ${it + 1}/${cfg.refineIters} (green ${refined.greenTime.toFixed(3)}s)`;
        autoTuneState.targetPoint = refined.targetPoint ? refined.targetPoint.clone() : null;
        rebuild({ computeSpikeSpace: false });
        await yieldFrame();
      }
    }

    if (!refined.intersectsGreen || refined.greenTime <= 0) {
      autoTuneState.status = `No feasible solution with current constraints (${summarizeFailReasons(autoTuneState.failReasons)})`;
      autoTuneState.targetPoint = null;
      rebuild({ computeSpikeSpace: true });
      return;
    }

    autoTuneState.best = refined;
    autoTuneState.bestGreen = refined.greenTime;
    autoTuneState.improvement = refined.greenTime - baseline.greenTime;

    params.trajectoryControlMode = "Manual: launch speed + angles + spin";
    params.launchSpeed = refined.speed;
    params.launchElevationAngle = refined.elev;
    params.launchDirectionLeftRight = refined.dir;
    if (controlRefs.launchSpeed) controlRefs.launchSpeed.updateDisplay();
    if (controlRefs.launchElevationAngle) controlRefs.launchElevationAngle.updateDisplay();
    if (controlRefs.launchDirectionLeftRight) controlRefs.launchDirectionLeftRight.updateDisplay();
    if (controlRefs.trajectoryControlMode) controlRefs.trajectoryControlMode.updateDisplay();

    const verify = evaluateLaunchCandidate(context, refined.speed, refined.elev, refined.dir);
    if (!verify.intersectsGreen || verify.greenTime <= 0) {
      autoTuneState.status = "Refused to apply: no green intersection after verify.";
      autoTuneState.targetPoint = null;
      rebuild({ computeSpikeSpace: true });
      return;
    }

    autoTuneState.status = `Done. Green ${refined.greenTime.toFixed(3)}s (improvement ${autoTuneState.improvement >= 0 ? "+" : ""}${autoTuneState.improvement.toFixed(3)}s)`;
    autoTuneState.targetPoint = null;
    setModeVisibility();
    rebuild({ computeSpikeSpace: true });
  } catch (err) {
    autoTuneState.status = "Auto tune failed. Please try again.";
    autoTuneState.targetPoint = null;
    console.error("[auto-tune-error]", err);
    rebuild({ computeSpikeSpace: true });
  } finally {
    autoTuneState.running = false;
  }
}

function samplePointsInsideWindow(window, count, focus, sampleTime, nominalContactTime) {
  const frame = getBandFrameAtTime(window, sampleTime, nominalContactTime);
  const p = getDomeParams(window);

  const sampleZone = (zone) => {
    const { greenStart, yellowStart } = getZoneThresholds();
    let tries = 0;
    while (tries < 300) {
      tries += 1;
      const alpha = THREE.MathUtils.lerp(-p.alphaMax, p.alphaMax, Math.random());
      const beta = THREE.MathUtils.lerp(p.betaMin, p.betaMax, Math.random());
      const fp = p.dForward * Math.cos(beta) * Math.cos(alpha);
      const l = p.dSide * Math.cos(beta) * Math.sin(alpha);
      const u = p.dUp * Math.sin(beta);
      const local = new THREE.Vector3(
        window.forwardOffset + fp + THREE.MathUtils.lerp(-window.thickness * 0.4, window.thickness * 0.4, Math.random()),
        l,
        u
      );
      const dome = evaluateDomePoint(local, window);
      if (!dome.inside) continue;
      if (zone === "green" && dome.q < greenStart) continue;
      if (zone === "yellow" && (dome.q < yellowStart || dome.q >= greenStart)) continue;
      if (zone === "red" && dome.q >= yellowStart) continue;
      return bandLocalToWorld(local, frame);
    }
    return bandLocalToWorld(new THREE.Vector3(window.forwardOffset, 0, p.dUp * 0.9), frame);
  };

  if (focus === "All") {
    const pts = [];
    while (pts.length < count) pts.push(sampleZone(["green", "yellow", "red"][pts.length % 3]));
    return pts;
  }

  const targetRatios = focus === "Green" ? { green: 0.6, yellow: 0.3, red: 0.1 } : { green: 0.34, yellow: 0.33, red: 0.33 };
  const target = {
    green: Math.max(1, Math.round(count * targetRatios.green)),
    yellow: Math.max(1, Math.round(count * targetRatios.yellow)),
    red: Math.max(1, count - Math.round(count * targetRatios.green) - Math.round(count * targetRatios.yellow)),
  };
  const buckets = { green: [], yellow: [], red: [] };

  while (buckets.green.length < target.green) buckets.green.push(sampleZone("green"));
  while (buckets.yellow.length < target.yellow) buckets.yellow.push(sampleZone("yellow"));
  while (buckets.red.length < target.red) buckets.red.push(sampleZone("red"));

  const all = [...buckets.green, ...buckets.yellow, ...buckets.red];
  while (all.length < count) all.push(sampleZone("yellow"));
  return all.slice(0, count);
}

function getHitterHighestPoint() {
  const maxHeight = params.standingReachHeight + params.jumpHeight;
  return new THREE.Vector3(params.hitterDistanceFromNet, params.hitterLateralPosition, maxHeight);
}

function getActiveContactModel(hitterMaxPoint) {
  if (params.contactModel === "Single contact point") {
    const p = hitterMaxPoint.clone();
    return { nominalContactPoint: p.clone(), nominalTime: params.singleTimeUntilContact, window: null, timingTolerance: 0, windowSamples: [p.clone()], cutoffs: null };
  }

  const window = {
    hitterX: hitterMaxPoint.x,
    hitterY: hitterMaxPoint.y,
    forwardOffset: params.contactBandOffsetFromHitter,
    width: params.contactBandWidth,
    heightRange: params.contactBandHeightRange,
    thickness: params.contactBandThickness,
    curveAmount: params.rainbowCurveAmount,
  };
  const nominalTime = params.nominalTimeUntilContact;
  const frameAtNominal = getBandFrameAtTime(window, nominalTime, nominalTime);

  return {
    nominalContactPoint: frameAtNominal.position.clone(),
    nominalTime,
    window,
    timingTolerance: params.timingTolerance,
    cutoffs: null,
    windowSamples: samplePointsInsideWindow(window, params.hittingWindowSamples, params.envelopeSampleFocus, nominalTime, nominalTime),
  };
}

function computeZoneTiming(points, times, model) {
  const zones = [];
  let greenTime = 0;
  let yellowTime = 0;
  let redTime = 0;

  const tMin = model.nominalTime - model.timingTolerance;
  const tMax = model.nominalTime + model.timingTolerance;

  let firstEntry = null;
  let lastExit = null;

  for (let i = 0; i < points.length; i++) {
    const inTiming = times[i] >= tMin && times[i] <= tMax;
    const zone = model.window && inTiming ? classifyPointInWindow(points[i], model.window, times[i], model.nominalTime) : (times[i] <= model.nominalTime + 1e-9 ? "neutral" : "outside");
    zones.push(zone);

    if (zone === "green" || zone === "yellow" || zone === "red") {
      if (firstEntry === null) firstEntry = times[i];
      lastExit = times[i];
    }

    if (i > 0) {
      const dt = times[i] - times[i - 1];
      if (zone === "green") greenTime += dt;
      else if (zone === "yellow") yellowTime += dt;
      else if (zone === "red") redTime += dt;
    }
  }

  const bestReached = greenTime > 0 ? "Best contact zone (green)" : yellowTime > 0 ? "Okay contact zone (yellow)" : redTime > 0 ? "Bad contact zone (red)" : "No contact zone reached";

  return {
    zones,
    greenTime,
    yellowTime,
    redTime,
    usableTime: greenTime + yellowTime,
    totalWindowTime: greenTime + yellowTime + redTime,
    bestReached,
    firstEntry,
    lastExit,
  };
}

function analyzeTrajectoryAgainstWindow(points, times, window, nominalTime, hitterY) {
  if (!window) {
    return {
      greenTime: 0,
      yellowTime: 0,
      redTime: 0,
      intersectsGreen: false,
      intersectsShell: false,
      bestLateralError: 0,
      bestForwardDist: 0,
      peakQ: 0,
    };
  }
  const th = getZoneThresholds();
  let greenTime = 0;
  let yellowTime = 0;
  let redTime = 0;
  let intersectsGreen = false;
  let intersectsShell = false;
  let bestQ = -1;
  let bestLateralError = 999;
  let bestForwardDist = 999;

  for (let i = 0; i < points.length; i++) {
    const frame = getBandFrameAtTime(window, times[i], nominalTime);
    const local = worldToBandLocal(points[i], frame);
    const dome = evaluateDomePoint(local, window);
    if (dome.inside && dome.q > bestQ) {
      intersectsShell = true;
      bestQ = dome.q;
      bestLateralError = Math.abs(points[i].y - hitterY);
      bestForwardDist = Math.abs((points[i].x - window.hitterX) - window.forwardOffset);
    }
    if (i > 0) {
      const dt = times[i] - times[i - 1];
      if (!dome.inside) continue;
      if (dome.q >= th.greenStart) {
        greenTime += dt;
        intersectsGreen = true;
      } else if (dome.q >= th.yellowStart) yellowTime += dt;
      else redTime += dt;
    }
  }
  return {
    greenTime,
    yellowTime,
    redTime,
    intersectsGreen,
    intersectsShell,
    bestLateralError: Number.isFinite(bestLateralError) ? bestLateralError : 0,
    bestForwardDist: Number.isFinite(bestForwardDist) ? bestForwardDist : 0,
    peakQ: Math.max(0, bestQ),
  };
}

function addZoneColoredTrajectory(group, points, zones) {
  const buckets = { green: [], yellow: [], red: [], neutral: [], outside: [] };

  for (let i = 0; i < points.length - 1; i++) {
    const zone = zones[i + 1];
    if (zone === "green" || zone === "yellow" || zone === "red") buckets[zone].push(points[i], points[i + 1]);
    else if (zone === "neutral") buckets.neutral.push(points[i], points[i + 1]);
    else if (zone === "outside") buckets.outside.push(points[i], points[i + 1]);
  }

  Object.entries(buckets).forEach(([zone, seg]) => {
    if (!seg.length) return;
    const color =
      zone === "green" ? 0x34ff8d :
      zone === "yellow" ? 0xffe44d :
      zone === "red" ? 0xff5c57 :
      0xffffff;
    const width = zone === "outside" ? 0.04 : zone === "neutral" ? 0.09 : 0.11;
    const opacity = zone === "outside" ? 0.45 : zone === "neutral" ? 0.88 : 0.98;
    const line = makeThickSegments2(seg, color, width, opacity);
    if (line) group.add(line);
    if (zone !== "outside") {
      const glow = makeThickSegments2(seg, color, width * 1.45, 0.2);
      if (glow) group.add(glow);
    }
  });
}

function addHittingWindowVisual(group, window, sampleTime, nominalContactTime) {
  if (!window) return;
  const frame = getBandFrameAtTime(window, sampleTime, nominalContactTime);
  const p = getDomeParams(window);
  const thresholds = getZoneThresholds();
  const segA = 60;
  const segB = 24;
  const positions = [];
  const colors = [];
  const indices = [];
  let minVertexZ = Number.POSITIVE_INFINITY;
  let maxVertexZ = Number.NEGATIVE_INFINITY;

  const colorForHeightNorm = (zNorm) => {
    if (zNorm >= thresholds.greenStart) return new THREE.Color("#2ecc71");
    if (zNorm >= thresholds.yellowStart) return new THREE.Color("#f1c40f");
    return new THREE.Color("#e74c3c");
  };

  const pushVertex = (localPoint, zNorm) => {
    const c = colorForHeightNorm(zNorm);
    positions.push(localPoint.x, localPoint.y, localPoint.z);
    colors.push(c.r, c.g, c.b);
    const worldPoint = bandLocalToWorld(localPoint, frame);
    minVertexZ = Math.min(minVertexZ, worldPoint.z);
    maxVertexZ = Math.max(maxVertexZ, worldPoint.z);
    return positions.length / 3 - 1;
  };

  const addGridSurface = (nx, ny, pointFn, reverse = false) => {
    const grid = Array.from({ length: nx + 1 }, () => Array(ny + 1).fill(0));
    for (let ix = 0; ix <= nx; ix++) {
      for (let iy = 0; iy <= ny; iy++) {
        const p = pointFn(ix / nx, iy / ny);
        grid[ix][iy] = pushVertex(p.local, p.zNorm);
      }
    }
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        const a = grid[ix][iy];
        const b = grid[ix + 1][iy];
        const c = grid[ix][iy + 1];
        const d = grid[ix + 1][iy + 1];
        if (!reverse) {
          indices.push(a, b, c);
          indices.push(c, b, d);
        } else {
          indices.push(a, c, b);
          indices.push(c, d, b);
        }
      }
    }
  };

  const surfacePoint = (ua, ub, shellOffset) => {
    const alpha = THREE.MathUtils.lerp(-p.alphaMax, p.alphaMax, ua);
    const beta = THREE.MathUtils.lerp(p.betaMin, p.betaMax, ub);
    const fp = p.dForward * Math.cos(beta) * Math.cos(alpha);
    const l = p.dSide * Math.cos(beta) * Math.sin(alpha);
    const u = p.dUp * Math.sin(beta);
    const local = new THREE.Vector3(window.forwardOffset + fp + shellOffset, l, u);
    const zNorm = clamp(local.z / Math.max(1e-6, p.dUp), 0, 1);
    return { local, zNorm };
  };

  addGridSurface(segA, segB, (ua, ub) => surfacePoint(ua, ub, window.thickness * 0.5));
  addGridSurface(segA, segB, (ua, ub) => surfacePoint(ua, ub, -window.thickness * 0.5), true);

  const bandGeometry = new THREE.BufferGeometry();
  bandGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  bandGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  bandGeometry.setIndex(indices);
  bandGeometry.computeVertexNormals();

  const bandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(bandGeometry, bandMaterial);
  band.renderOrder = 40;
  const pivot = new THREE.Group();
  pivot.position.copy(frame.position);
  pivot.quaternion.copy(frame.quat);
  pivot.add(band);

  const topArc = [];
  for (let ia = 0; ia <= segA; ia++) {
    const alpha = THREE.MathUtils.lerp(-p.alphaMax, p.alphaMax, ia / segA);
    const fp = p.dForward * Math.cos(p.betaMax) * Math.cos(alpha);
    const l = p.dSide * Math.cos(p.betaMax) * Math.sin(alpha);
    const u = p.dUp * Math.sin(p.betaMax);
    topArc.push(new THREE.Vector3(window.forwardOffset + fp, l, u));
  }
  const topArcLine = makeLine(topArc, 0x2ecc71, 0.75);
  topArcLine.renderOrder = 41;
  pivot.add(topArcLine);

  domeVisualDebug.topZ = frame.zTop;
  domeVisualDebug.maxVertexZ = Number.isFinite(maxVertexZ) ? maxVertexZ : 0;
  domeVisualDebug.minVertexZ = Number.isFinite(minVertexZ) ? minVertexZ : 0;
  domeVisualDebug.anchorOk = Math.abs(domeVisualDebug.maxVertexZ - domeVisualDebug.topZ) <= 0.01;
  console.assert(
    domeVisualDebug.anchorOk,
    `[DomeAnchor] maxVertexZ=${domeVisualDebug.maxVertexZ.toFixed(3)} expectedTopZ=${domeVisualDebug.topZ.toFixed(3)}`
  );
  console.log(
    `[DomeDebug] Dome top z=${domeVisualDebug.topZ.toFixed(3)}, max vertex z=${domeVisualDebug.maxVertexZ.toFixed(3)}, min vertex z=${domeVisualDebug.minVertexZ.toFixed(3)}`
  );

  group.add(pivot);
  return { pivot };
}

function addHitterVisuals(group, hitterMaxPoint) {
  const floorMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  floorMarker.position.set(hitterMaxPoint.x, hitterMaxPoint.y, 0.02);
  group.add(floorMarker);

  group.add(
    makeLine(
      [
        new THREE.Vector3(hitterMaxPoint.x, hitterMaxPoint.y, 0.03),
        new THREE.Vector3(hitterMaxPoint.x, hitterMaxPoint.y, hitterMaxPoint.z),
      ],
      0xffffff,
      0.8
    )
  );

  const highestMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0x222222, emissiveIntensity: 0.25 })
  );
  highestMarker.position.copy(hitterMaxPoint);
  group.add(highestMarker);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function applyCameraSensitivity() {
  const s = clamp(params.cameraSensitivity, 0.2, 3.0);
  controls.zoomSpeed = 1.0 * s;
  controls.panSpeed = 1.0 * s;
  controls.rotateSpeed = 1.0 * s;
}

function getBlockAnchorFromHitter(hitterY) {
  const sideSign = Math.sign(hitterY);
  const signedSide = sideSign === 0 ? 1 : sideSign;
  return clamp(hitterY - signedSide * params.blockShadeInside, -4.5, 4.5);
}

function getBlockerPositions(yTrack) {
  const count = Math.max(0, Math.min(3, Number(params.numberOfBlockers) || 0));
  const c = yTrack;
  const gap = params.blockerGap;
  const w = params.handsWidthPerBlocker;
  const y = [];
  if (count === 1) y.push(c);
  else if (count === 2) y.push(c - (w / 2 + gap / 2), c + (w / 2 + gap / 2));
  else if (count === 3) y.push(c - (w + gap), c, c + (w + gap));

  if (!y.length) return y;
  let shift = 0;
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  if (minY < -4.5) shift += -4.5 - minY;
  if (maxY + shift > 4.5) shift -= maxY + shift - 4.5;
  return y.map((v) => clamp(v + shift, -4.5, 4.5));
}

function getSplitHandLayout() {
  const totalWidth = Math.max(0.2, params.handsWidthPerBlocker);
  const gap = clamp(params.handGap, -0.05, 0.15);
  const handWidth = Math.max(0.05, (totalWidth - gap) / 2);
  const centerOffset = gap / 2 + handWidth / 2;
  return { totalWidth, gap, handWidth, centerOffset };
}

function getEffectivePressDepth(effectiveReach) {
  const press = Math.max(0, params.pressOverNet);
  const pressRad = THREE.MathUtils.degToRad(params.pressOverAngle);
  const wristRad = THREE.MathUtils.degToRad(params.wristOverAmount);
  return Math.max(0.03, press + Math.tan(pressRad) * effectiveReach * 0.5 + Math.tan(wristRad) * effectiveReach * 0.2);
}

function isCrossingBlockedAtPoint(yCross, zCross, netTopHeight, blockerYs, effectiveReach, zReachBoost = 0) {
  const layout = getSplitHandLayout();
  const z0 = netTopHeight;
  const z1 = netTopHeight + effectiveReach + zReachBoost;
  for (let i = 0; i < blockerYs.length; i++) {
    const yb = blockerYs[i];
    const handCenters = [yb - layout.centerOffset, yb + layout.centerOffset];
    for (let h = 0; h < handCenters.length; h++) {
      const yc = handCenters[h];
      const halfW = layout.handWidth / 2;
      if (yCross >= yc - halfW && yCross <= yc + halfW && zCross >= z0 && zCross <= z1) return true;
    }
  }
  return false;
}

function addBlockerVisuals(group, blockerYs, netTopHeight, effectiveReach) {
  const zTop = netTopHeight + effectiveReach;
  const halfW = params.handsWidthPerBlocker / 2;
  const pressRad = THREE.MathUtils.degToRad(params.pressOverAngle);
  const wristRad = THREE.MathUtils.degToRad(params.wristOverAmount);
  const baseTilt = -(pressRad + Math.atan2(Math.max(0, params.pressOverNet), Math.max(0.2, effectiveReach)) * 0.7);
  const layout = getSplitHandLayout();
  const handDepth = 0.05;
  const baseH = Math.max(0.06, effectiveReach * 0.72);
  const tipH = Math.max(0.05, effectiveReach - baseH);
  blockerYs.forEach((yb) => {
    group.add(
      makeLine(
        [
          new THREE.Vector3(0, yb - halfW, netTopHeight),
          new THREE.Vector3(0, yb + halfW, netTopHeight),
          new THREE.Vector3(0, yb + halfW, zTop),
          new THREE.Vector3(0, yb - halfW, zTop),
          new THREE.Vector3(0, yb - halfW, netTopHeight),
        ],
        0xff6b5b,
        0.95
      )
    );

    const handCenters = [yb - layout.centerOffset, yb + layout.centerOffset];
    handCenters.forEach((hc) => {
      const basePivot = new THREE.Group();
      basePivot.position.set(0, hc, netTopHeight);
      basePivot.rotation.y = baseTilt;

      const baseSeg = new THREE.Mesh(
        new THREE.BoxGeometry(handDepth, layout.handWidth, baseH),
        new THREE.MeshStandardMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.55 })
      );
      baseSeg.position.set(0, 0, baseH / 2);
      basePivot.add(baseSeg);

      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, 0, baseH);
      tipPivot.rotation.y = -wristRad;
      const tipSeg = new THREE.Mesh(
        new THREE.BoxGeometry(handDepth, layout.handWidth, tipH),
        new THREE.MeshStandardMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.58 })
      );
      tipSeg.position.set(0, 0, tipH / 2);
      tipPivot.add(tipSeg);
      basePivot.add(tipPivot);
      group.add(basePivot);
    });

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1.9, 14),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, transparent: true, opacity: 0.45 })
    );
    pillar.rotation.x = Math.PI / 2;
    pillar.position.set(0, yb, 0.95);
    group.add(pillar);

    const floorMarker = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 18),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
    );
    floorMarker.position.set(0, yb, 0.015);
    group.add(floorMarker);
  });
}

function generatePossibleSpikeTrajectories(contactPoints, netTopHeight, resolution, smoothness, blockerYs, effectiveReach) {
  const xVals = linspace(0.2, 9.0, resolution);
  const yVals = linspace(-4.5, 4.5, resolution);
  const freeTraj = [];
  const blockedTraj = [];
  const crossingsBefore = [];
  const crossingsAfter = [];
  const grids = [];

  const pressDepth = getEffectivePressDepth(effectiveReach);
  const pressAngleRad = THREE.MathUtils.degToRad(params.pressOverAngle);
  const wristRad = THREE.MathUtils.degToRad(params.wristOverAmount);
  const zReachBoost = (Math.tan(pressAngleRad) + Math.tan(wristRad) * 0.5) * Math.max(0.01, effectiveReach) * 0.08;

  for (let c = 0; c < contactPoints.length; c++) {
    const cp = contactPoints[c];
    const grid = Array.from({ length: resolution }, () => Array(resolution).fill(null));

    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const landing = new THREE.Vector3(xVals[i], yVals[j], 0);
        const denom = landing.x - cp.x;
        if (Math.abs(denom) < 1e-10) continue;
        const r = (0 - cp.x) / denom;
        if (!(r > 0 && r < 1)) continue;

        const yCross = cp.y + r * (landing.y - cp.y);
        const zCross = cp.z + r * (0 - cp.z);
        if (!(zCross >= netTopHeight && yCross >= -4.5 && yCross <= 4.5)) continue;
        crossingsBefore.push(new THREE.Vector3(0, yCross, zCross));

        let blocked = blockerYs.length > 0 && isCrossingBlockedAtPoint(yCross, zCross, netTopHeight, blockerYs, effectiveReach, zReachBoost);
        if (!blocked && blockerYs.length > 0 && pressDepth > 0) {
          const xProbe = -Math.max(0.03, pressDepth * 0.5);
          const rp = (xProbe - cp.x) / (landing.x - cp.x);
          if (rp > 0 && rp < 1) {
            const yProbe = cp.y + rp * (landing.y - cp.y);
            const zProbe = cp.z + rp * (landing.z - cp.z);
            blocked = isCrossingBlockedAtPoint(yProbe, zProbe, netTopHeight, blockerYs, effectiveReach, zReachBoost);
          }
        }
        if (!blocked && blockerYs.length > 0 && (pressAngleRad > 0 || wristRad > 0)) {
          const xTiltProbe = -Math.max(0.03, pressDepth);
          const rt = (xTiltProbe - cp.x) / (landing.x - cp.x);
          if (rt > 0 && rt < 1) {
            const yTilt = cp.y + rt * (landing.y - cp.y);
            const zTilt = cp.z + rt * (landing.z - cp.z);
            blocked = isCrossingBlockedAtPoint(yTilt, zTilt, netTopHeight, blockerYs, effectiveReach, zReachBoost);
          }
        }
        if (!blocked) crossingsAfter.push(new THREE.Vector3(0, yCross, zCross));
        const path = [];
        for (let k = 0; k < smoothness; k++) path.push(cp.clone().add(landing.clone().sub(cp).multiplyScalar(k / (smoothness - 1))));

        const t = { i, j, path, blocked };
        if (!blocked) {
          grid[j][i] = t;
          freeTraj.push(t);
        } else {
          blockedTraj.push(t);
        }
      }
    }
    grids.push(grid);
  }
  return { freeTraj, blockedTraj, crossingsBefore, crossingsAfter, grids };
}
function buildLineBundle(trajectories, maxCount, color = 0x70c1ff, opacity = 0.24) {
  if (!trajectories.length || maxCount <= 0) return null;
  const drawCount = Math.min(maxCount, trajectories.length);
  const selected = [];
  if (drawCount === trajectories.length) selected.push(...trajectories);
  else for (let n = 0; n < drawCount; n++) selected.push(trajectories[Math.floor((n * (trajectories.length - 1)) / Math.max(1, drawCount - 1))]);

  let segmentCount = 0;
  selected.forEach((t) => (segmentCount += Math.max(0, t.path.length - 1)));

  const pos = new Float32Array(segmentCount * 2 * 3);
  let p = 0;
  selected.forEach((t) => {
    for (let k = 0; k < t.path.length - 1; k++) {
      const a = t.path[k], b = t.path[k + 1];
      pos[p++] = a.x; pos[p++] = a.y; pos[p++] = a.z;
      pos[p++] = b.x; pos[p++] = b.y; pos[p++] = b.z;
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function buildBoundaryWire(grids, resolution, smoothness, color = 0xb2ff59, opacity = 0.3) {
  const seg = [];
  grids.forEach((grid) => {
    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution - 1; i++) {
        const a = grid[j][i], b = grid[j][i + 1];
        if (!a || !b) continue;
        for (let k = 0; k < smoothness; k++) seg.push(a.path[k], b.path[k]);
      }
    }
    for (let j = 0; j < resolution - 1; j++) {
      for (let i = 0; i < resolution; i++) {
        const a = grid[j][i], b = grid[j + 1][i];
        if (!a || !b) continue;
        for (let k = 0; k < smoothness; k++) seg.push(a.path[k], b.path[k]);
      }
    }
  });
  if (!seg.length) return null;

  const pos = new Float32Array(seg.length * 3);
  for (let i = 0; i < seg.length; i++) { pos[i * 3] = seg[i].x; pos[i * 3 + 1] = seg[i].y; pos[i * 3 + 2] = seg[i].z; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function estimateAvailableCrossingSpace(crossings, netTopHeight) {
  if (!crossings.length) return { area: 0 };
  const yBins = 90, zBins = 80, zMin = netTopHeight, zMax = 5;
  const dy = (Y_MAX - Y_MIN) / yBins, dz = (zMax - zMin) / zBins;
  const occ = Array.from({ length: yBins }, () => Array(zBins).fill(false));

  crossings.forEach((p) => {
    const yi = Math.floor((p.y - Y_MIN) / dy), zi = Math.floor((p.z - zMin) / dz);
    if (yi >= 0 && yi < yBins && zi >= 0 && zi < zBins) occ[yi][zi] = true;
  });
  let oc = 0;
  for (let yi = 0; yi < yBins; yi++) for (let zi = 0; zi < zBins; zi++) if (occ[yi][zi]) oc++;
  return { area: oc * dy * dz };
}

function updateContactLabel() {
  if (!contactLabelEl.textContent || !contactLabelEl.textContent.trim()) {
    contactLabelEl.style.display = "none";
    return;
  }
  const p = currentContactLabelPoint.clone().project(camera);
  contactLabelEl.style.left = `${(p.x * 0.5 + 0.5) * renderer.domElement.clientWidth}px`;
  contactLabelEl.style.top = `${(-p.y * 0.5 + 0.5) * renderer.domElement.clientHeight}px`;
  contactLabelEl.style.display = p.z < 1 ? "block" : "none";
}

function rebuild(options = {}) {
  const computeSpikeSpace = options.computeSpikeSpace !== false;
  clearGroup(dynamicGroup);
  trajectoryLineMaterials = [];
  activeBandPivot = null;
  activeBandWindow = null;

  const { netTop, netBottom } = drawNetSystem(params.netHeightMode);
  const setterPoint = new THREE.Vector3(params.setterDistanceFromNet, params.setterLateralPosition, params.setterReleaseHeight);
  const hitterMaxPoint = getHitterHighestPoint();
  const model = getActiveContactModel(hitterMaxPoint);
  domeVisualDebug.topZ = hitterMaxPoint.z;
  domeVisualDebug.maxVertexZ = hitterMaxPoint.z;
  domeVisualDebug.minVertexZ = hitterMaxPoint.z - params.contactBandHeightRange;
  domeVisualDebug.anchorOk = true;
  const autoMode = params.trajectoryControlMode === "Auto: reach contact point at chosen time";
  let autoWindowWarning = "";

  let nominalContactPoint = model.nominalContactPoint.clone();
  let nominalTime = Math.max(0.05, model.nominalTime);
  let setPath = [];
  let setTimes = [];
  let setVels = [];
  let magnusZ = [];
  let markerTime = Math.max(0.05, params.contactTimeMarker);
  let markerPoint = nominalContactPoint.clone();
  let launchVelocity = new THREE.Vector3(0, 0, 0);

  if (autoMode) {
    if (params.contactModel === "Hitting window (contact region + timing window)" && model.window) {
      const tEnd = Math.max(1.2, nominalTime + Math.max(0.45, model.timingTolerance + 0.2));
      const tuned = autoTuneGreenTargetForAuto({
        setterPoint,
        window: model.window,
        nominalTime,
        hitterY: params.hitterLateralPosition,
        netTopHeight: netTop,
        tEnd,
        dt: 0.005,
      });
      if (!tuned.ok) {
        autoWindowWarning = tuned.reason;
        setPath = [setterPoint.clone()];
        setTimes = [0];
        setVels = [new THREE.Vector3(0, 0, 0)];
        markerTime = nominalTime;
        markerPoint = setterPoint.clone();
      } else {
        launchVelocity = tuned.v0.clone();
        nominalContactPoint = tuned.pg.clone();
        nominalTime = tuned.t;
        model.nominalTime = tuned.t;
        model.nominalContactPoint = tuned.pg.clone();
        setPath = tuned.points;
        setTimes = tuned.times;
        setVels = setTimes.map((t) => launchVelocity.clone().add(G.clone().multiplyScalar(t)));
        markerTime = nominalTime;
        markerPoint = samplePointAtTime(setPath, setTimes, markerTime);
      }
    } else {
      launchVelocity = solveBallPathToContact(setterPoint, nominalContactPoint, nominalTime);
      const tEnd = Math.max(1.2, nominalTime + Math.max(0.45, model.timingTolerance + 0.2));
      const sampled = sampleSetPath(setterPoint, launchVelocity, tEnd, 0.005);
      setPath = sampled.points;
      setTimes = sampled.times;
      setVels = setTimes.map((t) => launchVelocity.clone().add(G.clone().multiplyScalar(t)));
      markerTime = nominalTime;
      markerPoint = samplePointAtTime(setPath, setTimes, markerTime);
    }
  } else {
    launchVelocity = velocityFromLaunchControls();
    const omega = omegaVectorFromControls();
    const tEnd = 1.8;
    const integrated = integrateTrajectoryRK4(setterPoint, launchVelocity, tEnd, 0.006, omega);
    setPath = integrated.points;
    setTimes = integrated.times;
    setVels = integrated.velocities;
    magnusZ = integrated.magnusZ;
    nominalTime = Math.max(0.05, params.nominalTimeUntilContact);
    markerTime = Math.max(0.05, params.contactTimeMarker);
    markerPoint = samplePointAtTime(setPath, setTimes, markerTime);
    nominalContactPoint = markerPoint.clone();
    if (model.window) {
      model.window.hitterX = hitterMaxPoint.x;
      model.window.hitterY = hitterMaxPoint.y;
      model.window.forwardOffset = params.contactBandOffsetFromHitter;
      model.window.width = params.contactBandWidth;
      model.window.heightRange = params.contactBandHeightRange;
      model.window.thickness = params.contactBandThickness;
      model.window.curveAmount = params.rainbowCurveAmount;
      model.nominalTime = nominalTime;
      model.timingTolerance = params.timingTolerance;
      model.windowSamples = samplePointsInsideWindow(model.window, params.hittingWindowSamples, params.envelopeSampleFocus, model.nominalTime, model.nominalTime);
    } else {
      model.nominalTime = markerTime;
      model.timingTolerance = 0;
    }
    if (params.magnusEffect && magnusZ.length) {
      const avgMagnusZ = magnusZ.reduce((a, b) => a + b, 0) / magnusZ.length;
      console.log("[magnus-z-check]", params.spinType, "avg_z=", avgMagnusZ.toFixed(5));
    }
  }

  if (autoTuneState.running && autoTuneState.targetPoint) {
    const tuningTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x8dff5d, emissive: 0x1b3d00, emissiveIntensity: 0.6 })
    );
    tuningTarget.position.copy(autoTuneState.targetPoint);
    dynamicGroup.add(tuningTarget);
  }

  if (params.contactModel === "Single contact point") {
    nominalContactPoint = hitterMaxPoint.clone();
  } else {
    nominalContactPoint = markerPoint.clone();
  }

  const zoneTiming = computeZoneTiming(setPath, setTimes, model);

  addHitterVisuals(dynamicGroup, hitterMaxPoint);
  addZoneColoredTrajectory(dynamicGroup, setPath, zoneTiming.zones);

  const setterBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 16), new THREE.MeshStandardMaterial({ color: 0x30d158 }));
  setterBall.position.copy(setterPoint); dynamicGroup.add(setterBall);
  if (params.contactModel === "Single contact point") {
    const contactSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 24, 22),
      new THREE.MeshStandardMaterial({ color: 0xff2d55, emissive: 0x5a0018, emissiveIntensity: 0.6 })
    );
    contactSphere.position.copy(hitterMaxPoint);
    dynamicGroup.add(contactSphere);

    const ballAtNominal = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 18),
      new THREE.MeshStandardMaterial({ color: 0xffe082 })
    );
    ballAtNominal.position.copy(markerPoint);
    dynamicGroup.add(ballAtNominal);
    contactLabelEl.textContent = "";
  } else {
    const nominalMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0x222222, emissiveIntensity: 0.35 })
    );
    nominalMarker.position.copy(nominalContactPoint);
    dynamicGroup.add(nominalMarker);
    contactLabelEl.textContent = "";
  }

  if (model.window) {
    const bandVisual = addHittingWindowVisual(dynamicGroup, model.window, model.nominalTime, model.nominalTime);
    activeBandPivot = bandVisual ? bandVisual.pivot : null;
    activeBandWindow = model.window;
    activeBandNominalTime = model.nominalTime;
  }

  const setCrosses = setPath.filter((_, i) => setTimes[i] <= markerTime + 1e-9).some((p) => p.x >= 0);
  const nowTs = Date.now();
  const dtMs = Math.max(1, nowTs - lastRebuildTs);
  lastRebuildTs = nowTs;
  const blockerTrackTime = params.contactModel === "Hitting window (contact region + timing window)" ? model.nominalTime : markerTime;
  const ballTrackY = samplePointAtTime(setPath, setTimes, blockerTrackTime).y;
  const tNet = estimateNetApproachTime(setPath, setTimes);
  const blockHeightMultiplier = computeBlockHeightMultiplier(tNet);
  const effectiveBlockReach = params.handsReachAboveNet * blockHeightMultiplier;
  const yAnchor = getBlockAnchorFromHitter(params.hitterLateralPosition);
  const followBlend = params.blockFollowsBall ? clamp(params.followStrength, 0, 1) : 0;
  const yTarget = clamp(THREE.MathUtils.lerp(yAnchor, ballTrackY, followBlend), -4.5, 4.5);
  const alpha = params.blockFollowsBall
    ? clamp((dtMs / Math.max(1, params.followDelayMs)) * params.followStrength, 0, 1)
    : 1.0;
  blockerTrackY = clamp(blockerTrackY + (yTarget - blockerTrackY) * alpha, -4.5, 4.5);
  const blockerYs = getBlockerPositions(blockerTrackY);
  addBlockerVisuals(dynamicGroup, blockerYs, netTop, effectiveBlockReach);

  let freeTraj = [], blockedTraj = [], crossingsBefore = [], crossingsAfter = [], allGrids = [];
  if (computeSpikeSpace && params.showPossibleSpikeSpace) {
    const contactSamplesForEnvelope =
      params.contactModel === "Single contact point"
        ? [hitterMaxPoint.clone()]
        : model.windowSamples;
    const generated = generatePossibleSpikeTrajectories(contactSamplesForEnvelope, netTop, params.landingAreaResolution, params.trajectorySmoothness, blockerYs, effectiveBlockReach);
    freeTraj = generated.freeTraj;
    blockedTraj = generated.blockedTraj;
    crossingsBefore = generated.crossingsBefore;
    crossingsAfter = generated.crossingsAfter;
    allGrids = generated.grids;
    const bundle = buildLineBundle(freeTraj, params.numberOfSpikePathsShown);
    if (bundle) dynamicGroup.add(bundle);
    if (params.showBlockedSpikePaths) {
      const blockedBundle = buildLineBundle(blockedTraj, params.numberOfSpikePathsShown, 0xa0a0a0, 0.18);
      if (blockedBundle) dynamicGroup.add(blockedBundle);
    }
    if (params.show3DBoundaryStructure) { const wire = buildBoundaryWire(allGrids, params.landingAreaResolution, params.trajectorySmoothness); if (wire) dynamicGroup.add(wire); }
  }

  const speedAtContact = sampleVectorAtTime(setVels, setTimes, markerTime).length();
  const singlePointDistance = markerPoint.distanceTo(hitterMaxPoint);
  const windowDebug = analyzeTrajectoryAgainstWindow(setPath, setTimes, model.window, model.nominalTime, params.hitterLateralPosition);
  const spaceBefore = estimateAvailableCrossingSpace(crossingsBefore, netTop).area;
  const spaceAfter = estimateAvailableCrossingSpace(crossingsAfter, netTop).area;
  const removedPercent = spaceBefore > 1e-9 ? ((spaceBefore - spaceAfter) / spaceBefore) * 100 : 0;
  const goodContactQualityPct = zoneTiming.totalWindowTime > 1e-9 ? (zoneTiming.greenTime / zoneTiming.totalWindowTime) * 100 : 0;
  const contactTimingMatch = goodContactQualityPct >= 45 ? "Good" : goodContactQualityPct >= 20 ? "Okay" : "Poor";

  currentContactLabelPoint.copy(nominalContactPoint);
  const poleVertical = Math.abs(poleVerticalCheck.x) < 0.01 && Math.abs(poleVerticalCheck.y) < 0.01 && Math.abs(poleVerticalCheck.z - 1) < 0.01;

  debugEl.innerHTML = [
    `<b>Net height mode:</b> ${params.netHeightMode}`,
    `<b>Contact model:</b> ${params.contactModel}`,
    `<b>Hitter location:</b> Distance from net ${params.hitterDistanceFromNet.toFixed(2)} m, Lateral court position ${params.hitterLateralPosition.toFixed(2)} m`,
    `<b>Highest hitting point:</b> Distance from net ${hitterMaxPoint.x.toFixed(2)} m, Lateral court position ${hitterMaxPoint.y.toFixed(2)} m, Height ${hitterMaxPoint.z.toFixed(2)} m`,
    `<b>Contact point:</b> Distance from net ${nominalContactPoint.x.toFixed(2)} m, Lateral court position ${nominalContactPoint.y.toFixed(2)} m, Height ${nominalContactPoint.z.toFixed(2)} m`,
    ...(params.contactModel === "Single contact point"
      ? [`<b>Distance to planned contact point:</b> ${singlePointDistance.toFixed(2)} m`]
      : []),
    `<b>Ball speed at contact:</b> ${speedAtContact.toFixed(2)} m/s`,
    `<b>Ball flight time:</b> ${markerTime.toFixed(2)} s`,
    `<b>Rainbow forward offset:</b> ${params.contactBandOffsetFromHitter.toFixed(2)} m`,
    `<b>Rainbow curve amount:</b> ${params.rainbowCurveAmount.toFixed(2)}`,
    `<b>Dome top z:</b> ${domeVisualDebug.topZ.toFixed(3)} m`,
    `<b>Dome max vertex z:</b> ${domeVisualDebug.maxVertexZ.toFixed(3)} m`,
    `<b>Dome min vertex z:</b> ${domeVisualDebug.minVertexZ.toFixed(3)} m`,
    `<b>Dome anchor check:</b> ${domeVisualDebug.anchorOk ? "OK" : "Warning"}`,
    `<b>Time the ball stays in each zone:</b> Green ${zoneTiming.greenTime.toFixed(3)} s | Yellow ${zoneTiming.yellowTime.toFixed(3)} s | Red ${zoneTiming.redTime.toFixed(3)} s`,
    `<b>Green contact time:</b> ${zoneTiming.greenTime.toFixed(3)} s`,
    `<b>Good contact quality %:</b> ${goodContactQualityPct.toFixed(1)}%`,
    `<b>Contact timing match:</b> ${contactTimingMatch}`,
    ...(autoWindowWarning ? [`<b>Auto warning:</b> ${autoWindowWarning}`] : []),
    `<b>Jump timing model:</b> ${params.jumpTimingModel ? "On" : "Off"} (${params.timingAlignment})`,
    `<b>Auto tune status:</b> ${autoTuneState.status}`,
    `<b>Auto tune green points:</b> ${autoTuneState.greenPointsCount}`,
    `<b>Auto tune candidates tried:</b> ${autoTuneState.candidatesTried}`,
    `<b>Auto tune valid green hits:</b> ${autoTuneState.validGreenCandidates}`,
    `<b>Auto tune fail reasons:</b> ${summarizeFailReasons(autoTuneState.failReasons)}`,
    `<b>Auto tune baseline green:</b> ${autoTuneState.baselineGreen.toFixed(3)} s`,
    `<b>Auto tune best green:</b> ${autoTuneState.bestGreen.toFixed(3)} s`,
    `<b>Auto tune improvement:</b> ${autoTuneState.improvement >= 0 ? "+" : ""}${autoTuneState.improvement.toFixed(3)} s`,
    ...(autoTuneState.best
      ? [
          `<b>Auto tune best launch:</b> Speed ${autoTuneState.best.speed.toFixed(2)} m/s, Elevation ${autoTuneState.best.elev.toFixed(1)}°, Direction ${autoTuneState.best.dir.toFixed(1)}°`,
        ]
      : []),
    `<b>Total usable hitting time:</b> ${zoneTiming.usableTime.toFixed(3)} s`,
    `<b>Debug Green time:</b> ${windowDebug.greenTime.toFixed(3)} s`,
    `<b>Debug Yellow time:</b> ${windowDebug.yellowTime.toFixed(3)} s`,
    `<b>Debug Red time:</b> ${windowDebug.redTime.toFixed(3)} s`,
    `<b>Did trajectory intersect green:</b> ${windowDebug.intersectsGreen ? "true" : "false"}`,
    `<b>Lateral error at best contact:</b> ${windowDebug.bestLateralError.toFixed(3)} m`,
    `<b>Best contact quality reached:</b> ${zoneTiming.bestReached}`,
    `<b>Trajectory intersects green zone:</b> ${zoneTiming.greenTime > 0 ? "Yes" : "No"}`,
    `<b>Time in green:</b> ${zoneTiming.greenTime.toFixed(3)} s`,
    `<b>Available crossing space (before block):</b> ${spaceBefore.toFixed(3)} m^2`,
    `<b>Available crossing space (after block):</b> ${spaceAfter.toFixed(3)} m^2`,
    `<b>Percent of crossing space removed by block:</b> ${removedPercent.toFixed(1)}%`,
    `<b>Possible spike paths (unblocked):</b> ${freeTraj.length}`,
    `<b>Possible spike paths (blocked):</b> ${blockedTraj.length}`,
    `<b>Number of blockers:</b> ${blockerYs.length}`,
    `<b>Block anchor from hitter:</b> hitter y ${params.hitterLateralPosition.toFixed(2)} m, shade inside ${params.blockShadeInside.toFixed(2)} m, y_anchor ${yAnchor.toFixed(2)} m`,
    `<b>Block follow input:</b> y_ball ${ballTrackY.toFixed(2)} m, follow blend ${followBlend.toFixed(2)}`,
    `<b>Block tracking center:</b> y_track ${blockerTrackY.toFixed(2)} m (lateral)`,
    `<b>Block timing:</b> ${params.blockTiming}`,
    `<b>Block reaction speed:</b> ${params.blockReactionSpeed.toFixed(2)}`,
    `<b>Block height at net:</b> ${(effectiveBlockReach).toFixed(2)} m above net (${(blockHeightMultiplier * 100).toFixed(0)}%)`,
    `<b>Ball time to net area:</b> ${tNet.toFixed(3)} s`,
    `<b>Hitting window samples:</b> ${model.windowSamples.length}`,
    `<b>Pole alignment check:</b> ${poleVertical ? "Vertical" : "Check setup"}`,
    `<b>Set stays on our side before contact:</b> ${setCrosses ? "No" : "Yes"}`,
    `<b>Net edges:</b> top ${netTop.toFixed(2)} m, bottom ${netBottom.toFixed(2)} m`,
  ].join("<br>");

  spinPanelEl.innerHTML = [
    `<b>Set trajectory control:</b> ${autoMode ? "Auto" : "Manual"}`,
    `<b>Spin:</b> ${params.spinType}`,
    `<b>Spin rate:</b> ${params.spinRateRps.toFixed(1)} rps`,
    `<b>Air drag:</b> ${params.airDrag ? "on" : "off"}`,
    `<b>Magnus:</b> ${params.magnusEffect ? "on" : "off"}`,
  ].join("<br>");
  spinPanelEl.style.display = autoMode ? "none" : "block";
}

function scheduleRebuild(fromFinish = false) {
  if (pendingHeavyRebuild) { clearTimeout(pendingHeavyRebuild); pendingHeavyRebuild = null; }
  if (!params.pauseSpikeSpaceWhileAdjusting || fromFinish) { rebuild({ computeSpikeSpace: true }); return; }
  rebuild({ computeSpikeSpace: false });
  pendingHeavyRebuild = setTimeout(() => rebuild({ computeSpikeSpace: true }), 220);
}

function resetView() {
  camera.position.copy(CAMERA_DEFAULT_POS);
  camera.up.set(0, 0, 1);
  controls.target.copy(CAMERA_TARGET);
  controls.update();
}

function hitterPOVView() {
  const hx = params.hitterDistanceFromNet;
  const hy = params.hitterLateralPosition;
  camera.position.set(hx - 2.8, hy, 2.0);
  camera.up.set(0, 0, 1);
  controls.target.set(hx + 2.4, hy, 2.3);
  controls.update();
}

function setTooltip(controller, text) { controller.domElement.title = text; }
function bindController(controller) { controller.onChange(() => scheduleRebuild(false)); controller.onFinishChange(() => scheduleRebuild(true)); return controller; }

function setModeVisibility() {
  const single = params.contactModel === "Single contact point";
  const autoMode = params.trajectoryControlMode === "Auto: reach contact point at chosen time";
  uiControllers.single.forEach((c) => { c.domElement.parentElement.style.display = single ? "" : "none"; });
  uiControllers.window.forEach((c) => { c.domElement.parentElement.style.display = single ? "none" : ""; });
  uiControllers.auto.forEach((c) => { c.domElement.parentElement.style.display = autoMode ? "" : "none"; });
  uiControllers.manual.forEach((c) => { c.domElement.parentElement.style.display = autoMode ? "none" : ""; });
  legendEl.style.display = single ? "none" : "block";
}

function setupGui() {
  const gui = new GUI({ title: "Volleyball Controls", width: 410 });

  const modelFolder = gui.addFolder("Contact Setup");
  bindController(modelFolder.add(params, "contactModel", ["Single contact point", "Hitting window (contact region + timing window)"]).name("Contact model")).onChange(() => { setModeVisibility(); scheduleRebuild(false); });
  controlRefs.trajectoryControlMode = bindController(
    modelFolder
      .add(params, "trajectoryControlMode", ["Auto: reach contact point at chosen time", "Manual: launch speed + angles + spin"])
      .name("Set trajectory control")
  ).onChange(() => {
    setModeVisibility();
    scheduleRebuild(false);
  });
  bindController(modelFolder.add(params, "searchQuality", ["Fast", "Balanced", "Thorough"]).name("Search quality"));
  modelFolder.add({ autoTuneSet: () => runAutoTuneSet() }, "autoTuneSet").name("Auto Tune Set (maximize green time)");

  const netFolder = gui.addFolder("Net Setup");
  bindController(netFolder.add(params, "netHeightMode", Object.keys(NET_MODES)).name("Net height mode"));

  const setFolder = gui.addFolder("Set Target");
  bindController(setFolder.add(params, "setterDistanceFromNet", -9, -0.1, 0.05).name("Setter position (distance from net)"));
  bindController(setFolder.add(params, "setterLateralPosition", -4.5, 4.5, 0.05).name("Setter lateral position (across court)"));
  bindController(setFolder.add(params, "setterReleaseHeight", 1.5, 3.5, 0.01).name("Setter release height"));

  const hitterFolder = gui.addFolder("Hitter");
  const hitterPresetController = bindController(
    hitterFolder.add(params, "hitterPreset", ["Position 4", "Middle", "Back row", "Custom"]).name("Hitter preset")
  );
  const hitterXController = bindController(
    hitterFolder.add(params, "hitterDistanceFromNet", -3.0, -0.1, 0.05).name("Hitter distance from net")
  );
  const hitterYController = bindController(
    hitterFolder.add(params, "hitterLateralPosition", -4.5, 4.5, 0.05).name("Hitter lateral position")
  );
  const reachController = bindController(
    hitterFolder.add(params, "standingReachHeight", 1.8, 2.8, 0.01).name("Standing reach height")
  );
  const jumpController = bindController(
    hitterFolder.add(params, "jumpHeight", 0.2, 1.2, 0.01).name("Jump height")
  );
  hitterPresetController.onChange((value) => {
    const presets = {
      "Position 4": { x: -0.8, y: 3.8 },
      Middle: { x: -0.55, y: 0.0 },
      "Back row": { x: -2.2, y: 2.3 },
    };
    if (value === "Custom" || !presets[value]) {
      scheduleRebuild(false);
      return;
    }
    params.hitterDistanceFromNet = presets[value].x;
    params.hitterLateralPosition = presets[value].y;
    hitterXController.updateDisplay();
    hitterYController.updateDisplay();
    reachController.updateDisplay();
    jumpController.updateDisplay();
    scheduleRebuild(false);
  });

  const singleFolder = gui.addFolder("Single Contact Point");
  uiControllers.single.push(bindController(singleFolder.add(params, "singleTimeUntilContact", 0.1, 1.2, 0.01).name("Time until contact")));
  uiControllers.auto.push(uiControllers.single[uiControllers.single.length - 1]);
  uiControllers.single.push(bindController(singleFolder.add(params, "contactTimeMarker", 0.1, 1.2, 0.01).name("Contact time marker")));
  uiControllers.manual.push(uiControllers.single[uiControllers.single.length - 1]);

  const windowFolder = gui.addFolder("Hitting Window");
  uiControllers.window.push(bindController(windowFolder.add(params, "contactBandOffsetFromHitter", 0.05, 0.4, 0.01).name("Rainbow forward offset")));
  uiControllers.window.push(bindController(windowFolder.add(params, "contactBandWidth", 1.0, 1.6, 0.01).name("Rainbow width (left-right)")));
  uiControllers.window.push(bindController(windowFolder.add(params, "contactBandHeightRange", 0.55, 0.8, 0.01).name("Rainbow height range")));
  uiControllers.window.push(bindController(windowFolder.add(params, "contactBandThickness", 0.1, 0.22, 0.005).name("Rainbow thickness (toward net)")));
  uiControllers.window.push(bindController(windowFolder.add(params, "rainbowCurveAmount", 0.0, 1.0, 0.01).name("Rainbow curve amount")));
  uiControllers.auto.push(bindController(windowFolder.add(params, "nominalTimeUntilContact", 0.1, 1.2, 0.01).name("Nominal time until contact")));
  uiControllers.window.push(bindController(windowFolder.add(params, "timingTolerance", 0.0, 0.3, 0.01).name("Timing tolerance (+/-)")));
  uiControllers.window.push(bindController(windowFolder.add(params, "jumpTimingModel").name("Jump timing model")));
  uiControllers.window.push(bindController(windowFolder.add(params, "timeToPeakJump", 0.1, 0.5, 0.01).name("Time to peak jump")));
  uiControllers.window.push(bindController(windowFolder.add(params, "totalAirTime", 0.35, 0.9, 0.01).name("Total air time")));
  uiControllers.window.push(
    bindController(windowFolder.add(params, "timingAlignment", ["Peak at contact", "Contact on way up", "Contact on way down"]).name("Timing alignment"))
  );
  uiControllers.window.push(bindController(windowFolder.add(params, "showJumpMotion").name("Show jump motion")));
  uiControllers.manual.push(bindController(windowFolder.add(params, "contactTimeMarker", 0.1, 1.2, 0.01).name("Contact time marker")));
  uiControllers.window.push(bindController(windowFolder.add(params, "hittingWindowSamples", 20, 60, 1).name("Hitting window samples")));
  uiControllers.window.push(bindController(windowFolder.add(params, "envelopeSampleFocus", ["Green", "Balanced", "All"]).name("Envelope samples focus on")));

  const spikeFolder = gui.addFolder("Possible Spike Space");
  bindController(spikeFolder.add(params, "showPossibleSpikeSpace").name("Show possible spike space"));
  bindController(spikeFolder.add(params, "show3DBoundaryStructure").name("Show 3D boundary structure"));
  bindController(spikeFolder.add(params, "showBlockedSpikePaths").name("Show blocked spike paths"));
  bindController(spikeFolder.add(params, "landingAreaResolution", 20, 90, 1).name("Landing area resolution"));
  bindController(spikeFolder.add(params, "trajectorySmoothness", 6, 20, 1).name("Trajectory smoothness"));
  bindController(spikeFolder.add(params, "numberOfSpikePathsShown", 200, 2000, 10).name("Number of spike paths shown"));

  const blockFolder = gui.addFolder("Blockers");
  bindController(blockFolder.add(params, "numberOfBlockers", [0, 1, 2, 3]).name("Number of blockers"));
  bindController(blockFolder.add(params, "blockShadeInside", 0.0, 1.0, 0.01).name("Block shade inside"));
  bindController(blockFolder.add(params, "blockerGap", 0.0, 0.3, 0.01).name("Blocker gap"));
  bindController(blockFolder.add(params, "handsWidthPerBlocker", 0.3, 1.2, 0.05).name("Hands width per blocker"));
  bindController(blockFolder.add(params, "handsReachAboveNet", 0.2, 1.2, 0.05).name("Hands reach above net"));
  bindController(blockFolder.add(params, "handGap", -0.05, 0.15, 0.01).name("Hand gap"));
  bindController(blockFolder.add(params, "pressOverNet", 0.0, 0.35, 0.01).name("Press over the net"));
  bindController(blockFolder.add(params, "pressOverAngle", 0, 25, 1).name("Press over angle"));
  bindController(blockFolder.add(params, "wristOverAmount", 0, 20, 1).name("Wrist over amount"));
  bindController(blockFolder.add(params, "blockTiming", ["Early", "Normal", "Late"]).name("Block timing"));
  bindController(blockFolder.add(params, "blockReactionSpeed", 0.0, 1.0, 0.01).name("Block reaction speed"));
  bindController(blockFolder.add(params, "blockFollowsBall").name("Block follows ball"));
  bindController(blockFolder.add(params, "followStrength", 0.0, 1.0, 0.01).name("Follow strength"));
  bindController(blockFolder.add(params, "followDelayMs", 20, 400, 5).name("Follow delay (ms)"));

  const perfFolder = gui.addFolder("Performance");
  bindController(perfFolder.add(params, "pauseSpikeSpaceWhileAdjusting").name("Pause spike-space updates while sliding"));

  const manualFolder = gui.addFolder("Manual Launch + Spin");
  controlRefs.launchSpeed = bindController(manualFolder.add(params, "launchSpeed", 1, 20, 0.1).name("Launch speed"));
  uiControllers.manual.push(controlRefs.launchSpeed);
  controlRefs.launchElevationAngle = bindController(manualFolder.add(params, "launchElevationAngle", 5, 85, 0.5).name("Launch elevation angle"));
  uiControllers.manual.push(controlRefs.launchElevationAngle);
  controlRefs.launchDirectionLeftRight = bindController(manualFolder.add(params, "launchDirectionLeftRight", -60, 60, 1).name("Launch direction (left-right)"));
  uiControllers.manual.push(controlRefs.launchDirectionLeftRight);
  uiControllers.manual.push(bindController(manualFolder.add(params, "spinType", ["Topspin", "Backspin"]).name("Spin type")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "spinRateRps", 0, 50, 0.5).name("Spin rate")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "spinAxisTilt", -30, 30, 1).name("Spin axis tilt")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "airDrag").name("Air drag")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "magnusEffect").name("Magnus effect")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "dragStrength", 0.001, 0.05, 0.001).name("Drag strength")));
  uiControllers.manual.push(bindController(manualFolder.add(params, "magnusStrength", 0.0001, 0.01, 0.0001).name("Magnus strength")));

  const viewFolder = gui.addFolder("View");
  bindController(viewFolder.add(params, "cameraSensitivity", 0.2, 3.0, 0.01).name("Camera sensitivity")).onChange(() => {
    applyCameraSensitivity();
    scheduleRebuild(false);
  });
  viewFolder.add({ resetView }, "resetView").name("Reset view");
  viewFolder.add({ hitterPOVView }, "hitterPOVView").name("Hitter POV");

  [modelFolder, netFolder, setFolder, singleFolder, windowFolder, spikeFolder, blockFolder, perfFolder, manualFolder, viewFolder].forEach((f) => f.open());
  setModeVisibility();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (let i = 0; i < trajectoryLineMaterials.length; i++) {
    trajectoryLineMaterials[i].resolution.set(window.innerWidth, window.innerHeight);
  }
});

function animate() {
  requestAnimationFrame(animate);
  camera.up.set(0, 0, 1);
  if (params.showJumpMotion && activeBandPivot && activeBandWindow) {
    const airTime = Math.max(0.2, params.totalAirTime);
    const loopT = sceneClock.getElapsedTime() % airTime;
    const peakTime = getJumpPeakTime(activeBandNominalTime);
    const jumpStart = peakTime - clamp(params.timeToPeakJump, 0.05, airTime - 0.05);
    const frame = getBandFrameAtTime(activeBandWindow, jumpStart + loopT, activeBandNominalTime);
    activeBandPivot.position.copy(frame.position);
    activeBandPivot.quaternion.copy(frame.quat);
  }
  controls.update();
  updateContactLabel();
  renderer.render(scene, camera);
}

function main() {
  drawStaticWorld();
  applyCameraSensitivity();
  setupGui();
  rebuild({ computeSpikeSpace: true });
  animate();
}

main();
