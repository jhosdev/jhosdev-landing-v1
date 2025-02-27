/**
 * parseCSV converts a CSV string into an array of objects of type T.
 * It handles quoted fields, including commas, line breaks, and escaped quotes.
 */
export function parseCSV<T>(csv: string): T[] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    while (i < csv.length) {
        const char = csv[i];

        if (char === '"') {
            // Handle escaped quotes inside a quoted field.
            if (insideQuotes && csv[i + 1] === '"') {
                currentField += '"';
                i += 2;
                continue;
            } else {
                insideQuotes = !insideQuotes;
                i++;
                continue;
            }
        }

        // If comma is encountered outside a quoted field, the field ends.
        if (char === ',' && !insideQuotes) {
            currentRow.push(currentField);
            currentField = '';
            i++;
            continue;
        }

        // Check for newlines (handling both LF and CRLF) outside quotes.
        if ((char === '\n' || char === '\r') && !insideQuotes) {
            // If CRLF, skip the \n after \r.
            if (char === '\r' && csv[i + 1] === '\n') {
                i++;
            }
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            i++;
            continue;
        }

        // Otherwise, accumulate the character.
        currentField += char;
        i++;
    }

    // Push any remaining data.
    currentRow.push(currentField);
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
    }

    if (rows.length === 0) {
        return [];
    }

    // Use the first row as headers.
    const headers = rows[0];
    const result: T[] = rows.slice(1).map((row) => {
        const obj: any = {};
        headers.forEach((header, idx) => {
            obj[header] = row[idx] || '';
        });
        return obj as T;
    });

    for (const row of result) {
        for (let i = 0; i < headers.length; i++) {
            //if row[headers[i]] has a break line, split it into an array
            //@ts-ignore
            if (row[headers[i]].includes('\n')) {
                //@ts-ignore
                row[headers[i]] = row[headers[i]].split('\n');
            }
        }
    }

    return result;
}