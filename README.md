# Solar 24h Clock Card

A custom Lovelace card for Home Assistant that displays an analog 24-hour clock — with solar noon at the top instead of midnight.

#VibeCoding

## Concept

Most clocks are centred around midnight. This one is centred around the sun: solar noon is always at the 12 o'clock position, and the dial rotates accordingly. This makes it easy to see at a glance how much daylight is left, where the sun currently stands, and how the day relates to natural light.

## Features

- **Solar noon at top** — the dial rotates daily so that local solar noon is always at the 12 o'clock position
- **Single hour hand** — one clean hand for the current time; no minute or second hand cluttering the dial
- **HH:MM display** — current time shown as a digital readout inside the dial
- **Day/night arc** — golden arc for daytime, blue arc for night, based on actual sunrise and sunset times
- **Sunrise & sunset markers** — clearly marked on the dial rim
- **Azimuth indicator** — a line shows the current compass direction of the sun; a glowing dot moves inward/outward based on elevation
- **Sun info bar** — shows sunrise time, current elevation, current azimuth, and sunset time below the clock
- **Elevation bar** — a subtle bar visualising the sun's current height above the horizon

All solar data is read live from the `sun.sun` entity in Home Assistant.

## Installation

1. Copy `solar-24h-clock-card.js` to `/config/www/`
2. Add the resource in Lovelace (Settings → Dashboards → Resources):
   - URL: `/local/solar-24h-clock-card.js`
   - Type: `JavaScript module`
3. Add the card to your dashboard:

```yaml
type: custom:solar-24h-clock-card
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `sun_entity` | `sun.sun` | Entity providing solar data |
| `title` | _(none)_ | Optional card title |
| `size` | `300` | Canvas size in pixels |

## Requirements

- Home Assistant with the `sun` integration enabled (active by default in most installations)
- The `sun.sun` entity must expose the attributes `next_noon`, `next_rising`, `next_setting`, `azimuth`, and `elevation`
