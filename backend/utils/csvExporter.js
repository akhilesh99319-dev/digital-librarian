/**
 * CSV Exporter Utility
 * Converts an array of objects to standard RFC 4180 compliant CSV string
 */

function jsonToCsv(data, fields = null) {
  if (!Array.isArray(data)) {
    return '';
  }

  // Determine headers
  let headers = fields;
  if ((!headers || headers.length === 0) && data.length > 0) {
    headers = Object.keys(data[0]);
  }

  if (!headers || headers.length === 0) {
    return '';
  }

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    } else {
      str = `"${str}"`;
    }
    return str;
  };

  const headerRow = headers.map(h => escapeCell(h)).join(',');
  
  const dataRows = data.map(row => {
    return headers.map(header => {
      return escapeCell(row[header]);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
}

module.exports = {
  jsonToCsv
};
