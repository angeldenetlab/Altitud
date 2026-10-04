"use client";

import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from "framer-motion";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Dock con magnificación al estilo del Dock de macOS.
 *
 * El icono bajo el cursor crece y arrastra consigo a sus vecinos, que crecen
 * menos conforme se alejan. Es lo que hace que un blanco de 40px se sienta
 * grande sin ocupar espacio permanente en pantalla: el ancho se lo quedan las
 * tablas y los formularios, no la navegación.
 */

const DOCK_CROSS_AXIS = 128;
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;
const DEFAULT_PANEL_WIDTH = 64;
const DEFAULT_ITEM_SIZE = 40;

type DockOrientation = "horizontal" | "vertical";

type DockProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  orientation?: DockOrientation;
  panelHeight?: number;
  panelWidth?: number;
  magnification?: number;
  spring?: SpringOptions;
  /**
   * En horizontal el dock gana alto al pasar el cursor para dejarle sitio a
   * las etiquetas. Apágalo si el dock no lleva `DockLabel` o vive dentro de un
   * contenedor que lo recorta.
   */
  expandOnHover?: boolean;
  /** Etiqueta del toolbar para lectores de pantalla. */
  "aria-label"?: string;
};

type DockItemProps = {
  className?: string;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** Se pinta como seleccionado: es la vista en la que está el usuario. */
  active?: boolean;
  /**
   * Adorno que se pinta encima del icono sin crecer con él —un contador, un
   * punto—. Va aparte de `children` porque a los hijos se les inyectan el
   * ancho animado y el hover, y eso solo lo entienden `DockIcon` y `DockLabel`.
   */
  badge?: React.ReactNode;
  "aria-label"?: string;
};

type DockLabelProps = {
  className?: string;
  children: React.ReactNode;
};

type DockIconProps = {
  className?: string;
  children: React.ReactNode;
};

type DockContextValue = {
  orientation: DockOrientation;
  pointer: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

/**
 * Props que `DockItem` le inyecta a sus hijos al clonarlos.
 *
 * `DockIcon` necesita el tamaño animado para escalar con él y `DockLabel`
 * necesita saber si el puntero está encima. Viajan por `cloneElement` en lugar
 * de por contexto para que cada item tenga los suyos sin montar un provider
 * por icono.
 */
type DockChildInjectedProps = {
  itemSize?: MotionValue<number>;
  isHovered?: MotionValue<number>;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

function useDock(): DockContextValue {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error("useDock debe usarse dentro de un <Dock>.");
  }
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  orientation = "horizontal",
  panelHeight = DEFAULT_PANEL_HEIGHT,
  panelWidth = DEFAULT_PANEL_WIDTH,
  expandOnHover = true,
  "aria-label": ariaLabel = "Navegación",
}: DockProps) {
  const pointer = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxCross = useMemo(
    () => Math.max(DOCK_CROSS_AXIS, magnification + magnification / 2 + 4),
    [magnification],
  );

  const expandedCross = useTransform(
    isHovered,
    [0, 1],
    [panelHeight, expandOnHover ? maxCross : panelHeight],
  );
  const crossSpring = useSpring(expandedCross, spring);

  const isVertical = orientation === "vertical";

  const panel = (
    <motion.div
      onMouseMove={(event) => {
        isHovered.set(1);
        // Coordenadas de viewport, igual que `getBoundingClientRect()`: con
        // `pageX/pageY` la lupa se desfasaba al hacer scroll, porque los docks
        // van `fixed` y no se mueven con la página.
        pointer.set(isVertical ? event.clientY : event.clientX);
      }}
      onMouseLeave={() => {
        isHovered.set(0);
        pointer.set(Infinity);
      }}
      className={cn(
        "mx-auto flex overflow-visible",
        isVertical
          ? "h-full w-full flex-col items-start gap-2 py-1"
          : "w-fit items-end gap-4 rounded-2xl bg-gray-50 px-4 dark:bg-neutral-900",
        className,
      )}
      style={isVertical ? undefined : { height: panelHeight }}
      role="toolbar"
      aria-label={ariaLabel}
    >
      <DockContext.Provider value={{ orientation, pointer, spring, distance, magnification }}>
        {children}
      </DockContext.Provider>
    </motion.div>
  );

  if (isVertical) {
    return (
      <div
        className="flex h-full w-full max-w-full flex-col overflow-visible"
        style={{ width: panelWidth, scrollbarWidth: "none" }}
      >
        {panel}
      </div>
    );
  }

  return (
    <motion.div
      style={{ height: crossSpring, scrollbarWidth: "none" }}
      className="flex w-max max-w-full items-end overflow-visible"
    >
      {panel}
    </motion.div>
  );
}

