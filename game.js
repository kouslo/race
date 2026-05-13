// THREE is loaded as a global via <script> tag in index.html.
(function () {

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
// GT3-style supercar: low + wide red body, carbon black accents, big rear wing,
// slim LED headlights, multi-spoke wheels with red brake calipers
function buildCar() {
    const car = new THREE.Group();

    const redMat    = new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.25, metalness: 0.6 });
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.45, metalness: 0.35 });
    const blackMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.2 });
    const glassMat  = new THREE.MeshStandardMaterial({ color: 0x0a0f15, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.85 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4, metalness: 0.2 });
    const calipMat  = new THREE.MeshStandardMaterial({ color: 0xd42828, roughness: 0.5, metalness: 0.4 });
    const ledMat    = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe0ff, emissiveIntensity: 1.4 });
    const tailMat   = new THREE.MeshStandardMaterial({ color: 0xff1010, emissive: 0xff0000, emissiveIntensity: 0.9 });
    const rimMat    = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.35, metalness: 0.9 });
    const tireMat   = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 });

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
    elapsed: 0,
    hp: 100,
    maxHp: 100,
    distance: 0,      // meters traveled (forward only)
    topSpeed: 0,
    wasOffTrack: false,
    bestDistance: null,
};

function resetCar() {
    const start = curve.getPointAt(0);
    const tan = curve.getTangentAt(0);
    car.position.set(start.x, 0, start.z);
    state.angle = Math.atan2(tan.x, tan.z);
    car.rotation.y = state.angle;
    state.speed = 0;
    state.elapsed = 0;
    state.hp = state.maxHp;
    state.distance = 0;
    state.topSpeed = 0;
    state.wasOffTrack = false;
    updateHUD();
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

    // Off-track penalty + HP damage
    const trackDist = distanceToTrack(car.position.x, car.position.z);
    const offTrack = trackDist > TRACK_WIDTH / 2;
    if (offTrack) {
        const over = trackDist - TRACK_WIDTH / 2;
        const slow = Math.min(50, 10 + over) * dt;
        if (state.speed > 0) state.speed = Math.max(0, state.speed - slow);
        else if (state.speed < 0) state.speed = Math.min(0, state.speed + slow);
        const offMax = 28;
        if (state.speed > offMax) state.speed = offMax;
        if (state.speed < -offMax) state.speed = -offMax;

        if (!state.wasOffTrack) {
            // crossed line — take 10 damage
            state.hp = Math.max(0, state.hp - 10);
            flashDamage();
            damageBeep();
            if (state.hp <= 0) endRun();
        }
    }
    state.wasOffTrack = offTrack;

    // Steering
    let targetSteer = 0;
    if (left) targetSteer += state.maxSteer;
    if (right) targetSteer -= state.maxSteer;
    state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * 10);

    const speedRatio = Math.min(1, Math.abs(state.speed) / state.maxSpeed);
    const turnAmount = state.steerAngle * speedRatio * dt * 2.2 * Math.sign(state.speed || 1);
    state.angle += turnAmount;

    // Movement
    const dx = Math.sin(state.angle) * state.speed * dt;
    const dz = Math.cos(state.angle) * state.speed * dt;
    car.position.x += dx;
    car.position.z += dz;
    car.rotation.y = state.angle;

    // Distance traveled (forward motion only counts)
    if (state.speed > 0) {
        state.distance += state.speed * dt;
    }
    if (Math.abs(state.speed) > state.topSpeed) state.topSpeed = Math.abs(state.speed);

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

            nextStepTime += SIXTEENTH;
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
// position camera initially behind the car
const start = curve.getPointAt(0);
camera.position.set(start.x - Math.sin(state.angle) * 12, 6, start.z - Math.cos(state.angle) * 12);
camTarget.set(start.x, 1, start.z);
camera.lookAt(camTarget);

requestAnimationFrame(loop);

})();
