/**
 * ============================================================================
 * BLACK HOLE TSL SHADER
 * ============================================================================
 *
 * Raymarching shader for black hole visualization using Three.js TSL.
 * Separated from the main simulation class for better code organization.
 *
 * @author Daniel Greenheck
 * @see BLOG.md for detailed explanation
 */

import {
  vec2,
  vec3,
  vec4,
  float,
  Fn,
  length,
  normalize,
  cross,
  dot,
  sin,
  cos,
  atan,
  asin,
  sqrt,
  pow,
  fract,
  clamp,
  smoothstep,
  mix,
  floor,
  step,
  Loop,
  Break,
  If,
  screenUV
} from 'three/tsl';

// ============================================================================
// SECTION 1: UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash function for pseudo-random number generation.
 * Used for procedural star and noise generation.
 */
const hash21 = Fn(([p]) => {
  const n = sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453);
  return fract(n);
});

const hash31 = Fn(([p]) => {
  const n = sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453);
  return fract(n);
});

const hash22 = Fn(([p]) => {
  const px = fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const py = fract(sin(dot(p, vec2(269.5, 183.3))).mul(43758.5453));
  return vec2(px, py);
});

/**
 * 3D Value noise for turbulence effects.
 */
const noise3D = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);

  // Smooth interpolation
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  // Hash corners
  const a = hash31(i);
  const b = hash31(i.add(vec3(1, 0, 0)));
  const c = hash31(i.add(vec3(0, 1, 0)));
  const d = hash31(i.add(vec3(1, 1, 0)));
  const e = hash31(i.add(vec3(0, 0, 1)));
  const f2 = hash31(i.add(vec3(1, 0, 1)));
  const g = hash31(i.add(vec3(0, 1, 1)));
  const h = hash31(i.add(vec3(1, 1, 1)));

  // Trilinear interpolation
  return mix(
    mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
    mix(mix(e, f2, u.x), mix(g, h, u.x), u.y),
    u.z
  );
});

/**
 * Fractal Brownian Motion - layered noise for natural-looking turbulence.
 * @param p - 3D position
 * @param lacunarity - frequency multiplier per octave (typically 2.0)
 * @param persistence - amplitude multiplier per octave (typically 0.5)
 */
const fbm = Fn(([p, lacunarity, persistence]) => {
  const value = float(0.0).toVar();
  const amplitude = float(0.5).toVar();
  const pos = p.toVar();

  // 4 octaves of noise
  value.addAssign(noise3D(pos).mul(amplitude));
  pos.mulAssign(lacunarity);
  amplitude.mulAssign(persistence);

  value.addAssign(noise3D(pos).mul(amplitude));
  pos.mulAssign(lacunarity);
  amplitude.mulAssign(persistence);

  value.addAssign(noise3D(pos).mul(amplitude));
  pos.mulAssign(lacunarity);
  amplitude.mulAssign(persistence);

  value.addAssign(noise3D(pos).mul(amplitude));

  return value;
});

/**
 * Convert temperature in Kelvin to RGB color using blackbody radiation.
 * Uses a branchless implementation for reliable shader compilation.
 * Based on color temperature approximation with smooth interpolation.
 * Valid for temperatures ~1000K to ~10000K.
 */
const blackbodyColor = Fn(([tempK]) => {
  // Normalize temperature: 1000K -> 0, 10000K -> 1
  const t = clamp(tempK.sub(1000.0).div(9000.0), float(0.0), float(1.0));

  // Color stops for blackbody radiation (physically motivated):
  // 1000K: deep red-orange (like hot coals)
  // 2000K: orange
  // 3500K: yellow-orange
  // 5500K: white (like the sun)
  // 10000K: blue-white

  // Red: starts high, stays high until very hot
  const red = clamp(float(1.0).sub(t.sub(0.8).mul(2.0)), float(0.5), float(1.0));

  // Green: starts low (red-orange), increases to white, slight decrease at blue-white
  const green = smoothstep(float(0.0), float(0.5), t)
    .mul(float(1.0).sub(t.sub(0.7).mul(0.3).max(0.0)));

  // Blue: near zero for cool temps, rises significantly only at high temps
  const blue = smoothstep(float(0.3), float(1.0), t).mul(t);

  return vec3(red, green, blue);
});

// ============================================================================
// SECTION 2: PROCEDURAL BACKGROUND
// ============================================================================

/**
 * Generate procedural star field.
 * Stars are placed using a grid-based hash function for consistent positions.
 */
