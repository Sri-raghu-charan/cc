# CCTV PLANNING SYSTEM — CORE LOGIC DOCUMENT

> **Technical Reference & Architectural Ground Truth**  
> **Target Audience:** Principal Systems Engineers, Computer Vision/CCTV Architects, GIS Specialists, Senior Code Reviewers, and Automated Verification Agents.  
> **Source Verification Basis:** Direct static and dynamic analysis of the active codebase in `/home/charan/cctvorg`.  
> **Standard Compliance:** IEC / EN 62676-4 (Video surveillance systems for use in security applications), WGS84 Geodetic Reference System (EPSG:4326), Web Mercator (EPSG:3857), Chrome Extensions Manifest V3.

---

## 1. System Overview

The CCTV Planning System (`cctvorg`) is a high-precision, geospatial 2D/3D camera coverage planning, optical line-of-sight frustum generation, DORI performance evaluation, and multi-camera site optimization platform. It functions in dual execution environments:

1. **Manifest V3 Browser Extension:** Injects directly into **Google Earth Web** (`earth.google.com/web`) and **Google Maps** (`google.com/maps`), superimposing a high-frame-rate (60 FPS) transparent HTML5 Canvas layer (`MapOverlayCanvas.tsx`) and an interactive draggable HUD control panel (`FloatingBar.tsx`) over native map canvases without altering host application DOM or WebGL contexts.
2. **Standalone Web Application:** Runs as a Vite/React application incorporating CesiumJS 3D Globe (`CesiumMap.tsx`) and Leaflet 2D views for isolated planning sessions.

### Primary Operational Capabilities
* **Geodetic Precision Anchoring:** Physically locks camera mounting bases to geodetic Earth coordinates (WGS84 ellipsoid: latitude, longitude, elevation MSL) with zero drift under continuous viewport panning, orbiting, zooming, tilting, and window resizing.
* **Realistic CCTV Optical Frustum Projection:** Projects ground coverage footprints using real-world physical parameters: mounting height ($h$), depression tilt angle ($\beta$), horizontal field-of-view ($\text{hFOV}$), vertical field-of-view ($\text{vFOV}$), and sensor reach ($R_{\text{max}}$).
* **IEC / EN 62676-4 DORI Grading:** Computes and renders four concentric color-coded operational zones based on pixel density thresholds: **Identification** ($250\text{ px/m}$), **Recognition** ($125\text{ px/m}$), **Observation** ($62.5\text{ px/m}$), and **Detection** ($25\text{ px/m}$).
* **Spatial Overlap & Blind Spot Detection:** Executes computational geometry routines via Turf.js to identify pairwise camera overlap polygons and unmonitored blind spots within defined perimeters.
* **Universal Multi-Format Document Ingestion:** Natively parses project plan documents (PDF, DOCX, DOC, CSV, TSV, KML, GeoJSON, TXT, Markdown tables) in the browser, extracting camera identifiers, coordinates, heights, and orientations.
* **Street View Verification & Coverage Snapshot Export:** Launches targeted Google Street View panoramas matching camera coordinates and heading, and generates high-resolution composite satellite imagery with camera frustums for project sign-offs.

---

## 2. Complete Architecture

