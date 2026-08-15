const imageCache = new Map()
const pendingRequests = new Map()

export function normalizeCharacterName(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function getNames(character) {
  return [character?.name, ...(character?.nicknames || [])].filter(Boolean).map(normalizeCharacterName)
}

function hasSameNameTokens(left, right) {
  const leftTokens = left.split(' ').sort()
  const rightTokens = right.split(' ').sort()
  return leftTokens.length === rightTokens.length
    && leftTokens.every((token, index) => token === rightTokens[index])
}

function selectBestCharacter(characters, characterName) {
  const wantedName = normalizeCharacterName(characterName)
  const withImages = characters.filter((character) => character?.images?.webp?.image_url || character?.images?.jpg?.image_url)
  return withImages.find((character) => getNames(character).includes(wantedName))
    || withImages.find((character) => getNames(character).some((name) => hasSameNameTokens(name, wantedName)))
    || withImages.find((character) => getNames(character).some((name) => name.includes(wantedName) || wantedName.includes(name)))
    || withImages[0]
    || null
}

function waitForRequest(request, signal) {
  if (!signal) return request
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    request.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export function getCharacterImage(characterName, options = {}) {
  const cacheKey = normalizeCharacterName(characterName)
  if (!cacheKey) return Promise.resolve('')
  if (imageCache.has(cacheKey)) return Promise.resolve(imageCache.get(cacheKey))
  let request = pendingRequests.get(cacheKey)
  if (!request) {
    request = fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(characterName)}&limit=5`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Jikan respondeu com status ${response.status}`)))
      .then(({ data }) => {
        const character = selectBestCharacter(Array.isArray(data) ? data : [], characterName)
        const image = character?.images?.webp?.image_url || character?.images?.jpg?.image_url || ''
        imageCache.set(cacheKey, image)
        return image
      })
      .catch(() => {
        imageCache.set(cacheKey, '')
        return ''
      })
      .finally(() => pendingRequests.delete(cacheKey))
    pendingRequests.set(cacheKey, request)
  }
  return waitForRequest(request, options.signal)
}
