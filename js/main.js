/**
 * main.js
 * Initializes the Google Quantum AI 360° Laboratory Skybox & IBL Environment
 * together with the 38-node Google Quantum AI Dilution Refrigerator & Willow QPU
 * and the 22-step interactive tour system.
 */

class QuantumLabExperimentApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.autoOrbit = false;

        this.initRenderer();
        this.initSceneAndCamera();
        this.initEnvironment();
        this.initQuantumComputer();
        this.initUI();
        this.initCircuitLab();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.02;
        this.container.appendChild(this.renderer.domElement);
    }

    initSceneAndCamera() {
        this.scene = new THREE.Scene();

        // Subtle soft hemispheric fill to complement the primary Radiance .HDR IBL
        // while keeping metallic reflections driven by scene.environment
        const hemiFill = new THREE.HemisphereLight(0xffffff, 0x334155, 0.28);
        this.scene.add(hemiFill);

        this.camera = new THREE.PerspectiveCamera(
            48,
            window.innerWidth / window.innerHeight,
            0.05,
            250.0
        );
        // Default camera framing the extended 3D T-slot gantry frame, chandelier, +X Control Rack, and -X Gas Handling Cabinet
        this.camera.position.set(0.0, 1.38, 3.85);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0.0, 1.22, 0.0);
        this.controls.minDistance = 0.28;
        this.controls.maxDistance = 5.35;
    }

    initEnvironment() {
        this.labEnv = new QuantumLabSkyboxEnvironment(
            this.renderer,
            this.scene,
            this.camera,
            this.controls
        );
        // Allow close-up zoom onto the QPU (0.28m) up to full lab overview (5.35m) inside the 6.2m 3D room
        this.controls.minDistance = 0.28;
        this.controls.maxDistance = 5.35;

        // Default to the Google Quantum AI Santa Barbara Laboratory 360° Skybox in Calibrated Ground-Anchored 3D Room mode
        this.labEnv.loadEnvironment('google_lab');
        this.labEnv.setProjectionMode('ground');
        this.controls.update();
    }

    initQuantumComputer() {
        this.quantumComputer = new GoogleQuantumComputer(this.scene);
        this.interaction = new QuantumObjectInteraction(this, this.quantumComputer);
    }

    initUI() {
        // 1. Camera Reset & Auto-Orbit Toggle
        const resetBtn = document.getElementById('btn-reset-cam');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.interaction) {
                    this.interaction.clearSelection(true);
                }
            });
        }

        const orbitBtn = document.getElementById('btn-auto-orbit');
        if (orbitBtn) {
            orbitBtn.addEventListener('click', () => {
                this.autoOrbit = !this.autoOrbit;
                this.controls.autoRotate = this.autoOrbit;
                this.controls.autoRotateSpeed = 0.85;
                orbitBtn.textContent = this.autoOrbit ? 'Auto-Orbit: On' : 'Auto-Orbit: Off';
                orbitBtn.classList.toggle('active', this.autoOrbit);
            });
        }

        // 4. Reference Photos Drawer Toggle
        const refToggle = document.getElementById('btn-ref-toggle');
        const refClose = document.getElementById('ref-close-btn');
        const refDrawer = document.getElementById('ref-drawer');

        if (refToggle && refDrawer) {
            refToggle.addEventListener('click', () => {
                const isHidden = refDrawer.style.display === 'none';
                refDrawer.style.display = isHidden ? 'block' : 'none';
                refToggle.classList.toggle('active', isHidden);
            });
        }
        if (refClose && refDrawer) {
            refClose.addEventListener('click', () => {
                refDrawer.style.display = 'none';
                if (refToggle) refToggle.classList.remove('active');
            });
        }
    }

    initCircuitLab() {
        if (window.QuantumCircuitLabUI) {
            this.circuitLab = new QuantumCircuitLabUI(this);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame((now) => this.animate(now));
        if (this.interaction) {
            this.interaction.update(performance.now());
        }
        this.controls.update();
        if (this.labEnv && this.labEnv.skyboxCubeMesh) {
            this.labEnv.skyboxCubeMesh.position.copy(this.camera.position);
        }
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new QuantumLabExperimentApp();
});
