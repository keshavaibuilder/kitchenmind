#!/usr/bin/env node
// Manual, OPTIONAL live benchmark for candidate Gemini OCR pool models against a real bill image.
//
// NOT run automatically by tests, `npm test`, or CI — it makes real Gemini API calls and consumes
// real quota. Run it explicitly, deliberately, and sparingly:
//
//   VITE_GEMINI_API_KEY=... node scripts/benchmark-gemini-ocr-models.mjs <path-to-bill-image> [model1,model2,...]
//
// (or export VITE_GEMINI_API_KEY in your shell / `.env` first, same as running the app).
//
// Reuses the real, unmodified OCRService prompt and normalization (via esbuild, since
// OCRService.js is written for Vite and uses the `@/` path alias + import.meta.env that plain
// Node doesn't resolve on its own) — this benchmarks the actual production extraction contract,
// not a reimplementation of it. This script is intended to *inform* whether the default pool
// order in src/config/geminiModels.config.js should change; it does not change it automatically.
//
// Never prints the API key.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const DEFAULT_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
]

// Reference values from the bill.jpeg used as the regression fixture throughout the
// purchaseQuantity/packSize contract work. Edit this table (or just ignore the correctness
// columns) when benchmarking a different bill image.
const EXPECTED_ITEMS = [
  { match: /MUSTARD OI.*5lt/i, purchaseQuantity: 1, packSize: 5, unit: 'l' },
  { match: /SAFFOLA ACTI.*4\.18kg/i, purchaseQuantity: 1, packSize: 4.18, unit: 'kg' },
  { match: /TEA GOLD.*250g/i, purchaseQuantity: 1, packSize: 250, unit: 'g' },
  { match: /MAAZA MANGO.*1200ml/i, purchaseQuantity: 1, packSize: 1200, unit: 'ml' },
  { match: /KURNOOL RICE/i, purchaseQuantity: 5.036, packSize: null, unit: 'kg' },
  { match: /VIM DISHWASH B.*110g/i, purchaseQuantity: 9, packSize: 110, unit: 'g' },
]

async function loadOCRService() {
  const entryPath = path.join(repoRoot, 'src', 'services', 'OCRService.js')
  const result = await esbuild.build({
    stdin: {
      contents: `export { OCRService, OCR_PROMPT } from ${JSON.stringify(entryPath)}`,
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    alias: { '@': path.join(repoRoot, 'src') },
  })
  const code = result.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}

function fmtCheck(actual, expected) {
  if (expected === undefined) return '  n/a'
  const ok = actual === expected
  return ok ? '   ✓ ' : `   ✗ (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`
}

function scoreItemsAgainstExpected(items) {
  const rows = []
  for (const exp of EXPECTED_ITEMS) {
    const found = items.find((i) => exp.match.test(i.itemName))
    if (!found) {
      rows.push({ label: exp.match.toString(), status: 'NOT FOUND on this bill\'s extraction' })
      continue
    }
    rows.push({
      label: found.itemName,
      purchaseQuantity: fmtCheck(found.purchaseQuantity, exp.purchaseQuantity),
      packSize: fmtCheck(found.packSize, exp.packSize),
      unit: fmtCheck(found.unit, exp.unit),
      quantity: fmtCheck(found.quantity, exp.packSize != null ? exp.purchaseQuantity * exp.packSize : exp.purchaseQuantity),
    })
  }
  return rows
}

async function benchmarkModel(OCR_PROMPT, apiKey, mimeType, base64, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const t0 = Date.now()
  let status = null
  let latencyMs = null
  let itemCount = 0
  let items = []
  let error = null

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: OCR_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0.1 },
      }),
    })
    status = res.status
    latencyMs = Date.now() - t0

    if (res.ok) {
      const data = await res.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const cleaned = rawText.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      items = parsed.items || parsed
    } else {
      const text = await res.text().catch(() => '')
      error = text.slice(0, 200)
    }
  } catch (err) {
    latencyMs = Date.now() - t0
    error = err.message
  }

  return { model, status, latencyMs, itemCount: Array.isArray(items) ? items.length : 0, rawItems: items, error }
}

async function main() {
  const [, , imagePathArg, modelsArg] = process.argv
  if (!imagePathArg) {
    console.error('Usage: node scripts/benchmark-gemini-ocr-models.mjs <path-to-bill-image> [model1,model2,...]')
    process.exit(1)
  }
  if (!existsSync(imagePathArg)) {
    console.error(`Image not found: ${imagePathArg}`)
    process.exit(1)
  }

  const apiKey = process.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    console.error('VITE_GEMINI_API_KEY is not set in the environment. Aborting (this script never prompts for or hardcodes a key).')
    process.exit(1)
  }

  const models = modelsArg ? modelsArg.split(',').map((m) => m.trim()).filter(Boolean) : DEFAULT_MODELS
  const mimeType = imagePathArg.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  const base64 = readFileSync(imagePathArg).toString('base64')

  const { OCRService, OCR_PROMPT } = await loadOCRService()

  console.log(`Benchmarking ${models.length} model(s) against ${imagePathArg}`)
  console.log('This makes real, sequential Gemini API calls and will consume quota.\n')

  const results = []
  for (const model of models) {
    process.stdout.write(`Running ${model}... `)
    const result = await benchmarkModel(OCR_PROMPT, apiKey, mimeType, base64, model)
    console.log(result.status === 200 ? `HTTP ${result.status} (${result.latencyMs}ms)` : `HTTP ${result.status ?? 'ERR'} (${result.latencyMs}ms) ${result.error ?? ''}`.trim())
    results.push(result)
    // Small courtesy delay between sequential model calls — this script deliberately does not
    // parallelize, to avoid bursting the shared project-level quota across models at once.
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log('\n=== SUMMARY ===')
  console.log('MODEL'.padEnd(28), 'STATUS'.padEnd(8), 'LATENCY'.padEnd(10), 'ITEMS')
  for (const r of results) {
    console.log(
      r.model.padEnd(28),
      String(r.status ?? 'ERR').padEnd(8),
      `${r.latencyMs}ms`.padEnd(10),
      Array.isArray(r.rawItems) ? r.rawItems.length : 0
    )
  }

  for (const r of results) {
    if (r.status !== 200) continue
    let normalized
    try {
      normalized = OCRService._normalizeScanOutput(Array.isArray(r.rawItems) ? { items: r.rawItems } : r.rawItems)
    } catch (err) {
      console.log(`\n${r.model}: normalization failed — ${err.message}`)
      continue
    }
    console.log(`\n--- ${r.model}: purchaseQuantity / packSize / unit / quantity correctness ---`)
    const rows = scoreItemsAgainstExpected(normalized.items)
    for (const row of rows) {
      if (row.status) {
        console.log(`  ${row.label}: ${row.status}`)
      } else {
        console.log(`  ${row.label}`)
        console.log(`    purchaseQuantity: ${row.purchaseQuantity}`)
        console.log(`    packSize:         ${row.packSize}`)
        console.log(`    unit:             ${row.unit}`)
        console.log(`    quantity:         ${row.quantity}`)
      }
    }
  }

  console.log('\nDone. This is a benchmark for informing model-pool ordering, not a claim about quota independence —')
  console.log('a project-wide quota outage can still return 429 for every model above.')
}

main().catch((err) => {
  console.error('Benchmark failed:', err.message)
  process.exit(1)
})