const createStarField = (uniforms) => Fn(([rayDir]) => {
  // Convert ray direction to spherical coordinates for grid
  const theta = atan(rayDir.z, rayDir.x);
  const phi = asin(clamp(rayDir.y, float(-1.0), float(1.0)));

  // Create grid cells - lower scale = larger cells = bigger stars
  const gridScale = float(60.0).div(uniforms.starSize);
  const scaledCoord = vec2(theta, phi).mul(gridScale);
  const cell = floor(scaledCoord);
  const cellUV = fract(scaledCoord);

  // Hash for this cell
  const cellHash = hash21(cell);

  // Star probability - most cells are empty
  const starProb = step(float(1.0).sub(uniforms.starDensity), cellHash);

  // Star position within cell
  const starPos = hash22(cell.add(42.0)).mul(0.8).add(0.1);
  const distToStar = length(cellUV.sub(starPos));

  // Star size with variation - base size scaled by uniform
  const baseSizeVar = hash21(cell.add(100.0)).mul(0.03).add(0.01);
  const finalStarSize = baseSizeVar.mul(uniforms.starSize);

  // Star brightness with soft glow
  const starCore = smoothstep(finalStarSize, float(0.0), distToStar);
  const starGlow = smoothstep(finalStarSize.mul(3.0), float(0.0), distToStar).mul(0.3);
  const starIntensity = starCore.add(starGlow).mul(starProb);

  // Star color variation (blue to yellow)
  const colorTemp = hash21(cell.add(200.0));
  const starColor = mix(
    vec3(0.8, 0.9, 1.0),  // Blue-white
    vec3(1.0, 0.95, 0.8), // Yellow-white
    colorTemp
  );

  return starColor.mul(starIntensity).mul(uniforms.starBrightness);
});

/**
 * Generate procedural nebula clouds.
 * Two independent layers added together, each with its own controls.
 */
const createNebulaField = (uniforms) => Fn(([rayDir]) => {
  // Layer 1
  const noisePos1 = rayDir.mul(uniforms.nebula1Scale);
  const n1 = fbm(noisePos1, float(2.0), float(0.5)).mul(2.0).sub(1.0);
  const layer1 = clamp(n1.add(uniforms.nebula1Density), float(0.0), float(1.0));
  const color1 = uniforms.nebula1Color.mul(layer1).mul(uniforms.nebula1Brightness);

  // Layer 2
  const noisePos2 = rayDir.mul(uniforms.nebula2Scale);
  const n2 = fbm(noisePos2, float(2.0), float(0.5)).mul(2.0).sub(1.0);
  const layer2 = clamp(n2.add(uniforms.nebula2Density), float(0.0), float(1.0));
  const color2 = uniforms.nebula2Color.mul(layer2).mul(uniforms.nebula2Brightness);

  // Add layers together
  return color1.add(color2);
});

// ============================================================================
// SECTION 3: ACCRETION DISK
// ============================================================================

/**
 * Calculate the color and opacity of the accretion disk at a given point.
 * Returns vec4(color.rgb, opacity) where ring patterns control opacity.
 */
