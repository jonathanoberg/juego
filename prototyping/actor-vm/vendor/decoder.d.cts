declare function decode(instruction: number, registers: Record<string, number>, memory: number[],
  stack: { push(value: number): void; pop(): number }, systemCall: (registers: Record<string, number>, memory: number[]) => void): boolean | undefined;
export = decode;
