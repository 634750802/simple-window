import { EventEmitter } from 'eventemitter3';
import type { RectLayout } from './layouts/base.js';
import { type Edges, makeRect, type Rect, UNINITIALIZED_RECT } from './rect.js';
import { RectWindow } from './window.js';

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
  'update:layout': [RectLayout, RectLayout];
}

export class RectWindowCollection<Props> extends EventEmitter<RectWindowCollectionEventsMap<Props>> {
  private readonly windows: Map<number | string, RectWindow<Props>> = new Map();
  private windowsPriority: RectWindow<Props>[] = [];
  readonly zIndexBase: number;
  private _layout: RectLayout;

  constructor ({
    zIndexBase = 20,
    layout,
  }: RectWindowCollectionOptions<Props>) {
    super();
    this.zIndexBase = zIndexBase;
    this._layout = layout;
  }

  getWindow (idOrKey: number | string): RectWindow<Props> | undefined {
    return this.windows.get(idOrKey);
  }

  get layout (): RectLayout {
    return this._layout;
  }

  set layout (layout: RectLayout) {
    const previousLayout = this._layout;
    this._layout.removeAllListeners();
    this._layout = layout;
    this.emit('update:layout', layout, previousLayout);
  }

  newWindow ({ key, rect, props }: NewWindowOptions<Props>) {
    const id = this.windowsPriority.reduce((id, w) => Math.max(w.id, id), -1) + 1;
    const window = new RectWindow(this, id, key, rect ?? UNINITIALIZED_RECT, props);
    this.windows.set(key || id, window);
    this.windowsPriority.push(window);
    window.initialize();
    window.once('destroy', () => {
      this.windows.delete(key || id);
      this.windowsPriority = this.windowsPriority.filter(item => window !== item);
      this._notifyPriorityChanges();
    });

    window.on('tap', () => {
      this.windowsPriority = this.windowsPriority.filter(item => item !== window).concat(window);
      this._notifyPriorityChanges();
    });

    this._notifyPriorityChanges();
    return window;
  }

  private _notifyPriorityChanges () {
    this.windowsPriority.forEach((window, index) => window.notifyPriorityChange(index + 1));
  }
}