const createAccretionDiskColor = (uniforms) => Fn(([hitR, hitAngle, time]) => {
  const innerR = uniforms.diskInnerRadius;
  const outerR = uniforms.diskOuterRadius;

  // Normalized radius (0 at inner edge, 1 at outer edge)
  const normR = clamp(hitR.sub(innerR).div(outerR.sub(innerR)), float(0.0), float(1.0));

  // === BLACKBODY DISK COLOR ===
  // Temperature profile inspired by Shakura-Sunyaev thin disk model
  // Peak temperature at inner edge (ISCO), falling to cooler outer regions
  // diskTemperature is in thousands of Kelvin (e.g., 5 = 5,000K peak)
  // temperatureFalloff controls steepness: 0.75 = physical, higher = steeper gradient
  const peakTempK = uniforms.diskTemperature.mul(1000.0);
  const outerTempK = float(1500.0); // Minimum temperature at outer edge (red-orange glow)
  // Use power law falloff but ensure we stay in visible range
  const tempFalloff = pow(innerR.div(hitR), uniforms.temperatureFalloff);
  const tempK = mix(outerTempK, peakTempK, tempFalloff);
  const diskColor = blackbodyColor(tempK);

  // Edge falloff - disk fades at boundaries
  const edgeFalloff = smoothstep(float(0.0), uniforms.diskEdgeSoftnessInner, normR)
    .mul(smoothstep(float(1.0), float(1.0).sub(uniforms.diskEdgeSoftnessOuter), normR));

  // === TURBULENT RING PATTERN ===
  // Anisotropic noise creates organic arc structures
  const ringOpacity = float(1.0).toVar('ringOpacity');

  // Cyclic time to prevent unbounded winding from differential rotation
  // We crossfade between two phases to hide the reset discontinuity
  const cycleLength = uniforms.turbulenceCycleTime;
  const cyclicTime = time.mod(cycleLength);
  const blendFactor = cyclicTime.div(cycleLength);

  // Two Keplerian phases for crossfade - inner regions rotate faster than outer
  const keplerianPhase1 = cyclicTime.mul(uniforms.diskRotationSpeed).div(pow(hitR, float(1.5)));
  const keplerianPhase2 = cyclicTime.add(cycleLength).mul(uniforms.diskRotationSpeed).div(pow(hitR, float(1.5)));

  const rotatedAngle1 = hitAngle.add(keplerianPhase1);
  const rotatedAngle2 = hitAngle.add(keplerianPhase2);

  // Sample noise at both phases
  // Anisotropic sampling: radial coord creates rings, azimuthal coords create arcs
  const noiseCoord1 = vec3(
    hitR.mul(uniforms.turbulenceScale),
    cos(rotatedAngle1).div(uniforms.turbulenceStretch.max(0.1)),
    sin(rotatedAngle1).div(uniforms.turbulenceStretch.max(0.1))
  );
  const noiseCoord2 = vec3(
    hitR.mul(uniforms.turbulenceScale),
    cos(rotatedAngle2).div(uniforms.turbulenceStretch.max(0.1)),
    sin(rotatedAngle2).div(uniforms.turbulenceStretch.max(0.1))
  );

  const turbulence1 = fbm(noiseCoord1, uniforms.turbulenceLacunarity, uniforms.turbulencePersistence);
  const turbulence2 = fbm(noiseCoord2, uniforms.turbulenceLacunarity, uniforms.turbulencePersistence);

  // Crossfade: at cyclicTime=0 show turbulence2, at cyclicTime=cycleLength show turbulence1
  const turbulence = mix(turbulence2, turbulence1, blendFactor);

  // Apply sharpness
  ringOpacity.assign(pow(clamp(turbulence, float(0.0), float(1.0)), uniforms.turbulenceSharpness));

  // Combine ring opacity with edge falloff (fades to transparent, not black)
  const finalOpacity = ringOpacity.mul(edgeFalloff);

  // Return vec4: rgb = disk color with brightness, a = opacity with edge falloff
  const finalColor = diskColor.mul(uniforms.diskBrightness);
  return vec4(finalColor, finalOpacity);
});

// ============================================================================
// SECTION 4: MAIN RAYMARCHING SHADER
// ============================================================================

/**
 * Create the complete black hole raymarching shader.
 * @param {Object} uniforms - Shader uniforms object
 * @returns {Function} TSL shader function
 */
