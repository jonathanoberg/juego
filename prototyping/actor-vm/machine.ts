import decode from './vendor/decoder.cjs';

export type Register = 'A' | 'B' | 'C' | 'D';
export type BodyChannel = 'energy' | 'fatigue' | 'pain' | 'crowding';
export type Action = { kind: 'move' | 'eat' | 'vocalize' | 'rest' | 'grow'; argument: number };
export interface Environment {
  // Values are normalized body sensations, 0..100. Exact state stays in the host.
  body(channel: BodyChannel): number;
  sense(kind: number): { detected: boolean; direction: number; strength: number };
}
export interface Configuration { precision: number; refreshTicks: number; memoryWords: number; stackWords: number }
export interface Snapshot {
  version: 1; program: number[]; config: Configuration; registers: Record<string, number>;
  memory: number[]; stack: number[]; sensations: Partial<Record<BodyChannel, { value: number; at: number }>>;
  lastTick: number; halted: boolean; fault: string | null; pending: Action | null; result: number;
}
export interface Turn {
  reason: 'budget' | 'yield' | 'action' | 'waiting' | 'halted' | 'fault';
  executed: number; action?: Action; fault?: string;
}
export const SYS = { READ_BODY: 1, SENSE: 2, MOVE: 3, EAT: 4, VOCALIZE: 5, REST: 6, YIELD: 7, READ_RESULT: 8, GROW: 9 } as const;
const channels: BodyChannel[] = ['energy', 'fatigue', 'pain', 'crowding'];
const names = ['A', 'B', 'C', 'D', 'IP', 'SP'];
function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}
function word(value: number) { return integer(value, 0, 65535, 'word'); }

