# Targets and geography — working vocabulary

The response table in `purposeful-responses.md` is set aside for later evaluation.
It is a design proposal, not a biological taxonomy. Responses distinguish action,
target, immediate purpose, and underlying pressure. Needs and disposition remain
unfinished; Panksepp's seven emotional systems were proposed as motivation
scales, not implemented behavior logic.

## Targets

Separate what something is from its role relative to the actor.

| Target type | Examples |
| --- | --- |
| Self | Acting entity |
| Body part | Wound, leg, wing |
| Other actor | Human, wolf, dragon |
| Group | Pack, herd, family |
| Object | Sword, boulder, cabin |
| Substance | Water, blood, food |
| Location / region / place | Position, spatial extent, recognized named place |
| Terrain structure | Cave cavity, creek bed, cliff |
| Signal or trace | Scent, tracks, call |

Prey, companion, mate, dependent, threat, food source, shelter, resting site,
territory, and novel stimulus describe roles, relationships, or affordances,
not exclusive physical entity types. A target may be a known identity or a set
of qualifying criteria for something not yet located.

## Geography decomposition

| Component | Examples |
| --- | --- |
| Terrain structure | Channel bed, basin, cave cavity, slope |
| Situated entity | Tree, cabin, bridge, boulder |
| Substance distribution | Water, snow, lava |
| Current state | Dry, flooded, frozen, burning |

A creek can retain its identity when its channel is dry. Shelter and den describe
uses. A boundary is relative to a region; a terrain structure can be inside one
region while forming another region's boundary. Traversal consequences depend
on the actor and are distinct from physical terrain.

Hex interiors describe surface and relief; two side approaches and a shared
transition can describe slopes, crests, troughs, cliffs, or gaps. The generation
prototype uses a coherent relative-height field instead of independent edge
heights. Local details can become substantial terrain when examined at finer
scales. See `hex-aggregation.md`, `terrain-storage.md`, and
`terrain-generation.md` for implemented experiments and limitations.

## Designer policy

Author major features, generate detail, then edit. Defaults precede generated
variation, authored features, and explicit edits. Deliberate edits win.
Named regions (including political claims) overlap independently of grid cells.
Cave entrances connect separate geographic worlds. Prototypes supply properties;
labels are descriptive. Current generator/prototype rules may evolve; revisions
invalidate cached terrain. Routine generated cells are not stored.

Reference supplied by the user for future terrain/UI discussion:
https://www.gamedeveloper.com/programming/creating-a-dynamic-tile-system

## Earlier need candidates (not finalized)

Nourishment, hydration, rest, physical integrity, environmental comfort, safety,
social connection, and stimulation were proposed. Respiration, elimination,
reproductive fulfillment, and space/privacy were optional candidates.
We subsequently chose to work backward from purposeful responses rather than
adopt this list unchanged. Disposition dimensions remain open.
