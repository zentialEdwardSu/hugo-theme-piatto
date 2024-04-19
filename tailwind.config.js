/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./layouts/**/*.html"],
  darkMode: "class",
  theme: {
    extend: {
      minHeight:{
        'frame': '768px'
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

