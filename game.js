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

let width, height, groundY;
let gameState = 'MENU';
let frames = 0;
let hue = 200;

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
const levelData = [
    { x: 800, type: 0 },
    { x: 1200, type: 0 },
    { x: 1500, type: 1, w: 120, h: 40 },
    { x: 1800, type: 0 },
    { x: 1860, type: 0 },
    { x: 2100, type: 1, w: 40, h: 80 },
    { x: 2140, type: 1, w: 40, h: 120 },
    { x: 2500, type: 0 },
    { x: 2560, type: 0 },
    { x: 2800, type: 1, w: 200, h: 40 },
    { x: 2800, type: 0 }, // Spike on top of block (will need offset)
    { x: 3200, type: 0 },
    { x: 3260, type: 0 },
    { x: 3320, type: 0 },
    { x: 3600, type: 1, w: 80, h: 80 },
    { x: 3680, type: 1, w: 80, h: 40 },
    { x: 4000, type: 0 },
    { x: 4200, type: 0 },
    { x: 4400, type: 1, w: 300, h: 40 },
    { x: 4450, type: 0 }, // Spike on bridge
];
const LEVEL_END_X = 5500;

function init() {
    resize();
    resetGame();
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
    obstacles = [...levelData];
    particles = [];
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
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameState === 'PLAYING') jump();
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') jump();
});
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'PLAYING') jump();
});

startBtn.addEventListener('click', () => {
    gameState = 'PLAYING';
    menu.classList.add('hidden');
    hud.style.display = 'flex';
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

        // Simple AABB collision
        if (player.x + PLAYER_SIZE > obsX &&
            player.x < obsX + obsW &&
            player.y + PLAYER_SIZE > obsY &&
            player.y < obsY + obsH) {

            // Spike collision = direct death
            if (obs.type === 0) {
                die();
            } else {
                // Block collision
                // If hitting side
                if (player.x + PLAYER_SIZE - SPEED <= obsX) {
                    die();
                }
                // If landing on top
                else if (player.vy > 0 && player.y + PLAYER_SIZE - player.vy <= obsY) {
                    player.y = obsY - PLAYER_SIZE;
                    player.vy = 0;
                    player.isJumping = false;
                    player.rotation = Math.round(player.rotation / 90) * 90;
                }
                // If hitting bottom (optional but good for GD)
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
    // Offset camera to follow player (basic horizontal scroll)
    const cameraX = -player.x + 200;
    ctx.translate(cameraX, 0);

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
    obstacles.forEach(obs => {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = `hsl(${(hue + 60) % 360}, 100%, 60%)`;
        ctx.lineWidth = 3;

        if (obs.type === 0) {
            // Spike
            const x = obs.x;
            // Check if there's a block below for stacking
            let y = groundY;
            obstacles.forEach(other => {
                if (other.type === 1 && obs.x >= other.x && obs.x < other.x + other.w) {
                    y = groundY - other.h;
                }
            });

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 20, y - 40);
            ctx.lineTo(x + 40, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            // Block
            const y = groundY - obs.h;
            ctx.fillRect(obs.x, y, obs.w, obs.h);
            ctx.strokeRect(obs.x, y, obs.w, obs.h);
        }
    });

    // Draw Player
    if (!player.isDead) {
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

        // Face detail
        ctx.fillStyle = '#000';
        ctx.fillRect(-12, -12, 8, 8);
        ctx.fillRect(4, -12, 8, 8);
        ctx.fillRect(-10, 8, 20, 4);

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
