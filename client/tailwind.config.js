/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'excel-green': '#C6E0B4',
                'excel-orange': '#FCE4D6',
                'excel-yellow': '#FFF2CC',
                'excel-blue': '#DDEBF7',
                'excel-purple': '#7030A0',
            }
        },
    },
    plugins: [],
}
