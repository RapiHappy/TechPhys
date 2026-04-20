export class VoiceController {
    constructor(onCommandParsed, onStatusChange) {
        this.onCommandParsed = onCommandParsed;
        this.onStatusChange = onStatusChange;
        
        // Поддержка SpeechAPI в браузерах Chrome/Edge
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.supported = false;
            return;
        }
        
        this.supported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ru-RU'; // Русский язык парсинга
        this.recognition.continuous = false; // Отключается после каждой фразы
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.onStatusChange('start');
        };

        this.recognition.onend = () => {
            this.onStatusChange('end');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            this.parseCommand(transcript);
        };
    }

    startListening() {
        if (!this.supported) {
            this.onStatusChange('log-err', 'Ваш браузер не поддерживает Voice Web API.');
            return;
        }
        try {
            this.recognition.start();
        } catch (e) {
            console.log("Уже слушает", e);
        }
    }

    stopListening() {
        if (this.supported) this.recognition.stop();
    }

    parseCommand(text) {
        // Логируем фразу в терминал
        this.onStatusChange('log', `> Вы сказали: "${text}"`);
        
        // Простейший NLP-парсер на ключевых словах
        if (text.includes('очистить') || text.includes('сброс') || text.includes('удали')) {
            this.onCommandParsed({ action: 'CLEAR' });
            return;
        }

        if (text.includes('шар') || text.includes('сфер') || text.includes('создай')) {
            // Извлекаем первое попавшееся число как массу
            const nums = text.match(/\d+/g);
            let mass = 1; // Дефолтно 1 кг
            
            if (nums && nums.length > 0) {
                mass = parseInt(nums[0], 10);
            }
            
            // Если есть слово "скорость", берем второе число или дефолт 5м/с
            let speed = 0;
            if (text.includes('скорост')) {
                if (nums && nums.length > 1) {
                    speed = parseInt(nums[1], 10);
                } else {
                    speed = 5; 
                }
            }

            // Ограничитель, чтоб физика не сломалась от гигантских цифр
            mass = Math.min(Math.max(mass, 0.1), 100); 
            speed = Math.min(speed, 50);

            this.onCommandParsed({
                action: 'SPAWN_SPHERE',
                mass: mass,
                speed: speed
            });
            return;
        }

        this.onStatusChange('log-err', '>> ОШИБКА РАСПОЗНАВАНИЯ КОМАНДЫ.');
    }
}
