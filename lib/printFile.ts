// Opens a fresh window containing just the file and triggers the browser's
// print dialog once it's loaded - one click gets straight to "print", no
// need to open the file, find the browser's own print button, etc.
export function printFileUrl(url: string, isPdf: boolean) {
  const w = window.open("", "_blank", "width=850,height=1100");
  if (!w) return;
  const pageStyle = "<style>@page{size:A4;margin:10mm;}</style>";
  if (isPdf) {
    w.document.write(
      `<html><head><title>Print</title>${pageStyle}</head><body style="margin:0">` +
        `<iframe src="${url}" style="border:0;width:100%;height:100vh;" ` +
        `onload="this.contentWindow.focus();this.contentWindow.print();"></iframe>` +
        `</body></html>`
    );
  } else {
    w.document.write(
      `<html><head><title>Print</title>${pageStyle}</head><body style="margin:0;text-align:center">` +
        `<img src="${url}" style="max-width:100%;" onload="window.focus();window.print();" />` +
        `</body></html>`
    );
  }
  w.document.close();
}
