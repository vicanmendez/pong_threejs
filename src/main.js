import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e12);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 1.25, 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.7);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 8, 3);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
scene.add(dir);

// World group to allow repositioning in VR
const world = new THREE.Group();
scene.add(world);

// Floor
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f1720, roughness: 1 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
world.add(floor);

// Table (low fidelity): top + net
const table = new THREE.Group();
const tableSize = { width: 2.74, height: 1.525, thickness: 0.05 }; // official ping pong dimensions in meters approx
const netHeight = 0.1525; // Mover netHeight al scope global
const tableTopGeo = new THREE.BoxGeometry(tableSize.width, tableSize.thickness, tableSize.height);
const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0, roughness: 0.9 });
const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
tableTop.position.y = 0.76; // table height ~0.76m
tableTop.castShadow = true;
tableTop.receiveShadow = true;
table.add(tableTop);

// White lines (simple): thin boxes
function addLine(x, z, w, d) {
    const line = new THREE.Mesh(
        new THREE.BoxGeometry(w, tableSize.thickness + 0.002, d),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    line.position.set(x, tableTop.position.y + 0.001, z);
    line.receiveShadow = true;
    table.add(line);
}
addLine(0, 0, tableSize.width, 0.01); // center line
addLine(0, tableSize.height/2 - 0.005, tableSize.width, 0.01);
addLine(0, -tableSize.height/2 + 0.005, tableSize.width, 0.01);

// Net
const netGeo = new THREE.BoxGeometry(0.02, netHeight, tableSize.height);
const netMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 });
const net = new THREE.Mesh(netGeo, netMat);
net.position.set(0, tableTop.position.y + netHeight / 2, 0);
net.castShadow = true;
table.add(net);

// Legs
const legGeo = new THREE.BoxGeometry(0.05, tableTop.position.y, 0.05);
const legMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
const legOffsets = [
    [ tableSize.width/2 - 0.1, tableSize.height/2 - 0.1],
    [-tableSize.width/2 + 0.1, tableSize.height/2 - 0.1],
    [ tableSize.width/2 - 0.1,-tableSize.height/2 + 0.1],
    [-tableSize.width/2 + 0.1,-tableSize.height/2 + 0.1],
];
for (const [x,z] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, legGeo.parameters.height/2, z);
    leg.castShadow = true;
    table.add(leg);
}

world.add(table);

// Paddles (low fidelity): boxes with handle
function createPaddle(color) {
	const group = new THREE.Group();
	const bladeRadius = 0.10; // ~20 cm diameter
	const bladeThickness = 0.02;
	const blade = new THREE.Mesh(
		new THREE.CylinderGeometry(bladeRadius, bladeRadius, bladeThickness, 32),
		new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })
	);
	blade.rotation.z = Math.PI / 2; // upright
	blade.rotation.x = 0; // ensure vertical
	blade.rotation.y = 0;
	blade.castShadow = true;
	blade.receiveShadow = true;

	const handleLength = 0.12;
	const handleThickness = 0.03;
	// handle orientado a lo largo del eje X (apuntando hacia el jugador)
	const handle = new THREE.Mesh(
		new THREE.BoxGeometry(handleLength, bladeThickness * 0.9, handleThickness),
		new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
	);
	handle.position.set(-(bladeRadius + handleLength/2 - 0.01), 0, 0);
	handle.castShadow = true;

	group.add(blade, handle);
	group.rotation.set(0, 0, 0); // keep whole paddle vertical
	group.userData.bladeRadius = bladeRadius;
	return group;
}

const playerPaddle = createPaddle(0xdc2626);
const cpuPaddle = createPaddle(0x16a34a);

// Position paddles along X axis near ends of table
const paddleY = tableTop.position.y + 0.06;
// Mover la raqueta del jugador más atrás hacia la frontera de la mesa
playerPaddle.position.set(-tableSize.width/2 - 0.15, paddleY, 0);
cpuPaddle.position.set(tableSize.width/2 - 0.25, paddleY, 0);
world.add(playerPaddle, cpuPaddle);

// Ball
const ballRadius = 0.02;
const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.4 })
);
ball.castShadow = true;
ball.position.set(0, paddleY, 0);
world.add(ball);

