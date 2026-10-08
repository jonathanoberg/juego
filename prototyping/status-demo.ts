import { runStatusScenario } from './status-scenario.ts';
for (const [label, roll] of [['Spill', 0.1], ['No spill', 0.9]] as const) {
  console.log(label);
  for (const step of runStatusScenario(roll)) console.log(`${step.action}: ${step.description}`);
}
