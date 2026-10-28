/**
 * course_math.js
 * Course-aligned Step-by-Step Mathematical Derivation Engine & Chapter Workbook
 * for the Quantum Circuit Lab.
 *
 * Aligned directly with:
 * - Phillip Kaye, Raymond Laflamme, Michele Mosca: "An Introduction to Quantum Computing" (Ch. 1–7)
 * - CSE 4412 (Prof. Walter O. Krawec): Exam 1 Study Guide, Homework 2, and Homework 3
 *   (Single-qubit gates, change-of-basis measurements, outer-product operators,
 *    Bell states |Φ⁺⟩, |Φ⁻⟩, |Ψ⁺⟩, |Ψ⁻⟩, entanglement vs. separability proofs,
 *    Quantum Teleportation, Phase Kickback, and Deutsch-Jozsa / Bernstein-Vazirani Oracles U_f).
 */

/**
 * Helper functions for textbook-grade HTML math formatting
 */
const MathFmt = {
    frac(num, den) {
        return `<span class="m-frac"><span class="m-num">${num}</span><span class="m-den">${den}</span></span>`;
    },
    ket(inside) {
        return `<span class="m-ket">|${inside}⟩</span>`;
    },
    bra(inside) {
        return `<span class="m-bra">⟨${inside}|</span>`;
    },
    braket(a, b) {
        return `<span class="m-braket">⟨${a}|${b}⟩</span>`;
    },
    outer(a, b) {
        return `<span class="m-outer">|${a}⟩⟨${b}|</span>`;
    },
    op(sym) {
        return `<span class="m-op">${sym}</span>`;
    },
    boxed(html) {
        return `<span class="m-boxed">${html}</span>`;
    }
};

/**
 * Live Step-by-Step Algebraic Derivation Engine for ANY circuit on the stage.
 * Given the circuit definition and simulation snapshots, produces human-readable,
 * textbook-formatted step-by-step algebraic equations for |ψ_0⟩ → |ψ_1⟩ → ... → |ψ_k⟩,
 * plus an automatic algebraic proof of Separability vs. Entanglement!
 */
class QuantumMathDerivationEngine {
    /**
     * Generates a complete list of step-by-step derivation cards for each slice t = 0..maxActiveStep
     */
    static generateCircuitDerivation(circuit, simResult, activeStepIndex) {
        const { numQubits, initialStates, gates } = circuit;
        const snapshots = simResult.snapshots;
        const steps = [];

        // Slice 0: Initial state |ψ_0⟩
        const snap0 = snapshots[0];
        const initTensorStr = initialStates
            .slice(0, numQubits)
            .map((s, q) => `<span class="m-ket">${s}</span><sub>q${q}</sub>`)
            .join(' ⊗ ');

        const initExpandedTerms = initialStates.slice(0, numQubits).map(s => {
            if (s === '|+⟩') return `${MathFmt.frac('1', '√2')}(|0⟩ + |1⟩)`;
            if (s === '|−⟩') return `${MathFmt.frac('1', '√2')}(|0⟩ − |1⟩)`;
            if (s === '|+i⟩') return `${MathFmt.frac('1', '√2')}(|0⟩ + i|1⟩)`;
            if (s === '|−i⟩') return `${MathFmt.frac('1', '√2')}(|0⟩ − i|1⟩)`;
            return s;
        });

        const hasSuperposInit = initialStates.slice(0, numQubits).some(s => s !== '|0⟩' && s !== '|1⟩');

        steps.push({
            stepIndex: 0,
            sliceLabel: '|ψ₀⟩',
            title: 'Slice 0 — Initial State Preparation',
            isActive: activeStepIndex === 0,
            operatorFormula: `|ψ₀⟩ = ${initTensorStr}`,
            ruleExplanation: `Each qubit wire starts in its prepared basis or superposition state. The joint ${numQubits}-qubit statevector is their tensor product in Hilbert space ℋ = (ℂ²)<sup>⊗${numQubits}</sup>.`,
            algebraLines: [
                `|ψ₀⟩ = ${initTensorStr}`,
                ...(hasSuperposInit ? [`= ${initExpandedTerms.join(' ⊗ ')}`] : []),
                `= ${MathFmt.boxed(this.formatStatePrettyHTML(snap0.basisStates))}`
            ],
            bornSummary: this.formatBornSummaryHTML(snap0.basisStates)
        });

        // Find highest step index that has a gate (or up to activeStepIndex)
        const maxGateStep = gates.reduce((m, g) => Math.max(m, g.step + 1), 0);
        const limitStep = Math.max(maxGateStep, activeStepIndex);

        for (let s = 1; s <= Math.min(snapshots.length - 1, Math.max(1, limitStep)); s++) {
            const snap = snapshots[s];
            const prevSnap = snapshots[s - 1];
            const stepGates = snap.stepGates || [];

            if (stepGates.length === 0 && s !== activeStepIndex) {
                continue;
            }

            const sliceLabel = `|ψ<sub>${s}</sub>⟩`;
            const prevLabel = `|ψ<sub>${s - 1}</sub>⟩`;

            if (stepGates.length === 0) {
                steps.push({
                    stepIndex: s,
                    sliceLabel: `|ψ${this.subDigit(s)}⟩`,
                    title: `Slice ${s} — Identity (Wires Idle)`,
                    isActive: activeStepIndex === s,
                    operatorFormula: `${sliceLabel} = I<sup>⊗${numQubits}</sup> ${prevLabel}`,
                    ruleExplanation: 'No quantum gates act in this time column, so the statevector evolves by the identity operator I.',
                    algebraLines: [
                        `${sliceLabel} = ${prevLabel} = ${MathFmt.boxed(this.formatStatePrettyHTML(snap.basisStates))}`
                    ],
                    bornSummary: this.formatBornSummaryHTML(snap.basisStates)
                });
                continue;
            }

            // Build operator tensor string & rule explanation for this column
            const opDesc = this.buildColumnOperatorDescription(numQubits, stepGates);
            const substitutionSteps = this.buildTermByTermExpansion(
                numQubits,
                prevSnap.basisStates,
                snap.basisStates,
                stepGates,
                snap.collapseEvents
            );

            steps.push({
                stepIndex: s,
                sliceLabel: `|ψ${this.subDigit(s)}⟩`,
                title: `Slice ${s} — Apply ${stepGates.map(g => this.shortGateName(g)).join(' ⊗ ')}`,
                isActive: activeStepIndex === s,
                operatorFormula: `${sliceLabel} = ${opDesc.tensorOp} ${prevLabel}`,
                ruleExplanation: opDesc.rulesHtml,
                algebraLines: [
                    `${sliceLabel} = ${opDesc.tensorOp} <span class="m-paren">[ ${this.formatStatePrettyHTML(prevSnap.basisStates)} ]</span>`,
                    ...substitutionSteps,
                    `= ${MathFmt.boxed(this.formatStatePrettyHTML(snap.basisStates))}`
                ],
                bornSummary: this.formatBornSummaryHTML(snap.basisStates)
            });
        }

        return steps;
    }

    static subDigit(n) {
        const subs = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
        return String(n)
            .split('')
            .map(d => subs[Number(d)] || d)
            .join('');
    }

    static shortGateName(g) {
        if (g.type === 'CNOT') return `CNOT(q${g.qubit}→q${g.targetQubit})`;
        if (g.type === 'CZ') return `CZ(q${g.qubit},q${g.targetQubit})`;
        if (g.type === 'SWAP') return `SWAP(q${g.qubit},q${g.targetQubit})`;
        if (g.type === 'M') return `Meas(q${g.qubit})`;
        if (GATE_LIBRARY[g.type]?.hasTheta) return `${g.type}(${formatRadiansShort(g.theta)})<sub>q${g.qubit}</sub>`;
        return `${g.type}<sub>q${g.qubit}</sub>`;
    }

    static buildColumnOperatorDescription(numQubits, stepGates) {
        const has2Q = stepGates.some(g => GATE_LIBRARY[g.type]?.numQubits === 2);
        const hasMeas = stepGates.some(g => g.type === 'M');

        let tensorOp = '';
        if (hasMeas) {
            const mWires = stepGates.filter(g => g.type === 'M').map(g => `q${g.qubit}`).join(', ');
            tensorOp = `Π<sub>meas(${mWires})</sub>`;
        } else if (!has2Q) {
            const wireOps = [];
            for (let q = 0; q < numQubits; q++) {
                const g = stepGates.find(item => item.qubit === q);
                if (!g) wireOps.push('I');
                else if (GATE_LIBRARY[g.type]?.hasTheta) wireOps.push(`${g.type}(${formatRadiansShort(g.theta)})`);
                else wireOps.push(g.type);
            }
            tensorOp = numQubits > 1 ? `(${wireOps.join(' ⊗ ')})` : wireOps[0];
        } else {
            tensorOp = stepGates.map(g => this.shortGateName(g)).join(' · ');
        }

        const rules = stepGates.map(g => {
            switch (g.type) {
                case 'H':
                    return `<strong>H on q${g.qubit}:</strong> H|0⟩ = ${MathFmt.frac('1', '√2')}(|0⟩ + |1⟩), &nbsp; H|1⟩ = ${MathFmt.frac('1', '√2')}(|0⟩ − |1⟩)`;
                case 'X':
                    return `<strong>Pauli-X on q${g.qubit}:</strong> X|0⟩ = |1⟩, &nbsp; X|1⟩ = |0⟩ (bit flip)`;
                case 'Y':
                    return `<strong>Pauli-Y on q${g.qubit}:</strong> Y|0⟩ = i|1⟩, &nbsp; Y|1⟩ = −i|0⟩`;
                case 'Z':
                    return `<strong>Pauli-Z on q${g.qubit}:</strong> Z|0⟩ = |0⟩, &nbsp; Z|1⟩ = −|1⟩ (phase flip on |1⟩)`;
                case 'S':
                    return `<strong>S Gate on q${g.qubit}:</strong> S|0⟩ = |0⟩, &nbsp; S|1⟩ = i|1⟩ = e<sup>iπ/2</sup>|1⟩`;
                case 'T':
                    return `<strong>T Gate on q${g.qubit}:</strong> T|0⟩ = |0⟩, &nbsp; T|1⟩ = e<sup>iπ/4</sup>|1⟩ = ${MathFmt.frac('1+i', '√2')}|1⟩`;
                case 'Rx':
                    return `<strong>Rx(${formatRadiansShort(g.theta)}) on q${g.qubit}:</strong> cos(${formatRadiansShort(g.theta / 2)})I − i sin(${formatRadiansShort(g.theta / 2)})X`;
                case 'Ry':
                    return `<strong>Ry(${formatRadiansShort(g.theta)}) on q${g.qubit}:</strong> Ry(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩`;
                case 'Rz':
                    return `<strong>Rz(${formatRadiansShort(g.theta)}) on q${g.qubit}:</strong> Rz(θ)|0⟩ = e<sup>−iθ/2</sup>|0⟩, &nbsp; Rz(θ)|1⟩ = e<sup>iθ/2</sup>|1⟩`;
                case 'CNOT':
                    return `<strong>CNOT (control q${g.qubit} → target q${g.targetQubit}):</strong> |c, t⟩ ↦ |c, t ⊕ c⟩ (flips target q${g.targetQubit} iff control q${g.qubit} = |1⟩)`;
                case 'CZ':
                    return `<strong>CZ (q${g.qubit}, q${g.targetQubit}):</strong> |11⟩ ↦ −|11⟩ (applies −1 phase iff both q${g.qubit}=1 and q${g.targetQubit}=1)`;
                case 'SWAP':
                    return `<strong>SWAP (q${g.qubit} ↔ q${g.targetQubit}):</strong> Exchanges the quantum states of wire q${g.qubit} and wire q${g.targetQubit}`;
                case 'M':
                    return `<strong>Projective Measurement on q${g.qubit}:</strong> P(m) = |⟨m|ψ⟩|², &nbsp; |ψ⟩ ↦ ${MathFmt.frac('Π_m |ψ⟩', '√P(m)')}`;
                default:
                    return '';
            }
        });

        return {
            tensorOp,
            rulesHtml: rules.join('<br>')
        };
    }

