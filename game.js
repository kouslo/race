import * as THREE from "three";

// ---------- Setup ----------
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88c5ff);
scene.fog = new THREE.Fog(0x88c5ff, 200, 800);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x3a5a2a, 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5e1, 1.2);
sun.position.set(120, 200, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -250;
sun.shadow.camera.right = 250;
sun.shadow.camera.top = 250;
sun.shadow.camera.bottom = -250;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- Track ----------
// 2D control points (XZ plane). Track is centered around origin.
const trackPoints2D = [
    [-200,  -80],
    [-100, -130],
    [   0, -150],
    [ 120, -130],
    [ 200,  -60],
    [ 230,   40],
    [ 180,  120],
    [  80,  150],
    [ -30,  100],
    [ -90,  140],
    [-180,  130],
    [-230,   40],
    [-220,  -40],
];

const curve = new THREE.CatmullRomCurve3(
    trackPoints2D.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.5
);

const TRACK_WIDTH = 14;
const TRACK_DIVISIONS = 400;

// Generate track mesh as a ribbon
function buildTrack() {
    const positions = [];
    const uvs = [];
    const indices = [];
    const centerPoints = [];

    for (let i = 0; i <= TRACK_DIVISIONS; i++) {
        const t = i / TRACK_DIVISIONS;
        const p = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const left = p.clone().addScaledVector(normal, TRACK_WIDTH / 2);
        const right = p.clone().addScaledVector(normal, -TRACK_WIDTH / 2);

        positions.push(left.x, 0.02, left.z);
        positions.push(right.x, 0.02, right.z);
        uvs.push(0, t * 60);
        uvs.push(1, t * 60);

        centerPoints.push(p);

        if (i < TRACK_DIVISIONS) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2);
            indices.push(a + 1, a + 3, a + 2);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Asphalt texture (procedural)
    const tex = makeAsphaltTexture();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0x4a4a4f,
        roughness: 0.95,
        metalness: 0.05,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return { mesh, centerPoints };
}

function makeAsphaltTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#3a3a3f";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const v = 30 + Math.random() * 60;
        g.fillStyle = `rgb(${v},${v},${v + 4})`;
        g.fillRect(x, y, 1, 1);
    }
    // center yellow dashed line
    g.fillStyle = "#e8c43b";
    for (let y = 0; y < 256; y += 32) {
        g.fillRect(126, y, 4, 18);
    }
    return new THREE.CanvasTexture(c);
}

const trackData = buildTrack();
scene.add(trackData.mesh);
const centerLine = trackData.centerPoints;

// Curb stripes along the sides
function buildCurbs() {
    const group = new THREE.Group();
    const segs = 200;
    for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const color = i % 2 === 0 ? 0xff3030 : 0xffffff;

        const geo = new THREE.BoxGeometry(1.6, 0.25, curve.getLength() / segs * 1.1);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

        const left = new THREE.Mesh(geo, mat);
        const lp = p.clone().addScaledVector(norm, TRACK_WIDTH / 2 + 0.8);
        left.position.set(lp.x, 0.12, lp.z);
        left.lookAt(lp.x + tan.x, 0.12, lp.z + tan.z);
        left.castShadow = true;
        left.receiveShadow = true;
        group.add(left);

        const right = new THREE.Mesh(geo, mat);
        const rp = p.clone().addScaledVector(norm, -(TRACK_WIDTH / 2 + 0.8));
        right.position.set(rp.x, 0.12, rp.z);
        right.lookAt(rp.x + tan.x, 0.12, rp.z + tan.z);
        right.castShadow = true;
        right.receiveShadow = true;
        group.add(right);
    }
    return group;
}
scene.add(buildCurbs());

// Ground
const groundGeo = new THREE.PlaneGeometry(2000, 2000, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// Trees scattered around (avoid track)
function isFarFromTrack(x, z, minDist) {
    let min = Infinity;
    for (let i = 0; i < centerLine.length; i++) {
        const p = centerLine[i];
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < min) min = d;
        if (min < minDist) return false;
    }
    return min >= minDist;
}

function makeTree(x, z) {
    const group = new THREE.Group();
    const trunkH = 4 + Math.random() * 2;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, trunkH, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 + Math.random(), 6 + Math.random() * 2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2d6a2d, roughness: 1 })
    );
    leaves.position.y = trunkH + 2.5;
    leaves.castShadow = true;
    group.add(leaves);

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    return group;
}

