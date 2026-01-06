# WebGPU Black Hole

A real-time black hole visualization using WebGPU, Three.js, and TSL (Three.js Shading Language). Features physically-inspired gravitational lensing, an accretion disk with blackbody radiation coloring, and procedural backgrounds.

## Features

- **Gravitational Lensing** - Raymarched light bending around a Schwarzschild black hole
- **Accretion Disk** - Temperature-based blackbody coloring with Keplerian differential rotation
- **Turbulence Patterns** - FBM noise creates organic arc structures with cyclic animation
- **Procedural Background** - Starfield and nebula clouds generated in the shader
- **Bloom Post-Processing** - HDR bloom for enhanced glow effects
- **Real-time Controls** - Tweakpane UI for adjusting all parameters

## Live Demo

Visit: https://dgreenheck.github.io/webgpu-galaxy/

## Requirements

- Browser with WebGPU support (Chrome 113+, Edge 113+)
- GPU with WebGPU capabilities

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Controls

- **Left Mouse Drag** - Orbit camera
- **Right Mouse Drag** - Pan camera
- **Mouse Wheel** - Zoom in/out
- **Right Panel** - Adjust parameters

## Parameters

### Black Hole
- Mass and gravitational lensing strength
- Disk geometry (inner/outer radius)
- Disk appearance (temperature, brightness, opacity)
- Turbulence (scale, stretch, rotation speed, cycle time)

### Background
- Star density, size, and brightness
- Nebula layers with independent colors and density

### Post-Processing
- Bloom strength, radius, and threshold

## Technical Details

The simulation uses a raymarching approach to trace light paths through curved spacetime around a Schwarzschild (non-rotating) black hole. Key techniques:

- **Adaptive step size** near the event horizon for accurate light bending
- **Analytic disk intersection** for efficient accretion disk rendering
- **Cyclic time crossfade** prevents differential rotation from winding turbulence indefinitely
- **Blackbody radiation** approximation for physically-motivated disk colors

## License

MIT

## Acknowledgments

Built with [Three.js](https://threejs.org/) and [WebGPU](https://www.w3.org/TR/webgpu/)
