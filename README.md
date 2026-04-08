# Multi-Stream Race Overlay for OBS

Browser-based Twitch multi-stream overlays for race restreams. Add as an OBS Browser Source — no installs needed.

**Live at:** `thealchemist616.github.io`

## Quick Start

1. Open `thealchemist616.github.io/overlay.html` in your browser
2. Press **E** to enter edit mode
3. Pick a preset layout, type in channel names, adjust panels
4. Click **Export as URL** to copy the configured link
5. In OBS, add a **Browser Source** → paste the URL → set to **1920x1080**

## Interactive Editor (`overlay.html`)

Press **E** to toggle edit mode. In edit mode you get a sidebar with all controls and a visible 1920x1080 canvas grid.

### Layout Controls
- **Preset buttons** — quickly set up 2, 3, 4, 6, 8, 10, 12, 16, or 24 stream grids
- **+ Add Stream** — add a panel manually
- **Drag** a panel to move it
- **Drag corner/edge handles** to resize (hold **Shift** to lock 16:9 aspect ratio)
- **Delete** key or button to remove a panel
- **Channel names** — editable in the sidebar stream list or detail panel

### Crop Mode (Zoom/Pan)
Select a panel, then click **Enter Crop Mode** in the sidebar. The stream plays live while you adjust:
- **Scroll wheel** — zoom in/out (1x to 4x)
- **Drag** on the stream — pan to frame the area you want
- **Escape** or button to exit crop mode

In regular edit mode (not crop mode), you can also:
- **Scroll wheel** on a panel to zoom
- **Shift+drag** on a panel to pan

### Saving & Sharing
- **Auto-saves** to browser localStorage
- **Export as URL** — generates a shareable link with the full layout encoded in the URL hash
- **Copy Config JSON** — copies raw config for backup
- Open an exported URL on any machine to load that exact layout

## Static Overlay Files

Simple fixed-grid alternatives if you don't need the editor:

| File | Grid | Streams |
|------|------|---------|
| `2-streams.html` | 2x1 | 2 |
| `3-streams.html` | 3x1 | 3 |
| `4-streams.html` | 2x2 | 4 |
| `6-streams.html` | 3x2 | 6 |
| `8-streams.html` | 4x2 | 8 |
| `10-streams.html` | 5x2 | 10 |
| `12-streams.html` | 4x3 | 12 |
| `16-streams.html` | 4x4 | 16 |
| `24-streams.html` | 6x4 | 24 |

Set channel names via URL parameter:
```
thealchemist616.github.io/6-streams.html?channels=user1,user2,user3,user4,user5,user6
```

## OBS Setup

1. Add a **Browser Source**
2. Set dimensions to **1920x1080**
3. Paste your overlay URL
4. The background is transparent — layer your frame/border overlay on top

## Bandwidth

Each stream uses ~3-6 Mbps of your download bandwidth. The streams load in your browser (or OBS), not on a server. More panels = more bandwidth.

| Streams | Est. Download |
|---------|--------------|
| 4 | 12-24 Mbps |
| 6 | 18-36 Mbps |
| 12 | 36-72 Mbps |
| 24 | 72-144 Mbps |
