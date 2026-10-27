/**
 * interaction.js
 * Implements the complete interactive subsystem modes, floating 3D nametags,
 * pulsing highlight outlines, raycast picking, expandable Info Box, and 22-step
 * sequential camera fly-to tour from apps.fz-juelich.de/qcmodel/objectInteraction.js
 * (adapted for the Google Quantum AI Willow / Sycamore Quantum Computer).
 */

class QuantumObjectInteraction {
    constructor(app, qcModel) {
        this.app = app;
        this.scene = app.scene;
        this.camera = app.camera;
        this.controls = app.controls;
        this.renderer = app.renderer;
        this.qc = qcModel;

        // Friendly Google Lab subsystem mode colors (Blue, Green, Yellow, Red, Purple, Teal)
        this.colModes = {
            default: '#1a73e8',
            hull: '#9334e6',
            plates: '#f9ab00',
            electronic_circuit: '#34a853',
            room_temp_control: '#ea4335',
            helium_system: '#4285f4',
            frame: '#fbbc04',
            single: '#5f6368'
        };

        this.currentSelection = 'default'; // 'default', modeName string, or meshName string
        this.currentMode = 'none';
        this.currentSeq = 0;
        this.showUI = true;
        this.infoBoxClosed = false;
        this.pulseAlpha = 0;

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.hoveredMeshName = null;
        this.highlightedNodes = []; // [{ node, colorHex, isPrimary }]
        this.cameraAnim = null;

        this.initCatalogAndCameraTargets();
        this.initFloatingNametags();
        this.initModeAndTourControls();
        this.initPointerEvents();
    }

    /**
     * Helper to convert qc_v15.gltf reference coordinates (X, Y_up, Z) into our scaled lab space
     */
    pos(x, y, z) {
        return this.qc.pos(x, y, z);
    }

