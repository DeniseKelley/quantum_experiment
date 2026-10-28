/**
 * circuit_simulator.js
 * Mathematically exact complex statevector simulator, gate matrix library,
 * Born-rule probability & shot sampler, single-qubit reduced density matrix /
 * Bloch sphere calculator, and progressive interactive lesson catalog for
 * the Quantum Circuit Lab educational layer.
 */

class Complex {
    constructor(re = 0, im = 0) {
        this.re = Number(re) || 0;
        this.im = Number(im) || 0;
    }

    static fromPolar(r, thetaRad) {
        return new Complex(r * Math.cos(thetaRad), r * Math.sin(thetaRad));
    }

    clone() {
        return new Complex(this.re, this.im);
    }

    add(other) {
        return new Complex(this.re + other.re, this.im + other.im);
    }

    sub(other) {
        return new Complex(this.re - other.re, this.im - other.im);
    }

    mul(other) {
        if (typeof other === 'number') {
            return new Complex(this.re * other, this.im * other);
        }
        return new Complex(
            this.re * other.re - this.im * other.im,
            this.re * other.im + this.im * other.re
        );
    }

    conj() {
        return new Complex(this.re, -this.im);
    }

    abs2() {
        return this.re * this.re + this.im * this.im;
    }

    abs() {
        return Math.sqrt(this.abs2());
    }

    arg() {
        if (this.abs() < 1e-10) return 0;
        return Math.atan2(this.im, this.re);
    }

    isZero(eps = 1e-9) {
        return this.abs() < eps;
    }

    formatCartesian(decimals = 3) {
        const eps = 1e-7;
        const r = Math.abs(this.re) < eps ? 0 : this.re;
        const i = Math.abs(this.im) < eps ? 0 : this.im;

        if (r === 0 && i === 0) return '0';
        if (i === 0) return this._fmtNum(r, decimals);
        if (r === 0) {
            if (Math.abs(i - 1) < 1e-5) return 'i';
            if (Math.abs(i + 1) < 1e-5) return '-i';
            return `${this._fmtNum(i, decimals)}i`;
        }
        const sign = i >= 0 ? '+' : '-';
        const absI = Math.abs(i);
        const iStr = Math.abs(absI - 1) < 1e-5 ? 'i' : `${this._fmtNum(absI, decimals)}i`;
        return `${this._fmtNum(r, decimals)} ${sign} ${iStr}`;
    }

    _fmtNum(val, decimals = 3) {
        // Check well-known algebraic values first for educational clarity
        const invSqrt2 = 1 / Math.SQRT2;
        if (Math.abs(Math.abs(val) - invSqrt2) < 1e-4) {
            return (val < 0 ? '-' : '') + '1/√2';
        }
        if (Math.abs(Math.abs(val) - 0.5) < 1e-5) {
            return (val < 0 ? '-' : '') + '1/2';
        }
        if (Math.abs(Math.abs(val) - Math.sqrt(3) / 2) < 1e-4) {
            return (val < 0 ? '-' : '') + '√3/2';
        }
        if (Math.abs(val - Math.round(val)) < 1e-6) {
            return String(Math.round(val));
        }
        return Number(val.toFixed(decimals)).toString();
    }
}

const C0 = new Complex(0, 0);
const C1 = new Complex(1, 0);
const CM1 = new Complex(-1, 0);
const CI = new Complex(0, 1);
const CMI = new Complex(0, -1);
const INV_SQRT2 = 1 / Math.SQRT2;

/**
 * Helper to format radian angles in multiples of π where applicable
 */
function formatRadians(rad) {
    if (rad === undefined || rad === null || isNaN(rad)) return '0 rad';
    const eps = 1e-4;
    if (Math.abs(rad) < eps) return '0 rad';
    const ratio = rad / Math.PI;
    const fractions = [
        [1, 1, 'π'],
        [-1, 1, '-π'],
        [1, 2, 'π/2'],
        [-1, 2, '-π/2'],
        [1, 3, 'π/3'],
        [-1, 3, '-π/3'],
        [2, 3, '2π/3'],
        [-2, 3, '-2π/3'],
        [1, 4, 'π/4'],
        [-1, 4, '-π/4'],
        [3, 4, '3π/4'],
        [-3, 4, '-3π/4'],
        [1, 6, 'π/6'],
        [-1, 6, '-π/6'],
        [1, 8, 'π/8'],
        [-1, 8, '-π/8'],
        [2, 1, '2π'],
        [-2, 1, '-2π']
    ];
    for (const [num, den, label] of fractions) {
        if (Math.abs(ratio - num / den) < 1e-3) {
            return `${label} (${rad.toFixed(3)} rad)`;
        }
    }
    return `${rad.toFixed(3)} rad`;
}

function formatRadiansShort(rad) {
    if (rad === undefined || rad === null || isNaN(rad)) return '0';
    const ratio = rad / Math.PI;
    const fractions = [
        [1, 1, 'π'],
        [-1, 1, '-π'],
        [1, 2, 'π/2'],
        [-1, 2, '-π/2'],
        [1, 3, 'π/3'],
        [-1, 3, '-π/3'],
        [2, 3, '2π/3'],
        [-2, 3, '-2π/3'],
        [1, 4, 'π/4'],
        [-1, 4, '-π/4'],
        [3, 4, '3π/4'],
        [-3, 4, '-3π/4'],
        [1, 6, 'π/6'],
        [-1, 6, '-π/6'],
        [1, 8, 'π/8'],
        [-1, 8, '-π/8'],
        [2, 1, '2π'],
        [-2, 1, '-2π']
    ];
    for (const [num, den, label] of fractions) {
        if (Math.abs(ratio - num / den) < 1e-3) return label;
    }
    return `${rad.toFixed(2)}`;
}

/**
 * Complete Gate Library with exact unitary matrices, physical meanings,
 * beginner explanations, and formal mathematical definitions.
 */
