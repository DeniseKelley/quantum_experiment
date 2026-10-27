# How the Lab Background Environment Works in `apps.fz-juelich.de/qcmodel` (and How to Recreate It)

Reference analyzed: **`https://apps.fz-juelich.de/qcmodel/`** (Forschungszentrum Jülich Interactive Quantum Computer Model Viewer).

---

## 1. Key Discovery: How the Reference Site Actually Builds the Lab Room

When inspecting the live source files of `https://apps.fz-juelich.de/qcmodel/` (`index.html`, `environment.js`, `objectInteraction.js`, and `assets/model/qc_v15.gltf`), a crucial architectural detail stands out:

> **The laboratory room in the background is NOT a 3D polygon room mesh.**  
> The 3D `.gltf` model (`qc_v15.gltf`, 38 nodes) contains **only the dilution refrigerator chandelier** (plates, coax cables, heat exchangers, HEMTs, Still, Mixing Chamber, QPU) and an optional outer vacuum hull (`assets/hull/hull.gltf`).  
> The entire surrounding laboratory room—walls, windows, optical tables, ceiling lights, and floor—is rendered using a **Dual-Cubemap Image-Based Lighting (IBL) + 360° Skybox Pipeline**.

### Why It Looks So Realistic and Seamless
1. **100% Image-Based Lighting (Zero Artificial Point/Directional Lights):**
   In `environment.js`, the very first line inside `addEnvTex(scene)` deletes the default analytic light:
   ```js
   scene.lights[0].dispose();
   ```
   Every highlight on the gold-plated stages, brass connectors, and copper tubes comes directly from the real laboratory's 360° HDR environment map (`scene.environmentIntensity = 1.2`). Because the reflections on the metal are mathematically convolved from the exact same room image shown in the background, the cryostat looks physically embedded in the room.

