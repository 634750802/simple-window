import { type ComponentProps, type ComponentPropsWithoutRef, createContext, type ReactNode, type Ref, type RefObject, use, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RectLayout } from './layouts/base.js';
import type { ConstraintRectLayout } from './layouts/constraint.js';
import { RectWindow } from './window.js';
import { RectWindowCollection, type RectWindowCollectionOptions } from './windows.js';

const RectWindowsContext = createContext<RectWindowCollection<any> | null>(null);
const RectWindowContext = createContext<RectWindow<any> | null>(null);

export function useRectWindows<R> () {
  return use(RectWindowsContext);
}

export function useRectWindow<R> () {
  return use(RectWindowContext);
}

export function RectWindows<R> ({ defaultConstraintPadding, zIndexBase, layout, children }: { zIndexBase?: number, children: ReactNode } & Pick<RectWindowCollectionOptions<R>, 'defaultConstraintPadding' | 'layout' | 'zIndexBase'>) {
  const [collection] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return new RectWindowCollection({ defaultConstraintPadding, zIndexBase, layout });
  });

  return (
    <RectWindowsContext value={collection}>
      {children}
    </RectWindowsContext>
  );
}

export function RectWindowWrapper<R> ({ windowProps, windowKey, children, ref: forwardedRef, ...props }: { windowProps: R, windowKey?: string, ref?: Ref<RectWindow<R> | null>, children: ReactNode } & ComponentPropsWithoutRef<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const collection = useRectWindows<R>();
  const [window, setWindow] = useState<RectWindow<R> | null>(null);

  useEffect(() => {
    if (!collection) {
      return;
    }
    const el = ref.current!;
    const window = collection.newWindow({
      key: windowKey,
      props: windowProps,
    });

    setWindow(window);
    window.bind(el);

    return () => {
      window.destroy();
    };
  }, [collection]);

  useImperativeHandle<RectWindow<R> | null, RectWindow<R> | null>(forwardedRef, () => window, [window]);

  return (
    <RectWindowContext value={window}>
      <div ref={ref} {...props}>
        {children}
        <RectWindowResizeHandlers window={window} />
      </div>
    </RectWindowContext>
  );
}

function useWindowLayoutProp<K extends keyof RectLayout> (window: RectWindow<any> | undefined | null, prop: K) {
  const [, setV] = useState(0);

  useEffect(() => {
    setV(v => v + 1);

    if (window) {
      const onLayoutChange = () => {
        setV(v => v + 1);
      };
      window.parent.on('update:layout', onLayoutChange);
      window.on('layout', onLayoutChange);
      return () => {
        window.off('layout', onLayoutChange);
        window.parent.off('update:layout', onLayoutChange);
      };
    }
  }, [window]);

  return window?.layout[prop];
}

export function RectWindowHeader ({ window, children, ...props }: { window: RectWindow<any> | null } & ComponentProps<'div'>) {
  const allowMove = useWindowLayoutProp(window, 'allowMove');

  return (
    <div {...props} data-rect-draggable-handler={true} data-rect-move={allowMove ? 'allow' : 'disallow'}>
      {children}
    </div>
  );
}

function RectWindowResizeHandlers ({ window }: { window?: RectWindow<any> | null }) {
  const allowResize = useWindowLayoutProp(window, 'allowMove');

  return (
    <>
      <div data-rect-draggable-edge="left" style={{ display: allowResize ? 'block' : 'none' }} />
      <div data-rect-draggable-edge="right" style={{ display: allowResize ? 'block' : 'none' }} />
      <div data-rect-draggable-edge="bottom" style={{ display: allowResize ? 'block' : 'none' }} />
      <div data-rect-draggable-corner="bottom-left" style={{ display: allowResize ? 'block' : 'none' }} />
      <div data-rect-draggable-corner="bottom-right" style={{ display: allowResize ? 'block' : 'none' }} />
    </>
  );
}

export function useConstraintRectLayoutWithElement<E extends Element> ({ elementRef, initializeLayout }: { elementRef: RefObject<E | null>, initializeLayout: () => ConstraintRectLayout }) {
  const layout = useMemo(() => initializeLayout(), []);

  useLayoutEffect(() => {
    if (elementRef.current) {
      layout.bindElement(elementRef.current);
      return () => {
        layout.unbind();
      };
    }
  }, [layout, elementRef]);
}

export function useConstraintRectLayoutWithWindow<R> ({ initializeLayout }: { initializeLayout: () => ConstraintRectLayout }) {
  const layout = useMemo(() => initializeLayout(), []);

  useLayoutEffect(() => {
    layout.bindWindow(window);

    return () => {
      layout.unbind();
    };
  }, [layout]);
}