const GATE_LIBRARY = {
    H: {
        id: 'H',
        symbol: 'H',
        name: 'Hadamard Gate',
        category: 'superposition',
        color: '#1a73e8',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Creates an equal quantum superposition from a basis state.',
        summary: 'Rotates the Bloch sphere by π radians around the diagonal (X+Z)/√2 axis. Maps |0⟩ to |+⟩ = (|0⟩ + |1⟩)/√2 and |1⟩ to |−⟩ = (|0⟩ − |1⟩)/√2.',
        mathFormula: 'H = \\frac{1}{\\sqrt{2}} \\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}',
        ketAction: 'H|0⟩ = |+⟩ = (|0⟩ + |1⟩)/√2,   H|1⟩ = |−⟩ = (|0⟩ − |1⟩)/√2',
        hardwareNote: 'Executed on the 10 mK Willow QPU via a resonant microwave Ry(π/2) pulse followed by a virtual frame Z(π) rotation.',
        matrixFn: () => {
            const s = new Complex(INV_SQRT2, 0);
            const ms = new Complex(-INV_SQRT2, 0);
            return [
                [s, s],
                [s, ms]
            ];
        }
    },
    X: {
        id: 'X',
        symbol: 'X',
        name: 'Pauli-X Gate (Quantum NOT)',
        category: 'pauli',
        color: '#ea4335',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Bit-flip gate: swaps the amplitudes of |0⟩ and |1⟩.',
        summary: 'The quantum equivalent of a classical NOT gate. Rotates the qubit state by π radians (180°) around the X-axis of the Bloch sphere.',
        mathFormula: 'X = \\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}',
        ketAction: 'X|0⟩ = |1⟩,   X|1⟩ = |0⟩',
        hardwareNote: 'Implemented by sending a calibrated ~20 ns microwave π-pulse at the qubit transition frequency (4.5–6 GHz) down the green XY coaxial control line.',
        matrixFn: () => [
            [C0, C1],
            [C1, C0]
        ]
    },
    Y: {
        id: 'Y',
        symbol: 'Y',
        name: 'Pauli-Y Gate',
        category: 'pauli',
        color: '#d93025',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Combined bit-flip and phase-flip: π rotation around the Y-axis.',
        summary: 'Rotates the qubit state by π radians around the Y-axis of the Bloch sphere, flipping |0⟩ ↔ |1⟩ while multiplying by ±i complex phase.',
        mathFormula: 'Y = \\begin{pmatrix} 0 & -i \\\\ i & 0 \\end{pmatrix}',
        ketAction: 'Y|0⟩ = i|1⟩,   Y|1⟩ = −i|0⟩',
        hardwareNote: 'Driven by a 90°-quadrature-shifted (Q-channel) microwave π-pulse from the room-temperature RF-DAC blade.',
        matrixFn: () => [
            [C0, CMI],
            [CI, C0]
        ]
    },
    Z: {
        id: 'Z',
        symbol: 'Z',
        name: 'Pauli-Z Gate (Phase Flip)',
        category: 'pauli',
        color: '#9334e6',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Flips the phase of |1⟩ to −|1⟩ while leaving |0⟩ unchanged.',
        summary: 'Rotates the Bloch sphere by π radians around the Z-axis. It does not change measurement probabilities in the Z-basis by itself, but swaps |+⟩ ↔ |−⟩!',
        mathFormula: 'Z = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}',
        ketAction: 'Z|0⟩ = |0⟩,   Z|1⟩ = −|1⟩,   Z|+⟩ = |−⟩',
        hardwareNote: 'Executed in zero physical time ("virtual Z gate") by shifting the phase reference of subsequent microwave pulses in the FPGA controller.',
        matrixFn: () => [
            [C1, C0],
            [C0, CM1]
        ]
    },
    S: {
        id: 'S',
        symbol: 'S',
        name: 'S Gate (√Z Phase Gate)',
        category: 'phase',
        color: '#7627bb',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Quarter-turn (π/2 rad) phase rotation around the Z-axis.',
        summary: 'Adds a relative phase of i = e^(iπ/2) to the |1⟩ component. Applying two S gates in a row equals one Pauli-Z gate (S² = Z).',
        mathFormula: 'S = \\begin{pmatrix} 1 & 0 \\\\ 0 & i \\end{pmatrix}',
        ketAction: 'S|0⟩ = |0⟩,   S|1⟩ = i|1⟩,   S|+⟩ = |+i⟩',
        hardwareNote: 'Implemented as a virtual Z-frame phase increment of +π/2 radians in the room-temperature RF-DAC sequencer.',
        matrixFn: () => [
            [C1, C0],
            [C0, CI]
        ]
    },
    T: {
        id: 'T',
        symbol: 'T',
        name: 'T Gate (π/8 Phase Gate)',
        category: 'phase',
        color: '#4285f4',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Eighth-turn (π/4 rad) phase rotation; essential for universal quantum computing.',
        summary: 'Adds a phase of e^(iπ/4) to |1⟩. Because T is a non-Clifford gate (T² = S, T⁴ = Z), combining {H, T, CNOT} enables universal quantum computation.',
        mathFormula: 'T = \\begin{pmatrix} 1 & 0 \\\\ 0 & e^{i\\pi/4} \\end{pmatrix}',
        ketAction: 'T|0⟩ = |0⟩,   T|1⟩ = e^(iπ/4)|1⟩ = (1+i)/√2 |1⟩',
        hardwareNote: 'Implemented via a precise +π/4 radian phase offset in the microwave local oscillator frame.',
        matrixFn: () => [
            [C1, C0],
            [C0, Complex.fromPolar(1, Math.PI / 4)]
        ]
    },
    Rx: {
        id: 'Rx',
        symbol: 'Rx',
        name: 'Rx(θ) Rotation Gate',
        category: 'rotation',
        color: '#f29900',
        numQubits: 1,
        hasTheta: true,
        defaultTheta: Math.PI / 2,
        tagline: 'Continuous rotation by angle θ (in radians) around the Bloch X-axis.',
        summary: 'Rotates the single-qubit statevector continuously around the X-axis by θ radians: Rx(θ) = exp(−i θ X / 2). At θ = π, Rx(π) = −iX.',
        mathFormula: 'R_x(\\theta) = \\begin{pmatrix} \\cos(\\theta/2) & -i\\sin(\\theta/2) \\\\ -i\\sin(\\theta/2) & \\cos(\\theta/2) \\end{pmatrix}',
        ketAction: 'Rx(θ)|0⟩ = cos(θ/2)|0⟩ − i sin(θ/2)|1⟩',
        hardwareNote: 'Controlled by varying the amplitude and duration of the in-phase (I-channel) microwave envelope on the XY control line.',
        matrixFn: (theta = Math.PI / 2) => {
            const c = new Complex(Math.cos(theta / 2), 0);
            const s = new Complex(0, -Math.sin(theta / 2));
            return [
                [c, s],
                [s, c]
            ];
        }
    },
    Ry: {
        id: 'Ry',
        symbol: 'Ry',
        name: 'Ry(θ) Rotation Gate',
        category: 'rotation',
        color: '#f9ab00',
        numQubits: 1,
        hasTheta: true,
        defaultTheta: Math.PI / 2,
        tagline: 'Continuous rotation by angle θ (in radians) around the Bloch Y-axis.',
        summary: 'Rotates the qubit state around the Y-axis by θ radians with purely real matrix entries: Ry(θ) = exp(−i θ Y / 2). At θ = π/2, Ry(π/2)|0⟩ = |+⟩.',
        mathFormula: 'R_y(\\theta) = \\begin{pmatrix} \\cos(\\theta/2) & -\\sin(\\theta/2) \\\\ \\sin(\\theta/2) & \\cos(\\theta/2) \\end{pmatrix}',
        ketAction: 'Ry(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩',
        hardwareNote: 'Controlled by the quadrature (Q-channel) microwave pulse envelope synthesized by the 6U RF-DAC rack.',
        matrixFn: (theta = Math.PI / 2) => {
            const c = new Complex(Math.cos(theta / 2), 0);
            const ms = new Complex(-Math.sin(theta / 2), 0);
            const ps = new Complex(Math.sin(theta / 2), 0);
            return [
                [c, ms],
                [ps, c]
            ];
        }
    },
    Rz: {
        id: 'Rz',
        symbol: 'Rz',
        name: 'Rz(θ) Rotation Gate',
        category: 'rotation',
        color: '#e37400',
        numQubits: 1,
        hasTheta: true,
        defaultTheta: Math.PI / 2,
        tagline: 'Continuous phase rotation by angle θ (in radians) around the Bloch Z-axis.',
        summary: 'Applies a relative phase difference of θ radians between |0⟩ and |1⟩: Rz(θ) = exp(−i θ Z / 2). Preserves Z-basis probabilities while rotating the equator.',
        mathFormula: 'R_z(\\theta) = \\begin{pmatrix} e^{-i\\theta/2} & 0 \\\\ 0 & e^{i\\theta/2} \\end{pmatrix}',
        ketAction: 'Rz(θ)|0⟩ = e^(−iθ/2)|0⟩,   Rz(θ)|1⟩ = e^(iθ/2)|1⟩',
        hardwareNote: 'Executed either via a fast Z flux-bias pulse through the royal-blue coax lines or a virtual microwave carrier phase shift.',
        matrixFn: (theta = Math.PI / 2) => [
            [Complex.fromPolar(1, -theta / 2), C0],
            [C0, Complex.fromPolar(1, theta / 2)]
        ]
    },
    CNOT: {
        id: 'CNOT',
        symbol: 'CX',
        name: 'CNOT / CX (Controlled-NOT Gate)',
        category: 'multiqubit',
        color: '#34a853',
        numQubits: 2,
        hasTheta: false,
        tagline: 'Flips the target qubit (⊕) if and only if the control qubit (●) is |1⟩.',
        summary: 'The primary two-qubit entangling gate. When the control qubit is in a superposition |+⟩ and target is |0⟩, CNOT creates an inseparable Bell state (|00⟩ + |11⟩)/√2.',
        mathFormula: '\\text{CNOT} = \\begin{pmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 0 & 1 \\\\ 0 & 0 & 1 & 0 \\end{pmatrix}',
        ketAction: '|c, t⟩ → |c, t ⊕ c⟩   (|00⟩→|00⟩, |01⟩→|01⟩, |10⟩→|11⟩, |11⟩→|10⟩)',
        hardwareNote: 'Realized on Willow by pulsing the tunable superconducting coupler between two Xmon qubits together with single-qubit Hadamard frames.',
        matrixFn: () => [
            [C1, C0, C0, C0],
            [C0, C1, C0, C0],
            [C0, C0, C0, C1],
            [C0, C0, C1, C0]
        ]
    },
    CZ: {
        id: 'CZ',
        symbol: 'CZ',
        name: 'CZ (Controlled-Z Phase Gate)',
        category: 'multiqubit',
        color: '#1e8e3e',
        numQubits: 2,
        hasTheta: false,
        tagline: 'Flips the phase of |11⟩ to −|11⟩ when both qubits are in state |1⟩.',
        summary: 'Symmetric two-qubit entangling gate: it does not matter which qubit is labeled control or target! Equivalent to applying H on the target before and after CNOT.',
        mathFormula: '\\text{CZ} = \\begin{pmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 1 & 0 \\\\ 0 & 0 & 0 & -1 \\end{pmatrix}',
        ketAction: '|00⟩→|00⟩, |01⟩→|01⟩, |10⟩→|10⟩, |11⟩→−|11⟩',
        hardwareNote: 'Native hardware gate on Google Sycamore & Willow transmons: a fast Z flux pulse brings |11⟩ into resonance with the non-computational |20⟩ state for one full cycle.',
        matrixFn: () => [
            [C1, C0, C0, C0],
            [C0, C1, C0, C0],
            [C0, C0, C1, C0],
            [C0, C0, C0, CM1]
        ]
    },
    SWAP: {
        id: 'SWAP',
        symbol: 'SWAP',
        name: 'SWAP Gate',
        category: 'multiqubit',
        color: '#00897b',
        numQubits: 2,
        hasTheta: false,
        tagline: 'Exchanges the quantum states of two qubits: |a, b⟩ → |b, a⟩.',
        summary: 'Routes quantum information across non-adjacent qubit wires. Mathematically equivalent to three alternating CNOT gates.',
        mathFormula: '\\text{SWAP} = \\begin{pmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 0 & 1 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 0 & 1 \\end{pmatrix}',
        ketAction: '|00⟩→|00⟩, |01⟩→|10⟩, |10⟩→|01⟩, |11⟩→|11⟩',
        hardwareNote: 'Decomposed into 3 CNOT/iSWAP interactions or resonant XY exchange pulses via the tunable coupler.',
        matrixFn: () => [
            [C1, C0, C0, C0],
            [C0, C0, C1, C0],
            [C0, C1, C0, C0],
            [C0, C0, C0, C1]
        ]
    },
    M: {
        id: 'M',
        symbol: 'M',
        name: 'Measurement (Computational Z-Basis)',
        category: 'measurement',
        color: '#5f6368',
        numQubits: 1,
        hasTheta: false,
        tagline: 'Projects a qubit onto |0⟩ or |1⟩ according to the Born rule P(k) = |α_k|².',
        summary: 'Irreversibly collapses the quantum superposition of the measured qubit into classical bit 0 or 1. The probability of each outcome is the squared magnitude of its complex amplitude.',
        mathFormula: 'P(0) = |\\langle 0|\\psi\\rangle|^2, \\quad P(1) = |\\langle 1|\\psi\\rangle|^2, \\quad |\\psi\\rangle \\mapsto \\frac{\\Pi_m |\\psi\\rangle}{\\sqrt{P(m)}}',
        ketAction: 'α|0⟩ + β|1⟩  →  0 (with prob |α|²)  or  1 (with prob |β|²)',
        hardwareNote: 'Dispersive microwave readout pulse sent through the readout resonator, amplified at 10 mK by the TWPA and at 4 K by HEMTs.',
        matrixFn: () => [
            [C1, C0],
            [C0, C0]
        ]
    }
};

