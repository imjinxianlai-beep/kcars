export function loginEmail(value) {
  const name = value.trim().toLowerCase()
  // Existing owner accounts remain usable during the handover.
  if (name.includes('@')) return name
  if (!/^[a-z0-9_]{3,32}$/.test(name)) throw new Error('用户名须为 3–32 位英文字母、数字或下划线')
  return `${name}@users.kcars.invalid`
}
