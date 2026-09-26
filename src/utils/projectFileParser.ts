/**
/**
 * Universal Project File Parser for CCTV GeoPlanner
 * Supports: PDF, DOC, DOCX, TXT, MD, CSV, TSV, JSON, GEOJSON, KML
 * Automatically extracts camera names, WGS84 coordinates, mounting heights,
 * headings, and specifications from any document format.
 */

export interface ParsedCamera {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  mountingHeight?: number;
  heading?: number;
  tilt?: number;
  rangeMeters?: number;
  modelName?: string;
  specs?: any;
  notes?: string;
}


export interface ParsedProjectFileResult {
  success: boolean;
  filename: string;
  fileType: string;
  cameras: ParsedCamera[];
  projectName?: string;
  notes?: string;
  error?: string;
  rawTextPreview?: string;
}

// Helper: Convert Degrees Minutes Seconds (DMS) to Decimal Degrees
export function dmsToDecimal(degrees: number, minutes: number, seconds: number, hemisphere: string): number {
  let dd = degrees + minutes / 60 + seconds / 3600;
  const h = hemisphere.toUpperCase();
  if (h === 'S' || h === 'W') {
    dd = -dd;
  }
  return Number(dd.toFixed(7));
}

/**
 * Universal entry point to parse a File or Blob
 */
export async function parseProjectFile(file: File): Promise<ParsedProjectFileResult> {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  try {
    let extractedText = '';

    if (['txt', 'md', 'csv', 'tsv', 'json', 'geojson', 'kml', 'xml'].includes(ext)) {
      extractedText = await file.text();
    } else if (ext === 'docx') {
      extractedText = await extractTextFromDocx(file);
    } else if (ext === 'pdf') {
      extractedText = await extractTextFromPdf(file);
    } else if (ext === 'doc') {
      extractedText = await extractTextFromDoc(file);
    } else {
      // Fallback: try reading as UTF-8 text first, then binary string
      try {
        extractedText = await file.text();
      } catch {
        const buffer = await file.arrayBuffer();
        extractedText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      }
    }

    return parseProjectText(extractedText, filename, ext);
  } catch (err: any) {
    console.error('Error parsing project file:', err);
    return {
      success: false,
      filename,
      fileType: ext,
      cameras: [],
      error: `Failed to process ${filename}: ${err.message || 'Unknown error'}`
    };
  }
}

/**
 * Parses raw text extracted from any file into structured cameras
 */
