/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./layouts/**/*.html"],
  darkMode: "class",
  theme: {
    extend: {
      minHeight:{
        'frame': '768px'
      },
      screens: {
        'xs': '345px', // for small phone
      },
      typography: {
        DEFAULT: {
          css: {
            textAlign: 'justify',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

