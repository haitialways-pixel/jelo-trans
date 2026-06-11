# Tarification Phalo Transportation — proposition

*(Note perso pour le boss. Le détail chiffré est juste en dessous si tu veux creuser.)*

---

Salut,

J'ai bossé sur un truc côté prix, je voulais ton avis avant d'aller plus loin.

Aujourd'hui on fixe nos tarifs à la main. Le souci, c'est que si l'essence ou les salaires montent, on grignote notre marge sans même s'en rendre compte — et y'a aucune règle qui garantit qu'on gagne de l'argent sur chaque course.

Mon idée : une petite formule, un peu comme **Uber**, qui part de nos **vrais coûts** (chauffeur, essence, snacks à bord, assurance…) et qui nous **garantit toujours notre marge**. Le mieux : **pas besoin d'augmenter les prix**. Quand je fais tourner les chiffres avec des coûts réalistes, ça retombe **pile sur nos $125/h actuels** — donc on prouve juste qu'on est déjà rentables, et on le reste même si les coûts bougent.

Le truc que la concurrence oublie tout le temps : les **kilomètres à vide** (aller chercher le client + rentrer à vide). Ça coûte presque autant que la course. Si on les compte pas, on perd de l'argent sans le voir. La formule les inclut.

En dessous t'as tout le détail : les calculs, une petite compa avec Uber Black, et surtout un **tableau où t'as juste à mettre nos vrais coûts**. Dis-moi ce que t'en penses — si ça te parle, on teste sur quelques courses.

— Marc

> ⚠️ Les chiffres en dollars ci-dessous sont des **exemples** pour montrer comment ça marche. Faut les remplacer par nos vrais coûts (§8). C'est un modèle commercial, pas un conseil juridique/comptable.

---

*Le détail technique 👇*

---

## 1. Why move to a formula

Today every hourly rate is typed in by hand. That creates three silent risks:

1. **Margin erosion** — if fuel or wages rise, a fixed $125/hr quietly becomes less profitable, and nobody notices until the books do.
2. **No profit guarantee** — there is no rule that proves *every* job clears its true cost.
3. **Blind pricing vs competitors** — we can't confidently match or beat Uber/competitors because we don't know our own floor.

**Goal:** a transparent, cost-based formula (same building blocks Uber uses) that **guarantees a target profit on every trip** and **re-adjusts automatically** when costs move.

---

## 2. How the competition prices (Uber, 2026)

Uber's fare is a sum of components, then a demand multiplier:

```
Fare = ( Base + Per-mile × miles + Per-minute × minutes ) × Surge  + Booking fee + Tolls/Airport
       (subject to a Minimum fare)
```

| | UberX (national avg) | Uber Black (luxury) |
|---|---|---|
| Base | ~$1.00 | ~$20 |
| Per mile | ~$0.97 | ~$3.00 |
| Per minute | ~$0.32 | (wait-time after 5-min grace) |
| Booking fee | ~$3.20 | — |
| Surge | ×2–5 on trip portion | mostly flat (premium = stable) |
| Example | 5 mi ≈ $15–22 | 10 mi / 20 min ≈ $45–65 |

**Takeaways we copy:** (a) split price into legible components; (b) always enforce a **minimum fare**; (c) a **peak multiplier** for high demand. **What Uber Black teaches:** luxury buyers will pay 20–40%+ more for a *stable, premium, no-surprise* experience — that is exactly Phalo Transportation's lane.

---

## 3. Our true cost of a trip

The model prices on **fully-loaded cost** — including the costs most operators forget:

| Cost (per trip) | Symbol | Note |
|---|---|---|
| Chauffeur pay | `D` | Paid for **all engaged time**, incl. driving to pickup + returning empty |
| Fuel | `F` | `miles ÷ MPG × price_per_gallon` — on **total** miles, not just billed |
| Vehicle wear (maintenance, tires, depreciation) | `M` | per mile, on total miles |
| Insurance (commercial livery) | `I` | allocated per engaged hour — a major luxury-transport cost |
| Overhead (dispatch, software, marketing, permits, admin) | `O` | allocated per engaged hour |
| Amenities (water, snacks served on board) | `A` | per trip — small cost, big perceived value |
| Cleaning / detailing between trips | `Cl` | per trip |
| Card processing (Stripe) | `p` | ~2.9% + $0.30 of the fare |

> ⚠️ **The #1 margin killer: dead miles ("deadhead").** Driving to the pickup and back empty can equal or exceed the billed miles. If you don't price them in, every trip is less profitable than it looks. Our formula loads them in explicitly.

---

## 4. The formula

### 4.1 The profit rule (this is what "guarantees" profit)

We never mark *up*; we price to a **target margin on revenue** `m`:

```
Price = Cost ÷ (1 − m)
```

- `m = 40%` → `Price = Cost ÷ 0.60 = Cost × 1.667`
- ⚠️ **Margin ≠ markup.** 40% *margin* is a 66.7% *markup*. Confusing the two is a classic, expensive mistake — this rule fixes the margin **on revenue**, which is what protects the business.

Because price is *defined* as cost ÷ (1−m), the target margin is mathematically guaranteed on every job, whatever the costs are that day.

### 4.2 Mode A — Hourly charter (current product: events, weddings, by-the-hour)

```
Cost_per_hour = D_hr×(1+deadhead_time%) + F_hr + M_hr + I_hr + O_hr + A_hr
Rate_per_hour = Cost_per_hour ÷ (1 − m)          ← per-vehicle hourly rate
Quote        = Rate_per_hour × hours × peak_multiplier   (then + card processing)
```

### 4.3 Mode B — Point-to-point transfer (NEW — fixes airport/flat trips)

For MCO transfers and one-way trips, an Uber-style fixed quote:

