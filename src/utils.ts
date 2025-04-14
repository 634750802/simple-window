import type { DraggableTarget } from './draggable.js';
import type { Rect, Vector2 } from './rect.js';
import type { RectWindowVirtualBoundDOMElement } from './window.js';

export function getRequiredElement (root: RectWindowVirtualBoundDOMElement, query: DraggableTarget | string): DraggableTarget | null {
  if (typeof query === 'string') {
    if (root.querySelector) {
      return root.querySelector(query);
    } else {
      console.error('querySelector is not supported on', root);
      return null;
    }
  }
  return query;
}

export function getEventOffset (event: MouseEvent | TouchEvent): Vector2 | null {
  if (isTouchEvent(event)) {
    if (event.touches.length !== 1) {
      return null;
    }
    const { clientX, clientY } = event.touches.item(0)!;
    return { x: clientX, y: clientY };
  } else {
    return { x: event.clientX, y: event.clientY };
  }
}

export function getEventButton (event: MouseEvent | TouchEvent): number | null {
  if (isTouchEvent(event)) {
    return null;
  }
  return event.button;
}

export function optimizedObserveElementResize (element: Element, onResize: (rect: ResizeObserverEntry) => void) {
  if (typeof ResizeObserver === 'undefined') {
    return () => {};
  }
  let tick: ReturnType<typeof requestAnimationFrame> = -1;

  const ro = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      onResize(entry);
    });
  });

  ro.observe(element);

  return () => {
    cancelAnimationFrame(tick);
    ro.disconnect();
  };
}

export function optimizedObserveWindowResize (onResize: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  let tick: ReturnType<typeof requestAnimationFrame> = -1;

  const handleResize = () => {
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      onResize();
    });
  };

  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
    cancelAnimationFrame(tick);
  };
}

function isTouchEvent (event: MouseEvent | TouchEvent): event is TouchEvent {
  return (event as TouchEvent).touches !== undefined;
}
