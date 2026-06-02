## OctoPrint Matter Status

### Printer options
- **Treat paused as active**: when enabled, a paused print is still reported as active/occupied.
- When disabled (default), a paused print is reported as inactive (same as idle).

### Recommended use
- Enable this option if you want automations to keep considering the printer "in use" during filament-change pauses.
- Leave it disabled if paused prints should behave like an inactive/idle printer in your home automations.