const trees = new THREE.Group();
for (let i = 0; i < 250; i++) {
    let x, z, tries = 0;
    do {
        x = (Math.random() - 0.5) * 700;
        z = (Math.random() - 0.5) * 600;
        tries++;
    } while (tries < 20 && !isFarFromTrack(x, z, TRACK_WIDTH / 2 + 8));
    if (tries < 20) trees.add(makeTree(x, z));
}
scene.add(trees);

// Distant mountains (billboard-ish)
function buildMountains() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a7a85, roughness: 1, flatShading: true });
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r = 700 + Math.random() * 80;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = 40 + Math.random() * 80;
        const m = new THREE.Mesh(new THREE.ConeGeometry(40 + Math.random() * 20, h, 5), mat);
        m.position.set(x, h / 2 - 2, z);
        group.add(m);
    }
    return group;
}
scene.add(buildMountains());

// Start/finish line marker
function buildStartLine() {
    const t0 = curve.getPointAt(0);
    const tan = curve.getTangentAt(0);
    const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const group = new THREE.Group();
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const g = c.getContext("2d");
    const sq = 32;
    for (let y = 0; y < c.height / sq; y++) {
        for (let x = 0; x < c.width / sq; x++) {
            g.fillStyle = (x + y) % 2 === 0 ? "#fff" : "#000";
            g.fillRect(x * sq, y * sq, sq, sq);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    const lineGeo = new THREE.PlaneGeometry(TRACK_WIDTH, 3);
    const lineMat = new THREE.MeshStandardMaterial({ map: tex });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(t0.x, 0.03, t0.z);
    line.lookAt(t0.x + norm.x, 0.03, t0.z + norm.z);
    line.rotateX(-Math.PI / 2);
    group.add(line);

    // gantry arches on each side
    const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
    const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    const lp = t0.clone().addScaledVector(norm, TRACK_WIDTH / 2 + 1);
    const rp = t0.clone().addScaledVector(norm, -(TRACK_WIDTH / 2 + 1));
    leftPost.position.set(lp.x, 4, lp.z);
    rightPost.position.set(rp.x, 4, rp.z);
    leftPost.castShadow = true;
    rightPost.castShadow = true;
    group.add(leftPost, rightPost);

    const beamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 1.2, 1);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xef476f, roughness: 0.5 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(t0.x, 8.6, t0.z);
    beam.lookAt(t0.x + tan.x, 8.6, t0.z + tan.z);
    beam.castShadow = true;
    group.add(beam);

    return group;
}
scene.add(buildStartLine());

// ---------- Car ----------
function buildCar() {
    const car = new THREE.Group();

    // Chassis
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xc1121f, roughness: 0.35, metalness: 0.55 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111a25, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.2, metalness: 1.0 });

    // Lower body (main hull)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.4), chassisMat);
    lowerBody.position.y = 0.55;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    // Hood (front lower)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.35, 1.5), chassisMat);
    hood.position.set(0, 0.95, -1.2);
    hood.castShadow = true;
    car.add(hood);

    // Cabin (sloped roof) — use bevelled box
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-1.4, 0);
    cabinShape.lineTo(-0.9, 0.7);
    cabinShape.lineTo(0.7, 0.7);
    cabinShape.lineTo(1.2, 0);
    cabinShape.lineTo(-1.4, 0);
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.8, bevelEnabled: false });
    const cabin = new THREE.Mesh(cabinGeo, chassisMat);
    cabin.rotation.y = Math.PI / 2;
    cabin.position.set(0.9, 0.85, 0.4);
    cabin.castShadow = true;
    car.add(cabin);

    // Windshield (front, tilted)
    const wsGeo = new THREE.PlaneGeometry(1.7, 0.85);
    const ws = new THREE.Mesh(wsGeo, glassMat);
    ws.position.set(0, 1.15, -0.45);
    ws.rotation.x = -Math.PI / 2 + 0.5;
    car.add(ws);

    // Rear window
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), glassMat);
    rw.position.set(0, 1.15, 1.1);
    rw.rotation.x = -Math.PI / 2 - 0.55;
    car.add(rw);

    // Side windows
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), glassMat);
    sw1.position.set(1.01, 1.12, 0.35);
    sw1.rotation.y = -Math.PI / 2;
    car.add(sw1);
    const sw2 = sw1.clone();
    sw2.position.x = -1.01;
    sw2.rotation.y = Math.PI / 2;
    car.add(sw2);

    // Trunk / rear deck
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.35, 0.9), chassisMat);
    trunk.position.set(0, 0.95, 1.65);
    trunk.castShadow = true;
    car.add(trunk);

    // Front grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.1), accentMat);
    grille.position.set(0, 0.7, -2.15);
    car.add(grille);

    // Bumpers
    const bumperGeo = new THREE.BoxGeometry(2.0, 0.25, 0.25);
    const fb = new THREE.Mesh(bumperGeo, chromeMat);
    fb.position.set(0, 0.42, -2.15);
    car.add(fb);
    const rb = new THREE.Mesh(bumperGeo, chromeMat);
    rb.position.set(0, 0.42, 2.15);
    car.add(rb);

    // Headlights
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe599, emissiveIntensity: 0.9 });
    const hlGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const hl1 = new THREE.Mesh(hlGeo, hlMat);
    hl1.position.set(-0.72, 0.75, -2.18);
    hl1.scale.set(1.4, 0.8, 0.6);
    car.add(hl1);
    const hl2 = hl1.clone();
    hl2.position.x = 0.72;
    car.add(hl2);

    // Tail lights
    const tlMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.7 });
    const tlGeo = new THREE.BoxGeometry(0.55, 0.18, 0.1);
    const tl1 = new THREE.Mesh(tlGeo, tlMat);
    tl1.position.set(-0.66, 0.92, 2.18);
    car.add(tl1);
    const tl2 = tl1.clone();
    tl2.position.x = 0.66;
    car.add(tl2);

    // Side mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.25, 0.18, 0.35);
    const m1 = new THREE.Mesh(mirrorGeo, chassisMat);
    m1.position.set(1.08, 1.0, -0.3);
    car.add(m1);
    const m2 = m1.clone();
    m2.position.x = -1.08;
    car.add(m2);

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 });
    function makeWheel() {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 24), wheelMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        g.add(tire);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.34, 6), rimMat);
        rim.rotation.z = Math.PI / 2;
        g.add(rim);
        return g;
    }

    const wheelPositions = [
        { x: -0.95, y: 0.45, z: -1.35, front: true,  name: "fl" },
        { x:  0.95, y: 0.45, z: -1.35, front: true,  name: "fr" },
        { x: -0.95, y: 0.45, z:  1.45, front: false, name: "rl" },
        { x:  0.95, y: 0.45, z:  1.45, front: false, name: "rr" },
    ];
    const wheels = {};
    wheelPositions.forEach(wp => {
        const pivot = new THREE.Group();
        pivot.position.set(wp.x, wp.y, wp.z);
        const w = makeWheel();
        pivot.add(w);
        car.add(pivot);
        wheels[wp.name] = { pivot, wheel: w, front: wp.front };
    });

    // Headlight cones (actual lights)
    const spotL = new THREE.SpotLight(0xfff2c0, 0, 60, Math.PI / 7, 0.4, 1.5);
    spotL.position.set(-0.7, 0.8, -2.2);
    spotL.target.position.set(-0.7, 0.0, -20);
    car.add(spotL);
    car.add(spotL.target);

    return { group: car, wheels };
}

