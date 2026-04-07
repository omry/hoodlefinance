export interface PlanSpecOptions {
  isRoutingNode?: boolean;
  routeClass?: string;
  routePath?: string;
}

export interface PlanSpec {
  defaultNodeCodes?: string[];
  nodeCodes?: string[];
  options?: PlanSpecOptions;
  resolverClass: string;
}
