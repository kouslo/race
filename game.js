(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const TOTAL_LAPS = 3;

    // Track defined as a center-line polygon. The track is drawn as a thick
    // stroke along this path. Checkpoints are placed along it to detect laps
    // and prevent shortcuts.
    const trackPath = [
        { x: 200, y: 120 },
        { x: 700, y: 120 },
        { x: 780, y: 200 },
        { x: 780, y: 300 },
        { x: 600, y: 320 },
        { x: 600, y: 420 },
        { x: 760, y: 480 },
        { x: 500, y: 530 },
        { x: 250, y: 500 },
        { x: 130, y: 400 },
        { x: 300, y: 320 },
        { x: 130, y: 220 },
    ];
    const TRACK_WIDTH = 70;

    // Start/finish line: between trackPath[0] and trackPath[1] near the start
    const startLine = { x: 250, y: 120, angle: 0 };

    const keys = {};
    window.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    });
    window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

    const car = {
        x: startLine.x,
        y: startLine.y,
        angle: 0,
        speed: 0,
        // physics
        maxSpeed: 320,
        maxReverse: -120,
        accel: 180,
        brake: 260,
        friction: 60,
        turnSpeed: 2.8,
        width: 22,
        height: 38,
        drifting: false,
    };

    let state = "menu"; // menu, playing, finished
    let lap = 1;
    let elapsed = 0;
    let lapStart = 0;
    let bestLap = null;
    let checkpointsHit = [];
    let lastTimestamp = 0;

    // Build checkpoint segments along the track path
    const checkpoints = trackPath.map((p, i) => {
        const next = trackPath[(i + 1) % trackPath.length];
        return {
            x: (p.x + next.x) / 2,
            y: (p.y + next.y) / 2,
            ang: Math.atan2(next.y - p.y, next.x - p.x),
        };
    });

    function reset() {
        car.x = startLine.x;
        car.y = startLine.y;
        car.angle = 0;
        car.speed = 0;
        lap = 1;
        elapsed = 0;
        lapStart = 0;
        checkpointsHit = [];
        updateHUD();
    }

    function updateHUD() {
        document.getElementById("speed").textContent = Math.round(Math.abs(car.speed));
        document.getElementById("lap").textContent = lap;
        document.getElementById("total-laps").textContent = TOTAL_LAPS;
        document.getElementById("time").textContent = elapsed.toFixed(2);
        document.getElementById("best").textContent = bestLap === null ? "--" : bestLap.toFixed(2) + "s";
    }

    // Distance from point to segment
    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        return Math.hypot(px - cx, py - cy);
    }

    function distanceToTrackCenter(x, y) {
        let min = Infinity;
        for (let i = 0; i < trackPath.length; i++) {
            const a = trackPath[i];
            const b = trackPath[(i + 1) % trackPath.length];
            const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
            if (d < min) min = d;
        }
        return min;
    }

    function update(dt) {
        if (state !== "playing") return;

        const accelerating = keys["arrowup"] || keys["w"];
        const reversing = keys["arrowdown"] || keys["s"];
        const left = keys["arrowleft"] || keys["a"];
        const right = keys["arrowright"] || keys["d"];
        const handbrake = keys[" "];

        if (accelerating) {
            car.speed += car.accel * dt;
        } else if (reversing) {
            car.speed -= car.brake * dt;
        } else {
            // friction
            if (car.speed > 0) car.speed = Math.max(0, car.speed - car.friction * dt);
            else if (car.speed < 0) car.speed = Math.min(0, car.speed + car.friction * dt);
        }

        if (handbrake) {
            const decel = 200 * dt;
            if (car.speed > 0) car.speed = Math.max(0, car.speed - decel);
            else if (car.speed < 0) car.speed = Math.min(0, car.speed + decel);
            car.drifting = Math.abs(car.speed) > 60;
        } else {
            car.drifting = false;
        }

        car.speed = Math.max(car.maxReverse, Math.min(car.maxSpeed, car.speed));

        // off-track slowdown
        const trackDist = distanceToTrackCenter(car.x, car.y);
        if (trackDist > TRACK_WIDTH / 2) {
            const over = trackDist - TRACK_WIDTH / 2;
            const slow = Math.min(180, 40 + over * 4) * dt;
            if (car.speed > 0) car.speed = Math.max(0, car.speed - slow);
            else if (car.speed < 0) car.speed = Math.min(0, car.speed + slow);
            // Limit max speed off track
            const offMax = 120;
            if (car.speed > offMax) car.speed = offMax;
            if (car.speed < -offMax) car.speed = -offMax;
        }

        // steering scales with speed
        const speedRatio = Math.min(1, Math.abs(car.speed) / car.maxSpeed);
        const turn = car.turnSpeed * speedRatio * dt;
        if (left) car.angle -= turn * Math.sign(car.speed || 1);
        if (right) car.angle += turn * Math.sign(car.speed || 1);

        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;

        // keep within canvas
        car.x = Math.max(10, Math.min(W - 10, car.x));
        car.y = Math.max(10, Math.min(H - 10, car.y));

        // Checkpoint detection
        for (let i = 0; i < checkpoints.length; i++) {
            const cp = checkpoints[i];
            const d = Math.hypot(car.x - cp.x, car.y - cp.y);
            if (d < 40 && !checkpointsHit.includes(i)) {
                // must hit them in order starting from 0
                const expected = checkpointsHit.length === 0 ? 0 : (checkpointsHit[checkpointsHit.length - 1] + 1) % checkpoints.length;
                if (i === expected) {
                    checkpointsHit.push(i);
                }
            }
        }

        // Lap completed when all checkpoints hit
        if (checkpointsHit.length === checkpoints.length) {
            const lapTime = elapsed - lapStart;
            if (bestLap === null || lapTime < bestLap) bestLap = lapTime;
            lapStart = elapsed;
            checkpointsHit = [];
            lap++;
            if (lap > TOTAL_LAPS) {
                state = "finished";
                document.getElementById("final-time").textContent = elapsed.toFixed(2);
                document.getElementById("final-best").textContent = (bestLap || 0).toFixed(2);
                document.getElementById("finish-overlay").classList.remove("hidden");
            }
        }

        elapsed += dt;
        updateHUD();
    }

    function drawTrack() {
        // grass background pattern
        ctx.fillStyle = "#4a7c3a";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#427032";
        for (let y = 0; y < H; y += 24) {
            for (let x = (y % 48 === 0 ? 0 : 24); x < W; x += 48) {
                ctx.fillRect(x, y, 12, 12);
            }
        }

        // Track outer border
        ctx.strokeStyle = "#222";
        ctx.lineWidth = TRACK_WIDTH + 8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        trackPath.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // Track surface
        ctx.strokeStyle = "#555";
        ctx.lineWidth = TRACK_WIDTH;
        ctx.beginPath();
        trackPath.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // center dashed line
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 14]);
        ctx.beginPath();
        trackPath.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // start/finish line
        ctx.save();
        ctx.translate(startLine.x, startLine.y);
        const checkerW = TRACK_WIDTH;
        const checkerH = 12;
        ctx.translate(-3, -checkerW / 2);
        for (let i = 0; i < checkerW / 6; i++) {
            ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
            ctx.fillRect(0, i * 6, checkerH, 6);
        }
        ctx.restore();
    }

    function drawCar() {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle + Math.PI / 2);

        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(-car.width / 2 + 2, -car.height / 2 + 2, car.width, car.height);

        // body
        const grad = ctx.createLinearGradient(-car.width / 2, 0, car.width / 2, 0);
        grad.addColorStop(0, "#c1121f");
        grad.addColorStop(0.5, "#ef476f");
        grad.addColorStop(1, "#c1121f");
        ctx.fillStyle = grad;
        ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

        // windshield
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(-car.width / 2 + 3, -car.height / 2 + 6, car.width - 6, 10);

        // rear window
        ctx.fillRect(-car.width / 2 + 3, car.height / 2 - 12, car.width - 6, 6);

        // headlights
        ctx.fillStyle = "#fff7c0";
        ctx.fillRect(-car.width / 2 + 2, -car.height / 2, 4, 3);
        ctx.fillRect(car.width / 2 - 6, -car.height / 2, 4, 3);

        // tail lights
        ctx.fillStyle = "#ff3030";
        ctx.fillRect(-car.width / 2 + 2, car.height / 2 - 3, 4, 3);
        ctx.fillRect(car.width / 2 - 6, car.height / 2 - 3, 4, 3);

        ctx.restore();

        // skid marks while drifting
        if (car.drifting) {
            ctx.fillStyle = "rgba(20,20,20,0.6)";
            ctx.beginPath();
            ctx.arc(car.x, car.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // persistent skid marks layer
    const skidCanvas = document.createElement("canvas");
    skidCanvas.width = W;
    skidCanvas.height = H;
    const skidCtx = skidCanvas.getContext("2d");

    function addSkid() {
        if (!car.drifting) return;
        skidCtx.fillStyle = "rgba(20,20,20,0.4)";
        const offset = car.width / 2 - 3;
        const lx = car.x + Math.cos(car.angle + Math.PI / 2) * offset;
        const ly = car.y + Math.sin(car.angle + Math.PI / 2) * offset;
        const rx = car.x - Math.cos(car.angle + Math.PI / 2) * offset;
        const ry = car.y - Math.sin(car.angle + Math.PI / 2) * offset;
        skidCtx.beginPath();
        skidCtx.arc(lx, ly, 2, 0, Math.PI * 2);
        skidCtx.arc(rx, ry, 2, 0, Math.PI * 2);
        skidCtx.fill();
    }

    function render() {
        drawTrack();
        ctx.drawImage(skidCanvas, 0, 0);
        drawCar();
    }

    function loop(ts) {
        if (!lastTimestamp) lastTimestamp = ts;
        const dt = Math.min(0.05, (ts - lastTimestamp) / 1000);
        lastTimestamp = ts;

        update(dt);
        addSkid();
        render();

        if (keys["r"]) {
            reset();
            skidCtx.clearRect(0, 0, W, H);
            keys["r"] = false;
        }

        requestAnimationFrame(loop);
    }

    document.getElementById("start-btn").addEventListener("click", () => {
        document.getElementById("overlay").classList.add("hidden");
        state = "playing";
        reset();
        skidCtx.clearRect(0, 0, W, H);
    });

    document.getElementById("restart-btn").addEventListener("click", () => {
        document.getElementById("finish-overlay").classList.add("hidden");
        state = "playing";
        reset();
        skidCtx.clearRect(0, 0, W, H);
    });

    // initial render so menu shows the track behind it
    render();
    requestAnimationFrame(loop);
})();