/**
 * Available initial single-qubit states for each wire
 */
const INITIAL_QUBIT_STATES = {
    '|0⟩': {
        label: '|0⟩',
        name: 'Ground State |0⟩',
        desc: 'North pole of the Bloch sphere (Z = +1)',
        amps: [new Complex(1, 0), new Complex(0, 0)]
    },
    '|1⟩': {
        label: '|1⟩',
        name: 'Excited State |1⟩',
        desc: 'South pole of the Bloch sphere (Z = −1)',
        amps: [new Complex(0, 0), new Complex(1, 0)]
    },
    '|+⟩': {
        label: '|+⟩',
        name: 'Plus Superposition |+⟩',
        desc: 'Equal superposition (|0⟩ + |1⟩)/√2 on +X axis',
        amps: [new Complex(INV_SQRT2, 0), new Complex(INV_SQRT2, 0)]
    },
    '|−⟩': {
        label: '|−⟩',
        name: 'Minus Superposition |−⟩',
        desc: 'Equal superposition (|0⟩ − |1⟩)/√2 with π phase on −X axis',
        amps: [new Complex(INV_SQRT2, 0), new Complex(-INV_SQRT2, 0)]
    },
    '|+i⟩': {
        label: '|+i⟩',
        name: 'Phase Superposition |+i⟩',
        desc: 'Equal superposition (|0⟩ + i|1⟩)/√2 on +Y axis',
        amps: [new Complex(INV_SQRT2, 0), new Complex(0, INV_SQRT2)]
    },
    '|−i⟩': {
        label: '|−i⟩',
        name: 'Phase Superposition |−i⟩',
        desc: 'Equal superposition (|0⟩ − i|1⟩)/√2 on −Y axis',
        amps: [new Complex(INV_SQRT2, 0), new Complex(0, -INV_SQRT2)]
    }
};

