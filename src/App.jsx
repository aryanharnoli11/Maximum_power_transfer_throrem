import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import ConnectionLab from './components/ConnectionLab.jsx'
import ActionButtons from './components/ActionButtons.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useAiGuideController } from './aiGuide/useAiGuideController.js'
import CalculationPanel from './components/CalculationPanel.jsx'
import { useWalkthrough } from './walkthrough/useWalkthrough.js'
import { calculateReadings } from './utils/circuitMath.js'
import { generateTheveninReport } from './utils/theveninReportGenerator.js'
import {
  FIXED_NETWORK_RESISTANCES,
  RESISTANCE_SLIDER_CONFIG,
} from './utils/resistance.js'

const BASE_WIDTH = 1152
const DEFAULT_CONTENT_HEIGHT = 1440
const PANEL_VIEWPORT_GUTTER = 0
const MIN_OBSERVATION_READINGS = 1
const MAX_OBSERVATIONS = 10

const getObservationSignature = ({ vth, rth, il }) => (
  [
    Number(vth).toFixed(3),
    Number(rth).toFixed(3),
    Number(il).toFixed(3),
  ].join('|')
)

const getAvailableWidth = () => {
  if (typeof window === 'undefined') {
    return BASE_WIDTH
  }

  return (
    document.body?.clientWidth
    || document.documentElement.clientWidth
    || window.innerWidth
  ) - (PANEL_VIEWPORT_GUTTER * 2)
}

const getScale = () => Math.min(
  Math.max(getAvailableWidth() / BASE_WIDTH, 0.1),
  1,
)

