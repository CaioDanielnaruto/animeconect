import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyQuote } from '../src/data/dailyQuotes.js'
import { getCharacterImage, normalizeCharacterName } from '../src/lib/jikan.js'

test('mantém a frase no mesmo dia e avança no dia seguinte', () => {
  const quotes = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const today = getDailyQuote(quotes, new Date(2026, 7, 15, 1))
  assert.equal(today, getDailyQuote(quotes, new Date(2026, 7, 15, 23)))
  assert.notEqual(today, getDailyQuote(quotes, new Date(2026, 7, 16, 1)))
})

test('normaliza acentos, pontuação e espaços', () => {
  assert.equal(normalizeCharacterName('  Monkey D.  Luffy  '), 'monkey d luffy')
  assert.equal(normalizeCharacterName('Kyōjurō Rengoku'), 'kyojuro rengoku')
})

test('prioriza nome equivalente, WebP e compartilha requisições', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return { ok: true, json: async () => ({ data: [
      { name: 'Outro Naruto', images: { jpg: { image_url: 'errada.jpg' } } },
      { name: 'Uzumaki, Naruto Cache Test', images: { webp: { image_url: 'naruto.webp' } } },
    ] }) }
  }
  const name = 'Naruto Cache Test Uzumaki'
  const [first, second] = await Promise.all([getCharacterImage(name), getCharacterImage(name)])
  assert.equal(first, 'naruto.webp')
  assert.equal(second, 'naruto.webp')
  assert.equal(calls, 1)
})

test('usa JPG e retorna vazio quando não há personagem', async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => ({ data: url.includes('Inexistente')
    ? []
    : [{ name: 'Monkey D. Luffy Test', images: { jpg: { image_url: 'luffy.jpg' } } }] }) })
  assert.equal(await getCharacterImage('Monkey D. Luffy Test'), 'luffy.jpg')
  assert.equal(await getCharacterImage('Personagem Inexistente Teste'), '')
})

test('respeita AbortSignal', async () => {
  globalThis.fetch = () => new Promise((resolve) => setTimeout(() => resolve({
    ok: true,
    json: async () => ({ data: [] }),
  }), 20))
  const controller = new AbortController()
  const request = getCharacterImage('Personagem Abort Test', { signal: controller.signal })
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})
