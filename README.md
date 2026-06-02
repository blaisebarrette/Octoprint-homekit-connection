# OctoPrint Matter Status

[Homebridge](https://homebridge.io) 2 plugin that exposes your [OctoPrint](https://octoprint.org/) print status as **Matter** sensors. Each printer appears in Apple Home, Google Home, Amazon Alexa, Home Assistant, or any other Matter-compatible controller — with the name you choose.

**npm package:** `homebridge-octoprint-matter-status`

## How it works

| OctoPrint state | Matter sensor (default: occupancy) |
|-----------------|-------------------------------------|
| Printing (`flags.printing` or pausing/cancelling/finishing transitions) | Detected / occupied |
| Idle, operational, not printing | Inactive |
| OctoPrint unreachable | Last known state kept (no spurious toggling) |

The plugin polls OctoPrint via `GET /api/printer` (configurable interval). No changes are required on the OctoPrint server.

## Requirements

- **Homebridge** ≥ 2.0.0 with **Matter enabled** on the main bridge or a child bridge (`bridge.matter` or `_bridge.matter`)
- **Node.js** 22 or 24 (LTS)
- One or more **OctoPrint** instances reachable from the network where Homebridge runs
- An **API key** per printer with at least **STATUS** permission (user key or Application Key — not the deprecated global key)

## Installation

### Via Homebridge Config UI X

1. Install the plugin from the **Plugins** tab (once published on npm), or in development mode:

   ```bash
   cd /path/to/homebridge
   npm install -g /path/to/homebridge-octoprint-matter-status
   ```

2. Restart Homebridge.

3. Add the **OctoPrint Matter Status** platform to your configuration.

### Manual configuration (`config.json`)

```json
{
  "platforms": [
    {
      "platform": "OctoPrintMatterStatus",
      "name": "OctoPrint Matter Status",
      "debug": false,
      "printers": [
        {
          "id": "mk3s",
          "sensorName": "Prusa MK3S Printing",
          "octoprintUrl": "http://octopi.local",
          "apiKey": "YOUR_API_KEY",
          "sensorType": "occupancy",
          "enabled": true,
          "pollIntervalSeconds": 10,
          "invertState": false
        }
      ]
    }
  ]
}
```

> **Migration:** if you used an older version with `"platform": "OctoPrintMatter"`, replace it with `"OctoPrintMatterStatus"` and re-pair Matter if sensors do not reappear (the Matter UUID changed).

## Configuration UI

The plugin provides a **dedicated interface** in Homebridge Config UI X:

- Add / remove printers
- **Sensor name** (`sensorName`) — name shown in HomeKit / Matter on first pairing
- OctoPrint URL and API key (masked)
- Sensor type: **Occupancy / Motion** (recommended) or **Contact**
- Polling interval, enable/disable, state inversion
- **Test connection** button per printer (the API key is never sent to the browser; the test goes through the plugin server)

### Fields per printer

| Field | Description |
|-------|-------------|
| `id` | Unique **stable** identifier (e.g. `mk3s`). Do not change after Matter pairing. |
| `sensorName` | Sensor name in smart home apps (e.g. `Voron 2.4 Printing`). |
| `octoprintUrl` | Full URL, e.g. `http://192.168.1.50` or `http://octopi.local`. |
| `apiKey` | OctoPrint API key (STATUS permission). |
| `sensorType` | `occupancy` (default) or `contact`. |
| `enabled` | Temporarily disable without removing the entry. |
| `pollIntervalSeconds` | Poll frequency (min. 2 s, default 10). |
| `invertState` | Invert active/inactive if needed for automations. |

## OctoPrint API key

1. In OctoPrint: **Settings** → **API Keys** (or **Application Keys**).
2. Create a key with **STATUS** permission (read printer state).
3. Paste it into the plugin configuration.

Reference: [OctoPrint API — General information](https://docs.octoprint.org/en/master/api/general.html)

## Enable Matter and pair

1. In Homebridge Config UI X, enable **Matter** on the bridge hosting this plugin (or on a dedicated child bridge).
2. Restart the bridge.
3. Scan the **Matter QR code** shown by Homebridge in your app of choice (Home, Google Home, etc.).
4. Each configured and enabled printer appears as a sensor named according to `sensorName`.

> Matter and HomeKit via Homebridge are **separate** pairings. Matter sensors do not appear in Homebridge’s classic accessories screen; they are managed by the Matter controller.

## Sensor types

- **Occupancy / Motion** (default) — suited for “the printer is printing”.
- **Contact** — open/closed Matter semantics inverted at the protocol level; useful if your ecosystem prefers it.

## Development

```bash
git clone https://github.com/blaisebarrette/Octoprint-homekit-connection.git
cd Octoprint-homekit-connection
npm install
npm run build      # compile to dist/
npm test           # unit tests
npm run lint
npm run typecheck
```

Symlink for local testing in Homebridge:

```bash
npm link
# then in your Homebridge directory:
npm link homebridge-octoprint-matter-status
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No sensors in Matter | Verify Matter is enabled on the correct bridge and restart. |
| “Matter is not enabled” in logs | Add `matter: true` (or a `matter` block depending on your HB version) to the bridge. |
| Connection test: 401/403 | Invalid API key or missing STATUS permission. |
| Test OK but sensor always inactive | Verify a print is actually running (`flags.printing`). |
| Sensor name changes after rename | Matter name is fixed at pairing; changing `sensorName` may require removing/re-adding the sensor in the controller. |

## License

MIT — see `package.json`.

## Credits

- [Homebridge](https://homebridge.io) and the Matter v2 API
- [OctoPrint](https://octoprint.org/) API
