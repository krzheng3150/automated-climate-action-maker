/**
 * Quote-aware CSV parser (comma-delimited, RFC 4180 quoting). Returns the header cells and
 * every data record as an array of cells. Records whose cells are all empty (e.g. ",,,,"
 * padding rows or blank lines) are dropped.
 */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (record.some((cell) => cell !== '')) records.push(record);
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) endRecord();

  const [headers = [], ...rows] = records;
  return { headers, rows };
}
