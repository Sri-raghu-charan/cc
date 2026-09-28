# 3D CCTV Camera Coverage Planning System

A professional, Google Earth-style 3D geospatial CCTV camera placement, orientation, and coverage planning application built from scratch with **React**, **TypeScript**, **Vite**, **CesiumJS**, and **Turf.js**.

All camera coverage calculations, field-of-view (FOV) frustums, ground blind-spots, and DORI zones are computed using **real-world geodetic mathematics on the WGS84 ellipsoid** and physical metric distances — strictly invariant of screen pixels and map zoom levels.

---

## Quick Start (How to Run)

### Option A: As a Google Earth & Google Maps Browser Extension (Manifest V3)

The project includes a ready-to-load Manifest V3 browser extension that injects a non-blocking 3D CCTV planning workstation directly inside **Google Earth** (`earth.google.com`) and **Google Maps** (`google.com/maps`).

1. **Build the extension bundle:**
   ```bash
   npm run build:extension
   ```
   *(This outputs the unpacked extension in the `chromeexe/` directory).*

2. **Load into Google Chrome / Microsoft Edge / Brave:**
   - Open Chrome and navigate to `chrome://extensions/` (or `edge://extensions/`).
   - Turn **ON** **Developer mode** (toggle in the top-right corner).
   - Click the **"Load unpacked"** button.
   - Select the `chromeexe` folder inside your project directory (`/home/charan/Desktop/cc/chromeexe`).
   - The **"CCTV GeoPlanner - 3D Camera Coverage for Google Earth Web"** extension will appear in your toolbar!

