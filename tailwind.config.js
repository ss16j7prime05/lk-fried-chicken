/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#E6F7ED',
          DEFAULT: '#00B14F', // Grab-inspired Green
          dark: '#008F3F',
        },
        secondary: '#FF5B22', // Foodpanda/LineMan Orange
        surface: '#F8F9FA',
        card: '#FFFFFF',
        accent: '#5D3EBC',
        dark: '#0A0A0A',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'premium': '0 20px 50px -12px rgba(0,0,0,0.08)',
        'soft': '0 2px 15px rgba(0,0,0,0.03)',
      }
    },
  },
  plugins: [],
}
