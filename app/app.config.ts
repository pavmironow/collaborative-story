/** Ink outline for form fields: the same 2px line as buttons and panels (see ink-card in main.css). */
const inkField = 'text-highlighted bg-default ring-2 ring-inset ring-(--ink)'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'coral',
      secondary: 'violet',
      neutral: 'slate'
    },
    button: {
      slots: {
        base: 'font-bold transition-[color,background-color,transform,box-shadow]'
      },
      compoundVariants: [
        // Filled and outlined buttons are drawn in ink with an offset shadow and "press" when clicked.
        {
          variant: ['solid', 'outline'],
          class: 'ring-2 ring-inset ring-(--ink) shadow-[3px_3px_0_var(--ink)] hover:not-disabled:-translate-y-px active:not-disabled:translate-x-[3px] active:not-disabled:translate-y-[3px] active:not-disabled:shadow-none'
        },
        // Bright coral needs ink text for contrast (white on coral is ≈ 2.9:1).
        {
          color: 'primary',
          variant: 'solid',
          class: 'bg-coral-500 hover:bg-coral-400 active:bg-coral-400 disabled:bg-coral-500 aria-disabled:bg-coral-500 dark:bg-coral-400 dark:hover:bg-coral-300 text-[#1F2333]'
        }
      ]
    },
    input: { variants: { variant: { outline: inkField } } },
    textarea: { variants: { variant: { outline: inkField } } },
    inputNumber: { variants: { variant: { outline: inkField } } },
    select: { variants: { variant: { outline: `${inkField} hover:bg-elevated disabled:bg-default` } } },
    modal: {
      slots: {
        content: 'bg-default divide-y divide-default flex flex-col focus:outline-none ring-2 ring-(--ink) shadow-[5px_5px_0_var(--ink)]',
        title: 'font-display text-xl font-bold text-highlighted'
      }
    },
    alert: {
      slots: { title: 'font-bold' }
    },
    badge: {
      slots: { base: 'font-bold' }
    }
  }
})
