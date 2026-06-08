# Street props — world-space corridor dressing

Drop neon street-prop art here, then add its path to `public/art-manifest.json`. The
sheet's frame dims + animations are declared in `src/ui/props.ts` (`PROP_SHEETS`).
Absent files fall back to procedural neon placeholders (`src/systems/streetProps.ts`)
so the layout works without art. Full table: `public/ASSET_INDEX.md` → "Street props".

Expected files (all wired, awaiting binaries):
- prop_vending_machine.png  2048×768  (4×512×768)  -> prop_vending_idle @3
- prop_arcade_cabinet.png   2001×786  (4×500×786)  -> prop_arcade_idle @2
- prop_lanterns.png         2048×768  (4×512×768)  -> prop_lanterns_idle @2 (overhead)
- prop_neon_signs.png       1536×1024 (3 rows×4 cols, 384×341) -> sign_gesen/karaoke/ramen @3
- prop_power_pole.png       400×646   static
- prop_railing.png          343×300   static
- prop_cat_trashcan.png     350×427   static
- prop_crates.png           437×400   static
- prop_bicycle.png          450×396   static
- prop_sale_sign.png        303×500   static
