export interface PlanSpecOptions {
  isRoutingNode?: boolean;
  routeClass?: string;
  routePath?: string;
  routeStateBuilderRef?: string;
}

export interface PlanSpec {
  defaultNodeCodes?: string[];
  nodeCodes?: string[];
  options?: PlanSpecOptions;
  resolverClass: string;
}