3. **Use on Google Earth & Google Maps:**
   - Navigate to [Google Earth Web](https://earth.google.com/web/) or [Google Maps](https://www.google.com/maps).
   - The compact **CCTV Planner** floating bar floats above the map:
     ```text
     ┌──────────────────────────────┐
     │ CCTV Planner   ●  −  ×       │
     └──────────────────────────────┘
     ```
   - Drag the bar anywhere on screen from its header handle (it remembers its position).
   - Click **`+` (Add Camera)**: click anywhere on the Earth or map to drop a camera at that exact real-world coordinate.
   - Click **`Compass` (Street View)**: inspect real-world ground surroundings before finalizing camera mounting positions.
   - Native Google Earth navigation (pan, tilt, 3D rotate, zoom) works 100% unimpeded.

---

### Option B: As a Standalone 3D Cesium Web Application

1. **Start the interactive development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173/`.

2. **Run the automated geospatial test suite:**
   ```bash
   npx vitest run
   ```

4. **Build the optimized production bundle:**
   ```bash
   npm run build
   ```

---

## Key Features & Capabilities

### 1. 3D Globe & Map Accuracy (CesiumJS)
- **True Geodetic Ground Frustums**: Uses 3D ray-plane intersection and WGS84 geodesics (`computeDestination`, `computeBearing`, `computeDistance`).
- **Zoom Invariance**: Zooming out or panning never inflates or shrinks the physical ground footprint of the camera. The physical ground coordinates $(\text{lat}, \text{lon})$ are constant.
- **Multiple Basemap Providers Out-of-the-Box** (Zero API keys required):
  - **High-Resolution Satellite**: Esri World Imagery
  - **OpenStreetMap**: Standard street cartography
  - **Carto Dark Matter**: High-contrast dark engineering theme
  - **Carto Positron**: Clean architectural light theme
- **Optional Cesium Ion Integration**: Settings panel allows supplying a personal Cesium Ion token if desired to load Cesium World Terrain and 3D Photorealistic Tiles.
- **Global Address Geocoding**: Search bar connects to OpenStreetMap Nominatim or direct coordinates (e.g. `40.7580, -73.9855`) to fly directly to any site worldwide.

### 2. Verified Real-World Camera Models Catalog
Includes verified specifications from official manufacturer datasheets:
- **Axis Communications**: AXIS P1468-LE (4K Bullet), AXIS Q3538-LVE (4K Dome), AXIS M3088-V (Fixed Mini Dome), AXIS P3268-LVE (Varifocal Dome)
- **Hikvision**: DS-2CD2047G2-LU (ColorVu 4MP), DS-2CD2387G2-LU (ColorVu 8MP), DS-2CD2686G2-IZS (Motorized Varifocal Bullet), DS-2CD2143G2-IS (AcuSense Dome)
- **Dahua Technology**: IPC-HFW2431S-S-S2 (4MP Bullet), IPC-HDBW5842R-ASE (WizMind 8MP), IPC-HFW5442E-Z4E (Long-Range 8-32mm Zoom)
- **Hanwha Vision**: XNO-6080R (2MP Bullet), PNV-A9081R (4K AI Dome)
- **Bosch Security**: FLEXIDOME IP starlight 8000i, DINION IP 3000i IR
- **Custom Mode**: Manual configuration of sensor dimensions, focal lengths, HFOV/VFOV, and ranges for unlisted models.
- **Verification Badging**: Clearly marks verified manufacturer specs vs. user-configured estimates.

### 3. European Standard EN 62676-4 DORI Engine
Computes and visualizes standard security pixel-density zones:
- **Identification** ($250\text{ px/m}$ or $76\text{ px/ft}$) - Positive ID beyond reasonable doubt
- **Recognition** ($125\text{ px/m}$ or $38\text{ px/ft}$) - Known individual verification
- **Observation** ($62.5\text{ px/m}$ or $19\text{ px/ft}$) - Characteristic details and scene
- **Detection** ($25\text{ px/m}$ or $8\text{ px/ft}$) - Reliable human presence detection
- Individual DORI layers can be toggled independently.

### 4. Interactive Circular Compass Control
- $0^\circ = \text{North}$, $90^\circ = \text{East}$, $180^\circ = \text{South}$, $270^\circ = \text{West}$.
- Interactive rotary drag dial, quick cardinal jump buttons (N, E, S, W), and exact degree numerical input.
- Real-time rotation of the camera's directional indicator and ground footprint around its fixed geographic anchor.

### 5. Ground-Distance Movement Controls
- **Orthogonal Directions**: Forward (along heading $\theta$), Backward ($\theta + 180^\circ$), Right ($\theta + 90^\circ$), Left ($\theta - 90^\circ$).
- **Configurable Increments**: $0.1\text{m}$, $0.5\text{m}$, $1.0\text{m}$, $2.0\text{m}$, $5.0\text{m}$, $10.0\text{m}$, or custom user distance.
- **Undo Movement** and **Reset Origin** functions to revert to the initial drop point.

### 6. Coverage & Spatial Analysis
- **Ground Distance Readouts**: Near dead zone ($d_{\text{near}}$ under camera pole), far reach distance ($d_{\text{far}}$), far lateral width span, and total surface area ($m^2$).
- **Pairwise Overlap Detection**: Identifies intersecting camera footprints using Turf.js polygon clipping and calculates overlapping area in $m^2$.
- **Facility Planning Perimeter & Blind Spots**: Generates a facility perimeter and computes monitored percentage vs. unmonitored blind spots.
- **Engineering Line-of-Sight Disclaimer**: Distinguishes geometric line-of-sight from physical 3D structural obstructions.

### 7. Project Export / Import
- Export project planning setup as standard **JSON**.
- Export camera footprints and locations as GIS-ready **GeoJSON**.
- Import saved planning sessions.

---

## Project Structure

```
d:/files/
├── src/
│   ├── components/
│   │   ├── Analysis/
│   │   │   └── CoverageAnalysisPanel.tsx # Overlaps, DORI toggles, blind spots
│   │   ├── Compass/
│   │   │   └── CircularCompass.tsx       # Rotary compass (0° N, 90° E, 180° S, 270° W)
│   │   ├── Header/
│   │   │   └── Header.tsx                # Location search, basemap selector, add camera
│   │   ├── Inspector/
│   │   │   └── CameraInspector.tsx       # Model picker, height, tilt, FOV, metrics
│   │   ├── Map/
│   │   │   └── CesiumMap.tsx             # Cesium 3D Globe, frustums, sightlines, DORI
│   │   ├── Movement/
│   │   │   └── GroundMovementControls.tsx # Forward/Back/Left/Right ground distance steps
│   │   ├── Settings/
│   │   │   └── SettingsModal.tsx         # Cesium Ion token & standards info
│   │   └── Sidebar/
│   │       ├── CameraList.tsx            # Multi-camera list, duplicate, import/export
│   │       └── Sidebar.tsx               # Tabbed sidebar container
│   ├── context/
│   │   └── CctvContext.tsx               # Centralized React state management
│   ├── data/
│   │   └── cameraModels.ts               # Verified manufacturer specs catalog
│   ├── geo/
│   │   ├── __tests__/
│   │   │   └── geoEngine.test.ts         # 12 automated unit tests
│   │   ├── analysis.ts                   # Overlaps & blind spot calculations
│   │   ├── coordinates.ts                # WGS84 geodesics (destination, distance, bearing)
│   │   ├── dori.ts                       # EN 62676-4 DORI standard calculations
│   │   ├── frustum.ts                    # 3D perspective ground ray-casting
│   │   └── movement.ts                   # Ground distance movement & history
│   ├── styles/
│   │   └── theme.css                     # Dark glassmorphic engineering design system
│   ├── types/
│   │   └── camera.ts                     # TypeScript data contracts
│   ├── App.tsx                           # Main application layout
│   └── main.tsx                          # React entrypoint
├── index.html                            # HTML5 root with Google Fonts & metadata
├── package.json                          # Dependencies and scripts
├── tsconfig.json                         # TypeScript configuration
└── vite.config.ts                        # Vite & Cesium plugin configuration
```

---

## Map Services & API Keys Configuration

- **Default Imagery Providers**: No API key is required. The app defaults to **Esri World Satellite Imagery**, **OpenStreetMap**, and **CartoDB**.
- **Cesium Ion Token (Optional)**:
  - If you have an account at [cesium.com](https://cesium.com), click the **Settings icon** (⚙️) in the top-right header and paste your Cesium Ion access token.
  - The token is securely stored in your browser's local storage.
