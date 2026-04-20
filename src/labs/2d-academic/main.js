import { Engine } from './modules/Engine.js';
import { LoaderEngine } from './modules/LoaderEngine.js';
import { TutorialManager } from './modules/TutorialManager.js';
import { MissionManager } from './modules/MissionManager.js';
import { PremiumControls } from '../../shared/PremiumControls.js';
import { i18n } from '../../shared/I18nManager.js';

window.onload = () => {
    let loader;
    try {
        loader = new LoaderEngine();
    } catch (e) {
        console.error("Loader failed:", e);
    }

    // Initial state from I18n
    i18n.applyTheme();

    const hidePreloader = () => {
        const preloader = document.getElementById('preloader');
        if (preloader && preloader.style.display !== 'none') {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
                if (loader) loader.stop();
            }, 1000);
        }
    };

    // Standard removal
    setTimeout(hidePreloader, 3500);
    
    // Fail-safe removal
    setTimeout(hidePreloader, 6000);

    try {
        window.engine = new Engine();
        window.tutorial = new TutorialManager();
        window.controls = new PremiumControls();
    } catch (err) {
        console.error("Engine Initialization Error:", err);
        hidePreloader(); // Ensure loader is gone even if engine crashes
    }
};
