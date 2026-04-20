/* ═══════════════════════════════════════════════════════════════
   TechPhys Sandbox v2.0 — Двухрежимный физический движок
   ─────────────────────────────────────────────────────────────
   Архитектура:
     ОБЩЕЕ:
       • Vec2              — 2D-вектор с полной алгеброй
     МЕХАНИКА:
       • RigidBody         — твёрдое тело (шар / гиря)
       • PhysicsWorld      — мир: гравитация, столкновения, рендер
       • Drag-and-Drop     — захват, швырок с передачей импульса
       • Векторы           — отрисовка стрелок mg и v
     ТЕРМОДИНАМИКА:
       • Particle           — отдельная молекула идеального газа
       • GasSimulation      — сосуд, температура, объём, давление
     МОДУЛЬ ТЕОРИИ:
       • TheoryContent      — тексты законов (Механика / МКТ)
   
   Интеграция: Symplectic Euler (полу-неявный)
   Без сторонних библиотек — 100% чистый JavaScript
   ═══════════════════════════════════════════════════════════════ */

'use strict';


// ─────────────────────────────────────────────────────────────
// 1. КЛАСС Vec2 — Двумерный вектор (общий для обоих режимов)
// ─────────────────────────────────────────────────────────────

class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /** Сложение векторов */
    add(other) { return new Vec2(this.x + other.x, this.y + other.y); }

    /** Вычитание векторов */
    sub(other) { return new Vec2(this.x - other.x, this.y - other.y); }

    /** Умножение на скаляр */
    scale(s) { return new Vec2(this.x * s, this.y * s); }

    /** Модуль (длина) вектора */
    magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }

    /** Единичный (нормализованный) вектор */
    normalize() {
        const m = this.magnitude();
        return m === 0 ? new Vec2(0, 0) : this.scale(1 / m);
    }

    /** Скалярное произведение */
    dot(other) { return this.x * other.x + this.y * other.y; }

    /** Глубокая копия */
    clone() { return new Vec2(this.x, this.y); }
}


// ═══════════════════════════════════════════════════════════════
//
//   РАЗДЕЛ A: МЕХАНИКА — классы RigidBody и PhysicsWorld
//
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// 2. КЛАСС RigidBody — Твёрдое тело (механика)
// ─────────────────────────────────────────────────────────────

class RigidBody {
    /**
     * @param {Object} opts
     * @param {'circle'|'rect'} opts.shape — форма
     * @param {number} opts.x, opts.y — начальная позиция
     * @param {number} opts.mass — масса (кг)
     * @param {number} opts.radius | opts.width, opts.height — размеры
     */
    constructor(opts) {
        this.shape    = opts.shape || 'circle';
        this.position = new Vec2(opts.x || 100, opts.y || 100);
        this.velocity = new Vec2(0, 0);
        this.acceleration = new Vec2(0, 0);
        this.mass     = opts.mass || 1;

        if (this.shape === 'circle') {
            this.radius = opts.radius || 22;
        } else {
            this.width  = opts.width  || 44;
            this.height = opts.height || 44;
        }

        this.id = RigidBody._nextId++;
        this.isDragged = false;

        // Цвета: шар — Cyan, гиря — Magenta
        this.color     = this.shape === 'circle' ? 'rgba(0,229,255,0.85)' : 'rgba(224,64,251,0.85)';
        this.glowColor = this.shape === 'circle' ? 'rgba(0,229,255,0.3)'  : 'rgba(224,64,251,0.3)';

        // След траектории
        this.trail = [];
        this.maxTrailLength = 60;
    }

    /**
     * Интегрирование методом Symplectic Euler:
     *   v(t+dt) = v(t) + a(t)·dt
     *   x(t+dt) = x(t) + v(t+dt)·dt
     * Симплектический Эйлер лучше классического сохраняет энергию.
     */
    integrate(dt) {
        if (this.isDragged) return;
        this.velocity = this.velocity.add(this.acceleration.scale(dt));
        this.position = this.position.add(this.velocity.scale(dt));
        this.trail.push(this.position.clone());
        if (this.trail.length > this.maxTrailLength) this.trail.shift();
    }

    /** AABB (Axis-Aligned Bounding Box) для столкновений */
    getAABB() {
        if (this.shape === 'circle') {
            return {
                left:   this.position.x - this.radius,
                right:  this.position.x + this.radius,
                top:    this.position.y - this.radius,
                bottom: this.position.y + this.radius
            };
        }
        return {
            left:   this.position.x - this.width / 2,
            right:  this.position.x + this.width / 2,
            top:    this.position.y - this.height / 2,
            bottom: this.position.y + this.height / 2
        };
    }

    /** Эффективный радиус (для столкновений между телами) */
    getEffectiveRadius() {
        return this.shape === 'circle'
            ? this.radius
            : Math.sqrt(this.width * this.width + this.height * this.height) / 2;
    }
}

RigidBody._nextId = 0;


// ─────────────────────────────────────────────────────────────
// 3. КЛАСС PhysicsWorld — Механический мир
// ─────────────────────────────────────────────────────────────

class PhysicsWorld {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bodies = [];

        // Физические параметры
        this.gravity     = 9.81;
        this.friction    = 0.02;
        this.restitution = 0.75;
        this.SCALE       = 50;   // 1 метр = 50 пикселей
        this.fixedDt     = 1 / 60;
        this.paused      = false;

        // Визуализация
        this.showVectors = true;
        this.showGrid    = true;
        this.showTrails  = true;

        // Выбранное тело
        this.selectedBody = null;

        // Мышь (Drag-and-Drop)
        this.mouse = {
            x: 0, y: 0,
            isDown: false,
            dragBody: null,
            prevPositions: [],
            maxPrevPositions: 5
        };