export function parseProjectText(rawText: string, filename: string = 'project_file', fileType: string = 'txt'): ParsedProjectFileResult {
  const cleanText = rawText.trim();
  if (!cleanText) {
    return {
      success: false,
      filename,
      fileType,
      cameras: [],
      error: 'The uploaded file is empty or contains no readable text.'
    };
  }

  // 1. Try JSON / GeoJSON parsing
  if (fileType === 'json' || fileType === 'geojson' || cleanText.startsWith('{') || cleanText.startsWith('[')) {
    try {
      const json = JSON.parse(cleanText);

      // A. Standard CCTV GeoPlanner Project Export
      if (json && Array.isArray(json.cameras) && json.cameras.length > 0) {
        const cameras: ParsedCamera[] = json.cameras
          .filter((c: any) => c.position && typeof c.position.latitude === 'number' && typeof c.position.longitude === 'number')
          .map((c: any, idx: number) => ({
            name: cleanCameraName(c.name, idx + 1),
            latitude: Number(c.position.latitude.toFixed(7)),
            longitude: Number(c.position.longitude.toFixed(7)),
            elevation: c.position.elevation || 0,
            mountingHeight: c.mountingHeight || 6.0,
            heading: c.heading || 0,
            tilt: c.tilt || 18,
            rangeMeters: c.rangeMeters || 45,
            modelName: c.specs?.modelName
          }));

        if (cameras.length > 0) {
          return {
            success: true,
            filename,
            fileType: 'json',
            projectName: json.name || json.projectName || filename.replace(/\.[^/.]+$/, ''),
            cameras,
            rawTextPreview: cleanText.substring(0, 300)
          };
        }
      }

      // B. GeoJSON FeatureCollection
      if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
        const cameras: ParsedCamera[] = [];
        json.features.forEach((f: any, idx: number) => {
          if (f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
            const [lon, lat, alt] = f.geometry.coordinates;
            if (typeof lat === 'number' && typeof lon === 'number') {
              cameras.push({
                name: cleanCameraName(f.properties?.name || f.properties?.title || f.properties?.id, idx + 1),
                latitude: Number(lat.toFixed(7)),
                longitude: Number(lon.toFixed(7)),
                elevation: typeof alt === 'number' ? alt : (f.properties?.elevation || 0),
                mountingHeight: f.properties?.mountingHeight || f.properties?.height || 6.0,
                heading: f.properties?.heading || f.properties?.bearing || 0,
                tilt: f.properties?.tilt || 18,
                rangeMeters: f.properties?.rangeMeters || 45
              });
            }
          }
        });

        if (cameras.length > 0) {
          return {
            success: true,
            filename,
            fileType: 'geojson',
            projectName: json.name || filename.replace(/\.[^/.]+$/, ''),
            cameras,
            rawTextPreview: cleanText.substring(0, 300)
          };
        }
      }

      // C. Generic Array of Camera Objects
      if (Array.isArray(json)) {
        const cameras: ParsedCamera[] = [];
        json.forEach((item: any, idx: number) => {
          const lat = item.latitude ?? item.lat ?? item.position?.latitude;
          const lon = item.longitude ?? item.lon ?? item.lng ?? item.position?.longitude;
          if (typeof lat === 'number' && typeof lon === 'number') {
            cameras.push({
              name: cleanCameraName(item.name || item.cameraName || item.camName || item.label || item.id || item.title || item.tag, idx + 1),
              latitude: Number(lat.toFixed(7)),
              longitude: Number(lon.toFixed(7)),
              elevation: item.elevation ?? item.alt ?? item.position?.elevation ?? 0,
              mountingHeight: item.mountingHeight ?? item.height ?? 6.0,
              heading: item.heading ?? item.bearing ?? 0,
              tilt: item.tilt ?? 18,
              rangeMeters: item.rangeMeters ?? 45,
              modelName: item.model || item.modelName
            });
          }
        });

        if (cameras.length > 0) {
          return {
            success: true,
            filename,
            fileType: 'json',
            cameras,
            rawTextPreview: cleanText.substring(0, 300)
          };
        }
      }
    } catch {
      // Continue to regex text parser
    }
  }

  // 2. Try KML Placemark parsing
  if (cleanText.includes('<Placemark') || cleanText.includes('<coordinates>')) {
    const kmlCameras: ParsedCamera[] = [];
    const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
    let pmMatch: RegExpExecArray | null;

    while ((pmMatch = placemarkRegex.exec(cleanText)) !== null) {
      const pmBlock = pmMatch[0];
      const nameMatch = pmBlock.match(/<name>([^<]+)<\/name>/i);
      const coordMatch = pmBlock.match(/<coordinates>\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)(?:\s*,\s*([-+]?\d+\.?\d*))?\s*<\/coordinates>/i);

      if (coordMatch) {
        // KML order is lon,lat,alt
        const lon = parseFloat(coordMatch[1]);
        const lat = parseFloat(coordMatch[2]);
        const alt = coordMatch[3] ? parseFloat(coordMatch[3]) : 0;

        if (isValidCoord(lat, lon)) {
          kmlCameras.push({
            name: nameMatch ? cleanCameraName(nameMatch[1].trim(), kmlCameras.length + 1) : `Camera ${kmlCameras.length + 1}`,
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: alt,
            mountingHeight: 6.0,
            heading: 0,
            tilt: 18,
            rangeMeters: 45
          });
        }
      }
    }

    if (kmlCameras.length > 0) {
      return {
        success: true,
        filename,
        fileType: 'kml',
        cameras: kmlCameras,
        rawTextPreview: cleanText.substring(0, 300)
      };
    }
  }

  // 3. Line-by-line Smart Extraction for CSV, Markdown tables, and Unstructured Text
  const lines = cleanText.split(/\r?\n/);
  const detectedCameras: ParsedCamera[] = [];

  // Check for CSV / Markdown table header
  let colIndices = {
    name: -1,
    lat: -1,
    lon: -1,
    height: -1,
    heading: -1,
    elevation: -1,
    model: -1
  };

  const headerLineIdx = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return (
      (lower.includes('lat') && (lower.includes('lon') || lower.includes('lng') || lower.includes('long'))) ||
      (lower.includes('latitude') && lower.includes('longitude'))
    );
  });

  if (headerLineIdx !== -1) {
    const headerLine = lines[headerLineIdx];
    const delimiter = headerLine.includes('\t')
      ? '\t'
      : headerLine.includes('|')
      ? '|'
      : headerLine.includes(';')
      ? ';'
      : ',';

    const cols = headerLine
      .split(delimiter)
      .map((c) => c.trim().toLowerCase().replace(/['"_-]/g, ''));

    cols.forEach((col, idx) => {
      if (
        col.includes('name') ||
        col.includes('camera') ||
        col.includes('cam') ||
        col.includes('label') ||
        col.includes('id') ||
        col.includes('tag') ||
        col.includes('device') ||
        col.includes('pole') ||
        col.includes('point') ||
        col.includes('location') ||
        col.includes('title') ||
        col.includes('site') ||
        col.includes('asset') ||
        col.includes('desc') ||
        col.includes('cctv') ||
        col.includes('ident')
      ) {
        if (colIndices.name === -1) colIndices.name = idx;
      } else if (col.includes('latitude') || col === 'lat') {
        colIndices.lat = idx;
      } else if (col.includes('longitude') || col === 'lon' || col === 'lng' || col === 'long') {
        colIndices.lon = idx;
      } else if (col.includes('height') || col.includes('mount') || col.includes('pole')) {
        colIndices.height = idx;
      } else if (col.includes('heading') || col.includes('bearing') || col.includes('yaw') || col.includes('angle') || col.includes('facing')) {
        colIndices.heading = idx;
      } else if (col.includes('elev') || col.includes('alt')) {
        colIndices.elevation = idx;
      } else if (col.includes('model')) {
        colIndices.model = idx;
      }
    });

    // If no explicit name column header, search for any text column that isn't lat/lon/height/heading/elevation/model
    if (colIndices.name === -1) {
      for (let c = 0; c < cols.length; c++) {
        if (
          c !== colIndices.lat &&
          c !== colIndices.lon &&
          c !== colIndices.height &&
          c !== colIndices.heading &&
          c !== colIndices.elevation &&
          c !== colIndices.model
        ) {
          colIndices.name = c;
          break;
        }
      }
    }

    if (colIndices.lat !== -1 && colIndices.lon !== -1) {
      for (let i = headerLineIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('|-') || line.startsWith('---')) continue;

        const row = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const lat = parseFloat(row[colIndices.lat]);
        const lon = parseFloat(row[colIndices.lon]);

        if (isValidCoord(lat, lon)) {
          const rawName = colIndices.name !== -1 && row[colIndices.name] ? row[colIndices.name] : '';
          const name = cleanCameraName(rawName, detectedCameras.length + 1);
          const height = colIndices.height !== -1 ? parseFloat(row[colIndices.height]) : 6.0;
          const heading = colIndices.heading !== -1 ? parseFloat(row[colIndices.heading]) : 0;
          const elev = colIndices.elevation !== -1 ? parseFloat(row[colIndices.elevation]) : 0;

          // All cameras strictly default to Approach Lane Tracking specs (45m range, 18° tilt, 6m ht)
          detectedCameras.push({
            name,
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: isNaN(elev) ? 0 : elev,
            mountingHeight: isNaN(height) || height <= 0 ? 6.0 : height,
            heading: isNaN(heading) ? 0 : heading,
            tilt: 18,
            rangeMeters: 45,
            modelName: colIndices.model !== -1 ? row[colIndices.model] : undefined
          });
        }
      }
    }
  }

  // 4. Smart Line-by-Line & Delimiter Scanner (For headerless CSVs, TSVs, and lists)
  if (detectedCameras.length === 0) {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || (line.startsWith('#') && !line.includes('.'))) continue;

      // A. Check for labeled coordinates: Camera Name: Lat: 40.7580, Lon: -73.9855
      const labeledMatch = line.match(/(?:([^\n,;|()]+?)\s*[:=-]\s*)?(?:lat(?:itude)?\s*[:=\s]\s*([-+]?\d{1,2}\.\d+))[,\s/|;]+(?:lon(?:gitude)?|lng)\s*[:=\s]\s*([-+]?\d{1,3}\.\d+)/i);
      if (labeledMatch) {
        const candidateName = labeledMatch[1]?.trim();
        const lat = parseFloat(labeledMatch[2]);
        const lon = parseFloat(labeledMatch[3]);
        if (isValidCoord(lat, lon)) {
          detectedCameras.push({
            name: cleanCameraName(candidateName, detectedCameras.length + 1),
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: 0,
            mountingHeight: extractHeightFromSnippet(line),
            heading: extractHeadingFromSnippet(line),
            tilt: 18,
            rangeMeters: 45
          });
          continue;
        }
      }

      // B. Check for delimited line (comma, tab, semicolon, pipe)
      const delims = [',', '\t', ';', '|'];
      let foundInDelim = false;
      for (const d of delims) {
        if (!line.includes(d)) continue;
        const tokens = line.split(d).map((t) => t.trim().replace(/^["']|["']$/g, ''));
        if (tokens.length < 2) continue;

        let latIdx = -1;
        let lonIdx = -1;
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i].trim();
          if (/^[-+]?\d{1,3}(?:\.\d+)?$/.test(t)) {
            const num = parseFloat(t);
            if (latIdx === -1 && num >= -90 && num <= 90 && t.includes('.')) {
              latIdx = i;
            } else if (lonIdx === -1 && num >= -180 && num <= 180 && t.includes('.')) {
              lonIdx = i;
            }
          }
        }

        if (latIdx !== -1 && lonIdx !== -1 && latIdx !== lonIdx) {
          const lat = parseFloat(tokens[latIdx]);
          const lon = parseFloat(tokens[lonIdx]);

          if (isValidCoord(lat, lon)) {
            // Find candidate camera name in remaining tokens
            let candidateName = '';
            for (let i = 0; i < tokens.length; i++) {
              if (i !== latIdx && i !== lonIdx) {
                const token = tokens[i];
                if (/^\d+(?:\.\d+)?\s*m$/i.test(token)) continue; // skip heights
                if (token.length > 0 && !/^[-\d.]+$/.test(token)) {
                  candidateName = token;
                  break;
                }
              }
            }
            // If tokens are numeric-like IDs (e.g. "01", "101"), use the first non-coord token
            if (!candidateName) {
              for (let i = 0; i < tokens.length; i++) {
                if (i !== latIdx && i !== lonIdx && tokens[i].length > 0) {
                  candidateName = tokens[i];
                  break;
                }
              }
            }

            detectedCameras.push({
              name: cleanCameraName(candidateName, detectedCameras.length + 1),
              latitude: Number(lat.toFixed(7)),
              longitude: Number(lon.toFixed(7)),
              elevation: 0,
              mountingHeight: extractHeightFromSnippet(line),
              heading: extractHeadingFromSnippet(line),
              tilt: 18,
              rangeMeters: 45
            });
            foundInDelim = true;
            break;
          }
        }
      }

      if (foundInDelim) continue;

      // C. Regex on line: Camera Name: lat, lon  OR  lat, lon (Camera Name)  OR  Camera Name - lat, lon
      const coordMatch = line.match(/([-+]?\d{1,2}\.\d{3,8})[,\s/|;]+([-+]?\d{1,3}\.\d{3,8})/);
      if (coordMatch && coordMatch.index !== undefined) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (isValidCoord(lat, lon)) {
          const before = line.substring(0, coordMatch.index).trim();
          const after = line.substring(coordMatch.index + coordMatch[0].length).trim();

          let candidate = '';
          const beforeCleaned = before.replace(/^[\d+.)\s-]+/, '').trim();
          const afterCleaned = after.replace(/^[,\s/|;()-]+|[,\s/|;()-]+$/g, '').trim();

          if (beforeCleaned.length > 0 && !/^(?:lat|latitude)[:=\s]/i.test(beforeCleaned)) {
            candidate = beforeCleaned;
          } else if (afterCleaned.length > 0 && !/^\d+(?:\.\d+)?\s*m$/i.test(afterCleaned)) {
            candidate = afterCleaned;
          }

          detectedCameras.push({
            name: cleanCameraName(candidate, detectedCameras.length + 1),
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: 0,
            mountingHeight: extractHeightFromSnippet(line),
            heading: extractHeadingFromSnippet(line),
            tilt: 18,
            rangeMeters: 45
          });
        }
      }
    }
  }

  // 5. Free-form Document Scanner (Fallback for multi-line documents)
  if (detectedCameras.length === 0) {
    // Regex Patterns for Coordinates
    // A. Labeled: Lat: 40.7580, Lon: -73.9855
    const labeledRegex = /(?:([^\n,;|()]+?)\s*[:=-]\s*)?(?:lat(?:itude)?\s*[:=\s]\s*([-+]?\d{1,2}\.\d+))[,\s/|;]+(?:lon(?:gitude)?|lng)\s*[:=\s]\s*([-+]?\d{1,3}\.\d+)/gi;

    let m: RegExpExecArray | null;
    while ((m = labeledRegex.exec(cleanText)) !== null) {
      const candidateName = m[1]?.trim();
      const lat = parseFloat(m[2]);
      const lon = parseFloat(m[3]);

      if (isValidCoord(lat, lon)) {
        const lastNewline = cleanText.lastIndexOf('\n', m.index);
        const nextNewline = cleanText.indexOf('\n', m.index + m[0].length);
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const lineEnd = nextNewline === -1 ? cleanText.length : nextNewline;
        const lineSnippet = cleanText.substring(lineStart, lineEnd);

        const height = extractHeightFromSnippet(lineSnippet);
        const heading = extractHeadingFromSnippet(lineSnippet);

        detectedCameras.push({
          name: cleanCameraName(candidateName, detectedCameras.length + 1),
          latitude: Number(lat.toFixed(7)),
          longitude: Number(lon.toFixed(7)),
          elevation: 0,
          mountingHeight: height,
          heading: heading,
          tilt: 18,
          rangeMeters: 45
        });
      }
    }

    // B. Google Earth / Maps URL in document: @lat,lon
    if (detectedCameras.length === 0) {
      const urlCoordRegex = /@(-?\d{1,2}\.\d{4,8}),(-?\d{1,3}\.\d{4,8})/g;
      while ((m = urlCoordRegex.exec(cleanText)) !== null) {
        const lat = parseFloat(m[1]);
        const lon = parseFloat(m[2]);
        if (isValidCoord(lat, lon)) {
          const preText = cleanText.substring(Math.max(0, m.index - 40), m.index);
          const nameMatch = preText.match(/(?:cam(?:era)?\s*\w+|[A-Za-z0-9\s_-]{3,20}):?/i);

          detectedCameras.push({
            name: cleanCameraName(nameMatch ? nameMatch[0].replace(/[:]/g, '').trim() : undefined, detectedCameras.length + 1),
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: 0,
            mountingHeight: 6.0,
            heading: 0,
            tilt: 18,
            rangeMeters: 45
          });
        }
      }
    }

    // C. DMS: 40°45'28.8"N 73°59'07.8"W
    if (detectedCameras.length === 0) {
      const dmsRegex = /(\d{1,2})[°\s]+(\d{1,2})['′\s]+([\d.]+)[″"]?\s*([NSns])[,\s]+(\d{1,3})[°\s]+(\d{1,2})['′\s]+([\d.]+)[″"]?\s*([EWew])/g;
      while ((m = dmsRegex.exec(cleanText)) !== null) {
        const lat = dmsToDecimal(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), m[4]);
        const lon = dmsToDecimal(parseFloat(m[5]), parseFloat(m[6]), parseFloat(m[7]), m[8]);

        if (isValidCoord(lat, lon)) {
          const preText = cleanText.substring(Math.max(0, m.index - 50), m.index);
          const nameMatch = preText.match(/(?:cam(?:era)?\s*\w+|[A-Za-z0-9\s_-]{3,20}):?/i);

          detectedCameras.push({
            name: cleanCameraName(nameMatch ? nameMatch[0].replace(/[:]/g, '').trim() : undefined, detectedCameras.length + 1),
            latitude: lat,
            longitude: lon,
            elevation: 0,
            mountingHeight: 6.0,
            heading: 0,
            tilt: 18,
            rangeMeters: 45
          });
        }
      }
    }

    // D. Decimal coordinate pairs: 40.7580, -73.9855
    if (detectedCameras.length === 0) {
      const decimalRegex = /(?:([^\n,;|()]+?)\s*[:=-]\s*)?([-+]?\d{1,2}\.\d{4,8})[,\s/|;]+([-+]?\d{1,3}\.\d{4,8})/g;
      while ((m = decimalRegex.exec(cleanText)) !== null) {
        const candidateName = m[1]?.trim();
        const lat = parseFloat(m[2]);
        const lon = parseFloat(m[3]);

        if (isValidCoord(lat, lon)) {
          const lastNewline = cleanText.lastIndexOf('\n', m.index);
          const nextNewline = cleanText.indexOf('\n', m.index + m[0].length);
          const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
          const lineEnd = nextNewline === -1 ? cleanText.length : nextNewline;
          const lineSnippet = cleanText.substring(lineStart, lineEnd);

          const height = extractHeightFromSnippet(lineSnippet);
          const heading = extractHeadingFromSnippet(lineSnippet);

          detectedCameras.push({
            name: cleanCameraName(candidateName, detectedCameras.length + 1),
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lon.toFixed(7)),
            elevation: 0,
            mountingHeight: height,
            heading: heading,
            tilt: 18,
            rangeMeters: 45
          });
        }
      }
    }
  }

  // Deduplicate cameras at exact identical coordinates
  const uniqueCameras: ParsedCamera[] = [];
  detectedCameras.forEach((cam) => {
    const isDup = uniqueCameras.some(
      (u) => Math.abs(u.latitude - cam.latitude) < 0.000005 && Math.abs(u.longitude - cam.longitude) < 0.000005
    );
    if (!isDup) {
      uniqueCameras.push(cam);
    }
  });

  if (uniqueCameras.length === 0) {
    return {
      success: false,
      filename,
      fileType,
      cameras: [],
      error: 'No valid camera coordinates were detected in this document. Ensure the file contains camera names and coordinates (e.g., "Camera 1: 40.7580, -73.9855, height: 6m").',
      rawTextPreview: cleanText.substring(0, 400)
    };
  }

  return {
    success: true,
    filename,
    fileType,
    projectName: filename.replace(/\.[^/.]+$/, ''),
    cameras: uniqueCameras,
    rawTextPreview: cleanText.substring(0, 300)
  };
}

