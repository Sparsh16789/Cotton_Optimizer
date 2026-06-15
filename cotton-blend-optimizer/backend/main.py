from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from scipy.optimize import linprog

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cotton-frontend-zi5q.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Cotton(BaseModel):
    name: str
    cost: float
    bale_weight: float
    trash: float = 0
    lint_loss: float = 0
    min_bales: float = 0
    max_bales: Optional[float] = None
    span25: Optional[float] = None
    span50: Optional[float] = None
    micronaire: Optional[float] = None
    strength: Optional[float] = None
    reflectance: Optional[float] = None
    maturity: Optional[float] = None
    short_fiber: Optional[float] = None


class Requirements(BaseModel):
    span25: Optional[float] = None
    span50: Optional[float] = None
    micronaire: Optional[float] = None
    strength: Optional[float] = None
    reflectance: Optional[float] = None
    maturity: Optional[float] = None
    short_fiber: Optional[float] = None


class OptimizeRequest(BaseModel):
    target_weight: float
    cottons: list[Cotton]
    requirements: Requirements


@app.post("/optimize")
def optimize(req: OptimizeRequest):
    cottons = req.cottons
    n = len(cottons)
    tw = req.target_weight

    # waste factor: how much raw cotton we need per kg of clean cotton
    waste_factors = [1 + (c.trash + c.lint_loss) / 100 for c in cottons]

    # objective: minimize total cost
    objective = [(c.cost / c.bale_weight) * waste_factors[i] for i, c in enumerate(cottons)]

    # build quality constraints
    A_ub = []
    b_ub = []

    req_dict = req.requirements.dict()

    # span25, span50, strength, reflectance, maturity must be >= requirement
    for key in ["span25", "span50", "strength", "reflectance", "maturity"]:
        r = req_dict.get(key)
        if r is None:
            continue
        row = []
        for c in cottons:
            val = getattr(c, key) or 0
            row.append(r - val)  # weighted avg >= r  =>  sum((r - val) * x) <= 0
        A_ub.append(row)
        b_ub.append(0)

    # short_fiber must be <= requirement
    r = req_dict.get("short_fiber")
    if r is not None:
        row = []
        for c in cottons:
            val = getattr(c, "short_fiber") or 0
            row.append(val - r)
        A_ub.append(row)
        b_ub.append(0)

    # micronaire uses harmonic mean
    r = req_dict.get("micronaire")
    if r is not None:
        row = []
        for c in cottons:
            val = getattr(c, "micronaire") or 0.001
            row.append(1 / val - 1 / r)
        A_ub.append(row)
        b_ub.append(0)

    # bounds for each cotton (in clean kg)
    bounds = []
    for i, c in enumerate(cottons):
        lo = (c.min_bales * c.bale_weight) / waste_factors[i] if c.min_bales else 0
        hi = (c.max_bales * c.bale_weight) / waste_factors[i] if c.max_bales else None
        bounds.append((lo, hi))

    # equality: total raw kg must equal target weight
    A_eq = [waste_factors]
    b_eq = [tw]

    result = linprog(
        c=objective,
        A_ub=A_ub if A_ub else None,
        b_ub=b_ub if b_ub else None,
        A_eq=A_eq,
        b_eq=b_eq,
        bounds=bounds,
        method="highs",
    )

    if result.status != 0:
        return {"success": False, "message": result.message}

    rows = []
    total_cost = 0

    for i, c in enumerate(cottons):
        clean_kg = result.x[i]
        raw_kg = clean_kg * waste_factors[i]
        bales = raw_kg / c.bale_weight
        cost = raw_kg * (c.cost / c.bale_weight)
        total_cost += cost
        rows.append({
            "name": c.name,
            "bales": round(bales, 2),
            "clean_kg": round(clean_kg, 2),
            "share_pct": round((clean_kg / tw) * 100, 1),
            "cost": round(cost, 2),
        })

    return {
        "success": True,
        "total_cost": round(total_cost, 2),
        "cost_per_kg": round(total_cost / tw, 4),
        "target_weight": tw,
        "rows": rows,
    }


@app.get("/")
def root():
    return {"status": "running"}
