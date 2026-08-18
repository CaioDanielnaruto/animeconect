export const dailyQuotes = [
  {
    quote: 'Se estiver se sentindo desmotivado ou sentindo que não é bom o suficiente, incendeie o seu coração. Enxugue as lágrimas e siga em frente. Quando se entristecer ou se acovardar, lembre-se de que o fluxo do tempo nunca para; ele não vai esperar enquanto você se afoga em tristeza. Eu não quero que fique angustiado com a minha partida. Não se esqueça de que eu sou um Hashira e que vou proteger vocês onde eu estiver. Os novos botões precisam desabrochar. Qualquer outro Hashira pensaria da mesma forma.',
    character: 'Kyojuro Rengoku',
    role: 'o Hashira das Chamas',
  },
]

export function getDailyQuote(quotes, date = new Date()) {
  if (!Array.isArray(quotes) || quotes.length === 0) return null
  const localDayNumber = Math.floor(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ) / 86400000)
  return quotes[localDayNumber % quotes.length]
}
