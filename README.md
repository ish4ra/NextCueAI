<p><img src="public/icon.svg" width="54" height="54" alt="NextCueAI logo"></p>

# NextCueAI

**See the problem. Know what to do next.**

NextCueAI helps a friend who is stuck on a confusing screen. Add a screenshot of an app, error, settings page, or form, and get an explanation with practical next steps. It runs a vision model through Ollama on your computer.

Built for the DEV.to Hacktoberfest Weekend Challenge 2026, **Build for a Friend**. The idea is simple: make the kind of help you would give a friend looking over their shoulder available in English and Sinhala.

## What it does

- Drop, paste, or choose a PNG, JPG, or WebP screenshot, up to 10 MB.
- Preview or replace the image before sending it to your local model.
- Choose English or Sinhala, with simple or detailed explanations.
- Get an observation, a possible explanation, a next action, and ordered steps.
- Cancel, retry, copy the response, or clear the workspace.
- Check Ollama readiness and find setup instructions inside the app.

There is no chat history, account, database, analytics, or hosted inference fallback. Screenshots are analyzed only when you press **Analyze screenshot**. NextCueAI gives guidance; it does not control your computer.

## Run locally

Install **Node.js 24+** (Node 24 LTS recommended) and the [latest Ollama](https://ollama.com/download). Keep the Ollama desktop app running. On Linux, start it with `ollama serve`.

Download the default vision model once:

```sh
ollama pull gemma4:e2b
```

Then:

```sh
git clone https://github.com/ish4ra/NextCueAI.git
cd NextCueAI
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Both the frontend and local bridge start with that command. No `.env` file is required for the defaults.

The default [`gemma4:e2b`](https://ollama.com/library/gemma4:e2b) is an open-weight Gemma vision model, not a hosted API. Allow several GB for the model download plus additional runtime memory. A GPU helps; CPU inference can be slow. The first request also loads the model into memory.

### Production build

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. The Node server serves the built frontend and API together. This is a local application; uploading the Vite `dist` directory alone to a static host does not provide its AI bridge.

### Configuration

Copy `.env.example` to `.env` if you need to change a default, then restart the app.

| Variable            | Default                  | Purpose                                        |
| ------------------- | ------------------------ | ---------------------------------------------- |
| `OLLAMA_BASE_URL`   | `http://127.0.0.1:11434` | Loopback HTTP endpoint for Ollama              |
| `OLLAMA_MODEL`      | `gemma4:e2b`             | Installed local model with vision support      |
| `PORT`              | `3001`                   | Local bridge and production server port        |
| `OLLAMA_TIMEOUT_MS` | `180000`                 | Analysis timeout, between 1,000 and 600,000 ms |

For a smaller download, [`gemma3:4b`](https://ollama.com/library/gemma3:4b) is another image-capable option. Pull the model and set `OLLAMA_MODEL=gemma3:4b`. Gemma 3's 270M and 1B variants cannot read images. Larger models may produce better explanations but need more memory. Sinhala accuracy varies between models; choosing the language is not a guarantee of translation quality.

The server checks `/api/show` for vision capabilities before analysis. It rejects cloud model names, models reported as remote by Ollama, and non-loopback endpoints. Keep Ollama current so its capability metadata is available.

## Privacy and safety

**Your screenshots can stay on your computer.** By default, the browser sends the image to the local NextCueAI bridge, which sends it to local Ollama. NextCueAI does not save screenshots or model replies to disk, log their contents, or make analytics requests. Fonts and icons are local. Installing dependencies and downloading models require internet access; local inference does not.

The bridge binds to `127.0.0.1`, checks browser origins and host names, and does not offer a general-purpose proxy. It decodes images, rejects mismatched file types and animated inputs, limits input to 25 megapixels, strips metadata, and scales images down to a maximum 2,400-pixel edge before inference. Do not expose the bridge to the public internet. A custom loopback proxy or modified Ollama installation is outside these privacy guarantees.

Images remain in browser and process memory while in use. Clearing the workspace or closing the app drops NextCueAI's references; this is not secure memory erasure. Review your Ollama installation's own logging and data handling if your screenshots are sensitive. Crop out personal details before analysis.

Model output is validated against a JSON schema and rendered as text, never executable HTML. The prompt treats instructions inside screenshots as untrusted, but prompt injection defenses are not perfect. Verify important or risky actions yourself. The model can misread small text, invent an explanation, or suggest a step that does not match your version of an app.

## If something is not working

| Symptom                      | Try this                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Setup needed                 | Open Ollama or run `ollama serve`, then use **Check again**.                                      |
| Model missing                | Run the `ollama pull` command shown in the setup panel.                                           |
| Model cannot read images     | Use a vision variant and update Ollama.                                                           |
| Analysis takes too long      | Crop the relevant area, try a smaller model, close memory-heavy apps, or raise the timeout.       |
| Unusable response            | Retry with a clearer screenshot or another vision model. Raw malformed output is never displayed. |
| Image rejected               | Export a still PNG, JPG, or WebP under 10 MB and 25 megapixels.                                   |
| Copy is unavailable          | The response is selected for manual copying with Ctrl+C or ⌘C.                                    |
| Clipboard paste does nothing | Copy an image itself, not a file path, or use the file picker.                                    |
| Port already in use          | Set another `PORT` in `.env`; development Vite remains on port 5173.                              |

## Development

React, TypeScript, and Vite provide the interface. A small Express server validates images with Sharp and calls Ollama's `/api/chat` endpoint. Zod defines the shared output schema. Lucide provides the interface icons. There is no agent framework or database.

```text
src/          Screenshot workspace and browser API client
server/       Local HTTP bridge, image processing, Ollama integration
shared/       Response schema, file limits, and output formatting
tests/        Validation, API, and browser tests
public/       Original SVG brand mark
```

```sh
npm run check                     # lint, unit/API tests, production build
npx playwright install chromium   # first browser-test run only
npm run test:e2e                   # desktop/mobile workflows and accessibility
```

CI performs these checks on pushes and pull requests. API and browser tests use isolated test responses so contributors do not need a model download to run the suite. They verify the request contract and UI behavior, not the accuracy of a real model. Before changes to prompts or model support are released, also test real screenshots with local Ollama in both languages.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution and manual verification guidance. Real screenshots or recordings of the finished application are welcome; please remove personal information first.

## License

The application is [MIT licensed](LICENSE). The bundled Noto Sans Sinhala font uses the [SIL Open Font License](public/fonts/OFL.txt). AI model weights have their own terms; review the chosen model's license before redistribution. [Ollama's vision and structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs) describes the underlying API.
