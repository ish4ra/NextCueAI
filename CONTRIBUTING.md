# Contributing

Use Node.js 24+ and install dependencies with `npm ci`. Run `npm run dev` for the interface at http://127.0.0.1:5173. For live inference, install Ollama and pull the configured vision model as described in the README.

Before opening a pull request:

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Keep pull requests focused. Add regression coverage for changed behavior, particularly file handling, model responses, errors, and cancelling or replacing an image. Test fixtures belong in tests; production must never substitute a canned answer for inference.

For changes to the model integration or prompts, also check actual local inference:

1. Analyze a readable error or settings screenshot in English and Sinhala.
2. Try Simple and Detailed modes. Verify visible labels are preserved and uncertainty is acknowledged.
3. Stop Ollama, check the offline state, restart it, and retry.
4. Use an invalid model name and then a text-only model to check setup guidance.
5. Cancel an analysis and analyze another screenshot.
6. Check the interface at a narrow mobile width and with keyboard-only navigation.

A test double verifies protocol behavior, not model quality. Describe your real-model checks and hardware in your pull request when relevant. Do not include screenshots containing personal data, `.env`, model weights, or build outputs.

Please report reproducible bugs with the model tag, Ollama version, operating system, and the error shown by NextCueAI. A redacted screenshot helps when the problem concerns image interpretation. Improvements to natural Sinhala phrasing are especially useful.
