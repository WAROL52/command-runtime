import type { Runtime } from "../runtime/runtime"

export interface Adapter<TContext = any> {
  name: string
  run(runtime: Runtime<TContext>): void | Promise<void>
}
