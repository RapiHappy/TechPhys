import { Engine } from './modules/Engine.js';
import { LoaderEngine } from './modules/LoaderEngine.js';
import { TutorialManager } from './modules/TutorialManager.js';

window.onload = () => {
    const loader = new LoaderEngine();

    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
                loader.stop();
            }, 1000);
        }
    }, 3500);

    window.engine = new Engine();
    window.tutorial = new TutorialManager();
};
