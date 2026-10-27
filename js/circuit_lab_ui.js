/**
 * circuit_lab_ui.js
 * Implements the Google Lab Friendly Light-Theme Quantum Circuit Lab:
 * - Inspired by learn-arduino-red.vercel.app & Google Quantum AI friendly UI palette
 * - Interactive Physical Superconducting Quantum Processor Board (chamfered aluminum carrier,
 *   silicon interposer, gold SMA coax launches, meandering λ/4 readout resonators, tunable
 *   couplers, and cross-shaped Xmon transmon qubits with twin Josephson junctions)
 * - Tactile Coaxial Pulse & Gate Composer track synced in real time with the physical chip
 * - Clean, uncluttered layout with a Tabbed Right Inspector (Bloch Spheres | Readout Shots | Math & State)
 */

class QuantumCircuitLabUI {
    constructor(app) {
        this.app = app;
        this.isLabActive = false;
        this.showFormalMath = false;
        this.activeRightTab = 'bloch'; // 'bloch' | 'shots' | 'math'

        // Circuit state
        this.numQubits = 2;
        this.numSteps = 6;
        this.initialStates = ['|0⟩', '|0⟩'];
        this.gates = [];
        this.gateIdCounter = 100;

        // Undo / Redo stacks
        this.undoStack = [];
        this.redoStack = [];

        // Selection state
        this.selectedPaletteGate = 'H';
        this.selectedPlacedGateId = null;
        this.activeTheta = Math.PI / 2; // radians

        // Execution & timeline state
        this.activeStepIndex = 2;
        this.isPlaying = false;
        this.playTimer = null;
        this.measurementSeedMap = {};

        // Shot sampling state
        this.numShots = 1024;
        this.sampledCounts = null;

        // Active guided lesson
        this.currentLessonIndex = 0;

        // Bloch sphere state
        this.blochCanvases = [];
        this.displayedBlochVectors = [];
        this.blochViewYaw = -0.58;
        this.blochViewPitch = 0.34;

        this.buildDOM();
        this.bindEvents();
        this.loadLesson(0, false);
        this.startBlochAnimationLoop();
    }

    /**
     * Maps complex phase angle in radians (-π .. π) to Google-inspired friendly colors
     */
    static phaseToColor(phaseRad) {
        // 0 rad -> Google Blue (#1a73e8), +π/2 -> Google Green (#34a853), π -> Google Red (#ea4335), -π/2 -> Google Yellow/Purple
        let deg = ((phaseRad * 180) / Math.PI) % 360;
        if (deg < 0) deg += 360;
        if (deg < 45 || deg >= 315) return '#1a73e8'; // +1 (0 rad): Google Blue
        if (deg >= 45 && deg < 135) return '#34a853'; // +i (+π/2 rad): Google Green
        if (deg >= 135 && deg < 225) return '#ea4335'; // -1 (π rad): Google Red
        return '#9334e6'; // -i (-π/2 rad): Google Purple
    }

    buildDOM() {
        // 1. Top-Center Global Mode Switcher (Google Friendly Pill)
        const modeSwitcher = document.createElement('nav');
        modeSwitcher.className = 'ui-overlay global-mode-switcher hideable-ui';
        modeSwitcher.id = 'global-mode-switcher';
        modeSwitcher.setAttribute('aria-label', 'Learning Mode Navigation');
        modeSwitcher.innerHTML = `
            <button class="mode-tab-btn active" id="tab-mode-3d" data-target="3d">
                <span class="mode-tab-dot dot-blue"></span>
                <span class="mode-tab-text">
                    <span class="mode-tab-title">3D Cryostat Explorer</span>
                    <span class="mode-tab-sub">Dilution Fridge &amp; Hardware</span>
                </span>
            </button>
            <button class="mode-tab-btn" id="tab-mode-circuits" data-target="circuits">
                <span class="mode-tab-dot dot-multi"></span>
                <span class="mode-tab-text">
                    <span class="mode-tab-title">Quantum Circuit Lab</span>
                    <span class="mode-tab-sub">Interactive Chip &amp; Circuit Builder</span>
                </span>
                <span class="mode-tab-pill">Hands-On</span>
            </button>
        `;
        document.body.appendChild(modeSwitcher);

        // Quick launch CTA inside the 3D Left Info Box
        const infoBox = document.getElementById('qc-info-box');
        if (infoBox) {
            const launchCta = document.createElement('div');
            launchCta.className = 'qc-launch-circuit-cta';
            launchCta.innerHTML = `
                <button class="btn-launch-circuit-inline" id="btn-inline-open-circuits">
                    ⚛️ Launch Quantum Circuit Lab →
                </button>
            `;
            infoBox.appendChild(launchCta);
        }

        // 2. Main Quantum Circuit Lab Light Artboard Container
        const labRoot = document.createElement('section');
        labRoot.id = 'quantum-circuit-lab';
        labRoot.className = 'qcl-workspace';
        labRoot.style.display = 'none';
        labRoot.setAttribute('aria-label', 'Quantum Circuit Lab Interactive Workspace');

        labRoot.innerHTML = `
            <!-- Main 3-Column Light Workbench Layout (Modeled after learn-arduino-red.vercel.app) -->
            <div class="qcl-main-grid">

                <!-- LEFT COLUMN: Guided Lesson Stepper + Physical Gate Components Tray -->
                <aside class="qcl-card qcl-left-col">
                    <!-- Compact Guided Lesson Card -->
                    <div class="qcl-lesson-box">
                        <div class="qcl-lesson-top-row">
                            <span class="qcl-google-pill pill-blue" id="qcl-lesson-badge">LESSON 1 / 6</span>
                            <div class="qcl-lesson-nav-btns">
                                <button class="qcl-icon-btn" id="qcl-prev-lesson" title="Previous Lesson">←</button>
                                <button class="qcl-icon-btn" id="qcl-reload-lesson" title="Reset Lesson Circuit">↺</button>
                                <button class="qcl-icon-btn" id="qcl-next-lesson" title="Next Lesson">→</button>
                            </div>
                        </div>
                        <select class="qcl-lesson-select" id="qcl-lesson-select" aria-label="Choose a Guided Lesson"></select>
                        <p class="qcl-lesson-desc" id="qcl-lesson-text"></p>
                        <div class="qcl-try-callout">
                            <span class="qcl-try-tag">Try this:</span>
                            <span id="qcl-lesson-try"></span>
                        </div>
                    </div>

                    <!-- Gate Components Tray -->
                    <div class="qcl-parts-section">
                        <div class="qcl-section-header">
                            <h3 class="qcl-card-title">Quantum Gate Parts</h3>
                            <span class="qcl-subtle-hint">Click or drag to wire</span>
                        </div>
                        <div class="qcl-palette-groups" id="qcl-palette-groups"></div>
                    </div>

                    <!-- Compact Selected Gate Inspector -->
                    <div class="qcl-gate-inspector" id="qcl-gate-inspector"></div>
                </aside>

                <!-- CENTER STAGE: Physical Quantum Chip Workbench + Live Coaxial Circuit Composer -->
                <main class="qcl-center-col">
                    <!-- Top Toolbar: Add/Remove Qubits, Presets, Undo/Redo, Reset -->
                    <div class="qcl-card qcl-workbench-toolbar">
                        <div class="qcl-toolbar-group">
                            <span class="qcl-group-title">QPU Qubits</span>
                            <button class="qcl-btn qcl-btn-blue" id="qcl-add-qubit" title="Add a physical Transmon Qubit to the chip (up to 4)">+ Add Qubit</button>
                            <button class="qcl-btn" id="qcl-remove-qubit" title="Remove bottom Transmon Qubit">− Remove</button>
                            <span class="qcl-chip-status-pill" id="qcl-qubit-count-pill">2 Transmons Active</span>
                        </div>

                        <div class="qcl-toolbar-group">
                            <span class="qcl-group-title">Quick Circuits</span>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-bell">Bell State |Φ⁺⟩</button>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-ghz">3Q GHZ State</button>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-interf">H·Z·H Interference</button>
                        </div>

                        <div class="qcl-toolbar-group">
                            <button class="qcl-btn" id="qcl-undo-btn" title="Undo (Ctrl+Z)" disabled>↶ Undo</button>
                            <button class="qcl-btn" id="qcl-redo-btn" title="Redo (Ctrl+Y)" disabled>↷ Redo</button>
                            <button class="qcl-btn qcl-btn-red-outline" id="qcl-clear-btn" title="Reset circuit to |0...0⟩">⟲ Reset</button>
                            <button class="qcl-btn qcl-btn-3d-jump" id="qcl-view-in-3d" title="Inspect where this chip sits inside the 3D cryostat">
                                🔬 See Chip in 3D Cryostat
                            </button>
                        </div>
                    </div>

                    <!-- Validation / Placement Guidance Banner -->
                    <div class="qcl-validation-banner" id="qcl-validation-banner" style="display: none;" role="alert">
                        <span class="qcl-val-icon">⚠️</span>
                        <span class="qcl-val-text" id="qcl-validation-text"></span>
                        <button class="qcl-val-close" id="qcl-validation-close">&times;</button>
                    </div>

                    <!-- PART 1 OF CENTER STAGE: Interactive Physical Superconducting Quantum Processor Board -->
                    <div class="qcl-card qcl-physical-chip-card">
                        <div class="qcl-chip-card-header">
                            <div>
                                <span class="qcl-eyebrow-tag">PHYSICAL QUANTUM PROCESSOR BENCH (10 mK WILLOW / SYCAMORE QPU)</span>
                                <h3 class="qcl-card-title">Live Superconducting Transmon Qubits, Coax Drive Lines &amp; Readout Resonators</h3>
                            </div>
                            <div class="qcl-chip-legend">
                                <span class="chip-leg-item"><i class="leg-line leg-green"></i> XY Microwave Gate Line</span>
                                <span class="chip-leg-item"><i class="leg-line leg-blue"></i> Z Flux Phase Line</span>
                                <span class="chip-leg-item"><i class="leg-line leg-yellow"></i> λ/4 Readout Resonator</span>
                                <span class="chip-leg-item"><i class="leg-line leg-coupler"></i> Tunable Coupler</span>
                            </div>
                        </div>

                        <!-- Interactive SVG Physical QPU Package & Transmon Chip -->
                        <div class="qcl-physical-chip-stage" id="qcl-physical-chip-stage">
                            <!-- Rendered dynamically as a detailed interactive SVG hardware board -->
                        </div>
                    </div>

                    <!-- PART 2 OF CENTER STAGE: Tactile Coaxial Pulse Sequence & Quantum Circuit Composer -->
                    <div class="qcl-card qcl-composer-card">
                        <div class="qcl-composer-header-row">
                            <div>
                                <span class="qcl-eyebrow-tag">PULSE SEQUENCE &amp; CIRCUIT SCHEMATIC</span>
                                <h3 class="qcl-card-title">Coaxial Waveguide Channels &amp; Gate Operations</h3>
                            </div>

                            <!-- Selected Wire Gate Action Bar (appears when clicking a placed gate) -->
                            <div class="qcl-placed-gate-bar" id="qcl-placed-gate-bar" style="display: none;">
                                <span class="qcl-pgb-title" id="qcl-pgb-title">Selected Gate</span>
                                <div class="qcl-pgb-actions">
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-left" title="Move left">←</button>
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-right" title="Move right">→</button>
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-up" title="Move up">↑</button>
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-down" title="Move down">↓</button>
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-flip" style="display:none;">⇅ Flip Control/Target</button>
                                    <button class="qcl-btn qcl-btn-xs" id="qcl-pgb-cycle-target" style="display:none;">🎯 Target Wire</button>
                                    <button class="qcl-btn qcl-btn-xs qcl-btn-red-outline" id="qcl-pgb-delete">🗑 Remove</button>
                                </div>
                            </div>
                        </div>

                        <!-- Visual Circuit Board -->
                        <div class="qcl-circuit-board-wrap">
                            <div class="qcl-circuit-board" id="qcl-circuit-board"></div>
                        </div>

                        <!-- Execution Controls & Step Timeline Scrubber -->
                        <div class="qcl-timeline-bar">
                            <div class="qcl-exec-controls">
                                <button class="qcl-btn qcl-btn-sm" id="qcl-step-start" title="Reset to Initial State (t=0)">⏮ t=0</button>
                                <button class="qcl-btn qcl-btn-sm" id="qcl-step-prev" title="Step Backward">⏪ Step</button>
                                <button class="qcl-btn qcl-btn-green-play" id="qcl-run-circuit" title="Run pulse sequence across the chip">▶ Run Circuit</button>
                                <button class="qcl-btn qcl-btn-sm" id="qcl-step-next" title="Step Forward">Step ⏩</button>
                                <button class="qcl-btn qcl-btn-sm" id="qcl-step-end" title="Jump to Final State">⏭ End</button>
                            </div>
                            <div class="qcl-timeline-steps" id="qcl-timeline-steps"></div>
                        </div>
                    </div>
                </main>

                <!-- RIGHT COLUMN: Clean Tabbed Inspector (One focused view at a time!) -->
                <aside class="qcl-card qcl-right-col">
                    <!-- Live State Summary Banner (Always visible at top of right card) -->
                    <div class="qcl-live-state-summary">
                        <div class="qcl-lss-top">
                            <span class="qcl-eyebrow-tag" id="qcl-step-eyebrow">STATE AT STEP t = 2</span>
                            <span class="qcl-classification-badge" id="qcl-classification-badge">Separable State</span>
                        </div>
                        <div class="qcl-lss-op" id="qcl-step-op-title">Active Statevector</div>
                        <div class="qcl-dirac-pill">
                            <span class="qcl-dirac-lhs">|ψ<sub id="qcl-dirac-sub">t</sub>⟩ =</span>
                            <code class="qcl-dirac-ket" id="qcl-dirac-ket">1|00⟩</code>
                            <button class="qcl-btn qcl-btn-xs" id="qcl-reroll-collapse" style="display:none;" title="Re-sample projective measurement collapse">
                                🎲 Re-sample
                            </button>
                        </div>
                    </div>

                    <!-- Clean 3-Tab Switcher (Like learn-arduino-red.vercel.app's right card tabs) -->
                    <div class="qcl-inspector-tabs" role="tablist">
                        <button class="qcl-insp-tab active" data-tab="bloch" role="tab" aria-selected="true">
                            🌐 Bloch Spheres
                        </button>
                        <button class="qcl-insp-tab" data-tab="shots" role="tab" aria-selected="false">
                            📊 Readout Shots
                        </button>
                        <button class="qcl-insp-tab" data-tab="math" role="tab" aria-selected="false">
                            📐 Math &amp; State
                        </button>
                    </div>

                    <!-- TAB 1: Bloch Spheres View -->
                    <div class="qcl-tab-pane active" id="qcl-tab-bloch">
                        <div class="qcl-pane-header">
                            <span class="qcl-pane-subtitle">Single-Qubit Vectors (Drag sphere to rotate 3D view)</span>
                        </div>
                        <div class="qcl-bloch-grid" id="qcl-bloch-grid"></div>
                        <div class="qcl-friendly-note">
                            <strong>Tip:</strong> Pure qubit states sit on the sphere surface (<code>|r| = 1</code>). When two qubits become <strong>entangled</strong>, each individual qubit's vector shrinks inside the sphere (<code>|r| &lt; 1</code>)!
                        </div>
                    </div>

                    <!-- TAB 2: Readout Probabilities & Measurement Shots Histogram -->
                    <div class="qcl-tab-pane" id="qcl-tab-shots" style="display: none;">
                        <div class="qcl-shots-controls">
                            <span class="qcl-group-title">Shots (N):</span>
                            <div class="qcl-shot-pills" id="qcl-shot-pills">
                                <button class="qcl-shot-pill" data-shots="1">1</button>
                                <button class="qcl-shot-pill" data-shots="10">10</button>
                                <button class="qcl-shot-pill" data-shots="100">100</button>
                                <button class="qcl-shot-pill active" data-shots="1024">1024</button>
                                <button class="qcl-shot-pill" data-shots="4096">4096</button>
                            </div>
                            <button class="qcl-btn qcl-btn-blue qcl-btn-xs" id="qcl-run-shots-btn">▶ Sample</button>
                        </div>

                        <div class="qcl-histogram-legend">
                            <span><i class="hist-swatch hist-swatch-theory"></i> Exact Born Rule |α|²</span>
                            <span><i class="hist-swatch hist-swatch-shots"></i> Sampled (<span id="qcl-hist-shot-label">1024</span> shots)</span>
                        </div>

                        <div class="qcl-histogram-bars" id="qcl-histogram-bars"></div>

                        <div class="qcl-friendly-note" id="qcl-shots-footnote">
                            With N = 1024 shots, statistical sampling noise is ~1/√1024 ≈ ±3.1% around the exact Born-rule probabilities.
                        </div>
                    </div>

                    <!-- TAB 3: Statevector Amplitudes & "Show the Math" Formal Layer -->
                    <div class="qcl-tab-pane" id="qcl-tab-math" style="display: none;">
                        <div class="qcl-math-header-row">
                            <span class="qcl-pane-subtitle">Basis States <strong id="qcl-ket-order-label">|q0 q1⟩</strong></span>
                            <button class="qcl-btn qcl-btn-xs qcl-btn-math-toggle" id="qcl-toggle-math" aria-pressed="false">
                                <span id="qcl-toggle-math-label">Show Formal Math ▼</span>
                            </button>
                        </div>

                        <!-- Complex Amplitude Cards -->
                        <div class="qcl-amplitudes-grid" id="qcl-amplitudes-grid"></div>

                        <!-- Formal Linear Algebra Drawer -->
                        <div class="qcl-formal-math-drawer" id="qcl-formal-math-drawer" style="display: none;">
                            <div class="qcl-math-card">
                                <div class="qcl-math-card-title">Unitary Gate Matrix &amp; Transformation</div>
                                <div id="qcl-math-matrix-content"></div>
                            </div>
                            <div class="qcl-math-card">
                                <div class="qcl-math-card-title">Complex Amplitudes &amp; Born Rule Table</div>
                                <div class="qcl-math-table-wrap" id="qcl-math-table-wrap"></div>
                            </div>
                            <div class="qcl-friendly-note">
                                <strong>Superposition ≠ Classical Coin Flip:</strong> A classical coin has only positive probabilities. Quantum states carry complex phases <code>e^(iφ)</code> in radians that can constructively add or destructively cancel before measurement!
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        `;

        document.body.appendChild(labRoot);
        this.renderPalette();
        this.renderLessonSelector();
    }