// Score boards (simple planes with canvas texture)
function createScoreTexture() {
    const size = 1024; // Resolución muy alta para máxima claridad
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const update = (scoreL, scoreR) => {
        ctx.clearRect(0,0,size,size);
        ctx.fillStyle = '#0b0e12';
        ctx.fillRect(0,0,size,size);
        ctx.fillStyle = '#e6edf3';
        ctx.font = 'bold 400px system-ui'; // Fuente muy grande para máxima legibilidad
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Agregar padding extra para números de 2 cifras
        const scoreText = `${scoreL}  :  ${scoreR}`;
        ctx.fillText(scoreText, size/2, size/2);
        texture.needsUpdate = true;
    };
    const texture = new THREE.CanvasTexture(canvas);
    return { texture, update };
}

const scoreCanvas = createScoreTexture();
const scorePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.2), // Marcador mucho más grande
    new THREE.MeshBasicMaterial({ map: scoreCanvas.texture, transparent: true })
);
// place the scoreboard at the far end (CPU side) above the table center line
// Ajustar posición para mejor visibilidad en VR
scorePlane.position.set(tableSize.width/2 + 0.3, tableTop.position.y + 1.2, 0);
// make scoreboard face camera each frame
world.add(scorePlane);

// Game state
const state = {
    running: false, // Iniciar pausado hasta configurar límite
    scoreL: 0,
    scoreR: 0,
    scoreLimit: 10, // Límite de puntos por defecto
    gameOver: false,
    ballVelocity: new THREE.Vector3(1.8, 0, (Math.random() > 0.5 ? 1 : -1) * 0.6),
    maxBallSpeed: 4.5,
    paddleSpeed: 4.6,
    cpuMaxSpeed: 2.4,
    cameraBack: 1.1,
};

// Audio context y sonidos
let audioContext;
let ballHitSound;
let backgroundMusic;
let musicGain;
let soundGain;

// Inicializar audio
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crear sonido de golpe de pelota (sintético)
        ballHitSound = createBallHitSound();
        
        // Crear música de fondo (sintética)
        backgroundMusic = createBackgroundMusic();
        
        // Configurar volúmenes
        musicGain = audioContext.createGain();
        soundGain = audioContext.createGain();
        
        musicGain.gain.value = 0.3; // Música a bajo volumen
        soundGain.gain.value = 0.5; // Sonidos a volumen medio
        
        backgroundMusic.connect(musicGain);
        musicGain.connect(audioContext.destination);
        
        ballHitSound.connect(soundGain);
        soundGain.connect(audioContext.destination);
        
    } catch (error) {
        console.log('Audio no disponible:', error);
    }
}

// Crear sonido de golpe de pelota
function createBallHitSound() {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
        const t = i / audioContext.sampleRate;
        data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 10) * 0.3;
    }
    
    return buffer;
}

// Crear música de fondo
function createBackgroundMusic() {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
        const t = i / audioContext.sampleRate;
        // Crear una melodía simple y energética
        const freq1 = 220 + Math.sin(t * 0.5) * 50; // Frecuencia base
        const freq2 = 330 + Math.sin(t * 0.3) * 30; // Armonía
        const freq3 = 440 + Math.sin(t * 0.7) * 20; // Melodía alta
        
        data[i] = (
            Math.sin(2 * Math.PI * freq1 * t) * 0.1 +
            Math.sin(2 * Math.PI * freq2 * t) * 0.08 +
            Math.sin(2 * Math.PI * freq3 * t) * 0.06
        ) * Math.sin(t * Math.PI) * 0.3; // Fade in/out
    }
    
    return buffer;
}

// Reproducir sonido de golpe
function playBallHit() {
    if (!audioContext || !ballHitSound) return;
    
    try {
        const source = audioContext.createBufferSource();
        source.buffer = ballHitSound;
        source.connect(soundGain);
        source.start();
    } catch (error) {
        console.log('Error reproduciendo sonido:', error);
    }
}

// Reproducir música de fondo
function playBackgroundMusic() {
    if (!audioContext || !backgroundMusic) return;
    
    try {
        const source = audioContext.createBufferSource();
        source.buffer = backgroundMusic;
        source.loop = true;
        source.connect(musicGain);
        source.start();
    } catch (error) {
        console.log('Error reproduciendo música:', error);
    }
}
scoreCanvas.update(state.scoreL, state.scoreR);

