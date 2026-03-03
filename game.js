const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const progressBar = document.getElementById('progress-bar');

// Game constants
const GRAVITY = 0.8;
const JUMP_FORCE = -12;
const SPEED = 6;
const PLAYER_SIZE = 40;
const GROUND_Y = 0.8; // % of height
const GRID_SIZE = 40;

let width, height, groundY;
let gameState = 'MENU'; // MENU, PLAYING, EDITOR, GAMEOVER
let frames = 0;
let hue = 200;

// Editor Variables
let editorTool = 'spike'; // spike, block, erase
let editorScrollX = 0;
let customLevel = [];

// DOM Elements for Editor
const editorUI = document.getElementById('editor-ui');
const editorControls = document.getElementById('editor-controls');
const toolSpikeBtn = document.getElementById('tool-spike');
const toolBlockBtn = document.getElementById('tool-block');
const toolEraseBtn = document.getElementById('tool-erase');
const publishBtn = document.getElementById('publish-btn');
const exitEditorBtn = document.getElementById('exit-editor-btn');

// Game objects
let player = {
    x: 100,
    y: 0,
    vy: 0,
    rotation: 0,
    isJumping: false,
    isDead: false,
    bufferJump: false
};

let obstacles = [];
let particles = [];

// Level data (X positions, type: 0=spike, 1=block)
// Default level data removed as requested
const levelData = [];
let LEVEL_END_X = 2000;
let levelName = "";
const levelNameDisplay = document.getElementById('active-level-display');

function init() {
    resize();
    loadPublishedLevel();
    animate();
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    groundY = height * GROUND_Y;
}

function resetGame() {
    player.x = 100;
    player.y = groundY - PLAYER_SIZE;
    player.vy = 0;
    player.rotation = 0;
    player.isJumping = false;
    player.isDead = false;

    // Load from memory if available, otherwise default
    if (customLevel.length > 0) {
        obstacles = JSON.parse(JSON.stringify(customLevel));
        // Dynamically set end location based on furthest obstacle
        let furthestX = 0;
        obstacles.forEach(o => { if (o.x > furthestX) furthestX = o.x; });
        LEVEL_END_X = furthestX + 1000;
    } else {
        obstacles = JSON.parse(JSON.stringify(levelData));
        LEVEL_END_X = 2000;
    }
    particles = [];

    // Update Menu Display
    if (levelNameDisplay) {
        levelNameDisplay.innerText = levelName ? `ACTIVE LEVEL: ${levelName}` : "ACTIVE LEVEL: NO LEVEL LOADED";
    }
}

function jump() {
    if (!player.isJumping && !player.isDead) {
        player.vy = JUMP_FORCE;
        player.isJumping = true;
    }
}

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // Secret Level Editor Access
    if (gameState === 'MENU' && e.code === 'KeyL') {
        const pass = prompt("Secret Password:");
        if (pass === "GoogleDash2000") {
            enterEditor();
        } else if (pass !== null) {
            alert("Incorrect Entry!");
        }
    }

    if (gameState === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp') jump();
    }
});

window.addEventListener('keyup', (e) => keys[e.code] = false);

window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') jump();
});

window.addEventListener('touchstart', (e) => {
    if (gameState === 'PLAYING') {
        e.preventDefault();
        jump();
    }
}, { passive: false });

function enterEditor() {
    gameState = 'EDITOR';
    menu.classList.add('hidden');
    hud.style.display = 'none';
    editorUI.style.display = 'flex';
    editorControls.style.display = 'flex';
    editorScrollX = 0;
}

function exitEditor() {
    gameState = 'MENU';
    menu.classList.remove('hidden');
    editorUI.style.display = 'none';
    editorControls.style.display = 'none';
}

exitEditorBtn.addEventListener('click', exitEditor);

toolSpikeBtn.addEventListener('click', () => setTool('spike'));
toolBlockBtn.addEventListener('click', () => setTool('block'));
toolEraseBtn.addEventListener('click', () => setTool('erase'));

