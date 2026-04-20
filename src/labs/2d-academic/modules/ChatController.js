export class ChatController {
    constructor(engine) {
        this.engine = engine;
        this.setup();
    }

    setup() {
        const wrapper = document.getElementById('chat-container');
        const reopenBtn = document.getElementById('chat-reopen-btn');

        const headerToggle = document.getElementById('chat-header-toggle');
        if (headerToggle) {
            headerToggle.onclick = () => document.getElementById('chat-window').classList.toggle('closed');
        }

        const closeBtn = document.getElementById('chat-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                wrapper.style.display = 'none';
            };
        }

        if (reopenBtn) {
            reopenBtn.onclick = () => {
                wrapper.style.display = 'block';
                document.getElementById('chat-window').classList.remove('closed');
            };
        }

        const sendBtn = document.getElementById('chat-send');
        if (sendBtn) {
            sendBtn.onclick = () => this.send();
        }

        const inputField = document.getElementById('chat-input');
        if (inputField) {
            inputField.onkeydown = (e) => {
                if (e.key === 'Enter') this.send();
            };
        }

        document.querySelectorAll('.chat-chip').forEach(c => {
            c.onclick = () => {
                const input = document.getElementById('chat-input');
                if (input) {
                    input.value = c.innerText;
                    this.send();
                }
            };
        });
    }

    send() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        this.addMsg(text, 'user');
        input.value = '';
        setTimeout(() => this.addMsg(this.getSmartResponse(text), 'bot'), 600);
    }

    getSmartResponse(q) {
        const low = q.toLowerCase();
        if (low.includes("ньютон")) return "Законы Ньютона — фундамент механики. 1-й: инерция; 2-й: F=ma; 3-й: действие равно противодействию. В нашей симуляции 2-й закон работает при каждом взаимодействии объектов!";
        if (low.includes("мкт") || low.includes("газ")) return "Молекулярно-кинетическая теория объясняет макросвойства газа движением молекул. Температура в симуляции задает скорость частиц, а давление — частоту их ударов о стенки.";
        if (low.includes("снеллиус") || low.includes("отражен") || low.includes("зеркал") || low.includes("линз")) return "Оптика в TechPhys поддерживает зеркальное отражение и преломление в призмах. Используйте лазер и зеркала, чтобы увидеть ход лучей!";
        if (low.includes("заряд") || low.includes("поле") || low.includes("кулон")) return "Закон Кулона определяет силу взаимодействия зарядов. В нашей лаборатории электростатики вы видите векторное поле, которое показывает направление этой силы в каждой точке.";
        if (low.includes("как") || low.includes("помощ") || low.includes("инструкц")) return "Все просто! Выберите лабораторию сверху, добавьте объекты кнопками слева и перетаскивайте их мышкой. Следите за параметрами в инспекторе!";
        return "Интересный вопрос! На нашей платформе вы можете проверить это экспериментально прямо сейчас.";
    }

    addMsg(t, s) {
        const box = document.getElementById('chat-messages');
        if (!box) return;
        const div = document.createElement('div');
        div.className = `message ${s}`;
        div.innerText = t;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }
}