// Helpers
function isValidCoord(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0);
}

export function cleanCameraName(raw: string | undefined, defaultIndex: number): string {
  if (!raw) return `Camera ${defaultIndex}`;
  let cleaned = raw
    .replace(/[#*`"']/g, '')
    .replace(/^[-*•\s:,|;()]+/, '')
    .replace(/[-*•\s:,|;()]+$/, '')
    .trim();

  // Strip leading list numbering like "1. " or "1) " or "1 - " if followed by text
  const listNumMatch = cleaned.match(/^\d+[\.\)\-]\s*(.+)$/);
  if (listNumMatch && listNumMatch[1].trim()) {
    cleaned = listNumMatch[1].trim();
  }

  // Strip leading "Camera: " or "Cam: " if followed by text (e.g., "Camera: Gate 1" -> "Gate 1")
  // Do not strip dashed ID tags like "CAM-01" or "CAM_01"
  const prefixMatch = cleaned.match(/^(?:camera|cam)\s*[:=]\s*(.+)$/i) || cleaned.match(/^(?:camera|cam)\s+[-]\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1].trim()) {
    cleaned = prefixMatch[1].trim();
  }

  // Strip trailing coordinate labels if leaked
  cleaned = cleaned.replace(/\s*(?:lat|latitude|lon|longitude|elevation|height)[:=\s]*.*$/i, '').trim();

  if (cleaned.length < 1 || cleaned.length > 100) {
    return `Camera ${defaultIndex}`;
  }
  return cleaned;
}


