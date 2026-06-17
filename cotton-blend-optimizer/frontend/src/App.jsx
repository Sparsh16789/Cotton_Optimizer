import { useState } from "react";

// help text taken from the spec sheet ("Corrections" tab)
const HELP = {
  total_mixing: "Enter the total mixing requirement in Kg that you want as output of Blow room",
  num_cottons: "Enter the number of cottons that you would like to try for the mixing. Remember that the tolerances of the parameters are to be taken care of.",
  count: "The count (Ne) that you would like to spun from this mixing.",
  uster: "The Uster level of yarn you are targetting.",
  test_mode: "Cotton testing mode to be entered",
  cotton_name: "Cotton name for your reference",
  cost_per_bale: "Enter the cotton cost per bale.",
  bale_weight: "Weight of the bale in Kg.",
  trash: "Trash % in this particular cotton variety",
  lint_loss: "Lint loss in Blow room while cleaning that is expected. This is used to estimate the clean cotton rate",
  comber_noil: "Comber noil % removed during the blow room process (applies to the whole mixing, optional)",
  min_bales: "Minimum bales of a particular cotton variety that MUST be used in the mixing",
  max_bales: "Maximum bales of a particular cotton variety that can be used in the mixing",
  span25: "Upper half mean length or 2.5% span length as is asked",
  span50: "Mean length or 50% mean length as is asked",
  micronaire: "Micronaire of particular cotton variety. Please ensure that you are using cottons with a micronaire range of plus minus 0.2",
  strength: "Strength of particular cotton variety.",
  reflectance: "Reflectance of particular cotton variety. Please ensure that you are using cottons with a reflectance range of plus minus 4",
  maturity: "Maturity of particular cotton variety.",
  short_fiber: "Short Fibre Content of particular cotton variety.",
};

function Help({ topic }) {
  return <span title={HELP[topic]} style={{ cursor: "help", marginLeft: 4 }}>(?)</span>;
}

function blankCotton() {
  return {
    name: "", cost_per_bale: "", bale_weight: "", trash_pct: "",
    min_bales: "", max_bales: "",
    span25: "", span50: "", micronaire: "", strength: "",
    reflectance: "", maturity: "", short_fiber: "",
  };
}

function toNum(v) {
  return v === "" || v === undefined ? null : parseFloat(v);
}

