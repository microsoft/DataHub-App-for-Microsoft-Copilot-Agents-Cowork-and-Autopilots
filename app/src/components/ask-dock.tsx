import { lazy, Suspense, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { X } from "lucide-react";
import { QueryLoading } from "./query-states";
import { cn } from "@/lib/utils";
import { BODY, SMALL } from "@/lib/type-scale";

const AskScreen = lazy(() => import("@/screens/ask").then((module) => ({ default: module.AskScreen })));
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';

export function AskDock({ modal, onClose, returnFocus }: {
    modal: boolean;
    onClose: () => void;
    returnFocus: RefObject<HTMLElement | null>;
}) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const target = returnFocus.current;
        ref.current?.querySelector<HTMLElement>("button")?.focus();
        return () => target?.focus();
    }, [returnFocus]);
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
        }
        if (!modal || event.key !== "Tab") return;
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };
    return (
        <aside ref={ref} id="ask-dock" role={modal ? "dialog" : "complementary"} aria-modal={modal || undefined}
            aria-labelledby="ask-dock-title" onKeyDown={onKeyDown} data-print="hide"
            className={cn("flex shrink-0 flex-col gap-400 overflow-y-auto border-l border-border bg-card p-400",
                modal ? "fixed inset-0 z-40" : "relative w-[min(26rem,40vw)]")}>
            <div className="flex items-center justify-between gap-200">
                <h2 id="ask-dock-title" className={cn(BODY, "font-semibold")}>Ask agent</h2>
                <button type="button" onClick={onClose} aria-label="Close Ask agent"
                    className="rounded-md p-200 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
                    <X className="icon-size-200" aria-hidden="true" />
                </button>
            </div>
            <p className={cn(SMALL, "text-muted-foreground")}>Name the team, period and metric in your question. Page filters are not automatically sent to the agent.</p>
            <Suspense fallback={<QueryLoading />}><AskScreen /></Suspense>
        </aside>
    );
}
