//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** One visual, explained in plain words for the section's info overlay. */
export interface GuideItem {
    /** A word or two for the kind of visual: "Bar chart". */
    kind: string;
    title: string;
    /** What the visual shows. */
    what?: string;
    /** How to read it. */
    how?: string;
}

/**
 * The visuals mounted inside one section. Visuals register themselves, so every
 * page gets an explanation without each screen authoring one.
 */
export class GuideStore {
    private readonly items = new Map<string, GuideItem>();
    private readonly listeners = new Set<() => void>();
    set(key: string, item: GuideItem) {
        const had = this.items.has(key);
        this.items.set(key, item);
        if (!had) this.emit();
    }
    delete(key: string) {
        if (this.items.delete(key)) this.emit();
    }
    list = () => [...this.items.values()];
    hasItems = () => this.items.size > 0;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => void this.listeners.delete(listener);
    };
    private emit() {
        for (const listener of this.listeners) listener();
    }
}

export const GuideContext = createContext<GuideStore | null>(null);

/** Lists a visual in the nearest section's info overlay; pass null to leave it out. */
export function useVisualGuide(item: GuideItem | null) {
    const store = useContext(GuideContext);
    const key = useId();
    const { kind, title, what, how } = item ?? {};
    const listed = item !== null && Boolean(title);
    useEffect(() => {
        if (!store) return;
        if (listed) store.set(key, { kind: kind!, title: title!, what, how });
        else store.delete(key);
    }, [store, key, listed, kind, title, what, how]);
    useEffect(() => () => store?.delete(key), [store, key]);
}

// ---- Reading a chart spec -------------------------------------------------------------------------

interface Encoding {
    field?: string;
    type?: string;
    title?: unknown;
    aggregate?: string;
    bin?: unknown;
    scale?: { type?: string } | null;
}
type Channels = Record<string, unknown>;
interface Layer {
    mark?: string | { type?: string; tooltip?: unknown; innerRadius?: number };
    encoding?: Channels;
    layer?: Layer[];
}

const ACRONYM = /^[A-Z0-9]{2,}/;
function humanise(field: string) {
    const words = field.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    return ACRONYM.test(words) ? words : words.charAt(0).toLowerCase() + words.slice(1);
}
const channel = (channels: Channels, key: string) => {
    const value = channels[key];
    return value && typeof value === "object" && !Array.isArray(value) ? value as Encoding : undefined;
};
function label(enc: Encoding | undefined, fallback: string) {
    if (!enc) return fallback;
    if (typeof enc.title === "string" && enc.title) return humanise(enc.title);
    return enc.field ? humanise(enc.field) : fallback;
}
const isQuantity = (enc?: Encoding) => Boolean(enc && (enc.type === "quantitative" || enc.aggregate) && !enc.bin);
/** "more items" for plural counts, "a higher share" otherwise. */
const more = (noun: string) => /s$/i.test(noun) ? `more ${noun}` : `a higher ${noun}`;

function flatten(spec: Layer, inherited: Channels = {}): { mark: string; channels: Channels; tooltip: boolean; donut: boolean }[] {
    const channels = { ...inherited, ...(spec.encoding ?? {}) };
    if (Array.isArray(spec.layer)) return spec.layer.flatMap(layer => flatten(layer, channels));
    const mark = typeof spec.mark === "string" ? spec.mark : spec.mark?.type;
    if (!mark) return [];
    const options = typeof spec.mark === "object" ? spec.mark : undefined;
    return [{ mark, channels, tooltip: Boolean(channels.tooltip || options?.tooltip), donut: Boolean(options?.innerRadius) }];
}

function usesLogScale(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(usesLogScale);
    const record = value as Record<string, unknown>;
    const scale = record.scale as { type?: string } | undefined;
    if (scale && typeof scale === "object" && (scale.type === "log" || scale.type === "symlog")) return true;
    return Object.values(record).some(usesLogScale);
}

function colourNote(colour: Encoding | undefined, category?: Encoding) {
    if (!colour || colour.field === undefined || colour.field === category?.field) return "";
    return isQuantity(colour) ? ` Stronger colour means ${more(label(colour, "value"))}.` : ` Colour shows the ${label(colour, "group")}.`;
}

