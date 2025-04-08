import { type ComponentProps, type ComponentPropsWithoutRef, createContext, type ReactNode, type Ref, use, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RectLayout } from './layouts/base.js';
import { RectWindow, RectWindowCollection } from './window.js';

const RectWindowsContext = createContext<RectWindowCollection<any> | null>(null);
const RectWindowContext = createContext<RectWindow<any> | null>(null);

export function useRectWindows<R> () {
  const collection = use(RectWindowsContext);
  if (!collection) {
    throw new Error('not in RectWindowsContext');
  }

  return collection;
}

export function useRectWindow<R> () {
  return use(RectWindowContext);
}

export function RectWindows<R> ({ children }: { children: ReactNode }) {
  const [collection] = useState(() => new RectWindowCollection({
    layout: new RectLayout(),
    defaultConstraintPadding: { left: 0, right: 0, top: 0, bottom: 0 },
  }));

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
  }, []);

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
    if (window) {
      setV(v => v + 1);

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

export function RectWindowHeader ({ window, children, ...props }: { window?: RectWindow<any> | null } & ComponentProps<'div'>) {
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
