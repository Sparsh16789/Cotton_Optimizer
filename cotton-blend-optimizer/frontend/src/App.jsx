import { useState } from "react";

const QUALITY_PROPS = [
  { key: "span25",      label: "2.5% Span Length (mm)",   condition: ">=" },
  { key: "span50",      label: "50% Span Length (mm)",    condition: ">=" },
  { key: "micronaire",  label: "Micronaire (µg/inch)",    condition: ">=" },
  { key: "strength",    label: "Strength (g/tex)",        condition: ">=" },
  { key: "reflectance", label: "Reflectance (Rd)",        condition: ">=" },
  { key: "maturity",    label: "Maturity Ratio",          condition: ">=" },
  { key: "short_fiber", label: "Short Fiber Content (%)", condition: "<=" },
];

function blankCotton() {
  return {
    name: "", cost: "", bale_weight: "", trash: "", lint_loss: "",
    min_bales: "", max_bales: "",
    span25: "", span50: "", micronaire: "",
    strength: "", reflectance: "", maturity: "", short_fiber: "",
  };
}

function toNum(val) {
  return val === "" ? null : parseFloat(val);
}

export default function App() {
  const [targetWeight, setTargetWeight] = useState("");
  const [cottons, setCottons] = useState([blankCotton(), blankCotton()]);
  const [requirements, setRequirements] = useState({
    span25: "", span50: "", micronaire: "",
    strength: "", reflectance: "", maturity: "", short_fiber: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateCotton(index, field, value) {
    const updated = cottons.map((c, i) => {
      if (i === index) {
        return { ...c, [field]: value };
      }
      return c;
    });
    setCottons(updated);
  }

  function addCotton() {
    setCottons([...cottons, blankCotton()]);
  }

  function removeCotton(index) {
    setCottons(cottons.filter((_, i) => i !== index));
  }

  async function handleOptimize() {
    setError("");
    setResult(null);
    setLoading(true);

    const body = {
      target_weight: parseFloat(targetWeight),
      cottons: cottons.map(c => ({
        name: c.name || "Cotton",
        cost: parseFloat(c.cost),
        bale_weight: parseFloat(c.bale_weight),
        trash: toNum(c.trash) ?? 0,
        lint_loss: toNum(c.lint_loss) ?? 0,
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
      } else {
        setError("No solution found: " + data.message);
      }
    } catch (e) {
      setError("Could not reach the backend. Make sure FastAPI is running on port 8000.");
    }

    setLoading(false);
  }

  const activeQualityKeys = QUALITY_PROPS
    .filter(p => requirements[p.key] !== "")
    .map(p => p.key);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>Cotton Blend Optimizer</h1>
      <p>Minimize cost while meeting quality requirements</p>

      <hr />

      <h2>Target Weight</h2>
      <div>
        <label>Target Weight (kg): </label>
        <input
          type="number"
          value={targetWeight}
          onChange={e => setTargetWeight(e.target.value)}
          placeholder="e.g. 1000"
        />
      </div>

      <hr />

      <h2>Quality Requirements (leave blank to skip)</h2>
      {QUALITY_PROPS.map(p => (
        <div key={p.key} style={{ marginBottom: 6 }}>
          <label>{p.label} ({p.condition}): </label>
          <input
            type="number"
            value={requirements[p.key]}
            onChange={e => setRequirements({ ...requirements, [p.key]: e.target.value })}
            placeholder="blank = no requirement"
          />
        </div>
      ))}

      <hr />

      <h2>Cotton Properties</h2>
      {cottons.map((cotton, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
          <b>Cotton {i + 1}</b>
          {cottons.length > 1 && (
            <button onClick={() => removeCotton(i)} style={{ marginLeft: 10 }}>Remove</button>
          )}

          <div style={{ marginTop: 8 }}>
            <div><label>Name: </label>
              <input value={cotton.name} placeholder={`Cotton ${i + 1}`}
                onChange={e => updateCotton(i, "name", e.target.value)} /></div>
            <div><label>Cost per bale: </label>
              <input type="number" value={cotton.cost} placeholder="e.g. 250"
                onChange={e => updateCotton(i, "cost", e.target.value)} /></div>
            <div><label>Bale weight (kg): </label>
              <input type="number" value={cotton.bale_weight} placeholder="e.g. 170"
                onChange={e => updateCotton(i, "bale_weight", e.target.value)} /></div>
            <div><label>Trash (%): </label>
              <input type="number" value={cotton.trash} placeholder="0"
                onChange={e => updateCotton(i, "trash", e.target.value)} /></div>
            <div><label>Lint loss (%): </label>
              <input type="number" value={cotton.lint_loss} placeholder="0"
                onChange={e => updateCotton(i, "lint_loss", e.target.value)} /></div>
            <div><label>Min bales: </label>
              <input type="number" value={cotton.min_bales} placeholder="0"
                onChange={e => updateCotton(i, "min_bales", e.target.value)} /></div>
            <div><label>Max bales (blank = unlimited): </label>
              <input type="number" value={cotton.max_bales} placeholder="blank"
                onChange={e => updateCotton(i, "max_bales", e.target.value)} /></div>

            {activeQualityKeys.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b>Quality values for this cotton:</b>
                {QUALITY_PROPS.filter(p => activeQualityKeys.includes(p.key)).map(p => (
                  <div key={p.key}>
                    <label>{p.label}: </label>
                    <input type="number" value={cotton[p.key]} placeholder="required"
                      onChange={e => updateCotton(i, p.key, e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <button onClick={addCotton}>+ Add Cotton</button>

      <hr />

      <button onClick={handleOptimize} disabled={loading} style={{ fontSize: 16, padding: "8px 20px" }}>
        {loading ? "Optimizing..." : "Optimize Blend"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div>
          <h2>Results</h2>
          <p>Total Cost: <b>{result.total_cost.toLocaleString()}</b></p>
          <p>Cost per kg: <b>{result.cost_per_kg}</b></p>
          <p>Target: <b>{result.target_weight} kg</b></p>

          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", marginTop: 10 }}>
            <thead>
              <tr>
                <th>Cotton</th>
                <th>Bales</th>
                <th>Clean kg</th>
                <th>Share %</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.name}</td>
                  <td>{row.bales}</td>
                  <td>{row.clean_kg}</td>
                  <td>{row.share_pct}%</td>
                  <td>{row.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
