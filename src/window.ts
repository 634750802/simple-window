import { EventEmitter } from 'eventemitter3';
import { bindDraggable, type DraggableTarget, type IDisposable } from './draggable.js';
import type { RectLayout } from './layouts/base.js';
import { isConstraintLayout } from './layouts/constraint.js';
import { type Edges, makeEdge, makeRect, type Rect, type Vector2 } from './rect.js';
import { getRequiredElement } from './utils.js';

export interface NewWindowOptions<Props> {
  key?: string;
  rect?: Rect;
  props: Props;
}

export interface RectWindowCollectionOptions<Props> {
  defaultConstraintPadding: Edges;
  zIndexBase?: number;
  layout: RectLayout;
}

export interface RectWindowCollectionEventsMap<Props> {
  'window:new': [RectWindow<Props>, id: number, key: string | undefined];
  'window:add': [RectWindow<Props>];
  'window:remove': [RectWindow<Props>];
  'update:layout': [RectLayout];
}

export class RectWindowCollection<Props> extends EventEmitter<RectWindowCollectionEventsMap<Props>> {
  private readonly windows: Map<number | string, RectWindow<Props>> = new Map();
  private windowsPriority: RectWindow<Props>[] = [];
  private defaultConstraintPadding: Edges;
  readonly zIndexBase: number;
  private _layout: RectLayout;

  private _constraintElement: Element | null = null;
  private _constraintElementResizeObserver: ResizeObserver | null = null;

  constructor ({
    defaultConstraintPadding = makeEdge({ left: 8, right: 8, top: 8, bottom: 8 }),
    zIndexBase = 20,
    layout,
  }: RectWindowCollectionOptions<Props>) {
    super();
    this.defaultConstraintPadding = defaultConstraintPadding;
    this.zIndexBase = zIndexBase;
    this._layout = layout;
    if (isConstraintLayout(layout)) {
      layout.setConstraintRect(this.getDefaultConstraint(), true);
    }
  }

  getWindow (idOrKey: number | string): RectWindow<Props> | undefined {
    return this.windows.get(idOrKey);
  }

  get layout (): RectLayout {
    return this._layout;
  }

  set layout (layout: RectLayout) {
    this._layout.removeAllListeners();
    this._layout = layout;
    if (isConstraintLayout(layout) && this._constraintElement) {
      layout.setConstraintRect(makeRect(this._constraintElement.getBoundingClientRect()), true);
    }
    this.emit('update:layout', layout);
  }

  get constraintElement (): Element | null {
    return this._constraintElement;
  }

  transfer (window: RectWindow<Props>, target: RectWindowCollection<Props>) {
    if (target === this) {
      return;
    }
    if (!this.windows.has(window.id)) {
      console.warn('window not owned by this collection');
      return;
    }
    this.windows.delete(window.id);
    this.windowsPriority = this.windowsPriority.filter(item => item !== window);
    this.notifyPriorityChanges();
    this.emit('window:remove', window);

    window._transferTo(target);

    target.windows.set(window.key ?? window.id, window);
    target.windowsPriority.push(window);
    target.notifyPriorityChanges();
    target.emit('window:add', window);
  }

  getDefaultConstraint (padding: Edges = this.defaultConstraintPadding) {
    return makeRect({
      x: padding.left,
      y: padding.top,
      width: window.innerWidth - padding.left - padding.right,
      height: window.innerHeight - padding.top - padding.bottom,
    });
  }

  newWindow ({ key, rect, props }: NewWindowOptions<Props>) {
    const id = this.windowsPriority.reduce((id, w) => Math.max(w.id, id), -1) + 1;
    const window = new RectWindow(this, id, key, rect ?? makeRect(this.layout.initializeRect(id)), props);
    this.windows.set(key || id, window);
    this.windowsPriority.push(window);
    window.initialize();
    window.once('destroy', () => {
      this.windows.delete(key || id);
      this.windowsPriority = this.windowsPriority.filter(item => window !== item);
      this.notifyPriorityChanges();
    });

    window.on('tap', () => {
      this.windowsPriority = this.windowsPriority.filter(item => item !== window).concat(window);
      this.notifyPriorityChanges();
    });

    const layout = this.layout;

    return window;
  }

  triggerConstraintElementUpdate () {
    if (isConstraintLayout(this._layout)) {
      if (this._constraintElement) {
        this._layout.setConstraintRect(makeRect(this._constraintElement.getBoundingClientRect()));
      } else {
        this._layout.setConstraintRect(this.getDefaultConstraint());
      }
    }

  }

