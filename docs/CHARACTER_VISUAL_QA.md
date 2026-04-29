# Character Visual QA Checklist

This document defines **pass/fail visual checks** for character rendering and animation, with concrete implementation touchpoints.

## Code touchpoints (what each area controls)

- `src/game/rendering/units/humanRigBody.ts`
  - Base rig composition, part stacking, z-index buckets, equipment slots (`headSlot`, `shoulderSlotL/R`, `backSlot`, `waistSlot`), and base part offsets/scales.
- `src/game/rendering/units/fireStyles.ts`
  - Per-class fire choreography (`FIRE_STYLES`) and mount profiles (`WEAPON_HOLD`) including class grip anchor, weapon scale, muzzle offset, and rest Y.
- `src/game/rendering/units/animate.ts`
  - Runtime motion channels for idle/walk/fire/hit/death, facing interpolation, rig-vs-bespoke transform path, and muzzle flash placement at fire time.
- `src/game/rendering/units/UnitNode.ts`
  - Unit node creation, wiring of rig composition + weapon wrap + arms sprite, and preload pipeline for rig parts and overlays.
- `src/ui/CharacterAnimationPreviewer.tsx`
  - Dev preview workflow UI (template/loadout/facing selection, idle/walk/fire/hit/death triggers) that reuses live `createUnitNode` + `tickUnitAnimations`.

---

## Minimal “How to review” workflow

1. Open the dev previewer (`CharacterAnimationPreviewer`) and load a soldier template with visible armor/kit layers plus at least two weapon classes (example: rifle + pistol sidearm).
2. For each test below, run checks in both facings:
   - Facing `Right (1)`
   - Facing `Left (-1)`
3. Trigger and observe states in this order:
   - `Idle`
   - `Walk` (loop for at least 3 cycles)
   - `Fire`
   - `Hit`
   - `Death`
4. Repeat Fire checks with each available fire context/class (rifle, sniper, shotgun, heavy, smg, pistol where available).
5. Record result as **PASS** only if all expected outcomes hold in both facings.

---

## QA checks

## 1) Proportions and silhouette consistency

### Scope
- Body part scale/origin consistency across rig parts and animation channels.

### Inspect against
- `humanRigBody.ts`: fixed rig part scale and base placement (`SPRITE_SCALE`, base part positioning).
- `animate.ts`: additive motion on top of base pose (walk bob/lean/squash, recoil, idle breath) without permanent drift.

### Pass criteria
- Character keeps a stable total height/width envelope in idle and walk (no sudden growth/shrink between frames).
- Torso/head/arms remain anatomically connected while moving/firing.
- No one-tile jumps or cumulative drift when returning to idle after walk/fire.
- Death pose tips/fades body as one coherent silhouette (not detached torso/head).

### Fail examples
- Torso appears offset from legs/head during walk or after recoil.
- Legs stretch abnormally (scale overwrite symptoms) or body sinks/rises permanently.
- Switching pose states causes discontinuous size/position pops.

---

## 2) Weapon grip and muzzle alignment by class

### Scope
- Weapon/arms pivot correctness, hold height, class silhouette, and flash origin.

### Inspect against
- `fireStyles.ts`: `WEAPON_HOLD` (`gripAnchor`, `armsAnchor`, `scale`, `restY`, `muzzleOffset`) and `FIRE_STYLES` timing/kick/lift.
- `UnitNode.ts`: weapon wrap + arms/weapon mount initialization.
- `animate.ts`: windup/shot/return transforms and muzzle flash draw using class muzzle offsets.

### Pass criteria (per class)
- Weapon rotates around hand grip (not around sprite center or floating point).
- Muzzle flash appears at barrel tip for that class in both facings.
- Class read is distinct:
  - pistol visually smaller/lower and one-hand-biased,
  - heavy visually larger/shouldered with burst cadence,
  - sniper/rifle raised-to-eye behavior is deliberate and stable.
- Rest pose after fire returns to class-appropriate `restY` (no lingering offset).

### Fail examples
- Flash appears mid-body or detached from muzzle.
- Left-facing barrel flash does not mirror correctly.
- Pistol appears rifle-sized or heavy appears under-scaled.

---

## 3) Equipment slot occlusion correctness

### Scope
- Draw order and slot-layer placement for armor/clothing/kit overlays.

### Inspect against
- `humanRigBody.ts`: `Z_BASE_PART`, `Z_BODY_OVERLAY`, `Z_SLOT`, and slot container wiring for head/shoulder/back/waist.
- `UnitNode.ts`: overlay asset preloading and composition path usage.

### Pass criteria
- Back items render behind torso/head as intended.
- Waist items sit above arms-back but below torso where designed.
- Helmet and shoulder overlays remain above underlying head/torso without clipping through.
- Occlusion remains correct during walk lean, fire recoil, and hit jitter.

### Fail examples
- Backpack draws in front of chest unexpectedly.
- Shoulder pad disappears behind face during sway.
- Waist pouches jump to wrong layer during animation.

---

## 4) Mirrored facing parity

### Scope
- Left/right equivalence of animation envelope and mount geometry.

### Inspect against
- `animate.ts`: facing interpolation, symmetric clamps, mirrored sign usage.
- `fireStyles.ts`: class hold/muzzle values that must mirror with facing sign.
- `CharacterAnimationPreviewer.tsx`: explicit facing toggles and trigger controls.

### Pass criteria
- Right-facing and left-facing poses are mirror-equivalent (same amplitude/timing, opposite direction).
- Fire windup, recoil, and return feel identical in magnitude both ways.
- Muzzle flash and grip alignment mirror exactly (no one-side offset bias).

### Fail examples
- One direction has larger lean/recoil envelope.
- One side clips equipment while the opposite side does not.
- Turn-to-fire transition pops on only one direction.

---

## 5) Animation naturalness (idle/walk/fire/hit/death)

### Scope
- Motion readability and state transitions.

### Inspect against
- `animate.ts`: idle breath/sway, walk cycle channels, fire phases, hit flash/jitter, death slump/fade.
- `CharacterAnimationPreviewer.tsx`: trigger functions (`trigIdle`, `trigFire`, `trigHit`, `trigDeath`, walk loop).

### Expected outcomes by state
- **Idle**
  - Subtle breathing/sway only; no hover-like drift.
  - Weapon rests low-ready; no continuous snap.
- **Walk**
  - Rhythmic two-step bob/squash with readable weight shift.
  - Weapon sway counterbalances body lean; silhouette stays coherent.
- **Fire**
  - Clear windup → shot window(s) → return.
  - Recoil appears as short impulse; no frozen recoil endpoint.
- **Hit**
  - Brief red flash + mild jitter; effect decays cleanly.
  - Underlying pose resumes smoothly after hit window.
- **Death**
  - Progressive slump/tip and fade to corpse alpha.
  - No post-death oscillation from leftover live-state channels.

### Fail examples
- Idle movement looks floaty or too noisy.
- Fire transitions skip windup or never settle.
- Hit jitter overwhelms readability or persists.
- Death leaves body in an animated walk pose.

---

## Suggested test matrix (minimum)

- 1 soldier template with full loadout overlays (helmet/shoulder/back/waist-visible)
- 1 light weapon context (pistol or smg)
- 1 long gun context (rifle or sniper)
- 1 heavy/shotgun context (heavy or shotgun)
- Both facings (`1`, `-1`) across Idle/Walk/Fire/Hit/Death

A change is **ready** only if every row above passes for both facings and at least 3 weapon-class profiles.
