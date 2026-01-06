/**
 * ============================================================================
 * BLACK HOLE SIMULATION WITH RAYMARCHED GRAVITATIONAL LENSING
 * ============================================================================
 *
 * This simulation renders a Schwarzschild (non-rotating) black hole with:
 * - Gravitational lensing of light rays through curved spacetime
 * - Accretion disk with temperature-based coloring and turbulence
 * - Doppler beaming (relativistic brightness variation)
 * - Procedural star field and nebula background
 * - Photon ring at the critical impact parameter
 *
 * The code is organized pedagogically for use in a blog post explaining
 * the physics and implementation of black hole rendering.
 *
 * @author Daniel Greenheck
 * @see BLOG.md for detailed explanation
 */

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createBlackHoleShader } from './blackhole-shader.js';

// ============================================================================
// SECTION 1: PHYSICAL CONSTANTS AND CONFIGURATION
// ============================================================================

/**
 * Quality presets for balancing visual quality vs performance.
 * These control the raymarching parameters.
 */
export const QUALITY_PRESETS = {
  low: {
    stepSize: 0.4,
    starsEnabled: false,
    nebulaEnabled: false
  },
  medium: {
    stepSize: 0.3,
    starsEnabled: true,
    nebulaEnabled: false
  },
  high: {
    stepSize: 0.2,
    starsEnabled: true,
    nebulaEnabled: true
  },
  ultra: {
    stepSize: 0.15,
    starsEnabled: true,
    nebulaEnabled: true
  }
};

// ============================================================================
// SECTION 2: BLACK HOLE SIMULATION CLASS
// ============================================================================

