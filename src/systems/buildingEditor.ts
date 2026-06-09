// In-game building placement editor (dev tool). Toggle with E.
//
// Workflow: press E → a tray of every building appears along the bottom. DRAG a tray item
// straight into the world to place it (a ghost follows the pointer; release above the tray
// to drop, over the tray to cancel). Click+drag any placed building to move it; RIGHT-click
// + drag horizontally to rotate it (or [ and ] keys: 1°, 15° with Shift); arrow keys nudge
// the selected one (1px, or 10px with Shift). Delete removes it. P prints every building as
// a JSON array ([{key,x,y,scale,angle}, …]) to the console for pasting into the scene code.
// E again exits and locks positions.
//
// Buildings are screen-space (scrollFactor 0) at camera zoom 1.0, so their x/y ARE the screen
// coordinates you place them at — paste straight into buildStreet().

import Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../constants';
import { ALL_BUILDINGS, buildingScale } from '../data/buildings';

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
  private ghost?: Phaser.GameObjects.Image; // tray-drag preview following the pointer
  private rotating?: { img: Phaser.GameObjects.Image; startAngle: number; startX: number };
  private exportPanel?: HTMLDivElement; // on-screen copyable JSON export (no F12 needed)

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

    // Dragging a TRAY thumbnail spawns a ghost that follows the pointer; release above the
    // tray to place it, over the tray to cancel. The thumbnail itself never moves.
    scene.input.on(Phaser.Input.Events.DRAG_START, (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (!this.active) return;
      const key = obj.getData?.('trayKey') as string | undefined;
      if (!key) return;
      this.ghost = scene.add
        .image(p.x, p.y, key)
        .setOrigin(0.5, 1)
        .setScale(buildingScale(key))
        .setAlpha(0.7)
        .setScrollFactor(0)
        .setDepth(UI_DEPTH + 3);
      this.ghost.setData('key', key);
      this.pickBrush(key);
    });
    scene.input.on(Phaser.Input.Events.DRAG, (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dx: number, dy: number) => {
      if (!this.active || !(obj instanceof Phaser.GameObjects.Image)) return;
      if (obj.getData('trayKey')) {
        this.ghost?.setPosition(Math.round(p.x), Math.round(p.y));
        return;
      }
      if (this.rotating) return; // right-button drag = rotate, not move
      obj.setPosition(Math.round(dx), Math.round(dy)).setDepth(Math.round(dy));
      this.select(obj);
    });
    scene.input.on(Phaser.Input.Events.DRAG_END, (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (!this.active) return;
      const key = obj.getData?.('trayKey') as string | undefined;
      if (!key) return;
      this.ghost?.destroy();
      this.ghost = undefined;
      if (p.y < H - TRAY_H) this.select(this.spawnInteractive(key, Math.round(p.x), Math.round(p.y)));
    });

    // RIGHT-click + horizontal drag on a building = rotate (¼° per pixel).
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!this.active || !this.rotating) return;
      if (!p.rightButtonDown()) {
        this.rotating = undefined;
        return;
      }
      this.rotating.img.angle = this.rotating.startAngle + (p.x - this.rotating.startX) * 0.25;
      this.refreshHud();
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, () => (this.rotating = undefined));
  }

  private toggle() {
    this.active ? this.exit() : this.enter();
  }

  private enter() {
    this.active = true;
    this.scene.input.mouse?.disableContextMenu(); // right-click is rotate, not browser menu
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
    this.ghost?.destroy();
    this.ghost = undefined;
    this.rotating = undefined;
    this.closeExportPanel();
    this.brushKey = null;
    this.selected = undefined;
  }

  /** Tray of every building along the bottom; click a thumbnail to pick the brush. */
  private buildTray() {
    const tray = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(UI_DEPTH);
    tray.add(this.scene.add.rectangle(0, H - TRAY_H, W, TRAY_H, 0x05030f, 0.92).setOrigin(0, 0));
    tray.add(
      this.scene.add
        .text(8, H - TRAY_H + 2, 'EDITOR  ·  drag tile into world  ·  drag move  ·  right-drag rotate (or [ ])  ·  arrows nudge (⇧×10)  ·  Del remove  ·  P / EXPORT → copy JSON  ·  E exit', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#8aa0c8',
        })
        .setOrigin(0, 0),
    );
    // On-screen EXPORT button (top-right of the tray strip) — same as pressing P.
    const btn = this.scene.add
      .text(W - 8, H - TRAY_H + 2, ' EXPORT ', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#06121a',
        backgroundColor: '#00eaff',
      })
      .setOrigin(1, 0)
      .setPadding(6, 3, 6, 3)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.printJSON());
    tray.add(btn);
    const present = ALL_BUILDINGS.filter((k) => this.scene.textures.exists(k));
    const step = W / present.length;
    present.forEach((key, i) => {
      const cx = i * step + step / 2;
      const cy = H - TRAY_H / 2 + 6;
      const cell = this.scene.add.rectangle(cx, cy, step - 6, TRAY_H - 18, 0x1a1340, 0).setStrokeStyle(2, 0x00eaff, 0);
      tray.add(cell);
      this.brushCells.set(key, cell);
      const src = this.scene.textures.get(key).getSourceImage() as { width: number; height: number };
      const fit = Math.min((step - 12) / (src.width || 1), THUMB_H / (src.height || 1)); // fit cell, keep aspect
      const thumb = this.scene.add.image(cx, cy, key).setScale(fit);
      thumb.setData('trayKey', key);
      thumb.setInteractive({ draggable: true, useHandCursor: true });
      this.scene.input.setDraggable(thumb);
      thumb.on('pointerdown', () => this.pickBrush(key)); // click still arms the brush (click-world to place)
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

  /** Make a building draggable + click-selectable (right-click starts a rotate-drag). */
  makeInteractive(img: Phaser.GameObjects.Image) {
    img.setInteractive({ draggable: true, useHandCursor: true });
    this.scene.input.setDraggable(img);
    img.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.select(img);
      if (p.rightButtonDown()) this.rotating = { img, startAngle: img.angle, startX: p.x };
    });
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
    const json = JSON.stringify(arr, null, 2);
    // eslint-disable-next-line no-console
    console.log('[BuildingEditor] positions:\n' + json); // also to console as a backup
    this.showExportPanel(json, arr.length);
  }

  /** Pop an on-screen, copyable JSON panel over the canvas — no dev console needed. */
  private showExportPanel(json: string, count: number) {
    this.closeExportPanel();
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(2,3,12,0.72);font-family:monospace;';
    const card = document.createElement('div');
    card.style.cssText =
      'width:min(640px,92vw);max-height:84vh;display:flex;flex-direction:column;gap:8px;padding:14px;' +
      'background:#0a0a18;border:2px solid #00eaff;border-radius:8px;box-shadow:0 0 24px #00eaff66;';
    const title = document.createElement('div');
    title.textContent = `Building layout — ${count} placed`;
    title.style.cssText = 'color:#9effa0;font-size:13px;';
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.readOnly = true;
    ta.style.cssText =
      'flex:1;min-height:240px;resize:vertical;background:#05050f;color:#cfe9ff;border:1px solid #234;' +
      'border-radius:4px;padding:8px;font-family:monospace;font-size:12px;white-space:pre;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    const mkBtn = (label: string, bg: string, fg: string) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `padding:7px 14px;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-size:12px;background:${bg};color:${fg};`;
      return b;
    };
    const copy = mkBtn('Copy', '#00eaff', '#06121a');
    copy.onclick = () => {
      ta.select();
      navigator.clipboard?.writeText(json).then(
        () => (copy.textContent = 'Copied ✓'),
        () => document.execCommand('copy') && (copy.textContent = 'Copied ✓'),
      );
    };
    const close = mkBtn('Close', '#26304a', '#cfe9ff');
    close.onclick = () => this.closeExportPanel();
    row.append(copy, close);
    card.append(title, ta, row);
    panel.append(card);
    panel.addEventListener('pointerdown', (e) => {
      if (e.target === panel) this.closeExportPanel(); // click backdrop to dismiss
    });
    document.body.append(panel);
    ta.focus();
    ta.select();
    this.exportPanel = panel;
  }

  private closeExportPanel() {
    this.exportPanel?.remove();
    this.exportPanel = undefined;
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
