-- Migration to create standings table for storing conference standings
DROP TABLE IF EXISTS standings;

CREATE TABLE standings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference TEXT NOT NULL,
    team_name TEXT NOT NULL,
    conference_wins INTEGER DEFAULT 0,
    conference_losses INTEGER DEFAULT 0,
    overall_wins INTEGER DEFAULT 0,
    overall_losses INTEGER DEFAULT 0,
    points_for INTEGER DEFAULT 0,
    points_against INTEGER DEFAULT 0,
    home_record TEXT DEFAULT '0-0',
    away_record TEXT DEFAULT '0-0',
    streak TEXT DEFAULT '',
    week_date DATE NOT NULL, -- Date when standings were recorded
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_standings_conference ON standings(conference);
CREATE INDEX idx_standings_team_name ON standings(team_name);
CREATE INDEX idx_standings_week_date ON standings(week_date);
CREATE INDEX idx_standings_conference_week ON standings(conference, week_date);

-- Create a unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX idx_standings_unique ON standings(conference, team_name, week_date);