export class BlackHoleSimulation {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.blackHoleMesh = null;
    this.initializeUniforms(config);
  }

  /**
   * Initialize all shader uniforms with default values.
   * These can be updated in real-time via the UI.
   */
  initializeUniforms(config) {
    this.uniforms = {
      // === Physics ===
      blackHoleMass: uniform(config.blackHoleMass ?? 1.0),

      // === Accretion Disk Geometry ===
      // Inner radius constrained to ISCO (Innermost Stable Circular Orbit)
      // For Schwarzschild black hole: ISCO = 3 × rs (where rs = 2M = 2.0 in our units)
      diskInnerRadius: uniform(config.diskInnerRadius ?? 3.0),
      diskOuterRadius: uniform(config.diskOuterRadius ?? 12.0),

      // === Accretion Disk Appearance ===
      // Peak temperature in thousands of Kelvin (at inner edge)
      // Typical values: 5-50 (5,000K - 50,000K)
      diskTemperature: uniform(config.diskTemperature ?? 10.0),
      // Temperature falloff exponent: 0.75 = physical (Shakura-Sunyaev), higher = steeper
      temperatureFalloff: uniform(config.temperatureFalloff ?? 0.75),
      diskBrightness: uniform(config.diskBrightness ?? 2.0),
      diskRotationSpeed: uniform(config.diskRotationSpeed ?? 0.3),

      // === Turbulence Pattern Controls ===
      turbulenceScale: uniform(config.turbulenceScale ?? 1.0),
      turbulenceStretch: uniform(config.turbulenceStretch ?? 5.0),
      turbulenceBrightness: uniform(config.turbulenceBrightness ?? 0.3),
      turbulenceSharpness: uniform(config.turbulenceSharpness ?? 1.0),
      turbulenceCycleTime: uniform(config.turbulenceCycleTime ?? 10.0),

      // === Disk Edge Falloff ===
      diskEdgeSoftnessInner: uniform(config.diskEdgeSoftnessInner ?? 0.15),
      diskEdgeSoftnessOuter: uniform(config.diskEdgeSoftnessOuter ?? 0.15),

      // === Relativistic Effects ===
      gravitationalLensing: uniform(config.gravitationalLensing ?? 1.5),

      // === Disk Opacity ===
      diskDensity: uniform(config.diskDensity ?? 0.25),

      // === Performance ===
      stepSize: uniform(config.stepSize ?? 0.3),

      // === Stars ===
      starsEnabled: uniform(config.starsEnabled ? 1.0 : 0.0),
      starBackgroundColor: uniform(new THREE.Color(config.starBackgroundColor ?? '#000000')),
      starDensity: uniform(config.starDensity ?? 0.003),
      starSize: uniform(config.starSize ?? 2.0),
      starBrightness: uniform(config.starBrightness ?? 1.0),

      // === Nebula Layer 1 ===
      nebulaEnabled: uniform(config.nebulaEnabled ? 1.0 : 0.0),
      nebula1Scale: uniform(config.nebula1Scale ?? 2.0),
      nebula1Density: uniform(config.nebula1Density ?? 0.5),
      nebula1Brightness: uniform(config.nebula1Brightness ?? 0.15),
      nebula1Color: uniform(new THREE.Color(config.nebula1Color ?? '#1a0033')),

      // === Nebula Layer 2 ===
      nebula2Scale: uniform(config.nebula2Scale ?? 6.0),
      nebula2Density: uniform(config.nebula2Density ?? 0.5),
      nebula2Brightness: uniform(config.nebula2Brightness ?? 0.15),
      nebula2Color: uniform(new THREE.Color(config.nebula2Color ?? '#4d1a26')),

      // === Animation State ===
      time: uniform(0),

      // === Camera ===
      resolution: uniform(new THREE.Vector2(window.innerWidth, window.innerHeight)),
      cameraPosition: uniform(new THREE.Vector3(0, 5, 20)),
      cameraTarget: uniform(new THREE.Vector3(0, 0, 0))
    };
  }

  /**
   * Create the black hole visualization mesh.
   * Uses a large inverted sphere as the render surface with a custom TSL shader.
   */
  createBlackHole() {
    // Clean up existing mesh
    if (this.blackHoleMesh) {
      this.scene.remove(this.blackHoleMesh);
      this.blackHoleMesh.material?.dispose();
      this.blackHoleMesh.geometry?.dispose();
    }

    // Create inverted sphere geometry (renders from inside)
    const geometry = new THREE.SphereGeometry(100, 32, 32);
    geometry.scale(-1, 1, 1);

    // Create material with our raymarching shader
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = this.createRaymarchingShader();

    this.blackHoleMesh = new THREE.Mesh(geometry, material);
    this.blackHoleMesh.frustumCulled = false;
    this.scene.add(this.blackHoleMesh);
  }

  /**
   * Main shader creation method.
   * Builds the complete raymarching shader using Three.js TSL.
   */
  createRaymarchingShader() {
    return createBlackHoleShader(this.uniforms);
  }

  // ==========================================================================
  // SECTION 7: PUBLIC API
  // ==========================================================================

  /**
   * Update uniform values from config object.
   * Called when UI controls change.
   */
  updateUniforms(config) {
    const u = this.uniforms;

    // Physics
    if (config.blackHoleMass !== undefined) u.blackHoleMass.value = config.blackHoleMass;

    // Disk geometry
    if (config.diskInnerRadius !== undefined) u.diskInnerRadius.value = config.diskInnerRadius;
    if (config.diskOuterRadius !== undefined) u.diskOuterRadius.value = config.diskOuterRadius;

    // Disk appearance
    if (config.diskTemperature !== undefined) u.diskTemperature.value = config.diskTemperature;
    if (config.temperatureFalloff !== undefined) u.temperatureFalloff.value = config.temperatureFalloff;
    if (config.diskBrightness !== undefined) u.diskBrightness.value = config.diskBrightness;
    if (config.diskRotationSpeed !== undefined) u.diskRotationSpeed.value = config.diskRotationSpeed;

    // Turbulence pattern
    if (config.turbulenceScale !== undefined) u.turbulenceScale.value = config.turbulenceScale;
    if (config.turbulenceStretch !== undefined) u.turbulenceStretch.value = config.turbulenceStretch;
    if (config.turbulenceBrightness !== undefined) u.turbulenceBrightness.value = config.turbulenceBrightness;
    if (config.turbulenceSharpness !== undefined) u.turbulenceSharpness.value = config.turbulenceSharpness;
    if (config.turbulenceCycleTime !== undefined) u.turbulenceCycleTime.value = config.turbulenceCycleTime;

    // Disk edge falloff
    if (config.diskEdgeSoftnessInner !== undefined) u.diskEdgeSoftnessInner.value = config.diskEdgeSoftnessInner;
    if (config.diskEdgeSoftnessOuter !== undefined) u.diskEdgeSoftnessOuter.value = config.diskEdgeSoftnessOuter;

    // Relativistic effects
    if (config.gravitationalLensing !== undefined) u.gravitationalLensing.value = config.gravitationalLensing;

    // Disk opacity
    if (config.diskDensity !== undefined) u.diskDensity.value = config.diskDensity;

    // Performance
    if (config.stepSize !== undefined) u.stepSize.value = config.stepSize;

    // Star uniforms
    if (config.starsEnabled !== undefined) u.starsEnabled.value = config.starsEnabled ? 1.0 : 0.0;
    if (config.starBackgroundColor !== undefined) u.starBackgroundColor.value.set(config.starBackgroundColor);
    if (config.starDensity !== undefined) u.starDensity.value = config.starDensity;
    if (config.starSize !== undefined) u.starSize.value = config.starSize;
    if (config.starBrightness !== undefined) u.starBrightness.value = config.starBrightness;

    // Nebula Layer 1 uniforms
    if (config.nebulaEnabled !== undefined) u.nebulaEnabled.value = config.nebulaEnabled ? 1.0 : 0.0;
    if (config.nebula1Scale !== undefined) u.nebula1Scale.value = config.nebula1Scale;
    if (config.nebula1Density !== undefined) u.nebula1Density.value = config.nebula1Density;
    if (config.nebula1Brightness !== undefined) u.nebula1Brightness.value = config.nebula1Brightness;
    if (config.nebula1Color !== undefined) u.nebula1Color.value.set(config.nebula1Color);

    // Nebula Layer 2 uniforms
    if (config.nebula2Scale !== undefined) u.nebula2Scale.value = config.nebula2Scale;
    if (config.nebula2Density !== undefined) u.nebula2Density.value = config.nebula2Density;
    if (config.nebula2Brightness !== undefined) u.nebula2Brightness.value = config.nebula2Brightness;
    if (config.nebula2Color !== undefined) u.nebula2Color.value.set(config.nebula2Color);

    // Note: Disk color is computed from blackbody radiation (no color uniforms needed)
  }

  /**
   * Apply a quality preset.
   */
  applyQualityPreset(presetName) {
    const preset = QUALITY_PRESETS[presetName];
    if (!preset) return;

    this.updateUniforms({
      stepSize: preset.stepSize,
      starsEnabled: preset.starsEnabled,
      nebulaEnabled: preset.nebulaEnabled
    });
  }

  /**
   * Update camera position uniform from Three.js camera.
   */
  updateCamera(camera) {
    this.uniforms.cameraPosition.value.copy(camera.position);

    // Calculate camera target from view direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    const target = camera.position.clone().add(direction.multiplyScalar(10));
    this.uniforms.cameraTarget.value.copy(target);
  }

  /**
   * Main update method - called each frame.
   */
  update(deltaTime, camera) {
    this.uniforms.time.value += deltaTime;
    this.updateCamera(camera);
  }

  /**
   * Handle window resize.
   */
  onResize(width, height) {
    this.uniforms.resolution.value.set(width, height);
  }

  /**
   * Regenerate the black hole mesh (e.g., after config changes).
   */
  regenerate() {
    this.createBlackHole();
  }
}