    /**
     * Produces intermediate algebraic substitution steps showing how the gate transforms each basis ket
     */
    static buildTermByTermExpansion(numQubits, prevBasis, nextBasis, stepGates, collapseEvents) {
        const activePrev = prevBasis.filter(b => b.magnitude > 1e-6);
        if (activePrev.length === 0) return [];

        if (collapseEvents && collapseEvents.length > 0) {
            return collapseEvents.map(ev => {
                const pct = (ev.probability * 100).toFixed(1);
                return `Projective collapse on q${ev.qubit} → outcome <strong>|${ev.outcome}⟩</strong> with Born probability P(${ev.outcome}) = ${pct}%, renormalizing by √P(${ev.outcome}) = √(${ev.probability.toFixed(3)})`;
            });
        }

        // If a single gate acts on the column, show the explicit action on each active ket
        if (stepGates.length === 1) {
            const g = stepGates[0];
            if (g.type === 'H' && activePrev.length <= 4) {
                const expandedPieces = activePrev.map(b => {
                    const coeffStr = this.formatAmpHTML(b.amplitude, false);
                    const prefix = coeffStr === '1' ? '' : coeffStr === '−1' ? '−' : `${coeffStr}·`;
                    const bit = b.bitstring[g.qubit];
                    const b0 = b.bitstring.slice(0, g.qubit) + '0' + b.bitstring.slice(g.qubit + 1);
                    const b1 = b.bitstring.slice(0, g.qubit) + '1' + b.bitstring.slice(g.qubit + 1);
                    const sign = bit === '0' ? '+' : '−';
                    return `${prefix}${MathFmt.frac('1', '√2')}(${MathFmt.ket(b0)} ${sign} ${MathFmt.ket(b1)})`;
                });
                return [`= ${expandedPieces.join(' + ').replace(/\+ −/g, '− ')}`];
            }
            if (g.type === 'CNOT' && activePrev.length <= 4) {
                const mappedPieces = activePrev.map(b => {
                    const coeffStr = this.formatAmpHTML(b.amplitude, false);
                    const prefix = coeffStr === '1' ? '' : coeffStr === '−1' ? '−' : `${coeffStr}`;
                    const cBit = Number(b.bitstring[g.qubit]);
                    const tBit = Number(b.bitstring[g.targetQubit]);
                    const newT = cBit ^ tBit;
                    const chars = b.bitstring.split('');
                    chars[g.targetQubit] = String(newT);
                    return `${prefix}${MathFmt.ket(chars.join(''))}<sub>(c=${cBit}, t=${tBit}⊕${cBit}=${newT})</sub>`;
                });
                return [`= ${mappedPieces.join(' + ').replace(/\+ −/g, '− ')}`];
            }
            if (g.type === 'Z' && activePrev.length <= 4) {
                const mappedPieces = activePrev.map(b => {
                    const bit = b.bitstring[g.qubit];
                    const flippedAmp = bit === '1' ? b.amplitude.mul(-1) : b.amplitude;
                    const coeffStr = this.formatAmpHTML(flippedAmp, false);
                    const prefix = coeffStr === '1' ? '' : coeffStr === '−1' ? '−' : `${coeffStr}`;
                    return `${prefix}${MathFmt.ket(b.bitstring)}`;
                });
                return [`= ${mappedPieces.join(' + ').replace(/\+ −/g, '− ')}`];
            }
        }

        // If all gates in column are H (like H ⊗ H), show product of superpositions
        if (stepGates.length === numQubits && stepGates.every(g => g.type === 'H') && activePrev.length === 1) {
            const b = activePrev[0];
            const factors = b.bitstring.split('').map(bit =>
                bit === '0'
                    ? `${MathFmt.frac('1', '√2')}(|0⟩ + |1⟩)`
                    : `${MathFmt.frac('1', '√2')}(|0⟩ − |1⟩)`
            );
            return [`= ${factors.join(' ⊗ ')}`];
        }

        return [];
    }

    /**
     * Formats a Complex amplitude into clean HTML (using stacked fractions for 1/√2, 1/2, √3/2, etc.)
     */
    static formatAmpHTML(amp, wrapParensIfSum = true) {
        const eps = 1e-6;
        const r = Math.abs(amp.re) < eps ? 0 : amp.re;
        const im = Math.abs(amp.im) < eps ? 0 : amp.im;

        const fmtRealHTML = val => {
            const sign = val < 0 ? '−' : '';
            const a = Math.abs(val);
            if (Math.abs(a - 1) < 1e-5) return `${sign}1`;
            if (Math.abs(a - 1 / Math.SQRT2) < 1e-4) return `${sign}${MathFmt.frac('1', '√2')}`;
            if (Math.abs(a - 0.5) < 1e-4) return `${sign}${MathFmt.frac('1', '2')}`;
            if (Math.abs(a - 0.25) < 1e-4) return `${sign}${MathFmt.frac('1', '4')}`;
            if (Math.abs(a - Math.sqrt(3) / 2) < 1e-4) return `${sign}${MathFmt.frac('√3', '2')}`;
            if (Math.abs(a - 1 / (2 * Math.SQRT2)) < 1e-4) return `${sign}${MathFmt.frac('1', '2√2')}`;
            if (Math.abs(a - Math.sqrt(2 / 3)) < 1e-4) return `${sign}${MathFmt.frac('√2', '√3')}`;
            if (Math.abs(a - 1 / Math.sqrt(3)) < 1e-4) return `${sign}${MathFmt.frac('1', '√3')}`;
            return `${sign}${Number(a.toFixed(3))}`;
        };

        if (r === 0 && im === 0) return '0';
        if (im === 0) return fmtRealHTML(r);
        if (r === 0) {
            if (Math.abs(im - 1) < 1e-5) return 'i';
            if (Math.abs(im + 1) < 1e-5) return '−i';
            return `${fmtRealHTML(im)}i`;
        }
        const imSign = im >= 0 ? '+' : '−';
        const absIm = Math.abs(im);
        const imPart = Math.abs(absIm - 1) < 1e-5 ? 'i' : `${fmtRealHTML(absIm)}i`;
        const combined = `${fmtRealHTML(r)} ${imSign} ${imPart}`;
        return wrapParensIfSum ? `(${combined})` : combined;
    }

    /**
     * Formats an array of basisStates into a textbook HTML ket equation
     */
    static formatStatePrettyHTML(basisStates) {
        const nonZero = basisStates.filter(b => b.magnitude > 1e-6);
        if (nonZero.length === 0) return '0';

        // Check if all non-zero terms share a common factor like 1/√2, 1/2, or 1/(2√2)
        const mags = nonZero.map(b => b.magnitude);
        const allSameMag = mags.every(m => Math.abs(m - mags[0]) < 1e-4);
        if (nonZero.length >= 2 && allSameMag) {
            const m = mags[0];
            let commonFactorHTML = null;
            if (Math.abs(m - 1 / Math.SQRT2) < 1e-4) commonFactorHTML = MathFmt.frac('1', '√2');
            else if (Math.abs(m - 0.5) < 1e-4) commonFactorHTML = MathFmt.frac('1', '2');
            else if (Math.abs(m - 1 / (2 * Math.SQRT2)) < 1e-4) commonFactorHTML = MathFmt.frac('1', '2√2');

            if (commonFactorHTML) {
                const allUnitRealOrImag = nonZero.every(b => {
                    const scaled = b.amplitude.mul(1 / m);
                    return (
                        (Math.abs(Math.abs(scaled.re) - 1) < 1e-3 && Math.abs(scaled.im) < 1e-3) ||
                        (Math.abs(Math.abs(scaled.im) - 1) < 1e-3 && Math.abs(scaled.re) < 1e-3)
                    );
                });

                if (allUnitRealOrImag) {
                    const innerTerms = nonZero.map((b, idx) => {
                        const scaled = b.amplitude.mul(1 / m);
                        let sign = '+';
                        let coeff = '';
                        if (Math.abs(scaled.re - 1) < 1e-3) {
                            sign = '+';
                        } else if (Math.abs(scaled.re + 1) < 1e-3) {
                            sign = '−';
                        } else if (Math.abs(scaled.im - 1) < 1e-3) {
                            sign = '+';
                            coeff = 'i';
                        } else if (Math.abs(scaled.im + 1) < 1e-3) {
                            sign = '−';
                            coeff = 'i';
                        }
                        const ketHTML = MathFmt.ket(b.bitstring);
                        if (idx === 0) {
                            return `${sign === '−' ? '−' : ''}${coeff}${ketHTML}`;
                        }
                        return `${sign} ${coeff}${ketHTML}`;
                    });
                    return `${commonFactorHTML} <span class="m-paren">( ${innerTerms.join(' ')} )</span>`;
                }
            }
        }

        // General term-by-term formatting
        return nonZero
            .map((b, idx) => {
                const ampHTML = this.formatAmpHTML(b.amplitude, true);
                const ketHTML = MathFmt.ket(b.bitstring);
                if (ampHTML === '1') {
                    return idx === 0 ? ketHTML : `+ ${ketHTML}`;
                }
                if (ampHTML === '−1') {
                    return idx === 0 ? `−${ketHTML}` : `− ${ketHTML}`;
                }
                if (ampHTML.startsWith('−')) {
                    return idx === 0 ? `${ampHTML}${ketHTML}` : `− ${ampHTML.slice(1)}${ketHTML}`;
                }
                return idx === 0 ? `${ampHTML}${ketHTML}` : `+ ${ampHTML}${ketHTML}`;
            })
            .join(' ');
    }

    static formatBornSummaryHTML(basisStates) {
        const active = basisStates.filter(b => b.probability > 1e-5);
        return active
            .map(b => {
                const pct = (b.probability * 100).toFixed(1).replace(/\.0$/, '');
                let fracStr = `${pct}%`;
                if (Math.abs(b.probability - 0.5) < 1e-4) fracStr = `1/2 (50%)`;
                else if (Math.abs(b.probability - 0.25) < 1e-4) fracStr = `1/4 (25%)`;
                else if (Math.abs(b.probability - 0.75) < 1e-4) fracStr = `3/4 (75%)`;
                else if (Math.abs(b.probability - 0.125) < 1e-4) fracStr = `1/8 (12.5%)`;
                else if (Math.abs(b.probability - 1) < 1e-4) fracStr = `1 (100%)`;
                return `<span class="m-born-chip">P(${b.bitstring}) = |⟨${b.bitstring}|ψ⟩|² = <strong>${fracStr}</strong></span>`;
            })
            .join(' ');
    }

