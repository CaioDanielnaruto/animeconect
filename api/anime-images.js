const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
async function getJikanData(path) {
  const upstream = await fetch(`${JIKAN_BASE_URL}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4500) })
  if (!upstream.ok) throw new Error(`Jikan respondeu com status ${upstream.status}`)
  const payload = await upstream.json()
  return Array.isArray(payload.data) ? payload.data : []
}
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' })
  const character = typeof request.query?.character === 'string' ? request.query.character.slice(0, 80) : 'Kyojuro Rengoku'
  const [animeResult, characterResult] = await Promise.allSettled([getJikanData('/top/anime?limit=8'), getJikanData(`/characters?q=${encodeURIComponent(character)}&limit=1`)])
  const anime = animeResult.status === 'fulfilled' ? animeResult.value : []
  const characters = characterResult.status === 'fulfilled' ? characterResult.value : []
  const themeImages = anime.map((item) => ({ title: item.title, url: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url })).filter((item) => item.url)
  response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
  return response.status(200).json({ characterImage: characters[0]?.images?.jpg?.image_url || '', themeImages })
}
