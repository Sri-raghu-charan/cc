import { describe, it, expect } from 'vitest';
import {
  VERIFIED_CAMERA_MODELS,
  CAMERA_SPECIFICATIONS,
  cameraSpecifications,
  getCameraSpecification,
  getCameraSpecificationsByManufacturer
} from '../../data/cameraModels';

describe('Verified Camera Models Real-World Specifications', () => {
  it('should have comprehensive models from major manufacturers including EQuiVision and PTZ', () => {
    expect(CAMERA_SPECIFICATIONS.length).toBeGreaterThanOrEqual(23);
    expect(cameraSpecifications).toBe(CAMERA_SPECIFICATIONS);
    expect(VERIFIED_CAMERA_MODELS).toBe(CAMERA_SPECIFICATIONS);

    const brands = new Set(CAMERA_SPECIFICATIONS.map((m) => m.manufacturer));
    expect(brands.has('EQuiVision')).toBe(true);
    expect(brands.has('Hikvision')).toBe(true);
    expect(brands.has('Axis Communications')).toBe(true);
    expect(brands.has('Dahua Technology')).toBe(true);
    expect(brands.has('Hanwha Vision')).toBe(true);
    expect(brands.has('Bosch Security')).toBe(true);
    expect(brands.has('Uniview (UNV)')).toBe(true);
  });

  it('should include specific EQuiVision models with exact real-world ranges', () => {
    const equivisionModels = getCameraSpecificationsByManufacturer('EQuiVision');
    expect(equivisionModels.length).toBeGreaterThanOrEqual(3);

    const ev60m = getCameraSpecification('equivision-ev-60m-4k');
    expect(ev60m).toBeDefined();
    expect(ev60m!.rangeMeters).toBe(60);
    expect(ev60m!.horizontalFovDegrees).toBe(90);
    expect(ev60m!.type).toBe('bullet');

    const evPtz = getCameraSpecification('equivision-ev-100ptz');
    expect(evPtz).toBeDefined();
    expect(evPtz!.type).toBe('ptz');
    expect(evPtz!.rangeMeters).toBe(100);
    expect(evPtz!.opticalZoom).toBe(30);
  });

  it('should include PTZ models with pan, tilt, and optical zoom specifications', () => {
    const ptzModels = CAMERA_SPECIFICATIONS.filter((m) => m.type === 'ptz' || m.formFactor === 'ptz');
    expect(ptzModels.length).toBeGreaterThanOrEqual(3);

    for (const ptz of ptzModels) {
      expect(ptz.rangeMeters).toBeGreaterThanOrEqual(100);
      expect(ptz.opticalZoom).toBeGreaterThanOrEqual(20);
      expect(ptz.lensType).toBe('motorized_zoom');
    }
  });

  it('should have valid optical range in meters and FOV in degrees for every model', () => {
    for (const model of CAMERA_SPECIFICATIONS) {
      expect(model.id).toBeDefined();
      expect(model.model).toBeDefined();
      expect(model.type).toBeDefined();
      expect(model.resolution).toBeDefined();
      expect(model.rangeMeters).toBeGreaterThan(0);
      expect(model.rangeMeters).toBeLessThanOrEqual(2500); // realistic PTZ / Long Range max
      expect(model.horizontalFovDegrees).toBeGreaterThan(5);
      expect(model.horizontalFovDegrees).toBeLessThanOrEqual(180);
      expect(model.verticalFovDegrees).toBeGreaterThan(3);
      expect(model.verticalFovDegrees).toBeLessThanOrEqual(180);
      expect(model.resolutionWidth).toBeGreaterThanOrEqual(1280);
      expect(model.resolutionHeight).toBeGreaterThanOrEqual(720);
      expect(model.sensorSize).toBeDefined();
    }
  });

  it('should have valid datasheet DORI metrics following EN 62676-4 order (detect >= observe >= recognize >= identify)', () => {
    for (const model of CAMERA_SPECIFICATIONS) {
      expect(model.datasheetDori).toBeDefined();
      const dori = model.datasheetDori!;
      expect(dori.detectMeters).toBeGreaterThan(0);
      expect(dori.observeMeters).toBeGreaterThan(0);
      expect(dori.recognizeMeters).toBeGreaterThan(0);
      expect(dori.identifyMeters).toBeGreaterThan(0);

      // Detection must be farthest, Identification closest
      expect(dori.detectMeters).toBeGreaterThanOrEqual(dori.observeMeters);
      expect(dori.observeMeters).toBeGreaterThanOrEqual(dori.recognizeMeters);
      expect(dori.recognizeMeters).toBeGreaterThanOrEqual(dori.identifyMeters);
    }
  });

  it('should have realistic recommended installation height and tilt angle', () => {
    for (const model of CAMERA_SPECIFICATIONS) {
      expect(model.recommendedHeight).toBeGreaterThanOrEqual(2);
      expect(model.recommendedHeight).toBeLessThanOrEqual(25);
      expect(model.recommendedTilt).toBeGreaterThanOrEqual(5);
      expect(model.recommendedTilt).toBeLessThanOrEqual(60);
    }
  });

  it('should have consistent varifocal properties for zoom models', () => {
    const varifocalModels = CAMERA_SPECIFICATIONS.filter(
      (m) => m.lensType === 'motorized_zoom' || (m.focalLengthMax && m.focalLengthMax > (m.focalLengthMin || 0))
    );
    expect(varifocalModels.length).toBeGreaterThan(0);

    for (const model of varifocalModels) {
      expect(model.focalLengthMin).toBeDefined();
      expect(model.focalLengthMax).toBeDefined();
      expect(model.focalLengthMax).toBeGreaterThan(model.focalLengthMin!);
      expect(model.hfovMin).toBeDefined();
      expect(model.hfovMax).toBeDefined();
      expect(model.hfovMax).toBeGreaterThan(model.hfovMin!);
    }
  });
});
