'use client'
/**
 * Print / download the invoice as a PDF.
 *
 * WHY A BUTTON AND NOT A LINK TO A DOWNLOAD
 * ------------------------------------------
 * `window.print()` opens the browser's print dialogue, and on every platform that
 * dialogue offers "Save as PDF". That is the honest way to hand someone a PDF of a
 * document that must be generated at request time: it uses the browser's own PDF
 * writer, so there is no server-side renderer to keep in sync with the invoice
 * layout, and no third-party HTML-to-PDF dependency to audit.
 *
 * A server-rendered PDF would be the other defensible answer, and it is a real piece
 * of work — deterministic bytes, archivable, emailable. It is REPORTED as a
 * follow-up rather than faked here: a "download" that opens a print dialogue is
 * labelled as exactly that, so nobody believes they have an emailed PDF when they do
 * not.
 *
 * WHY 'use client'
 * ---------------
 * `window` does not exist during server rendering, so this has to be a client
 * component. It is deliberately tiny and takes no props — nothing about the order
 * crosses this boundary, so there is no client bundle that contains customer data.
 */
export default function PrintButton({ invoiceNumber }: { invoiceNumber: string }) {
  return (
    <div className="flex flex-col items-end gap-2">
      {/*
        `print:hidden` on the wrapper so the control does not appear on the paper. If
        the print stylesheet failed to load, an invoice with a big "Print" button
        across the top is how documents get rejected.
      */}
      <button
        type="button"
        data-testid="print-invoice"
        className="border-border cursor-pointer rounded-sm border px-4 py-2 text-sm print:hidden"
        onClick={() => {
          // The document title becomes the default PDF filename. Putting the invoice
          // number in it means a customer's Downloads folder has six files called
          // "Invoice" and no way to tell them apart.
          const previous = document.title
          document.title = `Invoice ${invoiceNumber} — Upvvan`
          window.print()
          document.title = previous
        }}
      >
        Print / save as PDF
      </button>
      <p className="text-ink-muted m-0 text-xs print:hidden">
        Your browser&apos;s print dialogue can save this as a PDF.
      </p>
    </div>
  )
}
