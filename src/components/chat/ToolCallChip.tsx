import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

function getToolLabel(toolName: string, args: Record<string, string>): string {
  const { command, path } = args;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create": return `Creating ${path}`;
      case "str_replace": return `Editing ${path}`;
      case "insert": return `Editing ${path}`;
      case "view": return `Reading ${path}`;
      default: return `Editing ${path}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": return `Renaming ${path}`;
      case "delete": return `Deleting ${path}`;
    }
  }

  return toolName;
}

interface ToolCallChipProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallChip({ toolInvocation }: ToolCallChipProps) {
  const { toolName, args, state } = toolInvocation;
  const label = getToolLabel(toolName, args as Record<string, string>);
  const isDone = state === "result" && (toolInvocation as any).result;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
