export type Theme = 'dark' | 'light' | 'auto';

function loadSetting<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	const stored = localStorage.getItem(`bitcoincafe:${key}`);
	if (stored === null) return fallback;
	try {
		return JSON.parse(stored) as T;
	} catch {
		return fallback;
	}
}

function saveSetting(key: string, value: unknown): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(`bitcoincafe:${key}`, JSON.stringify(value));
}

export const settings = $state({
	_theme: 'dark' as Theme,
	_defaultZapAmount: 21,

	get theme(): Theme {
		return this._theme;
	},
	set theme(v: Theme) {
		this._theme = v;
		saveSetting('theme', v);
	},

	get defaultZapAmount(): number {
		return this._defaultZapAmount;
	},
	set defaultZapAmount(v: number) {
		this._defaultZapAmount = v;
		saveSetting('defaultZapAmount', v);
	},

	init() {
		this._theme = loadSetting<Theme>('theme', 'dark');
		this._defaultZapAmount = loadSetting<number>('defaultZapAmount', 21);
	}
});