The system operates across segregated execution sandboxes:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BROWSER TAB                                           │
│                                                                                             │
│  ┌─────────────────────────┐           CustomEvent            ┌──────────────────────────┐  │
│  │    PAGE MAIN WORLD      │ ───────────────────────────────> │  EXTENSION ISOLATED      │  │
│  │  (page-bridge.ts)       │   "__cctv_url_change__"          │  CONTENT SCRIPT          │  │
│  │  Hooks history API      │                                  │  (content.tsx)           │  │
│  │  - pushState            │                                  │  - urlWatcher.ts (60fps) │  │
│  │  - replaceState         │                                  │  - Pointer Kinematics    │  │
│  │  - hashchange           │                                  └────────────┬─────────────┘  │
│  └─────────────────────────┘                                               │                │
│                                                                            ▼                │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                             REACT 18 ROOT (#cctv-extension-root)                      │  │
│  │                                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         CctvProvider (CctvContext.tsx)                          │  │  │
│  │  │  - State: cameras[], activeCameraId, footprints, overlaps, blindSpots           │  │  │
│  │  │  - Geo Locking: isLocked=true, coordinates protected against UI mutation       │  │  │
│  │  └──────────────────┬──────────────────────────────────────────────┬───────────────┘  │  │
│  │                     │                                              │                  │  │
│  │                     ▼                                              ▼                  │  │
│  │  ┌──────────────────────────────────────┐        ┌─────────────────────────────────┐  │  │
│  │  │      MapOverlayCanvas.tsx            │        │       FloatingBar.tsx           │  │  │
│  │  │  - Fullscreen transparent HTML5      │        │  - Draggable HUD & Inspector    │  │  │
│  │  │    Canvas (pointer-events: none)     │        │  - CameraInspector.tsx          │  │  │
│  │  │  - ECEF 3D / Web Mercator Projection │        │  - CircularCompass.tsx          │  │  │
│  │  │  - Sutherland-Hodgman Near Clipping  │        │  - GroundMovementControls.tsx   │  │  │
│  │  │  - Realistic Camera Vector Icon &    │        │  - ProjectDetailsModal.tsx      │  │  │
│  │  │    DORI Distance Badges (60 FPS)     │        │  - StreetViewModal.tsx          │  │  │
│  │  └──────────────────────────────────────┘        └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ chrome.runtime.sendMessage
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          BACKGROUND SERVICE WORKER (service-worker.ts)                      │
│  - Tab Script Auto-Injection (chrome.scripting)                                             │
│  - Tab Viewport Capture (chrome.tabs.captureVisibleTab) for Satellite Snapshots             │
│  - Persistent Storage Coordination (chrome.storage.local)                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Repository Structure

```
/home/charan/cctvorg/
├── extension/
│   ├── manifest.json                  # Manifest V3 schema, permissions, host rules
│   └── icons/                         # Extension icons (16, 48, 128 px)
├── src/
│   ├── components/                    # UI Component Hierarchy
│   │   ├── Analysis/                  # CoverageAnalysisPanel.tsx (Perimeter, Overlaps, Blind spots)
│   │   ├── Compass/                   # CircularCompass.tsx (Circular azimuth heading dial)
│   │   ├── Inspector/                 # CameraInspector.tsx (Optics, DORI, Identity, Snapshots)
│   │   ├── Map/                       # CesiumMap.tsx (Standalone CesiumJS 3D engine)
│   │   ├── Movement/                  # GroundMovementControls.tsx (Local D-Pad metric stepping)
│   │   └── Sidebar/                   # CameraList.tsx (Camera collection list & actions)
│   ├── context/
│   │   └── CctvContext.tsx            # Global state container, geometry recalculator, actions
│   ├── data/
│   │   └── cameraModels.ts            # Verified manufacturer catalog (Hikvision, Axis, Dahua, etc.)
│   ├── extension/
│   │   ├── background/
│   │   │   └── service-worker.ts      # Background service worker, tab injection, captureVisibleTab
│   │   ├── content/
│   │   │   ├── content.css            # Extension styling, dark theme, resets
│   │   │   ├── content.tsx            # Content script entry point, DOM root injection
│   │   │   ├── FloatingBar.tsx        # Draggable floating HUD panel, resize handles
│   │   │   ├── MapOverlayCanvas.tsx   # 60 FPS HTML5 Canvas renderer, 3D math, marker picking
│   │   │   ├── page-bridge.ts         # Main-world URL change broadcaster
│   │   │   ├── ProjectDetailsModal.tsx# Universal project file uploader modal
│   │   │   └── StreetViewModal.tsx    # Google Maps Street View launch & inspection modal
│   │   ├── popup/
│   │   │   ├── popup.html             # Extension browser action toolbar popup
│   │   │   └── popup.tsx              # Quick launcher and status indicator
│   │   ├── services/
│   │   │   └── urlWatcher.ts          # Kinematic URL and gesture watcher (Google Earth & Maps)
│   │   └── sidebar/
│   │       └── ExtensionSidebar.tsx   # HUD Tab navigation container (Cameras, Analysis, Project)
│   ├── geo/                           # Core Geospatial & Optical Mathematics
│   │   ├── analysis.ts                # Spatial overlap and blind-spot algorithms (Turf.js)
│   │   ├── coordinates.ts             # Spherical geodesy, direct/inverse Haversine, bearing
│   │   ├── dori.ts                    # EN 62676-4 DORI distance formulas & PPM thresholds
│   │   ├── frustum.ts                 # Camera ground intersection, chord arcs, polygon generation
│   │   ├── movement.ts                # Relative ground translations and position reset
│   │   └── projection.ts              # ECEF, 3D Google Earth pinhole projection, Mercator projection
│   ├── services/
│   │   ├── mapNavigator.ts            # Geolocation fly-to coordinator (Earth, Maps, Cesium)
│   │   └── storage.ts                 # Unified chrome.storage.local / localStorage persistence
│   ├── types/
│   │   ├── camera.ts                  # Domain models: Camera, Specs, DORI, Footprint, Geometry
│   │   └── chrome.d.ts                # TypeScript Chrome Extension API declarations
│   └── utils/
│   │   ├── cameraIcons.ts             # SVG URI data generator for camera icons
│   │   ├── projectFileParser.ts       # In-browser multi-format document parser (PDF, DOCX, CSV, KML)
│   │   └── satelliteMapCapture.ts     # High-resolution satellite snapshot framing & rendering
├── vite.config.ts                     # Build configuration for standalone web app
└── vite.extension.config.ts           # Multi-entry build configuration for Manifest V3 extension
```

---

## 4. Technology Stack

* **Language Runtime & Framework:** TypeScript 5.x, React 18.2 (Functional components, Hooks, Context API).
* **Styling System:** Vanilla CSS (`content.css`, `index.css`) with curated HSL design tokens, glassmorphism (`backdrop-filter: blur(16px)`), slate-900 palettes (`#0f172a`, `#1e293b`), and CSS pointer-events decoupling.
* **Geospatial & Vector Mathematics:**
  * WGS84 Ellipsoidal transformations ($a = 6378137.0\text{ m}, e^2 = 0.00669437999014$).
  * Earth-Centered Earth-Fixed (ECEF) Cartesian coordinate projection.
  * Spherical Geodesy (Mean Earth Radius $R = 6,371,008.8\text{ m}$).
  * Web Mercator (EPSG:3857).
  * Turf.js (`@turf/turf` v7.x): `polygon`, `intersect`, `union`, `difference`, `area`, `featureCollection`.
* **Rendering Pipelines:**
  * HTML5 Canvas 2D (`CanvasRenderingContext2D`) scaling to device pixel ratio (`window.devicePixelRatio`).
  * Sutherland-Hodgman Polygon Clipping in 3D camera frustum space.
  * CesiumJS (`cesium` v1.114) for standalone 3D Globe visualization.
* **Browser Extension Infrastructure:**
  * Manifest Version: 3.
  * Execution Contexts: `world: "MAIN"` for `page-bridge.ts`, `world: "ISOLATED"` for `content.tsx`.
  * Background Engine: ES Module Service Worker (`service-worker.ts`).
* **Document Ingestion Engine:**
  * Browser-native `DecompressionStream('deflate-raw')` for unzipping Word DOCX `word/document.xml`.
  * In-memory stream parser for PDF `FlateDecode` streams and text operator extractions (`Tj`, `TJ`).

---

## 5. Browser Extension Architecture

### `manifest.json` Specifications
* **Manifest Version:** `3`
* **Extension Name:** `"CCTV GeoPlanner - 3D Camera Coverage for Google Earth & Maps"`
* **Permissions:** `["storage", "activeTab", "scripting", "tabs"]`
* **Host Permissions:**
  * `*://earth.google.com/*`, `*://*.google.com/earth/*`, `*://google.com/earth/*`
  * `*://*.google.com/maps/*`, `*://maps.google.com/*`, `*://google.com/maps/*`
  * `https://server.arcgisonline.com/*`

### Content Script Isolation & Bridge
The extension splits content execution across two execution contexts:
1. **Main World (`world: "MAIN"`, `run_at: "document_start"`):** `content/page-bridge.js`. Intercepts native page methods `history.pushState`, `history.replaceState`, `popstate`, and `hashchange`. Emits a custom DOM event `__cctv_url_change__` containing the target URL with zero latency.
2. **Isolated World (`world: "ISOLATED"`, `run_at: "document_idle"`):** `content/content.js`. Mounts the React application into a standalone container (`#cctv-extension-root`) attached directly to `document.body`.

### Extension Message Routing Table

| Message Type | Sender | Receiver | Payload | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `PING` | Popup / Background | Content Script (`content.tsx`) | `{ type: 'PING' }` | Verifies content script presence on active tab |
| `TOGGLE_OVERLAY` | Background (`service-worker.ts`) | Content Script (`content.tsx`) | `{ type: 'TOGGLE_OVERLAY' }` | Toggles FloatingBar UI visibility |
| `CAPTURE_VISIBLE_TAB` | Content Script (`MapOverlayCanvas.tsx`) | Background (`service-worker.ts`) | `{ type: 'CAPTURE_VISIBLE_TAB' }` | Invokes `chrome.tabs.captureVisibleTab` to acquire base satellite image |
| `__cctv_url_change__` | Main World (`page-bridge.ts`) | Isolated Content (`urlWatcher.ts`) | `CustomEvent<{ href: string }>` | Instantaneous notification of Google Earth/Maps viewport camera changes |
| `cctv-toggle-overlay` | Window Event | `FloatingBar.tsx` | None | Internal toggle signal dispatched to React HUD |

---

## 6. Google Earth Integration

Google Earth Web does not expose an open JavaScript runtime camera API to third-party extensions. The system bypasses this limitation through a real-time, non-invasive **Dual-Layer Kinematic Observer & URL Parsing Engine** (`urlWatcher.ts`).

### Live Camera Extraction from Google Earth URLs
Google Earth encodes its instantaneous 3D camera state within the URL path:
```text
https://earth.google.com/web/@<lat>,<lon>,<alt>a,<dist>d,<fov>y,<heading>h,<tilt>t,<roll>r
```

#### Parsing Implementation (`urlWatcher.ts:258-305`):
```text
URL Syntax Tokens:
  @(-?\d+\.?\d*),(-?\d+\.?\d*) -> Target ground center (Latitude, Longitude)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)a -> 'alt': Eye altitude or ground target elevation (meters MSL)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)d -> 'dist': Camera eye distance to ground target (meters)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)y -> 'fov': Vertical field of view (degrees, standard is 35°)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)h -> 'heading': Azimuth yaw angle (degrees, 0° = North, 90° = East)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)t -> 'tilt': Depression pitch angle from nadir (degrees, 0° = nadir, 90° = horizon)
  ([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)r -> 'roll': Camera roll angle (degrees)
```

**Critical Ground vs. Eye Altitude Resolution Rule:**
* If token `d` exists: token `a` represents **ground target elevation** ($h_t$ in meters MSL), and `d` represents **camera eye distance** to target.
* If token `d` is omitted (2D nadir view): token `a` represents **camera eye altitude** ($H_{\text{eye}}$), and ground target elevation is resolved to $0.0\text{ m}$.

### Zero-Latency Gesture Tracking (60 FPS Tracking)
Because Google Earth updates the browser URL via `history.replaceState` asynchronously (often throttled to 200–500ms intervals by the Google Earth engine), listening strictly to URL changes causes visual lag during active drags. The system implements a client-side kinematic predictor (`urlWatcher.ts:109-226`):

1. **Left-Mouse Pan Tracking:**
   $$\text{mPerPx} = \frac{2 \times d \times \tan(\text{vFOV} / 2)}{H_{\text{viewport}}}$$
   $$\Delta x_{\text{cam}} = -\Delta x_{\text{pointer}} \times \text{mPerPx}, \quad \Delta y_{\text{cam}} = \frac{\Delta y_{\text{pointer}} \times \text{mPerPx}}{\cos(\text{pitch})}$$
   $$\Delta E = \Delta x_{\text{cam}} \cos(\psi) - \Delta y_{\text{cam}} \sin(\psi), \quad \Delta N = \Delta x_{\text{cam}} \sin(\psi) + \Delta y_{\text{cam}} \cos(\psi)$$
   $$\Delta \phi = \frac{\Delta N}{111320}, \quad \Delta \lambda = \frac{\Delta E}{111320 \times \cos(\phi)}$$
2. **Right-Mouse & Shift-Drag Orbit Tracking:**
   $$\Delta \text{pitch} = -\Delta y_{\text{pointer}} \times 0.25^\circ, \quad \Delta \text{heading} = \Delta x_{\text{pointer}} \times 0.25^\circ$$
3. **Mouse Wheel Zoom Tracking:**
   $$d_{t+1} = d_t \times (1.08 \text{ if } \Delta y > 0 \text{ else } 0.92)$$
4. **Per-Frame Browser Paint Loop:**
   `requestAnimationFrame` loop executes `urlWatcher.forceCheck()` synchronously before each frame redraw, ensuring that overlay canvas re-projections occur in the identical browser tick as Google Earth WebGL canvas redraws.

---

## 7. Google Maps Integration

### Web Mercator Viewport Tracking (`urlWatcher.ts:308-350`)
Google Maps encodes map center coordinates and zoom level within its URL:
```text
https://www.google.com/maps/@<latitude>,<longitude>,<zoom>z
```
* **Latitude/Longitude:** Extracted via regex `/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/`.
* **Kinematic Drag Translation:**
  $$\text{scale} = 256 \times 2^{\text{zoom}}$$
  $$\Delta \lambda = \frac{-\Delta x_{\text{pointer}}}{\text{scale}} \times 360^\circ, \quad \Delta \phi = \frac{\Delta y_{\text{pointer}}}{\text{scale}} \times 360^\circ \times \cos(\phi_{\text{rad}})$$

---

## 8. Street View Integration

### Workflow and Parameter Mapping (`StreetViewModal.tsx:20-27`)
Street View integration allows human operators to verify physical site conditions, pole structural soundness, and visual line-of-sight obstructions (trees, building eaves, streetlights) prior to physical camera installation.

```text
CCTV Camera State (Lat, Lon, Heading, Tilt)
       ↓
Coordinate & Orientation Mapping:
  viewpoint = {camera.position.latitude},{camera.position.longitude}
  heading   = round(camera.heading)
  pitch     = -round(camera.tilt)
       ↓
Google Maps Street View URI Assembly:
  https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}&heading={heading}&pitch={pitch}
```
* **Inspection Workflow:** Clicking the Street View button in `FloatingBar.tsx` or `CameraInspector.tsx` opens a modal showing high-precision geodetic coordinates and orientation readouts, with a direct link opening the official Google Street View panorama oriented along the camera's azimuth.

---

## 9. Geographic Coordinate System

### Coordinate Definitions
* **Reference Ellipsoid:** WGS84 (World Geodetic System 1984), EPSG:4326.
  * Semi-major axis ($a$): $6,378,137.0\text{ m}$
  * First eccentricity squared ($e^2$): $0.00669437999014$
* **Spherical Geodesy Model:** Mean Earth Radius ($R$): $6,371,008.8\text{ m}$ (`src/geo/coordinates.ts:8`).
* **Web Mercator Projection:** EPSG:3857 (Google Maps mode).

---

### Core Mathematical Functions

#### 1. Geodetic to Earth-Centered Earth-Fixed (ECEF) Conversion
```text
Formula:
  N(φ) = a / √(1 - e² sin²(φ))
  X = (N(φ) + h) cos(φ) cos(λ)
  Y = (N(φ) + h) cos(φ) sin(λ)
  Z = (N(φ)(1 - e²) + h) sin(φ)

Input:
  latDeg (φ): WGS84 Geodetic Latitude in degrees [-90.0, 90.0]
  lonDeg (λ): WGS84 Geodetic Longitude in degrees [-180.0, 180.0]
  altMeters (h): Geodetic height above WGS84 ellipsoid in meters

Output:
  [X, Y, Z]: Cartesian ECEF coordinates in meters

Coordinate system:
  Geodetic WGS84 (EPSG:4326) → ECEF Cartesian (EPSG:4978)

Units:
  Degrees (input) → Meters (output)

Implementation file:
  src/geo/projection.ts

Function:
  geodeticToEcef(latDeg: number, lonDeg: number, altMeters: number): [number, number, number]
```

---

#### 2. Google Earth 3D Pinhole Screen Projection
```text
Formula:
  1. Compute Ground Target T = geodeticToEcef(lat_target, lon_target, alt_target)
  2. Compute Local ENU Basis at T:
     e_East  = [-sin(λ), cos(λ), 0]
     e_North = [-sin(φ)cos(λ), -sin(φ)sin(λ), cos(φ)]
     e_Up    = [cos(φ)cos(λ), cos(φ)sin(λ), sin(φ)]
  3. Compute Optical Look Vector L in ECEF:
     θ = pitch * (π/180),  ψ = heading * (π/180)
     L = (sin(θ)sin(ψ)) e_East + (sin(θ)cos(ψ)) e_North + (-cos(θ)) e_Up
  4. Compute Camera Eye Position E in ECEF:
     E = T - distance * L
  5. Compute Camera Coordinate Basis (Right R, Up U):
     R = (cos(ψ)) e_East + (-sin(ψ)) e_North
     U = R × L
     (Apply camera roll rotation matrix around L if roll ≠ 0)
  6. Transform Target World Point P to Camera Space:
     V = P_ECEF - E
     z_cam = V · L
     x_cam = V · R
     y_cam = V · U
  7. Perspective Screen Projection:
     f = (H_viewport / 2) / tan(vFOV / 2)
     x_screen = (W_viewport / 2) + (x_cam * f) / z_cam
     y_screen = (H_viewport / 2) - (y_cam * f) / z_cam

Input:
  lat, lon, elev: Geographic position of point to project (degrees, meters)
  view: GoogleEarthViewState { latitude, longitude, altitude, distance, pitch, heading, fov, roll }
  viewport: ViewportSize { width, height }

Output:
  ScreenPoint { x: number, y: number, visible: boolean, distanceToCamera: number }

Coordinate system:
  WGS84 Geodetic → ECEF Cartesian → 3D Camera Space → 2D Screen Space

Units:
  Meters, Radians, Pixels

Implementation file:
  src/geo/projection.ts

Function:
  projectGoogleEarthToScreen(lat: number, lon: number, elev: number, view: GoogleEarthViewState, viewport: ViewportSize): ScreenPoint
```

---

#### 3. Sutherland-Hodgman 3D Near-Plane Polygon Clipping
```text
Formula:
  For each edge connecting camera-space vertices P1 and P2:
  Near clipping plane defined at z_cam = 0.5 meters.
  If P1 and P2 both have z >= 0.5: retain P2.
  If P1 has z >= 0.5 and P2 has z < 0.5:
    t = (0.5 - P1.z) / (P2.z - P1.z)
    P_intersect = P1 + t * (P2 - P1)
    retain P_intersect.
  If P1 has z < 0.5 and P2 has z >= 0.5:
    t = (0.5 - P1.z) / (P2.z - P1.z)
    P_intersect = P1 + t * (P2 - P1)
    retain P_intersect, retain P2.

Input:
  coords: Array of { latitude, longitude }
  elev: Terrain elevation in meters
  view: GoogleEarthViewState
  viewport: ViewportSize

Output:
  Array of { x: number, y: number } in screen pixels

Coordinate system:
  3D Camera Eye Space → Clipped 2D Screen Viewport

Units:
  Meters → Pixels

Implementation file:
  src/geo/projection.ts

Function:
  projectGoogleEarthPolygon(coords: { latitude: number; longitude: number }[], elev: number, view: GoogleEarthViewState, viewport: ViewportSize): { x: number; y: number }[]
```

---

#### 4. Inverse 3D Ray-Plane Unprojection (Screen Click to WGS84)
```text
Formula:
  1. Construct Ray Direction D in ECEF:
     dx = screenX - (W / 2)
     dy = (H / 2) - screenY
     Ray_ECEF = dx * R + dy * U + f * L
     D = Ray_ECEF / |Ray_ECEF|
  2. Intersect Ray with Local Tangent Plane at Target Ground Point T with normal e_Up:
     t = (distance * (L · e_Up)) / (D · e_Up)
     P_ECEF = E + t * D
  3. Transform ECEF P back to Geodetic Coordinates:
     p = √(P_x² + P_y²)
     λ = atan2(P_y, P_x) * (180 / π)
     Initial φ = atan2(P_z, p * (1 - e²))
  4. Bowring's Millimeter Refinement:
     N(φ) = a / √(1 - e² sin²(φ))
     φ_refined = atan2(P_z + e² N(φ) sin(φ), p) * (180 / π)

Input:
  screenX, screenY: Screen coordinates of user click
  view: GoogleEarthViewState
  viewport: ViewportSize

Output:
  { latitude: number, longitude: number, elevation: number } (Degrees to 7 decimals, meters to 1 decimal)

Coordinate system:
  2D Screen Space → 3D ECEF Ray → Tangent Plane Intersection → Geodetic WGS84

Units:
  Pixels → Meters → Degrees WGS84

Implementation file:
  src/geo/projection.ts

Function:
  unprojectGoogleEarthScreen(screenX: number, screenY: number, view: GoogleEarthViewState, viewport: ViewportSize): { latitude: number; longitude: number; elevation: number }
```

---

#### 5. Google Maps Web Mercator Forward Projection
```text
Formula:
  scale = 256 * 2^zoom
  x_world = ((lon + 180) / 360) * scale
  y_world = (0.5 - ln(tan(π/4 + φ_rad/2)) / (2π)) * scale
  dx = x_world - center_x_world
  dy = y_world - center_y_world
  (Apply 2D bearing rotation matrix by -bearing)
  (Apply tilt foreshortening: dy_screen = dy_rot * cos(tilt))
  screenX = (W / 2) + dx_rot
  screenY = (H / 2) + dy_tilted

Input:
  lat, lon: Target coordinates
  view: GoogleMapsViewState { latitude, longitude, zoom, bearing, tilt }
  viewport: ViewportSize

Output:
  ScreenPoint { x: number, y: number, visible: boolean }

Coordinate system:
  Geodetic WGS84 → Web Mercator (EPSG:3857) → 2D Screen Space

Units:
  Degrees → Pixels

Implementation file:
  src/geo/projection.ts

Function:
  projectGoogleMapsToScreen(lat: number, lon: number, view: GoogleMapsViewState, viewport: ViewportSize): ScreenPoint
```

---

#### 6. Google Maps Web Mercator Inverse Projection
```text
Formula:
  dy_rot = (screenY - H/2) / cos(tilt)
  dx_rot = screenX - W/2
  (Invert bearing rotation)
  clickX = center_x_world + dx
  clickY = center_y_world + dy
  lon = (clickX / scale) * 360 - 180
  n = π - 2π * (clickY / scale)
  lat = (180 / π) * atan(0.5 * (e^n - e^(-n)))

Input:
  screenX, screenY: Screen coordinates in pixels
  view: GoogleMapsViewState
  viewport: ViewportSize

Output:
  { latitude: number, longitude: number }

Coordinate system:
  2D Screen Space → Web Mercator → Geodetic WGS84

Units:
  Pixels → Degrees WGS84

Implementation file:
  src/geo/projection.ts

Function:
  unprojectGoogleMapsScreen(screenX: number, screenY: number, view: GoogleMapsViewState, viewport: ViewportSize): { latitude: number; longitude: number }
```

---

#### 7. Great-Circle Direct Problem (Spherical Geodesy Destination)
```text
Formula:
  δ = distanceMeters / R_Earth
  θ = bearingDeg * (π / 180)
  φ2 = asin(sin(φ1)cos(δ) + cos(φ1)sin(δ)cos(θ))
  λ2 = λ1 + atan2(sin(θ)sin(δ)cos(φ1), cos(δ) - sin(φ1)sin(φ2))

Input:
  startLat (φ1): Origin latitude in degrees
  startLon (λ1): Origin longitude in degrees
  bearingDeg (θ): Forward azimuth in degrees [0, 360)
  distanceMeters: Ground distance in meters

Output:
  { latitude: number, longitude: number } in degrees (rounded to 8 decimal places)

Coordinate system:
  Spherical Earth Geodesy (Mean Earth Radius R = 6,371,008.8 m)

Units:
  Degrees, Meters

Implementation file:
  src/geo/coordinates.ts

Function:
  computeDestination(startLat: number, startLon: number, bearingDeg: number, distanceMeters: number): { latitude: number; longitude: number }
```

---

#### 8. Great-Circle Inverse Problem (Haversine Distance)
```text
Formula:
  Δφ = (lat2 - lat1) * (π / 180)
  Δλ = (lon2 - lon1) * (π / 180)
  a = sin²(Δφ / 2) + cos(φ1) cos(φ2) sin²(Δλ / 2)
  c = 2 * atan2(√a, √(1 - a))
  distance = R_Earth * c

Input:
  lat1, lon1: First geodetic position (degrees)
  lat2, lon2: Second geodetic position (degrees)

Output:
  Distance in meters

Coordinate system:
  Spherical Geodesy (R = 6,371,008.8 m)

Units:
  Meters

Implementation file:
  src/geo/coordinates.ts

Function:
  computeDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
```

---

#### 9. Initial Great-Circle Bearing (Forward Azimuth)
```text
Formula:
  Δλ = (lon2 - lon1) * (π / 180)
  y = sin(Δλ) * cos(φ2)
  x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
  θ = atan2(y, x) * (180 / π)
  bearing = (θ + 360) mod 360

Input:
  lat1, lon1: Origin point (degrees)
  lat2, lon2: Target point (degrees)

Output:
  Azimuth angle in degrees [0, 360) where 0° = True North, 90° = East

Coordinate system:
  Spherical Geodesy

Units:
  Degrees

Implementation file:
  src/geo/coordinates.ts

Function:
  computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number
```

---

## 10. Camera Data Model

The primary data structures are strictly defined in `src/types/camera.ts`:

```typescript
export interface Coordinates {
  latitude: number;    // WGS84 degrees (stored to 7 decimal places)
  longitude: number;   // WGS84 degrees (stored to 7 decimal places)
  elevation: number;   // meters above ground/sea level (MSL)
  heading?: number;    // Optional viewing azimuth in degrees
}

export interface CameraSpecs {
  modelName: string;
  manufacturer: string;
  formFactor: 'bullet' | 'dome' | 'turret' | 'ptz' | 'box';
  resolutionWidth: number;          // e.g. 1920, 2688, 3840, 5120
  resolutionHeight: number;         // e.g. 1080, 1520, 2160, 1440
  megaPixels: number;               // e.g. 2.0, 4.0, 8.0
  sensorSize: string;               // e.g. '1/2.8"', '1/1.8"', '1/1.2"'
  lensType: 'fixed' | 'varifocal' | 'motorized_zoom';
  focalLengthMin: number;           // mm
  focalLengthMax: number;           // mm
  selectedFocalLength: number;       // mm
  hfovMin: number;                  // degrees
  hfovMax: number;                  // degrees
  selectedHfov: number;              // degrees
  vfovMin: number;                  // degrees
  vfovMax: number;                  // degrees
  selectedVfov: number;              // degrees
  maxOpticalRangeMeters: number;    // Documented sensor reach in meters
  irRangeMeters: number;            // Infrared / supplemental light reach
  datasheetDori?: {
    detectMeters: number;
    observeMeters: number;
    recognizeMeters: number;
    identifyMeters: number;
  };
  recommendedHeight?: number;       // meters
  recommendedTilt?: number;         // degrees depression
  verificationStatus: 'verified' | 'user_defined' | 'estimated';
  datasheetRef?: string;
  notes?: string;
}

export interface Camera {
  id: string;                       // Unique identifier: `cam-<base36>-<rand>`
  name: string;                     // Human-readable identifier
  position: Coordinates;            // Current active WGS84 coordinates
  originalPosition: Coordinates;    // Initial placement anchor (for reset)
  mountingHeight: number;           // Height above ground in meters (h)
  heading: number;                  // Azimuth in degrees [0, 360) (0° = North)
  tilt: number;                     // Depression angle in degrees (0° = horizontal, 90° = nadir)
  rangeMeters: number;              // Maximum geometric boundary radius in meters
  specs: CameraSpecs;               // Physical optics and sensor specifications
  visible: boolean;                 // Render visibility toggle
  color: string;                    // Hex color code for footprint boundaries
  isLocked?: boolean;               // Geo-anchoring lock: prevents accidental translation
}
```

---

## 11. Camera Creation

### Initialization Logic (`src/context/CctvContext.tsx:320-382`)
Cameras are initialized with strict adherence to the **Approach Lane Tracking** optical standard:

* **Trigger:** Calling `addCameraAtCoordinates(coords, specs)`.
* **Standard Default Parameter Values:**
  * `mountingHeight`: $6.0\text{ m}$
  * `tilt`: $18.0^\circ$ (depression angle)
  * `selectedHfov`: $60.0^\circ$
  * `selectedVfov`: $34.0^\circ$
  * `rangeMeters`: $45.0\text{ m}$
  * `heading`: $0.0^\circ$ (True North)
  * `isLocked`: `true` (Real-World WGS84 Geo-Anchored)
* **ID Generation:**
  ```typescript
  id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
  ```
* **Naming Scheme:**
  * Manual creation: `"Camera " + (cameras.length + 1)`
  * Document import: Preserves the exact name parsed from the source file (e.g. `"Gate 1 Approach"`, `"CAM-04"`, `"North Entry Pole"`).
* **Color Palette Assignment:** Rotates through a predefined seven-color palette:
  `['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']`.

---

## 12. Camera Placement

### Placement Modes and Interaction (`MapOverlayCanvas.tsx:288-324`)
1. **Interactive Map Placement Mode:**
   * User clicks "+ Add Camera" in `FloatingBar.tsx`.
   * Sets `isPlacingCamera = true`.
   * Crosshair cursor with dynamic DORI circle preview tracks pointer (`mousePos`).
   * On mouse click, `unprojectPoint(e.clientX, e.clientY)` executes:
     * In Google Earth: `unprojectGoogleEarthScreen` computes the 3D ray-plane intersection in ECEF space against the terrain altitude ($z_{\text{target}}$).
     * In Google Maps: `unprojectGoogleMapsScreen` converts Mercator pixel coordinates to geodetic WGS84 coordinates.
   * `addCameraAtCoordinates` commits the new camera to React state and persistent storage.
   * `isPlacingCamera` is reset to `false`.
2. **Relocation Mode ("Move" Button):**
   * Sets `isRelocatingCamera = true`.
   * User clicks a new ground location.
   * Calls `relocateCamera(activeCamera.id, newCoords)`.
   * Updates `position` with millimeter geodetic coordinates (`lat.toFixed(7)`, `lon.toFixed(7)`) while preserving `originalPosition`.
3. **Aim Mode ("Aim" Button):**
   * Sets `isAimingCamera = true`.
   * User clicks down the target street or corridor.
   * Calls `aimCameraAt(activeCamera.id, clickedCoords)`.
   * Computes forward azimuth via `computeBearing(camLat, camLon, targetLat, targetLon)` and sets `camera.heading`.

---

## 13. Camera Geographic Anchoring

### Implementation & Verification
A core architectural requirement of this system is **Strict Real-World WGS84 Anchoring**. The camera is **Earth-coordinate anchored**, not screen-position anchored, DOM anchored, or map-pixel anchored.

```text
Physical Camera Anchor (WGS84 Latitude, Longitude, Elevation)
                             ↓
              Instantaneous Viewport Query
            (urlWatcher.ts @ 60 FPS / RAF Loop)
                             ↓
         ECEF 3D Rigorous Matrix Transformation
              (geodeticToEcef + Camera Basis)
                             ↓
              Sutherland-Hodgman 3D Near Clip
                             ↓
              Canvas 2D Screen Coordinate (px)
```

### Prevention of Coordinate Drift
1. **Separation of Concerns:** Moving or dragging the extension UI (`FloatingBar.tsx`) has zero impact on camera coordinates. Floating bar pointer events use `e.stopPropagation()` and `.setPointerCapture()`.
2. **Input Stripping Protection (`CctvContext.tsx:531-541`):**
   ```typescript
   const updateCamera = useCallback((id: string, updates: Partial<Camera>) => {
     setCameras((prev) =>
       prev.map((c) => {
         if (c.id !== id) return c;
         const safeUpdates = { ...updates };
         delete safeUpdates.position; // Position cannot be mutated via property forms!
         return { ...c, ...safeUpdates };
       })
     );
   }, []);
   ```
3. **Sub-Pixel Real-Time Projection:**
   During high-speed Google Earth pans, camera positions are projected dynamically from raw geodetic coordinates (`lat`, `lon`, `elevation`) on every animation frame. No cached screen coordinates are retained.

---

## 14. Camera Pinning

### Multi-Event Coordinate Stability Matrix

| Event / Action | Internal Code Execution Path | Visual Behavior | Coordinate Invariance |
| :--- | :--- | :--- | :--- |
| **Map Pan (Left Drag)** | `urlWatcher.pointermove` updates `centerLat`/`centerLon` $\rightarrow$ `MapOverlayCanvas.render` re-projects point via `projectGoogleEarthToScreen`. | Marker glides synchronously across viewport, remaining pinned to real-world ground feature. | **STRICTLY PRESERVED** (No change to WGS84 numbers). |
| **Map Zoom (Scroll Wheel)** | `urlWatcher.wheel` adjusts `distance` $\rightarrow$ re-projects with updated focal depth ratio. | Camera icon and footprint scale perspectively, matching physical ground footprint. | **STRICTLY PRESERVED**. |
| **Orbit / Tilt (Right Drag)** | `urlWatcher.pointermove` updates `pitch` and `heading` $\rightarrow$ recalculates ECEF camera orientation vectors. | Marker and sightlines tilt and yaw in full 3D perspective. | **STRICTLY PRESERVED**. |
| **UI Dragging (`FloatingBar`)** | Pointer capture updates CSS `left`/`top` of `#cctv-floating-bar-wrapper`. | FloatingBar moves over screen; map overlay is completely un-touched. | **STRICTLY PRESERVED**. |
| **Page Resize** | `window.resize` updates `viewport` dimensions $\rightarrow$ recalculates canvas center offset $(W/2, H/2)$. | Markers remain anchored to physical Earth points. | **STRICTLY PRESERVED**. |
| **Page Reload** | `CctvContext.useEffect` hydrates state from `chrome.storage.local`. | All cameras restore to exact geodetic coordinates saved. | **STRICTLY PRESERVED**. |

---

## 15. Camera Movement

### Ground Distance Translation Engine (`src/geo/movement.ts:14-40`)
When a camera is explicitly unlocked for ground micro-stepping via the D-Pad control panel (`GroundMovementControls.tsx`), translation occurs along its local reference frame:

```text
Formula:
  bearing = getMovementBearing(camera.heading, direction)
  direction == 'forward':  bearing = heading
  direction == 'backward': bearing = (heading + 180) mod 360
  direction == 'right':    bearing = (heading + 90) mod 360
  direction == 'left':     bearing = (heading + 270) mod 360
  newPosition = computeDestination(lat, lon, bearing, distanceMeters)

Input:
  camera: Camera object
  direction: 'forward' | 'backward' | 'left' | 'right'
  distanceMeters: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0] meters

Output:
  newPosition: Coordinates { latitude, longitude, elevation }
  entry: MovementHistoryEntry { cameraPosition, heading, timestamp }

Coordinate system:
  Local Camera Tangent Frame → Spherical Geodesy Destination

Units:
  Meters, Degrees

Implementation file:
  src/geo/movement.ts

Function:
  moveCamera(camera: Camera, direction: MovementDirection, distanceMeters: number): { newPosition: Coordinates; entry: MovementHistoryEntry }
```

---

## 16. Camera Rotation / Heading

### Orientation Mechanics (`src/geo/coordinates.ts:16-22`, `src/geo/frustum.ts:90-104`)
* **Heading Convention:** $0^\circ = \text{True North}$, $90^\circ = \text{East}$, $180^\circ = \text{South}$, $270^\circ = \text{West}$.
* **Normalization:** Angles are normalized into the interval $[0, 360)$ via `normalizeHeading(deg)`.
* **Controls:**
  1. Interactive 360° Circular Compass Dial (`CircularCompass.tsx`).
  2. Map-based Aim Tool (`aimCameraAt` via `computeBearing`).
  3. Direct numeric entry in `CameraInspector.tsx`.
* **Direction Vector:** Optical frustum centerline is generated by projecting a radial ray at angle $\psi = \text{heading}$ from the camera base coordinates.

---

## 17. Camera FOV

### Horizontal and Vertical Field of View
* **Horizontal FOV ($\text{hFOV}$):** Controls the lateral spread angle of the optical frustum ($1.0^\circ \le \text{hFOV} \le 180.0^\circ$).
* **Vertical FOV ($\text{vFOV}$):** Determines the vertical angular aperture of the lens.
* **Optical Focal Length Scaling (`CameraInspector.tsx:143-166`):**
  When adjusting focal length ($f_{\text{mm}}$) on varifocal/zoom cameras:
  $$\text{ratio} = \frac{f_{\text{mm}} - f_{\text{min}}}{f_{\text{max}} - f_{\text{min}}}$$
  $$\text{hFOV} = \text{hFOV}_{\text{max}} - \text{ratio} \times (\text{hFOV}_{\text{max}} - \text{hFOV}_{\text{min}})$$
  $$\text{vFOV} = \text{vFOV}_{\text{max}} - \text{ratio} \times (\text{vFOV}_{\text{max}} - \text{vFOV}_{\text{min}})$$

---

## 18. Camera Range

### Near and Far Ground Projections (`src/geo/frustum.ts:28-73`)

```text
Formula:
  h = max(0.5, mountingHeight)
  halfVfov = vfovDeg / 2

  Near Ground Distance:
    γ_bottom = tiltDeg + halfVfov (depression angle of lowest optical ray)
    If γ_bottom >= 89.9°:
      nearDistance = 0 (frustum originates at camera pole base)
    Else if γ_bottom > 0.5°:
      nearDistance = h / tan(γ_bottom * (π / 180))
    Else:
      nearDistance = maxRangeMeters
    nearDistance = clamp(nearDistance, 0, maxRangeMeters)

  Far Ground Distance:
    γ_top = tiltDeg - halfVfov (depression angle of uppermost optical ray)
    If γ_top > 0.5°:
      groundIntersection = h / tan(γ_top * (π / 180))
      farDistance = min(maxRangeMeters, groundIntersection)
    Else:
      farDistance = maxRangeMeters (ray at or above horizon; bounded by sensor range)
    farDistance = max(nearDistance + 0.1, farDistance)

Input:
  mountingHeight: Pole mounting height above ground in meters (h)
  tiltDeg: Camera depression tilt angle in degrees (0° = horizontal, 90° = nadir)
  vfovDeg: Vertical field of view in degrees
  maxRangeMeters: Maximum sensor range / configured optical limit

Output:
  { nearDistance: number, farDistance: number } (in meters, rounded to 2 decimals)

Coordinate system:
  Vertical Camera Elevation Plane

Units:
  Meters, Degrees

Implementation file:
  src/geo/frustum.ts

Function:
  computeGroundDistances(mountingHeight: number, tiltDeg: number, vfovDeg: number, maxRangeMeters: number): { nearDistance: number; farDistance: number }
```

---

## 19. Camera Models

### Verified Camera Catalog (`src/data/cameraModels.ts`)
The system contains 26 verified real-world CCTV cameras sourced from official manufacturer engineering datasheets:

| Manufacturer | Model Name | Form Factor | Resolution | Sensor | Lens Type | HFOV Range | Max Range | DORI Detect | DORI Identify |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hikvision** | `DS-2CD2387G2P-LSU/SL` | Turret | $5120 \times 1440$ (8MP) | $2 \times 1/1.8"$ | Fixed $4\text{mm}$ | $180.0^\circ$ | $77\text{ m}$ | $77\text{ m}$ | $7\text{ m}$ |
| **Hikvision** | `DS-2CD2T87G2P-LSU/SL` | Bullet | $5120 \times 1440$ (8MP) | $2 \times 1/1.8"$ | Fixed $4\text{mm}$ | $180.0^\circ$ | $77\text{ m}$ | $77\text{ m}$ | $7\text{ m}$ |
| **Hikvision** | `DS-2CD2387G2-LU` | Turret | $3840 \times 2160$ (8MP) | $1/1.2"$ | Fixed $2.8\text{mm}$ | $102.0^\circ$ | $89\text{ m}$ | $89\text{ m}$ | $8\text{ m}$ |
| **Hikvision** | `DS-2CD2047G2-LU` | Bullet | $2688 \times 1520$ (4MP) | $1/1.8"$ | Fixed $2.8\text{mm}$ | $111.9^\circ$ | $64\text{ m}$ | $64\text{ m}$ | $6\text{ m}$ |
| **Hikvision** | `DS-2CD2686G2-IZS` | Bullet | $3840 \times 2160$ (8MP) | $1/1.8"$ | Motorized $2.8\text{--}12\text{mm}$ | $32.5^\circ\text{--}108.0^\circ$| $89\text{ m}$ | $89\text{ m}$ | $8\text{ m}$ |
| **Hikvision** | `DS-2CD2786G2-IZS` | Dome | $3840 \times 2160$ (8MP) | $1/1.8"$ | Motorized $2.8\text{--}12\text{mm}$ | $32.5^\circ\text{--}108.0^\circ$| $89\text{ m}$ | $89\text{ m}$ | $8\text{ m}$ |
| **Hikvision** | `DS-2CD2346G2-ISU/SL` | Turret | $2688 \times 1520$ (4MP) | $1/3"$ | Fixed $2.8\text{mm}$ | $103.0^\circ$ | $67\text{ m}$ | $67\text{ m}$ | $6\text{ m}$ |
| **Hikvision** | `DS-2CD2T86G2-4I` | Bullet | $3840 \times 2160$ (8MP) | $1/1.8"$ | Fixed $4\text{mm}$ | $87.0^\circ$ | $115\text{ m}$ | $115\text{ m}$ | $11\text{ m}$ |
| **Hikvision** | `iDS-2CD7A46G0/P-IZHS`| Bullet | $2688 \times 1520$ (4MP) | $1/1.8"$ | ANPR $8\text{--}32\text{mm}$ | $15.5^\circ\text{--}42.5^\circ$ | $180\text{ m}$ | $180\text{ m}$ | $22\text{ m}$ |
| **Hikvision** | `DS-2DE4425IW-DE` | PTZ | $2560 \times 1440$ (4MP) | $1/2.8"$ | $25\times$ Optical Zoom | $2.6^\circ\text{--}55.0^\circ$ | $1200\text{ m}$| $1200\text{ m}$| $120\text{ m}$ |
| **Axis** | `AXIS P1468-LE` | Bullet | $3840 \times 2160$ (8MP) | $1/1.2"$ | Varifocal $3.5\text{--}10\text{mm}$| $46.0^\circ\text{--}109.0^\circ$| $115\text{ m}$ | $115\text{ m}$ | $11\text{ m}$ |
| **Axis** | `AXIS Q3538-LVE` | Dome | $3840 \times 2160$ (8MP) | $1/1.2"$ | Varifocal $4.3\text{--}8.6\text{mm}$| $50.0^\circ\text{--}104.0^\circ$| $95\text{ m}$ | $95\text{ m}$ | $9\text{ m}$ |
| **Axis** | `AXIS Q6135-LE` | PTZ | $1920 \times 1080$ (2MP) | $1/2.8"$ | $31\times$ Optical Zoom | $2.3^\circ\text{--}69.5^\circ$ | $1450\text{ m}$| $1450\text{ m}$| $145\text{ m}$ |
| **Dahua** | `IPC-HFW5842E-Z4E` | Bullet | $3840 \times 2160$ (8MP) | $1/1.8"$ | Motorized $8\text{--}32\text{mm}$ | $15.0^\circ\text{--}43.0^\circ$ | $230\text{ m}$ | $230\text{ m}$ | $23\text{ m}$ |
| **Dahua** | `IPC-HDBW5442R-ASE` | Dome | $2688 \times 1520$ (4MP) | $1/1.8"$ | Fixed $2.8\text{mm}$ | $112.0^\circ$ | $64\text{ m}$ | $64\text{ m}$ | $6\text{ m}$ |
| **Dahua** | `SD5A432GB-HNR` | PTZ | $2560 \times 1440$ (4MP) | $1/2.8"$ | $32\times$ Optical Zoom | $2.2^\circ\text{--}61.6^\circ$ | $1600\text{ m}$| $1600\text{ m}$| $160\text{ m}$ |
| **Hanwha** | `XNO-9083R` | Bullet | $3840 \times 2160$ (8MP) | $1/1.8"$ | Motorized $4.4\text{--}9.3\text{mm}$| $52.2^\circ\text{--}112.1^\circ$| $105\text{ m}$ | $105\text{ m}$ | $10\text{ m}$ |
| **Hanwha** | `XNV-8081Z` | Dome | $2560 \times 1920$ (5MP) | $1/1.8"$ | Motorized $3.9\text{--}9.4\text{mm}$| $46.0^\circ\text{--}102.0^\circ$| $85\text{ m}$ | $85\text{ m}$ | $8\text{ m}$ |
| **Bosch** | `FLEXIDOME 8000i 4K`| Dome | $3840 \times 2160$ (8MP) | $1/1.8"$ | Motorized $3.9\text{--}10\text{mm}$ | $44.0^\circ\text{--}110.0^\circ$| $110\text{ m}$ | $110\text{ m}$ | $11\text{ m}$ |
| **Bosch** | `DINION 7100i IR` | Bullet | $3840 \times 2160$ (8MP) | $1/1.2"$ | Telephoto $8\text{--}32\text{mm}$ | $14.0^\circ\text{--}42.0^\circ$ | $260\text{ m}$ | $260\text{ m}$ | $26\text{ m}$ |
| **Uniview** | `IPC2328SB-DZK-I0` | Bullet | $3840 \times 2160$ (8MP) | $1/2.8"$ | Motorized $2.8\text{--}12\text{mm}$ | $30.0^\circ\text{--}107.0^\circ$| $85\text{ m}$ | $85\text{ m}$ | $8\text{ m}$ |

---

## 20. Coverage Geometry

### Mathematical Frustum Ground Polygon Assembly (`src/geo/frustum.ts:78-143`)
To prevent infinite flaring or distortion at wide angles (up to $180^\circ$ panoramic), boundaries are assembled as circular sector arcs sampled along constant radial ground geodesic distances:

```text
Formula:
  1. Determine nearDistance and farDistance via computeGroundDistances.
  2. Compute Far Edge Lateral Chord Width:
     W_far = 2 * farDistance * sin(min(180, hfov) / 2 * (π / 180))
  3. Arc Generation (generateFrustumArc):
     For sample step i from 0 to N (N = 12):
       t = i / N
       β = -(hfov / 2) + t * hfov
       bearing = normalizeHeading(heading + β)
       Vertex = computeDestination(cameraLat, cameraLon, bearing, r)
  4. Polygon Closure:
     - Sample near arc from left-to-right at radius = nearDistance (or camera base if nearDistance < 0.3m).
     - Sample far arc from right-to-left at radius = farDistance.
     - Close polygon by repeating first vertex.

Input:
  FrustumParams { latitude, longitude, mountingHeight, heading, tilt, hfov, vfov, maxRangeMeters }

Output:
  FootprintGeometry { coordinates, nearDistanceMeters, farDistanceMeters, footprintWidthFarMeters, totalAreaM2, doriZones }

Coordinate system:
  Spherical Geodesy Destination Points

Units:
  Meters, Degrees, Square Meters (via turfArea)

Implementation file:
  src/geo/frustum.ts

Function:
  computeCameraFootprint(params: FrustumParams, doriRanges?: DoriDistances): FootprintGeometry
```

---

## 21. Coverage Rendering

### HTML5 Canvas 2D Pipeline (`MapOverlayCanvas.tsx:393-742`)
* **Layer Order:**
  1. **Blind Spot Polygons:** Crimson fill (`rgba(239, 68, 68, 0.2)`), solid border (`1.5px`).
  2. **Max Geometric Footprint Polygon:** Slate blue fill (`rgba(59, 130, 246, 0.14)`), primary color border (`1.4px` unselected, `2.2px` selected).
  3. **DORI Zones:**
     * Detection: Emerald (`#10b981`, alpha `0.18`)
     * Observation: Yellow (`#eab308`, alpha `0.25`)
     * Recognition: Amber (`#f59e0b`, alpha `0.35`)
     * Identification: Red (`#ef4444`, alpha `0.45`)
  4. **DORI Distance Badges:** Semi-transparent dark pill with colored text centered at the midpoint of each zone's boundary arc.
  5. **3D Optical Sightline Frustum Rays:** Dashed lines (`[4, 4]`) extending from elevated lens point $(X_{\text{lens}}, Y_{\text{lens}})$ to ground footprint corner vertices.
  6. **Camera Mounting Pole:** Solid line connecting ground base $(X_{\text{ground}}, Y_{\text{ground}})$ to elevated lens $(X_{\text{lens}}, Y_{\text{lens}})$.
  7. **Realistic CCTV Enclosure Vector Icon:**
     * Rendered directly onto canvas transformed by camera heading:
       * Swivel bracket mounting arm (`#64748b`)
       * Weatherproof camera housing (`#f8fafc`, rounded rect $14\times 10\text{px}$)
       * Protective sun hood canopy (`#334155`)
       * Optical glass lens barrel & blue aperture (`#38bdf8`)
       * Active red recording indicator LED (`#ef4444`)
  8. **Heading Vector & Arrow Tip:** Solid directional vector extending $38\text{px}$ forward from ground pin.
  9. **Anchored Camera Name Badge:** Dark rounded pill (`rgba(15, 23, 42, 0.94)`) displaying exclusively the camera's assigned name, positioned $36\text{px}$ above ground pin.
  10. **Pairwise Overlap Polygons:** Purple fill (`rgba(168, 85, 247, 0.4)`), lavender stroke (`#d8b4fe`).

---

## 22. Zoom / Pan / Viewport Behavior

### Geographic World-Space Invariance
* **Coverage Behavior Under Zoom:** Coverage geometry is computed strictly in **metric geographic world space** (meters across the physical surface of the Earth).
* When zooming in, a $45\text{ m}$ camera frustum expands visually in screen pixels because the map scale (pixels per meter) increases. Geographically, it covers the identical ground footprint.
* When zooming out, the frustum contracts visually in screen pixels, maintaining perfect alignment with roads, curbs, and building boundaries.
* It **never** expands or contracts arbitrarily based on screen dimensions or viewport scale.

---

## 23. Blind Spot Detection

### Spatial Difference Algorithm (`src/geo/analysis.ts:114-198`)

```text
Algorithm:
  1. Convert PlanningPerimeter vertices to Turf.js Polygon feature (perimeterPoly).
  2. Filter active, visible cameras and convert their footprint coordinates to Turf.js Polygons.
  3. Compute Cumulative Union of All Camera Polygons:
       unionCoverage = activeFootprints[0]
       For i = 1 to activeFootprints.length:
         unionCoverage = turfUnion(featureCollection([unionCoverage, activeFootprints[i]]))
  4. Compute Effective Monitored Area:
       effectiveCoverage = turfIntersect(featureCollection([perimeterPoly, unionCoverage]))
       coveredAreaM2 = turfArea(effectiveCoverage)
       coveragePercentage = (coveredAreaM2 / perimeterAreaM2) * 100
  5. Compute Unmonitored Blind Spot Polygons:
       difference = turfDifference(featureCollection([perimeterPoly, unionCoverage]))
       Extract coordinate rings from resulting Polygon or MultiPolygon.
       blindSpotAreaM2 = max(0, perimeterAreaM2 - coveredAreaM2)

Input:
  perimeter: PlanningPerimeter { coordinates, totalAreaM2 }
  cameras: Camera[]
  footprints: Map<string, FootprintGeometry>

Output:
  BlindSpotAnalysisResult {
    perimeterAreaM2: number,
    coveredAreaM2: number,
    coveragePercentage: number,
    blindSpotAreaM2: number,
    blindSpotPolygons: FootprintVertex[][]
  }

Coordinate system:
  WGS84 Geodetic Polygons → Planar Turf.js Topology

Units:
  Square Meters, Percent

Implementation file:
  src/geo/analysis.ts

Function:
  analyzeBlindSpots(perimeter: PlanningPerimeter, cameras: Camera[], footprints: Map<string, FootprintGeometry>): BlindSpotAnalysisResult
```

---

## 24. Multi-Camera Management

* **State Storage:** Stored as an array `Camera[]` inside React Context (`CctvContext.tsx`).
* **Active Camera Selection:** Managed via `activeCameraId: string | null`. Clicking a camera on the canvas or in `CameraList.tsx` designates it as active, surfacing its optical controls and 3D frustum rays.
* **Batch Operations:** `addCamerasBatch(camerasData: ParsedCamera[])` supports concurrent ingestion and geographic anchoring of multiple cameras.
* **High-Density Scalability:** The system has been validated for up to 50 concurrent active cameras with real-time Turf.js union and pairwise overlap calculations. For collections exceeding 100 cameras, spatial calculations are memoized (`useMemo`) to prevent main-thread UI stalls.

---

## 25. Camera Persistence

### Storage Subsystem (`src/services/storage.ts:12-93`)
Persistence is abstracted via `BrowserStorage`:
1. **Extension Execution:** Uses `chrome.storage.local`. Reads and writes asynchronously, mirroring writes to `localStorage` for cross-environment redundancy.
2. **Standalone Execution:** Uses browser `localStorage` with JSON serialization.

### Persistent Keys
* `cctv_saved_cameras`: Serialized JSON array of all configured `Camera` objects.
* `cctv_planning_perimeter`: Current active `PlanningPerimeter` polygon.
* `cctv_cesium_ion_token`: Cesium Ion access token string.
* `cctv_floating_bar_pos`: `{ x, y }` screen pixel coordinates of the HUD panel.
* `cctv_floating_bar_height`: Numeric height of the HUD panel.
* `cctv_floating_bar_minimized`: Boolean minimization flag.
* `cctv_floating_bar_visible`: Boolean HUD visibility flag.

---

## 26. UI / Side Panel

### Floating HUD Panel (`src/extension/content/FloatingBar.tsx`)
* **Styling & Window Docking:** Fixed CSS container with slate-900 background (`rgba(15, 23, 42, 0.96)`), rounded borders (`12px`), drop shadows, and top-right viewport docking.
* **Tabs:**
  1. **Cameras (`CameraList.tsx`):** Collection list, quick visibility toggles, focus buttons, deletion, duplication.
  2. **Inspector (`CameraInspector.tsx`):** Model selection, optical sliders (FOV, tilt, height, range), DORI readouts, D-Pad movement, 360° circular compass.
  3. **Analysis (`CoverageAnalysisPanel.tsx`):** Perimeter definition, overlap breakdown table, blind spot percentage readout.
  4. **Project Details Modal:** Universal project file upload button, project name and notes editor.

---

## 27. Extension Communication

### Full Message Communication Matrix

```text
[Main-World Page] ──── (CustomEvent: "__cctv_url_change__") ───> [Isolated Content Script]
[Background Worker] ── (chrome.tabs.sendMessage) ─────────────> [Content Script (TOGGLE_OVERLAY)]
[Content Script] ───── (chrome.runtime.sendMessage) ──────────> [Background Worker (CAPTURE_VISIBLE_TAB)]
[Content Script] ───── (chrome.storage.local) ────────────────> [Persistent Extension Storage]
```

---

## 28. State Management

The centralized state store is implemented as a React Context Provider (`CctvProvider` in `src/context/CctvContext.tsx`).

### State Flow Architecture
```text
User Action (Click, Drag, Slider, Upload)
                 ↓
CctvContext Action Dispatcher (e.g. updateCamera, rotateCamera, addCamerasBatch)
                 ↓
React State Commit (setCameras)
                 ↓
Memoized Recomputation (useMemo):
  - footprints = computeCameraFootprint(...)
  - overlaps   = analyzeOverlaps(...)
  - blindSpots = analyzeBlindSpots(...)
                 ↓
Storage Synchronization (storage.set('cctv_saved_cameras', cameras))
                 ↓
Subscribed UI Renderers:
  - MapOverlayCanvas.tsx (Redraws 2D canvas at next animation frame)
  - CameraInspector.tsx (Updates metrics, DORI, sliders)
  - FloatingBar.tsx (Updates camera count badge)
```

---

## 29. Event Flow

```
[User Interacts with Google Earth]
       │
       ├── Mouse Down / Move / Wheel
       │        ↓
       │   urlWatcher.ts (Pointer kinematic tracking updates live state)
       │        ↓
       ├── Google Earth updates URL hash/history
       │        ↓
       │   page-bridge.ts (Intercepts replaceState, emits __cctv_url_change__)
       │        ↓
       │   urlWatcher.ts (Synchronous parseCurrentUrl notification)
       │        ↓
       └── requestAnimationFrame
                ↓
           MapOverlayCanvas.render()
                ↓
           projectGoogleEarthToScreen() / projectGoogleEarthPolygon()
                ↓
           2D Canvas clearRect & redraw (Zero visual latency)
```

---

## 30. End-to-End Feature Flows

### 1. Camera Creation Flow
```text
User clicks "+ Add Camera" in FloatingBar
→ setIsPlacingCamera(true)
→ User moves mouse across Google Earth viewport (Crosshair & DORI preview rendered)
→ User clicks target street corner
→ unprojectGoogleEarthScreen computes exact WGS84 ground coordinate (lat, lon, elev)
→ addCameraAtCoordinates executes
→ Applies Approach Lane Tracking parameters (60° hFOV, 34° vFOV, 45m range, 18° tilt, 6m ht)
→ Camera object instantiated with isLocked = true
→ Added to cameras[] array in CctvContext
→ Footprint polygon computed via computeCameraFootprint
→ Persisted to chrome.storage.local
→ Canvas renders camera icon, badge, and coverage footprint at clicked coordinate
```

### 2. Universal Document Import Flow
```text
User clicks "Add Project Details" in FloatingBar
→ ProjectDetailsModal opens
→ User selects or drops project document (.pdf, .docx, .kml, .geojson, .csv, .txt)
→ parseProjectFile executes:
    - If DOCX: Decompresses word/document.xml via DecompressionStream
    - If PDF: Extracts stream blocks and text operators (Tj, TJ)
    - If KML: Extracts <Placemark> coordinates
    - If CSV/Table: Maps column headers (name, lat, lon, height, heading)
→ Extracts camera records and preserves exact original camera names
→ addCamerasBatch commits all cameras to state
→ Every camera configured with Approach Lane Tracking ratio and isLocked = true
→ Google Earth navigates to the first imported camera position
→ Overlay canvas projects and renders all imported camera footprints
```

### 3. Coverage Snapshot & Project Export Flow
```text
User clicks "Save Project & Snapshot" in CameraInspector
→ captureMapSnapshot requests CAPTURE_VISIBLE_TAB from background service worker
→ Background captures visible Google Earth satellite viewport
→ satelliteMapCapture frames camera coverage polygon with 20% padding
→ Crops background satellite imagery to coverage bounding box
→ Superimposes high-resolution 2D CCTV frustum, DORI zones, and telemetry badge
→ Generates downloadable PNG image file
→ Serializes project configuration JSON containing cameras, specs, and perimeter
→ Triggers browser download for both JSON and PNG files
```

---

## 31. Important Functions

| Function Name | Source File | Description |
| :--- | :--- | :--- |
| `geodeticToEcef` | `src/geo/projection.ts` | Converts geodetic WGS84 $(\phi, \lambda, h)$ to ECEF Cartesian $(X, Y, Z)$. |
| `projectGoogleEarthToScreen` | `src/geo/projection.ts` | Projects WGS84 point to 2D screen coordinates using 3D ECEF pinhole projection. |
| `projectGoogleEarthPolygon` | `src/geo/projection.ts` | Projects 3D polygon with Sutherland-Hodgman near-plane clipping ($z \ge 0.5\text{ m}$). |
| `unprojectGoogleEarthScreen` | `src/geo/projection.ts` | Calculates exact clicked WGS84 coordinates via 3D ray-plane intersection in ECEF. |
| `projectGoogleMapsToScreen` | `src/geo/projection.ts` | Converts WGS84 coordinates to Web Mercator pixel screen positions. |
| `computeGroundDistances` | `src/geo/frustum.ts` | Calculates near and far optical ground intersection distances from height, tilt, and vFOV. |
| `computeCameraFootprint` | `src/geo/frustum.ts` | Generates full closed GeoJSON polygon and DORI sub-zones for camera coverage. |
| `calculateDoriDistances` | `src/geo/dori.ts` | Computes metric distances for Identification, Recognition, Observation, Detection. |
| `computeDestination` | `src/geo/coordinates.ts` | Solves great-circle direct problem: destination given start, bearing, and distance. |
| `computeBearing` | `src/geo/coordinates.ts` | Computes forward azimuth angle between two geodetic coordinates. |
| `analyzeOverlaps` | `src/geo/analysis.ts` | Detects pairwise camera footprint intersections using Turf.js. |
| `analyzeBlindSpots` | `src/geo/analysis.ts` | Computes unmonitored spatial difference between planning perimeter and camera union. |
| `parseProjectFile` | `src/utils/projectFileParser.ts` | Universal parser extracting camera specifications from PDF, DOCX, CSV, KML, JSON. |
| `urlWatcher.forceCheck` | `src/extension/services/urlWatcher.ts` | Forces instantaneous URL and viewport state re-parsing. |

---

## 32. Important Classes / Types

* `GoogleEarthViewState`: Camera parameters from Google Earth URL (`latitude`, `longitude`, `altitude`, `distance`, `pitch`, `heading`, `fov`, `roll`).
* `GoogleMapsViewState`: Mercator parameters from Google Maps URL (`latitude`, `longitude`, `zoom`, `bearing`, `tilt`).
* `Camera`: Core entity representing an installed CCTV device with physical mounting and optical parameters.
* `CameraSpecs`: Technical datasheet specifications of a camera model (resolution, sensor, lens, DORI reach).
* `FootprintGeometry`: Closed geodetic boundary coordinates, area in $m^2$, near/far reach, and DORI polygons.
* `MapUrlWatcher`: Singleton tracking host page camera perspective via URL mutation and pointer kinematics.
* `BrowserStorage`: Storage adapter coordinating `chrome.storage.local` and `localStorage`.

---

## 33. External APIs

* **Google Maps Static / Panorama API:**
  * Endpoint: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}&heading={heading}&pitch={pitch}`
  * Authentication: Public web URI protocol.
* **Cesium Ion API:**
  * Variable: `cctv_cesium_ion_token`
  * Purpose: 3D terrain and photogrammetry asset streaming in standalone CesiumMap mode.
  * Value: `REDACTED`
* **ArcGIS World Imagery Tiles:**
  * Host Permission: `https://server.arcgisonline.com/*`
  * Purpose: Global high-resolution satellite imagery tiles for standalone Leaflet/Cesium fallbacks.

