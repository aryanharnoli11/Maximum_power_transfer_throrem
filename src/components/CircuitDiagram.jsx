import { Fragment } from 'react'
import {
  getTerminalConnectedClass,
  getTerminalHighlightClass,
  getTerminalNumberHighlightClass,
} from '../utils/terminalHighlight.js'
import circuitImage from '../assets/circuit.png'
import { formatKilohms } from '../utils/resistance.js'
const terminalLabels = [
  {
    id: '9-endpoint',
    label: '9',
    polarity: 'plus',
  },
  {
    id: '10-endpoint',
    label: '10',
    polarity: 'minus',
  },
  {
    id: '11-endpoint',
    label: '11',
    polarity: 'plus',
  },
  {
    id: '12-endpoint',
    label: '12',
    polarity: 'plus',
  },
  {
    id: '13-endpoint',
    label: '13',
    polarity: 'minus',
  },
  {
    id: '14-endpoint',
    label: '14',
    polarity: 'minus',
  },
]

const CircuitDiagram = ({
  className = '',
  connectedTerminalIds = [],
  highlightedTerminalIds = [],
  r1,
  r2,
  r3,
  rl,
}) => (
  <section className={`circuit-panel ${className}`} id="circuit-panel">
    <div className="circuit-panel__stage">
      <img alt="Kirchhoff current law circuit diagram" className="circuit-panel__image" src={circuitImage} />

      {terminalLabels.map(({ id, label, polarity }) => (
        <Fragment key={id}>
          <span
            id={id}
className={`connection-terminal connection-terminal--circuit connection-terminal--endpoint-${label}${getTerminalConnectedClass(connectedTerminalIds, id)}${getTerminalHighlightClass(highlightedTerminalIds, id)}`}
            data-polarity={polarity}
            aria-label={`Circuit terminal ${label}`}
          />
          <span
className={`terminal-number-label terminal-number-label--circuit terminal-number-label--endpoint-${label}${getTerminalNumberHighlightClass(highlightedTerminalIds, id)}`}
            data-terminal-id={id}
          >
            {label}
          </span>
        </Fragment>
      ))}

     <span className="resistor-value left-[71.2px] top-[136px]">{formatKilohms(r1, 0)} k&Omega;</span>

<span className="resistor-value left-[225.6px] top-[176px]">{formatKilohms(r2, 0)} k&Omega;</span>

<span className="resistor-value left-[240px] top-[131.2px]">{formatKilohms(r3, 0)} k&Omega;</span>

<span className="resistor-value left-[312px] top-[176px]">
  {rl} &Omega;
</span>
    </div>
  </section>
)

export default CircuitDiagram
