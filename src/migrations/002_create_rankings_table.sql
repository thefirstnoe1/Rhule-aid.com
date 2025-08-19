-- Migration to create rankings table for storing AP Poll and CFP rankings
DROP TABLE IF EXISTS rankings;

CREATE TABLE rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_type TEXT NOT NULL, -- 'AP' or 'CFP'
    rank INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    points INTEGER,
    first_place_votes INTEGER DEFAULT 0,
    week_date DATE NOT NULL, -- Date of the poll week
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_rankings_poll_type ON rankings(poll_type);
CREATE INDEX idx_rankings_team_name ON rankings(team_name);
CREATE INDEX idx_rankings_week_date ON rankings(week_date);
CREATE INDEX idx_rankings_poll_week ON rankings(poll_type, week_date);

-- Create a unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX idx_rankings_unique ON rankings(poll_type, team_name, week_date);