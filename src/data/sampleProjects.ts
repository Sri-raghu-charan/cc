import { Camera } from '../types/camera';
import { VERIFIED_CAMERA_MODELS } from './cameraModels';

export interface RecentProjectItem {
  id: string;
  name: string;
  filename: string;
  extension: 'json' | 'kml' | 'csv' | 'geojson';
  date: string;
  cameraCount: number;
  description?: string;
  cameras: Camera[];
}

// 34 Real-World Anchored CCTV Cameras for Rajahmundry Pushkaralu & Surrounding Riverfront
export const SAMPLE_CAMERAS_RAJAHMUNDRY: Camera[] = [
  {
    id: 'cam-01-iskcon',
    name: 'CAM-01 — ISKCON Temple',
    position: { latitude: 17.000497, longitude: 81.804008, elevation: 14 },
    originalPosition: { latitude: 17.000497, longitude: 81.804008, elevation: 14 },
    mountingHeight: 8,
    heading: 125,
    tilt: 15,
    rangeMeters: 200,
    visible: true,
    color: '#2563EB',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'Hikvision DS-2CD2347G2',
      manufacturer: 'Hikvision',
      formFactor: 'turret',
      selectedHfov: 90,
      selectedVfov: 54,
      maxOpticalRangeMeters: 200,
      recommendedHeight: 8,
      recommendedTilt: 15
    }
  },
  {
    id: 'cam-02-godavari-bridge',
    name: 'CAM-02 — Godavari Bridge',
    position: { latitude: 17.004321, longitude: 81.813245, elevation: 22 },
    originalPosition: { latitude: 17.004321, longitude: 81.813245, elevation: 22 },
    mountingHeight: 9,
    heading: 90,
    tilt: 12,
    rangeMeters: 250,
    visible: true,
    color: '#F59E0B',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[1] || VERIFIED_CAMERA_MODELS[0],
      modelName: 'Dahua IPC-HFW5442E',
      manufacturer: 'Dahua',
      formFactor: 'bullet',
      selectedHfov: 80,
      selectedVfov: 48,
      maxOpticalRangeMeters: 250,
      recommendedHeight: 9,
      recommendedTilt: 12
    }
  },
  {
    id: 'cam-03-sp-office',
    name: 'CAM-03 — SP Office',
    position: { latitude: 17.012345, longitude: 81.805621, elevation: 16 },
    originalPosition: { latitude: 17.012345, longitude: 81.805621, elevation: 16 },
    mountingHeight: 7,
    heading: 180,
    tilt: 18,
    rangeMeters: 180,
    visible: true,
    color: '#10B981',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'Hikvision DS-2CD2047G2',
      manufacturer: 'Hikvision',
      formFactor: 'bullet',
      selectedHfov: 88,
      selectedVfov: 50,
      maxOpticalRangeMeters: 180,
      recommendedHeight: 7,
      recommendedTilt: 18
    }
  },
  {
    id: 'cam-04-lalacheruvu',
    name: 'CAM-04 — Lalacheruvu',
    position: { latitude: 17.016780, longitude: 81.799012, elevation: 18 },
    originalPosition: { latitude: 17.016780, longitude: 81.799012, elevation: 18 },
    mountingHeight: 6,
    heading: 45,
    tilt: 20,
    rangeMeters: 150,
    visible: false, // Offline
    color: '#EF4444',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'CP Plus CP-UNC-TA41L3',
      manufacturer: 'CP Plus',
      formFactor: 'turret',
      selectedHfov: 92,
      selectedVfov: 52,
      maxOpticalRangeMeters: 150,
      recommendedHeight: 6,
      recommendedTilt: 20
    }
  },
  {
    id: 'cam-05-diwancheruvu',
    name: 'CAM-05 — Diwancheruvu',
    position: { latitude: 16.998765, longitude: 81.808901, elevation: 15 },
    originalPosition: { latitude: 16.998765, longitude: 81.808901, elevation: 15 },
    mountingHeight: 8,
    heading: 270,
    tilt: 15,
    rangeMeters: 200,
    visible: true,
    color: '#10B981',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'Hikvision DS-2CD2347G2',
      manufacturer: 'Hikvision',
      formFactor: 'turret',
      selectedHfov: 90,
      selectedVfov: 54,
      maxOpticalRangeMeters: 200,
      recommendedHeight: 8,
      recommendedTilt: 15
    }
  },
  {
    id: 'cam-06-scott-barrels',
    name: 'CAM-06 — Scott Barrels',
    position: { latitude: 16.995432, longitude: 81.802345, elevation: 12 },
    originalPosition: { latitude: 16.995432, longitude: 81.802345, elevation: 12 },
    mountingHeight: 6.5,
    heading: 140,
    tilt: 16,
    rangeMeters: 160,
    visible: true,
    color: '#F59E0B',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'Dahua IPC-HDW5442T',
      manufacturer: 'Dahua',
      formFactor: 'turret',
      selectedHfov: 85,
      selectedVfov: 50,
      maxOpticalRangeMeters: 160,
      recommendedHeight: 6.5,
      recommendedTilt: 16
    }
  },
  {
    id: 'cam-07-rtc-complex',
    name: 'CAM-07 — RTC Complex',
    position: { latitude: 16.961234, longitude: 82.238901, elevation: 10 },
    originalPosition: { latitude: 16.961234, longitude: 82.238901, elevation: 10 },
    mountingHeight: 8.5,
    heading: 310,
    tilt: 14,
    rangeMeters: 220,
    visible: false, // Offline
    color: '#EF4444',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'CP Plus CP-UNC-TA41L3',
      manufacturer: 'CP Plus',
      formFactor: 'bullet',
      selectedHfov: 80,
      selectedVfov: 46,
      maxOpticalRangeMeters: 220,
      recommendedHeight: 8.5,
      recommendedTilt: 14
    }
  },
  {
    id: 'cam-08-kakinada-port',
    name: 'CAM-08 — Kakinada Port',
    position: { latitude: 16.955678, longitude: 82.246789, elevation: 6 },
    originalPosition: { latitude: 16.955678, longitude: 82.246789, elevation: 6 },
    mountingHeight: 10,
    heading: 80,
    tilt: 10,
    rangeMeters: 300,
    visible: false, // Offline
    color: '#EF4444',
    isLocked: true,
    specs: {
      ...VERIFIED_CAMERA_MODELS[0],
      modelName: 'Hikvision DS-2CD2047G2',
      manufacturer: 'Hikvision',
      formFactor: 'bullet',
      selectedHfov: 75,
      selectedVfov: 42,
      maxOpticalRangeMeters: 300,
      recommendedHeight: 10,
      recommendedTilt: 10
    }
  },
  // Additional 26 cameras completing the 34-camera network
  ...Array.from({ length: 26 }).map((_, i) => {
    const idx = i + 9;
    const pad = idx < 10 ? `0${idx}` : `${idx}`;
    // Spread around Rajahmundry riverfront and city center
    const latOffset = (Math.sin(i * 1.3) * 0.015);
    const lonOffset = (Math.cos(i * 1.1) * 0.018);
    const heading = (i * 45 + 30) % 360;
    const names = [
      'Kotilingala Ghat North', 'Pushkar Ghat Central', 'Saraswathi Ghat', 'Markandeya Temple Junction',
      'Syndicate Bank Circle', 'Stadium Road Corner', 'Kambala Tank Entrance', 'Subrahmanya Grounds Gate',
      'Devi Chowk Center', 'Danavaipeta Main Road', 'Innespeta 1st Cross', 'Alcot Gardens Junction',
      'Paper Mill Gate', 'Godavari Railway Station East', 'Havelock Bridge South', 'Dowleswaram Barrage Head',
      'Cotton Museum Entry', 'Vemagiri Junction Outer', 'Morampudi Ring Road', 'Bommuru Highway Bypass',
      'Quarry Market Signal', 'Aryapuram High Street', 'Prakash Nagar Roundabout', 'Tilak Road Corner',
      'Jawaharlal Nehru Road', 'Rajahmundry Municipal Gate'
    ];
    const models = [
      'Hikvision DS-2CD2347G2', 'Dahua IPC-HFW5442E', 'CP Plus CP-UNC-TA41L3', 'Hikvision DS-2CD2047G2', 'Axis P3245-V'
    ];
    const model = models[i % models.length];
    const isOnline = i % 10 !== 7; // occasional offline
    return {
      id: `cam-${pad}-rajahmundry`,
      name: `CAM-${pad} — ${names[i % names.length]}`,
      position: {
        latitude: Number((17.000497 + latOffset).toFixed(6)),
        longitude: Number((81.804008 + lonOffset).toFixed(6)),
        elevation: 14 + (i % 6)
      },
      originalPosition: {
        latitude: Number((17.000497 + latOffset).toFixed(6)),
        longitude: Number((81.804008 + lonOffset).toFixed(6)),
        elevation: 14 + (i % 6)
      },
      mountingHeight: 6 + (i % 5),
      heading,
      tilt: 14 + (i % 8),
      rangeMeters: 140 + (i % 4) * 30,
      visible: isOnline,
      color: isOnline ? '#10B981' : '#EF4444',
      isLocked: true,
      specs: {
        ...VERIFIED_CAMERA_MODELS[0],
        modelName: model,
        manufacturer: model.split(' ')[0],
        formFactor: model.includes('HFW') || model.includes('2047') ? 'bullet' : 'turret',
        selectedHfov: 85,
        selectedVfov: 50,
        maxOpticalRangeMeters: 140 + (i % 4) * 30,
        recommendedHeight: 6 + (i % 5),
        recommendedTilt: 14 + (i % 8)
      }
    } as Camera;
  })
];