function setTool(tool) {
    editorTool = tool;
    toolSpikeBtn.classList.toggle('active', tool === 'spike');
    toolBlockBtn.classList.toggle('active', tool === 'block');
    toolEraseBtn.classList.toggle('active', tool === 'erase');
}

publishBtn.addEventListener('click', () => {
    const name = prompt("Enter Level Name:");
    if (name) {
        levelName = name;
        const saveData = {
            name: levelName,
            data: customLevel
        };
        localStorage.setItem('gd_google_published_level', JSON.stringify(saveData));
        alert(`'${levelName}' successfully published!`);
        exitEditor();
    }
});

function loadPublishedLevel() {
    const saved = localStorage.getItem('gd_google_published_level');
    if (saved) {
        const parsed = JSON.parse(saved);
        levelName = parsed.name || "Untitled";
        customLevel = parsed.data || [];
    }
    resetGame();
}

// Editor Mouse Interaction
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'EDITOR') return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left + editorScrollX; // Fixed: removed erroneous -200
    const my = e.clientY - rect.top;

    const gridX = Math.floor(mx / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.floor(my / GRID_SIZE) * GRID_SIZE;

    if (e.button === 0) { // Left Click - Place
        if (editorTool === 'erase') {
            removeAt(gridX, gridY);
        } else {
            placeAt(gridX, gridY, editorTool);
        }
    } else if (e.button === 2) { // Right Click - Erase
        removeAt(gridX, gridY);
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

function placeAt(x, y, tool) {
    removeAt(x, y); // Prevent overlapping
    if (tool === 'spike') {
        // Spikes in this engine are always on ground or block top
        // But for editor we save current X and let draw/collision handle Y
        customLevel.push({ x: x, type: 0 });
    } else {
        const heightFromGround = groundY - (y + GRID_SIZE);
        customLevel.push({ x: x, type: 1, w: GRID_SIZE, h: GRID_SIZE, editorY: y });
    }
}

function removeAt(x, y) {
    customLevel = customLevel.filter(obs => obs.x !== x || (obs.type === 1 && obs.editorY !== y));
}

startBtn.addEventListener('click', () => {
    gameState = 'PLAYING';
    menu.classList.add('hidden');
    hud.style.display = 'flex';
    resetGame();
});

function createDeathParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x + PLAYER_SIZE / 2,
            y: y + PLAYER_SIZE / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 8 + 2,
            life: 1.0
        });
    }
}

function update() {
    if (gameState === 'EDITOR') {
        if (keys['ArrowRight']) editorScrollX += 10;
        if (keys['ArrowLeft']) editorScrollX = Math.max(0, editorScrollX - 10);
        return;
    }

    if (gameState !== 'PLAYING' || player.isDead) {
        // Update particles even if dead
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) particles.splice(i, 1);
        });

        if (player.isDead && particles.length === 0) {
            resetGame();
        }
        return;
    }

    // Physics
    player.x += SPEED;

    // Buffer jump (hold for continuous jumping)
    if (keys['Space'] || keys['ArrowUp']) {
        if (!player.isJumping) jump();
    }

    player.vy += GRAVITY;
    player.y += player.vy;

    // Ground collision
    if (player.y + PLAYER_SIZE > groundY) {
        player.y = groundY - PLAYER_SIZE;
        player.vy = 0;
        player.isJumping = false;
        // Snap rotation to 90 deg components
        player.rotation = Math.round(player.rotation / 90) * 90;
    }

    if (player.isJumping) {
        player.rotation += 5; // Rotate during jump
    }

    // Progress bar
    const progress = Math.min((player.x / LEVEL_END_X) * 100, 100);
    progressBar.style.width = progress + '%';

    // Color shift
    hue = (hue + 0.2) % 360;

    // Collision detection
    obstacles.forEach(obs => {
        const obsX = obs.x;
        let obsY;
        if (obs.type === 0) {
            // Check for block below spike
            let baseHeight = 0;
            obstacles.forEach(other => {
                if (other.type === 1 && obs.x >= other.x && obs.x < other.x + other.w) {
                    baseHeight = other.h;
                }
            });
            obsY = groundY - baseHeight - 40;
        } else {
            obsY = groundY - obs.h;
        }

        const obsW = obs.type === 0 ? 40 : obs.w;
        const obsH = obs.type === 0 ? 40 : obs.h;

        // TIGHT HITBOXES
        let hitX = obsX;
        let hitY = obsY;
        let hitW = obsW;
        let hitH = obsH;

        if (obs.type === 0) {
            // SPIKE: Smaller horizontal hitbox for fairness
            hitX = obsX + 10;
            hitW = obsW - 20;
            hitY = obsY + 5;
            hitH = obsH - 5;
        } else {
            // BLOCK: Slightly smaller size for side detection
            hitX = obsX + 2;
            hitW = obsW - 4;
        }

        // Simple AABB collision with refined hitboxes
        if (player.x + PLAYER_SIZE - 2 > hitX &&
            player.x + 2 < hitX + hitW &&
            player.y + PLAYER_SIZE > hitY &&
            player.y < hitY + hitH) {

            // Spike collision = direct death
            if (obs.type === 0) {
                die();
            } else {
                // Block collision
                // If hitting side (check original obsX for side logic)
                if (player.x + PLAYER_SIZE - SPEED <= obsX + 2) {
                    die();
                }
                // If landing on top
                else if (player.vy > 0 && player.y + PLAYER_SIZE - player.vy <= obsY + 10) {
                    player.y = obsY - PLAYER_SIZE;
                    player.vy = 0;
                    player.isJumping = false;
                    player.rotation = Math.round(player.rotation / 90) * 90;
                }
                else {
                    die();
                }
            }
        }
    });

    if (player.x > LEVEL_END_X) {
        // Victory!
        gameState = 'MENU';
        menu.classList.remove('hidden');
        hud.style.display = 'none';
        resetGame();
    }
}