// Mostrar modal de configuración al cargar (asegurar ejecución aunque el DOM ya esté listo)
function bootstrap() {
    initAudio();
    showScoreLimitModal();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

// Mostrar modal de límite de puntos
function showScoreLimitModal() {
    const modal = document.getElementById('scoreLimitModal');
    modal.classList.remove('hidden');
    
    // Limpiar event listeners existentes
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    // Event listeners para botones de puntuación
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.scoreLimit = parseInt(btn.dataset.score);
            startGame();
        });
    });
    
    // Event listener para puntuación personalizada
    const customBtn = document.getElementById('customScoreBtn');
    const customInput = document.getElementById('customScore');
    
    // Limpiar listeners existentes
    customBtn.replaceWith(customBtn.cloneNode(true));
    customInput.replaceWith(customInput.cloneNode(true));
    
    // Agregar nuevos listeners
    document.getElementById('customScoreBtn').addEventListener('click', () => {
        const customScore = parseInt(document.getElementById('customScore').value);
        if (customScore && customScore > 0 && customScore <= 50) {
            state.scoreLimit = customScore;
            startGame();
        }
    });
    
    // Enter en el input personalizado
    document.getElementById('customScore').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('customScoreBtn').click();
        }
    });
}

// Iniciar el juego
function startGame() {
    const modal = document.getElementById('scoreLimitModal');
    modal.classList.add('hidden');
    
    state.running = true;
    state.gameOver = false;
    state.scoreL = 0;
    state.scoreR = 0;
    scoreCanvas.update(state.scoreL, state.scoreR);
    resetBall(1);
    
    // Iniciar música de fondo
    playBackgroundMusic();
}

// Mostrar modal de fin de juego
function showGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');
    
    if (state.scoreL >= state.scoreLimit) {
        title.textContent = '🎉 ¡Jugador Gana!';
        title.style.color = '#10b981';
    } else {
        title.textContent = '🤖 ¡CPU Gana!';
        title.style.color = '#ef4444';
    }
    
    message.textContent = `Puntuación final: ${state.scoreL} - ${state.scoreR}`;
    modal.classList.remove('hidden');
    
    // Limpiar event listeners existentes
    const playAgainBtn = document.getElementById('playAgainBtn');
    const changeSettingsBtn = document.getElementById('changeSettingsBtn');
    
    playAgainBtn.replaceWith(playAgainBtn.cloneNode(true));
    changeSettingsBtn.replaceWith(changeSettingsBtn.cloneNode(true));
    
    // Event listeners para botones
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
        startGame();
    });
    
    document.getElementById('changeSettingsBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
        showScoreLimitModal();
    });
}

// Verificar si el juego ha terminado
function checkGameOver() {
    if (state.scoreL >= state.scoreLimit || state.scoreR >= state.scoreLimit) {
        state.running = false;
        state.gameOver = true;
        setTimeout(() => showGameOverModal(), 1000); // Pequeño delay para mostrar el último punto
    }
}

// Input handling (keyboard + mouse + touch)
const input = { up: false, down: false, left: false, right: false, mouseY: null, mouseYVel: 0, rotationLocked: false, touchTarget: null };

function isAnyModalOpen() {
    return !!document.querySelector('.modal:not(.hidden)');
}

window.addEventListener('keydown', (e) => {
    if (isAnyModalOpen()) return; // No manejar teclas cuando un modal está abierto
    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
    if (e.code === 'Enter') state.running = !state.running; // pause/resume
});
window.addEventListener('keyup', (e) => {
    if (isAnyModalOpen()) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
});
window.addEventListener('mousemove', (e) => {
    const newY = e.clientY / window.innerHeight; // 0..1
    if (input.mouseY !== null) input.mouseYVel = newY - input.mouseY;
    input.mouseY = newY;
});
window.addEventListener('click', (e) => {
    if (isAnyModalOpen()) return; // Ignorar clics mientras el modal esté abierto
    input.rotationLocked = !input.rotationLocked;
});