    /**
     * Generates a formal CSE 4412 Exam 1 style algebraic proof of whether the current
     * 2-qubit state (or multi-qubit state) is Separable or Entangled!
     */
    static generateEntanglementProofHTML(snap, numQubits) {
        if (numQubits === 1) {
            const b = snap.blochData[0];
            return {
                title: 'Single-Qubit Pure State Analysis',
                isEntangled: false,
                stepsHTML: [
                    `State: <strong>|ψ⟩ = ${this.formatStatePrettyHTML(snap.basisStates)}</strong>`,
                    `Norm check: ⟨ψ|ψ⟩ = |α₀|² + |α₁|² = ${snap.basisStates[0].probability.toFixed(3)} + ${snap.basisStates[1].probability.toFixed(3)} = <strong>1.000</strong>.`,
                    `Bloch coordinates: (x, y, z) = (${b.rx.toFixed(2)}, ${b.ry.toFixed(2)}, ${b.rz.toFixed(2)}), length |r| = 1.`
                ]
            };
        }

        if (numQubits === 2) {
            const [b00, b01, b10, b11] = snap.basisStates;
            const a00 = b00.amplitude;
            const a01 = b01.amplitude;
            const a10 = b10.amplitude;
            const a11 = b11.amplitude;

            // Determinant Δ = α_00 * α_11 - α_01 * α_10
            const prod1 = a00.mul(a11);
            const prod2 = a01.mul(a10);
            const det = prod1.sub(prod2);
            const isEntangled = det.abs() > 1e-5;

            const q0Bloch = snap.blochData[0];
            const q1Bloch = snap.blochData[1];

            if (isEntangled) {
                return {
                    title: 'Algebraic Proof of Entanglement (CSE 4412 Exam 1 Method)',
                    isEntangled: true,
                    stepsHTML: [
                        `<strong>1. Assume for contradiction</strong> that |ψ⟩ is separable into a tensor product of two single-qubit states:<br>
                         <code>(a|0⟩ + b|1⟩) ⊗ (c|0⟩ + d|1⟩) = ac|00⟩ + ad|01⟩ + bc|10⟩ + bd|11⟩</code>`,
                        `<strong>2. Match coefficients</strong> with current state |ψ⟩ = ${this.formatStatePrettyHTML(snap.basisStates)}:<br>
                         <code>ac = ${a00.formatCartesian(3)}, &nbsp; ad = ${a01.formatCartesian(3)}, &nbsp; bc = ${a10.formatCartesian(3)}, &nbsp; bd = ${a11.formatCartesian(3)}</code>`,
                        `<strong>3. Test the separability condition</strong> <code>(ac)(bd) = (ad)(bc)</code>:<br>
                         • Left side: <code>(ac)(bd) = (${a00.formatCartesian(2)})(${a11.formatCartesian(2)}) = ${prod1.formatCartesian(3)}</code><br>
                         • Right side: <code>(ad)(bc) = (${a01.formatCartesian(2)})(${a10.formatCartesian(2)}) = ${prod2.formatCartesian(3)}</code>`,
                        `<strong>4. Conclusion:</strong> Since <code>(ac)(bd) ≠ (ad)(bc)</code> (difference Δ = ${det.formatCartesian(3)} ≠ 0), no such complex numbers a, b, c, d exist! <strong>Therefore, |ψ⟩ is provably ENTANGLED (Q.E.D.).</strong>`
                    ]
                };
            } else {
                return {
                    title: 'Algebraic Proof of Separability (Product State Factorization)',
                    isEntangled: false,
                    stepsHTML: [
                        `<strong>1. Test the tensor product condition</strong> <code>(a|0⟩ + b|1⟩) ⊗ (c|0⟩ + d|1⟩) = ac|00⟩ + ad|01⟩ + bc|10⟩ + bd|11⟩</code> on |ψ⟩ = ${this.formatStatePrettyHTML(snap.basisStates)}:`,
                        `<strong>2. Check determinant</strong> <code>(ac)(bd) − (ad)(bc)</code>:<br>
                         <code>(${a00.formatCartesian(2)})(${a11.formatCartesian(2)}) − (${a01.formatCartesian(2)})(${a10.formatCartesian(2)}) = ${prod1.formatCartesian(3)} − ${prod2.formatCartesian(3)} = 0</code> ✓`,
                        `<strong>3. Explicit Factorization:</strong><br>
                         ${MathFmt.boxed(`|ψ⟩ = ${q0Bloch.stateLabel}<sub>q0</sub> ⊗ ${q1Bloch.stateLabel}<sub>q1</sub>`)} — <strong>The state is SEPARABLE (unentangled).</strong>`
                    ]
                };
            }
        }

        // 3 or 4 qubits
        const entWires = snap.entangledQubits;
        return {
            title: `${numQubits}-Qubit Composite State Analysis (Reduced Density Matrix Trace)`,
            isEntangled: snap.isSystemEntangled,
            stepsHTML: [
                `Current ${numQubits}-qubit state: <strong>|ψ⟩ = ${this.formatStatePrettyHTML(snap.basisStates)}</strong>`,
                snap.isSystemEntangled
                    ? `Tracing out partner qubits gives reduced density matrix purity Tr(ρ<sub>q</sub>²) &lt; 1 on wires <strong>${entWires.join(', ')}</strong> (Bloch vector length |r| &lt; 1). Therefore, the system is <strong>ENTANGLED</strong>.`
                    : `Every single-qubit reduced density matrix has Purity Tr(ρ<sub>q</sub>²) = 1.00 (Bloch vector length |r| = 1). Therefore, the state is <strong>SEPARABLE</strong>: ${snap.blochData.map((b, q) => `${b.stateLabel}<sub>q${q}</sub>`).join(' ⊗ ')}.`
            ]
        };
    }
}

/**
 * Class-Style Quantum Oracle (U_f) & Algorithm Presets
 * Matching https://quantum.scene7.com/is/image/quantum/quantum-algorithms-1920X1080-1:1600-above
 * and CSE 4412 HW 3 Part Two!
 */
