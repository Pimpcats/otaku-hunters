import Phaser from 'phaser';
import { Backdrop } from '../systems/backdrop';

// The distant skyline, on its OWN scene/camera so it never zooms with the gameplay
// camera (zooming bitmap parallax pixelates). Rendered BEHIND RunScene (earlier in the
// scene list); RunScene draws nothing above the floor seam, so this shows through.
//
// It draws the sky-gradient back wall + the parallax skyline, scrolled by RunScene's
// (zoomed, player-following) camera so the layers still drift with the player.
export class BackgroundScene extends Phaser.Scene {
  private sky?: Backdrop;

  constructor() {
    super('Background');
  }

  create() {
    const run = this.scene.get('Run');
    this.sky = new Backdrop(this, { layer: 'sky', source: run });
  }

  update() {
    this.sky?.update();
  }
}