// Touch controls for mobile
window.addEventListener('touchstart', (e) => {
    if (isAnyModalOpen()) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    // Convertir coordenadas de pantalla a posición de la mesa
    // X: 0-1 -> posición Z en la mesa (-1.5 a 1.5)
    const targetZ = (x - 0.5) * 3.0; // Mapear 0-1 a -1.5 a 1.5
    // Y: 0-1 -> posición Y de la raqueta (0.5 a 1.5)
    const targetY = 0.5 + (1 - y) * 1.0; // Invertir Y para que arriba sea arriba
    
    input.touchTarget = { z: targetZ, y: targetY };
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (isAnyModalOpen() || !input.touchTarget) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    const targetZ = (x - 0.5) * 3.0;
    const targetY = 0.5 + (1 - y) * 1.0;
    
    input.touchTarget = { z: targetZ, y: targetY };
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (isAnyModalOpen()) return;
    e.preventDefault();
    input.touchTarget = null;
});
// zoom controls: mouse wheel and +/- keys
window.addEventListener('wheel', (e) => {
    const delta = Math.sign(e.deltaY) * 0.08;
    state.cameraBack = clamp(state.cameraBack + delta, 0.4, 2.0);
});
window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') state.cameraBack = clamp(state.cameraBack - 0.08, 0.4, 2.0);
    if (e.key === '-' || e.key === '_') state.cameraBack = clamp(state.cameraBack + 0.08, 0.4, 2.0);
});

// VR controllers and grabbing
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
scene.add(controller1, controller2);

const controllerModelFactory = new XRControllerModelFactory();
const controllerGrip1 = renderer.xr.getControllerGrip(0);
controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
scene.add(controllerGrip1);
const controllerGrip2 = renderer.xr.getControllerGrip(1);
controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
scene.add(controllerGrip2);

const tempMatrix = new THREE.Matrix4();
const grabState = new Map(); // controller -> { object, offsetMatrix }
const vrControl = { active: false, originX: 0, originZ: 0, gain: 1.2 };

function makeGrabbable(obj) {
    obj.userData.grabbable = true;
}
makeGrabbable(playerPaddle);
makeGrabbable(cpuPaddle);
makeGrabbable(ball);

function onSelectStart() {
    const controller = this;
    const raycaster = new THREE.Raycaster();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix).normalize();
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObjects([playerPaddle, cpuPaddle, ball], true);
    if (intersects.length > 0) {
        const obj = intersects[0].object.parent || intersects[0].object;
        if (obj.userData.grabbable) {
            const inverse = new THREE.Matrix4().copy(controller.matrixWorld).invert();
            const offsetMatrix = new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld);
            grabState.set(controller, { object: obj, offsetMatrix });
        }
    }
}
function onSelectEnd() {
    const controller = this;
    grabState.delete(controller);
}
controller1.addEventListener('selectstart', onSelectStart);
controller1.addEventListener('selectend', onSelectEnd);
controller2.addEventListener('selectstart', onSelectStart);
controller2.addEventListener('selectend', onSelectEnd);

// VR session lifecycle: calibrate paddle mapping to controller movement
renderer.xr.addEventListener('sessionstart', () => {
    const ref = controller1 || controllerGrip1 || controller2 || controllerGrip2;
    if (ref) {
        vrControl.active = true;
        vrControl.originX = ref.position.x;
        vrControl.originZ = playerPaddle.position.z;
        vrControl.originY = ref.position.y;
    }
    
    // Calibrar la escena para que el usuario quede detrás de su paleta (roja)
    // 1) Girar el mundo para alinear el eje X de la mesa con la dirección de mirada (-Z de la cámara)
    const rotY = -Math.PI / 2; // mantiene el lado del jugador al frente
    world.rotation.set(0, rotY, 0);
    // 2) Colocar el mundo de manera que la paleta del jugador quede centrada y a ~0.7m por delante
    const yAxis = new THREE.Vector3(0, 1, 0);
    const playerPosRotated = playerPaddle.position.clone().applyAxisAngle(yAxis, rotY);
    // Colocar la paleta ligeramente delante (~0.35m) para poder agarrarla cómodamente
    const desiredZ = -0.35; // distancia cómoda delante del usuario
    // traslación necesaria para llevar playerPosRotated a (x=0, z=desiredZ)
    world.position.set(-playerPosRotated.x, 0, desiredZ - playerPosRotated.z);

    // Mostrar controles VR cuando se inicia la sesión
    if (window.showVRControls) {
        window.showVRControls();
    }
});

