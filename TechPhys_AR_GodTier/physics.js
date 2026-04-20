import * as CANNON from 'cannon-es';

export class PhysicsEngine {
    constructor() {
        // Инициализация симуляции физики
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.81, 0) // Стандартная гравитация
        });
        
        // Оптимизация просчета столкновений (Sweep and Prune)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        
        // Массив всех тел для синхронизации с Three.js
        this.bodies = [];

        // Создаем невидимый пол для отскоков сфер (AR-уровень или десктоп)
        const groundMaterial = new CANNON.Material('ground');
        const groundBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Plane(),
            material: groundMaterial
        });
        // Поворот плоскости параллельно земле (по оси X на -90 градусов)
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);
    }

    addSphere(mass, radius, position, velocity) {
        // Материал для упругих столкновений (настроит Three.js, тут чисто физика)
        const physicsMaterial = new CANNON.Material();
        
        const body = new CANNON.Body({
            mass: mass,
            shape: new CANNON.Sphere(radius),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: physicsMaterial
        });
        
        // Задаем начальный импульс
        if (velocity) {
            body.velocity.set(velocity.x, velocity.y, velocity.z);
        }

        // Добавляем немного вращения(кручения) для зрелищности
        body.angularVelocity.set(0, velocity ? velocity.length() : 0, 0);

        this.world.addBody(body);
        this.bodies.push(body);
        
        return body;
    }

    removeBody(body) {
        this.world.removeBody(body);
        const index = this.bodies.indexOf(body);
        if (index !== -1) {
            this.bodies.splice(index, 1);
        }
    }

    update(deltaTime) {
        // Шаг симуляции (60 FPS стабильный шаг, подстройка под дельту времени кадра)
        this.world.step(1/60, deltaTime, 3);
    }
}
