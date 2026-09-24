export const ASCII_RAMP = ' .:-=+*#%@';

// Terminal cells are 8 by 16 pixels. A half block stores two square pixels per cell.
export function fitImageToCells(width, height, maxColumns, maxRows, mode = 'ascii') {
  if (![width, height, maxColumns, maxRows].every(value => Number.isFinite(value) && value > 0)) {
    return { columns: 0, rows: 0, sampleWidth: 0, sampleHeight: 0 };
  }
  const cellAspect = width / height * 2;
  let columns = Math.max(1, Math.floor(maxColumns));
  let rows = Math.max(1, Math.round(columns / cellAspect));
  if (rows > Math.floor(maxRows)) {
    rows = Math.max(1, Math.floor(maxRows));
    columns = Math.max(1, Math.min(columns, Math.round(rows * cellAspect)));
  }
  return { columns, rows, sampleWidth: columns, sampleHeight: rows * (mode === 'blocks' ? 2 : 1) };
}

export function rgbHex(red, green, blue) {
  return `#${[red, green, blue].map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;
}

// Area averaging retains thin image features when many source pixels form one cell.
export function sampleImageData(image, width, height) {
  const sourceWidth = Math.floor(image?.width || 0);
  const sourceHeight = Math.floor(image?.height || 0);
  if (sourceWidth < 1 || sourceHeight < 1 || image?.data?.length < sourceWidth * sourceHeight * 4) {
    throw new TypeError('Image data is incomplete.');
  }
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const top = y * sourceHeight / height;
    const bottom = (y + 1) * sourceHeight / height;
    for (let x = 0; x < width; x++) {
      const left = x * sourceWidth / width;
      const right = (x + 1) * sourceWidth / width;
      let red = 0, green = 0, blue = 0, total = 0;
      for (let sy = Math.floor(top); sy < Math.min(sourceHeight, Math.ceil(bottom)); sy++) {
        const overlapY = Math.min(sy + 1, bottom) - Math.max(sy, top);
        for (let sx = Math.floor(left); sx < Math.min(sourceWidth, Math.ceil(right)); sx++) {
          const weight = overlapY * (Math.min(sx + 1, right) - Math.max(sx, left));
          const at = (sy * sourceWidth + sx) * 4;
          const alpha = image.data[at + 3] / 255;
          red += image.data[at] * alpha * weight;
          green += image.data[at + 1] * alpha * weight;
          blue += image.data[at + 2] * alpha * weight;
          total += weight;
        }
      }
      const at = (y * width + x) * 4;
      data[at] = red / total;
      data[at + 1] = green / total;
      data[at + 2] = blue / total;
      data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

export function imageDataToCharacterLines(image, { columns, rows, mode = 'ascii' }) {
  if (!columns || !rows) return [];
  const blocks = mode === 'blocks';
  const sampled = sampleImageData(image, columns, rows * (blocks ? 2 : 1));
  const lines = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let column = 0; column < columns; column++) {
      const at = ((blocks ? row * 2 : row) * columns + column) * 4;
      const red = sampled.data[at], green = sampled.data[at + 1], blue = sampled.data[at + 2];
      const cell = blocks
        ? { text: '▀', fg: rgbHex(red, green, blue), bg: rgbHex(...sampled.data.subarray(at + columns * 4, at + columns * 4 + 3)) }
        : {
            text: ASCII_RAMP[Math.round((.2126 * red + .7152 * green + .0722 * blue) / 255 * (ASCII_RAMP.length - 1))],
            fg: mode === 'mono' ? 'ink' : rgbHex(red, green, blue),
          };
      const previous = line.at(-1);
      if (previous && previous.fg === cell.fg && previous.bg === cell.bg) previous.text += cell.text;
      else line.push(cell);
    }
    lines.push(line);
  }
  return lines;
}
