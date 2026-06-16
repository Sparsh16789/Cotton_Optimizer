from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from scipy.optimize import linprog

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# spec says: ICC test mode uses span25/span50, HVI test mode uses
# upper half mean length/mean length. both map to the same two slots,
# we just call them span25/span50 internally either way.
class Cotton(BaseModel):
    name: str
    cost_per_bale: float
    bale_weight: float
    trash_pct: float = 0
    lint_loss_pct: float = 0
    comber_noil_pct: float = 0
    min_bales: float = 0
    max_bales: Optional[float] = None
    span25: Optional[float] = None       # or upper half mean length (HVI)
    span50: Optional[float] = None       # or mean length (HVI)
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
    total_mixing_kg: float
    test_mode: str  # "ICC" or "HVI"
    cottons: list[Cotton]
    requirements: Requirements


PROPS_GTE = ["span25", "span50", "strength", "reflectance", "maturity"]  # weighted avg must be >= req
PROP_LTE = "short_fiber"   # weighted avg must be <= req
PROP_HARMONIC = "micronaire"  # uses harmonic mean (1/x), must be >= req


@app.post("/optimize")
def optimize(req: OptimizeRequest):
    cottons = req.cottons
    tw = req.total_mixing_kg

    # waste % = trash + lint loss + comber noil, as per spec sheet
    waste_pct = [c.trash_pct + c.lint_loss_pct + c.comber_noil_pct for c in cottons]
    waste_factor = [1 + w / 100 for w in waste_pct]

    # cost per kg of CLEAN cotton = cost per bale / (bale weight / waste_factor)
    objective = [(c.cost_per_bale / c.bale_weight) * waste_factor[i] for i, c in enumerate(cottons)]

    A_ub, b_ub = [], []
    req_dict = req.requirements.dict()

    for key in PROPS_GTE:
        r = req_dict.get(key)
        if r is None:
            continue
        row = [r - (getattr(c, key) or 0) for c in cottons]
        A_ub.append(row)
        b_ub.append(0)

    r = req_dict.get(PROP_LTE)
    if r is not None:
        row = [(getattr(c, PROP_LTE) or 0) - r for c in cottons]
        A_ub.append(row)
        b_ub.append(0)

    r = req_dict.get(PROP_HARMONIC)
    if r is not None:
        row = [1 / (getattr(c, PROP_HARMONIC) or 0.0001) - 1 / r for c in cottons]
        A_ub.append(row)
        b_ub.append(0)

    bounds = []
    for i, c in enumerate(cottons):
        lo = (c.min_bales * c.bale_weight) / waste_factor[i] if c.min_bales else 0
        hi = (c.max_bales * c.bale_weight) / waste_factor[i] if c.max_bales else None
        bounds.append((lo, hi))

    # total raw (bale) weight must equal total mixing requirement
    A_eq = [waste_factor]
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

    clean_kgs = result.x
    total_clean = sum(clean_kgs)

    rows = []
    total_cost = 0
    for i, c in enumerate(cottons):
        clean_kg = clean_kgs[i]
        raw_kg = clean_kg * waste_factor[i]
        bales = raw_kg / c.bale_weight
        cost = raw_kg * (c.cost_per_bale / c.bale_weight)
        total_cost += cost
        rows.append({
            "name": c.name,
            "bales": round(bales, 2),
            "bale_weight": c.bale_weight,
            "total_kg": round(raw_kg, 2),
            "clean_kg": round(clean_kg, 2),
            "trash_plus_lint": round(c.trash_pct + c.lint_loss_pct, 2),
            "cost_per_bale": c.cost_per_bale,
            "clean_cost_per_kg": round((c.cost_per_bale / c.bale_weight) * waste_factor[i], 2),
        })

    # achieved (actual) properties = weighted average across the clean-cotton mix
    def weighted(key):
        if total_clean == 0:
            return 0
        total = sum((getattr(c, key) or 0) * clean_kgs[i] for i, c in enumerate(cottons))
        return round(total / total_clean, 2)

    def weighted_harmonic(key):
        if total_clean == 0:
            return 0
        denom = sum(clean_kgs[i] / (getattr(c, key) or 0.0001) for i, c in enumerate(cottons))
        return round(total_clean / denom, 2) if denom else 0

    achieved = {
        "span25": weighted("span25"),
        "span50": weighted("span50"),
        "micronaire": weighted_harmonic("micronaire"),
        "strength": weighted("strength"),
        "reflectance": weighted("reflectance"),
        "maturity": weighted("maturity"),
        "short_fiber": weighted("short_fiber"),
    }

    return {
        "success": True,
        "total_cost": round(total_cost, 2),
        "cost_per_kg": round(total_cost / tw, 2) if tw else 0,
        "total_mixing_kg": tw,
        "total_actual_kg": round(sum(r["total_kg"] for r in rows), 2),
        "rows": rows,
        "achieved": achieved,
        "required": req_dict,
    }


@app.get("/")
def root():
    return {"status": "running"}
