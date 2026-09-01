export const formatCompactNumber = (value, maximumFractionDigits = 3) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return ''
  }

  const roundedValue = Number(numericValue.toFixed(maximumFractionDigits))

  return String(Object.is(roundedValue, -0) ? 0 : roundedValue)
}