/**
 * QuantumCircuitSimulator
 * Conventions:
 * - For clarity in textbook ket notation, basis state index `idx` (0 .. 2^n - 1)
 *   represents |q_0 q_1 ... q_{n-1}⟩ where q_0 is the most-significant bit (leftmost bit in ket)
 *   and q_{n-1} is the least-significant bit (rightmost bit in ket).
 * - We also display the bitstring mapping explicitly so students see both |q_0 q_1 ...⟩
 *   and each individual wire's state clearly.
 */
class QuantumCircuitSimulator {
    /**
     * Builds the initial n-qubit statevector as the tensor product
     * |q_0⟩ ⊗ |q_1⟩ ⊗ ... ⊗ |q_{n-1}⟩
     */
    static createInitialStatevector(numQubits, initialStates = []) {
        let state = [new Complex(1, 0)];
        for (let q = 0; q < numQubits; q++) {
            const key = initialStates[q] || '|0⟩';
            const spec = INITIAL_QUBIT_STATES[key] || INITIAL_QUBIT_STATES['|0⟩'];
            const [a0, a1] = spec.amps;
            const nextState = [];
            for (let i = 0; i < state.length; i++) {
                nextState.push(state[i].mul(a0));
                nextState.push(state[i].mul(a1));
            }
            state = nextState;
        }
        return state;
    }

    /**
     * Bit value (0 or 1) of qubit `q` (0 = top wire / MSB, numQubits-1 = bottom wire / LSB)
     * in basis index `basisIdx`.
     */
    static getQubitBit(basisIdx, q, numQubits) {
        const shift = numQubits - 1 - q;
        return (basisIdx >> shift) & 1;
    }

    /**
     * Applies an arbitrary single-qubit 2x2 unitary matrix `mat` to wire `targetQubit`.
     */
    static applySingleQubitMatrix(state, numQubits, targetQubit, mat) {
        const dim = 1 << numQubits;
        const out = new Array(dim);
        const shift = numQubits - 1 - targetQubit;
        const mask = 1 << shift;

        for (let i = 0; i < dim; i++) {
            if ((i & mask) === 0) {
                const i0 = i;
                const i1 = i | mask;
                const v0 = state[i0];
                const v1 = state[i1];
                out[i0] = mat[0][0].mul(v0).add(mat[0][1].mul(v1));
                out[i1] = mat[1][0].mul(v0).add(mat[1][1].mul(v1));
            }
        }
        return out;
    }

