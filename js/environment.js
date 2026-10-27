/**
 * environment.js
 * Implements the Dual-Cubemap 360° Laboratory Skybox + Prefiltered HDR IBL Pipeline
 * documented in LAB_BACKGROUND_ENVIRONMENT_GUIDE.md (modeled after apps.fz-juelich.de/qcmodel).
 *
 * Key architectural features:
 * 1. 100% Image-Based Lighting (zero artificial directional/point lights in the scene).
 * 2. Split Skybox vs. Specular IBL Textures:
 *    - Sharp 6x 1024x1024 Cubemap applied to a 150x150x150 Skybox mesh (and scene.background)
 *      with unlit rendering (disableLighting = true, microSurface = 0.99).
 *    - True High-Dynamic-Range Radiance .hdr (RGBE) environment map convolved via
 *      THREE.PMREMGenerator into GGX specular mipmaps + diffuse spherical harmonics
 *      and bound to scene.environment (environmentIntensity = 1.2).
 * 3. Optional Ground-Projected 360° Dome (Step 3 of LAB_BACKGROUND_ENVIRONMENT_GUIDE.md)
 *    that projects the lower hemisphere onto a flat horizontal floor plane at y = 0.
 * 4. Camera radius (1.0m - 10.0m) and panning distance (<= 5.0m) clamping to preserve
 *    perspective inside the 360° laboratory room.
 */

class QuantumLabSkyboxEnvironment {
    constructor(renderer, scene, camera, controls) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;

        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileCubemapShader();
        this.pmremGenerator.compileEquirectangularShader();

        this.cubeLoader = new THREE.CubeTextureLoader();
        this.texLoader = new THREE.TextureLoader();

        this.cache = {};
        this.currentEnvKey = null;
        this.projectionMode = 'ground'; // Default to calibrated Ground-Anchored 3D Room so zooming & rotating lock 1:1

        this.environments = {
            ibm_cleanroom: {
                title: 'IBM / BLUEFORS QUANTUM CLEANROOM LAB',
                subtitle: 'PERFORATED ACOUSTIC WALLS, CONTROL ROOM OBSERVATION GLASS & RF RACKS // 360° IBL SKYBOX',
                cubePath: 'assets/environment/ibm_cleanroom_cubemap/',
                equirectPath: 'assets/environment/ibm_cleanroom_skybox_equirect.jpg',
                hdrPath: 'assets/environment/ibm_cleanroom_specular.hdr',
                exposure: 1.02,
                groundRadius: 6.2,
                groundHeight: 1.35,
                ceilingHeight: 3.42,
                envStyle: 0.0,
                floorColor: new THREE.Color(0xcbd2da)
            },
            google_lab: {
                title: 'GOOGLE QUANTUM AI LAB — SANTA BARBARA',
                subtitle: '1,000-QUBIT DILUTION REFRIGERATOR, 8-POD COAX LOOMS, WILLOW QPU & T-SLOT GANTRY',
                cubePath: 'assets/environment/google_lab_cubemap/',
                equirectPath: 'assets/environment/google_lab_skybox_equirect.jpg',
                hdrPath: 'assets/environment/google_lab_specular.hdr',
                exposure: 1.0,
                groundRadius: 6.2,
                groundHeight: 1.35,
                ceilingHeight: 3.22,
                envStyle: 1.0,
                floorColor: new THREE.Color(0xd0d4d9)
            },
            ibm_dark: {
                title: 'IBM QUANTUM SYSTEM DARK GLASS & CYAN LAB',
                subtitle: 'ANODIZED ALUMINUM & GLASS ARCHITECTURE, CYAN AWG RACKS & CENTRAL STAGING PAD',
                cubePath: 'assets/environment/ibm_dark_cubemap/',
                equirectPath: 'assets/environment/ibm_dark_skybox_equirect.jpg',
                hdrPath: 'assets/environment/ibm_dark_specular.hdr',
                exposure: 1.08,
                groundRadius: 6.0,
                groundHeight: 1.35,
                ceilingHeight: 3.82,
                envStyle: 2.0,
                floorColor: new THREE.Color(0x262f3d)
            }
        };