const ORACLE_ALGORITHM_PRESETS = {
    bv_s01: {
        id: 'bv_s01',
        title: 'HW3 Part 2(a): Bernstein-Vazirani Oracle — Secret String s = 01 (n = 2)',
        badge: 'CSE 4412 HW3 PART 2(a)',
        n: 2,
        secretString: '01',
        formulaDesc: 'f(x) = x · s (mod 2) = x₁·0 ⊕ x₂·1 = x₂',
        truthTable: [
            { x: '00', fx: 0, calc: '0·0 + 0·1 = 0' },
            { x: '01', fx: 1, calc: '0·0 + 1·1 = 1' },
            { x: '10', fx: 0, calc: '1·0 + 0·1 = 0' },
            { x: '11', fx: 1, calc: '1·0 + 1·1 = 1' }
        ],
        slices: [
            {
                id: 'psi0',
                label: '|ψ₀⟩',
                stageTitle: 'Before First Hadamard Layer (Initial State)',
                formulaHTML: `|ψ₀⟩ = |0⟩<sup>⊗2</sup> ⊗ |1⟩ = |00⟩|1⟩`,
                stepsHTML: [
                    `Top query register has <code>n = 2</code> wires initialized to <code>|0⟩<sup>⊗2</sup> = |00⟩</code>.`,
                    `Bottom ancilla wire is initialized to <code>|1⟩</code> so that the first Hadamard turns it into the phase-kickback eigenstate <code>|−⟩</code>.`
                ]
            },
            {
                id: 'psi1',
                label: '|ψ₁⟩',
                stageTitle: 'After First H^⊗(n+1) Layer (Before Oracle U_f)',
                formulaHTML: `|ψ₁⟩ = H<sup>⊗3</sup>(|00⟩|1⟩) = ${MathFmt.frac('1', '2')}(|00⟩ + |01⟩ + |10⟩ + |11⟩) ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')}`,
                stepsHTML: [
                    `Apply <code>H<sup>⊗2</sup></code> to the top 2 wires: <code>H|0⟩ ⊗ H|0⟩ = ${MathFmt.frac('1', '√2')}(|0⟩+|1⟩) ⊗ ${MathFmt.frac('1', '√2')}(|0⟩+|1⟩) = ${MathFmt.frac('1', '2')}(|00⟩ + |01⟩ + |10⟩ + |11⟩)</code>.`,
                    `Apply <code>H</code> to the bottom wire: <code>H|1⟩ = |−⟩ = ${MathFmt.frac('|0⟩ − |1⟩', '√2')}</code>.`,
                    `Compact sum notation: <code>|ψ₁⟩ = ${MathFmt.frac('1', '2')} ∑<sub>x∈{0,1}²</sub> |x⟩ |−⟩</code>.`
                ]
            },
            {
                id: 'psi2',
                label: '|ψ₂⟩',
                stageTitle: 'After Quantum Oracle U_f (Phase Kickback!)',
                formulaHTML: `|ψ₂⟩ = U<sub>f</sub>|ψ₁⟩ = ${MathFmt.frac('1', '2')}(|00⟩ − |01⟩ + |10⟩ − |11⟩) ⊗ |−⟩`,
                stepsHTML: [
                    `By Phase Kickback, <code>U<sub>f</sub>|x⟩|−⟩ = (−1)<sup>f(x)</sup>|x⟩|−⟩</code> where <code>f(x) = x · 01 (mod 2)</code>:`,
                    `• <code>x = 00: f(00) = 0  ⟹  (−1)⁰|00⟩ = +|00⟩</code><br>
                     • <code>x = 01: f(01) = 1  ⟹  (−1)¹|01⟩ = −|01⟩</code><br>
                     • <code>x = 10: f(10) = 0  ⟹  (−1)⁰|10⟩ = +|10⟩</code><br>
                     • <code>x = 11: f(11) = 1  ⟹  (−1)¹|11⟩ = −|11⟩</code>`,
                    `Factoring the top 2 qubits: <code>${MathFmt.frac('1', '2')}(|00⟩ − |01⟩ + |10⟩ − |11⟩) = ${MathFmt.frac('|0⟩ + |1⟩', '√2')} ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')} = |+⟩|−⟩</code>!`
                ]
            },
            {
                id: 'psi3',
                label: '|ψ₃⟩',
                stageTitle: 'After Final H^⊗n Layer (Before Measurement)',
                formulaHTML: `|ψ₃⟩ = (H<sup>⊗2</sup> ⊗ I)|ψ₂⟩ = |01⟩ ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')} = |s⟩|−⟩`,
                stepsHTML: [
                    `Apply <code>H<sup>⊗2</sup></code> to the top register <code>|+⟩|−⟩</code>:`,
                    `Since <code>H|+⟩ = |0⟩</code> and <code>H|−⟩ = |1⟩</code>:<br>
                     <code>(H ⊗ H)(|+⟩ ⊗ |−⟩) = (H|+⟩) ⊗ (H|−⟩) = |0⟩ ⊗ |1⟩ = |01⟩</code>!`,
                    `<strong>Final Answer:</strong> Measuring the top 2 wires in the Z-basis outputs <code>|01⟩ = s</code> with <strong>100% probability (P(01) = 1)</strong> in a single oracle query!`
                ]
            }
        ],
        equivalentCircuit: {
            numQubits: 3,
            initialStates: ['|0⟩', '|0⟩', '|1⟩'],
            gates: [
                { id: 'bv01_1', type: 'H', qubit: 0, step: 0 },
                { id: 'bv01_2', type: 'H', qubit: 1, step: 0 },
                { id: 'bv01_3', type: 'H', qubit: 2, step: 0 },
                { id: 'bv01_4', type: 'CNOT', qubit: 1, targetQubit: 2, step: 1 },
                { id: 'bv01_5', type: 'H', qubit: 0, step: 2 },
                { id: 'bv01_6', type: 'H', qubit: 1, step: 2 },
                { id: 'bv01_7', type: 'M', qubit: 0, step: 3 },
                { id: 'bv01_8', type: 'M', qubit: 1, step: 3 }
            ]
        }
    },
    bv_s101: {
        id: 'bv_s101',
        title: 'HW3 Part 2(b): Bernstein-Vazirani Oracle — Secret String s = 101 (n = 3)',
        badge: 'CSE 4412 HW3 PART 2(b)',
        n: 3,
        secretString: '101',
        formulaDesc: 'f(x) = x · s (mod 2) = x₁·1 ⊕ x₂·0 ⊕ x₃·1 = x₁ ⊕ x₃',
        truthTable: [
            { x: '000', fx: 0, calc: '0+0+0 = 0' },
            { x: '001', fx: 1, calc: '0+0+1 = 1' },
            { x: '010', fx: 0, calc: '0+0+0 = 0' },
            { x: '011', fx: 1, calc: '0+0+1 = 1' },
            { x: '100', fx: 1, calc: '1+0+0 = 1' },
            { x: '101', fx: 0, calc: '1+0+1 = 2 ≡ 0' },
            { x: '110', fx: 1, calc: '1+0+0 = 1' },
            { x: '111', fx: 0, calc: '1+0+1 = 2 ≡ 0' }
        ],
        slices: [
            {
                id: 'psi0',
                label: '|ψ₀⟩',
                stageTitle: 'Before First Hadamard Layer (Initial State)',
                formulaHTML: `|ψ₀⟩ = |0⟩<sup>⊗3</sup> ⊗ |1⟩ = |000⟩|1⟩`,
                stepsHTML: [
                    `For <code>s = 101</code>, we have <code>n = 3</code> input wires initialized to <code>|000⟩</code> and <code>1</code> ancilla wire initialized to <code>|1⟩</code> (total <code>n + 1 = 4</code> wires).`
                ]
            },
            {
                id: 'psi1',
                label: '|ψ₁⟩',
                stageTitle: 'After First H^⊗4 Layer (Before Oracle U_f)',
                formulaHTML: `|ψ₁⟩ = ${MathFmt.frac('1', '√8')}(|000⟩ + |001⟩ + |010⟩ + |011⟩ + |100⟩ + |101⟩ + |110⟩ + |111⟩) ⊗ |−⟩`,
                stepsHTML: [
                    `Applying <code>H<sup>⊗3</sup></code> to <code>|000⟩</code> creates an equal superposition of all <code>2³ = 8</code> computational basis states with amplitude <code>1/√2³ = 1/(2√2)</code>:`,
                    `<code>|ψ₁⟩ = ${MathFmt.frac('1', '2√2')} ∑<sub>x∈{0,1}³</sub> |x⟩ ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')}</code>.`
                ]
            },
            {
                id: 'psi2',
                label: '|ψ₂⟩',
                stageTitle: 'After Quantum Oracle U_f (Phase Kickback for s = 101)',
                formulaHTML: `|ψ₂⟩ = ${MathFmt.frac('1', '2√2')}(|000⟩ − |001⟩ + |010⟩ − |011⟩ − |100⟩ + |101⟩ − |110⟩ + |111⟩) ⊗ |−⟩`,
                stepsHTML: [
                    `Each basis state <code>|x⟩</code> picks up phase <code>(−1)<sup>x·101</sup> = (−1)<sup>x₁⊕x₃</sup></code>:`,
                    `• Positive (+1) when <code>x₁ ⊕ x₃ = 0</code>: <code>|000⟩, |010⟩, |101⟩, |111⟩</code><br>
                     • Negative (−1) when <code>x₁ ⊕ x₃ = 1</code>: <code>−|001⟩, −|011⟩, −|100⟩, −|110⟩</code>`,
                    `Factoring into single-qubit kets:<br>
                     <code>${MathFmt.frac('|0⟩ − |1⟩', '√2')} ⊗ ${MathFmt.frac('|0⟩ + |1⟩', '√2')} ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')} ⊗ |−⟩ = |−⟩|+⟩|−⟩ ⊗ |−⟩</code>!`
                ]
            },
            {
                id: 'psi3',
                label: '|ψ₃⟩',
                stageTitle: 'After Final H^⊗3 Layer (Before Measurement)',
                formulaHTML: `|ψ₃⟩ = (H<sup>⊗3</sup> ⊗ I)(|−⟩|+⟩|−⟩ ⊗ |−⟩) = |101⟩ ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')}`,
                stepsHTML: [
                    `Apply <code>H</code> to each of the 3 top qubits using <code>H|−⟩ = |1⟩</code> and <code>H|+⟩ = |0⟩</code>:`,
                    `<code>(H|−⟩) ⊗ (H|+⟩) ⊗ (H|−⟩) = |1⟩ ⊗ |0⟩ ⊗ |1⟩ = |101⟩</code>!`,
                    `<strong>Final Answer:</strong> Measuring the top 3 wires yields <code>|101⟩ = s</code> with <strong>100% certainty</strong>!`
                ]
            }
        ],
        equivalentCircuit: {
            numQubits: 4,
            initialStates: ['|0⟩', '|0⟩', '|0⟩', '|1⟩'],
            gates: [
                { id: 'bv101_1', type: 'H', qubit: 0, step: 0 },
                { id: 'bv101_2', type: 'H', qubit: 1, step: 0 },
                { id: 'bv101_3', type: 'H', qubit: 2, step: 0 },
                { id: 'bv101_4', type: 'H', qubit: 3, step: 0 },
                { id: 'bv101_5', type: 'CNOT', qubit: 0, targetQubit: 3, step: 1 },
                { id: 'bv101_6', type: 'CNOT', qubit: 2, targetQubit: 3, step: 2 },
                { id: 'bv101_7', type: 'H', qubit: 0, step: 3 },
                { id: 'bv101_8', type: 'H', qubit: 1, step: 3 },
                { id: 'bv101_9', type: 'H', qubit: 2, step: 3 },
                { id: 'bv101_10', type: 'M', qubit: 0, step: 4 },
                { id: 'bv101_11', type: 'M', qubit: 1, step: 4 },
                { id: 'bv101_12', type: 'M', qubit: 2, step: 4 }
            ]
        }
    },
    deutsch_balanced: {
        id: 'deutsch_balanced',
        title: 'KLM Ch. 6.3: Deutsch’s Algorithm — Balanced Oracle f(0)=0, f(1)=1 (n = 1)',
        badge: 'MOSCA CH. 6.3',
        n: 1,
        secretString: '1',
        formulaDesc: 'f(x) = x  (Balanced: f(0) ⊕ f(1) = 1)',
        truthTable: [
            { x: '0', fx: 0, calc: 'f(0) = 0' },
            { x: '1', fx: 1, calc: 'f(1) = 1' }
        ],
        slices: [
            {
                id: 'psi0',
                label: '|ψ₀⟩',
                stageTitle: 'Initial State Preparation',
                formulaHTML: `|ψ₀⟩ = |0⟩|1⟩`,
                stepsHTML: [`Top query qubit is <code>|0⟩</code>; bottom ancilla qubit is <code>|1⟩</code>.`]
            },
            {
                id: 'psi1',
                label: '|ψ₁⟩',
                stageTitle: 'After First Hadamard Layer H ⊗ H',
                formulaHTML: `|ψ₁⟩ = ${MathFmt.frac('|0⟩ + |1⟩', '√2')} ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')} = |+⟩|−⟩`,
                stepsHTML: [`Query qubit is in equal superposition <code>|+⟩</code>; target qubit is in eigenstate <code>|−⟩</code>.`]
            },
            {
                id: 'psi2',
                label: '|ψ₂⟩',
                stageTitle: 'After Oracle U_f (Relative Phase Encoded)',
                formulaHTML: `|ψ₂⟩ = ${MathFmt.frac('(−1)^f(0)|0⟩ + (−1)^f(1)|1⟩', '√2')} ⊗ |−⟩ = ${MathFmt.frac('|0⟩ − |1⟩', '√2')} ⊗ |−⟩`,
                stepsHTML: [
                    `Because <code>f(0) = 0</code> and <code>f(1) = 1</code>, the relative phase between <code>|0⟩</code> and <code>|1⟩</code> flips from + to −, turning <code>|+⟩</code> into <code>|−⟩</code>!`
                ]
            },
            {
                id: 'psi3',
                label: '|ψ₃⟩',
                stageTitle: 'After Final Hadamard on Query Wire',
                formulaHTML: `|ψ₃⟩ = (H ⊗ I)(|−⟩|−⟩) = |1⟩ ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')}`,
                stepsHTML: [
                    `Measuring the top qubit yields <code>|1⟩ = |f(0) ⊕ f(1)⟩</code> with 100% probability, proving <code>f</code> is <strong>Balanced</strong> in just 1 query (classically requires 2 queries)!`
                ]
            }
        ],
        equivalentCircuit: {
            numQubits: 2,
            initialStates: ['|0⟩', '|1⟩'],
            gates: [
                { id: ' dj_1', type: 'H', qubit: 0, step: 0 },
                { id: ' dj_2', type: 'H', qubit: 1, step: 0 },
                { id: ' dj_3', type: 'CNOT', qubit: 0, targetQubit: 1, step: 1 },
                { id: ' dj_4', type: 'H', qubit: 0, step: 2 },
                { id: ' dj_5', type: 'M', qubit: 0, step: 3 }
            ]
        }
    },
    dj_constant: {
        id: 'dj_constant',
        title: 'KLM Ch. 6.4: Deutsch-Jozsa — Constant Oracle f(x) = 1 for all x (n = 2)',
        badge: 'MOSCA CH. 6.4',
        n: 2,
        secretString: '00 (f=1)',
        formulaDesc: 'f(x) = 1 for all x ∈ {0,1}² (Constant Function)',
        truthTable: [
            { x: '00', fx: 1, calc: 'f(00) = 1' },
            { x: '01', fx: 1, calc: 'f(01) = 1' },
            { x: '10', fx: 1, calc: 'f(10) = 1' },
            { x: '11', fx: 1, calc: 'f(11) = 1' }
        ],
        slices: [
            {
                id: 'psi0',
                label: '|ψ₀⟩',
                stageTitle: 'Initial State Preparation',
                formulaHTML: `|ψ₀⟩ = |00⟩|1⟩`,
                stepsHTML: [`Top 2 query wires start in <code>|00⟩</code>; bottom ancilla wire starts in <code>|1⟩</code>.`]
            },
            {
                id: 'psi1',
                label: '|ψ₁⟩',
                stageTitle: 'After First H^⊗3 Layer',
                formulaHTML: `|ψ₁⟩ = ${MathFmt.frac('1', '2')}(|00⟩ + |01⟩ + |10⟩ + |11⟩) ⊗ |−⟩`,
                stepsHTML: [`All 4 inputs <code>00, 01, 10, 11</code> are queried in uniform superposition.`]
            },
            {
                id: 'psi2',
                label: '|ψ₂⟩',
                stageTitle: 'After Constant Oracle U_f (Global Phase −1)',
                formulaHTML: `|ψ₂⟩ = −${MathFmt.frac('1', '2')}(|00⟩ + |01⟩ + |10⟩ + |11⟩) ⊗ |−⟩ = −|+⟩|+⟩|−⟩`,
                stepsHTML: [
                    `Since <code>f(x) = 1</code> for every <code>x</code>, every term gets <code>(−1)¹ = −1</code>. This is a global phase <code>−1</code>, so the relative phases between basis states are unchanged!`
                ]
            },
            {
                id: 'psi3',
                label: '|ψ₃⟩',
                stageTitle: 'After Final H^⊗2 Layer (Constructive Interference on |00⟩)',
                formulaHTML: `|ψ₃⟩ = −|00⟩ ⊗ ${MathFmt.frac('|0⟩ − |1⟩', '√2')}`,
                stepsHTML: [
                    `Applying <code>H<sup>⊗2</sup></code> maps <code>−|+⟩|+⟩ ↦ −|00⟩</code>.`,
                    `Probability of measuring <code>|00⟩</code> is <code>|−1|² = 1 (100%)</code>! Since we measured all <code>0</code>s, the algorithm outputs <strong>CONSTANT</strong>.`
                ]
            }
        ],
        equivalentCircuit: {
            numQubits: 3,
            initialStates: ['|0⟩', '|0⟩', '|1⟩'],
            gates: [
                { id: 'djc_1', type: 'H', qubit: 0, step: 0 },
                { id: 'djc_2', type: 'H', qubit: 1, step: 0 },
                { id: 'djc_3', type: 'H', qubit: 2, step: 0 },
                { id: 'djc_4', type: 'X', qubit: 2, step: 1 },
                { id: 'djc_5', type: 'H', qubit: 0, step: 2 },
                { id: 'djc_6', type: 'H', qubit: 1, step: 2 },
                { id: 'djc_7', type: 'M', qubit: 0, step: 3 },
                { id: 'djc_8', type: 'M', qubit: 1, step: 3 }
            ]
        }
    }
};