// VR session lifecycle: restaurar controles normales al salir
renderer.xr.addEventListener('sessionend', () => {
    // Ocultar controles VR cuando se termina la sesión
    if (window.hideVRControls) {
        window.hideVRControls();
    }
    // Restaurar orientación y posición del mundo al salir de VR
    world.rotation.set(0, 0, 0);
    world.position.set(0, 0, 0);
});


// Resize
window.addEventListener('resize', onWindowResize);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Helpers
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

// Game bounds
const bounds = {
    zMin: -tableSize.height/2 + ballRadius,
    zMax:  tableSize.height/2 - ballRadius,
    xMin: -tableSize.width/2 + 0.1,
    xMax:  tableSize.width/2 - 0.1,
};

function resetBall(direction = 1) {
    ball.position.set(0, paddleY + 0.1, 0); // Ligeramente por encima de la mesa
    state.ballVelocity.set(direction * 1.6, 2.0, (Math.random() > 0.5 ? 1 : -1) * 1.0); // Velocidad vertical inicial
}

// CPU simple AI: move towards predicted z where ball crosses cpu x
function updateCPU(dt) {
    const targetX = cpuPaddle.position.x;
    const dx = targetX - ball.position.x;
    if (dx < -0.01) {
        // ball moving towards CPU
        const timeToReach = Math.abs((cpuPaddle.position.x - ball.position.x) / state.ballVelocity.x);
        let predictedZ = ball.position.z + state.ballVelocity.z * timeToReach;
        // reflect off bounds prediction
        const span = bounds.zMax - bounds.zMin;
        const normalized = (predictedZ - bounds.zMin) / span;
        const reflected = Math.abs((normalized % 2) - 1); // triangle wave
        predictedZ = bounds.zMin + reflected * span;
        const delta = predictedZ - cpuPaddle.position.z;
        const move = clamp(delta, -state.cpuMaxSpeed * dt, state.cpuMaxSpeed * dt);
        const prevZ = cpuPaddle.position.z;
        cpuPaddle.position.z += move;
        // add subtle rotation based on movement direction
        const dz = cpuPaddle.position.z - prevZ;
        cpuPaddle.rotation.y = THREE.MathUtils.clamp(-dz * 0.6, -0.35, 0.35);
    } else {
        // idle gently towards center
        const delta = -cpuPaddle.position.z;
        const move = clamp(delta, -state.cpuMaxSpeed * 0.5 * dt, state.cpuMaxSpeed * 0.5 * dt);
        const prevZ = cpuPaddle.position.z;
        cpuPaddle.position.z += move;
        const dz = cpuPaddle.position.z - prevZ;
        cpuPaddle.rotation.y = THREE.MathUtils.clamp(-dz * 0.6, -0.35, 0.35);
    }
    // clamp within table
    const zRange = bounds.zMax - 0.1;
    cpuPaddle.position.z = clamp(cpuPaddle.position.z, -zRange, zRange);
}