const carData = buildCar();
const car = carData.group;
scene.add(car);

// ---------- Game state ----------
const state = {
    mode: "menu", // menu, playing, finished
    speed: 0,         // units per second along forward dir
    maxSpeed: 80,     // ~ 288 km/h scaled
    maxReverse: -25,
    accel: 28,
    brake: 55,
    friction: 8,
    steerAngle: 0,
    maxSteer: 0.55,
    angle: 0,         // heading on XZ plane
    cameraMode: 0,    // 0 chase, 1 hood, 2 cockpit
    totalLaps: 3,
    lap: 1,
    elapsed: 0,
    lapStart: 0,
    bestLap: null,
    checkpointsHit: [],
    checkpoints: [],
};

// Place checkpoints along the track
const NUM_CP = 12;
for (let i = 0; i < NUM_CP; i++) {
    const p = curve.getPointAt(i / NUM_CP);
    state.checkpoints.push({ x: p.x, z: p.z, idx: i });
}

function resetCar() {
    const start = curve.getPointAt(0);
    const tan = curve.getTangentAt(0);
    car.position.set(start.x, 0, start.z);
    state.angle = Math.atan2(tan.x, tan.z);
    car.rotation.y = state.angle;
    state.speed = 0;
    state.lap = 1;
    state.elapsed = 0;
    state.lapStart = 0;
    state.checkpointsHit = [];
    updateHUD();
}

