/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                'serif': ['Georgia', 'Times New Roman', 'serif'],
                'sans': ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                warm: {
                    50: '#fdfcfb',
                    100: '#faf8f5',
                    200: '#f5f1eb',
                    300: '#ede6db',
                    400: '#e2d5c3',
                    500: '#d4c2a8',
                    600: '#c4ac8a',
                    700: '#b0946d',
                    800: '#997d58',
                    900: '#7d6749',
                },
                sage: {
                    50: '#f7f9f6',
                    100: '#eef2ec',
                    200: '#dde6d9',
                    300: '#c4d3be',
                    400: '#a6ba9d',
                    500: '#8ba182',
                    600: '#708369',
                    700: '#5a6954',
                    800: '#495545',
                    900: '#3c463a',
                },
                cream: {
                    50: '#fefdfb',
                    100: '#fdfaf5',
                    200: '#faf4ea',
                    300: '#f6ebdb',
                    400: '#f0dfc4',
                    500: '#e8cfa4',
                    600: '#ddb87f',
                    700: '#ce9d5d',
                    800: '#b8834c',
                    900: '#9a6d40',
                }
            },
            fontSize: {
                '2xs': '0.625rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem',
                '5xl': '3rem',
                '6xl': '3.75rem',
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            borderRadius: {
                'xl': '0.75rem',
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
                'cozy': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 8px 30px -4px rgba(0, 0, 0, 0.06)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
} 