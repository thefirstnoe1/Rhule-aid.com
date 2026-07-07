declare class SoccerSchedule {
    cache: Map<any, any>;
    cacheTTL: number;
    init(): void;
    loadSchedules(): Promise<void>;
    fetchSoccerData(): Promise<any>;
    renderHuskerSchedule(games: any): void;
    renderUSMensSchedule(games: any): void;
    renderUSWomensSchedule(games: any): void;
    formatStatus(status: any): any;
    showLoading(): void;
    hideLoading(): void;
    showError(message: any): void;
    updateLastUpdated(timestamp: any): void;
    setupRefreshButton(): void;
}
//# sourceMappingURL=soccer-client.d.ts.map