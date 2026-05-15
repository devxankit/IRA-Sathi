/**
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'hsl(220 20% 12%)',
          foreground: 'hsl(0 0% 95%)',
          secondary: 'hsl(220 18% 18%)',
        },
        brand: {
          DEFAULT: '#017827',
          foreground: '#ffffff',
          soft: 'rgba(1, 120, 39, 0.15)',
          light: '#0a9937',
        },
        muted: {
          DEFAULT: 'hsl(220 15% 25%)',
          foreground: 'hsl(220 10% 65%)',
        },
        accent: {
          DEFAULT: 'hsl(38 92% 58%)',
          foreground: 'hsl(0 0% 99%)',
          soft: 'hsl(38 60% 25%)',
        },
        info: {
          DEFAULT: 'hsl(210 80% 58%)',
          soft: 'hsl(210 50% 25%)',
        },
        warning: {
          DEFAULT: 'hsl(38 92% 58%)',
          soft: 'hsl(38 60% 25%)',
        },
        success: {
          DEFAULT: '#017827',
          soft: 'rgba(1, 120, 39, 0.15)',
        },
        danger: {
          DEFAULT: 'hsl(0 72% 58%)',
          soft: 'hsl(0 50% 25%)',
        },
        purple: {
          DEFAULT: 'hsl(270 60% 58%)',
          soft: 'hsl(270 45% 25%)',
        },
        blue: {
          DEFAULT: 'hsl(210 80% 58%)',
          soft: 'hsl(210 50% 25%)',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 18px 40px -24px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 24px 48px -16px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
