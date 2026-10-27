# Actor VM prototype

Run `npm run prototype:actor-vm`; test with `node --test prototyping/actor-vm.test.ts`.
Requires Node 24, as do the existing TypeScript prototypes.

## Decisions — 2026-10-27

Use four general-purpose registers A–D with reliable unsigned 16-bit values.
Arithmetic wraps modulo 65536; comparisons are unsigned. IP and SP are separate
control state. Registers, instruction pointer, memory, stack and perceived body
readings persist between ticks. Each actor owns all mutable state.

Actual body state stays in the simulation. READ_BODY returns an imperfect numeric
sensation, initially rounded to the nearest 10 on a 0–100 scale. Cache each channel
on its first read and retain the reading for at least three simulation ticks;
the first subsequent read refreshes it. This is sample-and-hold perception, not
a fixed three-tick physiological lag. A changed body can therefore remain unnoticed.
Repeated reads cannot obtain additional samples. Precision and refresh interval
are configurable per actor. Bias and random noise are deferred. Sensation and
motivation remain separate: programs decide how to respond to perceived values.

Initial channels: energy (0 depleted, 100 full), fatigue and pain (0 absent,
100 maximum). These are prototype conventions, not new production entity schemas.

Default memory is 1024 words, including immutable program words at its start;
remaining words are writable persistent memory. Default stack capacity is 32 words.
These limits are provisional; memory capacity is not yet an evolved trait.
The 16-bit word format follows 16bitjs. The helper encoders intentionally expose
only a small subset; there is no new textual assembler or UI debugger yet.

## Actor system-call interface

Load A with the call number, B with its input, then execute upstream SYS (0x002d).
Inputs are preserved unless the table specifies an output. A is not overwritten.

| A | Call | Input | Output | Scheduling |
|---|---|---|---|---|
| 1 | READ_BODY | B: channel (0 energy, 1 fatigue, 2 pain) | B: cached sensation | Continues |
| 2 | SENSE | B: host-defined sense kind | B: direction; C: strength 0–100; D: detected 0/1 | Yields |
| 3 | MOVE | B: host-defined direction | Pending action | Waits for host |
| 4 | EAT | B: host-defined local target selector | Pending action | Waits for host |
| 5 | VOCALIZE | B: signal code | Pending action | Waits for host |
| 6 | REST | B: host-defined rest mode | Pending action | Waits for host |
| 7 | YIELD | None | None | Yields |
| 8 | READ_RESULT | None | B: last completed action result | Continues |

SENSE clears B/C/D to zero when nothing is detected. Direction zero may also be
valid, so inspect D. The host supplies already-limited perception; this VM does
not implement vision, geography, hearing propagation or sensory noise. Successful
and unsuccessful sensing both yield, limiting sampling to once per tick.

Actions emit intents without changing the world. The host validates and resolves
them, including duration and cost, then calls completeAction(result). The example
uses 0 for failure and 1 for success. While pending, no actor instructions execute.
Registers cannot directly edit body state or world state.

## Scheduling, faults, and checkpoints

runTick takes explicit increasing integer simulation ticks and an instruction
budget (default 32). Only one call per actor per tick is allowed, even after an
action is acknowledged. Budget exhaustion preserves the next instruction pointer.
The host must schedule actors and resolve competing world actions; no global
fairness or conflict policy is implemented here.

Invalid instructions, unknown calls, invalid addresses, code writes, division by
zero, and stack errors fault that actor. Faults do not exit Node. Execution is not
transactional: earlier instructions in the turn remain applied. Inputs are trusted
prototype programs; this is not a security sandbox for arbitrary host code.

snapshot returns an independent JSON-compatible checkpoint including the program,
configuration, registers, memory, stack, perceptions and timestamps, pending action,
result and status. restore reconstructs the machine without resampling. The host
must separately checkpoint body/world state and its pending action resolution so
an action is not applied twice. Production program versioning/storage is deferred.

## 16bitjs provenance and adaptations

Source: https://github.com/francisrstokes/16bitjs
at commit 7182b81613e8278aafe4ef1da13dd3988eae2f77.
The upstream MIT notice is retained in prototyping/actor-vm/vendor/LICENSE.

The vendored decoder, ALU, constants, and instruction splitting derive from upstream.
Changes: CommonJS .cjs imports; injected SYS callback instead of terminal I/O;
local ALU scratch storage; explicit invalid-operation and division-by-zero faults.
The new TypeScript wrapper replaces upstream global registers, memory, stack and
process-exiting runner with actor-local bounded execution. It enforces unsigned
register writes, memory bounds and immutable code. The original CLI, filesystem
helpers and dependencies are not included.

This is a genuine adaptation of the 16bitjs instruction decoder, not an independent
instruction set. Runtime safety and memory protections intentionally differ from
upstream. The prototype sits alongside existing effect/personality engines; it is
not yet integrated with Gradient Life Lab and does not replace effect evaluation.

## What the example demonstrates

The animal initially feels energy 50. After eating, its exact energy increases,
but it still feels 50 until the next refresh; it eats again and then requests food
that has run out. Once its sensation refreshes, it rests. This deliberately simple
program ignores action results, illustrating why later programs should inspect
failure and use perception rather than assuming food remains available.
