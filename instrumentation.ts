import { logInfo } from "@/lib/logging";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    logInfo("instrumentation_registered", { runtime: "nodejs" });
  }
}
