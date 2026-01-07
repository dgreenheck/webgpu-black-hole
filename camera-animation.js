/**
 * Cinematic Camera Animation System
 *
 * Creates smooth, professional camera movements for showcasing the black hole.
 * Uses keyframe-based animation with cosine interpolation for buttery-smooth motion.
 */

import * as THREE from 'three/webgpu';

/**
 * Catmull-Rom spline interpolation for smooth continuous curves.
 * Unlike per-segment easing, this creates fluid motion without pauses at waypoints.
 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Cinematic keyframes for the camera animation.
 * Each keyframe defines a camera state at a specific point in the animation.
 */
const cinematicKeyframes = [
  // 1. Wide shot from above
  { position: { x: 0, y: -3, z: 20 }, target: { x: 0, y: 0, z: 0 }, duration: 5 },

  // 2. Rotate around, begin rising
  { position: { x: 15, y: -5, z: 12 }, target: { x: 0, y: 0, z: 0 }, duration: 4 },

  // More top-down, continuing orbit
  { position: { x: 10, y: -18, z: -10 }, target: { x: 0, y: 0, z: 0 }, duration: 4 },

  // 3. Swing back down to wide shot
  { position: { x: -5, y: -6, z: -24 }, target: { x: 0, y: 0, z: 0 }, duration: 3 },

  // Wide shot, begin zoom in
  { position: { x: -5, y: -1, z: -20 }, target: { x: 0, y: 0, z: 0 }, duration: 12 },

  // Zooming in closer
  { position: { x: 5, y: -1, z: 0 }, target: { x: 0, y: 0, z: 0 }, duration: 0 },
];

/**
 * CameraAnimation class handles smooth cinematic camera movements.
 */
export class CameraAnimation {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.keyframes = cinematicKeyframes;

    // Animation state
    this.isPlaying = false;
    this.currentTime = 0;
    this.totalDuration = this.calculateTotalDuration();

    // Interpolation vectors (reused to avoid allocations)
    this.tempPosition = new THREE.Vector3();
    this.tempTarget = new THREE.Vector3();

    // Store original camera state for restoration
    this.originalPosition = new THREE.Vector3();
    this.originalTarget = new THREE.Vector3();
  }

  /**
   * Calculate the total duration of all keyframes
   */
  calculateTotalDuration() {
    return this.keyframes.reduce((sum, kf) => sum + kf.duration, 0);
  }

  /**
   * Get keyframe by index with wrapping for seamless looping
   */
  getKeyframe(index) {
    const len = this.keyframes.length;
    return this.keyframes[((index % len) + len) % len];
  }

  /**
   * Start the camera animation
   */
  start() {
    if (this.isPlaying) return;

    // Store current camera state
    this.originalPosition.copy(this.camera.position);
    this.originalTarget.copy(this.controls.target);

    // Disable user controls during animation
    this.controls.enabled = false;

    this.isPlaying = true;
    this.currentTime = 0;
  }

  /**
   * Stop the camera animation and restore controls
   */
  stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Re-enable user controls
    this.controls.enabled = true;

    // Smoothly restore to current position (don't snap back)
    this.controls.target.copy(this.tempTarget);
  }

  /**
   * Toggle animation on/off
   */
  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  /**
   * Get the current keyframe index and local time within that keyframe
   */
  getKeyframeInfo(globalTime) {
    let accumulatedTime = 0;

    for (let i = 0; i < this.keyframes.length; i++) {
      const kf = this.keyframes[i];
      if (globalTime < accumulatedTime + kf.duration) {
        return {
          index: i,
          localTime: globalTime - accumulatedTime,
          duration: kf.duration
        };
      }
      accumulatedTime += kf.duration;
    }

    // Return last keyframe if we've exceeded duration
    const lastIndex = this.keyframes.length - 1;
    return {
      index: lastIndex,
      localTime: this.keyframes[lastIndex].duration,
      duration: this.keyframes[lastIndex].duration
    };
  }

  /**
   * Interpolate using Catmull-Rom spline for smooth continuous motion
   */
  interpolateSpline(index, t) {
    // Get 4 control points for Catmull-Rom: p0, p1, p2, p3
    const p0 = this.getKeyframe(index - 1);
    const p1 = this.getKeyframe(index);
    const p2 = this.getKeyframe(index + 1);
    const p3 = this.getKeyframe(index + 2);

    // Interpolate position using Catmull-Rom
    this.tempPosition.set(
      catmullRom(p0.position.x, p1.position.x, p2.position.x, p3.position.x, t),
      catmullRom(p0.position.y, p1.position.y, p2.position.y, p3.position.y, t),
      catmullRom(p0.position.z, p1.position.z, p2.position.z, p3.position.z, t)
    );

    // Interpolate target using Catmull-Rom
    this.tempTarget.set(
      catmullRom(p0.target.x, p1.target.x, p2.target.x, p3.target.x, t),
      catmullRom(p0.target.y, p1.target.y, p2.target.y, p3.target.y, t),
      catmullRom(p0.target.z, p1.target.z, p2.target.z, p3.target.z, t)
    );
  }

  /**
   * Update the animation (call every frame)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.isPlaying) return;

    // Advance time
    this.currentTime += deltaTime;

    // Loop the animation
    if (this.currentTime >= this.totalDuration) {
      this.currentTime = this.currentTime % this.totalDuration;
    }

    // Get current keyframe info
    const info = this.getKeyframeInfo(this.currentTime);

    // Calculate normalized time within current segment
    const t = info.localTime / info.duration;

    // Interpolate using Catmull-Rom spline for smooth continuous motion
    this.interpolateSpline(info.index, t);

    // Apply to camera
    this.camera.position.copy(this.tempPosition);
    this.controls.target.copy(this.tempTarget);
    this.camera.lookAt(this.tempTarget);
  }

  /**
   * Get current animation progress (0-1)
   */
  getProgress() {
    return this.currentTime / this.totalDuration;
  }

  /**
   * Check if animation is currently playing
   */
  get playing() {
    return this.isPlaying;
  }
}
