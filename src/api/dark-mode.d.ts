export = DarkModeManager;
/**
 * Dark Mode Toggle Functionality for Rhule-aid.com
 * This script handles theme switching and persistence
 */
declare class DarkModeManager {
    themeKey: string;
    init(): void;
    getCurrentTheme(): string;
    setTheme(theme: any): void;
    toggleTheme(): void;
    loadSavedTheme(): void;
    updateToggleButton(): void;
    bindToggleEvents(): void;
}
//# sourceMappingURL=dark-mode.d.ts.map