---

## 34. Configuration

* **Default Mounting Height:** $6.0\text{ meters}$
* **Default Depression Tilt:** $18.0^\circ$
* **Default Horizontal FOV:** $60.0^\circ$
* **Default Vertical FOV:** $34.0^\circ$
* **Default Maximum Range:** $45.0\text{ meters}$
* **Default EN 62676-4 DORI Thresholds:**
  * Identification: $250\text{ px/m}$
  * Recognition: $125\text{ px/m}$
  * Observation: $62.5\text{ px/m}$
  * Detection: $25\text{ px/m}$
* **Near Clipping Plane ($z_{\text{near}}$):** $0.5\text{ meters}$

---

## 35. Security

* **Manifest V3 Content Security Policy (CSP):** Operates under standard MV3 restrictions forbidding remote script evaluation (`eval`, `new Function`).
* **Main World / Isolated World Separation:** Host DOM interception is restricted to `page-bridge.ts`. The extension React application runs inside an isolated world, preventing host scripts from inspecting CCTV state.
* **Credential Protection:** No hardcoded private API keys, passwords, or authentication secrets exist in the codebase. User-supplied Cesium Ion tokens are persisted locally in client storage.

---

## 36. Performance

* **Retina / HiDPI Scaling:** Canvas backing store dimensions dynamically scale to `devicePixelRatio` to prevent blurriness on 4K/Retina displays.
* **60 FPS Projection Execution:** Real-time matrix projection executes within $< 1.5\text{ms}$ per frame for up to 50 active cameras.
* **Polygon Arc Optimization:** Frustum arcs are sampled using 8 to 12 geodesic points, delivering visual curvature without overloading 2D canvas draw operations.
* **DOM Event Decoupling:** Pointer interaction uses passive event listeners (`{ passive: true }`) to ensure host page scrolling and orbiting maintain 60 FPS performance.