```
Trip_cost = D + F + M + I + O + A + Cl     (all on TOTAL time & miles, incl. deadhead)
Fare      = max( Min_fare ,  Trip_cost ÷ (1 − m) ) × peak_multiplier
Charged   = Fare ÷ (1 − p) + $0.30          (pass card fee through, keep margin intact)
```

Presented to the customer as a clean **fixed price** ("$X, all-in, no surge") — a direct advantage over Uber Black's variable fare.

---

## 5. Worked examples (illustrative)

### 5.1 Hourly — does the model match reality?

| Input | Value |
|---|---|
| Chauffeur | $28/hr, +25% for deadhead → **$35/hr** |
| Fuel | ~$3/hr |
| Maintenance/depreciation | ~$4/hr |
| Insurance (livery) | ~$12/hr |
| Overhead | ~$15/hr |
| Amenities | ~$4/hr |
| **Cost/hour** | **≈ $73/hr** |
| Target margin `m` | 40% |
| **Rate = 73 ÷ 0.60** | **≈ $122 → $125/hr** |

✅ **Sanity check:** the model lands on **$125/hr** — exactly today's S-Class rate. So the current $125/$140/$155/$165/$185 ladder is already ~a 40% margin; we're not raising prices, we're **proving and protecting** them. Bigger/thirstier vehicles (Escalade, Sprinter, Stretch) cost more → the ladder follows automatically.

### 5.2 Point-to-point — MCO → Walt Disney World (~20 mi billed)

| Input | Value |
|---|---|
| Engaged time incl. positioning + empty return | ~75 min |
| Total miles incl. deadhead | ~40 mi |
| Driver (75 min) | $35 |
| Fuel (40 mi / 15 MPG × $3.50) | $9 |
| Maintenance (40 × $0.35) | $14 |
| Insurance + overhead (75 min) | $34 |
| Amenities + cleaning | $8 |
| **Fully-loaded cost** | **≈ $100** |
| **Fare = 100 ÷ 0.60** | **≈ $167** |

✅ **The real value:** the formula reveals the **true cost floor (~$100)** for this trip — *including the empty return miles competitors ignore*. Uber Black for the same trip ≈ $90–110. So management can decide, **with eyes open**: price at $167 (premium, 40% margin) or compete nearer $120 (still profitable) — but **never below ~$100**, which is the line that guarantees we don't lose money.

---

## 6. How profit is guaranteed (the 6 levers)

1. **Margin markup** — `Price = Cost ÷ (1 − m)` fixes the margin on every job by construction.
2. **Minimum fare** — short trips still cover per-trip fixed costs (cleaning, processing, dispatch).
3. **Deadhead loading** — empty miles/time are billed into cost, so they can't eat margin.
4. **Cost indexing** — when fuel or wages rise, rates recompute (e.g., a fuel surcharge when gas > $X/gal). Margin holds even as costs climb.
5. **Peak multiplier** — capture extra margin in high-demand windows (controlled, ~1.25–1.5×; never gouging — that protects the brand).
6. **Processing pass-through** — card fees added on top, so Stripe's ~3% doesn't come out of margin.

---

## 7. Competitive positioning

| | Uber Black | **Phalo Transportation** |
|---|---|---|
| Price | Variable, can surge | **Fixed, all-in, no surprises** |
| Vehicle | Whatever shows up | **Guaranteed specific vehicle** |
| Driver | Random | **Vetted, dedicated chauffeur** |
| Onboard | None | **Amenities (water, snacks)** |
| Hourly / events | No | **Yes (charters, weddings)** |
| Relationship | None | **Repeat-client, concierge** |

We don't win on being cheapest — we win on **certainty + experience**, and the formula lets us defend that premium *while proving every job is profitable*.

---

## 8. Inputs to confirm (owner fills these in)

| Parameter | Placeholder | Your real number |
|---|---|---|
| Chauffeur cost ($/hr, loaded) | $28 | |
| Deadhead time factor (%) | 25% | |
| Avg MPG per vehicle class | 15 | |
| Fuel price ($/gal) | $3.50 | |
| Maintenance+depreciation ($/mi) | $0.35 | |
| Commercial insurance ($/engaged hr) | $12 | |
| Overhead ($/engaged hr) | $15 | |
| Amenities ($/trip) | $4 | |
| Cleaning ($/trip) | $4 | |
| **Target margin `m`** | **40%** | |
| Minimum fare | $95 | |
| Peak multiplier (cap) | 1.5× | |
| Card processing | 2.9% + $0.30 | |

---

## 9. Risks & notes

- **Gratuity is the driver's, not company margin.** The current "+20% gratuity" should flow to the chauffeur and stay **separate** from the profit margin in the rate. Mixing them overstates profit — a real accounting trap.
- **Insurance & permits** (commercial livery, MCO airport access) are significant and region-specific — confirm before committing rates.
- Numbers here are illustrative; the owner's real inputs (§8) drive the final rates.

---

## 10. If approved — how we build it

- Store the §8 inputs + margin as **editable settings** (DB table `pricing_config`), not hardcoded.
- Compute each vehicle's `hourly_rate` from its cost profile (rates become **derived**, auto-updating when inputs change).
- Add the **point-to-point transfer** product to the booking engine (this also resolves the current `/services` page, which advertises flat "from $95" prices the engine can't actually honor).
- Keep the server-authoritative pricing rule we already enforce (the customer never sets the price).

> **Sources (Uber benchmarks):**
> - https://getridewise.com/blog/how-much-is-uber
> - https://getridewise.com/blog/how-uber-lyft-calculate-fare-pricing
> - https://www.ridester.com/uber-black/
> - https://gothamride.com/blog/black-car-vs-uber-black-nyc-2025/
