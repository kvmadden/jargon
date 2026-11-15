# Synthetic learner flow capture

The PNGs show the existing term-detail flow with a fictional learner, a cached synthetic rewrite and the original-definition toggle. No model or hosted backend was called. Keyboard Enter switches between original and personalized text at all three sizes. Captures have no horizontal overflow, visible interactive targets are at least 44 by 44 pixels, and there were no page errors.

The application currently ships a dark palette. These are explicitly **light presentation captures**, using the vendored design token package's light variants in the capture browser only. They do not demonstrate a shipped theme switch. No learner-facing styling or behavior was changed. At 390 pixels the existing floating feedback launcher can overlap lower content, although the toggle remains keyboard accessible.

Reproduce from the repository root with `node scripts/capture-portfolio.mjs`. It opens a visible Chromium browser, starts an isolated local dev server, uses mocked local data, blocks other network traffic and closes its browser and server. Fonts come from the existing E2E fixtures. The Phosphor `plugs-connected` icon fixture comes from `https://api.iconify.design/ph/plugs-connected.svg`, MIT licensed by Phosphor Icons. The fixture avoids broken icons when the capture blocks outbound traffic.

The primary portfolio image is `learner-flow-light-1440x900.png`. Smaller captures preserve the responsive screen for inspection. The screenshots illustrate the flow, not a new model result or proof of verifier accuracy.
