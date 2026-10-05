import type { LocationRepository } from '../../domain/ports/LocationRepository';
import type {
  InfrastructureNodeCollection,
  InfrastructureNodeFeature,
  InfrastructureNodeType,
  InfrastructureNodeStatus
} from '../../domain/models/InfrastructureNode';
import infrastructureNodesData from '../data/infrastructure-nodes.json';

/**
 * In-memory repository implementing LocationRepository using static GeoJSON data.
 */
export class StaticLocationRepository implements LocationRepository {
  private readonly data: InfrastructureNodeCollection;

  /**
   * Constructs the static location repository.
   * @param customData Optional custom GeoJSON dataset (defaults to bundled infrastructure-nodes.json).
   */
  constructor(customData?: InfrastructureNodeCollection) {
    this.data = customData ?? (infrastructureNodesData as unknown as InfrastructureNodeCollection);
  }

  /**
   * Retrieves all infrastructure nodes as a GeoJSON FeatureCollection.
   */
  async getInfrastructureNodes(): Promise<InfrastructureNodeCollection> {
    return Promise.resolve(this.data);
  }

  /**
   * Retrieves a single infrastructure node by its unique identifier.
   */
  async getNodeById(id: string): Promise<InfrastructureNodeFeature | null> {
    const feature = this.data.features.find((f) => f.properties.id === id);
    return Promise.resolve(feature ?? null);
  }

  /**
   * Retrieves infrastructure nodes filtered by their node type.
   */
  async getNodesByType(type: InfrastructureNodeType): Promise<InfrastructureNodeFeature[]> {
    const features = this.data.features.filter((f) => f.properties.type === type);
    return Promise.resolve(features);
  }

  /**
   * Retrieves infrastructure nodes filtered by their operational status.
   */
  async getNodesByStatus(status: InfrastructureNodeStatus): Promise<InfrastructureNodeFeature[]> {
    const features = this.data.features.filter((f) => f.properties.status === status);
    return Promise.resolve(features);
  }
}
