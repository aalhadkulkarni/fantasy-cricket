/**
 * **Test data: the IPL 2026 player pool, and the teams it belongs to.**
 *
 * Written once, by hand, from the list in `players.md` — the auction order,
 * each player with their 2026 franchise. Nationality, role and the
 * international formats each player currently plays are filled from what was
 * known in mid-2026, **best effort**: uncapped domestic players are the least
 * certain, and international formats change. Anything wrong is corrected in
 * the admin panel afterwards, not here.
 *
 * Used only by `populateSeedData`, which wipes an environment and loads this,
 * and `createSampleIplTournament`, which builds a tournament on the 2026
 * schedule. Never in production.
 */

import type { PlayerCategory, PlayerRole } from '@fantasy-cricket/shared'

export {
  FORMAT_COMPETITIONS,
  shortNames,
  type IntlFormat,
} from './catalogue-rules.ts'

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/** The ten franchises, by the code `players.md` uses. */
export const IPL_TEAMS = {
  CSK: 'Chennai Super Kings',
  DC: 'Delhi Capitals',
  GT: 'Gujarat Titans',
  KKR: 'Kolkata Knight Riders',
  LSG: 'Lucknow Super Giants',
  MI: 'Mumbai Indians',
  PBKS: 'Punjab Kings',
  RCB: 'Royal Challengers Bengaluru',
  RR: 'Rajasthan Royals',
  SRH: 'Sunrisers Hyderabad',
} as const
export type IplTeam = keyof typeof IPL_TEAMS

/**
 * **The nations, playing every international format.** The team name is also
 * the nationality — including West Indies, which is not a country but is how a
 * West Indian player's nationality reads here.
 */
export const NATIONAL_TEAMS = {
  India: 'IND',
  Australia: 'AUS',
  'South Africa': 'SA',
  'New Zealand': 'NZ',
  England: 'ENG',
  Pakistan: 'PAK',
  'Sri Lanka': 'SL',
  'West Indies': 'WI',
  Bangladesh: 'BAN',
  Afghanistan: 'AFG',
  Zimbabwe: 'ZIM',
  Ireland: 'IRE',
  Netherlands: 'NED',
} as const
export type Nation = keyof typeof NATIONAL_TEAMS

/** The base tournaments, by name, that the IPL franchises play. */
export const IPL_COMPETITION = 'IPL'

// ---------------------------------------------------------------------------
// The 2026 schedule
// ---------------------------------------------------------------------------

/** Start times in IST, which is UTC+5:30. */
const IST_START_UTC = { '3:30': [10, 0], '7:30': [14, 0] } as const
type IstStart = keyof typeof IST_START_UTC

/**
 * `[month, day, IST start, home, away, venue]`, in match order. A playoff has
 * only its date and time.
 */
type Fixture =
  | readonly [number, number, IstStart, IplTeam, IplTeam, string]
  | readonly [number, number, IstStart]

/**
 * **The IPL 2026 fixtures**, 70 league matches and 4 playoffs, as published in
 * March 2026. Playoff venues were not announced with the schedule.
 */