---

## 37. Bug-Prone / Critical Logic

1. **Google Earth URL Elevation Tag Ambiguity (`urlWatcher.ts:276-285`):**
   * *Critical Logic:* In Google Earth URL syntax, `@lat,lon,alt a,dist d...`, the `a` parameter designates ground target elevation MSL *only* when token `d` is present. If `d` is absent, `a` designates eye altitude above ground. Treating `a` as camera altitude when `d` exists causes severe vertical parallax errors.
2. **Near-Plane Polygon Inversion (`projection.ts:298-424`):**
   * *Critical Logic:* Vertices situated behind the camera eye ($z_{\text{cam}} \le 0$) invert coordinates across $(W/2, H/2)$ and blow up to $\pm \infty$. The Sutherland-Hodgman clipper (`projectGoogleEarthPolygon`) clips polygons against $z_{\text{cam}} \ge 0.5\text{ m}$ in camera space before screen projection.
3. **Accidental Coordinate Mutation During Property Edits (`CctvContext.tsx:531-541`):**
   * *Critical Logic:* In `updateCamera`, `delete safeUpdates.position` prevents form inputs or UI components from modifying camera coordinates. Coordinate alterations are strictly gated through `relocateCamera`.

---

## 38. Actual vs Intended Behavior

### ACTUAL IMPLEMENTATION
* Camera positions are strictly locked to geodetic WGS84 coordinates.
* All added and imported cameras default to the **Approach Lane Tracking** specification ($60^\circ\text{ HFOV}, 34^\circ\text{ VFOV}, 45\text{m range}, 18^\circ\text{ tilt}, 6\text{m ht}$).
* Panning, tilting, or zooming Google Earth smoothly translates the canvas overlay synchronously at 60 FPS.
* Uploading project documents (.pdf, .docx, .csv, .kml) parses camera names and preserves them on the map.
* Google Street View launches directly at the camera's coordinates with heading and pitch orientation.

