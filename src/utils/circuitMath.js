const toFiniteNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

export const calculateReadings = ({ voltage, r1, r2, r3, rl }) => {
  const vs = Math.max(toFiniteNumber(voltage), 0)

  const R1 = Math.max(toFiniteNumber(r1), 0)
  const R2 = Math.max(toFiniteNumber(r2), 0)
  const R3 = Math.max(toFiniteNumber(r3), 0)
  const RL = Math.max(toFiniteNumber(rl), 0)

  const parallel =
    (R1 + R2) > 0
      ? (R1 * R2) / (R1 + R2)
      : 0

  const rth = R3 + parallel

  const vth =
    (R1 + R2) > 0
      ? vs * (R2 / (R1 + R2))
      : 0

  const il =
    (rth + RL) > 0
      ? vth / (rth + RL)
      : 0

  return {
    rth,
    vth,
    il,
  }
}