const App = () => {
  const {
    clearAlerts,
    confirmAlert,
    dismissAlert,
    showStepAlert,
  } = useLabAlerts()
  const { completionCount } = useWalkthrough()
  const [scale, setScale] = useState(getScale)
  const [contentHeight, setContentHeight] = useState(DEFAULT_CONTENT_HEIGHT)
  const postSimulationContentRef = useRef(null)
  const walkthroughCompletionRef = useRef(0)
  const viewportMetricsRef = useRef({
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    outerWidth: typeof window === 'undefined' ? BASE_WIDTH : window.outerWidth,
  })
  const { r1, r2, r3 } = FIXED_NETWORK_RESISTANCES
  const [rl, setRl] = useState(RESISTANCE_SLIDER_CONFIG.load.initial)
  const [resistanceSelections, setResistanceSelections] = useState({
    rl: false,
  })
  const [voltage, setVoltage] = useState(1)
  const [powerOn, setPowerOn] = useState(false)
  const [voltageLocked, setVoltageLocked] = useState(false)
  const [observations, setObservations] = useState([])
  const [calculationDone, setCalculationDone] = useState(false)
  const [calculatedValues, setCalculatedValues] = useState(null)
  const [userCalculatedIL, setUserCalculatedIL] = useState('')
  const [verificationResult, setVerificationResult] = useState('')
  const [experimentCase, setExperimentCase] = useState(1)
  const [measuredRth, setMeasuredRth] = useState(null)
  const [measuredVth, setMeasuredVth] = useState(null)
  const [measuredIl, setMeasuredIl] = useState(null)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [reportPrinted, setReportPrinted] = useState(false)
  const [status, setStatus] = useState(
    'Make the connections, click CHECK, then set the resistance values.',
  )
  const [checkRequest, setCheckRequest] = useState(0)
  const [resetRequest, setResetRequest] = useState(0)
  const [autoConnectRequest, setAutoConnectRequest] = useState(0)
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [sessionStart, setSessionStart] = useState(() => Date.now())
  const [showRth, setShowRth] = useState(false)
  const [case1ConnectionsRemoved, setCase1ConnectionsRemoved] = useState(false)
  const [case2ConnectionsRemoved, setCase2ConnectionsRemoved] = useState(false)
  const [showMultimeter, setShowMultimeter] = useState(false)
  const handleGuideAudioError = useCallback(() => {
    setStatus('AI Guide could not play its configured audio file.')
  }, [])

  const {
    activeInstructionId,
    notify: notifyGuide,
    replayCurrentInstruction,
    state: guideState,
  } = useAiGuideController({
    clearAlerts,
    confirmAlert,
    dismissAlert,
    onAudioError: handleGuideAudioError,
    showStepAlert,
  })

  const resistancesConfigured = Object.values(resistanceSelections).every(Boolean)

  const handleResistanceChange = (value) => {
    setRl(value)
    setResistanceSelections((current) => ({
      ...current,
      rl: true,
    }))
  }

  useEffect(() => {
    let resizeTimer = 0

    const handleResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        const previousMetrics = viewportMetricsRef.current
        const nextMetrics = {
          devicePixelRatio: window.devicePixelRatio,
          outerWidth: window.outerWidth,
        }
        const pixelRatioChanged = (
          Math.abs(
            nextMetrics.devicePixelRatio - previousMetrics.devicePixelRatio,
          ) > 0.001
        )
        const outerWidthChanged = (
          nextMetrics.outerWidth !== previousMetrics.outerWidth
        )

        viewportMetricsRef.current = nextMetrics

        // Page zoom changes the device pixel ratio without resizing the
        // browser window. Keep the app scale stable so native zoom is visible.
        if (!pixelRatioChanged || outerWidthChanged) {
          setScale(getScale())
        }
      }, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const content = postSimulationContentRef.current

    if (!content) {
      return undefined
    }

    const updateContentHeight = () => {
      const nextHeight = Math.ceil(content.offsetTop + content.offsetHeight)

      setContentHeight((currentHeight) => (
        currentHeight === nextHeight ? currentHeight : nextHeight
      ))
    }

    updateContentHeight()

    const resizeObserver = new ResizeObserver(updateContentHeight)
    resizeObserver.observe(content)
    window.addEventListener('load', updateContentHeight)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('load', updateContentHeight)
    }
  }, [])

  useEffect(() => {
    const handleAfterPrint = () => setReportPrinted(true)

    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  useEffect(() => {
    if (
      completionCount === 0
      || completionCount === walkthroughCompletionRef.current
    ) {
      return
    }

    walkthroughCompletionRef.current = completionCount

    if (!guideState.guideStarted) {
      return
    }

    void notifyGuide({ type: 'WALKTHROUGH_COMPLETED' })
  }, [completionCount, guideState.guideStarted, notifyGuide])

  useEffect(() => {
    void notifyGuide({
      configured: resistancesConfigured,
      selections: resistanceSelections,
      type: 'RESISTANCE_CONFIGURATION',
    })
  }, [notifyGuide, resistanceSelections, resistancesConfigured])

  const readings = useMemo(
    () => calculateReadings({
      voltage: powerOn ? voltage : 0,
      r1,
      r2,
      r3,
      rl,
    }),
    [powerOn, r1, r2, r3, rl, voltage],
  )
  const normalizedVoltage = Number(voltage.toFixed(1))
  const currentReadingSignature = getObservationSignature({
    vth: readings.vth,
    rth: readings.rth,
    il: readings.il,
  })
  const hasDuplicateReading = observations.some((row) => (
    row.voltage === normalizedVoltage
    || getObservationSignature(row) === currentReadingSignature
  ))
  const readingCount = observations.length

  const handleAiGuide = useCallback(() => {
    if (guideState.guideStarted) {
      setStatus('AI Guide is replaying the current instruction.')
      if (guideState.startupCompleted) {
        void replayCurrentInstruction()
      } else {
        void notifyGuide({ type: 'START_GUIDE' })
      }
      return
    }

    setStatus('AI Guide narration started.')
    void notifyGuide({ type: 'START_GUIDE' })
  }, [
    guideState.guideStarted,
    guideState.startupCompleted,
    notifyGuide,
    replayCurrentInstruction,
  ])

  const handleAutoConnect = () => {
    if (experimentCase >= 4) {
      return
    }

    if (!resistancesConfigured) {
      void notifyGuide({ type: 'RESISTANCE_REQUIRED' })
      return
    }

    if (
      (experimentCase === 2 && !case1ConnectionsRemoved)
      || (experimentCase === 3 && !case2ConnectionsRemoved)
    ) {
      void notifyGuide({
        caseNumber: experimentCase,
        type: 'AUTO_CONNECT_BLOCKED_EXISTING',
      })
      return
    }

    setAutoConnectRequest((current) => current + 1)
  }

  const recordObservation = () => {
    if (!connectionsVerified) {
      setStatus('Check the circuit connections before adding readings.')
      void notifyGuide({
        description: 'Verify the wiring before storing current readings.',
        target: '#check-button',
        title: 'Check Connections First',
        type: 'ADD_REJECTED',
      })
      return
    }

    if (experimentCase !== 1 && !powerOn) {
      setStatus('Switch on the power supply before adding readings.')
      void notifyGuide({
        description: 'Switch on the verified power supply before adding readings.',
        target: '#power-toggle-button',
        title: 'Switch On the Power Supply',
        type: 'ADD_REJECTED',
      })
      return
    }

    if (experimentCase !== 1 && normalizedVoltage <= 0) {
      setStatus('Set the power supply voltage before adding a reading.')
      void notifyGuide({
        description: 'Increase the voltage above 0 V before adding a reading.',
        target: '#voltage-control',
        title: 'Set the Supply Voltage',
        type: 'ADD_REJECTED',
      })
      return
    }

    if (readingCount >= MAX_OBSERVATIONS) {
      setStatus('Observation table is full. Reset the experiment for a new run.')
      void notifyGuide({
        description: 'The observation table already contains the maximum number of readings.',
        target: '#observation-table-panel',
        title: 'Observation Table Is Full',
        type: 'ADD_REJECTED',
      })
      return
    }

    if (hasDuplicateReading) {
      setStatus('Duplicate reading cannot be added to the observation table.')
      void notifyGuide({
        description: 'This reading already exists in the observation table. Change the voltage before adding another reading.',
        target: '#voltage-control',
        title: 'Duplicate Reading Not Allowed',
        type: 'ADD_REJECTED',
      })
      return
    }

    const completedCase = experimentCase

    if (completedCase === 1) {
      setObservations([
        {
          id: 1,
          rth: readings.rth,
          vth: null,
          il: null,
          rl,
        },
      ])
      setMeasuredRth(readings.rth)
      setConnectionsVerified(false)
      setExperimentCase(2)
      setCase1ConnectionsRemoved(false)
    } else if (completedCase === 2) {
      setObservations([
        {
          ...observations[0],
          vth: readings.vth,
        },
      ])
      setMeasuredVth(readings.vth)
      setVoltageLocked(true)
      setConnectionsVerified(false)
      setExperimentCase(3)
      setCase2ConnectionsRemoved(false)
    } else if (completedCase === 3) {
      setObservations([
        {
          ...observations[0],
          il: readings.il,
        },
      ])
      setMeasuredIl(readings.il)
      setConnectionsVerified(false)
      setExperimentCase(4)
    }

    void notifyGuide({
      caseNumber: completedCase,
      type: 'READING_ADDED',
    })
    setReportGenerated(false)
    setReportPrinted(false)
    setStatus(
      completedCase === 2
        ? 'Case 2 reading added. Turn OFF the power supply manually, then remove the voltmeter connections.'
        : 'Reading added to the observation table.',
    )
  }

  const resetSimulation = useCallback(() => {
    setPowerOn(false)
    setVoltage(1)
    setVoltageLocked(false)
    setRl(RESISTANCE_SLIDER_CONFIG.load.initial)
    setResistanceSelections({
      rl: false,
    })
    setObservations([])
    setCalculationDone(false)
    setCalculatedValues(null)
    setVerificationResult('')
    setUserCalculatedIL('')
    setReportGenerated(false)
    setReportPrinted(false)
    setCheckRequest(0)
    setAutoConnectRequest(0)
    setExperimentCase(1)
    setConnectionsVerified(false)
    setMeasuredRth(null)
    setMeasuredVth(null)
    setMeasuredIl(null)
    setCase1ConnectionsRemoved(false)
    setCase2ConnectionsRemoved(false)
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now())
    setStatus('Simulation reset. Make the circuit connections again.')
    setShowRth(false)
    setShowMultimeter(false)
    walkthroughCompletionRef.current = completionCount
    void notifyGuide({ type: 'RESET' })
  }, [completionCount, notifyGuide])

  const handlePrint = async () => {
    await notifyGuide({ type: 'PRINT' })
    window.print()
  }

  const handleGenerateReport = async () => {
    if (!calculationDone) {
      void notifyGuide({
        description: 'Please click CALCULATE before generating report.',
        target: '#calculate-button',
        title: 'Calculate First',
        type: 'REPORT_BLOCKED',
      })
      return
    }

    if (readingCount < MIN_OBSERVATION_READINGS) {
      void notifyGuide({
        description: 'Please add at least one observation.',
        target: '#observation-table-panel',
        title: 'Observation Required',
        type: 'REPORT_BLOCKED',
      })
      return
    }

    setStatus('Report is ready. Click OK to open it in a new tab.')
    const shouldOpenReport = await notifyGuide({ type: 'REPORT_REQUEST' })

    if (!shouldOpenReport) {
      setStatus('Report opening cancelled.')
      return
    }

    const reportOpened = generateTheveninReport({
      observations,
      r1,
      r2,
      r3,
      rl,
      vth: calculatedValues?.vth ?? 0,
      rth: calculatedValues?.rth ?? 0,
      calculatedIL: Number(userCalculatedIL),
      sessionStart,
    })

    if (!reportOpened) {
      setStatus('The report window was blocked. Allow popups and try again.')
      return
    }

    setReportGenerated(true)
    void notifyGuide({ type: 'REPORT_GENERATED' })
    setStatus('Report generated and opened in a new tab.')
  }

  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(contentHeight * scale)

  const handleCheckConnections = useCallback((result) => {
    void notifyGuide({
      caseNumber: experimentCase,
      result,
      type: 'CHECK_RESULT',
    })

    if (result.isCorrect) {
      if (experimentCase === 1) {
        setShowRth(true)
        setShowMultimeter(true)
      }

      setConnectionsVerified(true)

      if (experimentCase === 1) {
        setStatus('Right connections! Click ADD to measure RTH.')
      } else if (experimentCase === 2) {
        setStatus(
          'Right connections! Turn ON power supply and click ADD to measure VTH.',
        )
      } else if (experimentCase === 3) {
        setStatus(
          'Right connections! Turn ON power supply and click ADD to measure IL.',
        )
      }

      return
    }

    setConnectionsVerified(false)

    if (result.totalConnections === 0) {
      setStatus('Please make the connections first.')
      return
    }

    setStatus('Invalid connections. Please check the wiring and try again.')
  }, [experimentCase, notifyGuide])

  const handleCheck = () => {
    if (experimentCase >= 4) {
      return
    }

    if (!resistancesConfigured) {
      void notifyGuide({ type: 'RESISTANCE_REQUIRED' })
      return
    }

    setCheckRequest((current) => current + 1)
  }

  const handleTogglePower = () => {
    if (experimentCase === 1) {
      return
    }

    if (!powerOn && !connectionsVerified) {
      void notifyGuide({
        description: 'Complete all required connections before switching ON the power supply.',
        target: '#check-button',
        title: 'Complete Connections First',
        type: 'POWER_REJECTED',
      })
      setStatus(
        'Complete all required connections before switching ON the power supply.',
      )
      return
    }

    if (powerOn) {
      setPowerOn(false)
      setStatus('Power supply switched off.')
      return
    }

    setPowerOn(true)
    setStatus(
      experimentCase === 3
        ? `Power supply switched on at the previous setting of ${voltage} V. Add the reading.`
        : 'Power supply switched on. Adjust voltage and add the reading.',
    )
    void notifyGuide({
      caseNumber: experimentCase,
      type: 'POWER_ON',
    })
  }

  const handleVoltageChange = useCallback((nextVoltage) => {
    if (voltageLocked) {
      return
    }

    setVoltage(nextVoltage)
  }, [voltageLocked])

  const handleVoltageSet = useCallback((nextVoltage) => {
    if (powerOn && experimentCase === 2) {
      void notifyGuide({
        type: 'VOLTAGE_SET',
        voltage: nextVoltage,
      })
    }
  }, [experimentCase, notifyGuide, powerOn])

  const handleCalculate = () => {
    setCalculatedValues({
      r1,
      r2,
      r3,
      rl: observations[0]?.rl ?? rl,
      voltageSource: voltage,
      vth: observations[0]?.vth ?? measuredVth,
      rth: observations[0]?.rth ?? measuredRth,
      observedIL: observations[0]?.il ?? measuredIl,
    })
    setCalculationDone(true)
    void notifyGuide({ type: 'CALCULATE' })
  }

  const guideHighlights = {
    5: ['5-endpoint', '11-endpoint'],
    6: ['6-endpoint', '13-endpoint'],
    7: ['9-endpoint', '10-endpoint'],
    17: ['7-endpoint', '9-endpoint'],
    18: ['8-endpoint', '10-endpoint'],
    19: ['1-endpoint', '11-endpoint'],
    20: ['2-endpoint', '13-endpoint'],
    26: ['3-endpoint', '11-endpoint'],
    27: ['4-endpoint', '12-endpoint'],
    28: ['13-endpoint', '14-endpoint'],
  }
  const highlightedTerminalIds = (
    guideHighlights[Number(activeInstructionId)] ?? []
  )
  const verificationSucceeded = verificationResult.includes(
    'Verified Successfully',
  )
  const activeInstructionStep = (
    !resistancesConfigured
      ? 'step1'
      : experimentCase === 1
        || (experimentCase === 2 && !case1ConnectionsRemoved)
        ? 'case1'
        : experimentCase === 2
          || (experimentCase === 3 && !case2ConnectionsRemoved)
          ? 'case2'
          : experimentCase === 3
            ? 'case3'
            : !calculationDone
              ? 'step3'
              : !verificationSucceeded
                ? 'step4'
                : !reportPrinted
                  ? 'step5'
                  : 'step6'
  )

  return (
    <div id="app-wrapper">
      <div
        id="app-viewport"
        style={{
          height: `${scaledHeight}px`,
          width: `${scaledWidth}px`,
        }}
      >
        <div
          id="app-scale"
          style={{
            height: `${contentHeight}px`,
            zoom: scale,
          }}
        >
          <main className="simulation-shell" id="walkthrough-demo-experiment">
            <HeaderBoard />
            <WalkthroughStartButton
              highlighted={
                guideState.startupCompleted
                && !guideState.walkthroughCompleted
              }
              variant="side-tab"
            />
            <span className="sr-only" role="status" aria-live="polite">
              {status}
            </span>

            <section className="workspace-grid">
              <aside className="left-panel">
                <ActionButtons
                  activeInstructionStep={activeInstructionStep}
                  activeButtons={{
                    onAiGuide: guideState.guideStarted,
                  }}
                  disabledButtons={{
                    onAdd: !connectionsVerified,
                    onCalculate: experimentCase !== 4,
                    onCheck: false,
                    onPrint: false,
                  }}
                  onAdd={recordObservation}
                  onAiGuide={handleAiGuide}
                  onAutoConnect={handleAutoConnect}
                  onCalculate={handleCalculate}
                  onCheck={handleCheck}
                  onPrint={handlePrint}
                  onReset={resetSimulation}
                />

                <ControlPanel
                  locked={powerOn}
                  minReadings={MIN_OBSERVATION_READINGS}
                  observations={observations}
                  onGenerateReport={handleGenerateReport}
                  readingCount={readingCount}
                  reportGenerated={reportGenerated}
                  rl={rl}
                  setRl={handleResistanceChange}
                />
              </aside>

              <section className="right-panel">
                <ConnectionLab
                  autoConnectRequest={autoConnectRequest}
                  case1ConnectionsRemoved={case1ConnectionsRemoved}
                  case2ConnectionsRemoved={case2ConnectionsRemoved}
                  checkRequest={checkRequest}
                  experimentCase={experimentCase}
                  highlightedTerminalIds={highlightedTerminalIds}
                  key={`connection-lab-${resetRequest}`}
                  onCheckConnections={handleCheckConnections}
                  onGuideEvent={notifyGuide}
                  onTogglePower={handleTogglePower}
                  observationIl={observations[0]?.il ?? null}
                  observationVth={observations[0]?.vth ?? null}
                  powerOn={powerOn}
                  r1={r1}
                  r2={r2}
                  r3={r3}
                  readings={readings}
                  resetRequest={resetRequest}
                  resistancesConfigured={resistancesConfigured}
                  rl={rl}
                  scale={scale}
                  setCase1ConnectionsRemoved={setCase1ConnectionsRemoved}
                  setCase2ConnectionsRemoved={setCase2ConnectionsRemoved}
                  setShowMultimeter={setShowMultimeter}
                  setShowRth={setShowRth}
                  setVoltage={handleVoltageChange}
                  showMultimeter={showMultimeter}
                  showRth={showRth}
                  onVoltageSet={handleVoltageSet}
                  voltage={voltage}
                  voltageLocked={voltageLocked}
                />
              </section>
            </section>
          </main>

          <div className="post-simulation-content" ref={postSimulationContentRef}>
            <CalculationPanel
              calculatedValues={calculatedValues}
              calculationDone={calculationDone}
              key={calculationDone ? 'calculation-ready' : 'calculation-reset'}
              onGuideEvent={notifyGuide}
              setUserCalculatedIL={setUserCalculatedIL}
              setVerificationResult={setVerificationResult}
              verificationResult={verificationResult}
            />
            <footer className="site-footer">
              © 2026 Virtual Labs, IIT Roorkee
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