  watchWindowResize () {
    window.addEventListener('resize', () => this.triggerConstraintElementUpdate(), { passive: true });
  }

  bindConstraintElement (element: Element) {
    if (this._constraintElement) {
      this.unbindConstraintElement(false);
    }

    this._constraintElement = element;
    const ro = this._constraintElementResizeObserver = new ResizeObserver(() => {
      this.triggerConstraintElementUpdate();
    });
    ro.observe(element);

    this.triggerConstraintElementUpdate();
  }

  unbindConstraintElement (updateConstraint = true) {
    if (this._constraintElement) {
      this._constraintElementResizeObserver?.disconnect();
      this._constraintElementResizeObserver = null;
      this._constraintElement = null;
      if (updateConstraint) {
        if (isConstraintLayout(this._layout)) {
          this._layout.setConstraintRect(this.getDefaultConstraint(), true);
        }
      }
    }
  }

  notifyPriorityChanges () {
    this.windowsPriority.forEach((window, index) => window.notifyPriorityChange(index + 1));
  }
}

type RectWindowVirtualBoundDOMElementEventsMap = {
  touchstart: TouchEvent;
  mousedown: MouseEvent;
  mouseenter: MouseEvent;
  mouseleave: MouseEvent;
  transitionend: TransitionEvent;
  transitioncancel: TransitionEvent;
}

export interface RectWindowVirtualBoundDOMElement {
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

  constructor (
    private parent: RectWindowCollection<Props>,
    readonly id: number,
    readonly key: string | undefined,
    public rect: Rect,
    public props: Props,
  ) {
    super();
    this._layout = undefined;
  }

  _transferTo (collection: RectWindowCollection<Props>) {
    this.parent = collection;
    this.onReLayout();
  }

  setLayout (layout: RectLayout | undefined) {
    const rect = this.rect;
    const previousLayout = this.layout;
    this._layout = layout === undefined ? this.parent.layout : layout === this.parent.layout ? undefined : layout;
    const nextLayout = this._layout ?? this.parent.layout;
    nextLayout.on('update', this.onLayoutChange, this);
    nextLayout.on('break', this.onReLayout, this);
    if (previousLayout.allowRestore) {
      previousLayout.restoredRects.set(this, rect);
    }
    if (this.bound) {
      const { el } = this.bound;
      nextLayout.renderTransitionProperties(el.style);

      const onTransitionEndOrCanceled = () => {
        if (nextLayout.allowTransitions) {
          nextLayout.renderTransitionProperties(el.style);
        } else {
          el.style.transition = '';
        }
        el.removeEventListener?.('transitioncancel', onTransitionEndOrCanceled);
        el.removeEventListener?.('transitionend', onTransitionEndOrCanceled);
      };

      el.addEventListener?.('transitioncancel', onTransitionEndOrCanceled);
      el.addEventListener?.('transitionend', onTransitionEndOrCanceled);

      this.bound.disposables.push(() => {
        el.removeEventListener?.('transitioncancel', onTransitionEndOrCanceled);
        el.removeEventListener?.('transitionend', onTransitionEndOrCanceled);
      });
    }

    this.onReLayout(nextLayout.allowRestore ? nextLayout.restoredRects.get(this) : null);
  }

  public notifyPriorityChange (priority: number) {
    this.priority = priority;
    this.flushZIndex();
  }

  initialize () {
    this.parent.on('update:layout', this.setLayout, this);
    this.layout.on('update', this.onLayoutChange, this);
    this.layout.on('break', this.onReLayout, this);
  }

  onLayoutChange () {
    this.rect = this.layout.fitRect(this.rect);
    this.flush();
  }

  onReLayout (suggestedRect?: Rect | undefined | null) {
    this.rect = suggestedRect ? this.layout.fitRect(suggestedRect) : this.layout.initializeRect(this.id);
    this.flush();
  }

  destroy () {
    this.unbind();
    this.parent.off('update:layout', this.setLayout, this);
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
      layout.renderTransitionProperties(el.style);
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
            this.emit('drag:start');
            start = this.rect;
          },
          (offset, delta) => {
            this.rect = this.layout.move(start, offset, offset);
            this.flush();
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
        disposables.push(bindDraggable(
          target,
          window,
          cursors[edgeOrCorner],
          () => this.layout.allowResize,
          () => {
            el.dataset.resizing = edgeOrCorner;
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