// Player control update
function updatePlayer(dt) {
    let targetZ = playerPaddle.position.z;
    let targetY = playerPaddle.position.y;
    
    const usingKeys = input.up || input.down || input.left || input.right;
    
    // Prioridad: Touch > Mouse > Keyboard
    if (input.touchTarget) {
        // Control táctil para móvil
        targetZ = clamp(input.touchTarget.z, bounds.zMin + 0.12, bounds.zMax - 0.12);
        targetY = clamp(input.touchTarget.y, 0.5, 1.5);
    } else if (!usingKeys && input.mouseY !== null) {
        // Control con mouse
        const t = ((1 - input.mouseY) * 2 - 1); // -1..1
        targetZ = clamp(t * (tableSize.height/2 - 0.12), bounds.zMin + 0.12, bounds.zMax - 0.12);
        // feed-forward from mouse velocity for extra responsiveness (same sign as t)
        const feedForward = input.mouseYVel * (tableSize.height * 2.6);
        targetZ = clamp(targetZ + feedForward, bounds.zMin + 0.12, bounds.zMax - 0.12);
    } else if (usingKeys) {
        // Control con teclado
        // Movimiento horizontal (A/D o flechas izquierda/derecha)
        if (input.left) targetZ -= state.paddleSpeed * dt;
        if (input.right) targetZ += state.paddleSpeed * dt;
        
        // Movimiento vertical (W/S o flechas arriba/abajo)
        if (input.up) targetY += state.paddleSpeed * dt;
        if (input.down) targetY -= state.paddleSpeed * dt;
    }
    
    // Aplicar movimiento suave con damping
    const prevZ = playerPaddle.position.z;
    const prevY = playerPaddle.position.y;
    
    playerPaddle.position.z = THREE.MathUtils.damp(playerPaddle.position.z, targetZ, 80.0, dt);
    playerPaddle.position.y = THREE.MathUtils.damp(playerPaddle.position.y, targetY, 80.0, dt);
    
    // Rotation feedback based on movement; click toggles upright lock
    const dz = playerPaddle.position.z - prevZ;
    const dyPlayer = playerPaddle.position.y - prevY;
    const targetYaw = input.rotationLocked ? 0 : THREE.MathUtils.clamp(-dz * 1.0, -0.5, 0.5);
    playerPaddle.rotation.y = THREE.MathUtils.damp(playerPaddle.rotation.y, targetYaw, 16.0, dt);
    
    // Clamp positions within bounds
    playerPaddle.position.z = clamp(playerPaddle.position.z, bounds.zMin + 0.12, bounds.zMax - 0.12);
    playerPaddle.position.y = clamp(playerPaddle.position.y, 0.5, 1.5); // Rango vertical de movimiento
    
    // decay mouse velocity to avoid buildup
    input.mouseYVel *= 0.35;
}

// Paddle collision function
function collideWithPaddle(paddle, isPlayer) {
    const r = paddle.userData.bladeRadius || 0.10;
    const px = paddle.position.x, pz = paddle.position.z, py = paddle.position.y;
    const dz = ball.position.z - pz;
    const dy = ball.position.y - py;
    const withinCircle = (dz*dz) <= (r + ballRadius) * (r + ballRadius);
    const nearPlaneX = Math.abs(ball.position.x - px) <= (r + ballRadius + 0.05);
    const withinHeight = Math.abs(dy) <= (r + ballRadius + 0.05);
    
        if (withinCircle && nearPlaneX && withinHeight) {
            // Reproducir sonido de golpe
            playBallHit();
            
            // Invertir velocidad horizontal
            state.ballVelocity.x = Math.abs(state.ballVelocity.x) * (isPlayer ? 1 : -1) * 1.06;
            
            // Añadir efecto de la paleta en Z basado en la posición relativa
            state.ballVelocity.z += (ball.position.z - pz) * 3.2 * 0.016; // Usar dt fijo para evitar problemas
            
            // Añadir efecto de la paleta en Y basado en la posición relativa
            state.ballVelocity.y += (ball.position.y - py) * 2.0 * 0.016; // Usar dt fijo para evitar problemas
            
            // Asegurar velocidad mínima hacia arriba para mantener el juego dinámico
            if (state.ballVelocity.y < 2.0) {
                state.ballVelocity.y = 2.0;
            }
            
            const speed = state.ballVelocity.length();
            if (speed > state.maxBallSpeed) state.ballVelocity.multiplyScalar(state.maxBallSpeed / speed);
            ball.position.x = px + (isPlayer ? 1 : -1) * (r + ballRadius + 0.003);
        }
}