2. **Split Skybox vs. Specular IBL Textures (`room2_skybox.dds` + `room2_specular.env`):**
   Instead of using a single environment texture for both the background and metallic reflections, the reference site loads **two separate cubemap files** from `assets/environment/`:
   - **`room2_skybox.dds` (~18.8 MB, `1024×1024` per cube face, `mipmaps: 1`):**  
     An unblurred, full-resolution 6-face cubemap applied to a `150×150×150` skybox cube with `disableLighting = true` and `microSurface = 0.99`. This keeps the visible background room razor-sharp when orbiting the camera.
   - **`room2_specular.env` (~3.35 MB, `512×512` per face, Babylon prefiltered `.env`):**  
     Contains pre-convolved GGX mipmap levels (for varying PBR surface roughnesses on the cryostat's `combined_4k_ORM.jpg` metallic-roughness texture) plus 3-band Spherical Harmonics (`irradiance` coefficients) for soft diffuse ambient bounce.

3. **Camera Pan & Zoom Clamping to Prevent Skybox Distortion:**
   A 360° skybox has no 3D depth parallax if the user pans too far away from the center `(0, 0, 0)`. To keep the illusion intact, `environment.js` tightly constrains the camera:
   ```js
   camera.lowerRadiusLimit = 1;
   camera.upperRadiusLimit = 10;
   camera.panningDistanceLimit = 5;
   ```
   By restricting zoom (`1` to `10` units) and panning (`<= 5` units) while keeping the skybox size at `150` units, the quantum computer always remains visually anchored in the middle of the laboratory room.

---

## 2. Exact Source Code Used by `apps.fz-juelich.de/qcmodel`

Below is the annotated `environment.js` implementation from the reference site:

```javascript
// environment.js (from https://apps.fz-juelich.de/qcmodel/environment.js)
BabylonViewer.viewerManager
    .getViewerPromiseById("qcModel")
    .then(function (viewer) {
        viewer.onSceneInitObservable.add(function (scene) {
            scene.executeWhenReady(function (scene) {
                addEnvTex(scene);
            });
        });
    });

function addEnvTex(scene) {
    // 1. Delete default directional/hemispheric light so 100% of lighting comes from the lab IBL
    scene.lights[0].dispose();

    // 2. Load the sharp visual skybox cubemap (.dds) and prefiltered PBR reflection map (.env)
    const hdrTexture_sky = BABYLON.CubeTexture.CreateFromPrefilteredData(
        'assets/environment/room2_skybox.dds',
        scene
    );
    const hdrTexture_spec = BABYLON.CubeTexture.CreateFromPrefilteredData(
        'assets/environment/room2_specular.env',
        scene
    );

    // 3. Bind the prefiltered specular cubemap to the scene for PBR metallic reflections
    scene.environmentTexture = hdrTexture_spec;
    scene.environmentIntensity = 1.2;

    // 4. Create the 360° Laboratory Room Skybox Cube
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 150 }, scene);

    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.reflectionTexture = hdrTexture_sky;
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.microSurface = 0.99; // Keeps the background cubemap sharp (no roughness blur)
    skyboxMaterial.disableLighting = true; // Pure unlit emissive lookup from the cubemap
    skybox.material = skyboxMaterial;

    // 5. Lock camera limits so the user cannot pan out of the skybox's sweet spot
    let camera = scene.activeCamera;
    camera.useBouncingBehavior = false;
    camera.wheelPrecision = 300;
    camera.panningInertia = 0.9;
    camera.panningDistanceLimit = 5;
    camera.wheelDeltaPercentage = 0.05;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 10;
}
```

---

## 3. How to Create This Exact Lab Background Environment in Three.js

If you are building your quantum experiment in **Three.js** (like our previous project) and want the exact same photographic 360° laboratory background + matching PBR metallic reflections as `apps.fz-juelich.de/qcmodel`, here is how to do it.

### Step 1: Obtain or Render a 360° Equirectangular HDR Lab Panorama (`.hdr` or `.exr`)
You need a 360° equirectangular panorama (`2:1` aspect ratio, e.g., `4096×2048` `.hdr`) of a laboratory or cleanroom. You can get one in three ways:
1. **Poly Haven / Free HDRIs:** Download a studio/lab/workshop `.hdr` from [Poly Haven](https://polyhaven.com/hdris) (or convert the reference cubemap).
2. **Render Your Own in Blender (Cycles):**
   - Place a camera at the center of a 3D lab room `(0, 0, 1.5m)`.
   - In **Camera Properties**, set **Type** to `Panoramic` and **Panorama Type** to `Equirectangular`.
   - Render at `4096 × 2048` and save as **Radiance HDR (`.hdr`)** or **OpenEXR (`.exr`)**.
   - This bakes realistic global illumination, soft area lights, and lab equipment into a single 360° texture with zero runtime polygon cost.
3. **High-Resolution Procedural Canvas Equirectangular Panorama (Zero external files):**
   - Draw a detailed `2048×1024` or `4096×2048` equirectangular room projection onto an HTML5 `<canvas>` (with spherical-projected walls, windows, lab benches, ceiling grid, and floor) and assign it to both `scene.background` and `PMREMGenerator`.

### Step 2: Load the Panorama as Both `scene.background` (Sharp Skybox) and `scene.environment` (Prefiltered IBL) in Three.js

In Three.js, `PMREMGenerator` performs the exact same job as Babylon's `room2_specular.env`, while assigning the raw equirectangular texture to `scene.background` performs the exact same job as `room2_skybox.dds`:

```javascript
// Three.js implementation matching apps.fz-juelich.de/qcmodel/environment.js
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

function setupJuelichStyleLabEnvironment(renderer, scene, camera, controls) {
    // 1. Calibrate Renderer Tone Mapping & Exposure (matching Babylon's PBR pipeline)
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 2. Generate Prefiltered Specular Mipmaps via PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // 3. Load 360° Lab HDR Panorama
    new RGBELoader().load('assets/environment/lab_room_4k.hdr', (hdrEquirect) => {
        hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;

        // A. Sharp 360° Background Skybox (equivalent to room2_skybox.dds)
        scene.background = hdrEquirect;

        // B. Prefiltered GGX Specular + Irradiance IBL (equivalent to room2_specular.env)
        const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
        scene.environment = envMap;

        pmremGenerator.dispose();
    });

    // 4. Constrain OrbitControls to prevent skybox parallax distortion
    // (Matches camera.lowerRadiusLimit = 1, upperRadiusLimit = 10, panningDistanceLimit = 5)
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 6.5;
    controls.maxPolarAngle = Math.PI * 0.85;
}
```

### Step 3 (Optional Upgrade): Ground-Projected Skybox (`GroundProjectedEnv`)
In standard skyboxes (including `apps.fz-juelich.de/qcmodel/`), the floor of the 360° photo is projected at infinity, so the cryostat hovers in the center of the sphere rather than sitting on the floor plane.
If you want the 360° photo's floor to act as a **flat horizontal floor** at `y = 0` that the gantry legs physically stand on:
- Use Three.js's `GroundProjectedEnv` (or `GroundProjectedSkybox`):
  ```javascript
  import { GroundProjectedEnv } from 'three/examples/jsm/objects/GroundProjectedEnv.js';

  const env = new GroundProjectedEnv(hdrEquirect);
  env.scale.setScalar(20); // Room radius in meters
  env.height = 2.5;        // Camera height when the 360° panorama was captured
  env.radius = 12;         // Flattens the lower hemisphere into a physical floor at y = 0
  scene.add(env);
  ```

---

## 4. How to Convert Any `.hdr` Panorama into Babylon `.env` + `.dds` (If Using Babylon.js)

If you want to use **Babylon.js** directly like the Forschungszentrum Jülich viewer:
1. Open the official **[Babylon.js Sandbox](https://sandbox.babylonjs.com/)** in your browser.
2. Drag and drop your 360° `.hdr` laboratory panorama into the viewport.
3. Open the **Inspector** (`Tools` tab) → click **Generate .env texture** → save as `room2_specular.env`.
4. Use [cmftStudio](https://github.com/dariomanesku/cmftStudio) or `texconv` (`texconv -f R32G32B32A32_FLOAT -m 1`) to convert the `.hdr` into an unblurred 1-mipmap cubemap `room2_skybox.dds` (or simply pass a high-res `.env` to `scene.createDefaultSkybox(hdrTexture, true, 150, 0.0)` with `blur = 0.0`).

---

## 5. Summary Comparison: 3D Geometry Room vs. 360° IBL Skybox Room

| Feature | 3D Polygon Room (Walls/Racks Meshes) | Reference Site (`fz-juelich.de/qcmodel`) 360° IBL Skybox |
| :--- | :--- | :--- |
| **How Background is Rendered** | Real-time 3D meshes (`BoxGeometry`, `CylinderGeometry`) | `1024×1024` 6-face 360° Cubemap (`room2_skybox.dds`) |
| **How Metals are Lit** | Analytic lights + synthetic env map | 100% Prefiltered HDR IBL (`room2_specular.env`, `intensity = 1.2`) |
| **Background Visual Detail** | Limited by procedural geometry/textures | Photographic realism (real lab benches, cables, windows, lighting) |
| **GPU Geometry Cost** | Thousands of extra triangles & shadow maps | **12 triangles** (one skybox cube) |
| **Camera Movement** | Full 3D walking/panning parallax | Orbit around central model (`lowerRadius = 1`, `upperRadius = 10`) |
