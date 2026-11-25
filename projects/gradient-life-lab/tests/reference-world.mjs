// Existing rule-specific regression fixtures explicitly exercise the reference controller.
import { World as Ecosystem, N, dirs } from '../public/engine.mjs';
export { N, dirs };
export class World extends Ecosystem { constructor(seed, options = {}) { super(seed, { ...options, controller: 'rules' }); } }
