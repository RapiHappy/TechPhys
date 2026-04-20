import { i18n } from './I18nManager.js';

/**
 * PremiumControls: Manages the high-end interaction for header toggles
 * Handles Language and Theme switching with smooth transitions
 */
export class PremiumControls {
    constructor() {
        this.init();
    }

    init() {
        this.langBtn = document.getElementById('lang-toggle');
        this.themeBtn = document.getElementById('theme-toggle');
        
        if (this.langBtn) {
            this.langBtn.innerText = i18n.lang.toUpperCase();
            this.langBtn.onclick = () => {
                const next = i18n.lang === 'ru' ? 'en' : 'ru';
                i18n.setLanguage(next);
            };
        }

        if (this.themeBtn) {
            this.themeBtn.innerText = i18n.theme === 'dark' ? '🌙' : '☀️';
            this.themeBtn.onclick = () => {
                const next = i18n.theme === 'dark' ? 'light' : 'dark';
                i18n.setTheme(next);
                this.updateThemeButton(next);
            };
        }

        // Global listener for theme changes from other sources
        window.addEventListener('techphys_theme_change', (e) => {
            this.updateThemeButton(e.detail.theme);
        });
    }

    updateThemeButton(theme) {
        if (!this.themeBtn) return;
        this.themeBtn.innerText = theme === 'dark' ? '🌙' : '☀️';
        this.themeBtn.classList.add('pop-animation');
        setTimeout(() => this.themeBtn.classList.remove('pop-animation'), 400);
    }
}
