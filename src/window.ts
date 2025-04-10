import { EventEmitter } from 'eventemitter3';
import { bindDraggable, type DraggableTarget, type IDisposable } from './draggable.js';
import type { RectLayout, RectLayoutTransitionProperties } from './layouts/base.js';
import { type Edges, type Rect, type Vector2 } from './rect.js';
import { getRequiredElement, renderTransitionProperties } from './utils.js';
import type { RectWindowCollection } from './windows.js';

type RectWindowVirtualBoundDOMElementEventsMap = {
  touchstart: TouchEvent;
  mousedown: MouseEvent;
  mouseenter: MouseEvent;
  mouseleave: MouseEvent;
  transitionend: TransitionEvent;
  transitioncancel: TransitionEvent;
}

export interface RectWindowVirtualBoundDOMElement extends Partial<Pick<HTMLElement, 'getAnimations'>> {
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
}

export class RectWindow<Props> extends EventEmitter<RectWindowCollectionEventsMap<Props>> {
  private priority: number = 0;

  private bound: { el: RectWindowVirtualBoundDOMElement, disposables: IDisposable[] } | null = null;
  private _layout: RectLayout | undefined;

  switchLayoutTransitions: RectLayoutTransitionProperties = {
    duration: 400,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    properties: ['transform', 'width', 'height'],
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

  setLayout (layout: RectLayout | undefined, previousLayout?: RectLayout) {
    previousLayout = previousLayout ?? this.layout;

    if (previousLayout.allowRestore) {
      previousLayout.storeRect(this, this.rect);
    }
    previousLayout.off('update', this.onLayoutChange, this);
    previousLayout.off('break', this.onReLayout, this);

    const nextLayout = layout ?? this.parent.layout;
    this._layout = layout === this.parent.layout ? undefined : layout;
    nextLayout.on('update', this.onLayoutChange, this);
    nextLayout.on('break', this.onReLayout, this);
    this.onReLayout(nextLayout.getStoredRect(this));
  }

  private _triggerSwitchTransition () {
    if (this.bound) {
      const { el } = this.bound;
      renderTransitionProperties(el.style, this.switchLayoutTransitions);
    }
  }

  private _postTriggerSwitchTransition () {
    if (this.bound) {
      const { el } = this.bound;

      const onTransitionEndOrCanceled = () => {
        el.style.transition = '';
        el.removeEventListener?.('transitioncancel', onTransitionEndOrCanceled);
        el.removeEventListener?.('transitionend', onTransitionEndOrCanceled);
      };

      const animations = el.getAnimations?.();
      if (animations && animations.length > 0) {
        const transitions = animations.filter(animation => animation instanceof CSSTransition);
        let total = 0;
        const onFinishOrCancel = () => {
          total--;
          if (total === 0) {
            onTransitionEndOrCanceled();
          }
        };
        for (let transition of transitions) {
          total++;

          transition.addEventListener('finish', onFinishOrCancel, { once: true });
          transition.addEventListener('cancel', onFinishOrCancel, { once: true });
        }
      }
    }
  }

  public notifyPriorityChange (priority: number) {
    this.priority = priority;
    this.flushZIndex();
  }

  initialize () {
    this.parent.on('update:layout', this.onParentLayoutUpdate, this);
    this.layout.on('update', this.onLayoutChange, this);
    this.layout.on('break', this.onReLayout, this);
  }

  onParentLayoutUpdate (newLayout: RectLayout, previousLayout: RectLayout) {
    if (!this._layout) {
      this.setLayout(newLayout, previousLayout);
    }
  }

  onLayoutChange () {
    this.rect = this.layout.fitRect(this.rect);
    this.flush();
    this.emit('layout');
  }

  onReLayout (suggestedRect?: Rect | undefined | null) {
    this.rect = suggestedRect ? this.layout.fitRect(suggestedRect) : this.layout.initializeRect(this.id);
    this._triggerSwitchTransition();
    this.flush();
    this._postTriggerSwitchTransition();
    this.emit('layout');
  }

  destroy () {
    this.unbind();
    this.parent.off('update:layout', this.onParentLayoutUpdate, this);
    this.layout.off('update', this.onLayoutChange, this);
    this.layout.off('break', this.onReLayout, this);
    this.emit('destroy');
    this.removeAllListeners();
  }

  bind (el: RectWindowVirtualBoundDOMElement, {
    draggableTargets = ['[data-rect-draggable-handler]'],
    leftEdge = '[data-rect-draggable-edge="left"]',
    rightEdge = '[data-rect-draggable-edge="right"]',
    bottomEdge = '[data-rect-draggable-edge="bottom"]',
    bottomLeftCorner = '[data-rect-draggable-corner="bottom-left"]',
    bottomRightCorner = '[data-rect-draggable-corner="bottom-right"]',
  }: RectWindowBindOptions = {}) {
    if (this.bound) {
      this.unbind();
    }
    const disposables: IDisposable[] = [];
    this.bound = { el, disposables };
    el.style.position = 'fixed';
    el.style.transformOrigin = '0% 0%';
    el.style.perspectiveOrigin = '50% 50%';
    el.style.zIndex = String(this.priority + this.parent.zIndexBase);
    el.style.left = '0';
    el.style.top = '0';

    el.dataset.rect = 'true';

    const layout = this._layout ?? this.parent.layout;
    if (layout.allowTransitions) {
      renderTransitionProperties(el.style, layout.transitions);
    } else {
      el.style.transition = '';
    }

    const onTap = () => {
      this.emit('tap');
    };

    el.addEventListener?.('mousedown', onTap);
    el.addEventListener?.('touchstart', onTap);

    disposables.push(() => {
      el.removeEventListener?.('mousedown', onTap);
      el.removeEventListener?.('touchstart', onTap);
    });

    draggableTargets.forEach(query => {
      const target = getRequiredElement(el, query);
      if (target) {
        let start = this.rect;
        disposables.push(bindDraggable(
          target,
          window,
          'move',
          () => this.layout.allowMove,
          () => {
            el.dataset.dragging = 'true';
            if (this.layout.allowTransitions) {
              renderTransitionProperties(el.style, this.layout.transitions);
            }
            this.emit('drag:start');
            this.emit('tap');
            start = this.rect;
          },
          (offset, delta) => {
            this.rect = this.layout.move(start, offset, offset);
            this.flush();
            this.emit('drag:move', offset, delta);
          },
          () => {
            delete el.dataset.dragging;
            if (this.layout.allowTransitions) {
              el.style.transition = '';
            }
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
        disposables.push(bindDraggable(
          target,
          window,
          cursors[edgeOrCorner],
          () => this.layout.allowResize,
          () => {
            el.dataset.resizing = edgeOrCorner;
            if (this.layout.allowTransitions) {
              renderTransitionProperties(el.style, this.layout.transitions);
            }
            this.emit(`resize:${edgeOrCorner}:start`);
            start = this.rect;
          },
          (offset, delta) => {
            this.rect = this.layout.resize(start, convertToResizeDeltaEdges(offset, edgeOrCorner));
            this.flush();
            this.emit(`resize:${edgeOrCorner}:move`, offset, delta);
          },
          () => {
            delete el.dataset.resizing;
            if (this.layout.allowTransitions) {
              el.style.transition = '';
            }
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

    this.onLayoutChange();
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

  flush () {
    const layout = this._layout ?? this.parent.layout;
    if (!this.bound) {
      return;
    }

    const { el } = this.bound;

    el.style.zIndex = String(this.priority + this.parent.zIndexBase);
    layout.renderRectToCSSStyleProperty(this.rect, el.style);
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