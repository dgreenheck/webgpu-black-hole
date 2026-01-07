# Raytracing a Black Hole with WebGPU: A Deep Dive

*How to render scientifically-accurate gravitational lensing in real-time using Three.js and WebGPU*

---

## Introduction

When *Interstellar* hit theaters in 2014, audiences were captivated by the hauntingly beautiful imagery of Gargantua, the supermassive black hole at the film's center. What made these visuals remarkable wasn't just their aesthetic appeal - they were based on real physics, with gravitational lensing calculations performed by a team led by physicist Kip Thorne.

In this tutorial, we'll recreate this effect in real-time using WebGPU and Three.js's new Shading Language (TSL). By the end, you'll understand both the physics behind black hole visualization and how to implement it efficiently in a browser.

**What we'll build:**
- A raymarched black hole with gravitational lensing
- An accretion disk with temperature-based blackbody coloring
- Turbulent ring patterns with Keplerian rotation
- A procedural star field and nebula background that get distorted by gravity
- Interactive controls for all parameters

[Live Demo](#) | [Source Code](https://github.com/dgreenheck/webgpu-galaxy)

---

## Part 1: The Physics of Black Holes

### 1.1 Schwarzschild Spacetime

A black hole is a region of spacetime where gravity is so strong that nothing - not even light - can escape. For a non-rotating black hole (called a Schwarzschild black hole), the key radius is the **event horizon**:

```
rs = 2GM/c²
```

Where:
- `G` is the gravitational constant
- `M` is the black hole's mass
- `c` is the speed of light

In our simulation, we use geometric units where `G = c = 1`, so `rs = 2M`. With a mass of 1.0, our event horizon is at radius 2.0.

### 1.2 How Light Bends Around a Black Hole

In general relativity, massive objects curve spacetime, and light follows the curves - called **geodesics**. Near a black hole, these curves can be dramatic. Light passing close to the event horizon can loop around multiple times before escaping.

This bending creates several visual effects:
1. **Einstein rings** - Background stars appear as rings around the black hole
2. **Multiple images** - We can see the same object from different angles
3. **The shadow** - A dark region where light has fallen in

### 1.3 The Accretion Disk

Matter falling into a black hole doesn't drop straight in. Due to conservation of angular momentum, it forms a flat, rotating disk called an **accretion disk**.

**The Inner Edge (ISCO):**
For a Schwarzschild black hole, the innermost stable circular orbit (ISCO) is at `r = 3 × rs`. Matter inside this radius spirals rapidly into the black hole. In our simulation with `rs = 2`, this means `ISCO = 6.0` - but we often set the inner edge at `r = 3.0` for more dramatic visuals.

**Temperature Profile:**
The inner disk is hotter because gravitational potential energy converts to heat as matter falls inward. The standard thin disk model (Shakura-Sunyaev) predicts:

```
T ∝ r^(-3/4)
```

This means the inner edge glows white-hot while the outer edge is cooler (red/orange). We'll use blackbody radiation colors to visualize this temperature gradient.

**Keplerian Rotation:**
Material in the disk orbits according to Kepler's laws - inner material moves faster than outer material. The orbital velocity goes as:

```
v ∝ r^(-1/2)
```

This differential rotation creates shearing in the disk, stretching any structures into elongated arcs.

---

## Part 2: Setting Up the Project

### 2.1 Three.js with WebGPU and TSL

Three.js recently introduced **Three Shading Language (TSL)**, a JavaScript-based shader language that compiles to WGSL (WebGPU) or GLSL (WebGL). This lets us write shaders in familiar JavaScript syntax.

First, let's set up the basic structure:

```javascript
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Initialize WebGPU renderer
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 20);

// Create a large inverted sphere as our render surface
// By inverting it, we render from inside - perfect for a skybox-style shader
const geometry = new THREE.SphereGeometry(100, 32, 32);
geometry.scale(-1, 1, 1);  // Invert the sphere

const material = new THREE.MeshBasicNodeMaterial();
// material.colorNode will hold our shader
```

### 2.2 Shader Architecture

We'll organize our shader into distinct sections:
1. **Utility functions** - Hash functions, noise, FBM
2. **Background** - Stars and nebula
3. **Accretion disk** - Color and opacity calculation
4. **Main raymarcher** - The core loop that traces light through curved spacetime

**🎯 Checkpoint 1:** At this point, we have a basic Three.js WebGPU setup with an inverted sphere. Setting `material.colorNode = vec4(1, 0, 0, 1)` should give us a red screen.

---

## Part 3: The Raymarching Core

### 3.1 What is Raymarching?

Traditional rasterization renders objects by projecting triangles onto the screen. But gravitational lensing bends light in ways that triangles can't represent. We need to trace each ray's path through curved spacetime.

**Raymarching** works by:
1. For each pixel, create a ray from the camera
2. Step the ray forward in small increments
3. At each step, bend the ray toward the black hole
4. Check if the ray hits the disk, falls into the hole, or escapes

### 3.2 Camera Setup

First, we need to generate rays for each pixel. We build a camera coordinate system from the camera position and target:

```javascript
// Get UV coordinates centered at (0,0) ranging from -1 to 1
const uv = screenUV.sub(0.5).mul(2.0);
const aspect = uniforms.resolution.x.div(uniforms.resolution.y);
const screenPos = vec2(uv.x.mul(aspect), uv.y);

// Camera basis vectors
const camPos = uniforms.cameraPosition;
const camTarget = uniforms.cameraTarget;
const camForward = normalize(camTarget.sub(camPos));
const worldUp = vec3(0.0, 1.0, 0.0);
const camRight = normalize(cross(worldUp, camForward));
const camUp = cross(camForward, camRight);

// Generate ray direction through this pixel
const fov = float(1.0);
const rayDir = normalize(
  camForward.mul(fov)
    .add(camRight.mul(screenPos.x))
    .add(camUp.mul(screenPos.y))
).toVar('rayDir');
```

**🎯 Checkpoint 2:** We can visualize the ray direction as a color to verify our camera setup:

```javascript
return vec4(rayDir.mul(0.5).add(0.5), 1.0);
```

This should show a gradient where different directions map to different colors.

### 3.3 The Basic Raymarching Loop

Now let's build the core loop. We'll start simple and add features incrementally:

```javascript
const rayPos = camPos.toVar('rayPos');
const rs = uniforms.blackHoleMass.mul(2.0);  // Event horizon radius

Loop(64, () => {
  const r = length(rayPos);

  // Captured by black hole?
  If(r.lessThan(rs.mul(1.01)), () => {
    Break();
  });

  // Escaped to infinity?
  If(r.greaterThan(100.0), () => {
    Break();
  });

  // Step forward
  rayPos.addAssign(rayDir.mul(uniforms.stepSize));
});
```

Without gravitational bending, this just traces straight lines. Let's add the physics.

### 3.4 Gravitational Light Bending

The key to the black hole visualization is bending light rays toward the center. We use a simplified model based on the Schwarzschild metric:

```javascript
// Direction from ray to black hole center
const toCenter = rayPos.negate().div(r);  // Normalized

// Bend strength: stronger when closer (inverse square)
const bendStrength = rs.div(r.mul(r)).mul(stepSize).mul(uniforms.gravitationalLensing);

// Apply bending to ray direction
rayDir.addAssign(toCenter.mul(bendStrength));
rayDir.assign(normalize(rayDir));

// Then step forward
rayPos.addAssign(rayDir.mul(stepSize));
```

The `gravitationalLensing` uniform (default 1.5) lets us tune the bend strength. A value of 1.5 gives visually pleasing results that match the expected physics reasonably well.

**🎯 Checkpoint 3:** Now we should see a black circle in the center of the screen - rays that get too close fall into the black hole and never escape. The background (which we haven't added yet) shows through elsewhere.

### 3.5 Adaptive Step Size

There's a problem with fixed step sizes: near the event horizon, light curves sharply. Large steps miss these curves, causing inaccurate geodesics. But small steps everywhere are expensive.

The solution is **adaptive stepping** - take smaller steps where precision matters:

```javascript
const distFromHorizon = r.sub(rs);
const horizonFactor = smoothstep(float(0.0), rs.mul(5.0), distFromHorizon)
  .mul(0.8).add(0.2);  // Range: 0.2 to 1.0
const adaptiveStep = uniforms.stepSize.mul(horizonFactor);
```

Near the event horizon (`distFromHorizon ≈ 0`), we use 20% of the base step size. Far away, we use the full step size. This concentrates our computational budget where it matters most.

---

## Part 4: The Accretion Disk

### 4.1 Disk Intersection

Rather than volumetric sampling (stepping through a thick disk), we use **analytic plane intersection**. The disk lies in the XZ plane (Y = 0), so we detect when the ray crosses this plane:

```javascript
const prevPos = camPos.toVar('prevPos');

// Inside the loop, after stepping:
prevPos.assign(rayPos);  // Save position before stepping
rayPos.addAssign(rayDir.mul(adaptiveStep));

// Did we cross the Y = 0 plane?
const crossedPlane = prevPos.y.mul(rayPos.y).lessThan(0.0);

If(crossedPlane, () => {
  // Linear interpolation to find exact crossing point
  const t = prevPos.y.negate().div(rayPos.y.sub(prevPos.y));
  const hitPos = mix(prevPos, rayPos, t);

  // Radial distance from center
  const hitR = sqrt(hitPos.x.mul(hitPos.x).add(hitPos.z.mul(hitPos.z)));

  // Is this within the disk bounds?
  const inDisk = hitR.greaterThan(innerR).and(hitR.lessThan(outerR));

  If(inDisk, () => {
    // Sample disk color here...
  });
});
```

This approach is more efficient than volumetric sampling - we only compute disk color when we actually hit it, and we get pixel-perfect intersection points.

**🎯 Checkpoint 4:** With a simple flat color for the disk, we should now see a ring around the black hole. The gravitational lensing causes the far side of the disk to appear warped above and below the black hole.

### 4.2 Blackbody Temperature Coloring

Real accretion disks glow based on their temperature. We implement a blackbody color function that maps temperature (in Kelvin) to RGB:

```javascript
const blackbodyColor = Fn(([tempK]) => {
  // Normalize: 1000K -> 0, 10000K -> 1
  const t = clamp(tempK.sub(1000.0).div(9000.0), float(0.0), float(1.0));

  // Red: high for all temperatures, drops slightly at extreme heat
  const red = clamp(float(1.0).sub(t.sub(0.8).mul(2.0)), float(0.5), float(1.0));

  // Green: rises from 0 to peak at mid temps
  const green = smoothstep(float(0.0), float(0.5), t)
    .mul(float(1.0).sub(t.sub(0.7).mul(0.3).max(0.0)));

  // Blue: only significant at high temperatures
  const blue = smoothstep(float(0.3), float(1.0), t).mul(t);

  return vec3(red, green, blue);
});
```

Now we apply the temperature profile from Section 1.3:

```javascript
const peakTempK = uniforms.diskTemperature.mul(1000.0);  // e.g., 10 -> 10,000K
const outerTempK = float(1500.0);  // Minimum at outer edge

// Power law falloff: T ∝ r^(-temperatureFalloff)
const tempFalloff = pow(innerR.div(hitR), uniforms.temperatureFalloff);
const tempK = mix(outerTempK, peakTempK, tempFalloff);

const diskColor = blackbodyColor(tempK);
```

**🎯 Checkpoint 5:** The disk should now show a gradient from white/blue at the inner edge to red/orange at the outer edge.

### 4.3 Edge Softening

Sharp disk boundaries look artificial. We add smooth falloff at both edges:

```javascript
const normR = clamp(hitR.sub(innerR).div(outerR.sub(innerR)), float(0.0), float(1.0));

const edgeFalloff = smoothstep(float(0.0), uniforms.diskEdgeSoftnessInner, normR)
  .mul(smoothstep(float(1.0), float(1.0).sub(uniforms.diskEdgeSoftnessOuter), normR));
```

### 4.4 Turbulent Ring Patterns

Real accretion disks aren't smooth - they have turbulent structure caused by magnetohydrodynamic instabilities. We create this using **3D Fractal Brownian Motion (FBM)**.

First, we need noise functions:

```javascript
// 3D Value noise
const noise3D = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));  // Smoothstep

  // Hash the 8 corners of the cube and interpolate
  // ... (trilinear interpolation of hashed values)
});

// Fractal Brownian Motion - layered noise
const fbm = Fn(([p]) => {
  const value = float(0.0).toVar();
  const amplitude = float(0.5).toVar();
  const pos = p.toVar();

  // 4 octaves
  for (let i = 0; i < 4; i++) {
    value.addAssign(noise3D(pos).mul(amplitude));
    pos.mulAssign(2.0);
    amplitude.mulAssign(0.5);
  }

  return value;
});
```

Now we apply this to create swirling patterns. The key insight is using **anisotropic coordinates** - we stretch the noise differently in the radial vs. azimuthal directions to create arc-like structures rather than random blobs:

```javascript
const hitAngle = atan(hitPos.z, hitPos.x);

// Keplerian rotation: inner regions rotate faster
const keplerianPhase = time.mul(uniforms.diskRotationSpeed).div(pow(hitR, float(1.5)));
const rotatedAngle = hitAngle.add(keplerianPhase);

// Anisotropic sampling: radial creates rings, azimuthal creates arcs
const noiseCoord = vec3(
  hitR.mul(uniforms.turbulenceScale),                          // Radial component
  cos(rotatedAngle).div(uniforms.turbulenceStretch.max(0.1)), // Stretched azimuthally
  sin(rotatedAngle).div(uniforms.turbulenceStretch.max(0.1))
);

const turbulence = fbm(noiseCoord);
const ringOpacity = pow(clamp(turbulence, float(0.0), float(1.0)), uniforms.turbulenceSharpness);
```

The `turbulenceStretch` parameter (default 5.0) controls how elongated the structures are. Higher values create longer arcs that wrap around the disk.

### 4.5 The Cyclic Time Problem

There's a subtle issue with Keplerian rotation: the phase grows without bound over time. For very long-running simulations, this can cause floating-point precision issues and visual discontinuities.

The fix is to use **cyclic time with crossfading**:

```javascript
const cycleLength = uniforms.turbulenceCycleTime;  // e.g., 10 seconds
const cyclicTime = time.mod(cycleLength);
const blendFactor = cyclicTime.div(cycleLength);

// Sample two phases offset by one cycle
const phase1 = cyclicTime.mul(rotationSpeed).div(pow(hitR, float(1.5)));
const phase2 = cyclicTime.add(cycleLength).mul(rotationSpeed).div(pow(hitR, float(1.5)));

const turbulence1 = fbm(/* coords with phase1 */);
const turbulence2 = fbm(/* coords with phase2 */);

// Crossfade to hide the cycle reset
const turbulence = mix(turbulence2, turbulence1, blendFactor);
```

This creates seamless looping - as one phase approaches its reset point, we blend into the next phase.

**🎯 Checkpoint 6:** The disk should now show dynamic, swirling arc patterns that rotate differentially - inner regions spin faster than outer regions, creating realistic shearing.

### 4.6 Alpha Compositing

Because the disk is thin but the ray can pass through it multiple times (from different angles due to lensing), we use front-to-back alpha compositing:

```javascript
const color = vec3(0.0, 0.0, 0.0).toVar('color');
const alpha = float(0.0).toVar('alpha');

// When we hit the disk:
const diskResult = accretionDiskColor(hitR, hitAngle, time);  // Returns vec4(rgb, opacity)
const remainingAlpha = float(1.0).sub(alpha);
color.addAssign(diskResult.xyz.mul(diskResult.w).mul(remainingAlpha));
alpha.addAssign(remainingAlpha.mul(diskResult.w));

// Early termination when fully opaque
If(alpha.greaterThan(0.99), () => { Break(); });
```

---

## Part 5: Procedural Background

### 5.1 Star Field

For rays that escape to infinity, we show a procedural star field. We use a grid-based approach that ensures consistent star positions regardless of camera angle:

```javascript
const createStarField = (uniforms) => Fn(([rayDir]) => {
  // Convert ray direction to spherical coordinates
  const theta = atan(rayDir.z, rayDir.x);
  const phi = asin(clamp(rayDir.y, float(-1.0), float(1.0)));

  // Grid cells
  const gridScale = float(60.0).div(uniforms.starSize);
  const cell = floor(vec2(theta, phi).mul(gridScale));
  const cellUV = fract(vec2(theta, phi).mul(gridScale));

  // Hash determines if this cell has a star
  const cellHash = hash21(cell);
  const starProb = step(float(1.0).sub(uniforms.starDensity), cellHash);

  // Star position within cell (offset from edges)
  const starPos = hash22(cell.add(42.0)).mul(0.8).add(0.1);
  const distToStar = length(cellUV.sub(starPos));

  // Brightness with soft glow
  const starCore = smoothstep(starSize, float(0.0), distToStar);
  const starGlow = smoothstep(starSize.mul(3.0), float(0.0), distToStar).mul(0.3);

  return starColor.mul(starCore.add(starGlow)).mul(starProb);
});
```

Because we apply this to the *bent* ray direction (after gravitational lensing), stars near the black hole appear distorted - exactly as physics predicts. You can see the Einstein ring effect where background stars appear to wrap around the black hole's shadow.

**🎯 Checkpoint 7:** Stars should now be visible in the background, distorted into arcs near the black hole.

### 5.2 Nebula Clouds

For additional atmosphere, we add procedural nebula using layered FBM noise:

```javascript
const createNebulaField = (uniforms) => Fn(([rayDir]) => {
  // Layer 1
  const n1 = fbm(rayDir.mul(uniforms.nebula1Scale)).mul(2.0).sub(1.0);
  const layer1 = clamp(n1.add(uniforms.nebula1Density), float(0.0), float(1.0));
  const color1 = uniforms.nebula1Color.mul(layer1).mul(uniforms.nebula1Brightness);

  // Layer 2 (different scale for variety)
  const n2 = fbm(rayDir.mul(uniforms.nebula2Scale)).mul(2.0).sub(1.0);
  const layer2 = clamp(n2.add(uniforms.nebula2Density), float(0.0), float(1.0));
  const color2 = uniforms.nebula2Color.mul(layer2).mul(uniforms.nebula2Brightness);

  return color1.add(color2);
});
```

Two independent layers with different scales and colors create depth and visual interest.

**🎯 Checkpoint 8:** Colorful nebula clouds should now appear in the background, adding cosmic atmosphere.

---

## Part 6: Final Polish

### 6.1 Gamma Correction

Computer monitors expect gamma-corrected values. We apply the standard sRGB correction:

```javascript
const finalColor = pow(color, vec3(1.0 / 2.2));
return vec4(finalColor, 1.0);
```

### 6.2 Complete Raymarching Loop

Here's the full loop structure with all components:

```javascript
Loop(64, () => {
  // Early termination checks
  If(escaped.or(captured).or(alpha.greaterThan(0.99)), () => { Break(); });

  const r = length(rayPos);

  // Captured by black hole
  If(r.lessThan(rs.mul(1.01)), () => {
    captured.assign(1.0);
    Break();
  });

  // Escaped to infinity
  If(r.greaterThan(100.0), () => {
    escaped.assign(1.0);
    Break();
  });

  // Adaptive stepping
  const adaptiveStep = computeAdaptiveStep(r, rs);

  // Gravitational bending
  applyGravitationalBending(rayPos, rayDir, r, rs, adaptiveStep);

  // Save previous position and step forward
  prevPos.assign(rayPos);
  rayPos.addAssign(rayDir.mul(adaptiveStep));

  // Disk intersection
  checkDiskIntersection(prevPos, rayPos, color, alpha);
});

// Background for escaped rays
If(escaped.and(alpha.lessThan(0.99)), () => {
  const bg = starField(rayDir).add(nebulaField(rayDir));
  color.addAssign(bg.mul(float(1.0).sub(alpha)));
});
```

---

## Part 7: Performance Considerations

### 7.1 Step Count vs. Quality

The number of raymarching iterations directly affects both quality and performance:

| Steps | Quality | Use Case |
|-------|---------|----------|
| 32    | Low     | Mobile, testing |
| 64    | Medium  | Default (good balance) |
| 128   | High    | Screenshots, powerful GPUs |
| 256   | Ultra   | Offline rendering |

### 7.2 Adaptive Stepping Benefits

Our horizon-based adaptive stepping isn't just about accuracy - it's also about performance. By using larger steps in empty space far from the black hole, we effectively get more distance covered with fewer iterations.

### 7.3 Early Termination

We exit the loop as soon as we know the ray's fate:
- **Captured**: `r < rs` - ray fell into black hole
- **Escaped**: `r > 100` - ray left the scene
- **Opaque**: `alpha > 0.99` - accumulated enough disk material

---

## Conclusion

We've built a real-time black hole visualization from scratch. The key insights were:

1. **Raymarching is ideal for curved spacetime** - we can bend rays at each step according to gravitational physics.

2. **Analytic intersection beats volumetric sampling** - for a thin disk, computing exact plane crossings is both faster and more accurate than stepping through volume.

3. **Anisotropic noise creates believable structure** - by stretching noise differently in radial vs. azimuthal directions, we get arc-like patterns that mimic real turbulence.

4. **Blackbody radiation gives physically-motivated color** - the temperature profile from thin-disk theory naturally produces the iconic white-hot inner edge fading to red-orange outer regions.

5. **Adaptive stepping balances quality and performance** - smaller steps near the event horizon capture the dramatic light bending, while larger steps elsewhere save computation.

The effect is most dramatic when you orbit the camera around the black hole - you can see how the disk appears to bend above and below, with the far side visible through gravitational lensing. Background stars create Einstein rings as they pass behind the black hole.

**Potential extensions:**
- Spinning (Kerr) black holes with frame dragging
- Doppler beaming (relativistic brightness variation based on disk velocity)
- Gravitational redshift
- Wormholes connecting two regions of space

---

## References

1. James, O., von Tunzelmann, E., Franklin, P., & Thorne, K. S. (2015). *Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar*. Classical and Quantum Gravity.

2. Schwarzschild, K. (1916). *On the gravitational field of a mass point according to Einstein's theory*.

3. Shakura, N. I., & Sunyaev, R. A. (1973). *Black holes in binary systems. Observational appearance*.

4. Three.js TSL Documentation: https://threejs.org/docs/#api/en/tsl/

---

*Built with Three.js WebGPU and TSL. [View source on GitHub](https://github.com/dgreenheck/webgpu-galaxy)*
