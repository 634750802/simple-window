import { EventEmitter } from 'eventemitter3';
import { bindDraggable, type DraggableTarget, type IDisposable } from './draggable.js';
import type { RectLayout } from './layouts/base.js';
import { type Edges, isSameRect, makeRect, type Rect, UNINITIALIZED_RECT, type Vector2 } from './rect.js';
import { getRequiredElement } from './utils.js';
import type { RectWindowCollection } from './windows.js';

type RectWindowVirtualBoundDOMElementEventsMap = {
  touchstart: TouchEvent;
  mousedown: MouseEvent;
  mouseenter: MouseEvent;
  mouseleave: MouseEvent;
  transitionend: TransitionEvent;
  transitioncancel: TransitionEvent;
}

export interface RectWindowVirtualBoundDOMElement extends Partial<Pick<HTMLElement, 'getAnimations' | 'animate' | 'cloneNode' | 'parentElement'>> {
  readonly dataset: DOMStringMap;
  style: Pick<CSSStyleDeclaration, 'width' | 'height' | 'position' | 'left' | 'top' | 'transform' | 'transition' | 'transformOrigin' | 'perspectiveOrigin' | 'zIndex'>;

  querySelector?<E extends DraggableTarget = DraggableTarget> (query: string): E | null;

  addEventListener?<K extends keyof RectWindowVirtualBoundDOMElementEventsMap> (eventName: K, cb: (event: RectWindowVirtualBoundDOMElementEventsMap[K]) => void): void;

  removeEventListener?<K extends keyof RectWindowVirtualBoundDOMElementEventsMap> (eventName: K, cb: (event: RectWindowVirtualBoundDOMElementEventsMap[K]) => void): void;
}

export interface RectWindowBindOptions {
  draggableTargets?: (DraggableTarget | string)[];
  leftEdge?: DraggableTarget | string;
  rightEdge?: DraggableTarget | string;
  bottomEdge?: DraggableTarget | string;
  bottomLeftCorner?: DraggableTarget | string;
  bottomRightCorner?: DraggableTarget | string;
}

export interface RectWindowCollectionEventsMap<Props> {
  'drag:start': [];
  'drag:move': [Vector2, Vector2];
  'drag:end': [];
  'destroy': [];
  'tap': [];
  'layout': [];
  'resize:left:start': [];
  'resize:left:move': [Vector2, Vector2];
  'resize:left:end': [];
  'resize:right:start': [];
  'resize:right:move': [Vector2, Vector2];
  'resize:right:end': [];
  'resize:bottom:start': [];
  'resize:bottom:move': [Vector2, Vector2];
  'resize:bottom:end': [];
  'resize:bottom-right:start': [];
  'resize:bottom-right:move': [Vector2, Vector2];
  'resize:bottom-right:end': [];
  'resize:bottom-left:start': [];
  'resize:bottom-left:move': [Vector2, Vector2];
  'resize:bottom-left:end': [];
  'animate:start': [Keyframe[]];
  'animate:end': [Keyframe[]];
}

export class RectWindow<Props> extends EventEmitter<RectWindowCollectionEventsMap<Props>> {
  private priority: number = 0;

  private bound: { el: RectWindowVirtualBoundDOMElement, disposables: IDisposable[] } | null = null;
  private _layout: RectLayout | undefined;
  private _animatingKeyframes: Keyframe[] | null = null;
  private _pendingAnimations: [keyframes: Keyframe[], effectTiming: Omit<EffectTiming, 'fill'>] | null = null;

  enterEffectTiming: Omit<EffectTiming, 'fill'> = {
    duration: 250,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };
  exitEffectTiming: Omit<EffectTiming, 'fill'> = {
    duration: 250,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };
  switchLayoutEffectTiming: Omit<EffectTiming, 'fill'> = {
    duration: 450,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };

  constructor (
    readonly parent: RectWindowCollection<Props>,
    readonly id: number,
    readonly key: string | undefined,
    public rect: Rect,
    public props: Props,
  ) {
    super();
    this._layout = undefined;
  }

