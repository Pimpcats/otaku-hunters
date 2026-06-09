import Phaser from 'phaser';
import { Hud } from '../ui/hud';
import { Atmosphere } from '../ui/atmosphere';

// The run HUD + the baked vignette/grade overlay, on their OWN scene/camera so they
// stay SCREEN-SCALE regardless of the gameplay camera's zoom (a scrollFactor-0 HUD on
// the zoomed camera would scale and drift). Rendered IN FRONT of RunScene (later in the
// scene list); the modal LevelUp/Pause scenes sit in front of this.
//
// The bloom/saturate camera post-FX stays on RunScene's camera (it must glow the zoomed
// world); only the screen-space overlay lives here.
export class HudScene extends Phaser.Scene {
  hud?: Hud;

  constructor() {
    super('Hud');
  }

  create() {
    this.hud = new Hud(this);
    new Atmosphere(this, { overlay: true, glow: false }); // overlay only; glow is on RunScene's camera
  }
}
