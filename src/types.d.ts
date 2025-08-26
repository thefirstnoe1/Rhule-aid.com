export interface Env {
    DB: any;
    SCHEDULE_CACHE: any;
    ROSTER_CACHE: any;
    NEWS_CACHE: any;
    WEATHER_CACHE: any;
    RANKINGS_CACHE: any;
    STANDINGS_CACHE: any;
    CFB_SCHEDULE_CACHE: any;
    ASSETS: any;
    OPENWEATHER_API_KEY: string;
}
export interface Context {
    request: Request;
    env: Env;
}
export interface Team {
    name: string;
    shortName: string;
    logo: string;
    score: number;
    rank?: number;
    conference: string;
}
export interface ScheduleMatch {
    id: string;
    date: string;
    time: string;
    datetime: string;
    week: number;
    homeTeam: Team;
    awayTeam: Team;
    venue: string;
    location: string;
    tv: string;
    status: string;
    isCompleted: boolean;
    spread: string | null;
}
//# sourceMappingURL=types.d.ts.map