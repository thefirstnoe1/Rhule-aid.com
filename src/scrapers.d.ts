export interface APPollTeam {
    rank: number;
    team: string;
    points: number;
    firstPlaceVotes?: number;
}
export interface CFPTeam {
    rank: number;
    team: string;
    points?: number;
}
export interface StandingsTeam {
    school: string;
    confWins: number;
    confLosses: number;
    overallWins: number;
    overallLosses: number;
    pointsFor: number;
    pointsAgainst: number;
    homeRecord: string;
    awayRecord: string;
    streak: string;
}
export declare function scrapeAPPoll(): Promise<APPollTeam[]>;
export declare function scrapeCFPPoll(): Promise<CFPTeam[]>;
export declare function scrapeBigTenStandings(): Promise<StandingsTeam[]>;
//# sourceMappingURL=scrapers.d.ts.map