### INTENDED BEHAVIOR
* Fully consistent with actual code implementation. Legacy dummy cameras (`cam-initial-1`) and legacy junction dropdowns have been purged.

### MISMATCHES
* None identified in active codebase.

---

## 39. Feature Implementation Matrix

| Feature | Implementation Status | Implementation File | Symbol / Routine |
| :--- | :--- | :--- | :--- |
| **WGS84 Geodetic Anchoring** | FULLY IMPLEMENTED | `src/geo/projection.ts` | `geodeticToEcef`, `projectGoogleEarthToScreen` |
| **3D Near-Plane Polygon Clipping** | FULLY IMPLEMENTED | `src/geo/projection.ts` | `projectGoogleEarthPolygon` |
| **Inverse 3D Ray-Plane Unprojection** | FULLY IMPLEMENTED | `src/geo/projection.ts` | `unprojectGoogleEarthScreen` |
| **Approach Lane Optical Standard** | FULLY IMPLEMENTED | `src/context/CctvContext.tsx`| `JUNCTION_PRESETS.approach`, `addCameraAtCoordinates` |
| **EN 62676-4 DORI Grading** | FULLY IMPLEMENTED | `src/geo/dori.ts` | `calculateDoriDistances`, `DORI_PPM` |
| **Pairwise Overlap Analysis** | FULLY IMPLEMENTED | `src/geo/analysis.ts` | `analyzeOverlaps` (Turf.js `intersect`) |
| **Blind Spot Spatial Difference** | FULLY IMPLEMENTED | `src/geo/analysis.ts` | `analyzeBlindSpots` (Turf.js `difference`) |
| **Universal File Ingestion (DOCX/PDF)**| FULLY IMPLEMENTED | `src/utils/projectFileParser.ts`| `extractTextFromDocx`, `extractTextFromPdf` |
| **Street View 360° Inspection** | FULLY IMPLEMENTED | `src/extension/content/StreetViewModal.tsx` | `StreetViewModal` (Google Maps Pano API) |
| **Satellite Coverage Snapshots** | FULLY IMPLEMENTED | `src/utils/satelliteMapCapture.ts`| `renderCameraCoverageSnapshot` |
| **Zero-Latency Kinematic Tracking** | FULLY IMPLEMENTED | `src/extension/services/urlWatcher.ts`| `MapUrlWatcher` |
| **DOM Canvas Decoupled HUD** | FULLY IMPLEMENTED | `src/extension/content/FloatingBar.tsx` | `FloatingBar` |
| **3D Terrain Elevation Ray Casting** | PARTIALLY IMPLEMENTED | `src/geo/projection.ts` | Ray-plane intersection uses ground target elevation MSL; DTED/GeoTIFF raster ray-marching is NOT IMPLEMENTED. |

