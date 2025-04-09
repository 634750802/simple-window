import { EventEmitter } from 'eventemitter3';
import { type Edges, padding, type Rect, type Vector2 } from '../rect.js';
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
  allowRestore = true;

  private readonly restoredRects: WeakMap<RectWindow<any>, Rect> = new Map();

  public readonly transitions: RectLayoutTransitionProperties = {
    duration: 200,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: ['transform', 'width', 'height'],
  };

  constructor () {
    super();
  }

  storeRect (window: RectWindow<any>, rect: Rect) {
    if (this.allowRestore) {
      console.log('set', this.constructor.name, window.id, rect);
      this.restoredRects.set(window, rect);
    }
  }

  getStoredRect (window: RectWindow<any>) {
    if (!this.allowRestore) {
      return undefined;
    }
    const rect = this.restoredRects.get(window);
    console.log('get', this.constructor.name, window.id, rect);
    this.restoredRects.delete(window);
    return rect;
  }

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
    return padding(rect, this._rectPaddingPixels);
  }

  setRectPaddingPixels (padding: Edges) {
    this._rectPaddingPixels = padding;
    this.emit('update');
    return this;
  }

  renderRectToCSSStyleProperty (rect: Rect, style: Pick<CSSStyleDeclaration, 'width' | 'height' | 'transform' | 'zIndex'>) {
    const { x, y, width, height } = this.toRectInPixels(rect);
    style.width = `${width}px`;
    style.height = `${height}px`;
    style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}