  setLayout (layout: RectLayout | undefined, previousLayout?: RectLayout, previousKeyframe?: Keyframe) {
    previousKeyframe = previousKeyframe ?? (previousLayout ?? this.layout).captureKeyframe(this.rect);
    this._unbindLayout(previousLayout ?? this.layout);

    const nextLayout = layout ?? this.parent.layout;
    this._layout = layout === this.parent.layout ? undefined : layout;

    const suggestedRect = this._bindLayout(nextLayout);
    this.onReLayout(suggestedRect, previousKeyframe);
  }

  private _animate (keyframes: Keyframe[], effectTiming: Omit<EffectTiming, 'fill'>) {
    console.log(keyframes[0].left, keyframes[1].left);
    if (this._pendingAnimations) {
      this._pendingAnimations[0][1] = keyframes[keyframes.length - 1];
      this._pendingAnimations[1] = effectTiming;
      return;
    } else if (this._animatingKeyframes) {
      this._pendingAnimations = [[this._animatingKeyframes[this._animatingKeyframes.length - 1], keyframes[keyframes.length - 1]], effectTiming];
      return;
    }

    if (this.bound) {
      console.log('animate');
      const { el } = this.bound;
      const handleFinish = () => {
        this._animatingKeyframes = null;
        if (this._pendingAnimations) {
          console.log('continue pending', this._pendingAnimations);
          const args = this._pendingAnimations;
          this._pendingAnimations = null;
          const animated = RectWindow.animateElement(el, args[0], args[1], handleFinish);
          if (animated) {
            this._animatingKeyframes = args[0];
            return;
          }
        }
        this._animatingKeyframes = null;
        this.flush();
        this.emit('animate:end', keyframes);
        console.log('finish');
      };

      const animated = RectWindow.animateElement(el, keyframes, effectTiming, handleFinish);
      if (animated) {
        this._animatingKeyframes = keyframes;
        this.emit('animate:start', keyframes);
      }
    }
  }

  public static animateElement (element: RectWindowVirtualBoundDOMElement, keyframes: Keyframe[], effectTiming: Omit<EffectTiming, 'fill'>, onFinished: () => void) {
    const animation = element.animate?.(keyframes, {
      ...effectTiming,
      fill: 'auto',
    });

    if (!animation || animation.playState === 'finished') {
      onFinished();
      return false;
    } else {
      animation.addEventListener('finish', onFinished, { once: true });
      animation.addEventListener('cancel', onFinished, { once: true });
      return animation;
    }
  }

  public notifyPriorityChange (priority: number) {
    this.priority = priority;
    this.flushZIndex();
  }

  initialize () {
    this.parent.on('update:layout', this.onParentLayoutUpdate, this);
    this._bindLayout(this.layout);
    if (this.rect === UNINITIALIZED_RECT) {
      this.rect = makeRect(this.layout.initializeRect(this.id));
    }
  }

  onParentLayoutUpdate (newLayout: RectLayout, previousLayout: RectLayout) {
    if (!this._layout) {
      this.setLayout(newLayout, previousLayout, previousLayout.captureKeyframe(this.rect));
    }
  }

  onLayoutChange (animate?: boolean, effectTiming?: Omit<EffectTiming, 'fill'>, toExtends?: Partial<Keyframe>, fromKeyframes?: [Keyframe, ...Keyframe[]]) {
    const from = fromKeyframes ? [...fromKeyframes] : [this.captureKeyframe()];
    this.rect = this.layout.fitRect(this.rect);
    const to = {
      ...this.captureKeyframe(),
      ...toExtends,
    };
    if (animate || this._animatingKeyframes) {
      this._animate([...from, to], effectTiming ?? this.switchLayoutEffectTiming);
    } else {
      this.flush();
    }
    this.emit('layout');
  }

  onReLayout (suggestedRect?: Rect | undefined | null, from?: Keyframe) {
    from = from ?? this.captureKeyframe();
    this.rect = suggestedRect ? this.layout.fitRect(suggestedRect) : this.layout.fitRect(this.layout.initializeRect(this.id));
    const to = this.captureKeyframe();
    this._animate([from, to], this.switchLayoutEffectTiming);
    this.emit('layout');
  }

