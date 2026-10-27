/**
 * quantum_computer.js
 * High-precision procedural 3D model of the Google Quantum AI 1,000+-Qubit Dilution Refrigerator
 * ("Quantum Chandelier") & Extruded Aluminum T-Slot Gantry Frame, modeled directly after:
 *   1. Reference Photo: assets/references/sci_news_14467_quantum_computer.jpg
 *      (https://www.sci.news/othersciences/computerscience/qubit-copies-14467.html)
 *   2. Reference Photo: assets/references/Google_Quantum_AI_Cryostat.jpg
 *   3. QUANTUM_COMPUTER_MODEL_GUIDE.md & FRAME_AND_ANCHORING_GUIDE.md
 *
 * Key visual & structural features matching sci_news_14467_quantum_computer.jpg:
 *   - Top recessed brushed stainless-steel vacuum flange with dual bolt rings mounted flush in the
 *     extruded aluminum T-slot ceiling deck.
 *   - 2 Upper Brushed Silver/Aluminum Stage Plates (50K & 4K) with 8 oval port cutouts housing
 *     gold multi-pin matrix blocks and dense silver-steel semi-rigid coax bundles.
 *   - 4 Lower Polished Gold-Plated OFHC Copper Stage Plates (800mK, 300mK, 90mK, 10mK) with
 *     chamfered edges, gold standoff sleeves, and perforated tapped-hole patterns on the underside.
 *   - 8 Symmetric Perimeter Coax Pods: each pod contains a dense 3D array (3x7 = 21 lines per stage)
 *     of dark gunmetal/bronze semi-rigid coaxial cables bent in a uniform S-wave between gold manifold
 *     blocks, topped by bright yellow-gold SMA attenuator rows above the bottom mixing chamber plate.
 *   - 8 Vertical Banks of Two-Tone Silver & Amber-Gold Cylindrical Filter/Attenuator Barrels hanging
 *     directly beneath the bottom gold plate.
 *   - 160+ Bright Silver-White Flexible Coaxial Cables (with black heat-shrink marker bands) pouring
 *     downward from the 8 barrel banks in sweeping catenary U-loops into the central QPU core.
 *   - Distortion-free 3D T-Slot Gantry Frame anchored to a soft-feathered lab floor pad at y = 0.
 */

class GoogleQuantumComputer {
    constructor(scene) {
        this.scene = scene;
        this.root = new THREE.Group();
        this.root.name = 'GoogleQuantumAICryostatRoot';

        // Scale and vertical offset so the T-slot gantry frame sits at y = 0.0
        // and the chandelier hangs from y = 2.40m down to y = 0.25m in the center of the lab.
        this.S = 0.36;
        this.Y0 = 0.09;

        this.namedMeshes = {};
        this.modeGroups = {
            hull: [],
            plates: [],
            electronic_circuit: [],
            room_temp_control: [],
            helium_system: [],
            frame: [],
            single: []
        };

        this.initMaterials();
        this.buildAllNodes();

        this.scene.add(this.root);
    }

    pos(x, y, z) {
        return new THREE.Vector3(x * this.S, this.Y0 + y * this.S, z * this.S);
    }

    len(v) {
        return v * this.S;
    }

    /**
     * Initializes physically based materials driven by the 360° Radiance .HDR lab environment
     * (without distorting reflection normal overrides).
     */
    initMaterials() {
        const brushedBump = this.createRadialAnisotropicBumpTexture();
        const tappedPlateBump = this.createTappedHoleGridBumpTexture();
        const tslotTex = this.createExtrudedTSlotTexture();

        this.mats = {
            // 1. Polished Gold-Plated OFHC Copper (Lower 4 stage plates in sci_news_14467)
            goldPlate: new THREE.MeshStandardMaterial({
                name: 'GoldPlatedCopperStage',
                color: new THREE.Color(0xf6be3a),
                metalness: 0.95,
                roughness: 0.16,
                bumpMap: tappedPlateBump,
                bumpScale: 0.0022,
                envMapIntensity: 1.45
            }),

            // 2. Brushed Silver Aluminum / Stainless Stage Plates (Upper 2 plates in sci_news_14467)
            brushedSilverPlate: new THREE.MeshStandardMaterial({
                name: 'BrushedSilverCryoStage',
                color: new THREE.Color(0xd8dee6),
                metalness: 0.91,
                roughness: 0.23,
                bumpMap: brushedBump,
                bumpScale: 0.0018,
                envMapIntensity: 1.38
            }),

            // 3. Bright Yellow-Gold SMA Attenuator & Manifold Blocks (seen above & below bottom plate)
            amberGoldBarrel: new THREE.MeshStandardMaterial({
                name: 'AmberGoldSMABarrel',
                color: new THREE.Color(0xf59e0b),
                metalness: 0.94,
                roughness: 0.15,
                envMapIntensity: 1.50
            }),

            brightYellowGoldSMA: new THREE.MeshStandardMaterial({
                name: 'BrightYellowGoldSMA',
                color: new THREE.Color(0xfacc15),
                metalness: 0.92,
                roughness: 0.18,
                envMapIntensity: 1.45
            }),

            // 4. Dark Gunmetal / Bronze Semi-Rigid S-Wave Coax Bundles (middle stages in sci_news_14467)
            darkGunmetalCoax: new THREE.MeshStandardMaterial({
                name: 'DarkGunmetalBronzeCoax',
                color: new THREE.Color(0x4a3f37),
                metalness: 0.84,
                roughness: 0.28,
                envMapIntensity: 1.30
            }),

            // 5. Upper Silver-Steel Semi-Rigid Coax Bundles (top two silver stages in sci_news_14467)
            upperSilverCoax: new THREE.MeshStandardMaterial({
                name: 'UpperSilverSteelCoax',
                color: new THREE.Color(0x9ca3af),
                metalness: 0.88,
                roughness: 0.26,
                envMapIntensity: 1.32
            }),

            // 6. Bright Silver-White Flexible Lower Coax Cables (sweeping catenary loops at bottom)
            silverWhiteFlexCoax: new THREE.MeshStandardMaterial({
                name: 'SilverWhiteFlexCoax',
                color: new THREE.Color(0xeef2f6),
                metalness: 0.72,
                roughness: 0.22,
                envMapIntensity: 1.38
            }),

            // 7. Black Heat-Shrink Marker Bands & Velcro Straps on Coax Loops
            blackMarkerBand: new THREE.MeshStandardMaterial({
                name: 'BlackHeatShrinkBand',
                color: new THREE.Color(0x18181b),
                metalness: 0.15,
                roughness: 0.65
            }),

            // 8. Brushed Stainless Steel (Top flange, support rods, dilution column, upper barrel halves)
            stainlessSteel: new THREE.MeshStandardMaterial({
                name: 'BrushedStainlessSteel',
                color: new THREE.Color(0xcbd5e1),
                metalness: 0.90,
                roughness: 0.24,
                envMapIntensity: 1.35
            }),

            polishedSteel: new THREE.MeshStandardMaterial({
                name: 'PolishedStainlessSteel',
                color: new THREE.Color(0xe2e8f0),
                metalness: 0.95,
                roughness: 0.14,
                envMapIntensity: 1.42
            }),

            // 9. Helical Cupronickel / Copper Cooling Coils & Step Exchangers
            copperCoax: new THREE.MeshStandardMaterial({
                name: 'CopperHelicalCoil',
                color: new THREE.Color(0xd97736),
                metalness: 0.91,
                roughness: 0.20,
                envMapIntensity: 1.38
            }),

            // 10. Extruded Aluminum 80/20 / Bosch-Rexroth T-Slot Gantry Frame
            tslotAluminum: new THREE.MeshStandardMaterial({
                name: 'ExtrudedAluminumTSlot',
                color: new THREE.Color(0xdbe2ea),
                map: tslotTex,
                bumpMap: tslotTex,
                bumpScale: 0.004,
                metalness: 0.85,
                roughness: 0.25,
                envMapIntensity: 1.35
            }),

            ceilingDeckPanel: new THREE.MeshStandardMaterial({
                name: 'GantryCeilingDeckPanel',
                color: new THREE.Color(0xe2e8f0),
                metalness: 0.35,
                roughness: 0.42,
                envMapIntensity: 0.95
            }),

            anodizedBlackMount: new THREE.MeshStandardMaterial({
                name: 'AnodizedBlackFrameMount',
                color: new THREE.Color(0x1e242d),
                metalness: 0.72,
                roughness: 0.34,
                envMapIntensity: 1.15
            }),

            // 11. White PTFE (Teflon) Dielectric Core for Open Coax Cutaway
            ptfeWhite: new THREE.MeshStandardMaterial({
                name: 'PTFEDielectric',
                color: new THREE.Color(0xf8fafc),
                metalness: 0.05,
                roughness: 0.35
            }),

            // 12. Silicon QPU Interposer & Flip-Chip Qubit Die (matching Google_Willow_Quantum_Chip.jpg & Google_Sycamore_Chip_001.png)
            siliconInterposer: new THREE.MeshStandardMaterial({
                name: 'WillowSiliconInterposer',
                color: new THREE.Color(0xffffff),
                metalness: 0.90,
                roughness: 0.12,
                map: this.createWillowInterposerTexture(),
                envMapIntensity: 1.55
            }),

            siliconQpu: new THREE.MeshStandardMaterial({
                name: 'WillowFlipChipQubitDie',
                color: new THREE.Color(0xffffff),
                metalness: 0.82,
                roughness: 0.16,
                map: this.createWillowQpuDieTexture(),
                envMapIntensity: 1.45
            }),

            // 13. Outer Artistic Vacuum Hull
            artisticHull: new THREE.MeshStandardMaterial({
                name: 'GoogleQuantumArtisticHull',
                color: new THREE.Color(0xffffff),
                metalness: 0.30,
                roughness: 0.28,
                map: this.createArtisticHullTexture(),
                envMapIntensity: 1.05
            }),

            // 14. Room-Temperature Color-Coded Coaxial Cable Looms (matching right side of sci_news_14467_quantum_computer.jpg)
            rtCoaxGreen: new THREE.MeshStandardMaterial({
                name: 'RoomTempGreenCoaxLoom',
                color: new THREE.Color(0x10b981),
                metalness: 0.25,
                roughness: 0.32,
                envMapIntensity: 1.15
            }),

            rtCoaxBlue: new THREE.MeshStandardMaterial({
                name: 'RoomTempBlueCoaxLoom',
                color: new THREE.Color(0x2563eb),
                metalness: 0.28,
                roughness: 0.30,
                envMapIntensity: 1.15
            }),

            rtCoaxYellow: new THREE.MeshStandardMaterial({
                name: 'RoomTempYellowCoaxLoom',
                color: new THREE.Color(0xf59e0b),
                metalness: 0.26,
                roughness: 0.32,
                envMapIntensity: 1.15
            }),

            rtCoaxWhite: new THREE.MeshStandardMaterial({
                name: 'RoomTempWhiteCoaxLoom',
                color: new THREE.Color(0xf1f5f9),
                metalness: 0.35,
                roughness: 0.28,
                envMapIntensity: 1.20
            }),

            // 15. Room-Temperature Control Electronics Rack & Subrack Crates (matching sci_news_14467 & Google_Quantum_AI_Cryostat)
            rackCabinetSteel: new THREE.MeshStandardMaterial({
                name: 'ControlRackCabinetSteel',
                color: new THREE.Color(0x151922),
                metalness: 0.68,
                roughness: 0.36,
                envMapIntensity: 1.10
            }),

            fpgaSubrackFaceplate: new THREE.MeshStandardMaterial({
                name: 'GoogleFpgaDacSubrackFaceplate',
                color: new THREE.Color(0xffffff),
                metalness: 0.52,
                roughness: 0.26,
                map: this.createGoogleControlSubrackTexture(),
                envMapIntensity: 1.22
            }),

            ejectorLatchWhite: new THREE.MeshStandardMaterial({
                name: 'SubrackCardEjectorLatch',
                color: new THREE.Color(0xf1f5f9),
                metalness: 0.20,
                roughness: 0.32,
                envMapIntensity: 1.05
            }),

            masterClockFaceplate: new THREE.MeshStandardMaterial({
                name: 'MasterClockSynthFaceplate',
                color: new THREE.Color(0xffffff),
                metalness: 0.48,
                roughness: 0.24,
                map: this.createMasterClockSynthTexture(),
                envMapIntensity: 1.20
            }),

            // 16. Pulse-Tube Rotary Valve Anodized Blue & Gas Handling System Panel
            pulseTubeBlue: new THREE.MeshStandardMaterial({
                name: 'CryomechRotaryValveBlue',
                color: new THREE.Color(0x0284c7),
                metalness: 0.78,
                roughness: 0.26,
                envMapIntensity: 1.28
            }),

            ghsControlFaceplate: new THREE.MeshStandardMaterial({
                name: 'BlueforsGasHandlingFaceplate',
                color: new THREE.Color(0xffffff),
                metalness: 0.45,
                roughness: 0.26,
                map: this.createGasHandlingPanelTexture(),
                envMapIntensity: 1.18
            })
        };
    }

    createRadialAnisotropicBumpTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 512, 512);

        const cx = 256;
        const cy = 256;
        for (let r = 8; r < 252; r += 2) {
            const v = 128 + Math.round(Math.sin(r * 0.65) * 16 + (Math.random() - 0.5) * 14);
            ctx.strokeStyle = `rgb(${v},${v},${v})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Generates the dense grid of tapped M3/M4 mounting holes visible on the underside of the
     * gold stage plates in sci_news_14467_quantum_computer.jpg
     */
    createTappedHoleGridBumpTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 512, 512);

        const cx = 256;
        const cy = 256;
        for (let r = 10; r < 250; r += 3) {
            ctx.strokeStyle = 'rgba(150,150,150,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Concentric rings of dark tapped bolt holes (clearly visible on bottom gold plate in sci_news_14467)
        for (let r = 36; r <= 220; r += 16) {
            const count = Math.floor((2 * Math.PI * r) / 16);
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2;
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                ctx.fillStyle = '#222222';
                ctx.beginPath();
                ctx.arc(x, y, 2.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Generates a 3-channel extruded aluminum T-slot profile texture matching the multi-track
     * aluminum beams in sci_news_14467_quantum_computer.jpg
     */
    createExtrudedTSlotTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#dce3ec';
        ctx.fillRect(0, 0, 256, 256);

        // Fine vertical brushed aluminum grain
        for (let x = 0; x < 256; x += 2) {
            const v = 212 + Math.round((Math.random() - 0.5) * 14);
            ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
            ctx.fillRect(x, 0, 2, 256);
        }

        // Three parallel recessed dark T-slot channels along the profile face (matching sci_news_14467)
        const slots = [48, 128, 208];
        slots.forEach(sx => {
            ctx.fillStyle = '#8b95a5';
            ctx.fillRect(sx - 13, 0, 26, 256);
            ctx.fillStyle = '#1e2530';
            ctx.fillRect(sx - 7, 0, 14, 256);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(sx - 15, 0, 2, 256);
            ctx.fillRect(sx + 13, 0, 2, 256);
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Generates the mirror-silver silicon interposer texture with hundreds of radial fan-out
     * superconducting microstrip traces, left/right iridescent blue-gold bond-pad diffraction strips,
     * and the "Google Quantum AI / Willow" markings matching Google_Willow_Quantum_Chip.jpg
     * and Google_Sycamore_Chip_001.png.
     */
    createWillowInterposerTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // 1. Bright mirror-silver silicon/aluminum base with subtle diagonal metallic gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
        bgGrad.addColorStop(0.0, '#e2e8f0');
        bgGrad.addColorStop(0.35, '#f8fafc');
        bgGrad.addColorStop(0.65, '#cbd5e1');
        bgGrad.addColorStop(1.0, '#e2e8f0');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1024, 1024);

        // 2. Iridescent blue-to-amber diffraction strips along the left and right bond-pad edges
        //    (Directly matching the signature blue/amber edge bands in Google_Willow_Quantum_Chip.jpg)
        [36, 940].forEach((edgeX, idx) => {
            const diffGrad = ctx.createLinearGradient(0, 60, 0, 964);
            if (idx === 0) {
                diffGrad.addColorStop(0.0, 'rgba(2, 132, 199, 0.85)');
                diffGrad.addColorStop(0.28, 'rgba(56, 189, 248, 0.55)');
                diffGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.48)');
                diffGrad.addColorStop(1.0, 'rgba(203, 213, 225, 0.15)');
            } else {
                diffGrad.addColorStop(0.0, 'rgba(203, 213, 225, 0.15)');
                diffGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.48)');
                diffGrad.addColorStop(0.72, 'rgba(56, 189, 248, 0.55)');
                diffGrad.addColorStop(1.0, 'rgba(2, 132, 199, 0.85)');
            }
            ctx.fillStyle = diffGrad;
            ctx.fillRect(edgeX, 48, 48, 928);
        });

        // 3. Radial fan-out superconducting microwave traces radiating from the central die (cx=512, cy=480)
        //    to the 4 perimeter edges (matching Google_Sycamore_Chip_001.png & Sycamore_Quantum_Chip.jpg)
        const cx = 512;
        const cy = 480;
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.62)';
        ctx.lineWidth = 1.6;

        const numTracesPerSide = 44;
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < numTracesPerSide; i++) {
                const t = (i + 0.5) / numTracesPerSide;
                const span = 820;
                const offset = 102 + t * span;
                let ex, ey;
                if (side === 0) { ex = offset; ey = 44; }
                else if (side === 1) { ex = 980; ey = offset; }
                else if (side === 2) { ex = offset; ey = 980; }
                else { ex = 44; ey = offset; }

                // Leave a clean lower-center label window for the "Google Quantum AI / Willow" engraving
                if (side === 2 && t > 0.34 && t < 0.66) continue;

                const sx = cx + (ex - cx) * 0.24;
                const sy = cy + (ey - cy) * 0.24;
                const mx = cx + (ex - cx) * 0.52;
                const my = cy + (ey - cy) * 0.46;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(mx, my);
                ctx.lineTo(ex, ey);
                ctx.stroke();

                // Gold/silver wirebond pad at outer edge
                ctx.fillStyle = '#64748b';
                ctx.fillRect(ex - 3, ey - 3, 6, 6);
            }
        }

        // 4. Warm golden halo around the central flip-chip die footprint (matching Google_Willow_Quantum_Chip.jpg)
        const haloGrad = ctx.createRadialGradient(cx, cy, 140, cx, cy, 310);
        haloGrad.addColorStop(0.0, 'rgba(245, 158, 11, 0.32)');
        haloGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.12)');
        haloGrad.addColorStop(1.0, 'rgba(245, 158, 11, 0.0)');
        ctx.fillStyle = haloGrad;
        ctx.fillRect(180, 150, 664, 664);

        // 5. Etched "Google Quantum AI" & "Willow" emblem below the central die
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('G  Quantum AI', cx, 790);
        ctx.font = '600 22px Inter, sans-serif';
        ctx.fillText('Willow  •  105 Qubits', cx, 875);

        // Outer metallic border
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 8;
        ctx.strokeRect(12, 12, 1000, 1000);

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
    }

    /**
     * Generates the texture for the raised central dark charcoal-black flip-chip qubit die
     * with its 105-qubit Xmon transmon lattice sheen and metallic beveled border.
     */
    createWillowQpuDieTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Deep polished charcoal-black silicon substrate
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0.0, '#181c24');
        grad.addColorStop(0.5, '#232936');
        grad.addColorStop(1.0, '#11141a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Silver/gold beveled silicon edge
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 496, 496);

        // Subtle microscopic Xmon transmon cross-qubit grid (10x10 lattice + tunable couplers)
        const gridN = 10;
        const start = 68;
        const step = (512 - start * 2) / (gridN - 1);
        for (let r = 0; r < gridN; r++) {
            for (let c = 0; c < gridN; c++) {
                const x = start + c * step;
                const y = start + r * step;

                // Subtle gold coupler traces
                ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
                ctx.lineWidth = 1.2;
                if (c < gridN - 1) {
                    ctx.beginPath();
                    ctx.moveTo(x + 10, y);
                    ctx.lineTo(x + step - 10, y);
                    ctx.stroke();
                }
                if (r < gridN - 1) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + 10);
                    ctx.lineTo(x, y + step - 10);
                    ctx.stroke();
                }

                // Cross-shaped Xmon capacitor
                ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(x - 8, y);
                ctx.lineTo(x + 8, y);
                ctx.moveTo(x, y - 8);
                ctx.lineTo(x, y + 8);
                ctx.stroke();
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
    }

    createArtisticHullTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, 2048, 1024);

        // Bold geometric origami/prism facets visible in the background of sci_news_14467 & Google_Quantum_AI_Cryostat
        const facets = [
            { pts: [[0, 120], [480, 120], [320, 520], [0, 480]], col: '#38bdf8' },
            { pts: [[480, 120], [960, 260], [640, 680], [320, 520]], col: '#f59e0b' },
            { pts: [[0, 480], [320, 520], [640, 680], [220, 920], [0, 920]], col: '#fbbf24' },
            { pts: [[960, 120], [1480, 180], [1280, 620], [960, 260]], col: '#1e293b' },
            { pts: [[640, 680], [960, 260], [1280, 620], [980, 920]], col: '#ef4444' },
            { pts: [[1480, 180], [2048, 120], [2048, 580], [1640, 720], [1280, 620]], col: '#0284c7' },
            { pts: [[1280, 620], [1640, 720], [2048, 580], [2048, 920], [1320, 920]], col: '#facc15' }
        ];
        facets.forEach(f => {
            ctx.fillStyle = f.col;
            ctx.beginPath();
            ctx.moveTo(f.pts[0][0], f.pts[0][1]);
            for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 5;
            ctx.stroke();
        });

        // Brushed stainless top and bottom flange bands
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 2048, 110);
        ctx.fillRect(0, 914, 2048, 110);

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        tex.wrapS = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Generates the front panel texture for a 6U Google Quantum AI Custom RF-DAC / FPGA / ADC
     * Subrack Crate (matching the blue-faced modular blades with white ejector latches and
     * dense vertical columns of gold SMA connectors visible on the right of sci_news_14467_quantum_computer.jpg).
     */
    createGoogleControlSubrackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Subrack metallic frame background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 1024, 512);

        // Top and bottom extruded aluminum subrack card-guide rails
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 1024, 28);
        ctx.fillRect(0, 484, 1024, 28);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px Inter, monospace';
        ctx.fillText('GOOGLE QUANTUM AI // 6U 14-SLOT RF-DAC & ULTRA-FAST FLUX CONTROL CRATE (ICE / SYCAMORE / WILLOW)', 24, 19);

        // 12 Modular Eurocard Plug-In Blades across the 19-inch subrack
        const nBlades = 12;
        const marginX = 24;
        const bladeW = (1024 - marginX * 2) / nBlades;

        for (let b = 0; b < nBlades; b++) {
            const bx = marginX + b * bladeW;

            // Royal-blue anodized/PCB blade faceplate (matching sci_news_14467)
            const grad = ctx.createLinearGradient(bx, 30, bx + bladeW - 4, 482);
            grad.addColorStop(0.0, '#1d4ed8');
            grad.addColorStop(0.5, '#1e40af');
            grad.addColorStop(1.0, '#172554');
            ctx.fillStyle = grad;
            ctx.fillRect(bx + 2, 30, bladeW - 4, 452);

            // Silver metallic blade bezel border
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx + 2, 30, bladeW - 4, 452);

            // Top & bottom white/silver card-ejector latch housings
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(bx + 6, 32, bladeW - 12, 26);
            ctx.fillRect(bx + 6, 454, bladeW - 12, 26);

            // Status LEDs (PLL Lock, FPGA Ready, Temp OK)
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(bx + 16, 74, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = b % 3 === 0 ? '#38bdf8' : '#f59e0b';
            ctx.beginPath();
            ctx.arc(bx + 30, 74, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Channel label
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 11px Inter, monospace';
            ctx.fillText(b < 8 ? `DAC-${b}` : `ADC-${b - 8}`, bx + 42, 78);

            // Two vertical columns of 8 gold SMA coaxial connectors per blade
            for (let row = 0; row < 8; row++) {
                const sy = 106 + row * 42;
                [bx + 24, bx + 56].forEach(sx => {
                    // Gold outer hex nut
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 11, 0, Math.PI * 2);
                    ctx.fill();
                    // Bright gold barrel
                    ctx.fillStyle = '#facc15';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
                    ctx.fill();
                    // PTFE insulator & center pin
                    ctx.fillStyle = '#f8fafc';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 4.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#b45309';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
    }

    /**
     * Generates the front panel texture for the Master Rubidium Clock, Local Oscillator (LO)
     * Microwave Synthesizer & Trigger Distribution Unit at the top of the Control Rack.
     */
    createMasterClockSynthTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 1024, 256);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 1016, 248);

        // Glowing OLED Spectrum & Phase-Noise Display Screen
        ctx.fillStyle = '#020617';
        ctx.fillRect(36, 32, 420, 192);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(36, 32, 420, 192);

        // Grid lines inside display
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 1;
        for (let gx = 76; gx < 456; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 32); ctx.lineTo(gx, 224); ctx.stroke();
        }
        for (let gy = 64; gy < 224; gy += 32) {
            ctx.beginPath(); ctx.moveTo(36, gy); ctx.lineTo(456, gy); ctx.stroke();
        }

        // Synthesized Qubit Drive & Readout Microwave Carrier Peaks
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 44; x < 448; x += 2) {
            const normX = (x - 44) / 404;
            const p1 = Math.exp(-Math.pow((normX - 0.25) / 0.03, 2)) * 95;
            const p2 = Math.exp(-Math.pow((normX - 0.52) / 0.025, 2)) * 112;
            const p3 = Math.exp(-Math.pow((normX - 0.78) / 0.03, 2)) * 84;
            const y = 198 - (p1 + p2 + p3 + Math.sin(x * 0.4) * 3);
            if (x === 44) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 15px Inter, monospace';
        ctx.fillText('10 MHz Rb CLOCK LOCKED // LO: 4.50 - 7.85 GHz', 52, 58);
        ctx.fillStyle = '#22c55e';
        ctx.font = '13px Inter, monospace';
        ctx.fillText('PHASE JITTER < 18 fs RMS  |  105 QUBITS SYNCED', 52, 80);

        // Right-side SMA Reference Outputs & Status Indicators
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText('GOOGLE QUANTUM AI — MASTER LO & TIMING DISTRIBUTION', 490, 58);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Inter, monospace';
        ctx.fillText(' ULTRA-LOW PHASE NOISE PUMP & CLOCK SYNTHESIZER', 490, 84);

        for (let i = 0; i < 10; i++) {
            const cx = 515 + i * 48;
            const cy = 162;
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(cx, cy - 32, 4.5, 0, Math.PI * 2); ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
    }

    /**
     * Generates the top-header OLED digital telemetry banner texture for the +Z front beam
     * of the 3D open-frame Bluefors ³He/⁴He Gas Handling & Cryo-Compressor Skid.
     * (All pressure gauges, valves, tanks, and heat exchangers are modeled as true 3D geometry.)
     */
    createGasHandlingPanelTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Anodized dark-slate instrument header bezel
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 1024, 256);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, 1000, 232);

        // Title bar
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText('BLUEFORS // ³He-⁴He GAS HANDLING & PULSE-TUBE COMPRESSOR SKID', 36, 58);

        // Digital OLED readout cards
        const cards = [
            { label: 'MXC BASE TEMP', val: '9.8 mK', col: '#38bdf8' },
            { label: '³He CIRCULATION', val: '485 µmol/s', col: '#22c55e' },
            { label: 'TURBO PUMP', val: '90,000 RPM', col: '#a855f7' },
            { label: 'HELIUM SUPPLY', val: '224 PSI', col: '#f59e0b' }
        ];
        cards.forEach((c, idx) => {
            const cx = 36 + idx * 242;
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx, 84, 224, 136);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx, 84, 224, 136);

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px Inter, monospace';
            ctx.fillText(c.label, cx + 18, 124);

            ctx.fillStyle = c.col;
            ctx.font = 'bold 30px Inter, monospace';
            ctx.fillText(c.val, cx + 18, 182);
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
    }

    registerNode(name, object3D, modeName, seqIndex = null) {
        object3D.name = name;
        object3D.traverse(child => {
            if (child.isMesh) {
                child.userData.meshName = name;
                child.userData.modeName = modeName;
                child.userData.seqIndex = seqIndex;
                child.userData.baseMaterial = child.material;
            }
        });
        this.namedMeshes[name] = object3D;
        if (this.modeGroups[modeName]) {
            this.modeGroups[modeName].push(object3D);
        }
        this.root.add(object3D);
        return object3D;
    }

    buildAllNodes() {
        // Stage vertical heights (in reference coordinates, scaled by S = 0.36, Y0 = 0.09):
        // Matching sci_news_14467_quantum_computer.jpg, Dilution_Fridge_009_8K.png & Google_Quantum_AI_Cryostat.jpg:
        //   - Top Hermetic Breakout Manifolds & Pulse Tubes: y_ref = 6.25..7.15 (y = 2.34m..2.66m)
        //   - Top Recessed Stainless Vacuum Flange (plaque): y_ref = 6.18 (y = 2.315m)
        //   - Plate 0 (Upper Brushed Silver 50K Stage):      y_ref = 5.52 (y = 2.077m)
        //   - Plate 1 (Second Brushed Silver 4K Stage):      y_ref = 4.86 (y = 1.840m)
        //   - Plate 2 (First Polished Gold 800mK Stage):     y_ref = 4.16 (y = 1.588m)
        //   - Plate 3 (Second Polished Gold 300mK Stage):    y_ref = 3.46 (y = 1.336m)
        //   - Plate 4a (Third Polished Gold 90mK Stage):     y_ref = 2.76 (y = 1.084m)
        //   - Plate 4b (Bottom Polished Gold 10mK Stage):    y_ref = 2.06 (y = 0.832m)
        //   - 8 Silver/Gold Vertical Filter Barrel Banks:    y_ref = 1.52..2.04
        //   - Sweeping Silver-White Catenary Coax Loops:     y_ref = 0.45..1.52

        this.buildExtrudedAluminumGantryFrame();
        this.buildFloorAnchoringAndReflectionCatcher();
        this.buildOuterVacuumHull();
        this.buildCryostatStagePlates();
        this.buildSupportRodsAndGoldCollars();
        this.buildHeliumDilutionSystem();
        this.buildEightPodCoaxAndReadoutArchitecture();
        this.buildTopStainlessFlangeAndPlaque();
        this.buildRoomTempBreakoutWiringAndControlRacks();
    }

    /**
     * 1. Builds the Extended 3D Extruded Aluminum T-Slot Gantry Frame, Overhead Cable Bridges
     *    & Equipment Bay Outriggers matching sci_news_14467_quantum_computer.jpg and Google_Quantum_AI_Cryostat.jpg.
     */
    buildExtrudedAluminumGantryFrame() {
        const frameGroup = new THREE.Group();

        const halfW = 0.86;     // Central cryostat bay: 1.72m x 1.72m footprint
        const extX = 1.76;      // Extended equipment bays on +X (Control Rack) and -X (Gas Handling)
        const extZ = 0.52;      // Z half-width of the extended overhead cable bridge & outriggers
        const frameH = 2.40;    // Top of gantry frame
        const beamThick = 0.082;
        const deckY = this.Y0 + this.len(6.22); // Ceiling deck height (~2.33m) matching top flange

        const corners = [
            [-halfW, -halfW],
            [ halfW, -halfW],
            [-halfW,  halfW],
            [ halfW,  halfW]
        ];

        // 1A. Four Main Vertical T-Slot Corner Columns
        const postGeo = new THREE.BoxGeometry(beamThick, frameH, beamThick);
        corners.forEach(([cx, cz]) => {
            const post = new THREE.Mesh(postGeo, this.mats.tslotAluminum);
            post.position.set(cx, frameH * 0.5, cz);
            frameGroup.add(post);

            // Black anodized floor leveling mount pad at y = 0
            const footBlock = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 1.5, 0.048, beamThick * 1.5),
                this.mats.anodizedBlackMount
            );
            footBlock.position.set(cx, 0.024, cz);
            frameGroup.add(footBlock);

            // Black rectangular hinge / clamp block on vertical post (visible on left column in sci_news_14467)
            const hingeBlock = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 1.18, 0.11, beamThick * 0.65),
                this.mats.anodizedBlackMount
            );
            hingeBlock.position.set(cx, 0.78, cz);
            frameGroup.add(hingeBlock);
        });

        // 1B. Upper Multi-Slot Horizontal T-Slot Perimeter Frame & Ceiling Deck (top of sci_news_14467)
        const spanLen = halfW * 2 + beamThick;
        [-halfW, halfW].forEach(zPos => {
            const topBeamX = new THREE.Mesh(
                new THREE.BoxGeometry(spanLen, beamThick * 1.25, beamThick),
                this.mats.tslotAluminum
            );
            topBeamX.position.set(0, deckY, zPos);
            frameGroup.add(topBeamX);
        });
        [-halfW, halfW].forEach(xPos => {
            const topBeamZ = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick, beamThick * 1.25, spanLen),
                this.mats.tslotAluminum
            );
            topBeamZ.position.set(xPos, deckY, 0);
            frameGroup.add(topBeamZ);
        });

        // Twin inner T-slot frame beams framing the circular stainless top vacuum flange
        const innerSpan = halfW * 2 - beamThick;
        [-0.54, 0.54].forEach(offset => {
            const innerBeamX = new THREE.Mesh(
                new THREE.BoxGeometry(innerSpan, beamThick * 1.1, beamThick * 0.9),
                this.mats.tslotAluminum
            );
            innerBeamX.position.set(0, deckY, offset);
            frameGroup.add(innerBeamX);

            const innerBeamZ = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 0.9, beamThick * 1.1, innerSpan),
                this.mats.tslotAluminum
            );
            innerBeamZ.position.set(offset, deckY, 0);
            frameGroup.add(innerBeamZ);
        });

        // Recessed white/silver ceiling deck panels around the central cryostat opening
        [-0.70, 0.70].forEach(pos => {
            const deckStripX = new THREE.Mesh(
                new THREE.BoxGeometry(innerSpan, 0.018, 0.24),
                this.mats.ceilingDeckPanel
            );
            deckStripX.position.set(0, deckY - 0.02, pos);
            frameGroup.add(deckStripX);

            const deckStripZ = new THREE.Mesh(
                new THREE.BoxGeometry(0.24, 0.018, innerSpan),
                this.mats.ceilingDeckPanel
            );
            deckStripZ.position.set(pos, deckY - 0.02, 0);
            frameGroup.add(deckStripZ);
        });

        // 1C. Mid-Upper Side Horizontal T-Slot Crossbar & 45-Degree Mitered Corner Braces
        const upAxis = new THREE.Vector3(0, 1, 0);
        const strutThick = beamThick * 0.72;
        const cornerY = deckY - beamThick * 0.55;
        const legDist = 0.24;

        const addConnectedStrut = (pA, pB) => {
            const vec = new THREE.Vector3().subVectors(pB, pA);
            const len = vec.length();
            const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
            const strut = new THREE.Mesh(
                new THREE.BoxGeometry(strutThick, len, strutThick),
                this.mats.tslotAluminum
            );
            strut.position.copy(mid);
            strut.quaternion.setFromUnitVectors(upAxis, vec.clone().normalize());
            frameGroup.add(strut);

            [pA, pB].forEach(pt => {
                const bracket = new THREE.Mesh(
                    new THREE.BoxGeometry(beamThick * 0.88, 0.032, beamThick * 0.88),
                    this.mats.anodizedBlackMount
                );
                bracket.position.copy(pt);
                frameGroup.add(bracket);
            });
        };

        corners.forEach(([cx, cz]) => {
            const signX = cx > 0 ? -1 : 1;
            const signZ = cz > 0 ? -1 : 1;
            const innerX = cx + signX * (beamThick * 0.25);
            const innerZ = cz + signZ * (beamThick * 0.25);

            addConnectedStrut(
                new THREE.Vector3(innerX, cornerY - legDist, cz),
                new THREE.Vector3(innerX + signX * legDist, cornerY, cz)
            );
            addConnectedStrut(
                new THREE.Vector3(cx, cornerY - legDist, innerZ),
                new THREE.Vector3(cx, cornerY, innerZ + signZ * legDist)
            );
        });

        // 1D. Lower Perimeter T-Slot Stabilizer Rails at y = 0.08m
        const lowY = 0.08;
        [-halfW, halfW].forEach(xPos => {
            const lowRailZ = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 0.85, beamThick * 0.85, innerSpan),
                this.mats.tslotAluminum
            );
            lowRailZ.position.set(xPos, lowY, 0);
            frameGroup.add(lowRailZ);
        });
        [-halfW, halfW].forEach(zPos => {
            const lowRailX = new THREE.Mesh(
                new THREE.BoxGeometry(innerSpan, beamThick * 0.85, beamThick * 0.85),
                this.mats.tslotAluminum
            );
            lowRailX.position.set(0, lowY, zPos);
            frameGroup.add(lowRailX);
        });

        // 1E. EXTENDED T-SLOT GANTRY WINGS & OVERHEAD CABLE TRAY BRIDGES (+X Control Bay & -X Gas Handling Bay)
        //     Directly modeled after the extended T-slot gantry bays in Google_Quantum_AI_Cryostat.jpg
        const bridgeSpanX = extX - halfW;
        const bridgeMidX = (extX + halfW) * 0.5;

        [-1, 1].forEach(sideSign => {
            const outX = sideSign * extX;
            const midX = sideSign * bridgeMidX;

            // Two outer vertical T-slot outrigger columns at (±1.76m, 0..2.40m, ±0.52m)
            [-extZ, extZ].forEach(oz => {
                const outPost = new THREE.Mesh(postGeo, this.mats.tslotAluminum);
                outPost.position.set(outX, frameH * 0.5, oz);
                frameGroup.add(outPost);

                // Floor leveling foot at y = 0
                const outFoot = new THREE.Mesh(
                    new THREE.BoxGeometry(beamThick * 1.45, 0.048, beamThick * 1.45),
                    this.mats.anodizedBlackMount
                );
                outFoot.position.set(outX, 0.024, oz);
                frameGroup.add(outFoot);

                // Overhead horizontal T-slot bridge beam connecting central gantry (±0.86) to outer post (±1.76)
                const bridgeBeam = new THREE.Mesh(
                    new THREE.BoxGeometry(bridgeSpanX + beamThick, beamThick * 1.15, beamThick * 0.92),
                    this.mats.tslotAluminum
                );
                bridgeBeam.position.set(midX, deckY, oz);
                frameGroup.add(bridgeBeam);

                // Lower floor stabilizer rail connecting central gantry to outer post at y = 0.08m
                const lowOutRail = new THREE.Mesh(
                    new THREE.BoxGeometry(bridgeSpanX, beamThick * 0.78, beamThick * 0.78),
                    this.mats.tslotAluminum
                );
                lowOutRail.position.set(midX, lowY, oz);
                frameGroup.add(lowOutRail);

                // 45° mitered corner brace at outer post top
                addConnectedStrut(
                    new THREE.Vector3(outX - sideSign * 0.02, cornerY - 0.22, oz),
                    new THREE.Vector3(outX - sideSign * 0.24, cornerY, oz)
                );
            });

            // Outer top & bottom Z crossbeams tying the two outrigger posts together
            const outTopCross = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 0.95, beamThick * 1.15, extZ * 2 + beamThick),
                this.mats.tslotAluminum
            );
            outTopCross.position.set(outX, deckY, 0);
            frameGroup.add(outTopCross);

            const outLowCross = new THREE.Mesh(
                new THREE.BoxGeometry(beamThick * 0.78, beamThick * 0.78, extZ * 2),
                this.mats.tslotAluminum
            );
            outLowCross.position.set(outX, lowY, 0);
            frameGroup.add(outLowCross);

            // Overhead Perforated Aluminum Cable Ladder Tray (y = deckY + 0.09m) carrying the wiring/pipes
            // from the top of the cryostat out to the +X Control Rack and -X Gas Handling System
            const trayY = deckY + 0.095;
            const trayStart = sideSign * 0.38;
            const trayEnd = sideSign * 1.56;
            const trayLen = Math.abs(trayEnd - trayStart);
            const trayCenter = (trayStart + trayEnd) * 0.5;
            const trayHalfW = 0.28;

            [-trayHalfW, trayHalfW].forEach(tz => {
                const traySideRail = new THREE.Mesh(
                    new THREE.BoxGeometry(trayLen, 0.036, 0.018),
                    this.mats.polishedSteel
                );
                traySideRail.position.set(trayCenter, trayY, tz);
                frameGroup.add(traySideRail);
            });

            // Ladder cross-rungs every 12cm along the overhead cable tray
            const nRungs = 10;
            for (let r = 0; r <= nRungs; r++) {
                const rx = trayStart + (r / nRungs) * (trayEnd - trayStart);
                const rung = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.014, trayHalfW * 2),
                    this.mats.stainlessSteel
                );
                rung.position.set(rx, trayY - 0.01, 0);
                frameGroup.add(rung);
            }
        });

        this.registerNode('gantry_frame', frameGroup, 'frame', 27);
    }

    /**
     * 2. Builds a Distortion-Free 3D Anti-Vibration Lab Floor Pad, Multi-Rack Contact AO &
     *    Floor Specular Reflection Catcher at y = 0 (following FRAME_AND_ANCHORING_GUIDE.md)
     *    that grounds the central gantry, outrigger posts, +X Control Electronics Rack, and
     *    -X Gas Handling Cabinet onto the y = 0 ground-projected floor.
     */
    buildFloorAnchoringAndReflectionCatcher() {
        const anchorGroup = new THREE.Group();
        anchorGroup.name = 'FloorAnchoringCatcher';

        // Expanded 5.4m x 4.2m floor shader plane at y = 0.001 covering the entire extended system
        const padGeo = new THREE.PlaneGeometry(5.4, 4.2);
        padGeo.rotateX(-Math.PI / 2);

        const padMat = new THREE.ShaderMaterial({
            name: 'DistortionFreeFloorAnchorShader',
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            uniforms: {
                uFootHalfW: { value: 0.86 }
            },
            vertexShader: `
                varying vec3 vWorldPos;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: `
                uniform float uFootHalfW;
                varying vec3 vWorldPos;

                float sdSegment(vec2 p, vec2 a, vec2 b) {
                    vec2 pa = p - a, ba = b - a;
                    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                    return length(pa - ba * h);
                }

                float sdBox(vec2 p, vec2 b) {
                    vec2 d = abs(p) - b;
                    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
                }

                void main() {
                    vec2 p = vWorldPos.xz;
                    vec2 ap = abs(p);
                    float r = length(p);
                    float hw = uFootHalfW;

                    // 1. Contact AO under the 4 central T-slot columns (±0.86, ±0.86) and 4 outrigger columns (±1.76, ±0.52)
                    float dFoot = min(
                        length(ap - vec2(hw, hw)),
                        length(ap - vec2(1.76, 0.52))
                    );
                    float aoFoot = exp(- (dFoot * dFoot) / (2.0 * 0.12 * 0.12)) * 0.66;

                    // 2. Contact AO along the lower T-slot perimeter & outrigger stabilizer rails
                    float dRail = min(
                        min(sdSegment(ap, vec2(hw, 0.0), vec2(hw, hw)),
                            sdSegment(ap, vec2(0.0, hw), vec2(hw, hw))),
                        min(sdSegment(ap, vec2(hw, 0.52), vec2(1.76, 0.52)),
                            sdSegment(ap, vec2(1.76, 0.0), vec2(1.76, 0.52)))
                    );
                    float aoRail = exp(- (dRail * dRail) / (2.0 * 0.085 * 0.085)) * 0.34;

                    // 3. Contact AO under the +X Control Electronics Rack (1.42, 0) & -X Gas Handling Cabinet (-1.42, 0)
                    float dRack = max(0.0, sdBox(vec2(ap.x - 1.42, p.y), vec2(0.30, 0.42)));
                    float aoRack = exp(- (dRack * dRack) / (2.0 * 0.11 * 0.11)) * 0.68;

                    // 4. Soft central chandelier occlusion shadow
                    float aoCenter = exp(- (r * r) / (2.0 * 0.52 * 0.52)) * 0.40;

                    // 5. Subtle Floor Specular Reflection Bounce (Anchor 4 of FRAME_AND_ANCHORING_GUIDE.md):
                    //    Warm golden bounce under the chandelier + cyan/blue instrument glow in front of the racks
                    float goldGlow = exp(- (r * r) / (2.0 * 0.38 * 0.38)) * 0.14;
                    float rackGlow = exp(- (dRack * dRack) / (2.0 * 0.26 * 0.26)) * 0.10;

                    // Smooth outer feather across the 5.4m x 4.2m footprint
                    float edgeFade = (1.0 - smoothstep(1.95, 2.55, abs(p.x))) *
                                     (1.0 - smoothstep(1.35, 1.95, abs(p.y)));

                    float shadowAlpha = clamp((aoFoot + aoRail + aoRack + aoCenter) * edgeFade, 0.0, 0.74);
                    vec3 tint = mix(
                        vec3(0.04, 0.06, 0.09),
                        vec3(0.75, 0.56, 0.18),
                        clamp(goldGlow / (shadowAlpha + 0.05), 0.0, 0.35)
                    );
                    tint = mix(tint, vec3(0.08, 0.42, 0.68), clamp(rackGlow / (shadowAlpha + 0.05), 0.0, 0.25));

                    gl_FragColor = vec4(tint, shadowAlpha);
                }
            `
        });

        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.position.y = 0.001;
        padMesh.userData.isContactAo = true;
        anchorGroup.add(padMesh);

        this.root.add(anchorGroup);
    }

    /**
     * 3. Outer Artistic Vacuum Hull (toggleable via 'Hull (Art Shield)')
     */
    buildOuterVacuumHull() {
        const hullGroup = new THREE.Group();
        const r = this.len(1.42);
        const yTop = this.Y0 + this.len(6.10);
        const yBot = this.Y0 + this.len(0.28);
        const h = yTop - yBot;

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(r, r * 0.97, h, 64, 1, false),
            this.mats.artisticHull
        );
        body.position.set(0, (yTop + yBot) * 0.5, 0);
        hullGroup.add(body);

        const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.97, r * 0.88, this.len(0.18), 64),
            this.mats.stainlessSteel
        );
        cap.position.set(0, yBot - this.len(0.08), 0);
        hullGroup.add(cap);

        hullGroup.visible = false;
        this.registerNode('hull', hullGroup, 'hull', 1);
    }

    /**
     * 4. Builds the 6 Cryogenic Stage Plates matching sci_news_14467_quantum_computer.jpg:
     *    - Top 2 Brushed Silver Aluminum/Stainless Stage Plates (plate_0 at 50K, plate_1 at 4K)
     *      with 8 large oval/circular perimeter cutouts.
     *    - Lower 4 Polished Gold-Plated Copper Stage Plates (plate_2 at 800mK, plate_3 at 300mK,
     *      plate_4 upper at 90mK, and plate_4 lower at 10mK Mixing Chamber).
     */
    buildCryostatStagePlates() {
        this.stageSpecs = [
            { name: 'plate_0', y: 5.52, r: 1.24, thick: 0.075, isSilver: true,  label: '~50K (-223°C)' },
            { name: 'plate_1', y: 4.86, r: 1.20, thick: 0.075, isSilver: true,  label: '~4K (-269°C)' },
            { name: 'plate_2', y: 4.16, r: 1.15, thick: 0.075, isSilver: false, label: '~800mK (-272.35°C)' },
            { name: 'plate_3', y: 3.46, r: 1.12, thick: 0.075, isSilver: false, label: '300mK (-272.85°C)' },
            { name: 'plate_4', y: 2.76, r: 1.10, thick: 0.075, isSilver: false, label: '90mK (-273.06°C)' },
            { name: 'plate_4_mc', y: 2.06, r: 1.08, thick: 0.080, isSilver: false, label: '10mK (-273.14°C)' }
        ];

        const podAngles = [];
        for (let k = 0; k < 8; k++) {
            podAngles.push((k / 8) * Math.PI * 2 + Math.PI / 8);
        }
        this.podAngles = podAngles;

        let plate4Group = null;

        this.stageSpecs.forEach((spec) => {
            const pGroup = new THREE.Group();
            const r = this.len(spec.r);
            const h = this.len(spec.thick);
            const yPos = this.Y0 + this.len(spec.y);
            const plateMat = spec.isSilver ? this.mats.brushedSilverPlate : this.mats.goldPlate;

            // Main machined stage disk
            const disk = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, h, 72),
                plateMat
            );
            disk.position.set(0, yPos, 0);
            pGroup.add(disk);

            // Chamfered outer lip ring (seen clearly on all 6 plates in sci_news_14467)
            const rimRing = new THREE.Mesh(
                new THREE.TorusGeometry(r, h * 0.42, 12, 72),
                plateMat
            );
            rimRing.rotation.x = Math.PI / 2;
            rimRing.position.set(0, yPos, 0);
            pGroup.add(rimRing);

            // 8 Circular/Oval Perimeter Cutout Frames & Gold Multi-Pin Feedthrough Blocks
            const podR = r * 0.72;
            podAngles.forEach(ang => {
                const px = Math.cos(ang) * podR;
                const pz = Math.sin(ang) * podR;

                // Dark recessed cutout pocket in the plate where the coax pod passes through
                const cutoutWell = new THREE.Mesh(
                    new THREE.CylinderGeometry(this.len(0.22), this.len(0.22), h * 1.06, 24),
                    this.mats.anodizedBlackMount
                );
                cutoutWell.position.set(px, yPos, pz);
                pGroup.add(cutoutWell);

                // Rectangular/oval gold multi-coax manifold block bolted inside the cutout
                // (In sci_news_14467, even the top 2 silver plates have bright gold rectangular coax blocks inside their 8 cutouts!)
                const block = new THREE.Mesh(
                    new THREE.BoxGeometry(this.len(0.32), h * 1.45, this.len(0.18)),
                    this.mats.goldPlate
                );
                block.position.set(px, yPos, pz);
                block.rotation.y = -ang + Math.PI / 2;
                pGroup.add(block);
            });

            // Perimeter M4 socket-head bolt ring
            const boltCount = 32;
            const boltGeo = new THREE.CylinderGeometry(this.len(0.011), this.len(0.011), h * 1.25, 8);
            for (let i = 0; i < boltCount; i++) {
                const a = (i / boltCount) * Math.PI * 2;
                const bMesh = new THREE.Mesh(boltGeo, this.mats.polishedSteel);
                bMesh.position.set(Math.cos(a) * (r * 0.94), yPos, Math.sin(a) * (r * 0.94));
                pGroup.add(bMesh);
            }

            if (spec.name === 'plate_4') {
                plate4Group = pGroup;
                this.registerNode('plate_4', pGroup, 'plates', 2);
            } else if (spec.name === 'plate_4_mc') {
                // Attach the 10mK bottom mixing chamber gold plate into plate_4 so all 38 node names remain intact
                plate4Group.add(pGroup);
            } else {
                this.registerNode(spec.name, pGroup, 'plates', 2);
            }
        });
    }

    /**
     * 5. Builds the Internal Support Rods & Gold Collar Standoffs (`staffs_low`, `bolts_staffs`)
     *    Notice in sci_news_14467_quantum_computer.jpg the slender angled & vertical stainless tie-rods
     *    visible between the coax pods!
     */
    buildSupportRodsAndGoldCollars() {
        const staffsGroup = new THREE.Group();
        const collarsGroup = new THREE.Group();

        const yTop = this.Y0 + this.len(6.18);
        const yBot = this.Y0 + this.len(2.06);
        const h = yTop - yBot;
        const midY = (yTop + yBot) * 0.5;

        // 8 slender stainless structural tie rods positioned between the 8 coax pods
        for (let k = 0; k < 8; k++) {
            const ang = (k / 8) * Math.PI * 2;
            const rRod = this.len(0.68);
            const rx = Math.cos(ang) * rRod;
            const rz = Math.sin(ang) * rRod;

            const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(this.len(0.022), this.len(0.022), h, 14),
                this.mats.polishedSteel
            );
            rod.position.set(rx, midY, rz);
            staffsGroup.add(rod);

            // Gold collar nuts at each of the lower 4 gold stage plates
            [4.16, 3.46, 2.76, 2.06].forEach(sy => {
                const collar = new THREE.Mesh(
                    new THREE.CylinderGeometry(this.len(0.042), this.len(0.042), this.len(0.14), 14),
                    this.mats.goldPlate
                );
                collar.position.set(rx, this.Y0 + this.len(sy), rz);
                collarsGroup.add(collar);
            });
        }

        this.registerNode('staffs_low', staffsGroup, 'single');
        this.registerNode('bolts_staffs', collarsGroup, 'single');
    }

    /**
     * 6. Builds the Central Helium-3 / Helium-4 Dilution Refrigeration System
     *     nestled inside the 8-pod coax ring (`gas_pipe`, `still`, `pipe_still`,
     *    `heat_exchanger_round`, `heat_exchanger_steps`, `mixing_chamber`).
     */
    buildHeliumDilutionSystem() {
        // 6.1 Concentric Helium Gas Supply & Return Column (gas_pipe, seq: 16)
        const gasPipeGroup = new THREE.Group();
        const outerPipe = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.068), this.len(0.068), this.len(1.85), 24),
            this.mats.stainlessSteel
        );
        outerPipe.position.copy(this.pos(0, 5.20, 0));
        gasPipeGroup.add(outerPipe);

        const innerCapillary = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.026), this.len(0.026), this.len(1.90), 16),
            this.mats.copperCoax
        );
        innerCapillary.position.copy(this.pos(0, 5.20, 0));
        gasPipeGroup.add(innerCapillary);
        this.registerNode('gas_pipe', gasPipeGroup, 'helium_system', 16);

        // 6.2 Still Chamber (still, seq: 17)
        const stillGroup = new THREE.Group();
        const stillBody = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.22), this.len(0.20), this.len(0.48), 32),
            this.mats.goldPlate
        );
        stillBody.position.copy(this.pos(0, 3.85, 0));
        stillGroup.add(stillBody);
        this.registerNode('still', stillGroup, 'helium_system', 17);

        // 6.3 Upper Helical Coil (pipe_still)
        const pipeStillGroup = new THREE.Group();
        const upperHelixPts = [];
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const a = t * Math.PI * 2 * 4.5;
            upperHelixPts.push(this.pos(
                Math.cos(a) * 0.24,
                4.22 + t * 0.56,
                Math.sin(a) * 0.24
            ));
        }
        pipeStillGroup.add(new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(upperHelixPts), 120, this.len(0.022), 12, false),
            this.mats.stainlessSteel
        ));
        this.registerNode('pipe_still', pipeStillGroup, 'helium_system');

        // 6.4 Continuous Helical Heat Exchanger (heat_exchanger_round, seq: 18)
        const hexRoundGroup = new THREE.Group();
        const lowerHelixPts = [];
        for (let i = 0; i <= 120; i++) {
            const t = i / 120;
            const a = t * Math.PI * 2 * 5.5;
            lowerHelixPts.push(this.pos(
                Math.cos(a) * 0.25,
                2.82 + t * 0.58,
                Math.sin(a) * 0.25
            ));
        }
        hexRoundGroup.add(new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lowerHelixPts), 140, this.len(0.024), 12, false),
            this.mats.copperCoax
        ));
        this.registerNode('heat_exchanger_round', hexRoundGroup, 'helium_system', 18);

        // 6.5 Sintered Silver Step Heat Exchangers (heat_exchanger_steps, seq: 19)
        const hexStepsGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
            const cell = new THREE.Mesh(
                new THREE.CylinderGeometry(this.len(0.068), this.len(0.068), this.len(0.11), 20),
                i % 2 === 0 ? this.mats.stainlessSteel : this.mats.goldPlate
            );
            cell.position.copy(this.pos(0.12, 2.65 - i * 0.12, 0));
            hexStepsGroup.add(cell);
        }
        this.registerNode('heat_exchanger_steps', hexStepsGroup, 'helium_system', 19);

        // 6.6 Mixing Chamber (mixing_chamber, seq: 20)
        const mcGroup = new THREE.Group();
        const mcCyl = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.24), this.len(0.21), this.len(0.45), 32),
            this.mats.goldPlate
        );
        mcCyl.position.copy(this.pos(0, 2.35, 0));
        mcGroup.add(mcCyl);
        this.registerNode('mixing_chamber', mcGroup, 'helium_system', 20);
    }

    /**
     * 7. Builds the Signature 8-Pod High-Density Coaxial Architecture, Two-Tone Barrel Banks,
     *    and 160+ Sweeping Silver-White Catenary Coax Loops from sci_news_14467_quantum_computer.jpg.
     */
    buildEightPodCoaxAndReadoutArchitecture() {
        const controlCablesGroup = new THREE.Group();   // cables_control (seq: 4)
        const measuringCablesGroup = new THREE.Group(); // cables_measuring (seq: 5)
        const attenuatorsGroup = new THREE.Group();     // attenuators (seq: 9)
        const bandpassGroup = new THREE.Group();        // filter_bandpass (seq: 8)

        // Stage pairs from top flange down to bottom mixing chamber plate:
        //   Tier 0: Top Flange (6.18) -> Plate 0 Silver (5.52) [dark/silver coax]
        //   Tier 1: Plate 0 Silver (5.52) -> Plate 1 Silver (4.86) [silver-steel coax]
        //   Tier 2: Plate 1 Silver (4.86) -> Plate 2 Gold (4.16) [silver-steel coax]
        //   Tier 3: Plate 2 Gold (4.16) -> Plate 3 Gold (3.46) [dark gunmetal S-wave coax]
        //   Tier 4: Plate 3 Gold (3.46) -> Plate 4a Gold (2.76) [dark gunmetal S-wave coax]
        //   Tier 5: Plate 4a Gold (2.76) -> Plate 4b Gold (2.06) [dark gunmetal S-wave coax + bright yellow SMA tops]
        const interStageTiers = [
            { yTop: 6.14, yBot: 5.56, rPod: 0.84, mat: this.mats.darkGunmetalCoax, waveAmp: 0.035, hasYellowSmaTop: false, hasYellowSmaBot: false },
            { yTop: 5.48, yBot: 4.90, rPod: 0.84, mat: this.mats.upperSilverCoax,  waveAmp: 0.040, hasYellowSmaTop: false, hasYellowSmaBot: false },
            { yTop: 4.82, yBot: 4.20, rPod: 0.82, mat: this.mats.upperSilverCoax,  waveAmp: 0.045, hasYellowSmaTop: false, hasYellowSmaBot: true  },
            { yTop: 4.12, yBot: 3.50, rPod: 0.80, mat: this.mats.darkGunmetalCoax, waveAmp: 0.068, hasYellowSmaTop: true,  hasYellowSmaBot: true  },
            { yTop: 3.42, yBot: 2.80, rPod: 0.79, mat: this.mats.darkGunmetalCoax, waveAmp: 0.072, hasYellowSmaTop: true,  hasYellowSmaBot: true  },
            { yTop: 2.72, yBot: 2.10, rPod: 0.78, mat: this.mats.darkGunmetalCoax, waveAmp: 0.075, hasYellowSmaTop: true,  hasYellowSmaBot: true  }
        ];

        const smaPinGeo = new THREE.CylinderGeometry(this.len(0.015), this.len(0.015), this.len(0.075), 8);

        // 7A. Build the 8 Perimeter Multi-Coax S-Wave Ribbons across all 6 tiers
        this.podAngles.forEach((podAng, podIdx) => {
            const cosA = Math.cos(podAng);
            const sinA = Math.sin(podAng);
            // Tangent vector (along rim) and Radial vector (outward)
            const tanX = -sinA;
            const tanZ = cosA;

            interStageTiers.forEach((tier, tierIdx) => {
                // In each pod, create a 3x7 = 21 semi-rigid coax matrix (7 tangential columns x 3 radial rows)
                const nCols = 7;
                const nRows = 3;

                for (let c = 0; c < nCols; c++) {
                    const uCol = (c - (nCols - 1) * 0.5) * 0.046; // tangential offset
                    for (let r = 0; r < nRows; r++) {
                        const uRow = (r - 1) * 0.042; // radial offset
                        const baseR = tier.rPod + uRow;

                        const x0 = cosA * baseR + tanX * uCol;
                        const z0 = sinA * baseR + tanZ * uCol;

                        // Uniform S-wave curve matching the dense wavy coax pods in sci_news_14467
                        const p0 = this.pos(x0, tier.yTop, z0);
                        const p1 = this.pos(
                            x0 + cosA * tier.waveAmp * 0.85 + tanX * 0.015,
                            tier.yTop * 0.72 + tier.yBot * 0.28,
                            z0 + sinA * tier.waveAmp * 0.85 + tanZ * 0.015
                        );
                        const p2 = this.pos(
                            x0 - cosA * tier.waveAmp * 0.65 - tanX * 0.015,
                            tier.yTop * 0.30 + tier.yBot * 0.70,
                            z0 - sinA * tier.waveAmp * 0.65 - tanZ * 0.015
                        );
                        const p3 = this.pos(x0, tier.yBot, z0);

                        const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
                        const tube = new THREE.Mesh(
                            new THREE.TubeGeometry(curve, 14, this.len(0.0095), 6, false),
                            tier.mat
                        );
                        controlCablesGroup.add(tube);

                        // Bright yellow-gold SMA attenuator sleeves at bottom/top of pod (especially prominent above bottom plate!)
                        if (tier.hasYellowSmaBot && r === 1) {
                            const smaBot = new THREE.Mesh(
                                smaPinGeo,
                                tierIdx === 5 ? this.mats.brightYellowGoldSMA : this.mats.amberGoldBarrel
                            );
                            smaBot.position.copy(this.pos(x0, tier.yBot + 0.025, z0));
                            attenuatorsGroup.add(smaBot);
                        }
                        if (tier.hasYellowSmaTop && r === 1) {
                            const smaTop = new THREE.Mesh(smaPinGeo, this.mats.amberGoldBarrel);
                            smaTop.position.copy(this.pos(x0, tier.yTop - 0.025, z0));
                            attenuatorsGroup.add(smaTop);
                        }
                    }
                }
            });

            // 7B. Build the 8 Vertical Banks of Two-Tone Silver & Amber-Gold Cylindrical Barrels
            //     hanging directly beneath the bottom gold plate (y_ref = 2.06 down to 1.54)
            //     AND the 160+ Sweeping Silver-White Flexible Coaxial Catenary Loops below them!
            const nBarrelsCol = 7;
            const nBarrelsRow = 3;
            const podBaseR = 0.76;

            for (let c = 0; c < nBarrelsCol; c++) {
                const uCol = (c - (nBarrelsCol - 1) * 0.5) * 0.048;
                for (let r = 0; r < nBarrelsRow; r++) {
                    const uRow = (r - 1) * 0.044;
                    const br = podBaseR + uRow;
                    const bx = cosA * br + tanX * uCol;
                    const bz = sinA * br + tanZ * uCol;

                    // Upper gold hex nut under the 10mK plate (y_ref = 1.99)
                    const topNut = new THREE.Mesh(
                        new THREE.CylinderGeometry(this.len(0.017), this.len(0.017), this.len(0.06), 6),
                        this.mats.amberGoldBarrel
                    );
                    topNut.position.copy(this.pos(bx, 1.99, bz));
                    attenuatorsGroup.add(topNut);

                    // Upper Brushed Silver Half of the Inline Filter/Attenuator Barrel (y_ref = 1.88)
                    const silverBarrel = new THREE.Mesh(
                        new THREE.CylinderGeometry(this.len(0.019), this.len(0.019), this.len(0.18), 10),
                        this.mats.polishedSteel
                    );
                    silverBarrel.position.copy(this.pos(bx, 1.87, bz));
                    bandpassGroup.add(silverBarrel);

                    // Lower Amber-Gold Half of the Inline Filter/Attenuator Barrel (y_ref = 1.68)
                    // (Slightly staggered in height across rows just like sci_news_14467)
                    const staggerY = (r - 1) * 0.025;
                    const goldBarrel = new THREE.Mesh(
                        new THREE.CylinderGeometry(this.len(0.020), this.len(0.020), this.len(0.20), 10),
                        this.mats.amberGoldBarrel
                    );
                    goldBarrel.position.copy(this.pos(bx, 1.68 + staggerY, bz));
                    bandpassGroup.add(goldBarrel);

                    // Bottom bright gold SMA tip at y_ref = 1.55
                    const botTipY = 1.56 + staggerY;
                    const botTip = new THREE.Mesh(
                        new THREE.CylinderGeometry(this.len(0.014), this.len(0.014), this.len(0.06), 8),
                        this.mats.brightYellowGoldSMA
                    );
                    botTip.position.copy(this.pos(bx, botTipY, bz));
                    attenuatorsGroup.add(botTip);

                    // 7C. Sweeping Silver-White Flexible Coaxial Catenary Loop emerging from this barrel!
                    //     Part the front-most catenary loops outward to frame the central Willow QPU chip
                    //     so the chip is clearly visible and unobstructed from the front!
                    const isFrontPod = (bz > 0.45 && Math.abs(bx) < 0.48);
                    const dropY = 0.64 + ((c * 3 + r + podIdx) % 7) * 0.055;
                    const sideSign = bx >= 0 ? 1 : -1;
                    const swirlAng = isFrontPod
                        ? (podAng + sideSign * 0.52)
                        : (podAng + 0.35 + (c - 3) * 0.05);
                    const midR = br * 0.86;
                    const innerR = 0.22 + (r * 0.05);

                    const cP0 = this.pos(bx, botTipY - 0.02, bz);
                    const cP1 = this.pos(
                        bx * 1.03,
                        botTipY - 0.34,
                        bz * 1.03
                    );
                    const cP2 = this.pos(
                        Math.cos(swirlAng) * midR,
                        dropY + 0.14,
                        Math.sin(swirlAng) * midR
                    );
                    const cP3 = this.pos(
                        Math.cos(swirlAng + sideSign * 0.35) * (innerR + 0.16),
                        dropY,
                        Math.sin(swirlAng + sideSign * 0.35) * (innerR + 0.16)
                    );
                    const cP4 = this.pos(
                        Math.cos(swirlAng + sideSign * 0.55) * innerR,
                        1.26 + (r * 0.10),
                        Math.sin(swirlAng + sideSign * 0.55) * innerR - (isFrontPod ? 0.18 : 0.0)
                    );

                    const flexCurve = new THREE.CatmullRomCurve3([cP0, cP1, cP2, cP3, cP4]);
                    const flexTube = new THREE.Mesh(
                        new THREE.TubeGeometry(flexCurve, 22, this.len(0.0085), 6, false),
                        this.mats.silverWhiteFlexCoax
                    );
                    measuringCablesGroup.add(flexTube);

                    // Black heat-shrink marker band along the lower curve (prominently visible in sci_news_14467)
                    const bandT = 0.52 + ((c + r) % 3) * 0.08;
                    const bandPos = flexCurve.getPointAt(bandT);
                    const bandTan = flexCurve.getTangentAt(bandT);
                    const markerBand = new THREE.Mesh(
                        new THREE.CylinderGeometry(this.len(0.0115), this.len(0.0115), this.len(0.045), 8),
                        this.mats.blackMarkerBand
                    );
                    markerBand.position.copy(bandPos);
                    markerBand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bandTan);
                    measuringCablesGroup.add(markerBand);
                }
            }
        });

        this.registerNode('cables_control', controlCablesGroup, 'electronic_circuit', 4);
        this.registerNode('cables_measuring', measuringCablesGroup, 'electronic_circuit', 5);
        this.registerNode('attenuators', attenuatorsGroup, 'electronic_circuit', 9);
        this.registerNode('filter_bandpass', bandpassGroup, 'electronic_circuit', 8);

        // 7D. 4K Low-Noise HEMT Amplifiers & DC Power Supply Loom (HEMTS seq: 6, power_supply seq: 7)
        const hemtsGroup = new THREE.Group();
        [[-0.38, 4.48, 0.22], [0.38, 4.48, -0.22]].forEach(([hx, hy, hz]) => {
            const hemtBox = new THREE.Mesh(
                new THREE.BoxGeometry(this.len(0.22), this.len(0.16), this.len(0.12)),
                this.mats.goldPlate
            );
            hemtBox.position.copy(this.pos(hx, hy, hz));
            hemtsGroup.add(hemtBox);
        });
        this.registerNode('HEMTS', hemtsGroup, 'electronic_circuit', 6);

        const powerSupplyGroup = new THREE.Group();
        const psCurve = new THREE.CatmullRomCurve3([
            this.pos(-0.38, 5.50, 0.22),
            this.pos(-0.44, 5.05, 0.26),
            this.pos(-0.38, 4.55, 0.22)
        ]);
        powerSupplyGroup.add(new THREE.Mesh(
            new THREE.TubeGeometry(psCurve, 24, this.len(0.016), 8, false),
            this.mats.copperCoax
        ));
        this.registerNode('power_supply', powerSupplyGroup, 'electronic_circuit', 7);

        // 7E. Cutaway Coaxial Cable (open_cable, seq: 10)
        const openCableGroup = new THREE.Group();
        const ocPos = this.pos(0.55, 1.35, 0.45);
        const outerJacket = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.036), this.len(0.036), this.len(0.20), 20),
            this.mats.amberGoldBarrel
        );
        outerJacket.position.copy(ocPos);
        openCableGroup.add(outerJacket);

        const ptfeCore = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.025), this.len(0.025), this.len(0.16), 20),
            this.mats.ptfeWhite
        );
        ptfeCore.position.copy(ocPos).add(new THREE.Vector3(0, -this.len(0.14), 0));
        openCableGroup.add(ptfeCore);

        const innerPin = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.009), this.len(0.009), this.len(0.16), 14),
            this.mats.goldPlate
        );
        innerPin.position.copy(ocPos).add(new THREE.Vector3(0, -this.len(0.26), 0));
        openCableGroup.add(innerPin);
        this.registerNode('open_cable', openCableGroup, 'electronic_circuit', 10);

        // 7F. Prominent 3D Google Willow / Sycamore QPU Chip Assembly (qpu, seq: 11)
        //     Modeled directly after:
        //       - Google_Willow_Quantum_Chip.jpg (Silver radial fan-out interposer + blue/gold edge strips + raised dark die)
        //       - Sycamore_Quantum_Chip.jpg (Brushed silver chamfered carrier frame)
        //       - Google_Sycamore_Chip_001.png (Flip-chip bonded dark silicon qubit processor die)
        //     Mounted on a gold-plated OFHC copper cold-finger pedestal in the front-bottom viewing window
        //     of the 10mK stage so it is clearly visible and ready for close-up inspection!
        const qpuGroup = new THREE.Group();
        const qpuMountGroup = new THREE.Group();

        // Upper gold cold-finger column descending from the 10mK Mixing Chamber plate (y_ref = 2.06 down to 1.25)
        const qpuColdFinger = new THREE.Mesh(
            new THREE.CylinderGeometry(this.len(0.16), this.len(0.14), this.len(0.75), 32),
            this.mats.goldPlate
        );
        qpuColdFinger.position.copy(this.pos(0, 1.65, 0));
        qpuMountGroup.add(qpuColdFinger);

        // Gold multi-SMA connector manifold ring above the QPU package
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const sma = new THREE.Mesh(
                new THREE.CylinderGeometry(this.len(0.016), this.len(0.016), this.len(0.09), 8),
                this.mats.brightYellowGoldSMA
            );
            sma.rotation.z = Math.PI / 2;
            sma.rotation.y = -a;
            sma.position.copy(this.pos(Math.cos(a) * 0.20, 1.48 + (k % 2) * 0.10, Math.sin(a) * 0.20));
            qpuMountGroup.add(sma);
        }

        // QPU Package Assembly positioned at (0, 1.02, 0.24) tilted slightly upward (18°) toward the viewer
        const chipAssembly = new THREE.Group();
        chipAssembly.position.copy(this.pos(0, 1.02, 0.24));
        chipAssembly.rotation.x = -0.28; // Tilted slightly upward for optimal viewing & close-up inspection

        // 1. Gold-Plated Copper Cryo-Backplane & Thermal Clamp Block
        const goldBackplane = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.56), this.len(0.56), this.len(0.045)),
            this.mats.goldPlate
        );
        goldBackplane.position.z = -this.len(0.035);
        chipAssembly.add(goldBackplane);

        // 12x Perimeter Gold SMA Coax Launch Connectors around the QPU carrier backplane
        for (let side = 0; side < 4; side++) {
            for (let j = -1; j <= 1; j++) {
                const smaLaunch = new THREE.Mesh(
                    new THREE.CylinderGeometry(this.len(0.014), this.len(0.014), this.len(0.065), 8),
                    this.mats.brightYellowGoldSMA
                );
                const offset = j * this.len(0.14);
                const dist = this.len(0.30);
                if (side === 0) {
                    smaLaunch.position.set(offset, dist, -this.len(0.02));
                } else if (side === 1) {
                    smaLaunch.rotation.z = Math.PI / 2;
                    smaLaunch.position.set(dist, offset, -this.len(0.02));
                } else if (side === 2) {
                    smaLaunch.position.set(offset, -dist, -this.len(0.02));
                } else {
                    smaLaunch.rotation.z = Math.PI / 2;
                    smaLaunch.position.set(-dist, offset, -this.len(0.02));
                }
                chipAssembly.add(smaLaunch);
            }
        }

        // 2. Brushed Silver Chamfered Carrier Frame (matching Sycamore_Quantum_Chip.jpg)
        const silverCarrier = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.50), this.len(0.50), this.len(0.032)),
            this.mats.brushedSilverPlate
        );
        silverCarrier.position.z = 0;
        chipAssembly.add(silverCarrier);

        // 4x Corner Hex Mounting Screws on the silver carrier frame
        [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].forEach(([bx, by]) => {
            const screw = new THREE.Mesh(
                new THREE.CylinderGeometry(this.len(0.014), this.len(0.014), this.len(0.042), 6),
                this.mats.amberGoldBarrel
            );
            screw.rotation.x = Math.PI / 2;
            screw.position.set(this.len(bx), this.len(by), this.len(0.004));
            chipAssembly.add(screw);
        });

        // 3. Mirror-Silver Silicon Interposer Plate with Radial Fan-Out Superconducting Traces
        //    (Matching Google_Willow_Quantum_Chip.jpg & Google_Sycamore_Chip_001.png)
        const interposerPlate = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.38), this.len(0.38), this.len(0.016)),
            this.mats.siliconInterposer
        );
        interposerPlate.position.z = this.len(0.022);
        chipAssembly.add(interposerPlate);

        // 4. Indium Bump-Bond Stand-Off Pedestal (creates the crisp shadow gap under the flip-chip die)
        const bumpBondLayer = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.155), this.len(0.155), this.len(0.010)),
            this.mats.amberGoldBarrel
        );
        bumpBondLayer.position.set(0, this.len(0.012), this.len(0.033));
        chipAssembly.add(bumpBondLayer);

        // 5. Raised Central Dark Charcoal-Black Flip-Chip Qubit Processor Die (Willow 105-Qubit / Sycamore 53-Qubit)
        const flipChipDie = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.175), this.len(0.175), this.len(0.018)),
            this.mats.siliconQpu
        );
        flipChipDie.position.set(0, this.len(0.012), this.len(0.044));
        chipAssembly.add(flipChipDie);

        qpuGroup.add(chipAssembly);

        this.registerNode('qpu', qpuGroup, 'electronic_circuit', 11);
        this.registerNode('chip_plate_brown_low', qpuMountGroup, 'single');

        // 7G. Cryogenic Isolators, Directional Couplers & TWPA inside the 10mK Readout Core
        //     (isolator seq: 12, directional_coupler seq: 13, TWPA seq: 14)
        const isolatorGroup = new THREE.Group();
        [[-0.24, 1.58, -0.16], [0.24, 1.58, -0.16]].forEach(([ix, iy, iz]) => {
            const iso = new THREE.Mesh(
                new THREE.BoxGeometry(this.len(0.18), this.len(0.12), this.len(0.12)),
                this.mats.amberGoldBarrel
            );
            iso.position.copy(this.pos(ix, iy, iz));
            isolatorGroup.add(iso);
        });
        this.registerNode('isolator', isolatorGroup, 'electronic_circuit', 12);

        const couplerGroup = new THREE.Group();
        const couplerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.22), this.len(0.10), this.len(0.12)),
            this.mats.polishedSteel
        );
        couplerMesh.position.copy(this.pos(-0.22, 1.38, -0.18));
        couplerGroup.add(couplerMesh);
        this.registerNode('directional_coupler', couplerGroup, 'electronic_circuit', 13);

        const twpaGroup = new THREE.Group();
        const twpaMesh = new THREE.Mesh(
            new THREE.BoxGeometry(this.len(0.24), this.len(0.11), this.len(0.12)),
            this.mats.goldPlate
        );
        twpaMesh.position.copy(this.pos(0.22, 1.38, -0.18));
        twpaGroup.add(twpaMesh);
        this.registerNode('TWPA', twpaGroup, 'electronic_circuit', 14);
    }

    /**
     * 8. Builds the Top Recessed Brushed Stainless-Steel Vacuum Flange (`plaque`, seq: 21)
     *    matching the top of sci_news_14467_quantum_computer.jpg with its two concentric bolt-hole rings.
     */
    buildTopStainlessFlangeAndPlaque() {
        const plaqueGroup = new THREE.Group();
        const flangeY = this.Y0 + this.len(6.18);
        const flangeR = this.len(1.48);
        const flangeH = this.len(0.085);

        // Wide brushed stainless circular vacuum flange recessed into the T-slot ceiling deck
        const topFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(flangeR, flangeR, flangeH, 72),
            this.mats.stainlessSteel
        );
        topFlange.position.set(0, flangeY, 0);
        plaqueGroup.add(topFlange);

        // Two concentric rings of dark socket bolt holes on the underside of the top stainless flange
        // (Clearly visible at the very top of sci_news_14467_quantum_computer.jpg)
        const holeGeo = new THREE.CylinderGeometry(this.len(0.014), this.len(0.014), flangeH * 1.08, 10);
        [1.36, 1.24].forEach((ringR, idx) => {
            const count = idx === 0 ? 36 : 24;
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2;
                const hole = new THREE.Mesh(holeGeo, this.mats.anodizedBlackMount);
                hole.position.set(
                    Math.cos(a) * this.len(ringR),
                    flangeY,
                    Math.sin(a) * this.len(ringR)
                );
                plaqueGroup.add(hole);
            }
        });

        this.registerNode('plaque', plaqueGroup, 'single', 21);
    }

    /**
     * 9. Builds the Room-Temperature Extension above and outside the Cryostat:
     *    - `top_breakout_manifolds` (seq: 22): 8 radial CNC-milled finned aluminum hermetic coaxial
     *      feedthrough towers on top of the 300K flange (matching Dilution_Fridge_009_8K.png) + 4 multi-pin
     *      Fischer/Lemo DC/thermometry vacuum turrets.
     *    - `room_temp_wiring` (seq: 23): 168+ color-coded room-temperature coaxial cables (Green XY drive,
     *      Blue Z flux-bias, Yellow/Amber readout, and White clock/DC looms bound with black velcro straps)
     *      rising from the 8 top feedthrough manifolds, routing across the overhead T-slot cable tray, and
     *      sweeping down in catenary drapes into the front SMA panels of the Control Electronics Crates
     *      (matching the right side of sci_news_14467_quantum_computer.jpg).
     *    - `control_electronics_rack` (seq: 24): Floor-standing 19-inch Google Quantum AI Control Electronics
     *      Rack at X = +1.42m housing 4 stacked 6U RF-DAC/FPGA/ADC crates (each with 12 blue-faced modular
     *      blades, 3D white card-ejector latches, and 3D gold SMA connector columns) + Master Rubidium Clock
     *      & LO Synthesizer + Linear Power Supply PDU.
     *    - `pulse_tube_assembly` (seq: 25): Twin Cryomech PT415/PT420 Pulse-Tube Cryocooler Cold Heads
     *      with copper heat-exchanger fins, anodized blue rotary valve motor heads, and 4 braided stainless
     *      high-pressure helium flex hoses arching across the -X overhead bridge.
     *    - `gas_handling_system` (seq: 26): Central 300K stainless turbo-pump & KF-50 vacuum manifold tee,
     *      overhead ³He/⁴He circulation pipes, and floor-standing Bluefors Gas Handling & Cryo-Compressor
     *      Cabinet at X = -1.42m.
     */
    buildRoomTempBreakoutWiringAndControlRacks() {
        const flangeTopY = this.Y0 + this.len(6.22); // ~2.33m

        // =========================================================================================
        // 9A. TOP 300K HERMETIC COAXIAL BREAKOUT TOWERS (`top_breakout_manifolds`, seq: 22)
        //     Directly modeled after the 8 rectangular finned silver blocks at the very top of
        //     Dilution_Fridge_009_8K.png & Dilution_Fridge_with_Quantum_Processors_Enclosed_008_8K.png
        // =========================================================================================
        const breakoutGroup = new THREE.Group();
        const towerR = this.len(0.84);
        const towerH = 0.145;
        const towerW = 0.125;
        const towerD = 0.082;

        const towerTopPorts = []; // Stores exact world positions of the 3D SMA ports on all 8 towers

        this.podAngles.forEach((ang, podIdx) => {
            const tx = Math.cos(ang) * towerR;
            const tz = Math.sin(ang) * towerR;
            const towerSub = new THREE.Group();
            const rotY = -ang + Math.PI / 2;
            towerSub.position.set(tx, flangeTopY + towerH * 0.5, tz);
            towerSub.rotation.y = rotY;

            // Black anodized hermetic O-ring base flange
            const baseSeal = new THREE.Mesh(
                new THREE.BoxGeometry(towerW * 1.12, 0.018, towerD * 1.12),
                this.mats.anodizedBlackMount
            );
            baseSeal.position.y = -towerH * 0.5 + 0.009;
            towerSub.add(baseSeal);

            // Brushed aluminum multi-channel feedthrough body (matching top of Dilution_Fridge_009_8K.png)
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(towerW, towerH, towerD),
                this.mats.brushedSilverPlate
            );
            towerSub.add(body);

            // Vertical CNC-machined stiffening/cooling fins along the front & back faces of the tower
            for (let f = -3; f <= 3; f++) {
                const fin = new THREE.Mesh(
                    new THREE.BoxGeometry(0.006, towerH * 0.92, towerD * 1.08),
                    this.mats.polishedSteel
                );
                fin.position.x = f * 0.015;
                towerSub.add(fin);
            }

            // Gold-plated multi-SMA top bulkhead patch plate
            const goldCap = new THREE.Mesh(
                new THREE.BoxGeometry(towerW * 0.96, 0.012, towerD * 0.96),
                this.mats.goldPlate
            );
            goldCap.position.y = towerH * 0.5 + 0.006;
            towerSub.add(goldCap);

            // 3x5 array of 3D brass SMA hermetic bulkhead barrels protruding from the top of the tower
            const smaGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 8);
            const smaWorldPorts = [];
            const cosR = Math.cos(rotY);
            const sinR = Math.sin(rotY);

            for (let c = -2; c <= 2; c++) {
                for (let r = -1; r <= 1; r++) {
                    const lx = c * 0.021;
                    const lz = r * 0.021;
                    const sma = new THREE.Mesh(smaGeo, this.mats.brightYellowGoldSMA);
                    sma.position.set(lx, towerH * 0.5 + 0.018, lz);
                    towerSub.add(sma);

                    // Compute exact world position of the top of this 3D SMA barrel
                    const wx = tx + lx * cosR + lz * sinR;
                    const wz = tz - lx * sinR + lz * cosR;
                    const wy = flangeTopY + towerH + 0.026;
                    smaWorldPorts.push(new THREE.Vector3(wx, wy, wz));
                }
            }

            breakoutGroup.add(towerSub);
            towerTopPorts.push({
                podIdx,
                ang,
                worldPos: new THREE.Vector3(tx, flangeTopY + towerH + 0.026, tz),
                smaWorldPorts
            });
        });

        // 4 Multi-Pin DC Bias & Cryogenic Thermometry Hermetic Fischer Turrets between the RF towers
        const fischerTurretPorts = [];
        for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 8;
            const fx = Math.cos(a) * this.len(1.10);
            const fz = Math.sin(a) * this.len(1.10);

            const turret = new THREE.Mesh(
                new THREE.CylinderGeometry(0.028, 0.034, 0.085, 16),
                this.mats.polishedSteel
            );
            turret.position.set(fx, flangeTopY + 0.042, fz);
            breakoutGroup.add(turret);

            const collar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.031, 0.031, 0.022, 16),
                k % 2 === 0 ? this.mats.pulseTubeBlue : this.mats.anodizedBlackMount
            );
            collar.position.set(fx, flangeTopY + 0.082, fz);
            breakoutGroup.add(collar);

            // Top brass multi-pin receptacle on turret
            const pinHeader = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.014, 0.024, 12),
                this.mats.brightYellowGoldSMA
            );
            pinHeader.position.set(fx, flangeTopY + 0.098, fz);
            breakoutGroup.add(pinHeader);

            fischerTurretPorts.push(new THREE.Vector3(fx, flangeTopY + 0.108, fz));
        }

        this.registerNode('top_breakout_manifolds', breakoutGroup, 'room_temp_control', 22);

        // =========================================================================================
        // 9B. GOOGLE QUANTUM AI ROOM-TEMPERATURE CONTROL ELECTRONICS RACK (`control_electronics_rack`, seq: 24)
        //     Standing at X = +1.42m, Y = 0..2.18m, Z = 0.0m inside the extended +X T-slot bay.
        //     SINGLE FRONT FACE (+Z): All 6U FPGA/RF-DAC subrack blades, ejector handles, and SMA
        //     bulkheads face strictly +Z (matching sci_news_14467_quantum_computer.jpg).
        //     Side faces (-X/+X) have louvered cooling vents, and rear face (-Z) has exhaust fans.
        // =========================================================================================
        const rackGroup = new THREE.Group();
        const rackX = 1.42;
        const rackW = 0.58;   // X width of the 19-inch cabinet (X in [1.13, 1.71])
        const rackD = 0.78;   // Z depth of the cabinet (Z in [-0.39, +0.39])
        const rackH = 2.18;
        const frontFaceZ = rackD * 0.5; // +0.39m

        // Outer matte-black steel rack enclosure
        const rackBody = new THREE.Mesh(
            new THREE.BoxGeometry(rackW, rackH - 0.06, rackD),
            this.mats.rackCabinetSteel
        );
        rackBody.position.set(rackX, rackH * 0.5 + 0.02, 0);
        rackGroup.add(rackBody);

        // 4 Heavy-duty leveling feet planted on the y = 0 laboratory floor
        [[-0.24, -0.34], [0.24, -0.34], [-0.24, 0.34], [0.24, 0.34]].forEach(([dx, dz]) => {
            const foot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.032, 0.042, 0.05, 12),
                this.mats.anodizedBlackMount
            );
            foot.position.set(rackX + dx, 0.025, dz);
            rackGroup.add(foot);
        });

        // Vertical brushed-aluminum 19-inch EIA rack mounting rails on the +Z front face ONLY
        [-rackW * 0.45, rackW * 0.45].forEach(rxOff => {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(0.032, rackH - 0.12, 0.018),
                this.mats.brushedSilverPlate
            );
            rail.position.set(rackX + rxOff, rackH * 0.5 + 0.02, frontFaceZ + 0.008);
            rackGroup.add(rail);
        });

        // Side (-X and +X) Recessed Louvered Cooling Panels (distinct side geometry, no duplicated faceplates!)
        [-rackW * 0.5 - 0.004, rackW * 0.5 + 0.004].forEach(sideXOff => {
            [0.65, 1.35, 1.88].forEach(ventY => {
                const ventFrame = new THREE.Mesh(
                    new THREE.BoxGeometry(0.008, 0.36, rackD * 0.72),
                    this.mats.anodizedBlackMount
                );
                ventFrame.position.set(rackX + sideXOff, ventY, 0);
                rackGroup.add(ventFrame);

                for (let l = -3; l <= 3; l++) {
                    const louver = new THREE.Mesh(
                        new THREE.BoxGeometry(0.012, 0.014, rackD * 0.64),
                        this.mats.brushedSilverPlate
                    );
                    louver.position.set(rackX + sideXOff, ventY + l * 0.042, 0);
                    rackGroup.add(louver);
                }
            });
        });

        // Rear (-Z) Exhaust Fan Grille & Copper Grounding Busbar (distinct rear panel at Z = -0.39m)
        const rearDoor = new THREE.Mesh(
            new THREE.BoxGeometry(rackW * 0.88, rackH - 0.18, 0.012),
            this.mats.anodizedBlackMount
        );
        rearDoor.position.set(rackX, rackH * 0.5 + 0.02, -frontFaceZ - 0.005);
        rackGroup.add(rearDoor);

        [0.64, 1.12, 1.60].forEach(fanY => {
            [-0.14, 0.14].forEach(fanXOff => {
                const fanRing = new THREE.Mesh(
                    new THREE.TorusGeometry(0.085, 0.008, 8, 20),
                    this.mats.brushedSilverPlate
                );
                fanRing.position.set(rackX + fanXOff, fanY, -frontFaceZ - 0.014);
                rackGroup.add(fanRing);

                const fanHub = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.032, 0.032, 0.016, 12),
                    this.mats.copperCoax
                );
                fanHub.rotation.x = Math.PI / 2;
                fanHub.position.set(rackX + fanXOff, fanY, -frontFaceZ - 0.014);
                rackGroup.add(fanHub);
            });
        });

        // Overhead Cable Waterfall Roller Bar & Strain-Relief Comb mounted on top of the rack
        // at Y = 2.34m, Z = +0.435m (guides overhead cables cleanly in front of the +Z faceplates
        // so zero cables ever touch or clip through the rack cabinet!)
        [-rackW * 0.44, rackW * 0.44].forEach(rxOff => {
            const riser = new THREE.Mesh(
                new THREE.BoxGeometry(0.024, 0.22, 0.024),
                this.mats.brushedSilverPlate
            );
            riser.position.set(rackX + rxOff, rackH + 0.08, frontFaceZ - 0.04);
            rackGroup.add(riser);

            const arm = new THREE.Mesh(
                new THREE.BoxGeometry(0.024, 0.024, 0.14),
                this.mats.brushedSilverPlate
            );
            arm.position.set(rackX + rxOff, rackH + 0.17, frontFaceZ + 0.01);
            rackGroup.add(arm);
        });

        const waterfallBar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, rackW * 0.94, 16),
            this.mats.polishedSteel
        );
        waterfallBar.rotation.z = Math.PI / 2;
        waterfallBar.position.set(rackX, rackH + 0.17, frontFaceZ + 0.055); // Y = 2.35m, Z = +0.445m
        rackGroup.add(waterfallBar);

        // 4 Stacked 6U Google Custom RF-DAC / FPGA / Readout ADC Subracks (y = 0.56m, 0.94m, 1.32m, 1.70m)
        // Strictly on the +Z front face!
        const crateHeights = [0.56, 0.94, 1.32, 1.70];
        const crateH = 0.32;
        const nBlades3D = 8; // 8 blades per 6U subrack (matching 8 pod bundles!)
        const bladeXCoords = [];

        for (let b = 0; b < nBlades3D; b++) {
            const u = (b / (nBlades3D - 1) - 0.5);
            bladeXCoords.push(rackX + u * (rackW * 0.76));
        }

        crateHeights.forEach((cy) => {
            // Front +Z Subrack Faceplate
            const frontPanelZ = new THREE.Mesh(
                new THREE.BoxGeometry(rackW * 0.88, crateH, 0.020),
                this.mats.fpgaSubrackFaceplate
            );
            frontPanelZ.position.set(rackX, cy, frontFaceZ + 0.008);
            rackGroup.add(frontPanelZ);

            // Horizontal brushed aluminum subrack card-cage rails (top & bottom of the 6U crate)
            [-crateH * 0.47, crateH * 0.47].forEach(ry => {
                const cageBar = new THREE.Mesh(
                    new THREE.BoxGeometry(rackW * 0.90, 0.014, 0.028),
                    this.mats.brushedSilverPlate
                );
                cageBar.position.set(rackX, cy + ry, frontFaceZ + 0.014);
                rackGroup.add(cageBar);
            });

            // 8 Protruding 3D Blade Front Strips, White Card-Ejector Handles & Gold SMA Bulkhead Jacks on +Z
            bladeXCoords.forEach((bx) => {
                // 3D anodized blue blade bezel strip
                const bladeStrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.036, crateH * 0.88, 0.012),
                    this.mats.pulseTubeBlue
                );
                bladeStrip.position.set(bx, cy, frontFaceZ + 0.016);
                rackGroup.add(bladeStrip);

                // Top & bottom 3D white card-ejector latches
                [-crateH * 0.41, crateH * 0.41].forEach(ly => {
                    const latchZ = new THREE.Mesh(
                        new THREE.BoxGeometry(0.026, 0.018, 0.024),
                        this.mats.ejectorLatchWhite
                    );
                    latchZ.position.set(bx, cy + ly, frontFaceZ + 0.024);
                    rackGroup.add(latchZ);
                });

                // 7 vertical 3D Gold SMA bulkhead jacks per blade on the +Z front face
                for (let s = -3; s <= 3; s++) {
                    const smaZ = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.0048, 0.0048, 0.022, 8),
                        this.mats.brightYellowGoldSMA
                    );
                    smaZ.rotation.x = Math.PI / 2;
                    smaZ.position.set(bx, cy + s * 0.032, frontFaceZ + 0.024);
                    rackGroup.add(smaZ);
                }
            });
        });

        // Top 3U Master Rubidium Clock & Local Oscillator Synthesizer Chassis (y = 2.02m, +Z face only)
        const clockPanelZ = new THREE.Mesh(
            new THREE.BoxGeometry(rackW * 0.88, 0.16, 0.020),
            this.mats.masterClockFaceplate
        );
        clockPanelZ.position.set(rackX, 2.02, frontFaceZ + 0.008);
        rackGroup.add(clockPanelZ);

        // 4 Gold Fischer / SMA Clock & DC Reference bulkhead receptacles on the +Z face of the 3U Clock Chassis
        const clockPortWorldCoords = [];
        for (let k = 0; k < 4; k++) {
            const cpx = rackX - 0.18 + k * 0.12;
            const cpz = frontFaceZ + 0.024;
            const cpy = 2.00;
            const clockReceptacle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.009, 0.009, 0.024, 10),
                this.mats.brightYellowGoldSMA
            );
            clockReceptacle.rotation.x = Math.PI / 2;
            clockReceptacle.position.set(cpx, cpy, cpz);
            rackGroup.add(clockReceptacle);
            clockPortWorldCoords.push(new THREE.Vector3(cpx, cpy, cpz + 0.008));
        }

        // Bottom Low-Noise Linear DC Power Supply & PDU Chassis (y = 0.22m)
        const pduChassis = new THREE.Mesh(
            new THREE.BoxGeometry(rackW * 0.90, 0.22, rackD * 0.92),
            this.mats.anodizedBlackMount
        );
        pduChassis.position.set(rackX, 0.22, 0);
        rackGroup.add(pduChassis);

        this.registerNode('control_electronics_rack', rackGroup, 'room_temp_control', 24);

        // =========================================================================================
        // 9C. COLOR-CODED ROOM-TEMPERATURE COAXIAL CABLE LOOMS (`room_temp_wiring`, seq: 23)
        //     Every single cable (Green, Blue, Yellow/Amber, and White) is a 100% continuous,
        //     unbroken 3D tube connected at BOTH ends:
        //       - Starts inside a 3D Gold SMA barrel + strain-relief boot on `top_breakout_manifolds`
        //       - Travels across the +X overhead cable ladder tray (Y = 2.47..2.52m)
        //       - Passes over the rack's top waterfall roller bar (Y = 2.36m, Z = +0.45m, completely
        //         outside the rack box!)
        //       - Loops down in front of the +Z subrack blades (Z = +0.46..+0.54m) with black Velcro
        //         straps and plugs directly into a 3D Gold SMA jack + boot on `control_electronics_rack`!
        // =========================================================================================
        const rtWiringGroup = new THREE.Group();
        const loomPalette = [
            this.mats.rtCoaxGreen,   // Emerald-Green XY Qubit Microwave Drive Loom
            this.mats.rtCoaxBlue,    // Royal-Blue Z Fast Flux-Bias & Coupler Loom
            this.mats.rtCoaxYellow,  // Amber-Yellow Readout Stimulus & Pump Loom
            this.mats.rtCoaxWhite    // Silver-White Master Clock & Low-Noise DC Loom
        ];

        const trayY = flangeTopY + 0.13; // ~2.46m along the overhead ladder cable tray

        // Route all 8 pod bundles (8 pods × 7 cables = 56 continuous color-coded cables)
        towerTopPorts.forEach((port, podIdx) => {
            const colorIdx = podIdx % 4;
            const loomMat = loomPalette[colorIdx];
            // Map each of the 8 pod bundles to its dedicated blade column (0..7) and subrack crate (0..3)
            const targetCrateIdx = colorIdx;
            const targetCrateY = crateHeights[targetCrateIdx];
            const targetBladeX = bladeXCoords[podIdx];

            // Dedicated horizontal lane on the overhead tray (Z in [-0.18, +0.18])
            const trayLaneZ = ((podIdx - 3.5) / 3.5) * 0.17;
            // Dedicated catenary loop dip height in front of the +Z rack face
            const dipY = Math.max(0.36, targetCrateY - 0.24 - (podIdx % 2) * 0.06);
            // Layer depth in front of the +Z face (all strictly >= frontFaceZ + 0.065m = +0.455m!)
            const frontLayerZ = frontFaceZ + 0.075 + (colorIdx * 0.016);

            for (let k = 0; k < 7; k++) {
                // Pick a dedicated 3D SMA barrel on top of this breakout tower
                const smaPortPos = port.smaWorldPorts[k * 2] || port.worldPos;
                const spreadX = (k - 3) * 0.0042;
                const spreadZ = ((k % 2) - 0.5) * 0.0045;

                // 1. Exact start inside the 3D SMA jack on top of the 300K Breakout Tower
                const pStart = new THREE.Vector3(
                    smaPortPos.x,
                    smaPortPos.y - 0.004,
                    smaPortPos.z
                );

                // 3D Black strain-relief boot + gold nut right where the cable exits the breakout tower SMA jack
                const towerBoot = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.0058, 0.0052, 0.022, 8),
                    this.mats.anodizedBlackMount
                );
                towerBoot.position.set(pStart.x, pStart.y + 0.010, pStart.z);
                rtWiringGroup.add(towerBoot);

                // 2. Vertical rise straight out of the tower SMA barrel onto the overhead bridge plane
                const laneY = trayY + 0.032 + colorIdx * 0.011 + (k % 2) * 0.004;
                const pTowerRise = new THREE.Vector3(
                    pStart.x,
                    laneY + 0.02,
                    pStart.z
                );

                // 3. Entry onto the +X overhead ladder tray (X = 0.54m)
                const pTrayEntry = new THREE.Vector3(
                    0.54,
                    laneY,
                    trayLaneZ + spreadZ
                );

                // 4. Midpoint along the +X overhead ladder tray (X = 1.02m)
                const pTrayMid = new THREE.Vector3(
                    1.02,
                    laneY,
                    trayLaneZ + spreadZ
                );

                // 5. Pass cleanly ABOVE the top roof of the Control Rack (Y = 2.41m > rackH = 2.18m)
                const pRackTopOver = new THREE.Vector3(
                    targetBladeX + spreadX,
                    rackH + 0.23 + colorIdx * 0.008,
                    0.18 + spreadZ
                );

                // 6. Round the 3D Overhead Waterfall Roller Bar in front of the rack (Y = 2.355m, Z = +0.46m)
                const loopShiftX = (podIdx % 2 === 0 ? -0.045 : 0.045);
                const pWaterfall = new THREE.Vector3(
                    targetBladeX + loopShiftX + spreadX,
                    rackH + 0.175,
                    frontLayerZ - 0.012 + spreadZ
                );

                // 7. Upper vertical cascade in front of the +Z subrack faceplates (Z >= +0.465m)
                const pFrontDescent = new THREE.Vector3(
                    targetBladeX + loopShiftX * 1.15 + spreadX,
                    (rackH + 0.14 + dipY) * 0.52,
                    frontLayerZ + 0.018 + spreadZ
                );

                // 8. Sweeping catenary U-bend bottom in front of the rack (matching sci_news_14467)
                const pCatenaryDip = new THREE.Vector3(
                    targetBladeX + loopShiftX * 0.55 + spreadX,
                    dipY - (k % 3) * 0.009,
                    frontLayerZ + 0.028 + spreadZ
                );

                // 9. Horizontal approach directly in front of the target 3D SMA jack on the +Z blade
                const targetSmaY = targetCrateY + (k - 3) * 0.032;
                const pPlugApproach = new THREE.Vector3(
                    targetBladeX,
                    targetSmaY - 0.012,
                    frontFaceZ + 0.058
                );

                // 10. Exact termination inside the 3D Gold SMA bulkhead jack on the +Z blade faceplate
                const pPlug = new THREE.Vector3(
                    targetBladeX,
                    targetSmaY,
                    frontFaceZ + 0.028
                );

                const curve = new THREE.CatmullRomCurve3([
                    pStart,
                    pTowerRise,
                    pTrayEntry,
                    pTrayMid,
                    pRackTopOver,
                    pWaterfall,
                    pFrontDescent,
                    pCatenaryDip,
                    pPlugApproach,
                    pPlug
                ]);

                const cableMesh = new THREE.Mesh(
                    new THREE.TubeGeometry(curve, 44, 0.0042, 6, false),
                    loomMat
                );
                rtWiringGroup.add(cableMesh);

                // 3D Gold SMA hex connector nut + black strain-relief boot where the cable plugs into the +Z blade
                const rackBoot = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.0056, 0.0056, 0.020, 8),
                    this.mats.anodizedBlackMount
                );
                rackBoot.rotation.x = Math.PI / 2;
                rackBoot.position.set(pPlug.x, pPlug.y, pPlug.z + 0.008);
                rtWiringGroup.add(rackBoot);

                // Black Velcro Bundling Straps along the overhead tray and front catenary loops
                if (k === 3) {
                    [0.32, 0.54, 0.68, 0.80, 0.89].forEach(tBand => {
                        const bPos = curve.getPointAt(tBand);
                        const bTan = curve.getTangentAt(tBand);
                        const strap = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.019, 0.019, 0.018, 12),
                            this.mats.blackMarkerBand
                        );
                        strap.position.copy(bPos);
                        strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bTan);
                        rtWiringGroup.add(strap);
                    });
                }
            }
        });

        // Also connect the 4 Fischer DC/Thermometry Turrets on the 300K flange via continuous
        // braided silver-white trunk cables into the 4 receptacles on the 3U Master Clock Chassis!
        fischerTurretPorts.forEach((fStart, fIdx) => {
            const fEnd = clockPortWorldCoords[fIdx];
            const laneZ = (fIdx - 1.5) * 0.06;
            const dcCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(fStart.x, fStart.y - 0.005, fStart.z),
                new THREE.Vector3(fStart.x * 0.85 + 0.15, trayY + 0.08, fStart.z * 0.7),
                new THREE.Vector3(0.75, trayY + 0.07, laneZ),
                new THREE.Vector3(fEnd.x, rackH + 0.25, 0.15),
                new THREE.Vector3(fEnd.x, rackH + 0.18, frontFaceZ + 0.06),
                new THREE.Vector3(fEnd.x, fEnd.y + 0.02, frontFaceZ + 0.065),
                fEnd
            ]);
            const dcCable = new THREE.Mesh(
                new THREE.TubeGeometry(dcCurve, 32, 0.0065, 8, false),
                this.mats.rtCoaxWhite
            );
            rtWiringGroup.add(dcCable);

            // Connector boots at both turret start and rack clock receptacle end
            const startBoot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.011, 0.009, 0.024, 10),
                this.mats.anodizedBlackMount
            );
            startBoot.position.set(fStart.x, fStart.y + 0.008, fStart.z);
            rtWiringGroup.add(startBoot);

            const endBoot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.010, 0.010, 0.022, 10),
                this.mats.anodizedBlackMount
            );
            endBoot.rotation.x = Math.PI / 2;
            endBoot.position.set(fEnd.x, fEnd.y, fEnd.z + 0.006);
            rtWiringGroup.add(endBoot);
        });

        this.registerNode('room_temp_wiring', rtWiringGroup, 'room_temp_control', 23);

        // =========================================================================================
        // 9D. PULSE-TUBE CRYOCOOLER COLD HEADS, ROTARY VALVES & HELIUM FLEX LINES (`pulse_tube_assembly`, seq: 25)
        //     Modeled after the copper-finned Cryomech PT415/PT420 pulse-tube turrets at the top of
        //     Google_Quantum_AI_Cryostat.jpg and IBM_QC.jpg.
        //     All 4 braided stainless helium flex lines connect cleanly into 3D brass Aeroquip
        //     fittings on the Cryomech compressor vessel at X = -1.36m, Y = 0.92m!
        // =========================================================================================
        const pulseTubeGroup = new THREE.Group();
        const ptPositions = [
            [-0.46, flangeTopY, -0.34],
            [-0.46, flangeTopY,  0.34]
        ];

        const compressorFittingCoords = [];

        ptPositions.forEach(([px, py, pz], ptIdx) => {
            const ptSub = new THREE.Group();
            ptSub.position.set(px, py, pz);

            // Stainless mounting base flange on 300K plate
            const baseFlange = new THREE.Mesh(
                new THREE.CylinderGeometry(0.078, 0.082, 0.026, 24),
                this.mats.polishedSteel
            );
            baseFlange.position.y = 0.013;
            ptSub.add(baseFlange);

            // Stacked Copper Heat-Exchanger Cooling Fins
            for (let f = 0; f < 8; f++) {
                const finDisk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.068, 0.068, 0.008, 24),
                    this.mats.copperCoax
                );
                finDisk.position.y = 0.038 + f * 0.016;
                ptSub.add(finDisk);
            }

            // Central copper cold-head cylinder
            const coreCyl = new THREE.Mesh(
                new THREE.CylinderGeometry(0.046, 0.046, 0.16, 20),
                this.mats.copperCoax
            );
            coreCyl.position.y = 0.10;
            ptSub.add(coreCyl);

            // Anodized Blue Rotary Valve Stepper Motor Housing on top
            const motorBox = new THREE.Mesh(
                new THREE.BoxGeometry(0.095, 0.095, 0.095),
                this.mats.pulseTubeBlue
            );
            motorBox.position.y = 0.22;
            ptSub.add(motorBox);

            // Brushed aluminum helium buffer reservoir tank alongside the cold head
            const bufferTank = new THREE.Mesh(
                new THREE.CylinderGeometry(0.042, 0.042, 0.22, 20),
                this.mats.brushedSilverPlate
            );
            bufferTank.position.set(-0.09, 0.12, 0);
            ptSub.add(bufferTank);

            pulseTubeGroup.add(ptSub);

            // High-Pressure Supply & Low-Pressure Return Braided Stainless Helium Flex Hoses
            // routing from 3D brass fittings on the pulse-tube rotary valve across the -X overhead
            // tray and vertically down into 3D brass Aeroquip fittings on the Cryomech compressor!
            [-0.024, 0.024].forEach((zOff, hIdx) => {
                const lineIdx = ptIdx * 2 + hIdx;
                const targetZ = -0.26 + lineIdx * 0.075;
                const targetX = -1.34;
                const targetY = 0.90;
                compressorFittingCoords.push({ x: targetX, y: targetY, z: targetZ, hIdx });

                // Top brass fitting on the rotary valve motor housing
                const topFitting = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.014, 0.014, 0.028, 10),
                    this.mats.amberGoldBarrel
                );
                topFitting.position.set(px, py + 0.275, pz + zOff);
                pulseTubeGroup.add(topFitting);

                const hoseCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(px, py + 0.28, pz + zOff),
                    new THREE.Vector3(px - 0.18, py + 0.34 + hIdx * 0.02, pz * 0.65 + zOff),
                    new THREE.Vector3(-0.98, py + 0.22, targetZ),
                    new THREE.Vector3(targetX + 0.12, 1.55, targetZ),
                    new THREE.Vector3(targetX, 1.12, targetZ),
                    new THREE.Vector3(targetX, targetY, targetZ)
                ]);
                const hoseMesh = new THREE.Mesh(
                    new THREE.TubeGeometry(hoseCurve, 32, 0.0115, 10, false),
                    this.mats.stainlessSteel
                );
                pulseTubeGroup.add(hoseMesh);

                // Red/Amber (High-Pressure Supply) or Blue (Low-Pressure Return) anodized collar bands at both ends
                [0.12, 0.94].forEach(tBand => {
                    const bandPos = hoseCurve.getPointAt(tBand);
                    const bandTan = hoseCurve.getTangentAt(tBand);
                    const band = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.015, 0.015, 0.032, 10),
                        hIdx === 0 ? this.mats.amberGoldBarrel : this.mats.pulseTubeBlue
                    );
                    band.position.copy(bandPos);
                    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bandTan);
                    pulseTubeGroup.add(band);
                });
            });
        });

        this.registerNode('pulse_tube_assembly', pulseTubeGroup, 'helium_system', 25);

        // =========================================================================================
        // 9E. CENTRAL 300K TURBO-PUMP MANIFOLD & 3D OPEN-FRAME GAS HANDLING SKID (`gas_handling_system`, seq: 26)
        //     Built following `QUANTUM_COMPUTER_MODEL_GUIDE.md` by stacking real 3D mechanical primitives:
        //       - Open welded structural steel skid frame at X = -1.42m (no solid dual-face painted box!)
        //       - Single-face (+Z) top digital OLED status header bar at Y = 2.03m
        //       - Lower Deck (Y = 0.06..0.94m):
        //           * Twin 3D stainless/blue ³He/⁴He dump cylinders with domed heads, 3D brass valves,
        //             and real 3D cylindrical Bourdon pressure gauges (cased cylinders + 3D bezel + needle)
        //           * 3D Cryomech CPA289C helium compressor module with a 3D helical copper heat-exchanger
        //             coil and 4 brass Aeroquip bulkhead couplings receiving the pulse-tube flex hoses
        //       - Upper Deck (Y = 0.98..1.90m):
        //           * 3D Liquid-Nitrogen / Charcoal Cryo-Trap Dewar cylinder with helical copper coil
        //           * 3D CNC-machined stainless vacuum valve manifold block with 6 motorized diaphragm
        //             valves, 3 cylindrical MKS capacitance manometers, and connected riser/overhead pipes!
        // =========================================================================================
        const ghsGroup = new THREE.Group();

        // 1. Central 300K Stainless Vacuum Tee & Turbo-Molecular Pump Turret at (0, flangeTopY, 0)
        const centralTurret = new THREE.Mesh(
            new THREE.CylinderGeometry(0.095, 0.115, 0.26, 28),
            this.mats.polishedSteel
        );
        centralTurret.position.set(0, flangeTopY + 0.13, 0);
        ghsGroup.add(centralTurret);

        // Gold/brass KF-50 / ISO-100 vacuum clamp rings on the central turret
        [0.03, 0.14, 0.25].forEach(ry => {
            const clampRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.105, 0.012, 10, 28),
                this.mats.amberGoldBarrel
            );
            clampRing.rotation.x = Math.PI / 2;
            clampRing.position.set(0, flangeTopY + ry, 0);
            ghsGroup.add(clampRing);
        });

        // 2. Open-Frame Structural Steel Mechanical Skid at X = -1.42m, Y = 0..2.12m, Z = -0.36..+0.36m
        const ghsX = -1.42;
        const ghsW = 0.56;
        const ghsD = 0.74;
        const ghsH = 2.12;

        // Heavy steel base skid deck (Y = 0.05m) and mid-level manifold deck (Y = 0.96m)
        [0.05, 0.96, 1.92].forEach((deckY, dIdx) => {
            const deckPlate = new THREE.Mesh(
                new THREE.BoxGeometry(ghsW, dIdx === 0 ? 0.036 : 0.024, ghsD),
                this.mats.rackCabinetSteel
            );
            deckPlate.position.set(ghsX, deckY, 0);
            ghsGroup.add(deckPlate);
        });

        // 4 Leveling feet on the y = 0 floor
        [[-0.24, -0.32], [0.24, -0.32], [-0.24, 0.32], [0.24, 0.32]].forEach(([dx, dz]) => {
            const foot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.032, 0.042, 0.05, 12),
                this.mats.anodizedBlackMount
            );
            foot.position.set(ghsX + dx, 0.025, dz);
            ghsGroup.add(foot);

            // 4 Vertical open-frame structural corner posts (allows 360° visibility of internal 3D tanks & valves!)
            const post = new THREE.Mesh(
                new THREE.BoxGeometry(0.034, ghsH - 0.06, 0.034),
                this.mats.brushedSilverPlate
            );
            post.position.set(ghsX + dx, ghsH * 0.5 + 0.02, dz);
            ghsGroup.add(post);
        });

        // Top Digital Telemetry Header Bar (ONLY on the +Z front face at Y = 2.02m — never duplicated on +X!)
        const headerChassis = new THREE.Mesh(
            new THREE.BoxGeometry(ghsW - 0.04, 0.16, 0.12),
            this.mats.anodizedBlackMount
        );
        headerChassis.position.set(ghsX, 2.02, ghsD * 0.5 - 0.06);
        ghsGroup.add(headerChassis);

        const headerScreenZ = new THREE.Mesh(
            new THREE.BoxGeometry(ghsW - 0.06, 0.14, 0.012),
            this.mats.ghsControlFaceplate
        );
        headerScreenZ.position.set(ghsX, 2.02, ghsD * 0.5 + 0.004);
        ghsGroup.add(headerScreenZ);

        // Helper to build a true 3D Mechanical Bourdon Pressure Gauge (brass body + white dial cylinder + 3D needle + torus bezel)
        const add3DPressureGauge = (gx, gy, gz, rotY = 0) => {
            const gaugeSub = new THREE.Group();
            gaugeSub.position.set(gx, gy, gz);
            gaugeSub.rotation.y = rotY;

            // Brass stem connecting gauge to pipe/manifold
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.008, 0.032, 10),
                this.mats.amberGoldBarrel
            );
            stem.position.y = -0.046;
            gaugeSub.add(stem);

            // Cylindrical stainless/brass gauge casing
            const casing = new THREE.Mesh(
                new THREE.CylinderGeometry(0.036, 0.036, 0.024, 20),
                this.mats.polishedSteel
            );
            casing.rotation.x = Math.PI / 2;
            gaugeSub.add(casing);

            // White dial face disk
            const dialFace = new THREE.Mesh(
                new THREE.CylinderGeometry(0.031, 0.031, 0.004, 20),
                this.mats.ejectorLatchWhite
            );
            dialFace.rotation.x = Math.PI / 2;
            dialFace.position.z = 0.012;
            gaugeSub.add(dialFace);

            // 3D Torus outer bezel ring
            const bezel = new THREE.Mesh(
                new THREE.TorusGeometry(0.034, 0.0045, 10, 24),
                this.mats.amberGoldBarrel
            );
            bezel.position.z = 0.013;
            gaugeSub.add(bezel);

            // 3D physical pointer needle & center brass pin
            const needle = new THREE.Mesh(
                new THREE.BoxGeometry(0.0035, 0.024, 0.003),
                this.mats.anodizedBlackMount
            );
            needle.position.set(0.005, 0.005, 0.015);
            needle.rotation.z = -0.65;
            gaugeSub.add(needle);

            const centerPin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.005, 0.005, 0.006, 10),
                this.mats.amberGoldBarrel
            );
            centerPin.rotation.x = Math.PI / 2;
            centerPin.position.z = 0.015;
            gaugeSub.add(centerPin);

            ghsGroup.add(gaugeSub);
        };

        // 3. LOWER DECK FRONT (Z = +0.16m): Twin 3D Stainless-Steel ³He / ⁴He Mixture Dump Tanks
        //    with hemispherical domes, brass manifold blocks, 3D handwheels, and 3D Bourdon gauges,
        //    plus continuous stainless riser pipes connecting up to the upper valve manifold!
        [[-0.14, this.mats.brushedSilverPlate], [0.14, this.mats.pulseTubeBlue]].forEach(([dx, tankMat], tIdx) => {
            const tx = ghsX + dx;
            const tz = 0.16;

            // Cylindrical pressure vessel body
            const tankBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.098, 0.098, 0.56, 28),
                tankMat
            );
            tankBody.position.set(tx, 0.38, tz);
            ghsGroup.add(tankBody);

            // Hemispherical top dome
            const topDome = new THREE.Mesh(
                new THREE.SphereGeometry(0.098, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
                this.mats.polishedSteel
            );
            topDome.position.set(tx, 0.66, tz);
            ghsGroup.add(topDome);

            // Base mounting ring on lower deck
            const baseSkirt = new THREE.Mesh(
                new THREE.CylinderGeometry(0.106, 0.112, 0.06, 24),
                this.mats.anodizedBlackMount
            );
            baseSkirt.position.set(tx, 0.09, tz);
            ghsGroup.add(baseSkirt);

            // Brass valve manifold block atop the dump cylinder
            const valveBlock = new THREE.Mesh(
                new THREE.BoxGeometry(0.065, 0.055, 0.065),
                this.mats.amberGoldBarrel
            );
            valveBlock.position.set(tx, 0.78, tz);
            ghsGroup.add(valveBlock);

            // 3D Valve handwheel on the side of the valve block
            const wheel = new THREE.Mesh(
                new THREE.TorusGeometry(0.028, 0.005, 8, 18),
                this.mats.copperCoax
            );
            wheel.position.set(tx, 0.78, tz + 0.048);
            ghsGroup.add(wheel);

            // Real 3D Bourdon pressure gauge mounted on each dump tank manifold
            add3DPressureGauge(tx, 0.85, tz + 0.032, 0);

            // Continuous 3D vertical stainless riser pipe connecting the dump tank manifold (Y = 0.78m)
            // through the mid-deck up into the upper gas-handling manifold block (Y = 1.28m)!
            const riserPipe = new THREE.Mesh(
                new THREE.CylinderGeometry(0.014, 0.014, 0.54, 12),
                this.mats.polishedSteel
            );
            riserPipe.position.set(tx, 1.03, tz - 0.06);
            ghsGroup.add(riserPipe);
        });

        // 4. LOWER DECK REAR (Z = -0.15m): 3D Cryomech CPA289C High-Pressure Helium Compressor Vessel,
        //    3D Helical Copper Heat-Exchanger Coil, Oil Adsorber Cartridge, and 4 Brass Flex-Hose Couplings
        const compX = ghsX - 0.08;
        const compZ = -0.16;

        // Dark-slate compressor pressure vessel cylinder
        const compVessel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.135, 0.135, 0.68, 28),
            this.mats.anodizedBlackMount
        );
        compVessel.position.set(compX, 0.42, compZ);
        ghsGroup.add(compVessel);

        // 3D Helical Copper Heat-Exchanger Aftercooler Coil wrapped around the compressor vessel
        const coilPts = [];
        const coilTurns = 6.5;
        const coilSamples = 120;
        for (let i = 0; i <= coilSamples; i++) {
            const u = i / coilSamples;
            const ang = u * coilTurns * Math.PI * 2;
            coilPts.push(new THREE.Vector3(
                compX + Math.cos(ang) * 0.158,
                0.16 + u * 0.52,
                compZ + Math.sin(ang) * 0.158
            ));
        }
        const copperHelix = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 100, 0.011, 8, false),
            this.mats.copperCoax
        );
        ghsGroup.add(copperHelix);

        // Vertical stainless oil-separator / charcoal adsorber cylinder beside the compressor
        const adsorberCyl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.058, 0.058, 0.66, 20),
            this.mats.polishedSteel
        );
        adsorberCyl.position.set(ghsX + 0.14, 0.41, -0.15);
        ghsGroup.add(adsorberCyl);

        // High/Low Helium Manifold Distribution Bar at Y = 0.86m where the 4 pulse-tube flex hoses plug in
        const heManifoldBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.06, 0.36),
            this.mats.brushedSilverPlate
        );
        heManifoldBar.position.set(-1.34, 0.86, -0.15);
        ghsGroup.add(heManifoldBar);

        // 2 Real 3D Bourdon Helium Supply/Return Pressure Gauges on the compressor manifold (facing +X/+Z)
        add3DPressureGauge(-1.28, 0.91, -0.22, Math.PI * 0.35);
        add3DPressureGauge(-1.28, 0.91, -0.08, Math.PI * 0.35);

        // 4 Brass Aeroquip Bulkhead Couplings at the exact termination coordinates of the 4 pulse-tube hoses
        compressorFittingCoords.forEach(({ x, y, z }) => {
            const bulkhead = new THREE.Mesh(
                new THREE.CylinderGeometry(0.017, 0.017, 0.045, 12),
                this.mats.amberGoldBarrel
            );
            bulkhead.position.set(x, y - 0.01, z);
            ghsGroup.add(bulkhead);
        });

        // 5. UPPER DECK (Y = 0.98..1.90m): 3D LN₂ Charcoal Cryo-Trap Dewar, Vacuum Manifold Matrix,
        //    6 Motorized Diaphragm Valves, and 3 Cylindrical Capacitance Manometers
        // 5A. Liquid-Nitrogen (LN₂) Cold Trap Dewar Cylinder on the rear-left of the upper deck
        const trapX = ghsX - 0.12;
        const trapZ = -0.16;
        const ln2Dewar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.105, 0.105, 0.68, 28),
            this.mats.polishedSteel
        );
        ln2Dewar.position.set(trapX, 1.38, trapZ);
        ghsGroup.add(ln2Dewar);

        // Brass KF flange collar on top of the LN₂ cold trap
        const trapFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(0.118, 0.118, 0.028, 28),
            this.mats.amberGoldBarrel
        );
        trapFlange.position.set(trapX, 1.73, trapZ);
        ghsGroup.add(trapFlange);

        // 3D Helical Copper Condensing Coil above the cold trap
        const trapCoilPts = [];
        for (let i = 0; i <= 60; i++) {
            const u = i / 60;
            const a = u * 4.5 * Math.PI * 2;
            trapCoilPts.push(new THREE.Vector3(
                trapX + Math.cos(a) * 0.122,
                1.14 + u * 0.46,
                trapZ + Math.sin(a) * 0.122
            ));
        }
        const trapCoil = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trapCoilPts), 64, 0.0085, 8, false),
            this.mats.copperCoax
        );
        ghsGroup.add(trapCoil);

        // 5B. CNC-Machined Stainless Vacuum Valve Manifold Block & Piping Matrix (Y = 1.28..1.82m)
        const manifoldBlock = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.085, 0.34),
            this.mats.brushedSilverPlate
        );
        manifoldBlock.position.set(ghsX + 0.02, 1.30, 0.10);
        ghsGroup.add(manifoldBlock);

        // Upper Stainless Vacuum Distribution Header Bar at Y = 1.78m (receives the 3 overhead pipes from the cryostat!)
        const upperHeaderBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.075, 0.36),
            this.mats.polishedSteel
        );
        upperHeaderBar.position.set(ghsX + 0.04, 1.78, 0.0);
        ghsGroup.add(upperHeaderBar);

        // 6 Real 3D Pneumatic/Motorized Diaphragm Valves + Vertical Stainless Interconnecting Pipes
        // bridging `manifoldBlock` (Y = 1.30m) and `upperHeaderBar` (Y = 1.78m)
        for (let v = 0; v < 6; v++) {
            const vx = ghsX - 0.08 + (v % 3) * 0.11;
            const vz = (v < 3) ? 0.02 : 0.18;

            // Vertical stainless pipe column between lower and upper manifold blocks
            const vPipe = new THREE.Mesh(
                new THREE.CylinderGeometry(0.013, 0.013, 0.48, 12),
                this.mats.polishedSteel
            );
            vPipe.position.set(vx, 1.54, vz);
            ghsGroup.add(vPipe);

            // Brass valve body tee at midpoint
            const vBody = new THREE.Mesh(
                new THREE.BoxGeometry(0.044, 0.048, 0.044),
                this.mats.amberGoldBarrel
            );
            vBody.position.set(vx, 1.52 + (v % 2) * 0.06, vz);
            ghsGroup.add(vBody);

            // Anodized Blue or Copper cylindrical pneumatic actuator head protruding forward (+Z)
            const actuator = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022, 0.022, 0.055, 14),
                v % 2 === 0 ? this.mats.pulseTubeBlue : this.mats.copperCoax
            );
            actuator.rotation.x = Math.PI / 2;
            actuator.position.set(vx, 1.52 + (v % 2) * 0.06, vz + 0.042);
            ghsGroup.add(actuator);
        }

        // 3 Cylindrical MKS / Pfeiffer Capacitance Manometer Vacuum Transducers on the front of the upper header
        [-0.10, 0.0, 0.10].forEach((mx) => {
            const transducer = new THREE.Mesh(
                new THREE.CylinderGeometry(0.020, 0.020, 0.085, 16),
                this.mats.polishedSteel
            );
            transducer.rotation.x = Math.PI / 2;
            transducer.position.set(ghsX + 0.04 + mx, 1.78, 0.22);
            ghsGroup.add(transducer);

            const cap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16),
                this.mats.anodizedBlackMount
            );
            cap.rotation.x = Math.PI / 2;
            cap.position.set(ghsX + 0.04 + mx, 1.78, 0.265);
            ghsGroup.add(cap);
        });

        // Stainless pipe bridging the LN₂ Cold Trap (`trapX, 1.73, trapZ`) to `upperHeaderBar`
        const trapBridgeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(trapX, 1.74, trapZ),
            new THREE.Vector3(trapX, 1.85, trapZ * 0.5),
            new THREE.Vector3(ghsX + 0.04, 1.85, -0.12),
            new THREE.Vector3(ghsX + 0.04, 1.78, -0.12)
        ]);
        const trapBridgeMesh = new THREE.Mesh(
            new THREE.TubeGeometry(trapBridgeCurve, 20, 0.016, 10, false),
            this.mats.polishedSteel
        );
        ghsGroup.add(trapBridgeMesh);

        // 6. Three Overhead Stainless-Steel & Copper ³He / ⁴He Circulation & Turbo Pumping Lines
        //    running from 3D KF flange collars on the central 300K turret (`X = 0`) across the -X
        //    overhead bridge and plugging straight into 3D brass KF collars on `upperHeaderBar` (`Y = 1.82m`)!
        [-0.09, 0.0, 0.09].forEach((pipeZ, pIdx) => {
            const pipeRadius = pIdx === 1 ? 0.024 : 0.015; // Central Still turbo line is larger diameter
            const pipeMat = pIdx === 0 ? this.mats.copperCoax : this.mats.polishedSteel;
            const endX = ghsX + 0.04;
            const endY = 1.81;

            const pipeCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.08, flangeTopY + 0.20, pipeZ),
                new THREE.Vector3(-0.42, flangeTopY + 0.24, pipeZ),
                new THREE.Vector3(-1.08, flangeTopY + 0.22, pipeZ),
                new THREE.Vector3(endX, 2.18, pipeZ),
                new THREE.Vector3(endX, endY, pipeZ)
            ]);
            const pipeMesh = new THREE.Mesh(
                new THREE.TubeGeometry(pipeCurve, 32, pipeRadius, 12, false),
                pipeMat
            );
            ghsGroup.add(pipeMesh);

            // 3D Brass KF vacuum flange collar where each overhead pipe plugs into `upperHeaderBar`
            const endCollar = new THREE.Mesh(
                new THREE.CylinderGeometry(pipeRadius * 1.45, pipeRadius * 1.45, 0.028, 16),
                this.mats.amberGoldBarrel
            );
            endCollar.position.set(endX, endY + 0.014, pipeZ);
            ghsGroup.add(endCollar);
        });

        this.registerNode('gas_handling_system', ghsGroup, 'helium_system', 26);
    }
}

window.GoogleQuantumComputer = GoogleQuantumComputer;
