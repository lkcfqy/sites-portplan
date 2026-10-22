# GLPK.js / WebAssembly source provenance and rebuild

Checked 2026-10-12. The source archive includes the JavaScript/C wrapper **and the exact pinned GLPK submodule source**, in addition to published binaries. Installing the npm package alone does not build the C solver.

## Versions and provenance

| Component | Verified identifier |
|---|---|
| npm package | `glpk.js@5.0.0` |
| Upstream tag | `v5.0.0` |
| npm `gitHead` / tag commit | `80e1ff5bd80b588bc233a4427b0687128146c8d0` |
| `src/glpk` gitlink | `4945cf1cb8e860b24d8b79a8a258c2d214945d10` |
| Submodule upstream | `https://salsa.debian.org/science-team/glpk.git` |
| GLPK C version | `5.0`, from the pinned `configure.ac` and the installed WASM `glp_version()` |
| Emscripten image | `emscripten/emsdk:4.0.3`, from upstream Dockerfile |
| Node | >=20, from upstream package.json |

Evidence: [npm metadata](https://registry.npmjs.org/glpk.js/5.0.0), [upstream release](https://github.com/jvail/glpk.js/releases/tag/v5.0.0), and [pinned submodule metadata](https://api.github.com/repos/jvail/glpk.js/contents/src/glpk?ref=80e1ff5bd80b588bc233a4427b0687128146c8d0). A local copy of the submodule GET result is `vendor/source/glpk-submodule-pin.json`.

## Included source archives

All files below are under `vendor/source/`. `source-manifest.json` records URLs, sizes, identifiers, validation and hashes; `SHA256SUMS` permits local verification.

| Archive | SHA-256 |
|---|---|
| `glpk-js-80e1ff5bd80b588bc233a4427b0687128146c8d0.tar.gz` | `c9181a09422bc2e46283f1563f4cb06c9a6ce0ceca27eaecd7e84ffa1979fecf` |
| `glpk-submodule-4945cf1cb8e860b24d8b79a8a258c2d214945d10.tar.gz` | `a667028edb376ffb6d9a862174247957430307e76aa55534c551b0530953c862` |
| `glpk-js-5.0.0-npm.tgz` | `8b0d01e5cb4b54520a7d5df717440508454b78d4fe9a7f1ce5bb932a48f4e909` |
| `glpk-5.0.tar.gz` (GNU release, additional reference) | `4a1013eebb50f728fc601bdd833b0b2870333c3b3e5a816eeba921d95bec6f15` |

Use the **pinned submodule archive** for the recipe, not the additional GNU reference archive. GitHub source archives leave git submodules empty; the second archive supplies that otherwise missing source tree, including GLPK C files, build files and COPYING.

## Rebuild from C and wrapper sources

Run from the PortPlan repository root. The following creates a temporary build directory and does not overwrite the application or its installed solver.

```bash
PORTPLAN_ROOT="$(pwd)"
(cd "$PORTPLAN_ROOT/vendor/source" && sha256sum -c SHA256SUMS)
PORTPLAN_GLPK_BUILD="$(mktemp -d)"
tar -xzf "$PORTPLAN_ROOT/vendor/source/glpk-js-80e1ff5bd80b588bc233a4427b0687128146c8d0.tar.gz" \
  -C "$PORTPLAN_GLPK_BUILD" --strip-components=1
mkdir -p "$PORTPLAN_GLPK_BUILD/src/glpk"
tar -xzf "$PORTPLAN_ROOT/vendor/source/glpk-submodule-4945cf1cb8e860b24d8b79a8a258c2d214945d10.tar.gz" \
  -C "$PORTPLAN_GLPK_BUILD/src/glpk" --strip-components=1
cd "$PORTPLAN_GLPK_BUILD"
docker build -t portplan-glpk-source-build .
docker run --rm -v "$PORTPLAN_GLPK_BUILD:/app" portplan-glpk-source-build \
  sh -lc 'npm ci && npm run build && npm test'
```

The upstream Dockerfile installs `automake`, `autoconf`, and `libtool`. `npm run build` executes `make all`: it runs `autoreconf`, configures GLPK for `wasm32-unknown-emscripten`, compiles the static library with `emmake`, and invokes `emcc` on that library plus `src/glpk.js.c`. The JavaScript step runs Rollup and `src/pack.js` to package the worker/WASM for the browser. The upstream lockfile is included in the source archive and separately as `upstream-package-lock.json`.

Without Docker, install Emscripten SDK 4.0.3, the above autotools, and Node >=20; activate the SDK in the shell, then run `npm ci`, `npm run build`, and `npm test` inside the prepared build tree. Network access is needed for toolchain/dependency installation. Use the managed environment's supported proxy/CA configuration when building there.

After successful rebuilding, the generated `dist/` directory contains the replacement solver assets. To use it in PortPlan, replace the matching files under `node_modules/glpk.js/dist/`, then run the application's tests and Vite build. Keep the modified source and compiler/build logs if changing the solver.

## Checks actually performed

- npm tarball SHA-1 and SHA-512 integrity match the official registry metadata.
- npm `dist/glpk.wasm`, `dist/glpk.js`, `dist/index.js`, `src/glpk.js.c`, Makefile and Dockerfile match the corresponding files in the pinned upstream archive byte-for-byte.
- The installed solver reports GLPK `5.0`; the pinned submodule's `configure.ac` declares GLPK `5.0`.
- Archives parse successfully; the submodule contains GLPK headers and COPYING. SHA-256 values are recorded locally.

**The C-to-WASM rebuild was not executed in this session.** The source inputs and upstream build recipe are supplied, but reproducible binary equality is not claimed. The image is version-tagged rather than digest-pinned, and OS package/compiler environment details can affect byte-for-byte output. Published WASM SHA-256 is `acf09a204bbed381fd00fe57a3d4f8337986f28245daba5e977831ba1fc090ca`.
