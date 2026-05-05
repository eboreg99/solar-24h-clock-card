# Solar 24h Clock Card

A custom Lovelace card for Home Assistant that displays an analog 24-hour clock — centred around the sun instead of midnight.

**Solar noon is always at the top.** The dial rotates daily so that 12 o'clock always corresponds to local solar noon, giving you an intuitive sense of where the sun stands in the day at a glance.

---

## Features

- 🌞 **Solar noon at top** — dial rotates daily to keep solar noon at the 12 o'clock position
- 🕐 **Single hour hand** — clean and uncluttered; no minute or second hand
- 🔢 **HH:MM display** — current time as a digital readout inside the dial
- 🌅 **Day/night arc** — golden arc for daytime, blue for night, based on real sunrise/sunset times
- 📍 **Sunrise & sunset markers** — clearly marked on the dial rim
- 🧭 **Azimuth indicator** — a line shows the current compass direction of the sun; a glowing dot moves inward/outward based on solar elevation
- ☀️ **Sun info bar** — shows sunrise, current elevation, current azimuth, and sunset below the clock
- 📊 **Elevation bar** — subtle bar visualising the sun's current height above the horizon

All solar data is read live from the `sun.sun` entity in Home Assistant — no extra integrations needed.

---

## Requirements

- Home Assistant with the built-in `sun` integration enabled (active by default)
- The `sun.sun` entity must expose: `next_noon`, `next_rising`, `next_setting`, `azimuth`, `elevation`

---

## Configuration

```yaml
type: custom:solar-24h-clock-card
```

| Option | Default | Description |
|---|---|---|
| `sun_entity` | `sun.sun` | Entity providing solar data |
| `title` | *(none)* | Optional card title |
| `size` | `300` | Canvas size in pixels |
