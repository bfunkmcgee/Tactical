# Audio assets

The `soundEngine` (`src/game/audio/soundEngine.ts`) looks up clips by
filename in this directory. Missing files fail silently — the game
plays without sound until the expected assets land.

## Expected files (all `.ogg`, ≤ 150ms each unless noted)

### Combat
| Filename                | Trigger                                    |
|-------------------------|--------------------------------------------|
| `shot-rifle.ogg`        | Ranger's carbine / scrap assault rifle     |
| `shot-heavy.ogg`        | Autocannon / scrap MG burst                |
| `shot-shotgun.ogg`      | Hexbore Scattergun / goblin blunderbuss    |
| `shot-sniper.ogg`       | Arclight Marksman                          |
| `shot-pistol.ogg`       | Sigilshot / Thornlock / berserker swing    |
| `shot-smg.ogg`          | Whisperneedle                              |
| `hit.ogg`               | Non-crit hit (any faction, < 8 dmg)        |
| `crit.ogg`              | 8+ damage hit                              |
| `miss.ogg`              | Shot whiffs entirely                       |
| `kill.ogg`              | Unit drops to 0 HP (layers over `hit`)     |
| `grenade.ogg`           | Any grenade detonation                     |

### Soldier actions
| Filename                | Trigger                                    |
|-------------------------|--------------------------------------------|
| `reload.ogg`            | tryReload                                  |
| `move.ogg`              | tryMove commits                            |
| `ability.ogg`           | Any class ability activation               |

### UI
| Filename                | Trigger                                    |
|-------------------------|--------------------------------------------|
| `ui-tap.ogg`            | Generic button press                       |
| `ui-primary.ogg`        | Primary CTA (End Turn, Deploy, March on)   |
| `ui-cancel.ogg`         | Back / cancel buttons                      |

### Turn structure
| Filename                | Trigger                                    | Length |
|-------------------------|--------------------------------------------|--------|
| `round-start.ogg`       | Start of each player round after round 1   | < 500ms |
| `victory.ogg`           | Mission phase → `won`                      | 1-2s   |
| `defeat.ogg`            | Mission phase → `lost`                     | 1-2s   |

## Recommended sourcing

- [freesound.org](https://freesound.org) with CC0 / CC-BY filter
- Generate chiptune-adjacent stingers in [sfxr](https://sfxr.me) or
  [ChipTone](https://sfbgames.itch.io/chiptone)
- Keep the master bundle under ~500 KB total; the build already
  precaches the `public/` directory via the PWA plugin.

## Master volume / mute

`soundEngine.setMaster(0..1)` scales all clips. The player can toggle
mute via the 🔊 / 🔇 button on the combat HUD. Both are persisted in
`localStorage` under `tactical.audio.*.v1`.
