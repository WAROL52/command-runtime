import { z } from "zod"
import { CommandInterface, Command, CommandOption } from "../../src/index"
import type { ExecCmdOption } from "../../src/index"

export interface Ctx { apiKey?: string }

export class WeatherCmd extends CommandInterface<undefined, string, any, Ctx> {
  get unit(): string {
    return this.getOption<string>("unit") ?? "celsius"
  }

  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    const temp = opt.input === "Paris" ? 22 : opt.input === "London" ? 15 : 20
    return { success: true, data: { location: opt.input, temperature: temp, unit: this.unit } }
  }
}

export class CapitalCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    const capitals: Record<string, string> = { France: "Paris", UK: "London", Japan: "Tokyo" }
    return { success: true, data: { country: opt.input, capital: capitals[opt.input] ?? "unknown" } }
  }
}

export function registerCommands() {
  Command({ name: "weather", description: "Get weather for a city", input: z.string() })(WeatherCmd)
  Command({ name: "capital", description: "Get capital of a country", input: z.string() })(CapitalCmd)

  CommandOption({ name: "unit", alias: "u", description: "Temperature unit", input: z.enum(["celsius", "fahrenheit"]) })(
    WeatherCmd.prototype, "unit", Object.getOwnPropertyDescriptor(WeatherCmd.prototype, "unit")!
  )
}
