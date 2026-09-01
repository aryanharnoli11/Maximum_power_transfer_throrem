import { useEffect, useState } from 'react';
import ElectricalText from './ElectricalText.jsx';
import { amperesToMilliamperes } from '../utils/current.js';
import { formatCompactNumber } from '../utils/numberFormat.js';
import {
  kilohmsToOhms,
  ohmsToKilohms,
} from '../utils/resistance.js';

const INPUT_RANGES = {
  vth: { min: 0, max: 100 },
  rth: { min: 0, max: 50 },
  rl: { min: 0, max: 5 },
};

const INPUT_TOLERANCES = {
  vth: 0.005,
  rth: 0.005,
  rl: 0.05,
};

const LOAD_CURRENT_TOLERANCE_MILLIAMPERES = 0.01;
const COMPARISON_EPSILON = 1e-9;

const isWithinRange = (value, range) => (
  Number.isFinite(value) && value >= range.min && value <= range.max
);

const approximatelyEquals = (value, expected, tolerance) => (
  Number.isFinite(expected)
  && Math.abs(value - expected) <= tolerance + COMPARISON_EPSILON
);

const clampInputToRange = (value, range) => {
  if (value === '') return '';

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return '';
  if (numericValue < range.min) return String(range.min);
  if (numericValue > range.max) return String(range.max);

  return value;
};

const preventInvalidNumberKey = (event) => {
  if (['-', '+', 'e', 'E'].includes(event.key)) {
    event.preventDefault();
  }
};

const preventMouseWheelAdjustment = (event) => {
  event.currentTarget.blur();
};

