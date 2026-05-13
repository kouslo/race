// THREE is loaded as a global via <script> tag in index.html.
(function () {

// ---------- Setup ----------
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// keep legacy lighting math so intensity values are straightforward multipliers
if ("useLegacyLights" in renderer) renderer.useLegacyLights = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 4000);

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ---------- HDRI-style atmospheric scattering sky ----------
const SUN_DIR = new THREE.Vector3(0.42, 0.30, 0.86).normalize();

function buildSky() {
    const skyGeo = new THREE.SphereGeometry(1800, 64, 40);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            sunDir:      { value: SUN_DIR.clone() },
            rayleighCol: { value: new THREE.Color(0.20, 0.45, 0.95) },
            mieCol:      { value: new THREE.Color(1.00, 0.78, 0.55) },
            groundCol:   { value: new THREE.Color(0.18, 0.16, 0.14) },
            sunIntensity:{ value: 22.0 },
            sunDiscSize: { value: 0.9986 },
            exposure:    { value: 0.42 },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main() {
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 sunDir;
            uniform vec3 rayleighCol;
            uniform vec3 mieCol;
            uniform vec3 groundCol;
            uniform float sunIntensity;
            uniform float sunDiscSize;
            uniform float exposure;
            varying vec3 vWorldPos;

            // Henyey-Greenstein phase
            float hgPhase(float cosT, float g) {
                float g2 = g * g;
                return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosT, 1.5));
            }

            void main() {
                vec3 dir = normalize(vWorldPos);
                float upDot = clamp(dir.y, -1.0, 1.0);
                vec3 sd = normalize(sunDir);
                float cosTheta = dot(dir, sd);

                // Below-horizon ground
                if (upDot < -0.02) {
                    vec3 g = mix(groundCol, rayleighCol * 0.05, smoothstep(-0.02, 0.05, upDot));
                    gl_FragColor = vec4(g, 1.0);
                    return;
                }

                // Atmospheric thickness approximation
                float zenith = 1.0 - upDot * 0.85;
                float thickness = 1.0 / max(0.04, upDot + 0.08);

                // Rayleigh (blue) scattering — more at zenith
                float rayleighPhase = 0.75 * (1.0 + cosTheta * cosTheta);
                vec3 rayleigh = rayleighCol * rayleighPhase * thickness * 0.55;

                // Mie (forward, around sun) scattering — orange near horizon
                float mie = hgPhase(cosTheta, 0.78);
                vec3 mieScat = mieCol * mie * thickness * 1.2;

                // Sun extinction toward horizon (warmer + redder near horizon)
                float sunHeight = clamp(sd.y, 0.0, 1.0);
                float horizonShift = pow(1.0 - sunHeight, 4.0);
                vec3 sunTint = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.25), horizonShift);

                // Sun disc + glow
                float disc = smoothstep(sunDiscSize, 1.0, cosTheta);
                float glow = smoothstep(0.94, 1.0, cosTheta);
                vec3 sunColor = sunTint * sunIntensity * (disc + glow * 0.4);

                vec3 col = (rayleigh + mieScat) * sunTint;
                col += sunColor;

                // Horizon haze lift
                float haze = pow(1.0 - max(upDot, 0.0), 6.0);
                col = mix(col, vec3(1.05, 0.85, 0.70) * 0.75, haze * 0.55);

                // Exposure & subtle ACES-ish tonemap
                col *= exposure;
                col = col / (col + 0.155) * 1.019;
                col = pow(col, vec3(1.0 / 1.05));

                gl_FragColor = vec4(col, 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false,
    });
    return new THREE.Mesh(skyGeo, skyMat);
}
const sky = buildSky();
scene.add(sky);

scene.fog = new THREE.FogExp2(0xd5a878, 0.0045);
scene.background = new THREE.Color(0x6ea8d8);

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x3a5a2a, 0.45);
scene.add(hemi);

// Golden-hour key light — low angle, warm
const sun = new THREE.DirectionalLight(0xffd9a0, 1.7);
sun.position.set(70, 70, 110);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 6;
scene.add(sun);
scene.add(sun.target);

// Cool rim/back light for atmospheric depth
const rim = new THREE.DirectionalLight(0x7fa3d8, 0.55);
rim.position.set(-80, 50, -90);
scene.add(rim);

// Bounce light — warm light from below to fake ground bounce
const bounce = new THREE.DirectionalLight(0xffcc88, 0.18);
bounce.position.set(0, -20, 30);
scene.add(bounce);

// ---------- Lens flare (sun sprite + ghost ring) ----------
function makeFlareTexture(color, falloff) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, color);
    grd.addColorStop(falloff, color.replace(/[\d.]+\)$/, "0.4)"));
    grd.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const sunFlareMat = new THREE.SpriteMaterial({
    map: makeFlareTexture("rgba(255,230,180,1)", 0.3),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
});
const sunFlare = new THREE.Sprite(sunFlareMat);
sunFlare.scale.set(180, 180, 1);
sunFlare.renderOrder = 999;
scene.add(sunFlare);

const flareGhostMat = new THREE.SpriteMaterial({
    map: makeFlareTexture("rgba(255,160,90,1)", 0.4),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    opacity: 0.55,
});
const flareGhost = new THREE.Sprite(flareGhostMat);
flareGhost.scale.set(60, 60, 1);
flareGhost.renderOrder = 998;
scene.add(flareGhost);

// ---------- Environment map (for PBR reflections) ----------
function buildEnvMap() {
    // Procedural sky -> equirect texture -> PMREM
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size * 2; c.height = size;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0.0, "#153560");
    grad.addColorStop(0.4, "#6ea8d8");
    grad.addColorStop(0.55, "#ffb478");
    grad.addColorStop(0.62, "#7a6040");
    grad.addColorStop(0.7, "#3a4a30");
    grad.addColorStop(1.0, "#0e1a10");
    g.fillStyle = grad;
    g.fillRect(0, 0, size * 2, size);
    // Sun spot
    const sg = g.createRadialGradient(size * 1.3, size * 0.35, 0, size * 1.3, size * 0.35, size * 0.3);
    sg.addColorStop(0, "rgba(255,240,200,1)");
    sg.addColorStop(0.2, "rgba(255,210,150,0.7)");
    sg.addColorStop(1, "rgba(255,210,150,0)");
    g.fillStyle = sg;
    g.fillRect(0, 0, size * 2, size);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return envRT.texture;
}
scene.environment = buildEnvMap();

// ---------- Road / Lanes ----------
const NUM_LANES = 5;
const LANE_WIDTH = 4;
const ROAD_HALF = (NUM_LANES * LANE_WIDTH) / 2; // 10
const SHOULDER = 2;
const ROAD_TOTAL_HALF = ROAD_HALF + SHOULDER;   // 12

const LANE_X = [];
for (let i = 0; i < NUM_LANES; i++) {
    LANE_X.push(-ROAD_HALF + LANE_WIDTH / 2 + i * LANE_WIDTH);
}

const SEG_LENGTH = 40;
const NUM_SEGS = 24;
const ROAD_REPEAT = SEG_LENGTH * NUM_SEGS;

