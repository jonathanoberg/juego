# Gradient Life Lab maintenance

This project is the canonical source for the Gradient Life Lab simulation, also hosted at https://gradient-life-lab.jonathanoberg.chatgpt.site.

- Implement future simulation, interface, rule, and test changes here in juego. Keep this folder current whenever the user requests changes to the simulation.
- Run `npm test` in this folder after model changes; update relevant tests and the README when rules change.
- Commit and push authorized changes to juego as part of completing the work. The user has explicitly requested ongoing synchronization.
- Publish corresponding application changes with the Sites skill, preserving the existing Site identity and private audience. Use `npm run sync-site -- <site-checkout>` to copy canonical public files into its deployment checkout before the normal Sites packaging workflow.
- Do not commit Site credentials, hosting manifests, archives, node_modules, or Git metadata here. The synchronization script only copies application files and does not deploy or authenticate.
- Report simulation outcomes honestly; passing invariants does not establish ecological stability. Do not tune tests to require survival or claim biological fidelity.
