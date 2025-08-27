export interface Env {
    DB: any;
    SCHEDULE_CACHE: any;
    ROSTER_CACHE: any;
    NEWS_CACHE: any;
    WEATHER_CACHE: any;
    RANKINGS_CACHE: any;
    STANDINGS_CACHE: any;
    BETTING_CACHE: any;
    ASSETS: any;
    OPENWEATHER_API_KEY: string;
}
declare const _default: {
    fetch(request: Request, env: Env): Promise<Response>;
    scheduled(event: any, env: Env): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map