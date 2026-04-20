export class MissionManager {
    constructor(engine) {
        this.engine = engine;
        this.missions = [
            // MECHANICS
            { id: 'm1', category: 'mechanics', title: { ru: "Первый закон", en: "First Law" }, desc: { ru: "Создайте шар массой более 5 кг", en: "Create a ball with mass > 5kg" }, check: () => (this.engine.labs.mechanics.objects || []).some(o => o.m > 5), done: false },
            { id: 'm2', category: 'mechanics', title: { ru: "Высокий полет", en: "High Flight" }, desc: { ru: "Поднимите объект выше 400px", en: "Lift an object above 400px" }, check: () => (this.engine.labs.mechanics.objects || []).some(o => o.pos.y < 100), done: false },
            { id: 'm3', category: 'mechanics', title: { ru: "Маятник", en: "Pendulum" }, desc: { ru: "Запустите сценарий 'Маятник'", en: "Load the 'Pendulum' preset" }, check: () => (this.engine.labs.mechanics.objects || []).some(o => o.type === 'pendulum'), done: false },
            { id: 'm4', category: 'mechanics', title: { ru: "Стартап", en: "Startup" }, desc: { ru: "Поставьте симуляцию на паузу", en: "Pause the simulation" }, check: () => this.engine.isPaused, done: false },

            // THERMO
            { id: 't1', category: 'thermo', title: { ru: "Нагрев", en: "Heating" }, desc: { ru: "Ускорьте время до 2.0x", en: "Set sim speed to 2.0x" }, check: () => this.engine.timeScale >= 2.0, done: false },
            { id: 't2', category: 'thermo', title: { ru: "Газовая атака", en: "Gas Attack" }, desc: { ru: "Перейдите во вкладку Термодинамики", en: "Switch to Thermodynamics tab" }, check: () => this.engine.activeLab === 'thermo', done: false },
            { id: 't3', category: 'thermo', title: { ru: "Идеальный газ", en: "Ideal Gas" }, desc: { ru: "Создайте более 50 частиц", en: "Spawn more than 50 particles" }, check: () => (this.engine.labs.thermo.particles || []).length > 50, done: false },
            { id: 't4', category: 'thermo', title: { ru: "Давление", en: "Pressure" }, desc: { ru: "Достигните давления > 100", en: "Reach pressure > 100" }, check: () => (this.engine.labs.thermo.pressure || 0) > 100, done: false },

            // OPTICS
            { id: 'o1', category: 'optics', title: { ru: "Да будет свет", en: "Let there be light" }, desc: { ru: "Включите лазер в Оптике", en: "Enable laser in Optics" }, check: () => this.engine.activeLab === 'optics' && (this.engine.labs.optics.lasers || []).length > 0, done: false },
            { id: 'o2', category: 'optics', title: { ru: "Отражение", en: "Reflection" }, desc: { ru: "Создайте зеркало", en: "Place a mirror" }, check: () => (this.engine.labs.optics.objects || []).some(o => o.type === 'mirror'), done: false },
            { id: 'o3', category: 'optics', title: { ru: "Угол падения", en: "Angle of Incidence" }, desc: { ru: "Поверните объект на 45°", en: "Rotate an object to 45°" }, check: () => (this.engine.selection && Math.abs(this.engine.selection.angle - Math.PI/4) < 0.1), done: false },
            { id: 'o4', category: 'optics', title: { ru: "Фокус", en: "Focus" }, desc: { ru: "Используйте линзу", en: "Use a lens" }, check: () => (this.engine.labs.optics.objects || []).some(o => o.type === 'lens'), done: false },
            
            // ELECTRO
            { id: 'e1', category: 'electro', title: { ru: "Заряд", en: "Charge" }, desc: { ru: "Разместите положительный заряд", en: "Place a positive charge" }, check: () => (this.engine.labs.electro.charges || []).some(c => c.q > 0), done: false }
        ];

        this.init();
    }

    init() {
        this.render();
        setInterval(() => this.update(), 1000);
    }

    update() {
        let changed = false;
        this.missions.forEach(m => {
            if (!m.done && m.check()) {
                m.done = true;
                changed = true;
                this.notify(m);
            }
        });
        if (changed) this.render();
    }

    notify(m) {
        const lang = document.documentElement.getAttribute('lang') || 'ru';
        const msg = document.createElement('div');
        msg.className = 'mission-toast';
        msg.innerHTML = `
            <div class="icon">🏆</div>
            <div class="text">
                <div class="title">${m.title[lang]}</div>
                <div class="desc">${m.desc[lang]}</div>
            </div>
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.classList.add('show'), 100);
        setTimeout(() => {
            msg.classList.remove('show');
            setTimeout(() => msg.remove(), 500);
        }, 4000);
    }

    render() {
        const container = document.getElementById('mission-list');
        if (!container) return;

        const lang = document.documentElement.getAttribute('lang') || 'ru';
        container.innerHTML = this.missions.map(m => `
            <div class="mission-item ${m.done ? 'done' : ''}">
                <div class="status-dot"></div>
                <div class="mission-info">
                    <div class="mission-title">${m.title[lang]}</div>
                    <div class="mission-desc">${m.desc[lang]}</div>
                </div>
            </div>
        `).join('');
    }
}
