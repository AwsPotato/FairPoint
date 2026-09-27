/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./components/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        /* Core Design Tokens */
        user: {
          1: "var(--color-user-1, #2563EB)", // Cobalt Blue
          2: "var(--color-user-2, #E11D48)", // Rose Red
          3: "var(--color-user-3, #059669)", // Emerald Green
          4: "var(--color-user-4, #7C3AED)", // Violet Purple
        },
        intersection: "var(--color-intersection, #F59E0B)", // Amber
        fairpoint: "var(--color-fairpoint, #F59E0B)",       // Amber

        /* Semantic Surfaces */
        surface: {
          overlay: "var(--surface-overlay, #ffffffe5)",
          card: "var(--surface-card, #ffffff)",
        },

        /* Semantic Borders & Text */
        border: {
          default: "var(--border-default, #e2e8f0)",
        },
        content: {
          primary: "var(--text-primary, #0f172a)",
          secondary: "var(--text-secondary, #64748b)",
        },
      },
      spacing: {
        xs: "var(--spacing-xs, 4px)",
        sm: "var(--spacing-sm, 8px)",
        md: "var(--spacing-md, 12px)",
        lg: "var(--spacing-lg, 16px)",
        xl: "var(--spacing-xl, 24px)",
      },
      borderRadius: {
        control: "var(--radius-control, 8px)",
        card: "var(--radius-card, 16px)",
        pill: "var(--radius-pill, 9999px)",
      },
    },
  },
  plugins: [],
};