const CalculationPanel = ({
  calculationDone,
  calculatedValues,
  verificationResult,
  setUserCalculatedIL,
  setVerificationResult,
  onGuideEvent,
}) => {
  // Extracting basic parameters from calculatedValues
  const r1 = calculatedValues?.r1 ?? '';
  const r2 = calculatedValues?.r2 ?? '';
  const r3 = calculatedValues?.r3 ?? '';
  const voltageSource = calculatedValues?.voltageSource ?? '';

  // Extracting recorded load parameters
  const rl = calculatedValues?.rl ?? '';
  const observedIL = calculatedValues?.observedIL ?? '';

  const [theveninInputs, setTheveninInputs] = useState({
    rth: '',
    vth: '',
    rl: '',
  });
  const [incorrectInputs, setIncorrectInputs] = useState({
    rth: false,
    vth: false,
    rl: false,
  });
  const [calculatedCurrentIncorrect, setCalculatedCurrentIncorrect] = useState(false);

  const missingInputKeys = Object.entries(theveninInputs)
    .filter(([, value]) => value.trim() === '')
    .map(([parameter]) => parameter);
  const hasTheveninInputs = missingInputKeys.length === 0;
  const enteredRthKilohms = Number(theveninInputs.rth);
  const enteredVth = Number(theveninInputs.vth);
  const loadResistanceKilohms = Number(theveninInputs.rl);
  const enteredRth = kilohmsToOhms(enteredRthKilohms);
  const loadResistance = kilohmsToOhms(loadResistanceKilohms);
  const loadCurrentDenominator = enteredRth + loadResistance;
  const inputsAreValid =
    hasTheveninInputs &&
    isWithinRange(enteredVth, INPUT_RANGES.vth) &&
    isWithinRange(enteredRthKilohms, INPUT_RANGES.rth) &&
    isWithinRange(loadResistanceKilohms, INPUT_RANGES.rl) &&
    loadCurrentDenominator > 0;
 const calculatedLoadCurrent = inputsAreValid
  ? enteredVth / loadCurrentDenominator
  : null;

const calculatedLoadCurrentDisplay =
  calculatedLoadCurrent === null
    ? ''
    : formatCompactNumber(amperesToMilliamperes(calculatedLoadCurrent), 3);

  useEffect(() => {
    setUserCalculatedIL(calculatedLoadCurrentDisplay);
  }, [calculatedLoadCurrentDisplay, setUserCalculatedIL]);

  const handleTheveninInputChange = (parameter, value) => {
    const nextValue = clampInputToRange(value, INPUT_RANGES[parameter]);

    setTheveninInputs((current) => ({
      ...current,
      [parameter]: nextValue,
    }));
    setIncorrectInputs((current) => ({
      ...current,
      [parameter]: false,
    }));
    setCalculatedCurrentIncorrect(false);
    setVerificationResult('');
  };

  const handleTheveninInputBlur = (parameter) => {
    setTheveninInputs((current) => {
      const currentValue = current[parameter];

      if (currentValue.trim() === '') return current;

      const numericValue = Number(currentValue);

      if (!Number.isFinite(numericValue)) return current;

      return {
        ...current,
        [parameter]: String(numericValue),
      };
    });
  };

  const handleVerify = () => {
    if (!calculationDone) return;

    if (missingInputKeys.length > 0) {
      const onlyOneValueIsMissing = missingInputKeys.length === 1;

      onGuideEvent?.({
        alertType: 'warning',
        title: 'Input Required',
        description: onlyOneValueIsMissing
          ? 'Please enter the required value, then click the “Verify” button to verify the theorem.'
          : 'Please enter all the values, then click the “Verify” button to verify the theorem.',
        missingCount: missingInputKeys.length,
        target: '#calculation-panel',
        type: 'CALCULATION_INPUT_REQUIRED',
      });
      return;
    }

    const expectedVth = Number(calculatedValues?.vth);
    const expectedRthKilohms = ohmsToKilohms(calculatedValues?.rth);
    const expectedLoadResistanceKilohms = ohmsToKilohms(calculatedValues?.rl);
    const nextIncorrectInputs = {
      vth:
        !isWithinRange(enteredVth, INPUT_RANGES.vth)
        || !approximatelyEquals(enteredVth, expectedVth, INPUT_TOLERANCES.vth),
      rth:
        !isWithinRange(enteredRthKilohms, INPUT_RANGES.rth)
        || !approximatelyEquals(
          enteredRthKilohms,
          expectedRthKilohms,
          INPUT_TOLERANCES.rth,
        ),
      rl:
        !isWithinRange(loadResistanceKilohms, INPUT_RANGES.rl)
        || !approximatelyEquals(
          loadResistanceKilohms,
          expectedLoadResistanceKilohms,
          INPUT_TOLERANCES.rl,
        ),
    };

    const actual = Number(observedIL);
    const loadCurrentDifferenceMilliamperes = inputsAreValid && Number.isFinite(actual)
      ? Math.abs(amperesToMilliamperes(calculatedLoadCurrent - actual))
      : Number.POSITIVE_INFINITY;
    const nextCalculatedCurrentIncorrect =
      loadCurrentDifferenceMilliamperes > LOAD_CURRENT_TOLERANCE_MILLIAMPERES;
    const hasIncorrectInput = Object.values(nextIncorrectInputs).some(Boolean);
    const isCorrect =
      !hasIncorrectInput &&
      !nextCalculatedCurrentIncorrect;

    setIncorrectInputs(nextIncorrectInputs);
    setCalculatedCurrentIncorrect(nextCalculatedCurrentIncorrect);

    if (isCorrect) {
      onGuideEvent?.({
        isCorrect: true,
        type: 'VERIFICATION_RESULT',
      })
      setVerificationResult('✅ Verified Successfully');

    } else {
      onGuideEvent?.({
        isCorrect: false,
        type: 'VERIFICATION_RESULT',
      })
      setVerificationResult('❌ Incorrect Calculation');
    }
  };

  return (
    <section id="calculation-panel" className="graph-panel graph-panel--separate">
      <div className="graph-panel__heading">
        <div>
          <h2>THEORETICAL CALCULATIONS</h2>
        </div>
      </div>

      <div className="graph-panel__body">

        {/* TOP ROW: Resistance & Source Values */}
        <div className="calc-top-row">
          
          {/* Resistance Values Card */}
          <div className="values-card">
            <h3>Resistance Values</h3>
            <div className="values-inline-group">
              <div className="inline-input-item">
                <span className="inline-label">R<sub>1</sub>:</span>
                <div className="inline-display">
                  {calculationDone && r1 !== ''
                    ? formatCompactNumber(ohmsToKilohms(r1), 0)
                    : ''}
                </div>
                <span className="inline-unit">kΩ</span>
              </div>
              
              <div className="inline-input-item">
                <span className="inline-label">R<sub>2</sub>:</span>
                <div className="inline-display">
                  {calculationDone && r2 !== ''
                    ? formatCompactNumber(ohmsToKilohms(r2), 0)
                    : ''}
                </div>
                <span className="inline-unit">kΩ</span>
              </div>
              
              <div className="inline-input-item">
                <span className="inline-label">R<sub>3</sub>:</span>
                <div className="inline-display">
                  {calculationDone && r3 !== ''
                    ? formatCompactNumber(ohmsToKilohms(r3), 0)
                    : ''}
                </div>
                <span className="inline-unit">kΩ</span>
              </div>

              <div className="inline-input-item">
                <span className="inline-label">R<sub>L</sub>:</span>
                <div className="inline-display">
                  {calculationDone && rl !== ''
                    ? formatCompactNumber(ohmsToKilohms(rl), 1)
                    : ''}
                </div>
                <span className="inline-unit">kΩ</span>
              </div>
            </div>
          </div>

          {/* Source Values Card */}
          <div className="values-card">
            <h3>Source Values</h3>
            <div className="values-inline-group">

              <div className="inline-input-item">
                <span className="inline-label long-label">Voltage Source:</span>
                <div className="inline-display">
                  {calculationDone && voltageSource !== '' ? Number(voltageSource) : ''}
                </div>
                <span className="inline-unit">V</span>
              </div>
            </div>
          </div>

        </div>

        {/* Observed and calculated current share one continuous calculation area. */}
        <div className="load-current-calculation">
          <div className="observed-current-row">
            <span className="load-current-heading">
              Observed Load Current (<ElectricalText text="IL" />) =
            </span>
            <output
              aria-label="Observed load current in milliamperes"
              className="observed-current-value"
            >
              {calculationDone && observedIL !== ''
                ? formatCompactNumber(amperesToMilliamperes(observedIL), 3)
                : ''}
              {calculationDone && observedIL !== '' ? ' mA' : ''}
            </output>
          </div>

          <div className="calculated-current-section">
            <h3 className="load-current-heading">
              Calculated Load Current (<ElectricalText text="IL" />):
            </h3>

            <div
              className="load-current-equation"
              aria-label="Load current equals Thevenin voltage divided by the sum of Thevenin resistance and load resistance"
            >
              <span className="equation-lead">
                <ElectricalText text="IL" /> =
              </span>

              <div className="equation-fraction">
                <label className="equation-term equation-numerator">
                  <ElectricalText text="Vth" />
                  <input
                    aria-label="Enter Thevenin equivalent voltage"
                    aria-invalid={incorrectInputs.vth}
                    className={`formula-input${incorrectInputs.vth ? ' formula-input--error' : ''}`}
                    disabled={!calculationDone}
                    max={INPUT_RANGES.vth.max}
                    min={INPUT_RANGES.vth.min}
                    onBlur={() => handleTheveninInputBlur('vth')}
                    onChange={(event) => handleTheveninInputChange('vth', event.target.value)}
                    onKeyDown={preventInvalidNumberKey}
                    onWheel={preventMouseWheelAdjustment}
                    placeholder="0 - 100"
                    step="0.01"
                    title="Enter a value from 0 to 100 V"
                    type="number"
                    value={theveninInputs.vth}
                  />
                  <span className="equation-input-unit">V</span>
                </label> 
                <div className="equation-denominator">
                  <label className="equation-term">
                    <ElectricalText text="Rth" />
                    <input
                      aria-label="Enter Thevenin equivalent resistance in kilo-ohms"
                      aria-invalid={incorrectInputs.rth}
                      className={`formula-input${incorrectInputs.rth ? ' formula-input--error' : ''}`}
                      disabled={!calculationDone}
                      max={INPUT_RANGES.rth.max}
                      min={INPUT_RANGES.rth.min}
                      onBlur={() => handleTheveninInputBlur('rth')}
                      onChange={(event) => handleTheveninInputChange('rth', event.target.value)}
                      onKeyDown={preventInvalidNumberKey}
                      onWheel={preventMouseWheelAdjustment}
                      placeholder="0 - 50"
                      step="0.01"
                      title="Enter a value from 0 to 50 kΩ"
                      type="number"
                      value={theveninInputs.rth}
                    />
                    <span className="equation-input-unit">kΩ</span>
                  </label>
                  <span aria-hidden="true" className="equation-operator">+</span>
                  <label className="equation-term">
                    <ElectricalText text="RL" />
                    <input
                      aria-label="Enter load resistance in kilo-ohms"
                      aria-invalid={incorrectInputs.rl}
                      className={`formula-input${incorrectInputs.rl ? ' formula-input--error' : ''}`}
                      disabled={!calculationDone}
                      max={INPUT_RANGES.rl.max}
                      min={INPUT_RANGES.rl.min}
                      onBlur={() => handleTheveninInputBlur('rl')}
                      onChange={(event) => handleTheveninInputChange('rl', event.target.value)}
                      onKeyDown={preventInvalidNumberKey}
                      onWheel={preventMouseWheelAdjustment}
                      placeholder="0 - 5"
                      step="0.01"
                      title="Enter a value from 0 to 5 kΩ"
                      type="number"
                      value={theveninInputs.rl}
                    />
                    <span className="equation-input-unit">kΩ</span>
                  </label>
                </div>
              </div>

              <div className="equation-result">
                <span className="equation-equals" aria-hidden="true">=</span>
                <input
                  aria-label="Calculated load current"
                  aria-invalid={calculatedCurrentIncorrect}
                  aria-readonly="true"
                  className={`formula-input formula-result-input${calculatedCurrentIncorrect ? ' formula-input--error' : ''}`}
                  disabled={!calculationDone}
                  placeholder="Answer"
                  readOnly
                  step="0.000001"
                  type="number"
                  value={calculatedLoadCurrentDisplay}
                />
                <span className="equation-unit">mA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Segment */}
        <div className="verification-section">
          <button
            type="button"
            onClick={handleVerify}
            disabled={!calculationDone}
            className="verify-btn"
          >
            Verify
          </button>

          {verificationResult && (
            <div
              className={`verification-message ${
                verificationResult.includes('Verified') ? 'success' : 'error'
              }`}
            >
              {verificationResult}
            </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default CalculationPanel;
