import { z } from "zod"
import {
  Command,
  CommandChild,
  CommandOption,
  CommandInterface,
} from "../../src/index"
import type { ExecSubCmdOption, ExecCmdOption } from "../../src/index"

export interface DeployContext {
  logs: string[]
}

// ─── Level 3: DeployCommand (leaf) ────────────────────────────────
@Command({
  name: "deploy",
  description: "Deploy a project to an environment",
  input: z.string(),
  examples: [
    { cmd: "app project deploy myapp --env prod", description: "Deploy myapp to prod" },
  ],
})
export class DeployCommand extends CommandInterface<ProjectCommand, string, any, DeployContext> {
  constructor(public override parent: ProjectCommand) {
    super(parent)
  }

  async execute(opt: ExecCmdOption<string, DeployContext>): Promise<any> {
    const { input: projectName, context, nextChild } = opt
    context.logs.push(`Deploying ${projectName} to ${this.env} from branch ${this.branch}`)
    return {
      success: true,
      data: {
        project: projectName,
        env: this.env,
        branch: this.branch,
        status: "deployed",
      },
    }
  }

  @CommandOption({
    name: "env",
    alias: "e",
    description: "Target environment (dev, staging, prod)",
    input: z.string(),
  })
  get env(): string {
    return this.getOption<string>("env") ?? "dev"
  }

  @CommandOption({
    name: "branch",
    alias: "b",
    description: "Git branch to deploy",
    input: z.string().optional(),
  })
  get branch(): string | undefined {
    return this.getOption<string | undefined>("branch")
  }
}

// ─── Level 2: ProjectCommand (middle) ──────────────────────────
@Command({
  name: "project",
  description: "Manage projects",
})
export class ProjectCommand extends CommandInterface<AppCommand, unknown, unknown, DeployContext> {
  constructor(public override parent: AppCommand) {
    super(parent)
  }

  async execute(opt: ExecCmdOption<unknown, DeployContext>): Promise<any> {
    const { context, nextChild } = opt
    context.logs.push("Project help shown")
    return { success: true, data: "help shown" }
  }

  @CommandChild({
    child: DeployCommand,
    Constructor(parent: ProjectCommand) {
      return new DeployCommand(parent)
    },
  })
  async deploy(opt: ExecSubCmdOption<DeployCommand, string, DeployContext>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push(`Project context: enriched`)
    const result = await child.execute({ input, context, nextChild })
    context.logs.push(`Deploy result: ${result.success ? "ok" : "failed"}`)
    return result
  }
}

// ─── Level 1: AppCommand (root) ───────────────────────────────
@Command({
  name: "app",
  description: "Deployment application CLI",
})
export class AppCommand extends CommandInterface<undefined, unknown, unknown, DeployContext> {
  async execute(opt: ExecCmdOption<unknown, DeployContext>): Promise<any> {
    return { success: true, data: "App root — use 'app project deploy <name>'" }
  }

  @CommandChild({
    child: ProjectCommand,
    Constructor(parent: AppCommand) {
      return new ProjectCommand(parent)
    },
  })
  async project(opt: ExecSubCmdOption<ProjectCommand, string, DeployContext>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push("App root: orchestrating deployment")

    const link = nextChild()
    if (!link) {
      return child.execute({ input, context, nextChild: () => null })
    }

    return child.deploy({
      child: link.child,
      input,
      context,
      nextChild: link.nextChild,
    })
  }
}
