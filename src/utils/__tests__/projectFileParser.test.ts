import { describe, it, expect } from 'vitest';
import { parseProjectText, dmsToDecimal } from '../projectFileParser';

describe('Project File Parser', () => {
  it('converts DMS coordinates to decimal degrees correctly', () => {
    // 40° 45' 28.8" N -> 40 + 45/60 + 28.8/3600 = 40.758
    const lat = dmsToDecimal(40, 45, 28.8, 'N');
    expect(lat).toBeCloseTo(40.758, 4);

    // 73° 59' 7.8" W -> -(73 + 59/60 + 7.8/3600) = -73.9855
    const lon = dmsToDecimal(73, 59, 7.8, 'W');
    expect(lon).toBeCloseTo(-73.9855, 4);
  });

  it('parses Plain Text with labeled camera coordinates', () => {
    const text = `
    Project: Downtown Surveillance Deployment
    Site survey notes:
    Camera 1 (Main Entrance): Lat: 40.7580, Lon: -73.9855, height: 6m, heading: 90
    Camera 2 (Loading Bay): Latitude: 40.7592, Longitude: -73.9841, mount: 4.5m, heading: 180
    North Perimeter Cam: lat: 40.7571, lon: -73.9862
    `;

    const result = parseProjectText(text, 'survey_notes.txt', 'txt');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(3);

    expect(result.cameras[0].name).toContain('Camera 1');
    expect(result.cameras[0].latitude).toBeCloseTo(40.758, 4);
    expect(result.cameras[0].longitude).toBeCloseTo(-73.9855, 4);
    expect(result.cameras[0].mountingHeight).toBe(6);
    expect(result.cameras[0].heading).toBe(90);

    expect(result.cameras[1].name).toContain('Camera 2');
    expect(result.cameras[1].mountingHeight).toBe(4.5);
    expect(result.cameras[1].heading).toBe(180);
  });

  it('parses Markdown tables with camera schedules', () => {
    const md = `
# Camera Installation Schedule

| Camera Name | Latitude | Longitude | Height (m) | Heading (deg) | Model |
| ----------- | -------- | --------- | ---------- | ------------- | ----- |
| Gate North  | 37.7749  | -122.4194 | 5.5        | 45            | 4K Bullet |
| South Yard  | 37.7758  | -122.4180 | 6.0        | 135           | PTZ Dome |
| East Alley  | 37.7742  | -122.4201 | 4.0        | 270           | Turret |
    `;

    const result = parseProjectText(md, 'schedule.md', 'md');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(3);

    expect(result.cameras[0].name).toBe('Gate North');
    expect(result.cameras[0].latitude).toBeCloseTo(37.7749, 4);
    expect(result.cameras[0].longitude).toBeCloseTo(-122.4194, 4);
    expect(result.cameras[0].mountingHeight).toBe(5.5);
    expect(result.cameras[0].heading).toBe(45);
    expect(result.cameras[0].modelName).toBe('4K Bullet');

    expect(result.cameras[1].name).toBe('South Yard');
    expect(result.cameras[1].mountingHeight).toBe(6.0);
    expect(result.cameras[1].heading).toBe(135);
  });

  it('parses CSV data with comma separation', () => {
    const csv = `name,lat,lon,height,heading
Gate 1,51.5074,-0.1278,5.0,0
Gate 2,51.5080,-0.1290,6.5,180
Gate 3,51.5065,-0.1265,4.5,90`;

    const result = parseProjectText(csv, 'cameras.csv', 'csv');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(3);
    expect(result.cameras[0].name).toBe('Gate 1');
    expect(result.cameras[0].latitude).toBeCloseTo(51.5074, 4);
    expect(result.cameras[0].longitude).toBeCloseTo(-0.1278, 4);
    expect(result.cameras[1].mountingHeight).toBe(6.5);
  });

  it('parses KML placemarks from Google Earth exports', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Intersection Cam A</name>
      <Point>
        <coordinates>-73.9855,40.7580,12.5</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Intersection Cam B</name>
      <Point>
        <coordinates>-73.9840,40.7590,14.0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

    const result = parseProjectText(kml, 'earth_placemarks.kml', 'kml');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(2);
    expect(result.cameras[0].name).toBe('Intersection Cam A');
    expect(result.cameras[0].latitude).toBeCloseTo(40.758, 4);
    expect(result.cameras[0].longitude).toBeCloseTo(-73.9855, 4);
    expect(result.cameras[0].elevation).toBe(12.5);
  });

  it('parses GeoJSON Point features', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Perimeter 1', height: 6.0, heading: 270 },
          geometry: { type: 'Point', coordinates: [-73.9855, 40.7580, 0] }
        }
      ]
    });

    const result = parseProjectText(geojson, 'plan.geojson', 'geojson');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(1);
    expect(result.cameras[0].name).toBe('Perimeter 1');
    expect(result.cameras[0].latitude).toBeCloseTo(40.758, 4);
    expect(result.cameras[0].longitude).toBeCloseTo(-73.9855, 4);
    expect(result.cameras[0].mountingHeight).toBe(6.0);
    expect(result.cameras[0].heading).toBe(270);
  });

  it('deduplicates duplicate coordinates in the document', () => {
    const text = `
    Camera 1: 40.758000, -73.985500
    Camera 1 Duplicate: 40.758000, -73.985500
    Camera 2: 40.759000, -73.984000
    `;

    const result = parseProjectText(text, 'duplicates.txt', 'txt');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(2);
  });

  it('parses headerless CSV with camera names and coordinates', () => {
    const csv = `Approach Lane Cam 1, 16.990510, 81.775710
Approach Lane Cam 2, 16.991200, 81.776500`;

    const result = parseProjectText(csv, 'cameras.csv', 'csv');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(2);
    expect(result.cameras[0].name).toBe('Approach Lane Cam 1');
    expect(result.cameras[0].latitude).toBeCloseTo(16.99051, 5);
    expect(result.cameras[0].longitude).toBeCloseTo(81.77571, 5);
    expect(result.cameras[0].tilt).toBe(18); // Approach lane tilt
    expect(result.cameras[0].rangeMeters).toBe(45); // Approach lane range
    expect(result.cameras[0].mountingHeight).toBe(6.0); // Approach lane height

    expect(result.cameras[1].name).toBe('Approach Lane Cam 2');
  });

  it('parses files with trailing camera names after coordinates', () => {
    const text = `16.990510, 81.775710, South Gate Approach
16.992000, 81.778000, North Highway Approach`;

    const result = parseProjectText(text, 'project.txt', 'txt');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(2);
    expect(result.cameras[0].name).toBe('South Gate Approach');
    expect(result.cameras[0].latitude).toBeCloseTo(16.99051, 5);
    expect(result.cameras[0].longitude).toBeCloseTo(81.77571, 5);
    expect(result.cameras[1].name).toBe('North Highway Approach');
  });

  it('parses CSV with ID column and alternate coordinate headers', () => {
    const csv = `ID,Lat,Long
CAM-01,16.990510,81.775710
CAM-02,16.991500,81.776200`;

    const result = parseProjectText(csv, 'cctv_plan.csv', 'csv');
    expect(result.success).toBe(true);
    expect(result.cameras.length).toBe(2);
    expect(result.cameras[0].name).toBe('CAM-01');
    expect(result.cameras[1].name).toBe('CAM-02');
  });

  it('handles empty or coordinate-less files gracefully', () => {
    const text = 'This document has no coordinates or camera specs at all.';
    const result = parseProjectText(text, 'notes.txt', 'txt');
    expect(result.success).toBe(false);
    expect(result.cameras.length).toBe(0);
    expect(result.error).toBeDefined();
  });
});