// Simple physics and collisions
function updateBall(dt) {
    // Aplicar gravedad a la pelota
    state.ballVelocity.y -= 9.8 * dt; // Gravedad realista
    
    // Actualizar posición de la pelota
    ball.position.addScaledVector(state.ballVelocity, dt);
    
    // Rebotar en el suelo (mesa)
    if (ball.position.y <= tableTop.position.y + ballRadius) {
        ball.position.y = tableTop.position.y + ballRadius;
        state.ballVelocity.y = Math.abs(state.ballVelocity.y) * 0.8; // Pérdida de energía en el rebote
    }

    // wall bounces on Z
    if (ball.position.z < bounds.zMin) {
        ball.position.z = bounds.zMin;
        state.ballVelocity.z = Math.abs(state.ballVelocity.z);
    }
    if (ball.position.z > bounds.zMax) {
        ball.position.z = bounds.zMax;
        state.ballVelocity.z = -Math.abs(state.ballVelocity.z);
    }
    
    // Colisión con la red del medio
    if (Math.abs(ball.position.x) <= 0.02 && ball.position.y <= tableTop.position.y + netHeight) {
        // La pelota está en la posición X de la red y por debajo de su altura
        if (state.ballVelocity.x > 0) {
            // Pelota moviéndose hacia la derecha, rebotar hacia la izquierda
            state.ballVelocity.x = -Math.abs(state.ballVelocity.x) * 0.9; // Pérdida de energía
            ball.position.x = -0.02; // Posicionar ligeramente a la izquierda de la red
        } else if (state.ballVelocity.x < 0) {
            // Pelota moviéndose hacia la izquierda, rebotar hacia la derecha
            state.ballVelocity.x = Math.abs(state.ballVelocity.x) * 0.9; // Pérdida de energía
            ball.position.x = 0.02; // Posicionar ligeramente a la derecha de la red
        }
    }

    // paddle collisions (upright circular blade proxy)
    if (state.ballVelocity.x < 0 && ball.position.x <= playerPaddle.position.x + 0.12) collideWithPaddle(playerPaddle, true);
    if (state.ballVelocity.x > 0 && ball.position.x >= cpuPaddle.position.x - 0.12) collideWithPaddle(cpuPaddle, false);

    // scoring: ball passes behind paddle x
    if (ball.position.x < bounds.xMin - 0.2) {
        state.scoreR += 1; 
        scoreCanvas.update(state.scoreL, state.scoreR); 
        resetBall(1);
        checkGameOver();
    }
    if (ball.position.x > bounds.xMax + 0.2) {
        state.scoreL += 1; 
        scoreCanvas.update(state.scoreL, state.scoreR); 
        resetBall(-1);
        checkGameOver();
    }
}

// Camera: first-person viewpoint slightly behind player's paddle
function updateCameraFP(dt) {
    const isVR = renderer.xr.isPresenting;
    const session = renderer.xr.getSession ? renderer.xr.getSession() : null;
    const isImmersive = session && session.mode === 'immersive-vr';

    if (isVR && !isImmersive) {
        // Vista previa VR (no inmersiva, en navegador)
        const desired = new THREE.Vector3(-3.5, 1.3, 0.4);
        camera.position.lerp(desired, clamp(10 * dt, 0, 1));
        const lookAtTarget = new THREE.Vector3(0, tableTop.position.y + 0.1, 0);
        camera.lookAt(lookAtTarget);

        // En vista previa, mantener el marcador del lado CPU (derecha)
        scorePlane.position.set(tableSize.width/2 + 0.3, tableTop.position.y + 1.2, 0);
    } else if (isImmersive) {
        // En VR inmersivo el headset controla la cámara
        // NO tocar camera.position ni camera.lookAt
        // Mantener el marcador en el lado CPU como en desktop/móvil
        scorePlane.position.set(tableSize.width/2 + 0.3, tableTop.position.y + 1.2, 0);
    } else {
        // Vista normal (desktop/móvil)
        const back = THREE.MathUtils.lerp(0.35, 1.4, state.cameraBack);
        const desired = new THREE.Vector3(playerPaddle.position.x - back, 1.1, playerPaddle.position.z);
        camera.position.lerp(desired, clamp(10 * dt, 0, 1));
        const lookAtTarget = new THREE.Vector3(0, tableTop.position.y + 0.05, playerPaddle.position.z * 0.6);
        camera.lookAt(lookAtTarget);
    }
}


// Update grabbed objects to follow controller
function updateGrabs() {
    for (const [controller, data] of grabState.entries()) {
        const { object, offsetMatrix } = data;
        const newMatrix = new THREE.Matrix4().multiplyMatrices(controller.matrixWorld, offsetMatrix);
        newMatrix.decompose(object.position, object.quaternion, object.scale);
        // Mantener paddles verticales aunque el controlador tenga roll/pitch
        if (object === playerPaddle || object === cpuPaddle) {
            object.rotation.x = 0;
            object.rotation.z = 0;
        }
        // if ball is grabbed, zero velocity
        if (object === ball) {
            state.ballVelocity.set(0,0,0);
        }
    }
}

