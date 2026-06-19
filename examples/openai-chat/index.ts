import { createRuntime } from "../../src/index"
import { createOpenAIAdapter } from "../../src/adapters/ai/openai-adapter"
import { WeatherCmd, CapitalCmd, registerCommands, type Ctx } from "./commands"

registerCommands()

const runtime = createRuntime<Ctx>({
  name: "assistant",
  commands: [WeatherCmd, CapitalCmd],
})

const adapter = createOpenAIAdapter(runtime, { apiKey: process.env.OPENAI_API_KEY })

console.log("=== OpenAI Tools ===")
console.log(JSON.stringify(adapter.tools, null, 2))
console.log()

const demo = async () => {
  const weather = await adapter.executeTool("weather", { input: "Paris", unit: "celsius" })
  console.log("weather('Paris', unit=celsius):", JSON.stringify(weather, null, 2))

  const capital = await adapter.executeTool("capital", { input: "France" })
  console.log("capital('France'):", JSON.stringify(capital, null, 2))
}

demo().catch(console.error)