        // FPS
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTime = 0;

        this.resizeCanvas();
        this.bindEvents();
    }

    // ═══ 3.1 Размер Canvas ═══

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const rect = wrapper.getBoundingClientRect();
        this.canvas.width  = rect.width  * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width  = rect.width  + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width  = rect.width;
        this.height = rect.height;
    }

    // ═══ 3.2 Привязка событий мыши ═══

    bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());

        // Нажатие — захват тела
        this.canvas.addEventListener('mousedown', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - r.left;
            this.mouse.y = e.clientY - r.top;
            this.mouse.isDown = true;
            this.mouse.prevPositions = [];

            const body = this.getBodyAt(this.mouse.x, this.mouse.y);
            if (body) {
                body.isDragged = true;
                body.velocity = new Vec2(0, 0);
                this.mouse.dragBody = body;
                this.selectedBody = body;
                this.canvas.style.cursor = 'grabbing';
            }
        });

        // Перемещение — перетаскивание
        this.canvas.addEventListener('mousemove', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - r.left;
            this.mouse.y = e.clientY - r.top;

            if (this.mouse.dragBody) {
                this.mouse.dragBody.position.x = this.mouse.x;
                this.mouse.dragBody.position.y = this.mouse.y;
                this.mouse.prevPositions.push({ x: this.mouse.x, y: this.mouse.y, time: performance.now() });
                if (this.mouse.prevPositions.length > this.mouse.maxPrevPositions)
                    this.mouse.prevPositions.shift();
            } else {
                this.canvas.style.cursor = this.getBodyAt(this.mouse.x, this.mouse.y) ? 'grab' : 'crosshair';
            }
        });

        // Отпускание — швырок
        this.canvas.addEventListener('mouseup', () => {
            if (this.mouse.dragBody) {
                this.applyThrowVelocity(this.mouse.dragBody);
                this.mouse.dragBody.isDragged = false;
                this.mouse.dragBody = null;
            }
            this.mouse.isDown = false;
            this.canvas.style.cursor = 'crosshair';
        });

        // Покидание Canvas
        this.canvas.addEventListener('mouseleave', () => {
            if (this.mouse.dragBody) {
                this.applyThrowVelocity(this.mouse.dragBody);
                this.mouse.dragBody.isDragged = false;
                this.mouse.dragBody = null;
            }
            this.mouse.isDown = false;
            this.canvas.style.cursor = 'crosshair';
        });

        // Клик — выбор тела в инспекторе
        this.canvas.addEventListener('click', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.selectedBody = this.getBodyAt(e.clientX - r.left, e.clientY - r.top);
        });
    }

    // ═══ 3.3 Поиск тела под курсором ═══

    getBodyAt(x, y) {
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            const b = this.bodies[i];
            if (b.shape === 'circle') {
                const dx = x - b.position.x, dy = y - b.position.y;
                if (dx * dx + dy * dy <= b.radius * b.radius) return b;
            } else {
                const a = b.getAABB();
                if (x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) return b;
            }
        }
        return null;
    }

    // ═══ 3.4 Расчёт скорости «швырка» ═══

    applyThrowVelocity(body) {
        const pos = this.mouse.prevPositions;
        if (pos.length < 2) return;
        const first = pos[0], last = pos[pos.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt <= 0) return;
        let vx = (last.x - first.x) / dt;
        let vy = (last.y - first.y) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);
        const maxSpeed = 1500;
        if (speed > maxSpeed) { const f = maxSpeed / speed; vx *= f; vy *= f; }
        body.velocity = new Vec2(vx, vy);
    }

    // ═══ 3.5 Управление телами ═══

    addBody(body) { this.bodies.push(body); }
    clearBodies() { this.bodies = []; this.selectedBody = null; }

    // ═══ 3.6 Шаг физики ═══

    step() {
        if (this.paused) return;
        const dt = this.fixedDt;

        for (const body of this.bodies) {
            if (body.isDragged) continue;

            // Гравитация → ускорение (переводим м/с² в пиксели/с²)
            body.acceleration = new Vec2(0, this.gravity * this.SCALE);

            // Symplectic Euler
            body.integrate(dt);

            // Демпфирование (сопротивление среды)
            body.velocity = body.velocity.scale(1 - this.friction);
        }

        this.resolveWallCollisions();
        this.resolveBodyCollisions();
    }

    // ═══ 3.7 Столкновения со стенами ═══

    resolveWallCollisions() {
        const W = this.width, H = this.height, e = this.restitution;

        for (const body of this.bodies) {
            if (body.isDragged) continue;
            const aabb = body.getAABB();

            // Пол
            if (aabb.bottom > H) {
                body.position.y = body.shape === 'circle' ? H - body.radius : H - body.height / 2;
                body.velocity.y = -body.velocity.y * e;
                if (Math.abs(body.velocity.y) < 5) body.velocity.y = 0;
            }
            // Потолок
            if (aabb.top < 0) {
                body.position.y = body.shape === 'circle' ? body.radius : body.height / 2;
                body.velocity.y = -body.velocity.y * e;
            }
            // Левая
            if (aabb.left < 0) {
                body.position.x = body.shape === 'circle' ? body.radius : body.width / 2;
                body.velocity.x = -body.velocity.x * e;
            }
            // Правая
            if (aabb.right > W) {
                body.position.x = body.shape === 'circle' ? W - body.radius : W - body.width / 2;
                body.velocity.x = -body.velocity.x * e;
            }
        }
    }

    // ═══ 3.8 Столкновения между телами (импульсный метод) ═══

    resolveBodyCollisions() {
        const bodies = this.bodies, e = this.restitution;

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i], b = bodies[j];
                const delta = a.position.sub(b.position);
                const dist = delta.magnitude();
                const minDist = a.getEffectiveRadius() + b.getEffectiveRadius();

                if (dist < minDist && dist > 0) {
                    const normal = delta.normalize();
                    const overlap = minDist - dist;
                    const totalMass = a.mass + b.mass;

                    // Разделение тел
                    if (!a.isDragged) a.position = a.position.add(normal.scale(overlap * b.mass / totalMass));
                    if (!b.isDragged) b.position = b.position.sub(normal.scale(overlap * a.mass / totalMass));

                    // Импульс
                    const relVel = a.velocity.sub(b.velocity);
                    const velNorm = relVel.dot(normal);
                    if (velNorm > 0) continue;

                    const impulse = -(1 + e) * velNorm / totalMass;
                    const impVec = normal.scale(impulse);

                    if (!a.isDragged) a.velocity = a.velocity.add(impVec.scale(b.mass));
                    if (!b.isDragged) b.velocity = b.velocity.sub(impVec.scale(a.mass));
                }
            }
        }
    }

    // ═══ 3.9 Рендеринг механики ═══

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        if (this.showGrid) this.drawGrid();
        if (this.showTrails) this.drawTrails();

        for (const body of this.bodies) {
            this.drawBody(body);
            if (this.showVectors && !body.isDragged) this.drawBodyVectors(body);
        }

        if (this.selectedBody) this.drawSelectionHighlight(this.selectedBody);
    }

    // ─── Координатная сетка ───

    drawGrid() {
        const ctx = this.ctx, W = this.width, H = this.height, step = this.SCALE;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        // Линия «земли»
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
        ctx.restore();
    }

    // ─── Следы траекторий ───

    drawTrails() {
        const ctx = this.ctx;
        for (const body of this.bodies) {
            if (body.trail.length < 2) continue;
            ctx.save();
            ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            for (let i = 1; i < body.trail.length; i++) {
                const alpha = (i / body.trail.length) * 0.35;
                ctx.strokeStyle = body.shape === 'circle'
                    ? `rgba(0,229,255,${alpha})` : `rgba(224,64,251,${alpha})`;
                ctx.beginPath();
                ctx.moveTo(body.trail[i - 1].x, body.trail[i - 1].y);
                ctx.lineTo(body.trail[i].x, body.trail[i].y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ─── Отрисовка одного тела ───

    drawBody(body) {
        const ctx = this.ctx;
        ctx.save();
        ctx.shadowColor = body.glowColor;
        ctx.shadowBlur = 15;

        if (body.shape === 'circle') {
            const grad = ctx.createRadialGradient(
                body.position.x - body.radius * 0.3, body.position.y - body.radius * 0.3, body.radius * 0.1,
                body.position.x, body.position.y, body.radius
            );
            grad.addColorStop(0, 'rgba(100,240,255,0.95)');
            grad.addColorStop(1, body.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(0,229,255,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            const x = body.position.x - body.width / 2, y = body.position.y - body.height / 2;
            const grad = ctx.createLinearGradient(x, y, x + body.width, y + body.height);
            grad.addColorStop(0, 'rgba(240,130,255,0.9)');
            grad.addColorStop(1, body.color);
            ctx.fillStyle = grad;
            this.roundRect(ctx, x, y, body.width, body.height, 3);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(224,64,251,0.5)';
            ctx.lineWidth = 1;
            this.roundRect(ctx, x, y, body.width, body.height, 3);
            ctx.stroke();
        }

        // Подпись массы
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(body.mass.toFixed(1) + ' кг', body.position.x, body.position.y);
        ctx.restore();
    }

    /** Скруглённый прямоугольник */
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ─── Подсветка выбранного тела ───

    drawSelectionHighlight(body) {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        if (body.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(body.position.x, body.position.y, body.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            this.roundRect(ctx, body.position.x - body.width / 2 - 6, body.position.y - body.height / 2 - 6,
                body.width + 12, body.height + 12, 5);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ═══ 3.10 Векторная визуализация ═══

    drawBodyVectors(body) {
        const cx = body.position.x, cy = body.position.y;

        // Вектор mg (Magenta) — вниз, длина ∝ массе
        const mgLen = body.mass * 4;
        this.drawVector(cx, cy, cx, cy + mgLen, '#e040fb', 'rgba(224,64,251,0.4)', 'mg');

        // Вектор v (Cyan) — по направлению движения
        const vScale = 0.08;
        const vx = body.velocity.x * vScale, vy = body.velocity.y * vScale;
        if (Math.sqrt(vx * vx + vy * vy) > 2) {
            this.drawVector(cx, cy, cx + vx, cy + vy, '#00e5ff', 'rgba(0,229,255,0.4)', 'v');
        }
    }

    /**
     * Универсальная отрисовка вектора-стрелки.
     * @param {number} x1,y1 — начало
     * @param {number} x2,y2 — конец (острие)
     * @param {string} color — цвет
     * @param {string} glow — цвет свечения
     * @param {string} label — подпись
     */
    drawVector(x1, y1, x2, y2, color, glow, label) {
        const ctx = this.ctx;
        const dx = x2 - x1, dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1) return;

        const angle = Math.atan2(dy, dx);
        const headLen = Math.min(12, length * 0.35);
        const headAng = Math.PI / 6;

        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Линия
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

        // Наконечник
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - headAng), y2 - headLen * Math.sin(angle - headAng));
        ctx.lineTo(x2 - headLen * Math.cos(angle + headAng), y2 - headLen * Math.sin(angle + headAng));
        ctx.closePath(); ctx.fill();

        // Подпись
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const lx = x2 + 10 * Math.cos(angle), ly = y2 + 10 * Math.sin(angle);
        const m = ctx.measureText(label);
        ctx.fillStyle = 'rgba(6,8,13,0.7)';
        ctx.fillRect(lx - 2, ly - 7, m.width + 4, 14);
        ctx.fillStyle = color;
        ctx.fillText(label, lx, ly);
        ctx.restore();
    }

    // ═══ 3.11 Расчёт физических величин (инспектор) ═══

    getBodyPhysics(body) {
        const vx_m = body.velocity.x / this.SCALE;
        const vy_m = body.velocity.y / this.SCALE;
        const speed = Math.sqrt(vx_m * vx_m + vy_m * vy_m);
        const h = (this.height - body.position.y) / this.SCALE;
        const Ek = 0.5 * body.mass * speed * speed;
        const Ep = body.mass * this.gravity * Math.max(0, h);
        return {
            mass: body.mass, speed, vx: vx_m, vy: vy_m,
            height: Math.max(0, h), Ek, Ep, E: Ek + Ep,
            posX: (body.position.x / this.SCALE).toFixed(1),
            posY: h.toFixed(1)
        };
    }
}


// ═══════════════════════════════════════════════════════════════
//
//   РАЗДЕЛ B: ТЕРМОДИНАМИКА — классы Particle и GasSimulation
//
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
// 4. КЛАСС Particle — Молекула идеального газа
// ─────────────────────────────────────────────────────────────
// Каждая молекула — маленький кружок со скоростью.
// Скорость задаётся случайно, затем масштабируется
// по ползунку температуры.
// ─────────────────────────────────────────────────────────────

class Particle {
    /**
     * @param {number} x — позиция X (пиксели)
     * @param {number} y — позиция Y (пиксели)
     * @param {number} speedScale — множитель скорости (от температуры)
     */
    constructor(x, y, speedScale) {
        this.x = x;
        this.y = y;
        this.radius = 3;

        // Случайный угол → начальная скорость
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = 30 + Math.random() * 60; // базовая скорость (пиксели/с)
        this.vx = Math.cos(angle) * baseSpeed * speedScale;
        this.vy = Math.sin(angle) * baseSpeed * speedScale;
    }
}


// ─────────────────────────────────────────────────────────────
// 5. КЛАСС GasSimulation — Симуляция идеального газа
// ─────────────────────────────────────────────────────────────
// Управляет частицами: спавн, движение, отскоки от стенок
// сосуда, подсчёт давления (ударов в секунду).
// ─────────────────────────────────────────────────────────────

class GasSimulation {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.particles = [];
        this.temperature = 30;    // 1..100
        this.volume = 80;         // 50..100 (% ширины)

        // Счётчик ударов о стенки (для давления)
        this.wallHits = 0;
        this.pressure = 0;           // удары/сек
        this.pressureTimer = 0;      // накопитель времени

        // Размер Canvas (обновляется из resizeCanvas)
        this.width = 0;
        this.height = 0;

        this.resizeCanvas();
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const rect = wrapper.getBoundingClientRect();
        this.canvas.width  = rect.width  * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width  = rect.width  + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width  = rect.width;
        this.height = rect.height;
    }

    /**
     * Возвращает прямоугольник сосуда в пикселях.
     * Сосуд центрирован, высота фиксирована, ширина зависит от volume%.
     */
    getVessel() {
        const margin = 40;
        const maxW = this.width - margin * 2;
        const maxH = this.height - margin * 2;
        const w = maxW * (this.volume / 100);
        const h = maxH * 0.85;
        const x = (this.width - w) / 2;
        const y = (this.height - h) / 2;
        return { x, y, w, h };
    }

    /**
     * Добавляет N молекул внутри сосуда.
     * @param {number} n — количество
     */
    addParticles(n) {
        const v = this.getVessel();
        const speedScale = this.getSpeedScale();
        for (let i = 0; i < n; i++) {
            const px = v.x + 10 + Math.random() * (v.w - 20);
            const py = v.y + 10 + Math.random() * (v.h - 20);
            this.particles.push(new Particle(px, py, speedScale));
        }
    }

    /** Убрать все молекулы */
    clearParticles() {
        this.particles = [];
        this.wallHits = 0;
        this.pressure = 0;
    }

    /**
     * Множитель скорости на основе температуры.
     * T=1 → медленно (0.3x), T=100 → быстро (3.5x).
     * Используем √T для физически корректной связи (Eₖ ∝ T).
     */
    getSpeedScale() {
        return 0.3 + (this.temperature / 100) * 3.2;
    }

    /**
     * Обновляет скорости всех частиц при изменении температуры.
     * Масштабируем текущую скорость каждой молекулы так,
     * чтобы средняя кинетическая энергия соответствовала T.
     */
    applyTemperature() {
        const targetScale = this.getSpeedScale();
        for (const p of this.particles) {
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed < 0.01) continue;

            // Средняя скорость в «базовых» единицах ~ 60 px/s
            const targetSpeed = 60 * targetScale;
            const factor = targetSpeed / speed;

            // Плавно приближаем к целевой скорости (lerp)
            const lerpFactor = 0.05;
            p.vx *= 1 + (factor - 1) * lerpFactor;
            p.vy *= 1 + (factor - 1) * lerpFactor;
        }
    }

    /**
     * Шаг симуляции: двигаем частицы, обрабатываем столкновения
     * со стенками сосуда, считаем удары.
     * @param {number} dt — шаг времени (секунды)
     */
    step(dt) {
        const v = this.getVessel();
        const left   = v.x;
        const right  = v.x + v.w;
        const top    = v.y;
        const bottom = v.y + v.h;

        // Подсчёт давления: обнуляем каждую секунду
        this.pressureTimer += dt;
        if (this.pressureTimer >= 1.0) {
            this.pressure = this.wallHits;
            this.wallHits = 0;
            this.pressureTimer = 0;
        }

        for (const p of this.particles) {
            // Движение
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Столкновения со стенками сосуда (абсолютно упругие)
            if (p.x - p.radius < left) {
                p.x = left + p.radius;
                p.vx = Math.abs(p.vx);
                this.wallHits++;
            }
            if (p.x + p.radius > right) {
                p.x = right - p.radius;
                p.vx = -Math.abs(p.vx);
                this.wallHits++;
            }
            if (p.y - p.radius < top) {
                p.y = top + p.radius;
                p.vy = Math.abs(p.vy);
                this.wallHits++;
            }
            if (p.y + p.radius > bottom) {
                p.y = bottom - p.radius;
                p.vy = -Math.abs(p.vy);
                this.wallHits++;
            }
        }

        // Плавная подстройка скоростей под текущую температуру
        this.applyTemperature();
    }

    /**
     * Средняя кинетическая энергия частиц:
     * <Eₖ> = ½ m <v²> (m условная = 1)
     */
    getAverageKineticEnergy() {
        if (this.particles.length === 0) return 0;
        let totalV2 = 0;
        for (const p of this.particles) {
            totalV2 += p.vx * p.vx + p.vy * p.vy;
        }
        return 0.5 * (totalV2 / this.particles.length);
    }

    /**
     * Цвет частицы в зависимости от температуры.
     * T=1 → холодный голубой, T=50 → жёлтый, T=100 → яркий красный.
     * Используем HSL с плавным переходом hue 210→60→0.
     */
    getParticleColor(alpha = 1) {
        const t = this.temperature / 100; // 0..1
        // Hue: от 210 (синий) через 60 (жёлтый) к 0 (красный)
        const hue = 210 - t * 210;
        const sat = 80 + t * 20;   // насыщенность растёт
        const lit = 50 + t * 15;   // яркость растёт
        return `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`;
    }

    /** Цвет свечения частицы */
    getParticleGlow() {
        const t = this.temperature / 100;
        const hue = 210 - t * 210;
        return `hsla(${hue}, 90%, 60%, 0.4)`;
    }

    // ═══ Рендер термодинамики ═══

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // ─── Сосуд ───
        this.drawVessel();

        // ─── Частицы ───
        this.drawParticles();
    }

    drawVessel() {
        const ctx = this.ctx;
        const v = this.getVessel();

        ctx.save();

        // Фон сосуда — очень тонкий
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(v.x, v.y, v.w, v.h);

        // Стенки сосуда (белый контур)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(v.x, v.y, v.w, v.h);

        // Подпись «Сосуд» сверху
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Сосуд · V = ${this.volume}%`, v.x + v.w / 2, v.y - 10);

        // Маркеры на стенках (давление — мигающие засечки)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        const tickStep = 30;
        for (let y = v.y + tickStep; y < v.y + v.h; y += tickStep) {
            ctx.beginPath(); ctx.moveTo(v.x, y); ctx.lineTo(v.x + 8, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(v.x + v.w, y); ctx.lineTo(v.x + v.w - 8, y); ctx.stroke();
        }

        ctx.restore();
    }

    drawParticles() {
        const ctx = this.ctx;
        const color = this.getParticleColor(0.9);
        const glow  = this.getParticleGlow();

        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;

        for (const p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}


// ═══════════════════════════════════════════════════════════════
//
//   РАЗДЕЛ C: МОДУЛЬ ТЕОРИИ — HTML-контент для модального окна
//
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 6. Объект TheoryContent — тексты для двух вкладок
// ─────────────────────────────────────────────────────────────

const TheoryContent = {

    // ─── Теория для вкладки «Механика» ───
    mechanics: `
        <h3>⚙ Законы Ньютона</h3>
        <p><strong>Первый закон (инерция):</strong> тело сохраняет скорость, если на него не действуют силы. В симуляции: объект без гравитации и трения двигается равномерно и прямолинейно.</p>
        <p><strong>Второй закон:</strong> <span class="formula">F = m · a</span> — ускорение прямо пропорционально силе и обратно пропорционально массе. Вектор <span class="formula-magenta formula">mg</span> (пурпурный) визуализирует силу тяжести, действующую на тело.</p>
        <p><strong>Третий закон:</strong> при столкновении двух тел импульс передаётся по формуле с учётом масс обоих тел.</p>

        <h3>⚡ Закон сохранения энергии</h3>
        <p>Полная механическая энергия замкнутой системы постоянна:</p>
        <p><span class="formula">E = Eₖ + Eₚ = const</span></p>
        <ul>
            <li><strong>Кинетическая энергия:</strong> <span class="formula">Eₖ = ½mv²</span> — зависит от скорости (вектор <span class="formula">v</span>, голубой).</li>
            <li><strong>Потенциальная энергия:</strong> <span class="formula-magenta formula">Eₚ = mgh</span> — зависит от высоты тела над «землёй».</li>
        </ul>
        <p>При падении Eₚ переходит в Eₖ, при подъёме — наоборот. В реальной системе часть энергии теряется на трение (коэффициент μ) и неупругость удара (коэффициент e).</p>

        <h3>🎨 Цветовое кодирование векторов</h3>
        <ul>
            <li><span class="formula-magenta formula">mg</span> — <strong>Пурпурный</strong> — сила тяжести. Всегда направлен строго вниз. Длина пропорциональна массе тела.</li>
            <li><span class="formula">v</span> — <strong>Голубой (Cyan)</strong> — вектор скорости. Направлен по касательной к траектории. Длина пропорциональна модулю скорости.</li>
        </ul>

        <h3>📐 Интеграция Symplectic Euler</h3>
        <p>Для расчёта движения используется <strong>симплектический метод Эйлера</strong>:</p>
        <p><span class="formula">v(t+Δt) = v(t) + a(t)·Δt</span></p>
        <p><span class="formula">x(t+Δt) = x(t) + v(t+Δt)·Δt</span></p>
        <p>Ключевое отличие от классического Эйлера: позиция обновляется по <em>новой</em> скорости, что значительно лучше сохраняет энергию системы.</p>
    `,

    // ─── Теория для вкладки «Термодинамика» ───
    thermo: `
        <h3>🔥 Молекулярно-кинетическая теория (МКТ)</h3>
        <p>Все вещества состоят из молекул, которые находятся в непрерывном <strong>хаотическом движении</strong>. Это движение называется <em>тепловым</em>.</p>
        <p>Основные положения МКТ:</p>
        <ul>
            <li>Все вещества состоят из мельчайших частиц (молекул, атомов).</li>
            <li>Частицы непрерывно и хаотически двигаются.</li>
            <li>Частицы взаимодействуют друг с другом (притяжение/отталкивание).</li>
        </ul>

        <h3>🌡 Температура и скорость молекул</h3>
        <p>Температура — это мера <strong>средней кинетической энергии</strong> молекул:</p>
        <p><span class="formula-orange formula">⟨Eₖ⟩ = ³⁄₂ · k · T</span></p>
        <p>где <strong>k</strong> — постоянная Больцмана, <strong>T</strong> — абсолютная температура.</p>
        <p>Чем выше температура → тем быстрее двигаются молекулы → тем «горячее» их цвет в симуляции (от <span style="color:#4488ff;">синего</span> к <span style="color:#ff4444;">красному</span>).</p>

        <h3>📊 Давление газа</h3>
        <p><strong>Давление</strong> — результат ударов молекул о стенки сосуда:</p>
        <p><span class="formula">P = F / S = Δp / (Δt · S)</span></p>
        <p>В симуляции давление измеряется как <strong>количество ударов молекул о стенки в секунду</strong>. Факторы, увеличивающие давление:</p>
        <ul>
            <li><strong>↑ Температура</strong> → молекулы быстрее → чаще бьются о стенки.</li>
            <li><strong>↓ Объём</strong> → сосуд меньше → чаще столкновения.</li>
            <li><strong>↑ Количество частиц</strong> → больше ударов.</li>
        </ul>

        <h3>⚖ Уравнение состояния идеального газа</h3>
        <p>Закон Менделеева-Клапейрона связывает P, V и T:</p>
        <p><span class="formula-orange formula">P · V = N · k · T</span></p>
        <p>В симуляции вы можете наблюдать эту связь: уменьшая объём при постоянной температуре, давление растёт (закон Бойля-Мариотта).</p>
    `
};


// ═══════════════════════════════════════════════════════════════
//
//   РАЗДЕЛ D: ИНИЦИАЛИЗАЦИЯ — связь UI ↔ движка
//
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ─── Canvas и оба движка ───
    const canvas = document.getElementById('physics-canvas');
    const world  = new PhysicsWorld(canvas);    // Механика
    const gas    = new GasSimulation(canvas);   // Термодинамика

    // Активная вкладка: 'mechanics' | 'thermo'
    let activeTab = 'mechanics';

    // ─── Элементы управления: вкладки ───
    const tabBtns      = document.querySelectorAll('.tab-btn');
    const ctrlMech     = document.getElementById('controls-mechanics');
    const ctrlThermo   = document.getElementById('controls-thermo');
    const inspMech     = document.getElementById('inspector-mechanics');
    const inspThermo   = document.getElementById('inspector-thermo');

    // ─── Механика: кнопки ───
    const btnCreateBall = document.getElementById('btn-create-ball');
    const btnCreateBox  = document.getElementById('btn-create-box');
    const btnPause      = document.getElementById('btn-pause');
    const btnClear      = document.getElementById('btn-clear');

    // ─── Механика: ползунки ───
    const sliderGravity     = document.getElementById('slider-gravity');
    const sliderFriction    = document.getElementById('slider-friction');
    const sliderRestitution = document.getElementById('slider-restitution');
    const sliderMass        = document.getElementById('slider-mass');
    const valGravity     = document.getElementById('val-gravity');
    const valFriction    = document.getElementById('val-friction');
    const valRestitution = document.getElementById('val-restitution');
    const valMass        = document.getElementById('val-mass');

    // ─── Механика: переключатели визуализации ───
    const toggleVectors = document.getElementById('toggle-vectors');
    const toggleGrid    = document.getElementById('toggle-grid');
    const toggleTrails  = document.getElementById('toggle-trails');

    // ─── Механика: инспектор ───
    const inspectorEmpty = document.getElementById('inspector-empty');
    const inspectorData  = document.getElementById('inspector-data');
    const inspectShape   = document.getElementById('inspect-shape');
    const inspectType    = document.getElementById('inspect-type');
    const inspectMass    = document.getElementById('inspect-mass');
    const inspectVel     = document.getElementById('inspect-velocity');
    const inspectVx      = document.getElementById('inspect-vx');
    const inspectVy      = document.getElementById('inspect-vy');
    const inspectEk      = document.getElementById('inspect-ek');
    const inspectEp      = document.getElementById('inspect-ep');
    const inspectEtotal  = document.getElementById('inspect-etotal');
    const inspectHeight  = document.getElementById('inspect-height');
    const inspectX       = document.getElementById('inspect-x');
    const inspectY       = document.getElementById('inspect-y');

    // ─── Термодинамика: кнопки и ползунки ───
    const btnAddMols     = document.getElementById('btn-add-molecules');
    const btnClearGas    = document.getElementById('btn-clear-gas');
    const sliderTemp     = document.getElementById('slider-temperature');
    const sliderVolume   = document.getElementById('slider-volume');
    const valTemp        = document.getElementById('val-temperature');
    const valVolume      = document.getElementById('val-volume');

    // ─── Термодинамика: инспектор ───
    const thermoCount    = document.getElementById('thermo-count');
    const thermoAvgEk    = document.getElementById('thermo-avg-ek');
    const thermoPressure = document.getElementById('thermo-pressure');
    const thermoTempDisp = document.getElementById('thermo-temp-display');
    const thermoVolDisp  = document.getElementById('thermo-vol-display');

    // ─── Общие элементы ───
    const fpsCounter  = document.getElementById('fps-counter');
    const bodyCount   = document.getElementById('body-count');
    const overlayHint = document.getElementById('canvas-overlay-hint');

    // ─── Теория: модальное окно ───
    const btnTheory       = document.getElementById('btn-theory');
    const theoryOverlay   = document.getElementById('theory-overlay');
    const btnCloseTheory  = document.getElementById('btn-close-theory');
    const theoryTitle     = document.getElementById('theory-title');
    const theoryBody      = document.getElementById('theory-body');


    // ═══════════════════════════════════════════════════════
    //  D.1 ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
    // ═══════════════════════════════════════════════════════

    function switchTab(tab) {
        activeTab = tab;

        // Обновляем кнопки вкладок
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Переключаем содержимое левой панели
        ctrlMech.classList.toggle('active', tab === 'mechanics');
        ctrlThermo.classList.toggle('active', tab === 'thermo');

        // Переключаем инспектор
        inspMech.classList.toggle('active', tab === 'mechanics');
        inspThermo.classList.toggle('active', tab === 'thermo');

        // Обновляем подсказку на Canvas
        if (tab === 'mechanics') {
            overlayHint.textContent = 'Создайте объект и перетаскивайте его мышью';
            if (world.bodies.length > 0) overlayHint.style.opacity = '0';
        } else {
            overlayHint.textContent = 'Добавьте молекулы и наблюдайте за газом';
            if (gas.particles.length > 0) overlayHint.style.opacity = '0';
            else overlayHint.style.opacity = '0.6';
        }
    }

    // Обработчики кликов по вкладкам
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });


    // ═══════════════════════════════════════════════════════
    //  D.2 МОДАЛЬНОЕ ОКНО ТЕОРИИ
    // ═══════════════════════════════════════════════════════

    btnTheory.addEventListener('click', () => {
        // Заполняем контент в зависимости от активной вкладки
        if (activeTab === 'mechanics') {
            theoryTitle.textContent = '📖 Теория — Механика';
            theoryBody.innerHTML = TheoryContent.mechanics;
        } else {
            theoryTitle.textContent = '📖 Теория — Термодинамика';
            theoryBody.innerHTML = TheoryContent.thermo;
        }
        theoryOverlay.classList.add('visible');
    });

    btnCloseTheory.addEventListener('click', () => {
        theoryOverlay.classList.remove('visible');
    });

    // Закрытие по клику на overlay (фон)
    theoryOverlay.addEventListener('click', (e) => {
        if (e.target === theoryOverlay) {
            theoryOverlay.classList.remove('visible');
        }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') theoryOverlay.classList.remove('visible');
    });


    // ═══════════════════════════════════════════════════════
    //  D.3 МЕХАНИКА: создание объектов
    // ═══════════════════════════════════════════════════════

    function randomSpawnPos() {
        return {
            x: 60 + Math.random() * (world.width - 120),
            y: 60 + Math.random() * (world.height * 0.3)
        };
    }

    btnCreateBall.addEventListener('click', () => {
        const pos = randomSpawnPos();
        const mass = parseFloat(sliderMass.value);
        world.addBody(new RigidBody({
            shape: 'circle', x: pos.x, y: pos.y,
            mass, radius: 14 + mass * 2
        }));
        world.selectedBody = world.bodies[world.bodies.length - 1];
        overlayHint.style.opacity = '0';
    });

    btnCreateBox.addEventListener('click', () => {
        const pos = randomSpawnPos();
        const mass = parseFloat(sliderMass.value);
        const sz = 26 + mass * 3;
        world.addBody(new RigidBody({
            shape: 'rect', x: pos.x, y: pos.y,
            mass, width: sz, height: sz
        }));
        world.selectedBody = world.bodies[world.bodies.length - 1];
        overlayHint.style.opacity = '0';
    });


    // ═══════════════════════════════════════════════════════
    //  D.4 МЕХАНИКА: пауза и очистка
    // ═══════════════════════════════════════════════════════

    btnPause.addEventListener('click', () => {
        world.paused = !world.paused;
        btnPause.innerHTML = world.paused ? '▶ Запуск' : '⏸ Пауза';
    });

    btnClear.addEventListener('click', () => {
        world.clearBodies();
        overlayHint.style.opacity = '0.6';
    });


    // ═══════════════════════════════════════════════════════
    //  D.5 МЕХАНИКА: ползунки
    // ═══════════════════════════════════════════════════════

    sliderGravity.addEventListener('input', () => {
        world.gravity = parseFloat(sliderGravity.value);
        valGravity.textContent = parseFloat(sliderGravity.value).toFixed(2);
    });

    sliderFriction.addEventListener('input', () => {
        world.friction = parseFloat(sliderFriction.value);
        valFriction.textContent = parseFloat(sliderFriction.value).toFixed(3);
    });

    sliderRestitution.addEventListener('input', () => {
        world.restitution = parseFloat(sliderRestitution.value);
        valRestitution.textContent = parseFloat(sliderRestitution.value).toFixed(2);
    });

    sliderMass.addEventListener('input', () => {
        valMass.textContent = parseFloat(sliderMass.value).toFixed(1);
    });


    // ═══════════════════════════════════════════════════════
    //  D.6 МЕХАНИКА: переключатели визуализации
    // ═══════════════════════════════════════════════════════

    toggleVectors.addEventListener('change', () => { world.showVectors = toggleVectors.checked; });
    toggleGrid.addEventListener('change', () => { world.showGrid = toggleGrid.checked; });
    toggleTrails.addEventListener('change', () => {
        world.showTrails = toggleTrails.checked;
        if (!toggleTrails.checked) world.bodies.forEach(b => b.trail = []);
    });


    // ═══════════════════════════════════════════════════════
    //  D.7 ТЕРМОДИНАМИКА: контролы
    // ═══════════════════════════════════════════════════════

    btnAddMols.addEventListener('click', () => {
        gas.addParticles(50);
        overlayHint.style.opacity = '0';
    });

    btnClearGas.addEventListener('click', () => {
        gas.clearParticles();
        overlayHint.style.opacity = '0.6';
    });

    sliderTemp.addEventListener('input', () => {
        gas.temperature = parseInt(sliderTemp.value);
        valTemp.textContent = sliderTemp.value;
    });

    sliderVolume.addEventListener('input', () => {
        gas.volume = parseInt(sliderVolume.value);
        valVolume.textContent = sliderVolume.value;
    });


    // ═══════════════════════════════════════════════════════
    //  D.8 ОБНОВЛЕНИЕ ИНСПЕКТОРА (синхронно с рендером)
    // ═══════════════════════════════════════════════════════

    function updateInspector() {
        // FPS и счётчик тел
        fpsCounter.textContent = 'FPS: ' + fps;

        if (activeTab === 'mechanics') {
            bodyCount.textContent = 'Тел: ' + world.bodies.length;

            // Проверяем, что выбранное тело ещё существует
            if (world.selectedBody && !world.bodies.includes(world.selectedBody)) {
                world.selectedBody = null;
            }

            if (world.selectedBody) {
                inspectorEmpty.style.display = 'none';
                inspectorData.style.display  = 'flex';
                const body = world.selectedBody;
                const p = world.getBodyPhysics(body);

                inspectShape.textContent = body.shape === 'circle' ? '●' : '■';
                inspectShape.style.color = body.shape === 'circle' ? '#00e5ff' : '#e040fb';
                inspectType.textContent  = body.shape === 'circle' ? 'Шар' : 'Гиря';

                inspectMass.textContent    = p.mass.toFixed(1);
                inspectVel.textContent     = p.speed.toFixed(2);
                inspectVx.textContent      = p.vx.toFixed(2);
                inspectVy.textContent      = (-p.vy).toFixed(2);
                inspectEk.textContent      = p.Ek.toFixed(2);
                inspectEp.textContent      = p.Ep.toFixed(2);
                inspectEtotal.textContent  = p.E.toFixed(2);
                inspectHeight.textContent  = p.height.toFixed(2);
                inspectX.textContent       = p.posX;
                inspectY.textContent       = p.posY;
            } else {
                inspectorEmpty.style.display = 'flex';
                inspectorData.style.display  = 'none';
            }

        } else {
            // Термодинамика
            bodyCount.textContent = 'Частиц: ' + gas.particles.length;

            thermoCount.textContent    = gas.particles.length;
            thermoAvgEk.textContent    = gas.getAverageKineticEnergy().toFixed(1);
            thermoPressure.textContent = gas.pressure;
            thermoTempDisp.textContent = gas.temperature;
            thermoVolDisp.textContent  = gas.volume;
        }
    }


    // ═══════════════════════════════════════════════════════
    //  D.9 ГЛАВНЫЙ ЦИКЛ (Game Loop)
    // ═══════════════════════════════════════════════════════
    //
    // Единый цикл requestAnimationFrame.
    // В зависимости от activeTab вызываем step+render
    // для механики ИЛИ для термодинамики.
    // ═══════════════════════════════════════════════════════

    let fps = 0;
    let frameCount = 0;
    let fpsTimeAccum = 0;
    let lastTime = performance.now();

    function mainLoop(now) {
        const elapsed = (now - lastTime) / 1000;
        lastTime = now;

        // Счётчик FPS
        frameCount++;
        fpsTimeAccum += elapsed;
        if (fpsTimeAccum >= 1) {
            fps = frameCount;
            frameCount = 0;
            fpsTimeAccum = 0;
        }

        // ─── Шаг + рендер в зависимости от вкладки ───
        if (activeTab === 'mechanics') {
            world.step();
            world.render();
        } else {
            gas.step(1 / 60);
            gas.render();
        }

        // Обновляем инспектор
        updateInspector();

        requestAnimationFrame(mainLoop);
    }

    // ═══ Обработка resize для обоих движков ═══
    window.addEventListener('resize', () => {
        world.resizeCanvas();
        gas.resizeCanvas();
    });

    // ═══════════════════════════════════════════════════════
    //  D.10 ЗАПУСК!
    // ═══════════════════════════════════════════════════════

    requestAnimationFrame(mainLoop);

    console.log(
        '%c TechPhys Sandbox %c v2.0 — Механика + Термодинамика',
        'background: #00e5ff; color: #06080d; font-weight: bold; padding: 2px 8px; border-radius: 3px;',
        'color: #8892a4;'
    );
});
