// In-game building placement editor (dev tool). Toggle with E.
//
// Workflow: press E → a tray of every building appears along the bottom. Click a tray item
// to pick it, then click the world to place it. Click+drag any placed building to move it;
// arrow keys nudge the selected one (1px, or 10px with Shift); [ and ] rotate it (1°, or 15°
// with Shift). Delete removes it. P prints every building as a JSON array
// ([{key,x,y,scale,angle}, …]) to the console for pasting into the scene code. E again exits
// and locks positions.
//
// Buildings are screen-space (scrollFactor 0) at camera zoom 1.0, so their x/y ARE the screen
// coordinates you place them at — paste straight into buildStreet().

import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { ALL_BUILDINGS } from '../data/buildings';

const UI_DEPTH = 1_000_000; // editor overlays sit above everything
const TRAY_H = 96;
const THUMB_H = 58;

export class BuildingEditor {
  active = false;
  private brushKey: string | null = null;
  private selected?: Phaser.GameObjects.Image;
  private tray?: Phaser.GameObjects.Container;
  private brushCells = new Map<string, Phaser.GameObjects.Rectangle>(); // tray highlight per key
  private hud?: Phaser.GameObjects.Text;
  private ring?: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private buildings: Phaser.GameObjects.Image[],
    private spawn: (key: string, x: number, y: number) => Phaser.GameObjects.Image,
  ) {
    const kb = scene.input.keyboard;
    kb?.on('keydown-E', () => this.toggle());
    kb?.on('keydown-P', () => this.active && this.printJSON());
    kb?.on('keydown-DELETE', () => this.active && this.deleteSelected());
    kb?.on('keydown-BACKSPACE', () => this.active && this.deleteSelected());
    kb?.on('keydown-LEFT', (e: KeyboardEvent) => this.nudge(-1, 0, e));
    kb?.on('keydown-RIGHT', (e: KeyboardEvent) => this.nudge(1, 0, e));
    kb?.on('keydown-UP', (e: KeyboardEvent) => this.nudge(0, -1, e));
    kb?.on('keydown-DOWN', (e: KeyboardEvent) => this.nudge(0, 1, e));
    kb?.on('keydown-OPEN_BRACKET', (e: KeyboardEvent) => this.rotate(-1, e));
    kb?.on('keydown-CLOSED_BRACKET', (e: KeyboardEvent) => this.rotate(1, e));

    // Click empty world (with a brush picked) → place; clicks ON a building/tray are handled
    // by their own interactivity and skipped here (currentlyOver non-empty).
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.active || over.length > 0 || !this.brushKey) return;
      if (p.y > H - TRAY_H) return; // tray strip
      this.select(this.spawnInteractive(this.brushKey, Math.round(p.x), Math.round(p.y)));
    });
    scene.input.on(Phaser.Input.Events.DRAG, (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dx: number, dy: number) => {
      if (!this.active || !(obj instanceof Phaser.GameObjects.Image)) return;
      obj.setPosition(Math.round(dx), Math.round(dy)).setDepth(Math.round(dy));
      this.select(obj);
    });
  }

  private toggle() {
    this.active ? this.exit() : this.enter();
  }

  private enter() {
    this.active = true;
    for (const b of this.buildings) this.makeInteractive(b);
    this.buildTray();
    this.ring = this.scene.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH + 1);
    this.hud = this.scene.add
      .text(8, 78, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9effa0', backgroundColor: '#000000aa' })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 2)
      .setPadding(4);
    this.refreshHud();
  }

  private exit() {
    this.active = false;
    for (const b of this.buildings) b.disableInteractive();
    this.tray?.destroy();
    this.tray = undefined;
    this.brushCells.clear();
    this.ring?.destroy();
    this.ring = undefined;
    this.hud?.destroy();
    this.hud = undefined;
    this.brushKey = null;
    this.selected = undefined;
  }

  /** Tray of every building along the bottom; click a thumbnail to pick the brush. */
  private buildTray() {
    const tray = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(UI_DEPTH);
    tray.add(this.scene.add.rectangle(0, H - TRAY_H, W, TRAY_H, 0x05030f, 0.92).setOrigin(0, 0));
    tray.add(
      this.scene.add
        .text(8, H - TRAY_H + 2, 'EDITOR  ·  click tile → click world to place  ·  drag move  ·  arrows nudge (⇧×10)  ·  [ ] rotate  ·  Del remove  ·  P export  ·  E exit', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#8aa0c8',
        })
        .setOrigin(0, 0),
    );
    const present = ALL_BUILDINGS.filter((k) => this.scene.textures.exists(k));
    const step = W / present.length;
    present.forEach((key, i) => {
      const cx = i * step + step / 2;
      const cy = H - TRAY_H / 2 + 6;
      const cell = this.scene.add.rectangle(cx, cy, step - 6, TRAY_H - 18, 0x1a1340, 0).setStrokeStyle(2, 0x00eaff, 0);
      tray.add(cell);
      this.brushCells.set(key, cell);
      const src = this.scene.textures.get(key).getSourceImage() as { height: number };
      const thumb = this.scene.add.image(cx, cy, key).setScale(THUMB_H / (src.height || THUMB_H)); // keep aspect via height
      thumb.setInteractive({ useHandCursor: true });
      thumb.on('pointerdown', () => this.pickBrush(key));
      tray.add(thumb);
      tray.add(
        this.scene.add.text(cx, H - 14, key.replace(/_/g, ' '), { fontFamily: 'monospace', fontSize: '9px', color: '#cfd6f5' }).setOrigin(0.5, 0),
      );
    });
    this.tray = tray;
  }

  private pickBrush(key: string) {
    this.brushKey = key;
    for (const [k, cell] of this.brushCells) cell.setStrokeStyle(2, 0x00eaff, k === key ? 1 : 0);
    this.refreshHud();
  }

  private spawnInteractive(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const img = this.spawn(key, x, y);
    this.makeInteractive(img);
    return img;
  }

  /** Make a building draggable + click-selectable while the editor is open. */
  makeInteractive(img: Phaser.GameObjects.Image) {
    img.setInteractive({ draggable: true, useHandCursor: true });
    this.scene.input.setDraggable(img);
    img.on('pointerdown', () => this.select(img));
  }

  private select(img: Phaser.GameObjects.Image) {
    this.selected = img;
    this.refreshHud();
  }

  private nudge(dx: number, dy: number, e: KeyboardEvent) {
    if (!this.active || !this.selected) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    this.selected.setPosition(this.selected.x + dx * step, this.selected.y + dy * step).setDepth(this.selected.y + dy * step);
    this.refreshHud();
  }

  private rotate(dir: number, e: KeyboardEvent) {
    if (!this.active || !this.selected) return;
    e.preventDefault();
    this.selected.angle += dir * (e.shiftKey ? 15 : 1);
    this.refreshHud();
  }

  private deleteSelected() {
    if (!this.selected) return;
    const i = this.buildings.indexOf(this.selected);
    if (i >= 0) this.buildings.splice(i, 1);
    this.selected.destroy();
    this.selected = undefined;
    this.refreshHud();
  }

  private printJSON() {
    const arr = this.buildings.map((b) => ({
      key: b.getData('key') as string,
      x: Math.round(b.x),
      y: Math.round(b.y),
      scale: Math.round(b.scaleX * 1000) / 1000,
      angle: Math.round(b.angle),
    }));
    // eslint-disable-next-line no-console
    console.log('[BuildingEditor] positions:\n' + JSON.stringify(arr));
    if (this.hud) {
      const old = this.hud.text;
      this.hud.setText(old + '\n→ printed ' + arr.length + ' to console (F12)');
      this.scene.time.delayedCall(1500, () => this.refreshHud());
    }
  }

  private refreshHud() {
    if (!this.hud) return;
    const s = this.selected;
    const sel = s
      ? `sel ${s.getData('key')}  x:${Math.round(s.x)} y:${Math.round(s.y)}  s:${(s.scaleX).toFixed(2)}  a:${Math.round(s.angle)}°`
      : 'sel —';
    this.hud.setText(`EDITOR  brush:${this.brushKey ?? '—'}\n${sel}`);
    const g = this.ring;
    if (g) {
      g.clear();
      if (s) {
        g.lineStyle(2, 0x00eaff, 0.9);
        const w = s.displayWidth;
        const h = s.displayHeight;
        g.strokeRect(s.x - w / 2, s.y - h, w, h); // origin is bottom-center
      }
    }
  }
}