    /**
     * Applies a two-qubit 4x4 unitary matrix `mat` on `(controlQubit, targetQubit)`
     * where basis ordering of the 4x4 matrix is |00⟩, |01⟩, |10⟩, |11⟩ for |control, target⟩.
     */
    static applyTwoQubitMatrix(state, numQubits, qA, qB, mat) {
        const dim = 1 << numQubits;
        const out = state.map(c => c.clone());
        const shiftA = numQubits - 1 - qA;
        const shiftB = numQubits - 1 - qB;
        const maskA = 1 << shiftA;
        const maskB = 1 << shiftB;

        for (let i = 0; i < dim; i++) {
            if ((i & maskA) === 0 && (i & maskB) === 0) {
                const idx00 = i;
                const idx01 = i | maskB;
                const idx10 = i | maskA;
                const idx11 = i | maskA | maskB;
                const indices = [idx00, idx01, idx10, idx11];
                const v = indices.map(k => state[k]);

                for (let r = 0; r < 4; r++) {
                    let sum = new Complex(0, 0);
                    for (let c = 0; c < 4; c++) {
                        sum = sum.add(mat[r][c].mul(v[c]));
                    }
                    out[indices[r]] = sum;
                }
            }
        }
        return out;
    }

    /**
     * Applies a single gate operation to the statevector.
     * Note: Measurement 'M' in statevector timeline mode records measurement on that qubit
     * while preserving exact pre-measurement Born probabilities; we also support explicit
     * projective collapse simulation!
     */
    static applyGateToState(state, numQubits, gateOp) {
        const def = GATE_LIBRARY[gateOp.type];
        if (!def) return state.map(c => c.clone());

        if (gateOp.type === 'M') {
            // In deterministic statevector evolution, keep coherent amplitudes for Born-rule analysis
            // and track measured wires for classical readout register.
            return state.map(c => c.clone());
        }

        const mat = def.matrixFn(gateOp.theta);
        if (def.numQubits === 1) {
            return this.applySingleQubitMatrix(state, numQubits, gateOp.qubit, mat);
        } else if (def.numQubits === 2) {
            return this.applyTwoQubitMatrix(state, numQubits, gateOp.qubit, gateOp.targetQubit, mat);
        }
        return state.map(c => c.clone());
    }

    /**
     * Performs a projective single-shot collapse of qubit `q` according to the Born rule.
     * Returns { collapsedState, outcome, probability }.
     */
    static collapseQubit(state, numQubits, q, forcedOutcome = null) {
        const dim = 1 << numQubits;
        const shift = numQubits - 1 - q;
        const mask = 1 << shift;

        let prob0 = 0;
        for (let i = 0; i < dim; i++) {
            if ((i & mask) === 0) {
                prob0 += state[i].abs2();
            }
        }
        prob0 = Math.min(1, Math.max(0, prob0));
        const prob1 = 1 - prob0;

        let outcome;
        if (forcedOutcome === 0 || forcedOutcome === 1) {
            outcome = forcedOutcome;
            if ((outcome === 0 && prob0 < 1e-9) || (outcome === 1 && prob1 < 1e-9)) {
                outcome = prob0 >= prob1 ? 0 : 1;
            }
        } else {
            outcome = Math.random() < prob0 ? 0 : 1;
        }

        const chosenProb = outcome === 0 ? prob0 : prob1;
        const norm = Math.sqrt(Math.max(chosenProb, 1e-12));
        const collapsed = state.map((amp, i) => {
            const bit = (i & mask) ? 1 : 0;
            return bit === outcome ? amp.mul(1 / norm) : new Complex(0, 0);
        });

        return {
            collapsedState: collapsed,
            outcome,
            probability: chosenProb
        };
    }

    /**
     * Computes reduced 1-qubit density matrix ρ_q = Tr_{≠q}(|ψ⟩⟨ψ|),
     * Bloch vector (rx, ry, rz), polar/azimuthal angles, purity Tr(ρ_q²),
     * and marginal probabilities P(q=0), P(q=1).
     */
    static computeQubitBlochData(state, numQubits, q) {
        const dim = 1 << numQubits;
        const shift = numQubits - 1 - q;
        const mask = 1 << shift;

        let rho00 = 0;
        let rho11 = 0;
        let rho01 = new Complex(0, 0); // sum_{k} ψ_{k,q=0} * conj(ψ_{k,q=1})

        for (let i = 0; i < dim; i++) {
            if ((i & mask) === 0) {
                const i0 = i;
                const i1 = i | mask;
                const a0 = state[i0];
                const a1 = state[i1];
                rho00 += a0.abs2();
                rho11 += a1.abs2();
                rho01 = rho01.add(a0.mul(a1.conj()));
            }
        }

        // Standard Pauli expectations:
        // <X> = Tr(ρ X) = 2 Re(ρ01)
        // <Y> = Tr(ρ Y) = -2 Im(ρ01) = 2 Im(ρ10)
        // <Z> = Tr(ρ Z) = ρ00 - ρ11
        const rx = 2 * rho01.re;
        const ry = -2 * rho01.im;
        const rz = rho00 - rho11;

        const rLen = Math.min(1, Math.sqrt(rx * rx + ry * ry + rz * rz));
        const purity = Math.min(1, Math.max(0.5, 0.5 * (1 + rx * rx + ry * ry + rz * rz)));
        const isEntangled = rLen < 0.995;

        // Spherical angles (theta from +Z north pole [0..π], phi in XY plane [-π..π])
        const clampedZ = Math.max(-1, Math.min(1, rLen > 1e-6 ? rz / rLen : 1));
        const theta = rLen > 1e-6 ? Math.acos(clampedZ) : 0;
        const phi = Math.hypot(rx, ry) > 1e-6 ? Math.atan2(ry, rx) : 0;

        // Friendly state label if close to a cardinal Bloch state
        let stateLabel = 'Mixed / Entangled';
        if (!isEntangled) {
            if (rz > 0.99) stateLabel = '|0⟩';
            else if (rz < -0.99) stateLabel = '|1⟩';
            else if (rx > 0.99) stateLabel = '|+⟩';
            else if (rx < -0.99) stateLabel = '|−⟩';
            else if (ry > 0.99) stateLabel = '|+i⟩';
            else if (ry < -0.99) stateLabel = '|−i⟩';
            else stateLabel = `Pure (θ=${formatRadiansShort(theta)}, φ=${formatRadiansShort(phi)})`;
        }

        return {
            qubit: q,
            rx,
            ry,
            rz,
            rLen,
            purity,
            isEntangled,
            prob0: rho00,
            prob1: rho11,
            theta,
            phi,
            stateLabel
        };
    }