  destroy () {
    if (this.bound) {
      const parent = this.bound.el.parentElement;
      if (parent) {
        const cloned = this.bound.el.cloneNode?.(true);
        if (cloned) {
          parent.appendChild(cloned);
          const from = this.captureKeyframe();
          const to = this.layout.getExitKeyframe(this.rect);
          RectWindow.animateElement(cloned as never, [from, to], this.exitEffectTiming, () => {
            parent.removeChild(cloned);
          });
        }
      }
    }
    this.unbind();
    this.parent.off('update:layout', this.onParentLayoutUpdate, this);
    this._unbindLayout(this.layout, true);
    this.emit('destroy');
    this.removeAllListeners();
  }

  bind (el: RectWindowVirtualBoundDOMElement, options: RectWindowBindOptions = {}) {
    if (this.bound) {
      this.unbind();
    }
    const disposables: IDisposable[] = [];
    this.bound = { el, disposables };
    el.style.position = 'fixed';
    el.style.zIndex = String(this.priority + this.parent.zIndexBase);
    el.style.left = '0';
    el.style.top = '0';

    el.dataset.rect = 'true';

    const onTap = () => {
      this.emit('tap');
    };

    el.addEventListener?.('mousedown', onTap);
    el.addEventListener?.('touchstart', onTap);

    disposables.push(() => {
      el.removeEventListener?.('mousedown', onTap);
      el.removeEventListener?.('touchstart', onTap);
    });

    this.bindHandlers(options);

    const enterKeyframe = this.layout.getEnterKeyframe(this.layout.fitRect(this.rect));
    this.onLayoutChange(true, this.enterEffectTiming, { opacity: 1 }, [enterKeyframe]);
  }

  bindHandlers ({
    draggableTargets = ['[data-rect-draggable-handler]'],
    leftEdge = '[data-rect-draggable-edge="left"]',
    rightEdge = '[data-rect-draggable-edge="right"]',
    bottomEdge = '[data-rect-draggable-edge="bottom"]',
    bottomLeftCorner = '[data-rect-draggable-corner="bottom-left"]',
    bottomRightCorner = '[data-rect-draggable-corner="bottom-right"]',
  }: RectWindowBindOptions = {}) {
    const bound = this.bound;
    if (!bound) {
      return;
    }
    bound.disposables.filter(disposable => disposable.tag === 'draggable').forEach(fn => fn());
    bound.disposables = bound.disposables.filter(disposable => disposable.tag !== 'draggable');
    const { el, disposables } = bound;

    draggableTargets.forEach(query => {
      const target = getRequiredElement(el, query);
      if (target) {
        let start = this.rect;
        let lastRect = start;
        let lastKeyframe: Keyframe = this.layout.captureKeyframe(start);
        disposables.push(bindDraggable(
          target,
          window,
          'move',
          () => this.layout.allowMove,
          () => {
            el.dataset.dragging = 'true';
            this.emit('drag:start');
            this.emit('tap');
            start = this.rect;
            if (this.layout.allowTransitions) {
              lastRect = start;
              lastKeyframe = this.layout.captureKeyframe(lastRect);
            }
          },
          (offset, delta) => {
            const newRect = this.rect = this.layout.move(start, offset, offset);
            if (this.layout.allowTransitions && !isSameRect(lastRect, newRect)) {
              const keyframe = this.layout.captureKeyframe(newRect);
              this._animate([lastKeyframe, keyframe], this.layout.transitionEffectTiming);
              lastRect = newRect;
              lastKeyframe = keyframe;
            } else {
              this.flush();
            }
            this.emit('drag:move', offset, delta);
          },
          () => {
            delete el.dataset.dragging;
            this.emit('drag:end');
          },
        ));
      }
    });

    const cursors = {
      'left': 'col-resize',
      'right': 'col-resize',
      'bottom': 'row-resize',
      'bottom-left': 'nesw-resize',
      'bottom-right': 'nwse-resize',
    };

    const bindResizingHandler = (query: string | DraggableTarget, edgeOrCorner: 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right') => {
      const target = getRequiredElement(el, query);
      if (target) {
        let start = this.rect;
        let lastRect = start;
        let lastKeyframe: Keyframe = this.layout.captureKeyframe(start);
        disposables.push(bindDraggable(
          target,
          window,
          cursors[edgeOrCorner],
          () => this.layout.allowResize,
          () => {
            el.dataset.resizing = edgeOrCorner;
            this.emit(`resize:${edgeOrCorner}:start`);
            start = this.rect;
            if (this.layout.allowTransitions) {
              lastRect = start;
              lastKeyframe = this.layout.captureKeyframe(lastRect);
            }
          },
          (offset, delta) => {
            const newRect = this.rect = this.layout.resize(start, convertToResizeDeltaEdges(offset, edgeOrCorner));
            if (this.layout.allowTransitions && !isSameRect(lastRect, newRect)) {
              const keyframe = this.layout.captureKeyframe(newRect);
              this._animate([lastKeyframe, keyframe], this.layout.transitionEffectTiming);
              lastRect = newRect;
              lastKeyframe = keyframe;
            } else {
              this.flush();
            }
            this.emit(`resize:${edgeOrCorner}:move`, offset, delta);
          },
          () => {
            delete el.dataset.resizing;
            this.emit('resize:left:end');
          },
        ));
      }
    };

    bindResizingHandler(leftEdge, 'left');
    bindResizingHandler(rightEdge, 'right');
    bindResizingHandler(bottomEdge, 'bottom');
    bindResizingHandler(bottomLeftCorner, 'bottom-left');
    bindResizingHandler(bottomRightCorner, 'bottom-right');
  }

