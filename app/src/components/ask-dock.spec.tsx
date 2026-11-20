import { Suspense } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AskDock } from "./ask-dock";

vi.mock("@/screens/ask", () => ({ AskScreen: () => <button type="button">Example question</button> }));

describe("Ask dock", () => {
    it("traps focus only on small screens, closes with Escape and restores the trigger", async () => {
        const trigger = document.createElement("button");
        document.body.append(trigger);
        const onClose = vi.fn();
        const { unmount } = render(<Suspense><AskDock modal onClose={onClose} returnFocus={{ current: trigger }} /></Suspense>);
        const close = screen.getByRole("button", { name: "Close Ask agent" });
        await waitFor(() => expect(close).toHaveFocus());
        const last = await screen.findByRole("button", { name: "Example question" });
        last.focus();
        fireEvent.keyDown(last, { key: "Tab" });
        expect(close).toHaveFocus();
        fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
        expect(last).toHaveFocus();
        fireEvent.keyDown(last, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
        expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
        unmount();
        expect(trigger).toHaveFocus();
        trigger.remove();
    });

    it("leaves the report accessible beside the desktop dock", () => {
        render(<AskDock modal={false} onClose={() => undefined} returnFocus={{ current: null }} />);
        expect(screen.getByRole("complementary")).not.toHaveAttribute("aria-modal");
        expect(screen.getByText(/Page filters are not automatically sent/)).toBeVisible();
    });
});
