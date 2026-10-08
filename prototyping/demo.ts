import { runScenario } from './scenario.ts';
for (const step of runScenario()) console.log(`${step.action}: ${JSON.stringify(step.result)}`);