        this.initSkyboxMeshes();
        this.enforceCameraConstraints();
    }

    /**
     * Builds:
     * 1. The Calibrated Ground-Anchored 3D Laboratory Room Dome (default):
     *    - Intersects downward rays with the physical floor plane y = 0 so the feet of the 3D frame
     *      stay 100% locked to the floor when zooming in/out and orbiting 360°.
     *    - Intersects upward rays above the wall cornice (y = uCeilingHeight) with a flat horizontal
     *      3D ceiling plane and renders a 100% straight, rectilinear orthogonal architectural ceiling
     *      in world space (x, z) so ceiling tiles, LED panels, and utility trays have crisp 90° angles
     *      with zero bending and zero distortion to any wall.
     * 2. The 150x150x150 unlit Skybox Cube (optional pure infinite cubemap view).
     */
    initSkyboxMeshes() {
        // 1. 150x150x150 Unlit Skybox Cube
        const skyboxGeo = new THREE.BoxGeometry(150, 150, 150);
        this.skyboxCubeMaterial = new THREE.ShaderMaterial({
            name: 'JuelichSkyboxCubeShader',
            uniforms: {
                tCube: { value: null },
                uIntensity: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vWorldDirection;
                void main() {
                    vWorldDirection = position;
                    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_Position = clipPos.xyww;
                }
            `,
            fragmentShader: `
                uniform samplerCube tCube;
                uniform float uIntensity;
                varying vec3 vWorldDirection;
                void main() {
                    vec3 dir = normalize(vWorldDirection);
                    vec4 texel = textureCube(tCube, vec3(-dir.x, dir.y, dir.z));
                    gl_FragColor = vec4(texel.rgb * uIntensity, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: true
        });

        this.skyboxCubeMesh = new THREE.Mesh(skyboxGeo, this.skyboxCubeMaterial);
        this.skyboxCubeMesh.name = 'skyBox';
        this.skyboxCubeMesh.visible = false;
        this.skyboxCubeMesh.frustumCulled = false;
        this.skyboxCubeMesh.renderOrder = -1000;
        this.scene.add(this.skyboxCubeMesh);

        // 2. Calibrated Ground-Anchored 3D Room (world-space room with flat y=0 floor & flat y=uCeilingHeight ceiling)
        const domeGeo = new THREE.SphereGeometry(1.0, 128, 64);
        this.groundSkyboxMaterial = new THREE.ShaderMaterial({
            name: 'CalibratedGroundAnchoredSkyboxShader',
            uniforms: {
                tEquirect: { value: null },
                uHeight: { value: 1.35 },
                uRadius: { value: 6.2 },
                uCeilingHeight: { value: 3.22 },
                uEnvStyle: { value: 1.0 },
                uFloorColor: { value: new THREE.Color(0xd0d4d9) }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                uniform float uRadius;
                uniform float uHeight;
                void main() {
                    vec3 worldCenter = vec3(0.0, uHeight, 0.0);
                    vec3 scaledPos = worldCenter + position * uRadius;
                    vWorldPosition = (modelMatrix * vec4(scaledPos, 1.0)).xyz;
                    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tEquirect;
                uniform float uHeight;
                uniform float uRadius;
                uniform float uCeilingHeight;
                uniform float uEnvStyle;
                uniform vec3 uFloorColor;
                varying vec3 vWorldPosition;

                const float PI = 3.141592653589793;

                vec2 directionToEquirectUV(vec3 dir) {
                    vec3 d = normalize(dir);
                    float phi = atan(d.z, d.x);
                    float theta = acos(clamp(d.y, -1.0, 1.0));
                    float u = fract(phi / (2.0 * PI) + 0.5);
                    float v = 1.0 - (theta / PI);
                    return vec2(u, v);
                }

                // Renders a 100% rectilinear, perspective-true 3D architectural cleanroom ceiling
                // on the flat horizontal plane y = uCeilingHeight using world-space coordinates p = (x, z).
                // Every tile edge, T-bar beam, recessed rectangular LED panel, and overhead utility tray
                // is aligned strictly with the orthogonal X and Z axes (90-degree right angles, zero bending).
                vec3 computeRectilinearCeiling(vec2 p, float dist, float rimR, float style) {
                    float fw = clamp(dist * 0.0022, 0.002, 0.022);
                    float r = length(p);

                    // 1. Environment-matched architectural ceiling palette
                    vec3 tileBaseCol = vec3(0.79, 0.82, 0.86);
                    vec3 tileBevelCol = vec3(0.67, 0.71, 0.76);
                    vec3 tBarCol = vec3(0.60, 0.65, 0.71);
                    vec3 lightCoreCol = vec3(1.00, 0.97, 0.90);
                    vec3 trayRailCol = vec3(0.55, 0.60, 0.66);
                    vec3 conduitColA = vec3(0.14, 0.38, 0.68); // Royal blue utility conduit
                    vec3 conduitColB = vec3(0.88, 0.68, 0.14); // Amber/yellow utility conduit

                    if (style > 0.5 && style < 1.5) {
                        // Google Quantum AI Santa Barbara Lab: crisp bright architectural white & industrial steel
                        tileBaseCol = vec3(0.84, 0.86, 0.89);
                        tileBevelCol = vec3(0.72, 0.75, 0.79);
                        tBarCol = vec3(0.62, 0.66, 0.71);
                        lightCoreCol = vec3(0.97, 0.99, 1.00);
                        trayRailCol = vec3(0.64, 0.68, 0.73);
                        conduitColA = vec3(0.16, 0.44, 0.82);
                        conduitColB = vec3(0.92, 0.72, 0.12);
                    } else if (style >= 1.5) {
                        // IBM Dark Glass & Cyan Lab: dark anodized slate acoustic ceiling with cyan/white linear luminaires
                        tileBaseCol = vec3(0.17, 0.22, 0.29);
                        tileBevelCol = vec3(0.11, 0.15, 0.21);
                        tBarCol = vec3(0.25, 0.32, 0.40);
                        lightCoreCol = vec3(0.88, 0.97, 1.00);
                        trayRailCol = vec3(0.28, 0.36, 0.45);
                        conduitColA = vec3(0.08, 0.58, 0.86);
                        conduitColB = vec3(0.32, 0.42, 0.52);
                    }

                    // 2. Orthogonal 0.60m x 0.60m Acoustic Ceiling Tiles & 1.20m Main Extruded Aluminum T-Beams
                    vec2 gMinor = abs(fract(p / 0.60 + 0.5) - 0.5) * 0.60;
                    float dMinor = min(gMinor.x, gMinor.y);

                    vec2 gMajor = abs(fract(p / 1.20 + 0.5) - 0.5) * 1.20;
                    float dMajor = min(gMajor.x, gMajor.y);

                    // Subtle micro-perforation & acoustic tile shading
                    vec2 tileCenter = (fract(p / 0.60) - 0.5);
                    float tileVig = 1.0 - 0.08 * dot(tileCenter, tileCenter);
                    vec3 col = tileBaseCol * tileVig;

                    // Tile recessed step bevel next to the T-bar grid
                    float bevelMask = 1.0 - smoothstep(0.013 - fw, 0.024 + fw, dMinor);
                    col = mix(col, tileBevelCol, bevelMask * 0.75);

                    // Secondary 0.60m cross-T aluminum rails (width = 0.022m)
                    float minorBarMask = 1.0 - smoothstep(0.011 - fw, 0.011 + fw, dMinor);
                    col = mix(col, tBarCol, minorBarMask);

                    // Primary 1.20m structural T-beams (width = 0.038m) with center highlight ridge
                    float majorBarMask = 1.0 - smoothstep(0.019 - fw, 0.019 + fw, dMajor);
                    float majorRidge = 1.0 - smoothstep(0.004 - fw, 0.004 + fw, dMajor);
                    col = mix(col, tBarCol * 0.92, majorBarMask);
                    col = mix(col, tBarCol * 1.16, majorRidge * 0.6);

                    // 3. Straight Rectangular Recessed Cleanroom LED Light Troffers (or Linear LED Bars in Dark Lab)
                    vec2 cellIdx = floor((p + 0.60) / 1.20);
                    vec2 cellLocal = (fract((p + 0.60) / 1.20) - 0.5) * 1.20;

                    if (style < 1.5) {
                        // Rectangular 0.96m x 0.44m cleanroom LED troffers arranged in straight orthogonal rows
                        bool isLightRowX = (abs( abs(cellIdx.x) - 2.0 ) < 0.25) || (abs(cellIdx.x) < 0.25 && abs( abs(cellIdx.y) - 2.0 ) < 0.25);
                        bool isLightRowZ = (abs(cellIdx.y) <= 3.25) && (abs(cellIdx.y) >= 0.75);
                        if (isLightRowX && isLightRowZ && r < rimR - 0.45) {
                            vec2 halfSize = vec2(0.46, 0.21);
                            vec2 boxD = abs(cellLocal) - halfSize;
                            float sdfBox = max(boxD.x, boxD.y);

                            // Outer anodized aluminum luminaire bezel (0.032m wide, 90-degree corners)
                            float frameMask = (1.0 - smoothstep(0.032 - fw, 0.032 + fw, sdfBox)) * smoothstep(-0.004 - fw, -0.004 + fw, sdfBox);
                            // Inner glowing micro-prismatic diffuser panel
                            float lensMask = 1.0 - smoothstep(-0.004 - fw, -0.004 + fw, sdfBox);

                            // Subtle straight prismatic louver ribs along X inside the luminaire
                            float louver = 0.97 + 0.03 * cos(cellLocal.x * 80.0);
                            float edgeSoft = 1.0 - 0.12 * smoothstep(-0.08, 0.0, sdfBox);
                            vec3 luminaireCol = lightCoreCol * louver * edgeSoft;

                            col = mix(col, tBarCol * 0.82, frameMask);
                            col = mix(col, luminaireCol, lensMask);
                        }
                    } else {
                        // IBM Dark Lab: Razor-straight orthogonal linear LED light strips at |x| = 1.80m and |z| = 1.80m, 3.60m
                        float dStripX = abs(abs(p.x) - 1.80);
                        float dStripZ = min(abs(abs(p.y) - 1.80), abs(abs(p.y) - 3.60));
                        float dStrip = min(
                            (abs(p.y) < 4.20) ? dStripX : 10.0,
                            (abs(p.x) < 4.20) ? dStripZ : 10.0
                        );
                        float stripHousing = 1.0 - smoothstep(0.052 - fw, 0.052 + fw, dStrip);
                        float stripCore = 1.0 - smoothstep(0.028 - fw, 0.028 + fw, dStrip);
                        col = mix(col, vec3(0.08, 0.14, 0.20), stripHousing);
                        col = mix(col, lightCoreCol, stripCore);
                    }

                    // 4. Straight Orthogonal Overhead Utility & Cable Trays (90-degree grid at |x| = 1.32m and |z| = 1.32m)
                    float trayCoordX = abs(p.x) - 1.32;
                    float trayCoordZ = abs(p.y) - 1.32;
                    float dTrayX = abs(trayCoordX); // Runs straight parallel to Z axis
                    float dTrayZ = abs(trayCoordZ); // Runs straight parallel to X axis
                    float trayHalfW = 0.135;

                    bool onTrayX = (dTrayX < trayHalfW + 0.02) && (abs(p.y) < rimR - 0.25);
                    bool onTrayZ = (dTrayZ < trayHalfW + 0.02) && (abs(p.x) < rimR - 0.25);

                    if (onTrayX || onTrayZ) {
                        // Use whichever straight orthogonal tray is closer
                        float s = (dTrayX < dTrayZ) ? trayCoordX : trayCoordZ; // Cross-tray coordinate in [-0.15, +0.15]
                        float along = (dTrayX < dTrayZ) ? p.y : p.x;          // Coordinate along the straight tray
                        float absS = abs(s);

                        float inTray = 1.0 - smoothstep(trayHalfW - fw, trayHalfW + fw, absS);
                        // Recessed dark shadow backing inside the open cable tray
                        col = mix(col, tileBevelCol * 0.48, inTray * 0.85);

                        // Straight perpendicular ladder cross-rungs every 0.24m
                        float dRung = abs(fract(along / 0.24 + 0.5) - 0.5) * 0.24;
                        float rungMask = (1.0 - smoothstep(0.010 - fw, 0.010 + fw, dRung)) * inTray;
                        col = mix(col, trayRailCol * 0.90, rungMask);

                        // 3 Straight parallel cylindrical utility conduits inside the tray (s = -0.075, 0.0, +0.075)
                        float dCondA = abs(s + 0.072);
                        float dCondMid = abs(s);
                        float dCondB = abs(s - 0.072);
                        float rCond = 0.024;

                        if (dCondA < rCond + fw) {
                            float m = (1.0 - smoothstep(rCond - fw, rCond + fw, dCondA)) * inTray;
                            float cylShade = 0.72 + 0.35 * sqrt(max(0.0, 1.0 - (dCondA / rCond) * (dCondA / rCond)));
                            col = mix(col, conduitColA * cylShade, m);
                        }
                        if (dCondMid < rCond + fw) {
                            float m = (1.0 - smoothstep(rCond - fw, rCond + fw, dCondMid)) * inTray;
                            float cylShade = 0.75 + 0.35 * sqrt(max(0.0, 1.0 - (dCondMid / rCond) * (dCondMid / rCond)));
                            col = mix(col, trayRailCol * 1.18 * cylShade, m);
                        }
                        if (dCondB < rCond + fw) {
                            float m = (1.0 - smoothstep(rCond - fw, rCond + fw, dCondB)) * inTray;
                            float cylShade = 0.72 + 0.35 * sqrt(max(0.0, 1.0 - (dCondB / rCond) * (dCondB / rCond)));
                            col = mix(col, conduitColB * cylShade, m);
                        }

                        // Straight brushed-aluminum C-channel outer side rails along absS == trayHalfW
                        float railMask = (1.0 - smoothstep(0.014 - fw, 0.014 + fw, abs(absS - trayHalfW)));
                        col = mix(col, trayRailCol * 1.12, railMask);
                    }

                    // 5. Central Square Structural Hoist Frame directly above the Cryostat Gantry (|x| <= 0.92m, |z| <= 0.92m)
                    float centerBox = max(abs(p.x), abs(p.y));
                    float hoistFrame = 1.0 - smoothstep(0.026 - fw, 0.026 + fw, abs(centerBox - 0.90));
                    col = mix(col, trayRailCol * 0.95, hoistFrame);

                    // 6. Radial room lighting falloff & architectural perimeter cornice shadow at r -> rimR
                    float radialVignette = 1.0 - 0.14 * smoothstep(1.2, rimR, r);
                    float perimeterRim = 1.0 - smoothstep(0.08, 0.0, abs(r - rimR));
                    float cornerAO = 1.0 - 0.28 * exp(-(rimR - r) * (rimR - r) / 0.06);
                    col *= radialVignette * cornerAO;
                    col = mix(tBarCol * 0.78, col, perimeterRim);

                    return col;
                }

                void main() {
                    vec3 tripodOrigin = vec3(0.0, uHeight, 0.0);
                    vec3 camPos = cameraPosition;
                    vec3 rayDir = normalize(vWorldPosition - camPos);

                    // 1. Intersect viewing ray with the 3D Room Sphere of radius uRadius centered at tripodOrigin
                    vec3 oc = camPos - tripodOrigin;
                    float b = dot(oc, rayDir);
                    float c = dot(oc, oc) - uRadius * uRadius;
                    float disc = max(0.0, b * b - c);
                    float tSphere = -b + sqrt(disc);
                    vec3 hitPos = camPos + rayDir * tSphere;
                    float sphereY = hitPos.y;

                    // 2. Intersect downward viewing ray with the physical laboratory floor plane at y = 0.0
                    //    At hitPos.y == 0.0, tFloor == tSphere so the wall-to-floor boundary is 100% continuous.
                    if (sphereY < 0.0 && rayDir.y < -0.0001) {
                        float tFloor = -camPos.y / rayDir.y;
                        if (tFloor > 0.0) {
                            hitPos = camPos + rayDir * tFloor;
                        }
                    }

                    // 3. Compute panorama lookup vector from tripodOrigin for the 4 vertical walls and floor
                    //    (100% 1:1 unwarped above the horizon so zero wall pixels are ever stretched or distorted!)
                    vec3 rel = hitPos - tripodOrigin;
                    if (rel.y < 0.0) {
                        rel.y *= 1.85;
                    }
                    vec3 sampleDir = normalize(rel);
                    vec2 uv = directionToEquirectUV(sampleDir);
                    vec3 panoColor = texture2D(tEquirect, uv).rgb;

                    // 4. On the physical y = 0 floor plane, blend smoothly into the laboratory ESD floor
                    //    and apply subtle 3D world-space contact shadows under the gantry & side cabinets.
                    if (sphereY <= 0.002) {
                        float floorR = length(hitPos.xz);
                        float padBlend = 1.0 - smoothstep(1.20, 4.80, floorR);
                        panoColor = mix(panoColor, uFloorColor, padBlend * 0.42);

                        vec2 absXZ = abs(hitPos.xz);
                        float footDist = min(
                            length(absXZ - vec2(0.86, 0.86)),
                            length(absXZ - vec2(1.76, 0.52))
                        );
                        float footAO = 1.0 - 0.22 * exp(-footDist * footDist / 0.035);

                        vec2 rackDelta = max(abs(vec2(absXZ.x - 1.42, hitPos.z)) - vec2(0.32, 0.44), 0.0);
                        float rackDist = length(rackDelta);
                        float rackAO = 1.0 - 0.26 * exp(-rackDist * rackDist / 0.045);

                        float centerAO = 1.0 - 0.10 * exp(-floorR * floorR / 0.85);
                        panoColor *= (footAO * rackAO * centerAO);
                    }

                    // 5. Intersect upward viewing rays above the wall cornice (sphereY >= uCeilingHeight)
                    //    with a flat horizontal 3D ceiling plane at y = uCeilingHeight.
                    //    At sphereY == uCeilingHeight, tCeil == tSphere so the wall-to-ceiling join is 100% continuous!
                    float dyCeil = uCeilingHeight - uHeight;
                    float ceilRimRadius = sqrt(max(0.1, uRadius * uRadius - dyCeil * dyCeil));

                    // Subtle horizontal perimeter cornice molding along the top 7cm of the vertical wall
                    if (sphereY > uCeilingHeight - 0.075 && sphereY <= uCeilingHeight) {
                        float corniceT = smoothstep(uCeilingHeight - 0.075, uCeilingHeight - 0.015, sphereY);
                        vec3 corniceCol = (uEnvStyle >= 1.5) ? vec3(0.14, 0.19, 0.25) : vec3(0.56, 0.61, 0.67);
                        panoColor = mix(panoColor, corniceCol, corniceT * 0.90);
                    }

                    if (sphereY > uCeilingHeight && rayDir.y > 0.0001) {
                        float tCeil = (uCeilingHeight - camPos.y) / rayDir.y;
                        if (tCeil > 0.0) {
                            vec3 ceilPos = camPos + rayDir * tCeil;
                            panoColor = computeRectilinearCeiling(ceilPos.xz, tCeil, ceilRimRadius, uEnvStyle);
                        }
                    }

                    gl_FragColor = vec4(panoColor, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: true
        });

        this.groundSkyboxMesh = new THREE.Mesh(domeGeo, this.groundSkyboxMaterial);
        this.groundSkyboxMesh.name = 'groundProjectedSkyBox';
        this.groundSkyboxMesh.visible = true;
        this.groundSkyboxMesh.frustumCulled = false;
        this.groundSkyboxMesh.renderOrder = -999;
        this.scene.add(this.groundSkyboxMesh);
    }

    /**
     * Enforces camera constraints that keep the camera inside the 3D anchored room
     * and above the y = 0 floor plane so zooming in/out and rotating 360° are 100% locked.
     */
    enforceCameraConstraints() {
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.055;
        this.controls.rotateSpeed = 0.65;
        this.controls.zoomSpeed = 0.85;
        this.controls.panSpeed = 0.45;

        // Radius limits inside the 6.2m 3D room
        this.controls.minDistance = 0.28;
        this.controls.maxDistance = 5.35;

        // Keep camera above the y = 0 floor plane so tFloor = -camPos.y / rayDir.y is always valid
        this.controls.minPolarAngle = 0.12;
        this.controls.maxPolarAngle = Math.PI * 0.488;

        this.controls.addEventListener('change', () => {
            const t = this.controls.target;
            const horizDist = Math.hypot(t.x, t.z);
            let clampedX = t.x;
            let clampedZ = t.z;
            if (horizDist > 1.85) {
                const scale = 1.85 / horizDist;
                clampedX *= scale;
                clampedZ *= scale;
            }
            const clampedY = Math.max(0.42, Math.min(2.65, t.y));

            if (clampedX !== t.x || clampedY !== t.y || clampedZ !== t.z) {
                const dx = clampedX - t.x;
                const dy = clampedY - t.y;
                const dz = clampedZ - t.z;
                t.set(clampedX, clampedY, clampedZ);
                this.camera.position.x += dx;
                this.camera.position.y += dy;
                this.camera.position.z += dz;
            }

            // Guarantee camera stays strictly between the y = 0 floor and y = uCeilingHeight ceiling plane
            if (this.camera.position.y < 0.12) {
                this.camera.position.y = 0.12;
            }
            const maxCeilY = (this.groundSkyboxMaterial ? this.groundSkyboxMaterial.uniforms.uCeilingHeight.value : 2.70) - 0.12;
            if (this.camera.position.y > maxCeilY) {
                this.camera.position.y = maxCeilY;
            }

            if (this.skyboxCubeMesh) {
                this.skyboxCubeMesh.position.copy(this.camera.position);
            }
        });
    }

    /**
     * Self-contained parser for uncompressed 32-bit_rle_rgbe Radiance .hdr files.
     * Decodes RGBE pixels into a linear float/RGBE DataTexture for PMREMGenerator.
     */
    loadRadianceHDR(url, onComplete) {
        fetch(url)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const bytes = new Uint8Array(buffer);
                let pos = 0;

                // Read ASCII header up to "-Y <H> +X <W>\n"
                let headerStr = '';
                while (pos < bytes.length) {
                    const ch = String.fromCharCode(bytes[pos++]);
                    headerStr += ch;
                    if (headerStr.endsWith('\n') && headerStr.includes('-Y ') && headerStr.includes('+X ')) {
                        break;
                    }
                }

                const match = headerStr.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/);
                if (!match) {
                    console.warn('Invalid HDR header:', url);
                    return;
                }
                const height = parseInt(match[1], 10);
                const width = parseInt(match[2], 10);

                // Convert RGBE (4 bytes per pixel) to tone-mapped sRGB / linear RGBA8 for PMREMGenerator
                // Flip vertically so row 0 is at the bottom as expected by Three.js DataTexture
                const rgba = new Uint8Array(width * height * 4);
                for (let y = 0; y < height; y++) {
                    const dstY = height - 1 - y;
                    for (let x = 0; x < width; x++) {
                        const srcIdx = pos + (y * width + x) * 4;
                        const dstIdx = (dstY * width + x) * 4;

                        const r = bytes[srcIdx];
                        const g = bytes[srcIdx + 1];
                        const b = bytes[srcIdx + 2];
                        const e = bytes[srcIdx + 3];

                        if (e === 0) {
                            rgba[dstIdx] = 0;
                            rgba[dstIdx + 1] = 0;
                            rgba[dstIdx + 2] = 0;
                            rgba[dstIdx + 3] = 255;
                        } else {
                            const scale = Math.pow(2.0, e - 128 - 8);
                            const rl = r * scale;
                            const gl = g * scale;
                            const bl = b * scale;

                            // Reinhard-ACES soft compression into sRGB for crisp PMREM mip convolution
                            const toSRGB = (val) => {
                                const mapped = (val * 1.2) / (1.0 + val * 0.22);
                                const srgb = mapped <= 0.0031308
                                    ? mapped * 12.92
                                    : 1.055 * Math.pow(mapped, 1.0 / 2.4) - 0.055;
                                return Math.max(0, Math.min(255, Math.round(srgb * 255)));
                            };

                            rgba[dstIdx] = toSRGB(rl);
                            rgba[dstIdx + 1] = toSRGB(gl);
                            rgba[dstIdx + 2] = toSRGB(bl);
                            rgba[dstIdx + 3] = 255;
                        }
                    }
                }

                const hdrDataTex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
                hdrDataTex.encoding = THREE.sRGBEncoding;
                hdrDataTex.mapping = THREE.EquirectangularReflectionMapping;
                hdrDataTex.needsUpdate = true;
                onComplete(hdrDataTex);
            })
            .catch(err => console.error('Failed to load Radiance HDR:', err));
    }

    /**
     * Loads and activates one of the 360° quantum laboratory environments
     */
    loadEnvironment(envKey) {
        const spec = this.environments[envKey];
        if (!spec) return;
        this.currentEnvKey = envKey;

        // Update UI titles
        const titleEl = document.getElementById('lab-title');
        const subEl = document.getElementById('lab-subtitle');
        if (titleEl) titleEl.textContent = spec.title;
        if (subEl) subEl.textContent = spec.subtitle;

        this.renderer.toneMappingExposure = spec.exposure;
        this.groundSkyboxMaterial.uniforms.uRadius.value = spec.groundRadius;
        this.groundSkyboxMaterial.uniforms.uHeight.value = spec.groundHeight;
        this.groundSkyboxMaterial.uniforms.uCeilingHeight.value = spec.ceilingHeight || 2.82;
        this.groundSkyboxMaterial.uniforms.uEnvStyle.value = (spec.envStyle !== undefined) ? spec.envStyle : 0.0;
        if (spec.floorColor) {
            this.groundSkyboxMaterial.uniforms.uFloorColor.value.copy(spec.floorColor);
        }

        if (this.cache[envKey]) {
            this.applyCachedEnvironment(this.cache[envKey]);
            return;
        }

        const entry = {
            cubeTex: null,
            equirectTex: null,
            pmremTex: null
        };
        this.cache[envKey] = entry;

        // 1. Load 6-face 1024x1024 Skybox Cubemap (equivalent to room2_skybox.dds)
        const cacheBust = '?v=10';
        const urls = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'].map(
            f => spec.cubePath + f + cacheBust
        );
        entry.cubeTex = this.cubeLoader.load(urls, (cubeTex) => {
            cubeTex.encoding = THREE.sRGBEncoding;
            cubeTex.generateMipmaps = false;
            cubeTex.minFilter = THREE.LinearFilter;
            cubeTex.magFilter = THREE.LinearFilter;
            if (this.currentEnvKey === envKey) {
                this.applyCachedEnvironment(entry);
            }
        });

        // 2. Load 3072x1536 Equirectangular Panorama for Ground-Projected Dome Mode
        entry.equirectTex = this.texLoader.load(spec.equirectPath + cacheBust, (tex) => {
            tex.encoding = THREE.sRGBEncoding;
            tex.mapping = THREE.EquirectangularReflectionMapping;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            if (this.currentEnvKey === envKey) {
                this.applyCachedEnvironment(entry);
            }
        });

        // 3. Load Radiance .hdr (RGBE) Specular IBL Map & Convolve via PMREMGenerator
        // (Equivalent to room2_specular.env with scene.environmentIntensity = 1.2)
        this.loadRadianceHDR(spec.hdrPath + cacheBust, (hdrDataTex) => {
            const pmremTarget = this.pmremGenerator.fromEquirectangular(hdrDataTex);
            entry.pmremTex = pmremTarget.texture;
            hdrDataTex.dispose();
            if (this.currentEnvKey === envKey) {
                this.applyCachedEnvironment(entry);
            }
        });
    }

    applyCachedEnvironment(entry) {
        if (entry.cubeTex) {
            this.skyboxCubeMaterial.uniforms.tCube.value = entry.cubeTex;
            if (this.projectionMode === 'cubemap') {
                this.scene.background = entry.cubeTex;
            }
        }

        if (entry.equirectTex) {
            this.groundSkyboxMaterial.uniforms.tEquirect.value = entry.equirectTex;
        }

        if (entry.pmremTex) {
            this.scene.environment = entry.pmremTex;
        }
    }

    setProjectionMode(mode) {
        this.projectionMode = mode;
        const statEl = document.getElementById('stat-skybox');

        if (mode === 'ground') {
            this.skyboxCubeMesh.visible = false;
            this.groundSkyboxMesh.visible = true;
            this.scene.background = null;
            if (statEl) statEl.textContent = 'Ground-Projected 360°';
        } else {
            this.skyboxCubeMesh.visible = true;
            this.groundSkyboxMesh.visible = false;
            const entry = this.cache[this.currentEnvKey];
            if (entry && entry.cubeTex) {
                this.scene.background = entry.cubeTex;
            }
            if (statEl) statEl.textContent = '6× 1024² Cubemap';
        }
    }
}

window.QuantumLabSkyboxEnvironment = QuantumLabSkyboxEnvironment;