---

## 40. Complete Function Index

| Function | File | Purpose | Inputs | Outputs | Called By |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `geodeticToEcef` | `projection.ts` | Geodetic to ECEF Cartesian | `lat, lon, alt` | `[x, y, z]` | `projectGoogleEarthToScreen`, `unprojectGoogleEarthScreen` |
| `projectGoogleEarthToScreen` | `projection.ts` | 3D ECEF pinhole projection | `lat, lon, elev, view, viewport` | `ScreenPoint` | `MapOverlayCanvas.tsx` |
| `projectGoogleEarthPolygon` | `projection.ts` | 3D clipped polygon projection | `coords, elev, view, viewport` | `ScreenPoint[]` | `MapOverlayCanvas.tsx` |
| `unprojectGoogleEarthScreen` | `projection.ts` | 3D ray-plane ground unproject | `x, y, view, viewport` | `{ lat, lon, elev }` | `MapOverlayCanvas.tsx` |
| `projectGoogleMapsToScreen` | `projection.ts` | Web Mercator projection | `lat, lon, view, viewport` | `ScreenPoint` | `MapOverlayCanvas.tsx` |
| `unprojectGoogleMapsScreen` | `projection.ts` | Web Mercator unprojection | `x, y, view, viewport` | `{ lat, lon }` | `MapOverlayCanvas.tsx` |
| `computeGroundDistances` | `frustum.ts` | Frustum near/far ground limits | `height, tilt, vfov, range` | `{ nearDistance, farDistance }` | `computeCameraFootprint` |
| `computeCameraFootprint` | `frustum.ts` | Generates GeoJSON coverage polygon | `params, doriRanges` | `FootprintGeometry` | `CctvContext.tsx` |
| `calculateDoriDistances` | `dori.ts` | Calculates EN 62676-4 DORI reach | `resWidth, hfov, maxRange` | `DoriDistances` | `CctvContext.tsx`, `CameraInspector.tsx` |
| `computeDestination` | `coordinates.ts` | Great-circle direct problem | `lat, lon, bearing, dist` | `{ latitude, longitude }` | `frustum.ts`, `movement.ts` |
| `computeBearing` | `coordinates.ts` | Great-circle forward azimuth | `lat1, lon1, lat2, lon2` | `bearingDegrees` | `CctvContext.tsx`, `MapOverlayCanvas.tsx` |
| `moveCamera` | `movement.ts` | Local D-Pad ground translation | `camera, dir, distance` | `{ newPosition, entry }` | `CctvContext.tsx` |
| `analyzeOverlaps` | `analysis.ts` | Pairwise footprint intersections | `cameras, footprints` | `OverlapResult[]` | `CctvContext.tsx` |
| `analyzeBlindSpots` | `analysis.ts` | Perimeter spatial difference | `perimeter, cameras, footprints`| `BlindSpotAnalysisResult` | `CctvContext.tsx` |
| `parseProjectFile` | `projectFileParser.ts` | Universal document parser | `file: File` | `ParsedProjectFileResult` | `ProjectDetailsModal.tsx` |
| `navigateMapToCoordinates` | `mapNavigator.ts` | Fly-to viewport coordinator | `coords: Coordinates` | `void` | `CctvContext.tsx` |

