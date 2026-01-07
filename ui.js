/**
 * UI Controls for Black Hole Simulation
 *
 * Uses Tweakpane for real-time parameter adjustment.
 * Organized into logical folders matching the simulation components.
 */

import { Pane } from 'tweakpane';

export class BlackHoleUI {
  constructor(config, callbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.pane = new Pane({ title: 'Black Hole Controls' });
    this.bloomPassNode = null;
    this.perfParams = { fps: 60 };

    this.setupUI();
  }

  setupUI() {
    this.setupCameraFolder();
    this.setupConfigFolder();
    this.setupPerformanceFolder();
    this.setupBlackHoleFolder();
    this.setupStarsFolder();
    this.setupNebulaFolder();
    this.setupBloomFolder();
  }

  // ==========================================================================
  // CAMERA ANIMATION
  // ==========================================================================

  setupCameraFolder() {
    const cameraFolder = this.pane.addFolder({
      title: 'Camera',
      expanded: true
    });

    // Animation state tracking
    this.cameraAnimState = { playing: false };

    // Toggle button for cinematic animation
    this.animButton = cameraFolder.addButton({
      title: 'Start Cinematic Mode'
    }).on('click', () => {
      const isPlaying = this.callbacks.onToggleCameraAnimation?.();
      this.cameraAnimState.playing = isPlaying;
      this.animButton.title = isPlaying ? 'Stop Cinematic Mode' : 'Start Cinematic Mode';
      if (isPlaying) {
        this.showNotification('Cinematic mode started - enjoy the show!');
      } else {
        this.showNotification('Cinematic mode stopped');
      }
    });

    // Info text
    cameraFolder.addBlade({
      view: 'text',
      label: '',
      parse: (v) => String(v),
      value: 'Smooth camera flythrough'
    });
  }

  // ==========================================================================
  // CONFIGURATION MANAGEMENT
  // ==========================================================================

  setupConfigFolder() {
    const configFolder = this.pane.addFolder({
      title: 'Save/Load',
      expanded: true
    });

    // Button params (Tweakpane buttons need a dummy object)
    const buttonParams = {
      save: () => {
        this.callbacks.onSaveConfig?.();
        this.showNotification('Settings saved!');
      },
      clear: () => {
        if (confirm('Clear saved settings and reload with defaults?')) {
          this.callbacks.onClearConfig?.();
        }
      },
      reset: () => {
        if (confirm('Reset all settings to defaults?')) {
          this.callbacks.onResetToDefaults?.();
          this.pane.refresh();
          this.showNotification('Reset to defaults');
        }
      }
    };

    configFolder.addButton({
      title: 'Save Settings'
    }).on('click', buttonParams.save);

    configFolder.addButton({
      title: 'Clear & Reload'
    }).on('click', buttonParams.clear);

    configFolder.addButton({
      title: 'Reset to Defaults'
    }).on('click', buttonParams.reset);
  }