    renderLessonSelector() {
        const select = document.getElementById('qcl-lesson-select');
        if (!select) return;

        select.innerHTML = CIRCUIT_LESSONS.map(
            (lesson, idx) => `<option value="${idx}">${lesson.title}</option>`
        ).join('');

        select.addEventListener('change', e => {
            this.loadLesson(Number(e.target.value), true);
        });
    }

    renderPalette() {
        const container = document.getElementById('qcl-palette-groups');
        if (!container) return;

        const groups = [
            { title: 'Superposition & Flips', keys: ['H', 'X', 'Y', 'Z'] },
            { title: 'Phase & Radian Rotations', keys: ['S', 'T', 'Rx', 'Ry', 'Rz'] },
            { title: '2-Qubit Couplers & Readout', keys: ['CNOT', 'CZ', 'SWAP', 'M'] }
        ];

        container.innerHTML = groups
            .map(
                group => `
            <div class="qcl-palette-group">
                <div class="qcl-palette-group-label">${group.title}</div>
                <div class="qcl-palette-row">
                    ${group.keys
                        .map(k => {
                            const g = GATE_LIBRARY[k];
                            const isSelected = this.selectedPaletteGate === k && !this.selectedPlacedGateId;
                            return `
                            <button class="qcl-gate-chip ${isSelected ? 'active' : ''}"
                                    draggable="true"
                                    data-gate="${g.id}"
                                    style="--gate-color: ${g.color};"
                                    title="${g.name}: ${g.tagline}">
                                <span class="qcl-chip-sym">${g.symbol}</span>
                                <span class="qcl-chip-sub">${g.hasTheta ? 'θ rad' : g.numQubits === 2 ? '2Q' : g.id === 'M' ? 'Read' : '1Q'}</span>
                            </button>
                        `;
                        })
                        .join('')}
                </div>
            </div>
        `
            )
            .join('');

        container.querySelectorAll('.qcl-gate-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedPlacedGateId = null;
                this.selectedPaletteGate = btn.dataset.gate;
                this.hideValidationBanner();
                this.updatePaletteSelectionUI();
                this.renderGateInspector();
                this.renderCircuitBoard();
            });