// VR controls: map hand movement to paddle position and camera movement
function updateVRControls(dt) {
    if (!renderer.xr.isPresenting || !vrControl.active) return;
    
    // Solo aplicar controles VR en modo inmersivo
    const isImmersive = renderer.xr.getSession && renderer.xr.getSession() && renderer.xr.getSession().mode === 'immersive-vr';
    if (!isImmersive) return;
    
    // Obtener gamepads de ambos controladores
    const gamepad1 = controller1 && controller1.gamepad ? controller1.gamepad : null;
    const gamepad2 = controller2 && controller2.gamepad ? controller2.gamepad : null;
    
    // MOVIMIENTO DE CÁMARA CON JOYSTICK IZQUIERDO
    if (gamepad1 && gamepad1.axes && gamepad1.axes.length >= 2) {
        // Joystick izquierdo: ejes 0 (horizontal) y 1 (vertical)
        const leftStickX = gamepad1.axes[0] || 0;
        const leftStickY = gamepad1.axes[1] || 0;
        
        // Mover el mundo (mesa) en dirección opuesta para simular movimiento de cámara
        const cameraSpeed = 2.0; // Velocidad de movimiento de cámara
        const deadzone = 0.1; // Zona muerta para evitar drift
        
        if (Math.abs(leftStickX) > deadzone) {
            world.position.x -= leftStickX * cameraSpeed * dt;
        }
        if (Math.abs(leftStickY) > deadzone) {
            world.position.z -= leftStickY * cameraSpeed * dt;
        }
        
        // Limitar el movimiento del mundo para mantener la mesa visible
        world.position.x = clamp(world.position.x, -3, 3);
        world.position.z = clamp(world.position.z, -3, 3);
    }
    
    // CONTROL DEL PADDLE CON JOYSTICK DERECHO
    if (gamepad1 && gamepad1.axes && gamepad1.axes.length >= 4) {
        // Joystick derecho: ejes 2 (horizontal) y 3 (vertical)
        const rightStickX = gamepad1.axes[2] || 0;
        const rightStickY = gamepad1.axes[3] || 0;
        
        const deadzone = 0.1;
        const paddleSpeed = 3.0;
        
        let targetZ = playerPaddle.position.z;
        let targetY = playerPaddle.position.y;
        
        // Mover paddle con joystick derecho
        if (Math.abs(rightStickX) > deadzone) {
            targetZ += rightStickX * paddleSpeed * dt;
        }
        if (Math.abs(rightStickY) > deadzone) {
            targetY += rightStickY * paddleSpeed * dt;
        }
        
        // Aplicar movimiento suave con damping
        const prevZ = playerPaddle.position.z;
        const prevY = playerPaddle.position.y;
        
        playerPaddle.position.z = THREE.MathUtils.damp(playerPaddle.position.z, clamp(targetZ, bounds.zMin + 0.12, bounds.zMax - 0.12), 80.0, dt);
        playerPaddle.position.y = THREE.MathUtils.damp(playerPaddle.position.y, clamp(targetY, 0.5, 1.5), 80.0, dt);
        
        const dz = playerPaddle.position.z - prevZ;
        
        // Mantener paddle vertical, con rotación basada en movimiento
        playerPaddle.rotation.x = 0;
        playerPaddle.rotation.z = 0;
        const targetYaw = THREE.MathUtils.clamp(-dz * 1.0, -0.5, 0.5);
        playerPaddle.rotation.y = THREE.MathUtils.damp(playerPaddle.rotation.y, targetYaw, 16.0, dt);
    }
}

// Animate
let last = performance.now();
renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    updateGrabs();

    if (state.running && !state.gameOver) {
        // VR control overrides player mouse/keyboard when in VR inmersivo
        const isImmersive = renderer.xr.isPresenting && renderer.xr.getSession && renderer.xr.getSession() && renderer.xr.getSession().mode === 'immersive-vr';
        if (isImmersive) {
            updateVRControls(dt);
        } else {
            updatePlayer(dt);
        }
        updateCPU(dt);
        updateBall(dt);
    }
    updateCameraFP(dt);
    // billboard score to camera
    scorePlane.lookAt(camera.position);

    renderer.render(scene, camera);
});