/** Plain-words reading instructions, worked out from a Vega-Lite spec. */
export function describeSpec(spec: object): { kind: string; how: string } {
    const root = spec as Layer & { facet?: unknown; repeat?: unknown; hconcat?: unknown; vconcat?: unknown; concat?: unknown };
    const panels = root.hconcat ?? root.vconcat ?? root.concat;
    const layers = Array.isArray(panels) ? (panels as Layer[]).flatMap(panel => flatten(panel)) : flatten(root);
    const drawn = layers.filter(layer => layer.mark !== "text");
    const marks = new Set(drawn.map(layer => layer.mark));
    const main = drawn.find(layer => layer.mark !== "rule") ?? drawn[0] ?? layers[0];
    const tail = [
        usesLogScale(spec) ? " Log scale: each step along the axis is ten times the last." : "",
        layers.some(layer => layer.tooltip) ? " Hover over or tap a mark for exact figures." : "",
    ].join("");
    if (!main) return { kind: "Chart", how: `Read each mark against its axis.${tail}` };
    const c = main.channels;
    const x = channel(c, "x"), y = channel(c, "y"), colour = channel(c, "color");
    const facet = channel(c, "row") ?? channel(c, "column") ?? channel(c, "facet");
    const prefix = root.facet || facet ? `One small panel per ${label(facet, "group")}; each reads the same way. ` :
        Array.isArray(panels) ? "Several panels side by side; each reads the same way. " : "";
    const labelled = layers.some(layer => layer.mark === "text") ? " Figures are printed on the marks." : "";
    const done = (kind: string, how: string) => ({ kind, how: `${prefix}${how}${labelled}${tail}` });

    if ((marks.has("rule") || marks.has("bar")) && (marks.has("point") || marks.has("circle")) && drawn.some(layer => channel(layer.channels, "x2") || channel(layer.channels, "y2"))) {
        return done("Range chart", `Dots mark the values; the line between them shows the gap.${colourNote(colour)}`);
    }
    switch (main.mark) {
        case "bar": {
            if (channel(c, "x2") || channel(c, "y2")) return done("Range bars", `Each bar spans from a start to an end value.${colourNote(colour, y)}`);
            const across = isQuantity(x) && !isQuantity(y);
            const category = across ? y : x, value = across ? x : y;
            const split = channel(c, across ? "yOffset" : "xOffset")
                ? ` Bars side by side compare each ${label(colour, "group")}.`
                : colour && colour.field !== category?.field && !isQuantity(colour) ? ` Coloured segments split each bar by ${label(colour, "group")}.` : colourNote(colour, category);
            return done("Bar chart", `One bar per ${label(category, "row")}; a ${across ? "longer" : "taller"} bar means ${more(label(value, "value"))}.${split}`);
        }
        case "line":
            return done("Line chart", colour && !isQuantity(colour)
                ? `Each line follows ${label(y, "the value")} across ${label(x, "time")}, one line per ${label(colour, "group")}.`
                : `The line follows ${label(y, "the value")} across ${label(x, "time")}; read it left to right.`);
        case "area":
            return done("Area chart", colour && !isQuantity(colour)
                ? `Shaded bands show ${label(y, "the value")} across ${label(x, "time")}, one per ${label(colour, "group")}; stacked bands add up to the total.`
                : `The shaded area shows ${label(y, "the value")} across ${label(x, "time")}.`);
        case "rect":
            return done("Heatmap", `A grid of ${label(y, "rows")} by ${label(x, "columns")}.${colourNote(colour) || " Each cell is one combination."}`);
        case "arc":
            return done(main.donut ? "Donut chart" : "Pie chart", `Each slice is one ${label(colour, "group")}; a bigger slice is a bigger share of the total.`);
        case "point": case "circle": case "square": {
            const size = channel(c, "size");
            const sizeNote = size ? ` A bigger dot means ${more(label(size, "value"))}.` : "";
            if (isQuantity(x) && isQuantity(y)) {
                return done("Scatter plot", `Each dot sits at its ${label(x, "x value")} (across) and ${label(y, "y value")} (up).${sizeNote}${colourNote(colour)}`);
            }
            const value = isQuantity(x) ? x : y, category = isQuantity(x) ? y : x;
            return done("Dot plot", `Each dot marks the ${label(value, "value")} for one ${label(category, "row")}.${sizeNote}${colourNote(colour, category)}`);
        }
        case "tick":
            return done("Strip chart", `Each tick marks one ${label(isQuantity(x) ? x : y, "value")}.${colourNote(colour)}`);
        case "boxplot":
            return done("Box plot", "The box spans the middle half of the values; the whiskers show the full range.");
        case "rule":
            return done("Reference lines", `Lines mark each value or range.${colourNote(colour)}`);
        default:
            return done("Chart", `Read each mark against its axis.${colourNote(colour)}`);
    }
}