export function createBlackHoleShader(uniforms) {
  // Create shader functions that depend on uniforms
  const starField = createStarField(uniforms);
  const nebulaField = createNebulaField(uniforms);
  const accretionDiskColor = createAccretionDiskColor(uniforms);

  return Fn(() => {
    // === SCHWARZSCHILD PARAMETERS ===
    const rs = uniforms.blackHoleMass.mul(2.0);

    // === CAMERA SETUP ===
    const uv = screenUV.sub(0.5).mul(2.0);
    const aspect = uniforms.resolution.x.div(uniforms.resolution.y);
    const screenPos = vec2(uv.x.mul(aspect), uv.y);

    const camPos = uniforms.cameraPosition;
    const camTarget = uniforms.cameraTarget;

    // Build camera coordinate system
    const camForward = normalize(camTarget.sub(camPos));
    const worldUp = vec3(0.0, 1.0, 0.0);
    const camRight = normalize(cross(worldUp, camForward));
    const camUp = cross(camForward, camRight);

    // Generate ray direction through pixel
    const fov = float(1.0);
    const rayDir = normalize(
      camForward.mul(fov)
        .add(camRight.mul(screenPos.x))
        .add(camUp.mul(screenPos.y))
    ).toVar('rayDir');

    // === INITIALIZE RAY STATE ===
    const rayPos = camPos.toVar('rayPos');
    const prevPos = camPos.toVar('prevPos');

    // Accumulated color with alpha for blending
    const color = vec3(0.0, 0.0, 0.0).toVar('color');
    const alpha = float(0.0).toVar('alpha');

    // Ray status
    const escaped = float(0.0).toVar('escaped');
    const captured = float(0.0).toVar('captured');

    // Disk parameters
    const innerR = uniforms.diskInnerRadius;
    const outerR = uniforms.diskOuterRadius;

    // === RAYMARCHING LOOP ===
    Loop(64, () => {
      // Check if we've already terminated
      If(escaped.greaterThan(0.5).or(captured.greaterThan(0.5)).or(alpha.greaterThan(0.99)), () => {
        Break();
      });

      const r = length(rayPos);

      // === TERMINATION: CAPTURED BY BLACK HOLE ===
      If(r.lessThan(rs.mul(1.01)), () => {
        captured.assign(1.0);
        Break();
      });

      // === TERMINATION: ESCAPED TO INFINITY ===
      If(r.greaterThan(100.0), () => {
        escaped.assign(1.0);
        Break();
      });

      // === ADAPTIVE STEP SIZE ===
      // Reduce step size near event horizon for accurate bending
      const distFromHorizon = r.sub(rs);
      const horizonFactor = smoothstep(float(0.0), rs.mul(5.0), distFromHorizon)
        .mul(0.8).add(0.2);
      const adaptiveStep = uniforms.stepSize.mul(horizonFactor);

      // === GRAVITATIONAL LIGHT BENDING ===
      // Use r we already computed instead of calling normalize() again
      const toCenter = rayPos.negate().div(r);
      const bendStrength = rs.div(r.mul(r)).mul(adaptiveStep).mul(uniforms.gravitationalLensing);

      // Apply bending to ray direction
      rayDir.addAssign(toCenter.mul(bendStrength));
      rayDir.assign(normalize(rayDir));

      // Save previous position before stepping
      prevPos.assign(rayPos);

      // Step ray forward
      rayPos.addAssign(rayDir.mul(adaptiveStep));

      // === ANALYTIC DISK PLANE INTERSECTION ===
      // Detect when ray crosses the disk plane (Y = 0)
      const crossedPlane = prevPos.y.mul(rayPos.y).lessThan(0.0);

      If(crossedPlane.and(alpha.lessThan(0.99)), () => {
        // Compute exact intersection point using linear interpolation
        // t = -prevPos.y / (rayPos.y - prevPos.y)
        const t = prevPos.y.negate().div(rayPos.y.sub(prevPos.y));
        const hitPos = mix(prevPos, rayPos, t);

        // Radial distance from center at hit point
        const hitR = sqrt(hitPos.x.mul(hitPos.x).add(hitPos.z.mul(hitPos.z)));

        // Check if hit is within disk bounds
        const inDisk = hitR.greaterThan(innerR).and(hitR.lessThan(outerR));

        If(inDisk, () => {
          const hitAngle = atan(hitPos.z, hitPos.x);

          // Get disk color and opacity (includes edge falloff and turbulence)
          const diskResult = accretionDiskColor(hitR, hitAngle, uniforms.time);

          // Alpha blending (front-to-back compositing)
          const remainingAlpha = float(1.0).sub(alpha);
          color.addAssign(diskResult.xyz.mul(diskResult.w).mul(remainingAlpha));
          alpha.addAssign(remainingAlpha.mul(diskResult.w));
        });
      });
    });

    // After loop: if ray wasn't captured, it escaped
    If(captured.lessThan(0.5), () => {
      escaped.assign(1.0);
    });

    // === BACKGROUND (for escaped rays) ===
    If(escaped.greaterThan(0.5).and(alpha.lessThan(0.99)), () => {
      const bgColor = uniforms.starBackgroundColor.toVar('bgColor');

      // Add stars if enabled
      If(uniforms.starsEnabled.greaterThan(0.5), () => {
        const stars = starField(rayDir);
        bgColor.addAssign(stars);
      });

      // Add nebula if enabled
      If(uniforms.nebulaEnabled.greaterThan(0.5), () => {
        const nebula = nebulaField(rayDir);
        bgColor.addAssign(nebula);
      });

      // Blend background with accumulated disk color
      color.addAssign(bgColor.mul(float(1.0).sub(alpha)));
    });

    // === GAMMA CORRECTION ===
    const finalColor = pow(color, vec3(1.0 / 2.2));

    return vec4(finalColor, 1.0);
  })();
}
