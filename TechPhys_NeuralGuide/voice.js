// voice.js - "Мозг" и "Голос" проекта
export class VoiceController {
    constructor(onCommand, onStatus) {
        this.onCommand = onCommand;
        this.onStatus = onStatus;
        
        // === ВСТАВЛЯЙ СВОИ КЛЮЧИ СЮДА ===
        this.GEMINI_API_KEY = "AIzaSyDy4fVKvPs809AmgfWJnWPGIFbCbzpRKkI";
        this.ELEVENLABS_API_KEY = "sk_c1930799ee82a65a8ef0aa07668e8349a7ef78ea0ce16b07";
        this.VOICE_ID = "SdaWBr1v0KnnjnRCWTf9"; // Голос Adam (можно менять)
        // ================================

        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = 'ru-RU';
        this.recognition.interimResults = false;

        this.recognition.onstart = () => this.onStatus('start');
        this.recognition.onend = () => this.onStatus('end');
        
        this.recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            this.onStatus('log', `Вы сказали: "${text}"`);
            await this.processWithAI(text);
        };
    }

    async processWithAI(text) {
        try {
            // 1. Отправляем текст в Gemini (используем стабильный алиас)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Ты ИИ-физик. Переведи команду пользователя: "${text}" в JSON. 
                        Формат: {"action": "SPAWN_SPHERE", "mass": число, "speed": число, "reply": "краткий ответ"}. 
                        Если команда "удали" или "очисти", action: "CLEAR". Отвечай ТОЛЬКО чистым JSON без markdown разметки и кавычек кода.` }]}]
                })
            });

            const data = await response.json();

            // ЖЕСТКИЙ ОТЛОВ ОШИБОК GEMINI:
            if (!response.ok) {
                console.error("/// GEMINI API ERROR ///", data);
                throw new Error(`Отказ API Gemini: ${data.error?.message || response.statusText}`);
            }

            // 2. Безопасный парсинг ответа
            let rawText = data.candidates[0].content.parts[0].text;
            // Очищаем от лишнего мусора, если Gemini вдруг добавил markdown
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiResult = JSON.parse(rawText);

            // 3. Передаем команду в движок и озвучиваем (используемые имена колбэков адаптированы под архитектуру)
            this.onCommand(aiResult); 
            await this.speak(aiResult.reply);

        } catch (err) {
            this.onStatus('log-err', 'Мозг недоступен. Перехожу на базовое понимание.');
            console.error(err);
            
            // Если Gemini отвалился, система не умирает, а переходит на старые регулярные выражения!
            this.parseCommand(text); 
        }
    }

    // Резервная система регулярных выражений (Fallback-парсер)
    parseCommand(text) {
        const lowerText = text.toLowerCase();
        let mass = 1, speed = 0;
        
        // Парсинг массы
        const massRegex = /(?:масса|массу|весом)\s*(\d+|\w+)/i;
        const massMatch = lowerText.match(massRegex);
        if (massMatch) {
            const val = parseFloat(massMatch[1]);
            if (!isNaN(val)) mass = val;
            else if (massMatch[1] === "пять") mass = 5;
            else if (massMatch[1] === "десять") mass = 10;
        }
        
        // Поиск команд
        if (lowerText.includes("создай") || lowerText.includes("шар") || lowerText.includes("поставь")) {
            this.onCommand({ action: "SPAWN_SPHERE", mass: mass, speed: speed });
            this.speak(`Система экстренного протокола: Создана сфера массой ${mass} килограмм.`);
        } else if (lowerText.includes("очисти") || lowerText.includes("удали")) {
            this.onCommand({ action: "CLEAR" });
        } else {
            this.speak("Сбой интеллекта. Система слышит вас, но не понимает сложных конструкций.");
        }
    }

    async speak(message) {
        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.VOICE_ID}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.ELEVENLABS_API_KEY
                },
                body: JSON.stringify({
                    text: message,
                    model_id: "eleven_turbo_v2_5",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            });

            // Жесткий обработчик ошибок
            if (!response.ok) {
                const errText = await response.text();
                console.error("/// ELEVENLABS BLOCK ERROR ///\nStatus:", response.status, "\nMessage:", errText);
                throw new Error("Отказ API ElevenLabs");
            }

            const blob = await response.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            await audio.play();
        } catch (e) {
            // Фоллбэк на обычный голос, если API не сработало
            this.onStatus('log-err', 'API Голоса недоступно. Используем браузер.');
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'ru-RU';
            window.speechSynthesis.speak(utterance);
        }
    }

    startListening() {
        this.recognition.start();
    }
}