    /**
     * Simulates the entire circuit step-by-step and returns snapshots for every step
     * t = 0 (Initial State) through t = maxStep.
     *
     * Handles both:
     * 1) Coherent unitary evolution + exact Born-rule ensemble distribution
     * 2) Real projective statevector collapse (|ψ⟩ → Π_m |ψ⟩ / √P(m)) when a Measurement ('M')
     *    gate executes at step t, so 'M' has a genuine, observable physical effect on the statevector
     *    and Bloch spheres!
     */
    static simulateCircuit(circuit, measurementSeedMap = {}) {
        const { numQubits, numSteps, initialStates, gates } = circuit;
        const initialVec = this.createInitialStatevector(numQubits, initialStates);

        const snapshots = [];
        snapshots.push(this.buildSnapshot(0, initialVec, initialVec, numQubits, [], 'Initial State Preparation', initialVec, []));

        let currentVec = initialVec.map(c => c.clone());
        let coherentVec = initialVec.map(c => c.clone());
        const classicalRegister = new Array(numQubits).fill(null);

        for (let step = 0; step < numSteps; step++) {
            const stepGates = gates
                .filter(g => g.step === step)
                .sort((a, b) => a.qubit - b.qubit);

            const prevVec = currentVec.map(c => c.clone());
            const stepCollapseEvents = [];

            for (const g of stepGates) {
                if (g.type === 'M') {
                    // Perform genuine projective measurement collapse on currentVec using Born rule!
                    const forced = measurementSeedMap[g.id];
                    const collapseRes = this.collapseQubit(currentVec, numQubits, g.qubit, forced);
                    currentVec = collapseRes.collapsedState;
                    classicalRegister[g.qubit] = collapseRes.outcome;
                    stepCollapseEvents.push({
                        gateId: g.id,
                        qubit: g.qubit,
                        outcome: collapseRes.outcome,
                        probability: collapseRes.probability
                    });
                } else {
                    currentVec = this.applyGateToState(currentVec, numQubits, g);
                    coherentVec = this.applyGateToState(coherentVec, numQubits, g);
                }
            }

            const desc = stepGates.length > 0
                ? stepGates.map(g => {
                    if (g.type === 'M') {
                        const ev = stepCollapseEvents.find(e => e.gateId === g.id);
                        const outBit = ev ? ev.outcome : 0;
                        const probPct = ev ? (ev.probability * 100).toFixed(1) : '50.0';
                        return `Measure q${g.qubit} → collapsed to |${outBit}⟩ (Born prob ${probPct}%)`;
                    }
                    return this.describeGateOp(g);
                }).join('  •  ')
                : 'Identity (Wire Idle)';

            snapshots.push(
                this.buildSnapshot(
                    step + 1,
                    currentVec,
                    coherentVec,
                    numQubits,
                    stepGates,
                    desc,
                    prevVec,
                    stepCollapseEvents,
                    [...classicalRegister]
                )
            );
        }

        const measuredQubits = [...new Set(gates.filter(g => g.type === 'M').map(g => g.qubit))].sort();

        return {
            numQubits,
            numSteps,
            snapshots,
            measuredQubits
        };
    }

    static describeGateOp(g) {
        if (g.type === 'CNOT') return `CNOT (control q${g.qubit} → target q${g.targetQubit})`;
        if (g.type === 'CZ') return `CZ (q${g.qubit} ↔ q${g.targetQubit})`;
        if (g.type === 'SWAP') return `SWAP (q${g.qubit} ↔ q${g.targetQubit})`;
        if (g.type === 'M') return `Measure q${g.qubit} → c${g.qubit}`;
        if (GATE_LIBRARY[g.type] && GATE_LIBRARY[g.type].hasTheta) {
            return `${g.type}(${formatRadiansShort(g.theta)}) on q${g.qubit}`;
        }
        return `${g.type} on q${g.qubit}`;
    }

    static buildSnapshot(
        stepIndex,
        statevector,
        coherentStatevector,
        numQubits,
        stepGates,
        description,
        prevStatevector,
        collapseEvents = [],
        classicalRegister = []
    ) {
        const dim = 1 << numQubits;
        const basisStates = [];
        const theoreticalBasisStates = [];

        for (let i = 0; i < dim; i++) {
            const bitstring = i.toString(2).padStart(numQubits, '0');
            const amp = statevector[i];
            const prob = amp.abs2();
            const mag = amp.abs();
            const phase = amp.arg(); // radians in (-π, π]
            basisStates.push({
                index: i,
                bitstring,
                ket: `|${bitstring}⟩`,
                amplitude: amp,
                magnitude: mag,
                probability: prob,
                phaseRad: phase
            });

            const cohAmp = (coherentStatevector || statevector)[i];
            theoreticalBasisStates.push({
                index: i,
                bitstring,
                ket: `|${bitstring}⟩`,
                amplitude: cohAmp,
                magnitude: cohAmp.abs(),
                probability: cohAmp.abs2(),
                phaseRad: cohAmp.arg()
            });
        }

        const blochData = [];
        for (let q = 0; q < numQubits; q++) {
            blochData.push(this.computeQubitBlochData(statevector, numQubits, q));
        }

        const entangledQubits = blochData.filter(b => b.isEntangled).map(b => `q${b.qubit}`);
        const isSystemEntangled = numQubits > 1 && entangledQubits.length > 0;

        const nonZeroCount = basisStates.filter(b => b.probability > 1e-6).length;
        let stateClassification = 'Computational Basis State';
        if (collapseEvents.length > 0) {
            stateClassification = `Post-Measurement Collapsed State (${collapseEvents.map(e => `c${e.qubit}=${e.outcome}`).join(', ')})`;
        } else if (isSystemEntangled) {
            stateClassification = `Entangled Quantum State (${entangledQubits.join(', ')})`;
        } else if (nonZeroCount > 1) {
            stateClassification = 'Separable Quantum Superposition';
        }

        return {
            stepIndex,
            statevector,
            coherentStatevector: coherentStatevector || statevector,
            prevStatevector,
            basisStates,
            theoreticalBasisStates,
            blochData,
            isSystemEntangled,
            entangledQubits,
            stateClassification,
            stepGates,
            description,
            collapseEvents,
            classicalRegister,
            diracString: this.formatDiracString(basisStates),
            theoreticalDiracString: this.formatDiracString(theoreticalBasisStates)
        };
    }

