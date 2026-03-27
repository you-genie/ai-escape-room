import { tutorialScenario } from "./tutorial";
import { hospitalScenario } from "./hospital";
import { submarineScenario } from "./submarine";
import type { Scenario } from "../scenario";

export const scenarios: Scenario[] = [
  tutorialScenario,
  hospitalScenario,
  submarineScenario,
];

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
