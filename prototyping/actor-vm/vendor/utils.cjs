exports.splitInstruction = instruction => [instruction & 15, (instruction >>> 4) & 3, (instruction >>> 6) & 3, instruction >>> 8, instruction >>> 6];
