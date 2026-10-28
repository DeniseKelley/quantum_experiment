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
        this.showFormalMath = true; // Default open so step-by-step math is immediately visible!
        this.activeRightTab = 'math'; // Default to Step-by-Step Math tab!
        this.activeStageMode = 'isometric'; // 'isometric' | 'oracle' | 'chapters'

        // Oracle diagram state (for Class Oracle U_f section)
        this.activeOraclePresetId = 'bv_s01';
        this.activeOracleSliceIdx = 2; // 0: |ψ0⟩, 1: |ψ1⟩, 2: |ψ2⟩, 3: |ψ3⟩
        this.customSecretString = '01';

        // Course chapters workbook state
        this.activeChapterIndex = 0;

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
        this.loadLesson(2, false); // Start on Bell State / Entanglement by default so 2-qubit 3D spheres shine
        this.startBlochAnimationLoop();
    }

    /**
     * Maps complex phase angle in radians (-π .. π) to Google-inspired friendly colors
     */
    static phaseToColor(phaseRad) {
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
                    <span class="mode-tab-sub">3D Bloch Stage, Oracles &amp; Class Math</span>
                </span>
                <span class="mode-tab-pill">CSE 4412 + 3D</span>
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
            <!-- Main 3-Column Light Workbench Layout -->
            <div class="qcl-main-grid">

                <!-- LEFT COLUMN: Guided Course Lessons + Quantum Gate Palette -->
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
                            <span class="qcl-subtle-hint">Click or drag onto stage</span>
                        </div>
                        <div class="qcl-palette-groups" id="qcl-palette-groups"></div>
                    </div>

                    <!-- Compact Selected Gate Inspector -->
                    <div class="qcl-gate-inspector" id="qcl-gate-inspector"></div>
                </aside>

                <!-- CENTER STAGE: 3-Mode Interactive Visual Stage (Isometric 3D Bloch Stage | Class Oracle U_f | Course Chapters Workbook) -->
                <main class="qcl-center-col">
                    <!-- Top Stage Mode Switcher & Circuit Toolbar -->
                    <div class="qcl-card qcl-workbench-toolbar">
                        <div class="qcl-stage-mode-tabs" role="tablist" aria-label="Visual Stage Mode">
                            <button class="qcl-stage-mode-btn active" data-stage-mode="isometric" id="qcl-mode-isometric">
                                ✨ 3D Isometric Bloch Stage
                            </button>
                            <button class="qcl-stage-mode-btn" data-stage-mode="oracle" id="qcl-mode-oracle">
                                🎓 Class Oracle Diagram (U<sub>f</sub>)
                            </button>
                            <button class="qcl-stage-mode-btn" data-stage-mode="chapters" id="qcl-mode-chapters">
                                📖 Course Chapters &amp; HW Math
                            </button>
                        </div>

                        <div class="qcl-toolbar-group" id="qcl-circuit-action-group">
                            <button class="qcl-btn qcl-btn-blue" id="qcl-add-qubit" title="Add a Qubit Wire & 3D Bloch Pedestal (up to 4)">+ Add Qubit</button>
                            <button class="qcl-btn" id="qcl-remove-qubit" title="Remove bottom Qubit Wire">− Remove</button>
                            <span class="qcl-chip-status-pill" id="qcl-qubit-count-pill">2 Qubits</span>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-bell" title="Bell State |Φ⁺⟩ (HW3 Q2)">Bell |Φ⁺⟩</button>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-teleport" title="3-Qubit Quantum Teleportation Protocol">Teleportation</button>
                            <button class="qcl-btn qcl-btn-chip" id="qcl-preset-interf" title="HW3 Q3: CNOT(H⊗H)|+,0⟩">HW3 Q3</button>
                            <button class="qcl-btn" id="qcl-undo-btn" title="Undo (Ctrl+Z)" disabled>↶</button>
                            <button class="qcl-btn" id="qcl-redo-btn" title="Redo (Ctrl+Y)" disabled>↷</button>
                            <button class="qcl-btn qcl-btn-red-outline" id="qcl-clear-btn" title="Reset circuit to |0...0⟩">⟲ Reset</button>
                        </div>
                    </div>

                    <!-- Validation / Placement Guidance Banner -->
                    <div class="qcl-validation-banner" id="qcl-validation-banner" style="display: none;" role="alert">
                        <span class="qcl-val-icon">⚠️</span>
                        <span class="qcl-val-text" id="qcl-validation-text"></span>
                        <button class="qcl-val-close" id="qcl-validation-close">&times;</button>
                    </div>

                    <!-- MODE 1: Microsoft Teleportation-Style Isometric 3D Bloch Pedestal & Circuit Stage -->
                    <div id="qcl-stage-pane-isometric" class="qcl-stage-pane">
                        <div class="qcl-card qcl-isometric-stage-card">
                            <div class="qcl-chip-card-header">
                                <div>
                                    <span class="qcl-eyebrow-tag">INTERACTIVE 3D ISOMETRIC BLOCH SPHERE &amp; CIRCUIT STAGE (CLICK ANY WIRE SLOT OR ↑ |ψₖ⟩ SLICE)</span>
                                    <h3 class="qcl-card-title">Glowing 3D Bloch Sphere Pedestals, Standing Isometric Gates &amp; State Slice Evolution</h3>
                                </div>
                                <div class="qcl-chip-legend">
                                    <span class="chip-leg-item"><i class="leg-dot leg-cyan"></i> Left Pedestal: Click to Cycle Init State</span>
                                    <span class="chip-leg-item"><i class="leg-dot leg-gold"></i> Wire Pad (+): Click to Place Selected Gate</span>
                                    <span class="chip-leg-item"><i class="leg-dot leg-purple"></i> Slice ↑ |ψₖ⟩: Click to Inspect Step Algebra</span>
                                </div>
                            </div>

                            <!-- Interactive Isometric 3D Stage SVG -->
                            <div class="qcl-isometric-stage-wrap" id="qcl-physical-chip-stage"></div>
                        </div>

                        <!-- Compact Synchronized Circuit Grid & Timeline Scrubber -->
                        <div class="qcl-card qcl-composer-card">
                            <div class="qcl-composer-header-row">
                                <div>
                                    <span class="qcl-eyebrow-tag">SYNCHRONIZED GATE TIMELINE &amp; SLICE SCRUBBER</span>
                                    <h3 class="qcl-card-title">Drag-and-Drop Gate Sequencer &amp; Classical Readout Bus</h3>
                                </div>

                                <!-- Selected Wire Gate Action Bar -->
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

                            <div class="qcl-circuit-board-wrap">
                                <div class="qcl-circuit-board" id="qcl-circuit-board"></div>
                            </div>

                            <div class="qcl-timeline-bar">
                                <div class="qcl-exec-controls">
                                    <button class="qcl-btn qcl-btn-sm" id="qcl-step-start" title="Reset to Initial State |ψ₀⟩ (t=0)">⏮ |ψ₀⟩</button>
                                    <button class="qcl-btn qcl-btn-sm" id="qcl-step-prev" title="Previous Slice">⏪ Prev</button>
                                    <button class="qcl-btn qcl-btn-green-play" id="qcl-run-circuit" title="Animate step-by-step across the 3D Bloch stage">▶ Run Circuit</button>
                                    <button class="qcl-btn qcl-btn-sm" id="qcl-step-next" title="Next Slice">Next ⏩</button>
                                    <button class="qcl-btn qcl-btn-sm" id="qcl-step-end" title="Jump to Final Slice">⏭ End</button>
                                </div>
                                <div class="qcl-timeline-steps" id="qcl-timeline-steps"></div>
                            </div>
                        </div>
                    </div>

                    <!-- MODE 2: Dedicated Class Oracle & Algorithm Diagram Section (scene7_quantum_alg.png / HW3 Part Two) -->
                    <div id="qcl-stage-pane-oracle" class="qcl-stage-pane" style="display: none;">
                        <div class="qcl-card qcl-oracle-stage-card" id="qcl-oracle-stage-container"></div>
                    </div>

                    <!-- MODE 3: Course Chapters, HW2 / HW3 & Exam 1 Step-by-Step Math Workbook -->
                    <div id="qcl-stage-pane-chapters" class="qcl-stage-pane" style="display: none;">
                        <div class="qcl-card qcl-chapters-workbook-card" id="qcl-chapters-workbook-container"></div>
                    </div>
                </main>

                <!-- RIGHT COLUMN: Live Step-by-Step Math Derivation, Bloch Spheres & Readout Shots -->
                <aside class="qcl-card qcl-right-col">
                    <!-- Live State Summary Banner -->
                    <div class="qcl-live-state-summary">
                        <div class="qcl-lss-top">
                            <span class="qcl-eyebrow-tag" id="qcl-step-eyebrow">SLICE |ψ₂⟩ (STEP t = 2)</span>
                            <span class="qcl-classification-badge" id="qcl-classification-badge">Separable State</span>
                        </div>
                        <div class="qcl-lss-op" id="qcl-step-op-title">Active Statevector</div>
                        <div class="qcl-dirac-pill">
                            <span class="qcl-dirac-lhs">|ψ<sub id="qcl-dirac-sub">2</sub>⟩ =</span>
                            <div class="qcl-dirac-ket" id="qcl-dirac-ket">1|00⟩</div>
                            <button class="qcl-btn qcl-btn-xs" id="qcl-reroll-collapse" style="display:none;" title="Re-sample projective measurement collapse">
                                🎲 Re-sample
                            </button>
                        </div>
                    </div>

                    <!-- 3-Tab Switcher (Defaulting to Step-by-Step Math!) -->
                    <div class="qcl-inspector-tabs" role="tablist">
                        <button class="qcl-insp-tab active" data-tab="math" role="tab" aria-selected="true">
                            📐 Step-by-Step Math
                        </button>
                        <button class="qcl-insp-tab" data-tab="bloch" role="tab" aria-selected="false">
                            🌐 3D Bloch Spheres
                        </button>
                        <button class="qcl-insp-tab" data-tab="shots" role="tab" aria-selected="false">
                            📊 Born Shots
                        </button>
                    </div>

                    <!-- TAB 1 (DEFAULT): Live Step-by-Step Algebraic Derivation & Entanglement Proof -->
                    <div class="qcl-tab-pane active" id="qcl-tab-math">
                        <div class="qcl-math-header-row">
                            <span class="qcl-pane-subtitle">Live Algebraic Derivation <strong id="qcl-ket-order-label">|q0 q1⟩</strong></span>
                            <button class="qcl-btn qcl-btn-xs qcl-btn-math-toggle active" id="qcl-toggle-math" aria-pressed="true">
                                <span id="qcl-toggle-math-label">Matrix &amp; Table ▲</span>
                            </button>
                        </div>

                        <!-- Step-by-Step Slice Derivation Cards (|ψ₀⟩ → |ψ₁⟩ → |ψ₂⟩ ...) -->
                        <div class="qcl-step-derivation-list" id="qcl-step-derivation-list"></div>

                        <!-- Automatic CSE 4412 Exam 1 Separability / Entanglement Proof Box -->
                        <div class="qcl-entanglement-proof-box" id="qcl-entanglement-proof-box"></div>

                        <!-- Complex Amplitude Cards -->
                        <div class="qcl-amplitudes-grid" id="qcl-amplitudes-grid"></div>

                        <!-- Formal Linear Algebra Drawer -->
                        <div class="qcl-formal-math-drawer" id="qcl-formal-math-drawer">
                            <div class="qcl-math-card">
                                <div class="qcl-math-card-title">Unitary Gate Matrix &amp; Transformation</div>
                                <div id="qcl-math-matrix-content"></div>
                            </div>
                            <div class="qcl-math-card">
                                <div class="qcl-math-card-title">Complex Amplitudes &amp; Born Rule Table</div>
                                <div class="qcl-math-table-wrap" id="qcl-math-table-wrap"></div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: Interactive Drag-to-Rotate 3D Bloch Spheres -->
                    <div class="qcl-tab-pane" id="qcl-tab-bloch" style="display: none;">
                        <div class="qcl-pane-header">
                            <span class="qcl-pane-subtitle">Single-Qubit Vectors (Drag sphere to rotate 3D view)</span>
                        </div>
                        <div class="qcl-bloch-grid" id="qcl-bloch-grid"></div>
                        <div class="qcl-friendly-note">
                            <strong>Exam 1 &amp; Ch. 3.5 Note:</strong> Pure single-qubit states lie on the sphere surface (<code>|r| = 1</code>, Tr(ρ²) = 1). When two qubits are <strong>entangled</strong>, tracing out one qubit leaves the other in a mixed state inside the sphere (<code>|r| &lt; 1</code>, ρ = ½I for Bell states)!
                        </div>
                    </div>

                    <!-- TAB 3: Readout Probabilities & Measurement Shots Histogram -->
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
                            <span><i class="hist-swatch hist-swatch-theory"></i> Exact Born Rule |⟨x|ψ⟩|²</span>
                            <span><i class="hist-swatch hist-swatch-shots"></i> Sampled (<span id="qcl-hist-shot-label">1024</span> shots)</span>
                        </div>

                        <div class="qcl-histogram-bars" id="qcl-histogram-bars"></div>

                        <div class="qcl-friendly-note" id="qcl-shots-footnote">
                            With N = 1024 shots, statistical sampling noise is ~1/√1024 ≈ ±3.1% around the exact Born-rule probabilities.
                        </div>
                    </div>
                </aside>
            </div>
        `;

        document.body.appendChild(labRoot);
        this.renderPalette();
        this.renderLessonSelector();
        this.renderClassOracleStage();
        this.renderCourseChaptersWorkbook();
    }

    switchStageMode(mode) {
        this.activeStageMode = mode;
        document.querySelectorAll('.qcl-stage-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.stageMode === mode);
        });
        ['isometric', 'oracle', 'chapters'].forEach(m => {
            const pane = document.getElementById(`qcl-stage-pane-${m}`);
            if (pane) pane.style.display = m === mode ? 'flex' : 'none';
        });
        const actionGroup = document.getElementById('qcl-circuit-action-group');
        if (actionGroup) {
            actionGroup.style.display = mode === 'isometric' ? 'flex' : 'none';
        }
        if (mode === 'oracle') {
            this.renderClassOracleStage();
        } else if (mode === 'chapters') {
            this.renderCourseChaptersWorkbook();
        } else {
            this.refreshAll();
        }
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
            { title: 'Superposition & Pauli Flips', keys: ['H', 'X', 'Y', 'Z'] },
            { title: 'Phase & Radian Rotations', keys: ['S', 'T', 'Rx', 'Ry', 'Rz'] },
            { title: '2-Qubit Entanglers & Readout', keys: ['CNOT', 'CZ', 'SWAP', 'M'] }
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
                                <span class="qcl-chip-sub">${g.hasTheta ? 'θ rad' : g.numQubits === 2 ? '2Q' : g.id === 'M' ? 'Meter' : '1Q'}</span>
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
                if (this.lastSimResult) {
                    const activeSnap = this.lastSimResult.snapshots[this.activeStepIndex];
                    this.renderPhysicalQuantumChip(activeSnap);
                }
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
     * Helper to draw a gorgeous 3D Translucent Bloch Sphere on a Glowing Ring Pedestal in SVG
     * Inspired directly by Microsoft's Quantum Teleportation illustration (ms_teleportation.jpg)!
     */
    renderSVGBlochPedestal(cx, cy, radius, bloch, labelTop, labelBottom, isInteractiveInit = false, qubitIndex = 0) {
        const rx = bloch ? bloch.rx : 0;
        const ry = bloch ? bloch.ry : 0;
        const rz = bloch ? bloch.rz : 1;
        const isEntangled = bloch ? bloch.isEntangled : false;

        // Isometric 3D projection of Bloch vector (x = front-left, y = front-right, z = vertical up)
        const isoX = (ry - rx * 0.65) * radius * 0.85;
        const isoY = (-rz + (rx * 0.35 + ry * 0.25)) * radius * 0.85;
        const tipX = cx + isoX;
        const tipY = cy + isoY;

        const pedY = cy + radius + 9;
        const ringColor = isEntangled ? '#34d399' : '#38bdf8';
        const arrowColor = isEntangled ? '#10b981' : '#f43f5e';

        return `
            <g class="iso-bloch-pedestal-group ${isInteractiveInit ? 'iso-clickable-pedestal' : ''}"
               ${isInteractiveInit ? `data-init-qubit="${qubitIndex}"` : ''}
               style="${isInteractiveInit ? 'cursor: pointer;' : ''}">
                <title>${isInteractiveInit ? `Click to cycle Q${qubitIndex} initial state (${labelBottom})` : `Q${qubitIndex} Live State: ${labelBottom}`}</title>

                <!-- Glowing Concentric Isometric Pedestal Base on the Grid Floor -->
                <ellipse cx="${cx}" cy="${pedY + 4}" rx="${radius * 1.18}" ry="${radius * 0.42}"
                         fill="rgba(15, 23, 42, 0.72)" stroke="${ringColor}" stroke-width="1.6" stroke-opacity="0.85" />
                <ellipse cx="${cx}" cy="${pedY + 2}" rx="${radius * 0.92}" ry="${radius * 0.31}"
                         fill="rgba(56, 189, 248, 0.16)" stroke="#bae6fd" stroke-width="1.2" stroke-dasharray="4,2" />
                <ellipse cx="${cx}" cy="${pedY}" rx="${radius * 0.58}" ry="${radius * 0.19}"
                         fill="rgba(56, 189, 248, 0.32)" />

                <!-- Pedestal Upward Light Cone -->
                <polygon points="${cx - radius * 0.85},${pedY} ${cx + radius * 0.85},${pedY} ${cx + radius * 0.98},${cy} ${cx - radius * 0.98},${cy}"
                         fill="url(#iso-pedestal-beam)" opacity="0.45" />

                <!-- Translucent 3D Glass Bloch Sphere -->
                <circle cx="${cx}" cy="${cy}" r="${radius}"
                        fill="${isEntangled ? 'url(#iso-sphere-entangled)' : 'url(#iso-sphere-glass)'}"
                        stroke="${ringColor}" stroke-width="1.8" />

                <!-- Equator & Meridian Wireframe Ellipses inside 3D Sphere -->
                <ellipse cx="${cx}" cy="${cy}" rx="${radius}" ry="${radius * 0.34}"
                         fill="none" stroke="rgba(186, 230, 253, 0.55)" stroke-width="1.1" stroke-dasharray="3,2" />
                <ellipse cx="${cx}" cy="${cy}" rx="${radius * 0.36}" ry="${radius}"
                         fill="none" stroke="rgba(186, 230, 253, 0.38)" stroke-width="1" />

                <!-- Vertical Z Axis (|0⟩ North Pole to |1⟩ South Pole) -->
                <line x1="${cx}" y1="${cy - radius}" x2="${cx}" y2="${cy + radius}"
                      stroke="rgba(226, 232, 240, 0.45)" stroke-width="1" stroke-dasharray="2,2" />
                <text x="${cx}" y="${cy - radius - 4}" text-anchor="middle" fill="#bae6fd" font-size="8.5" font-weight="800">|0⟩</text>
                <text x="${cx + 9}" y="${cy + radius - 2}" text-anchor="start" fill="#94a3b8" font-size="7.5" font-weight="700">|1⟩</text>

                <!-- Center Origin Dot -->
                <circle cx="${cx}" cy="${cy}" r="2.5" fill="#e2e8f0" />

                <!-- 3D State Vector Arrow or Entanglement Core -->
                ${
                    isEntangled && bloch.rLen < 0.15
                        ? `
                        <circle cx="${cx}" cy="${cy}" r="${radius * 0.36}" fill="rgba(16, 185, 129, 0.35)" stroke="#34d399" stroke-width="1.6" stroke-dasharray="3,2" />
                        <text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="#ecfdf5" font-size="7.5" font-weight="800">EPR</text>
                    `
                        : `
                        <line x1="${cx}" y1="${cy}" x2="${tipX}" y2="${tipY}"
                              stroke="${arrowColor}" stroke-width="3" stroke-linecap="round" filter="url(#iso-glow)" />
                        <circle cx="${tipX}" cy="${tipY}" r="4.5" fill="${arrowColor}" stroke="#ffffff" stroke-width="1.4" />
                    `
                }

                <!-- Specular Glass Highlight on Top-Left of Sphere -->
                <ellipse cx="${cx - radius * 0.34}" cy="${cy - radius * 0.36}" rx="${radius * 0.28}" ry="${radius * 0.15}"
                         transform="rotate(-28 ${cx - radius * 0.34} ${cy - radius * 0.36})"
                         fill="rgba(255, 255, 255, 0.42)" />

                <!-- Top & Bottom Labels -->
                <text x="${cx}" y="${cy - radius - 15}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="800" font-family="Inter, sans-serif">
                    ${labelTop}
                </text>
                <rect x="${cx - 32}" y="${pedY + 11}" width="64" height="17" rx="8.5"
                      fill="${isEntangled ? 'rgba(6, 95, 70, 0.92)' : 'rgba(15, 23, 42, 0.9)'}"
                      stroke="${ringColor}" stroke-width="1.2" />
                <text x="${cx}" y="${pedY + 23}" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="800" font-family="monospace">
                    ${labelBottom}
                </text>
            </g>
        `;
    }

    /**
     * Renders the Microsoft Quantum Teleportation-Style Isometric 3D Bloch Pedestal & Circuit Stage!
     * Replaces the old chip view with:
     * - Isometric perspective grid platform (matching ms_teleportation.jpg & scene7_quantum_alg.png)
     * - Left Input 3D Bloch Sphere Pedestals (click to cycle initial state |0⟩, |1⟩, |+⟩, |−⟩)
     * - Standing 3D Isometric Gate Prisms (H, X, Y, Z, S, T, Rx, Ry, Rz, CNOT ●—⊕, CZ, SWAP, Measurement gauge with double classical wires)
     * - Interactive wire landing pads (+) to add gates directly on the pretty diagram
     * - Class-style vertical state slice markers (↑ |ψ₀⟩, ↑ |ψ₁⟩, ↑ |ψ₂⟩, ...) between every time step
     * - Right Output 3D Bloch Sphere Pedestals showing live simulated state & entanglement ribbons
     */
    renderPhysicalQuantumChip(snap) {
        const stage = document.getElementById('qcl-physical-chip-stage');
        if (!stage) return;

        const n = this.numQubits;
        const numSteps = this.numSteps;
        const W = 860;
        const rowSpacing = n === 1 ? 0 : n === 2 ? 96 : n === 3 ? 74 : 60;
        const H = Math.max(255, 130 + (n - 1) * rowSpacing + 65);

        const leftPedX = 76;
        const rightPedX = W - 78;
        const wireStartX = leftPedX + 36;
        const wireEndX = rightPedX - 36;
        const stepWidth = (wireEndX - wireStartX) / numSteps;

        const topMargin = n === 1 ? H * 0.45 : 64;
        const wireY = Array.from({ length: n }, (_, q) => topMargin + q * rowSpacing);
        const sphereR = n <= 2 ? 26 : n === 3 ? 22 : 19;

        // 1. Build Isometric Perspective Grid Lines in Background (matching ms_teleportation.jpg & scene7_quantum_alg.png)
        let isoGridSvg = '';
        for (let gx = -240; gx <= W + 240; gx += 44) {
            isoGridSvg += `
                <line x1="${gx}" y1="0" x2="${gx + H * 1.15}" y2="${H}" stroke="rgba(56, 189, 248, 0.13)" stroke-width="1" />
                <line x1="${gx}" y1="${H}" x2="${gx + H * 1.15}" y2="0" stroke="rgba(56, 189, 248, 0.11)" stroke-width="1" />
            `;
        }

        // 2. Entanglement Glow Ribbons between entangled qubit wires on the isometric floor
        let entanglementRibbonsSvg = '';
        if (snap && snap.isSystemEntangled && n >= 2) {
            const entIndices = snap.blochData.filter(b => b.isEntangled).map(b => b.qubit);
            if (entIndices.length >= 2) {
                const yMin = wireY[Math.min(...entIndices)];
                const yMax = wireY[Math.max(...entIndices)];
                entanglementRibbonsSvg = `
                    <rect x="${wireStartX}" y="${yMin - 12}" width="${wireEndX - wireStartX}" height="${yMax - yMin + 24}"
                          rx="16" fill="url(#iso-entangle-field)" stroke="rgba(52, 211, 153, 0.45)" stroke-width="1.5" stroke-dasharray="6,4" />
                `;
            }
        }

        // 3. Active Time Slice Highlight Plane & Class State Slice Markers (↑ |ψ₀⟩, ↑ |ψ₁⟩, ↑ |ψ₂⟩...)
        let sliceMarkersSvg = '';
        for (let s = 0; s <= numSteps; s++) {
            const sx = wireStartX + s * stepWidth;
            const isCurrentSlice = this.activeStepIndex === s;
            const subDigits = ['₀', '₁', '₂', '₃', '₄', '₅', '₆'];
            const ketLabel = `|ψ${subDigits[s] || s}⟩`;

            sliceMarkersSvg += `
                <g class="iso-slice-marker-group" data-slice-step="${s}" style="cursor: pointer;">
                    <title>Click to inspect state slice ${ketLabel} (Step t = ${s}) and its step-by-step algebra</title>
                    <!-- Vertical dashed slice line across all wires (like scene7_quantum_alg.png) -->
                    <line x1="${sx}" y1="${wireY[0] - 28}" x2="${sx}" y2="${H - 36}"
                          stroke="${isCurrentSlice ? '#38bdf8' : 'rgba(148, 163, 184, 0.35)'}"
                          stroke-width="${isCurrentSlice ? '2.4' : '1.2'}"
                          stroke-dasharray="${isCurrentSlice ? 'none' : '4,4'}" />
                    ${
                        isCurrentSlice
                            ? `<rect x="${sx - 16}" y="${wireY[0] - 30}" width="32" height="${H - wireY[0] - 4}" rx="8"
                                     fill="rgba(56, 189, 248, 0.12)" pointer-events="none" />`
                            : ''
                    }
                    <!-- Upward Arrow ↑ and |ψ_k⟩ Pill at bottom (matching class diagram!) -->
                    <text x="${sx}" y="${H - 24}" text-anchor="middle"
                          fill="${isCurrentSlice ? '#38bdf8' : '#94a3b8'}" font-size="11" font-weight="900">↑</text>
                    <rect x="${sx - 23}" y="${H - 22}" width="46" height="18" rx="6"
                          fill="${isCurrentSlice ? '#0284c7' : 'rgba(15, 23, 42, 0.85)'}"
                          stroke="${isCurrentSlice ? '#7dd3fc' : 'rgba(148, 163, 184, 0.5)'}" stroke-width="1.3" />
                    <text x="${sx}" y="${H - 9.5}" text-anchor="middle"
                          fill="${isCurrentSlice ? '#ffffff' : '#cbd5e1'}" font-size="10.5" font-weight="800" font-family="Georgia, serif" font-style="italic">
                        ${ketLabel}
                    </text>
                </g>
            `;
        }

        // 4. Qubit Quantum Wires & Left/Right 3D Bloch Sphere Pedestals
        let wiresAndPedestalsSvg = '';
        const initVec = QuantumCircuitSimulator.createInitialStatevector(n, this.initialStates);

        for (let q = 0; q < n; q++) {
            const wy = wireY[q];
            const initBloch = QuantumCircuitSimulator.computeQubitBlochData(initVec, n, q);
            const liveBloch =
                snap && snap.blochData && snap.blochData[q]
                    ? snap.blochData[q]
                    : initBloch;

            // Glowing quantum wire connecting Left Input Bloch Pedestal to Right Output Bloch Pedestal
            const passedX = wireStartX + this.activeStepIndex * stepWidth;
            wiresAndPedestalsSvg += `
                <!-- Base quantum wire -->
                <line x1="${wireStartX - 10}" y1="${wy}" x2="${wireEndX + 10}" y2="${wy}"
                      stroke="rgba(148, 163, 184, 0.55)" stroke-width="3" />
                <!-- Illuminated active quantum wave segment up to current slice |ψ_t⟩ -->
                <line x1="${wireStartX - 10}" y1="${wy}" x2="${passedX}" y2="${wy}"
                      stroke="${liveBloch.isEntangled ? '#34d399' : '#38bdf8'}" stroke-width="3.6" filter="url(#iso-glow)" />
            `;

            // Left Input 3D Bloch Sphere Pedestal (Interactive: click to cycle initial state)
            wiresAndPedestalsSvg += this.renderSVGBlochPedestal(
                leftPedX,
                wy - 4,
                sphereR,
                initBloch,
                `q${q} In`,
                this.initialStates[q] || '|0⟩',
                true,
                q
            );

            // Right Output 3D Bloch Sphere Pedestal (Live state at active slice |ψ_t⟩)
            wiresAndPedestalsSvg += this.renderSVGBlochPedestal(
                rightPedX,
                wy - 4,
                sphereR,
                liveBloch,
                `q${q} State`,
                liveBloch.isEntangled ? 'Entangled' : liveBloch.stateLabel.slice(0, 6),
                false,
                q
            );
        }

        // 5. Standing 3D Isometric Gate Tiles & Interactive Wire Slots
        let gatesAndSlotsSvg = '';
        for (let s = 0; s < numSteps; s++) {
            const cx = wireStartX + (s + 0.5) * stepWidth;
            const isStepExecuted = s < this.activeStepIndex;
            const isCurrentStep = s + 1 === this.activeStepIndex;

            // First draw multi-qubit vertical 3D bridges in column s
            const col2QGates = this.gates.filter(
                g => g.step === s && GATE_LIBRARY[g.type]?.numQubits === 2 && g.targetQubit !== undefined
            );
            col2QGates.forEach(g => {
                const y1 = wireY[g.qubit];
                const y2 = wireY[g.targetQubit];
                const def = GATE_LIBRARY[g.type];
                gatesAndSlotsSvg += `
                    <g class="iso-2q-bridge">
                        <!-- Shadow on isometric floor -->
                        <line x1="${cx + 5}" y1="${y1 + 6}" x2="${cx + 5}" y2="${y2 + 6}"
                              stroke="rgba(15, 23, 42, 0.55)" stroke-width="6" stroke-linecap="round" />
                        <!-- Glowing vertical entangling column -->
                        <line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}"
                              stroke="${def.color}" stroke-width="4.2" stroke-linecap="round"
                              ${isCurrentStep ? 'filter="url(#iso-glow)"' : ''} />
                    </g>
                `;
            });

            // Classical feed-forward double lines for Measurement gates (like Microsoft Teleportation diagram!)
            const colMeasGates = this.gates.filter(g => g.step === s && g.type === 'M');
            colMeasGates.forEach(mg => {
                const my = wireY[mg.qubit];
                const bottomBusY = H - 38;
                gatesAndSlotsSvg += `
                    <g class="iso-classical-feed">
                        <line x1="${cx - 2}" y1="${my + 16}" x2="${cx - 2}" y2="${bottomBusY}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3,2" />
                        <line x1="${cx + 2}" y1="${my + 16}" x2="${cx + 2}" y2="${bottomBusY}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3,2" />
                    </g>
                `;
            });

            // Now draw each wire slot (q, s)
            for (let q = 0; q < n; q++) {
                const cy = wireY[q];
                const directGate = this.gates.find(g => g.qubit === q && g.step === s);
                const targetOfGate = this.gates.find(
                    g => g.step === s && GATE_LIBRARY[g.type]?.numQubits === 2 && g.targetQubit === q
                );

                if (directGate) {
                    const def = GATE_LIBRARY[directGate.type];
                    const isSelected = this.selectedPlacedGateId === directGate.id;
                    gatesAndSlotsSvg += this.renderSVGIsometricGateTile(
                        cx,
                        cy,
                        directGate,
                        def,
                        isSelected,
                        isCurrentStep,
                        isStepExecuted,
                        'primary'
                    );
                } else if (targetOfGate) {
                    const def = GATE_LIBRARY[targetOfGate.type];
                    const isSelected = this.selectedPlacedGateId === targetOfGate.id;
                    gatesAndSlotsSvg += this.renderSVGIsometricGateTile(
                        cx,
                        cy,
                        targetOfGate,
                        def,
                        isSelected,
                        isCurrentStep,
                        isStepExecuted,
                        'target'
                    );
                } else {
                    // Interactive empty landing pad on the isometric wire
                    gatesAndSlotsSvg += `
                        <g class="iso-empty-slot" data-qubit="${q}" data-step="${s}" style="cursor: pointer;">
                            <title>Click to place ${this.selectedPaletteGate} gate on wire q${q} at Step ${s + 1}</title>
                            <ellipse cx="${cx}" cy="${cy}" rx="12" ry="7"
                                     fill="rgba(15, 23, 42, 0.65)" stroke="rgba(148, 163, 184, 0.55)" stroke-width="1.2" stroke-dasharray="2,2" />
                            <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="800">+</text>
                        </g>
                    `;
                }
            }
        }

        stage.innerHTML = `
            <svg class="qcl-qpu-svg qcl-iso-stage-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="iso-stage-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#0b192c" />
                        <stop offset="50%" stop-color="#0f2942" />
                        <stop offset="100%" stop-color="#1e3a5f" />
                    </linearGradient>
                    <radialGradient id="iso-sphere-glass" cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stop-color="rgba(224, 242, 254, 0.55)" />
                        <stop offset="55%" stop-color="rgba(56, 189, 248, 0.22)" />
                        <stop offset="100%" stop-color="rgba(3, 105, 161, 0.42)" />
                    </radialGradient>
                    <radialGradient id="iso-sphere-entangled" cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stop-color="rgba(209, 250, 229, 0.6)" />
                        <stop offset="55%" stop-color="rgba(16, 185, 129, 0.28)" />
                        <stop offset="100%" stop-color="rgba(4, 120, 87, 0.48)" />
                    </radialGradient>
                    <linearGradient id="iso-pedestal-beam" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stop-color="rgba(56, 189, 248, 0.42)" />
                        <stop offset="100%" stop-color="rgba(56, 189, 248, 0.0)" />
                    </linearGradient>
                    <linearGradient id="iso-entangle-field" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="rgba(16, 185, 129, 0.06)" />
                        <stop offset="50%" stop-color="rgba(16, 185, 129, 0.18)" />
                        <stop offset="100%" stop-color="rgba(16, 185, 129, 0.06)" />
                    </linearGradient>
                    <filter id="iso-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <!-- Isometric Gridded Stage Floor (Microsoft Teleportation & Class Diagram Aesthetic) -->
                <rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="url(#iso-stage-bg)" stroke="#334155" stroke-width="1.5" />
                <g opacity="0.9">${isoGridSvg}</g>

                <!-- Top Stage Banner Label -->
                <text x="18" y="21" fill="#7dd3fc" font-size="9.5" font-weight="800" letter-spacing="0.08em">
                    3D ISOMETRIC QUANTUM STAGE • INPUT BLOCH PEDESTALS ⟶ STANDING UNITARY GATES ⟶ OUTPUT BLOCH PEDESTALS
                </text>

                <!-- Entanglement Field Ribbon -->
                ${entanglementRibbonsSvg}

                <!-- Vertical State Slice Markers (↑ |ψ₀⟩, ↑ |ψ₁⟩, ...) -->
                ${sliceMarkersSvg}

                <!-- Qubit Wires & 3D Translucent Bloch Sphere Pedestals -->
                ${wiresAndPedestalsSvg}

                <!-- Standing Isometric 3D Gate Tiles & Interactive Wire Slots -->
                ${gatesAndSlotsSvg}
            </svg>
        `;

        // Bind interactive events on the Isometric 3D Stage:
        // 1) Clicking a left input Bloch pedestal cycles that wire's initial state!
        stage.querySelectorAll('.iso-clickable-pedestal').forEach(ped => {
            ped.addEventListener('click', e => {
                e.stopPropagation();
                const q = Number(ped.dataset.initQubit);
                this.cycleInitialState(q);
            });
        });

        // 2) Clicking any ↑ |ψ_k⟩ slice marker jumps the timeline & math derivation to step k!
        stage.querySelectorAll('.iso-slice-marker-group').forEach(marker => {
            marker.addEventListener('click', e => {
                e.stopPropagation();
                this.stopAutoPlay();
                this.activeStepIndex = Number(marker.dataset.sliceStep);
                this.refreshAll();
            });
        });

        // 3) Clicking an empty slot (+) on the isometric wire places the selected gate!
        stage.querySelectorAll('.iso-empty-slot').forEach(slot => {
            slot.addEventListener('click', e => {
                e.stopPropagation();
                const q = Number(slot.dataset.qubit);
                const s = Number(slot.dataset.step);
                this.placeGateAt(this.selectedPaletteGate, q, s);
            });
        });

        // 4) Clicking a standing 3D gate tile selects it (or clicking its × button deletes it)
        stage.querySelectorAll('.iso-placed-gate-group').forEach(gEl => {
            gEl.addEventListener('click', e => {
                e.stopPropagation();
                const delBtn = e.target.closest('.iso-gate-del');
                const gId = gEl.dataset.gateId;
                if (delBtn) {
                    this.deletePlacedGate(gId);
                    return;
                }
                this.selectedPlacedGateId = gId;
                const gObj = this.gates.find(g => g.id === gId);
                if (gObj) {
                    if (GATE_LIBRARY[gObj.type]?.hasTheta) {
                        this.activeTheta = gObj.theta;
                    }
                    this.activeStepIndex = gObj.step + 1;
                }
                this.updatePaletteSelectionUI();
                this.refreshAll();
            });
        });
    }

    /**
     * Draws a standing 3D Isometric Gate Prism / Control Sphere / CNOT Target / Measurement Gauge
     * on the Isometric Stage
     */
    renderSVGIsometricGateTile(cx, cy, gate, def, isSelected, isCurrentStep, isStepExecuted, role) {
        const color = def.color;
        const glowAttr = isCurrentStep || isSelected ? 'filter="url(#iso-glow)"' : '';
        const strokeColor = isSelected ? '#fde047' : '#ffffff';
        const strokeW = isSelected ? '2.4' : '1.4';

        // CNOT Control Dot (3D glowing sphere on control wire)
        if (gate.type === 'CNOT' && role === 'primary') {
            return `
                <g class="iso-placed-gate-group" data-gate-id="${gate.id}" style="cursor: pointer;">
                    <title>CNOT Control on q${gate.qubit} → Target on q${gate.targetQubit} (Click to select or remove)</title>
                    <ellipse cx="${cx}" cy="${cy + 14}" rx="10" ry="4" fill="rgba(15, 23, 42, 0.55)" />
                    <circle cx="${cx}" cy="${cy}" r="10" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeW}" ${glowAttr} />
                    <circle cx="${cx - 3}" cy="${cy - 3}" r="3" fill="rgba(255,255,255,0.65)" />
                    <g class="iso-gate-del" transform="translate(${cx + 11}, ${cy - 11})">
                        <circle r="7" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" />
                        <text y="3.5" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800">&times;</text>
                    </g>
                </g>
            `;
        }

        // CNOT Target ⊕ (3D Isometric XOR ring)
        if (gate.type === 'CNOT' && role === 'target') {
            return `
                <g class="iso-placed-gate-group" data-gate-id="${gate.id}" style="cursor: pointer;">
                    <title>CNOT Target (⊕) on q${gate.targetQubit} controlled by q${gate.qubit}</title>
                    <ellipse cx="${cx}" cy="${cy + 18}" rx="15" ry="5" fill="rgba(15, 23, 42, 0.55)" />
                    <circle cx="${cx + 3}" cy="${cy + 2}" r="15" fill="#064e3b" stroke="${color}" stroke-width="1.5" />
                    <circle cx="${cx}" cy="${cy}" r="15" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeW}" ${glowAttr} />
                    <line x1="${cx - 9}" y1="${cy}" x2="${cx + 9}" y2="${cy}" stroke="#ffffff" stroke-width="2.6" />
                    <line x1="${cx}" y1="${cy - 9}" x2="${cx}" y2="${cy + 9}" stroke="#ffffff" stroke-width="2.6" />
                </g>
            `;
        }

        // Standing 3D Isometric Prism Tile for H, X, Y, Z, S, T, Rx, Ry, Rz, CZ, SWAP, M
        const w = 36;
        const h = 36;
        const dx = 6; // 3D isometric depth extrude X
        const dy = -5; // 3D isometric depth extrude Y
        const x0 = cx - w / 2;
        const y0 = cy - h / 2;

        const subText = def.hasTheta
            ? formatRadiansShort(gate.theta)
            : gate.type === 'M'
            ? 'READ'
            : '';

        return `
            <g class="iso-placed-gate-group" data-gate-id="${gate.id}" style="cursor: pointer;">
                <title>${def.name} at Step ${gate.step + 1} (Click to inspect or remove)</title>
                <!-- Isometric floor drop shadow -->
                <ellipse cx="${cx + 3}" cy="${cy + h / 2 + 7}" rx="18" ry="5.5" fill="rgba(2, 6, 23, 0.6)" />

                <!-- 3D Top Extruded Face -->
                <polygon points="${x0},${y0} ${x0 + dx},${y0 + dy} ${x0 + w + dx},${y0 + dy} ${x0 + w},${y0}"
                         fill="${color}" filter="brightness(1.25)" stroke="rgba(255,255,255,0.6)" stroke-width="0.9" />

                <!-- 3D Right Extruded Side Face -->
                <polygon points="${x0 + w},${y0} ${x0 + w + dx},${y0 + dy} ${x0 + w + dx},${y0 + h + dy} ${x0 + w},${y0 + h}"
                         fill="${color}" filter="brightness(0.75)" stroke="rgba(255,255,255,0.4)" stroke-width="0.9" />

                <!-- Front Standing Isometric Gate Face -->
                <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5"
                      fill="${color}" stroke="${strokeColor}" stroke-width="${strokeW}" ${glowAttr} />

                ${
                    gate.type === 'M'
                        ? `
                        <!-- Measurement Meter Dial Gauge Arc & Needle (like ms_teleportation.jpg) -->
                        <path d="M ${cx - 11} ${cy + 4} A 11 11 0 0 1 ${cx + 11} ${cy + 4}" fill="none" stroke="#ffffff" stroke-width="2" />
                        <line x1="${cx}" y1="${cy + 4}" x2="${cx + 7}" y2="${cy - 6}" stroke="#fde047" stroke-width="2.2" stroke-linecap="round" />
                        <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#fde047" font-size="7.5" font-weight="800">METER</text>
                    `
                        : `
                        <text x="${cx}" y="${cy + (subText ? 1 : 5)}" text-anchor="middle"
                              fill="#ffffff" font-size="14.5" font-weight="900" font-family="Inter, sans-serif">
                            ${role === 'target' && gate.type === 'SWAP' ? '✕' : def.symbol}
                        </text>
                        ${
                            subText
                                ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-size="8" font-weight="700" font-family="monospace">${subText}</text>`
                                : ''
                        }
                    `
                }

                ${
                    role === 'primary'
                        ? `
                        <g class="iso-gate-del" transform="translate(${x0 + w + 3}, ${y0 - 3})">
                            <circle r="7" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" />
                            <text y="3.5" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800">&times;</text>
                        </g>
                    `
                        : ''
                }
            </g>
        `;
    }

    /**
     * Renders Mode 2: The Dedicated Class Oracle & Algorithm Diagram Section (scene7_quantum_alg.png & HW3 Part Two)
     */
    renderClassOracleStage() {
        const container = document.getElementById('qcl-oracle-stage-container');
        if (!container || typeof ORACLE_ALGORITHM_PRESETS === 'undefined') return;

        const preset = ORACLE_ALGORITHM_PRESETS[this.activeOraclePresetId] || ORACLE_ALGORITHM_PRESETS.bv_s01;
        const activeSlice = preset.slices[this.activeOracleSliceIdx] || preset.slices[0];

        container.innerHTML = `
            <div class="qcl-oracle-header">
                <div>
                    <span class="qcl-eyebrow-tag">CLASS ALGORITHM &amp; ORACLE ARCHITECTURE (CSE 4412 HW3 PART TWO &amp; MOSCA CH. 6)</span>
                    <h3 class="qcl-card-title">${preset.title}</h3>
                </div>
                <div class="qcl-oracle-preset-pills">
                    ${Object.values(ORACLE_ALGORITHM_PRESETS)
                        .map(
                            p => `
                        <button class="qcl-btn qcl-btn-chip ${p.id === preset.id ? 'active-preset-chip' : ''}"
                                data-oracle-preset="${p.id}">
                            ${p.badge}: s=${p.secretString}
                        </button>
                    `
                        )
                        .join('')}
                </div>
            </div>

            <!-- Interactive Class-Style Oracle Diagram SVG (Matching scene7_quantum_alg.png) -->
            <div class="qcl-oracle-svg-wrap">
                <svg class="qcl-oracle-svg" viewBox="0 0 820 250" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <linearGradient id="oracle-bg-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#15325b" />
                            <stop offset="55%" stop-color="#165b8c" />
                            <stop offset="100%" stop-color="#1985a1" />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="820" height="250" rx="14" fill="url(#oracle-bg-grad)" stroke="#38bdf8" stroke-width="1.5" />

                    <!-- Isometric perspective grid background matching scene7_quantum_alg.png -->
                    <g opacity="0.22">
                        ${Array.from({ length: 24 }, (_, i) => {
                            const gx = -180 + i * 50;
                            return `
                                <line x1="${gx}" y1="0" x2="${gx + 260}" y2="250" stroke="#bae6fd" stroke-width="1" />
                                <line x1="${gx}" y1="250" x2="${gx + 260}" y2="0" stroke="#bae6fd" stroke-width="1" />
                            `;
                        }).join('')}
                    </g>

                    <!-- Top Register Wire: |0⟩ —/n— H^⊗n — x — [ U_f ] — x — H^⊗n — Measure |s⟩ -->
                    <text x="58" y="80" text-anchor="end" fill="#e0f2fe" font-size="24" font-family="Georgia, serif">|0⟩</text>
                    <line x1="70" y1="73" x2="175" y2="73" stroke="#bae6fd" stroke-width="2.6" />
                    <!-- Multi-qubit bundle slash /n -->
                    <line x1="112" y1="88" x2="134" y2="58" stroke="#bae6fd" stroke-width="2.2" />
                    <text x="122" y="53" text-anchor="middle" fill="#7dd3fc" font-size="18" font-weight="800" font-family="Georgia, serif">n=${preset.n}</text>

                    <!-- First H^⊗n Box -->
                    <rect x="175" y="45" width="68" height="56" fill="rgba(15, 23, 42, 0.45)" stroke="#bae6fd" stroke-width="2.2" />
                    <text x="209" y="80" text-anchor="middle" fill="#e0f2fe" font-size="21" font-family="Georgia, serif" font-style="italic">
                        H<tspan baseline-shift="super" font-size="13">⊗${preset.n}</tspan>
                    </text>

                    <line x1="243" y1="73" x2="315" y2="73" stroke="#bae6fd" stroke-width="2.6" />

                    <!-- Bottom Ancilla Wire: |1⟩ ——— H — y — [ U_f : y ⊕ f(x) ] ——— |−⟩ -->
                    <text x="58" y="166" text-anchor="end" fill="#e0f2fe" font-size="24" font-family="Georgia, serif">|1⟩</text>
                    <line x1="70" y1="158" x2="175" y2="158" stroke="#bae6fd" stroke-width="2.6" />

                    <!-- Bottom H Box -->
                    <rect x="175" y="130" width="68" height="56" fill="rgba(15, 23, 42, 0.45)" stroke="#bae6fd" stroke-width="2.2" />
                    <text x="209" y="166" text-anchor="middle" fill="#e0f2fe" font-size="23" font-family="Georgia, serif" font-style="italic">H</text>

                    <line x1="243" y1="158" x2="315" y2="158" stroke="#bae6fd" stroke-width="2.6" />

                    <!-- Large Central Quantum Oracle Box U_f (matching scene7_quantum_alg.png!) -->
                    <rect x="315" y="34" width="205" height="160" fill="rgba(15, 23, 42, 0.48)" stroke="#7dd3fc" stroke-width="2.5" />
                    <text x="334" y="78" fill="#bae6fd" font-size="20" font-family="Georgia, serif" font-style="italic">x</text>
                    <text x="498" y="78" text-anchor="end" fill="#bae6fd" font-size="20" font-family="Georgia, serif" font-style="italic">x</text>
                    <text x="417" y="122" text-anchor="middle" fill="#ffffff" font-size="30" font-family="Georgia, serif" font-style="italic">
                        U<tspan baseline-shift="sub" font-size="20">f</tspan>
                    </text>
                    <text x="334" y="164" fill="#bae6fd" font-size="20" font-family="Georgia, serif" font-style="italic">y</text>
                    <text x="504" y="164" text-anchor="end" fill="#fde047" font-size="20" font-family="Georgia, serif" font-style="italic">y ⊕ f(x)</text>

                    <!-- Wires Exiting U_f -->
                    <line x1="520" y1="73" x2="590" y2="73" stroke="#bae6fd" stroke-width="2.6" />
                    <line x1="520" y1="158" x2="755" y2="158" stroke="#bae6fd" stroke-width="2.6" />
                    <text x="765" y="163" fill="#bae6fd" font-size="16" font-family="monospace">|−⟩</text>

                    <!-- Final H^⊗n Box on Top Register -->
                    <rect x="590" y="45" width="68" height="56" fill="rgba(15, 23, 42, 0.45)" stroke="#bae6fd" stroke-width="2.2" />
                    <text x="624" y="80" text-anchor="middle" fill="#e0f2fe" font-size="21" font-family="Georgia, serif" font-style="italic">
                        H<tspan baseline-shift="super" font-size="13">⊗${preset.n}</tspan>
                    </text>
                    <line x1="658" y1="73" x2="715" y2="73" stroke="#bae6fd" stroke-width="2.6" />

                    <!-- Final Measurement Output Badge -->
                    <rect x="715" y="51" width="88" height="44" rx="8" fill="#0284c7" stroke="#fde047" stroke-width="2" />
                    <text x="759" y="70" text-anchor="middle" fill="#fde047" font-size="10" font-weight="800">OUTPUT</text>
                    <text x="759" y="86" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="900" font-family="monospace">|${preset.secretString.slice(0, 3)}⟩</text>

                    <!-- Interactive Vertical State Slice Arrows ↑ |ψ₀⟩, ↑ |ψ₁⟩, ↑ |ψ₂⟩, ↑ |ψ₃⟩ -->
                    ${[
                        { idx: 0, x: 145, label: '|ψ₀⟩' },
                        { idx: 1, x: 278, label: '|ψ₁⟩' },
                        { idx: 2, x: 554, label: '|ψ₂⟩' },
                        { idx: 3, x: 688, label: '|ψ₃⟩' }
                    ]
                        .map(sl => {
                            const isSel = this.activeOracleSliceIdx === sl.idx;
                            return `
                            <g class="oracle-slice-btn" data-oracle-slice="${sl.idx}" style="cursor: pointer;">
                                <line x1="${sl.x}" y1="28" x2="${sl.x}" y2="195"
                                      stroke="${isSel ? '#fde047' : 'rgba(186, 230, 253, 0.4)'}"
                                      stroke-width="${isSel ? '2.5' : '1.4'}" stroke-dasharray="5,4" />
                                <text x="${sl.x}" y="212" text-anchor="middle" fill="${isSel ? '#fde047' : '#bae6fd'}" font-size="16" font-weight="900">↑</text>
                                <rect x="${sl.x - 30}" y="216" width="60" height="26" rx="8"
                                      fill="${isSel ? '#fde047' : 'rgba(15, 23, 42, 0.78)'}"
                                      stroke="${isSel ? '#ffffff' : '#7dd3fc'}" stroke-width="1.5" />
                                <text x="${sl.x}" y="234" text-anchor="middle"
                                      fill="${isSel ? '#0f172a' : '#e0f2fe'}" font-size="16" font-weight="800" font-family="Georgia, serif">
                                    ${sl.label}
                                </text>
                            </g>
                        `;
                        })
                        .join('')}
                </svg>
            </div>

            <!-- Interactive Slice Selector Pills & Step-by-Step Hand Calculation Display -->
            <div class="qcl-oracle-body-grid">
                <div class="qcl-oracle-derivation-panel">
                    <div class="qcl-oracle-slice-tabs">
                        ${preset.slices
                            .map(
                                (sl, idx) => `
                            <button class="qcl-oracle-slice-tab ${idx === this.activeOracleSliceIdx ? 'active' : ''}"
                                    data-oracle-slice="${idx}">
                                Slice ${sl.label}: ${sl.stageTitle.split('(')[0]}
                            </button>
                        `
                            )
                            .join('')}
                    </div>

                    <!-- Highlighted Active Slice Formula & Step-by-Step Hand Calculation -->
                    <div class="qcl-oracle-active-slice-box">
                        <div class="qcl-oracle-slice-title">${activeSlice.label} — ${activeSlice.stageTitle}</div>
                        <div class="qcl-oracle-main-eq">${activeSlice.formulaHTML}</div>
                        <div class="qcl-oracle-steps-list">
                            ${activeSlice.stepsHTML.map(st => `<div class="qcl-oracle-step-item">${st}</div>`).join('')}
                        </div>
                    </div>

                    <!-- All 4 Slices Overview Accordion / List for Exam Reference -->
                    <div class="qcl-oracle-all-slices-summary">
                        <div class="qcl-math-card-title">Complete Exam / HW3 Hand-Calculation Summary (${preset.formulaDesc})</div>
                        ${preset.slices
                            .map(
                                (sl, idx) => `
                            <div class="qcl-oracle-summary-row ${idx === this.activeOracleSliceIdx ? 'active-row' : ''}" data-oracle-slice="${idx}">
                                <span class="qcl-osr-tag">${sl.label}</span>
                                <div class="qcl-osr-eq">${sl.formulaHTML}</div>
                            </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>

                <!-- Right Side of Oracle Card: Oracle Truth Table f(x) & 1-Click Load into 3D Stage -->
                <div class="qcl-oracle-truth-panel">
                    <div class="qcl-math-card-title">Oracle Function Table: ${preset.formulaDesc}</div>
                    <table class="qcl-formal-amp-table">
                        <thead>
                            <tr>
                                <th>Input x</th>
                                <th>Calculation</th>
                                <th>f(x)</th>
                                <th>Kickback (−1)<sup>f(x)</sup></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${preset.truthTable
                                .map(
                                    row => `
                                <tr class="${row.fx === 1 ? 'active-basis-row' : ''}">
                                    <td><code>|${row.x}⟩</code></td>
                                    <td><code>${row.calc}</code></td>
                                    <td><strong>${row.fx}</strong></td>
                                    <td><strong style="color:${row.fx === 1 ? '#dc2626' : '#16a34a'}">${row.fx === 1 ? '−1' : '+1'}</strong></td>
                                </tr>
                            `
                                )
                                .join('')}
                        </tbody>
                    </table>

                    <button class="qcl-btn qcl-btn-blue" id="qcl-load-oracle-to-3d" style="width: 100%; margin-top: 10px; padding: 9px;">
                        ✨ Load Equivalent CNOT Circuit onto 3D Isometric Bloch Stage →
                    </button>
                </div>
            </div>
        `;

        container.querySelectorAll('[data-oracle-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeOraclePresetId = btn.dataset.oraclePreset;
                this.activeOracleSliceIdx = 2;
                this.renderClassOracleStage();
            });
        });

        container.querySelectorAll('[data-oracle-slice]').forEach(el => {
            el.addEventListener('click', () => {
                this.activeOracleSliceIdx = Number(el.dataset.oracleSlice);
                this.renderClassOracleStage();
            });
        });

        document.getElementById('qcl-load-oracle-to-3d')?.addEventListener('click', () => {
            const eq = preset.equivalentCircuit;
            if (eq) {
                this.pushUndoState();
                this.numQubits = eq.numQubits;
                this.initialStates = [...eq.initialStates];
                this.gates = eq.gates.map(g => ({ ...g }));
                this.activeStepIndex = 3;
                this.switchStageMode('isometric');
            }
        });
    }

    /**
     * Renders Mode 3: The Course Chapters, HW2 / HW3 & Exam 1 Step-by-Step Math Workbook
     */
    renderCourseChaptersWorkbook() {
        const container = document.getElementById('qcl-chapters-workbook-container');
        if (!container || typeof COURSE_CHAPTERS === 'undefined') return;

        const chapter = COURSE_CHAPTERS[this.activeChapterIndex] || COURSE_CHAPTERS[0];

        container.innerHTML = `
            <div class="qcl-workbook-header">
                <div>
                    <span class="qcl-eyebrow-tag">${chapter.sourceTag}</span>
                    <h3 class="qcl-card-title">${chapter.number}: ${chapter.title}</h3>
                </div>
                <div class="qcl-chapter-Selector-pills">
                    ${COURSE_CHAPTERS.map(
                        (ch, idx) => `
                        <button class="qcl-btn qcl-btn-chip ${idx === this.activeChapterIndex ? 'active-preset-chip' : ''}"
                                data-chapter-idx="${idx}">
                            ${ch.number}
                        </button>
                    `
                    ).join('')}
                </div>
            </div>

            <p class="qcl-workbook-summary">${chapter.summary}</p>

            <!-- Key Chapter Formulas Box -->
            <div class="qcl-workbook-formulas-grid">
                ${chapter.keyFormulas
                    .map(
                        f => `
                    <div class="qcl-wb-formula-card">
                        <div class="qcl-wb-formula-name">${f.name}</div>
                        <div class="qcl-wb-formula-eq">${f.eq}</div>
                    </div>
                `
                    )
                    .join('')}
            </div>

            <!-- Step-by-Step Calculated Examples from Class, HW2, HW3 & Exam 1 Study Guide -->
            <div class="qcl-workbook-examples-list">
                ${chapter.examples
                    .map(
                        ex => `
                    <div class="qcl-wb-example-card">
                        <div class="qcl-wb-ex-header">
                            <div>
                                <span class="qcl-google-pill pill-blue">${ex.badge}</span>
                                <h4 class="qcl-wb-ex-title">${ex.title}</h4>
                            </div>
                            ${
                                ex.loadCircuit
                                    ? `<button class="qcl-btn qcl-btn-blue qcl-btn-xs qcl-wb-load-btn" data-ex-id="${ex.id}">
                                           ✨ Load on 3D Isometric Stage →
                                       </button>`
                                    : ex.openOraclePreset
                                    ? `<button class="qcl-btn qcl-btn-blue qcl-btn-xs qcl-wb-oracle-btn" data-oracle-id="${ex.openOraclePreset}">
                                           🎓 Open in Class Oracle Diagram →
                                       </button>`
                                    : ''
                            }
                        </div>
                        <div class="qcl-wb-problem-box">
                            <strong>Problem:</strong> ${ex.problemStatement}
                        </div>
                        <div class="qcl-wb-steps">
                            ${ex.steps
                                .map(
                                    (st, sIdx) => `
                                <div class="qcl-wb-step-row">
                                    <div class="qcl-wb-step-badge">Step ${sIdx + 1}: ${st.label}</div>
                                    <div class="qcl-wb-step-math">${st.math}</div>
                                    <div class="qcl-wb-step-note">${st.note}</div>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;

        container.querySelectorAll('[data-chapter-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeChapterIndex = Number(btn.dataset.chapterIdx);
                this.renderCourseChaptersWorkbook();
            });
        });

        container.querySelectorAll('.qcl-wb-load-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const exId = btn.dataset.exId;
                const ex = chapter.examples.find(e => e.id === exId);
                if (ex && ex.loadCircuit) {
                    this.pushUndoState();
                    this.numQubits = ex.loadCircuit.numQubits;
                    this.initialStates = [...ex.loadCircuit.initialStates];
                    this.gates = ex.loadCircuit.gates.map(g => ({ ...g }));
                    const maxStep = this.gates.reduce((m, g) => Math.max(m, g.step), 0);
                    this.activeStepIndex = maxStep + 1;
                    this.switchStageMode('isometric');
                }
            });
        });

        container.querySelectorAll('.qcl-wb-oracle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeOraclePresetId = btn.dataset.oracleId;
                this.activeOracleSliceIdx = 2;
                this.switchStageMode('oracle');
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
        const derivList = document.getElementById('qcl-step-derivation-list');
        const proofBox = document.getElementById('qcl-entanglement-proof-box');

        if (eyebrow) {
            eyebrow.textContent = snap.stepIndex === 0 ? 'SLICE |ψ₀⟩ (INITIAL STATE t = 0)' : `SLICE |ψ${snap.stepIndex}⟩ (AFTER STEP t = ${snap.stepIndex})`;
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
        if (ketEl) {
            if (typeof QuantumMathDerivationEngine !== 'undefined') {
                ketEl.innerHTML = QuantumMathDerivationEngine.formatStatePrettyHTML(snap.basisStates);
            } else {
                ketEl.textContent = snap.diracString;
            }
        }
        if (orderLabel) {
            const wires = Array.from({ length: this.numQubits }, (_, i) => `q${i}`).join(' ');
            orderLabel.textContent = `|${wires}⟩`;
        }

        // 1. Render Step-by-Step Algebraic Derivation Cards (|ψ₀⟩ → |ψ₁⟩ → |ψ₂⟩ ...)
        if (derivList && typeof QuantumMathDerivationEngine !== 'undefined' && this.lastSimResult) {
            const steps = QuantumMathDerivationEngine.generateCircuitDerivation(
                {
                    numQubits: this.numQubits,
                    initialStates: this.initialStates,
                    gates: this.gates
                },
                this.lastSimResult,
                this.activeStepIndex
            );

            derivList.innerHTML = steps
                .map(
                    st => `
                <div class="qcl-deriv-step-card ${st.isActive ? 'active-deriv-step' : ''}" data-deriv-step="${st.stepIndex}">
                    <div class="qcl-deriv-card-header">
                        <span class="qcl-deriv-slice-pill">${st.sliceLabel}</span>
                        <span class="qcl-deriv-card-title">${st.title}</span>
                    </div>
                    <div class="qcl-deriv-rule">${st.ruleExplanation}</div>
                    <div class="qcl-deriv-algebra-box">
                        ${st.algebraLines.map(line => `<div class="qcl-deriv-eq-line">${line}</div>`).join('')}
                    </div>
                    <div class="qcl-deriv-born-row">${st.bornSummary}</div>
                </div>
            `
                )
                .join('');

            derivList.querySelectorAll('.qcl-deriv-step-card').forEach(card => {
                card.addEventListener('click', () => {
                    this.stopAutoPlay();
                    this.activeStepIndex = Number(card.dataset.derivStep);
                    this.refreshAll();
                });
            });
        }

        // 2. Render Automatic CSE 4412 Exam 1 Separability / Entanglement Proof
        if (proofBox && typeof QuantumMathDerivationEngine !== 'undefined') {
            const proof = QuantumMathDerivationEngine.generateEntanglementProofHTML(snap, this.numQubits);
            proofBox.innerHTML = `
                <div class="qcl-proof-card ${proof.isEntangled ? 'proof-entangled' : 'proof-separable'}">
                    <div class="qcl-proof-header">
                        <span class="qcl-proof-icon">${proof.isEntangled ? '🔗' : '🧩'}</span>
                        <strong>${proof.title}</strong>
                    </div>
                    <div class="qcl-proof-steps">
                        ${proof.stepsHTML.map(p => `<div class="qcl-proof-step-line">${p}</div>`).join('')}
                    </div>
                </div>
            `;
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

        // Stage Mode Switcher Tabs (3D Isometric Bloch Stage | Class Oracle Diagram | Course Chapters & HW Math)
        document.querySelectorAll('.qcl-stage-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchStageMode(btn.dataset.stageMode));
        });

        // Right Column Tab Switcher (Math | Bloch | Shots)
        document.querySelectorAll('.qcl-insp-tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchRightTab(btn.dataset.tab));
        });

        // Lesson navigation
        document.getElementById('qcl-prev-lesson')?.addEventListener('click', () => {
            const nextIdx = (this.currentLessonIndex - 1 + CIRCUIT_LESSONS.length) % CIRCUIT_LESSONS.length;
            this.switchStageMode('isometric');
            this.loadLesson(nextIdx, true);
        });
        document.getElementById('qcl-next-lesson')?.addEventListener('click', () => {
            const nextIdx = (this.currentLessonIndex + 1) % CIRCUIT_LESSONS.length;
            this.switchStageMode('isometric');
            this.loadLesson(nextIdx, true);
        });
        document.getElementById('qcl-reload-lesson')?.addEventListener('click', () => {
            this.switchStageMode('isometric');
            this.loadLesson(this.currentLessonIndex, true);
        });

        const mathToggleBtn = document.getElementById('qcl-toggle-math');
        if (mathToggleBtn) {
            mathToggleBtn.addEventListener('click', () => {
                this.showFormalMath = !this.showFormalMath;
                mathToggleBtn.classList.toggle('active', this.showFormalMath);
                mathToggleBtn.setAttribute('aria-pressed', String(this.showFormalMath));
                const lbl = document.getElementById('qcl-toggle-math-label');
                if (lbl) lbl.textContent = this.showFormalMath ? 'Matrix & Table ▲' : 'Matrix & Table ▼';
                this.refreshSimulationAndViews(false);
            });
        }

        // Qubit Add / Remove
        document.getElementById('qcl-add-qubit')?.addEventListener('click', () => {
            if (this.numQubits >= 4) {
                this.showValidationBanner('Up to 4 qubits with 3D Bloch sphere pedestals can be displayed simultaneously on the stage.');
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
                this.showValidationBanner('At least 1 qubit wire (q0) is required on the stage.');
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

        document.getElementById('qcl-preset-bell')?.addEventListener('click', () => {
            this.switchStageMode('isometric');
            this.loadLesson(2, true);
        });
        document.getElementById('qcl-preset-teleport')?.addEventListener('click', () => {
            this.switchStageMode('isometric');
            this.loadLesson(4, true);
        });
        document.getElementById('qcl-preset-interf')?.addEventListener('click', () => {
            this.switchStageMode('isometric');
            this.loadLesson(3, true);
        });

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