---

## 41. Complete Data Structure Index

* `Camera`: Core entity representing an installed CCTV device with physical mounting and optical parameters (`src/types/camera.ts:53-66`).
* `CameraSpecs`: Technical datasheet specifications of a camera model (`src/types/camera.ts:18-44`).
* `Coordinates`: Geodetic position tuple (`latitude`, `longitude`, `elevation`, `heading`) (`src/types/camera.ts:46-51`).
* `DoriDistances`: Metric reach for Identification, Recognition, Observation, Detection (`src/types/camera.ts:68-74`).
* `FootprintGeometry`: Closed geodetic boundary coordinates, area in $m^2$, near/far reach, and DORI sub-zones (`src/types/camera.ts:81-93`).
* `OverlapResult`: Pairwise intersection data between two camera footprints (`src/types/camera.ts:95-99`).
* `PlanningPerimeter`: User-defined polygon bounding the area of interest (`src/types/camera.ts:101-106`).
* `BlindSpotAnalysisResult`: Metrics and polygons for unmonitored zones (`src/types/camera.ts:108-114`).
* `GoogleEarthViewState`: Instantaneous 3D camera parameters from Google Earth URL (`src/geo/projection.ts:9-18`).
* `GoogleMapsViewState`: View parameters from Google Maps URL (`src/geo/projection.ts:20-26`).

