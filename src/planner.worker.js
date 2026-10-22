import { solveScenario } from './engine.js';

self.onmessage = async ({ data }) => {
  const { id, scenario, options } = data;
  try {
    const result = await solveScenario(scenario, options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