  get layout () {
    return this._layout ?? this.parent.layout;
  }

  unbind () {
    if (!this.bound) {
      return;
    }
    this.bound.disposables.forEach(dispose => dispose());
    this.bound = null;
  }

  flushZIndex () {
    if (!this.bound) {
      return;
    }
    const { el } = this.bound;
    el.style.zIndex = String(this.priority + this.parent.zIndexBase);
  }

  captureKeyframe (): Keyframe {
    return this.layout.captureKeyframe(this.rect);
  }

  flush () {
    const layout = this._layout ?? this.parent.layout;
    if (!this.bound) {
      return;
    }

    const { el } = this.bound;

    el.style.zIndex = String(this.priority + this.parent.zIndexBase);
    layout.renderRectToCSSStyleProperty(this.rect, el.style);
  }

  private _bindLayout (layout: RectLayout) {
    layout.addWindow(this);
    layout.on('update', this.onLayoutChange, this);
    layout.on('break', this.onReLayout, this);

    if (layout.allowRestore) {
      return layout.getStoredRect(this);
    }
    return undefined;
  }

  private _unbindLayout (layout: RectLayout, destroy = false) {
    if (layout.allowRestore) {
      layout.storeRect(this, this.rect);
    }
    layout.off('update', this.onLayoutChange, this);
    layout.off('break', this.onReLayout, this);
    layout.removeWindow(this);
  }
}

const convertToResizeDeltaEdges = (offset: Vector2, edgeOrCorner: 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'): Edges => {
  switch (edgeOrCorner) {
    case 'left':
      return {
        left: offset.x,
        right: 0,
        top: 0,
        bottom: 0,
      };
    case 'right':
      return {
        left: 0,
        right: offset.x,
        top: 0,
        bottom: 0,
      };
    case 'bottom':
      return {
        left: 0,
        right: 0,
        top: 0,
        bottom: offset.y,
      };
    case 'bottom-left':
      return {
        left: offset.x,
        right: 0,
        top: 0,
        bottom: offset.y,
      };
    case 'bottom-right':
      return {
        left: 0,
        right: offset.x,
        top: 0,
        bottom: offset.y,
      };
  }
};