function extractHeightFromSnippet(text: string): number {
  const hMatch = text.match(/(?:height|mount|pole|elevation|alt|elev)[:=\s]*(\d+(?:\.\d+)?)\s*m?\b/i);
  if (hMatch) {
    const h = parseFloat(hMatch[1]);
    if (!isNaN(h) && h > 0.5 && h < 100) return h;
  }
  return 6.0;
}

function extractHeadingFromSnippet(text: string): number {
  const headMatch = text.match(/(?:heading|bearing|yaw|angle|facing|direction)[:=\s]*(\d+(?:\.\d+)?)\b/i);
  if (headMatch) {
    const head = parseFloat(headMatch[1]);
    if (!isNaN(head)) return (head % 360 + 360) % 360;
  }
  // Check cardinal directions
  if (/\b(?:north|pointing\s+north)\b/i.test(text)) return 0;
  if (/\b(?:east|pointing\s+east)\b/i.test(text)) return 90;
  if (/\b(?:south|pointing\s+south)\b/i.test(text)) return 180;
  if (/\b(?:west|pointing\s+west)\b/i.test(text)) return 270;
  return 0;
}

/**
 * Text extraction for DOCX (Word XML)
 */
async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // In DOCX, word/document.xml contains the text.
  // Search for the local file header signature 0x04034b50 and find word/document.xml
  let docXmlContent = '';

  for (let i = 0; i < bytes.length - 30; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
      const compression = bytes[i + 8] | (bytes[i + 9] << 8);
      const compressedSize = bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24);
      const nameLength = bytes[i + 26] | (bytes[i + 27] << 8);
      const extraLength = bytes[i + 28] | (bytes[i + 29] << 8);

      const nameBytes = bytes.slice(i + 30, i + 30 + nameLength);
      const entryName = new TextDecoder().decode(nameBytes);

      if (entryName === 'word/document.xml') {
        const dataStart = i + 30 + nameLength + extraLength;
        const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

        if (compression === 0) {
          // Stored
          docXmlContent = new TextDecoder('utf-8').decode(compressedData);
          break;
        } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
          // Deflated - decompress natively via browser DecompressionStream
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressedData);
            writer.close();
            const response = new Response(ds.readable);
            docXmlContent = await response.text();
            break;
          } catch (e) {
            console.warn('DOCX deflate stream error:', e);
          }
        }
      }
    }
  }

  if (docXmlContent) {
    // Extract text from <w:t> tags
    const textPieces: string[] = [];
    const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/gi;
    let match: RegExpExecArray | null;
    while ((match = wtRegex.exec(docXmlContent)) !== null) {
      textPieces.push(match[1]);
    }
    // Also include line breaks <w:br/> or <w:p>
    const cleanDocx = docXmlContent
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return textPieces.join(' ') + '\n' + cleanDocx;
  }

  // Fallback: extract all readable strings from binary
  return extractAsciiStrings(bytes);
}