    static formatDiracString(basisStates) {
        const terms = [];
        for (const b of basisStates) {
            if (b.magnitude < 1e-6) continue;
            const ampStr = b.amplitude.formatCartesian(3);
            if (ampStr === '1') {
                terms.push({ sign: '+', body: `${b.ket}` });
            } else if (ampStr === '-1') {
                terms.push({ sign: '−', body: `${b.ket}` });
            } else if (ampStr.startsWith('-') && !ampStr.includes(' ')) {
                terms.push({ sign: '−', body: `${ampStr.slice(1)}${b.ket}` });
            } else if (ampStr.includes(' ') && (ampStr.includes('+') || ampStr.includes('-'))) {
                terms.push({ sign: '+', body: `(${ampStr})${b.ket}` });
            } else {
                terms.push({ sign: '+', body: `${ampStr}${b.ket}` });
            }
        }
        if (terms.length === 0) return '0';
        return terms
            .map((t, idx) => (idx === 0 ? (t.sign === '−' ? `−${t.body}` : t.body) : `${t.sign} ${t.body}`))
            .join(' ');
    }

    /**
     * Samples `numShots` independent projective measurements from `basisStates`
     * using the Born rule P(x) = |α_x|².
     */
    static sampleMeasurements(basisStates, numShots = 1024) {
        const counts = {};
        basisStates.forEach(b => {
            counts[b.bitstring] = 0;
        });

        // Build cumulative distribution
        const cdf = [];
        let acc = 0;
        for (const b of basisStates) {
            acc += b.probability;
            cdf.push({ bitstring: b.bitstring, threshold: acc });
        }
        if (cdf.length > 0) {
            cdf[cdf.length - 1].threshold = 1.0;
        }

        for (let s = 0; s < numShots; s++) {
            const r = Math.random();
            for (let i = 0; i < cdf.length; i++) {
                if (r <= cdf[i].threshold) {
                    counts[cdf[i].bitstring]++;
                    break;
                }
            }
        }

        return counts;
    }
}

/**
 * Progressive, hands-on interactive lessons (inspired by the approachable Arduino starter kit
 * learning flow combined with IBM Quantum Composer circuits).
 */
