export type NodeResult =
  | { status: 'success'; value: object }
  | { status: 'lookup_failure' }
  | { status: 'terminal_error'; error: string };

export interface NodeExecutor {
  execute(input: object): NodeResult;
}
