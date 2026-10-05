import * as maplibregl from 'maplibre-gl';
import type {
  Map as MapLibreInstance,
  GeoJSONSource,
  Popup,
  MapLayerMouseEvent,
  Marker
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapRenderer, MapRendererOptions } from '../../domain/ports/MapRenderer';
import type {
  GeoCoordinates,
  InfrastructureNodeCollection,
  InfrastructureNodeFeature,
  InfrastructureNodeType,
  InfrastructureNodeProperties
} from '../../domain/models/InfrastructureNode';

/**
 * Enterprise Dark MapLibre GL implementation of the MapRenderer port.
 * Features Globe projection, transcontinental orbital camera flyovers,
 * 3D architectural extruded buildings, corporate cobalt blue accents, and glassmorphism.
 */
export class MapLibreAdapter implements MapRenderer {
  private map: MapLibreInstance | null = null;
  private currentPopup: Popup | null = null;
  private hqMarker: Marker | null = null;
  private nodesData: InfrastructureNodeCollection | null = null;
  private hqNodeFeature: InfrastructureNodeFeature | null = null;
  private clickCallbacks: Array<(node: InfrastructureNodeFeature) => void> = [];
  private cinematicCompleteCallbacks: Array<() => void> = [];
  private hqFocusCallbacks: Array<() => void> = [];
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Geographic coordinates and camera presets.
   */
  public static readonly ASIA_ORIGIN: GeoCoordinates = [138.0, 36.0];
  public static readonly COLOMBIA_CENTER: GeoCoordinates = [-74.2973, 4.5709];
  public static readonly HQ_COORDINATES: GeoCoordinates = [-74.0600, 4.6533];

  private static readonly DEFAULT_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  /**
   * Initializes the MapLibre GL instance with Globe projection and Enterprise Dark configuration.
   */
  async init(options: MapRendererOptions): Promise<void> {
    if (this.map) {
      return;
    }

    const {
      container,
      initialCenter = MapLibreAdapter.COLOMBIA_CENTER,
      initialZoom = 5.4,
      initialPitch = 20,
      initialBearing = 0,
      styleUrl = MapLibreAdapter.DEFAULT_STYLE
    } = options;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      try {
        const map = new maplibregl.Map({
          container,
          style: styleUrl,
          center: initialCenter,
          zoom: initialZoom,
          pitch: initialPitch,
          bearing: initialBearing,
          attributionControl: false,
          cooperativeGestures: true
        });

        // Enable Globe projection if supported in MapLibre instance
        try {
          if (typeof (map as unknown as { setProjection: (p: { type: string }) => void }).setProjection === 'function') {
            (map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({ type: 'globe' });
          }
        } catch (projErr) {
          console.warn('MapLibre globe projection notice:', projErr);
        }

        // Minimalist corporate navigation controls
        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: true
          }),
          'top-right'
        );

        // Corporate attribution
        map.addControl(
          new maplibregl.AttributionControl({
            compact: true,
            customAttribution: '© <a href="https://carto.com" target="_blank" rel="noopener">CARTO</a> © DR.C Technology'
          }),
          'bottom-right'
        );

        map.once('load', () => {
          this.isLoaded = true;
          this.map = map;

          this.setupCityPresenceHighlights();
          this.setup3dExtrudedBuildings();

          if (this.nodesData) {
            this.renderNodesLayer(this.nodesData);
          }

          this.setupHqMarker();
          this.setupInteractivity();
          resolve();
        });

        map.once('error', (err) => {
          console.warn('MapLibre GL encountered a warning/error during load:', err);
        });

