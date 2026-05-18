import { test, expect, afterEach, describe } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallChip } from "../ToolCallChip";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  toolName: string,
  args: Record<string, string>,
  state: "call" | "result" = "call",
  result?: unknown
): ToolInvocation {
  if (state === "result") {
    return { toolCallId: "1", toolName, args, state, result } as ToolInvocation;
  }
  return { toolCallId: "1", toolName, args, state } as ToolInvocation;
}

describe("str_replace_editor", () => {
  test("create pending shows 'Creating' with spinner", () => {
    const { container } = render(
      <ToolCallChip toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })} />
    );
    expect(screen.getByText("Creating /App.jsx")).toBeDefined();
    expect(container.querySelector(".animate-spin")).toBeDefined();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  test("str_replace done shows 'Editing' with green dot", () => {
    const { container } = render(
      <ToolCallChip toolInvocation={makeInvocation("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" }, "result", "ok")} />
    );
    expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
    expect(container.querySelector(".bg-emerald-500")).toBeDefined();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  test("insert done shows 'Editing'", () => {
    render(
      <ToolCallChip toolInvocation={makeInvocation("str_replace_editor", { command: "insert", path: "/App.jsx" }, "result", "ok")} />
    );
    expect(screen.getByText("Editing /App.jsx")).toBeDefined();
  });

  test("view pending shows 'Reading'", () => {
    render(
      <ToolCallChip toolInvocation={makeInvocation("str_replace_editor", { command: "view", path: "/App.jsx" })} />
    );
    expect(screen.getByText("Reading /App.jsx")).toBeDefined();
  });
});

describe("file_manager", () => {
  test("rename pending shows 'Renaming'", () => {
    render(
      <ToolCallChip toolInvocation={makeInvocation("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })} />
    );
    expect(screen.getByText("Renaming /old.jsx")).toBeDefined();
  });

  test("delete done shows 'Deleting' with green dot", () => {
    const { container } = render(
      <ToolCallChip toolInvocation={makeInvocation("file_manager", { command: "delete", path: "/App.jsx" }, "result", { success: true })} />
    );
    expect(screen.getByText("Deleting /App.jsx")).toBeDefined();
    expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  });
});

test("unknown tool name falls back to raw tool name", () => {
  render(
    <ToolCallChip toolInvocation={makeInvocation("some_other_tool", {})} />
  );
  expect(screen.getByText("some_other_tool")).toBeDefined();
});
