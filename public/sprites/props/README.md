# Street props — world-space corridor dressing

Drop neon street-prop art here, then add its path to `public/art-manifest.json` and list
it in `ui/props.ts` (`PROP_SHEETS`) with explicit frame dimensions. Absent files fall back
to procedural neon-rectangle placeholders (`systems/streetProps.ts`) so the layout works
without art. See `public/ASSET_INDEX.md` → "Street props".

Pending:
- `vending_machine.png` — 自販機 neon vending machine. 2048×768, 4 frames in a row
  (512×768 each). Loader + `prop_vending_idle` @3fps already wired; just commit the PNG
  and add `"sprites/props/vending_machine.png"` to `art-manifest.json`.
