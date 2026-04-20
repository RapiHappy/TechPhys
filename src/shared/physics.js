/**
 * Common Physics Utilities for TechPhys project
 */

export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    mult(s) {
        return new Vec2(this.x * s, this.y * s);
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    unit() {
        const m = this.mag();
        return m ? this.mult(1 / m) : new Vec2();
    }

    dist(v) {
        return this.sub(v).mag();
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    reflect(normal) {
        const d = this;
        return d.sub(normal.mult(2 * d.dot(normal)));
    }
}
