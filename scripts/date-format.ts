// Pure YYYY-MM / YYYY -> "Mon YYYY" / "YYYY" date formatter shared by the
// Typst resume renderer (scripts/render-pdf.ts).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: string): string {
  const [year, month] = date.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}