// ---------- Input ----------
const keys = {};
window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
    if (e.key.toLowerCase() === "c") {
        state.cameraMode = (state.cameraMode + 1) % 3;
    }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- Distance to track helper ----------
function distanceToTrack(x, z) {
    let min = Infinity;
    for (let i = 0; i < centerLine.length; i++) {
        const a = centerLine[i];
        const b = centerLine[(i + 1) % centerLine.length];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len2 = dx * dx + dz * dz;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + t * dx, cz = a.z + t * dz;
        const d = Math.hypot(x - cx, z - cz);
        if (d < min) min = d;
    }
    return min;
}

// ---------- Update ----------
function update(dt) {
    if (state.mode !== "playing") return;

    const accelerating = keys["arrowup"] || keys["w"];
    const reversing = keys["arrowdown"] || keys["s"];
    const left = keys["arrowleft"] || keys["a"];
    const right = keys["arrowright"] || keys["d"];
    const handbrake = keys[" "];

    if (accelerating) {
        state.speed += state.accel * dt;
    } else if (reversing) {
        if (state.speed > 0) state.speed -= state.brake * dt;
        else state.speed -= state.accel * 0.6 * dt;
    } else {
        if (state.speed > 0) state.speed = Math.max(0, state.speed - state.friction * dt);
        else if (state.speed < 0) state.speed = Math.min(0, state.speed + state.friction * dt);
    }

    if (handbrake) {
        const decel = 40 * dt;
        if (state.speed > 0) state.speed = Math.max(0, state.speed - decel);
        else if (state.speed < 0) state.speed = Math.min(0, state.speed + decel);
    }

    state.speed = Math.max(state.maxReverse, Math.min(state.maxSpeed, state.speed));

    // Off-track penalty
    const trackDist = distanceToTrack(car.position.x, car.position.z);
    if (trackDist > TRACK_WIDTH / 2) {
        const over = trackDist - TRACK_WIDTH / 2;
        const slow = Math.min(50, 10 + over) * dt;
        if (state.speed > 0) state.speed = Math.max(0, state.speed - slow);
        else if (state.speed < 0) state.speed = Math.min(0, state.speed + slow);
        const offMax = 28;
        if (state.speed > offMax) state.speed = offMax;
        if (state.speed < -offMax) state.speed = -offMax;
    }

    // Steering
    let targetSteer = 0;
    if (left) targetSteer += state.maxSteer;
    if (right) targetSteer -= state.maxSteer;
    state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * 10);

    const speedRatio = Math.min(1, Math.abs(state.speed) / state.maxSpeed);
    const turnAmount = state.steerAngle * speedRatio * dt * 2.2 * Math.sign(state.speed || 1);
    state.angle += turnAmount;

    // Movement
    car.position.x += Math.sin(state.angle) * state.speed * dt;
    car.position.z += Math.cos(state.angle) * state.speed * dt;
    car.rotation.y = state.angle;

    // Spin wheels & steer front wheels
    const wheelRotSpeed = state.speed / 0.45;
    Object.values(carData.wheels).forEach(w => {
        w.wheel.rotation.x += wheelRotSpeed * dt;
        if (w.front) w.pivot.rotation.y = state.steerAngle;
    });

    // Subtle body roll / pitch
    const roll = -state.steerAngle * speedRatio * 0.08;
    const pitch = (accelerating ? -0.03 : reversing ? 0.04 : 0) * speedRatio;
    car.rotation.z = roll;
    car.rotation.x = pitch;

    // Checkpoint logic
    for (let i = 0; i < state.checkpoints.length; i++) {
        const cp = state.checkpoints[i];
        const d = Math.hypot(car.position.x - cp.x, car.position.z - cp.z);
        if (d < 10 && !state.checkpointsHit.includes(i)) {
            const expected = state.checkpointsHit.length === 0
                ? 0
                : (state.checkpointsHit[state.checkpointsHit.length - 1] + 1) % state.checkpoints.length;
            if (i === expected) state.checkpointsHit.push(i);
        }
    }

    if (state.checkpointsHit.length === state.checkpoints.length) {
        const lapTime = state.elapsed - state.lapStart;
        if (state.bestLap === null || lapTime < state.bestLap) state.bestLap = lapTime;
        state.lapStart = state.elapsed;
        state.checkpointsHit = [];
        state.lap++;
        if (state.lap > state.totalLaps) {
            state.mode = "finished";
            document.getElementById("final-time").textContent = state.elapsed.toFixed(2);
            document.getElementById("final-best").textContent = (state.bestLap || 0).toFixed(2);
            document.getElementById("finish-overlay").classList.remove("hidden");
        }
    }

    state.elapsed += dt;

    if (keys["r"]) {
        resetCar();
        keys["r"] = false;
    }

    updateHUD();
}

