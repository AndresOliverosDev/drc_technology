import type {
  GeoCoordinates,
  InfrastructureNodeCollection,
  InfrastructureNodeFeature,
  InfrastructureNodeType
} from '../models/InfrastructureNode';

/**
 * Options required to initialize the map renderer.
 */
export interface MapRendererOptions {
  /**
   * Container element or HTML element ID where the map canvas will be mounted.
   */
  container: string | HTMLElement;

  /**
   * Initial center coordinates [longitude, latitude].
   */
  initialCenter?: GeoCoordinates;

  /**
   * Initial zoom level.
   */
  initialZoom?: number;

  /**
   * Initial pitch (tilt in degrees).
   */
  initialPitch?: number;

  /**
   * Initial bearing (rotation in degrees).
   */
  initialBearing?: number;

  /**
   * Vector style URL or style object.
   */
  styleUrl?: string;
}

/**
 * Port contract for map rendering adapters.
 */
export interface MapRenderer {
  /**
   * Initializes the map canvas within the designated container.
   * @param options Map configuration options.
   */
  init(options: MapRendererOptions): Promise<void>;

  /**
   * Adds or updates the infrastructure nodes displayed on the map.
   * @param nodes GeoJSON FeatureCollection of infrastructure nodes.
   */
  addNodes(nodes: InfrastructureNodeCollection): void;

  /**
   * Filters displayed nodes by type ('all' or specific node type).
   * @param type Category of node to filter, or 'all'.
   */
  filterNodesByType(type: InfrastructureNodeType | 'all'): void;

  /**
   * Smoothly animates the map camera to designated coordinates.
   * @param coordinates Target geographic coordinates.
   * @param zoom Target zoom level.
   */
  flyTo(coordinates: GeoCoordinates, zoom?: number): void;

  /**
   * Runs the transcontinental cinematic camera flyover from Asia to Bogotá HQ.
   */
  runCinematicIntro(): Promise<void>;

  /**
   * Focuses the camera directly on the corporate headquarters in Chapinero, Bogotá.
   */
  focusHQ(): Promise<void>;

  /**
   * Focuses the camera on the national Colombia telecommunications coverage view.
   */
  focusNational(): Promise<void>;

  /**
   * Resets the map camera to the default national overview.
   */
  resetView(): Promise<void>;

  /**
   * Registers a callback invoked when an infrastructure node is clicked.
   * @param callback Callback receiving the clicked infrastructure node feature.
   */
  onNodeClick(callback: (node: InfrastructureNodeFeature) => void): void;

  /**
   * Registers a callback invoked when the cinematic intro sequence completes.
   * @param callback Callback invoked upon cinematic sequence completion.
   */
  onCinematicComplete?(callback: () => void): void;

  /**
   * Registers a callback invoked when the corporate HQ is selected/focused.
   * @param callback Callback invoked when HQ is focused.
   */
  onHQFocus?(callback: () => void): void;

  /**
   * Recalculates map viewport dimensions to fit container.
   */
  resize?(): void;

  /**
   * Tears down map listeners, popups, and frees WebGL context.
   */
  destroy(): void;
}
