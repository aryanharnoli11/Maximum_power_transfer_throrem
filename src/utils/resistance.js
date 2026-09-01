export const OHMS_PER_KILOHM = 1000

export const LOAD_RESISTANCE_VALUES = [
  0,
  100,
  200,
  300,
  400,
  450,
  550,
  700,
  850,
  1000,
]

export const RESISTANCE_SLIDER_CONFIG = {
  load: {
    initial: LOAD_RESISTANCE_VALUES[0],
    max: LOAD_RESISTANCE_VALUES.at(-1),
    min: LOAD_RESISTANCE_VALUES[0],
    step: null,
    values: LOAD_RESISTANCE_VALUES,
  },
  network: {
    initial: 1000,
    max: 5000,
    min: 1000,
    step: 1000,
  },
}

export const ohmsToKilohms = (value) => Number(value) / OHMS_PER_KILOHM

export const kilohmsToOhms = (value) => Number(value) * OHMS_PER_KILOHM

export const formatKilohms = (value, fractionDigits = 1) => (
  ohmsToKilohms(value).toFixed(fractionDigits)
)
