import { EventEmitter } from 'eventemitter3';
import { applyCaptureKeyframeMutations, type CaptureKeyframeMutation } from '../animation.js';
import { type Edges, padding, type Rect, type Vector2 } from '../rect.js';
import type { RectWindow } from '../window.js';

export interface RectLayoutEventsMap {
  /**
   * layout was changed smoothly (like changing constraint element's width)
   */
  'update': [triggerSwitchTransition?: boolean];
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

export interface RectLayoutVirtualProperties {
  left: CSSUnitValue,
  top: CSSUnitValue,
  width: CSSUnitValue;
  height: CSSUnitValue,
  transform: DOMMatrix
  transformOrigin: [string, string];
}

export class RectLayout extends EventEmitter<RectLayoutEventsMap> {
  allowMove = true;
  allowResize = true;
  allowTransitions = false;
  allowRestore = true;

  private _storedRects: WeakMap<RectWindow<any>, Rect> = new Map();
  protected readonly _windows: Map<number, RectWindow<any>> = new Map();
  protected _activeWindows: number[] = [];

  public readonly transitionEffectTiming: Omit<EffectTiming, 'fill'> = {
    duration: 200,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };

  constructor () {
    super();
  }

  get activeWindows () {
    return this._activeWindows.map(id => this._windows.get(id))?.filter(Boolean) as RectWindow<any>[];
  }

  setRectPaddingPixels (padding: Edges) {
    this._rectPaddingPixels = padding;
    this.emit('update');
    return this;
  }

  cleanupStoredRects () {
    this._storedRects = new WeakMap();
  }

  storeRect (window: RectWindow<any>, rect: Rect) {
    if (this.allowRestore) {
      this._storedRects.set(window, rect);
    }
  }

  getStoredRect (window: RectWindow<any>) {
    if (!this.allowRestore) {
      return undefined;
    }
    const rect = this._storedRects.get(window);
    this._storedRects.delete(window);
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
    return this.initializeRectByIndex(this.getWindowIndex(id));
  }

  protected getWindowIndex (id: number) {
    let index = this._activeWindows.indexOf(id);
    if (index === -1) {
      index = this._activeWindows.length;
    }
    return index;
  }

  protected initializeRectByIndex (index: number) {
    return {
      x: 36 * index,
      y: 36 * index,
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

  rectInPixelsToVirtualProperties (rect: Rect): RectLayoutVirtualProperties {
    const { x, y, width, height } = rect;
    return {
      width: CSS.px(width),
      height: CSS.px(height),
      transform: new DOMMatrix(),
      left: CSS.px(x),
      top: CSS.px(y),
      transformOrigin: ['center', 'center'],
    };
  }

  renderRectToCSSStyleProperty (rect: Rect, style: Pick<CSSStyleDeclaration, 'left' | 'top' | 'width' | 'height' | 'transform' | 'transformOrigin' | 'zIndex'>) {
    const virtualProperties = this.rectInPixelsToVirtualProperties(this.toRectInPixels(rect));
    style.width = virtualProperties.width.toString();
    style.height = virtualProperties.height.toString();
    style.transform = virtualProperties.transform.toString();
    style.left = virtualProperties.left.toString();
    style.top = virtualProperties.top.toString();
    style.transformOrigin = virtualProperties.transformOrigin.join(' ');
  }

  captureKeyframe (rect: Rect, mutation?: CaptureKeyframeMutation): Omit<Keyframe, 'composite' | 'offset' | 'easing'> {
    return applyCaptureKeyframeMutations(this.rectInPixelsToVirtualProperties(this.toRectInPixels(rect)), mutation);
  }

  addWindow (window: RectWindow<any>) {
    this._activeWindows.push(window.id);
    this._windows.set(window.id, window);
  }

  removeWindow (window: RectWindow<any>) {
    this._activeWindows = this._activeWindows.filter(id => id !== window.id);
    this._windows.delete(window.id);
  }

  getEnterKeyframe (rect: Rect) {
    const keyframe = this.captureKeyframe(rect, new DOMMatrix().scale3dSelf(0.7, 0, 0, 0));
    keyframe.opacity = 0;
    return keyframe;
  }

  getExitKeyframe (rect: Rect) {
    const keyframe = this.captureKeyframe(rect, new DOMMatrix().scale3dSelf(0.7, 0, 0, 0));
    keyframe.opacity = 0;
    return keyframe;
  }
}
