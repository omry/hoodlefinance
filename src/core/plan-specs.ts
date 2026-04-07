export interface PlanSpecOptions {
  canHandleRef?: string;
  isRoutingNode?: boolean;
  routeClass?: string;
  routeClassRef?: string;
  routePath?: string;
  routePathRef?: string;
  routeStateBuilderRef?: string;
}

export interface PlanSpec {
  defaultNodeCodes?: string[];
  nodeCodes?: string[];
  options?: PlanSpecOptions;
  resolverClass: string;
}