/**
 * Complete Course Chapters & Worked Examples Catalog
 * Covering Kaye-Laflamme-Mosca ("Mosca.pdf"), CSE 4412 Exam 1 Study Guide ("Capture.PNG"),
 * Homework 2 ("HW2.pdf"), and Homework 3 ("HW3.pdf").
 */
const COURSE_CHAPTERS = [
    {
        id: 'ch1_linear_algebra',
        number: 'Chapter 1 & 2',
        title: 'Dirac Bra-Ket Notation, Inner/Outer Products & Unitary Operators',
        sourceTag: 'Kaye-Laflamme-Mosca Ch. 2 • CSE 4412 Exam 1 Sec. 2 • HW2',
        summary: 'Vectors in Hilbert space ℋ are written as kets |ψ⟩, dual row vectors as bras ⟨ψ| = (|ψ⟩)†, inner products as ⟨ψ|φ⟩, and linear operators as outer products |ψ⟩⟨φ| or unitary matrices U†U = I.',
        keyFormulas: [
            {
                name: 'Computational & Hadamard Bases',
                eq: `|0⟩ = <span class="m-vec">[1, 0]<sup>T</sup></span>, &nbsp; |1⟩ = <span class="m-vec">[0, 1]<sup>T</sup></span>, &nbsp; |+⟩ = ${MathFmt.frac('|0⟩ + |1⟩', '√2')}, &nbsp; |−⟩ = ${MathFmt.frac('|0⟩ − |1⟩', '√2')}`
            },
            {
                name: 'Inner Product & Orthonormality',
                eq: `⟨0|0⟩ = ⟨1|1⟩ = 1, &nbsp; ⟨0|1⟩ = ⟨+|−⟩ = 0, &nbsp; ⟨+|0⟩ = ⟨+|1⟩ = ⟨−|0⟩ = ${MathFmt.frac('1', '√2')}, &nbsp; ⟨−|1⟩ = −${MathFmt.frac('1', '√2')}`
            },
            {
                name: 'Outer Product Operator Action',
                eq: `(|ψ⟩⟨φ|) |γ⟩ = |ψ⟩ (⟨φ|γ⟩) = ⟨φ|γ⟩ |ψ⟩`
            },
            {
                name: 'Operator Exponential (KLM Ex. 4.2.1 / HW2)',
                eq: `If A² = I, then &nbsp; e<sup>iθA</sup> = cos(θ) I + i sin(θ) A`
            }
        ],
        examples: [
            {
                id: 'ex_1_1_krawec_outer',
                badge: 'EXAM 1 STUDY GUIDE (SEC. 2)',
                title: 'Evaluating Outer-Product Unitary Operator U = |0⟩⟨+| + |1⟩⟨−|',
                problemStatement: 'Suppose U is a unitary operator written in bra-ket notation as U = |0⟩⟨+| + |1⟩⟨−|. Calculate what U evolves |−⟩ and |0⟩ into step-by-step.',
                steps: [
                    {
                        label: 'Part (a): Calculate U|−⟩',
                        math: `U|−⟩ = ( |0⟩⟨+| + |1⟩⟨−| ) |−⟩ = |0⟩⟨+|−⟩ + |1⟩⟨−|−⟩`,
                        note: 'Distribute |−⟩ from the right across both outer-product terms.'
                    },
                    {
                        label: 'Use Orthonormality of {|+⟩, |−⟩}',
                        math: `Since ⟨+|−⟩ = ${MathFmt.frac('1', '2')}(⟨0|+⟨1|)(|0⟩−|1⟩) = ${MathFmt.frac('1', '2')}(1 − 1) = 0 &nbsp; and &nbsp; ⟨−|−⟩ = 1:`,
                        note: 'The Hadamard basis states |+⟩ and |−⟩ are mutually orthogonal unit vectors.'
                    },
                    {
                        label: 'Result for U|−⟩',
                        math: `U|−⟩ = |0⟩(0) + |1⟩(1) = ${MathFmt.boxed('|1⟩')}`,
                        note: 'U maps |−⟩ deterministically to |1⟩!'
                    },
                    {
                        label: 'Part (b): Calculate U|0⟩',
                        math: `U|0⟩ = ( |0⟩⟨+| + |1⟩⟨−| ) |0⟩ = |0⟩⟨+|0⟩ + |1⟩⟨−|0⟩`,
                        note: 'Evaluate the inner products ⟨+|0⟩ and ⟨−|0⟩.'
                    },
                    {
                        label: 'Substitute ⟨+|0⟩ = 1/√2 and ⟨−|0⟩ = 1/√2',
                        math: `⟨+|0⟩ = ${MathFmt.frac('⟨0|0⟩ + ⟨1|0⟩', '√2')} = ${MathFmt.frac('1', '√2')}, &nbsp;&nbsp; ⟨−|0⟩ = ${MathFmt.frac('⟨0|0⟩ − ⟨1|0⟩', '√2')} = ${MathFmt.frac('1', '√2')}`,
                        note: 'Both inner products equal +1/√2.'
                    },
                    {
                        label: 'Result for U|0⟩',
                        math: `U|0⟩ = ${MathFmt.frac('1', '√2')}|0⟩ + ${MathFmt.frac('1', '√2')}|1⟩ = ${MathFmt.boxed('|+⟩')}`,
                        note: 'Notice that U = |0⟩⟨+| + |1⟩⟨−| is in fact the Hadamard gate H itself!'
                    }
                ],
                loadCircuit: {
                    numQubits: 1,
                    initialStates: ['|−⟩'],
                    gates: [{ id: 'ex11_h', type: 'H', qubit: 0, step: 0 }]
                }
            },
            {
                id: 'ex_1_2_klm_inner',
                badge: 'MOSCA TEXTBOOK EX. 2.2.2 & 2.2.5',
                title: 'Inner Product ⟨ψ|φ⟩ in 2-Qubit Hilbert Space',
                problemStatement: 'Given two 2-qubit vectors |ψ⟩ = √(2/3)|01⟩ + (i/√3)|11⟩ and |φ⟩ = (1/√2)|10⟩ + (1/√2)|11⟩, compute their inner product ⟨ψ|φ⟩ step-by-step.',
                steps: [
                    {
                        label: 'Step 1: Form the Dual Bra ⟨ψ| (Conjugate Transpose)',
                        math: `⟨ψ| = (|ψ⟩)<sup>†</sup> = ${MathFmt.frac('√2', '√3')}⟨01| + ( ${MathFmt.frac('i', '√3')} )<sup>*</sup>⟨11| = ${MathFmt.frac('√2', '√3')}⟨01| − ${MathFmt.frac('i', '√3')}⟨11|`,
                        note: 'Remember to complex-conjugate every coefficient when turning a ket |ψ⟩ into a bra ⟨ψ| (so +i becomes −i)!'
                    },
                    {
                        label: 'Step 2: Expand the Product ⟨ψ|φ⟩',
                        math: `⟨ψ|φ⟩ = ${MathFmt.frac('√2', '√3')}·${MathFmt.frac('1', '√2')}⟨01|10⟩ + ${MathFmt.frac('√2', '√3')}·${MathFmt.frac('1', '√2')}⟨01|11⟩ − ${MathFmt.frac('i', '√3')}·${MathFmt.frac('1', '√2')}⟨11|10⟩ − ${MathFmt.frac('i', '√3')}·${MathFmt.frac('1', '√2')}⟨11|11⟩`,
                        note: 'By orthonormality ⟨b_n|b_m⟩ = δ_{n,m}, ⟨01|10⟩ = ⟨01|11⟩ = ⟨11|10⟩ = 0 and ⟨11|11⟩ = 1.'
                    },
                    {
                        label: 'Step 3: Simplify Non-Zero Term',
                        math: `⟨ψ|φ⟩ = 0 + 0 − 0 + ( −${MathFmt.frac('i', '√3')} )( ${MathFmt.frac('1', '√2')} )(1) = ${MathFmt.boxed(`−${MathFmt.frac('i', '√6')}`)}`,
                        note: 'Only the overlapping basis state |11⟩ contributes to the inner product.'
                    }
                ]
            }
        ]
    },
    {
        id: 'ch2_measurements_single',
        number: 'Chapter 3',
        title: 'Single-Qubit Gates, Superposition & Change-of-Basis Measurements',
        sourceTag: 'Kaye-Laflamme-Mosca Ch. 3 • CSE 4412 Exam 1 Sec. 1 • HW3 Q1',
        summary: 'Measuring |ψ⟩ = ∑ α_i |b_i⟩ in an orthonormal basis {|b_i⟩} yields outcome i with Born probability P(i) = |⟨b_i|ψ⟩|² and collapses the state to |b_i⟩. To measure in the Z-basis when given a state in the |+⟩/|−⟩ basis, substitute |±⟩ = (|0⟩ ± |1⟩)/√2 and collect amplitudes!',
        keyFormulas: [
            {
                name: 'Basis Substitution Identity',
                eq: `|+⟩ = ${MathFmt.frac('|0⟩ + |1⟩', '√2')}, &nbsp; |−⟩ = ${MathFmt.frac('|0⟩ − |1⟩', '√2')} &nbsp; ⟺ &nbsp; |0⟩ = ${MathFmt.frac('|+⟩ + |−⟩', '√2')}, &nbsp; |1⟩ = ${MathFmt.frac('|+⟩ − |−⟩', '√2')}`
            },
            {
                name: 'Born Rule & State Collapse Postulate',
                eq: `P(b<sub>i</sub>) = |⟨b<sub>i</sub>|ψ⟩|² = |α<sub>i</sub>|², &nbsp;&nbsp; |ψ<sub>post</sub>⟩ = ${MathFmt.frac('P<sub>i</sub>|ψ⟩', '√⟨ψ|P<sub>i</sub>|ψ⟩')}`
            },
            {
                name: 'Pauli Gates on |0⟩, |1⟩, |+⟩, |−⟩',
                eq: `X|0⟩ = |1⟩, &nbsp; Z|0⟩ = |0⟩, &nbsp; Z|1⟩ = −|1⟩, &nbsp; Z|+⟩ = |−⟩, &nbsp; H|+⟩ = |0⟩, &nbsp; H|−⟩ = |1⟩`
            }
        ],
        examples: [
            {
                id: 'ex_2_1_hw3_q1',
                badge: 'CSE 4412 HW 3 — PART 1, Q1',
                title: 'HW3 Q1: Tracing |0⟩ Through H Followed by Z',
                problemStatement: 'Consider a single qubit initially in state |0⟩. What is the state of this qubit after passing through an H gate followed by a Z gate?',
                steps: [
                    {
                        label: 'Step 1: Initial State |ψ₀⟩',
                        math: `|ψ₀⟩ = |0⟩`,
                        note: 'Qubit starts in the computational ground state |0⟩ (North Pole of Bloch sphere).'
                    },
                    {
                        label: 'Step 2: Apply Hadamard Gate H',
                        math: `|ψ₁⟩ = H|ψ₀⟩ = H|0⟩ = ${MathFmt.frac('1', '√2')}|0⟩ + ${MathFmt.frac('1', '√2')}|1⟩ = |+⟩`,
                        note: 'H maps |0⟩ into the equal superposition |+⟩ on the +X equator.'
                    },
                    {
                        label: 'Step 3: Apply Pauli-Z Gate',
                        math: `|ψ₂⟩ = Z|ψ₁⟩ = Z( ${MathFmt.frac('1', '√2')}|0⟩ + ${MathFmt.frac('1', '√2')}|1⟩ ) = ${MathFmt.frac('1', '√2')}Z|0⟩ + ${MathFmt.frac('1', '√2')}Z|1⟩`,
                        note: 'By linearity, Z acts on each basis ket: Z|0⟩ = |0⟩ and Z|1⟩ = −|1⟩.'
                    },
                    {
                        label: 'Step 4: Final Simplified State',
                        math: `|ψ₂⟩ = ${MathFmt. boxed(`${MathFmt.frac('1', '√2')}|0⟩ − ${MathFmt.frac('1', '√2')}|1⟩ = |−⟩`)}`,
                        note: 'In matrix form: Z H |0⟩ = [[1,0],[0,-1]] · (1/√2)[[1,1],[1,-1]] · [1,0]^T = (1/√2)[1, -1]^T = |−⟩.'
                    }
                ],
                loadCircuit: {
                    numQubits: 1,
                    initialStates: ['|0⟩'],
                    gates: [
                        { id: 'hw3q1_1', type: 'H', qubit: 0, step: 0 },
                        { id: 'hw3q1_2', type: 'Z', qubit: 0, step: 1 }
                    ]
                }
            },
            {
                id: 'ex_2_2_exam1_meas',
                badge: 'EXAM 1 STUDY GUIDE (SEC. 1)',
                title: 'Measuring |ψ⟩ = √(3/4)|+⟩ − (1/2)|−⟩ in the Z Basis & Sequential Measurement',
                problemStatement: 'Given |ψ⟩ = √(3/4)|+⟩ − (1/2)|−⟩, what is the probability of observing |1⟩ if a Z-basis measurement is made? If |1⟩ is observed, what happens if a second measurement is then made in the Hadamard {|+⟩, |−⟩} basis?',
                steps: [
                    {
                        label: 'Step 1: Substitute |+⟩ = (|0⟩+|1⟩)/√2 and |−⟩ = (|0⟩−|1⟩)/√2',
                        math: `|ψ⟩ = ${MathFmt.frac('√3', '2')} [ ${MathFmt.frac('|0⟩ + |1⟩', '√2')} ] − ${MathFmt.frac('1', '2')} [ ${MathFmt.frac('|0⟩ − |1⟩', '√2')} ]`,
                        note: 'Notice √(3/4) = √3 / 2. Check normalization first: (√(3/4))² + (−1/2)² = 3/4 + 1/4 = 1 ✓.'
                    },
                    {
                        label: 'Step 2: Group |0⟩ and |1⟩ Amplitudes',
                        math: `|ψ⟩ = ( ${MathFmt.frac('√3 − 1', '2√2')} ) |0⟩ + ( ${MathFmt.frac('√3 + 1', '2√2')} ) |1⟩`,
                        note: 'Notice that the −|1⟩ inside −(1/2)|−⟩ becomes +(1/2√2)|1⟩!'
                    },
                    {
                        label: 'Step 3: Apply the Born Rule for P(|1⟩)',
                        math: `P(|1⟩) = |⟨1|ψ⟩|² = ( ${MathFmt.frac('√3 + 1', '2√2')} )² = ${MathFmt.frac('(√3)² + 2√3 + 1²', '8')} = ${MathFmt.frac('4 + 2√3', '8')} = ${MathFmt.boxed(`${MathFmt.frac('2 + √3', '4')} ≈ 93.3%`)}`,
                        note: 'And P(|0⟩) = (2 − √3)/4 ≈ 6.7%, so P(|0⟩) + P(|1⟩) = 4/4 = 1.'
                    },
                    {
                        label: 'Step 4: Sequential Measurement (State Collapse!)',
                        math: `If |1⟩ is observed, the state collapses to |ψ'⟩ = |1⟩ = ${MathFmt.frac('1', '√2')}|+⟩ − ${MathFmt.frac('1', '√2')}|−⟩`,
                        note: 'If a second measurement is now made in the Hadamard {|+⟩, |−⟩} basis, P(|+⟩) = |1/√2|² = 1/2 (50%) and P(|−⟩) = |−1/√2|² = 1/2 (50%)!'
                    }
                ],
                loadCircuit: {
                    numQubits: 1,
                    initialStates: ['|0⟩'],
                    gates: [
                        { id: 'ex22_ry', type: 'Ry', qubit: 0, step: 0, theta: (5 * Math.PI) / 6 },
                        { id: 'ex22_m', type: 'M', qubit: 0, step: 1 }
                    ]
                }
            }
        ]
    },
    {
        id: 'ch3_bell_entanglement',
        number: 'Chapter 4',
        title: 'Tensor Products, All 4 Bell States & Entanglement Proofs',
        sourceTag: 'Kaye-Laflamme-Mosca Ch. 3.3 & 4.5 • CSE 4412 Exam 1 Sec. 3 • HW3 Q2 & Q3',
        summary: 'A 2-qubit state |ψ⟩ is separable iff it can be factored as (a|0⟩+b|1⟩)⊗(c|0⟩+d|1⟩) = ac|00⟩ + ad|01⟩ + bc|10⟩ + bd|11⟩ (which requires ac·bd = ad·bc). Otherwise, the qubits are entangled!',
        keyFormulas: [
            {
                name: 'The Four Bell States (EPR Basis)',
                eq: `|Φ⁺⟩ = ${MathFmt.frac('|00⟩ + |11⟩', '√2')}, &nbsp; |Φ⁻⟩ = ${MathFmt.frac('|00⟩ − |11⟩', '√2')}, &nbsp; |Ψ⁺⟩ = ${MathFmt.frac('|01⟩ + |10⟩', '√2')}, &nbsp; |Ψ⁻⟩ = ${MathFmt.frac('|01⟩ − |10⟩', '√2')}`
            },
            {
                name: 'Separability Condition',
                eq: `α<sub>00</sub>|00⟩ + α<sub>01</sub>|01⟩ + α<sub>10</sub>|10⟩ + α<sub>11</sub>|11⟩ is separable &nbsp; ⟺ &nbsp; α<sub>00</sub>α<sub>11</sub> = α<sub>01</sub>α<sub>10</sub>`
            },
            {
                name: 'Tensor Operator Action',
                eq: `(A ⊗ B)(|ψ₁⟩ ⊗ |ψ₂⟩) = (A|ψ₁⟩) ⊗ (B|ψ₂⟩)`
            }
        ],
        examples: [
            {
                id: 'ex_3_1_hw3_q2_bell',
                badge: 'CSE 4412 HW 3 — PART 1, Q2',
                title: 'HW3 Q2: Circuits & Derivations for All Four Bell States |Φ⁺⟩, |Φ⁻⟩, |Ψ⁺⟩, |Ψ⁻⟩',
                problemStatement: 'Starting from |00⟩, show how to construct all four Bell states using H, X, Z, and CNOT gates, and trace each state step-by-step.',
                steps: [
                    {
                        label: '1. Bell State |Φ⁺⟩ = (|00⟩ + |11⟩)/√2',
                        math: `|00⟩ &nbsp; ⟶<sup>H⊗I</sup> &nbsp; ${MathFmt.frac('|0⟩+|1⟩', '√2')}|0⟩ = ${MathFmt.frac('|00⟩+|10⟩', '√2')} &nbsp; ⟶<sup>CNOT</sup> &nbsp; ${MathFmt.boxed(`${MathFmt.frac('|00⟩ + |11⟩', '√2')} = |Φ⁺⟩`)}`,
                        note: 'Circuit: H on q0, then CNOT(q0 → q1).'
                    },
                    {
                        label: '2. Bell State |Φ⁻⟩ = (|00⟩ − |11⟩)/√2',
                        math: `|00⟩ &nbsp; ⟶<sup>X⊗I</sup> &nbsp; |10⟩ &nbsp; ⟶<sup>H⊗I</sup> &nbsp; ${MathFmt.frac('|00⟩ − |10⟩', '√2')} &nbsp; ⟶<sup>CNOT</sup> &nbsp; ${MathFmt.boxed(`${MathFmt.frac('|00⟩ − |11⟩', '√2')} = |Φ⁻⟩`)}`,
                        note: 'Circuit: X on q0, then H on q0, then CNOT(q0 → q1) (or apply Z after H).'
                    },
                    {
                        label: '3. Bell State |Ψ⁺⟩ = (|01⟩ + |10⟩)/√2',
                        math: `|00⟩ &nbsp; ⟶<sup>H⊗X</sup> &nbsp; ${MathFmt.frac('|0⟩+|1⟩', '√2')}|1⟩ = ${MathFmt.frac('|01⟩ + |11⟩', '√2')} &nbsp; ⟶<sup>CNOT</sup> &nbsp; ${MathFmt.boxed(`${MathFmt.frac('|01⟩ + |10⟩', '√2')} = |Ψ⁺⟩`)}`,
                        note: 'Circuit: H on q0 and X on q1, then CNOT(q0 → q1) flips |11⟩ → |10⟩!'
                    },
                    {
                        label: '4. Bell State |Ψ⁻⟩ = (|01⟩ − |10⟩)/√2',
                        math: `|00⟩ &nbsp; ⟶<sup>X⊗X</sup> &nbsp; |11⟩ &nbsp; ⟶<sup>H⊗I</sup> &nbsp; ${MathFmt.frac('|01⟩ − |11⟩', '√2')} &nbsp; ⟶<sup>CNOT</sup> &nbsp; ${MathFmt.boxed(`${MathFmt.frac('|01⟩ − |10⟩', '√2')} = |Ψ⁻⟩`)}`,
                        note: 'Circuit: X on q0 and X on q1, then H on q0, then CNOT(q0 → q1).'
                    }
                ],
                loadCircuit: {
                    numQubits: 2,
                    initialStates: ['|0⟩', '|0⟩'],
                    gates: [
                        { id: 'hw3q2_h', type: 'H', qubit: 0, step: 0 },
                        { id: 'hw3q2_x', type: 'X', qubit: 1, step: 0 },
                        { id: 'hw3q2_cx', type: 'CNOT', qubit: 0, targetQubit: 1, step: 1 }
                    ]
                }
            },
            {
                id: 'ex_3_2_hw3_q3',
                badge: 'CSE 4412 HW 3 — PART 1, Q3',
                title: 'HW3 Q3: Calculate CNOT(H ⊗ H)|+, 0⟩ in the Z Basis',
                problemStatement: 'Evaluate the two-qubit state CNOT(H ⊗ H)|+, 0⟩ step-by-step and express the final answer in the computational (Z) basis {|00⟩, |01⟩, |10⟩, |11⟩}.',
                steps: [
                    {
                        label: 'Step 1: Apply (H ⊗ H) to |+, 0⟩ = |+⟩ ⊗ |0⟩',
                        math: `(H ⊗ H)(|+⟩ ⊗ |0⟩) = (H|+⟩) ⊗ (H|0⟩)`,
                        note: 'Recall H² = I, so H|+⟩ = H(H|0⟩) = |0⟩, and H|0⟩ = |+⟩ = (|0⟩ + |1⟩)/√2.'
                    },
                    {
                        label: 'Step 2: Expand Intermediate State |ψ₁⟩ in the Z Basis',
                        math: `|ψ₁⟩ = |0⟩ ⊗ ( ${MathFmt.frac('|0⟩ + |1⟩', '√2')} ) = ${MathFmt.frac('1', '√2')}|00⟩ + ${MathFmt.frac('1', '√2')}|01⟩`,
                        note: 'Notice that the control qubit (first wire) is in state |0⟩ in both terms!'
                    },
                    {
                        label: 'Step 3: Apply CNOT to |ψ₁⟩',
                        math: `CNOT( ${MathFmt.frac('1', '√2')}|00⟩ + ${MathFmt.frac('1', '√2')}|01⟩ ) = ${MathFmt.frac('1', '√2')}CNOT|00⟩ + ${MathFmt.frac('1', '√2')}CNOT|01⟩`,
                        note: 'Since CNOT|0, t⟩ = |0, t⟩ when the control bit is 0, neither |00⟩ nor |01⟩ is flipped!'
                    },
                    {
                        label: 'Step 4: Final Answer in the Z Basis',
                        math: `CNOT(H ⊗ H)|+, 0⟩ = ${MathFmt.boxed(`${MathFmt.frac('1', '√2')}|00⟩ + ${MathFmt.frac('1', '√2')}|01⟩`)}`,
                        note: 'Click "Load on 3D Stage" to see this exact circuit on the isometric Bloch spheres!'
                    }
                ],
                loadCircuit: {
                    numQubits: 2,
                    initialStates: ['|+⟩', '|0⟩'],
                    gates: [
                        { id: 'hw3q3_h0', type: 'H', qubit: 0, step: 0 },
                        { id: 'hw3q3_h1', type: 'H', qubit: 1, step: 0 },
                        { id: 'hw3q3_cx', type: 'CNOT', qubit: 0, targetQubit: 1, step: 1 }
                    ]
                }
            },
            {
                id: 'ex_3_3_exam1_proofs',
                badge: 'EXAM 1 STUDY GUIDE (SEC. 3)',
                title: 'Exam 1 Proofs: Proving Entangled vs. Separable States',
                problemStatement: '(a) Prove algebraically that (|00⟩ + |11⟩)/√2 is entangled. (b) Prove that (1/2)(|++⟩ + |+−⟩ + |−+⟩ + |−−⟩) is separable.',
                steps: [
                    {
                        label: 'Proof (a): Suppose (|00⟩ + |11⟩)/√2 = (a|0⟩ + b|1⟩) ⊗ (c|0⟩ + d|1⟩)',
                        math: `ac|00⟩ + ad|01⟩ + bc|10⟩ + bd|11⟩ = ${MathFmt.frac('1', '√2')}|00⟩ + 0|01⟩ + 0|10⟩ + ${MathFmt.frac('1', '√2')}|11⟩`,
                        note: 'Matching basis coefficients gives: ac = 1/√2, ad = 0, bc = 0, bd = 1/√2.'
                    },
                    {
                        label: 'Contradiction',
                        math: `From ad = 0, either a = 0 or d = 0. If a = 0, then ac = 0 ≠ ${MathFmt.frac('1', '√2')}. If d = 0, then bd = 0 ≠ ${MathFmt.frac('1', '√2')}.`,
                        note: 'Contradiction! No such a, b, c, d exist, so (|00⟩ + |11⟩)/√2 is ENTANGLED. ∎'
                    },
                    {
                        label: 'Proof (b): Factor (1/2)(|++⟩ + |+−⟩ + |−+⟩ + |−−⟩)',
                        math: `= ${MathFmt.frac('1', '2')} [ |+⟩(|+⟩ + |−⟩) + |−⟩(|+⟩ + |−⟩) ] = ${MathFmt.frac('|+⟩ + |−⟩', '√2')} ⊗ ${MathFmt.frac('|+⟩ + |−⟩', '√2')}`,
                        note: 'Group the first two terms and last two terms by factoring out |+⟩ and |−⟩.'
                    },
                    {
                        label: 'Simplify Using (|+⟩ + |−⟩)/√2 = |0⟩',
                        math: `= |0⟩ ⊗ |0⟩ = ${MathFmt.boxed('|00⟩')} &nbsp; (Separable! ∎)`,
                        note: 'Not only is it separable, it is simply the basis state |00⟩ written in the Hadamard basis!'
                    }
                ]
            }
        ]
    },
    {
        id: 'ch4_teleportation',
        number: 'Chapter 5',
        title: 'Quantum Teleportation Protocol & Superdense Coding',
        sourceTag: 'Kaye-Laflamme-Mosca Ch. 5 • CSE 4412 Exam 1 Sec. 3 • Microsoft Teleportation',
        summary: 'Quantum Teleportation transmits an unknown quantum state |ψ⟩ = α|0⟩ + β|1⟩ from Alice (q0) to Bob (q2) using a pre-shared Bell pair |Φ⁺⟩ on (q1, q2), a Bell-basis measurement on Alice’s two qubits (q0, q1), and 2 classical bits (m₀, m₁) sent to control Bob’s X^(m₁) and Z^(m₀) recovery gates.',
        keyFormulas: [
            {
                name: 'Teleportation Algebraic Identity (KLM Eq. 5.2.3)',
                eq: `|ψ⟩<sub>0</sub> |Φ⁺⟩<sub>12</sub> = ${MathFmt.frac('1', '2')} [ |Φ⁺⟩<sub>01</sub>|ψ⟩<sub>2</sub> + |Φ⁻⟩<sub>01</sub>(Z|ψ⟩)<sub>2</sub> + |Ψ⁺⟩<sub>01</sub>(X|ψ⟩)<sub>2</sub> + |Ψ⁻⟩<sub>01</sub>(XZ|ψ⟩)<sub>2</sub> ]`
            },
            {
                name: 'Bob’s Classical Recovery Rule',
                eq: `Given Alice’s Z-measurement bits (m₀, m₁) ∈ {0,1}², Bob applies &nbsp; Z<sup>m₀</sup> X<sup>m₁</sup> &nbsp; to q₂ to recover |ψ⟩ = α|0⟩ + β|1⟩!`
            }
        ],
        examples: [
            {
                id: 'ex_4_1_teleportation_trace',
                badge: 'MOSCA CH. 5.2 & EXAM 1 STUDY GUIDE',
                title: 'Full Step-by-Step Derivation of Quantum Teleportation (|ψ₀⟩ → |ψ₄⟩)',
                problemStatement: 'Alice has an unknown qubit |ψ⟩ = α|0⟩ + β|1⟩ on wire q0, and shares |Φ⁺⟩ = (|00⟩+|11⟩)/√2 with Bob on wires (q1, q2). Trace the circuit: CNOT(q0→q1), H on q0, Measurement of (q0, q1), and Bob’s conditional X and Z gates.',
                steps: [
                    {
                        label: 'Stage 0: Initial 3-Qubit State |ψ₀⟩ = |ψ⟩₀ ⊗ |Φ⁺⟩₁₂',
                        math: `|ψ₀⟩ = (α|0⟩ + β|1⟩) ⊗ ${MathFmt.frac('|00⟩ + |11⟩', '√2')} = ${MathFmt.frac('1', '√2')} [ α|000⟩ + α|011⟩ + β|100⟩ + β|111⟩ ]`,
                        note: 'Alice holds qubits q0 and q1; Bob holds qubit q2.'
                    },
                    {
                        label: 'Stage 1: Alice Applies CNOT(q0 → q1)',
                        math: `|ψ₁⟩ = ${MathFmt.frac('1', '√2')} [ α|000⟩ + α|011⟩ + β|110⟩ + β|101⟩ ]`,
                        note: 'CNOT flips q1 whenever q0 = 1 (so β|100⟩ → β|110⟩ and β|111⟩ → β|101⟩).'
                    },
                    {
                        label: 'Stage 2: Alice Applies H on q0',
                        math: `|ψ₂⟩ = ${MathFmt.frac('1', '2')} [ α(|0⟩+|1⟩)|00⟩ + α(|0⟩+|1⟩)|11⟩ + β(|0⟩−|1⟩)|10⟩ + β(|0⟩−|1⟩)|01⟩ ]`,
                        note: 'Now regroup terms by Alice’s two qubits |q0 q1⟩ ∈ {|00⟩, |01⟩, |10⟩, |11⟩}:'
                    },
                    {
                        label: 'Stage 3: Regrouped Pre-Measurement State',
                        math: `|ψ₂⟩ = ${MathFmt.frac('1', '2')} |00⟩(α|0⟩ + β|1⟩) + ${MathFmt.frac('1', '2')} |01⟩(α|1⟩ + β|0⟩) + ${MathFmt.frac('1', '2')} |10⟩(α|0⟩ − β|1⟩) + ${MathFmt.frac('1', '2')} |11⟩(α|1⟩ − β|0⟩)`,
                        note: 'Each outcome (m₀, m₁) ∈ {00, 01, 10, 11} occurs with probability (1/2)²(|α|²+|β|²) = 1/4 (25%)!'
                    },
                    {
                        label: 'Stage 4: Alice Measures (m₀, m₁) & Bob Applies Z^(m₀) X^(m₁)',
                        math: `• m₀m₁ = 00: Bob has α|0⟩ + β|1⟩ &nbsp; ⟶<sup>I</sup> &nbsp; |ψ⟩<br>
                               • m₀m₁ = 01: Bob has α|1⟩ + β|0⟩ = X|ψ⟩ &nbsp; ⟶<sup>X</sup> &nbsp; |ψ⟩<br>
                               • m₀m₁ = 10: Bob has α|0⟩ − β|1⟩ = Z|ψ⟩ &nbsp; ⟶<sup>Z</sup> &nbsp; |ψ⟩<br>
                               • m₀m₁ = 11: Bob has α|1⟩ − β|0⟩ = XZ|ψ⟩ &nbsp; ⟶<sup>Z·X</sup> &nbsp; |ψ⟩`,
                        note: 'Exam 1 Key Facts: (1) Does NOT violate No-Cloning because Alice’s measurement collapses q0! (2) Cannot signal faster than light because Alice must send (m₀, m₁) over a classical channel before Bob knows which gate to apply!'
                    }
                ],
                loadCircuit: {
                    numQubits: 3,
                    initialStates: ['|+⟩', '|0⟩', '|0⟩'],
                    gates: [
                        { id: 'tp_h1', type: 'H', qubit: 1, step: 0 },
                        { id: 'tp_cx12', type: 'CNOT', qubit: 1, targetQubit: 2, step: 1 },
                        { id: 'tp_cx01', type: 'CNOT', qubit: 0, targetQubit: 1, step: 2 },
                        { id: 'tp_h0', type: 'H', qubit: 0, step: 3 },
                        { id: 'tp_m0', type: 'M', qubit: 0, step: 4 },
                        { id: 'tp_m1', type: 'M', qubit: 1, step: 4 }
                    ]
                }
            }
        ]
    },
    {
        id: 'ch5_oracles_algorithms',
        number: 'Chapter 6',
        title: 'Quantum Oracles U_f, Phase Kickback & Deutsch-Jozsa / Bernstein-Vazirani',
        sourceTag: 'Kaye-Laflamme-Mosca Ch. 6 • CSE 4412 HW3 Part Two • Class Oracle Diagram',
        summary: 'A reversible quantum oracle U_f maps |x⟩|y⟩ ↦ |x⟩|y ⊕ f(x)⟩. By preparing the bottom ancilla wire in |−⟩ = H|1⟩ = (|0⟩ − |1⟩)/√2, the oracle kicks the function value into the phase: U_f|x⟩|−⟩ = (−1)^f(x)|x⟩|−⟩!',
        keyFormulas: [
            {
                name: 'Oracle Definition & Phase Kickback (KLM Eq. 6.2.15)',
                eq: `U<sub>f</sub>|x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩ &nbsp;&nbsp; ⟹ &nbsp;&nbsp; U<sub>f</sub> |x⟩ ( ${MathFmt.frac('|0⟩ − |1⟩', '√2')} ) = (−1)<sup>f(x)</sup> |x⟩ ( ${MathFmt.frac('|0⟩ − |1⟩', '√2')} )`
            },
            {
                name: 'n-Qubit Hadamard Transform (KLM Eq. 6.4.16)',
                eq: `H<sup>⊗n</sup>|x⟩ = ${MathFmt.frac('1', '√2ⁿ')} ∑<sub>z∈{0,1}ⁿ</sub> (−1)<sup>x·z</sup> |z⟩, &nbsp;&nbsp; where x·z = x₁z₁ ⊕ x₂z₂ ⊕ ··· ⊕ x<sub>n</sub>z<sub>n</sub>`
            },
            {
                name: 'Bernstein-Vazirani Identity (HW3 Part Two)',
                eq: `H<sup>⊗n</sup> ( ${MathFmt.frac('1', '√2ⁿ')} ∑<sub>x∈{0,1}ⁿ</sub> (−1)<sup>x·s</sup> |x⟩ ) = |s⟩`
            }
        ],
        examples: [
            {
                id: 'ex_5_1_kickback_proof',
                badge: 'MOSCA CH. 6.2 & HW3 PART TWO',
                title: 'Derivation of Phase Kickback: Why U_f|x⟩|−⟩ = (−1)^f(x)|x⟩|−⟩',
                problemStatement: 'Prove algebraically that for any Boolean function f : {0,1}ⁿ → {0,1}, applying U_f : |x⟩|y⟩ ↦ |x⟩|y ⊕ f(x)⟩ when the bottom wire is in state |−⟩ = (|0⟩ − |1⟩)/√2 produces (−1)^f(x)|x⟩|−⟩.',
                steps: [
                    {
                        label: 'Step 1: Expand |−⟩ and Apply Linearity of U_f',
                        math: `U<sub>f</sub> [ |x⟩ ( ${MathFmt.frac('|0⟩ − |1⟩', '√2')} ) ] = ${MathFmt.frac('1', '√2')} ( U<sub>f</sub>|x⟩|0⟩ − U<sub>f</sub>|x⟩|1⟩ ) = |x⟩ ( ${MathFmt.frac('|0 ⊕ f(x)⟩ − |1 ⊕ f(x)⟩', '√2')} )`,
                        note: 'Apply U_f|x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩ to both |0⟩ and |1⟩.'
                    },
                    {
                        label: 'Step 2: Check the Two Cases f(x) = 0 and f(x) = 1',
                        math: `• Case f(x) = 0: &nbsp; ${MathFmt.frac('|0⊕0⟩ − |1⊕0⟩', '√2')} = ${MathFmt.frac('|0⟩ − |1⟩', '√2')} = (+1)|−⟩ = (−1)<sup>0</sup>|−⟩<br>
                               • Case f(x) = 1: &nbsp; ${MathFmt.frac('|0⊕1⟩ − |1⊕1⟩', '√2')} = ${MathFmt.frac('|1⟩ − |0⟩', '√2')} = (−1)|−⟩ = (−1)<sup>1</sup>|−⟩`,
                        note: 'When f(x) = 1, |0⟩ and |1⟩ swap places, factoring out a −1 sign!'
                    },
                    {
                        label: 'Step 3: Combine Both Cases into (−1)^f(x)',
                        math: `U<sub>f</sub> |x⟩ |−⟩ = ${MathFmt.boxed(`(−1)<sup>f(x)</sup> |x⟩ ( ${MathFmt.frac('|0⟩ − |1⟩', '√2')} )`)}`,
                        note: 'The bottom wire remains unchanged in |−⟩ while the eigenvalue (−1)^f(x) is kicked back to the top register |x⟩!'
                    }
                ],
                openOraclePreset: 'bv_s01'
            },
            {
                id: 'ex_5_2_hw3_part2',
                badge: 'CSE 4412 HW 3 — PART TWO (a) & (b)',
                title: 'HW3 Part Two: Complete Hand Calculation for s = 01 (n=2) and s = 101 (n=3)',
                problemStatement: 'Trace the circuit |0⟩^⊗n |1⟩ → H^⊗(n+1) → U_f → (H^⊗n ⊗ I) at slices |ψ₀⟩, |ψ₁⟩, |ψ₂⟩, |ψ₃⟩ for f(x) = x · s (mod 2) with (a) s = 01 and (b) s = 101.',
                steps: [
                    {
                        label: 'Part (a) s = 01 (n = 2): Slices |ψ₀⟩ and |ψ₁⟩',
                        math: `|ψ₀⟩ = |00⟩|1⟩ &nbsp; ⟶<sup>H⊗3</sup> &nbsp; |ψ₁⟩ = ${MathFmt.frac('1', '2')}(|00⟩ + |01⟩ + |10⟩ + |11⟩) ⊗ |−⟩`,
                        note: 'Since s = 01, f(x₁x₂) = x₁·0 ⊕ x₂·1 = x₂. So f(00)=0, f(01)=1, f(10)=0, f(11)=1.'
                    },
                    {
                        label: 'Part (a) s = 01: Slices |ψ₂⟩ (After U_f) and |ψ₃⟩ (After H^⊗2)',
                        math: `|ψ₂⟩ = ${MathFmt.frac('1', '2')}(|00⟩ − |01⟩ + |10⟩ − |11⟩)|−⟩ = |+⟩|−⟩|−⟩ &nbsp; ⟶<sup>H⊗2⊗I</sup> &nbsp; |ψ₃⟩ = ${MathFmt.boxed('|01⟩|−⟩')}`,
                        note: 'Since H|+⟩ = |0⟩ and H|−⟩ = |1⟩, the final state on the top 2 wires is |01⟩ = |s⟩!'
                    },
                    {
                        label: 'Part (b) s = 101 (n = 3): Slices |ψ₀⟩ and |ψ₁⟩',
                        math: `|ψ₀⟩ = |000⟩|1⟩ &nbsp; ⟶<sup>H⊗4</sup> &nbsp; |ψ₁⟩ = ${MathFmt.frac('1', '2√2')} ∑<sub>x∈{0,1}³</sub> |x⟩ ⊗ |−⟩`,
                        note: 'Since s = 101, f(x₁x₂x₃) = x₁ ⊕ x₃. Thus f(x) = 1 for x ∈ {001, 011, 100, 110}.'
                    },
                    {
                        label: 'Part (b) s = 101: Slices |ψ₂⟩ (After U_f) and |ψ₃⟩ (After H^⊗3)',
                        math: `|ψ₂⟩ = ${MathFmt.frac('1', '2√2')}(|000⟩ − |001⟩ + |010⟩ − |011⟩ − |100⟩ + |101⟩ − |110⟩ + |111⟩)|−⟩ = |−⟩|+⟩|−⟩|−⟩ &nbsp; ⟶<sup>H⊗3⊗I</sup> &nbsp; |ψ₃⟩ = ${MathFmt.boxed('|101⟩|−⟩')}`,
                        note: 'Click "Open in Class Oracle Diagram" below to explore both s = 01 and s = 101 interactively!'
                    }
                ],
                openOraclePreset: 'bv_s101'
            }
        ]
    }
];

window.MathFmt = MathFmt;
window.QuantumMathDerivationEngine = QuantumMathDerivationEngine;
window.ORACLE_ALGORITHM_PRESETS = ORACLE_ALGORITHM_PRESETS;
window.COURSE_CHAPTERS = COURSE_CHAPTERS;