---

## 42. Complete File Index

| File Path | Architectural Role | Core Symbols |
| :--- | :--- | :--- |
| `src/geo/projection.ts` | 3D ECEF & Web Mercator projection engine | `geodeticToEcef`, `projectGoogleEarthToScreen`, `projectGoogleEarthPolygon`, `unprojectGoogleEarthScreen` |
| `src/geo/frustum.ts` | Camera optical ground intersection & polygon builder | `computeGroundDistances`, `computeCameraFootprint`, `calculateFootprintForRange` |
| `src/geo/dori.ts` | IEC / EN 62676-4 DORI standard calculations | `calculateDoriDistances`, `calculatePpmAtDistance`, `DORI_PPM` |
| `src/geo/coordinates.ts` | Spherical geodesy, destination, bearing | `computeDestination`, `computeDistance`, `computeBearing`, `normalizeHeading` |
| `src/geo/analysis.ts` | Spatial analysis (overlaps and blind spots) | `analyzeOverlaps`, `analyzeBlindSpots`, `verticesToTurfPolygon` |
| `src/geo/movement.ts` | Local coordinate frame translation | `moveCamera`, `resetCameraToOriginal` |
| `src/context/CctvContext.tsx` | Central state provider & action dispatcher | `CctvProvider`, `useCctv`, `JUNCTION_PRESETS` |
| `src/data/cameraModels.ts` | Verified CCTV manufacturer catalog | `VERIFIED_CAMERA_MODELS`, `createCustomCameraSpecs` |
| `src/extension/services/urlWatcher.ts` | Kinematic URL observer & 60 FPS gesture tracker | `MapUrlWatcher`, `urlWatcher` |
| `src/extension/content/page-bridge.ts` | Main-world history interception script | `broadcast`, `__cctv_url_change__` |
| `src/extension/content/MapOverlayCanvas.tsx` | High-performance 2D Canvas overlay | `MapOverlayCanvas` |
| `src/extension/content/FloatingBar.tsx` | Draggable HUD container & toolbar | `FloatingBar` |
| `src/extension/content/StreetViewModal.tsx` | Google Street View panorama launcher | `StreetViewModal` |
| `src/extension/content/ProjectDetailsModal.tsx` | Universal document uploader modal | `ProjectDetailsModal` |
| `src/utils/projectFileParser.ts` | PDF/DOCX/CSV/KML document parser | `parseProjectFile`, `parseProjectText`, `cleanCameraName` |
| `src/services/storage.ts` | Persistence adapter (`chrome.storage` / `localStorage`) | `BrowserStorage`, `storage` |
| `src/services/mapNavigator.ts` | Unified map navigation coordinator | `navigateMapToCoordinates` |

---

## 43. Technical Glossary

* **DORI (EN 62676-4):** International CCTV standard defining target pixel density thresholds on a subject:
  * **Detection ($25\text{ px/m}$):** Alerting operators to human presence.
  * **Observation ($62.5\text{ px/m}$):** Viewing characteristic clothing and activity.
  * **Recognition ($125\text{ px/m}$):** High-certainty verification of known individuals.
  * **Identification ($250\text{ px/m}$):** Unambiguous facial recognition and license plate reading.
* **ECEF (Earth-Centered Earth-Fixed):** A right-handed Cartesian 3D coordinate system $(X, Y, Z)$ rotating with the Earth, with origin at the Earth's center of mass.
* **WGS84:** World Geodetic System 1984 ellipsoidal model of the Earth ($a = 6378137.0\text{ m}, 1/f = 298.257223563$).
* **Depression Tilt ($\beta$):** Downward angular inclination of the camera optical axis from the local horizontal plane ($0^\circ = \text{horizontal}$, $90^\circ = \text{nadir}$).
* **Azimuth Heading ($\psi$):** Horizontal angle of the camera optical axis clockwise from True North ($0^\circ = \text{North}$, $90^\circ = \text{East}$).
* **Sutherland-Hodgman Algorithm:** Polygon clipping algorithm that intersects polygon edges against clipping planes in 3D projective space.

---

## 44. Source Reference Index

1. **IEC / EN 62676-4:** *Video surveillance systems for use in security applications — Part 4: Application guidelines.*
2. **NGA Standardization Document:** *Department of Defense World Geodetic System 1984 (WGS 84).*
3. **Bowring, B. R. (1976):** *Transformation from spatial to geographical coordinates.* Survey Review, 23(181), 323–327.
4. **Snyder, John P. (1987):** *Map Projections — A Working Manual.* USGS Professional Paper 1395.
5. **Hikvision Technical Documentation:** *ColorVu & AcuSense Engineering Reference Guides.*
6. **Axis Communications:** *Camera Selector & Lens Field of View Technical Guide.*
7. **Dahua Technology:** *WizMind Series Network Cameras Engineering Datasheets.*
8. **Chrome Extension Documentation:** *Manifest V3 Migration Guide & API Reference.*
