/**
 * MobileManager handles responsive UI logic for the Academic Lab.
 * It manages sidebar toggling and mobile-specific layout states.
 */
export class MobileManager {
    constructor() {
        this.isMobile = window.innerWidth <= 992;
        this.sidebars = {
            left: document.querySelector('.left-sidebar'),
            right: document.querySelector('.right-sidebar')
        };
        this.toggles = {
            left: document.getElementById('toggle-left-sidebar'),
            right: document.getElementById('toggle-right-sidebar'),
            close: document.querySelectorAll('.mobile-close-sidebar')
        };
        
        this.init();
        window.addEventListener('resize', () => this.handleResize());
    }

    init() {
        // Left Sidebar Toggle
        if (this.toggles.left) {
            this.toggles.left.addEventListener('click', () => this.toggleSidebar('left'));
        }

        // Right Sidebar Toggle
        if (this.toggles.right) {
            this.toggles.right.addEventListener('click', () => this.toggleSidebar('right'));
        }

        // Close buttons inside sidebars
        this.toggles.close.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sidebar = e.target.closest('.sidebar');
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
            });
        });

        // Close sidebar on esc
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.sidebars.left?.classList.remove('active');
                this.sidebars.right?.classList.remove('active');
            }
        });
    }

    toggleSidebar(side) {
        const sidebar = this.sidebars[side];
        const otherSide = side === 'left' ? 'right' : 'left';
        
        // Close other sidebar first on small screens
        if (window.innerWidth < 768) {
            this.sidebars[otherSide]?.classList.remove('active');
        }

        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 992;

        if (!this.isMobile && wasMobile) {
            // Revert fixed sidebar states when returning to desktop
            this.sidebars.left?.classList.remove('active');
            this.sidebars.right?.classList.remove('active');
        }
    }
}