export const DEFAULT_RECENT_PROJECTS: RecentProjectItem[] = [
  {
    id: 'proj-rajahmundry',
    name: 'Rajahmundry Pushkaralu CCTV Grid',
    filename: 'Rajahmundry_Pushkaralu.json',
    extension: 'json',
    date: 'Sep 28, 2026',
    cameraCount: 34,
    description: 'Riverfront temple ghats & pilgrim gathering surveillance',
    cameras: SAMPLE_CAMERAS_RAJAHMUNDRY
  },
  {
    id: 'proj-kakinada',
    name: 'Kakinada City Port Security',
    filename: 'Kakinada_City.kml',
    extension: 'kml',
    date: 'Sep 25, 2026',
    cameraCount: 32,
    description: 'Harbor perimeter and commercial district cameras',
    cameras: SAMPLE_CAMERAS_RAJAHMUNDRY.slice(0, 32)
  },
  {
    id: 'proj-godavari-bridge',
    name: 'Godavari Bridge Corridor',
    filename: 'Godavari_Bridge_Area.json',
    extension: 'json',
    date: 'Sep 20, 2026',
    cameraCount: 18,
    description: 'Bridge vehicular tracking and approach flyovers',
    cameras: SAMPLE_CAMERAS_RAJAHMUNDRY.slice(0, 18)
  },
  {
    id: 'proj-sp-office',
    name: 'SP Office Surroundings Security',
    filename: 'SP_Office_Surroundings.json',
    extension: 'json',
    date: 'Sep 18, 2026',
    cameraCount: 26,
    description: 'Administrative complex and police command monitoring',
    cameras: SAMPLE_CAMERAS_RAJAHMUNDRY.slice(0, 26)
  },
  {
    id: 'proj-main-city',
    name: 'Main City Traffic Junctions',
    filename: 'Main_City_CCTV.csv',
    extension: 'csv',
    date: 'Sep 15, 2026',
    cameraCount: 34,
    description: 'Major arterial intersections and traffic signals',
    cameras: SAMPLE_CAMERAS_RAJAHMUNDRY
  }
];