    initCatalogAndCameraTargets() {
        // Complete 28-step sequence (seq: 0..27) combining the Forschungszentrum Jülich
        // scientific descriptions (en_US.xml) with Google Quantum AI (Willow / Sycamore) hardware details,
        // 300K Top Hermetic Breakout Manifolds, Color-Coded Room-Temp Coaxial Looms, 6U RF-DAC/FPGA Control Crates,
        // Pulse-Tube Cryocoolers, Bluefors Gas Handling Cabinet, and the Extended 3D T-Slot Gantry Frame.
        this.catalog = {
            default: {
                seq: 0,
                mode: 'default',
                name: 'Overview',
                title: 'Google Quantum AI Cryostat, Room-Temp Wiring, Control Racks & Extended Gantry',
                category: 'OVERVIEW // SEQ 0/27',
                text: 'Welcome to the complete interactive 3D model of the <strong>Google Quantum AI Dilution Refrigerator</strong>, its <strong>300K Top Hermetic Breakout Towers</strong>, <strong>Color-Coded Umbilical Coax Looms</strong>, <strong>Room-Temperature RF-DAC/FPGA Control Rack</strong>, and <strong>³He/⁴He Gas Handling Cabinet</strong> anchored in the extended <strong>Extruded Aluminum T-Slot Gantry</strong>.',
                textDetails: 'Modeled directly after <code>sci_news_14467_quantum_computer.jpg</code>, <code>Dilution_Fridge_009_8K.png</code>, and <code>Google_Quantum_AI_Cryostat.jpg</code>: click any component on the chandelier, overhead wiring bridge, control electronics rack, or gas handling cabinet, select a subsystem on the right, or use <strong>Next / Prev</strong>.',
                camPos: new THREE.Vector3(0.0, 1.38, 3.85),
                camTarget: new THREE.Vector3(0.0, 1.22, 0.0)
            },
            hull: {
                seq: 1,
                mode: 'hull',
                name: 'Hull (Cryostat Shield)',
                title: 'Google Quantum AI Artistic Outer Vacuum Hull',
                category: 'VACUUM & THERMAL SHIELD // SEQ 1/22',
                text: 'The cryostat’s outer <strong>vacuum hull</strong> acts as a hermetic vacuum enclosure and thermal radiation shield required to maintain millikelvin temperatures within, while also insulating the processor from electromagnetic interference.',
                textDetails: 'At Google Quantum AI’s Santa Barbara campus (as seen in the background of <code>Google_Quantum_AI_Cryostat.jpg</code>), the outer cylindrical vacuum cans are wrapped in high-contrast geometric mural art with bolted stainless-steel top and bottom vacuum flanges.',
                camPos: this.pos(0.0, 3.25, 8.4),
                camTarget: this.pos(0.0, 2.95, 0.0)
            },
            plates: {
                seq: 2,
                mode: 'plates',
                name: 'Bulk of Cryostat',
                title: 'Gold-Plated Copper Cryogenic Stage Disks & Gold Standoff Collars',
                category: 'CRYOGENIC STAGES // SEQ 2/22',
                text: 'Five <strong>gold-plated OFHC copper disks</strong> linked by 4 brushed stainless-steel support columns with machined <strong>gold cylindrical collar sleeves</strong>, operating from <strong>~50 K (-223 °C)</strong> down to <strong>10 mK (-273.14 °C)</strong>.',
                textDetails: 'Matching <code>Google_Quantum_AI_Cryostat.jpg</code>, each stage disk features chamfered gold rims, CNC radial stiffening ribs, circular manifold cutouts, and rows of brass SMA bulkhead feedthroughs around the perimeter.',
                camPos: this.pos(0.0, 3.45, 6.8),
                camTarget: this.pos(0.0, 3.35, 0.0)
            },
            electronic_circuit: {
                seq: 3,
                mode: 'electronic_circuit',
                name: 'Electronic Circuits',
                title: 'Copper-Bronze Semi-Rigid Coaxial Looms & Readout Chain',
                category: 'MICROWAVE SUBSYSTEM // SEQ 3/22',
                text: 'Dense curtains of <strong>copper-bronze semi-rigid coaxial cables</strong> and stage-clamped attenuators connect the quantum processor at 10 mK with room-temperature control racks.',
                textDetails: 'Below the 10 mK Mixing Chamber plate, two symmetrical left and right bundles of 10 copper-bronze coaxial cables sweep downward and curve 90° inward into 20 horizontal brass SMA ports on the vertical gold QPU enclosure.',
                camPos: this.pos(0.0, 3.15, 6.2),
                camTarget: this.pos(0.0, 2.55, 0.0)
            },
            cables_control: {
                seq: 4,
                mode: 'electronic_circuit',
                name: 'Control lines',
                title: 'Copper-Bronze Semi-Rigid Coaxial Control Lines',
                category: 'ELECTRONIC CIRCUITS // SEQ 4/22',
                text: '<strong>Control lines</strong> transmit shaped microwave XY gate pulses and fast Z flux-bias pulses from the top vacuum flange through every stage down to the QPU.',
                textDetails: 'Matching <code>Google_Quantum_AI_Cryostat.jpg</code>, dozens of warm copper-bronze semi-rigid coaxial tubes pass through brass SMA bulkhead nuts on each gold stage plate, bowed in graceful S-curves to absorb thermal contraction during cooldown.',
                nametagPos: this.pos(0.95, 3.10, 0.35),
                camPos: this.pos(1.85, 3.10, 1.75),
                camTarget: this.pos(0.65, 3.05, 0.25)
            },
            cables_measuring: {
                seq: 5,
                mode: 'electronic_circuit',
                name: 'Measurement lines',
                title: 'Superconducting Readout Lines & Lower QPU Coax Bundles',
                category: 'ELECTRONIC CIRCUITS // SEQ 5/22',
                text: '<strong>Measurement lines</strong> carry single-photon microwave readout signals from the vertical gold QPU housing out through the 4-tier isolator/TWPA stack and 4 K HEMT amplifiers.',
                textDetails: 'Notice the symmetrical left and right U-shaped bundles of 10 copper-bronze coaxial cables below the 10 mK plate that curve horizontally into the 20 brass SMA connectors along the sides of the gold QPU paddle.',
                nametagPos: this.pos(-0.78, 1.05, 0.25),
                camPos: this.pos(-1.65, 1.15, 1.65),
                camTarget: this.pos(-0.35, 1.02, 0.10)
            },
            HEMTS: {
                seq: 6,
                mode: 'electronic_circuit',
                name: 'HEMTs',
                title: '4K Low-Noise Cryogenic HEMT Amplifiers',
                category: 'ELECTRONIC CIRCUITS // SEQ 6/22',
                text: 'Mounted beneath the 4 K stage, the <strong>HEMTs</strong> (High-Electron-Mobility Transistor amplifiers) provide ~40 dB of low-noise second-stage amplification for readout signals leaving the cryostat.',
                textDetails: 'Because semiconductor HEMT amplifiers dissipate several milliwatts of active DC heat, they are thermally anchored with gold-plated copper clamps to the high-cooling-power 4 K plate.',
                nametagPos: this.pos(-0.82, 4.42, 0.18),
                camPos: this.pos(-1.75, 4.42, 1.15),
                camTarget: this.pos(-0.62, 4.40, 0.15)
            },
            power_supply: {
                seq: 7,
                mode: 'electronic_circuit',
                name: 'Power supply cables for HEMT',
                title: 'Twisted-Pair Bronze DC Bias Loom for HEMTs',
                category: 'ELECTRONIC CIRCUITS // SEQ 7/22',
                text: '<strong>Power supply cables</strong> deliver regulated low-noise DC drain and gate bias voltages from room-temperature electronics down to the 4 K HEMT amplifiers.',
                textDetails: 'Twisted-pair phosphor-bronze and manganin DC looms are thermally clamped at the 50 K and 4 K plates to filter out low-frequency electrical noise and prevent room-temperature heat from reaching the amplifiers.',
                nametagPos: this.pos(-0.66, 5.15, 0.18),
                camPos: this.pos(-1.55, 5.10, 1.45),
                camTarget: this.pos(-0.58, 4.95, 0.15)
            },
            filter_bandpass: {
                seq: 8,
                mode: 'electronic_circuit',
                name: 'Bandpass filters',
                title: 'Multi-Channel Cryogenic Bandpass & IR Filter Banks',
                category: 'ELECTRONIC CIRCUITS // SEQ 8/22',
                text: 'Gold-plated <strong>bandpass and infrared filter banks</strong> above the 90 mK and 10 mK stages strip away out-of-band electromagnetic and thermal blackbody radiation.',
                textDetails: 'Combined with Eccosorb infrared-absorptive filter sections, these machined gold manifold blocks prevent stray gigahertz/terahertz photons from breaking Cooper pairs in the superconducting aluminum qubits.',
                nametagPos: this.pos(0.82, 1.85, 0.35),
                camPos: this.pos(1.55, 1.90, 1.45),
                camTarget: this.pos(0.55, 1.82, 0.25)
            },
            attenuators: {
                seq: 9,
                mode: 'electronic_circuit',
                name: 'Attenuators',
                title: 'Brass SMA Bulkhead Attenuators (50K – 10mK)',
                category: 'ELECTRONIC CIRCUITS // SEQ 9/22',
                text: 'Dense concentric rings of inline <strong>cryogenic attenuators</strong> at every stage plate reduce microwave signal amplitude and thermalize the inner conductor of each coaxial cable.',
                textDetails: 'Resistive thin-film attenuators (~20 dB at 4 K, ~10 dB at 800 mK, ~20 dB at 10 mK) dissipate room-temperature Johnson-Nyquist thermal noise photons so the control lines reach true millikelvin noise floors.',
                nametagPos: this.pos(0.95, 3.65, 0.35),
                camPos: this.pos(1.65, 3.65, 1.55),
                camTarget: this.pos(0.68, 3.62, 0.25)
            },
            open_cable: {
                seq: 10,
                mode: 'electronic_circuit',
                name: 'Open coaxial cable',
                title: 'Cutaway Semi-Rigid Coaxial Line (PTFE Core)',
                category: 'ELECTRONIC CIRCUITS // SEQ 10/22',
                text: 'This <strong>open cutaway coaxial cable</strong> illustrates the internal three-layer coaxial structure of a cryogenic microwave line.',
                textDetails: 'From outside to inside: (1) the outer copper-bronze shield jacket, (2) the white cylindrical dielectric insulator made of <strong>PTFE (Teflon)</strong>, and (3) the solid center gold-plated conductor pin.',
                nametagPos: this.pos(0.88, 1.28, 0.32),
                camPos: this.pos(1.35, 1.32, 1.15),
                camTarget: this.pos(0.72, 1.30, 0.28)
            },
            qpu: {
                seq: 11,
                mode: 'electronic_circuit',
                name: 'QPU Chip (Willow / Sycamore)',
                title: 'Google Quantum AI Willow (105-Qubit) & Sycamore Flip-Chip QPU',
                category: 'QUANTUM PROCESSOR CHIP // SEQ 11/22',
                text: 'Mounted at the <strong>10 millikelvin</strong> base stage, the <strong>Google Willow / Sycamore QPU</strong> consists of a dark silicon qubit die flip-chip bonded via superconducting indium micro-bumps onto a mirror-silver silicon interposer with radial microwave fan-out traces.<div class="qpu-closeup-gallery"><div class="qpu-closeup-card"><img src="assets/references/Google_Willow_Quantum_Chip.jpg" alt="Google Willow 105-Qubit Chip"><span>Google Willow (105-Qubit) Flip-Chip QPU</span></div><div class="qpu-closeup-card"><img src="assets/references/Google_Sycamore_Chip_001.png" alt="Sycamore Radial Fan-Out Interposer"><span>Radial Fan-Out Traces &amp; Flip-Chip Die</span></div></div>',
                textDetails: 'Patterned on a high-resistivity silicon substrate using superconducting aluminum (T_c ≈ 1.2 K) and Al/AlOx/Al Josephson junctions. In Google’s 105-qubit <em>Willow</em> and 53-qubit <em>Sycamore</em> processors, cross-shaped Xmon transmon qubits and tunable couplers are flip-chip bonded onto a multi-layer routing interposer framed by a chamfered brushed-aluminum cryo-carrier.<div class="qpu-closeup-gallery" style="margin-top:8px;"><div class="qpu-closeup-card"><img src="assets/references/Sycamore_Quantum_Chip.jpg" alt="Sycamore Carrier Package"><span>Chamfered Cryo-Carrier Frame</span></div><div class="qpu-closeup-card"><img src="assets/references/Cross-Shaped_Transmon_with_2_Josephson_Junctions_003.png" alt="Xmon Transmon Qubit"><span>Xmon Transmon Qubit &amp; Josephson Junctions</span></div></div>',
                nametagPos: this.pos(-0.34, 1.04, 0.28),
                camPos: this.pos(0.0, 1.15, 0.92),
                camTarget: this.pos(0.0, 1.02, 0.24)
            },
            isolator: {
                seq: 12,
                mode: 'electronic_circuit',
                name: 'Microwave isolators',
                title: '4-Tier Stacked Cryogenic Ferrite Isolator Array',
                category: 'ELECTRONIC CIRCUITS // SEQ 12/22',
                text: '<strong>Microwave isolators</strong> act as one-way electromagnetic check valves below the 10 mK plate that prevent amplifier back-action noise from reaching and decohering the QPU.',
                textDetails: 'Visible in <code>Google_Quantum_AI_Cryostat.jpg</code> immediately behind and above the QPU assembly, these stacked silver and gold rectangular housings contain permanently magnetized ferrite circulator junctions.',
                nametagPos: this.pos(0.55, 1.28, -0.18),
                camPos: this.pos(1.35, 1.28, 0.95),
                camTarget: this.pos(0.28, 1.26, -0.18)
            },
            directional_coupler: {
                seq: 13,
                mode: 'electronic_circuit',
                name: 'Directional coupler',
                title: 'Cryogenic 4-Port Microwave Directional Coupler',
                category: 'ELECTRONIC CIRCUITS // SEQ 13/22',
                text: '<strong>Directional couplers</strong> route microwave pump tones into the parametric amplifier while isolating the QPU from reflected pump power.',
                textDetails: 'Mounted in the multi-tier 10 mK readout rack immediately above the TWPA, the directional coupler combines the weak single-photon readout signal from the QPU with a clean microwave pump tone.',
                nametagPos: this.pos(-0.55, 1.32, -0.18),
                camPos: this.pos(-1.25, 1.30, 1.05),
                camTarget: this.pos(-0.28, 1.30, -0.18)
            },
            TWPA: {
                seq: 14,
                mode: 'electronic_circuit',
                name: 'TWPA',
                title: 'Traveling-Wave Parametric Amplifier (TWPA)',
                category: 'ELECTRONIC CIRCUITS // SEQ 14/22',
                text: 'The <strong>TWPA</strong> (Traveling-Wave Parametric Amplifier) provides the critical first stage of quantum-limited readout amplification at 10 mK.',
                textDetails: 'Built from a nonlinear Josephson-junction metamaterial transmission line inside a gold-clamped magnetic shield, the TWPA amplifies single-photon readout pulses with near-quantum-limited noise before sending them up to the 4 K HEMTs.',
                nametagPos: this.pos(-0.55, 1.12, -0.18),
                camPos: this.pos(-1.25, 1.12, 1.05),
                camTarget: this.pos(-0.28, 1.12, -0.18)
            },
            helium_system: {
                seq: 15,
                mode: 'helium_system',
                name: 'Helium gas system',
                title: 'Helium-3 / Helium-4 Dilution Column & Helical Coils',
                category: 'CRYOGENIC COOLING // SEQ 15/22',
                text: 'The central <strong>Helium-3 / Helium-4 dilution system</strong> features prominent thick helical cupronickel cooling coils wrapped around the central stainless column down to <strong>10 millikelvin</strong>.',
                textDetails: 'Matching <code>Google_Quantum_AI_Cryostat.jpg</code>, the central stainless column is wrapped in multi-turn helical tubular heat exchangers between the 4 K, 800 mK, and 90 mK stages, driving continuous endothermic mixing of ³He into superfluid ⁴He.',
                camPos: this.pos(0.0, 3.25, 6.6),
                camTarget: this.pos(0.0, 2.95, 0.0)
            },
            gas_pipe: {
                seq: 16,
                mode: 'helium_system',
                name: 'Helium gas pipes',
                title: 'Concentric Helium Supply & Return Column',
                category: 'HELIUM GAS SYSTEM // SEQ 16/22',
                text: 'The central <strong>helium gas column</strong> comprises concentric stainless-steel and copper capillary tubes running down the spine of the chandelier.',
                textDetails: 'As revealed by the cutaway window above the 4 K plate, the inner copper capillary injects purified, pre-cooled ³He down into the condensation circuit, while the outer stainless tube evacuates low-pressure ³He vapor from the Still.',
                nametagPos: this.pos(-0.26, 5.36, 0.0),
                camPos: this.pos(0.0, 5.36, 2.15),
                camTarget: this.pos(0.0, 5.36, 0.0)
            },
            still: {
                seq: 17,
                mode: 'helium_system',
                name: 'Still',
                title: 'Still Distillation Chamber & Upper Helical Coil (~800 mK)',
                category: 'HELIUM GAS SYSTEM // SEQ 17/22',
                text: 'Anchored above the ~800 mK plate and wrapped by the upper 5-turn helical cooling coil, the <strong>Still</strong> selectively evaporates Helium-3 out of the dilute mixture.',
                textDetails: 'Because lighter ³He has a much higher vapor pressure than ⁴He at ~800 mK, gently heating the Still causes >95% pure ³He to evaporate, driving osmotic circulation across the Mixing Chamber below.',
                nametagPos: this.pos(-0.32, 3.95, 0.0),
                camPos: this.pos(-1.45, 3.95, 1.65),
                camTarget: this.pos(0.0, 3.95, 0.0)
            },
            heat_exchanger_round: {
                seq: 18,
                mode: 'helium_system',
                name: 'Continuous heat exchanger',
                title: 'Thick Multi-Turn Helical Capillary Heat Exchanger',
                category: 'HELIUM GAS SYSTEM // SEQ 18/22',
                text: 'The prominent 6-turn helical <strong>continuous heat exchanger</strong> coiled around the central column precools incoming concentrated ³He between the 800 mK and 90 mK plates.',
                textDetails: 'Directly modeled after the thick silver/copper spiral coil at the center of <code>Google_Quantum_AI_Cryostat.jpg</code>, counter-flow heat exchange cools the incoming liquid stream down to ~40 mK before it enters the sintered step heat exchangers.',
                nametagPos: this.pos(-0.34, 3.10, 0.0),
                camPos: this.pos(-1.65, 3.10, 1.35),
                camTarget: this.pos(0.0, 3.10, 0.0)
            },
            heat_exchanger_steps: {
                seq: 19,
                mode: 'helium_system',
                name: 'Step heat exchanger',
                title: '5-Stage Sintered Silver Step Heat Exchanger',
                category: 'HELIUM GAS SYSTEM // SEQ 19/22',
                text: 'The <strong>step heat exchanger</strong> overcomes Kapitza thermal boundary resistance to cool the helium stream from ~40 mK down to < 10 mK.',
                textDetails: 'Each vertical cylindrical step cell is packed with pressed sintered silver powder, providing tens of square meters of surface area inside a few cubic centimeters between the 90 mK Cold Plate and 10 mK Mixing Chamber.',
                nametagPos: this.pos(-0.26, 2.15, 0.0),
                camPos: this.pos(-1.55, 2.15, 1.05),
                camTarget: this.pos(0.0, 2.15, 0.0)
            },
            mixing_chamber: {
                seq: 20,
                mode: 'helium_system',
                name: 'Mixing chamber',
                title: 'He-3 / He-4 Mixing Chamber (10 mK Base Stage)',
                category: 'HELIUM GAS SYSTEM // SEQ 20/22',
                text: 'Inside the <strong>Mixing Chamber</strong>, the cryostat’s coldest temperature (~10 mK) is generated by endothermic dilution of ³He into superfluid ⁴He.',
                textDetails: 'As ³He atoms cross the phase boundary downward into superfluid ⁴He, they absorb latent heat from the gold-plated copper walls and cool the 10 mK Mixing Chamber plate and suspended QPU package.',
                nametagPos: this.pos(-0.28, 1.75, 0.0),
                camPos: this.pos(-1.25, 1.75, 1.55),
                camTarget: this.pos(0.0, 1.75, 0.0)
            },
            plaque: {
                seq: 21,
                mode: 'single',
                name: '300K Top Vacuum Flange',
                title: 'Top 300 K Room-Temperature Vacuum Flange & Turret Collar',
                category: 'VACUUM & GANTRY INTERFACE // SEQ 21/27',
                text: 'The 300 K stainless-steel top vacuum flange suspends the entire dilution refrigerator chandelier from the central bridge beams of the T-slot aluminum gantry frame.',
                textDetails: 'Forms the primary O-ring vacuum seal between the room-temperature laboratory environment above and the 10⁻⁶ mbar cryogenic vacuum vessel below.',
                nametagPos: this.pos(-0.75, 5.98, 0.0),
                camPos: this.pos(0.0, 6.25, 2.45),
                camTarget: this.pos(0.0, 5.88, 0.0)
            },
            room_temp_control: {
                seq: 22,
                mode: 'room_temp_control',
                name: 'Room-Temp Wiring & Racks',
                title: '300K Breakout Towers, Color-Coded Coax Looms & RF-DAC Control Rack',
                category: 'ROOM-TEMPERATURE CONTROL EXTENSION // SEQ 22/27',
                text: 'Above and outside the cryostat, signals cross the 300 K vacuum boundary through <strong>8 Finned Aluminum Hermetic Breakout Towers</strong>, travel across the overhead T-slot bridge in <strong>color-coded coaxial cable bundles</strong> (Green, Blue, Yellow, White), and plug into <strong>4 stacked 6U Google RF-DAC/FPGA Control Crates</strong>.',
                textDetails: 'Modeled directly after <code>sci_news_14467_quantum_computer.jpg</code> and <code>Dilution_Fridge_009_8K.png</code>: click any nametag on the top breakout towers, the hanging color-coded coax drapes, or the 19-inch Control Electronics Rack to inspect each stage of the room-temperature signal path.',
                camPos: new THREE.Vector3(0.95, 1.65, 2.85),
                camTarget: new THREE.Vector3(0.75, 1.48, 0.0)
            },
            top_breakout_manifolds: {
                seq: 22,
                mode: 'room_temp_control',
                name: '300K Hermetic Breakout Towers',
                title: '8 Radial 300K Finned Aluminum Coax Feedthrough Towers & DC Turrets',
                category: 'ROOM-TEMP VACUUM INTERFACE // SEQ 22/27',
                text: 'Protruding above the 300 K top flange directly in line with the 8 internal coaxial pods are <strong>8 CNC-milled finned aluminum hermetic breakout manifolds</strong> with gold multi-SMA bulkhead patch plates.<div class="qpu-closeup-gallery"><div class="qpu-closeup-card"><img src="assets/references/Dilution_Fridge_009_8K.png" alt="Top 300K Hermetic Breakout Towers"><span>8 Top Finned Breakout Manifolds</span></div><div class="qpu-closeup-card"><img src="assets/references/Google_Quantum_AI_Cryostat.jpg" alt="300K Top Turret & Gantry Deck"><span>300K Top Deck &amp; Gantry Mount</span></div></div>',
                textDetails: 'Each hermetic feedthrough tower transitions 21+ internal semi-rigid cryogenic coax lines across an O-ring vacuum seal into room-temperature SMA jacks, accompanied by 4 multi-pin Fischer/Lemo turrets for DC HEMT bias and Ruthenium-Oxide stage thermometry.',
                nametagPos: new THREE.Vector3(0.32, 2.50, 0.28),
                camPos: new THREE.Vector3(0.85, 2.68, 1.25),
                camTarget: new THREE.Vector3(0.05, 2.42, 0.0)
            },
            room_temp_wiring: {
                seq: 23,
                mode: 'room_temp_control',
                name: 'Color-Coded Umbilical Coax Looms',
                title: 'Green, Blue, Yellow & White Room-Temperature Coaxial Cable Bundles',
                category: 'ROOM-TEMP SIGNAL ROUTING // SEQ 23/27',
                text: 'Emerging from the 8 top hermetic breakout towers, <strong>168+ color-coded room-temperature coaxial cables</strong> route across the overhead aluminum ladder tray and sweep down in catenary loops bound with <strong>black Velcro straps</strong> into the control electronics crates.<div class="qpu-closeup-gallery"><div class="qpu-closeup-card"><img src="assets/references/sci_news_14467_quantum_computer.jpg" alt="Color-Coded Coax Bundles & Control Rack"><span>Green/Blue/Yellow Coax Looms (Right)</span></div><div class="qpu-closeup-card"><img src="assets/references/Google_Quantum_AI_Cryostat.jpg" alt="Overhead Cable Bridge & Rack"><span>Overhead T-Slot Bridge &amp; Rack</span></div></div>',
                textDetails: 'Color coding matches Google Quantum AI’s Santa Barbara laboratory hardware: <strong>Emerald-Green</strong> for XY microwave qubit gate pulses (4–8 GHz), <strong>Royal-Blue</strong> for fast Z flux-bias & tunable coupler pulses, <strong>Amber-Yellow</strong> for multiplexed readout & TWPA pump tones, and <strong>Silver-White</strong> for 10 MHz / 1 GHz phase-locked clock & DC bias distribution.',
                nametagPos: new THREE.Vector3(1.05, 1.58, 0.26),
                camPos: new THREE.Vector3(1.15, 1.58, 1.65),
                camTarget: new THREE.Vector3(1.15, 1.42, 0.08)
            },
            control_electronics_rack: {
                seq: 24,
                mode: 'room_temp_control',
                name: 'RF-DAC / FPGA Control Rack',
                title: 'Google Quantum AI 19-Inch Custom RF-DAC, FPGA & Readout ADC Rack',
                category: 'ROOM-TEMP CONTROL ELECTRONICS // SEQ 24/27',
                text: 'Standing in the <code>+X</code> bay of the extended T-slot gantry is the <strong>19-inch Room-Temperature Control Electronics Rack</strong> housing <strong>4 stacked 6U custom RF-DAC / FPGA subracks</strong> and a <strong>Master Rubidium Clock &amp; LO Synthesizer</strong>.',
                textDetails: 'Directly modeled after the open rack visible on the right of <code>sci_news_14467_quantum_computer.jpg</code>: each 6U subrack holds 12 modular Eurocard blades with royal-blue anodized faceplates, top/bottom white card-ejector latches, and dual columns of gold SMA jacks that synthesize nanosecond-envelope microwave XY pulses, fast Z flux waveforms, and demodulate multi-qubit readout signals.',
                nametagPos: new THREE.Vector3(1.42, 1.78, 0.44),
                camPos: new THREE.Vector3(1.42, 1.38, 1.85),
                camTarget: new THREE.Vector3(1.42, 1.28, 0.0)
            },
            pulse_tube_assembly: {
                seq: 25,
                mode: 'helium_system',
                name: 'Pulse-Tube Cryocoolers & He Flex Lines',
                title: 'Twin Cryomech PT415/PT420 Pulse-Tube Cold Heads & Helium Flex Hoses',
                category: 'CRYOGEN-FREE PRECOOLING // SEQ 25/27',
                text: 'Mounted on the 300 K top deck are twin <strong>Pulse-Tube Cryocooler Cold Heads</strong> with stacked copper heat-exchanger fins, anodized blue rotary valve stepper motors, and 4 braided stainless-steel high-pressure helium flex hoses.',
                textDetails: 'Driven by high-pressure helium gas (220 PSI supply / 82 PSI return) from the compressor module across the <code>-X</code> overhead bridge, the pulse tubes cool the 50 K and 4 K silver stages acoustically without liquid helium bath refills.',
                nametagPos: new THREE.Vector3(-0.48, 2.55, 0.34),
                camPos: new THREE.Vector3(-0.95, 2.65, 1.35),
                camTarget: new THREE.Vector3(-0.48, 2.42, 0.0)
            },
            gas_handling_system: {
                seq: 26,
                mode: 'helium_system',
                name: '³He/⁴He Gas Handling & Pump Rack',
                title: 'Top Turbo-Pump Manifold & Bluefors ³He/⁴He Gas Handling Cabinet',
                category: 'CLOSED-LOOP HELIUM CIRCULATION // SEQ 26/27',
                text: 'Rising from the center of the 300 K flange is the <strong>stainless-steel turbo-molecular pump &amp; KF-50 vacuum manifold</strong>, connected via overhead circulation pipes to the floor-standing <strong>³He/⁴He Gas Handling &amp; Compressor Cabinet</strong> in the <code>-X</code> bay.',
                textDetails: 'The Gas Handling System (GHS) continuously pumps low-pressure ³He vapor out of the Still (~800 mK), purifies it through liquid-nitrogen/charcoal cold traps, and re-injects it down the central capillary column while monitoring all stage pressures and storing the ³He/⁴He gas mixture in the lower dump cylinders.',
                nametagPos: new THREE.Vector3(-1.42, 1.72, 0.44),
                camPos: new THREE.Vector3(-1.42, 1.38, 1.85),
                camTarget: new THREE.Vector3(-1.42, 1.25, 0.0)
            },
            frame: {
                seq: 27,
                mode: 'frame',
                name: 'Extended T-Slot Gantry & Cable Bridge',
                title: 'Extended 3D Extruded Aluminum T-Slot Gantry, Cable Trays & Floor Anchoring',
                category: 'STRUCTURAL SUPPORT & CABLE BRIDGE // SEQ 27/27',
                text: 'Modeled after <code>Google_Quantum_AI_Cryostat.jpg</code> and <code>FRAME_AND_ANCHORING_GUIDE.md</code>, this <strong>extended 3D extruded aluminum T-slot gantry frame</strong> supports the central cryostat and bridges across to both the <code>+X</code> Control Electronics Rack and <code>-X</code> Gas Handling Cabinet.',
                textDetails: 'Features 4 central T-slot columns, 4 outer equipment-bay outrigger columns, overhead perforated aluminum ladder cable trays, 45° mitered gusset braces, lower perimeter stabilizer rails, and a unified 5.4m × 4.2m floor contact AO & specular reflection catcher locked at <code>y = 0</code>.',
                nametagPos: new THREE.Vector3(-0.86, 1.35, 0.86),
                camPos: new THREE.Vector3(1.95, 1.55, 3.45),
                camTarget: new THREE.Vector3(0.0, 1.20, 0.0)
            }
        };

        // Alias gantry_frame mesh name to frame catalog entry for direct raycast clicks
        this.catalog.gantry_frame = this.catalog.frame;

        // Also define the stage plate temperature nametags (shown when mode === 'plates')
        this.plateNametagSpecs = [
            { id: 'plate_0', text: '~50K (-223°C) [Silver Stage]', pos: this.pos(-1.28, 5.52, 0.0) },
            { id: 'plate_1', text: '~4K (-269°C) [Silver Stage]', pos: this.pos(-1.24, 4.86, 0.0) },
            { id: 'plate_2', text: '~800mK (-272.35°C) [Gold Stage]', pos: this.pos(-1.18, 4.16, 0.0) },
            { id: 'plate_3', text: '300mK (-272.85°C) [Gold Stage]', pos: this.pos(-1.15, 3.46, 0.0) },
            { id: 'plate_4', text: '90mK / 10mK [Mixing Chamber]', pos: this.pos(-1.12, 2.06, 0.0) }
        ];
    }