/**
 * Text extraction for PDF
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder('latin1');
  const pdfString = textDecoder.decode(bytes);

  const extractedBlocks: string[] = [];

  // 1. Match uncompressed text strings inside (...) Tj and [(...)] TJ
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRegex.exec(pdfString)) !== null) {
    extractedBlocks.push(m[1]);
  }

  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((m = arrayTjRegex.exec(pdfString)) !== null) {
    const inner = m[1].replace(/\(([^)]+)\)/g, '$1 ').replace(/-?\d+\.?\d*/g, '');
    extractedBlocks.push(inner);
  }

  // 2. Try decompressing FlateDecode streams if available
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  while ((m = streamRegex.exec(pdfString)) !== null) {
    const rawStream = m[1];
    if (typeof DecompressionStream !== 'undefined' && rawStream.length > 20) {
      try {
        const streamBytes = new Uint8Array(rawStream.length);
        for (let j = 0; j < rawStream.length; j++) {
          streamBytes[j] = rawStream.charCodeAt(j);
        }
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(streamBytes);
        writer.close();
        const response = new Response(ds.readable);
        const decompressed = await response.text();
        if (decompressed && decompressed.length > 10) {
          extractedBlocks.push(decompressed);
        }
      } catch {
        // Stream decompression failed or wasn't flate, ignore
      }
    }
  }

  // 3. Fallback: extract ASCII strings
  if (extractedBlocks.length === 0) {
    return extractAsciiStrings(bytes);
  }

  return extractedBlocks.join('\n') + '\n' + extractAsciiStrings(bytes);
}

/**
 * Text extraction for legacy binary DOC
 */
async function extractTextFromDoc(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return extractAsciiStrings(bytes);
}

/**
 * Extracts printable ASCII and UTF-8 strings from binary file
 */
function extractAsciiStrings(bytes: Uint8Array): string {
  let result = '';
  let currentWord = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    // Printable ASCII or newline / tab
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      currentWord += String.fromCharCode(byte);
    } else {
      if (currentWord.length >= 4) {
        result += currentWord + '\n';
      }
      currentWord = '';
    }
  }
  if (currentWord.length >= 4) {
    result += currentWord;
  }
  return result;
}