function makeAsphaltTextures() {
    const SIZE = 512;
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const g = c.getContext("2d");

    // Albedo
    g.fillStyle = "#26262a";
    g.fillRect(0, 0, SIZE, SIZE);
    // Aggregate (small stones)
    for (let i = 0; i < 18000; i++) {
        const v = 20 + Math.random() * 50;
        const r = Math.random() * 1.5 + 0.5;
        g.fillStyle = `rgb(${v},${v},${v + Math.random() * 6})`;
        g.beginPath();
        g.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, Math.PI * 2);
        g.fill();
    }
    // Long tire streaks
    for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(${15 + Math.random() * 10}, ${15 + Math.random() * 10}, ${20 + Math.random() * 10}, 0.6)`;
        g.fillRect(Math.random() * SIZE, 0, 0.6, SIZE);
    }
    // Subtle oil patches
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        const r = 30 + Math.random() * 50;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, "rgba(10,10,20,0.6)");
        rg.addColorStop(1, "rgba(10,10,20,0)");
        g.fillStyle = rg;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const albedo = new THREE.CanvasTexture(c);
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.repeat.set(2, 8);
    albedo.anisotropy = MAX_ANISO;
    albedo.colorSpace = THREE.SRGBColorSpace;

    // Normal map — derive bumps from grayscale brightness
    const nc = document.createElement("canvas");
    nc.width = nc.height = SIZE;
    const ng = nc.getContext("2d");
    const img = g.getImageData(0, 0, SIZE, SIZE).data;
    const out = ng.createImageData(SIZE, SIZE);
    const odata = out.data;
    function lum(x, y) {
        x = (x + SIZE) % SIZE; y = (y + SIZE) % SIZE;
        const idx = (y * SIZE + x) * 4;
        return (img[idx] + img[idx + 1] + img[idx + 2]) / 3;
    }
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dx = (lum(x + 1, y) - lum(x - 1, y)) / 255;
            const dy = (lum(x, y + 1) - lum(x, y - 1)) / 255;
            const nx = -dx * 2.5;
            const ny = -dy * 2.5;
            const nz = 1.0;
            const len = Math.hypot(nx, ny, nz);
            const idx = (y * SIZE + x) * 4;
            odata[idx]     = Math.round((nx / len * 0.5 + 0.5) * 255);
            odata[idx + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
            odata[idx + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
            odata[idx + 3] = 255;
        }
    }
    ng.putImageData(out, 0, 0);
    const normal = new THREE.CanvasTexture(nc);
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(2, 8);
    normal.anisotropy = MAX_ANISO;

    return { albedo, normal };
}

const asphalt = makeAsphaltTextures();
const roadMat = new THREE.MeshPhysicalMaterial({
    map: asphalt.albedo,
    normalMap: asphalt.normal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    color: 0x4a4a52,
    roughness: 0.78,
    metalness: 0.0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.6,
});
const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x1f1f24, roughness: 0.95 });

function makeGrassTexture() {
    const SIZE = 256;
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const g = c.getContext("2d");
    g.fillStyle = "#3d6b2f";
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 6000; i++) {
        const r = 30 + Math.random() * 50;
        const gr = 60 + Math.random() * 50;
        const b = 20 + Math.random() * 30;
        g.fillStyle = `rgb(${r},${gr},${b})`;
        g.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1.5, 1.5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 80);
    tex.anisotropy = MAX_ANISO;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
const grassMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), color: 0xffffff, roughness: 1 });

function makeRoadSegment() {
    const g = new THREE.Group();

    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_HALF * 2, SEG_LENGTH),
        roadMat
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    g.add(road);

    [-1, 1].forEach(side => {
        const sh = new THREE.Mesh(
            new THREE.PlaneGeometry(SHOULDER, SEG_LENGTH),
            shoulderMat
        );
        sh.rotation.x = -Math.PI / 2;
        sh.position.x = side * (ROAD_HALF + SHOULDER / 2);
        sh.position.y = 0.005;
        sh.receiveShadow = true;
        g.add(sh);
    });

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-ROAD_HALF + 0.15, ROAD_HALF - 0.15].forEach(x => {
        const line = new THREE.Mesh(
            new THREE.PlaneGeometry(0.25, SEG_LENGTH),
            lineMat
        );
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.02, 0);
        g.add(line);
    });

    const dashLen = 4;
    const gapLen = 4;
    const dashCount = Math.floor(SEG_LENGTH / (dashLen + gapLen));
    for (let i = 1; i < NUM_LANES; i++) {
        const x = -ROAD_HALF + i * LANE_WIDTH;
        for (let j = 0; j < dashCount; j++) {
            const dash = new THREE.Mesh(
                new THREE.PlaneGeometry(0.18, dashLen),
                lineMat
            );
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(
                x,
                0.02,
                -SEG_LENGTH / 2 + dashLen / 2 + j * (dashLen + gapLen)
            );
            g.add(dash);
        }
    }

    const railMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.4, metalness: 0.8 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const z = -SEG_LENGTH / 2 + (i + 0.5) * (SEG_LENGTH / 4);
        [-1, 1].forEach(side => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), postMat);
            post.position.set(side * (ROAD_TOTAL_HALF + 0.3), 0.6, z);
            post.castShadow = true;
            g.add(post);
        });
    }
    [-1, 1].forEach(side => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, SEG_LENGTH), railMat);
        rail.position.set(side * (ROAD_TOTAL_HALF + 0.3), 0.95, 0);
        rail.castShadow = true;
        g.add(rail);
    });

    return g;
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), grassMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const roadSegments = [];
for (let i = 0; i < NUM_SEGS; i++) {
    const seg = makeRoadSegment();
    seg.position.z = i * SEG_LENGTH;
    scene.add(seg);
    roadSegments.push(seg);
}

// ---------- Side scenery ----------
// Multi-layer foliage trees — bark with normal variation, layered cones
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.95, metalness: 0 });
const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2d6a2d, roughness: 0.85, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x35783a, roughness: 0.85, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x1f5a25, roughness: 0.85, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x4a7f3a, roughness: 0.85, flatShading: true }),
];

function makeTree() {
    const g = new THREE.Group();
    const variant = Math.floor(Math.random() * 3); // 0: conifer, 1: oak, 2: small

    const trunkH = (variant === 2 ? 2.5 : 4.5) + Math.random() * 2.2;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.55, trunkH, 8),
        trunkMat
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    if (variant === 0) {
        // Conifer — 3 stacked cones
        const baseR = 2.2 + Math.random() * 0.8;
        for (let i = 0; i < 3; i++) {
            const r = baseR * (1 - i * 0.25);
            const h = 3.5 - i * 0.6;
            const c = new THREE.Mesh(
                new THREE.ConeGeometry(r, h, 8),
                leafMats[Math.floor(Math.random() * leafMats.length)]
            );
            c.position.y = trunkH + 1.5 + i * 1.6;
            c.rotation.y = Math.random() * Math.PI;
            c.castShadow = true;
            g.add(c);
        }
    } else if (variant === 1) {
        // Oak — overlapping spheres
        const baseR = 2.0 + Math.random() * 0.8;
        const cluster = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < cluster; i++) {
            const r = baseR * (0.7 + Math.random() * 0.5);
            const s = new THREE.Mesh(
                new THREE.IcosahedronGeometry(r, 0),
                leafMats[Math.floor(Math.random() * leafMats.length)]
            );
            s.position.set(
                (Math.random() - 0.5) * baseR * 1.4,
                trunkH + 1.0 + (Math.random() - 0.3) * baseR * 0.8,
                (Math.random() - 0.5) * baseR * 1.4
            );
            s.castShadow = true;
            g.add(s);
        }
    } else {
        // Small bush/shrub
        const r = 1.0 + Math.random() * 0.6;
        const s = new THREE.Mesh(
            new THREE.IcosahedronGeometry(r, 0),
            leafMats[Math.floor(Math.random() * leafMats.length)]
        );
        s.position.y = trunkH + 0.3;
        s.castShadow = true;
        g.add(s);
    }

    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
}

const trees = [];
for (let i = 0; i < 160; i++) {
    const t = makeTree();
    const side = i % 2 === 0 ? -1 : 1;
    t.position.x = side * (ROAD_TOTAL_HALF + 3 + Math.random() * 50);
    t.position.z = Math.random() * ROAD_REPEAT;
    scene.add(t);
    trees.push(t);
}

// ---------- Heightmapped mountain terrain ----------
// Multi-octave value-noise displaced plane meshes on each side of the highway
function hash2(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}
function valueNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, octaves) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise(x * freq, y * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.1;
    }
    return sum / norm;
}

// Rock + snow + dirt material (vertex-color blended via heights)
function buildTerrainStrip(opts) {
    const { width, depth, segW, segD, offsetX, offsetZ, maxH, ridgeFalloff, seedOff } = opts;
    const geo = new THREE.PlaneGeometry(width, depth, segW, segD);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const colRock = new THREE.Color(0x5a6470);
    const colRockDark = new THREE.Color(0x3a4048);
    const colDirt = new THREE.Color(0x6e5a40);
    const colGrass = new THREE.Color(0x4a6a2a);
    const colSnow = new THREE.Color(0xf4f4f8);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + offsetX;
        const z = pos.getZ(i) + offsetZ;

        // Falloff: lower near road, taller far away
        const dist = Math.abs(x - offsetX);
        const falloff = Math.pow(Math.min(1, dist / ridgeFalloff), 1.6);

        const n = fbm((x + seedOff) * 0.006, (z + seedOff) * 0.006, 5);
        const ridge = Math.pow(n, 1.8);
        const h = ridge * maxH * falloff;

        pos.setY(i, h);

        // Color by altitude + steepness
        const ratio = Math.min(1, h / (maxH * 0.7));
        if (ratio < 0.2) tmp.copy(colGrass);
        else if (ratio < 0.45) tmp.copy(colDirt).lerp(colRock, (ratio - 0.2) / 0.25);
        else if (ratio < 0.75) tmp.copy(colRock).lerp(colRockDark, (ratio - 0.45) / 0.3);
        else tmp.copy(colRockDark).lerp(colSnow, (ratio - 0.75) / 0.25);

        // Slight noise tint
        const tint = 0.85 + valueNoise(x * 0.05, z * 0.05) * 0.3;
        colors.push(tmp.r * tint, tmp.g * tint, tmp.b * tint);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0.0,
        flatShading: false,
        envMapIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(offsetX, -2, offsetZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// Left ridge
const leftTerrain = buildTerrainStrip({
    width: 700, depth: 2200,
    segW: 70, segD: 220,
    offsetX: -350, offsetZ: 800,
    maxH: 180, ridgeFalloff: 280, seedOff: 0,
});
scene.add(leftTerrain);

// Right ridge
const rightTerrain = buildTerrainStrip({
    width: 700, depth: 2200,
    segW: 70, segD: 220,
    offsetX: 350, offsetZ: 800,
    maxH: 180, ridgeFalloff: 280, seedOff: 9000,
});
scene.add(rightTerrain);

// Far hazy backdrop
const farMat = new THREE.MeshBasicMaterial({ color: 0xa6b8c8, fog: true });
for (let i = 0; i < 6; i++) {
    const w = 600 + Math.random() * 300;
    const h = 200 + Math.random() * 150;
    const shape = new THREE.Shape();
    shape.moveTo(-w/2, 0);
    let x = -w/2;
    const steps = 14;
    for (let s = 1; s <= steps; s++) {
        x += w / steps;
        const y = h * (0.4 + 0.6 * Math.sin(s * 0.7 + i * 1.3) * 0.5 + 0.5 * Math.random());
        shape.lineTo(x, Math.max(20, y));
    }
    shape.lineTo(w/2, 0);
    shape.lineTo(-w/2, 0);
    const geo = new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(geo, farMat);
    m.position.set((i % 2 === 0 ? -1 : 1) * (600 + i * 30), 0, 1000 + i * 100);
    m.rotation.y = (i % 2 === 0 ? 0.2 : -0.2);
    scene.add(m);
}

// ---------- Volumetric ground fog ----------
function makeFogLayer() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,200,160,0.55)");
    grd.addColorStop(0.5, "rgba(220,180,150,0.25)");
    grd.addColorStop(1, "rgba(200,160,130,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
const fogLayerTex = makeFogLayer();

const fogLayers = [];
const FOG_LAYER_COUNT = 18;
for (let i = 0; i < FOG_LAYER_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
        map: fogLayerTex,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.NormalBlending,
        fog: false,
    });
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat);
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = 0.4 + Math.random() * 0.8;
    layer.position.x = (Math.random() - 0.5) * 80;
    layer.position.z = i * 30 - 50;
    scene.add(layer);
    fogLayers.push(layer);
}

// ---------- Obstacles ----------
const OBSTACLE_TYPES = ["cone", "barrel", "block", "car"];

function makeConeObstacle() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 })
    );
    cone.position.y = 0.6;
    cone.castShadow = true;
    g.add(cone);
    const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    stripe.position.y = 0.7;
    g.add(stripe);
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.08, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    base.position.y = 0.04;
    g.add(base);
    g.userData.size = { x: 1.0, z: 1.0 };
    return g;
}

function makeBarrelObstacle() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16),
        new THREE.MeshStandardMaterial({ color: 0xd22020, roughness: 0.5, metalness: 0.4 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    g.add(body);
    [0.35, 1.05].forEach(yy => {
        const ring = new THREE.Mesh(
            new THREE.CylinderGeometry(0.57, 0.57, 0.07, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        ring.position.y = yy;
        g.add(ring);
    });
    g.userData.size = { x: 1.2, z: 1.2 };
    return g;
}

function makeBlockObstacle() {
    const g = new THREE.Group();
    const block = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.0, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xf0c000, roughness: 0.7 })
    );
    block.position.y = 0.5;
    block.castShadow = true;
    g.add(block);
    for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.02, 1.02),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        stripe.position.set(-0.9 + i * 0.6, 0.5, 0);
        g.add(stripe);
    }
    g.userData.size = { x: 2.4, z: 1.0 };
    return g;
}

function makeCarObstacle() {
    const g = new THREE.Group();
    const color = [0x2266dd, 0x22aa55, 0xcccccc, 0xeeaa20][Math.floor(Math.random() * 4)];
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.7, 3.6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 })
    );
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.55, 1.9),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 })
    );
    cabin.position.set(0, 1.2, 0.1);
    cabin.castShadow = true;
    g.add(cabin);
    const tl1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.12, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.8 })
    );
    tl1.position.set(-0.55, 0.75, 1.82);
    g.add(tl1);
    const tl2 = tl1.clone();
    tl2.position.x = 0.55;
    g.add(tl2);
    [[-0.85, 0.3, -1.2], [0.85, 0.3, -1.2], [-0.85, 0.3, 1.2], [0.85, 0.3, 1.2]].forEach(p => {
        const w = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        w.rotation.z = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        g.add(w);
    });
    g.userData.size = { x: 1.8, z: 3.6 };
    return g;
}

function makeObstacle(type) {
    let m;
    switch (type) {
        case "cone":   m = makeConeObstacle(); break;
        case "barrel": m = makeBarrelObstacle(); break;
        case "block":  m = makeBlockObstacle(); break;
        case "car":    m = makeCarObstacle(); break;
    }
    m.userData.type = type;
    m.userData.active = false;
    m.userData.hit = false;
    m.visible = false;
    return m;
}

const obstaclePool = [];
for (let i = 0; i < 40; i++) {
    const type = OBSTACLE_TYPES[i % OBSTACLE_TYPES.length];
    const ob = makeObstacle(type);
    scene.add(ob);
    obstaclePool.push(ob);
}

function acquireObstacle(preferredType = null) {
    if (preferredType) {
        for (const ob of obstaclePool) {
            if (!ob.userData.active && ob.userData.type === preferredType) return ob;
        }
    }
    for (const ob of obstaclePool) {
        if (!ob.userData.active) return ob;
    }
    return null;
}

function spawnObstacleRow(z, blockCount = 1) {
    // Block at most NUM_LANES - 1 so there's always at least one safe lane.
    blockCount = Math.max(1, Math.min(NUM_LANES - 1, blockCount));
    const lanes = [0, 1, 2, 3, 4];
    for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const chosen = lanes.slice(0, blockCount);
    for (const laneIdx of chosen) {
        const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        const ob = acquireObstacle(type) || acquireObstacle();
        if (!ob) continue;
        ob.position.set(LANE_X[laneIdx], 0, z);
        ob.rotation.y = 0;
        ob.visible = true;
        ob.userData.active = true;
        ob.userData.hit = false;
    }
}

function releaseObstacle(ob) {
    ob.userData.active = false;
    ob.visible = false;
}

// ---------- Car ----------
// GT3-style supercar: low + wide red body, carbon black accents, big rear wing,
// slim LED headlights, multi-spoke wheels with red brake calipers
function buildCar() {
    const car = new THREE.Group();

    // AAA-style PBR materials with clearcoat car paint
    const redMat    = new THREE.MeshPhysicalMaterial({
        color: 0xc8161d, roughness: 0.32, metalness: 0.85,
        clearcoat: 1.0, clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
    });
    const carbonMat = new THREE.MeshPhysicalMaterial({
        color: 0x0c0c0c, roughness: 0.35, metalness: 0.6,
        clearcoat: 0.8, clearcoatRoughness: 0.18,
        envMapIntensity: 1.2,
    });
    const blackMat  = new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.7 });
    const glassMat  = new THREE.MeshPhysicalMaterial({
        color: 0x05080c, roughness: 0.04, metalness: 0.0,
        transmission: 0.15, ior: 1.45,
        clearcoat: 1.0, clearcoatRoughness: 0.02,
        transparent: true, opacity: 0.75,
        envMapIntensity: 1.8,
    });
    const stripeMat = new THREE.MeshPhysicalMaterial({
        color: 0xf2f2f2, roughness: 0.35, metalness: 0.1,
        clearcoat: 1.0, clearcoatRoughness: 0.1,
        envMapIntensity: 1.0,
    });
    const calipMat  = new THREE.MeshStandardMaterial({ color: 0xd02525, roughness: 0.45, metalness: 0.5, envMapIntensity: 1.0 });
    const ledMat    = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcce8ff, emissiveIntensity: 2.4 });
    const tailMat   = new THREE.MeshStandardMaterial({ color: 0xff1010, emissive: 0xff0000, emissiveIntensity: 1.5 });
    const rimMat    = new THREE.MeshPhysicalMaterial({
        color: 0x111114, roughness: 0.28, metalness: 1.0,
        clearcoat: 0.6, clearcoatRoughness: 0.15,
        envMapIntensity: 1.4,
    });
    const tireMat   = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.92, envMapIntensity: 0.2 });

    // ---- Main monocoque (low + wide) ----
    // Use ExtrudeGeometry from a top-down silhouette to get a tapered shape.
    function extrudeShape(points, depth, y, mat, castShadow = true) {
        const shape = new THREE.Shape();
        shape.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
        const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
        geo.translate(0, 0, -depth / 2);
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        m.castShadow = castShadow;
        m.receiveShadow = true;
        return m;
    }

    // Lower wide body silhouette (top-down: x = length axis, y = width axis)
    // Length ~4.6 (z), width ~2.2 (x). Front tapered, rear wider.
    const lowerSilhouette = [
        [-2.3,  0.55], [-2.0,  0.95], [-0.8, 1.05], [ 0.8, 1.1], [ 1.9, 1.0], [ 2.3,  0.7],
        [ 2.3, -0.7], [ 1.9, -1.0], [ 0.8, -1.1], [-0.8,-1.05], [-2.0,-0.95], [-2.3, -0.55],
    ];
    const lower = extrudeShape(lowerSilhouette, 0.55, 0.45, redMat);
    car.add(lower);

    // Upper body (narrower, hood + cabin base level)
    const upperSilhouette = [
        [-2.1, 0.45], [-1.7, 0.78], [-0.4, 0.88], [ 0.7, 0.92], [ 1.7, 0.85], [ 2.0, 0.55],
        [ 2.0, -0.55],[ 1.7,-0.85], [ 0.7,-0.92], [-0.4,-0.88], [-1.7,-0.78], [-2.1,-0.45],
    ];
    const upper = extrudeShape(upperSilhouette, 0.32, 0.95, redMat);
    car.add(upper);

    // Carbon hood scoop (black center stripe on hood)
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 1.2), carbonMat);
    hoodScoop.position.set(0, 1.16, -1.0);
    hoodScoop.castShadow = true;
    car.add(hoodScoop);

    // Hood vents (two angled slots)
    const ventGeo = new THREE.BoxGeometry(0.35, 0.04, 0.4);
    const vent1 = new THREE.Mesh(ventGeo, blackMat);
    vent1.position.set(-0.25, 1.18, -1.3);
    vent1.rotation.y = 0.15;
    car.add(vent1);
    const vent2 = vent1.clone();
    vent2.position.x = 0.25;
    vent2.rotation.y = -0.15;
    car.add(vent2);

    // ---- Cabin / roof (low teardrop) ----
    const cabinSilhouette = [
        [-1.3, 0.4], [-1.0, 0.7], [-0.2, 0.78], [ 0.5, 0.78], [ 1.1, 0.6], [ 1.3, 0.3],
        [ 1.3, -0.3], [ 1.1, -0.6], [ 0.5,-0.78], [-0.2,-0.78], [-1.0,-0.7], [-1.3,-0.4],
    ];
    const cabin = extrudeShape(cabinSilhouette, 0.55, 1.25, redMat);
    cabin.position.z = 0.0;
    car.add(cabin);

    // Windshield (tinted, slopes forward)
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.7), glassMat);
    ws.position.set(0, 1.45, -0.65);
    ws.rotation.x = -Math.PI / 2 + 0.55;
    car.add(ws);

    // Rear window
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55), glassMat);
    rw.position.set(0, 1.5, 0.6);
    rw.rotation.x = -Math.PI / 2 - 0.5;
    car.add(rw);

    // Side windows
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), glassMat);
    sw1.position.set(0.96, 1.48, 0.0);
    sw1.rotation.y = -Math.PI / 2;
    sw1.rotation.x = -0.05;
    car.add(sw1);
    const sw2 = sw1.clone();
    sw2.position.x = -0.96;
    sw2.rotation.y = Math.PI / 2;
    car.add(sw2);

    // ---- Black/white racing stripe on hood ----
    const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 1.7), stripeMat);
    stripeHood.position.set(-0.55, 1.18, -1.05);
    stripeHood.rotation.y = 0.04;
    car.add(stripeHood);
    const stripeHood2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 1.7), carbonMat);
    stripeHood2.position.set(0.55, 1.18, -1.05);
    stripeHood2.rotation.y = -0.04;
    car.add(stripeHood2);

    // ---- Front splitter (aggressive carbon) ----
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.6), carbonMat);
    splitter.position.set(0, 0.18, -2.0);
    splitter.castShadow = true;
    car.add(splitter);

    // Front splitter side dive planes
    const dpGeo = new THREE.BoxGeometry(0.5, 0.05, 0.35);
    const dpL = new THREE.Mesh(dpGeo, carbonMat);
    dpL.position.set(-1.0, 0.35, -1.8);
    dpL.rotation.z = 0.15;
    car.add(dpL);
    const dpR = dpL.clone();
    dpR.position.x = 1.0;
    dpR.rotation.z = -0.15;
    car.add(dpR);

    // Front bumper lower air intakes (black)
    const intakeC = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), blackMat);
    intakeC.position.set(0, 0.45, -2.15);
    car.add(intakeC);
    const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.2), blackMat);
    intakeL.position.set(-0.85, 0.45, -2.1);
    car.add(intakeL);
    const intakeR = intakeL.clone();
    intakeR.position.x = 0.85;
    car.add(intakeR);

    // ---- Slim LED headlights (long thin bars, blue-white) ----
    const hlGeo = new THREE.BoxGeometry(0.55, 0.06, 0.08);
    const hlL = new THREE.Mesh(hlGeo, ledMat);
    hlL.position.set(-0.75, 0.92, -2.18);
    hlL.rotation.z = -0.08;
    car.add(hlL);
    const hlR = hlL.clone();
    hlR.position.x = 0.75;
    hlR.rotation.z = 0.08;
    car.add(hlR);
    // Second LED accent below
    const hlGeo2 = new THREE.BoxGeometry(0.4, 0.04, 0.06);
    const hlL2 = new THREE.Mesh(hlGeo2, ledMat);
    hlL2.position.set(-0.78, 0.82, -2.18);
    car.add(hlL2);
    const hlR2 = hlL2.clone();
    hlR2.position.x = 0.78;
    car.add(hlR2);

    // ---- Side skirts (carbon) ----
    const skirtGeo = new THREE.BoxGeometry(0.18, 0.18, 3.0);
    const skirtL = new THREE.Mesh(skirtGeo, carbonMat);
    skirtL.position.set(-1.12, 0.32, 0.1);
    skirtL.castShadow = true;
    car.add(skirtL);
    const skirtR = skirtL.clone();
    skirtR.position.x = 1.12;
    car.add(skirtR);

    // ---- White/black livery accent on side (triangular) ----
    const liveryShape = new THREE.Shape();
    liveryShape.moveTo(0, 0);
    liveryShape.lineTo(1.4, 0.15);
    liveryShape.lineTo(1.2, -0.25);
    liveryShape.lineTo(0, 0);
    const liveryGeo = new THREE.ExtrudeGeometry(liveryShape, { depth: 0.02, bevelEnabled: false });
    const liveryL = new THREE.Mesh(liveryGeo, stripeMat);
    liveryL.rotation.y = Math.PI / 2;
    liveryL.position.set(-1.13, 0.7, 0.4);
    car.add(liveryL);
    const liveryR = new THREE.Mesh(liveryGeo, stripeMat);
    liveryR.rotation.y = -Math.PI / 2;
    liveryR.position.set(1.13, 0.7, 0.4);
    car.add(liveryR);

    // ---- Rear ----
    // Diffuser (carbon, with vertical fins)
    const diff = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.5), carbonMat);
    diff.position.set(0, 0.25, 2.05);
    car.add(diff);
    for (let i = -2; i <= 2; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.5), blackMat);
        fin.position.set(i * 0.32, 0.25, 2.05);
        car.add(fin);
    }

    // Tail lights (thin red bars across rear)
    const tlGeo = new THREE.BoxGeometry(0.7, 0.08, 0.06);
    const tlL = new THREE.Mesh(tlGeo, tailMat);
    tlL.position.set(-0.55, 0.92, 2.16);
    car.add(tlL);
    const tlR = tlL.clone();
    tlR.position.x = 0.55;
    car.add(tlR);

    // Dual exhaust tips
    const exhGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
    const exhMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.95 });
    const exhL = new THREE.Mesh(exhGeo, exhMat);
    exhL.rotation.x = Math.PI / 2;
    exhL.position.set(-0.35, 0.35, 2.2);
    car.add(exhL);
    const exhR = exhL.clone();
    exhR.position.x = 0.35;
    car.add(exhR);

    // ---- Giant rear wing (signature GT3 look) ----
    const wingMat = carbonMat;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.55), wingMat);
    wing.position.set(0, 1.5, 1.95);
    wing.rotation.x = -0.06;
    wing.castShadow = true;
    car.add(wing);
    // Wing end plates
    const epGeo = new THREE.BoxGeometry(0.05, 0.35, 0.6);
    const epL = new THREE.Mesh(epGeo, wingMat);
    epL.position.set(-1.2, 1.45, 1.95);
    car.add(epL);
    const epR = epL.clone();
    epR.position.x = 1.2;
    car.add(epR);
    // Wing uprights
    const upGeo = new THREE.BoxGeometry(0.08, 0.55, 0.18);
    const upL = new THREE.Mesh(upGeo, wingMat);
    upL.position.set(-0.6, 1.25, 1.95);
    car.add(upL);
    const upR = upL.clone();
    upR.position.x = 0.6;
    car.add(upR);

    // Roof shark fin / antenna
    const sharkFinShape = new THREE.Shape();
    sharkFinShape.moveTo(0, 0);
    sharkFinShape.lineTo(1.0, 0);
    sharkFinShape.lineTo(0.0, 0.18);
    sharkFinShape.lineTo(0, 0);
    const sharkFin = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sharkFinShape, { depth: 0.03, bevelEnabled: false }),
        carbonMat
    );
    sharkFin.position.set(-0.015, 1.55, 0.4);
    sharkFin.rotation.y = Math.PI / 2;
    car.add(sharkFin);

    // Side mirrors (carbon)
    const mirrorGeo = new THREE.BoxGeometry(0.22, 0.14, 0.32);
    const m1 = new THREE.Mesh(mirrorGeo, carbonMat);
    m1.position.set(1.05, 1.18, -0.45);
    car.add(m1);
    const m2 = m1.clone();
    m2.position.x = -1.05;
    car.add(m2);

    // ---- Wheels (multi-spoke black, with red brake caliper) ----
    function makeWheel() {
        const g = new THREE.Group();

        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 28), tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        g.add(tire);

        // Rim disc
        const rimBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.30, 24), rimMat);
        rimBase.rotation.z = Math.PI / 2;
        g.add(rimBase);

        // Multi-spokes (10 thin spokes)
        const spokeMat = rimMat;
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.78), spokeMat);
            spoke.rotation.x = a;
            g.add(spoke);
        }

        // Center hub (slight red accent)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 16), calipMat);
        hub.rotation.z = Math.PI / 2;
        g.add(hub);

        // Brake disc (silver)
        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24),
            new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.9 })
        );
        disc.rotation.z = Math.PI / 2;
        g.add(disc);

        // Red brake caliper (visible behind spokes)
        const caliper = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.05, 8, 8, Math.PI / 2.5),
            calipMat
        );
        caliper.rotation.y = Math.PI / 2;
        caliper.position.set(0, 0.05, 0);
        g.add(caliper);

        return g;
    }

    const wheelPositions = [
        { x: -1.0, y: 0.5, z: -1.45, front: true,  name: "fl" },
        { x:  1.0, y: 0.5, z: -1.45, front: true,  name: "fr" },
        { x: -1.0, y: 0.5, z:  1.55, front: false, name: "rl" },
        { x:  1.0, y: 0.5, z:  1.55, front: false, name: "rr" },
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

    // Wheel arch flares (subtle)
    const flareGeo = new THREE.TorusGeometry(0.62, 0.08, 8, 18, Math.PI);
    [-1.45, 1.55].forEach(z => {
        [-1.0, 1.0].forEach(x => {
            const flare = new THREE.Mesh(flareGeo, carbonMat);
            flare.position.set(x, 0.78, z);
            flare.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
            flare.rotation.x = -Math.PI / 2;
            car.add(flare);
        });
    });

    return { group: car, wheels };
}

const carData = buildCar();
const car = carData.group;
scene.add(car);

// ---------- Dynamic cube reflection on car body ----------
// Put the car on its own layer so the cube camera can exclude it from
// reflections (otherwise the car reflects itself).
const CAR_LAYER = 1;
car.traverse(o => {
    if (o.isMesh) o.layers.set(CAR_LAYER);
});
camera.layers.enable(CAR_LAYER); // main camera renders both world + car

const cubeRT = new THREE.WebGLCubeRenderTarget(128, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
});
cubeRT.texture.type = THREE.HalfFloatType;
const cubeCam = new THREE.CubeCamera(0.1, 800, cubeRT);
// CubeCamera's 6 internal cameras keep default layer 0 = car (layer 1) excluded
car.add(cubeCam);

// Assign cubeRT as environment for car's body materials so we get true
// world reflections in addition to the PMREM ambient.
function applyCubeReflectionToCar() {
    car.traverse(o => {
        if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
                if (m.isMeshPhysicalMaterial || m.isMeshStandardMaterial) {
                    m.envMap = cubeRT.texture;
                    m.needsUpdate = true;
                }
            }
        }
    });
}
applyCubeReflectionToCar();

let cubeFrame = 0;
function updateCubeReflection() {
    cubeFrame++;
    if (cubeFrame % 2 !== 0) return; // every other frame for perf
    // Position the cube camera at car center, hide car, render.
    cubeCam.position.set(0, 0.7, 0);
    cubeCam.update(renderer, scene);
}

// ---------- Stage system ----------
// 6 escalating difficulty tiers. Each defines the auto-cruise speed, the
// gap between obstacle rows, the absolute max throttle speed, the range
// of possible block counts per row (more = scarier), a BGM tempo
// multiplier, and a "heat" index that drives visual overlays.
const STAGES = [
    { name: "CRUISE",   minDist: 0,    base: 28, gap: 32, max: 65,  blocks: [1,1,2],     tempo: 1.0,  heat: 1 },
    { name: "STEADY",   minDist: 300,  base: 36, gap: 26, max: 75,  blocks: [1,2,2],     tempo: 1.10, heat: 2 },
    { name: "RAPID",    minDist: 800,  base: 46, gap: 22, max: 88,  blocks: [2,2,3],     tempo: 1.20, heat: 3 },
    { name: "INSANE",   minDist: 1500, base: 58, gap: 18, max: 105, blocks: [2,3,3],     tempo: 1.35, heat: 4 },
    { name: "HYPER",    minDist: 2400, base: 72, gap: 14, max: 125, blocks: [2,3,3,4],   tempo: 1.55, heat: 5 },
    { name: "INFERNO",  minDist: 3500, base: 88, gap: 11, max: 150, blocks: [3,3,4,4],   tempo: 1.80, heat: 6 },
];

function stageForDistance(d) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (d >= STAGES[i].minDist) return i;
    }
    return 0;
}

// ---------- Game state ----------
const state = {
    mode: "menu",
    speed: 28,        // starts at stage 1 base
    minSpeed: 16,
    accel: 14,
    brake: 32,
    cameraMode: 0,
    elapsed: 0,
    hp: 100,
    maxHp: 100,
    distance: 0,
    topSpeed: 0,
    bestDistance: null,
    currentLane: 2,
    nextSpawnZ: 80,
    stageIdx: 0,

    // Boost / nitro
    boost: 0,           // 0..100
    boostMax: 100,
    boostActive: false,
    boostFillRate: 7,   // points/sec while driving cleanly
    boostHitFill: -15,  // points lost on collision (no fill from damage)
    boostDrainRate: 38, // points/sec while active
    boostMinToActivate: 25,
    boostMult: 1.85,    // speed multiplier while active
    fov: 65,
};

function resetCar() {
    car.position.set(LANE_X[2], 0, 0);
    car.rotation.set(0, 0, 0);
    state.currentLane = 2;
    state.stageIdx = 0;
    state.speed = STAGES[0].base;
    state.elapsed = 0;
    state.hp = state.maxHp;
    state.distance = 0;
    state.topSpeed = 0;
    state.nextSpawnZ = car.position.z + 80;

    for (const ob of obstaclePool) releaseObstacle(ob);

    for (let i = 0; i < roadSegments.length; i++) {
        roadSegments[i].position.z = i * SEG_LENGTH - SEG_LENGTH;
    }

    state.boost = 0;
    state.boostActive = false;
    state.fov = 65;
    camera.fov = 65;
    camera.updateProjectionMatrix();
    document.getElementById("boost-wrap").classList.remove("active");
    document.getElementById("postfx").classList.remove("boost");

    applyStageVisuals(0, true);
    updateHUD();
}

// ---------- Nitro SFX + transition effects ----------
function triggerBoostStart() {
    document.getElementById("postfx").classList.add("boost");
    if (!bgm.ctx) return;
    const t = bgm.ctx.currentTime;
    // Whoosh / engine roar — descending square sweep + noise burst
    const o = bgm.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.35);
    const filt = bgm.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(400, t);
    filt.frequency.exponentialRampToValueAtTime(6000, t + 0.4);
    filt.Q.value = 8;
    const g = bgm.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(filt).connect(g).connect(bgm.ctx.destination);
    o.start(t); o.stop(t + 0.6);

    // Air rush noise
    const bufSize = bgm.ctx.sampleRate * 0.6;
    const buf = bgm.ctx.createBuffer(1, bufSize, bgm.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const n = bgm.ctx.createBufferSource();
    n.buffer = buf;
    const hp = bgm.ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = 2500;
    const ng = bgm.ctx.createGain();
    ng.gain.value = 0.25;
    n.connect(hp).connect(ng).connect(bgm.ctx.destination);
    n.start(t); n.stop(t + 0.6);
}

function triggerBoostEnd() {
    document.getElementById("postfx").classList.remove("boost");
}

function playSmash() {
    if (!bgm.ctx) return;
    const t = bgm.ctx.currentTime;
    const bufSize = bgm.ctx.sampleRate * 0.25;
    const buf = bgm.ctx.createBuffer(1, bufSize, bgm.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const n = bgm.ctx.createBufferSource();
    n.buffer = buf;
    const filt = bgm.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1800;
    const g = bgm.ctx.createGain();
    g.gain.value = 0.35;
    n.connect(filt).connect(g).connect(bgm.ctx.destination);
    n.start(t); n.stop(t + 0.27);
}

// Stage visual feedback (banner + HUD chip + post-fx tint + BGM tempo)
const STAGE_COLORS = ["#4ce080", "#e0d24c", "#ff9020", "#ff5040", "#ff3070", "#ff2020"];
const stageItemEl = document.getElementById("stage-item");
const stageNumEl = document.getElementById("stage");
const stageNameEl = document.getElementById("stage-name");
const stageBannerEl = document.getElementById("stage-banner");
const postFxEl = document.getElementById("postfx");

function applyStageVisuals(idx, silent = false) {
    const s = STAGES[idx];
    // HUD chip class
    for (let i = 1; i <= 6; i++) stageItemEl.classList.remove("s" + i);
    stageItemEl.classList.add("s" + s.heat);
    stageNumEl.textContent = idx + 1;
    stageNameEl.textContent = s.name;

    // Post-fx tint (heat 3+ adds increasing red wash)
    postFxEl.classList.remove("hot3", "hot4", "hot5", "hot6");
    if (s.heat >= 3) postFxEl.classList.add("hot" + s.heat);

    // BGM tempo follows the stage
    if (typeof bgm !== "undefined") bgm.tempoMult = s.tempo;

    // Banner
    if (!silent) {
        stageBannerEl.textContent = `STAGE ${idx + 1} · ${s.name}`;
        stageBannerEl.style.color = STAGE_COLORS[idx] || "#fff";
        stageBannerEl.classList.add("show");
        setTimeout(() => stageBannerEl.classList.remove("show"), 1400);
        playStageJingle(s.heat);
    }
}

function playStageJingle(heat) {
    if (typeof bgm === "undefined" || !bgm.ctx) return;
    const t = bgm.ctx.currentTime;
    const base = 220 * Math.pow(2, (heat - 1) / 6);
    [0, 0.08, 0.16].forEach((delay, i) => {
        const o = bgm.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = base * (1 + i * 0.5);
        const g = bgm.ctx.createGain();
        g.gain.setValueAtTime(0, t + delay);
        g.gain.linearRampToValueAtTime(0.25, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.4);
        o.connect(g).connect(bgm.ctx.destination);
        o.start(t + delay);
        o.stop(t + delay + 0.45);
    });
}

function flashDamage() {
    const el = document.getElementById("damage-flash");
    el.classList.add("active");
    setTimeout(() => el.classList.remove("active"), 80);
}

function endRun() {
    state.mode = "finished";
    if (state.bestDistance === null || state.distance > state.bestDistance) {
        state.bestDistance = state.distance;
    }
    document.getElementById("final-distance").textContent = Math.round(state.distance);
    document.getElementById("final-time").textContent = state.elapsed.toFixed(2);
    document.getElementById("final-top").textContent = Math.round(state.topSpeed * 3.6 * 1.6);
    document.getElementById("finish-overlay").classList.remove("hidden");
}

function damageBeep() {
    if (!bgm.ctx) return;
    const t = bgm.ctx.currentTime;
    const o = bgm.ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(280, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    const g = bgm.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(bgm.ctx.destination);
    o.start(t); o.stop(t + 0.22);
}

// ---------- Input ----------
const keys = {};
const justPressed = {};
window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!keys[k]) justPressed[k] = true;
    keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
    }
    if (k === "c") {
        state.cameraMode = (state.cameraMode + 1) % 3;
    }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- Update ----------
function update(dt) {
    if (state.mode !== "playing") return;

    const accelerating = keys["arrowup"] || keys["w"];
    const reversing = keys["arrowdown"] || keys["s"];
    const boostHeld = keys["shift"];

    // ---- Nitro boost handling ----
    const boostWrap = document.getElementById("boost-wrap");
    const boostFillEl = document.getElementById("boost-fill");
    if (boostHeld && !state.boostActive && state.boost >= state.boostMinToActivate) {
        state.boostActive = true;
        boostWrap.classList.add("active");
        triggerBoostStart();
    }
    if (state.boostActive) {
        state.boost -= state.boostDrainRate * dt;
        if (state.boost <= 0 || !boostHeld) {
            state.boost = Math.max(0, state.boost);
            state.boostActive = false;
            boostWrap.classList.remove("active");
            triggerBoostEnd();
        }
    } else {
        state.boost = Math.min(state.boostMax, state.boost + state.boostFillRate * dt);
    }
    boostFillEl.style.width = (state.boost / state.boostMax * 100) + "%";
    boostFillEl.classList.toggle("ready", state.boost >= state.boostMinToActivate && !state.boostActive);

    // Lane change (edge triggered — one press = one lane).
    // Camera looks down +Z so world +X projects to screen LEFT; we flip so
    // pressing Left visually moves the car left.
    if (justPressed["arrowleft"] || justPressed["a"]) {
        if (state.currentLane < NUM_LANES - 1) state.currentLane++;
    }
    if (justPressed["arrowright"] || justPressed["d"]) {
        if (state.currentLane > 0) state.currentLane--;
    }
    // clear edge triggers
    justPressed["arrowleft"] = false;
    justPressed["a"] = false;
    justPressed["arrowright"] = false;
    justPressed["d"] = false;

    // Stage progression
    const newStage = stageForDistance(state.distance);
    if (newStage !== state.stageIdx) {
        state.stageIdx = newStage;
        applyStageVisuals(newStage);
    }
    const stage = STAGES[state.stageIdx];

    // Speed control — base & max scale with stage
    if (accelerating) state.speed += state.accel * dt;
    else if (reversing) state.speed -= state.brake * dt;
    else {
        // drift back toward stage base speed
        if (state.speed > stage.base) state.speed -= 6 * dt;
        else if (state.speed < stage.base) state.speed += 6 * dt;
    }
    const effectiveMax = state.boostActive ? stage.max * state.boostMult : stage.max;
    if (state.boostActive) {
        // Snap toward the boosted top speed
        state.speed += 80 * dt;
    }
    state.speed = Math.max(state.minSpeed, Math.min(effectiveMax, state.speed));

    // Forward motion (car heads down +Z)
    car.position.z += state.speed * dt;
    state.distance += state.speed * dt;
    if (state.speed > state.topSpeed) state.topSpeed = state.speed;

    // Smooth lane X interpolation
    const targetX = LANE_X[state.currentLane];
    const xDelta = targetX - car.position.x;
    const laneChangeRate = 14; // units per second
    const step = Math.sign(xDelta) * Math.min(Math.abs(xDelta), laneChangeRate * dt);
    car.position.x += step;

    // Tilt during lane change (banking)
    const tilt = -xDelta * 0.06;
    car.rotation.z += (tilt - car.rotation.z) * Math.min(1, dt * 8);

    // Slight nose-up/nose-down on throttle/brake
    const pitch = accelerating ? -0.02 : reversing ? 0.03 : 0;
    car.rotation.x += (pitch - car.rotation.x) * Math.min(1, dt * 6);

    // Spin wheels
    const wheelRotSpeed = state.speed / 0.5;
    Object.values(carData.wheels).forEach(w => {
        w.wheel.rotation.x += wheelRotSpeed * dt;
        if (w.front) {
            // small visual steering during lane change
            const targetSteer = -xDelta * 0.05;
            w.pivot.rotation.y += (targetSteer - w.pivot.rotation.y) * Math.min(1, dt * 10);
        }
    });

    // Recycle road segments behind the player
    for (const seg of roadSegments) {
        if (seg.position.z < car.position.z - SEG_LENGTH * 2) {
            seg.position.z += NUM_SEGS * SEG_LENGTH;
        }
    }

    // Recycle trees behind player
    for (const t of trees) {
        if (t.position.z < car.position.z - 50) {
            t.position.z += ROAD_REPEAT;
            t.position.x = (Math.random() < 0.5 ? -1 : 1) * (ROAD_TOTAL_HALF + 3 + Math.random() * 50);
        }
    }

    // Recycle volumetric fog layers
    for (const layer of fogLayers) {
        if (layer.position.z < car.position.z - 30) {
            layer.position.z += FOG_LAYER_COUNT * 30;
            layer.position.x = (Math.random() - 0.5) * 80;
        }
    }

    // Spawn obstacles ahead — gap shrinks per stage, block count climbs
    while (state.nextSpawnZ < car.position.z + 240) {
        const blockChoices = stage.blocks;
        const blockCount = blockChoices[Math.floor(Math.random() * blockChoices.length)];
        spawnObstacleRow(state.nextSpawnZ, blockCount);
        const jitter = (Math.random() - 0.5) * stage.gap * 0.3;
        state.nextSpawnZ += stage.gap + jitter;
    }

    // Collision detection + recycle obstacles behind
    const carHalfX = 1.05;
    const carHalfZ = 2.3;
    for (const ob of obstaclePool) {
        if (!ob.userData.active) continue;
        // Recycle if well behind
        if (ob.position.z < car.position.z - 15) {
            releaseObstacle(ob);
            continue;
        }
        if (ob.userData.hit) continue;

        const sz = ob.userData.size;
        const dx = Math.abs(ob.position.x - car.position.x) - (carHalfX + sz.x / 2);
        const dz = Math.abs(ob.position.z - car.position.z) - (carHalfZ + sz.z / 2);
        if (dx < 0 && dz < 0) {
            ob.userData.hit = true;
            if (state.boostActive) {
                // Invincible — plow through, obstacle launches violently
                ob.userData.fly = {
                    vx: (ob.position.x - car.position.x) * 0.4 + (Math.random() - 0.5) * 6,
                    vy: 14 + Math.random() * 6,
                    vz: 18 + state.speed * 0.3, // forward (away from car)
                    vr: (Math.random() - 0.5) * 18,
                };
                flashDamage();
                playSmash();
            } else {
                state.hp = Math.max(0, state.hp - 10);
                state.speed = Math.max(state.minSpeed, state.speed - 12);
                flashDamage();
                damageBeep();
                ob.userData.fly = {
                    vx: (ob.position.x - car.position.x) * 0.5 + (Math.random() - 0.5) * 4,
                    vy: 6 + Math.random() * 3,
                    vz: -8,
                    vr: (Math.random() - 0.5) * 10,
                };
                if (state.hp <= 0) endRun();
            }
        }
    }

    // Animate flying (hit) obstacles
    for (const ob of obstaclePool) {
        if (ob.userData.active && ob.userData.fly) {
            const f = ob.userData.fly;
            ob.position.x += f.vx * dt;
            ob.position.y += f.vy * dt;
            ob.position.z += f.vz * dt;
            ob.rotation.x += f.vr * dt;
            ob.rotation.z += f.vr * 0.7 * dt;
            f.vy -= 18 * dt; // gravity
            if (ob.position.y < -8) {
                ob.userData.fly = null;
                releaseObstacle(ob);
            }
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
const camTarget = new THREE.Vector3();

function updateCamera(dt) {
    let desired = new THREE.Vector3();
    let lookAt = new THREE.Vector3();
    let lerpFactor = 6;

    if (state.cameraMode === 0) {
        // 3rd-person chase
        desired.set(car.position.x * 0.5, car.position.y + 5, car.position.z - 10);
        lookAt.set(car.position.x, car.position.y + 1.0, car.position.z + 8);
        lerpFactor = 6;
    } else if (state.cameraMode === 1) {
        // Hood
        desired.set(car.position.x, car.position.y + 1.5, car.position.z + 0.5);
        lookAt.set(car.position.x, car.position.y + 1.0, car.position.z + 20);
        lerpFactor = 14;
    } else {
        // Overhead
        desired.set(car.position.x * 0.3, car.position.y + 30, car.position.z - 4);
        lookAt.set(car.position.x, 0, car.position.z + 12);
        lerpFactor = 5;
    }

    camera.position.lerp(desired, Math.min(1, dt * lerpFactor));
    camTarget.lerp(lookAt, Math.min(1, dt * lerpFactor));

    // Speed-based + boost camera shake
    const speedRatio = Math.max(0, (state.speed - 30) / 40);
    let shake = speedRatio * 0.06;
    if (state.boostActive) shake += 0.18; // strong boost shudder
    if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake * 0.6;
        camera.position.z += (Math.random() - 0.5) * shake * 0.4;
    }

    // FOV punch — wider FOV during boost
    const targetFov = state.boostActive ? 92 : 65;
    state.fov += (targetFov - state.fov) * Math.min(1, dt * (state.boostActive ? 12 : 6));
    if (Math.abs(camera.fov - state.fov) > 0.05) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
    }

    camera.lookAt(camTarget);

    // Sky + sun light follow the camera so they never run out of range
    sky.position.copy(camera.position);
    sun.position.set(camera.position.x + 70, 70, camera.position.z + 110);
    sun.target.position.set(camera.position.x, 0, camera.position.z + 20);
    sun.target.updateMatrixWorld();

    // Lens flare: place sun sprite far along SUN_DIR, ghost mirrored across center
    const flareDist = 800;
    sunFlare.position.set(
        camera.position.x + SUN_DIR.x * flareDist,
        camera.position.y + SUN_DIR.y * flareDist,
        camera.position.z + SUN_DIR.z * flareDist,
    );
    // Ghost mirrored across viewport center along the same vector
    flareGhost.position.set(
        camera.position.x - SUN_DIR.x * flareDist * 0.6,
        camera.position.y + SUN_DIR.y * flareDist * 0.5,
        camera.position.z - SUN_DIR.z * flareDist * 0.6,
    );
    // Fade flare if the sun is behind the camera
    const viewDir = new THREE.Vector3().subVectors(camTarget, camera.position).normalize();
    const sunAlign = Math.max(0, viewDir.dot(SUN_DIR));
    sunFlareMat.opacity = 0.55 * sunAlign;
    flareGhostMat.opacity = 0.4 * sunAlign;

    // Speed-driven vignette only (no canvas blur — that washed out the view)
    const speedlinesEl = document.getElementById("speedlines");
    if (speedlinesEl) speedlinesEl.classList.toggle("active", state.speed > 55);
}

// ---------- HUD ----------
const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const distanceEl = document.getElementById("distance");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const hpTextEl = document.getElementById("hp-text");
const hpFillEl = document.getElementById("hp-fill");
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
    distanceEl.textContent = Math.round(state.distance);
    timeEl.textContent = state.elapsed.toFixed(2);
    bestEl.textContent = state.bestDistance === null ? "--" : Math.round(state.bestDistance) + " m";

    hpTextEl.textContent = Math.round(state.hp);
    hpFillEl.style.width = (state.hp / state.maxHp * 100) + "%";
    hpFillEl.classList.toggle("low", state.hp <= 30);

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
    updateCubeReflection();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

// ---------- BGM (procedural synth) ----------
const bgm = {
    ctx: null,
    masterGain: null,
    started: false,
    muted: false,
    timer: null,
    step: 0,
    tempoMult: 1.0,
};

function startBGM() {
    if (bgm.started) {
        if (bgm.ctx.state === "suspended") bgm.ctx.resume();
        return;
    }
    bgm.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    bgm.ctx = new AC();
    const ctx = bgm.ctx;

    bgm.masterGain = ctx.createGain();
    bgm.masterGain.gain.value = bgm.muted ? 0 : 0.35;

    // Light reverb-ish delay
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(bgm.masterGain);
    bgm.masterGain.connect(ctx.destination);

    const sendFx = (node) => { node.connect(bgm.masterGain); node.connect(delay); };

    // Pulse-wave-ish lead via two detuned sawtooths
    function playLead(freq, t, dur, vol = 0.18) {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = "sawtooth";
        o2.type = "sawtooth";
        o1.frequency.value = freq;
        o2.frequency.value = freq * 1.005;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
        filter.frequency.exponentialRampToValueAtTime(1200, t + dur);
        filter.Q.value = 6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o1.connect(filter); o2.connect(filter);
        filter.connect(g);
        sendFx(g);
        o1.start(t); o2.start(t);
        o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }

    // Bass: square with envelope
    function playBass(freq, t, dur, vol = 0.35) {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = freq;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(filter).connect(g);
        g.connect(bgm.masterGain);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    function playKick(t) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(bgm.masterGain);
        o.start(t); o.stop(t + 0.2);
    }

    function playSnare(t) {
        const bufSize = ctx.sampleRate * 0.18;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        noise.connect(hp).connect(g).connect(bgm.masterGain);
        noise.start(t); noise.stop(t + 0.18);
    }

    function playHat(t, open = false) {
        const bufSize = ctx.sampleRate * 0.05;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 7000;
        const g = ctx.createGain();
        const decay = open ? 0.12 : 0.04;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        noise.connect(hp).connect(g).connect(bgm.masterGain);
        noise.start(t); noise.stop(t + decay + 0.02);
    }

    // 140 BPM driving rock/synth loop in Am
    // Chord roots: Am - F - C - G (8 bars total, 2 bars each)
    const BPM = 140;
    const BEAT = 60 / BPM;          // 0.4285s per beat
    const SIXTEENTH = BEAT / 4;
    const BARS_PER_LOOP = 8;
    const STEPS_PER_BAR = 16;
    const TOTAL_STEPS = BARS_PER_LOOP * STEPS_PER_BAR;

    // MIDI helpers
    const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

    // Bass pattern (one root per beat with octave kicks)
    const rootByBar = [57, 57, 53, 53, 60, 60, 55, 55]; // A2, F2, C3, G2
    const bassPattern = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1]; // 16 steps

    // Lead melody (semitone offsets from Am scale), -1 = rest
    const leadMelody = [
        // bar 1
        12, -1, 15, -1, 17, -1, 19, 17, 15, -1, 12, -1, 10, -1, 12, -1,
        // bar 2
        15, -1, 17, -1, 19, 17, 15, -1, 12, -1, 15, -1, 17, 19, 22, -1,
        // bar 3 (F)
        8, -1, 12, -1, 15, -1, 17, -1, 15, -1, 12, -1, 8, -1, 12, -1,
        // bar 4
        12, -1, 15, 17, 19, 17, 15, 12, 10, -1, 12, -1, 8, -1, -1, -1,
        // bar 5 (C)
        12, -1, 15, -1, 19, -1, 22, -1, 19, -1, 15, -1, 12, -1, 15, -1,
        // bar 6
        19, -1, 22, -1, 24, 22, 19, 15, 17, -1, 19, -1, 22, -1, -1, -1,
        // bar 7 (G)
        14, -1, 17, -1, 19, -1, 22, 19, 17, -1, 14, -1, 12, -1, 14, -1,
        // bar 8
        17, -1, 19, -1, 22, 19, 17, 14, 12, -1, 10, -1, 12, -1, -1, -1,
    ];

    bgm.step = 0;
    let nextStepTime = ctx.currentTime + 0.1;

    function scheduler() {
        const lookAhead = 0.15;
        while (nextStepTime < ctx.currentTime + lookAhead) {
            const s = bgm.step % TOTAL_STEPS;
            const bar = Math.floor(s / STEPS_PER_BAR);
            const stepInBar = s % STEPS_PER_BAR;
            const root = rootByBar[bar];

            // Drums
            if (stepInBar % 8 === 0) playKick(nextStepTime);                // beats 1, 3
            if (stepInBar === 4 || stepInBar === 12) playSnare(nextStepTime); // beats 2, 4
            if (stepInBar % 2 === 0) playHat(nextStepTime, stepInBar === 14); // 8ths

            // Bass
            if (bassPattern[stepInBar]) {
                const bf = note(root - 12);
                playBass(bf, nextStepTime, SIXTEENTH * 1.8, 0.3);
            }

            // Lead (8ths only, on even steps)
            const lm = leadMelody[s];
            if (lm !== -1 && stepInBar % 2 === 0) {
                playLead(note(root + lm), nextStepTime, SIXTEENTH * 2.6, 0.14);
            }

            nextStepTime += SIXTEENTH / (bgm.tempoMult || 1);
            bgm.step++;
        }
    }

    bgm.timer = setInterval(scheduler, 25);
}

function toggleMute() {
    bgm.muted = !bgm.muted;
    if (bgm.masterGain) {
        bgm.masterGain.gain.linearRampToValueAtTime(
            bgm.muted ? 0 : 0.35,
            bgm.ctx.currentTime + 0.1
        );
    }
    const btn = document.getElementById("mute-btn");
    btn.textContent = bgm.muted ? "♪ OFF" : "♪ ON";
    btn.classList.toggle("muted", bgm.muted);
}

document.getElementById("mute-btn").addEventListener("click", () => {
    if (!bgm.started) startBGM();
    toggleMute();
});

// ---------- UI ----------
document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("overlay").classList.add("hidden");
    state.mode = "playing";
    resetCar();
    startBGM();
});
document.getElementById("restart-btn").addEventListener("click", () => {
    document.getElementById("finish-overlay").classList.add("hidden");
    state.mode = "playing";
    resetCar();
});

resetCar();
camera.position.set(0, 5, -10);
camTarget.set(0, 1, 8);
camera.lookAt(camTarget);

requestAnimationFrame(loop);

})();
