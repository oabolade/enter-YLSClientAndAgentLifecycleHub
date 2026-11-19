import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '1rem',
			screens: {
				'2xl': '1320px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['var(--font-body)'],
				display: ['var(--font-display)']
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
					soft: 'hsl(var(--destructive-soft))'
				},
				crimson: {
					DEFAULT: 'hsl(var(--crimson))',
					foreground: 'hsl(var(--crimson-foreground))',
					soft: 'hsl(var(--crimson-soft))'
				},
				gold: {
					DEFAULT: 'hsl(var(--gold))',
					foreground: 'hsl(var(--gold-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					soft: 'hsl(var(--warning-soft))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					soft: 'hsl(var(--success-soft))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-navy': 'var(--gradient-navy)',
				'gradient-subtle': 'var(--gradient-subtle)',
				'gradient-hero-fade': 'var(--gradient-hero-fade)',
				'gradient-hero-fade-up': 'var(--gradient-hero-fade-up)',
				'gradient-gold-line': 'var(--gradient-gold-line)'
			},
			boxShadow: {
				card: 'var(--shadow-card)',
				raised: 'var(--shadow-raised)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'hero-settle': {
					from: { opacity: '0', transform: 'scale(1.06)' },
					to: { opacity: '1', transform: 'scale(1)' }
				},
				'hero-drift': {
					'0%, 100%': { transform: 'scale(1) translateX(0)' },
					'50%': { transform: 'scale(1.03) translateX(-0.75%)' }
				},
				'line-grow': {
					from: { transform: 'scaleX(0)' },
					to: { transform: 'scaleX(1)' }
				},
				glow: {
					'0%, 100%': { opacity: '0.35' },
					'50%': { opacity: '0.7' }
				},
				'pop-in': {
					from: { opacity: '0', transform: 'scale(0.95)' },
					to: { opacity: '1', transform: 'scale(1)' }
				},
				// A highlight band sweeping down a document while the AI reads it.
				scan: {
					from: { transform: 'translateY(-100%)' },
					to: { transform: 'translateY(300%)' }
				},
				// A new queue row: fades in on a soft highlight that settles back to the row's own colour.
				'row-in': {
					from: { opacity: '0', backgroundColor: 'hsl(var(--success-soft))' },
					'15%': { opacity: '1', backgroundColor: 'hsl(var(--success-soft))' }
				},
				dot: {
					'0%, 80%, 100%': { opacity: '0.25' },
					'40%': { opacity: '1' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-up': 'fade-up 0.35s ease-out both',
				'hero-in': 'fade-up 0.6s ease-out both',
				'hero-settle': 'hero-settle 1.4s cubic-bezier(0.22, 1, 0.36, 1) both',
				'hero-drift': 'hero-drift 24s ease-in-out 1.4s infinite',
				'line-grow': 'line-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
				glow: 'glow 6s ease-in-out infinite',
				'pop-in': 'pop-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
				scan: 'scan 1.4s linear infinite',
				'row-in': 'row-in 2.4s ease-out backwards',
				dot: 'dot 1.2s ease-in-out infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