            btn.addEventListener('dragstart', e => {
                this.selectedPlacedGateId = null;
                this.selectedPaletteGate = btn.dataset.gate;
                this.updatePaletteSelectionUI();
                this.renderGateInspector();
                e.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ source: 'palette', gateType: btn.dataset.gate })
                );
            });
        });
    }

    updatePaletteSelectionUI() {
        document.querySelectorAll('.qcl-gate-chip').forEach(btn => {
            btn.classList.toggle(
                'active',
                btn.dataset.gate === this.selectedPaletteGate && !this.selectedPlacedGateId
            );
        });
    }

    /**
     * Renders the Interactive Physical Superconducting Quantum Processor Board (SVG)
     * Modeled directly after Google Sycamore/Willow flip-chip carrier & Xmon cross-shaped transmon qubits.
     */
    renderPhysicalQuantumChip(snap) {
        const stage = document.getElementById('qcl-physical-chip-stage');
        if (!stage) return;

        const n = this.numQubits;
        const W = 740;
        const H = 200;
        const stepGates = snap && snap.stepGates ? snap.stepGates : [];

        // Calculate horizontal X positions for each physical Xmon qubit on the silicon die
        const dieX = 110;
        const dieY = 24;
        const dieW = 520;
        const dieH = 152;
        const spacing = dieW / (n + 1);
        const qubitX = Array.from({ length: n }, (_, i) => dieX + spacing * (i + 1));
        const qubitY = dieY + dieH * 0.54;

        // Check active gates in current step for pulse animations
        const activeGateByQubit = {};
        const activeCouplers = [];
        stepGates.forEach(g => {
            activeGateByQubit[g.qubit] = g;
            if (GATE_LIBRARY[g.type]?.numQubits === 2 && g.targetQubit !== undefined) {
                activeGateByQubit[g.targetQubit] = g;
                activeCouplers.push({
                    from: Math.min(g.qubit, g.targetQubit),
                    to: Math.max(g.qubit, g.targetQubit),
                    gate: g
                });
            }
        });

        // Build SVG for each physical Xmon transmon qubit, its meandering λ/4 readout resonator,
        // its green XY drive coax line, its blue Z flux bias line, and its gold SMA launch pads
        let qubitsSvg = '';
        let couplersSvg = '';

        // 1. Tunable couplers between adjacent qubits (and long-range coupling arcs if non-adjacent)
        for (let q = 0; q < n - 1; q++) {
            const x1 = qubitX[q];
            const x2 = qubitX[q + 1];
            const midX = (x1 + x2) / 2;
            const activeC = activeCouplers.find(c => c.from <= q && c.to >= q + 1);
            const couplerColor = activeC ? '#34a853' : '#64748b';
            const couplerGlow = activeC ? 'filter="url(#qpu-glow)" stroke-width="3.2"' : 'stroke-width="1.8"';

            couplersSvg += `
                <g class="qpu-coupler-group">
                    <!-- Waveguide trace from Q${q} right arm to Coupler SQUID to Q${q + 1} left arm -->
                    <line x1="${x1 + 24}" y1="${qubitY}" x2="${midX - 14}" y2="${qubitY}"
                          stroke="${couplerColor}" ${couplerGlow} stroke-dasharray="${activeC ? 'none' : '3,2'}" />
                    <line x1="${midX + 14}" y1="${qubitY}" x2="${x2 - 24}" y2="${qubitY}"
                          stroke="${couplerColor}" ${couplerGlow} stroke-dasharray="${activeC ? 'none' : '3,2'}" />
                    <!-- Tunable Coupler Transmon Pad -->
                    <rect x="${midX - 13}" y="${qubitY - 9}" width="26" height="18" rx="4"
                          fill="${activeC ? '#e6f4ea' : '#1e293b'}"
                          stroke="${couplerColor}" stroke-width="1.8" />
                    <text x="${midX}" y="${qubitY + 3}" text-anchor="middle"
                          fill="${activeC ? '#137333' : '#94a3b8'}" font-size="8" font-weight="800">
                        ${activeC ? activeC.gate.type : 'CPL'}
                    </text>
                </g>
            `;
        }

        // 2. Individual Xmon Transmon Qubits + Coax Lines + Meandering Readout Resonator
        for (let q = 0; q < n; q++) {
            const cx = qubitX[q];
            const cy = qubitY;
            const bloch = snap && snap.blochData && snap.blochData[q] ? snap.blochData[q] : { stateLabel: '|0⟩', isEntangled: false, prob1: 0 };
            const activeOp = activeGateByQubit[q];

            // Determine what kind of physical pulse is active on this qubit
            const isXYPulse = activeOp && ['H', 'X', 'Y', 'Rx', 'Ry'].includes(activeOp.type);
            const isZPulse = activeOp && ['Z', 'S', 'T', 'Rz'].includes(activeOp.type);
            const isMeasPulse = activeOp && activeOp.type === 'M';
            const is2QPulse = activeOp && ['CNOT', 'CZ', 'SWAP'].includes(activeOp.type);

            // Color of the Xmon cross based on its live quantum state
            let crossFill = '#3b82f6'; // default sapphire blue |0⟩
            let crossStroke = '#93c5fd';
            if (bloch.isEntangled) {
                crossFill = '#10b981'; // Emerald entangled state
                crossStroke = '#a7f3d0';
            } else if (bloch.prob1 > 0.85) {
                crossFill = '#ea4335'; // Excited |1⟩ state (Google Red)
                crossStroke = '#fca5a5';
            } else if (Math.abs(bloch.prob1 - 0.5) < 0.2) {
                crossFill = '#fbbc04'; // Superposition state (Google Yellow/Amber)
                crossStroke = '#fde68a';
            }

            // Meandering λ/4 readout resonator path from top bus (y=44) down to top of Xmon (cy-25)
            const resTopY = 44;
            const meanderPath = `
                M ${cx} ${resTopY}
                L ${cx} ${resTopY + 6}
                L ${cx - 12} ${resTopY + 6}
                L ${cx - 12} ${resTopY + 12}
                L ${cx + 12} ${resTopY + 12}
                L ${cx + 12} ${resTopY + 18}
                L ${cx - 12} ${resTopY + 18}
                L ${cx - 12} ${resTopY + 24}
                L ${cx} ${resTopY + 24}
                L ${cx} ${cy - 26}
            `;

            qubitsSvg += `
                <g class="qpu-transmon-unit" data-qubit="${q}" style="cursor: pointer;">
                    <title>Physical Transmon Qubit Q${q} (${bloch.stateLabel}) — Click to apply ${this.selectedPaletteGate} gate</title>

                    <!-- Top Gold Readout Coupling Node & Meandering λ/4 Readout Resonator -->
                    <circle cx="${cx}" cy="${resTopY}" r="3.5" fill="${isMeasPulse ? '#fbbc04' : '#cbd5e1'}" />
                    <path d="${meanderPath}" fill="none"
                          stroke="${isMeasPulse ? '#fbbc04' : '#94a3b8'}"
                          stroke-width="${isMeasPulse ? '2.6' : '1.5'}"
                          ${isMeasPulse ? 'filter="url(#qpu-glow)"' : ''} />
                    <!-- Capacitive Readout Claw above Xmon North Arm -->
                    <path d="M ${cx - 9} ${cy - 22} L ${cx - 9} ${cy - 26} L ${cx + 9} ${cy - 26} L ${cx + 9} ${cy - 22}"
                          fill="none" stroke="${isMeasPulse ? '#fbbc04' : '#cbd5e1'}" stroke-width="1.8" />

                    <!-- Bottom Left Emerald-Green XY Microwave Coaxial Control Line -->
                    <path d="M ${cx - 28} ${H - 8} L ${cx - 22} ${H - 24} L ${cx - 14} ${cy + 16}"
                          fill="none"
                          stroke="${isXYPulse ? '#34a853' : '#22c55e'}"
                          stroke-width="${isXYPulse ? '3.2' : '1.8'}"
                          stroke-opacity="${isXYPulse ? '1' : '0.65'}" />
                    <!-- Gold SMA Bottom Launch Pad for XY Drive -->
                    <rect x="${cx - 35}" y="${H - 12}" width="14" height="8" rx="2" fill="#f59e0b" stroke="#b45309" stroke-width="1" />

                    <!-- Bottom Right Royal-Blue Fast-Z Flux Bias Coaxial Line (to SQUID Josephson Junctions) -->
                    <path d="M ${cx + 28} ${H - 8} L ${cx + 22} ${H - 24} L ${cx + 4} ${cy + 23}"
                          fill="none"
                          stroke="${isZPulse ? '#60a5fa' : '#3b82f6'}"
                          stroke-width="${isZPulse ? '3.2' : '1.8'}"
                          stroke-opacity="${isZPulse ? '1' : '0.65'}" />
                    <!-- Gold SMA Bottom Launch Pad for Z Flux -->
                    <rect x="${cx + 21}" y="${H - 12}" width="14" height="8" rx="2" fill="#f59e0b" stroke="#b45309" stroke-width="1" />

                    <!-- Active Pulse Wavepacket Ring when a gate fires on Q${q} -->
                    ${
                        isXYPulse || isZPulse || isMeasPulse || is2QPulse
                            ? `<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${GATE_LIBRARY[activeOp.type]?.color || '#4285f4'}" stroke-width="2.2" stroke-dasharray="4,3" opacity="0.9" />`
                            : ''
                    }

                    <!-- Cross-Shaped Xmon Superconducting Transmon Qubit (Matched to Reference Image 003) -->
                    <!-- Etched Dark Sapphire Isolation Trench around Cross -->
                    <path d="M ${cx - 7} ${cy - 22} H ${cx + 7} V ${cy - 7} H ${cx + 22} V ${cy + 7} H ${cx + 7} V ${cy + 22} H ${cx - 7} V ${cy + 7} H ${cx - 22} V ${cy - 7} H ${cx - 7} Z"
                          fill="#0f172a" stroke="#1e3a8a" stroke-width="2" />

                    <!-- Superconducting Aluminum Cross Capacitor Pads -->
                    <path d="M ${cx - 4.5} ${cy - 19} H ${cx + 4.5} V ${cy - 4.5} H ${cx + 19} V ${cy + 4.5} H ${cx + 4.5} V ${cy + 19} H ${cx - 4.5} V ${cy + 4.5} H ${cx - 19} V ${cy - 4.5} H ${cx - 4.5} Z"
                          fill="${crossFill}" stroke="${crossStroke}" stroke-width="1.4" />

                    <!-- Twin Josephson Junctions (Al/AlOx/Al SQUID Loop) at bottom leg of Xmon -->
                    <line x1="${cx - 5}" y1="${cy + 19}" x2="${cx - 2}" y2="${cy + 23}" stroke="#f8fafc" stroke-width="1.5" />
                    <line x1="${cx + 5}" y1="${cy + 19}" x2="${cx + 2}" y2="${cy + 23}" stroke="#f8fafc" stroke-width="1.5" />

                    <!-- Qubit ID & Live State Badge on Chip -->
                    <circle cx="${cx}" cy="${cy}" r="9" fill="#0f172a" stroke="${crossStroke}" stroke-width="1.2" />
                    <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="800" font-family="monospace">
                        Q${q}
                    </text>

                    <!-- Floating State Pill Below Qubit -->
                    <rect x="${cx - 24}" y="${cy + 27}" width="48" height="16" rx="8"
                          fill="#ffffff" stroke="${crossFill}" stroke-width="1.5" />
                    <text x="${cx}" y="${cy + 38}" text-anchor="middle" fill="#202124" font-size="9.5" font-weight="800" font-family="monospace">
                        ${bloch.isEntangled ? 'Entangled' : bloch.stateLabel.slice(0, 6)}
                    </text>
                </g>
            `;
        }

        stage.innerHTML = `
            <svg class="qcl-qpu-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="carrier-metal" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#e2e8f0" />
                        <stop offset="50%" stop-color="#cbd5e1" />
                        <stop offset="100%" stop-color="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="silicon-die" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#0f172a" />
                        <stop offset="100%" stop-color="#1e293b" />
                    </linearGradient>
                    <filter id="qpu-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <!-- Outer Brushed-Aluminum Chamfered Cryo-Package Carrier (Matching Sycamore_Quantum_Chip.jpg) -->
                <polygon points="18,8 722,8 734,20 734,180 722,192 18,192 6,180 6,20"
                         fill="url(#carrier-metal)" stroke="#64748b" stroke-width="1.5" />

                <!-- 4 Corner Cryo-Carrier Mounting Screws -->
                <circle cx="24" cy="24" r="5" fill="#94a3b8" stroke="#475569" stroke-width="1.2" />
                <circle cx="716" cy="24" r="5" fill="#94a3b8" stroke="#475569" stroke-width="1.2" />
                <circle cx="24" cy="176" r="5" fill="#94a3b8" stroke="#475569" stroke-width="1.2" />
                <circle cx="716" cy="176" r="5" fill="#94a3b8" stroke="#475569" stroke-width="1.2" />

                <!-- Left RF-DAC Coax Input Header Badge -->
                <g transform="translate(18, 62)">
                    <rect x="0" y="0" width="78" height="76" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />
                    <text x="39" y="18" text-anchor="middle" fill="#1a73e8" font-size="8.5" font-weight="800">RF-DAC COAX</text>
                    <text x="39" y="31" text-anchor="middle" fill="#202124" font-size="9.5" font-weight="800">4–6 GHz</text>
                    <line x1="10" y1="42" x2="68" y2="42" stroke="#22c55e" stroke-width="2.5" />
                    <text x="39" y="53" text-anchor="middle" fill="#15803d" font-size="8" font-weight="700">XY Drive</text>
                    <line x1="10" y1="61" x2="68" y2="61" stroke="#3b82f6" stroke-width="2.5" />
                    <text x="39" y="71" text-anchor="middle" fill="#1d4ed8" font-size="8" font-weight="700">Z Flux Bias</text>
                </g>

                <!-- Central Dark Silicon Flip-Chip QPU Die -->
                <rect x="${dieX}" y="${dieY}" width="${dieW}" height="${dieH}" rx="10"
                      fill="url(#silicon-die)" stroke="#475569" stroke-width="2" />

                <!-- Multiplexed Readout Transmission Bus across top of Silicon Die -->
                <line x1="${dieX + 16}" y1="44" x2="${dieX + dieW - 16}" y2="44"
                      stroke="#fbbc04" stroke-width="2.2" stroke-dasharray="6,3" />
                <text x="${dieX + 22}" y="37" fill="#fde68a" font-size="8.5" font-weight="700" font-family="monospace">
                    7.2 GHz MULTIPLEXED READOUT BUS → TWPA
                </text>

                <!-- Couplers & Cross-Shaped Xmon Transmon Qubits -->
                ${couplersSvg}
                ${qubitsSvg}

                <!-- Right Readout Amplifier & Classical Bit Output Module -->
                <g transform="translate(644, 52)">
                    <rect x="0" y="0" width="78" height="94" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />
                    <text x="39" y="17" text-anchor="middle" fill="#d93025" font-size="8.5" font-weight="800">10 mK TWPA</text>
                    <text x="39" y="29" text-anchor="middle" fill="#202124" font-size="9" font-weight="800">READOUT</text>
                    <rect x="10" y="36" width="58" height="24" rx="5" fill="#f8f9fa" stroke="#dadce0" />
                    <text x="39" y="52" text-anchor="middle" fill="#1a73e8" font-size="11" font-weight="800" font-family="monospace">
                        |ψ⟩ → c
                    </text>
                    <text x="39" y="75" text-anchor="middle" fill="#5f6368" font-size="8" font-weight="700">Click any Qubit</text>
                    <text x="39" y="86" text-anchor="middle" fill="#5f6368" font-size="8" font-weight="700">to apply ${this.selectedPaletteGate}</text>
                </g>
            </svg>
        `;

        // Clicking a physical Xmon qubit on the chip places the selected gate on the next open slot on that wire!
        stage.querySelectorAll('.qpu-transmon-unit').forEach(unit => {
            unit.addEventListener('click', () => {
                const q = Number(unit.dataset.qubit);
                // Find first empty step on wire q
                let targetStep = 0;
                for (let s = 0; s < this.numSteps; s++) {
                    const occupied = this.gates.some(
                        g => g.step === s && (g.qubit === q || g.targetQubit === q)
                    );
                    if (!occupied) {
                        targetStep = s;
                        break;
                    }
                }
                this.placeGateAt(this.selectedPaletteGate, q, targetStep);
            });
        });
    }

    loadLesson(lessonIdx, recordUndo = false) {
        if (lessonIdx < 0 || lessonIdx >= CIRCUIT_LESSONS.length) return;
        if (recordUndo) this.pushUndoState();

        this.stopAutoPlay();
        this.currentLessonIndex = lessonIdx;
        const lesson = CIRCUIT_LESSONS[lessonIdx];

        this.numQubits = lesson.numQubits;
        this.initialStates = [...lesson.initialStates];
        this.gates = lesson.gates.map(g => ({ ...g }));
        this.selectedPlacedGateId = null;
        this.measurementSeedMap = {};

        const maxGateStep = this.gates.reduce((max, g) => Math.max(max, g.step), 0);
        this.activeStepIndex = Math.min(this.numSteps, maxGateStep + 1);

        const badgeEl = document.getElementById('qcl-lesson-badge');
        const selectEl = document.getElementById('qcl-lesson-select');
        const textEl = document.getElementById('qcl-lesson-text');
        const tryEl = document.getElementById('qcl-lesson-try');

        if (badgeEl) badgeEl.textContent = `LESSON ${lesson.number} OF ${CIRCUIT_LESSONS.length} • ${lesson.badge}`;
        if (selectEl) selectEl.value = String(lessonIdx);
        if (textEl) textEl.textContent = lesson.explanation;
        if (tryEl) tryEl.textContent = lesson.tryThis;

        this.hideValidationBanner();
        this.refreshAll();
    }

    setMode(mode) {
        this.isLabActive = mode === 'circuits';
        const labEl = document.getElementById('quantum-circuit-lab');
        const tab3d = document.getElementById('tab-mode-3d');
        const tabCircuits = document.getElementById('tab-mode-circuits');

        if (tab3d) tab3d.classList.toggle('active', !this.isLabActive);
        if (tabCircuits) tabCircuits.classList.toggle('active', this.isLabActive);

        document.body.classList.toggle('circuit-lab-mode', this.isLabActive);

        if (labEl) {
            labEl.style.display = this.isLabActive ? 'flex' : 'none';
        }

        if (this.isLabActive) {
            this.refreshAll();
        } else {
            this.stopAutoPlay();
        }
    }

    pushUndoState() {
        this.undoStack.push({
            numQubits: this.numQubits,
            initialStates: [...this.initialStates],
            gates: this.gates.map(g => ({ ...g })),
            activeStepIndex: this.activeStepIndex
        });
        if (this.undoStack.length > 40) this.undoStack.shift();
        this.redoStack = [];
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push({
            numQubits: this.numQubits,
            initialStates: [...this.initialStates],
            gates: this.gates.map(g => ({ ...g })),
            activeStepIndex: this.activeStepIndex
        });
        const prev = this.undoStack.pop();
        this.numQubits = prev.numQubits;
        this.initialStates = [...prev.initialStates];
        this.gates = prev.gates.map(g => ({ ...g }));
        this.activeStepIndex = prev.activeStepIndex;
        this.selectedPlacedGateId = null;
        this.updateUndoRedoButtons();
        this.hideValidationBanner();
        this.refreshAll();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push({
            numQubits: this.numQubits,
            initialStates: [...this.initialStates],
            gates: this.gates.map(g => ({ ...g })),
            activeStepIndex: this.activeStepIndex
        });
        const next = this.redoStack.pop();
        this.numQubits = next.numQubits;
        this.initialStates = [...next.initialStates];
        this.gates = next.gates.map(g => ({ ...g }));
        this.activeStepIndex = next.activeStepIndex;
        this.selectedPlacedGateId = null;
        this.updateUndoRedoButtons();
        this.hideValidationBanner();
        this.refreshAll();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('qcl-undo-btn');
        const redoBtn = document.getElementById('qcl-redo-btn');
        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    showValidationBanner(message) {
        const banner = document.getElementById('qcl-validation-banner');
        const text = document.getElementById('qcl-validation-text');
        if (banner && text) {
            text.textContent = message;
            banner.style.display = 'flex';
        }
    }

    hideValidationBanner() {
        const banner = document.getElementById('qcl-validation-banner');
        if (banner) banner.style.display = 'none';
    }

    validateGatePlacement(gateType, qubit, step, targetQubit = null, ignoreGateId = null) {
        const def = GATE_LIBRARY[gateType];
        if (!def) return { valid: false, reason: 'Unknown gate operation.' };

        if (qubit < 0 || qubit >= this.numQubits) {
            return { valid: false, reason: `Wire q${qubit} does not exist in this ${this.numQubits}-qubit circuit.` };
        }
        if (step < 0 || step >= this.numSteps) {
            return { valid: false, reason: `Time step t=${step + 1} is outside the circuit timeline (1..${this.numSteps}).` };
        }

        if (def.numQubits === 2) {
            if (this.numQubits < 2) {
                return {
                    valid: false,
                    reason: `${def.name} connects two qubits and requires at least 2 qubits on the chip. Click "+ Add Qubit" in the top toolbar first!`
                };
            }
            if (targetQubit === null || targetQubit === undefined || targetQubit === qubit) {
                return {
                    valid: false,
                    reason: `${def.name} requires two distinct qubit wires (control q${qubit} cannot target itself).`
                };
            }
            if (targetQubit < 0 || targetQubit >= this.numQubits) {
                return {
                    valid: false,
                    reason: `Target wire q${targetQubit} is out of range for ${this.numQubits} qubits.`
                };
            }
        }

        const otherGates = this.gates.filter(g => g.id !== ignoreGateId);
        const touchedWires = def.numQubits === 2 ? [qubit, targetQubit] : [qubit];

        for (const w of touchedWires) {
            const existingMeas = otherGates.find(g => g.type === 'M' && g.qubit === w);
            if (existingMeas && step > existingMeas.step) {
                return {
                    valid: false,
                    reason: `Invalid placement on Q${w}: Qubit Q${w} is already measured at Step ${existingMeas.step + 1}, collapsing its state to classical bit c${w}. Place quantum gates to the left of (before) Measurement.`
                };
            }
            if (existingMeas && gateType === 'M' && existingMeas.qubit === w && existingMeas.step !== step) {
                return {
                    valid: false,
                    reason: `Qubit Q${w} already has a Measurement gate at Step ${existingMeas.step + 1}.`
                };
            }
        }

        if (gateType === 'M') {
            const laterGate = otherGates.find(
                g =>
                    g.step > step &&
                    (g.qubit === qubit || (GATE_LIBRARY[g.type]?.numQubits === 2 && g.targetQubit === qubit))
            );
            if (laterGate) {
                return {
                    valid: false,
                    reason: `Invalid placement: Measurement on Q${qubit} at Step ${step + 1} would occur before ${laterGate.type} at Step ${laterGate.step + 1}. Place Measurement at the end of the pulse sequence.`
                };
            }
        }

        const stepGates = otherGates.filter(g => g.step === step);
        for (const sg of stepGates) {
            const sgWires = GATE_LIBRARY[sg.type]?.numQubits === 2 ? [sg.qubit, sg.targetQubit] : [sg.qubit];
            if (def.numQubits === 2 && sgWires.includes(targetQubit) && sg.qubit !== qubit) {
                return {
                    valid: false,
                    reason: `Step ${step + 1} already has a ${sg.type} gate operating on wire Q${targetQubit}. Choose an open time step column.`
                };
            }
            if (GATE_LIBRARY[sg.type]?.numQubits === 2 && sg.targetQubit === qubit && sg.qubit !== qubit) {
                return {
                    valid: false,
                    reason: `Wire Q${qubit} at Step ${step + 1} is already connected as the target of ${sg.type} (from Q${sg.qubit}).`
                };
            }
        }

        return { valid: true };
    }

    placeGateAt(gateType, qubit, step, explicitTarget = null) {
        const def = GATE_LIBRARY[gateType];
        if (!def) return;

        let targetQubit = null;
        if (def.numQubits === 2) {
            if (explicitTarget !== null && explicitTarget !== undefined && explicitTarget !== qubit) {
                targetQubit = explicitTarget;
            } else {
                targetQubit = qubit + 1 < this.numQubits ? qubit + 1 : qubit - 1;
            }
        }

        const existingAtCell = this.gates.find(g => g.qubit === qubit && g.step === step);
        const validation = this.validateGatePlacement(
            gateType,
            qubit,
            step,
            targetQubit,
            existingAtCell ? existingAtCell.id : null
        );

        if (!validation.valid) {
            this.showValidationBanner(validation.reason);
            return;
        }

        this.hideValidationBanner();
        this.pushUndoState();

        if (existingAtCell) {
            this.gates = this.gates.filter(g => g.id !== existingAtCell.id);
        }

        const newGate = {
            id: `g_${++this.gateIdCounter}`,
            type: gateType,
            qubit,
            step
        };
        if (def.hasTheta) {
            newGate.theta = this.activeTheta;
        }
        if (def.numQubits === 2) {
            newGate.targetQubit = targetQubit;
        }

        this.gates.push(newGate);
        this.selectedPlacedGateId = newGate.id;
        this.activeStepIndex = step + 1;
        this.refreshAll();
    }

    movePlacedGate(gateId, newQubit, newStep) {
        const gate = this.gates.find(g => g.id === gateId);
        if (!gate) return;

        const def = GATE_LIBRARY[gate.type];
        let newTarget = gate.targetQubit;
        if (def.numQubits === 2) {
            const deltaQ = newQubit - gate.qubit;
            if (newTarget === newQubit) {
                newTarget = gate.qubit;
            } else if (newTarget + deltaQ >= 0 && newTarget + deltaQ < this.numQubits && newTarget + deltaQ !== newQubit) {
                newTarget = newTarget + deltaQ;
            } else if (newTarget >= this.numQubits || newTarget === newQubit) {
                newTarget = newQubit + 1 < this.numQubits ? newQubit + 1 : newQubit - 1;
            }
        }

        const validation = this.validateGatePlacement(gate.type, newQubit, newStep, newTarget, gate.id);
        if (!validation.valid) {
            this.showValidationBanner(validation.reason);
            return;
        }

        const occupant = this.gates.find(g => g.id !== gate.id && g.qubit === newQubit && g.step === newStep);
        if (occupant) {
            this.showValidationBanner(
                `Step ${newStep + 1} on Q${newQubit} already contains a ${occupant.type} gate.`
            );
            return;
        }

        this.hideValidationBanner();
        this.pushUndoState();
        gate.qubit = newQubit;
        gate.step = newStep;
        if (def.numQubits === 2) {
            gate.targetQubit = newTarget;
        }
        this.activeStepIndex = newStep + 1;
        this.refreshAll();
    }

    deletePlacedGate(gateId) {
        const idx = this.gates.findIndex(g => g.id === gateId);
        if (idx === -1) return;
        this.pushUndoState();
        this.gates.splice(idx, 1);
        if (this.selectedPlacedGateId === gateId) {
            this.selectedPlacedGateId = null;
        }
        this.hideValidationBanner();
        this.refreshAll();
    }

    cycleInitialState(q) {
        const order = ['|0⟩', '|1⟩', '|+⟩', '|−⟩', '|+i⟩', '|−i⟩'];
        const curr = this.initialStates[q] || '|0⟩';
        const nextIdx = (order.indexOf(curr) + 1) % order.length;
        this.pushUndoState();
        this.initialStates[q] = order[nextIdx];
        this.refreshAll();
    }

    renderGateInspector() {
        const box = document.getElementById('qcl-gate-inspector');
        if (!box) return;

        const placedGate = this.gates.find(g => g.id === this.selectedPlacedGateId);
        const gateType = placedGate ? placedGate.type : this.selectedPaletteGate;
        const def = GATE_LIBRARY[gateType] || GATE_LIBRARY.H;
        const currentTheta = placedGate && def.hasTheta ? placedGate.theta : this.activeTheta;
        const mat = def.matrixFn(currentTheta);

        let thetaControlsHtml = '';
        if (def.hasTheta) {
            const presets = [
                { label: '−π/2', val: -Math.PI / 2 },
                { label: 'π/4', val: Math.PI / 4 },
                { label: 'π/2', val: Math.PI / 2 },
                { label: 'π', val: Math.PI }
            ];
            thetaControlsHtml = `
                <div class="qcl-inspector-theta">
                    <div class="qcl-theta-header">
                        <span>Angle θ (Radians)</span>
                        <strong id="qcl-theta-readout">${formatRadians(currentTheta)}</strong>
                    </div>
                    <input type="range" id="qcl-theta-slider"
                           min="${(-Math.PI).toFixed(4)}"
                           max="${(2 * Math.PI).toFixed(4)}"
                           step="0.0654498"
                           value="${currentTheta}" />
                    <div class="qcl-theta-presets">
                        ${presets
                            .map(
                                p => `
                            <button class="qcl-theta-preset-btn ${Math.abs(currentTheta - p.val) < 1e-2 ? 'active' : ''}"
                                    data-theta="${p.val}">${p.label}</button>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            `;
        }

        let measControlsHtml = '';
        if (gateType === 'M' && placedGate) {
            const forced = this.measurementSeedMap[placedGate.id];
            measControlsHtml = `
                <div class="qcl-inspector-meas">
                    <div class="qcl-theta-header">
                        <span>Collapse Mode (Q${placedGate.qubit})</span>
                        <strong>${forced === 0 ? 'Force |0⟩' : forced === 1 ? 'Force |1⟩' : 'Born Random'}</strong>
                    </div>
                    <div class="qcl-theta-presets">
                        <button class="qcl-meas-mode-btn ${forced === undefined ? 'active' : ''}" data-outcome="random">🎲 Random</button>
                        <button class="qcl-meas-mode-btn ${forced === 0 ? 'active' : ''}" data-outcome="0">Force |0⟩</button>
                        <button class="qcl-meas-mode-btn ${forced === 1 ? 'active' : ''}" data-outcome="1">Force |1⟩</button>
                    </div>
                </div>
            `;
        }

        box.innerHTML = `
            <div class="qcl-insp-top" style="border-left-color: ${def.color}">
                <div class="qcl-insp-badge" style="background: ${def.color}; color: #ffffff;">
                    ${def.symbol}
                </div>
                <div>
                    <div class="qcl-insp-status">
                        ${placedGate ? `ON QUBIT Q${placedGate.qubit} • STEP ${placedGate.step + 1}` : 'SELECTED COMPONENT'}
                    </div>
                    <h4 class="qcl-insp-name">${def.name}</h4>
                </div>
            </div>
            <p class="qcl-insp-tagline">${def.tagline}</p>
            ${thetaControlsHtml}
            ${measControlsHtml}
            <div class="qcl-insp-math-mini">
                <div class="qcl-insp-ket-action"><code>${def.ketAction}</code></div>
                <div class="qcl-insp-matrix-wrap">${this.formatMatrixHTML(mat)}</div>
            </div>
        `;

        const slider = document.getElementById('qcl-theta-slider');
        if (slider) {
            slider.addEventListener('input', e => {
                const val = parseFloat(e.target.value);
                this.activeTheta = val;
                if (placedGate && def.hasTheta) {
                    placedGate.theta = val;
                }
                const readout = document.getElementById('qcl-theta-readout');
                if (readout) readout.textContent = formatRadians(val);
                this.refreshSimulationAndViews(false);
                this.renderCircuitBoard();
            });
        }

        box.querySelectorAll('.qcl-theta-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseFloat(btn.dataset.theta);
                this.activeTheta = val;
                if (placedGate && def.hasTheta) {
                    this.pushUndoState();
                    placedGate.theta = val;
                }
                this.refreshAll();
            });
        });

        box.querySelectorAll('.qcl-meas-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!placedGate) return;
                const mode = btn.dataset.outcome;
                if (mode === 'random') {
                    delete this.measurementSeedMap[placedGate.id];
                } else {
                    this.measurementSeedMap[placedGate.id] = Number(mode);
                }
                this.refreshAll();
            });
        });
    }

    formatMatrixHTML(mat) {
        const rows = mat
            .map(row => `<tr>${row.map(cell => `<td>${cell.formatCartesian(2)}</td>`).join('')}</tr>`)
            .join('');
        return `<table class="qcl-unitary-matrix"><tbody>${rows}</tbody></table>`;
    }

    /**
     * Renders the Tactile Coaxial Pulse & Circuit Composer Grid
     */
    renderCircuitBoard() {
        const board = document.getElementById('qcl-circuit-board');
        const countPill = document.getElementById('qcl-qubit-count-pill');
        if (!board) return;

        if (countPill) {
            countPill.textContent = `${this.numQubits} Transmon${this.numQubits > 1 ? 's' : ''} (${1 << this.numQubits} States)`;
        }

        this.updatePlacedGateActionBar();

        let html = `
            <div class="qcl-grid-header">
                <div class="qcl-wire-label-col">Coax Input / Init</div>
                ${Array.from({ length: this.numSteps }, (_, s) => {
                    const isActiveCol = this.activeStepIndex === s + 1;
                    return `
                        <div class="qcl-step-col-header ${isActiveCol ? 'active-step-col' : ''}"
                             data-step="${s}"
                             title="Click to inspect state after Pulse Step ${s + 1}">
                            <span>Pulse t=${s + 1}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        for (let q = 0; q < this.numQubits; q++) {
            const initKey = this.initialStates[q] || '|0⟩';
            const initSpec = INITIAL_QUBIT_STATES[initKey] || INITIAL_QUBIT_STATES['|0⟩'];

            html += `
                <div class="qcl-wire-row" data-qubit="${q}">
                    <div class="qcl-wire-init-cell">
                        <span class="qcl-sma-jack" title="SMA Coaxial Port Q${q}"></span>
                        <span class="qcl-wire-name">Q<sub>${q}</sub></span>
                        <button class="qcl-init-state-btn"
                                data-qubit="${q}"
                                title="${initSpec.name} (${initSpec.desc}). Click to cycle initial state">
                            ${initKey}
                        </button>
                    </div>
                    ${Array.from({ length: this.numSteps }, (_, s) => {
                        const isActiveCol = this.activeStepIndex === s + 1;
                        return this.renderWireCellHTML(q, s, isActiveCol);
                    }).join('')}
                </div>
            `;
        }

        // Classical Readout Bus row
        const lastSnap = this.lastSimResult
            ? this.lastSimResult.snapshots[Math.min(this.activeStepIndex, this.lastSimResult.snapshots.length - 1)]
            : null;
        const cReg = lastSnap && lastSnap.classicalRegister ? lastSnap.classicalRegister : [];

        html += `
            <div class="qcl-wire-row qcl-classical-row">
                <div class="qcl-wire-init-cell">
                    <span class="qcl-wire-name qcl-cname">Readout c</span>
                    <span class="qcl-creg-readout" title="Classical readout bits">
                        ${Array.from({ length: this.numQubits }, (_, q) => (cReg[q] !== null && cReg[q] !== undefined ? cReg[q] : '·')).join('')}
                    </span>
                </div>
                ${Array.from({ length: this.numSteps }, (_, s) => {
                    const measInCol = this.gates.filter(g => g.step === s && g.type === 'M');
                    const label = measInCol.length > 0 ? measInCol.map(m => `c${m.qubit}`).join(',') : '';
                    return `
                        <div class="qcl-classical-cell">
                            <div class="qcl-double-wire"></div>
                            ${label ? `<span class="qcl-meas-arrow-badge">⇓ ${label}</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        board.innerHTML = html;

        board.querySelectorAll('.qcl-init-state-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.cycleInitialState(Number(btn.dataset.qubit));
            });
        });

        board.querySelectorAll('.qcl-step-col-header').forEach(hdr => {
            hdr.addEventListener('click', () => {
                this.stopAutoPlay();
                this.activeStepIndex = Number(hdr.dataset.step) + 1;
                this.refreshAll();
            });
        });

        board.querySelectorAll('.qcl-wire-cell').forEach(cell => {
            const q = Number(cell.dataset.qubit);
            const s = Number(cell.dataset.step);

            cell.addEventListener('click', e => {
                const delBtn = e.target.closest('.qcl-gate-del-btn');
                if (delBtn) {
                    e.stopPropagation();
                    this.deletePlacedGate(delBtn.dataset.gateId);
                    return;
                }

                const gateEl = e.target.closest('[data-placed-gate-id]');
                if (gateEl) {
                    e.stopPropagation();
                    const gId = gateEl.dataset.placedGateId;
                    this.selectedPlacedGateId = gId;
                    const gObj = this.gates.find(g => g.id === gId);
                    if (gObj && GATE_LIBRARY[gObj.type]?.hasTheta) {
                        this.activeTheta = gObj.theta;
                    }
                    this.activeStepIndex = s + 1;
                    this.updatePaletteSelectionUI();
                    this.renderGateInspector();
                    this.renderCircuitBoard();
                    this.refreshSimulationAndViews(false);
                    return;
                }

                this.placeGateAt(this.selectedPaletteGate, q, s);
            });

            cell.addEventListener('dragover', e => {
                e.preventDefault();
                cell.classList.add('drag-over');
            });

            cell.addEventListener('dragleave', () => {
                cell.classList.remove('drag-over');
            });

            cell.addEventListener('drop', e => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                try {
                    const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (payload.source === 'palette' && payload.gateType) {
                        this.placeGateAt(payload.gateType, q, s);
                    } else if (payload.source === 'board' && payload.gateId) {
                        this.movePlacedGate(payload.gateId, q, s);
                    }
                } catch (err) {
                    // ignore
                }
            });
        });

        board.querySelectorAll('.qcl-placed-gate[draggable="true"]').forEach(gateEl => {
            gateEl.addEventListener('dragstart', e => {
                e.stopPropagation();
                const gId = gateEl.dataset.placedGateId;
                this.selectedPlacedGateId = gId;
                e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'board', gateId: gId }));
            });
        });
    }

    renderWireCellHTML(q, s, isActiveCol) {
        const directGate = this.gates.find(g => g.qubit === q && g.step === s);
        const targetOfGate = this.gates.find(
            g => g.step === s && GATE_LIBRARY[g.type]?.numQubits === 2 && g.targetQubit === q
        );

        let contentHtml = '';

        if (directGate) {
            const def = GATE_LIBRARY[directGate.type];
            const isSelected = this.selectedPlacedGateId === directGate.id;

            if (def.numQubits === 2) {
                const goesDown = directGate.targetQubit > q;
                const spanDist = Math.abs(directGate.targetQubit - q);

                if (directGate.type === 'CNOT') {
                    contentHtml = `
                        <div class="qcl-vconn ${goesDown ? 'vconn-down' : 'vconn-up'}"
                             style="--span-rows: ${spanDist}; --conn-color: ${def.color};"></div>
                        <div class="qcl-placed-gate qcl-control-dot ${isSelected ? 'selected' : ''}"
                             draggable="true"
                             data-placed-gate-id="${directGate.id}"
                             style="--gate-color: ${def.color};"
                             title="CNOT Control on Q${q} → Target on Q${directGate.targetQubit}">
                            <span class="ctrl-dot-core">●</span>
                            <span class="ctrl-sub-label">CTRL</span>
                            <button class="qcl-gate-del-btn" data-gate-id="${directGate.id}" title="Remove CNOT">&times;</button>
                        </div>
                    `;
                } else if (directGate.type === 'CZ') {
                    contentHtml = `
                        <div class="qcl-vconn ${goesDown ? 'vconn-down' : 'vconn-up'}"
                             style="--span-rows: ${spanDist}; --conn-color: ${def.color};"></div>
                        <div class="qcl-placed-gate qcl-cz-node ${isSelected ? 'selected' : ''}"
                             draggable="true"
                             data-placed-gate-id="${directGate.id}"
                             style="--gate-color: ${def.color};"
                             title="CZ Gate between Q${q} and Q${directGate.targetQubit}">
                            <span class="qcl-gate-sym">●</span>
                            <span class="ctrl-sub-label">CZ</span>
                            <button class="qcl-gate-del-btn" data-gate-id="${directGate.id}" title="Remove CZ">&times;</button>
                        </div>
                    `;
                } else if (directGate.type === 'SWAP') {
                    contentHtml = `
                        <div class="qcl-vconn ${goesDown ? 'vconn-down' : 'vconn-up'}"
                             style="--span-rows: ${spanDist}; --conn-color: ${def.color};"></div>
                        <div class="qcl-placed-gate qcl-swap-node ${isSelected ? 'selected' : ''}"
                             draggable="true"
                             data-placed-gate-id="${directGate.id}"
                             style="--gate-color: ${def.color};"
                             title="SWAP Gate between Q${q} and Q${directGate.targetQubit}">
                            <span class="swap-x">✕</span>
                            <span class="ctrl-sub-label">SWAP</span>
                            <button class="qcl-gate-del-btn" data-gate-id="${directGate.id}" title="Remove SWAP">&times;</button>
                        </div>
                    `;
                }
            } else {
                // Single-qubit gate with miniature microwave pulse wave icon
                const paramLabel = def.hasTheta
                    ? `<span class="qcl-gate-param">${formatRadiansShort(directGate.theta)}</span>`
                    : directGate.type === 'M'
                    ? `<span class="qcl-gate-param">READ</span>`
                    : `<span class="qcl-gate-param">∿ pulse</span>`;
                contentHtml = `
                    <div class="qcl-placed-gate ${isSelected ? 'selected' : ''}"
                         draggable="true"
                         data-placed-gate-id="${directGate.id}"
                         style="--gate-color: ${def.color};"
                         title="${def.name} on Q${q} at Step ${s + 1}">
                        <span class="qcl-gate-sym">${def.symbol}</span>
                        ${paramLabel}
                        <button class="qcl-gate-del-btn" data-gate-id="${directGate.id}" title="Remove gate">&times;</button>
                    </div>
                `;
            }
        } else if (targetOfGate) {
            const def = GATE_LIBRARY[targetOfGate.type];
            const isSelected = this.selectedPlacedGateId === targetOfGate.id;
            if (targetOfGate.type === 'CNOT') {
                contentHtml = `
                    <div class="qcl-placed-gate qcl-cnot-target ${isSelected ? 'selected' : ''}"
                         data-placed-gate-id="${targetOfGate.id}"
                         style="--gate-color: ${def.color};"
                         title="CNOT Target (⊕) on Q${q} controlled by Q${targetOfGate.qubit}">
                        <span class="cnot-plus">⊕</span>
                        <span class="ctrl-sub-label">XOR</span>
                    </div>
                `;
            } else if (targetOfGate.type === 'CZ') {
                contentHtml = `
                    <div class="qcl-placed-gate qcl-cz-node ${isSelected ? 'selected' : ''}"
                         data-placed-gate-id="${targetOfGate.id}"
                         style="--gate-color: ${def.color};"
                         title="CZ Partner on Q${q}">
                        <span class="qcl-gate-sym">Z</span>
                        <span class="ctrl-sub-label">PHASE</span>
                    </div>
                `;
            } else if (targetOfGate.type === 'SWAP') {
                contentHtml = `
                    <div class="qcl-placed-gate qcl-swap-node ${isSelected ? 'selected' : ''}"
                         data-placed-gate-id="${targetOfGate.id}"
                         style="--gate-color: ${def.color};"
                         title="SWAP Partner on Q${q}">
                        <span class="swap-x">✕</span>
                        <span class="ctrl-sub-label">SWAP</span>
                    </div>
                `;
            }
        } else {
            contentHtml = `<div class="qcl-empty-slot-dot" title="Click to place ${this.selectedPaletteGate} on Q${q}, Step ${s + 1}">+</div>`;
        }

        return `
            <div class="qcl-wire-cell ${isActiveCol ? 'active-step-cell' : ''}"
                 data-qubit="${q}"
                 data-step="${s}">
                <div class="qcl-coax-wire-track"></div>
                ${contentHtml}
            </div>
        `;
    }

    updatePlacedGateActionBar() {
        const bar = document.getElementById('qcl-placed-gate-bar');
        const titleEl = document.getElementById('qcl-pgb-title');
        const flipBtn = document.getElementById('qcl-pgb-flip');
        const cycleTargetBtn = document.getElementById('qcl-pgb-cycle-target');
        if (!bar) return;

        const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
        if (!g) {
            bar.style.display = 'none';
            return;
        }

        const def = GATE_LIBRARY[g.type];
        bar.style.display = 'flex';
        if (titleEl) {
            titleEl.textContent =
                def.numQubits === 2
                    ? `${def.symbol} (Q${g.qubit} → Q${g.targetQubit}) • t=${g.step + 1}`
                    : `${def.symbol}${def.hasTheta ? `(${formatRadiansShort(g.theta)})` : ''} on Q${g.qubit} • t=${g.step + 1}`;
        }

        if (flipBtn) flipBtn.style.display = def.numQubits === 2 ? 'inline-flex' : 'none';
        if (cycleTargetBtn) cycleTargetBtn.style.display = def.numQubits === 2 && this.numQubits > 2 ? 'inline-flex' : 'none';
    }

    refreshSimulationAndViews(resampleShots = true) {
        this.lastSimResult = QuantumCircuitSimulator.simulateCircuit(
            {
                numQubits: this.numQubits,
                numSteps: this.numSteps,
                initialStates: this.initialStates,
                gates: this.gates
            },
            this.measurementSeedMap
        );

        const maxSnapIdx = this.lastSimResult.snapshots.length - 1;
        this.activeStepIndex = Math.max(0, Math.min(this.activeStepIndex, maxSnapIdx));
        const activeSnap = this.lastSimResult.snapshots[this.activeStepIndex];

        this.renderPhysicalQuantumChip(activeSnap);
        this.renderTimelineBar(this.lastSimResult.snapshots);
        this.renderStatevectorAndMath(activeSnap);
        this.syncBlochSpheresData(activeSnap);

        if (resampleShots || !this.sampledCounts) {
            this.sampledCounts = QuantumCircuitSimulator.sampleMeasurements(
                activeSnap.theoreticalBasisStates || activeSnap.basisStates,
                this.numShots
            );
        }
        this.renderHistogram(activeSnap);
    }

    refreshAll() {
        this.renderGateInspector();
        this.refreshSimulationAndViews(true);
        this.renderCircuitBoard();
        this.updateUndoRedoButtons();
    }

    renderTimelineBar(snapshots) {
        const container = document.getElementById('qcl-timeline-steps');
        if (!container) return;

        container.innerHTML = snapshots
            .map(snap => {
                const isActive = snap.stepIndex === this.activeStepIndex;
                const hasGates = snap.stepGates && snap.stepGates.length > 0;
                const gateLabel =
                    snap.stepIndex === 0
                        ? 'Init'
                        : hasGates
                        ? snap.stepGates.map(g => g.type).join('+')
                        : 'Idle';
                return `
                    <button class="qcl-timeline-pill ${isActive ? 'active' : ''} ${hasGates ? 'has-op' : ''}"
                            data-step-idx="${snap.stepIndex}"
                            title="Step t=${snap.stepIndex}: ${snap.description}">
                        <span class="tl-step-num">t=${snap.stepIndex}</span>
                        <span class="tl-step-op">${gateLabel}</span>
                    </button>
                `;
            })
            .join('');

        container.querySelectorAll('.qcl-timeline-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this.stopAutoPlay();
                this.activeStepIndex = Number(pill.dataset.stepIdx);
                this.refreshAll();
            });
        });
    }

    renderStatevectorAndMath(snap) {
        const eyebrow = document.getElementById('qcl-step-eyebrow');
        const opTitle = document.getElementById('qcl-step-op-title');
        const badge = document.getElementById('qcl-classification-badge');
        const rerollBtn = document.getElementById('qcl-reroll-collapse');
        const subEl = document.getElementById('qcl-dirac-sub');
        const ketEl = document.getElementById('qcl-dirac-ket');
        const orderLabel = document.getElementById('qcl-ket-order-label');
        const ampGrid = document.getElementById('qcl-amplitudes-grid');

        if (eyebrow) {
            eyebrow.textContent = snap.stepIndex === 0 ? 'INITIAL STATE (t = 0)' : `AFTER PULSE STEP t = ${snap.stepIndex}`;
        }
        if (opTitle) opTitle.textContent = snap.description;
        if (badge) {
            badge.textContent = snap.stateClassification;
            badge.className = `qcl-classification-badge ${
                snap.isSystemEntangled
                    ? 'badge-entangled'
                    : snap.collapseEvents && snap.collapseEvents.length > 0
                    ? 'badge-collapsed'
                    : 'badge-separable'
            }`;
        }
        if (rerollBtn) {
            const hasAnyMeasurement = this.gates.some(g => g.type === 'M' && g.step < snap.stepIndex);
            rerollBtn.style.display = hasAnyMeasurement ? 'inline-flex' : 'none';
        }
        if (subEl) subEl.textContent = snap.stepIndex;
        if (ketEl) ketEl.textContent = snap.diracString;
        if (orderLabel) {
            const wires = Array.from({ length: this.numQubits }, (_, i) => `Q${i}`).join(' ');
            orderLabel.textContent = `|${wires}⟩`;
        }

        if (ampGrid) {
            ampGrid.innerHTML = snap.basisStates
                .map(b => {
                    const probPct = (b.probability * 100).toFixed(1);
                    const phaseStr = b.magnitude > 1e-5 ? formatRadiansShort(b.phaseRad) : '0';
                    const barColor =
                        b.magnitude > 1e-5 ? QuantumCircuitLabUI.phaseToColor(b.phaseRad) : '#dadce0';
                    return `
                        <div class="qcl-amp-card ${b.probability > 1e-5 ? 'non-zero' : ''}">
                            <div class="qcl-amp-top">
                                <span class="qcl-amp-ket">${b.ket}</span>
                                <span class="qcl-amp-prob">${probPct}%</span>
                            </div>
                            <div class="qcl-amp-bar-track">
                                <div class="qcl-amp-bar-fill" style="width: ${Math.min(100, b.probability * 100)}%; background: ${barColor};"></div>
                            </div>
                            <div class="qcl-amp-meta">
                                <span>α=${b.amplitude.formatCartesian(2)}</span>
                                <span>φ=${phaseStr}</span>
                            </div>
                        </div>
                    `;
                })
                .join('');
        }

        const mathDrawer = document.getElementById('qcl-formal-math-drawer');
        if (mathDrawer) {
            mathDrawer.style.display = this.showFormalMath ? 'flex' : 'none';
            if (this.showFormalMath) {
                this.renderFormalMathDetails(snap);
            }
        }
    }

    renderFormalMathDetails(snap) {
        const matContainer = document.getElementById('qcl-math-matrix-content');
        const tableContainer = document.getElementById('qcl-math-table-wrap');

        if (matContainer) {
            const activeGate =
                snap.stepGates && snap.stepGates.length > 0
                    ? snap.stepGates[0]
                    : this.gates.find(g => g.id === this.selectedPlacedGateId) || {
                          type: this.selectedPaletteGate,
                          qubit: 0,
                          theta: this.activeTheta
                      };
            const def = GATE_LIBRARY[activeGate.type] || GATE_LIBRARY.H;
            const mat = def.matrixFn(activeGate.theta ?? this.activeTheta);
            const prevDirac = snap.prevStatevector
                ? QuantumCircuitSimulator.formatDiracString(
                      snap.prevStatevector.map((amp, i) => ({
                          ket: `|${i.toString(2).padStart(this.numQubits, '0')}⟩`,
                          amplitude: amp,
                          magnitude: amp.abs()
                      }))
                  )
                : snap.diracString;

            matContainer.innerHTML = `
                <div class="qcl-math-eq-line">
                    <strong>${def.name}</strong> ${def.hasTheta ? `(θ = ${formatRadians(activeGate.theta ?? this.activeTheta)})` : ''}
                </div>
                <div class="qcl-math-matrix-flex">
                    ${this.formatMatrixHTML(mat)}
                    <div class="qcl-math-evolution-box">
                        <div><span class="math-muted">In:</span> <code>${prevDirac}</code></div>
                        <div><span class="math-muted">Out:</span> <code>${snap.diracString}</code></div>
                    </div>
                </div>
            `;
        }

        if (tableContainer) {
            tableContainer.innerHTML = `
                <table class="qcl-formal-amp-table">
                    <thead>
                        <tr>
                            <th>Ket</th>
                            <th>α = a + bi</th>
                            <th>Phase (rad)</th>
                            <th>Born |α|²</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${snap.basisStates
                            .map(
                                b => `
                            <tr class="${b.probability > 1e-5 ? 'active-basis-row' : ''}">
                                <td><code>${b.ket}</code></td>
                                <td><code>${b.amplitude.formatCartesian(3)}</code></td>
                                <td>${b.magnitude > 1e-5 ? formatRadiansShort(b.phaseRad) : '0'}</td>
                                <td><strong>${(b.probability * 100).toFixed(1)}%</strong></td>
                            </tr>
                        `
                            )
                            .join('')}
                    </tbody>
                </table>
            `;
        }
    }

    renderHistogram(snap) {
        const container = document.getElementById('qcl-histogram-bars');
        const shotLabel = document.getElementById('qcl-hist-shot-label');
        const footnote = document.getElementById('qcl-shots-footnote');
        if (!container) return;

        if (shotLabel) shotLabel.textContent = this.numShots;
        if (footnote) {
            const stdErr = (100 / Math.sqrt(this.numShots)).toFixed(1);
            footnote.textContent =
                this.numShots === 1
                    ? 'Single-shot run (N = 1): Measurement collapses the statevector into a single definite outcome!'
                    : `With N = ${this.numShots} shots, finite sampling fluctuates by ~1/√N ≈ ±${stdErr}% around the theoretical Born probabilities |α_x|².`;
        }

        const theoryStates = snap.theoreticalBasisStates || snap.basisStates;
        const counts = this.sampledCounts || {};

        container.innerHTML = theoryStates
            .map(b => {
                const theoryPct = b.probability * 100;
                const count = counts[b.bitstring] || 0;
                const shotPct = (count / this.numShots) * 100;

                return `
                    <div class="qcl-hist-row">
                        <div class="qcl-hist-ket">${b.ket}</div>
                        <div class="qcl-hist-tracks">
                            <div class="qcl-hist-bar-line" title="Theoretical Born Probability: ${theoryPct.toFixed(1)}%">
                                <div class="qcl-hist-fill-theory" style="width: ${Math.min(100, theoryPct)}%;"></div>
                                <span class="qcl-hist-val">${theoryPct.toFixed(1)}%</span>
                            </div>
                            <div class="qcl-hist-bar-line" title="Sampled in ${count} of ${this.numShots} shots (${shotPct.toFixed(1)}%)">
                                <div class="qcl-hist-fill-shots" style="width: ${Math.min(100, shotPct)}%;"></div>
                                <span class="qcl-hist-val">${count}/${this.numShots} (${shotPct.toFixed(1)}%)</span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    syncBlochSpheresData(snap) {
        const grid = document.getElementById('qcl-bloch-grid');
        if (!grid) return;

        if (this.blochCanvases.length !== this.numQubits) {
            this.blochCanvases = [];
            this.displayedBlochVectors = [];
            grid.innerHTML = '';

            for (let q = 0; q < this.numQubits; q++) {
                const card = document.createElement('div');
                card.className = 'qcl-bloch-card';
                card.innerHTML = `
                    <div class="qcl-bloch-card-top">
                        <span class="qcl-bloch-qname">Transmon Q<sub>${q}</sub></span>
                        <span class="qcl-bloch-state-tag" id="qcl-bloch-tag-${q}">|0⟩</span>
                    </div>
                    <canvas class="qcl-bloch-canvas" width="160" height="160" data-qubit="${q}"></canvas>
                    <div class="qcl-bloch-coords" id="qcl-bloch-coords-${q}"></div>
                `;
                grid.appendChild(card);
                const canvas = card.querySelector('canvas');
                this.initBlochCanvasDrag(canvas);
                this.blochCanvases.push(canvas);
                this.displayedBlochVectors.push({ rx: 0, ry: 0, rz: 1, rLen: 1, isEntangled: false });
            }
        }

        snap.blochData.forEach((b, q) => {
            const tagEl = document.getElementById(`qcl-bloch-tag-${q}`);
            const coordsEl = document.getElementById(`qcl-bloch-coords-${q}`);

            if (tagEl) {
                tagEl.textContent = b.stateLabel;
                tagEl.classList.toggle('entangled-tag', b.isEntangled);
            }
            if (coordsEl) {
                coordsEl.innerHTML = `
                    <span>X:${b.rx.toFixed(2)}</span>
                    <span>Y:${b.ry.toFixed(2)}</span>
                    <span>Z:${b.rz.toFixed(2)}</span>
                    <span>|r|:${b.rLen.toFixed(2)}</span>
                `;
            }

            if (!this.displayedBlochVectors[q]) {
                this.displayedBlochVectors[q] = { ...b, targetRx: b.rx, targetRy: b.ry, targetRz: b.rz };
            } else {
                this.displayedBlochVectors[q].targetRx = b.rx;
                this.displayedBlochVectors[q].targetRy = b.ry;
                this.displayedBlochVectors[q].targetRz = b.rz;
                this.displayedBlochVectors[q].rLen = b.rLen;
                this.displayedBlochVectors[q].isEntangled = b.isEntangled;
            }
        });
    }

    initBlochCanvasDrag(canvas) {
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener('pointerdown', e => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            this.blochViewYaw += dx * 0.012;
            this.blochViewPitch = Math.max(-1.2, Math.min(1.2, this.blochViewPitch + dy * 0.012));
        });

        canvas.addEventListener('pointerup', () => {
            dragging = false;
        });
    }

    startBlochAnimationLoop() {
        const tick = () => {
            requestAnimationFrame(tick);
            if (!this.isLabActive) return;

            for (let q = 0; q < this.blochCanvases.length; q++) {
                const canvas = this.blochCanvases[q];
                const state = this.displayedBlochVectors[q];
                if (!canvas || !state) continue;

                const tx = state.targetRx ?? 0;
                const ty = state.targetRy ?? 0;
                const tz = state.targetRz ?? 1;
                state.rx += (tx - state.rx) * 0.18;
                state.ry += (ty - state.ry) * 0.18;
                state.rz += (tz - state.rz) * 0.18;

                this.drawBlochSphereLight(canvas, state);
            }
        };
        requestAnimationFrame(tick);
    }

    projectBlochPoint(bx, by, bz, cx, cy, radius) {
        const yaw = this.blochViewYaw;
        const pitch = this.blochViewPitch;

        const rawX = by;
        const rawY = bz;
        const rawZ = bx;

        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const x1 = rawX * cosY + rawZ * sinY;
        const z1 = -rawX * sinY + rawZ * cosY;
        const y1 = rawY;

        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;

        return {
            x: cx + x1 * radius,
            y: cy - y2 * radius,
            z: z2
        };
    }

    /**
     * Bright, friendly Google-styled Bloch sphere renderer on crisp daylight canvas
     */
    drawBlochSphereLight(canvas, blochState) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const R = 55;

        ctx.clearRect(0, 0, w, h);

        // Soft daylight sphere shading
        const grad = ctx.createRadialGradient(cx - 16, cy - 18, 6, cx, cy, R);
        if (blochState.isEntangled) {
            grad.addColorStop(0, '#e6f4ea');
            grad.addColorStop(1, '#ceead6');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#e8f0fe');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        // Outer sphere border
        ctx.strokeStyle = blochState.isEntangled ? '#34a853' : '#9aa0a6';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();

        const drawCircle3D = (pointFn, strokeStyle, dashed = false) => {
            ctx.save();
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1.1;
            if (dashed) ctx.setLineDash([3, 3]);
            ctx.beginPath();
            const steps = 48;
            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * Math.PI * 2;
                const [bx, by, bz] = pointFn(t);
                const p = this.projectBlochPoint(bx, by, bz, cx, cy, R);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.restore();
        };

        drawCircle3D(t => [Math.cos(t), Math.sin(t), 0], 'rgba(26, 115, 232, 0.35)', true);
        drawCircle3D(t => [0, Math.cos(t), Math.sin(t)], 'rgba(95, 99, 104, 0.2)', false);

        const axes = [
            { from: [0, 0, -1], to: [0, 0, 1], labelPos: '|0⟩', labelNeg: '|1⟩', color: '#5f6368' },
            { from: [-1, 0, 0], to: [1, 0, 0], labelPos: '|+⟩', labelNeg: '|−⟩', color: '#1a73e8' },
            { from: [0, -1, 0], to: [0, 1, 0], labelPos: '|+i⟩', labelNeg: '', color: '#34a853' }
        ];

        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        axes.forEach(ax => {
            const p1 = this.projectBlochPoint(ax.from[0], ax.from[1], ax.from[2], cx, cy, R);
            const p2 = this.projectBlochPoint(ax.to[0], ax.to[1], ax.to[2], cx, cy, R);
            ctx.strokeStyle = 'rgba(95, 99, 104, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            if (ax.labelPos) {
                const lp = this.projectBlochPoint(ax.to[0] * 1.22, ax.to[1] * 1.22, ax.to[2] * 1.22, cx, cy, R);
                ctx.fillStyle = ax.color;
                ctx.fillText(ax.labelPos, lp.x, lp.y);
            }
            if (ax.labelNeg) {
                const ln = this.projectBlochPoint(ax.from[0] * 1.22, ax.from[1] * 1.22, ax.from[2] * 1.22, cx, cy, R);
                ctx.fillStyle = '#5f6368';
                ctx.fillText(ax.labelNeg, ln.x, ln.y);
            }
        });

        const origin = this.projectBlochPoint(0, 0, 0, cx, cy, R);
        const tip = this.projectBlochPoint(blochState.rx, blochState.ry, blochState.rz, cx, cy, R);

        // State vector arrow in Google Red (#ea4335) or Google Green (#34a853) when entangled
        const vecColor = blochState.isEntangled ? '#34a853' : '#ea4335';
        ctx.strokeStyle = vecColor;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();

        ctx.fillStyle = '#5f6368';
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = vecColor;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    toggleAutoPlay() {
        if (this.isPlaying) {
            this.stopAutoPlay();
            return;
        }

        this.isPlaying = true;
        const playBtn = document.getElementById('qcl-run-circuit');
        if (playBtn) {
            playBtn.textContent = '⏸ Pause';
            playBtn.classList.add('playing');
        }

        if (this.activeStepIndex >= this.numSteps) {
            this.activeStepIndex = 0;
            this.refreshAll();
        }

        this.playTimer = setInterval(() => {
            if (this.activeStepIndex < this.numSteps) {
                this.activeStepIndex++;
                this.refreshAll();
            } else {
                this.stopAutoPlay();
            }
        }, 720);
    }

    stopAutoPlay() {
        this.isPlaying = false;
        if (this.playTimer) {
            clearInterval(this.playTimer);
            this.playTimer = null;
        }
        const playBtn = document.getElementById('qcl-run-circuit');
        if (playBtn) {
            playBtn.textContent = '▶ Run Circuit';
            playBtn.classList.remove('playing');
        }
    }

    switchRightTab(tabName) {
        this.activeRightTab = tabName;
        document.querySelectorAll('.qcl-insp-tab').forEach(btn => {
            const isMatch = btn.dataset.tab === tabName;
            btn.classList.toggle('active', isMatch);
            btn.setAttribute('aria-selected', String(isMatch));
        });

        ['bloch', 'shots', 'math'].forEach(t => {
            const pane = document.getElementById(`qcl-tab-${t}`);
            if (pane) pane.style.display = t === tabName ? 'flex' : 'none';
        });
    }

    bindEvents() {
        // Mode Switcher Tabs
        document.getElementById('tab-mode-3d')?.addEventListener('click', () => this.setMode('3d'));
        document.getElementById('tab-mode-circuits')?.addEventListener('click', () => this.setMode('circuits'));
        document.getElementById('btn-inline-open-circuits')?.addEventListener('click', () => this.setMode('circuits'));

        document.getElementById('qcl-view-in-3d')?.addEventListener('click', () => {
            this.setMode('3d');
            if (this.app && this.app.interaction) {
                this.app.interaction.selectObject('qpu');
            }
        });

        // Right Column Tab Switcher (Bloch | Shots | Math)
        document.querySelectorAll('.qcl-insp-tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchRightTab(btn.dataset.tab));
        });

        // Lesson navigation
        document.getElementById('qcl-prev-lesson')?.addEventListener('click', () => {
            const nextIdx = (this.currentLessonIndex - 1 + CIRCUIT_LESSONS.length) % CIRCUIT_LESSONS.length;
            this.loadLesson(nextIdx, true);
        });
        document.getElementById('qcl-next-lesson')?.addEventListener('click', () => {
            const nextIdx = (this.currentLessonIndex + 1) % CIRCUIT_LESSONS.length;
            this.loadLesson(nextIdx, true);
        });
        document.getElementById('qcl-reload-lesson')?.addEventListener('click', () => {
            this.loadLesson(this.currentLessonIndex, true);
        });

        const mathToggleBtn = document.getElementById('qcl-toggle-math');
        if (mathToggleBtn) {
            mathToggleBtn.addEventListener('click', () => {
                this.showFormalMath = !this.showFormalMath;
                mathToggleBtn.classList.toggle('active', this.showFormalMath);
                mathToggleBtn.setAttribute('aria-pressed', String(this.showFormalMath));
                const lbl = document.getElementById('qcl-toggle-math-label');
                if (lbl) lbl.textContent = this.showFormalMath ? 'Hide Formal Math ▲' : 'Show Formal Math ▼';
                this.refreshSimulationAndViews(false);
            });
        }

        // Qubit Add / Remove
        document.getElementById('qcl-add-qubit')?.addEventListener('click', () => {
            if (this.numQubits >= 4) {
                this.showValidationBanner('Up to 4 physical Xmon transmon qubits can be mounted on this interactive QPU bench.');
                return;
            }
            this.hideValidationBanner();
            this.pushUndoState();
            this.numQubits++;
            this.initialStates.push('|0⟩');
            this.refreshAll();
        });

        document.getElementById('qcl-remove-qubit')?.addEventListener('click', () => {
            if (this.numQubits <= 1) {
                this.showValidationBanner('At least 1 physical transmon qubit (Q0) is required on the QPU chip.');
                return;
            }
            this.hideValidationBanner();
            this.pushUndoState();
            const removedWire = this.numQubits - 1;
            this.numQubits--;
            this.initialStates.pop();
            this.gates = this.gates.filter(g => g.qubit !== removedWire && g.targetQubit !== removedWire);
            this.selectedPlacedGateId = null;
            this.refreshAll();
        });

        document.getElementById('qcl-undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('qcl-redo-btn')?.addEventListener('click', () => this.redo());
        document.getElementById('qcl-clear-btn')?.addEventListener('click', () => {
            this.stopAutoPlay();
            this.pushUndoState();
            this.gates = [];
            this.initialStates = new Array(this.numQubits).fill('|0⟩');
            this.selectedPlacedGateId = null;
            this.activeStepIndex = 0;
            this.hideValidationBanner();
            this.refreshAll();
        });

        document.getElementById('qcl-preset-bell')?.addEventListener('click', () => this.loadLesson(3, true));
        document.getElementById('qcl-preset-ghz')?.addEventListener('click', () => this.loadLesson(5, true));
        document.getElementById('qcl-preset-interf')?.addEventListener('click', () => this.loadLesson(2, true));

        document.getElementById('qcl-validation-close')?.addEventListener('click', () => this.hideValidationBanner());

        // Placed gate action buttons
        document.getElementById('qcl-pgb-left')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && g.step > 0) this.movePlacedGate(g.id, g.qubit, g.step - 1);
        });
        document.getElementById('qcl-pgb-right')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && g.step < this.numSteps - 1) this.movePlacedGate(g.id, g.qubit, g.step + 1);
        });
        document.getElementById('qcl-pgb-up')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && g.qubit > 0) this.movePlacedGate(g.id, g.qubit - 1, g.step);
        });
        document.getElementById('qcl-pgb-down')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && g.qubit < this.numQubits - 1) this.movePlacedGate(g.id, g.qubit + 1, g.step);
        });
        document.getElementById('qcl-pgb-flip')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && GATE_LIBRARY[g.type]?.numQubits === 2) {
                const validation = this.validateGatePlacement(g.type, g.targetQubit, g.step, g.qubit, g.id);
                if (!validation.valid) {
                    this.showValidationBanner(validation.reason);
                    return;
                }
                this.pushUndoState();
                const tmp = g.qubit;
                g.qubit = g.targetQubit;
                g.targetQubit = tmp;
                this.refreshAll();
            }
        });
        document.getElementById('qcl-pgb-cycle-target')?.addEventListener('click', () => {
            const g = this.gates.find(item => item.id === this.selectedPlacedGateId);
            if (g && GATE_LIBRARY[g.type]?.numQubits === 2 && this.numQubits > 1) {
                for (let offset = 1; offset < this.numQubits; offset++) {
                    const candidate = (g.targetQubit + offset) % this.numQubits;
                    if (candidate === g.qubit) continue;
                    const validation = this.validateGatePlacement(g.type, g.qubit, g.step, candidate, g.id);
                    if (validation.valid) {
                        this.pushUndoState();
                        g.targetQubit = candidate;
                        this.hideValidationBanner();
                        this.refreshAll();
                        return;
                    }
                }
            }
        });
        document.getElementById('qcl-pgb-delete')?.addEventListener('click', () => {
            if (this.selectedPlacedGateId) this.deletePlacedGate(this.selectedPlacedGateId);
        });

        // Execution controls
        document.getElementById('qcl-step-start')?.addEventListener('click', () => {
            this.stopAutoPlay();
            this.activeStepIndex = 0;
            this.refreshAll();
        });
        document.getElementById('qcl-step-prev')?.addEventListener('click', () => {
            this.stopAutoPlay();
            if (this.activeStepIndex > 0) {
                this.activeStepIndex--;
                this.refreshAll();
            }
        });
        document.getElementById('qcl-run-circuit')?.addEventListener('click', () => this.toggleAutoPlay());
        document.getElementById('qcl-step-next')?.addEventListener('click', () => {
            this.stopAutoPlay();
            if (this.activeStepIndex < this.numSteps) {
                this.activeStepIndex++;
                this.refreshAll();
            }
        });
        document.getElementById('qcl-step-end')?.addEventListener('click', () => {
            this.stopAutoPlay();
            this.activeStepIndex = this.numSteps;
            this.refreshAll();
        });

        document.getElementById('qcl-reroll-collapse')?.addEventListener('click', () => {
            this.measurementSeedMap = {};
            this.refreshAll();
        });

        document.querySelectorAll('.qcl-shot-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qcl-shot-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.numShots = Number(btn.dataset.shots);
                this.refreshSimulationAndViews(true);
            });
        });

        document.getElementById('qcl-run-shots-btn')?.addEventListener('click', () => {
            this.refreshSimulationAndViews(true);
        });

        window.addEventListener(
            'keydown',
            e => {
                if (!this.isLabActive) return;
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;

                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    this.undo();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    this.redo();
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (this.selectedPlacedGateId) {
                        e.preventDefault();
                        this.deletePlacedGate(this.selectedPlacedGateId);
                    }
                } else if (e.key === 'ArrowRight') {
                    e.stopImmediatePropagation();
                    this.stopAutoPlay();
                    if (this.activeStepIndex < this.numSteps) {
                        this.activeStepIndex++;
                        this.refreshAll();
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.stopImmediatePropagation();
                    this.stopAutoPlay();
                    if (this.activeStepIndex > 0) {
                        this.activeStepIndex--;
                        this.refreshAll();
                    }
                }
            },
            true
        );
    }
}

window.QuantumCircuitLabUI = QuantumCircuitLabUI;
