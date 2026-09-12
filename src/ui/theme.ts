import { styleText } from "node:util";

const colorEnabled =
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== "0" &&
  Boolean(process.stdout.isTTY);

export function paint(style: Parameters<typeof styleText>[0], text: string): string {
  if (!colorEnabled) return text;
  return styleText(style, text);
}

export const theme = {
  brand: (text: string) => paint(["bold", "cyan"], text),
  muted: (text: string) => paint("dim", text),
  heading: (text: string) => paint(["bold", "white"], text),
  ok: (text: string) => paint("green", text),
  fail: (text: string) => paint("red", text),
  warn: (text: string) => paint("yellow", text),
  info: (text: string) => paint("cyan", text),
  label: (text: string) => paint("bold", text),
  path: (text: string) => paint("dim", text),
};

export const VERSION = "0.1.0";