const CIRCUIT_LESSONS = [
    {
        id: 'lesson_1_hw3_q1',
        number: 1,
        title: '1. Ch. 2 & HW3 Q1: Single-Qubit Gates (|0⟩ → H → Z → |−⟩)',
        badge: 'HW3 PART 1 Q1',
        numQubits: 1,
        initialStates: ['|0⟩'],
        gates: [
            { id: 'l1_g1', type: 'H', qubit: 0, step: 0 },
            { id: 'l1_g2', type: 'Z', qubit: 0, step: 1 },
            { id: 'l1_g3', type: 'M', qubit: 0, step: 3 }
        ],
        conceptTitle: 'Superposition & Relative Phase Flip (H followed by Z)',
        explanation: 'In CSE 4412 HW3 Q1, a qubit starts in |ψ₀⟩ = |0⟩ (North Pole of the 3D Bloch sphere pedestal). First, H creates |ψ₁⟩ = |+⟩ = (|0⟩ + |1⟩)/√2. Next, Z flips the phase of |1⟩ to −|1⟩, giving |ψ₂⟩ = |−⟩ = (|0⟩ − |1⟩)/√2. Notice that P(0) = P(1) = 50% at both |ψ₁⟩ and |ψ₂⟩, yet the 3D Bloch arrow rotated 180° across the equator!',
        tryThis: 'Place a second H gate at Step 2 (between Z and M): because H|−⟩ = |1⟩, destructive interference cancels |0⟩ and outputs |1⟩ with 100% probability (H·Z·H = X)!'
    },
    {
        id: 'lesson_2_exam1_basis',
        number: 2,
        title: '2. Ch. 3 & Exam 1: Superposition, Interference & Basis Measurement',
        badge: 'EXAM 1 SEC. 1',
        numQubits: 1,
        initialStates: ['|0⟩'],
        gates: [
            { id: 'l2_g1', type: 'H', qubit: 0, step: 0 },
            { id: 'l2_g2', type: 'H', qubit: 0, step: 1 },
            { id: 'l2_g3', type: 'M', qubit: 0, step: 2 }
        ],
        conceptTitle: 'Why Superposition is NOT a Classical Coin Flip (H · H = I)',
        explanation: 'At |ψ₁⟩ = H|0⟩ = (|0⟩ + |1⟩)/√2, measuring in the Z-basis gives 0 or 1 with 50% probability each. But if we do NOT measure at |ψ₁⟩ and instead apply a second H gate, the two paths for |1⟩ (+1/2 and −1/2) cancel by destructive interference: |ψ₂⟩ = H|+⟩ = |0⟩ with 100% certainty!',
        tryThis: 'Click any ↑ |ψₖ⟩ slice marker along the bottom of the 3D isometric stage to inspect the exact step-by-step algebra for |ψ₀⟩ → |ψ₁⟩ → |ψ₂⟩!'
    },
    {
        id: 'lesson_3_bell_hw3_q2',
        number: 3,
        title: '3. Ch. 4 & HW3 Q2: Constructing All 4 Bell States (|Φ⁺⟩, |Φ⁻⟩, |Ψ⁺⟩, |Ψ⁻⟩)',
        badge: 'HW3 PART 1 Q2',
        numQubits: 2,
        initialStates: ['|0⟩', '|0⟩'],
        gates: [
            { id: 'l3_g1', type: 'H', qubit: 0, step: 0 },
            { id: 'l3_g2', type: 'CNOT', qubit: 0, targetQubit: 1, step: 1 },
            { id: 'l3_g3', type: 'M', qubit: 0, step: 2 },
            { id: 'l3_g4', type: 'M', qubit: 1, step: 2 }
        ],
        conceptTitle: 'Entanglement & The Four EPR Bell States',
        explanation: 'Applying H on q0 and CNOT(q0 → q1) transforms |00⟩ into |Φ⁺⟩ = (|00⟩ + |11⟩)/√2. In the Step-by-Step Math panel on the right, see the formal CSE 4412 Exam 1 proof that ad = bc = 0 contradicts ac = bd = 1/√2, proving |Φ⁺⟩ is inseparable (entangled)!',
        tryThis: 'Click the initial state pedestals on the left of the 3D stage to change |00⟩ → |10⟩ (gives |Φ⁻⟩), |01⟩ (gives |Ψ⁺⟩), or |11⟩ (gives |Ψ⁻⟩)!'
    },
    {
        id: 'lesson_4_hw3_q3',
        number: 4,
        title: '4. Ch. 4 & HW3 Q3: Evaluating CNOT(H ⊗ H)|+, 0⟩ in the Z Basis',
        badge: 'HW3 PART 1 Q3',
        numQubits: 2,
        initialStates: ['|+⟩', '|0⟩'],
        gates: [
            { id: 'l4_g1', type: 'H', qubit: 0, step: 0 },
            { id: 'l4_g2', type: 'H', qubit: 1, step: 0 },
            { id: 'l4_g3', type: 'CNOT', qubit: 0, targetQubit: 1, step: 1 }
        ],
        conceptTitle: 'Step-by-Step Tensor Product Algebra: CNOT(H ⊗ H)|+, 0⟩',
        explanation: 'From CSE 4412 HW3 Part 1 Q3: Wire q0 starts in |+⟩ and wire q1 starts in |0⟩. At Step 1, (H ⊗ H)|+, 0⟩ = (H|+⟩) ⊗ (H|0⟩) = |0⟩ ⊗ |+⟩ = (|00⟩ + |01⟩)/√2. At Step 2, CNOT acts with control q0 = |0⟩, leaving the state unchanged as (|00⟩ + |01⟩)/√2!',
        tryThis: 'Check the Step-by-Step Math tab on the right to see the complete algebraic derivation and automatic separability factorization |0⟩ ⊗ |+⟩!'
    },
    {
        id: 'lesson_5_teleportation',
        number: 5,
        title: '5. Ch. 5 & Exam 1: Quantum Teleportation Protocol (3-Qubit Isometric Stage)',
        badge: 'TELEPORTATION',
        numQubits: 3,
        initialStates: ['|+⟩', '|0⟩', '|0⟩'],
        gates: [
            { id: 'l5_g1', type: 'H', qubit: 1, step: 0 },
            { id: 'l5_g2', type: 'CNOT', qubit: 1, targetQubit: 2, step: 1 },
            { id: 'l5_g3', type: 'CNOT', qubit: 0, targetQubit: 1, step: 2 },
            { id: 'l5_g4', type: 'H', qubit: 0, step: 3 },
            { id: 'l5_g5', type: 'M', qubit: 0, step: 4 },
            { id: 'l5_g6', type: 'M', qubit: 1, step: 4 }
        ],
        conceptTitle: 'Teleporting |ψ⟩ Across an Entangled Bell Pair |Φ⁺⟩',
        explanation: 'First, H on q1 and CNOT(q1→q2) create the shared Bell pair |Φ⁺⟩ between Alice (q1) and Bob (q2). Next, Alice entangles her payload qubit q0 with q1 via CNOT(q0→q1) and H on q0, then measures q0 and q1 to obtain 2 classical bits (m₀, m₁) that tell Bob which recovery gates Z^(m₀) X^(m₁) to apply!',
        tryThis: 'Step through t=0 → t=5 on the 3D Isometric Stage and click "🎲 Re-sample" after measurement to see all 4 classical outcomes (00, 01, 10, 11)!'
    },
    {
        id: 'lesson_6_bv_oracle',
        number: 6,
        title: '6. Ch. 6 & HW3 Part 2: Bernstein-Vazirani Oracle U_f (s = 01)',
        badge: 'HW3 PART 2 ORACLE',
        numQubits: 3,
        initialStates: ['|0⟩', '|0⟩', '|1⟩'],
        gates: [
            { id: 'l6_g1', type: 'H', qubit: 0, step: 0 },
            { id: 'l6_g2', type: 'H', qubit: 1, step: 0 },
            { id: 'l6_g3', type: 'H', qubit: 2, step: 0 },
            { id: 'l6_g4', type: 'CNOT', qubit: 1, targetQubit: 2, step: 1 },
            { id: 'l6_g5', type: 'H', qubit: 0, step: 2 },
            { id: 'l6_g6', type: 'H', qubit: 1, step: 2 },
            { id: 'l6_g7', type: 'M', qubit: 0, step: 3 },
            { id: 'l6_g8', type: 'M', qubit: 1, step: 3 }
        ],
        conceptTitle: 'Phase Kickback & Finding Secret String s in 1 Query',
        explanation: 'Top wires q0, q1 are the n=2 query register |00⟩; bottom wire q2 is the ancilla |1⟩. After H⊗³, the ancilla is in |−⟩. The Oracle U_f for s = 01 kicks back (−1)^(x·01), turning |+⟩|+⟩ into |+⟩|−⟩. The final H⊗² decodes |+⟩|−⟩ → |01⟩ = |s⟩ in a single query!',
        tryThis: 'Click the "🎓 Class Oracle Diagram (U_f)" tab above the stage to view the exact class chalkboard diagram with /ⁿ bundle notation and s = 01 / s = 101!'
    }
];

window.Complex = Complex;
window.formatRadians = formatRadians;
window.formatRadiansShort = formatRadiansShort;
window.GATE_LIBRARY = GATE_LIBRARY;
window.INITIAL_QUBIT_STATES = INITIAL_QUBIT_STATES;
window.QuantumCircuitSimulator = QuantumCircuitSimulator;
window.CIRCUIT_LESSONS = CIRCUIT_LESSONS;
