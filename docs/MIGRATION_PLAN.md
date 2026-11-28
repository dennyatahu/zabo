# Rencana Migrasi zabo ke Bun

## 1. Inventaris awal

- Runtime: Bun 1.4.5
- Jumlah file sumber: 40 file JavaScript ESM di `src/`
- Total baris: 4049
- Tidak ada test, linter, formatter, atau `bunfig.toml`
- Dependency utama: `zapo-js`, `@zapo-js/media-utils`, `@zapo-js/native`, `@zapo-js/store-sqlite`, `pino`, `pino-pretty`, `qrcode-terminal`, `sharp`

## 2. Pemetaan Node ke Bun yang sudah diterapkan

| Modul/ API | Sebelum | Sesudah | Alasan |
| --- | --- | --- | --- |
| SQLite | `node:sqlite` | `bun:sqlite` | Driver bawaan Bun, lebih cepat, tanpa kompilasi |
| Supervisor | `node:child_process` | `Bun.spawn` | API Bun native, dukungan sinyal dan exit code |
| Shell plugin | `child_process.exec` | `Bun.spawn` | Tanpa promisify, output pipe langsung |
| Hash | `node:crypto` | `Bun.CryptoHasher` | API Bun native |
| File I/O | `node:fs/promises` | `Bun.file`/`Bun.write` | Lebih ringkas, buat folder otomatis |
| Environment | `process.env` | `Bun.env` | Padanan Bun yang konsisten |
| Worker thread | `node:worker_threads` | diproses di main thread | Menyederhanakan dan menghindari thread tambahan |

## 3. Struktur target

```
src/
  main.js
  supervisor.js
  config/
    constants.js
    env.js
    paths.js
    index.js
  core/
    client/index.js
    database/
    dispatcher/index.js
    logger/index.js
    session/index.js
    store/index.js
  events/
  services/
    menu/
    plugin-service.js
    prefix-service.js
    reload-service.js
    restart-service.js
    selective-service.js
    toggle-service.js
  shared/
  plugins/
    owner/
    info/
```

## 4. Peta nama lama ke nama baru

| Nama lama | Nama baru |
| --- | --- |
| `src/launcher.js` | `src/supervisor.js` |
| `src/config.js` | `src/config/env.js` + `src/config/paths.js` |
| `src/constants.js` | `src/config/constants.js` |
| `src/utils.js` | `src/shared/*` |
| `src/events.js` | `src/events/*` |
| `src/core/*.js` | `src/core/*/*.js` |
| `src/managers/*-manager.js` | `src/services/*-service.js` |
| `src/lib/*.js` | `src/shared/*.js` |
| `src/plugins/owner/plugin.js` | `src/plugins/owner/plugin-service.js`? (dipertahankan nama plugin.js) |

## 5. Risiko

- Import relatif panjang akan diganti alias `#...` lewat `package.json#imports`.
- Hot reload plugin harus tetap berfungsi dengan query cache-busting.
- `eval` plugin harus mempertahankan variabel konteks.
- Skema SQLite dan migrasi ringan tidak boleh berubah.
- Perilaku bot dan teks balasan tidak boleh berubah.
```

Then Fase 1: we already did most. Need add bunfig.toml, jsconfig, Biome? Fase 3. Let's proceed in phases. But first commit this plan? The prompt says commit per phase. Fase 0 commit. Let's commit plan.<|end|><|start|>start<|channel|>shell<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /root/zabo-gh && mkdir -p docs && git add docs/MIGRATION_PLAN.md && git commit -m "docs: add Bun migration plan" && git push origin main 2>&1 | tail -3