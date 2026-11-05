import { strFromU8, unzipSync } from "fflate";

type SheetCell = string | number | boolean | null;

function xml(source: Uint8Array): Document {
  return new DOMParser().parseFromString(strFromU8(source), "application/xml");
}

function columnIndex(reference: string): number {
  const letters = (reference.match(/^[A-Z]+/i)?.[0] ?? "A").toUpperCase();
  return (
    [...letters].reduce(
      (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

export async function readSheet(file: File): Promise<SheetCell[][]> {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const sheetSource = archive["xl/worksheets/sheet1.xml"];
  if (!sheetSource) throw new Error("فایل Excel فاقد Sheet قابل خواندن است.");

  const sharedSource = archive["xl/sharedStrings.xml"];
  const shared = sharedSource
    ? [...xml(sharedSource).getElementsByTagName("si")].map((item) =>
        [...item.getElementsByTagName("t")]
          .map((node) => node.textContent ?? "")
          .join(""),
      )
    : [];

  const rows: SheetCell[][] = [];
  for (const row of [...xml(sheetSource).getElementsByTagName("row")]) {
    const values: SheetCell[] = [];
    for (const cell of [...row.getElementsByTagName("c")]) {
      const index = columnIndex(cell.getAttribute("r") ?? "A1");
      const kind = cell.getAttribute("t") ?? "n";
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      const inline = cell.getElementsByTagName("is")[0]?.textContent ?? "";
      let value: SheetCell = null;
      if (kind === "s") value = shared[Number(raw)] ?? "";
      else if (kind === "inlineStr" || kind === "str") value = inline || raw;
      else if (kind === "b") value = raw === "1";
      else if (raw !== "")
        value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
      values[index] = value;
    }
    rows.push(values);
  }
  return rows;
}
