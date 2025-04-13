import type { Rect } from '../rect.js';
import { RectLayout } from './base.js';

export class DialogLayout extends RectLayout {
  allowMove = false;
  allowResize = false;
  allowTransitions = false;

  constructor () {
    super();
    const onResize = () => {
      this.emit('update');
    };
    window.addEventListener('resize', onResize, { passive: true });
  }

  initializeRect (): Rect {
    let width = Math.min(1280, window.innerWidth - 48);
    let height = Math.min(720, window.innerHeight - 48);
    return {
      x: (window.innerWidth - width) / 2,
      y: (window.innerHeight - height) / 2,
      width: width,
      height: height,
    };
  }

  fitRect (rect: Rect): Rect {
    return this.initializeRect();
  }

  renderRectToCSSStyleProperty (rect: Rect, style: Pick<CSSStyleDeclaration, 'left' | 'top' | 'width' | 'height' | 'transform' | 'transformOrigin' | 'zIndex'>) {
    super.renderRectToCSSStyleProperty(rect, style);
    style.zIndex = '1000';
  }
}