        this.map = map;
      } catch (error) {
        reject(error);
      }
    });

    return this.loadPromise;
  }

  /**
   * Adds or updates the infrastructure nodes displayed on the map.
   */
  addNodes(nodes: InfrastructureNodeCollection): void {
    this.nodesData = nodes;

    // Detect HQ feature
    const hq = nodes.features.find((f) => f.properties.isHQ || f.properties.type === 'headquarters');
    if (hq) {
      this.hqNodeFeature = hq;
    }

    if (!this.map || !this.isLoaded) {
      return;
    }

    const source = this.map.getSource('drc-nodes') as GeoJSONSource | undefined;
    if (source) {
      source.setData(nodes);
    } else {
      this.renderNodesLayer(nodes);
    }

    this.setupHqMarker();
  }

  /**
   * Filters displayed nodes by node type ('all' or specific category).
   */
  filterNodesByType(type: InfrastructureNodeType | 'all'): void {
    if (!this.map || !this.isLoaded) return;

    const filterExpression = type === 'all' ? null : ['==', ['get', 'type'], type];

    if (this.map.getLayer('drc-nodes-halo')) {
      this.map.setFilter('drc-nodes-halo', filterExpression);
    }
    if (this.map.getLayer('drc-nodes-core')) {
      this.map.setFilter('drc-nodes-core', filterExpression);
    }
    if (this.map.getLayer('drc-nodes-center')) {
      this.map.setFilter('drc-nodes-center', filterExpression);
    }
    if (this.map.getLayer('drc-nodes-labels')) {
      this.map.setFilter('drc-nodes-labels', filterExpression);
    }
  }

  /**
   * Smoothly animates the map camera to designated coordinates.
   */
  flyTo(coordinates: GeoCoordinates, zoom = 12): void {
    if (!this.map) return;

    this.map.flyTo({
      center: coordinates,
      zoom,
      pitch: 35,
      bearing: 0,
      essential: true,
      duration: 1800
    });
  }

  /**
   * Executes the transcontinental cinematic camera intro:
   * 1. Start: Centered on Japan / East Asia at globe scale (zoom: 1.8)
   * 2. Smooth orbital flyTo across Pacific towards Colombia (zoom: 5.5, duration: 3800ms)
   * 3. Mandatory ~900ms strategic pause showing national coverage
   * 4. 3D immersion to Chapinero, Bogotá HQ (zoom: 16.8, pitch: 48°, bearing: -15°, duration: 2800ms)
   * 5. Settle camera, trigger 3D building highlights, and notify Info Box.
   */
  async runCinematicIntro(): Promise<void> {
    if (!this.map) return;

    this.resize();

    // Step 0: Instantly stage globe over Japan / East Asia
    this.map.jumpTo({
      center: MapLibreAdapter.ASIA_ORIGIN,
      zoom: 1.8,
      pitch: 0,
      bearing: 0
    });

    // Brief stabilization pause
    await this.wait(350);

    // Step 1: Long-trajectory orbital flyTo across Pacific to Colombia
    await this.flyToPromise({
      center: MapLibreAdapter.COLOMBIA_CENTER,
      zoom: 5.5,
      pitch: 22,
      bearing: 0,
      duration: 3800
    });

    // Step 2: Mandatory strategic pause showing nationwide coverage
    await this.wait(900);

    // Step 3: 3D immersion dive to Chapinero, Bogotá D.C. (Street-aligned office perspective)
    await this.flyToPromise({
      center: MapLibreAdapter.HQ_COORDINATES,
      zoom: 17.5,
      pitch: 50,
      bearing: -20,
      duration: 2800
    });

    // Step 4: Camera settled — notify completion & deploy Corporate Info Box
    this.notifyCinematicComplete();
    this.notifyHQFocus();
  }

  /**
   * Focuses camera directly on Corporate HQ in Chapinero, Bogotá.
   */
  async focusHQ(): Promise<void> {
    if (!this.map) return;

    await this.flyToPromise({
      center: MapLibreAdapter.HQ_COORDINATES,
      zoom: 17.5,
      pitch: 50,
      bearing: -20,
      duration: 2200
    });

    this.notifyHQFocus();
  }

  /**
   * Focuses camera on the nationwide Colombia coverage view.
   */
  async focusNational(): Promise<void> {
    if (!this.map) return;

    await this.flyToPromise({
      center: MapLibreAdapter.COLOMBIA_CENTER,
      zoom: 5.5,
      pitch: 20,
      bearing: 0,
      duration: 2000
    });
  }

  /**
   * Resets view to default national overview.
   */
  async resetView(): Promise<void> {
    if (!this.map) return;

    if (this.currentPopup) {
      this.currentPopup.remove();
      this.currentPopup = null;
    }

    await this.flyToPromise({
      center: MapLibreAdapter.COLOMBIA_CENTER,
      zoom: 5.4,
      pitch: 20,
      bearing: 0,
      duration: 1800
    });
  }

  /**
   * Registers a callback invoked when an infrastructure node is clicked.
   */
  onNodeClick(callback: (node: InfrastructureNodeFeature) => void): void {
    this.clickCallbacks.push(callback);
  }

  /**
   * Registers a callback invoked when the cinematic intro sequence completes.
   */
  onCinematicComplete(callback: () => void): void {
    this.cinematicCompleteCallbacks.push(callback);
  }

  /**
   * Registers a callback invoked when Corporate HQ is focused or selected.
   */
  onHQFocus(callback: () => void): void {
    this.hqFocusCallbacks.push(callback);
  }

  /**
   * Recalculates map viewport dimensions to fit container.
   */
  resize(): void {
    if (this.map) {
      this.map.resize();
    }
  }

  /**
   * Tears down map listeners, markers, popups, and frees WebGL context.
   */
  destroy(): void {
    if (this.currentPopup) {
      this.currentPopup.remove();
      this.currentPopup = null;
    }

    if (this.hqMarker) {
      this.hqMarker.remove();
      this.hqMarker = null;
    }

    this.clickCallbacks = [];
    this.cinematicCompleteCallbacks = [];
    this.hqFocusCallbacks = [];

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.isLoaded = false;
    this.nodesData = null;
  }

  /**
   * Helper that wraps map.flyTo into a reliable Promise resolved on 'moveend'.
   */
  private flyToPromise(options: maplibregl.FlyToOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.map) {
        resolve();
        return;
      }

      let resolved = false;
      const complete = () => {
        if (!resolved) {
          resolved = true;
          this.map?.off('moveend', complete);
          resolve();
        }
      };

      this.map.once('moveend', complete);

      // Fallback timeout in case moveend is cancelled or interrupted
      const timeout = (options.duration || 2000) + 400;
      setTimeout(complete, timeout);

      this.map.flyTo({
        ...options,
        essential: true
      });
    });
  }

  /**
   * Helper for asynchronous delays.
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private notifyCinematicComplete(): void {
    for (const cb of this.cinematicCompleteCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error('Error in onCinematicComplete callback:', err);
      }
    }
  }

  private notifyHQFocus(): void {
    for (const cb of this.hqFocusCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error('Error in onHQFocus callback:', err);
      }
    }
  }

  /**
   * Configures prominent corporate color highlights for cities with DR.C Technology presence.
   * Completely removes inter-city connection lines in favor of clean regional coverage auras.
   */
  private setupCityPresenceHighlights(): void {
    if (!this.map) return;

    const presenceCitiesGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'presence-bogota',
          properties: {
            city: 'Bogotá D.C.',
            department: 'Cundinamarca',
            region: 'Sede Central & Sabana',
            isHQ: true,
            statusLabel: 'Sede Principal Corporativa',
            type: 'headquarters',
            status: 'operational',
            description: 'Centro de Operaciones Técnicas (NOC), Laboratorio de Desarrollo de Software y Centro de Mando Nacional.',
            services: 'Infraestructura • Redes • CCTV • Detección de Incendios • Software'
          },
          geometry: {
            type: 'Point',
            coordinates: [-74.0600, 4.6533]
          }
        },
        {
          type: 'Feature',
          id: 'presence-medellin',
          properties: {
            city: 'Medellín',
            department: 'Antioquia',
            region: 'Valle de Aburrá & Occidente',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Capacidad operativa de despliegue para infraestructura de redes, seguridad electrónica y consultoría tecnológica.',
            services: 'Infraestructura Tecnológica • Redes de Datos • CCTV Corporativo'
          },
          geometry: {
            type: 'Point',
            coordinates: [-75.5742, 6.2088]
          }
        },
        {
          type: 'Feature',
          id: 'presence-cali',
          properties: {
            city: 'Cali',
            department: 'Valle del Cauca',
            region: 'Suroccidente Colombiano',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Despliegue y mantenimiento de cableado estructurado, detección de incendios y enlaces corporativos.',
            services: 'Redes • Detección y Extinción de Incendios • CCTV'
          },
          geometry: {
            type: 'Point',
            coordinates: [-76.5298, 3.4682]
          }
        },
        {
          type: 'Feature',
          id: 'presence-barranquilla',
          properties: {
            city: 'Barranquilla',
            department: 'Atlántico',
            region: 'Costa Norte & Sector Portuario',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Infraestructura de comunicaciones y sistemas de seguridad electrónica para terminales industriales y empresas.',
            services: 'Infraestructura de Telecomunicaciones • CCTV • Redes'
          },
          geometry: {
            type: 'Point',
            coordinates: [-74.7932, 10.9984]
          }
        },
        {
          type: 'Feature',
          id: 'presence-cartagena',
          properties: {
            city: 'Cartagena',
            department: 'Bolívar',
            region: 'Zona Industrial Mamonal & Caribe',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Soluciones integrales de seguridad perimetral, detección temprana de incendios y redes empresariales.',
            services: 'CCTV Industrial • Detección de Incendios • Conectividad'
          },
          geometry: {
            type: 'Point',
            coordinates: [-75.5118, 10.3342]
          }
        },
        {
          type: 'Feature',
          id: 'presence-bucaramanga',
          properties: {
            city: 'Bucaramanga',
            department: 'Santander',
            region: 'Zona Oriente',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Servicios de ingeniería de red, centros de cableado estructurado y soporte de sistemas tecnológicos.',
            services: 'Redes y Cableado • CCTV • Consultoría'
          },
          geometry: {
            type: 'Point',
            coordinates: [-73.1118, 7.1186]
          }
        },
        {
          type: 'Feature',
          id: 'presence-pereira',
          properties: {
            city: 'Pereira',
            department: 'Risaralda',
            region: 'Eje Cafetero',
            isHQ: false,
            statusLabel: 'Presencia Regional Activa',
            type: 'regional_hub',
            status: 'operational',
            description: 'Atención a proyectos de modernización de infraestructura tecnológica y redes empresariales.',
            services: 'Infraestructura • Redes de Datos • CCTV'
          },
          geometry: {
            type: 'Point',
            coordinates: [-75.6912, 4.8087]
          }
        }
      ]
    };

    if (!this.map.getSource('drc-city-presence')) {
      this.map.addSource('drc-city-presence', {
        type: 'geojson',
        data: presenceCitiesGeoJSON
      });

      // 1. Resaltado de Área Metropolitana de Cobertura (Aura radial de color)
      this.map.addLayer({
        id: 'drc-city-coverage-glow',
        type: 'circle',
        source: 'drc-city-presence',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 22,
            6, 42,
            9, 85,
            14, 180
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'isHQ'], true],
            '#2563EB',
            '#1D4ED8'
          ],
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 0.22,
            7, 0.18,
            12, 0.08
          ],
          'circle-blur': 0.7
        }
      });

      // 2. Delimitador perimetral de presencia (borde fino técnico)
      this.map.addLayer({
        id: 'drc-city-coverage-ring',
        type: 'circle',
        source: 'drc-city-presence',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 22,
            6, 42,
            9, 85,
            14, 180
          ],
          'circle-color': 'transparent',
          'circle-stroke-width': 1.2,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'isHQ'], true],
            '#3B82F6',
            '#60A5FA'
          ],
          'circle-stroke-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 0.45,
            7, 0.35,
            12, 0.12
          ]
        }
      });

      // 3. Núcleo focal del punto de presencia
      this.map.addLayer({
        id: 'drc-city-core',
        type: 'circle',
        source: 'drc-city-presence',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 5.5,
            7, 7.5,
            12, 9.5
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'isHQ'], true],
            '#2563EB',
            '#3B82F6'
          ],
          'circle-stroke-width': 2.2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.95
        }
      });

      // 4. Etiqueta corporativa nítida con el nombre de la ciudad
      this.map.addLayer({
        id: 'drc-city-label',
        type: 'symbol',
        source: 'drc-city-presence',
        layout: {
          'text-field': ['get', 'city'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 10.5,
            7, 12,
            12, 13
          ],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-letter-spacing': 0.05
        },
        paint: {
          'text-color': '#F1F5F9',
          'text-halo-color': '#090D16',
          'text-halo-width': 2.5
        }
      });
    }
  }

  /**
   * Configures 3D Extruded Buildings in matte graphite/slate (#1E293B, #334155)
   * with corporate architectural highlight for Chapinero HQ campus.
   */
  /**
   * Configures 3D Extruded Buildings:
   * 1. Extrudes all real neighborhood buildings, houses, and street blocks from OpenStreetMap/Carto.
   * 2. Overlays a street-aligned architectural office complex for DR.C Technology Oficina Principal,
   *    rotated precisely along Carrera 10 (~18.5°) and aligned with adjacent houses.
   */
  private setup3dExtrudedBuildings(): void {
    if (!this.map) return;

    // 1. Street-aligned architectural office complex (Rotated ~18.5° matching Carrera 10 and Calle 67)
    const hqBuildingsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
      type: 'FeatureCollection',
      features: [
        // Main DR.C Technology Corporate Office Building (4-5 floors, glass/slate corporate facade)
        {
          type: 'Feature',
          properties: {
            name: 'DR.C Technology — Oficina Principal',
            isHQ: true,
            isAtrium: false,
            height: 22,
            min_height: 0,
            color: '#1E293B'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-74.060126, 4.653266],
              [-74.06008, 4.653403],
              [-74.059874, 4.653334],
              [-74.05992, 4.653197],
              [-74.060126, 4.653266]
            ]]
          }
        },
        // Entrance Portico & Reception Canopy facing the street
        {
          type: 'Feature',
          properties: {
            name: 'Atrio de Acceso & Recepción Corporativa',
            isHQ: true,
            isAtrium: true,
            height: 5,
            min_height: 0,
            color: '#2563EB'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-74.060169, 4.653309],
              [-74.06014, 4.653395],
              [-74.060089, 4.653377],
              [-74.060118, 4.653292],
              [-74.060169, 4.653309]
            ]]
          }
        },
        // Neighboring House / Building North (Aligned with the street and parcel block)
        {
          type: 'Feature',
          properties: {
            name: 'Edificación Contigua Costado Norte',
            isHQ: false,
            isAtrium: false,
            height: 14,
            min_height: 0,
            color: '#1E293B'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-74.060067, 4.653413],
              [-74.060024, 4.653542],
              [-74.059835, 4.653479],
              [-74.059878, 4.65335],
              [-74.060067, 4.653413]
            ]]
          }
        },
        // Neighboring House / Building South (Aligned with the street and parcel block)
        {
          type: 'Feature',
          properties: {
            name: 'Edificación Contigua Costado Sur',
            isHQ: false,
            isAtrium: false,
            height: 12,
            min_height: 0,
            color: '#1E293B'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-74.060165, 4.653121],
              [-74.060122, 4.65325],
              [-74.059933, 4.653187],
              [-74.059976, 4.653058],
              [-74.060165, 4.653121]
            ]]
          }
        }
      ]
    };

    if (!this.map.getSource('drc-hq-buildings')) {
      this.map.addSource('drc-hq-buildings', {
        type: 'geojson',
        data: hqBuildingsGeoJSON
      });

      // Extruded street-aligned office complex
      this.map.addLayer({
        id: 'drc-hq-buildings-extrusion',
        type: 'fill-extrusion',
        source: 'drc-hq-buildings',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'isAtrium'], true],
            '#2563EB',
            ['==', ['get', 'isHQ'], true],
            '#1E293B',
            '#182333'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.95
        }
      });

      // Corporate Cobalt Crown on main office roof
      this.map.addLayer({
        id: 'drc-hq-roof-highlight',
        type: 'fill-extrusion',
        source: 'drc-hq-buildings',
        filter: ['all', ['==', ['get', 'isHQ'], true], ['!=', ['get', 'isAtrium'], true]],
        minzoom: 14.5,
        paint: {
          'fill-extrusion-color': '#2563EB',
          'fill-extrusion-height': ['+', ['get', 'height'], 1.4],
          'fill-extrusion-base': ['get', 'height'],
          'fill-extrusion-opacity': 0.9
        }
      });
    }

    // 2. Extrude ALL real OpenStreetMap / Carto neighborhood buildings & houses
    try {
      const layers = this.map.getStyle()?.layers || [];
      let labelLayerId: string | undefined = undefined;

      for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout && (layer.layout as Record<string, unknown>)['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      for (const layer of layers) {
        if (layer.type === 'fill' && (layer as Record<string, unknown>)['source-layer'] === 'building') {
          const sourceId = (layer as Record<string, unknown>).source as string;
          const sourceLayer = (layer as Record<string, unknown>)['source-layer'] as string;

          if (!this.map.getLayer('3d-buildings-osm')) {
            this.map.addLayer(
              {
                id: '3d-buildings-osm',
                source: sourceId,
                'source-layer': sourceLayer,
                type: 'fill-extrusion',
                minzoom: 14,
                paint: {
                  'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, '#141E2E',
                    16, '#1E293B',
                    18, '#2D3B4F'
                  ],
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    15.5, ['coalesce', ['get', 'render_height'], ['get', 'height'], 15]
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    15.5, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
                  ],
                  'fill-extrusion-opacity': 0.85
                }
              },
              labelLayerId
            );
          }
          break;
        }
      }
    } catch (e) {
      console.warn('Real building extrusion setup notice:', e);
    }
  }

  /**
   * Sets up Corporate HQ Marker with cobalt blue pin and concentric translucent halo.
   */
  private setupHqMarker(): void {
    if (!this.map) return;

    if (this.hqMarker) {
      this.hqMarker.remove();
      this.hqMarker = null;
    }

    const container = document.createElement('div');
    container.className = 'drc-hq-marker-wrapper';
    container.setAttribute('role', 'button');
    container.setAttribute('aria-label', 'DR.C Technology — Sede Principal');
    container.style.cssText = 'position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;';

    // Outer subtle concentric halo (rgba(37, 99, 235, 0.15))
    const pulseHalo = document.createElement('div');
    pulseHalo.style.cssText = `
      position: absolute;
      inset: -10px;
      border-radius: 9999px;
      background-color: rgba(37, 99, 235, 0.15);
      pointer-events: none;
      animation: drc-hq-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    `;

    // Concentric ring boundary
    const ringBoundary = document.createElement('div');
    ringBoundary.style.cssText = `
      position: absolute;
      inset: -4px;
      border-radius: 9999px;
      background-color: rgba(37, 99, 235, 0.10);
      border: 1px solid rgba(37, 99, 235, 0.35);
      pointer-events: none;
    `;

    // Cobalt Blue Pin
    const pin = document.createElement('div');
    pin.style.cssText = `
      position: relative;
      z-index: 10;
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background-color: #2563EB;
      border: 2px solid #FFFFFF;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, background-color 0.2s ease;
    `;
    pin.innerHTML = `
      <svg style="width: 14px; height: 14px; color: #FFFFFF;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    `;

    // Subtle Badge Below Pin
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute;
      top: 36px;
      white-space: nowrap;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #93C5FD;
      font-size: 10px;
      font-family: ui-monospace, monospace;
      font-weight: 600;
      letter-spacing: 0.05em;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    `;
    badge.innerText = 'OFICINA PRINCIPAL';

    container.appendChild(pulseHalo);
    container.appendChild(ringBoundary);
    container.appendChild(pin);
    container.appendChild(badge);

    container.addEventListener('mouseenter', () => {
      pin.style.transform = 'scale(1.1)';
      pin.style.backgroundColor = '#1D4ED8';
    });

    container.addEventListener('mouseleave', () => {
      pin.style.transform = 'scale(1)';
      pin.style.backgroundColor = '#2563EB';
    });

    container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.focusHQ();
      if (this.hqNodeFeature) {
        this.displayPopup(this.hqNodeFeature.geometry.coordinates, this.hqNodeFeature.properties);
      }
    });

    this.hqMarker = new maplibregl.Marker({
      element: container,
      anchor: 'center'
    })
      .setLngLat(MapLibreAdapter.HQ_COORDINATES)
      .addTo(this.map);
  }

  /**
   * Adds the infrastructure nodes sources and visualization layers.
   * Enterprise palette: Cobalt blue (#2563EB), Slate (#1E293B), Amber for maintenance.
   */
  private renderNodesLayer(nodes: InfrastructureNodeCollection): void {
    if (!this.map) return;

    if (!this.map.getSource('drc-nodes')) {
      this.map.addSource('drc-nodes', {
        type: 'geojson',
        data: nodes
      });

      // 1. Concentric halo / pulse
      this.map.addLayer({
        id: 'drc-nodes-halo',
        type: 'circle',
        source: 'drc-nodes',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 8,
            7, 14,
            12, 22
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'maintenance'],
            '#D97706',
            '#2563EB'
          ],
          'circle-opacity': 0.15,
          'circle-blur': 0.8
        }
      });

      // 2. High-contrast corporate core circle
      this.map.addLayer({
        id: 'drc-nodes-core',
        type: 'circle',
        source: 'drc-nodes',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 5,
            7, 7,
            12, 10
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'maintenance'],
            '#F59E0B',
            '#2563EB'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0F172A',
          'circle-stroke-opacity': 0.9
        }
      });

      // 3. Central light emitter
      this.map.addLayer({
        id: 'drc-nodes-center',
        type: 'circle',
        source: 'drc-nodes',
        paint: {
          'circle-radius': 2.2,
          'circle-color': '#FFFFFF'
        }
      });

      // 4. Facility Specific Label layer (Only at zoom 12+ to prevent city label collisions)
      this.map.addLayer({
        id: 'drc-nodes-labels',
        type: 'symbol',
        source: 'drc-nodes',
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
          'text-letter-spacing': 0.05
        },
        paint: {
          'text-color': '#CBD5E1',
          'text-halo-color': '#090D16',
          'text-halo-width': 2
        }
      });
    }
  }

  /**
   * Sets up interactive cursor feedback, click popups, and event propagation.
   */
  private setupInteractivity(): void {
    if (!this.map) return;

    // Hover feedback on presence cities
    this.map.on('mouseenter', 'drc-city-core', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', 'drc-city-core', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    // Click on city presence highlights
    this.map.on('click', 'drc-city-core', (e: MapLayerMouseEvent) => {
      if (!this.map || !e.features || e.features.length === 0) return;

      const feat = e.features[0];
      const coords = (feat.geometry as GeoJSON.Point).coordinates as GeoCoordinates;
      const props = feat.properties as Record<string, any>;

      if (props.isHQ) {
        this.focusHQ();
        this.notifyHQFocus();
      } else {
        this.displayCityPresencePopup(coords, props);
      }
    });

    this.map.on('mouseenter', 'drc-nodes-core', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', 'drc-nodes-core', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    this.map.on('click', 'drc-nodes-core', (e: MapLayerMouseEvent) => {
      if (!this.map || !e.features || e.features.length === 0) return;

      const feature = e.features[0] as unknown as InfrastructureNodeFeature;
      const coords = feature.geometry.coordinates;
      const props = feature.properties as InfrastructureNodeProperties;

      this.displayPopup(coords, props);

      for (const cb of this.clickCallbacks) {
        cb(feature);
      }
    });
  }

  /**
   * Displays the Enterprise Dark popup for a regional city of presence.
   */
  public displayCityPresencePopup(coords: GeoCoordinates, props: Record<string, any>): void {
    if (!this.map) return;

    if (this.currentPopup) {
      this.currentPopup.remove();
    }

    const technicalVisitUrl = `https://wa.me/573502049578?text=Hola%20DR.C%20Technology,%20solicito%20atenci%C3%B3n%20t%C3%A9cnica%20corporativa%20en%20${encodeURIComponent(props.city)}`;

    const htmlContent = `
      <div class="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl font-sans min-w-[270px] max-w-[320px]">
        <!-- Top accent corporate line -->
        <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        
        <!-- Header -->
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-[10px] font-mono tracking-wider uppercase text-blue-400 font-semibold">
            ${props.region || 'Presencia Regional'}
          </span>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            OPERACIÓN ACTIVA
          </span>
        </div>

        <!-- City Title -->
        <h4 class="text-sm font-semibold text-white tracking-tight mb-1 font-heading">
          DR.C Technology — ${props.city}
        </h4>
        <p class="text-xs text-slate-400 mb-3 flex items-center gap-1 font-mono">
          <svg class="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          ${props.department}, Colombia
        </p>

        <p class="text-[11px] text-slate-300 leading-relaxed mb-3">${props.description || 'Capacidad técnica y operativa de despliegue.'}</p>

        ${props.services ? `
          <div class="mb-3 p-2 rounded-lg bg-slate-950/60 border border-white/5 text-[10px] font-mono text-slate-300">
            <span class="text-slate-500 uppercase tracking-wider block mb-1">Servicios Disponibles:</span>
            ${props.services}
          </div>
        ` : ''}

        <div class="pt-2 border-t border-white/10 flex items-center justify-between">
          <a
            href="${technicalVisitUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full text-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm"
          >
            Solicitar Servicio en ${props.city}
          </a>
        </div>
      </div>
    `;

    this.currentPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 14,
      className: 'drc-enterprise-popup'
    })
      .setLngLat(coords)
      .setHTML(htmlContent)
      .addTo(this.map);
  }

  /**
   * Builds and displays the glassmorphic interactive popup with Enterprise Dark aesthetics.
   */
  public displayPopup(coords: GeoCoordinates, props: InfrastructureNodeProperties): void {
    if (!this.map) return;

    if (this.currentPopup) {
      this.currentPopup.remove();
    }

    const typeLabels: Record<InfrastructureNodeType, string> = {
      headquarters: 'Sede Principal Corporativa',
      datacenter: 'Centro de Datos Tier III',
      pop: 'Punto de Presencia (POP)',
      fiber_hub: 'Hub Troncal de Fibra',
      tower: 'Torre de Retransmisión'
    };

    const statusBadge =
      props.status === 'operational'
        ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
             OPERATIVO
           </span>`
        : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
             <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
             MANTENIMIENTO
           </span>`;

    const htmlContent = `
      <div class="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-4 text-slate-100 shadow-2xl backdrop-blur-xl font-sans min-w-[270px] max-w-[320px]">
        <!-- Top accent corporate line -->
        <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        
        <!-- Header -->
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-[10px] font-mono tracking-wider uppercase text-blue-400 font-semibold">
            ${typeLabels[props.type] || props.type}
          </span>
          ${statusBadge}
        </div>

        <!-- Title -->
        <h4 class="text-sm font-bold text-white tracking-tight mb-1">
          ${props.name}
        </h4>
        <p class="text-xs text-slate-400 mb-3 flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          ${props.city}, ${props.department}
        </p>

        <!-- Technical Metrics Grid -->
        <div class="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-white/5 mb-3 text-[11px] font-mono">
          <div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400">Capacidad</div>
            <div class="font-semibold text-blue-300 truncate">${props.capacity}</div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400">Latencia Core</div>
            <div class="font-semibold text-slate-200">${props.latency || '< 2ms'}</div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400">Clasificación</div>
            <div class="font-semibold text-slate-200 truncate">${props.tier || 'Carrier Grade'}</div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400">Uptime SLA</div>
            <div class="font-semibold text-emerald-400">${props.uptime || '99.98%'}</div>
          </div>
        </div>

        ${props.description ? `<p class="text-[11px] text-slate-300 leading-relaxed mb-3">${props.description}</p>` : ''}

        <!-- Footer Coordinates -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>COORDS: ${coords[1].toFixed(4)}°N, ${Math.abs(coords[0]).toFixed(4)}°W</span>
          <span class="text-blue-400 font-semibold">DR.C TECH</span>
        </div>
      </div>
    `;

    this.currentPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 16,
      className: 'drc-enterprise-popup'
    })
      .setLngLat(coords)
      .setHTML(htmlContent)
      .addTo(this.map);
  }
}
