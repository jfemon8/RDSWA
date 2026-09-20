import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatRichContent from "@/components/chat/ChatRichContent";

describe("ChatRichContent", () => {
  it("renders Markdown emphasis, highlight, lists, and line breaks", () => {
    const { container } = render(
      <ChatRichContent
        content={
          "**bold** *italic* ==highlight==\nline two\n\n- First\n- Second"
        }
      />,
    );

    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(container.querySelector("mark")).toHaveTextContent("highlight");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("br")).toBeInTheDocument();
  });

  it("formats Markdown the author typed inside editor HTML", () => {
    // Announcements arrive as HTML with the title in front, so the markers sit in text nodes.
    const { container } = render(
      <ChatRichContent
        content={"**Announcement title**\n\n<p>Read the <em>full</em> ~~draft~~ *today*</p>"}
      />,
    );

    expect(container.querySelector("strong")).toHaveTextContent(
      "Announcement title",
    );
    expect(container.querySelector("del")).toHaveTextContent("draft");
    expect(container.textContent).not.toContain("**");
    expect(container.textContent).not.toContain("~~");
  });

  it("renders existing rich HTML without exposing unsafe tags", () => {
    const { container } = render(
      <ChatRichContent
        content={"<p><strong>Bold</strong></p><script>alert(1)</script>"}
      />,
    );

    expect(container.querySelector("strong")).toHaveTextContent("Bold");
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});
