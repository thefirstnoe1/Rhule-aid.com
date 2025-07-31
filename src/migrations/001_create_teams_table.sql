-- Migration to create teams table for conference information
DROP TABLE IF EXISTS teams;

CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    conference TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_teams_name ON teams(name);
CREATE INDEX idx_teams_conference ON teams(conference);

-- Insert all the conference data
INSERT INTO teams (name, conference) VALUES
-- Big Ten Conference
('Michigan Wolverines', 'Big Ten Conference'),
('Michigan State Spartans', 'Big Ten Conference'),
('Maryland Terrapins', 'Big Ten Conference'),
('Minnesota Golden Gophers', 'Big Ten Conference'),
('Northwestern Wildcats', 'Big Ten Conference'),
('USC Trojans', 'Big Ten Conference'),
('UCLA Bruins', 'Big Ten Conference'),
('Ohio State Buckeyes', 'Big Ten Conference'),
('Penn State Nittany Lions', 'Big Ten Conference'),
('Iowa Hawkeyes', 'Big Ten Conference'),
('Illinois Fighting Illini', 'Big Ten Conference'),
('Indiana Hoosiers', 'Big Ten Conference'),
('Nebraska Cornhuskers', 'Big Ten Conference'),
('Oregon Ducks', 'Big Ten Conference'),
('Purdue Boilermakers', 'Big Ten Conference'),
('Rutgers Scarlet Knights', 'Big Ten Conference'),
('Washington Huskies', 'Big Ten Conference'),
('Wisconsin Badgers', 'Big Ten Conference'),

-- SEC Conference
('Alabama Crimson Tide', 'SEC Conference'),
('Arkansas Razorbacks', 'SEC Conference'),
('Auburn Tigers', 'SEC Conference'),
('Florida Gators', 'SEC Conference'),
('Georgia Bulldogs', 'SEC Conference'),
('Kentucky Wildcats', 'SEC Conference'),
('LSU Tigers', 'SEC Conference'),
('Mississippi State Bulldogs', 'SEC Conference'),
('Missouri Tigers', 'SEC Conference'),
('Ole Miss Rebels', 'SEC Conference'),
('South Carolina Gamecocks', 'SEC Conference'),
('Tennessee Volunteers', 'SEC Conference'),
('Texas Longhorns', 'SEC Conference'),
('Texas A&M Aggies', 'SEC Conference'),
('Vanderbilt Commodores', 'SEC Conference'),
('Oklahoma Sooners', 'SEC Conference'),

-- ACC Conference
('Boston College Eagles', 'ACC Conference'),
('Clemson Tigers', 'ACC Conference'),
('Duke Blue Devils', 'ACC Conference'),
('Florida State Seminoles', 'ACC Conference'),
('Georgia Tech Yellow Jackets', 'ACC Conference'),
('Louisville Cardinals', 'ACC Conference'),
('Miami Hurricanes', 'ACC Conference'),
('NC State Wolfpack', 'ACC Conference'),
('North Carolina Tar Heels', 'ACC Conference'),
('Notre Dame Fighting Irish', 'ACC Conference'),
('Pittsburgh Panthers', 'ACC Conference'),
('Syracuse Orange', 'ACC Conference'),
('Virginia Cavaliers', 'ACC Conference'),
('Virginia Tech Hokies', 'ACC Conference'),
('Wake Forest Demon Deacons', 'ACC Conference'),
('California Golden Bears', 'ACC Conference'),
('SMU Mustangs', 'ACC Conference'),
('Stanford Cardinal', 'ACC Conference'),

-- Big 12 Conference
('Baylor Bears', 'Big 12 Conference'),
('BYU Cougars', 'Big 12 Conference'),
('Cincinnati Bearcats', 'Big 12 Conference'),
('Colorado Buffaloes', 'Big 12 Conference'),
('Houston Cougars', 'Big 12 Conference'),
('Iowa State Cyclones', 'Big 12 Conference'),
('Kansas Jayhawks', 'Big 12 Conference'),
('Kansas State Wildcats', 'Big 12 Conference'),
('Oklahoma State Cowboys', 'Big 12 Conference'),
('TCU Horned Frogs', 'Big 12 Conference'),
('Texas Tech Red Raiders', 'Big 12 Conference'),
('UCF Knights', 'Big 12 Conference'),
('Utah Utes', 'Big 12 Conference'),
('West Virginia Mountaineers', 'Big 12 Conference'),
('Arizona Wildcats', 'Big 12 Conference'),
('Arizona State Sun Devils', 'Big 12 Conference'),

