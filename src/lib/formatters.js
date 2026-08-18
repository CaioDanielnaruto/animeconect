export const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
export const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
export const numberFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function friendlyError(message) {
  const translations = {
    'Invalid login credentials': 'E-mail ou senha inválidos.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'duplicate key value violates unique constraint "profiles_username_key"': 'Este nome de usuário já está em uso.',
  }
  return translations[message] || message || 'Não foi possível concluir a operação.'
}