// ---------- Camera ----------
const camOffset = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

function updateCamera(dt) {
    let desired = new THREE.Vector3();
    let lookAt = new THREE.Vector3();
    let lerpFactor = 4;

    if (state.cameraMode === 0) {
        // Chase
        const back = 9;
        const up = 4;
        desired.set(
            car.position.x - Math.sin(state.angle) * back,
            car.position.y + up,
            car.position.z - Math.cos(state.angle) * back
        );
        lookAt.set(
            car.position.x + Math.sin(state.angle) * 4,
            car.position.y + 1.2,
            car.position.z + Math.cos(state.angle) * 4
        );
        lerpFactor = 6;
    } else if (state.cameraMode === 1) {
        // Hood
        desired.set(
            car.position.x + Math.sin(state.angle) * 0.8,
            car.position.y + 1.4,
            car.position.z + Math.cos(state.angle) * 0.8
        );
        lookAt.set(
            car.position.x + Math.sin(state.angle) * 20,
            car.position.y + 1.0,
            car.position.z + Math.cos(state.angle) * 20
        );
        lerpFactor = 12;
    } else {
        // Cockpit / overhead
        desired.set(car.position.x, car.position.y + 40, car.position.z);
        lookAt.set(car.position.x + Math.sin(state.angle) * 5, 0, car.position.z + Math.cos(state.angle) * 5);
        lerpFactor = 6;
    }

    camera.position.lerp(desired, Math.min(1, dt * lerpFactor));
    camTarget.lerp(lookAt, Math.min(1, dt * lerpFactor));
    camera.lookAt(camTarget);
}

// ---------- HUD ----------
const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const lapEl = document.getElementById("lap");
const totalLapsEl = document.getElementById("total-laps");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const needle = document.getElementById("needle");

// Speedometer ticks
const ticks = document.getElementById("ticks");
for (let i = 0; i <= 12; i++) {
    const ang = -120 + (i * 240 / 12);
    const rad = (ang - 90) * Math.PI / 180;
    const x1 = 100 + Math.cos(rad) * 78;
    const y1 = 100 + Math.sin(rad) * 78;
    const x2 = 100 + Math.cos(rad) * 88;
    const y2 = 100 + Math.sin(rad) * 88;
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", x1);
    tick.setAttribute("y1", y1);
    tick.setAttribute("x2", x2);
    tick.setAttribute("y2", y2);
    tick.setAttribute("stroke", "#fff");
    tick.setAttribute("stroke-width", i % 3 === 0 ? 2 : 1);
    ticks.appendChild(tick);
}

function kmh() { return Math.abs(state.speed) * 3.6 * 1.6; }

function updateHUD() {
    const k = Math.round(kmh());
    speedEl.textContent = k;
    if (state.speed > 1) gearEl.textContent = Math.min(6, Math.ceil(state.speed / 14));
    else if (state.speed < -1) gearEl.textContent = "R";
    else gearEl.textContent = "N";
    lapEl.textContent = state.lap;
    totalLapsEl.textContent = state.totalLaps;
    timeEl.textContent = state.elapsed.toFixed(2);
    bestEl.textContent = state.bestLap === null ? "--" : state.bestLap.toFixed(2) + "s";

    // needle: -120deg at 0, +120deg at max
    const ratio = Math.min(1, k / 320);
    const deg = -120 + ratio * 240;
    needle.setAttribute("transform", `rotate(${deg} 100 100)`);
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

// ---------- UI ----------
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("overlay").classList.add("hidden");
    state.mode = "playing";
    resetCar();
});
document.getElementById("restart-btn").addEventListener("click", () => {
    document.getElementById("finish-overlay").classList.add("hidden");
    state.mode = "playing";
    resetCar();
});

resetCar();
// position camera initially behind the car
const start = curve.getPointAt(0);
camera.position.set(start.x - Math.sin(state.angle) * 12, 6, start.z - Math.cos(state.angle) * 12);
camTarget.set(start.x, 1, start.z);
camera.lookAt(camTarget);

requestAnimationFrame(loop);
