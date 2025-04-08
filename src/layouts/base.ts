import { EventEmitter } from 'eventemitter3';
import { type Edges, type Rect, type Vector2 } from '../rect.js';
import type { RectWindow } from '../window.js';

export interface RectLayoutEventsMap {
  /**
   * layout was changed smoothly (like changing constraint element's width)
   */
  'update': [];
  /**
   * layout was changed like re-layout
   */
  'break': [];

  'swap': [number, number];
}

export interface RectLayoutTransitionProperties {
  duration: number; //ms
  easing: string;
  properties: string[];
}

export class RectLayout extends EventEmitter<RectLayoutEventsMap> {
  allowMove = true;
  allowResize = true;
  allowTransitions = false;
  allowRestore = false;

  readonly restoredRects: WeakMap<RectWindow<any>, Rect> = new Map();

  transitions: RectLayoutTransitionProperties = {
    duration: 400,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: ['transform', 'width', 'height'],
  };

  _rectPaddingPixels: Edges = { top: 0, left: 0, right: 0, bottom: 0 };

  move (rect: Rect, offset: Vector2, direction: Vector2): Rect {
    return {
      x: rect.x + offset.x,
      y: rect.y + offset.y,
      width: rect.width,
      height: rect.height,
    };
  }

  resize (rect: Rect, edges: Edges): Rect {
    return {
      x: rect.x + edges.left,
      y: rect.y + edges.top,
      width: rect.width - edges.left + edges.right,
      height: rect.height - edges.top + edges.bottom,
    };
  };

  fitRect (rect: Rect): Rect {
    return rect;
  }

  initializeRect (id: number): Rect {
    return {
      x: 36 * id,
      y: 36 * id,
      width: 100,
      height: 100,
    };
  }

  /**
   * Some layout (like grid) does not need the pixel level coordinates. This method is used to transform from virtual rect to dom rect data
   * @param rect
   */
  toRectInPixels (rect: Rect): Rect {
    return {
      x: rect.x + this._rectPaddingPixels.left,
      y: rect.y + this._rectPaddingPixels.top,
      width: rect.width - this._rectPaddingPixels.left - this._rectPaddingPixels.right,
      height: rect.height - this._rectPaddingPixels.top - this._rectPaddingPixels.bottom,
    };
  }

  setRectPaddingPixels (padding: Edges) {
    this._rectPaddingPixels = padding;
    this.emit('update');
    return this;
  }

  renderTransitionProperties (style: Pick<CSSStyleDeclaration, 'transition'>) {
    const { duration, easing, properties } = this.transitions;
    style.transition = `${properties.map(t => `${t} ${duration}ms ${easing}`).join(', ')}`;
  }

  renderRectToCSSStyleProperty (rect: Rect, style: Pick<CSSStyleDeclaration, 'width' | 'height' | 'transform' | 'zIndex'>) {
    const { x, y, width, height } = this.toRectInPixels(rect);
    style.width = `${width}px`;
    style.height = `${height}px`;
    style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}