export default function App() {
  const [screen, setScreen] = useState(1);

  // screen 1 state
  const [totalMixing, setTotalMixing] = useState("");
  const [numCottons, setNumCottons] = useState(2);
  const [countToSpin, setCountToSpin] = useState("");
  const [usterLevel, setUsterLevel] = useState("5%");
  const [testMode, setTestMode] = useState("ICC");

  // screen 2 state
  const [cottons, setCottons] = useState([blankCotton(), blankCotton()]);
  const [lintLossPct, setLintLossPct] = useState("");
  const [comberNoilPct, setComberNoilPct] = useState("");
  const [requirements, setRequirements] = useState({
    span25: "", span50: "", micronaire: "", strength: "",
    reflectance: "", maturity: "", short_fiber: "",
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const span25Label = testMode === "HVI" ? "Upper half mean length (mm)" : "2.5% Span Length (mm)";
  const span50Label = testMode === "HVI" ? "Mean Length (mm)" : "50% Span Length (mm)";

  function goToScreen2() {
    const n = parseInt(numCottons);
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(cottons[i] || blankCotton());
    setCottons(arr);
    setScreen(2);
  }

  function updateCotton(i, field, value) {
    setCottons(cottons.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  async function handleSolve() {
    setError("");
    setLoading(true);

    const body = {
      total_mixing_kg: parseFloat(totalMixing),
      test_mode: testMode,
      lint_loss_pct: toNum(lintLossPct) ?? 0,
      comber_noil_pct: toNum(comberNoilPct) ?? 0,
      cottons: cottons.map((c, i) => ({
        name: c.name || `Cotton${i + 1}`,
        cost_per_bale: parseFloat(c.cost_per_bale),
        bale_weight: parseFloat(c.bale_weight),
        trash_pct: toNum(c.trash_pct) ?? 0,
        min_bales: toNum(c.min_bales) ?? 0,
        max_bales: toNum(c.max_bales),
        span25: toNum(c.span25),
        span50: toNum(c.span50),
        micronaire: toNum(c.micronaire),
        strength: toNum(c.strength),
        reflectance: toNum(c.reflectance),
        maturity: toNum(c.maturity),
        short_fiber: toNum(c.short_fiber),
      })),
      requirements: {
        span25: toNum(requirements.span25),
        span50: toNum(requirements.span50),
        micronaire: toNum(requirements.micronaire),
        strength: toNum(requirements.strength),
        reflectance: toNum(requirements.reflectance),
        maturity: toNum(requirements.maturity),
        short_fiber: toNum(requirements.short_fiber),
      },
    };

    try {
      const res = await fetch("https://cotton-backend-l2s5.onrender.com/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setScreen(3);
      } else {
        setError("No solution found: " + data.message);
      }
    } catch (e) {
      setError("Could not reach the backend. Make sure FastAPI is running on port 8000.");
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>Optimise Mixing Cost</h2>

      {screen === 1 && (
        <div>
          <h3>Enter mixing requirements</h3>

          <div style={{ marginBottom: 8 }}>
            <label>Total Mixing (Kg)*<Help topic="total_mixing" />: </label>
            <input type="number" value={totalMixing} onChange={e => setTotalMixing(e.target.value)} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Number of cottons to be tried for this mixing*<Help topic="num_cottons" />: </label>
            <select value={numCottons} onChange={e => setNumCottons(e.target.value)}>
              {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Count to be spun (Ne)*<Help topic="count" />: </label>
            <input type="number" value={countToSpin} onChange={e => setCountToSpin(e.target.value)} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Target yarn uster level*<Help topic="uster" />: </label>
            <select value={usterLevel} onChange={e => setUsterLevel(e.target.value)}>
              <option>5%</option><option>25%</option><option>50%</option>
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Cotton Test Mode*<Help topic="test_mode" />: </label>
            <select value={testMode} onChange={e => setTestMode(e.target.value)}>
              <option>ICC</option>
              <option>HVI</option>
            </select>
          </div>

          <button onClick={goToScreen2}>Continue &gt;</button>
        </div>
      )}

      {screen === 2 && (
        <div>
          <h3>Enter Cotton parameters</h3>
          <p>Please fill all the mandatory fields marked by * and at least ONE property for ALL the cottons.</p>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Field</th>
                {cottons.map((_, i) => <th key={i}>Cotton {i + 1}</th>)}
                <th>Required Mixing Property</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cotton Name*<Help topic="cotton_name" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input value={c.name} onChange={e => updateCotton(i, "name", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>Cotton Cost / Bale*<Help topic="cost_per_bale" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.cost_per_bale} onChange={e => updateCotton(i, "cost_per_bale", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>Bale Weight (Kg)*<Help topic="bale_weight" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.bale_weight} onChange={e => updateCotton(i, "bale_weight", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>Trash (%)*<Help topic="trash" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.trash_pct} onChange={e => updateCotton(i, "trash_pct", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>Lint Loss in Blow room (%)*<Help topic="lint_loss" /></td>
                <td colSpan={cottons.length}>
                  <input type="number" value={lintLossPct} onChange={e => setLintLossPct(e.target.value)} />
                </td>
                <td></td>
              </tr>
              <tr>
                <td>Comber Noil (%)<Help topic="comber_noil" /></td>
                <td colSpan={cottons.length}>
                  <input type="number" value={comberNoilPct} onChange={e => setComberNoilPct(e.target.value)} />
                </td>
                <td></td>
              </tr>
              <tr>
                <td>Minimum Bales to be used<Help topic="min_bales" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.min_bales} onChange={e => updateCotton(i, "min_bales", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>Maximum Bales to be used<Help topic="max_bales" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.max_bales} onChange={e => updateCotton(i, "max_bales", e.target.value)} /></td>
                ))}
                <td></td>
              </tr>
              <tr>
                <td>{span25Label}<Help topic="span25" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.span25} onChange={e => updateCotton(i, "span25", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.span25} onChange={e => setRequirements({ ...requirements, span25: e.target.value })} /></td>
              </tr>
              <tr>
                <td>{span50Label}<Help topic="span50" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.span50} onChange={e => updateCotton(i, "span50", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.span50} onChange={e => setRequirements({ ...requirements, span50: e.target.value })} /></td>
              </tr>
              <tr>
                <td>Micronaire (ug/inch)<Help topic="micronaire" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.micronaire} onChange={e => updateCotton(i, "micronaire", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.micronaire} onChange={e => setRequirements({ ...requirements, micronaire: e.target.value })} /></td>
              </tr>
              <tr>
                <td>Strength (g/tex)<Help topic="strength" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.strength} onChange={e => updateCotton(i, "strength", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.strength} onChange={e => setRequirements({ ...requirements, strength: e.target.value })} /></td>
              </tr>
              <tr>
                <td>Reflectance (Rd)<Help topic="reflectance" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.reflectance} onChange={e => updateCotton(i, "reflectance", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.reflectance} onChange={e => setRequirements({ ...requirements, reflectance: e.target.value })} /></td>
              </tr>
              <tr>
                <td>Maturity Ratio<Help topic="maturity" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.maturity} onChange={e => updateCotton(i, "maturity", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.maturity} onChange={e => setRequirements({ ...requirements, maturity: e.target.value })} /></td>
              </tr>
              <tr>
                <td>Short Fiber Content (%)<Help topic="short_fiber" /></td>
                {cottons.map((c, i) => (
                  <td key={i}><input type="number" value={c.short_fiber} onChange={e => updateCotton(i, "short_fiber", e.target.value)} /></td>
                ))}
                <td><input type="number" value={requirements.short_fiber} onChange={e => setRequirements({ ...requirements, short_fiber: e.target.value })} /></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12 }}>
            <button onClick={() => setScreen(1)}>&lt; Back</button>{" "}
            <button onClick={handleSolve} disabled={loading}>{loading ? "Solving..." : "Solve"}</button>
          </div>

          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      )}

      {screen === 3 && result && (
        <div>
          <h3>Here are your mixing suggestions</h3>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Cotton Name</th>
                {result.rows.map((r, i) => <th key={i}>{r.name}</th>)}
                <th>Required</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>No. Of Bales</td>
                {result.rows.map((r, i) => <td key={i}>{r.bales}</td>)}
                <td></td>
                <td>{result.rows.reduce((s, r) => s + r.bales, 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Bale weight (Kg)</td>
                {result.rows.map((r, i) => <td key={i}>{r.bale_weight}</td>)}
                <td></td>
                <td>-</td>
              </tr>
              <tr>
                <td>Total Kg of bale cotton</td>
                {result.rows.map((r, i) => <td key={i}>{r.total_kg}</td>)}
                <td>{result.total_mixing_kg}</td>
                <td>{result.total_actual_kg}</td>
              </tr>
              <tr>
                <td>Total Kg of clean cotton</td>
                {result.rows.map((r, i) => <td key={i}>{r.clean_kg}</td>)}
                <td></td>
                <td>{result.rows.reduce((s, r) => s + r.clean_kg, 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cost Per Bale</td>
                {result.rows.map((r, i) => <td key={i}>{r.cost_per_bale}</td>)}
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>Trash + Lint loss (%)</td>
                {result.rows.map((r, i) => <td key={i}>{r.trash_plus_lint}</td>)}
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>Clean Cotton Cost Per Kg</td>
                {result.rows.map((r, i) => <td key={i}>{r.clean_cost_per_kg}</td>)}
                <td></td>
                <td>{result.cost_per_kg}</td>
              </tr>
              <tr>
                <td>{span25Label}</td>
                {result.rows.map((r, i) => <td key={i}>{r.span25 ?? ""}</td>)}
                <td>{result.required.span25 ?? "-"}</td>
                <td>{result.achieved.span25}</td>
              </tr>
              <tr>
                <td>{span50Label}</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.span50 ?? "-"}</td>
                <td>{result.achieved.span50}</td>
              </tr>
              <tr>
                <td>Micronaire (ug/inch)</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.micronaire ?? "-"}</td>
                <td>{result.achieved.micronaire}</td>
              </tr>
              <tr>
                <td>Strength (g/tex)</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.strength ?? "-"}</td>
                <td>{result.achieved.strength}</td>
              </tr>
              <tr>
                <td>Reflectance (Rd)</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.reflectance ?? "-"}</td>
                <td>{result.achieved.reflectance}</td>
              </tr>
              <tr>
                <td>Maturity Ratio</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.maturity ?? "-"}</td>
                <td>{result.achieved.maturity}</td>
              </tr>
              <tr>
                <td>Short Fiber Content (%)</td>
                <td colSpan={result.rows.length}></td>
                <td>{result.required.short_fiber ?? "-"}</td>
                <td>{result.achieved.short_fiber}</td>
              </tr>
              <tr>
                <td><b>Total Cost</b></td>
                <td colSpan={result.rows.length}></td>
                <td></td>
                <td><b>{result.total_cost}</b></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12 }}>
            <button onClick={() => setScreen(2)}>&lt; Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