const IPL_2026_SCHEDULE: readonly Fixture[] = [
  [3, 28, '7:30', 'RCB', 'SRH', 'Bengaluru'],
  [3, 29, '7:30', 'MI', 'KKR', 'Mumbai'],
  [3, 30, '7:30', 'RR', 'CSK', 'Guwahati'],
  [3, 31, '7:30', 'PBKS', 'GT', 'New Chandigarh'],
  [4, 1, '7:30', 'LSG', 'DC', 'Lucknow'],
  [4, 2, '7:30', 'KKR', 'SRH', 'Kolkata'],
  [4, 3, '7:30', 'CSK', 'PBKS', 'Chennai'],
  [4, 4, '3:30', 'DC', 'MI', 'Delhi'],
  [4, 4, '7:30', 'GT', 'RR', 'Ahmedabad'],
  [4, 5, '3:30', 'SRH', 'LSG', 'Hyderabad'],
  [4, 5, '7:30', 'RCB', 'CSK', 'Bengaluru'],
  [4, 6, '7:30', 'KKR', 'PBKS', 'Kolkata'],
  [4, 7, '7:30', 'RR', 'MI', 'Guwahati'],
  [4, 8, '7:30', 'DC', 'GT', 'Delhi'],
  [4, 9, '7:30', 'KKR', 'LSG', 'Kolkata'],
  [4, 10, '7:30', 'RR', 'RCB', 'Guwahati'],
  [4, 11, '3:30', 'PBKS', 'SRH', 'New Chandigarh'],
  [4, 11, '7:30', 'CSK', 'DC', 'Chennai'],
  [4, 12, '3:30', 'LSG', 'GT', 'Lucknow'],
  [4, 12, '7:30', 'MI', 'RCB', 'Mumbai'],
  [4, 13, '7:30', 'SRH', 'RR', 'Hyderabad'],
  [4, 14, '7:30', 'CSK', 'KKR', 'Chennai'],
  [4, 15, '7:30', 'RCB', 'LSG', 'Bengaluru'],
  [4, 16, '7:30', 'MI', 'PBKS', 'Mumbai'],
  [4, 17, '7:30', 'GT', 'KKR', 'Ahmedabad'],
  [4, 18, '3:30', 'RCB', 'DC', 'Bengaluru'],
  [4, 18, '7:30', 'SRH', 'CSK', 'Hyderabad'],
  [4, 19, '3:30', 'KKR', 'RR', 'Kolkata'],
  [4, 19, '7:30', 'PBKS', 'LSG', 'New Chandigarh'],
  [4, 20, '7:30', 'GT', 'MI', 'Ahmedabad'],
  [4, 21, '7:30', 'SRH', 'DC', 'Hyderabad'],
  [4, 22, '7:30', 'LSG', 'RR', 'Lucknow'],
  [4, 23, '7:30', 'MI', 'CSK', 'Mumbai'],
  [4, 24, '7:30', 'RCB', 'GT', 'Bengaluru'],
  [4, 25, '3:30', 'DC', 'PBKS', 'Delhi'],
  [4, 25, '7:30', 'RR', 'SRH', 'Jaipur'],
  [4, 26, '3:30', 'GT', 'CSK', 'Ahmedabad'],
  [4, 26, '7:30', 'LSG', 'KKR', 'Lucknow'],
  [4, 27, '7:30', 'DC', 'RCB', 'Delhi'],
  [4, 28, '7:30', 'PBKS', 'RR', 'New Chandigarh'],
  [4, 29, '7:30', 'MI', 'SRH', 'Mumbai'],
  [4, 30, '7:30', 'GT', 'RCB', 'Ahmedabad'],
  [5, 1, '7:30', 'RR', 'DC', 'Jaipur'],
  [5, 2, '7:30', 'CSK', 'MI', 'Chennai'],
  [5, 3, '3:30', 'SRH', 'KKR', 'Hyderabad'],
  [5, 3, '7:30', 'GT', 'PBKS', 'Ahmedabad'],
  [5, 4, '7:30', 'MI', 'LSG', 'Mumbai'],
  [5, 5, '7:30', 'DC', 'CSK', 'Delhi'],
  [5, 6, '7:30', 'SRH', 'PBKS', 'Hyderabad'],
  [5, 7, '7:30', 'LSG', 'RCB', 'Lucknow'],
  [5, 8, '7:30', 'DC', 'KKR', 'Delhi'],
  [5, 9, '7:30', 'RR', 'GT', 'Jaipur'],
  [5, 10, '3:30', 'CSK', 'LSG', 'Chennai'],
  [5, 10, '7:30', 'RCB', 'MI', 'Raipur'],
  [5, 11, '7:30', 'PBKS', 'DC', 'Dharamshala'],
  [5, 12, '7:30', 'GT', 'SRH', 'Ahmedabad'],
  [5, 13, '7:30', 'RCB', 'KKR', 'Raipur'],
  [5, 14, '7:30', 'PBKS', 'MI', 'Dharamshala'],
  [5, 15, '7:30', 'LSG', 'CSK', 'Lucknow'],
  [5, 16, '7:30', 'KKR', 'GT', 'Kolkata'],
  [5, 17, '3:30', 'PBKS', 'RCB', 'Dharamshala'],
  [5, 17, '7:30', 'DC', 'RR', 'Delhi'],
  [5, 18, '7:30', 'CSK', 'SRH', 'Chennai'],
  [5, 19, '7:30', 'RR', 'LSG', 'Jaipur'],
  [5, 20, '7:30', 'KKR', 'MI', 'Kolkata'],
  [5, 21, '7:30', 'CSK', 'GT', 'Chennai'],
  [5, 22, '7:30', 'SRH', 'RCB', 'Hyderabad'],
  [5, 23, '7:30', 'LSG', 'PBKS', 'Lucknow'],
  [5, 24, '3:30', 'MI', 'RR', 'Mumbai'],
  [5, 24, '7:30', 'KKR', 'DC', 'Kolkata'],
  // The playoffs: dated, but the teams are not known until the league ends.
  [5, 26, '7:30'],
  [5, 27, '7:30'],
  [5, 29, '7:30'],
  [5, 31, '7:30'],
]