function die() {
    player.isDead = true;
    createDeathParticles(player.x, player.y);
    setTimeout(() => {
        // Reset happens when particles are gone or via update
    }, 1000);
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Dynamic background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, `hsl(${hue}, 40%, 10%)`);
    bgGrad.addColorStop(1, `hsl(${(hue + 40) % 360}, 40%, 5%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Offset camera
    const cameraX = gameState === 'EDITOR' ? -editorScrollX : -player.x + 200;
    ctx.translate(cameraX, 0);

    if (gameState === 'EDITOR') {
        // Draw Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width + editorScrollX; x += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width + editorScrollX, y);
            ctx.stroke();
        }
    }

    // Draw Ground
    ctx.strokeStyle = `hsl(${(hue + 20) % 360}, 100%, 70%)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(player.x - 200, groundY);
    ctx.lineTo(player.x + width, groundY);
    ctx.stroke();

    // Add ground glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${(hue + 20) % 360}, 100%, 50%)`;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Obstacles
    const targetObstacles = gameState === 'EDITOR' ? customLevel : obstacles;
    targetObstacles.forEach(obs => {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = `hsl(${(hue + 60) % 360}, 100%, 60%)`;
        ctx.lineWidth = 3;

        if (obs.type === 0) {
            // Spike
            const x = obs.x;
            // Check if there's a block below for stacking
            let y = groundY;
            targetObstacles.forEach(other => {
                if (other.type === 1 && obs.x >= other.x && obs.x < other.x + other.w) {
                    y = groundY - other.h;
                }
            });
            // Editor might have floating spikes - let's keep them on ground/block for simplicity

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 20, y - 40);
            ctx.lineTo(x + 40, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Block
            const y = gameState === 'EDITOR' ? obs.editorY : groundY - obs.h;
            ctx.fillRect(obs.x, y, obs.w, obs.h);
            ctx.strokeRect(obs.x, y, obs.w, obs.h);
        }
    });

    // Draw Player
    if (gameState !== 'EDITOR' && !player.isDead) {
        ctx.save();
        ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
        ctx.rotate(player.rotation * Math.PI / 180);

        // Player Square
        ctx.fillStyle = `hsl(${(hue + 180) % 360}, 100%, 60%)`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

        ctx.restore();
    }

    // Draw Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

function animate() {
    update();
    draw();
    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
init();