    /**
     * Creates 3D-tracked HTML nametag buttons (equivalent to BABYLON.GUI.Button("buttonNametag_" + objName))
     */
    initFloatingNametags() {
        this.nametagContainer = document.getElementById('nametags-layer');
        this.nametagsByMode = {
            plates: [],
            electronic_circuit: [],
            room_temp_control: [],
            helium_system: [],
            frame: [],
            single: []
        };
        this.nametagsById = {};

        // 1. Create Plate Temperature Nametags
        this.plateNametagSpecs.forEach(spec => {
            const el = document.createElement('button');
            el.className = 'nametag-pill nametag-plate';
            el.textContent = spec.text;
            el.style.display = 'none';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentSelection === 'plates') {
                    this.clearSelection(true);
                } else {
                    this.selectMode('plates');
                }
            });
            this.nametagContainer.appendChild(el);
            const item = { id: spec.id, mode: 'plates', el, worldPos: spec.pos };
            this.nametagsByMode.plates.push(item);
            this.nametagsById[spec.id] = item;
        });

        // 2. Create Component Nametags for electronic_circuit, helium_system, frame, and single
        Object.keys(this.catalog).forEach(key => {
            if (key === 'gantry_frame') return;
            const entry = this.catalog[key];
            if (!entry.nametagPos) return;

            const el = document.createElement('button');
            el.className = `nametag-pill nametag-${entry.mode}`;
            el.textContent = entry.name;
            el.style.display = 'none';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentSelection === key) {
                    this.clearSelection(true);
                } else if (key === 'frame') {
                    this.selectMode('frame');
                } else {
                    this.selectObject(key);
                }
            });
            this.nametagContainer.appendChild(el);
            const item = { id: key, mode: entry.mode, el, worldPos: entry.nametagPos };
            if (this.nametagsByMode[entry.mode]) {
                this.nametagsByMode[entry.mode].push(item);
            }
            this.nametagsById[key] = item;
        });
    }

    /**
     * Projects 3D world positions of visible nametags to 2D screen coordinates every frame
     * (Matches buttonNametag.moveToVector3(nametagPos, scene) in objectInteraction.js)
     */
    updateFloatingNametags() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const tempV = new THREE.Vector3();

        Object.values(this.nametagsById).forEach(item => {
            if (item.el.style.display === 'none') return;
            tempV.copy(item.worldPos);
            tempV.project(this.camera);

            if (tempV.z > 1.0) {
                item.el.style.opacity = '0';
                return;
            }
            const x = (tempV.x * 0.5 + 0.5) * w;
            const y = (-tempV.y * 0.5 + 0.5) * h;
            item.el.style.opacity = '1';
            item.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        });
    }

    /**
     * Smoothly animates camera.position and controls.target to the target stop
     * (Matches cameraShot(id) in objectInteraction.js)
     */
    cameraShot(id) {
        const entry = this.catalog[id];
        if (!entry || !entry.camPos || !entry.camTarget) return;

        this.cameraAnim = {
            startTime: performance.now(),
            duration: 680,
            startPos: this.camera.position.clone(),
            endPos: entry.camPos.clone(),
            startTarget: this.controls.target.clone(),
            endTarget: entry.camTarget.clone()
        };
    }

    updateCameraAnimation(now) {
        if (!this.cameraAnim) return;
        const t = Math.min(1.0, (now - this.cameraAnim.startTime) / this.cameraAnim.duration);
        // Smooth cubic ease-out
        const ease = 1.0 - Math.pow(1.0 - t, 3);

        this.camera.position.lerpVectors(this.cameraAnim.startPos, this.cameraAnim.endPos, ease);
        this.controls.target.lerpVectors(this.cameraAnim.startTarget, this.cameraAnim.endTarget, ease);

        if (t >= 1.0) {
            this.cameraAnim = null;
        }
    }

    setInfoBoxOpen(isOpen) {
        this.infoBoxClosed = !isOpen;
        const infoBox = document.getElementById('qc-info-box');
        const reopenPill = document.getElementById('info-reopen-pill');
        if (infoBox) {
            infoBox.style.display = isOpen ? 'block' : 'none';
        }
        if (reopenPill) {
            reopenPill.style.display = isOpen ? 'none' : 'inline-flex';
        }
    }

    /**
     * Updates the Info Box card with expandable "Show more / Show less" details
     */
    updateInfoBox(entry, autoOpen = false) {
        const catEl = document.getElementById('info-category');
        const titleEl = document.getElementById('info-title');
        const bodyEl = document.getElementById('info-body');
        const detailsEl = document.getElementById('info-details');
        const toggleBtn = document.getElementById('info-more-btn');
        const infoBox = document.getElementById('qc-info-box');

        if (!infoBox || !entry) return;
        if (autoOpen && this.infoBoxClosed) {
            this.setInfoBoxOpen(true);
        }
        const accent = this.colModes[entry.mode] || '#38bdf8';
        infoBox.style.borderLeftColor = accent;
        if (catEl) {
            catEl.textContent = entry.category;
            catEl.style.color = accent;
        }
        if (titleEl) titleEl.textContent = entry.title;
        if (bodyEl) bodyEl.innerHTML = entry.text;

        if (entry.textDetails) {
            detailsEl.innerHTML = entry.textDetails;
            toggleBtn.style.display = 'inline-block';
        } else {
            detailsEl.innerHTML = '';
            detailsEl.style.display = 'none';
            toggleBtn.style.display = 'none';
        }
    }

    /**
     * Restores all meshes to their original PBR materials and hides nametags
     */
    clearHighlightsAndNametags() {
        Object.values(this.qc.namedMeshes).forEach(node => {
            node.traverse(child => {
                if (child.isMesh && child.userData.baseMaterial) {
                    if (child.material !== child.userData.baseMaterial && child.material.dispose) {
                        child.material.dispose();
                    }
                    child.material = child.userData.baseMaterial;
                }
            });
        });
        this.highlightedNodes = [];

        Object.values(this.nametagsById).forEach(item => {
            item.el.style.display = 'none';
            item.el.classList.remove('active-tag');
        });
    }

    applyHighlightToNode(node, hexColor, isPrimary = true) {
        if (!node) return;
        const col = new THREE.Color(hexColor);
        node.traverse(child => {
            if (child.isMesh && child.userData.baseMaterial && !child.userData.isContactAo) {
                const cloned = child.userData.baseMaterial.clone();
                cloned.emissive = col;
                cloned.emissiveIntensity = isPrimary ? 0.36 : 0.14;
                child.material = cloned;
            }
        });
        this.highlightedNodes.push({ node, color: col, isPrimary });
    }

    /**
     * Breathing highlight pulse (matching registerBeforeRender in objectInteraction.js):
     *   alpha += 0.06;
     *   hl.blurHorizontalSize = 1.0 + Math.cos(alpha) * 0.6 + 0.6;
     */
    updateHighlightPulse() {
        if (this.highlightedNodes.length === 0) return;
        this.pulseAlpha += 0.055;
        const pulse = 0.5 + 0.5 * Math.cos(this.pulseAlpha);

        this.highlightedNodes.forEach(({ node, isPrimary }) => {
            const intensity = isPrimary ? (0.24 + pulse * 0.24) : (0.10 + pulse * 0.08);
            node.traverse(child => {
                if (child.isMesh && child.material && child.material !== child.userData.baseMaterial) {
                    child.material.emissiveIntensity = intensity;
                }
            });
        });
    }

    clearSelection(toDefault = true) {
        this.clearHighlightsAndNametags();

        // Hide outer vacuum hull if leaving 'hull' mode
        if (this.qc.namedMeshes.hull) {
            this.qc.namedMeshes.hull.visible = false;
        }

        if (toDefault) {
            this.currentSelection = 'default';
            this.currentMode = 'none';
            this.currentSeq = 0;
            this.updateModeButtonsUI('default');
            this.updateInfoBox(this.catalog.default);
            this.cameraShot('default');
        }
    }

    selectMode(modeName) {
        if (modeName === 'qpu') {
            this.selectObject('qpu');
            return;
        }

        this.clearSelection(false);
        const entry = this.catalog[modeName] || this.catalog.default;
        this.currentSelection = modeName;
        this.currentMode = modeName;
        this.currentSeq = entry.seq;

        this.updateModeButtonsUI(modeName);
        this.updateInfoBox(entry, modeName !== 'default');

        if (modeName === 'default') {
            this.cameraShot('default');
            return;
        }

        if (modeName === 'hull') {
            if (this.qc.namedMeshes.hull) {
                this.qc.namedMeshes.hull.visible = true;
            }
            this.cameraShot('hull');
            return;
        }

        // Show all floating 3D nametags for this mode
        if (this.nametagsByMode[modeName]) {
            this.nametagsByMode[modeName].forEach(item => {
                if (this.showUI) item.el.style.display = 'block';
            });
        }

        // Highlight all meshes belonging to this subsystem mode
        const colorHex = this.colModes[modeName];
        const nodes = this.qc.modeGroups[modeName] || [];
        nodes.forEach(node => this.applyHighlightToNode(node, colorHex, true));

        this.cameraShot(modeName);
    }

    selectObject(meshName) {
        const entry = this.catalog[meshName];
        const node = this.qc.namedMeshes[meshName];
        if (!entry || !node) return;

        this.clearSelection(false);
        this.currentSelection = meshName;
        this.currentMode = entry.mode;
        this.currentSeq = entry.seq;

        this.updateModeButtonsUI(meshName === 'qpu' ? 'qpu' : entry.mode);
        this.updateInfoBox(entry, true);

        // Show this component's floating 3D nametag
        if (this.nametagsById[meshName] && this.showUI) {
            this.nametagsById[meshName].el.style.display = 'block';
            this.nametagsById[meshName].el.classList.add('active-tag');
        }

        // When inspecting the QPU chip close-up, fade the surrounding lower catenary coax loops
        // to subtle semi-transparency so the 3D Willow/Sycamore QPU chip is 100% unobstructed
        if (meshName === 'qpu' && this.qc.namedMeshes.cables_measuring) {
            this.qc.namedMeshes.cables_measuring.traverse(child => {
                if (child.isMesh && child.userData.baseMaterial) {
                    const faded = child.userData.baseMaterial.clone();
                    faded.transparent = true;
                    faded.opacity = 0.18;
                    faded.depthWrite = false;
                    child.material = faded;
                }
            });
            // Keep the silicon interposer & flip-chip die crisp without washing out their textures with emissive glow
            node.traverse(child => {
                if (child.isMesh && child.userData.baseMaterial) {
                    const mName = child.userData.baseMaterial.name || '';
                    if (mName.includes('Willow')) {
                        child.material = child.userData.baseMaterial;
                    } else {
                        const cloned = child.userData.baseMaterial.clone();
                        cloned.emissive = new THREE.Color('#06B6D4');
                        cloned.emissiveIntensity = 0.22;
                        child.material = cloned;
                    }
                }
            });
        } else {
            // Highlight the selected component in its mode's signature color
            const colorHex = this.colModes[entry.mode] || '#38bdf8';
            this.applyHighlightToNode(node, colorHex, true);
        }

        this.cameraShot(meshName);
    }

    /**
     * Steps forward (+1) or backward (-1) across all 28 tour stops (seq: 0..27)
     * (Matches forwardSelection(direction) in objectInteraction.js)
     */
    forwardSelection(direction) {
        const nextSeq = this.currentSeq + direction;
        if (nextSeq < 0 || nextSeq > 27) return;

        const targetKey = Object.keys(this.catalog).find(
            k => k !== 'gantry_frame' && k !== 'room_temp_control' && this.catalog[k].seq === nextSeq
        );
        if (!targetKey) return;

        if (['default', 'hull', 'plates', 'electronic_circuit', 'room_temp_control', 'helium_system', 'frame'].includes(targetKey)) {
            this.selectMode(targetKey);
        } else {
            this.selectObject(targetKey);
        }
    }

    updateModeButtonsUI(activeMode) {
        document.querySelectorAll('.btn-qc-mode').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === activeMode);
        });
    }

    initModeAndTourControls() {
        // Subsystem mode buttons
        document.querySelectorAll('.btn-qc-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (this.currentSelection === mode && mode !== 'default') {
                    this.clearSelection(true);
                } else {
                    this.selectMode(mode);
                }
            });
        });

        // Prev / Next sequential tour buttons
        const prevBtn = document.getElementById('btn-tour-prev');
        const nextBtn = document.getElementById('btn-tour-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.forwardSelection(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.forwardSelection(1));

        // Info box Show More / Show Less toggle
        const moreBtn = document.getElementById('info-more-btn');
        const detailsEl = document.getElementById('info-details');
        if (moreBtn && detailsEl) {
            moreBtn.addEventListener('click', () => {
                const isHidden = detailsEl.style.display === 'none';
                detailsEl.style.display = isHidden ? 'block' : 'none';
                moreBtn.textContent = isHidden ? 'Show less ▲' : 'Show more ▼';
            });
        }

        // Info box Close & Reopen buttons
        const closeInfoBtn = document.getElementById('info-close-btn');
        const reopenInfoPill = document.getElementById('info-reopen-pill');
        if (closeInfoBtn) {
            closeInfoBtn.addEventListener('click', () => this.setInfoBoxOpen(false));
        }
        if (reopenInfoPill) {
            reopenInfoPill.addEventListener('click', () => this.setInfoBoxOpen(true));
        }

        // Hide UI button (matching buttonHideUI in objectInteraction.js)
        const hideUiBtn = document.getElementById('btn-hide-ui');
        if (hideUiBtn) {
            hideUiBtn.addEventListener('click', () => {
                this.showUI = !this.showUI;
                document.body.classList.toggle('ui-hidden', !this.showUI);
                hideUiBtn.textContent = this.showUI ? 'Hide UI' : 'Show UI';
                if (!this.showUI) {
                    Object.values(this.nametagsById).forEach(i => (i.el.style.display = 'none'));
                } else if (this.currentMode && this.nametagsByMode[this.currentMode] && this.currentSelection === this.currentMode) {
                    this.nametagsByMode[this.currentMode].forEach(i => (i.el.style.display = 'block'));
                } else if (this.nametagsById[this.currentSelection]) {
                    this.nametagsById[this.currentSelection].el.style.display = 'block';
                }
            });
        }

        // Initialize with default overview text
        this.updateInfoBox(this.catalog.default);
    }

    getPickedNode(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const pickTargets = [];
        this.qc.root.traverse(obj => {
            if (obj.isMesh && obj.visible && !obj.userData.isContactAo && obj.userData.modeName) {
                if (this.currentSelection === 'hull' && obj.userData.meshName !== 'hull') return;
                if (this.currentSelection !== 'hull' && obj.userData.meshName === 'hull') return;
                pickTargets.push(obj);
            }
        });

        const hits = this.raycaster.intersectObjects(pickTargets, false);
        if (hits.length === 0) return null;
        return hits[0].object.userData;
    }

    initPointerEvents() {
        const canvas = this.renderer.domElement;
        let downX = 0;
        let downY = 0;

        canvas.addEventListener('pointerdown', (e) => {
            downX = e.clientX;
            downY = e.clientY;
            // Cancel active camera fly-to if user manually grabs the orbit controls
            this.cameraAnim = null;
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!this.showUI || this.currentSelection === 'hull') {
                canvas.style.cursor = 'grab';
                return;
            }
            const hitData = this.getPickedNode(e.clientX, e.clientY);
            canvas.style.cursor = hitData ? 'pointer' : 'grab';
        });

        canvas.addEventListener('pointerup', (e) => {
            if (e.button !== 0) return;
            if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;

            const hitData = this.getPickedNode(e.clientX, e.clientY);
            if (!hitData) {
                // Clicked in the background lab skybox void -> reset to default overview
                if (this.currentSelection !== 'default') {
                    this.clearSelection(true);
                }
                return;
            }

            const { meshName, modeName } = hitData;
            if (modeName === 'plates') {
                if (this.currentSelection === 'plates') {
                    this.clearSelection(true);
                } else {
                    this.selectMode('plates');
                }
            } else if (modeName === 'frame') {
                if (this.currentSelection === 'frame') {
                    this.clearSelection(true);
                } else {
                    this.selectMode('frame');
                }
            } else if (this.catalog[meshName]) {
                if (this.currentSelection === meshName) {
                    this.clearSelection(true);
                } else {
                    this.selectObject(meshName);
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection(true);
            } else if (e.key === 'ArrowRight') {
                this.forwardSelection(1);
            } else if (e.key === 'ArrowLeft') {
                this.forwardSelection(-1);
            }
        });
    }

    update(now) {
        this.updateCameraAnimation(now);
        this.updateHighlightPulse();
        this.updateFloatingNametags();
    }
}

window.QuantumObjectInteraction = QuantumObjectInteraction;