  /**
   * Show a temporary notification message.
   */
  showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #0f0;
      padding: 12px 24px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);

    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 1500);
  }

  // ==========================================================================
  // PERFORMANCE CONTROLS
  // ==========================================================================

  setupPerformanceFolder() {
    const perfFolder = this.pane.addFolder({ title: 'Performance' });

    // FPS monitor
    perfFolder.addBinding(this.perfParams, 'fps', {
      readonly: true,
      label: 'FPS'
    });
  }

  // ==========================================================================
  // BLACK HOLE & ACCRETION DISK
  // ==========================================================================

  setupBlackHoleFolder() {
    const bhFolder = this.pane.addFolder({ title: 'Black Hole' });

    bhFolder.addBinding(this.config, 'blackHoleMass', {
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Mass'
    }).on('change', () => {
      this.callbacks.onUniformChange('blackHoleMass', this.config.blackHoleMass);
    });

    bhFolder.addBinding(this.config, 'gravitationalLensing', {
      min: 0.5,
      max: 3.0,
      step: 0.1,
      label: 'Grav. Lensing'
    }).on('change', () => {
      this.callbacks.onUniformChange('gravitationalLensing', this.config.gravitationalLensing);
    });

    bhFolder.addBinding(this.config, 'dopplerStrength', {
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: 'Doppler Beaming'
    }).on('change', () => {
      this.callbacks.onUniformChange('dopplerStrength', this.config.dopplerStrength);
    });

    // === Disk Geometry ===
    const geometryFolder = bhFolder.addFolder({
      title: 'Geometry',
      expanded: false
    });

    geometryFolder.addBinding(this.config, 'diskInnerRadius', {
      min: 2.0,
      max: 5.0,
      step: 0.1,
      label: 'Inner Radius'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskInnerRadius', this.config.diskInnerRadius);
    });

    geometryFolder.addBinding(this.config, 'diskOuterRadius', {
      min: 6.0,
      max: 20.0,
      step: 0.5,
      label: 'Outer Radius'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskOuterRadius', this.config.diskOuterRadius);
    });

    // === Disk Appearance ===
    const appearanceFolder = bhFolder.addFolder({
      title: 'Appearance',
      expanded: true
    });

    appearanceFolder.addBinding(this.config, 'diskBrightness', {
      min: 0.5,
      max: 5.0,
      step: 0.1,
      label: 'Brightness'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskBrightness', this.config.diskBrightness);
    });

    appearanceFolder.addBinding(this.config, 'diskTemperature', {
      min: 1,
      max: 50,
      step: 1,
      label: 'Peak Temp (kK)',
      format: (v) => `${v.toFixed(0)}k K`
    }).on('change', () => {
      this.callbacks.onUniformChange('diskTemperature', this.config.diskTemperature);
    });

    appearanceFolder.addBinding(this.config, 'temperatureFalloff', {
      min: 0.25,
      max: 15.0,
      step: 0.01,
      label: 'Temp Falloff'
    }).on('change', () => {
      this.callbacks.onUniformChange('temperatureFalloff', this.config.temperatureFalloff);
    });

    appearanceFolder.addBinding(this.config, 'diskEdgeSoftnessInner', {
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Inner Softness'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskEdgeSoftnessInner', this.config.diskEdgeSoftnessInner);
    });

    appearanceFolder.addBinding(this.config, 'diskEdgeSoftnessOuter', {
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Outer Softness'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskEdgeSoftnessOuter', this.config.diskEdgeSoftnessOuter);
    });

    // === Turbulence Pattern ===
    const turbulenceFolder = bhFolder.addFolder({
      title: 'Turbulence',
      expanded: true
    });

    turbulenceFolder.addBinding(this.config, 'turbulenceScale', {
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Scale'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulenceScale', this.config.turbulenceScale);
    });

    turbulenceFolder.addBinding(this.config, 'turbulenceStretch', {
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Arc Stretch'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulenceStretch', this.config.turbulenceStretch);
    });

    turbulenceFolder.addBinding(this.config, 'turbulenceSharpness', {
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: 'Sharpness'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulenceSharpness', this.config.turbulenceSharpness);
    });

    turbulenceFolder.addBinding(this.config, 'diskRotationSpeed', {
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Rotation Speed'
    }).on('change', () => {
      this.callbacks.onUniformChange('diskRotationSpeed', this.config.diskRotationSpeed);
    });

    turbulenceFolder.addBinding(this.config, 'turbulenceCycleTime', {
      min: 5.0,
      max: 30.0,
      step: 1.0,
      label: 'Cycle Time (s)'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulenceCycleTime', this.config.turbulenceCycleTime);
    });

    turbulenceFolder.addBinding(this.config, 'turbulenceLacunarity', {
      min: 1.0,
      max: 4.0,
      step: 0.1,
      label: 'Lacunarity'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulenceLacunarity', this.config.turbulenceLacunarity);
    });

    turbulenceFolder.addBinding(this.config, 'turbulencePersistence', {
      min: 0.1,
      max: 1.0,
      step: 0.05,
      label: 'Persistence'
    }).on('change', () => {
      this.callbacks.onUniformChange('turbulencePersistence', this.config.turbulencePersistence);
    });
  }

  // ==========================================================================
  // STARS
  // ==========================================================================

  setupStarsFolder() {
    const starsFolder = this.pane.addFolder({
      title: 'Stars',
      expanded: false
    });

    starsFolder.addBinding(this.config, 'starsEnabled', {
      label: 'Enable Stars'
    }).on('change', () => {
      this.callbacks.onUniformChange('starsEnabled', this.config.starsEnabled);
    });

    starsFolder.addBinding(this.config, 'starBackgroundColor', {
      label: 'Background'
    }).on('change', () => {
      this.callbacks.onUniformChange('starBackgroundColor', this.config.starBackgroundColor);
    });

    starsFolder.addBinding(this.config, 'starDensity', {
      min: 0.001,
      max: 0.1,
      step: 0.001,
      label: 'Density'
    }).on('change', () => {
      this.callbacks.onUniformChange('starDensity', this.config.starDensity);
    });

    starsFolder.addBinding(this.config, 'starSize', {
      min: 0.5,
      max: 5.0,
      step: 0.1,
      label: 'Size'
    }).on('change', () => {
      this.callbacks.onUniformChange('starSize', this.config.starSize);
    });

    starsFolder.addBinding(this.config, 'starBrightness', {
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Brightness'
    }).on('change', () => {
      this.callbacks.onUniformChange('starBrightness', this.config.starBrightness);
    });
  }

  // ==========================================================================
  // NEBULA
  // ==========================================================================

  setupNebulaFolder() {
    const nebulaFolder = this.pane.addFolder({
      title: 'Nebula',
      expanded: false
    });

    nebulaFolder.addBinding(this.config, 'nebulaEnabled', {
      label: 'Enable Nebula'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebulaEnabled', this.config.nebulaEnabled);
    });

    // Layer 1 subfolder
    const layer1Folder = nebulaFolder.addFolder({
      title: 'Layer 1',
      expanded: false
    });

    layer1Folder.addBinding(this.config, 'nebula1Scale', {
      min: 0.5,
      max: 10.0,
      step: 0.5,
      label: 'Scale'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula1Scale', this.config.nebula1Scale);
    });

    layer1Folder.addBinding(this.config, 'nebula1Density', {
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Density'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula1Density', this.config.nebula1Density);
    });

    layer1Folder.addBinding(this.config, 'nebula1Brightness', {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Brightness'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula1Brightness', this.config.nebula1Brightness);
    });

    layer1Folder.addBinding(this.config, 'nebula1Color', {
      label: 'Color'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula1Color', this.config.nebula1Color);
    });

    // Layer 2 subfolder
    const layer2Folder = nebulaFolder.addFolder({
      title: 'Layer 2',
      expanded: false
    });

    layer2Folder.addBinding(this.config, 'nebula2Scale', {
      min: 0.5,
      max: 20.0,
      step: 0.5,
      label: 'Scale'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula2Scale', this.config.nebula2Scale);
    });

    layer2Folder.addBinding(this.config, 'nebula2Density', {
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Density'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula2Density', this.config.nebula2Density);
    });

    layer2Folder.addBinding(this.config, 'nebula2Brightness', {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Brightness'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula2Brightness', this.config.nebula2Brightness);
    });

    layer2Folder.addBinding(this.config, 'nebula2Color', {
      label: 'Color'
    }).on('change', () => {
      this.callbacks.onUniformChange('nebula2Color', this.config.nebula2Color);
    });
  }

  // ==========================================================================
  // BLOOM POST-PROCESSING
  // ==========================================================================

  setupBloomFolder() {
    const bloomFolder = this.pane.addFolder({ title: 'Bloom' });

    bloomFolder.addBinding(this.config, 'bloomStrength', {
      min: 0,
      max: 3,
      step: 0.01,
      label: 'Strength'
    }).on('change', () => {
      this.callbacks.onBloomChange('strength', this.config.bloomStrength);
    });

    bloomFolder.addBinding(this.config, 'bloomRadius', {
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Radius'
    }).on('change', () => {
      this.callbacks.onBloomChange('radius', this.config.bloomRadius);
    });

    bloomFolder.addBinding(this.config, 'bloomThreshold', {
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Threshold'
    }).on('change', () => {
      this.callbacks.onBloomChange('threshold', this.config.bloomThreshold);
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  updateFPS(fps) {
    this.perfParams.fps = fps;
    this.pane.refresh();
  }

  setBloomNode(bloomNode) {
    this.bloomPassNode = bloomNode;
  }
}