// ---- The info button and overlay -----------------------------------------------------------------

const GAP = 6;
const EDGE = 8;
const SMALL = "text-[length:var(--text-200)] leading-200";

/** Collapses a run of headline figures into one entry, so the list stays short. */
function grouped(items: readonly GuideItem[]): GuideItem[] {
    const figures = items.filter(item => item.kind === "Headline figure");
    if (figures.length < 2) return [...items];
    const first = items.indexOf(figures[0]);
    const merged: GuideItem = {
        kind: "Headline figures",
        title: figures.map(item => item.title).join(" · "),
        how: [...new Set(figures.flatMap(item => item.how ? item.how.split(/(?<=\.)\s+/) : []))].join(" "),
    };
    const rest = items.filter(item => item.kind !== "Headline figure");
    return [...rest.slice(0, first), merged, ...rest.slice(first)];
}

/** The section's info button: lists each visual inside it, what it shows and how to read it. */
export function GuideButton({ store, section }: { store: GuideStore; section: string }) {
    const shown = useSyncExternalStore(store.subscribe, store.hasItems, store.hasItems);
    const [items, setItems] = useState<GuideItem[]>([]);
    const panelId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const panel = panelRef.current;
        const trigger = triggerRef.current;
        if (!panel || !trigger) return;
        const place = () => {
            const anchor = trigger.getBoundingClientRect();
            const width = panel.offsetWidth;
            const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
            const below = anchor.bottom + GAP;
            panel.style.top = `${Math.max(EDGE, Math.min(below, window.innerHeight - panel.offsetHeight - EDGE))}px`;
            panel.style.left = `${left}px`;
        };
        const onToggle = (event: Event) => {
            const open = (event as ToggleEvent).newState === "open";
            trigger.setAttribute("aria-expanded", String(open));
            setItems(open ? grouped(store.list()) : []);
            if (open) requestAnimationFrame(place);
        };
        const onResize = () => {
            if (panel.matches?.(":popover-open")) place();
        };
        panel.addEventListener("toggle", onToggle);
        window.addEventListener("resize", onResize);
        return () => {
            panel.removeEventListener("toggle", onToggle);
            window.removeEventListener("resize", onResize);
        };
    }, [shown, store]);

    if (!shown) return null;
    const close = () => panelRef.current?.hidePopover?.();
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                popoverTarget={panelId}
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-label={`How to read the visuals in ${section}`}
                title="How to read these visuals"
                className="inline-flex size-[28px] shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden"
            >
                <Info className="icon-size-200" aria-hidden="true" />
            </button>
            <div
                ref={panelRef}
                id={panelId}
                popover="auto"
                role="dialog"
                aria-label={`How to read: ${section}`}
                className="fixed inset-auto m-0 max-h-[min(75vh,560px)] w-[min(400px,calc(100vw-16px))] overflow-y-auto rounded-lg border border-border bg-popover p-400 text-popover-foreground shadow-16"
            >
                <div className="flex items-start justify-between gap-300">
                    <div className="flex flex-col gap-100">
                        <p className={cn(SMALL, "font-semibold uppercase tracking-wide text-muted-foreground")}>How to read</p>
                        <p className="text-[length:var(--text-300)] leading-300 font-semibold">{section}</p>
                    </div>
                    <button type="button" onClick={close} aria-label="Close" className="inline-flex size-[28px] shrink-0 items-center justify-center rounded-md hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <X className="icon-size-200" aria-hidden="true" />
                    </button>
                </div>
                <ol className="mt-300 flex flex-col">
                    {items.map((item, index) => (
                        <li key={`${item.title}-${index}`} className="flex flex-col gap-100 border-t border-border py-300 first:border-t-0 first:pt-0">
                            <span className={cn(SMALL, "w-fit rounded-full bg-accent px-200 text-accent-foreground")}>{item.kind}</span>
                            <span className="text-[length:var(--text-300)] leading-300 font-semibold">{item.title}</span>
                            {item.what && item.what !== item.title && <span className={SMALL}>{item.what}</span>}
                            {item.how && <span className={cn(SMALL, "text-muted-foreground")}><strong className="font-semibold text-foreground">Read it: </strong>{item.how}</span>}
                        </li>
                    ))}
                </ol>
            </div>
        </>
    );
}
