"use client";

import * as React from "react";
import { useMemo } from "react";

const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 86;
const BLOCK_DATA_CODEWORDS = 43;
const ECC_CODEWORDS = 24;

const gfExp = new Uint16Array(512);
const gfLog = new Uint16Array(256);
let gfReady = false;

function prepareGalois() {
  if (gfReady) return;
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    gfExp[index] = value;
    gfLog[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1)
    gfExp[index] = gfExp[index - 255];
  gfReady = true;
}

function gfMultiply(left: number, right: number) {
  if (!left || !right) return 0;
  return gfExp[gfLog[left] + gfLog[right]];
}

function generatorPolynomial(degree: number) {
  prepareGalois();
  let polynomial = [1];
  for (let exponent = 0; exponent < degree; exponent += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    polynomial.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, gfExp[exponent]);
    });
    polynomial = next;
  }
  return polynomial;
}

function errorCorrection(data: number[]) {
  const generator = generatorPolynomial(ECC_CODEWORDS);
  const working = [...data, ...new Array<number>(ECC_CODEWORDS).fill(0)];
  for (let offset = 0; offset < data.length; offset += 1) {
    const factor = working[offset];
    if (!factor) continue;
    generator.forEach((coefficient, index) => {
      working[offset + index] ^= gfMultiply(coefficient, factor);
    });
  }
  return working.slice(data.length);
}

function appendBits(target: number[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1)
    target.push((value >>> bit) & 1);
}

function dataCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 84) return null;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  const capacity = DATA_CODEWORDS * 8;
  for (let index = 0; index < Math.min(4, capacity - bits.length); index += 1)
    bits.push(0);
  while (bits.length % 8) bits.push(0);
  const result: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1)
      byte = (byte << 1) | bits[offset + bit];
    result.push(byte);
  }
  let pad = true;
  while (result.length < DATA_CODEWORDS) {
    result.push(pad ? 0xec : 0x11);
    pad = !pad;
  }
  return result;
}

function bchDigit(value: number) {
  let digit = 0;
  while (value) {
    digit += 1;
    value >>>= 1;
  }
  return digit;
}

function formatBits(mask: number) {
  const generator = 0x537;
  const maskPattern = 0x5412;
  const formatData = mask; // Error-correction level M is encoded as 00.
  let value = formatData << 10;
  while (bchDigit(value) - bchDigit(generator) >= 0)
    value ^= generator << (bchDigit(value) - bchDigit(generator));
  return ((formatData << 10) | value) ^ maskPattern;
}

function qrMatrix(value: string) {
  const data = dataCodewords(value);
  if (!data) return null;
  const first = data.slice(0, BLOCK_DATA_CODEWORDS);
  const second = data.slice(BLOCK_DATA_CODEWORDS);
  const firstEcc = errorCorrection(first);
  const secondEcc = errorCorrection(second);
  const codewords: number[] = [];
  for (let index = 0; index < BLOCK_DATA_CODEWORDS; index += 1)
    codewords.push(first[index], second[index]);
  for (let index = 0; index < ECC_CODEWORDS; index += 1)
    codewords.push(firstEcc[index], secondEcc[index]);

  const modules: Array<Array<boolean | null>> = Array.from(
    { length: SIZE },
    () => new Array<boolean | null>(SIZE).fill(null),
  );
  const set = (row: number, column: number, dark: boolean) => {
    if (row >= 0 && row < SIZE && column >= 0 && column < SIZE)
      modules[row][column] = dark;
  };
  const finder = (row: number, column: number) => {
    for (let y = -1; y <= 7; y += 1)
      for (let x = -1; x <= 7; x += 1) {
        const dark =
          y >= 0 &&
          y <= 6 &&
          x >= 0 &&
          x <= 6 &&
          (y === 0 ||
            y === 6 ||
            x === 0 ||
            x === 6 ||
            (y >= 2 && y <= 4 && x >= 2 && x <= 4));
        set(row + y, column + x, dark);
      }
  };
  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);

  for (let index = 8; index < SIZE - 8; index += 1) {
    if (modules[index][6] === null) set(index, 6, index % 2 === 0);
    if (modules[6][index] === null) set(6, index, index % 2 === 0);
  }
  const alignment = 30;
  for (let y = -2; y <= 2; y += 1)
    for (let x = -2; x <= 2; x += 1)
      set(
        alignment + y,
        alignment + x,
        Math.abs(y) === 2 || Math.abs(x) === 2 || (y === 0 && x === 0),
      );

  const mask = 0;
  const info = formatBits(mask);
  for (let index = 0; index < 15; index += 1) {
    const dark = ((info >>> index) & 1) === 1;
    if (index < 6) set(index, 8, dark);
    else if (index < 8) set(index + 1, 8, dark);
    else set(SIZE - 15 + index, 8, dark);
    if (index < 8) set(8, SIZE - index - 1, dark);
    else if (index < 9) set(8, 15 - index, dark);
    else set(8, 15 - index - 1, dark);
  }
  set(SIZE - 8, 8, true);

  let row = SIZE - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;
  for (let column = SIZE - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    while (true) {
      for (let pair = 0; pair < 2; pair += 1) {
        const targetColumn = column - pair;
        if (modules[row][targetColumn] !== null) continue;
        let dark =
          byteIndex < codewords.length &&
          ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
        if ((row + targetColumn) % 2 === 0) dark = !dark;
        set(row, targetColumn, dark);
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= SIZE) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
  return modules as boolean[][];
}

export function SecureQr({
  value,
  label = "پیگیری امن",
}: {
  value: string;
  label?: string;
}) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  if (!matrix)
    return (
      <div className="secure-qr-fallback">
        <strong>{label}</strong>
        <span dir="ltr">{value}</span>
      </div>
    );
  const quiet = 4;
  const dimension = SIZE + quiet * 2;
  return (
    <div className="secure-qr">
      <svg
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="img"
        aria-label={`QR ${label}`}
        shapeRendering="crispEdges"
      >
        <rect width={dimension} height={dimension} fill="#fff" />
        {matrix.flatMap((row, y) =>
          row.map((dark, x) =>
            dark ? (
              <rect
                key={`${x}-${y}`}
                x={x + quiet}
                y={y + quiet}
                width="1"
                height="1"
                fill="#123b38"
              />
            ) : null,
          ),
        )}
      </svg>
      <span>{label}</span>
    </div>
  );
}
