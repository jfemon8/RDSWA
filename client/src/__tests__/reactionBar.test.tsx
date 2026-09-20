import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import ReactionBar from "@/components/chat/ReactionBar";

const ME = "me-1";

describe("ReactionBar", () => {
  it("merges a legacy emoji row with the named reaction it stands for", () => {
    render(
      <ReactionBar
        currentUserId={ME}
        reactions={[
          { user: { _id: "u1", name: "Towhid Sarker" }, emoji: "👍" },
          { user: { _id: "u2", name: "Rakib Hasan" }, emoji: "like" },
          { user: { _id: "u3", name: "Manik Mia" }, emoji: "love" },
        ]}
      />,
    );

    // One chip per reaction, so the same glyph never appears twice.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByLabelText(/Like, 2 reactions/)).toBeInTheDocument();
  });

  it("names the reactors on hover", async () => {
    const user = userEvent.setup();
    render(
      <ReactionBar
        currentUserId={ME}
        reactions={[
          { user: { _id: ME, name: "Emon" }, emoji: "like" },
          { user: { _id: "u2", name: "Rakib Hasan" }, emoji: "👍" },
        ]}
      />,
    );

    await user.hover(screen.getByRole("button"));

    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("You");
    expect(tip).toHaveTextContent("Rakib Hasan");
  });

  it("toggles with the canonical name rather than the stored glyph", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ReactionBar
        currentUserId={ME}
        onToggle={onToggle}
        reactions={[{ user: { _id: ME, name: "Emon" }, emoji: "👍" }]}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledWith("like");
  });
});