/** The rounds a sample tournament is split into, by match number. */
export const IPL_ROUNDS = [
  { roundName: 'League stage', firstMatchNumber: 1, lastMatchNumber: 70 },
  { roundName: 'Playoffs', firstMatchNumber: 71, lastMatchNumber: 73 },
  { roundName: 'Final', firstMatchNumber: 74, lastMatchNumber: 74 },
] as const

/**
 * **The 2026 schedule moved to another year**: the same fixtures on the same
 * calendar dates and IST start times. Weekdays shift, which a test tournament
 * does not care about.
 */
export function iplScheduleIn(year: number): {
  matchNumber: number
  startTimestamp: number
  /** Absent for a playoff, which is TBA vs TBA. */
  fixture?: { team1: IplTeam; team2: IplTeam; venue: string }
}[] {
  return IPL_2026_SCHEDULE.map((entry, index) => {
    const [month, day, start] = entry
    const [hour, minute] = IST_START_UTC[start]
    return {
      matchNumber: index + 1,
      startTimestamp: Date.UTC(year, month - 1, day, hour, minute),
      ...(entry.length === 6
        ? { fixture: { team1: entry[3], team2: entry[4], venue: entry[5] } }
        : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Auction values, by position in the list
// ---------------------------------------------------------------------------

/**
 * **Category and base price come from a player's place in the list**: the
 * first 24 are Marquee, the next 24 Star, the rest go to the draft.
 */
export function auctionValueAt(position: number): {
  playerCategory: PlayerCategory
  playerBasePrice: number
} {
  if (position <= 12) return { playerCategory: 'marquee', playerBasePrice: 6 }
  if (position <= 24) return { playerCategory: 'marquee', playerBasePrice: 5 }
  if (position <= 36) return { playerCategory: 'star', playerBasePrice: 4 }
  if (position <= 48) return { playerCategory: 'star', playerBasePrice: 3 }
  return { playerCategory: 'general', playerBasePrice: 2 }
}

// ---------------------------------------------------------------------------
// Players, in `players.md` order
// ---------------------------------------------------------------------------

type Role = 'bat' | 'wk' | 'ar' | 'bowl'

export const ROLE_OF: Readonly<Record<Role, PlayerRole>> = {
  bat: 'batsman',
  wk: 'wicketKeeper',
  ar: 'allRounder',
  bowl: 'bowler',
}

/**
 * `[name, franchise, nationality, role, international formats]`. Formats are
 * space-separated, empty for a player not currently picked by their country.
 */
export type SeedPlayer = readonly [string, IplTeam, Nation, Role, string]

export const IPL_2026_PLAYERS: readonly SeedPlayer[] = [
  ['Hardik Pandya', 'MI', 'India', 'ar', 't20 odi'],
  ['Abhishek Sharma', 'SRH', 'India', 'ar', 't20'],
  ['Shreyas Iyer', 'PBKS', 'India', 'bat', 'odi'],
  ['Vaibhav Suryavanshi', 'RR', 'India', 'bat', ''],
  ['Virat Kohli', 'RCB', 'India', 'bat', 'odi'],
  ['Ruturaj Gaikwad', 'CSK', 'India', 'bat', 'odi'],
  ['Shubman Gill', 'GT', 'India', 'bat', 't20 odi test'],
  ['Rohit Sharma', 'MI', 'India', 'bat', 'odi'],
  ['Surya Kumar Yadav', 'MI', 'India', 'bat', 't20'],
  ['Yashasvi Jaiswal', 'RR', 'India', 'bat', 'odi test'],
  ['Travis Head', 'SRH', 'Australia', 'bat', 't20 odi test'],
  ['Jasprit Bumrah', 'MI', 'India', 'bowl', 't20 odi test'],
  ['KL Rahul', 'DC', 'India', 'wk', 'odi test'],
  ['Jos Buttler', 'GT', 'England', 'wk', 't20 odi'],
  ['Sai Sudharsan', 'GT', 'India', 'bat', 'test'],
  ['Will Jacks', 'MI', 'England', 'ar', 't20 odi'],
  ['Dewald Brevis', 'CSK', 'South Africa', 'bat', 't20 odi test'],
  ['Sanju Samson', 'CSK', 'India', 'wk', 't20'],
  ['Nicholas Pooran', 'LSG', 'West Indies', 'wk', ''],
  ['Ishan Kishan', 'SRH', 'India', 'wk', 't20'],
  ['Aiden Markram', 'LSG', 'South Africa', 'bat', 't20 odi test'],
  ['Mitchell Marsh', 'LSG', 'Australia', 'ar', 't20 odi'],
  ['Cameron Green', 'KKR', 'Australia', 'ar', 't20 odi test'],
  ['Axar Patel', 'DC', 'India', 'ar', 't20 odi test'],
  ['Jason Holder', 'GT', 'West Indies', 'ar', 't20 odi test'],
  ['Marco Jansen', 'PBKS', 'South Africa', 'ar', 't20 odi test'],
  ['Sam Curran', 'RR', 'England', 'ar', 't20'],
  ['Rajat Patidar', 'RCB', 'India', 'bat', ''],
  ['Devdutt Padikkal', 'RCB', 'India', 'bat', ''],
  ['Shimron Hetmyer', 'RR', 'West Indies', 'bat', 't20 odi'],
  ['Noor Ahmad', 'CSK', 'Afghanistan', 'bowl', 't20 odi'],
  ['Mitchell Starc', 'DC', 'Australia', 'bowl', 'odi test'],
  ['Varun Chakaravarthy', 'KKR', 'India', 'bowl', 't20 odi'],
  ['Sunil Narine', 'KKR', 'West Indies', 'ar', ''],
  ['Arshdeep Singh', 'PBKS', 'India', 'bowl', 't20 odi'],
  ['Josh Hazlewood', 'RCB', 'Australia', 'bowl', 't20 odi test'],
  ['Bhuvneshwar Kumar', 'RCB', 'India', 'bowl', ''],
  ['Rishabh Pant', 'LSG', 'India', 'wk', 'odi test'],
  ['Phil Salt', 'RCB', 'England', 'wk', 't20 odi'],
  ['Heinrich Klaasen', 'SRH', 'South Africa', 'wk', ''],
  ['Ravindra Jadeja', 'RR', 'India', 'ar', 'odi test'],
  ['Tim David', 'RCB', 'Australia', 'bat', 't20'],
  ['Harshal Patel', 'SRH', 'India', 'bowl', ''],
  ['Shivam Dube', 'CSK', 'India', 'ar', 't20'],
  ['Marcus Stoinis', 'PBKS', 'Australia', 'ar', 't20'],
  ['N. Tilak Varma', 'MI', 'India', 'bat', 't20 odi'],
  ['David Miller', 'DC', 'South Africa', 'bat', 't20 odi'],
  ['Ayush Mhatre', 'CSK', 'India', 'bat', ''],
  ['Rashid Khan', 'GT', 'Afghanistan', 'bowl', 't20 odi test'],
  ['Trent Boult', 'MI', 'New Zealand', 'bowl', ''],
  ['Pat Cummins', 'SRH', 'Australia', 'bowl', 't20 odi test'],
  ['Yuzvendra Chahal', 'PBKS', 'India', 'bowl', ''],
  ['Kuldeep Yadav', 'DC', 'India', 'bowl', 't20 odi test'],
  ['Mohammed Siraj', 'GT', 'India', 'bowl', 'odi test'],
  ['Jofra Archer', 'RR', 'England', 'bowl', 't20 odi test'],
  ['Prasidh Krishna', 'GT', 'India', 'bowl', 'odi test'],
  ['Matheesha Pathirana', 'KKR', 'Sri Lanka', 'bowl', 't20 odi'],
  ['Lungisani Ngidi', 'DC', 'South Africa', 'bowl', 't20 odi test'],
  ['Prabhsimran Singh', 'PBKS', 'India', 'wk', ''],
  ['Tim Seifert', 'KKR', 'New Zealand', 'wk', 't20'],
  ['Venkatesh Iyer', 'RCB', 'India', 'ar', ''],
  ['Nitish Kumar Reddy', 'SRH', 'India', 'ar', 't20 odi test'],
  ['Priyansh Arya', 'PBKS', 'India', 'bat', ''],
  ['Krunal Pandya', 'RCB', 'India', 'ar', ''],
  ['Washington Sundar', 'GT', 'India', 'ar', 't20 odi test'],
  ['Sai Kishore', 'GT', 'India', 'bowl', ''],
  ['Sherfane Rutherford', 'MI', 'West Indies', 'bat', 't20 odi'],
  ['Riyan Parag', 'RR', 'India', 'ar', ''],
  ['Rinku Singh', 'KKR', 'India', 'bat', 't20'],
  ['Glenn Phillips', 'GT', 'New Zealand', 'bat', 't20 odi test'],
  ['Kagiso Rabada', 'GT', 'South Africa', 'bowl', 't20 odi test'],
  ['Deepak Chahar', 'MI', 'India', 'bowl', ''],
  ['Ravi Bishnoi', 'RR', 'India', 'bowl', ''],
  ['Lockie Ferguson', 'PBKS', 'New Zealand', 'bowl', 't20 odi'],
  ['Harshit Rana', 'KKR', 'India', 'bowl', 't20 odi'],
  ['Finn Allen', 'KKR', 'New Zealand', 'bat', 't20'],
  ['Quinton de Kock', 'MI', 'South Africa', 'wk', 't20 odi'],
  ['MS Dhoni', 'CSK', 'India', 'wk', ''],
  ['Dhruv Jurel', 'RR', 'India', 'wk', 'test'],
  ['Tristan Stubbs', 'DC', 'South Africa', 'bat', 't20 odi test'],
  ['Khaleel Ahmed', 'CSK', 'India', 'bowl', ''],
  ['Sarfaraz Khan', 'CSK', 'India', 'bat', ''],
  ['Kartik Sharma', 'CSK', 'India', 'wk', ''],
  ['Anshul Kamboj', 'CSK', 'India', 'bowl', ''],
  ['Prashant Veer', 'CSK', 'India', 'ar', ''],
  ['Rahul Chahar', 'CSK', 'India', 'bowl', ''],
  ['Urvil Patel', 'CSK', 'India', 'wk', ''],
  ['Shreyas Gopal', 'CSK', 'India', 'bowl', ''],
  ['Jamie Overton', 'CSK', 'England', 'ar', ''],
  ['Nathan Ellis', 'CSK', 'Australia', 'bowl', 't20'],
  ['Akeal Hosein', 'CSK', 'West Indies', 'bowl', 't20 odi'],
  ['Matt Henry', 'CSK', 'New Zealand', 'bowl', 't20 odi test'],
  ['Karun Nair', 'DC', 'India', 'bat', ''],
  ['Prithvi Shaw', 'DC', 'India', 'bat', ''],
  ['Abishek Porel', 'DC', 'India', 'wk', ''],
  ['Sameer Rizvi', 'DC', 'India', 'bat', ''],
  ['Ashutosh Sharma', 'DC', 'India', 'bat', ''],
  ['Pathum Nissanka', 'DC', 'Sri Lanka', 'bat', 't20 odi test'],
  ['Ben Duckett', 'DC', 'England', 'bat', 't20 odi test'],
  ['Kyle Jamieson', 'DC', 'New Zealand', 'bowl', 't20 odi test'],
  ['Nitish Rana', 'DC', 'India', 'bat', ''],
  ['T. Natarajan', 'DC', 'India', 'bowl', ''],
  ['Mukesh Kumar', 'DC', 'India', 'bowl', ''],
  ['Vipraj Nigam', 'DC', 'India', 'ar', ''],
  ['Tom Banton', 'GT', 'England', 'bat', ''],
  ['Anuj Rawat', 'GT', 'India', 'wk', ''],
  ['Shahrukh Khan', 'GT', 'India', 'bat', ''],
  ['Gurnoor Singh Brar', 'GT', 'India', 'bowl', ''],
  ['Ishant Sharma', 'GT', 'India', 'bowl', ''],
  ['Rahul Tewatia', 'GT', 'India', 'ar', ''],
  ['Ashok Sharma', 'GT', 'India', 'bowl', ''],
  ['Rovman Powell', 'KKR', 'West Indies', 'bat', 't20'],
  ['Rachin Ravindra', 'KKR', 'New Zealand', 'ar', 't20 odi test'],
  ['Ajinkya Rahane', 'KKR', 'India', 'bat', ''],
  ['Angkrish Raghuvanshi', 'KKR', 'India', 'bat', ''],
  ['Ramandeep Singh', 'KKR', 'India', 'ar', ''],
  ['Vaibhav Arora', 'KKR', 'India', 'bowl', ''],
  ['Akash Deep', 'KKR', 'India', 'bowl', 'test'],
  ['Manish Pandey', 'KKR', 'India', 'bat', ''],
  ['Rahul Tripathi', 'KKR', 'India', 'bat', ''],
  ['Umran Malik', 'KKR', 'India', 'bowl', ''],
  ['Mohammad Shami', 'LSG', 'India', 'bowl', ''],
  ['Josh Inglis', 'LSG', 'Australia', 'wk', 't20 odi test'],
  ['Wanindu Hasaranga', 'LSG', 'Sri Lanka', 'ar', 't20 odi'],
  ['Anrich Nortje', 'LSG', 'South Africa', 'bowl', 't20 odi'],
  ['Akshat Raghuwanshi', 'LSG', 'India', 'bat', ''],
  ['Abdul Samad', 'LSG', 'India', 'bat', ''],
  ['Shahbaz Ahamad', 'LSG', 'India', 'ar', ''],
  ['Ayush Badoni', 'LSG', 'India', 'bat', ''],
  ['Avesh Khan', 'LSG', 'India', 'bowl', ''],
  ['Digvesh Singh', 'LSG', 'India', 'bowl', ''],
  ['Prince Yadav', 'LSG', 'India', 'bowl', ''],
  ['Mayank Yadav', 'LSG', 'India', 'bowl', ''],
  ['Mohsin Khan', 'LSG', 'India', 'bowl', ''],
  ['M. Siddharth', 'LSG', 'India', 'bowl', ''],
  ['Ryan Rickelton', 'MI', 'South Africa', 'wk', 't20 odi test'],
  ['Mitchell Santner', 'MI', 'New Zealand', 'ar', 't20 odi test'],
  ['Naman Dhir', 'MI', 'India', 'ar', ''],
  ['Shardul Thakur', 'MI', 'India', 'ar', ''],
  ['Corbin Bosch', 'MI', 'South Africa', 'ar', 't20 odi test'],
  ['Azmatullah Omarzai', 'PBKS', 'Afghanistan', 'ar', 't20 odi'],
  ['Harpreet Brar', 'PBKS', 'India', 'ar', ''],
  ['Cooper Connolly', 'PBKS', 'Australia', 'ar', 't20 odi'],
  ['Ben Dwarshuis', 'PBKS', 'Australia', 'bowl', 't20 odi'],
  ['Vyshak Vijaykumar', 'PBKS', 'India', 'bowl', ''],
  ['Nehal Wadhera', 'PBKS', 'India', 'bat', ''],
  ['Shashank Singh', 'PBKS', 'India', 'bat', ''],
  ['Yash Thakur', 'PBKS', 'India', 'bowl', ''],
  ['Suryansh Shedge', 'PBKS', 'India', 'ar', ''],
  ['Romario Shepherd', 'RCB', 'West Indies', 'ar', 't20 odi'],
  ['Jacob Bethell', 'RCB', 'England', 'ar', 't20 odi test'],
  ['Jitesh Sharma', 'RCB', 'India', 'wk', 't20'],
  ['Mangesh Yadav', 'RCB', 'India', 'bowl', ''],
  ['Rasikh Dar', 'RCB', 'India', 'bowl', ''],
  ['Suyash Sharma', 'RCB', 'India', 'bowl', ''],
  ['Yash Dayal', 'RCB', 'India', 'bowl', ''],
  ['Tushar Deshpande', 'RR', 'India', 'bowl', ''],
  ['Sandeep Sharma', 'RR', 'India', 'bowl', ''],
  ['Vignesh Puthur', 'RR', 'India', 'bowl', ''],
  ['Kuldeep Sen', 'RR', 'India', 'bowl', ''],
  ['Shubham Dubey', 'RR', 'India', 'bat', ''],
  ['Liam Livingstone', 'SRH', 'England', 'ar', ''],
  ['Eshan Malinga', 'SRH', 'Sri Lanka', 'bowl', 'odi'],
  ['Aniket Verma', 'SRH', 'India', 'bat', ''],
  ['Jaydev Unadkat', 'SRH', 'India', 'bowl', ''],
  ['Gurjapneet Singh', 'CSK', 'India', 'bowl', ''],
  ['Matthew William Short', 'CSK', 'Australia', 'ar', 't20 odi'],
  ['Ramakrishna Ghosh', 'CSK', 'India', 'ar', ''],
  ['Aman Khan', 'CSK', 'India', 'ar', ''],
  ['Mukesh Choudhary', 'CSK', 'India', 'bowl', ''],
  ['Zak Foulkes', 'CSK', 'New Zealand', 'ar', 't20'],
  ['Auqib Dar', 'DC', 'India', 'bowl', ''],
  ['Sahil Parakh', 'DC', 'India', 'bat', ''],
  ['Ajay Mandal', 'DC', 'India', 'ar', ''],
  ['Tripurana Vijay', 'DC', 'India', 'ar', ''],
  ['Madhav Tiwari', 'DC', 'India', 'ar', ''],
  ['Dushmantha Chameera', 'DC', 'Sri Lanka', 'bowl', 't20 odi'],
  ['Mohd. Arshad Khan', 'GT', 'India', 'ar', ''],
  ['Luke Wood', 'GT', 'England', 'bowl', 't20'],
  ['Kumar Kushagra', 'GT', 'India', 'wk', ''],
  ['Nishant Sindhu', 'GT', 'India', 'ar', ''],
  ['Jayant Yadav', 'GT', 'India', 'ar', ''],
  ['Manav Suthar', 'GT', 'India', 'bowl', ''],
  ['Prithvi Raj Yarra', 'GT', 'India', 'bowl', ''],
  ['Tejasvi Singh', 'KKR', 'India', 'wk', ''],
  ['Anukul Roy', 'KKR', 'India', 'ar', ''],
  ['Sarthak Ranjan', 'KKR', 'India', 'bat', ''],
  ['Daksh Kamra', 'KKR', 'India', 'ar', ''],
  ['Kartik Tyagi', 'KKR', 'India', 'bowl', ''],
  ['Prashant Solanki', 'KKR', 'India', 'bowl', ''],
  ['Mukul Choudhary', 'LSG', 'India', 'bat', ''],
  ['Matthew Breetzke', 'LSG', 'South Africa', 'bat', 't20 odi test'],
  ['Arshin Kulkarni', 'LSG', 'India', 'ar', ''],
  ['Himmat Singh', 'LSG', 'India', 'bat', ''],
  ['Akash Singh', 'LSG', 'India', 'bowl', ''],
  ['Arjun Tendulkar', 'LSG', 'India', 'ar', ''],
  ['Naman Tiwari', 'LSG', 'India', 'bowl', ''],
  ['Allah Ghazanfar', 'MI', 'Afghanistan', 'bowl', 't20 odi'],
  ['Danish Malewar', 'MI', 'India', 'bat', ''],
  ['Robin Minz', 'MI', 'India', 'wk', ''],
  ['Raj Angad Bawa', 'MI', 'India', 'ar', ''],
  ['Atharva Ankolekar', 'MI', 'India', 'ar', ''],
  ['Mayank Rawat', 'MI', 'India', 'ar', ''],
  ['Mayank Markande', 'MI', 'India', 'bowl', ''],
  ['Ashwani Kumar', 'MI', 'India', 'bowl', ''],
  ['Raghu Sharma', 'MI', 'India', 'bowl', ''],
  ['Mohammad Izhar', 'MI', 'India', 'bowl', ''],
  ['Mitch Owen', 'PBKS', 'Australia', 'ar', 't20'],
  ['Xavier Bartlett', 'PBKS', 'Australia', 'bowl', 't20 odi'],
  ['Harnoor Pannu', 'PBKS', 'India', 'bat', ''],
  ['Pyla Avinash', 'PBKS', 'India', 'bat', ''],
  ['Vishnu Vinod', 'PBKS', 'India', 'wk', ''],
  ['Musheer Khan', 'PBKS', 'India', 'ar', ''],
  ['Pravin Dubey', 'PBKS', 'India', 'bowl', ''],
  ['Vishal Nishad', 'PBKS', 'India', 'bowl', ''],
  ['Nuwan Thushara', 'RCB', 'Sri Lanka', 'bowl', 't20'],
  ['Jacob Duffy', 'RCB', 'New Zealand', 'bowl', 't20 odi test'],
  ['Jordan Cox', 'RCB', 'England', 'wk', 't20'],
  ['Swapnil Singh', 'RCB', 'India', 'ar', ''],
  ['Satvik Deswal', 'RCB', 'India', 'ar', ''],
  ['Vicky Ostwal', 'RCB', 'India', 'ar', ''],
  ['Vihaan Malhotra', 'RCB', 'India', 'bat', ''],
  ['Kanishk Chouhan', 'RCB', 'India', 'ar', ''],
  ['Abhinandan Singh', 'RCB', 'India', 'bowl', ''],
  ['Kwena Maphaka', 'RR', 'South Africa', 'bowl', 't20 odi'],
  ['Adam Milne', 'RR', 'New Zealand', 'bowl', ''],
  ['Nandre Burger', 'RR', 'South Africa', 'bowl', 't20 odi test'],
  ['Donovan Ferreira', 'RR', 'South Africa', 'bat', 't20'],
  ['Lhuan-dre Pretorius', 'RR', 'South Africa', 'wk', 't20 odi test'],
  ['Aman Rao Perala', 'RR', 'India', 'bat', ''],
  ['Ravi Singh', 'RR', 'India', 'wk', ''],
  ['Yudhvir Singh Charak', 'RR', 'India', 'bowl', ''],
  ['Sushant Mishra', 'RR', 'India', 'bowl', ''],
  ['Yash Raj Punja', 'RR', 'India', 'bowl', ''],
  ['Brijesh Sharma', 'RR', 'India', 'bowl', ''],
  ['Jack Edwards', 'SRH', 'Australia', 'ar', ''],
  ['Salil Arora', 'SRH', 'India', 'wk', ''],
  ['Kamindu Mendis', 'SRH', 'Sri Lanka', 'ar', 't20 odi test'],
  ['Brydon Carse', 'SRH', 'England', 'bowl', 't20 odi test'],
  ['Smaran Ravichandran', 'SRH', 'India', 'bat', ''],
  ['Harsh Dubey', 'SRH', 'India', 'ar', ''],
  ['Shivang Kumar', 'SRH', 'India', 'ar', ''],
  ['Krains Fuletra', 'SRH', 'India', 'bowl', ''],
  ['Zeeshan Ansari', 'SRH', 'India', 'bowl', ''],
  ['Sakib Hussain', 'SRH', 'India', 'bowl', ''],
  ['Onkar Tarmale', 'SRH', 'India', 'bowl', ''],
  ['Amit Kumar', 'SRH', 'India', 'bowl', ''],
  ['Praful Hinge', 'SRH', 'India', 'bowl', ''],
  ['Shivam Mavi', 'SRH', 'India', 'bowl', ''],
  ['Blessing Muzarabani', 'KKR', 'Zimbabwe', 'bowl', 't20 odi test'],
]
