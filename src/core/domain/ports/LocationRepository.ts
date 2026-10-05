import type {
  InfrastructureNodeCollection,
  InfrastructureNodeFeature,
  InfrastructureNodeType,
  InfrastructureNodeStatus
} from '../models/InfrastructureNode';

/**
 * Port contract for retrieving telecommunication infrastructure locations.
 */
export interface LocationRepository {
  /**
   * Retrieves all infrastructure nodes as a GeoJSON FeatureCollection.
   */
  getInfrastructureNodes(): Promise<InfrastructureNodeCollection>;

  /**
   * Retrieves a single infrastructure node by its unique identifier.
   * @param id The unique identifier of the node.
   */
  getNodeById(id: string): Promise<InfrastructureNodeFeature | null>;

  /**
   * Retrieves infrastructure nodes filtered by their node type.
   * @param type Node category type.
   */
  getNodesByType(type: InfrastructureNodeType): Promise<InfrastructureNodeFeature[]>;

  /**
   * Retrieves infrastructure nodes filtered by their operational status.
   * @param status Node operational status.
   */
  getNodesByStatus(status: InfrastructureNodeStatus): Promise<InfrastructureNodeFeature[]>;
}