-- Pac-12 Conference (remaining teams)
('Oregon State Beavers', 'Pac-12 Conference'),
('Washington State Cougars', 'Pac-12 Conference'),

-- American Athletic Conference
('Army Black Knights', 'American Athletic Conference'),
('Charlotte 49ers', 'American Athletic Conference'),
('East Carolina Pirates', 'American Athletic Conference'),
('Florida Atlantic Owls', 'American Athletic Conference'),
('Memphis Tigers', 'American Athletic Conference'),
('Navy Midshipmen', 'American Athletic Conference'),
('North Texas Mean Green', 'American Athletic Conference'),
('Rice Owls', 'American Athletic Conference'),
('South Florida Bulls', 'American Athletic Conference'),
('Temple Owls', 'American Athletic Conference'),
('Tulane Green Wave', 'American Athletic Conference'),
('Tulsa Golden Hurricane', 'American Athletic Conference'),
('UTSA Roadrunners', 'American Athletic Conference'),

-- Mountain West Conference
('Air Force Falcons', 'Mountain West Conference'),
('Boise State Broncos', 'Mountain West Conference'),
('Colorado State Rams', 'Mountain West Conference'),
('Fresno State Bulldogs', 'Mountain West Conference'),
('Hawaii Rainbow Warriors', 'Mountain West Conference'),
('Nevada Wolf Pack', 'Mountain West Conference'),
('New Mexico Lobos', 'Mountain West Conference'),
('San Diego State Aztecs', 'Mountain West Conference'),
('San Jose State Spartans', 'Mountain West Conference'),
('UNLV Rebels', 'Mountain West Conference'),
('Utah State Aggies', 'Mountain West Conference'),
('Wyoming Cowboys', 'Mountain West Conference'),

-- Conference USA
('Florida International Panthers', 'Conference USA'),
('Jacksonville State Gamecocks', 'Conference USA'),
('Louisiana Tech Bulldogs', 'Conference USA'),
('Liberty Flames', 'Conference USA'),
('Middle Tennessee Blue Raiders', 'Conference USA'),
('New Mexico State Aggies', 'Conference USA'),
('Sam Houston Bearkats', 'Conference USA'),
('UTEP Miners', 'Conference USA'),
('Western Kentucky Hilltoppers', 'Conference USA'),

-- MAC Conference
('Akron Zips', 'MAC Conference'),
('Ball State Cardinals', 'MAC Conference'),
('Bowling Green Falcons', 'MAC Conference'),
('Buffalo Bulls', 'MAC Conference'),
('Central Michigan Chippewas', 'MAC Conference'),
('Eastern Michigan Eagles', 'MAC Conference'),
('Kent State Golden Flashes', 'MAC Conference'),
('Miami RedHawks', 'MAC Conference'),
('Northern Illinois Huskies', 'MAC Conference'),
('Ohio Bobcats', 'MAC Conference'),
('Toledo Rockets', 'MAC Conference'),
('Western Michigan Broncos', 'MAC Conference'),

-- Sun Belt Conference
('Appalachian State Mountaineers', 'Sun Belt Conference'),
('Arkansas State Red Wolves', 'Sun Belt Conference'),
('Coastal Carolina Chanticleers', 'Sun Belt Conference'),
('Georgia Southern Eagles', 'Sun Belt Conference'),
('Georgia State Panthers', 'Sun Belt Conference'),
('James Madison Dukes', 'Sun Belt Conference'),
('Louisiana Ragin Cajuns', 'Sun Belt Conference'),
('Marshall Thundering Herd', 'Sun Belt Conference'),
('Old Dominion Monarchs', 'Sun Belt Conference'),
('South Alabama Jaguars', 'Sun Belt Conference'),
('Southern Miss Golden Eagles', 'Sun Belt Conference'),
('Texas State Bobcats', 'Sun Belt Conference'),
('Troy Trojans', 'Sun Belt Conference'),
('ULM Warhawks', 'Sun Belt Conference'),

-- FCS Conferences
('Northern Iowa Panthers', 'Missouri Valley Football Conference (FCS)'),
('North Dakota State Bison', 'Missouri Valley Football Conference (FCS)'),
('South Dakota State Jackrabbits', 'Missouri Valley Football Conference (FCS)'),
('Montana Grizzlies', 'Big Sky Conference (FCS)'),
('Eastern Washington Eagles', 'Big Sky Conference (FCS)'),

-- Independent
('UConn Huskies', 'Independent'),
('UMass Minutemen', 'Independent');