/** Per-actor, bounded adaptation of 16bitjs. No wall clock or ambient randomness. */
export class ActorVM {
  private state: Snapshot;
  constructor(program: readonly number[], configuration: Partial<Configuration> = {}) {
    const config = { precision: 10, refreshTicks: 3, memoryWords: 1024, stackWords: 32, ...configuration };
    integer(config.precision, 1, 100, 'precision');
    integer(config.refreshTicks, 1, 65535, 'refresh interval');
    integer(config.memoryWords, 1, 65536, 'memory size');
    integer(config.stackWords, 1, 65535, 'stack size');
    if (!program.length || program.length > config.memoryWords) throw new Error('Program does not fit memory');
    program.forEach(word);
    const memory = Array<number>(config.memoryWords).fill(0);
    memory.splice(0, program.length, ...program);
    this.state = { version: 1, program: [...program], config, registers: { A: 0, B: 0, C: 0, D: 0, IP: 0, SP: 0 },
      memory, stack: [], sensations: {}, lastTick: -1, halted: false, fault: null, pending: null, result: 0 };
  }
  snapshot(): Snapshot { return structuredClone(this.state); }
  static restore(saved: Snapshot): ActorVM {
    if (saved.version !== 1) throw new Error('Unsupported VM version');
    const vm = new ActorVM(saved.program, saved.config);
    if (saved.memory.length !== saved.config.memoryWords || saved.stack.length > saved.config.stackWords) throw new Error('Invalid saved memory');
    saved.memory.forEach(word); saved.stack.forEach(word);
    if (saved.program.some((v, i) => saved.memory[i] !== v)) throw new Error('Modified saved program');
    for (const name of names) {
      // An invalid jump is retained in faulted checkpoints for debugging.
      integer(saved.registers[name], name === 'IP' ? -Number.MAX_SAFE_INTEGER : 0,
        name === 'IP' ? Number.MAX_SAFE_INTEGER : 65535, 'saved register');
    }
    if (saved.registers.SP !== saved.stack.length) throw new Error('Invalid saved stack pointer');
    integer(saved.lastTick, -1, Number.MAX_SAFE_INTEGER, 'saved tick'); word(saved.result);
    if (typeof saved.halted !== 'boolean' || !(saved.fault === null || typeof saved.fault === 'string')) throw new Error('Invalid saved status');
    for (const [channel, reading] of Object.entries(saved.sensations)) {
      if (!channels.includes(channel as BodyChannel) || !reading) throw new Error('Invalid saved sensation');
      integer(reading.value, 0, 100, 'saved sensation'); integer(reading.at, 0, saved.lastTick, 'saved sensation time');
    }
    if (saved.pending && (!['move', 'eat', 'vocalize', 'rest', 'grow'].includes(saved.pending.kind) || !Number.isInteger(saved.pending.argument))) throw new Error('Invalid pending action');
    if (saved.pending) word(saved.pending.argument);
    vm.state = structuredClone(saved);
    return vm;
  }
  completeAction(result: number) {
    if (!this.state.pending) throw new Error('No pending action');
    word(result); this.state.result = result; this.state.pending = null;
  }
  runTick(tick: number, environment: Environment, budget = 32): Turn {
    integer(tick, 0, Number.MAX_SAFE_INTEGER, 'tick'); integer(budget, 1, 65535, 'budget');
    const s = this.state;
    if (tick <= s.lastTick) throw new Error('Each actor may run only once per increasing tick');
    s.lastTick = tick;
    if (s.fault) return { reason: 'fault', executed: 0, fault: s.fault };
    if (s.halted) return { reason: 'halted', executed: 0 };
    if (s.pending) return { reason: 'waiting', executed: 0 };
    let yielded = false, executed = 0;
    // Wrap only general registers; IP and SP are checked as control state.
    const registers = new Proxy(s.registers, { set(target, key: string, value: number) {
      if (!names.includes(key) || !Number.isFinite(value)) throw new Error('Invalid register write');
      target[key] = key === 'IP' || key === 'SP' ? value : value & 65535; return true;
    } });
    const memory = new Proxy(s.memory, {
      get(target, key) {
        if (typeof key === 'string' && /^-?\d+$/.test(key)) integer(Number(key), 0, target.length - 1, 'memory address');
        return Reflect.get(target, key);
      },
      set(target, key, value: number) {
        if (typeof key !== 'string' || !/^\d+$/.test(key)) throw new Error('Invalid memory address');
        const address = integer(Number(key), s.program.length, target.length - 1, 'writable memory address');
        target[address] = value & 65535; return true;
      }
    });
    const stack = {
      push(value: number) { if (s.stack.length >= s.config.stackWords) throw new Error('Stack overflow'); s.stack.push(word(value)); s.registers.SP = s.stack.length; },
      pop() { if (!s.stack.length) throw new Error('Stack underflow'); const value = s.stack.pop()!; s.registers.SP = s.stack.length; return value; }
    };
    const syscall = () => {
      const input = registers.B;
      switch (registers.A) {
        case SYS.READ_BODY: {
          const channel = channels[input];
          if (!channel) throw new Error('Unknown body channel');
          let reading = s.sensations[channel];
          if (!reading || tick - reading.at >= s.config.refreshTicks) {
            const exact = environment.body(channel);
            if (!Number.isFinite(exact) || exact < 0 || exact > 100) throw new Error('Invalid body value');
            reading = { value: Math.min(100, Math.round(exact / s.config.precision) * s.config.precision), at: tick };
            s.sensations[channel] = reading;
          }
          registers.B = reading.value; break;
        }
        case SYS.SENSE: {
          const observation = environment.sense(input);
          if (typeof observation.detected !== 'boolean') throw new Error('Invalid detection');
          registers.B = observation.detected ? word(observation.direction) : 0;
          registers.C = observation.detected ? integer(observation.strength, 0, 100, 'signal strength') : 0;
          registers.D = Number(observation.detected);
          // A sensory operation consumes the rest of this tick, including failed detection.
          yielded = true; break;
        }
        case SYS.MOVE: case SYS.EAT: case SYS.VOCALIZE: case SYS.REST: case SYS.GROW: {
          const kinds = { 3: 'move', 4: 'eat', 5: 'vocalize', 6: 'rest', 9: 'grow' } as const;
          s.pending = { kind: kinds[registers.A as keyof typeof kinds], argument: input }; yielded = true; break;
        }
        case SYS.YIELD: yielded = true; break;
        case SYS.READ_RESULT: registers.B = s.result; break;
        default: throw new Error('Unknown actor system call');
      }
    };
    try {
      while (executed < budget) {
        integer(s.registers.IP, 0, s.program.length - 1, 'instruction pointer');
        const instruction = s.program[s.registers.IP++]; executed++;
        s.halted = Boolean(decode(instruction, registers, memory, stack, syscall));
        if (s.halted) return { reason: 'halted', executed };
        if (s.pending) return { reason: 'action', executed, action: structuredClone(s.pending) };
        if (yielded) return { reason: 'yield', executed };
      }
      return { reason: 'budget', executed };
    } catch (error) {
      s.fault = error instanceof Error ? error.message : String(error);
      return { reason: 'fault', executed, fault: s.fault };
    }
  }
}

// Small checked encoders for the upstream instruction format; offsets are from the next IP.
const registerIndex = (r: Register) => {
  const index = ['A', 'B', 'C', 'D'].indexOf(r);
  return integer(index, 0, 3, 'register');
};
export const asm = {
  load(r: Register, value: number) { return (integer(value, 0, 255, 'immediate') << 8) | (registerIndex(r) << 4) | 1; },
  move(destination: Register, source: Register) { return (registerIndex(source) << 6) | (registerIndex(destination) << 4); },
  add(destination: Register, source: Register) { return (registerIndex(source) << 6) | (registerIndex(destination) << 4) | 4; },
  store(r: Register, address: number) { return (integer(address, 0, 1023, 'address') << 6) | (registerIndex(r) << 4) | 3; },
  read(r: Register, address: number) { return (integer(address, 0, 1023, 'address') << 6) | (registerIndex(r) << 4) | 11; },
  jump(offset: number) { return ((integer(offset, -2048, 2047, 'jump offset') & 4095) << 4) | 9; },
  less(left: Register, right: Register, target: Register) { return (2 << 10) | (registerIndex(target) << 8) | (registerIndex(right) << 6) | (registerIndex(left) << 4) | 6; },
  sys: 0x2d, halt: 0x3d
};