function DockItem({
  children,
  className,
  href,
  onClick,
  active,
  badge,
  "aria-label": ariaLabel,
}: DockItemProps) {
  const ref = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const { distance, magnification, pointer, spring, orientation } = useDock();
  const isHovered = useMotionValue(0);
  const isVertical = orientation === "vertical";

  const mouseDistance = useTransform(pointer, (value) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
    if (isVertical) {
      return value - rect.y - rect.height / 2;
    }
    return value - rect.x - rect.width / 2;
  });

  const sizeTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [DEFAULT_ITEM_SIZE, magnification, DEFAULT_ITEM_SIZE],
  );

  const itemSize = useSpring(sizeTransform, spring);

  // En vertical el hueco crece en los dos ejes: los vecinos se abren para
  // dejarle sitio, como en el Dock de macOS. Con `scale` el icono crecía
  // encima de ellos y se descentraba hacia la derecha del riel.
  const horizontalStyle = { width: itemSize };
  const verticalStyle = { width: itemSize, height: itemSize };

  const interactionHandlers = {
    onHoverStart: () => isHovered.set(1),
    onHoverEnd: () => isHovered.set(0),
    onFocus: () => isHovered.set(1),
    onBlur: () => isHovered.set(0),
  };

  const itemClassName = cn(
    "relative inline-flex aspect-square items-center justify-center outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isVertical && "z-10",
    className,
  );

  const inner = (
    <>
      {Children.map(children, (child) =>
        isValidElement<DockChildInjectedProps>(child)
          ? cloneElement(child, { itemSize, isHovered })
          : child,
      )}
      {badge}
    </>
  );

  if (isVertical) {
    return (
      <motion.div
        ref={ref as RefObject<HTMLDivElement>}
        style={verticalStyle}
        className="relative shrink-0"
        {...interactionHandlers}
      >
        {href ? (
          <Link
            href={href}
            onClick={onClick}
            aria-label={ariaLabel}
            aria-current={active ? "page" : undefined}
            className={cn(itemClassName, "size-full")}
          >
            {inner}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            aria-current={active ? "page" : undefined}
            className={cn(itemClassName, "size-full")}
          >
            {inner}
          </button>
        )}
      </motion.div>
    );
  }

  if (href) {
    return (
      <motion.div
        ref={ref as RefObject<HTMLDivElement>}
        style={horizontalStyle}
        className="relative shrink-0"
        {...interactionHandlers}
      >
        <Link
          href={href}
          onClick={onClick}
          aria-label={ariaLabel}
          aria-current={active ? "page" : undefined}
          className={cn(itemClassName, "size-full")}
        >
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      ref={ref as RefObject<HTMLButtonElement>}
      type="button"
      style={horizontalStyle}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={itemClassName}
      {...interactionHandlers}
    >
      {inner}
    </motion.button>
  );
}

function DockLabel({ children, className, ...rest }: DockLabelProps & DockChildInjectedProps) {
  const { isHovered } = rest;
  const { orientation } = useDock();
  const [isVisible, setIsVisible] = useState(false);
  const isVertical = orientation === "vertical";

  useEffect(() => {
    if (!isHovered) return;
    return isHovered.on("change", (latest) => setIsVisible(latest === 1));
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, ...(isVertical ? { x: 0 } : { y: 0 }) }}
          animate={{ opacity: 1, ...(isVertical ? { x: 6 } : { y: -10 }) }}
          exit={{ opacity: 0, ...(isVertical ? { x: 0 } : { y: 0 }) }}
          transition={{ duration: 0.2 }}
          className={cn(
            "pointer-events-none absolute z-50 w-fit whitespace-pre rounded-md border bg-popover px-2 py-0.5 text-xs font-medium text-popover-foreground shadow-sm",
            isVertical
              ? "left-full top-1/2 ml-4 -translate-y-1/2"
              : "-top-7 left-1/2 -translate-x-1/2",
            className,
          )}
          role="tooltip"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DockIcon({ children, className, ...rest }: DockIconProps & DockChildInjectedProps) {
  const { itemSize } = rest;
  const fallback = useMotionValue(DEFAULT_ITEM_SIZE);
  const iconScale = useTransform(itemSize ?? fallback, (value) => value / 2);

  return (
    <motion.div
      style={{ width: iconScale }}
      className={cn("flex items-center justify-center", className)}
    >
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
