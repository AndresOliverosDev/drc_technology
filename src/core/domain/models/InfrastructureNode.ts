/**
 * Types of telecommunications infrastructure nodes.
 */
export type InfrastructureNodeType = 'headquarters' | 'datacenter' | 'pop' | 'fiber_hub' | 'tower';

/**
 * Operational statuses for an infrastructure node.
 */
export type InfrastructureNodeStatus = 'operational' | 'maintenance';

/**
 * Geographic coordinates in [longitude, latitude] format according to RFC 7946 GeoJSON.
 */
export type GeoCoordinates = [longitude: number, latitude: number];

/**
 * Metadata properties associated with a telecommunications infrastructure node.
 */
export interface InfrastructureNodeProperties {
  id: string;
  name: string;
  city: string;
  department: string;
  type: InfrastructureNodeType;
  status: InfrastructureNodeStatus;
  capacity: string;
  latency?: string;
  tier?: string;
  address?: string;
  description?: string;
  uptime?: string;
  isHQ?: boolean;
  services?: string[];
}

/**
 * GeoJSON Point Geometry.
 */
export interface PointGeometry {
  type: 'Point';
  coordinates: GeoCoordinates;
}

/**
 * GeoJSON Feature representing an Infrastructure Node.
 */
export interface InfrastructureNodeFeature {
  type: 'Feature';
  id?: string | number;
  geometry: PointGeometry;
  properties: InfrastructureNodeProperties;
}

/**
 * GeoJSON LineString Geometry for network links.
 */
export interface LineStringGeometry {
  type: 'LineString';
  coordinates: GeoCoordinates[];
}

/**
 * GeoJSON Feature representing a network backbone connection link.
 */
export interface NetworkLinkFeature {
  type: 'Feature';
  id?: string | number;
  geometry: LineStringGeometry;
  properties: {
    id: string;
    from: string;
    to: string;
    capacity: string;
    type: 'fiber_backbone' | 'radio_link';
    status: 'active' | 'backup';
  };
}

/**
 * GeoJSON FeatureCollection for Infrastructure Nodes.
 */
export interface InfrastructureNodeCollection {
  type: 'FeatureCollection';
  features: InfrastructureNodeFeature[];
}
